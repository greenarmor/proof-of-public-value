/**
 * Vite dev server middleware for local RPT claim + Citizen role API.
 * In production (Vercel), handled by /api/*.ts serverless functions.
 */
import type { Plugin } from "vite";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const ACCESS_CONTROL = "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI";

export function claimRptPlugin(): Plugin {
  return {
    name: "claim-rpt-api",
    configureServer(server) {
      server.middlewares.use("/api/claim-rpt", async (req, res) => {
        res.setHeader("Content-Type", "application/json");

        try {
          // Parse address from GET query or POST body
          let address: string | null = null;

          if (req.method === "GET") {
            const url = new URL(req.url || "", `http://${req.headers.host}`);
            address = url.searchParams.get("address");
          } else if (req.method === "POST") {
            const body = await readBody(req);
            try {
              const parsed = JSON.parse(body);
              address = parsed.address;
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
              return;
            }
          }

          if (!address || !address.startsWith("G")) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Valid address required" }));
            return;
          }

          const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
          if (!ADMIN_SECRET) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server not configured" }));
            return;
          }

          const { Keypair, Asset, Operation, TransactionBuilder, Networks, Horizon } =
            await import("@stellar/stellar-sdk");

          const stellarServer = new Horizon.Server(HORIZON_URL);
          const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

          // Check existing RPT balance
          const acctData = await stellarServer.loadAccount(address);
          const rptBalance = acctData.balances.find(
            (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
          );

          if (rptBalance && Number(rptBalance.balance) >= 1) {
            res.end(JSON.stringify({ success: true, alreadyOwned: true, message: "Already has RPT" }));
            return;
          }

          // Check trustline
          const hasTrustline = acctData.balances.some(
            (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
          );
          if (!hasTrustline) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No RPT trustline", needsTrustline: true }));
            return;
          }

          // Mint 1 RPT
          const adminAccount = await stellarServer.loadAccount(adminKeypair.publicKey());
          const rptAsset = new Asset("RPT", RPT_ISSUER);

          const tx = new TransactionBuilder(adminAccount, {
            fee: "100000",
            networkPassphrase: Networks.TESTNET,
          })
            .addOperation(
              Operation.payment({ destination: address, asset: rptAsset, amount: "1" }),
            )
            .setTimeout(30)
            .build();

          tx.sign(adminKeypair);
          const result = await stellarServer.submitTransaction(tx);

          res.end(JSON.stringify({ success: true, txHash: result.hash, alreadyOwned: false }));
        } catch (err: any) {
          console.error("RPT claim error:", err.message);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err.response?.data?.extras?.result_codes?.transaction || err.message || "Unknown error",
            }),
          );
        }
      });

      // ── Citizen role assignment ──
      server.middlewares.use("/api/claim-citizen", async (req, res) => {
        res.setHeader("Content-Type", "application/json");

        try {
          let address: string | null = null;

          if (req.method === "GET") {
            const url = new URL(req.url || "", `http://${req.headers.host}`);
            address = url.searchParams.get("address");
          } else if (req.method === "POST") {
            const body = await readBody(req);
            try {
              address = JSON.parse(body).address;
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
              return;
            }
          }

          if (!address || !address.startsWith("G")) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Valid address required" }));
            return;
          }

          const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
          if (!ADMIN_SECRET) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server not configured" }));
            return;
          }

          const { Keypair, Address, Contract, TransactionBuilder, Networks, Horizon, rpc, xdr } =
            await import("@stellar/stellar-sdk");

          // 1. Verify 1+ RPT
          const horizonServer = new Horizon.Server(HORIZON_URL);
          let hasRpt = false;
          try {
            const acctData = await horizonServer.loadAccount(address);
            const rptBalance = acctData.balances.find(
              (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
            );
            if (rptBalance && Number(rptBalance.balance) >= 1) hasRpt = true;
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Wallet not found on testnet" }));
            return;
          }

          if (!hasRpt) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Must hold 1+ RPT to become a citizen" }));
            return;
          }

          // 2. Assign Citizen role via Soroban
          const sorobanServer = new rpc.Server(RPC_URL);
          const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
          const adminAddr = adminKeypair.publicKey();

          const adminAccount = await sorobanServer.getAccount(adminAddr);
          const adminAddress = new Address(adminAddr);
          const targetAddr = new Address(address);
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
            res.end(JSON.stringify({ success: true, txHash: result.hash, alreadyCitizen: false }));
          } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `Transaction status: ${result.status}` }));
          }
        } catch (err: any) {
          console.error("Citizen role error:", err.message);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err.response?.data?.extras?.result_codes?.transaction || err.message || "Unknown error",
            }),
          );
        }
      });
    },
  };
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
