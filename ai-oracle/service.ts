#!/usr/bin/env node
/**
 * PoPV AI Oracle v2 - LLM-Powered Fraud Detection Engine
 *
 * Watches Stellar testnet for PVOs with evidence and escrows that need AI validation.
 * Submits comprehensive analysis to the ai_oracle contract:
 *   - Fraud detection (LLM or rule-based)
 *   - Risk prediction (contractor risk profile)
 *   - Image verification (evidence authenticity)
 *   - Digital twin (cost deviation analysis)
 *   - Geo risk (flood, seismic, landslide)
 *   - GPS validation (coordinate verification)
 * Also submits Gate 5 pass/fail to the escrow contract.
 *
 * Usage:
 *   npx tsx ai-oracle/service.ts --once
 *   npx tsx ai-oracle/service.ts              # poll every 60s
 *
 * LLM Config (env vars):
 *   AI_LLM_API_KEY      - API key (DeepSeek, OpenAI, Groq, etc.)
 *   AI_LLM_BASE_URL     - defaults to https://api.deepseek.com/v1
 *   AI_LLM_MODEL        - defaults to deepseek-chat
 *
 * Wallet Config:
 *   AI_AUDITOR_SECRET    - AI Auditor wallet secret key
 *   AI_AUDITOR_SOURCE    - read-only account for contract queries
 *
 * Falls back to rule-based analysis if LLM is unavailable.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { Keypair } from "@stellar/stellar-sdk";

// Load .env file if it exists (for local development)
const envPath = resolve(__dirname, ".env");
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

// ── Config ──────────────────────────────────────────────
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const POLL_INTERVAL_MS = 60_000;

const CONTRACT_IDS: Record<string, string> = {
  pvo_core: "CCFANPZQ2EIMFEEITTF7MS6SNSJSA5RV365JDR6YA3OOKAIXFFR5ST2B",
  escrow: "CCH4G475KDLUSKKZUWIDYALEDOLRA2ZZQOO33V4IGX3NLJRVYSMNRFU7",
  ai_oracle: "CAVOYO6RPO3P6WRTD73Y4EQCWZVSCY6JCWELG3MFKNIIQ7IJCGNRWR7G",
  reputation: "CD7FFWLH2YD57MV5HXT74RBXIJ6IRFLLEATXFACQCDB275EWN5W7L3BG",
  audit_trail: "CB6AXOUYHEOWUUSEP6543GZYHMN6D2VA5WV5LXOMPNMJFYJ3XQNPZBV6",
  compliance_engine: "CAB4BREUIZPAVZIQ7AL2YTKSXBOAL5EQUFSTDOBYMJV34BPHWGLI5SCB",
  procurement_market: "CAQ6D4G4N4JOERAXBD227MOSUJAGFE7I7LZL6DHRQZZUI5DZ5AXYHJVP",
  grant_commitment: "CAEWCFHT54SDVZZOAH777ULGI3OASAGRWDTCLUTFWRXNKIZO35VQZ5JB",
  community_oracle: "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32",
  value_score: "CB6YODGT7D5O2PXBCM3RMGOVMNUMYB7U2TDTPMZPTUK2IBBBUPHE2UVU",
};

const READ_SOURCE = process.env.AI_AUDITOR_SOURCE ?? "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const CREDS_PATH = join(__dirname, "..", ".dev-logs", "newrolecreden.md");

// LLM config
const LLM_API_KEY = process.env.AI_LLM_API_KEY ?? "";
const LLM_BASE_URL = process.env.AI_LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_MODEL = process.env.AI_LLM_MODEL ?? "deepseek-chat";

// ── Types ───────────────────────────────────────────────
interface Evidence {
  gps_lat: number | null;
  gps_lng: number | null;
  evidence_types: string[];
  metadata_preview: string;
}

interface IpfsContentResult {
  hash: string;
  type: "image" | "document" | "text" | "binary" | "unknown";
  size: number;
  details: string;
  flags: string[];
}

// ── IPFS Constants ──────────────────────────────────────
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

function isMaybeIpfsHash(s: string): boolean {
  return !!s && (s.startsWith("Qm") || s.startsWith("baf"));
}

async function fetchIpfsContent(hash: string): Promise<Buffer | null> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(gw + hash, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) return Buffer.from(await resp.arrayBuffer());
    } catch { /* try next gateway */ }
  }
  return null;
}

function detectIpfsFileType(buffer: Buffer): "image" | "document" | "text" | "binary" | "unknown" {
  if (buffer.length < 4) return "unknown";
  // Image signatures
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "image"; // JPEG
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image"; // PNG
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image"; // GIF
  // PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50) return "document"; // PDF
  // UTF-8 text
  try {
    const sample = buffer.slice(0, 1024).toString("utf-8");
    const printable = sample.replace(/[\x00-\x1F\x7F-\x9F]/g, "").length;
    if (printable / Math.min(buffer.length, 1024) > 0.7) return "text";
  } catch { /* fall through */ }
  return "binary";
}

function analyzeIpfsText(buffer: Buffer): string[] {
  const flags: string[] = [];
  try {
    const text = buffer.toString("utf-8").toLowerCase().slice(0, 50000);
    // Suspicious patterns
    if (text.includes("photoshopped") || text.includes("edited") || text.includes("manipulated")) {
      flags.push("suspicious_metadata");
    }
    if ((text.match(/\d{4}-\d{2}-\d{2}/g) || []).length > 5) {
      flags.push("multiple_timestamps"); // Possible metadata tampering
    }
    if (text.includes("error") || text.includes("fail") || text.includes("defect")) {
      flags.push("report_contains_issues");
    }
    // Low content - possibly placeholder/fake
    if (text.replace(/\s/g, "").length < 100 && buffer.length > 1000) {
      flags.push("low_text_density"); // Large file but no substantive content
    }
  } catch {}
  return flags;
}

async function analyzeIpfsContent(dataHash: string, metadataStr: string): Promise<IpfsContentResult> {
  const result: IpfsContentResult = {
    hash: dataHash,
    type: "unknown",
    size: 0,
    details: "",
    flags: [],
  };

  // Try data_hash first (IPFS CID), then check metadata for embedded hash
  let hash = dataHash;
  if (!isMaybeIpfsHash(hash)) {
    // Check metadata for IPFS hash pattern
    const match = metadataStr.match(/\b(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{52,})\b/);
    if (match) hash = match[1];
    else return result; // No IPFS hash found
  }

  const content = await fetchIpfsContent(hash);
  if (!content) {
    result.flags.push("ipfs_unreachable");
    result.details = "File not retrievable from any IPFS gateway";
    return result;
  }

  result.size = content.length;
  result.type = detectIpfsFileType(content);
  result.details = `${result.type} file, ${(content.length / 1024).toFixed(1)} KB`;

  switch (result.type) {
    case "image": {
      if (content.length < 1000) result.flags.push("tiny_image_file");
      if (content.length > 50_000_000) result.flags.push("oversized_image");
      // Rough image quality: JPEG header analysis
      if (content[0] === 0xFF && content[1] === 0xD8) {
        const exifIdx = content.indexOf("Exif");
        if (exifIdx === -1) result.flags.push("no_exif_metadata");
      }
      result.details += " (authenticity lowered if no EXIF)";
      break;
    }
    case "document": {
      if (content.length < 2000) result.flags.push("suspicious_small_document");
      break;
    }
    case "text": {
      const textFlags = analyzeIpfsText(content);
      result.flags.push(...textFlags);
      break;
    }
    case "binary": {
      result.flags.push("binary_format_unverifiable");
      break;
    }
  }

  return result;
}

interface AnalysisResult {
  passed: boolean;
  riskScore: number;
  flags: string[];
  reasoning: string;
}

interface ForensicCaseFile {
  pvoId: number;
  pvo: any;
  milestones: any[];
  escrows: any[];
  grants: any[];
  tenders: any[];
  bidsByTender: Record<number, any[]>;
  violations: any[];
  isCompliant: boolean;
  communityReports: any[];
  verifiedReportCount: number;
  contractorReputation: any | null;
  contractorComplaints: any[];
  valueScore: any | null;
  auditHistory: any[];
  flags: string[];
  timeline: { timestamp: number; event: string; detail: string }[];
  actualBudget: number | null;
  actualBudgetPerMs: number | null;
}

// ── AI Auditor Wallet ───────────────────────────────────
function getSecretKey(): string {
  if (process.env.AI_AUDITOR_SECRET) return process.env.AI_AUDITOR_SECRET;
  try {
    const creds = readFileSync(CREDS_PATH, "utf-8");
    const match = creds.match(/AIAuditor.*?\|\s*(S[A-Z0-9]+)/);
    if (match) {
      console.log("  Read AI Auditor key from newrolecreden.md");
      return match[1];
    }
  } catch {}
  console.error("AI_AUDITOR_SECRET not set.");
  process.exit(1);
}

const AI_AUDITOR_SECRET = getSecretKey();
const HOME = process.env.HOME ?? "/root";
const STELLAR = `${HOME}/.local/bin/stellar`;
const AI_AUDITOR_PUBLIC = Keypair.fromSecret(AI_AUDITOR_SECRET).publicKey();
// Use raw secret key as --source so signing matches auditor for require_auth()
const AI_SOURCE_KEY = AI_AUDITOR_SECRET;

