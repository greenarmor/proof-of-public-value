#!/usr/bin/env node
/**
 * Gate 3 Cleanup Script - Process all existing unverified community reports
 * and trigger community_oracle_validate on eligible escrows.
 *
 * Run locally: npx tsx scripts/process-gate3.mjs
 * Or: node scripts/process-gate3.mjs
 *
 * Signs with AI Auditor key from env or .env file.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env
const envPath = resolve(".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0 && !process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
}

const SECRET_KEY = process.env.AI_AUDITOR_SECRET || process.argv[2] || "";

if (!SECRET_KEY || !SECRET_KEY.startsWith("S")) {
  console.error("Usage: npx tsx scripts/process-gate3.mjs [SECRET_KEY]");
  console.error("Or set AI_AUDITOR_SECRET in .env");
  process.exit(1);
}

const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
const PVO_CORE = "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK = "Test SDF Network ; September 2015";

async function main() {
  const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
    await import("@stellar/stellar-sdk");

  const kp = Keypair.fromSecret(SECRET_KEY);
  const pub = kp.publicKey();
  console.log(`Signer: ${pub}`);

  const server = new rpc.Server(RPC_URL);
  const oracle = new Contract(COMMUNITY_ORACLE);
  const escrow = new Contract(ESCROW);
  const pvoContract = new Contract(PVO_CORE);

  function makeSource(seq) {
    return {
      accountId: () => pub,
      sequenceNumber: () => seq,
      incrementSequenceNumber: () => {},
    };
  }

  async function sim(fnName, contract, ...args) {
    const account = await server.getAccount(pub);
    const tx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
      fee: "100000", networkPassphrase: NETWORK,
    }).addOperation(contract.call(fnName, ...args)).setTimeout(30).build();
    const s = await server.simulateTransaction(tx);
    if (s.error) return null;
    return s.result?.retval ?? null;
  }

  async function submitTx(tx) {
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(kp);
    const result = await server.sendTransaction(prepared);
    if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
      throw new Error(`Tx status: ${result.status}`);
    }
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const resp = await server.getTransaction(result.hash);
        if (resp.status !== "NOT_FOUND") return resp;
      } catch {}
    }
    return null;
  }

  function parseMap(sv) {
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
        case "scvMap": result[key] = parseMap(val); break;
        default: result[key] = null;
      }
    }
    return result;
  }

  // ── Step 1: Get report count ────────────────────────
  const countRv = await sim("get_report_count", oracle);
  const reportCount = countRv ? Number(countRv.u32().toString()) : 0;
  console.log(`\nFound ${reportCount} community reports`);

  let verifiedCount = 0;

  // ── Step 2: Verify unverified reports ────────────────
  for (let id = 1; id <= reportCount; id++) {
    const rv = await sim("get_report", oracle, nativeToScVal(id, { type: "u32" }));
    if (!rv || rv.switch().name === "scvVoid") continue;

    const parsed = parseMap(rv);
    if (parsed.verified) {
      console.log(`  Report #${id}: already verified (PVO ${parsed.pvo_id})`);
      continue;
    }

    console.log(`  Report #${id}: unverified (PVO ${parsed.pvo_id}), verifying...`);
    const account = await server.getAccount(pub);
    const tx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
      fee: "100000", networkPassphrase: NETWORK,
    }).addOperation(oracle.call(
      "verify_report",
      new Address(pub).toScVal(),
      xdr.ScVal.scvU32(id),
      xdr.ScVal.scvU32(30),
    )).setTimeout(30).build();

    try {
      const confirmed = await submitTx(tx);
      if (confirmed?.status === "SUCCESS") {
        verifiedCount++;
        console.log(`    Verified!`);
      } else {
        console.log(`    Failed: ${confirmed?.status || "timeout"}`);
      }
    } catch (e) {
      console.error(`    Error: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\nVerified ${verifiedCount} reports`);

  // ── Step 3: Trigger Gate 3 on escrows ────────────────
  // Scan ALL escrows directly (not by PVO) to handle non-sequential IDs
  const escCountRv = await sim("get_escrow_count", escrow);
  const escCount = escCountRv ? Number(escCountRv.u32().toString()) : 0;
  console.log(`\nScanning ${escCount} escrows for Gate 3...`);

  let gate3Triggered = 0;

  async function tryEscrowGate3(escId) {
    const escRv = await sim("get_escrow", escrow, nativeToScVal(escId, { type: "u32" }));
    if (!escRv || escRv.switch().name === "scvVoid") return false;

    const map = parseMap(escRv);
    const pvoId = map.pvo_id || "?";
    const conditions = map.conditions || {};

    if (conditions.community_oracle_validation) {
      console.log(`  Escrow #${escId} (PVO ${pvoId}): Gate 3 already passed`);
      return false;
    }

    console.log(`  Escrow #${escId} (PVO ${pvoId}): Gate 3 not passed, attempting...`);

    const account = await server.getAccount(pub);
    const gate3Tx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
      fee: "100000", networkPassphrase: NETWORK,
    }).addOperation(escrow.call(
      "community_oracle_validate",
      new Address(pub).toScVal(),
      xdr.ScVal.scvU32(escId),
    )).setTimeout(30).build();

    const gate3Sim = await server.simulateTransaction(gate3Tx);
    if (gate3Sim.error) {
      console.log(`    Skip: ${(gate3Sim.error || "").slice(0, 80)}`);
      return false;
    }

    try {
      const confirmed = await submitTx(gate3Tx);
      if (confirmed?.status === "SUCCESS") {
        gate3Triggered++;
        console.log(`    Gate 3 PASSED!`);
        return true;
      } else {
        console.log(`    Failed: ${confirmed?.status || "timeout"}`);
      }
    } catch (e) {
      console.error(`    Error: ${e.message?.slice(0, 100)}`);
    }
    return false;
  }

  for (let escId = 1; escId <= escCount; escId++) {
    await tryEscrowGate3(escId);
  }

  // Scan forward for non-sequential escrow IDs
  let nones = 0;
  let escId = escCount + 1;
  while (nones < 15) {
    const found = await tryEscrowGate3(escId);
    // can't easily distinguish "not found" from "already passed" - check raw
    const escRv = await sim("get_escrow", escrow, nativeToScVal(escId, { type: "u32" }));
    if (!escRv || escRv.switch().name === "scvVoid") {
      nones++;
    } else {
      nones = 0;
    }
    escId++;
  }

  console.log(`\n=== DONE ===`);
  console.log(`Reports verified: ${verifiedCount}`);
  console.log(`Gate 3 triggered: ${gate3Triggered}`);
}

main().catch((e) => {
  console.error("Fatal:", e.message?.slice(0, 200));
  process.exit(1);
});
