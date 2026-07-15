/**
 * Community Confirmation API - Vercel Serverless Function
 * Lets a citizen confirm an escrow (Gate 4) from the mobile app.
 * One wallet per escrow - contract enforces no double confirmation.
 *
 * POST /api/confirm-escrow
 * Body: { pvoId, citizenAddress, secretKey }
 */
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pvoId, citizenAddress, secretKey } = req.body || {};

  if (!pvoId || !citizenAddress || !citizenAddress.startsWith("G")) {
    return res.status(400).json({ error: "pvoId and citizenAddress required" });
  }

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid wallet secret key required" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const ESCROW = "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7";
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
    if (!hasRpt) return res.status(403).json({ error: "Wallet must hold 1+ RPT to confirm" });

    const server = new rpc.Server(RPC_URL);
    const escrowContract = new Contract(ESCROW);

    // Find escrows for this PVO
    const account = await server.getAccount(citizenAddress);
    const escQueryTx = new TransactionBuilder(
      {
        accountId: () => citizenAddress,
        sequenceNumber: () => account.sequenceNumber(),
        incrementSequenceNumber: () => {},
      },
      { fee: "100000", networkPassphrase: NETWORK },
    ).addOperation(escrowContract.call(
      "get_escrows_by_pvo",
      nativeToScVal(Number(pvoId), { type: "u32" }),
    )).setTimeout(30).build();

    const escSim = await server.simulateTransaction(escQueryTx);
    if (!escSim.result?.retval || escSim.result.retval.switch().name !== "scvVec") {
      return res.status(200).json({ success: false, error: "No escrows found for this PVO" });
    }

    const escVec = escSim.result.retval.vec();
    const candidates = [];

    for (let i = 0; i < escVec.length; i++) {
      const map = escVec.at(i).map();
      let escId = null;
      let commCount = 0;
      let commRequired = 1;
      let oracleValidated = false;

      for (const me of map) {
        const key = me.key().sym().toString();
        const val = me.val();
        if (key === "id") {
          escId = Number(val.u32().toString());
        } else if (key === "conditions") {
          for (const ce of val.map()) {
            const ck = ce.key().sym().toString();
            const cv = ce.val();
            if (ck === "community_confirmation") commCount = Number(cv.u32().toString());
            if (ck === "community_required") commRequired = Number(cv.u32().toString());
            if (ck === "community_oracle_validation") oracleValidated = cv.b();
          }
        }
      }

      if (escId && oracleValidated && commCount < commRequired) {
        candidates.push({ escId, commCount, commRequired });
      }
    }

    if (candidates.length === 0) {
      return res.status(200).json({
        success: false,
        error: "No escrows need confirmation (already met threshold or Gate 3 not passed)",
      });
    }

    // Try each candidate escrow
    const confirmed = [];
    let success = false;

    for (const c of candidates) {
      const confirmAccount = await server.getAccount(citizenAddress);
      const confirmTx = new TransactionBuilder(
        {
          accountId: () => citizenAddress,
          sequenceNumber: () => confirmAccount.sequenceNumber(),
          incrementSequenceNumber: () => {},
        },
        { fee: "100000", networkPassphrase: NETWORK },
      ).addOperation(escrowContract.call(
        "add_community_confirmation",
        new Address(citizenAddress).toScVal(),
        xdr.ScVal.scvU32(c.escId),
      )).setTimeout(30).build();

      // Simulate first - catches "already confirmed" before wasting gas
      const confirmSim = await server.simulateTransaction(confirmTx);
      if (confirmSim.error) {
        const errStr = String(confirmSim.error || "");
        if (errStr.includes("already confirmed")) {
          confirmed.push({ escrowId: c.escId, status: "already_confirmed" });
          continue;
        }
        console.log(`Confirm escrow #${c.escId} sim failed: ${errStr.slice(0, 80)}`);
        continue;
      }

      try {
        const prepared = await server.prepareTransaction(confirmTx);
        prepared.sign(citizenKp);
        const result = await server.sendTransaction(prepared);
        if (result.status === "PENDING" || result.status === "DUPLICATE") {
          // Poll for confirmation
          for (let j = 0; j < 12; j++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              const resp = await server.getTransaction(result.hash);
              if (resp.status !== "NOT_FOUND") {
                if (resp.status === "SUCCESS") {
                  success = true;
                  confirmed.push({ escrowId: c.escId, status: "confirmed", txHash: result.hash });
                } else {
                  confirmed.push({ escrowId: c.escId, status: resp.status });
                }
                break;
              }
            } catch {}
          }
        }
      } catch (e) {
        const msg = e.message?.slice(0, 100) || "";
        if (msg.includes("already confirmed")) {
          confirmed.push({ escrowId: c.escId, status: "already_confirmed" });
        } else {
          console.error(`Confirm escrow #${c.escId} failed: ${msg}`);
        }
      }
    }

    if (success) {
      return res.status(200).json({ success: true, confirmed });
    }
    if (confirmed.every((c) => c.status === "already_confirmed")) {
      return res.status(200).json({ success: false, error: "You already confirmed all escrows for this PVO", confirmed });
    }
    return res.status(200).json({ success: false, error: "Confirmation failed", confirmed });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