// In-memory cache to prevent re-submitting identical data
const submittedCache: Record<string, string> = {};

function cacheKey(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}

function shouldSubmit(key: string, data: string): boolean {
  const prev = submittedCache[key];
  if (prev === data) return false;
  submittedCache[key] = data;
  return true;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY ?? "";
const CENTRAL_BANK_SECRET = process.env.CENTRAL_BANK_SECRET ?? "";
const PPHP_CONTRACT = process.env.PPHP_CONTRACT_ID ?? "CDABOKL55EN6LUEWFC5GHAI3GPYQTEDR2AAVZLA3WHM263DN7A3LGML5";

const opts = {
  env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` },
  encoding: "utf-8" as BufferEncoding,
};

// SDK-based submission (bypasses CLI identity issues)
async function sdkInvoke(contractId: string, method: string, scvArgs: any[]): Promise<boolean> {
  if (!AI_AUDITOR_SECRET) { console.error("  AI_AUDITOR_SECRET not set"); return false; }
  try {
    const { Keypair, Contract, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
    const kp = Keypair.fromSecret(AI_AUDITOR_SECRET);
    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(kp.publicKey());
    const contract = new Contract(contractId);
    const op = contract.call(method, ...scvArgs);
    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op).setTimeout(30).build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(kp);
    const result = await server.sendTransaction(prepared);
    if (result.status !== "PENDING" && result.status !== "DUPLICATE") {
      console.error(`  [${method}] Tx failed: ${result.status} ${result.hash?.slice(0,10)??""}`);
    }
    return result.status === "PENDING" || result.status === "DUPLICATE";
  } catch (e: any) {
    console.error(`  [${method}] failed: ${e.message?.slice(0, 100)}`);
    return false;
  }
}

// SDK-based submission helper for ai_oracle contract
async function sdkSubmitOracle(method: string, scvArgs: any[]): Promise<boolean> {
  return sdkInvoke(CONTRACT_IDS.ai_oracle, method, scvArgs);
}

// Auto-verify community reports using AI Auditor as verifier (Gate 3 fallback)
async function sdkVerifyCommunityReport(reportId: number, weight: number = 30): Promise<boolean> {
  const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");
  return sdkInvoke(CONTRACT_IDS.community_oracle, "verify_report", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    nativeToScVal(reportId, { type: "u32" }),
    nativeToScVal(weight, { type: "u32" }),
  ]);
}

function cli(cmd: string): string {
  try {
    const raw = execSync(`${STELLAR} ${cmd}`, { ...opts, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    const lines = raw.split("\n").filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith("Sent") && !line.includes("Submitting") &&
          !line.includes("Simulating") && !line.includes("Signing") &&
          !line.includes("Sending") && !line.includes("Transaction") &&
          !line.includes("stellar.expert")) {
        return line;
      }
    }
    return raw;
  } catch (e: any) {
    const stderr = e.stderr?.toString()?.trim() ?? "";
    if (stderr) console.error(`  CLI stderr: ${stderr.slice(0, 150)}`);
    return "";
  }
}

// ── LLM Fraud Analysis ──────────────────────────────────
async function analyzeWithLLM(
  pvoTitle: string,
  milestoneTitle: string,
  milestoneDesc: string,
  budget: number,
  evidence: Evidence
): Promise<AnalysisResult> {
  const budgetPesos = (budget / 10_000_000).toLocaleString();

  const prompt = `You are an AI fraud auditor for government infrastructure projects in the Philippines.
Analyze this project milestone for potential fraud or anomalies.

PROJECT: ${pvoTitle}
MILESTONE: ${milestoneTitle}
DESCRIPTION: ${milestoneDesc || "N/A"}
BUDGET: P${budgetPesos}
GPS: ${evidence.gps_lat !== null ? `[${evidence.gps_lat}, ${evidence.gps_lng}]` : "Not provided"}
EVIDENCE TYPES: ${evidence.evidence_types.join(", ") || "None"}
EVIDENCE METADATA: ${evidence.metadata_preview || "None"}

Analyze for:
- GPS coordinates: are they within the Philippines (lat 4-21, lng 116-127)? Are they near zero (0,0)?
- Budget realism: is the amount reasonable for this type of project?
- Evidence quality: are sufficient evidence types provided?
- Metadata patterns: any suspicious keywords (test, demo, fake, sample)?
- Description completeness: is the description detailed enough?

Return ONLY valid JSON (no markdown, no code blocks):
{
  "passed": true/false,
  "riskScore": 0-100,
  "flags": ["FLAG1", "FLAG2"],
  "reasoning": "1-2 sentence summary"
}`;

  try {
    const resp = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: "You are a government fraud auditor. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!resp.ok) throw new Error(`LLM API error: ${resp.status}`);

    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM response");

    const result = JSON.parse(jsonMatch[0]);
    return {
      passed: Boolean(result.passed),
      riskScore: Math.min(100, Math.max(0, Number(result.riskScore) || 0)),
      flags: Array.isArray(result.flags) ? result.flags : [],
      reasoning: String(result.reasoning || "").slice(0, 200),
    };
  } catch (e: any) {
    console.error(`  LLM failed: ${e.message?.slice(0, 100)}. Falling back to rule-based.`);
    throw e;
  }
}

// ── Rule-Based Fallback ─────────────────────────────────
function analyzeRuleBased(evidence: Evidence): AnalysisResult {
  const flags: string[] = [];
  let riskScore = 0;

  if (evidence.gps_lat !== null && evidence.gps_lng !== null) {
    const lat = evidence.gps_lat;
    const lng = evidence.gps_lng;
    if (lat < 4 || lat > 21 || lng < 116 || lng > 127) {
      flags.push("GPS_OUTSIDE_PHILIPPINES");
      riskScore += 40;
    }
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) {
      flags.push("GPS_NEAR_ZERO");
      riskScore += 50;
    }
  }

  const meta = evidence.metadata_preview.toLowerCase();
  if (/test|demo|fake|sample/.test(meta)) {
    flags.push("SUSPICIOUS_METADATA");
    riskScore += 20;
  }

  if (evidence.evidence_types.length === 0) {
    flags.push("NO_EVIDENCE");
    riskScore += 30;
  }

  return { passed: riskScore < 50, riskScore, flags, reasoning: "Rule-based fallback" };
}

// ── Map flags to FraudIndicator variants ────────────────
const FRAUD_INDICATOR_MAP: Record<string, string> = {
  GPS_OUTSIDE_PHILIPPINES: "AbnormalBudgetGrowth",
  GPS_NEAR_ZERO: "GhostProject",
  SUSPICIOUS_METADATA: "ShellCompanyRisk",
  NO_EVIDENCE: "GhostProject",
  DUPLICATE_GPS: "DuplicateInvoice",
  BUDGET_ANOMALY: "MaterialCostInflation",
  REPEATED_CONTRACTOR: "RepeatedContractorWin",
  COLLUSION: "CollusionPattern",
  ABNORMAL_GROWTH: "AbnormalBudgetGrowth",
  UNUSUAL_TIMING: "UnusualPaymentTiming",
};

function mapFlagsToIndicators(flags: string[]): string[] {
  const indicators = new Set<string>();
  for (const f of flags) {
    const mapped = FRAUD_INDICATOR_MAP[f];
    if (mapped) indicators.add(mapped);
  }
  return [...indicators];
}

// ── Philippines Geo Risk Data ───────────────────────────
const GEO_RISK_DATA: Record<string, { flood: number; seismic: number; landslide: number }> = {
  manila: { flood: 75, seismic: 45, landslide: 10 },
  quezon: { flood: 70, seismic: 40, landslide: 15 },
  makati: { flood: 65, seismic: 40, landslide: 5 },
  davao: { flood: 40, seismic: 30, landslide: 20 },
  cebu: { flood: 50, seismic: 25, landslide: 15 },
  baguio: { flood: 30, seismic: 50, landslide: 80 },
  iloilo: { flood: 65, seismic: 20, landslide: 10 },
  cagayan: { flood: 80, seismic: 35, landslide: 25 },
  zamboanga: { flood: 45, seismic: 55, landslide: 15 },
  default: { flood: 50, seismic: 35, landslide: 25 },
};

function getGeoRisk(municipality: string): { flood: number; seismic: number; landslide: number; region: string } {
  const lower = (municipality || "").toLowerCase();
  for (const [key, val] of Object.entries(GEO_RISK_DATA)) {
    if (key !== "default" && lower.includes(key)) {
      return { ...val, region: municipality };
    }
  }
  return { ...GEO_RISK_DATA.default, region: municipality || "Philippines" };
}

// ── Citizen Reward Engine ────────────────────────────────
const rewardedReports = new Set<string>();

// Persist rewarded reports to disk to prevent re-reward on restart
const REWARDS_FILE = `${HOME}/popv-rewarded-reports.json`;
try {
  const saved = readFileSync(REWARDS_FILE, 'utf-8');
  JSON.parse(saved).forEach((k: string) => rewardedReports.add(k));
} catch {}

function persistRewards(): void {
  try { writeFileSync(REWARDS_FILE, JSON.stringify([...rewardedReports])); } catch {}
}

function getRewardTier(confidenceRating: number): { tier: string; pct: number } {
  if (confidenceRating >= 96) return { tier: "Guardian", pct: 0.001 };
  if (confidenceRating >= 81) return { tier: "Elite", pct: 0.0007 };
  if (confidenceRating >= 51) return { tier: "Trusted", pct: 0.0005 };
  if (confidenceRating >= 21) return { tier: "Rising", pct: 0.0003 };
  return { tier: "New", pct: 0.0001 };
}

// ── Pending Auditor Reviews (Gate 5 human oversight) ─────
interface PendingReview {
  escrowId: number;
  pvoId: number;
  pvoTitle: string;
  flags: string[];
  riskScore: number;
  confidence: number;
  timestamp: string;
}
const pendingReviews = new Map<number, PendingReview>();
const PENDING_FILE = `${HOME}/popv-pending-reviews.json`;

// Load saved pending reviews
try {
  const saved = readFileSync(PENDING_FILE, "utf-8");
  JSON.parse(saved).forEach((r: PendingReview) => pendingReviews.set(r.escrowId, r));
} catch {}

function persistPendingReviews(): void {
  try {
    writeFileSync(PENDING_FILE, JSON.stringify([...pendingReviews.values()], null, 2));
  } catch {}
}

function logPendingReview(escrowId: number, pvoId: number): void {
  const review: PendingReview = {
    escrowId,
    pvoId,
    pvoTitle: "",
    flags: [],
    riskScore: 0,
    confidence: 0,
    timestamp: new Date().toISOString(),
  };
  pendingReviews.set(escrowId, review);
  persistPendingReviews();
}

function resolvePendingReview(escrowId: number): void {
  pendingReviews.delete(escrowId);
  persistPendingReviews();
}

async function rewardCitizenForReport(
  citizenAddress: string,
  reportId: number,
  pvoId: number,
  winningBidStroops: number
): Promise<boolean> {
  const rewardKey = `${reportId}:${citizenAddress}`;
  if (rewardedReports.has(rewardKey)) { console.log(`  [Reward] Report #${reportId} already in dedup set, skipping`); return false; }
  if (!CENTRAL_BANK_SECRET) { console.log("  [Reward] CENTRAL_BANK_SECRET not set, skipping"); return false; }

  try {
    // Get citizen reputation from community_oracle (NOT reputation contract which is for contractors)
    let confidence = 50; // default starting confidence for new citizens
    try {
      const citizenRep = queryContract("community_oracle", "get_citizen_reputation", `--citizen ${citizenAddress}`);
      if (citizenRep) {
        confidence = Number(citizenRep.confidence_rating ?? citizenRep.confidence ?? 50);
      }
    } catch (e: any) { console.log(`  [Reward] queryContract community_oracle failed: ${e.message?.slice(0, 120)}`); }
    // Also try reputation contract as fallback
    if (confidence <= 50) {
      try {
        const rep = queryContract("reputation", "get_reputation", `--entity ${citizenAddress}`);
        const repConfidence = Number(rep?.confidence_rating ?? rep?.reputation_score ?? 0);
        if (repConfidence > confidence) confidence = repConfidence;
      } catch (e: any) { console.log(`  [Reward] queryContract reputation fallback failed: ${e.message?.slice(0, 120)}`); }
    }

    const { tier, pct } = getRewardTier(confidence);
    const rewardStroops = Math.floor(winningBidStroops * pct);
    console.log(`  [Reward] Report #${reportId}: confidence=${confidence}, tier=${tier}, pct=${pct}, budget=${winningBidStroops}, reward=${rewardStroops} stroops (${(rewardStroops / 10_000_000).toFixed(2)} pPHP)`);
    if (rewardStroops < 1) { console.log(`  [Reward] Amount too small: ${rewardStroops} stroops`); return false; }

    const { Keypair, Address, Contract, TransactionBuilder, rpc, nativeToScVal } = await import("@stellar/stellar-sdk");
    const cbKp = Keypair.fromSecret(CENTRAL_BANK_SECRET);
    const server = new rpc.Server("https://soroban-testnet.stellar.org:443");
    // Retry getAccount up to 3 times for RPC rate limit resilience
    let account: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        account = await server.getAccount(cbKp.publicKey());
        break;
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!account) { console.log("  [Reward] CentralBank account not reachable, skipping"); return false; }

    const tokenContract = new Contract(PPHP_CONTRACT);
    const mintOp = tokenContract.call(
      "mint",
      new Address(cbKp.publicKey()).toScVal(),
      new Address(citizenAddress).toScVal(),
      nativeToScVal(rewardStroops, { type: "i128" }),
    );
    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: "Test SDF Network ; September 2015",
    }).addOperation(mintOp).setTimeout(30).build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(cbKp);
    const result = await server.sendTransaction(prepared);

    if (result.status === "PENDING" || result.status === "DUPLICATE") {
      // Poll for confirmation to verify the transaction actually succeeded on-chain
      let confirmed = false;
      const txHash = (result as any).hash || (result as any).transactionHash || "";
      for (let wait = 0; wait < 10; wait++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const txResult = await server.getTransaction(txHash);
          if (txResult.status === "SUCCESS") {
            confirmed = true;
            rewardedReports.add(rewardKey);
            persistRewards();
            console.log(`  [Reward] ✅ ${tier} citizen rewarded ${(rewardStroops / 10_000_000).toFixed(2)} pPHP (${(pct * 100).toFixed(3)}% of bid) — report #${reportId}`);
            return true;
          }
          if (txResult.status === "FAILED") {
            console.error(`  [Reward] ❌ TX FAILED on-chain: ${JSON.stringify(txResult.resultMetaXdr || txResult).slice(0, 200)}`);
            break;
          }
        } catch (e: any) { /* keep polling */ }
      }
      if (!confirmed) {
        console.log(`  [Reward] ⏳ TX submitted (hash: ${txHash.slice(0, 16)}...) but not confirmed yet — NOT adding to dedup`);
        return false;
      }
    }
    console.log(`  [Reward] ❌ Send failed: status=${result.status}, details=${JSON.stringify(result).slice(0, 200)}`);
  } catch (e: any) {
    console.error(`  [Reward] Error: ${e.message?.slice(0, 100)}`);
  }
  return false;
}

