/**
 * Citizen Role Assignment API - Vercel Serverless Function
 *
 * Auto-assigns "Citizen" role to wallets that hold 1+ RPT.
 * Admin secret key is server-side only - never exposed to frontend.
 *
 * GET/POST /api/claim-citizen?address=GXXXX  or  {"address":"GXXXX"}
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const ACCESS_CONTROL = "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI";

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

  const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const { Keypair, Address, Contract, TransactionBuilder, Networks, Horizon, rpc, xdr } =
      await import("@stellar/stellar-sdk");

    // 1. Verify wallet has 1+ RPT
    const horizonServer = new Horizon.Server(HORIZON_URL);
    let hasRpt = false;
    try {
      const acctData = await horizonServer.loadAccount(address);
      const rptBalance = acctData.balances.find(
        (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
      );
      if (rptBalance && Number(rptBalance.balance) >= 1) {
        hasRpt = true;
      }
    } catch {
      return res.status(400).json({ error: "Wallet not found on testnet" });
    }

    if (!hasRpt) {
      return res.status(403).json({ error: "Wallet must hold 1+ RPT to become a citizen" });
    }

    // 2. Check if already has Citizen role via Soroban RPC
    const sorobanServer = new rpc.Server(RPC_URL);
    const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
    const adminAddr = adminKeypair.publicKey();
    const targetAddr = new Address(address);

    // Try reading current roles
    try {
      const acContract = new Contract(ACCESS_CONTROL);
      const checkTx = new TransactionBuilder(
        await sorobanServer.getAccount(adminAddr),
        { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE },
      )
        .addOperation(
          acContract.call("get_role", targetAddr.toScVal()),
        )
        .setTimeout(30)
        .build();

      const sim = await sorobanServer.simulateTransaction(checkTx);
      if (sim.result) {
        const simStr = JSON.stringify(sim);
        if (simStr.includes("Citizen")) {
          return res.status(200).json({
            success: true,
            message: "Already a citizen",
            alreadyCitizen: true,
          });
        }
      }
    } catch {}

    // 3. Assign Citizen role
    const adminAccount = await sorobanServer.getAccount(adminAddr);
    const adminAddress = new Address(adminAddr);
    const acContract = new Contract(ACCESS_CONTROL);

    const tx = new TransactionBuilder(adminAccount, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        acContract.call(
          "assign_role",
          adminAddress.toScVal(),
          targetAddr.toScVal(),
          xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Citizen")]),
        ),
      )
      .setTimeout(30)
      .build();

    const prepared = await sorobanServer.prepareTransaction(tx);
    prepared.sign(adminKeypair);

    const result = await sorobanServer.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      return res.status(200).json({
        success: true,
        message: "Citizen role assigned",
        txHash: result.hash,
        alreadyCitizen: false,
      });
    } else {
      return res.status(500).json({ error: `Transaction status: ${result.status}` });
    }
  } catch (err: any) {
    console.error("Citizen role error:", err.message || err);
    const msg =
      err.response?.data?.extras?.result_codes?.transaction ||
      err.message ||
      "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
