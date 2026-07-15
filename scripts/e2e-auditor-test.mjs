#!/usr/bin/env node
/**
 * E2E Dry-Run Test - AI Auditor Gate 5 Flow
 *
 * Simulates the full Gate 5 workflow without submitting any transactions.
 * Verifies that escrows awaiting Gate 5 are correctly identified and the
 * auditor decision endpoint responds correctly.
 */

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK = "Test SDF Network ; September 2015";
const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
const AI_ORACLE = "CAVOYO6RPO3P6WRTD73Y4EQCWZVSCY6JCWELG3MFKNIIQ7IJCGNRWR7G";
const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";

async function main() {
  const { Contract, TransactionBuilder, rpc, nativeToScVal, xdr, Address } =
    await import("@stellar/stellar-sdk");

  const server = new rpc.Server(RPC_URL);
  const escrowContract = new Contract(ESCROW);
  const aiOracleContract = new Contract(AI_ORACLE);
  const commOracleContract = new Contract(COMMUNITY_ORACLE);
  const dummy = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  function makeSource() {
    return { accountId: () => dummy, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  }

  function makeTx(contract, method, ...args) {
    return new TransactionBuilder(makeSource(), { fee: "100000", networkPassphrase: NETWORK })
      .addOperation(contract.call(method, ...args)).setTimeout(30).build();
  }

  async function sim(contract, method, ...args) {
    const tx = makeTx(contract, method, ...args);
    const s = await server.simulateTransaction(tx);
    if (s.error) return { error: String(s.error).slice(0, 120) };
    return s.result?.retval ?? null;
  }

  function parseScValMap(sv) {
    const result = {};
    for (const entry of sv.map()) {
      const key = entry.key().sym().toString();
      const val = entry.val();
      switch (val.switch().name) {
        case "scvU32": result[key] = Number(val.u32().toString()); break;
        case "scvU64": result[key] = Number(val.u64().toString()); break;
        case "scvBool": result[key] = val.b(); break;
        case "scvString": result[key] = val.str().toString(); break;
        case "scvSymbol": result[key] = val.sym().toString(); break;
        case "scvVec": {
          const v = val.vec();
          result[key] = Array.from({ length: v.length }, (_, i) => {
            const e = v.at(i);
            if (e.switch().name === "scvSymbol") return e.sym().toString();
            if (e.switch().name === "scvMap") return parseScValMap(e);
            return e.switch().name;
          });
          break;
        }
        case "scvMap": result[key] = parseScValMap(val); break;
        case "scvAddress": try { result[key] = val.address().toString(); } catch { result[key] = "address"; } break;
        default: result[key] = val.switch().name;
      }
    }
    return result;
  }

  console.log("═══ AI Auditor Gate 5 E2E Dry-Run Test ═══\n");
  console.log("⚠️  No transactions submitted — simulation only\n");

  // ── Step 1: Scan all escrows ──────────────────────────
  console.log("📋 Step 1: Scan all escrows for Gate 5 readiness\n");

  const escCountRv = await sim(escrowContract, "get_escrow_count");
  const escCount = escCountRv ? Number(escCountRv.u32().toString()) : 0;
  console.log(`  Total escrows on-chain: ${escCount}\n`);

  const pendingReviews = [];
  const passedGate5 = [];

  // Scan 1..escCount + forward for non-sequential
  const maxScan = escCount + 15;
  for (let id = 1; id <= maxScan; id++) {
    const rv = await sim(escrowContract, "get_escrow", nativeToScVal(id, { type: "u32" }));
    if (!rv || rv.switch().name === "scvVoid") continue;

    const e = parseScValMap(rv);
    if (!e.id) continue;

    const conditions = e.conditions || {};
    const gates = {
      g1: conditions.engineer_approval || false,
      g2: conditions.compliance_validation || false,
      g3: conditions.community_oracle_validation || false,
      g4: (conditions.community_confirmation || 0) >= (conditions.community_required || 1),
      g5: conditions.ai_risk_check || false,
    };

    const gates14Passed = gates.g1 && gates.g2 && gates.g3 && gates.g4;
    const gatesCount = [gates.g1, gates.g2, gates.g3, gates.g4, gates.g5].filter(Boolean).length;

    if (gates.g5) {
      passedGate5.push({ escrowId: id, pvoId: e.pvo_id, gates, status: typeof e.status === "string" ? e.status : (e.status?.[0] || "unknown") });
    } else if (gates14Passed) {
      pendingReviews.push({ escrowId: id, pvoId: e.pvo_id, gates, milestoneId: e.milestone_id, amount: e.amount });
    }

    console.log(`  Escrow #${id} PVO ${e.pvo_id}: ${gatesCount}/5 gates passed [G1:${gates.g1?"✓":"✗"} G2:${gates.g2?"✓":"✗"} G3:${gates.g3?"✓":"✗"} G4:${gates.g4?"✓(" + conditions.community_confirmation + "/" + (conditions.community_required||1) + ")":"✗"} G5:${gates.g5?"✓":"✗"}]${gates14Passed && !gates.g5 ? " ← AWAITING AUDITOR" : ""}`);
  }

  // ── Step 2: Show pending reviews ──────────────────────
  console.log(`\n📋 Step 2: Pending Auditor Reviews\n`);

  if (pendingReviews.length === 0) {
    console.log("  ✅ No escrows awaiting Gate 5 review (all decided)\n");
  } else {
    console.log(`  Found ${pendingReviews.length} escrow(s) needing human auditor decision:\n`);

    for (const p of pendingReviews) {
      console.log(`  ┌─ Escrow #${p.escrowId} (PVO #${p.pvoId}) ─────────────────────┐`);

      // Fetch AI Oracle fraud data
      try {
        const fraudRv = await sim(aiOracleContract, "get_fraud_by_pvo", nativeToScVal(Number(p.pvoId), { type: "u32" }));
        if (fraudRv && fraudRv.switch().name === "scvVec" && fraudRv.vec().length > 0) {
          const fraud = parseScValMap(fraudRv.vec().at(fraudRv.vec().length - 1));
          const riskScore = Number(fraud.risk_score || 0);
          const recommendation = riskScore < 50 ? "PASS" : "REJECT";
          console.log(`  │  🤖 AI Oracle Recommendation: ${recommendation}`);
          console.log(`  │  Risk Score: ${riskScore}/100  |  Confidence: ${fraud.confidence || "N/A"}%`);
          console.log(`  │  Indicators: ${fraud.indicators || "none"}`);
        } else {
          console.log(`  │  🤖 AI Oracle: No fraud data submitted yet`);
        }
      } catch {}

      // Fetch verified community reports
      try {
        const verifiedRv = await sim(commOracleContract, "get_verified_report_count", nativeToScVal(Number(p.pvoId), { type: "u32" }));
        const vCount = verifiedRv ? Number(verifiedRv.u32().toString()) : 0;
        console.log(`  │  📸 Verified Community Reports: ${vCount}`);
      } catch {}

      console.log(`  │  💰 Escrow Amount: ${p.amount || "N/A"}`);
      console.log(`  │  📍 Milestone: #${p.milestoneId || "?"}`);
      console.log(`  │`);
      console.log(`  │  🧑‍⚖️  Auditor Decision: [ ] PASS   [ ] FAIL   [ ] DISPUTE`);
      console.log(`  └──────────────────────────────────────────────────┘\n`);
    }
  }

  // ── Step 3: Already-passed Gate 5 escrows ─────────────
  if (passedGate5.length > 0) {
    console.log(`📋 Step 3: Escrows with Gate 5 Already Passed\n`);
    for (const p of passedGate5) {
      console.log(`  Escrow #${p.escrowId} PVO ${p.pvoId}: Gate 5 passed (status: ${p.status})`);
    }
  }

  // ── Step 4: Test auditor-decision API simulation ──────
  if (pendingReviews.length > 0) {
    console.log(`\n📋 Step 4: Simulate Auditor Decision (dry-run)\n`);

    for (const p of pendingReviews) {
      const auditorAddress = "GAKJTLALTPWV4DLQGUCBMSO36EL3YIXK6X774D27Q3HBIR4GPDX2BL5J";
      const simTx = makeTx(escrowContract, "ai_validate",
        new Address(auditorAddress).toScVal(),
        xdr.ScVal.scvU32(p.escrowId),
        xdr.ScVal.scvBool(true),
      );

      const decisionSim = await server.simulateTransaction(simTx);
      if (decisionSim.error) {
        console.log(`  Escrow #${p.escrowId}: Simulate PASS → ❌ Would fail: ${String(decisionSim.error).slice(0, 100)}`);
      } else {
        console.log(`  Escrow #${p.escrowId}: Simulate PASS → ✅ Would succeed on-chain`);
      }

      // Also simulate fail
      const failSimTx = makeTx(escrowContract, "ai_validate",
        new Address(auditorAddress).toScVal(),
        xdr.ScVal.scvU32(p.escrowId),
        xdr.ScVal.scvBool(false),
      );
      const failSim = await server.simulateTransaction(failSimTx);
      if (failSim.error) {
        console.log(`  Escrow #${p.escrowId}: Simulate FAIL → ❌ Would fail: ${String(failSim.error).slice(0, 100)}`);
      } else {
        console.log(`  Escrow #${p.escrowId}: Simulate FAIL → ✅ Would succeed on-chain`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────
  console.log(`\n═══ Test Summary ═══`);
  console.log(`  Total escrows scanned:  ${escCount}`);
  console.log(`  Gate 5 already passed:  ${passedGate5.length}`);
  console.log(`  Awaiting auditor:       ${pendingReviews.length}`);
  console.log(`  🔒 No transactions submitted — all simulations`);
  console.log(`  🧑‍⚖️  AI Auditor reviews at: /auditor → Escrow Gate tab\n`);
}

main().catch(e => {
  console.error("Test failed:", e.message?.slice(0, 300));
  process.exit(1);
});
