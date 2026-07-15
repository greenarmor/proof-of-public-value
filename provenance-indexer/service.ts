#!/usr/bin/env node
/**
 * PoPV Provenance Indexer - Independent audit trail service
 *
 * Builds provenance chains per PVO: PVO (parent) → Milestone (child) → Gate records (sub).
 * Each record links to its Stellar transaction hash for audit trackback.
 *
 * Serves: Funding Agency, COA (Commission on Audit), Administrator
 *
 * Usage:
 *   npx tsx provenance-indexer/service.ts            # Continuous: poll + serve API on :3111
 *   npx tsx provenance-indexer/service.ts --once      # Build once, serve, exit after 10s
 *   npx tsx provenance-indexer/service.ts --build     # Build once, no HTTP server
 *   npx tsx provenance-indexer/service.ts --rebuild   # Force full rebuild (re-scan all ledgers)
 *
 * API endpoints:
 *   GET /api/health                              → service status
 *   GET /api/provenance                          → all PVO provenance trees
 *   GET /api/provenance/:pvoId                   → single PVO provenance chain
 *   GET /api/provenance/:pvoId/timeline          → chronological event timeline
 *   GET /api/events                              → all captured events with tx hashes
 *   GET /api/events/:contractName                → events for a specific contract
 */

import { execSync } from "child_process";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { rpc } from "@stellar/stellar-sdk";

const __dirname_local = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const POLL_INTERVAL_MS = 30_000;
const HTTP_PORT = 3111;
const MAX_LEDGER_RANGE = 120000; // ~2 weeks of testnet history
const CHUNK_SIZE = 2000; // ledgers per RPC call (API limits)

const CONTRACT_IDS: Record<string, string> = {
  pvo_core: "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B",
  escrow: "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7",
  audit_trail: "CB6AXOUYHEOWUUSEP6543GZYHMN6D2VA5WV5LXOMPNMJFYJ3XQNPZBV6",
  procurement_market: "CAQ6D4G4N4JOERAXBD227MOSUJAGFE7I7LZL6DHRQZZUI5DZ5AXYHJVP",
  compliance_engine: "CAB4BREUIZPAVZIQ7AL2YTKSXBOAL5EQUFSTDOBYMJV34BPHWGLI5SCB",
  community_oracle: "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32",
  ai_oracle: "CAVOYO6RPO3P6WRTD73Y4EQCWZVSCY6JCWELG3MFKNIIQ7IJCGNRWR7G",
};

const CONTRACT_NAME_BY_ID: Record<string, string> = {};
for (const [name, id] of Object.entries(CONTRACT_IDS)) {
  CONTRACT_NAME_BY_ID[id] = name;
}

const PPHP_SCALE = 10_000_000;

const READ_SOURCE = process.env.PROVENANCE_SOURCE ?? "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";

const HOME = process.env.HOME ?? "/root";
const STELLAR = `${HOME}/.local/bin/stellar`;

// Load .env file if it exists
const envPath = join(__dirname_local, "..", ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
  console.log("  Loaded .env from", envPath);
}

// Read env vars AFTER .env is loaded
const API_KEY = process.env.PROVENANCE_API_KEY ?? "";

const STORE_DIR = join(__dirname_local, "..");
const STORE_PATH = join(STORE_DIR, "provenance-store.json");