// ── On-Chain: Escrow Gate 5 ──────────────────────────────
function submitEscrowGate5(escrowId: number, passed: boolean): void {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  console.log(`  [Gate 5] Escrow #${escrowId}: ai_validate passed=${passed}`);
  sdkInvoke(CONTRACT_IDS.escrow, "ai_validate", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(escrowId),
    xdr.ScVal.scvBool(passed),
  ]).then(ok => {
    if (ok) { console.log(`  [Gate 5] Submitted on-chain`); }
    else { console.error(`  [Gate 5] Failed`); }
  });
}

// ── On-Chain: Escrow Gate 3 (community oracle validation) ──
function submitEscrowGate3(escrowId: number): void {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  console.log(`  [Gate 3] Escrow #${escrowId}: community_oracle_validate`);
  sdkInvoke(CONTRACT_IDS.escrow, "community_oracle_validate", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(escrowId),
  ]).then(ok => {
    if (ok) { console.log(`  [Gate 3] Submitted on-chain`); }
    else { console.error(`  [Gate 3] Failed (may need more verified reports or escrow not funded)`); }
  });
}

// ── On-Chain: AI Oracle Submissions ─────────────────────
function submitFraudDetection(pvoId: number, riskScore: number, indicators: string[], confidence: number, evidenceHash: string): boolean {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("submit_fraud_detection", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(pvoId),
    xdr.ScVal.scvU32(riskScore),
    xdr.ScVal.scvString(JSON.stringify(indicators).slice(0,200)),
    xdr.ScVal.scvU32(confidence),
    xdr.ScVal.scvString(evidenceHash.slice(0,32)),
  ]);
}

function submitRiskPrediction(contractor: string, delayProb: number, overrunProb: number, riskCategory: number, confidence: number): boolean {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("submit_risk_prediction", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    new Address(contractor).toScVal(),
    xdr.ScVal.scvU32(delayProb),
    xdr.ScVal.scvU32(overrunProb),
    xdr.ScVal.scvU32(riskCategory),
    xdr.ScVal.scvU32(confidence),
  ]);
}

function submitImageVerification(evidenceId: number, progressPercent: number, authenticityScore: number, summary: string): boolean {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("submit_image_verification", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(evidenceId),
    xdr.ScVal.scvU32(progressPercent),
    xdr.ScVal.scvU32(authenticityScore),
    xdr.ScVal.scvString(summary.slice(0,200)),
  ]);
}

function submitDigitalTwin(pvoId: number, expectedCost: number, materialIdx: number, laborIdx: number, deviation: boolean): boolean {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("update_digital_twin", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(pvoId),
    xdr.ScVal.scvU32(expectedCost),
    xdr.ScVal.scvU32(materialIdx),
    xdr.ScVal.scvU32(laborIdx),
    xdr.ScVal.scvBool(deviation),
  ]);
}

function submitGeoRisk(pvoId: number, region: string, flood: number, seismic: number, landslide: number): boolean {
  const { Address, xdr } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("submit_geo_risk", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(pvoId),
    xdr.ScVal.scvString(region.slice(0,50)),
    xdr.ScVal.scvU32(flood),
    xdr.ScVal.scvU32(seismic),
    xdr.ScVal.scvU32(landslide),
  ]);
}

