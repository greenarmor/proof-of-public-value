/**
 * AI Auditor Decision API - Vercel Serverless Function
 * Human AI Auditor reviews AI Oracle assessment and makes final Gate 5 decision.
 *
 * GET  /api/auditor-decision                     - list pending reviews
 * POST /api/auditor-decision                     - pass/fail/dispute
 *
 * POST Body: {
 *   secretKey: "S...",     // AI Auditor secret key
 *   escrowId: number,
 *   decision: "pass" | "fail" | "dispute",
 *   reason: "..."          // required for fail/dispute
 * }
 */
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const NETWORK = "Test SDF Network ; September 2015";

    if (req.method === "GET") {
      // Return pending reviews (read from the AI Oracle's pending file)
      // Since Vercel can't read the VPS filesystem, we query escrow states directly
      return res.status(200).json({
        message: "Query escrows with Gates 1-4 passed but Gate 5 not yet decided",
        note: "Use POST to submit auditor decision",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { secretKey, escrowId, decision, reason } = req.body || {};

    if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
      return res.status(400).json({ error: "Valid auditor secret key required" });
    }
    if (!escrowId) {
      return res.status(400).json({ error: "escrowId required" });
    }
    if (!["pass", "fail", "dispute"].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'pass', 'fail', or 'dispute'" });
    }
    if (decision !== "pass" && !reason) {
      return res.status(400).json({ error: "reason required for fail/dispute decisions" });
    }

    const kp = Keypair.fromSecret(secretKey);
    const pub = kp.publicKey();
    console.log(`Auditor decision by ${pub}: escrow #${escrowId} → ${decision}`);

    const server = new rpc.Server(RPC_URL);
    const escrowContract = new Contract(ESCROW);

    // Step 1: Verify Gate 5 not already decided
    const dummy = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const checkTx = new TransactionBuilder(
      { accountId: () => dummy, sequenceNumber: () => "0", incrementSequenceNumber: () => {} },
      { fee: "100000", networkPassphrase: NETWORK },
    ).addOperation(escrowContract.call(
      "get_escrow",
      nativeToScVal(Number(escrowId), { type: "u32" }),
    )).setTimeout(30).build();

    const checkSim = await server.simulateTransaction(checkTx);
    if (checkSim.result?.retval && checkSim.result.retval.switch().name !== "scvVoid") {
      const map = checkSim.result.retval.map();
      let alreadyDecided = false;
      let pvoId = 0;

      for (const me of map) {
        const key = me.key().sym().toString();
        const val = me.val();
        if (key === "pvo_id") pvoId = Number(val.u32().toString());
        if (key === "conditions") {
          for (const ce of val.map()) {
            if (ce.key().sym().toString() === "ai_risk_check" && ce.val().b()) {
              alreadyDecided = true;
            }
          }
        }
      }

      if (alreadyDecided) {
        return res.status(200).json({
          success: false,
          error: "Gate 5 already decided for this escrow",
          escrowId,
          pvoId,
        });
      }
    }

    // Step 2: Submit auditor decision
    const isPass = decision === "pass";
    const account = await server.getAccount(pub);
    const decisionTx = new TransactionBuilder(
      {
        accountId: () => pub,
        sequenceNumber: () => account.sequenceNumber(),
        incrementSequenceNumber: () => {},
      },
      { fee: "100000", networkPassphrase: NETWORK },
    ).addOperation(escrowContract.call(
      "ai_validate",
      new Address(pub).toScVal(),
      xdr.ScVal.scvU32(Number(escrowId)),
      xdr.ScVal.scvBool(isPass),
    )).setTimeout(30).build();

    const prepared = await server.prepareTransaction(decisionTx);
    prepared.sign(kp);
    const result = await server.sendTransaction(prepared);

    if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
      return res.status(500).json({ error: `Tx failed: ${result.status}` });
    }

    // Poll for confirmation
    let confirmed = null;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const resp = await server.getTransaction(result.hash);
        if (resp.status !== "NOT_FOUND") { confirmed = resp; break; }
      } catch {}
    }

    if (confirmed?.status === "SUCCESS") {
      console.log(`Gate 5 decided: escrow #${escrowId} = ${decision}`);
      return res.status(200).json({
        success: true,
        escrowId,
        decision,
        txHash: result.hash,
        reason: reason || "Auditor override",
      });
    }

    return res.status(200).json({
      success: false,
      error: `Confirmation ${confirmed?.status || "timeout"}`,
      txHash: result.hash,
      note: "Transaction submitted but not confirmed. Check Stellar Expert.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