const opts = {
  env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` },
  encoding: "utf-8" as BufferEncoding,
  timeout: 30_000,
};

const sdkServer = new rpc.Server(RPC_URL);

// ── Types ───────────────────────────────────────────────
type GateStatus = "pending" | "passed" | "failed";

interface GateRecord {
  gate_number: number;
  gate_name: string;
  contract_fn: string;
  status: GateStatus;
  actor?: string;
  risk_score?: number;
  tx_hash?: string;
  ledger?: number;
  timestamp?: number;
}

interface EscrowSummary {
  escrow_id: number;
  pvo_id: number;
  milestone_id: number;
  amount: number;
  status: string;
  funder: string;
  recipient: string;
  funded: boolean;
  released: boolean;
  released_at?: number;
}

interface MilestoneProvenance {
  milestone_id: number;
  milestone_title: string;
  description: string;
  budget: number;
  status: string;
  evidence_count: number;
  evidence_types: string[];
  evidence_items: EvidenceItem[];
  escrow?: EscrowSummary;
  gates: GateRecord[];
}

interface EvidenceItem {
  id: number;
  type: string;
  data_hash: string;
  metadata: string;
  verified: boolean;
  submitted_at: number;
}

interface TimelineEntry {
  order: number;
  timestamp: number;
  type: string;
  description: string;
  tx_hash?: string;
  ledger?: number;
  actor?: string;
  contract: string;
}

interface PVOProvenance {
  pvo_id: number;
  title: string;
  department: string;
  municipality: string;
  description: string;
  total_budget: number;
  status: string;
  funding_agency: string;
  contractor?: string;
  project_manager?: string;
  fund_source: string;
  public_value_score: number;
  contractor_assigned: boolean;
  created_ledger?: number;
  milestones: MilestoneProvenance[];
  timeline: TimelineEntry[];
  stats: {
    total_escrowed: number;
    total_released: number;
    total_funded: number;
    gates_passed: number;
    gates_total: number;
    evidence_submitted: number;
  };
}

interface CapturedEvent {
  ledger: number;
  ledgerClosedAt: string;
  contract: string;
  contractId: string;
  eventName: string;
  txHash: string;
  data: Record<string, unknown>;
}

interface ProvenanceStore {
  lastUpdated: number;
  lastLedger: number;
  earliestLedger: number;
  pvoCount: number;
  escrowCount: number;
  eventCount: number;
  pvOs: PVOProvenance[];
  events: CapturedEvent[];
  stats: {
    totalEscrowed: number;
    totalReleased: number;
    totalFunded: number;
    totalGatesPassed: number;
    totalGatesPending: number;
  };
}

// ── CLI Helper ──────────────────────────────────────────
function cli(cmd: string): string {
  try {
    return execSync(`${STELLAR} ${cmd} 2>/dev/null`, opts).trim();
  } catch {
    return "";
  }
}

function invokeJSON(contractId: string, fn: string, args: string[] = []): any {
  const argStr = args.length > 0 ? ` -- ${fn} ${args.join(" ")}` : ` -- ${fn}`;
  const raw = cli(
    `contract invoke --id ${contractId} --source-account ${READ_SOURCE} --network testnet ${argStr}`
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.result ?? parsed;
  } catch {
    return null;
  }
}

// ── ScVal Decoder (SDK v16 returns decoded ScVal objects) ──
function decodeScVal(scVal: any): any {
  if (!scVal || typeof scVal !== "object") return scVal;

  try { return scVal.b(); } catch {}
  try { return scVal.u32(); } catch {}
  try { return scVal.i32(); } catch {}
  try { return scVal.sym().toString(); } catch {}
  try { return scVal.str().toString(); } catch {}
  try { return scVal.address().toString(); } catch {}
  try {
    const v = scVal.i128();
    return Number((BigInt(v.hi().toString()) << 64n) | BigInt(v.lo().toString()));
  } catch {}
  try {
    const v = scVal.u128();
    return Number((BigInt(v.hi().toString()) << 64n) | BigInt(v.lo().toString()));
  } catch {}
  try { return Number(scVal.u64().toString()); } catch {}
  try { return Number(scVal.i64().toString()); } catch {}

  try {
    const entries = scVal.map();
    const result: Record<string, any> = {};
    for (const entry of entries) {
      const key = decodeScVal(entry.key());
      result[String(key)] = decodeScVal(entry.val());
    }
    return result;
  } catch {}

  try {
    return scVal.vec().map((v: any) => decodeScVal(v));
  } catch {}

  try {
    return Buffer.from(scVal.bytes()).toString("hex");
  } catch {}

  return null;
}

function decodeEventTopic(topicVal: any): string {
  try {
    const decoded = decodeScVal(topicVal);
    return typeof decoded === "string" ? decoded : "unknown";
  } catch {
    return "unknown";
  }
}

function decodeEventValue(valueVal: any): Record<string, any> {
  const decoded = decodeScVal(valueVal);
  if (typeof decoded === "object" && decoded !== null) return decoded;
  return { _value: decoded };
}

// ── Event Fetcher ───────────────────────────────────────
async function fetchEvents(
  startLedger: number,
  endLedger: number
): Promise<CapturedEvent[]> {
  const allEvents: CapturedEvent[] = [];
  const contractIdList = Object.values(CONTRACT_IDS);
  const batchSize = 5;

  for (let i = 0; i < contractIdList.length; i += batchSize) {
    const batch = contractIdList.slice(i, i + batchSize);

    try {
      const resp = await sdkServer.getEvents({
        startLedger,
        endLedger,
        limit: 200,
        filters: [{ type: "contract", contractIds: batch }],
      });

      for (const ev of resp.events) {
        const eventName = ev.topic?.length > 0
          ? decodeEventTopic(ev.topic[0])
          : "unknown";
        const data = ev.value ? decodeEventValue(ev.value) : {};
        const contractName = CONTRACT_NAME_BY_ID[ev.contractId] ?? ev.contractId;

        allEvents.push({
          ledger: ev.ledger,
          ledgerClosedAt: ev.ledgerClosedAt,
          contract: contractName,
          contractId: ev.contractId,
          eventName,
          txHash: ev.txHash,
          data,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "object" ? JSON.stringify(e) : String(e);
      console.error(`  ⚠️ Event fetch error (batch ${i / batchSize + 1}): ${msg.slice(0, 200)}`);
    }
  }

  return allEvents;
}

function ledgerToTimestamp(ledgerClosedAt: string): number {
  return new Date(ledgerClosedAt).getTime();
}

// ── Contract Readers ────────────────────────────────────
function readPVOCount(): number {
  const raw = invokeJSON(CONTRACT_IDS.pvo_core, "get_pvo_count");
  const match = typeof raw === "string"
    ? raw.match(/"?(\d+)"?/)
    : null;
  if (match) return parseInt(match[1]);
  if (typeof raw === "number") return raw;
  return 0;
}

function readPVO(pvoId: number): any | null {
  return invokeJSON(CONTRACT_IDS.pvo_core, "get_pvo", [`--pvo_id ${pvoId}`]);
}

function readPVOMilestones(pvoId: number): any[] {
  const result = invokeJSON(CONTRACT_IDS.pvo_core, "get_pvo_milestones", [`--pvo_id ${pvoId}`]);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function readEscrowCount(): number {
  const raw = invokeJSON(CONTRACT_IDS.escrow, "get_escrow_count");
  const match = typeof raw === "string"
    ? raw.match(/"?(\d+)"?/)
    : null;
  if (match) return parseInt(match[1]);
  if (typeof raw === "number") return raw;
  return 0;
}

function readEscrow(escrowId: number): any | null {
  return invokeJSON(CONTRACT_IDS.escrow, "get_escrow", [`--escrow_id ${escrowId}`]);
}

function readAuditEntries(pvoId: number): any[] {
  const result = invokeJSON(CONTRACT_IDS.audit_trail, "get_pvo_audit_history", [`--pvo_id ${pvoId}`]);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function readTenders(): any[] {
  const result = invokeJSON(CONTRACT_IDS.procurement_market, "get_tenders");
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function readCommunityReports(): any[] {
  const count = Number(invokeJSON(CONTRACT_IDS.community_oracle, "get_report_count") || 0);
  const reports: any[] = [];
  let misses = 0;
  for (let id = 1; id <= count + 30; id++) {
    const report = invokeJSON(CONTRACT_IDS.community_oracle, "get_report", [`--report_id ${id}`]);
    if (report && report.id) { reports.push(report); misses = 0; }
    else { misses++; }
    if (misses >= 15 && id > count) break;
  }
  return reports;
}

// ── Helpers ─────────────────────────────────────────────
function extractStatus(statusField: any): string {
  if (!statusField) return "Unknown";
  if (typeof statusField === "string") return statusField;
  if (Array.isArray(statusField) && statusField.length > 0) {
    return typeof statusField[0] === "string"
      ? statusField[0]
      : extractStatus(statusField[0]);
  }
  return statusField.tag ?? statusField.variant ?? JSON.stringify(statusField);
}

function extractEnumList(arr: any[]): string[] {
  return arr.map((item) => {
    if (typeof item === "string") return item;
    return item?.tag ?? item?.variant ?? "Unknown";
  });
}

function toPesos(amount: number | undefined): number {
  if (!amount || isNaN(amount)) return 0;
  return amount / PPHP_SCALE;
}

function extractAddress(field: any): string | undefined {
  if (!field) return undefined;
  if (typeof field === "string") return field;
  return undefined;
}

function extractGateStatus(condition: boolean | undefined): GateStatus {
  if (condition === true) return "passed";
  return "pending";
}

// ── Provenance Builder ──────────────────────────────────
function buildGatesFromEscrow(escrow: any): GateRecord[] {
  const conds = escrow?.conditions ?? {};
  return [
    {
      gate_number: 1,
      gate_name: "Engineer Approval",
      contract_fn: "engineer_approve",
      status: extractGateStatus(conds.engineer_approval),
    },
    {
      gate_number: 2,
      gate_name: "Compliance Check",
      contract_fn: "compliance_validate",
      status: extractGateStatus(conds.compliance_validation),
    },
    {
      gate_number: 3,
      gate_name: "Community Oracle",
      contract_fn: "community_oracle_validate",
      status: extractGateStatus(conds.community_oracle_validation),
    },
    {
      gate_number: 4,
      gate_name: "Community Confirmation",
      contract_fn: "add_community_confirmation",
      status:
        Number(conds.community_confirmation ?? 0) >=
        Number(conds.community_required ?? 1)
          ? "passed"
          : "pending",
    },
    {
      gate_number: 5,
      gate_name: "AI Risk Check",
      contract_fn: "ai_validate",
      status: extractGateStatus(conds.ai_risk_check),
    },
  ];
}

function matchGateTxHashes(gates: GateRecord[], events: CapturedEvent[], escrowId: number): void {
  const escrowEvents = events.filter(
    (e) =>
      e.contract === "escrow" &&
      (e.data.id === escrowId || e.data.id === Number(escrowId))
  );

  for (const gate of gates) {
    const statusFromGate = mapGateToStatus(gate.gate_number);
    const matchingEvent = escrowEvents.find((e) => {
      const name = e.eventName.toLowerCase();
      if (name.includes("condition_updated") || name.includes("condition")) {
        const evStatus = extractStatus(e.data.status);
        return statusFromGate.includes(evStatus);
      }
      return false;
    });
    if (matchingEvent) {
      gate.tx_hash = matchingEvent.txHash;
      gate.ledger = matchingEvent.ledger;
      gate.timestamp = ledgerToTimestamp(matchingEvent.ledgerClosedAt);
    }
  }
}

function mapGateToStatus(gateNum: number): string[] {
  switch (gateNum) {
    case 1: return ["EngineerApproved"];
    case 2: return ["CompliancePassed"];
    case 3: return ["OracleValidated"];
    case 4: return ["CommunityVerified"];
    case 5: return ["AIValidated"];
    default: return [];
  }
}

function buildTimeline(
  pvoId: number,
  milestones: MilestoneProvenance[],
  events: CapturedEvent[],
  auditEntries: any[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let order = 0;

  const relevantEvents = events.filter((e) => {
    if (e.contract === "pvo_core") {
      return e.data.id === pvoId || e.data.pvo_id === pvoId ||
             e.data.id === Number(pvoId) || e.data.pvo_id === Number(pvoId);
    }
    if (e.contract === "escrow") {
      return milestones.some(
        (m) =>
          m.escrow &&
          (m.escrow.escrow_id === e.data.id ||
            m.escrow.escrow_id === Number(e.data.id))
      );
    }
    return false;
  });

  for (const ev of relevantEvents) {
    const ts = ledgerToTimestamp(ev.ledgerClosedAt);
    entries.push({
      order: order++,
      timestamp: ts,
      type: ev.eventName,
      description: describeEvent(ev),
      tx_hash: ev.txHash,
      ledger: ev.ledger,
      contract: ev.contract,
    });
  }

  for (const entry of auditEntries) {
    entries.push({
      order: order++,
      timestamp: Number(entry.timestamp ?? 0) * 1000,
      type: `audit:${entry.category ?? "record"}`,
      description: entry.action ??
        `${entry.category ?? "Decision"} by ${entry.actor_role ?? "unknown"}`,
      ledger: entry.block_height,
      actor: typeof entry.actor === "string"
        ? entry.actor
        : extractAddress(entry.actor),
      contract: "audit_trail",
    });
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp).map((e, i) => ({ ...e, order: i }));
}

function describeEvent(ev: CapturedEvent): string {
  const d = ev.data;
  const name = ev.eventName;
  if (name.includes("pvo_created")) {
    return `PVO created: ${d.title ?? "Untitled"}`;
  }
  if (name.includes("pvo_status")) {
    return `Status: ${extractStatus(d.old_status)} → ${extractStatus(d.new_status)}`;
  }
  if (name.includes("milestone_created")) {
    return `Milestone #${d.milestone_id} created (${toPesos(d.budget).toLocaleString()} PHP)`;
  }
  if (name.includes("evidence_submitted")) {
    return `Evidence #${d.evidence_id} submitted (${extractStatus(d.evidence_type)})`;
  }
  if (name.includes("contractor_assigned")) {
    return `Contractor assigned`;
  }
  if (name.includes("value_score")) {
    return `Public value score: ${d.score}`;
  }
  if (name.includes("escrow_created")) {
    return `Escrow #${d.id} created - ${toPesos(d.amount).toLocaleString()} PHP`;
  }
  if (name.includes("escrow_funded")) {
    return `Escrow #${d.id} funded (${toPesos(d.amount).toLocaleString()} PHP)`;
  }
  if (name.includes("escrow_released")) {
    return `Escrow #${d.id} released (${toPesos(d.amount).toLocaleString()} PHP → ${d.recipient ?? "recipient"})`;
  }
  if (name.includes("escrow_refunded")) {
    return `Escrow #${d.id} refunded`;
  }
  if (name.includes("escrow_condition_updated") || name.includes("EscrowConditionUpdated")) {
    return `Escrow #${d.id} → ${extractStatus(d.status)}`;
  }
  if (name.includes("escrow_disputed")) {
    return `Escrow #${d.id} disputed`;
  }
  return `${ev.contract}:${name}`;
}