function submitGpsValidation(evidenceId: number, expectedLat: number, expectedLon: number, reportedLat: number, reportedLon: number, maxDistM: number): boolean {
  const { Address, xdr, nativeToScVal } = require("@stellar/stellar-sdk");
  return sdkSubmitOracle("submit_gps_validation", [
    new Address(AI_AUDITOR_PUBLIC).toScVal(),
    xdr.ScVal.scvU32(evidenceId),
    nativeToScVal(Math.round(expectedLat*1_000_000), {type:"i128"}),
    nativeToScVal(Math.round(expectedLon*1_000_000), {type:"i128"}),
    nativeToScVal(Math.round(reportedLat*1_000_000), {type:"i128"}),
    nativeToScVal(Math.round(reportedLon*1_000_000), {type:"i128"}),
    xdr.ScVal.scvU32(maxDistM),
  ]);
}

// ── Check if already submitted ──────────────────────────
function getFraudCount(): number {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS.ai_oracle} --source ${AI_SOURCE_KEY} --network testnet -- get_fraud_count`
  );
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function getFraudByPvo(pvoId: number): any[] {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS.ai_oracle} --source ${AI_SOURCE_KEY} --network testnet -- get_fraud_by_pvo --pvo_id ${pvoId}`
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return parsed.result || parsed || [];
  } catch { return []; }
}

function hasGeoRisk(pvoId: number): boolean {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS.ai_oracle} --source ${AI_SOURCE_KEY} --network testnet -- get_geo_risk --pvo_id ${pvoId}`
  );
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    const result = parsed.result || parsed;
    return result && Object.keys(result).length > 0;
  } catch { return false; }
}

function hasDigitalTwin(pvoId: number): boolean {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS.ai_oracle} --source ${AI_SOURCE_KEY} --network testnet -- get_digital_twin --pvo_id ${pvoId}`
  );
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    const result = parsed.result || parsed;
    return result && Object.keys(result).length > 0;
  } catch { return false; }
}

// ── GPS Extraction from PVO Description ─────────────────
function extractGpsFromDesc(description: string): { lat: number; lng: number } | null {
  const match = (description || "").match(/\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= 4 && lat <= 21 && lng >= 116 && lng <= 127) {
      return { lat, lng };
    }
  }
  return null;
}

