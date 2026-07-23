import http from "http";
import { join } from "path";
import { readFileSync, existsSync, statSync } from "fs";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const RPC_FALLBACK = "https://soroban-rpc.testnet.stellar.gateway.fm";

async function getRpcServer(_rpc?: any) {
  for (const url of [RPC_URL, RPC_FALLBACK]) {
    try {
      const { rpc: r } = await import("@stellar/stellar-sdk");
      const s = new r.Server(url);
      await s.getLatestLedger();
      return s;
    } catch {}
  }
  const { rpc } = await import("@stellar/stellar-sdk");
  return new rpc.Server(RPC_URL);
}
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const PPHP_ISSUER = "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO";
const ACCESS_CONTROL = "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI";
const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
const PVO_CORE = "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B";

const PROVENANCE_PATH = join(process.cwd(), "..", "provenance-store.json");
const DIST_DIR = join(process.cwd(), "dist");
const PORT = 5174;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const REDACTED = "redacted";

function safeError(err: any): string {
  const raw = err?.response?.data?.extras?.result_codes?.transaction || err?.message || "Unknown error";
  return typeof raw === "string" ? raw.slice(0, 120).replace(/S[A-Z0-9]{55}/g, REDACTED) : "Internal error";
}

async function handleClaimRpt(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    let address: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      address = url.searchParams.get("address");
    } else if (req.method === "POST") {
      const body = await readBody(req);
      try { address = JSON.parse(body).address; } catch {
        return sendJson(res, 400, { error: "Invalid JSON body" });
      }
    }
    if (!address || !address.startsWith("G")) return sendJson(res, 400, { error: "Valid address required" });

    const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
    if (!ADMIN_SECRET) return sendJson(res, 500, { error: "Server not configured" });

    const { Keypair, Asset, Operation, TransactionBuilder, Networks, Horizon } =
      await import("@stellar/stellar-sdk");
    const stellarServer = new Horizon.Server(HORIZON_URL);
    const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

    let alreadyHasRpt = false;
    try {
      const acctData = await stellarServer.loadAccount(address);
      const rptBalance = acctData.balances.find(
        (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
      );
      if (rptBalance && Number(rptBalance.balance) >= 1) alreadyHasRpt = true;
    } catch {
      return sendJson(res, 400, { error: "Wallet not found or no trustline" });
    }
    if (alreadyHasRpt) return sendJson(res, 200, { success: true, alreadyOwned: true, message: "Already has RPT" });

    const acctData = await stellarServer.loadAccount(address);
    const hasTrustline = acctData.balances.some(
      (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );
    if (!hasTrustline) return sendJson(res, 400, { error: "No RPT trustline", needsTrustline: true });

    const adminAccount = await stellarServer.loadAccount(adminKeypair.publicKey());
    const rptAsset = new Asset("RPT", RPT_ISSUER);
    const tx = new TransactionBuilder(adminAccount, { fee: "100000", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: address, asset: rptAsset, amount: "1" }))
      .setTimeout(30).build();
    tx.sign(adminKeypair);
    const result = await stellarServer.submitTransaction(tx);
    sendJson(res, 200, { success: true, txHash: result.hash, alreadyOwned: false });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleClaimCitizen(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    let address: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      address = url.searchParams.get("address");
    } else if (req.method === "POST") {
      const body = await readBody(req);
      try { address = JSON.parse(body).address; } catch {
        return sendJson(res, 400, { error: "Invalid JSON body" });
      }
    }
    if (!address || !address.startsWith("G")) return sendJson(res, 400, { error: "Valid address required" });

    const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
    if (!ADMIN_SECRET) return sendJson(res, 500, { error: "Server not configured" });

    const { Keypair, Address, Contract, TransactionBuilder, Horizon, rpc, xdr } =
      await import("@stellar/stellar-sdk");
    const horizonServer = new Horizon.Server(HORIZON_URL);
    let hasRpt = false;
    try {
      const acctData = await horizonServer.loadAccount(address);
      const rptBalance = acctData.balances.find(
        (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
      );
      if (rptBalance && Number(rptBalance.balance) >= 1) hasRpt = true;
    } catch {
      return sendJson(res, 400, { error: "Wallet not found on testnet" });
    }
    if (!hasRpt) return sendJson(res, 403, { error: "Must hold 1+ RPT to become a citizen" });

    const sorobanServer = new rpc.Server(RPC_URL);
    const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
    const adminAddr = adminKeypair.publicKey();
    const adminAccount = await sorobanServer.getAccount(adminAddr);
    const adminAddress = new Address(adminAddr);
    const targetAddr = new Address(address);
    const acContract = new Contract(ACCESS_CONTROL);

    const tx = new TransactionBuilder(adminAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(
        acContract.call("assign_role",
          adminAddress.toScVal(),
          targetAddr.toScVal(),
          xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Citizen")]),
        ),
      ).setTimeout(30).build();

    const prepared = await sorobanServer.prepareTransaction(tx);
    prepared.sign(adminKeypair);
    const result = await sorobanServer.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      sendJson(res, 200, { success: true, txHash: (result as any).hash, alreadyCitizen: false });
    } else {
      sendJson(res, 500, { error: `Transaction status: ${result.status}` });
    }
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleSetupTrustline(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { secretKey } = JSON.parse(body);
    if (!secretKey?.startsWith("S") || secretKey.length < 55) return sendJson(res, 400, { error: "Valid secret key required" });

    const { Keypair, Asset, Operation, TransactionBuilder, Networks } = await import("@stellar/stellar-sdk");
    const walletKp = Keypair.fromSecret(secretKey);
    const walletAddr = walletKp.publicKey();

    const acctR = await fetch(`${HORIZON_URL}/accounts/${walletAddr}`);
    if (!acctR.ok) return sendJson(res, 400, { error: "Wallet account not found on testnet" });
    const acct: any = await acctR.json();
    const balances = acct.balances || [];

    const hasRpt = balances.some((b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER);
    const hasPphp = balances.some((b: any) => b.asset_code === "pPHP" && b.asset_issuer === PPHP_ISSUER);

    if (hasRpt && hasPphp) return sendJson(res, 200, { success: true, alreadySetup: true, created: [] });

    const ops: any[] = [];
    const created: string[] = [];
    if (!hasRpt) { ops.push(Operation.changeTrust({ asset: new Asset("RPT", RPT_ISSUER) })); created.push("RPT"); }
    if (!hasPphp) { ops.push(Operation.changeTrust({ asset: new Asset("pPHP", PPHP_ISSUER) })); created.push("pPHP"); }

    const source = { accountId: () => walletAddr, sequenceNumber: () => acct.sequence, incrementSequenceNumber: () => {} };
    const txB = new TransactionBuilder(source as any, { fee: "100000", networkPassphrase: Networks.TESTNET });
    for (const op of ops) txB.addOperation(op);
    const tx = txB.setTimeout(30).build();
    tx.sign(walletKp);

    const subR = await fetch(`${HORIZON_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(tx.toXDR())}`,
    });
    const sub: any = await subR.json();
    if (!subR.ok) return sendJson(res, 500, { error: sub.extras?.result_codes?.transaction || "Transaction failed" });
    sendJson(res, 200, { success: true, created, txHash: sub.hash });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

const challenges = new Map<string, { challenge: string; expires: number }>();

async function handleSubmitReport(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { pvoId, milestoneId, lat, lng, citizenAddress, challenge } = JSON.parse(body);
    if (!pvoId || !milestoneId || !citizenAddress?.startsWith("G"))
      return sendJson(res, 400, { error: "pvoId, milestoneId, lat, lng, citizenAddress required" });

    const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
    if (!ADMIN_SECRET) return sendJson(res, 500, { error: "Server not configured" });

    const { Keypair, Address, Contract, TransactionBuilder, xdr } = await import("@stellar/stellar-sdk");
    const rptResp = await fetch(`${HORIZON_URL}/accounts/${citizenAddress}`);
    if (!rptResp.ok) return sendJson(res, 403, { error: "Wallet not found" });
    const rptData: any = await rptResp.json();
    const hasRpt = rptData.balances?.some(
      (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER && Number(b.balance) >= 1,
    );
    if (!hasRpt) return sendJson(res, 403, { error: "Wallet must hold 1+ RPT" });
    if (challenge && !challenge.startsWith("popv-report-")) return sendJson(res, 401, { error: "Invalid challenge" });

    const adminKp = Keypair.fromSecret(ADMIN_SECRET);
    const server = await getRpcServer();
    const account = await server.getAccount(adminKp.publicKey());
    const dataHash = `mobile:${Date.now()}:${lat}:${lng}`.slice(0, 64);
    const latMicro = Math.round((lat || 0) * 1_000_000);
    const lngMicro = Math.round((lng || 0) * 1_000_000);

    const contract = new Contract(COMMUNITY_ORACLE);
    const op = contract.call("submit_report",
      new Address(citizenAddress).toScVal(),
      xdr.ScVal.scvU32(pvoId),
      xdr.ScVal.scvU32(milestoneId),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
      xdr.ScVal.scvString(dataHash),
      xdr.ScVal.scvI128({ hi: 0, lo: latMicro } as any),
      xdr.ScVal.scvI128({ hi: 0, lo: lngMicro } as any),
    );

    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op).setTimeout(30).build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(adminKp);
    const result = await server.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      sendJson(res, 200, { success: true, txHash: (result as any).hash });
    } else {
      sendJson(res, 500, { error: `Status: ${result.status}` });
    }
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleReportChallenge(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const address = url.searchParams.get("address");
  if (!address?.startsWith("G")) return sendJson(res, 400, { error: "Valid address required" });
  const c = `popv-report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  challenges.set(address, { challenge: c, expires: Date.now() + 300000 });
  for (const [k, v] of challenges) { if (v.expires < Date.now()) challenges.delete(k); }
  sendJson(res, 200, { challenge: c, expiresIn: 300 });
}

async function handleProvenance(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const raw = readFileSync(PROVENANCE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const pvoIdMatch = req.url?.match(/^\/api\/provenance\/(\d+)/);
    if (pvoIdMatch) {
      const pvoId = parseInt(pvoIdMatch[1]);
      const pvo = (parsed.pvOs || []).find((p: any) => p.pvo_id === pvoId);
      return sendJson(res, 200, pvo || {});
    }
    sendJson(res, 200, parsed.pvOs || []);
  } catch {
    sendJson(res, 200, []);
  }
}

async function handleSendPayment(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { secretKey, destination, amount, asset } = JSON.parse(body);
    if (!secretKey?.startsWith("S") || secretKey.length < 55) return sendJson(res, 400, { error: "Valid secret key required" });
    if (!destination?.startsWith("G") || destination.length !== 56) return sendJson(res, 400, { error: "Valid destination required" });
    const amt = Number(amount);
    if (!amt || amt <= 0) return sendJson(res, 400, { error: "Valid amount required" });
    if (!["XLM", "RPT", "pPHP"].includes(asset)) return sendJson(res, 400, { error: "Asset must be XLM, RPT, or pPHP" });

    const { Keypair, Asset, Operation, TransactionBuilder, Networks } = await import("@stellar/stellar-sdk");
    const walletKp = Keypair.fromSecret(secretKey);
    const walletAddr = walletKp.publicKey();

    const acctR = await fetch(`${HORIZON_URL}/accounts/${walletAddr}`);
    if (!acctR.ok) return sendJson(res, 400, { error: "Wallet not funded on testnet" });
    const acct: any = await acctR.json();

    let paymentAsset: any;
    if (asset === "RPT") paymentAsset = new Asset("RPT", RPT_ISSUER);
    else if (asset === "pPHP") paymentAsset = new Asset("pPHP", PPHP_ISSUER);
    else paymentAsset = Asset.native();

    const source = { accountId: () => walletAddr, sequenceNumber: () => acct.sequence, incrementSequenceNumber: () => {} };
    const tx = new TransactionBuilder(source as any, { fee: "100000", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination, asset: paymentAsset, amount: String(amt) }))
      .setTimeout(30).build();
    tx.sign(walletKp);

    const subR = await fetch(`${HORIZON_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(tx.toXDR())}`,
    });
    const sub: any = await subR.json();
    if (!subR.ok) return sendJson(res, 500, { error: sub.extras?.result_codes?.transaction || sub.extras?.result_codes?.operations?.[0] || "Transaction failed" });
    sendJson(res, 200, { success: true, txHash: sub.hash });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse) {
  sendJson(res, 200, { status: "ok", version: "prod", uptime: process.uptime() });
}

async function handlePvos(_req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const { Contract, nativeToScVal, TransactionBuilder } = await import("@stellar/stellar-sdk");
    const server = await getRpcServer();
    const contract = new Contract(PVO_CORE);
    const escrowContract = new Contract("CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7"); // escrow contract
    const dummyPub = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const dummySource = { accountId: () => dummyPub, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };

    async function sim(fnName: string, contractRef: any, ...args: any[]) {
      const tx = new TransactionBuilder(dummySource as any, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(contractRef.call(fnName, ...args)).setTimeout(30).build();
      const s: any = await server.simulateTransaction(tx);
      if (s.error) return null;
      return s.result?.retval;
    }

    async function pvoSim(fnName: string, ...args: any[]) {
      return sim(fnName, contract, ...args);
    }

    async function escrowSim(fnName: string, ...args: any[]) {
      return sim(fnName, escrowContract, ...args);
    }

    function parseMap(sv: any): Record<string, any> {
      const result: Record<string, any> = {};
      for (const entry of sv.map()) {
        const key = entry.key().sym().toString();
        const val = entry.val();
        switch (val.switch().name) {
          case "scvU32": result[key] = val.u32(); break;
          case "scvU64": result[key] = Number(val.u64().toString()); break;
          case "scvI128": result[key] = val.i128().lo().toString(); break;
          case "scvString": result[key] = val.str().toString(); break;
          case "scvBool": result[key] = val.b(); break;
          case "scvVec": result[key] = val.vec().length; break;
          case "scvMap": result[key] = parseMap(val); break;
          default: result[key] = null;
        }
      }
      return result;
    }

    const cntVal = await pvoSim("get_pvo_count");
    if (!cntVal) return sendJson(res, 500, { error: "Failed to get count" });
    const count = Number(cntVal.u32().toString());

    const pvos: any[] = [];
    for (let i = 1; i <= count; i++) {
      try {
        const rv = await pvoSim("get_pvo", nativeToScVal(i, { type: "u32" }));
        if (!rv || rv.switch().name === "scvVoid") continue;
        const parsed = parseMap(rv);
        if (parsed.title) pvos.push(parsed);
      } catch {}
    }

    let scanId = count + 1;
    let misses = 0;
    while (misses < 15) {
      try {
        const rv = await pvoSim("get_pvo", nativeToScVal(scanId, { type: "u32" }));
        if (!rv || rv.switch().name === "scvVoid") { misses++; }
        else {
          const parsed = parseMap(rv);
          if (parsed.title) { pvos.push(parsed); misses = 0; }
          else misses++;
        }
      } catch { misses++; }
      scanId++;
    }

    // Fetch gate statuses from escrow contract per PVO
    const escrowCountVal = await escrowSim("get_escrow_count");
    const escrowCount = escrowCountVal ? Number(escrowCountVal.u32().toString()) : 0;
    const pvoGates: Record<number, { engineer: boolean; compliance: boolean; oracle: boolean; community: boolean; ai: boolean; communityCount: number; communityRequired: number }> = {};

    for (let i = 1; i <= escrowCount; i++) {
      try {
        const ev = await escrowSim("get_escrow", nativeToScVal(i, { type: "u32" }));
        if (!ev || ev.switch().name === "scvVoid") continue;
        const esc = parseMap(ev);
        const pvoId = Number(esc.pvo_id);
        if (!pvoGates[pvoId]) {
          pvoGates[pvoId] = { engineer: false, compliance: false, oracle: false, community: false, ai: false, communityCount: 0, communityRequired: 0 };
        }
        const conditions = esc.conditions || {};
        if (conditions.engineer_approval === true) pvoGates[pvoId].engineer = true;
        if (conditions.compliance_validation === true) pvoGates[pvoId].compliance = true;
        if (conditions.community_oracle_validation === true) pvoGates[pvoId].oracle = true;
        if (conditions.community_confirmation >= (conditions.community_required || 1)) pvoGates[pvoId].community = true;
        if (conditions.ai_risk_check === true) pvoGates[pvoId].ai = true;
        if (typeof conditions.community_confirmation === "number") pvoGates[pvoId].communityCount = conditions.community_confirmation;
        if (typeof conditions.community_required === "number") pvoGates[pvoId].communityRequired = conditions.community_required;
      } catch {}
    }

    // Fetch full transaction history per PVO from Soroban RPC events
    const PVO_CORE_ID = "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B";
    const ESCROW_ID = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
    const AUDIT_ID = "CB6AXOUYHEOWUUSEP6543GZYHMN6D2VA5WV5LXOMPNMJFYJ3XQNPZBV6";
    const COMMUNITY_ID = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";

    type TxRecord = { description: string; tx_hash: string; ledger: number; timestamp: string; contract: string; type: string };
    const pvoTxHistory: Record<number, TxRecord[]> = {};
    const pvoTxHashes: Record<number, { gate1?: string; gate2?: string; gate3?: string; gate4?: string; gate5?: string }> = {};

    function addTx(pvoId: number, rec: TxRecord) {
      if (!pvoTxHistory[pvoId]) pvoTxHistory[pvoId] = [];
      pvoTxHistory[pvoId].push(rec);
    }

    try {
      const latestLedger = Number((await server.getLatestLedger()).sequence);
      // RPC retention is ~121k ledgers, use safe 100k window
      const startLedger = Math.max(1, latestLedger - 100000);

      const contractList = [
        { id: PVO_CORE_ID, name: "pvo_core" },
        { id: ESCROW_ID, name: "escrow" },
        { id: AUDIT_ID, name: "audit_trail" },
        { id: COMMUNITY_ID, name: "community_oracle" },
      ];

      const scanOneContract = async (contractId: string, contractName: string) => {
        try {
          let cursor: string | undefined;
          for (let page = 0; page < 3; page++) {
            const filters = [{ type: "contract" as const, contractIds: [contractId] }];
            const eventsResp = await server.getEvents(
              cursor
                ? { filters, cursor, limit: 200 }
                : { filters, startLedger, limit: 200 }
            );
            if (!eventsResp.events || eventsResp.events.length === 0) break;

            for (const ev of eventsResp.events) {
              try {
                const data: Record<string, any> = {};
                try {
                  const entries = ev.value?.map();
                  if (entries) {
                    for (const entry of entries) {
                      const key = entry.key().sym().toString();
                      let v: any = entry.val();
                      try { v = v.u32(); } catch {}
                      try { v = v.bool(); } catch {}
                      try { v = v.sym()?.toString() ?? v; } catch {}
                      try { v = v.str()?.toString() ?? v; } catch {}
                      try { v = v.i128(); } catch {}
                      try { v = Number(v.toString()); } catch {}
                      data[key] = v;
                    }
                  }
                } catch {}

                const eventName = ev.topic?.[0]?.sym?.()?.toString() ?? "";
                const pvoId = Number(data.pvo_id ?? data.pvo ?? 0);
                const escId = data.id ?? data.escrow_id;
                const ledgerClosedAt = ev.ledgerClosedAt ?? "";
                const txHash = ev.txHash ?? "";
                const lowerName = eventName.toLowerCase();

                // Skip if no PVO association
                if (pvoId === 0 && escId === undefined) continue;

                // PVO Core events
                if (contractName === "pvo_core" && pvoId > 0) {
                  if (lowerName.includes("created") || lowerName.includes("pvo_created")) {
                    addTx(pvoId, { description: `PVO "${data.title ?? ""}" created`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "genesis" });
                  } else if (lowerName.includes("status")) {
                    addTx(pvoId, { description: `Status changed to ${data.new_status ?? data.status ?? ""}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "status" });
                  } else if (lowerName.includes("milestone")) {
                    addTx(pvoId, { description: `Milestone "${data.title ?? "#"+(data.milestone_id ?? "")}" created`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "milestone" });
                  } else if (lowerName.includes("evidence")) {
                    addTx(pvoId, { description: `Evidence submitted (${data.evidence_type ?? "unknown"})`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "evidence" });
                  } else if (lowerName.includes("contractor")) {
                    addTx(pvoId, { description: `Contractor assigned`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "contractor" });
                  } else if (lowerName.includes("score") || lowerName.includes("value")) {
                    addTx(pvoId, { description: `Value score updated to ${data.score ?? ""}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "score" });
                  } else {
                    addTx(pvoId, { description: `${eventName} on ${contractName}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "event" });
                  }
                }

                // Escrow events
                if (contractName === "escrow") {
                  const escPvoId = pvoId > 0 ? pvoId : 0;
                  if (escPvoId === 0) continue;

                  if (lowerName.includes("created")) {
                    addTx(escPvoId, { description: `Escrow #${escId} created (${data.amount ?? ""} stroops)`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "escrow_created" });
                  } else if (lowerName.includes("funded")) {
                    addTx(escPvoId, { description: `Escrow #${escId} funded`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "escrow_funded" });
                  } else if (lowerName.includes("released")) {
                    addTx(escPvoId, { description: `Escrow #${escId} released`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "escrow_released" });
                  } else if (lowerName.includes("disputed")) {
                    addTx(escPvoId, { description: `Escrow #${escId} disputed`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "escrow_disputed" });
                  } else if (lowerName.includes("condition")) {
                    const stStr = String(data.status ?? data.condition ?? "").toLowerCase();
                    let gateName = "Gate update";
                    let gateNum = 0;
                    if (stStr.includes("engineer") || data.condition === 0) { gateName = "G1: Engineer Approval"; gateNum = 1; if (!pvoTxHashes[escPvoId]) pvoTxHashes[escPvoId] = {}; pvoTxHashes[escPvoId].gate1 = txHash; }
                    else if (stStr.includes("compliance") || data.condition === 1) { gateName = "G2: Compliance Check"; gateNum = 2; if (!pvoTxHashes[escPvoId]) pvoTxHashes[escPvoId] = {}; pvoTxHashes[escPvoId].gate2 = txHash; }
                    else if (stStr.includes("oracle") || data.condition === 2) { gateName = "G3: Community Oracle"; gateNum = 3; if (!pvoTxHashes[escPvoId]) pvoTxHashes[escPvoId] = {}; pvoTxHashes[escPvoId].gate3 = txHash; }
                    else if (stStr.includes("community") || data.condition === 3) { gateName = "G4: Community Confirmation"; gateNum = 4; if (!pvoTxHashes[escPvoId]) pvoTxHashes[escPvoId] = {}; pvoTxHashes[escPvoId].gate4 = txHash; }
                    else if (stStr.includes("ai") || stStr.includes("risk") || data.condition === 4) { gateName = "G5: AI Risk Check"; gateNum = 5; if (!pvoTxHashes[escPvoId]) pvoTxHashes[escPvoId] = {}; pvoTxHashes[escPvoId].gate5 = txHash; }
                    addTx(escPvoId, { description: `${gateName}: ${data.status ?? "updated"}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: `gate${gateNum}` });
                  } else {
                    addTx(escPvoId, { description: `${eventName}: Escrow #${escId}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "escrow_event" });
                  }
                }

                // Audit trail events
                if (contractName === "audit_trail" && pvoId > 0) {
                  addTx(pvoId, { description: `Audit: ${data.action ?? data.category ?? eventName}`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "audit" });
                }

                // Community oracle events
                if (contractName === "community_oracle" && pvoId > 0) {
                  addTx(pvoId, { description: `Community report ${data.verified ? "verified" : "submitted"} by ${String(data.citizen ?? "").slice(0, 8)}...`, tx_hash: txHash, ledger: ev.ledger, timestamp: ledgerClosedAt, contract: contractName, type: "community" });
                }
              } catch {}
            }

            cursor = eventsResp.cursor ?? eventsResp.events?.[eventsResp.events.length - 1]?.id;
            if (!cursor || eventsResp.events.length < 200) break;
          }
        } catch {}
      };

      await Promise.race([
        Promise.allSettled(contractList.map((c) => scanOneContract(c.id, c.name))),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch { /* event scan optional */ }

    // Check provenance-store.json for captured events to fill tx_history
    try {
      const raw = readFileSync(PROVENANCE_PATH, "utf-8");
      const store = JSON.parse(raw);
      for (const ev of store.events || []) {
        const pvoId = ev.data?.pvo_id ?? ev.data?.pvo ?? 0;
        if (pvoId > 0 && ev.txHash) {
          const contractName = ev.contract || "pvo_core";
          const evName = (ev.eventName || "").toLowerCase();
          let desc = ev.eventName || "";
          let type = "event";
          if (evName.includes("created") || evName.includes("pvo_created")) { desc = `PVO created`; type = "genesis"; }
          else if (evName.includes("status")) { desc = `Status changed`; type = "status"; }
          else if (evName.includes("milestone")) { desc = `Milestone event`; type = "milestone"; }
          else if (evName.includes("condition")) { desc = `Gate updated`; type = "gate"; }
          else if (evName.includes("funded")) { desc = "Escrow funded"; type = "escrow_funded"; }
          if (!pvoTxHistory[pvoId]) pvoTxHistory[pvoId] = [];
          const hasTx = pvoTxHistory[pvoId].some((t: any) => t.tx_hash === ev.txHash);
          if (!hasTx) {
            pvoTxHistory[pvoId].push({
              description: `${desc} on ${contractName}`,
              tx_hash: ev.txHash,
              ledger: ev.ledger,
              timestamp: ev.ledgerClosedAt || "",
              contract: contractName,
              type,
            });
          }
        }
      }
    } catch {}

    const statusMap: Record<number, string> = { 0: "Proposed", 1: "Approved", 2: "InProgress", 3: "UnderReview", 4: "Completed", 5: "Suspended", 6: "Terminated" };
    const formatted = pvos.map((p: any) => {
      const pid = Number(p.id);
      const gates = pvoGates[pid] || { engineer: false, compliance: false, oracle: false, community: false, ai: false, communityCount: 0, communityRequired: 0 };
      const txHashes = pvoTxHashes[pid] || {};
      const txHistory = (pvoTxHistory[pid] || []).sort((a, b) => {
        // Sort by ledger ascending (oldest first = genesis first)
        return a.ledger - b.ledger;
      });
      return {
        id: pid,
        title: p.title ?? "Untitled",
        description: p.description ?? "",
        department: p.department ?? "",
        municipality: p.municipality ?? "",
        total_budget: String(p.total_budget ?? 0),
        status: typeof p.status === "string" ? p.status : statusMap[p.status] ?? "Proposed",
        fund_source: p.fund_source ?? "",
        milestone_count: p.milestones ?? 0,
        milestones_released: 0,
        public_value_score: p.public_value_score ?? 0,
        gates: { ...gates, tx_hashes: txHashes },
        tx_history: txHistory,
      };
    });

    sendJson(res, 200, { pvos: formatted, count: formatted.length });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}


const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
};

