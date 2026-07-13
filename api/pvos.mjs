/**
 * PVO List API - Vercel Serverless Function
 * Fetches all PVOs from the pvo_core Soroban contract.
 *
 * GET /api/pvos
 * Returns: { pvos: [...] }
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const RPC_URL = "https://soroban-testnet.stellar.org:443";
  const PVO_CORE = "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B";
  const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

  try {
    const { Contract, rpc, nativeToScVal, xdr } = await import("@stellar/stellar-sdk");

    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(PVO_CORE);
    const dummyPub = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    const account = await server.getAccount(dummyPub).catch(() => ({
      accountId: () => dummyPub,
      sequenceNumber: () => "0",
    }));

    function makeTx(fnName, ...args) {
      const { TransactionBuilder } = require("@stellar/stellar-sdk");
      const tx = new TransactionBuilder(
        { accountId: () => dummyPub, sequenceNumber: () => "0", incrementSequenceNumber: () => {} },
        { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call(fnName, ...args))
        .setTimeout(30)
        .build();
      return tx;
    }

    async function simulate(fnName, ...args) {
      const tx = makeTx(fnName, ...args);
      const sim = await server.simulateTransaction(tx);
      if (sim.error) {
        console.error(`Sim error for ${fnName}:`, sim.error);
        return null;
      }
      return sim.result?.retval;
    }

    function parseScValMap(sv) {
      const result = {};
      for (const entry of sv.map()) {
        const key = entry.key().sym().toString();
        const val = entry.val();
        switch (val.switch().name) {
          case "scvU32":
            result[key] = val.u32();
            break;
          case "scvU64":
            result[key] = Number(val.u64().toString());
            break;
          case "scvI128":
            result[key] = val.i128().lo().toString();
            break;
          case "scvString":
            result[key] = val.str().toString();
            break;
          case "scvBool":
            result[key] = val.b();
            break;
          case "scvVec":
            result[key] = val.vec().length;
            break;
          case "scvSymbol":
            result[key] = val.sym().toString();
            break;
          default:
            result[key] = null;
        }
      }
      return result;
    }

    const retval = await simulate("get_pvo_count");
    if (!retval) {
      return res.status(500).json({ error: "Failed to get PVO count" });
    }
    const count = Number(retval.u32().toString());

    const pvos = [];

    for (let i = 1; i <= count; i++) {
      try {
        const rv = await simulate("get_pvo", nativeToScVal(i, { type: "u32" }));
        if (!rv || rv.switch().name === "scvVoid") continue;
        const parsed = parseScValMap(rv);
        if (parsed.title) pvos.push(parsed);
      } catch {}
    }

    let scanId = count + 1;
    let consecutiveNones = 0;
    while (consecutiveNones < 15) {
      try {
        const rv = await simulate("get_pvo", nativeToScVal(scanId, { type: "u32" }));
        if (!rv || rv.switch().name === "scvVoid") {
          consecutiveNones++;
        } else {
          const parsed = parseScValMap(rv);
          if (parsed.title) {
            pvos.push(parsed);
            consecutiveNones = 0;
          } else {
            consecutiveNones++;
          }
        }
      } catch {
        consecutiveNones++;
      }
      scanId++;
    }

    const statusMap = {
      0: "Proposed",
      1: "Approved",
      2: "InProgress",
      3: "UnderReview",
      4: "Completed",
      5: "Suspended",
      6: "Terminated",
    };

    const formatted = pvos.map((p) => ({
      id: p.id ?? 0,
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
    }));

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=5");
    return res.status(200).json({ pvos: formatted, count: formatted.length });
  } catch (err) {
    console.error("PVO list error:", err);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