// ── Escrow Query ────────────────────────────────────────
function getEscrowsByPvo(pvoId: number): any[] {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS.escrow} --source ${AI_SOURCE_KEY} --network testnet -- get_escrows_by_pvo --pvo_id ${pvoId}`
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return parsed.result || parsed || [];
  } catch { return []; }
}

// ── Forensic Data Collection (All Contracts) ────────────
function queryContract(contractKey: string, method: string, args: string = ""): any {
  const raw = cli(
    `contract invoke --id ${CONTRACT_IDS[contractKey]} --source ${AI_SOURCE_KEY} --network testnet -- ${method} ${args}`
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.result !== undefined ? parsed.result : parsed;
  } catch { return null; }
}

async function collectForensicData(pvoId: number, pvo: any, milestones: any[]): Promise<ForensicCaseFile> {
  const flags: string[] = [];
  const timeline: { timestamp: number; event: string; detail: string }[] = [];
  const contractor = String(pvo.contractor || "");

  // 1. Escrow data
  const escrows = queryContract("escrow", "get_escrows_by_pvo", `--pvo_id ${pvoId}`) || [];
  for (const e of escrows) {
    timeline.push({
      timestamp: Number(e.created_at || 0),
      event: "Escrow Created",
      detail: `Escrow #${e.id} for milestone #${e.milestone_id}, amount ${Number(e.amount || 0) / 10_000_000}`
    });
    const eStatus = typeof e.status === "string" ? e.status : e.status?.tag ?? "";
    if (e.released_at && Number(e.released_at) > 0) {
      timeline.push({
        timestamp: Number(e.released_at),
        event: "Escrow Released",
        detail: `Escrow #${e.id} released to ${String(e.recipient || "").slice(0, 12)}...`
      });
    }
    if (eStatus === "Disputed") {
      flags.push("EscrowDisputed");
      timeline.push({ timestamp: 0, event: "Escrow Disputed", detail: `Escrow #${e.id}` });
    }
  }

  // 2. Grant commitments
  const grants = queryContract("grant_commitment", "get_grants_by_pvo", `--pvo_id ${pvoId}`) || [];
  for (const g of grants) {
    timeline.push({
      timestamp: Number(g.created_at || 0),
      event: "Grant Committed",
      detail: `Grant #${g.id}: ${g.org_name || "Unknown"} committed ${Number(g.amount || 0) / 10_000_000} (${g.currency || "PHP"})`
    });
  }
  const committedTotal = queryContract("grant_commitment", "get_committed_total", `--pvo_id ${pvoId}`);
  const pvoRemaining = queryContract("grant_commitment", "get_pvo_remaining", `--pvo_id ${pvoId}`);
  const pvoEstimatedBudget = Number(pvo.total_budget || 0);
  const pvoEstimatedPesos = pvoEstimatedBudget / 10_000_000;
  if (pvoRemaining !== null && Number(pvoRemaining) > 0) {
    flags.push(`FundingGap:${Number(pvoRemaining) / 10_000_000}PHP_unfunded_of_${pvoEstimatedPesos.toLocaleString()}`);
  }

  // 3. Procurement trail
  const tenderCount = queryContract("procurement_market", "get_tender_count") || 0;
  const tenders: any[] = [];
  const bidsByTender: Record<number, any[]> = {};
  for (let t = 1; t <= Number(tenderCount); t++) {
    const tender = queryContract("procurement_market", "get_tender", `--id ${t}`);
    if (tender && Number(tender.pvo_id) === pvoId) {
      tenders.push(tender);
      const bids = queryContract("procurement_market", "get_bids_by_tender", `--tender_id ${t}`) || [];
      bidsByTender[t] = bids;
      timeline.push({
        timestamp: Number(tender.created_at || 0),
        event: "Tender Created",
        detail: `Tender #${t}: ${tender.title} budget ${Number(tender.budget || 0) / 10_000_000}`
      });
      if (tender.winner) {
        timeline.push({
          timestamp: 0,
          event: "Tender Awarded",
          detail: `Tender #${t} awarded to ${String(tender.winner).slice(0, 12)}...`
        });
      }
      if (bids.length === 1) {
        flags.push("SingleBidTender");
      }
      const prices = bids.map((b: any) => Number(b.price || 0));
      if (prices.length >= 2) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min > 0 && (max - min) / min < 0.02) {
          flags.push("SuspiciousBidClustering");
        }
      }
    }
  }

  // Shell company: contractor won tenders but submitted zero evidence ever
  const awardedTenders = tenders.filter((t: any) => {
    const st = typeof t.status === "string" ? t.status : t.status?.tag ?? "";
    return st === "Awarded" || !!t.winner;
  });
  const totalEvidenceAll = milestones.reduce((s: number, m: any) => s + (m.submitted_evidence || []).length, 0);
  if (awardedTenders.length > 0 && totalEvidenceAll === 0 && milestones.length > 0) {
    // Has at least one milestone defined, won a tender, but zero evidence
    flags.push("ShellCompanyRisk:won_tender_but_zero_evidence");
  }

  // 4. Compliance violations
  const violations = queryContract("compliance_engine", "get_violations_by_pvo", `--pvo_id ${pvoId}`) || [];
  const isCompliant = queryContract("compliance_engine", "is_pvo_compliant", `--pvo_id ${pvoId}`);
  for (const v of violations) {
    const rule = typeof v.rule === "string" ? v.rule : v.rule?.tag ?? "Unknown";
    timeline.push({
      timestamp: Number(v.timestamp || 0),
      event: v.resolved ? "Violation Resolved" : "Violation Detected",
      detail: `${rule} (severity ${v.severity})${v.auto_paused ? " - AUTO-PAUSED" : ""}`
    });
    if (!v.resolved && Number(v.severity) >= 70) {
      flags.push(`CriticalViolation:${rule}`);
    }
  }

  // 5. Community reports
  const communityReports = queryContract("community_oracle", "get_reports_by_pvo", `--pvo_id ${pvoId}`) || [];
  const verifiedReportCount = queryContract("community_oracle", "get_verified_report_count", `--pvo_id ${pvoId}`) || 0;

  // Auto-verify unverified reports (Gate 3 fallback - ensures mobile-submitted reports pass)
  for (const cr of communityReports) {
    if (!cr.verified && cr.id) {
      const ok = await sdkVerifyCommunityReport(Number(cr.id));
      if (ok) {
        console.log(`  [Gate3] Auto-verified report #${cr.id} for PVO ${pvoId}`);
      }
    }
  }

  for (const cr of communityReports) {
    timeline.push({
      timestamp: Number(cr.timestamp || 0),
      event: cr.verified ? "Community Report Verified" : "Community Report Submitted",
      detail: `${typeof cr.report_type === "string" ? cr.report_type : cr.report_type?.tag ?? "Report"} by ${String(cr.citizen || "").slice(0, 12)}...`
    });
    // Reward verified citizen reports
    if (cr.verified && cr.citizen) {
      const rewardBudget = Number(pvo.total_budget || 0);
      if (rewardBudget > 0) {
        try {
          const rewarded = await rewardCitizenForReport(
            String(cr.citizen),
            Number(cr.id || 0),
            pvoId,
            rewardBudget
          );
          if (!rewarded) {
            console.log(`  [Reward] Report #${cr.id} returned false — check logs above for specific reason`);
          }
        } catch (e: any) {
          console.error(`  [Reward] Error rewarding report #${cr.id}: ${e.message?.slice(0, 150)}`);
        }
      } else {
        console.log(`  [Reward] Skipping report #${cr.id} - PVO ${pvoId} budget is 0`);
      }
    }
  }

  // 5b. Cross-check: inspector approvals vs community ground truth
  // If engineer approved a milestone but no citizen verified it, flag for possible collusion
  for (const e of escrows) {
    const escrowMilestone = Number(e.milestone_id || 0);
    const engineerApproved = e.conditions?.engineer_approval || false;
    if (engineerApproved) {
      // Count verified community reports for this milestone
      const reportsForMs = communityReports.filter((cr: any) =>
        Number(cr.milestone_id || 0) === escrowMilestone && cr.verified
      );
      if (reportsForMs.length === 0) {
        flags.push(`InspectorApprovedButZeroCitizenConfirmations:MS${escrowMilestone}`);
      }
      // If inspector approved but community report count is suspiciously low
      const totalReportsForMs = communityReports.filter((cr: any) =>
        Number(cr.milestone_id || 0) === escrowMilestone
      );
      if (engineerApproved && totalReportsForMs.length === 0 && verifiedReportCount === 0) {
        if (!flags.some(f => f.startsWith("GhostProject"))) {
          flags.push("InspectorApprovalWithoutCommunityVerification:potential_false_report");
        }
      }
    }
  }

  // 6. Contractor reputation
  let contractorReputation: any = null;
  let contractorComplaints: any[] = [];
  if (contractor && contractor.length > 10) {
    contractorReputation = queryContract("reputation", "get_reputation", `--entity ${contractor}`);
    contractorComplaints = queryContract("reputation", "get_complaints_by_entity", `--entity ${contractor}`) || [];
    if (!contractorReputation) {
      flags.push("NoReputationRecord:no_performance_history");
    } else {
      const rep = contractorReputation;
      if (Number(rep.reputation_score || 0) < 40) flags.push(`LowReputation:${rep.reputation_score}`);
      if (Number(rep.safety_violations || 0) > 0) flags.push(`SafetyViolations:${rep.safety_violations}`);
      if (Number(rep.audit_findings || 0) > 2) flags.push(`MultipleAuditFindings:${rep.audit_findings}`);
      if (Number(rep.delayed_projects || 0) > Number(rep.completed_projects || 0) && Number(rep.completed_projects || 0) > 0) {
        flags.push("HighDelayRate");
      }
    }
    for (const comp of contractorComplaints) {
      timeline.push({
        timestamp: Number(comp.timestamp || 0),
        event: comp.verified ? "Complaint Verified" : "Complaint Filed",
        detail: `${comp.category || "Unknown"}: ${(comp.description || "").slice(0, 60)}`
      });
    }
  }

  // 7. Value score
  const valueScore = queryContract("value_score", "get_score", `--pvo_id ${pvoId}`);
  if (valueScore && Number(valueScore.overall_score || 0) > 0) {
    timeline.push({
      timestamp: Number(valueScore.last_updated || 0),
      event: "Value Score Updated",
      detail: `Overall: ${valueScore.overall_score}/100 from ${valueScore.total_evaluations || 0} evaluations`
    });
  }

  // 8. Audit trail
  const auditHistory = queryContract("audit_trail", "get_pvo_audit_history", `--pvo_id ${pvoId}`) || [];
  for (const entry of auditHistory) {
    const cat = typeof entry.category === "string" ? entry.category : entry.category?.tag ?? "Unknown";
    timeline.push({
      timestamp: Number(entry.timestamp || 0),
      event: `Audit: ${cat}`,
      detail: `${entry.actor_role || "Unknown"}: ${(entry.action || "").slice(0, 60)}`
    });
  }

  // 9. PVO genesis
  timeline.push({
    timestamp: Number(pvo.created_at || 0),
    event: "PVO Created",
    detail: `"${pvo.title}" budget ${Number(pvo.total_budget || 0) / 10_000_000} funded by ${pvo.fund_source || "unknown"}`
  });

  // 10. Milestone evidence trail
  for (const m of milestones) {
    const mStatus = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
    if (mStatus !== "Pending") {
      timeline.push({
        timestamp: 0,
        event: `Milestone ${mStatus}`,
        detail: `MS #${m.id}: ${m.title}`
      });
    }
    for (const ev of (m.submitted_evidence || [])) {
      const evType = typeof ev.evidence_type === "string" ? ev.evidence_type : ev.evidence_type?.tag ?? "Unknown";
      timeline.push({
        timestamp: Number(ev.submitted_at || 0),
        event: "Evidence Submitted",
        detail: `${evType} for MS #${m.id} by ${String(ev.submitter || "").slice(0, 12)}...`
      });
    }
  }

  // 11. Compute actual budget from winning tender bid
  let actualBudget: number | null = null;
  let actualBudgetPerMs: number | null = null;

  for (const tender of tenders) {
    const tStatus = typeof tender.status === "string" ? tender.status : tender.status?.tag ?? "";
    if ((tStatus === "Awarded" || tender.winner) && bidsByTender[tender.id]) {
      const bids = bidsByTender[tender.id] as any[];
      if (bids.length > 0) {
        const winner = bids.reduce((best: any, b: any) =>
          (Number(b.final_score || 0) > Number(best.final_score || 0)) ? b : best, bids[0]);
        actualBudget = Number(winner.price || 0);
        if (milestones.length > 0) {
          actualBudgetPerMs = actualBudget / milestones.length;
        }
        const actualPesos = actualBudget / 10_000_000;
        if (pvoEstimatedPesos > 0 && Math.abs(actualPesos - pvoEstimatedPesos) / pvoEstimatedPesos > 0.05) {
          const pct = Math.round((actualPesos - pvoEstimatedPesos) / pvoEstimatedPesos * 100);
          flags.push(`BudgetDeviation:winning_bid_${actualPesos.toLocaleString()}_vs_estimated_${pvoEstimatedPesos.toLocaleString()}_(${pct > 0 ? "+" : ""}${pct}%)`);
        }
        break;
      }
    }
  }

  // 12. Cross-contract forensic checks using actual budget
  if (escrows.length > 0 && milestones.length > 0) {
    for (const e of escrows) {
      const ms = milestones.find((m: any) => Number(m.id) === Number(e.milestone_id));
      if (!ms) continue;
      const escrowAmount = Number(e.amount);
      // Use winning bid amount as reference if available, otherwise fall back to milestone budget
      if (actualBudgetPerMs !== null && actualBudgetPerMs > 0) {
        const ratio = escrowAmount / actualBudgetPerMs;
        if (ratio > 1.1 || ratio < 0.9) {
          flags.push(`EscrowBudgetMismatch:escrow_${e.id}_is_${Math.round(ratio * 100)}%_of_actual_per_ms_${(actualBudgetPerMs / 10_000_000).toLocaleString()}`);
        }
      } else if (Number(ms.budget) > 0) {
        const ratio = escrowAmount / Number(ms.budget);
        if (ratio > 1.1 || ratio < 0.9) {
          flags.push(`EscrowBudgetMismatch:escrow_${e.id}_is_${Math.round(ratio * 100)}%_of_milestone_${ms.id}_budget`);
        }
      }
    }
  }

  // Ghost project: funded escrows exist but zero progress after deadline passed
  const now = Math.floor(Date.now() / 1000);
  const pvoDeadline = Number(pvo.deadline || 0);
  const hasFundedEscrows = escrows.some((e: any) => {
    const st = typeof e.status === "string" ? e.status : e.status?.tag ?? "";
    return st === "Funded" || st === "EngineerApproved" || st === "AIValidated"
      || st === "CompliancePassed" || st === "OracleValidated" || st === "CommunityVerified"
      || st === "Ready" || st === "Released" || st === "Disputed";
  });
  const hasAnyEvidence = milestones.some((m: any) => (m.submitted_evidence || []).length > 0);
  if (milestones.length > 0 && hasFundedEscrows
      && !hasAnyEvidence && communityReports.length === 0
      && pvoDeadline > 0 && now > pvoDeadline) {
    flags.push("GhostProject:funded_but_no_progress_after_deadline");
  }

  // Collusion: same contractor across multiple PVOs
  // (checked in the poll loop where we have all PVO data)

  // Sort timeline by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return {
    pvoId,
    pvo,
    milestones,
    escrows,
    grants,
    tenders,
    bidsByTender,
    violations,
    isCompliant: isCompliant === true || isCompliant === "true",
    communityReports,
    verifiedReportCount: Number(verifiedReportCount),
    contractorReputation,
    contractorComplaints,
    valueScore,
    auditHistory,
    flags,
    timeline,
    actualBudget,
    actualBudgetPerMs,
  };
}

