/**
 * Citizen Report Relay API - Vercel Serverless Function
 * Mobile app sends report data + wallet secret key, server
 * signs transaction with citizen's key and submits on-chain.
 *
 * POST /api/submit-report
 * Body: { pvoId, milestoneId, lat, lng, notes, citizenAddress, secretKey, signature, message, ipfsHash }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pvoId, milestoneId, lat, lng, notes, citizenAddress, secretKey, ipfsHash } = req.body || {};

  if (!pvoId || !milestoneId || !citizenAddress || !citizenAddress.startsWith("G")) {
    return res.status(400).json({ error: "pvoId, milestoneId, lat, lng, citizenAddress required" });
  }

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid wallet secret key required to sign the report" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const HORIZON = "https://horizon-testnet.stellar.org";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
    const NETWORK = "Test SDF Network ; September 2015";

    const citizenKp = Keypair.fromSecret(secretKey);
    if (citizenKp.publicKey() !== citizenAddress) {
      return res.status(401).json({ error: "Secret key does not match citizen address" });
    }

    // Verify citizen has RPT
    const rptResp = await fetch(`${HORIZON}/accounts/${citizenAddress}`);
    if (!rptResp.ok) return res.status(403).json({ error: "Wallet not found" });
    const rptData = await rptResp.json();
    const hasRpt = rptData.balances?.some(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER && Number(b.balance) >= 1
    );
    if (!hasRpt) return res.status(403).json({ error: "Wallet must hold 1+ RPT to submit reports" });

    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(citizenAddress);

    const dataHash = ipfsHash || `mobile:${Date.now()}:${lat}:${lng}`.slice(0, 64);
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
      nativeToScVal(latMicro, { type: "i128" }),
      nativeToScVal(lngMicro, { type: "i128" }),
    );

    const source = {
      accountId: () => citizenAddress,
      sequenceNumber: () => account.sequenceNumber(),
      incrementSequenceNumber: () => {},
    };

    const tx = new TransactionBuilder(source, {
      fee: "100000",
      networkPassphrase: NETWORK,
    }).addOperation(op).setTimeout(30).build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(citizenKp);

    const result = await server.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      return res.status(200).json({ success: true, txHash: result.hash });
    }
    return res.status(500).json({ error: `Status: ${result.status}` });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