async function handleUploadIpfs(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const PINATA_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET = process.env.PINATA_SECRET;
  if (!PINATA_KEY || !PINATA_SECRET) return sendJson(res, 500, { error: "IPFS not configured" });
  try {
    const boundary = req.headers["content-type"]?.split("boundary=")[1];
    if (!boundary) return sendJson(res, 400, { error: "Missing multipart boundary" });

    const pinataResp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        "pinata_api_key": PINATA_KEY,
        "pinata_secret_api_key": PINATA_SECRET,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: req,
    });
    const data: any = await pinataResp.json();
    if (!pinataResp.ok) return sendJson(res, pinataResp.status, { error: data.error || "IPFS upload failed" });
    sendJson(res, 200, { IpfsHash: data.IpfsHash });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleBuildTrustline(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { publicKey } = JSON.parse(body);
    if (!publicKey?.startsWith("G")) return sendJson(res, 400, { error: "Valid public key required" });

    const { Asset, Operation, TransactionBuilder, Networks } = await import("@stellar/stellar-sdk");
    const acctR = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!acctR.ok) return sendJson(res, 400, { error: "Wallet account not found" });
    const acct: any = await acctR.json();

    const balances = acct.balances || [];
    const hasRpt = balances.some((b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER);
    const hasPphp = balances.some((b: any) => b.asset_code === "pPHP" && b.asset_issuer === PPHP_ISSUER);
    if (hasRpt && hasPphp) return sendJson(res, 200, { alreadySetup: true });

    const ops: any[] = [];
    if (!hasRpt) ops.push(Operation.changeTrust({ asset: new Asset("RPT", RPT_ISSUER) }));
    if (!hasPphp) ops.push(Operation.changeTrust({ asset: new Asset("pPHP", PPHP_ISSUER) }));

    const source = { accountId: () => publicKey, sequenceNumber: () => acct.sequence, incrementSequenceNumber: () => {} };
    const txB = new TransactionBuilder(source as any, { fee: "100000", networkPassphrase: Networks.TESTNET });
    for (const op of ops) txB.addOperation(op);
    const tx = txB.setTimeout(30).build();

    sendJson(res, 200, { xdr: tx.toXDR(), txHash: tx.hash().toString("hex") });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleBuildPayment(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { publicKey, destination, amount, asset } = JSON.parse(body);
    if (!publicKey?.startsWith("G")) return sendJson(res, 400, { error: "Valid public key required" });
    if (!destination?.startsWith("G") || destination.length !== 56) return sendJson(res, 400, { error: "Valid destination required" });
    const amt = Number(amount);
    if (!amt || amt <= 0) return sendJson(res, 400, { error: "Valid amount required" });
    if (!["XLM", "RPT", "pPHP"].includes(asset)) return sendJson(res, 400, { error: "Asset must be XLM, RPT, or pPHP" });

    const { Asset, Operation, TransactionBuilder, Networks } = await import("@stellar/stellar-sdk");
    const acctR = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!acctR.ok) return sendJson(res, 400, { error: "Wallet not funded" });
    const acct: any = await acctR.json();

    let paymentAsset: any;
    if (asset === "RPT") paymentAsset = new Asset("RPT", RPT_ISSUER);
    else if (asset === "pPHP") paymentAsset = new Asset("pPHP", PPHP_ISSUER);
    else paymentAsset = Asset.native();

    const source = { accountId: () => publicKey, sequenceNumber: () => acct.sequence, incrementSequenceNumber: () => {} };
    const tx = new TransactionBuilder(source as any, { fee: "100000", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination, asset: paymentAsset, amount: String(amt) }))
      .setTimeout(30).build();

    sendJson(res, 200, { xdr: tx.toXDR(), txHash: tx.hash().toString("hex") });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

