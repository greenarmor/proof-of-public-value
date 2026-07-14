/**
 * Send Payment API - Vercel Serverless Function
 * Signs and submits a payment transaction on behalf of the mobile wallet.
 *
 * POST /api/send-payment
 * Body: { secretKey, destination, amount, asset }
 * asset: "XLM", "RPT", or "pPHP"
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { secretKey, destination, amount, asset } = req.body || {};

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid secret key required" });
  }
  if (!destination || !destination.startsWith("G") || destination.length !== 56) {
    return res.status(400).json({ error: "Valid destination address required" });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: "Valid amount required" });
  }
  if (!["XLM", "RPT", "pPHP"].includes(asset)) {
    return res.status(400).json({ error: "Asset must be XLM, RPT, or pPHP" });
  }

  try {
    const { Keypair, Asset, Operation, TransactionBuilder, Networks } =
      await import("@stellar/stellar-sdk");

    const HORIZON = "https://horizon-testnet.stellar.org";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
    const PPHP_ISSUER = "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO";

    const walletKp = Keypair.fromSecret(secretKey);
    const walletAddr = walletKp.publicKey();

    // Load source account
    const acctR = await fetch(`${HORIZON}/accounts/${walletAddr}`);
    if (!acctR.ok) {
      return res.status(400).json({ error: "Wallet not funded on testnet" });
    }
    const acct = await acctR.json();

    // Build payment operation
    let paymentAsset;
    if (asset === "RPT") {
      paymentAsset = new Asset("RPT", RPT_ISSUER);
    } else if (asset === "pPHP") {
      paymentAsset = new Asset("pPHP", PPHP_ISSUER);
    } else {
      paymentAsset = Asset.native();
    }

    const source = {
      accountId: () => walletAddr,
      sequenceNumber: () => acct.sequence,
      incrementSequenceNumber: () => {},
    };

    const tx = new TransactionBuilder(source, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: paymentAsset,
          amount: String(amt),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(walletKp);

    const subR = await fetch(`${HORIZON}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(tx.toXDR())}`,
    });
    const sub = await subR.json();

    if (!subR.ok) {
      const resultCode =
        sub.extras?.result_codes?.transaction ||
        sub.extras?.result_codes?.operations?.[0] ||
        "Transaction failed";
      return res.status(500).json({ error: resultCode });
    }

    return res.status(200).json({
      success: true,
      txHash: sub.hash,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