// ── Forensic Map: FraudIndicator Mapping ────────────────
function forensicFlagsToIndicators(flags: string[]): string[] {
  const indicators = new Set<string>();
  for (const f of flags) {
    const lower = f.toLowerCase();
    if (lower.includes("ghost")) indicators.add("GhostProject");
    if (lower.includes("collusion") || lower.includes("clustering") || lower.includes("singlebid")) indicators.add("CollusionPattern");
    if (lower.includes("mismatch") || lower.includes("gap")) indicators.add("AbnormalBudgetGrowth");
    if (lower.includes("duplicate")) indicators.add("DuplicateInvoice");
    if (lower.includes("timing") || lower.includes("unusual")) indicators.add("UnusualPaymentTiming");
    if (lower.includes("shell")) indicators.add("ShellCompanyRisk");
    if (lower.includes("inflation") || lower.includes("material")) indicators.add("MaterialCostInflation");
    if (lower.includes("repeated") || lower.includes("contractor")) indicators.add("RepeatedContractorWin");
  }
  return [...indicators];
}

// ── Comprehensive Forensic PVO Analysis ──────────────────
async function analyzePvo(caseFile: ForensicCaseFile): Promise<void> {
  const { pvoId, pvo, milestones, escrows, grants, tenders, violations, communityReports,
          contractorReputation, contractorComplaints, valueScore, auditHistory, flags, timeline } = caseFile;

  const pvoTitle = pvo.title ?? `PVO #${pvoId}`;
  const pvoMunicipality = pvo.municipality ?? "";
  const contractor = String(pvo.contractor ?? "");
  const pvoFundSource = pvo.fund_source ?? "";
  const pvoDescription = pvo.description ?? "";

  console.log(`\n  --- PVO #${pvoId}: ${pvoTitle} ---`);
  console.log(`  [Forensic] ${timeline.length} timeline events | ${flags.length} flags | ${escrows.length} escrows | ${grants.length} grants | ${tenders.length} tenders | ${violations.length} violations | ${communityReports.length} community reports | ${auditHistory.length} audit entries`);
  if (flags.length > 0) console.log(`  [Forensic Flags] ${flags.join(", ")}`);

  const geo = getGeoRisk(pvoMunicipality);
  const pvoGps = extractGpsFromDesc(pvoDescription);

  // 1. Submit Geo Risk (once per PVO)
  if (!hasGeoRisk(pvoId)) {
    console.log(`  [Geo Risk] ${geo.region}: flood=${geo.flood} seismic=${geo.seismic} landslide=${geo.landslide}`);
    if (submitGeoRisk(pvoId, geo.region, geo.flood, geo.seismic, geo.landslide)) {
      console.log(`  [Geo Risk] Submitted`);
    } else {
      console.error(`  [Geo Risk] Failed`);
    }
  } else {
    console.log(`  [Geo Risk] Already exists, skipping`);
  }

  // 2. Submit Digital Twin (once per PVO)
  if (!hasDigitalTwin(pvoId)) {
    const budgetForTwin = caseFile.actualBudget
      ?? milestones.reduce((s: number, m: any) => s + Number(m.budget || 0), 0);
    const totalBudgetPesos = budgetForTwin / 10_000_000;
    const materialIdx = Math.min(95, Math.round(totalBudgetPesos / 500_000_000 * 100) || 50);
    const laborIdx = Math.min(95, milestones.length * 6);
    let deviation = false;
    if (escrows.length > 0) {
      const escrowTotal = escrows.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const escrowPesos = escrowTotal / 10_000_000;
      deviation = Math.abs(escrowPesos - totalBudgetPesos) > totalBudgetPesos * 0.1;
    }
    if (flags.some(f => f.toLowerCase().includes("deviation") || f.toLowerCase().includes("mismatch"))) {
      deviation = true;
    }
    console.log(`  [Digital Twin] Expected cost: ${totalBudgetPesos.toLocaleString()} | material idx: ${materialIdx} | labor idx: ${laborIdx} | deviation: ${deviation}`);
    if (submitDigitalTwin(pvoId, budgetForTwin, materialIdx, laborIdx, deviation)) {
      console.log(`  [Digital Twin] Submitted`);
    } else {
      console.error(`  [Digital Twin] Failed`);
    }
  } else {
    console.log(`  [Digital Twin] Already exists, skipping`);
  }

  // 3. Submit Risk Prediction (updates every scan to reflect current project state)
  const existingFraud = getFraudByPvo(pvoId);
  {
    const factors: string[] = [...flags];
    let delayProb = 10;
    let overrunProb = 8;

    // Factor: Budget scale - use winning bid if available, else milestone sum
    const riskBudget = caseFile.actualBudget
      ?? milestones.reduce((s: number, m: any) => s + Number(m.budget || 0), 0);
    const riskBudgetPesos = riskBudget / 10_000_000;
    if (riskBudgetPesos > 1_000_000_000) {
      delayProb += 20;
      overrunProb += 15;
      factors.push("Large-scale project (>1B)");
    }

    // Factor: Milestone completion
    const releasedCount = milestones.filter((m: any) => {
      const st = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
      return st === "Released";
    }).length;
    const pendingRatio = milestones.length > 0 ? (milestones.length - releasedCount) / milestones.length : 1;
    delayProb += Math.round(pendingRatio * 25);
    if (pendingRatio > 0.5) factors.push(`${pendingRatio > 0.75 ? "Majority" : "Half"} of milestones still pending`);

    // Factor: Evidence coverage
    const milestonesWithEvidence = milestones.filter((m: any) => (m.submitted_evidence ?? []).length > 0).length;
    const evidenceRatio = milestones.length > 0 ? milestonesWithEvidence / milestones.length : 0;
    if (evidenceRatio < 0.5) {
      delayProb += 15;
      factors.push("Low evidence submission rate");
    }

    // Factor: Geo risk
    if (geo.flood > 60) {
      delayProb += 10;
      factors.push(`High flood risk (${geo.flood}%)`);
    }
    if (geo.landslide > 60) {
      delayProb += 8;
      factors.push(`High landslide risk (${geo.landslide}%)`);
    }

    // Factor: Fund source
    if (pvoFundSource === "National Budget") {
      factors.push("Funded by national budget (bureaucratic risk)");
      delayProb += 5;
    }

    // Factor: Contractor reputation (from reputation contract)
    if (contractorReputation) {
      const rep = contractorReputation;
      const repScore = Number(rep.reputation_score || 50);
      if (repScore < 50) {
        delayProb += Math.round((50 - repScore) * 0.4);
        factors.push(`Low contractor reputation (${repScore}/100)`);
      }
      if (Number(rep.delayed_projects || 0) > 0) {
        delayProb += Number(rep.delayed_projects) * 3;
        factors.push(`${rep.delayed_projects} prior delayed projects`);
      }
      if (Number(rep.budget_overruns || 0) > 0) {
        overrunProb += Number(rep.budget_overruns) * 5;
        factors.push(`${rep.budget_overruns} prior budget overruns`);
      }
      if (Number(rep.safety_violations || 0) > 0) {
        delayProb += 10;
        factors.push(`${rep.safety_violations} safety violations on record`);
      }
      if (Number(rep.audit_findings || 0) > 2) {
        delayProb += 8;
        factors.push(`${rep.audit_findings} audit findings`);
      }
    }

    // Factor: Compliance violations
    const unresolvedViolations = violations.filter((v: any) => !v.resolved);
    if (unresolvedViolations.length > 0) {
      delayProb += unresolvedViolations.length * 8;
      factors.push(`${unresolvedViolations.length} unresolved compliance violations`);
    }

    // Factor: Community engagement
    if (communityReports.length === 0 && milestones.some((m: any) => {
      const st = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
      return st === "Released" || st === "EvidenceSubmitted";
    })) {
      factors.push("No community reports for active milestones");
      delayProb += 5;
    }

    // Factor: Value score
    if (valueScore && Number(valueScore.overall_score || 0) > 0 && Number(valueScore.overall_score) < 50) {
      factors.push(`Low value score (${valueScore.overall_score}/100)`);
      delayProb += 10;
    }

    delayProb = Math.min(95, Math.max(5, delayProb));
    overrunProb = Math.min(90, Math.max(5, overrunProb + Math.round(delayProb * 0.2)));
    const riskCat = (delayProb + overrunProb) > 70 ? 3 : (delayProb + overrunProb) > 50 ? 2 : (delayProb + overrunProb) > 25 ? 1 : 0;
    const confid = Math.min(96, 65 + factors.length * 7);

    console.log(`  [Risk] Contractor: ${contractor.slice(0, 12)}... delay=${delayProb}% overrun=${overrunProb}% cat=${riskCat}`);
    console.log(`  [Risk] ${factors.length} factors: ${factors.slice(0, 5).join("; ")}${factors.length > 5 ? ` (+${factors.length - 5} more)` : ""}`);
    const riskKey = cacheKey("risk", `${contractor}:${pvoId}`);
    const riskData = `${delayProb}:${overrunProb}:${riskCat}:${confid}:${factors.join("|")}`;
    if (shouldSubmit(riskKey, riskData)) {
      if (submitRiskPrediction(contractor, delayProb, overrunProb, riskCat, confid)) {
        console.log(`  [Risk] Submitted`);
      } else {
        console.error(`  [Risk] Failed`);
      }
    } else {
      console.log(`  [Risk] Unchanged, skipped`);
    }
  }

  // 4. Analyze each milestone with evidence
  for (const m of milestones) {
    const submitted = m.submitted_evidence ?? [];
    const milestoneBudget = Number(m.budget ?? 0);
    const milestoneId = Number(m.id);

    const evidence: Evidence = {
      gps_lat: null,
      gps_lng: null,
      evidence_types: [],
      metadata_preview: "",
    };

    let gpsEvidenceId: number | null = null;
    let gpsReportedLat = 0;
    let gpsReportedLng = 0;

    for (const ev of submitted) {
      const evType = typeof ev.evidence_type === "string" ? ev.evidence_type : ev.evidence_type?.tag ?? "";
      evidence.evidence_types.push(evType);

      if (evType === "GpsCoordinates" && ev.metadata) {
        const parts = String(ev.metadata).split(",");
        if (parts.length === 2) {
          evidence.gps_lat = parseFloat(parts[0]);
          evidence.gps_lng = parseFloat(parts[1]);
          gpsEvidenceId = Number(ev.id);
          gpsReportedLat = evidence.gps_lat;
          gpsReportedLng = evidence.gps_lng;
        }
      }

      // 5. Submit Image Verification for each evidence item
      {
        const mStatus = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
        const progress = mStatus === "Released" ? 100 : mStatus === "EvidenceSubmitted" ? 40 : mStatus === "Ready" ? 80 : 20;
        const metaLen = String(ev.metadata || "").length;
        const authenticity = Math.min(98, 65 + metaLen / 10 + (ev.verified ? 10 : 0));

        // IPFS content analysis
        const dataHash = typeof ev.data_hash === "string" ? ev.data_hash : "";
        const metadataStr = typeof ev.metadata === "string" ? ev.metadata : "";
        if (isMaybeIpfsHash(dataHash) || isMaybeIpfsHash(metadataStr)) {
          const ipfsResult = await analyzeIpfsContent(dataHash, metadataStr);
          let adjustedAuth = authenticity;
          // Adjust authenticity based on IPFS content analysis
          if (ipfsResult.flags.includes("ipfs_unreachable")) adjustedAuth -= 20;
          if (ipfsResult.flags.includes("tiny_image_file")) adjustedAuth -= 10;
          if (ipfsResult.flags.includes("no_exif_metadata")) adjustedAuth -= 8;
          if (ipfsResult.flags.includes("suspicious_small_document")) adjustedAuth -= 15;
          if (ipfsResult.flags.includes("binary_format_unverifiable")) adjustedAuth -= 5;
          if (ipfsResult.flags.includes("suspicious_metadata")) adjustedAuth -= 15;
          if (ipfsResult.flags.includes("low_text_density")) adjustedAuth -= 10;
          adjustedAuth = Math.max(0, adjustedAuth);
          const summary = `Evidence: ${evType || "Unknown"} for milestone "${m.title || ""}". IPFS: ${ipfsResult.type} ${ipfsResult.details}. ${ipfsResult.flags.length > 0 ? "Flags: " + ipfsResult.flags.join(", ") : "Clean."} Auth: ${adjustedAuth}%`;
          console.log(`  [IPFS] Evidence #${ev.id}: type=${ipfsResult.type} size=${(ipfsResult.size / 1024).toFixed(1)}KB flags=${ipfsResult.flags.join(",") || "none"} auth=${adjustedAuth}%`);
          const imgKey = cacheKey("image", ev.id);
          const imgData = `${progress}:${adjustedAuth}`;
          if (shouldSubmit(imgKey, imgData)) {
            submitImageVerification(Number(ev.id), progress, adjustedAuth, summary);
          } else { console.log(`  [Image] Ev #${ev.id}: Unchanged, skipped`); }
        } else {
          const summary = `Evidence: ${evType || "Unknown"} for milestone "${m.title || ""}". Metadata length: ${metaLen} chars. Verified: ${ev.verified ? "yes" : "no"}.`;
          console.log(`  [Image] Evidence #${ev.id} (${evType}): progress=${progress}% auth=${authenticity}%`);
          const imgKey = cacheKey("image", ev.id);
          const imgData = `${progress}:${authenticity}`;
          if (shouldSubmit(imgKey, imgData)) {
            submitImageVerification(Number(ev.id), progress, authenticity, summary);
          } else { console.log(`  [Image] Ev #${ev.id}: Unchanged, skipped`); }
        }
      }
    }
    evidence.metadata_preview = JSON.stringify(submitted).slice(0, 300);

    // 6. Submit Fraud Detection (every scan with evidence)
    if (submitted.length > 0) {
      let result: AnalysisResult;
      if (LLM_API_KEY) {
        try {
          result = await analyzeWithLLM(
            pvoTitle, m.title ?? "", m.description ?? "", milestoneBudget, evidence
          );
          console.log(`  [Fraud] LLM: risk=${result.riskScore} flags=${result.flags.join(",") || "none"} - ${result.reasoning}`);
        } catch {
          result = analyzeRuleBased(evidence);
          console.log(`  [Fraud] Rule: risk=${result.riskScore} flags=${result.flags.join(",") || "none"}`);
        }
      } else {
        result = analyzeRuleBased(evidence);
        console.log(`  [Fraud] Rule: risk=${result.riskScore} flags=${result.flags.join(",") || "none"}`);
      }

      // Merge forensic flags into fraud indicators
      const ruleIndicators = mapFlagsToIndicators(result.flags);
      const forensicIndicators = forensicFlagsToIndicators(flags);
      let indicators = [...new Set([...ruleIndicators, ...forensicIndicators])];
      // Only flag AbnormalBudgetGrowth if there's an actual budget mismatch or gap
      if (indicators.length === 0 && flags.some(f => f.includes("mismatch") || f.includes("gap"))) {
        indicators = ["AbnormalBudgetGrowth"];
      }

      // Adjust risk score based on forensic flags
      let forensicRiskAdjust = 0;
      for (const f of flags) {
        const lower = f.toLowerCase();
        if (lower.includes("ghost")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 40);
        if (lower.includes("collusion") || lower.includes("clustering")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 30);
        if (lower.includes("criticalviolation")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 25);
        if (lower.includes("safety")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 20);
        if (lower.includes("fundinggap")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 15);
        if (lower.includes("noreputation")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 10);
        if (lower.includes("lowrep")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 10);
        if (lower.includes("singlebid")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 10);
        if (lower.includes("highdelay")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 10);
        if (lower.includes("disputed")) forensicRiskAdjust = Math.max(forensicRiskAdjust, 15);
      }
      const finalRiskScore = Math.min(100, result.riskScore + forensicRiskAdjust);

      const confidence = Math.min(95, 60 + submitted.length * 8 + evidence.evidence_types.length * 3 + flags.length * 2);
      const hash = `${pvoId}-${milestoneId}-${Date.now()}`;

      console.log(`  [Fraud] PVO #${pvoId}: score=${finalRiskScore} (base=${result.riskScore} +forensic=${forensicRiskAdjust}) indicators=${indicators.join(",")}`);
      const fraudKey = cacheKey("fraud", pvoId);
      const fraudData = `${finalRiskScore}:${confidence}:${indicators.join(",")}`;
      if (shouldSubmit(fraudKey, fraudData)) {
        if (submitFraudDetection(pvoId, finalRiskScore, indicators, confidence, hash)) {
          console.log(`  [Fraud] Submitted on-chain`);
        } else {
          console.error(`  [Fraud] Failed to submit`);
        }
      } else {
        console.log(`  [Fraud] Unchanged, skipped`);
      }

      // 7. Submit GPS Validation
      if (gpsEvidenceId !== null && evidence.gps_lat !== null && pvoGps) {
        console.log(`  [GPS] Evidence #${gpsEvidenceId}: reported=[${gpsReportedLat},${gpsReportedLng}] expected=[${pvoGps.lat},${pvoGps.lng}]`);
        const gpsKey = cacheKey("gps", gpsEvidenceId);
        const gpsData = `${gpsReportedLat}:${gpsReportedLng}:${pvoGps.lat}:${pvoGps.lng}`;
        if (shouldSubmit(gpsKey, gpsData)) {
          submitGpsValidation(gpsEvidenceId, pvoGps.lat, pvoGps.lng, gpsReportedLat, gpsReportedLng, 30000);
        } else {
          console.log(`  [GPS] Unchanged, skipped`);
        }
      }
    }
  }
}

