#!/usr/bin/env node

/**
 * PoPV Event Indexer — Listens for contract events on Stellar testnet
 * and indexes them for fast queries and dashboard monitoring.
 *
 * Usage: node index.js
 */

import { rpc } from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

const CONTRACTS = {
  access_control: "CCALCCU4NHS42HFO6FJPEF772COMG4FDV2TY3WLPMCWJDQZEVBYXAN7Z",
  audit_trail: "CB6AXOUYHEOWUUSEP6543GZYHMN6D2VA5WV5LXOMPNMJFYJ3XQNPZBV6",
  community_oracle: "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32",
  escrow: "CCA3TW7ZBOD6EYOFVDS3OLWILBAD4GJT2MHDKA62WAX4NSUNIOQGPCYD",
  pvo_core: "CBZMGTVCGWA4XQWGXYHYP42YRM5VSCMC7UL5ASIFDBKIYRZRBJ2BJXTU",
  reputation: "CD7FFWLH2YD57MV5HXT74RBXIJ6IRFLLEATXFACQCDB275EWN5W7L3BG",
  value_score: "CB6YODGT7D5O2PXBCM3RMGOVMNUMYB7U2TDTPMZPTUK2IBBBUPHE2UVU",
  ai_oracle: "CAVOYO6RPO3P6WRTD73Y4EQCWZVSCY6JCWELG3MFKNIIQ7IJCGNRWR7G",
  public_index: "CDC66L3ZVAOJZN3ZJOFZLAJQOML6LXKAMCEG27BIGKU6J4H7T4FGERYF",
  compliance_engine: "CAB4BREUIZPAVZIQ7AL2YTKSXBOAL5EQUFSTDOBYMJV34BPHWGLI5SCB",
  procurement_market: "CB3CQCAEDZSOPJZDOYBM2KRRWMV4KNKYPREUMLETOBE4UPBA47FRP34F",
};

/** In-memory event store (replace with DB for production) */
const events = [];

const stats = {
  total: 0,
  byContract: {},
  startTime: Date.now(),
};

const server = new rpc.Server(RPC_URL);

function log(name, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${name}:`, JSON.stringify(data).slice(0, 200));
}

async function pollEvents() {
  try {
    for (const [name, contractId] of Object.entries(CONTRACTS)) {
      // Poll the latest ledger entry for this contract
      // In production, use getEvents() with startLedger cursor
      try {
        const result = await server.getLatestLedger();
        if (!stats.byContract[name]) {
          stats.byContract[name] = { checked: 0 };
        }
        stats.byContract[name].checked++;
        stats.byContract[name].lastLedger = result.sequence;
      } catch (e) {
        // Contract may not have events yet
        if (!stats.byContract[name]) stats.byContract[name] = { errors: 0 };
        stats.byContract[name].errors++;
      }
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  }
}

async function healthCheck() {
  try {
    const health = await server.getHealth();
    return health.status === "healthy";
  } catch {
    return false;
  }
}

function printStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  console.log("\n=== PoPV Event Indexer Stats ===");
  console.log(`Uptime: ${uptime}s | Events indexed: ${stats.total}`);
  console.log(`RPC: ${CONTRACTS.length} contracts monitored`);
  console.log("===============================\n");
}

async function main() {
  console.log("=== PoPV Event Indexer ===");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Contracts: ${Object.keys(CONTRACTS).length}`);
  console.log("Starting event polling...\n");

  // Initial health check
  const healthy = await healthCheck();
  log("Health", { status: healthy ? "healthy" : "unhealthy" });

  // Poll every 10 seconds
  setInterval(pollEvents, 10_000);

  // Print stats every 60 seconds
  setInterval(printStats, 60_000);

  // Initial poll
  pollEvents();
}

main().catch(console.error);
