#!/usr/bin/env node
/**
 * PoPV Provenance Event Capturer - Incremental event archiver
 *
 * Continuously polls Soroban RPC for new events from all PoPV contracts.
 * Accumulates events in provenance-store.json so they persist beyond
 * the RPC retention window (~10 days on testnet).
 *
 * Usage:
 *   npx tsx provenance-indexer/archiver.ts
 *
 * The frontend server reads provenance-store.json directly when the
 * live indexer HTTP server (port 3111) is unavailable.
 */

import { rpc } from "@stellar/stellar-sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const POLL_INTERVAL_MS = 30_000;

const CONTRACT_IDS: Record<string, string> = {
  pvo_core: "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B",
  escrow: "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7",
  audit_trail: "CB6AXOUYHEOWUUSEP6543GZYHMN6D2VA5WV5LXOMPNMJFYJ3XQNPZBV6",
  community_oracle: "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32",
};

const STORE_DIR = join(__dirname, "..");
const STORE_PATH = join(STORE_DIR, "provenance-store.json");

interface CapturedEvent {
  ledger: number;
  ledgerClosedAt: string;
  contract: string;
  contractId: string;
  eventName: string;
  txHash: string;
  data: Record<string, any>;
}

interface ProvenanceStore {
  lastUpdated: number;
  lastLedger: number;
  lastCursor: string;
  pvoCount: number;
  eventCount: number;
  pvOs: any[];
  events: CapturedEvent[];
}

const server = new rpc.Server(RPC_URL);

function loadStore(): ProvenanceStore {
  try {
    if (existsSync(STORE_PATH)) {
      return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
    }
  } catch {}
  return {
    lastUpdated: 0,
    lastLedger: 0,
    lastCursor: "",
    pvoCount: 0,
    eventCount: 0,
    pvOs: [],
    events: [],
  };
}

function saveStore(store: ProvenanceStore) {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function decodeEventVal(val: any): Record<string, any> {
  const data: Record<string, any> = {};
  try {
    const entries = val.map();
    for (const entry of entries) {
      const key = entry.key().sym().toString();
      const v = entry.val();
      switch (v.switch().name) {
        case "scvU32": data[key] = v.u32(); break;
        case "scvU64": data[key] = Number(v.u64().toString()); break;
        case "scvI128": data[key] = Number(BigInt(v.i128().hi().toString()) << 64n | BigInt(v.i128().lo().toString())); break;
        case "scvString": data[key] = v.str().toString(); break;
        case "scvBool": data[key] = v.b(); break;
        case "scvSymbol": data[key] = v.sym().toString(); break;
        case "scvAddress": data[key] = v.address().toString(); break;
        case "scvMap": data[key] = decodeEventVal(v); break;
        case "scvVec": data[key] = v.vec().map((item: any) => {
          try { return decodeEventVal(item); } catch { return null; }
        }); break;
        default: data[key] = null;
      }
    }
  } catch {}
  // Also extract pvo_id from nested data if present
  if (!data.pvo_id && data.id && typeof data.id === "number") data.pvo_id = data.id;
  return data;
}

async function captureNewEvents(store: ProvenanceStore): Promise<number> {
  let captured = 0;
  const knownTxHashes = new Set(store.events.map((e) => e.txHash));

  for (const [contractName, contractId] of Object.entries(CONTRACT_IDS)) {
    let cursor: string | undefined = store.lastCursor || undefined;
    let done = false;

    for (let page = 0; page < 20 && !done; page++) {
      try {
        const resp = cursor
          ? await server.getEvents({
              filters: [{ type: "contract", contractIds: [contractId] }],
              cursor,
              limit: 200,
            })
          : await (async () => {
              const start = store.lastLedger > 0
                ? store.lastLedger
                : Math.max(1, (await server.getLatestLedger()).sequence - 100000);
              return server.getEvents({
                filters: [{ type: "contract", contractIds: [contractId] }],
                startLedger: start,
                limit: 200,
              });
            })();

        const events = resp.events || [];
        if (events.length === 0) break;

        for (const ev of events) {
          if (knownTxHashes.has(ev.txHash)) {
            done = true;
            break;
          }

          const eventName = ev.topic?.[0] ? (() => { try { return ev.topic[0].sym().toString(); } catch { return ""; } })() : "";
          const data = decodeEventVal(ev.value);

          store.events.push({
            ledger: ev.ledger,
            ledgerClosedAt: ev.ledgerClosedAt || "",
            contract: contractName,
            contractId,
            eventName,
            txHash: ev.txHash,
            data,
          });

          knownTxHashes.add(ev.txHash);
          captured++;
        }

        if (done) break;
        if (resp.cursor) {
          cursor = resp.cursor;
          store.lastCursor = resp.cursor;
        }
        if (events.length < 200) done = true;
      } catch {
        done = true;
      }
    }
  }

  if (captured > 0) {
    store.eventCount = store.events.length;
    const lastEvent = store.events[store.events.length - 1];
    store.lastLedger = lastEvent.ledger;
    store.lastCursor = store.lastCursor || "";
    store.lastUpdated = Date.now();
  }

  return captured;
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  PoPV Provenance Event Archiver      ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  RPC: ${RPC_URL}`);
  console.log(`  Store: ${STORE_PATH}`);
  console.log(`  Poll: ${POLL_INTERVAL_MS / 1000}s`);
  console.log("");

  const store = loadStore();
  console.log(`  Loaded: ${store.eventCount} events, ${store.events.length} total`);
  console.log("");

  // Initial capture from stored cursor
  const initial = await captureNewEvents(store);
  if (initial > 0) {
    saveStore(store);
    console.log(`  Captured ${initial} new events (total: ${store.eventCount})`);
  }

  // Poll for new events
  setInterval(async () => {
    const captured = await captureNewEvents(store);
    if (captured > 0) {
      saveStore(store);
      console.log(`  [+${captured}] New events captured (total: ${store.eventCount})`);
    }
  }, POLL_INTERVAL_MS);

  process.on("SIGINT", () => {
    console.log("\n  Shutting down. Store preserved.");
    saveStore(store);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
