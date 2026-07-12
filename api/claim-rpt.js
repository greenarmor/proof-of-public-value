/**
 * RPT Claim API - Vercel Serverless Function
 * Mints exactly 1 RPT using Horizon REST (no SDK dependency).
 */
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = req.method === "GET" ? req.query.address : req.body?.address;
  if (!address || !address.startsWith("G")) {
    return res.status(400).json({ error: "Valid wallet address required" });
  }

  const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const {
      Asset, Keypair, Operation, TransactionBuilder,
      Networks, Server: HorizonServer,
    } = await import("@stellar/stellar-sdk");

    const stellarServer = new HorizonServer(HORIZON_URL);
    const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

    let alreadyHasRpt = false;
    try {
      const acctData = await stellarServer.loadAccount(address);
      const rptBalance = acctData.balances.find(
        (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
      );
      if (rptBalance && Number(rptBalance.balance) >= 1) alreadyHasRpt = true;
    } catch {
      return res.status(400).json({ error: "Wallet not found or no trustline" });
    }

    if (alreadyHasRpt) {
      return res.status(200).json({ success: true, alreadyOwned: true, message: "Already has RPT" });
    }

    const acctData = await stellarServer.loadAccount(address);
    const hasTrustline = acctData.balances.some(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );
    if (!hasTrustline) {
      return res.status(400).json({ error: "No RPT trustline", needsTrustline: true });
    }

    const adminAccount = await stellarServer.loadAccount(adminKeypair.publicKey());
    const rptAsset = new Asset("RPT", RPT_ISSUER);

    const tx = new TransactionBuilder(adminAccount, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({ destination: address, asset: rptAsset, amount: "1" }))
      .setTimeout(30)
      .build();

    tx.sign(adminKeypair);
    const result = await stellarServer.submitTransaction(tx);

    return res.status(200).json({ success: true, txHash: result.hash, alreadyOwned: false });
  } catch (err) {
    const msg = err.response?.data?.extras?.result_codes?.transaction || err.message || "Unknown";
    return res.status(500).json({ error: `API error: ${msg}` });
  }
};
