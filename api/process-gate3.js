/**
 * Gate 3 Cleanup API - Process all existing unverified community reports
 * and trigger community_oracle_validate on eligible escrows.
 *
 * This retroactively fixes reports submitted before the auto-verify fix.
 *
 * POST /api/process-gate3
 * Body: { secretKey: "S..." }  (admin or AI auditor key for signing)
 * Returns: { verified: N, gate3Triggered: N, details: [...] }
 */
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { secretKey } = req.body || {};

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid secret key required (admin or auditor)" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const COMMUNITY_ORACLE = "CCMVMF2ZJULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
    const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const NETWORK = "Test SDF Network ; September 2015";

    const signerKp = Keypair.fromSecret(secretKey);
    const signerPub = signerKp.publicKey();

    const server = new rpc.Server(RPC_URL);
    const oracleContract = new Contract(COMMUNITY_ORACLE);
    const escrowContract = new Contract(ESCROW);

    function makeSource(seq) {
      return {
        accountId: () => signerPub,
        sequenceNumber: () => seq,
        incrementSequenceNumber: () => {},
      };
    }

    async function simulate(fnName, contract, ...args) {
      const account = await server.getAccount(signerPub);
      const tx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
        fee: "100000", networkPassphrase: NETWORK,
      }).addOperation(contract.call(fnName, ...args)).setTimeout(30).build();
      const sim = await server.simulateTransaction(tx);
      if (sim.error) return null;
      return sim.result?.retval ?? null;
    }

    async function submitTx(tx) {
      const prepared = await server.prepareTransaction(tx);
      prepared.sign(signerKp);
      const result = await server.sendTransaction(prepared);
      if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
        throw new Error(`Tx status: ${result.status}`);
      }
      // Poll for confirmation
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const resp = await server.getTransaction(result.hash);
          if (resp.status !== "NOT_FOUND") return resp;
        } catch {}
      }
      return null;
    }

    function parseScValMap(sv) {
      const result = {};
      for (const entry of sv.map()) {
        const key = entry.key().sym().toString();
        const val = entry.val();
        switch (val.switch().name) {
          case "scvU32": result[key] = val.u32(); break;
          case "scvU64": result[key] = Number(val.u64().toString()); break;
          case "scvBool": result[key] = val.b(); break;
          case "scvString": result[key] = val.str().toString(); break;
          case "scvVec": result[key] = val.vec().length; break;
          case "scvMap": result[key] = parseScValMap(val); break;
          default: result[key] = null;
        }
      }
      return result;
    }

    // ── Step 1: Get report count ────────────────────────
    const countRv = await simulate("get_report_count", oracleContract);
    const reportCount = countRv ? Number(countRv.u32().toString()) : 0;
    console.log(`Found ${reportCount} community reports`);

    const details = [];
    let verifiedCount = 0;

    // ── Step 2: Scan all reports, verify unverified ones ──
    for (let id = 1; id <= reportCount; id++) {
      const rv = await simulate("get_report", oracleContract, nativeToScVal(id, { type: "u32" }));
      if (!rv || rv.switch().name === "scvVoid") continue;

      const parsed = parseScValMap(rv);
      if (parsed.verified) continue;

      console.log(`  Report #${id}: unverified (PVO ${parsed.pvo_id}), verifying...`);

      const account = await server.getAccount(signerPub);
      const verifyTx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
        fee: "100000", networkPassphrase: NETWORK,
      }).addOperation(oracleContract.call(
        "verify_report",
        new Address(signerPub).toScVal(),
        xdr.ScVal.scvU32(id),
        xdr.ScVal.scvU32(30),
      )).setTimeout(30).build();

      try {
        const confirmed = await submitTx(verifyTx);
        if (confirmed?.status === "SUCCESS") {
          verifiedCount++;
          details.push({ reportId: id, pvoId: parsed.pvo_id, action: "verified", status: "success" });
          console.log(`  Report #${id}: verified`);
        } else {
          details.push({ reportId: id, pvoId: parsed.pvo_id, action: "verify", status: confirmed?.status || "timeout" });
        }
      } catch (e) {
        details.push({ reportId: id, pvoId: parsed.pvo_id, action: "verify", status: "failed", error: e.message?.slice(0, 80) });
        console.error(`  Report #${id}: verify failed: ${e.message?.slice(0, 80)}`);
      }
    }

    // ── Step 3: Get PVO count and scan escrows for Gate 3 ──
    const PVO_CORE = "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B";
    const pvoContract = new Contract(PVO_CORE);
    const pvoCountRv = await simulate("get_pvo_count", pvoContract);
    const pvoCount = pvoCountRv ? Number(pvoCountRv.u32().toString()) : 0;

    let gate3Triggered = 0;

    for (let pid = 1; pid <= pvoCount; pid++) {
      const escRv = await simulate(
        "get_escrows_by_pvo", escrowContract,
        nativeToScVal(pid, { type: "u32" }),
      );
      if (!escRv || escRv.switch().name !== "scvVec") continue;

      const escVec = escRv.vec();
      for (let i = 0; i < escVec.length; i++) {
        const entry = escVec.at(i);
        const map = parseScValMap(entry);
        const escId = map.id;
        const conditions = map.conditions || {};
        const status = map.status;

        if (conditions.community_oracle_validation) continue;

        console.log(`  Escrow #${escId} (PVO ${pid}): Gate 3 not passed, checking...`);

        const account = await server.getAccount(signerPub);
        const gate3Tx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
          fee: "100000", networkPassphrase: NETWORK,
        }).addOperation(escrowContract.call(
          "community_oracle_validate",
          new Address(signerPub).toScVal(),
          xdr.ScVal.scvU32(escId),
        )).setTimeout(30).build();

        // Simulate first
        const gate3Sim = await server.simulateTransaction(gate3Tx);
        if (gate3Sim.error) {
          details.push({ escrowId: escId, pvoId: pid, action: "gate3", status: "sim_failed", error: (gate3Sim.error || "").slice(0, 80) });
          console.log(`    Sim failed: ${(gate3Sim.error || "").slice(0, 80)}`);
          continue;
        }

        try {
          const confirmed = await submitTx(gate3Tx);
          if (confirmed?.status === "SUCCESS") {
            gate3Triggered++;
            details.push({ escrowId: escId, pvoId: pid, action: "gate3", status: "success" });
            console.log(`    Gate 3 passed!`);
          } else {
            details.push({ escrowId: escId, pvoId: pid, action: "gate3", status: confirmed?.status || "timeout" });
          }
        } catch (e) {
          details.push({ escrowId: escId, pvoId: pid, action: "gate3", status: "failed", error: e.message?.slice(0, 80) });
          console.error(`    Submit failed: ${e.message?.slice(0, 80)}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      reportCount,
      verifiedCount,
      gate3Triggered,
      details,
    });
  } catch (err) {
    console.error("Gate3 cleanup error:", err);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
