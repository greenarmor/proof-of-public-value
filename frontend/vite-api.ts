/**
 * Vite dev server middleware for local RPT claim + Citizen role API.
 * In production (Vercel), handled by /api/*.ts serverless functions.
 */
import type { Plugin } from "vite";
import { join } from "path";
import { readFileSync } from "fs";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const ACCESS_CONTROL = "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI";

const PROVENANCE_PATH = join(process.cwd(), "provenance-store.json");

export function claimRptPlugin(): Plugin {
  return {
    name: "claim-rpt-api",
    configureServer(server) {
      server.middlewares.use("/api/claim-rpt", async (req, res) => {
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

          const { Keypair, Asset, Operation, TransactionBuilder, Networks, Horizon } =
            await import("@stellar/stellar-sdk");

          const stellarServer = new Horizon.Server(HORIZON_URL);
          const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

          let alreadyHasRpt = false;
          try {
            const acctData = await stellarServer.loadAccount(address);
            const rptBalance = acctData.balances.find(
              (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
            );
            if (rptBalance && Number(rptBalance.balance) >= 1) alreadyHasRpt = true;
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Wallet not found or no trustline" }));
            return;
          }

          if (alreadyHasRpt) {
            res.end(JSON.stringify({ success: true, alreadyOwned: true, message: "Already has RPT" }));
            return;
          }

          const acctData = await stellarServer.loadAccount(address);
          const hasTrustline = acctData.balances.some(
            (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
          );
          if (!hasTrustline) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No RPT trustline", needsTrustline: true }));
            return;
          }

          const adminAccount = await stellarServer.loadAccount(adminKeypair.publicKey());
          const rptAsset = new Asset("RPT", RPT_ISSUER);

          const tx = new TransactionBuilder(adminAccount, {
            fee: "100000",
            networkPassphrase: Networks.TESTNET,
          })
            .addOperation(Operation.payment({ destination: address, asset: rptAsset, amount: "1" }))
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

          const { Keypair, Address, Contract, TransactionBuilder, Horizon, rpc, xdr } =
            await import("@stellar/stellar-sdk");

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

      // ── Submit Citizen Report (mobile relay) ──
      server.middlewares.use("/api/submit-report", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const body = await readBody(req);
          const { pvoId, milestoneId, lat, lng, notes, citizenAddress } = JSON.parse(body);

          if (!pvoId || !milestoneId || !citizenAddress?.startsWith("G")) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "pvoId, milestoneId, lat, lng, citizenAddress required" }));
            return;
          }

          const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
          if (!ADMIN_SECRET) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server not configured" }));
            return;
          }

          const { Keypair, Address, Contract, TransactionBuilder, rpc, xdr } = await import("@stellar/stellar-sdk");
          const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
          const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
          const RPC_URL = "https://soroban-testnet.stellar.org:443";
          const HORIZON = "https://horizon-testnet.stellar.org";
          const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";

          // Verify citizen has RPT
          const rptResp = await fetch(`${HORIZON}/accounts/${citizenAddress}`);
          if (!rptResp.ok) { res.statusCode = 403; res.end(JSON.stringify({ error: "Wallet not found" })); return; }
          const rptData = await rptResp.json();
          const hasRpt = rptData.balances?.some(
            (b) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER && Number(b.balance) >= 1
          );
          if (!hasRpt) { res.statusCode = 403; res.end(JSON.stringify({ error: "Wallet must hold 1+ RPT" })); return; }

          const adminKp = Keypair.fromSecret(ADMIN_SECRET);
          const server = new rpc.Server(RPC_URL);
          const account = await server.getAccount(adminKp.publicKey());

          const dataHash = `mobile:${Date.now()}:${lat}:${lng}`.slice(0, 64);
          const latMicro = Math.round((lat || 0) * 1_000_000);
          const lngMicro = Math.round((lng || 0) * 1_000_000);

          const contract = new Contract(COMMUNITY_ORACLE);
          const op = contract.call("submit_report",
            new Address(citizenAddress).toScVal(),
            xdr.ScVal.scvU32(pvoId),
            xdr.ScVal.scvU32(milestoneId),
            xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
            xdr.ScVal.scvString(dataHash),
            xdr.ScVal.scvI128({ hi: 0, lo: latMicro }),
            xdr.ScVal.scvI128({ hi: 0, lo: lngMicro }),
          );

          const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
            .addOperation(op).setTimeout(30).build();
          const prepared = await server.prepareTransaction(tx);
          prepared.sign(adminKp);
          const result = await server.sendTransaction(prepared);

          if (result.status === "PENDING" || result.status === "DUPLICATE") {
            res.end(JSON.stringify({ success: true, txHash: result.hash }));
          } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `Status: ${result.status}` }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message?.slice(0, 200) }));
        }
      });

      // ── Provenance data ──
      server.middlewares.use("/api/provenance", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        try {
          const raw = readFileSync(PROVENANCE_PATH, "utf-8");
          const parsed = JSON.parse(raw);
          res.end(JSON.stringify(parsed.pvOs || []));
        } catch {
          res.end(JSON.stringify([]));
        }
      });

      server.middlewares.use("/api/health", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "ok", version: "dev", uptime: process.uptime() }));
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
