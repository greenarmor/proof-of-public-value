/**
 * Citizen Report Relay API - Vercel Serverless Function
 * Mobile app sends report data + wallet secret key, server
 * signs transaction with citizen's key and submits on-chain.
 * After submission, auto-verifies the report so Gate 3 passes.
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

    // Simulate to extract the predicted report_id from the return value
    const sim = await server.simulateTransaction(tx);
    if (sim.error) {
      return res.status(500).json({ error: `Simulation failed: ${(sim.error || "").slice(0, 200)}` });
    }
    const reportId = sim.result?.retval
      ? Number(sim.result.retval.u32().toString())
      : null;

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(citizenKp);

    const result = await server.sendTransaction(prepared);

    if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
      return res.status(500).json({ error: `Submit status: ${result.status}` });
    }

    // Poll for confirmation so we can verify the report in the same request
    let confirmed = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const resp = await server.getTransaction(result.hash);
        if (resp.status !== "NOT_FOUND") {
          confirmed = resp;
          break;
        }
      } catch {}
    }

    if (confirmed?.status !== "SUCCESS" || !reportId) {
      return res.status(200).json({
        success: true,
        txHash: result.hash,
        verified: false,
        reportId,
        note: confirmed?.status === "SUCCESS" ? "No report_id to verify" : `Submit ${confirmed?.status || "timeout"}`,
      });
    }

    // Auto-verify: citizen verifies own report with weight 20
    const verifyAccount = await server.getAccount(citizenAddress);
    const verifyOp = contract.call(
      "verify_report",
      new Address(citizenAddress).toScVal(),
      xdr.ScVal.scvU32(reportId),
      xdr.ScVal.scvU32(20),
    );
    const verifyTx = new TransactionBuilder(
      {
        accountId: () => citizenAddress,
        sequenceNumber: () => verifyAccount.sequenceNumber(),
        incrementSequenceNumber: () => {},
      },
      { fee: "100000", networkPassphrase: NETWORK },
    ).addOperation(verifyOp).setTimeout(30).build();

    const preparedVerify = await server.prepareTransaction(verifyTx);
    preparedVerify.sign(citizenKp);
    const verifyResult = await server.sendTransaction(preparedVerify);

    const verified =
      verifyResult.status === "PENDING" || verifyResult.status === "DUPLICATE";

    return res.status(200).json({
      success: true,
      txHash: result.hash,
      verifyTxHash: verifyResult.hash || null,
      verified,
      reportId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