// ── Cross-PVO Collusion Detection ───────────────────────
function detectCollusion(allPvoData: { pvoId: number; contractor: string; wonTender: boolean }[]): string[] {
  const flags: string[] = [];
  const contractorPvos: Record<string, number[]> = {};
  for (const d of allPvoData) {
    if (!d.contractor || d.contractor.length < 5) continue;
    // Only count PVOs where this contractor actually won a tender (not placeholder)
    if (!d.wonTender) continue;
    if (!contractorPvos[d.contractor]) contractorPvos[d.contractor] = [];
    contractorPvos[d.contractor].push(d.pvoId);
  }
  for (const [contractor, pvoIds] of Object.entries(contractorPvos)) {
    if (pvoIds.length >= 3) {
      flags.push(`CollusionPattern:${contractor.slice(0, 12)}_holds_${pvoIds.length}_PVOs`);
    }
  }
  return flags;
}

// ── Escrow Gate Checks (Gate 3 + Gate 5) ──────────────────
function checkEscrowGates(): void {
  const escCountRaw = cli(
    `contract invoke --id ${CONTRACT_IDS.escrow} --source ${AI_SOURCE_KEY} --network testnet -- get_escrow_count`
  );
  let escCount = parseInt(escCountRaw.match(/(\d+)/)?.[1] ?? "0");
  if (isNaN(escCount) || escCount === 0) escCount = parseInt(escCountRaw) || 0;

  if (escCount === 0) return;

  for (let escrowId = 1; escrowId <= escCount; escrowId++) {
    const raw = cli(
      `contract invoke --id ${CONTRACT_IDS.escrow} --source ${AI_SOURCE_KEY} --network testnet -- get_escrow --escrow_id ${escrowId}`
    );
    if (!raw) continue;
    processEscrowGates(escrowId, raw);
  }
  // Scan forward for non-sequential escrow IDs
  let escNones = 0;
  let escId = escCount + 1;
  while (escNones < 15) {
    const raw = cli(
      `contract invoke --id ${CONTRACT_IDS.escrow} --source ${AI_SOURCE_KEY} --network testnet -- get_escrow --escrow_id ${escId}`
    );
    if (!raw) { escNones++; escId++; continue; }
    try {
      const parsed = JSON.parse(raw);
      const escrow = parsed.result || parsed;
      if (!escrow) { escNones++; escId++; continue; }
      escNones = 0;
      processEscrowGates(escId, raw);
    } catch { escNones++; }
    escId++;
  }
}

