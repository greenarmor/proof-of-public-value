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
    const { Contract, rpc, nativeToScVal, TransactionBuilder } = await import("@stellar/stellar-sdk");

    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(PVO_CORE);
    const dummyPub = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    function makeTx(fnName, ...args) {
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
          case "scvMap":
            result[key] = parseScValMap(val);
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

    // Fetch escrow gate status per PVO
    const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
    const escContract = new Contract(ESCROW);

    function makeEscTx(fnName, ...args) {
      const tx = new TransactionBuilder(
        { accountId: () => dummyPub, sequenceNumber: () => "0", incrementSequenceNumber: () => {} },
        { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }
      ).addOperation(escContract.call(fnName, ...args)).setTimeout(30).build();
      return tx;
    }

    async function simEsc(fnName, ...args) {
      const tx = makeEscTx(fnName, ...args);
      const sim = await server.simulateTransaction(tx);
      if (sim.error) return null;
      return sim.result?.retval;
    }

    function parseEscrowVec(sv) {
      const list = [];
      const vec = sv.vec();
      for (let i = 0; i < vec.length; i++) {
        const entry = vec.get(i);
        const map = parseScValMap(entry);
        list.push(map);
      }
      return list;
    }

    const escrowGates = {};

    for (const p of pvos) {
      const pid = p.id;
      try {
        const escRv = await simEsc("get_escrows_by_pvo", nativeToScVal(pid, { type: "u32" }));
        if (escRv && escRv.switch().name === "scvVec") {
          const escList = parseEscrowVec(escRv);
          let g1 = false, g2 = false, g3 = false, g4 = false, g5 = false;
          let g4Count = 0, g4Required = 0;
          for (const e of escList) {
            if (e.engineer_approval) g1 = true;
            if (e.compliance_validation) g2 = true;
            if (e.community_oracle_validation) g3 = true;
            g4Count = Math.max(g4Count, e.community_confirmation || 0);
            g4Required = Math.max(g4Required, e.community_required || 0);
            if ((e.community_confirmation || 0) >= (e.community_required || 1)) g4 = true;
            if (e.ai_risk_check) g5 = true;
          }
          escrowGates[pid] = { g1, g2, g3, g4, g5, g4Count, g4Required };
        }
      } catch {}
    }

    const formatted = pvos.map((p) => {
      const gates = escrowGates[p.id] || {};
      return {
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
        gates: {
          engineer: gates.g1 || false,
          compliance: gates.g2 || false,
          oracle: gates.g3 || false,
          community: gates.g4 || false,
          ai: gates.g5 || false,
          community_count: gates.g4Count || 0,
          community_required: gates.g4Required || 0,
        },
      };
    });

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=5");
    return res.status(200).json({ pvos: formatted, count: formatted.length, _fix: "recursive-maps-v2" });
  } catch (err) {
    console.error("PVO list error:", err);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
