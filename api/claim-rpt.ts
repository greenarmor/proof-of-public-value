/**
 * RPT Claim API - Vercel Serverless Function
 *
 * Mints exactly 1 RPT (Reporting Token) to a wallet that has a trustline.
 * Admin secret key is server-side only - never exposed to frontend.
 *
 * GET /api/claim-rpt?address=GXXXX
 */

import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  Networks,
  Horizon,
} from "@stellar/stellar-sdk";

type VercelRequest = any;
type VercelResponse = any;

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

if (!ADMIN_SECRET) {
  console.error("ADMIN_SECRET_KEY environment variable is not set");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address =
    req.method === "GET"
      ? (req.query.address as string)
      : (req.body?.address as string);

  if (!address || !address.startsWith("G")) {
    return res.status(400).json({ error: "Valid wallet address required" });
  }

  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const server = new Horizon.Server(HORIZON_URL);
    const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

    // Check if wallet already has RPT balance
    let alreadyHasRpt = false;
    try {
      const acctData = await server.loadAccount(address);
      const rptBalance = acctData.balances.find(
        (b: any) =>
          b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
      );
      if (rptBalance && Number(rptBalance.balance) >= 1) {
        alreadyHasRpt = true;
      }
    } catch {
      return res.status(400).json({ error: "Wallet not found or no trustline" });
    }

    if (alreadyHasRpt) {
      return res.status(200).json({
        success: true,
        message: "Wallet already has RPT",
        alreadyOwned: true,
      });
    }

    // Check for trustline
    const acctData = await server.loadAccount(address);
    const hasTrustline = acctData.balances.some(
      (b: any) =>
        b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
    );

    if (!hasTrustline) {
      return res.status(400).json({
        error: "No RPT trustline. Add trustline first.",
        needsTrustline: true,
      });
    }

    // Load admin account and build payment tx
    const adminAccount = await server.loadAccount(adminKeypair.publicKey());
    const rptAsset = new Asset("RPT", RPT_ISSUER);

    const tx = new TransactionBuilder(adminAccount, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: address,
          asset: rptAsset,
          amount: "1",
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(adminKeypair);

    const result = await server.submitTransaction(tx);

    return res.status(200).json({
      success: true,
      message: "1 RPT minted successfully",
      txHash: result.hash,
      alreadyOwned: false,
    });
  } catch (err: any) {
    console.error("RPT claim error:", err.message || err);
    const msg =
      err.response?.data?.extras?.result_codes?.transaction ||
      err.message ||
      "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