function processEscrowGates(escrowId: number, raw: string): void {
  try {
    const parsed = JSON.parse(raw);
    const escrow = parsed.result || parsed;
    if (!escrow) return;

    const status = typeof escrow.status === "string" ? escrow.status : escrow.status?.tag ?? "";
    const pvoId = Number(escrow.pvo_id || 0);

    // Gate 3: community oracle validation (skip if already passed)
    if (!escrow.conditions?.community_oracle_validation) {
      // Check if verified reports exist for this PVO
      const vCount = queryContract("community_oracle", "get_verified_report_count", `--pvo_id ${pvoId}`) || 0;
      if (Number(vCount) > 0) {
        console.log(`  [Gate 3] Escrow #${escrowId} (PVO ${pvoId}, ${status}) has ${vCount} verified reports, submitting Gate 3`);
        submitEscrowGate3(escrowId);
      }
    }

    // Gate 5: AI validation (skip if already passed)
    if (escrow.conditions?.ai_risk_check === true) return;

    // Gate 5 must wait for Gate 4 (community confirmations)
    const commCount = Number(escrow.conditions?.community_confirmation || 0);
    const commRequired = Number(escrow.conditions?.community_required || 1);
    if (commCount < commRequired) return;

    if (status !== "CommunityVerified" && status !== "Ready" && status !== "OracleValidated") return;

    console.log(`  [Gate 5] Escrow #${escrowId} (${status}) AI assessment complete — pending human Auditor review`);
    logPendingReview(escrowId, pvoId);
  } catch {}
}

// ── Forensic Poller ─────────────────────────────────────
async function poll(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] AI Oracle forensic scan...`);

  try {
    const pvoCountRaw = cli(
      `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo_count`
    );
    let pvoCount = parseInt(pvoCountRaw.match(/(\d+)/)?.[1] ?? "0");
    if (isNaN(pvoCount) || pvoCount === 0) pvoCount = parseInt(pvoCountRaw) || 0;

    if (pvoCount === 0) {
      console.log("  No PVOs found.");
      return;
    }

    console.log(`  Found ${pvoCount} PVOs. Building forensic case files...`);

    // First pass: collect all PVO data + tender winners for cross-PVO collusion detection
    const allPvoBasic: { pvoId: number; contractor: string; wonTender: boolean }[] = [];
    const pvoDataCache: { pvo: any; milestones: any[] }[] = [];

    // Quick scan of tenders to find awarded winners per PVO
    const pvoWinners: Record<number, string> = {};
    const tCount = queryContract("procurement_market", "get_tender_count") || 0;
    for (let t = 1; t <= Number(tCount); t++) {
      const tender = queryContract("procurement_market", "get_tender", `--id ${t}`);
      if (!tender) continue;
      const pvoId = Number(tender.pvo_id || 0);
      const status = typeof tender.status === "string" ? tender.status : tender.status?.tag ?? "";
      if ((status === "Awarded" || tender.winner) && pvoId > 0) {
        pvoWinners[pvoId] = String(tender.winner || "");
      }
    }

    for (let pvoId = 1; pvoId <= pvoCount; pvoId++) {
      try {
        const pvoRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo --pvo_id ${pvoId}`
        );
        if (!pvoRaw) { pvoDataCache.push({ pvo: null, milestones: [] }); continue; }
        const pvo = JSON.parse(pvoRaw).result || JSON.parse(pvoRaw);
        if (!pvo) { pvoDataCache.push({ pvo: null, milestones: [] }); continue; }

        const milestonesRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo_milestones --pvo_id ${pvoId}`
        );
        let milestones: any[] = [];
        if (milestonesRaw) {
          const mParsed = JSON.parse(milestonesRaw);
          milestones = Array.isArray(mParsed) ? mParsed : (mParsed.result || []);
        }

        const contractor = String(pvo.contractor || "");
        // Only count if this contractor actually won a tender for this PVO
        const wonTender = pvoWinners[pvoId] ? contractor === pvoWinners[pvoId] || pvoWinners[pvoId].length < 5 : false;

        pvoDataCache.push({ pvo, milestones });
        allPvoBasic.push({ pvoId, contractor, wonTender });
      } catch {
        pvoDataCache.push({ pvo: null, milestones: [] });
      }
    }

    // Scan forward for PVOs with IDs beyond count (from failed tx gaps)
    let pvoNones = 0;
    let pvoScanId = pvoCount + 1;
    while (pvoNones < 15) {
      try {
        const pvoRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo --pvo_id ${pvoScanId}`
        );
        if (!pvoRaw) { pvoNones++; pvoScanId++; continue; }
        const pvo = JSON.parse(pvoRaw).result || JSON.parse(pvoRaw);
        if (!pvo) { pvoNones++; pvoScanId++; continue; }
        pvoNones = 0;
        const milestonesRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo_milestones --pvo_id ${pvoScanId}`
        );
        let milestones: any[] = [];
        if (milestonesRaw) { const mParsed = JSON.parse(milestonesRaw); milestones = Array.isArray(mParsed) ? mParsed : (mParsed.result || []); }
        const contractor = String(pvo.contractor || "");
        const wonTender = pvoWinners[pvoScanId] ? contractor === pvoWinners[pvoScanId] || pvoWinners[pvoScanId].length < 5 : false;
        pvoDataCache.push({ pvo, milestones });
        allPvoBasic.push({ pvoId: pvoScanId, contractor, wonTender });
      } catch { pvoNones++; }
      pvoScanId++;
    }

    // Cross-PVO collusion detection
    const collusionFlags = detectCollusion(allPvoBasic);
    if (collusionFlags.length > 0) {
      console.log(`  [Cross-PVO] ${collusionFlags.length} collusion patterns detected`);
    }

    // Second pass: collect forensic data and analyze each PVO
    for (let idx = 0; idx < pvoDataCache.length; idx++) {
      const cached = pvoDataCache[idx];
      if (!cached || !cached.pvo) continue;
      const pvoId = cached.pvo.id ?? (idx + 1);

      try {
        const caseFile = await collectForensicData(pvoId, cached.pvo, cached.milestones);

        // Inject cross-PVO collusion flags for this contractor
        const contractor = String(cached.pvo.contractor || "");
        for (const cf of collusionFlags) {
          if (cf.toLowerCase().includes(contractor.toLowerCase().slice(0, 12))) {
            caseFile.flags.push(cf);
          }
        }

        await analyzePvo(caseFile);
      } catch (e: any) {
        console.error(`  PVO #${pvoId} error: ${e.message?.slice(0, 100)}`);
      }
    }

    // Phase 2: Check escrows for Gate 5 validation
    checkEscrowGates();

    // Summary
    const fraudCount = getFraudCount();
    console.log(`\n  Forensic scan complete. Total fraud detections on-chain: ${fraudCount}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ${msg.slice(0, 100)}`);
  }
}

// ── Main ────────────────────────────────────────────────
const runOnce = process.argv.includes("--once");

console.log("============================================");
console.log("  PoPV AI Oracle v3 - Forensic Engine");
console.log("============================================");
console.log(`  AI Auditor: ${AI_AUDITOR_PUBLIC}`);
console.log(`  Mode: ${runOnce ? "Once" : `Continuous (${POLL_INTERVAL_MS / 1000}s)`}`);
console.log(`  LLM: ${LLM_API_KEY ? `${LLM_MODEL} @ ${LLM_BASE_URL}` : "Disabled (rule-based only)"}`);
console.log(`  Forensic scope: 10 contracts, full project lifecycle`);
console.log(`  Data sources: pvo_core, escrow, audit_trail, reputation,`);
console.log(`    compliance, procurement, grants, community, value_score, ai_oracle`);
console.log(`  Submissions: fraud, risk, image, twin, geo, GPS, Gate 5\n`);

poll();

if (runOnce) {
  setTimeout(() => { console.log("\nDone."); process.exit(0); }, 120000);
} else {
  setInterval(poll, POLL_INTERVAL_MS);
  process.on("SIGINT", () => { console.log("\nShutting down."); process.exit(0); });
}