function buildMilestoneProvenance(
  m: any,
  pvoId: number,
  escrows: any[],
  events: CapturedEvent[]
): MilestoneProvenance {
  const milestoneId = m.id;
  const matchingEscrow = escrows.find(
    (e) =>
      Number(e.pvo_id) === Number(pvoId) &&
      Number(e.milestone_id) === Number(milestoneId)
  );

  let escrowSummary: EscrowSummary | undefined;
  let gates: GateRecord[] = [];

  if (matchingEscrow) {
    escrowSummary = {
      escrow_id: Number(matchingEscrow.id),
      pvo_id: Number(matchingEscrow.pvo_id),
      milestone_id: Number(matchingEscrow.milestone_id),
      amount: toPesos(Number(matchingEscrow.amount)),
      status: extractStatus(matchingEscrow.status),
      funder: extractAddress(matchingEscrow.funder) ?? "",
      recipient: extractAddress(matchingEscrow.recipient) ?? "",
      funded: matchingEscrow.status !== "Created",
      released: matchingEscrow.status === "Released",
      released_at: matchingEscrow.released_at
        ? Number(matchingEscrow.released_at)
        : undefined,
    };

    gates = buildGatesFromEscrow(matchingEscrow);
    matchGateTxHashes(gates, events, Number(matchingEscrow.id));
  }

  return {
    milestone_id: Number(m.id),
    milestone_title: m.title ?? `Milestone ${m.id}`,
    description: m.description ?? "",
    budget: toPesos(Number(m.budget ?? 0)),
    status: extractStatus(m.status),
    evidence_count: m.submitted_evidence?.length ?? 0,
    evidence_types: m.submitted_evidence
      ? extractEnumList(
          m.submitted_evidence.map((e: any) =>
            typeof e.evidence_type === "string" ? e.evidence_type : e.evidence_type
          )
        )
      : [],
    evidence_items: (m.submitted_evidence || []).map((e: any) => ({
      id: Number(e.id),
      type: typeof e.evidence_type === "string" ? e.evidence_type : e.evidence_type?.tag ?? "Unknown",
      data_hash: typeof e.data_hash === "string" ? e.data_hash : "",
      metadata: typeof e.metadata === "string" ? e.metadata : "",
      verified: !!e.verified,
      submitted_at: Number(e.submitted_at || 0),
    })),
    escrow: escrowSummary,
    gates,
  };
}

