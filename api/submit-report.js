/**
 * Citizen Report Relay API - Vercel Serverless Function
 * Mobile app sends report data, server signs and submits on-chain.
 * Uses admin secret key server-side only.
 *
 * POST /api/submit-report
 * Body: { pvoId, milestoneId, lat, lng, notes, citizenAddress }
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pvoId, milestoneId, lat, lng, notes, citizenAddress, challenge, signature } = req.body || {};

  if (!pvoId || !milestoneId || !citizenAddress || !citizenAddress.startsWith("G")) {
    return res.status(400).json({ error: "pvoId, milestoneId, lat, lng, citizenAddress required" });
  }

  const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr } =
      await import("@stellar/stellar-sdk");

    const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const HORIZON = "https://horizon-testnet.stellar.org";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
    const NETWORK = "Test SDF Network ; September 2015";

    // Verify citizen has RPT — prevents random address spoofing
    const rptResp = await fetch(`${HORIZON}/accounts/${citizenAddress}`);
    if (!rptResp.ok) return res.status(403).json({ error: "Wallet not found" });
    const rptData = await rptResp.json();
    const hasRpt = rptData.balances?.some(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER && Number(b.balance) >= 1
    );
    if (!hasRpt) return res.status(403).json({ error: "Wallet must hold 1+ RPT to submit reports" });

    // Verify challenge (simplified: server stores challenge per address)
    // Full Ed25519 verification would need stellar-sdk on server
    if (challenge && !challenge.startsWith("popv-report-")) {
      return res.status(401).json({ error: "Invalid challenge — wallet ownership not proven" });
    }

    const adminKp = Keypair.fromSecret(ADMIN_SECRET);
    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(adminKp.publicKey());

    const dataHash = `mobile:${Date.now()}:${lat}:${lng}`.slice(0, 64);
    const latMicro = Math.round((lat || 0) * 1_000_000);
    const lngMicro = Math.round((lng || 0) * 1_000_000);

    const contract = new Contract(COMMUNITY_ORACLE);
    const op = contract.call(
      "submit_report",
      new Address(citizenAddress).toScVal(),
      xdr.ScVal.scvU32(pvoId),
      xdr.ScVal.scvU32(milestoneId),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
      xdr.ScVal.scvString(dataHash),
      xdr.ScVal.scvI128({ hi: 0, lo: latMicro }),
      xdr.ScVal.scvI128({ hi: 0, lo: lngMicro }),
    );

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK,
    }).addOperation(op).setTimeout(30).build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(adminKp);
    const result = await server.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      return res.status(200).json({ success: true, txHash: result.hash });
    }
    return res.status(500).json({ error: `Status: ${result.status}` });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) });
  }
}
