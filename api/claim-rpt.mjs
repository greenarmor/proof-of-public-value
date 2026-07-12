/**
 * RPT Claim API
 */
export default async function handler(req, res) {
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
    const { Keypair, TransactionBuilder, Operation, Asset, Networks } =
      await import("@stellar/stellar-sdk");

    const admin = Keypair.fromSecret(ADMIN_SECRET);
    const HORIZON = "https://horizon-testnet.stellar.org";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";

    // Check user account
    const acctR = await fetch(`${HORIZON}/accounts/${address}`);
    if (!acctR.ok) return res.status(400).json({ error: "Wallet not found" });
    const acct = await acctR.json();

    const bal = acct.balances.find(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );
    if (bal && Number(bal.balance) >= 1) {
      return res.status(200).json({ success: true, alreadyOwned: true });
    }

    const tl = acct.balances.some(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );
    if (!tl) return res.status(400).json({ error: "No RPT trustline", needsTrustline: true });

    // Get admin sequence
    const admR = await fetch(`${HORIZON}/accounts/${admin.publicKey()}`);
    if (!admR.ok) return res.status(500).json({ error: "Admin account not found" });
    const adm = await admR.json();

    // Build tx
    const rptAsset = new Asset("RPT", RPT_ISSUER);
    const src = { accountId: () => admin.publicKey(), sequenceNumber: () => adm.sequence, incrementSequenceNumber: () => {} };
    const tx = new TransactionBuilder(src, { fee: "100000", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: address, asset: rptAsset, amount: "1" }))
      .setTimeout(30).build();
    tx.sign(admin);

    // Submit
    const subR = await fetch(`${HORIZON}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(tx.toXDR())}`,
    });
    const sub = await subR.json();
    if (!subR.ok) return res.status(500).json({ error: sub.extras?.result_codes?.transaction || "Tx failed" });

    return res.status(200).json({ success: true, txHash: sub.hash });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown" });
  }
}