async function buildProvenance(
  existingStore: ProvenanceStore | null
): Promise<ProvenanceStore> {
  console.log(`\n🔄 [${new Date().toISOString()}] Building provenance...`);

  const pvoCount = readPVOCount();
  const escrowCount = readEscrowCount();
  console.log(`  📊 ${pvoCount} PVOs, ${escrowCount} escrows`);

  if (pvoCount === 0) {
    console.log("  No PVOs found.");
    return {
      lastUpdated: Date.now(),
      lastLedger: existingStore?.lastLedger ?? 0,
      earliestLedger: existingStore?.earliestLedger ?? (existingStore?.lastLedger ?? 0),
      pvoCount: 0,
      escrowCount: 0,
      eventCount: existingStore?.eventCount ?? 0,
      pvOs: [],
      events: existingStore?.events ?? [],
      stats: {
        totalEscrowed: 0,
        totalReleased: 0,
        totalFunded: 0,
        totalGatesPassed: 0,
        totalGatesPending: 0,
      },
    };
  }

  const escrows: any[] = [];
  for (let i = 1; i <= escrowCount; i++) {
    const esc = readEscrow(i);
    if (esc) escrows.push(esc);
  }
  // Scan forward for non-sequential escrow IDs
  let escNones = 0;
  let escId = escrowCount + 1;
  while (escNones < 15) {
    const esc = readEscrow(escId);
    if (esc) { escrows.push(esc); escNones = 0; } else { escNones++; }
    escId++;
  }

  let lastLedger = existingStore?.lastLedger ?? 0;
  let allEvents = existingStore?.events ?? [];
  // Track the earliest ledger we've ever scanned to ensure full coverage
  let earliestScanned = existingStore?.earliestLedger ?? lastLedger;

  try {
    const latest = await sdkServer.getLatestLedger();
    const endLedger = Number(latest.sequence ?? latest);
    let startLedger: number;

    if (lastLedger > 0 && endLedger - lastLedger < MAX_LEDGER_RANGE) {
      // Incremental: scan only new ledgers since last run
      startLedger = lastLedger + 1;
    } else {
      // Full scan: cover as much history as the RPC allows
      // But limit to MAX_LEDGER_RANGE from earliest known or from end
      const desiredStart = Math.max(1, earliestScanned > 0 ? earliestScanned : endLedger - MAX_LEDGER_RANGE);
      startLedger = Math.max(1, endLedger - MAX_LEDGER_RANGE);
    }

    // Chunked scanning: split into 2000-ledger chunks to stay within RPC limits
    console.log(`  📡 Scanning ledgers ${startLedger} → ${endLedger} (chunks of ${CHUNK_SIZE})...`);
    let totalNew = 0;
    const existingTxHashes = new Set(allEvents.map((e) => e.txHash));

    for (let chunkStart = startLedger; chunkStart <= endLedger; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, endLedger);
      try {
        const chunkEvents = await fetchEvents(chunkStart, chunkEnd);
        const newInChunk = chunkEvents.filter((e) => !existingTxHashes.has(e.txHash));
        for (const e of newInChunk) {
          allEvents.push(e);
          existingTxHashes.add(e.txHash);
        }
        totalNew += newInChunk.length;
      } catch (chunkErr) {
        // Skip failed chunks gracefully
      }
    }

    allEvents.sort((a, b) => b.ledger - a.ledger);

    // Smarter dedup: for high-frequency event types, keep only latest per entity
    // This prevents store bloat from repetitive submissions (risk_predicted, geo_risk, etc.)
    const DEDUP_EVENT_TYPES = new Set([
      "risk_predicted_event",
      "geo_risk_assessed_event",
      "digital_twin_updated_event",
      "fraud_detected_event",
      "image_verified_event",
    ]);
    const seen = new Set<string>();
    const dedupedEvents: CapturedEvent[] = [];
    let dedupedCount = 0;
    for (const e of allEvents) {
      if (DEDUP_EVENT_TYPES.has(e.eventName)) {
        // Dedup by event type + contract (already unique per contract)
        // For risk_predicted: keep latest per contractor (from data)
        // For geo_risk/twin: keep latest per pvo_id
        let key = `${e.eventName}:${e.contract}:`;
        const d = e.data || {};
        if (d.contractor) key += String(d.contractor).slice(0, 20);
        else if (d.pvo_id) key += `pvo_${d.pvo_id}`;
        else key += e.txHash.slice(-8);
        if (seen.has(key)) { dedupedCount++; continue; }
        seen.add(key);
      }
      dedupedEvents.push(e);
    }
    if (dedupedCount > 0) {
      console.log(`  💾 Deduplicated ${dedupedCount} redundant events (${dedupedEvents.length} kept)`);
    }
    allEvents = dedupedEvents;

    // Hard cap with structured fallback: prioritize pvo_core/escrow over ai_oracle
    const MAX_EVENTS = 50000;
    if (allEvents.length > MAX_EVENTS) {
      const priority = (e: CapturedEvent) => 
        e.contract === "pvo_core" ? 0 : e.contract === "escrow" ? 1 :
        e.contract === "audit_trail" ? 2 : e.contract === "compliance_engine" ? 3 : 4;
      allEvents.sort((a, b) => {
        const pa = priority(a) - priority(b);
        if (pa !== 0) return pa;
        return b.ledger - a.ledger;
      });
      const trimmed = allEvents.length - MAX_EVENTS;
      allEvents = allEvents.slice(0, MAX_EVENTS);
      console.log(`  ⚠ Store capped at ${MAX_EVENTS} events (trimmed ${trimmed} low-priority)`);
    }

    if (allEvents.length > 10000) {
      console.log(`  ⚠ Store size: ${allEvents.length} events (${(allEvents.length / MAX_EVENTS * 100).toFixed(0)}% of capacity)`);
    }

    if (earliestScanned === 0 || startLedger < earliestScanned) {
      earliestScanned = startLedger;
    }
    lastLedger = endLedger;
    console.log(`  📡 ${totalNew} new events (total: ${allEvents.length})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ⚠️ Event scan skipped: ${msg.slice(0, 100)}`);
  }

  const pvOs: PVOProvenance[] = [];

  // Fetch community reports for all PVOs
  const communityReports = readCommunityReports();
  console.log(`  Loaded ${communityReports.length} community reports`);
  const reportsByPvo: Record<number, any[]> = {};
  for (const cr of communityReports) {
    const pid = Number(cr.pvo_id || 0);
    if (pid > 0) {
      if (!reportsByPvo[pid]) reportsByPvo[pid] = [];
      reportsByPvo[pid].push(cr);
    }
  }

  for (let i = 1; i <= pvoCount; i++) {
    const pvo = readPVO(i);
    if (!pvo) {
      console.log(`  ⚠️ PVO #${i} not readable`);
      continue;
    }

    const milestonesRaw = readPVOMilestones(i);
    const auditEntries = readAuditEntries(i);

    const milestones: MilestoneProvenance[] = milestonesRaw.map((m: any) =>
      buildMilestoneProvenance(m, i, escrows, allEvents)
    );

    const timeline = buildTimeline(i, milestones, allEvents, auditEntries);

    // Add community reports to timeline
    const pvoReports = reportsByPvo[i] || [];
    for (const cr of pvoReports) {
      timeline.push({
        timestamp: Number(cr.timestamp || cr.submitted_at || 0),
        actor: String(cr.citizen || "").slice(0, 12),
        action: cr.verified ? "Community Report Verified" : "Community Report Submitted",
        details: { report_id: cr.id, pvo_id: i, report_type: cr.report_type, verified: cr.verified, data_hash: cr.data_hash },
      });
    }
    timeline.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const totalEscrowed = milestones.reduce((s, m) => s + (m.escrow?.amount ?? 0), 0);
    const totalFunded = milestones.filter((m) => m.escrow?.funded).length;
    const totalReleased = milestones.reduce(
      (s, m) => s + (m.escrow?.released ? m.escrow.amount : 0),
      0
    );
    const gatesPassed = milestones.reduce(
      (s, m) => s + m.gates.filter((g) => g.status === "passed").length,
      0
    );
    const gatesTotal = milestones.reduce((s, m) => s + m.gates.length, 0);
    const evidenceCount = milestones.reduce((s, m) => s + m.evidence_count, 0);

    // Compute public value score from escrow gate progress
    let computedScore = 0;
    if (milestones.length > 0) {
      let totalPct = 0;
      for (const m of milestones) {
        if (m.escrow) {
          let passed = 0;
          for (const g of m.gates) {
            if (g.status === "passed") passed++;
          }
          totalPct += (passed / 5) * 100;
        }
        // milestones without escrows contribute 0
      }
      computedScore = Math.round(totalPct / milestones.length);
    }

    pvOs.push({
      pvo_id: Number(pvo.id ?? i),
      title: pvo.title ?? `PVO #${i}`,
      department: pvo.department ?? "Unknown",
      municipality: pvo.municipality ?? "Unknown",
      description: pvo.description ?? "",
      total_budget: toPesos(Number(pvo.total_budget ?? 0)),
      status: extractStatus(pvo.status),
      funding_agency: extractAddress(pvo.funding_agency) ?? "",
      contractor: extractAddress(pvo.contractor),
      project_manager: extractAddress(pvo.project_manager),
      fund_source: typeof pvo.fund_source === "object"
        ? extractStatus(pvo.fund_source)
        : pvo.fund_source ?? "Unknown",
      public_value_score: computedScore,
      contractor_assigned: pvo.contractor_assigned ?? false,
      milestones,
      timeline,
      stats: {
        total_escrowed: totalEscrowed,
        total_released: totalReleased,
        total_funded: totalFunded,
        gates_passed: gatesPassed,
        gates_total: gatesTotal,
        evidence_submitted: evidenceCount,
      },
    });

    console.log(
      `  ✅ PVO #${i}: ${pvo.title} - ${milestones.length} milestones, ${timeline.length} timeline entries`
    );
  }

  // Scan forward for PVOs with IDs beyond count (from failed tx gaps)
  let consecutiveNones = 0;
  let scanId = pvoCount + 1;
  while (consecutiveNones < 15) {
    const pvo = readPVO(scanId);
    if (!pvo) {
      consecutiveNones++;
      scanId++;
      continue;
    }
    consecutiveNones = 0;

    const milestonesRaw = readPVOMilestones(scanId);
    const auditEntries = readAuditEntries(scanId);
    const milestones: MilestoneProvenance[] = milestonesRaw.map((m: any) =>
      buildMilestoneProvenance(m, scanId, escrows, allEvents)
    );
    const timeline = buildTimeline(scanId, milestones, allEvents, auditEntries);
    const totalEscrowed = milestones.reduce((s, m) => s + (m.escrow?.amount ?? 0), 0);
    const totalFunded = milestones.filter((m) => m.escrow?.funded).length;
    const totalReleased = milestones.reduce((s, m) => s + (m.escrow?.released ? m.escrow.amount : 0), 0);
    const gatesPassed = milestones.reduce((s, m) => s + m.gates.filter((g) => g.status === "passed").length, 0);
    const gatesTotal = milestones.reduce((s, m) => s + m.gates.length, 0);
    const evidenceCount = milestones.reduce((s, m) => s + m.evidence_count, 0);
    let computedScore = 0;
    if (milestones.length > 0) {
      let totalPct = 0;
      for (const m of milestones) {
        if (m.escrow) {
          let passed = 0;
          for (const g of m.gates) { if (g.status === "passed") passed++; }
          totalPct += (passed / 5) * 100;
        }
      }
      computedScore = Math.round(totalPct / milestones.length);
    }
    pvOs.push({
      pvo_id: Number(pvo.id ?? scanId),
      title: pvo.title ?? `PVO #${scanId}`,
      department: pvo.department ?? "Unknown",
      municipality: pvo.municipality ?? "Unknown",
      description: pvo.description ?? "",
      total_budget: toPesos(Number(pvo.total_budget ?? 0)),
      status: extractStatus(pvo.status),
      funding_agency: extractAddress(pvo.funding_agency) ?? "",
      contractor: extractAddress(pvo.contractor),
      project_manager: extractAddress(pvo.project_manager),
      fund_source: typeof pvo.fund_source === "object" ? extractStatus(pvo.fund_source) : pvo.fund_source ?? "Unknown",
      public_value_score: computedScore,
      contractor_assigned: pvo.contractor_assigned ?? false,
      milestones, timeline,
      stats: { total_escrowed: totalEscrowed, total_released: totalReleased, total_funded: totalFunded, gates_passed: gatesPassed, gates_total: gatesTotal, evidence_submitted: evidenceCount },
    });
    console.log(`  ✅ PVO #${scanId}: ${pvo.title} - ${milestones.length} milestones, ${timeline.length} timeline entries`);
    scanId++;
  }

  const store: ProvenanceStore = {
    lastUpdated: Date.now(),
    lastLedger,
    earliestLedger: earliestScanned || lastLedger,
    pvoCount,
    escrowCount,
    eventCount: allEvents.length,
    pvOs,
    events: allEvents,
    stats: {
      totalEscrowed: pvOs.reduce((s, p) => s + p.stats.total_escrowed, 0),
      totalReleased: pvOs.reduce((s, p) => s + p.stats.total_released, 0),
      totalFunded: pvOs.reduce(
        (s, p) => s + p.stats.total_funded,
        0
      ),
      totalGatesPassed: pvOs.reduce((s, p) => s + p.stats.gates_passed, 0),
      totalGatesPending: pvOs.reduce(
        (s, p) => s + (p.stats.gates_total - p.stats.gates_passed),
        0
      ),
    },
  };

  saveStore(store);
  console.log(
    `  📦 Store saved: ${pvOs.length} PVOs, ${allEvents.length} events, ${store.stats.totalGatesPassed}/${pvOs.reduce((s, p) => s + p.stats.gates_total, 0)} gates passed`
  );

  return store;
}

