/**
 * Trustline Setup API - Vercel Serverless Function
 * Mobile app sends wallet secret key, server creates missing trustlines (RPT, pPHP).
 *
 * POST /api/setup-trustline
 * Body: { secretKey }
 * Returns: { success, created: ["RPT", "pPHP"], txHash }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { secretKey } = req.body || {};

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid secret key required" });
  }

  try {
    const { Keypair, Asset, Operation, TransactionBuilder, Networks } =
      await import("@stellar/stellar-sdk");

    const HORIZON = "https://horizon-testnet.stellar.org";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
    const PPHP_ISSUER = "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO";

    const walletKp = Keypair.fromSecret(secretKey);
    const walletAddr = walletKp.publicKey();

    // Load wallet account
    const acctR = await fetch(`${HORIZON}/accounts/${walletAddr}`);
    if (!acctR.ok) {
      return res.status(400).json({ error: "Wallet account not found on testnet" });
    }
    const acct = await acctR.json();

    const balances = acct.balances || [];
    const hasRpt = balances.some(
      (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );
    const hasPphp = balances.some(
      (b) => b.asset_code === "pPHP" && b.asset_issuer === PPHP_ISSUER,
    );

    const created = [];

    if (hasRpt && hasPphp) {
      return res.status(200).json({
        success: true,
        alreadySetup: true,
        created: [],
        message: "All trustlines already exist",
      });
    }

    // Build ChangeTrust ops for missing trustlines
    const ops = [];
    if (!hasRpt) {
      ops.push(
        Operation.changeTrust({
          asset: new Asset("RPT", RPT_ISSUER),
        }),
      );
      created.push("RPT");
    }
    if (!hasPphp) {
      ops.push(
        Operation.changeTrust({
          asset: new Asset("pPHP", PPHP_ISSUER),
        }),
      );
      created.push("pPHP");
    }

    // Build and sign transaction with wallet key
    const source = {
      accountId: () => walletAddr,
      sequenceNumber: () => acct.sequence,
      incrementSequenceNumber: () => {},
    };

    const tx = new TransactionBuilder(source, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    });

    for (const op of ops) tx.addOperation(op);

    const builtTx = tx.setTimeout(30).build();
    builtTx.sign(walletKp);

    const subR = await fetch(`${HORIZON}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(builtTx.toXDR())}`,
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
      created,
      txHash: sub.hash,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
