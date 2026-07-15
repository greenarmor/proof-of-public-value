/**
 * Citizen Reputation API - Vercel Serverless Function
 * Returns on-chain reputation stats for a citizen wallet.
 *
 * GET /api/reputation?citizen=GXXX
 * Returns: { total_reports, verified_reports, confidence_rating }
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { citizen } = req.query;
  if (!citizen) {
    return res.status(400).json({ error: "citizen query parameter required" });
  }

  try {
    const { Address, Contract, TransactionBuilder, rpc, nativeToScVal } =
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
      "get_citizen_reputation",
      new Address(citizen).toScVal(),
    )).setTimeout(30).build();

    const sim = await server.simulateTransaction(tx);
    if (!sim.result?.retval || sim.result.retval.switch().name === "scvVoid") {
      return res.status(200).json({ total_reports: 0, verified_reports: 0, confidence_rating: 50 });
    }

    const map = sim.result.retval.map();
    const result = {};
    for (const me of map) {
      const key = me.key().sym().toString();
      const val = me.val();
      if (val.switch().name === "scvU32") result[key] = Number(val.u32().toString());
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=10");
    return res.status(200).json({
      total_reports: result.total_reports || 0,
      verified_reports: result.verified_reports || 0,
      confidence_rating: result.confidence_rating || 50,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