// ── Store ───────────────────────────────────────────────
function loadStore(): ProvenanceStore | null {
  try {
    if (!existsSync(STORE_PATH)) return null;
    return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveStore(store: ProvenanceStore): void {
  try {
    if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error(`  ⚠️ Could not save store: ${(e as Error).message.slice(0, 80)}`);
  }
}

// ── Rate Limiter ────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateTracker = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateTracker.get(ip);
  if (!entry || now > entry.resetAt) {
    rateTracker.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateTracker) {
    if (now > entry.resetAt) rateTracker.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

// ── HTTP Server ─────────────────────────────────────────
let currentStore: ProvenanceStore | null = null;

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendHTML(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(html);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://localhost:${HTTP_PORT}`);
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(ip)) {
    sendJSON(res, { error: "Rate limit exceeded" }, 429);
    return;
  }

  if (req.method === "OPTIONS") {
    sendJSON(res, {});
    return;
  }

  // API key gate (skip for health + HTML landing page)
  if (API_KEY && url.pathname !== "/api/health" && url.pathname !== "/" && url.pathname !== "/api") {
    const provided = req.headers["x-api-key"] as string || req.headers["authorization"]?.replace("Bearer ", "");
    if (provided !== API_KEY) {
      console.log(`  Denied ${ip} ${url.pathname} - no/bad API key`);
      sendJSON(res, { error: "Unauthorized" }, 401);
      return;
    }
  }

  if (url.pathname === "/api/rebuild" || url.pathname === "/api/rebuild/") {
    console.log("  🔄 Manual rebuild triggered");
    buildProvenance(currentStore).then(s => { currentStore = s; });
    sendJSON(res, { status: "rebuilding", message: "Full rebuild triggered. Check /api/health for progress." });
    return;
  }

  if (url.pathname === "/api/health") {
    sendJSON(res, {
      status: "healthy",
      lastUpdated: currentStore?.lastUpdated ?? null,
      lastLedger: currentStore?.lastLedger ?? null,
      earliestLedger: currentStore?.earliestLedger ?? null,
      pvoCount: currentStore?.pvoCount ?? 0,
      escrowCount: currentStore?.escrowCount ?? 0,
      eventCount: currentStore?.eventCount ?? 0,
      uptime: process.uptime(),
    });
    return;
  }

  if (url.pathname === "/api/provenance") {
    if (!currentStore) {
      sendJSON(res, { error: "Store not built yet", pvOs: [] });
      return;
    }
    sendJSON(res, currentStore.pvOs);
    return;
  }

  // Full provenance store download (node replication archive)
  if (url.pathname === "/api/store" || url.pathname === "/provenance-store.json") {
    if (!currentStore) {
      sendJSON(res, { error: "Store not built yet" }, 503);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=30",
      "Content-Disposition": "inline; filename=\"provenance-store.json\"",
    });
    res.end(JSON.stringify(currentStore, null, 2));
    return;
  }

  const singleMatch = url.pathname.match(/^\/api\/provenance\/(\d+)$/);
  if (singleMatch) {
    const pvoId = parseInt(singleMatch[1]);
    const pvo = currentStore?.pvOs.find((p) => p.pvo_id === pvoId);
    if (!pvo) {
      sendJSON(res, { error: `PVO #${pvoId} not found` }, 404);
      return;
    }
    sendJSON(res, pvo);
    return;
  }

  const timelineMatch = url.pathname.match(
    /^\/api\/provenance\/(\d+)\/timeline$/
  );
  if (timelineMatch) {
    const pvoId = parseInt(timelineMatch[1]);
    const pvo = currentStore?.pvOs.find((p) => p.pvo_id === pvoId);
    sendJSON(res, pvo?.timeline ?? []);
    return;
  }

  if (url.pathname === "/api/events") {
    sendJSON(res, currentStore?.events ?? []);
    return;
  }

  const eventsByContract = url.pathname.match(/^\/api\/events\/(\w+)$/);
  if (eventsByContract) {
    const contractName = eventsByContract[1];
    sendJSON(
      res,
      (currentStore?.events ?? []).filter((e) => e.contract === contractName)
    );
    return;
  }

  if (url.pathname === "/" || url.pathname === "/api") {
    sendHTML(res, `<!DOCTYPE html>
<html><head><title>PoPV Provenance Indexer</title></head>
<body style="font-family:monospace;padding:2rem;background:#0a0a0a;color:#0f0">
<h1>PoPV Provenance Indexer</h1>
<p>Status: ${currentStore ? "Active" : "Building..."}</p>
<p>Last updated: ${currentStore ? new Date(currentStore.lastUpdated).toISOString() : "-"}</p>
<p>PVOs: ${currentStore?.pvoCount ?? 0} | Escrows: ${currentStore?.escrowCount ?? 0} | Events: ${currentStore?.eventCount ?? 0}</p>
<h3>API Endpoints:</h3>
<ul>
<li><a href="/api/health">GET /api/health</a></li>
<li><a href="/api/provenance">GET /api/provenance</a> - all PVO provenance trees</li>
<li>GET /api/provenance/:pvoId - single PVO chain</li>
<li>GET /api/provenance/:pvoId/timeline - event timeline</li>
<li><a href="/api/events">GET /api/events</a> - all captured events with tx hashes</li>
<li>GET /api/events/:contractName - events by contract</li>
<li><a href="/api/rebuild">GET /api/rebuild</a> - force full rebuild (use after new transactions)</li>
</ul>
</body></html>`);
    return;
  }

  sendJSON(res, { error: "Not found", path: url.pathname }, 404);
}

function startHTTPServer(): void {
  const server = createServer(handleRequest);
  server.on("error", (e: any) => {
    if (e.code === "EADDRINUSE") {
      console.error(`  ⚠️ Port ${HTTP_PORT} in use. Kill the old process first: kill $(lsof -ti:${HTTP_PORT})`);
    } else {
      console.error(`  ⚠️ Server error: ${e.message}`);
    }
  });
  server.listen(HTTP_PORT, "127.0.0.1", () => {
    console.log(`\n🌐 Provenance API: http://127.0.0.1:${HTTP_PORT} (only via nginx)`);
    console.log(`   Endpoints: /api/provenance, /api/events, /api/health\n`);
  });
}

// ── Main ────────────────────────────────────────────────
const args = process.argv.slice(2);
const runOnce = args.includes("--once");
const buildOnly = args.includes("--build");
const forceRebuild = args.includes("--rebuild");

console.log("╔══════════════════════════════════════╗");
console.log("║   PoPV Provenance Indexer Service    ║");
console.log("╚══════════════════════════════════════╝");
console.log(`  RPC: ${RPC_URL}`);
console.log(`  Store: ${STORE_PATH}`);
console.log(
  `  Mode: ${buildOnly ? "Build only" : runOnce ? "Once" : `Continuous (${POLL_INTERVAL_MS / 1000}s)`}`
);
console.log("");

async function main(): Promise<void> {
  const existing = forceRebuild ? null : loadStore();
  if (existing) {
    console.log(`  📂 Loaded existing store (${existing.pvoCount} PVOs, ${existing.eventCount} events)`);
    currentStore = existing;
  }

  currentStore = await buildProvenance(existing);

  if (buildOnly) {
    console.log("\n✅ Build complete. Exiting.");
    process.exit(0);
  }

  if (!runOnce) {
    startHTTPServer();
    let pollCount = 0;
    const FULL_REBUILD_EVERY = 10; // every 10 polls (5 minutes)
    setInterval(async () => {
      pollCount++;
      const forceRebuild = pollCount % FULL_REBUILD_EVERY === 0;
      if (forceRebuild) {
        console.log("  🔄 Periodic full rebuild (keeping existing events)...");
        currentStore = await buildProvenance(currentStore);
      } else {
        currentStore = await buildProvenance(currentStore);
      }
    }, POLL_INTERVAL_MS);
  } else {
    startHTTPServer();
    setTimeout(() => {
      console.log("\n✅ Done.");
      process.exit(0);
    }, 10_000);
  }

  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down.");
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
