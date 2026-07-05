// Setup trustlines for all role wallets
// pPHP_SAC for all wallets, RPT for citizens
// Run from /Users/tata/stellar/frontend

const { Asset, Operation, TransactionBuilder, rpc, Keypair } = require("@stellar/stellar-sdk");
const { execSync } = require("child_process");

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";

const PPHP = new Asset("pPHP", ISSUER);
const RPT = new Asset("RPT", ISSUER);

// Wallet name -> { needsPphp: bool, needsRpt: bool }
const WALLETS = {
  // Original 14 roles — all need pPHP
  alice:               { pphp: true, rpt: false },
  bob:                 { pphp: true, rpt: true },
  citizen:             { pphp: true, rpt: true },
  gov_agency_role:     { pphp: true, rpt: false },
  contractor_role:     { pphp: true, rpt: false },
  engineer_role:       { pphp: true, rpt: false },
  inspector_role:      { pphp: true, rpt: false },
  auditor_role:        { pphp: true, rpt: false },
  coa_role:            { pphp: true, rpt: false },
  anticorruption_role: { pphp: true, rpt: false },
  funding_agency_role: { pphp: true, rpt: false },
  donor_role:          { pphp: true, rpt: false },
  ai_auditor_role:     { pphp: true, rpt: false },
  // 5 donors
  donor_1:  { pphp: true, rpt: false },
  donor_2:  { pphp: true, rpt: false },
  donor_3:  { pphp: true, rpt: false },
  donor_4:  { pphp: true, rpt: false },
  donor_5:  { pphp: true, rpt: false },
  // 10 contractors
  contractor_1:  { pphp: true, rpt: false },
  contractor_2:  { pphp: true, rpt: false },
  contractor_3:  { pphp: true, rpt: false },
  contractor_4:  { pphp: true, rpt: false },
  contractor_5:  { pphp: true, rpt: false },
  contractor_6:  { pphp: true, rpt: false },
  contractor_7:  { pphp: true, rpt: false },
  contractor_8:  { pphp: true, rpt: false },
  contractor_9:  { pphp: true, rpt: false },
  contractor_10: { pphp: true, rpt: false },
  // 5 engineers
  engineer_1: { pphp: true, rpt: false },
  engineer_2: { pphp: true, rpt: false },
  engineer_3: { pphp: true, rpt: false },
  engineer_4: { pphp: true, rpt: false },
  engineer_5: { pphp: true, rpt: false },
  // 10 citizens — need both pPHP and RPT
  citizen_1:  { pphp: true, rpt: true },
  citizen_2:  { pphp: true, rpt: true },
  citizen_3:  { pphp: true, rpt: true },
  citizen_4:  { pphp: true, rpt: true },
  citizen_5:  { pphp: true, rpt: true },
  citizen_6:  { pphp: true, rpt: true },
  citizen_7:  { pphp: true, rpt: true },
  citizen_8:  { pphp: true, rpt: true },
  citizen_9:  { pphp: true, rpt: true },
  citizen_10: { pphp: true, rpt: true },
};

function getSecretKey(name) {
  try {
    const output = execSync("~/.local/bin/stellar keys show " + name + " 2>/dev/null", { encoding: "utf-8" }).trim();
    const match = output.match(/^(S[A-Z0-9]+)$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getAddress(name) {
  return execSync("~/.local/bin/stellar keys address " + name + " 2>/dev/null", { encoding: "utf-8" }).trim();
}

async function setupTrustlines(name, config) {
  const secret = getSecretKey(name);
  if (!secret) { console.log("  [SKIP] " + name + " — no secret key found"); return false; }

  const address = getAddress(name);
  const kp = Keypair.fromSecret(secret);
  const server = new rpc.Server(RPC_URL);

  let account;
  try {
    account = await server.getAccount(address);
  } catch {
    console.log("  [SKIP] " + name + " — account not funded");
    return false;
  }

  const ops = [];
  if (config.pphp) ops.push(Operation.changeTrust({ asset: PPHP }));
  if (config.rpt)  ops.push(Operation.changeTrust({ asset: RPT }));

  if (ops.length === 0) return true;

  try {
    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(ops[0])
      .setTimeout(30);
    if (ops[1]) tx.addOperation(ops[1]);
    const built = tx.build();
    built.sign(kp);
    const result = await server.sendTransaction(built);
    if (result.status === "PENDING" || result.status === "DUPLICATE" || result.status === "TRY_AGAIN_LATER") {
      const labels = [];
      if (config.pphp) labels.push("pPHP");
      if (config.rpt) labels.push("RPT");
      console.log("  [OK] " + name + " (" + address.slice(0, 12) + "...) — " + labels.join(" + "));
      return true;
    } else {
      console.log("  [FAIL] " + name + " — status: " + result.status);
      return false;
    }
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes("already") || msg.includes("exist")) {
      console.log("  [OK] " + name + " — trustlines already exist");
      return true;
    }
    console.log("  [FAIL] " + name + " — " + msg.slice(0, 100));
    return false;
  }
}

async function main() {
  console.log("=== Setting up trustlines for all role wallets ===\n");

  const names = Object.keys(WALLETS);
  let ok = 0, fail = 0;

  for (const name of names) {
    const success = await setupTrustlines(name, WALLETS[name]);
    if (success) ok++; else fail++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n=== Done: " + ok + " success, " + fail + " failed ===\n");

  // Verify a few balances
  console.log("=== Verification ===");
  const server = new rpc.Server(RPC_URL);
  for (const name of ["funding_agency_role", "contractor_1", "citizen_1", "donor_1"]) {
    try {
      const addr = getAddress(name);
      const acct = await server.getAccount(addr);
      const balances = acct.balances.filter(b => b.asset_type !== "native");
      const trustlines = balances.map(b => b.asset_code + ":" + b.balance).join(", ") || "none";
      console.log("  " + name + ": " + trustlines);
    } catch (e) {
      console.log("  " + name + ": error checking");
    }
  }
}

main().catch(console.error);
