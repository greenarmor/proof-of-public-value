/**
 * Citizen Report Relay API - Vercel Serverless Function
 * Mobile app sends report data + wallet secret key, server
 * signs transaction with citizen's key and submits on-chain.
 *
 * Full flow in one request:
 *   1. submit_report on community_oracle
 *   2. verify_report (auto-verify so Gate 3 data exists)
 *   3. community_oracle_validate on escrow (flips Gate 3)
 *
 * POST /api/submit-report
 * Body: { pvoId, milestoneId, lat, lng, notes, citizenAddress, secretKey, signature, message, ipfsHash }
 */
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pvoId, milestoneId, lat, lng, notes, citizenAddress, secretKey, ipfsHash } = req.body || {};

  if (!pvoId || !milestoneId || !citizenAddress || !citizenAddress.startsWith("G")) {
    return res.status(400).json({ error: "pvoId, milestoneId, citizenAddress required" });
  }

  if (!secretKey || !secretKey.startsWith("S") || secretKey.length < 55) {
    return res.status(400).json({ error: "Valid wallet secret key required" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr, nativeToScVal } =
      await import("@stellar/stellar-sdk");

    const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
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
    if (!hasRpt) return res.status(403).json({ error: "Wallet must hold 1+ RPT to submit reports" });

    const server = new rpc.Server(RPC_URL);
    const oracleContract = new Contract(COMMUNITY_ORACLE);
    const escrowContract = new Contract(ESCROW);

    function makeSource(seq) {
      return {
        accountId: () => citizenAddress,
        sequenceNumber: () => seq,
        incrementSequenceNumber: () => {},
      };
    }

    async function pollForTx(hash, maxTries = 12) {
      for (let i = 0; i < maxTries; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const resp = await server.getTransaction(hash);
          if (resp.status !== "NOT_FOUND") return resp;
        } catch {}
      }
      return null;
    }

    async function submitTx(tx) {
      const prepared = await server.prepareTransaction(tx);
      prepared.sign(citizenKp);
      const result = await server.sendTransaction(prepared);
      if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
        throw new Error(`Tx status: ${result.status}`);
      }
      return result;
    }

    // ── Step 1: Submit report ───────────────────────────
    const account = await server.getAccount(citizenAddress);
    const dataHash = ipfsHash || `mobile:${Date.now()}:${lat}:${lng}`.slice(0, 64);
    const latMicro = Math.round((lat || 0) * 1_000_000);
    const lngMicro = Math.round((lng || 0) * 1_000_000);

    const reportTx = new TransactionBuilder(makeSource(account.sequenceNumber()), {
      fee: "100000", networkPassphrase: NETWORK,
    }).addOperation(oracleContract.call(
      "submit_report",
      new Address(citizenAddress).toScVal(),
      xdr.ScVal.scvU32(pvoId),
      xdr.ScVal.scvU32(milestoneId),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
      xdr.ScVal.scvString(dataHash),
      nativeToScVal(latMicro, { type: "i128" }),
      nativeToScVal(lngMicro, { type: "i128" }),
    )).setTimeout(30).build();

    // Simulate to get predicted report_id
    const sim = await server.simulateTransaction(reportTx);
    if (sim.error) {
      return res.status(500).json({ error: `Simulation failed: ${(sim.error || "").slice(0, 200)}` });
    }
    const reportId = sim.result?.retval
      ? Number(sim.result.retval.u32().toString())
      : null;

    const reportResult = await submitTx(reportTx);
    const reportConfirmed = await pollForTx(reportResult.hash);

    if (reportConfirmed?.status !== "SUCCESS") {
      return res.status(200).json({
        success: true,
        txHash: reportResult.hash,
        reportId,
        verified: false,
        gate3: false,
        note: `Report submitted but confirmation ${reportConfirmed?.status || "timeout"}`,
      });
    }

    // ── Step 2: Auto-verify report ──────────────────────
    let verified = false;
    let verifyTxHash = null;

    if (reportId) {
      const verifyAccount = await server.getAccount(citizenAddress);
      const verifyTx = new TransactionBuilder(makeSource(verifyAccount.sequenceNumber()), {
        fee: "100000", networkPassphrase: NETWORK,
      }).addOperation(oracleContract.call(
        "verify_report",
        new Address(citizenAddress).toScVal(),
        xdr.ScVal.scvU32(reportId),
        xdr.ScVal.scvU32(20),
      )).setTimeout(30).build();

      try {
        const verifyResult = await submitTx(verifyTx);
        verifyTxHash = verifyResult.hash;
        const verifyConfirmed = await pollForTx(verifyResult.hash, 10);
        verified = verifyConfirmed?.status === "SUCCESS";
      } catch (e) {
        console.error("Verify failed:", e.message?.slice(0, 100));
      }
    }

    // ── Step 3: Trigger Gate 3 on escrow ────────────────
    let gate3 = false;
    let gate3TxHash = null;

    if (verified) {
      try {
        // Find escrows for this PVO via simulation
        const escQueryAccount = await server.getAccount(citizenAddress);
        const escQueryTx = new TransactionBuilder(makeSource(escQueryAccount.sequenceNumber()), {
          fee: "100000", networkPassphrase: NETWORK,
        }).addOperation(escrowContract.call(
          "get_escrows_by_pvo",
          nativeToScVal(Number(pvoId), { type: "u32" }),
        )).setTimeout(30).build();

        const escSim = await server.simulateTransaction(escQueryTx);
        if (escSim.result?.retval && escSim.result.retval.switch().name === "scvVec") {
          const escVec = escSim.result.retval.vec();
          const candidates = [];

          for (let i = 0; i < escVec.length; i++) {
            const entry = escVec.at(i);
            const map = entry.map();
            let escId = null;
            let alreadyValidated = false;
            let alreadyConfirmed = false;
            let commRequired = 1;
            let commCount = 0;
            let milestoneId = null;

            for (const me of map) {
              const key = me.key().sym().toString();
              const val = me.val();
              if (key === "id") {
                escId = Number(val.u32().toString());
              } else if (key === "milestone_id") {
                milestoneId = Number(val.u32().toString());
              } else if (key === "conditions") {
                const condMap = val.map();
                for (const ce of condMap) {
                  const ck = ce.key().sym().toString();
                  const cv = ce.val();
                  if (ck === "community_oracle_validation") {
                    alreadyValidated = cv.b();
                  } else if (ck === "community_required") {
                    commRequired = Number(cv.u32().toString());
                  } else if (ck === "community_confirmation") {
                    commCount = Number(cv.u32().toString());
                  }
                }
              }
            }

            if (escId) {
              candidates.push({ escId, alreadyValidated, commRequired, commCount, milestoneId });
            }
          }

          // Step 3a: Trigger Gate 3 on escrows that need it
          for (const c of candidates) {
            if (c.alreadyValidated) continue;
            const gate3Account = await server.getAccount(citizenAddress);
            const gate3Tx = new TransactionBuilder(makeSource(gate3Account.sequenceNumber()), {
              fee: "100000", networkPassphrase: NETWORK,
            }).addOperation(escrowContract.call(
              "community_oracle_validate",
              new Address(citizenAddress).toScVal(),
              xdr.ScVal.scvU32(c.escId),
            )).setTimeout(30).build();

            // Simulate first to check if escrow is funded + ready
            const gate3Sim = await server.simulateTransaction(gate3Tx);
            if (gate3Sim.error) {
              console.log(`Gate3 escrow #${c.escId} sim failed: ${(gate3Sim.error || "").slice(0, 80)}`);
              continue;
            }

            try {
              const gate3Result = await submitTx(gate3Tx);
              gate3TxHash = gate3Result.hash;
              gate3 = true;
            } catch (e) {
              console.error(`Gate3 escrow #${c.escId} submit failed:`, e.message?.slice(0, 80));
            }
          }

          // Step 3b: Add community confirmation (Gate 4) on all escrows for this PVO
          let gate4 = false;
          let gate4TxHash = null;

          for (const c of candidates) {
            if (c.commCount >= c.commRequired) continue; // already met threshold

            const gate4Account = await server.getAccount(citizenAddress);
            const gate4Tx = new TransactionBuilder(makeSource(gate4Account.sequenceNumber()), {
              fee: "100000", networkPassphrase: NETWORK,
            }).addOperation(escrowContract.call(
              "add_community_confirmation",
              new Address(citizenAddress).toScVal(),
              xdr.ScVal.scvU32(c.escId),
            )).setTimeout(30).build();

            const gate4Sim = await server.simulateTransaction(gate4Tx);
            if (gate4Sim.error) {
              console.log(`Gate4 escrow #${c.escId} sim failed: ${(gate4Sim.error || "").slice(0, 80)}`);
              continue;
            }

            try {
              const gate4Result = await submitTx(gate4Tx);
              gate4TxHash = gate4Result.hash;
              gate4 = true;
              console.log(`Gate4 escrow #${c.escId} confirmed by citizen`);
            } catch (e) {
              console.error(`Gate4 escrow #${c.escId} submit failed:`, e.message?.slice(0, 80));
            }
          }
        }
      } catch (e) {
        console.error("Gate3 lookup failed:", e.message?.slice(0, 100));
      }
    }

    return res.status(200).json({
      success: true,
      txHash: reportResult.hash,
      verifyTxHash,
      gate3TxHash,
      gate4TxHash: gate4TxHash || null,
      verified,
      gate3,
      gate4,
      reportId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
