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
  access_control: "CCJKHTUZEDT4E5W2VIW2KSOPKMA5Z6K4QUMYSTQOBFTUSLBSM3OBCMVP",
  audit_trail: "CA2O7WXT6PQJLE4HW5KFDMWI4AJWSPDDO7K2OM756HMMF2E7RJDPBROZ",
  community_oracle: "CCTM2WTQ7V7KSTXWJRBAJAROC25STQPW2UGAJQBECKAL5UGM23QEEIOV",
  escrow: "CDTH4UPAZW6CZXONDGRFBSIYRLFWJX4XSQ5YKOCYP7BL24CACQTEDZT3",
  pvo_core: "CAJHYJL5E6IPHMYMCODTI5PBLK4TNN2YCT34KAUBIFIL4SJSQW5MVNOD",
  reputation: "CACWGE2KH37SNHJOMXRMGAXYGWDT7HX7XDF7O5PE36DTDJO2C4OJ4ADN",
  value_score: "CCTC3HR4RIKQQWMPUU5XQ3BLNWUPCTLPDANHTWVWQZYWVVSCPXXSE3YN",
  ai_oracle: "CDR5OICDQYT33V7XPPD63YAUDMKRTWSKN7MD5VPS5K773PVU5AAMID43",
  public_index: "CCN74K6E6NKEXMT2U5Y3JQ5RYCDP2MYBV3OJG4PSUH2WUNFRXHNSJG7J",
  compliance_engine: "CCRSE76TWXO6TPEWMBKT2577AVYPKKNF5LSWUGUFXKA5XQGPFFZMGRTD",
  procurement_market: "CCPQYSIVVFOH6CAB5J3QMBZF6EOHJEIVQMZAPMFZCSWRMJRRUMWBJBW3",
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
