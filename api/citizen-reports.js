/**
 * Citizen Reports API - Vercel Serverless Function
 * Returns milestone IDs that a citizen has already reported for a given PVO.
 * Queries community_oracle contract on-chain for ground-truth data.
 *
 * GET /api/citizen-reports?pvoId=30&citizen=GXXX
 * Returns: { milestones: [1, 2, 3], count: 3 }
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pvoId, citizen } = req.query;

  if (!pvoId || !citizen) {
    return res.status(400).json({ error: "pvoId and citizen required" });
  }

  try {
    const { Contract, TransactionBuilder, rpc, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const NETWORK = "Test SDF Network ; September 2015";

    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(COMMUNITY_ORACLE);
    const dummy = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    const tx = new TransactionBuilder(
      { accountId: () => dummy, sequenceNumber: () => "0", incrementSequenceNumber: () => {} },
      { fee: "100000", networkPassphrase: NETWORK },
    ).addOperation(contract.call(
      "get_reports_by_pvo",
      nativeToScVal(Number(pvoId), { type: "u32" }),
    )).setTimeout(30).build();

    const sim = await server.simulateTransaction(tx);
    if (!sim.result?.retval || sim.result.retval.switch().name !== "scvVec") {
      return res.status(200).json({ milestones: [], confirmed: false });
    }

    const vec = sim.result.retval.vec();
    const milestones = [];
    const reporters = [];
    let confirmed = false;

    for (let i = 0; i < vec.length; i++) {
      const entry = vec.at(i);
      const map = entry.map();
      let reporter = null;
      let milestoneId = null;
      let isVerified = false;

      for (const me of map) {
        const key = me.key().sym().toString();
        const val = me.val();
        if (key === "citizen") {
          // Address type - convert to human-readable strkey
          try {
            const addrObj = Address.fromScAddress(val.address());
            reporter = addrObj.toString();
            if (!reporter || reporter === "[object Object]") {
              // fallback: try constructor
              reporter = new Address(val.address()).toString();
            }
          } catch { reporter = null; }
        } else if (key === "milestone_id") {
          milestoneId = Number(val.u32().toString());
        } else if (key === "verified") {
          isVerified = val.b();
        }
      }

      // Check if this address matches
      if (reporter && reporters.length < 3) reporters.push(reporter);
      if (reporter === citizen) {
        if (milestoneId && !milestones.includes(milestoneId)) {
          milestones.push(milestoneId);
        }
      }
    }

    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=2");
    return res.status(200).json({
      milestones, count: milestones.length,
      _v: "v4", _citizen: citizen, _reportCount: vec.length,
      _sample: reporters[0] || "none"
    });
  } catch (err) {
    console.error("citizen-reports error:", err.message?.slice(0, 100));
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