async function handleSubmitSigned(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const { xdr, signature, publicKey } = JSON.parse(body);
    if (!xdr || !signature || !publicKey) return sendJson(res, 400, { error: "xdr, signature, publicKey required" });

    const sdk = await import("@stellar/stellar-sdk");
    const tx = sdk.TransactionBuilder.fromXDR(xdr, sdk.Networks.TESTNET);
    const kp = sdk.Keypair.fromPublicKey(publicKey);
    tx.signatures.push(new sdk.xdr.DecoratedSignature({
      hint: kp.signatureHint(),
      signature: Buffer.from(signature, "hex"),
    }));

    const subR = await fetch(`${HORIZON_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(tx.toXDR())}`,
    });
    const sub: any = await subR.json();
    if (!subR.ok) return sendJson(res, 500, { error: sub.extras?.result_codes?.transaction || "Transaction failed" });
    sendJson(res, 200, { success: true, txHash: sub.hash });
  } catch (err: any) {
    sendJson(res, 500, { error: safeError(err) });
  }
}

function handleReputation(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const citizen = url.searchParams.get("citizen");
  if (!citizen?.startsWith("G")) return sendJson(res, 400, { error: "Valid citizen address required" });

  (async () => {
    try {
      const { Contract, TransactionBuilder, Address } = await import("@stellar/stellar-sdk");
      const server = await getRpcServer();
      const contract = new Contract(COMMUNITY_ORACLE);
      const dummyPub = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
      const dummySource = { accountId: () => dummyPub, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };

      const tx = new TransactionBuilder(dummySource as any, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(contract.call("get_citizen_reputation", new Address(citizen).toScVal()))
        .setTimeout(30).build();
      const sim: any = await server.simulateTransaction(tx);

      if (sim.error || !sim.result?.retval || sim.result.retval.switch().name === "scvVoid") {
        return sendJson(res, 200, { total_reports: 0, verified_reports: 0, confidence_rating: 0 });
      }

      const rv = sim.result.retval;
      const data: Record<string, any> = {};
      for (const entry of rv.map()) {
        const key = entry.key().sym().toString();
        const val = entry.val();
        switch (val.switch().name) {
          case "scvU32": data[key] = val.u32(); break;
          case "scvString": data[key] = val.str().toString(); break;
          case "scvBool": data[key] = val.b(); break;
          default: data[key] = null;
        }
      }

      sendJson(res, 200, {
        total_reports: data.total_reports ?? 0,
        verified_reports: data.verified_reports ?? 0,
        confidence_rating: data.confidence_rating ?? 0,
      });
    } catch (err: any) {
      sendJson(res, 500, { error: safeError(err) });
    }
  })();
}

function serveStatic(pathName: string, res: http.ServerResponse) {
  let filePath = join(DIST_DIR, pathName);
  if (pathName === "/" || !existsSync(filePath)) {
    filePath = join(DIST_DIR, "index.html");
  }
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found - build the frontend first with npm run build" });
    return;
  }
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    filePath = join(DIST_DIR, "index.html");
    if (!existsSync(filePath)) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
  }
  const ext = filePath.substring(filePath.lastIndexOf("."));
  const mime = MIME[ext] || "application/octet-stream";
  const data = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": data.length });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const pathName = url.pathname;

  try {
    if (pathName === "/api/claim-rpt") return await handleClaimRpt(req, res);
    if (pathName === "/api/claim-citizen") return await handleClaimCitizen(req, res);
    if (pathName === "/api/setup-trustline") return await handleSetupTrustline(req, res);
    if (pathName === "/api/submit-report") return await handleSubmitReport(req, res);
    if (pathName === "/api/report-challenge") return await handleReportChallenge(req, res);
    if (pathName === "/api/provenance" || pathName.startsWith("/api/provenance/")) {
  return await handleProvenance(req, res);
}
    if (pathName === "/api/send-payment") return await handleSendPayment(req, res);
    if (pathName === "/api/upload-ipfs") return await handleUploadIpfs(req, res);
    if (pathName === "/api/build-trustline") return await handleBuildTrustline(req, res);
    if (pathName === "/api/build-payment") return await handleBuildPayment(req, res);
    if (pathName === "/api/submit-signed") return await handleSubmitSigned(req, res);
    if (pathName === "/api/health") return handleHealth(req, res);
    if (pathName === "/api/pvos") return await handlePvos(req, res);
    if (pathName === "/api/reputation") return await handleReputation(req, res);
    if (pathName.startsWith("/api/")) return sendJson(res, 404, { error: "Not found" });

    serveStatic(pathName, res);
  } catch (err: any) {
    console.error("Server error:", err?.message?.slice(0, 200));
    sendJson(res, 500, { error: "Internal server error", detail: err?.message?.slice(0, 100) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`POPV production server running on port ${PORT}`);
});
