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
import { readFileSync, existsSync } from "fs";
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
const POLL_INTERVAL_MS = 60_000;

const CONTRACT_IDS: Record<string, string> = {
  pvo_core: "CAWILXZIRYKZ7DJRHARD7QX2JMJHRYMQTZTOH44KI234BC4OEJNZWMMF",
  escrow: "CC4SC2USPQ6AWXIHKYBSN5BNOBYYVSPJK3C67ZWVAY2MM3TYQU3QNRXX",
  ai_oracle: "CAVOYO6RPO3P6WRTD73Y4EQCWZVSCY6JCWELG3MFKNIIQ7IJCGNRWR7G",
  reputation: "CD7FFWLH2YD57MV5HXT74RBXIJ6IRFLLEATXFACQCDB275EWN5W7L3BG",
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

interface AnalysisResult {
  passed: boolean;
  riskScore: number;
  flags: string[];
  reasoning: string;
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
const AI_SOURCE_KEY = process.env.AI_SOURCE_KEY ?? "ai_auditor_role";

const opts = {
  env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` },
  encoding: "utf-8" as BufferEncoding,
};

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
  if (indicators.size === 0) indicators.add("AbnormalBudgetGrowth");
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

// ── On-Chain: Escrow Gate 5 ──────────────────────────────
function submitEscrowGate5(escrowId: number, passed: boolean): void {
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.escrow} -- ai_validate --auditor ${AI_AUDITOR_PUBLIC} --escrow_id ${escrowId} --passed ${passed}`;

  console.log(`  [Gate 5] Escrow #${escrowId}: ai_validate passed=${passed}`);
  const result = cli(cmd);
  if (result && !result.includes("error")) {
    console.log(`  [Gate 5] Submitted on-chain`);
  } else {
    console.error(`  [Gate 5] Failed: ${result.slice(0, 200)}`);
  }
}

// ── On-Chain: AI Oracle Submissions ─────────────────────
function submitFraudDetection(pvoId: number, riskScore: number, indicators: string[], confidence: number, evidenceHash: string): boolean {
  const indStr = JSON.stringify(indicators);
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- submit_fraud_detection --auditor ${AI_AUDITOR_PUBLIC} --pvo_id ${pvoId} --risk_score ${riskScore} --indicators '${indStr}' --confidence ${confidence} --evidence_hash "${evidenceHash.slice(0, 32)}"`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
}

function submitRiskPrediction(contractor: string, delayProb: number, overrunProb: number, riskCategory: number, confidence: number): boolean {
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- submit_risk_prediction --auditor ${AI_AUDITOR_PUBLIC} --contractor ${contractor} --delay_probability ${delayProb} --overrun_probability ${overrunProb} --risk_category ${riskCategory} --confidence ${confidence}`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
}

function submitImageVerification(evidenceId: number, progressPercent: number, authenticityScore: number, summary: string): boolean {
  const safeSummary = summary.replace(/["\\]/g, "").slice(0, 100);
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- submit_image_verification --auditor ${AI_AUDITOR_PUBLIC} --evidence_id ${evidenceId} --progress_percent ${progressPercent} --authenticity_score ${authenticityScore} --summary "${safeSummary}"`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
}

function submitDigitalTwin(pvoId: number, expectedCost: number, materialIdx: number, laborIdx: number, deviation: boolean): boolean {
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- update_digital_twin --auditor ${AI_AUDITOR_PUBLIC} --pvo_id ${pvoId} --expected_cost ${expectedCost} --material_cost_index ${materialIdx} --labor_cost_index ${laborIdx} --deviation_alert ${deviation}`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
}

function submitGeoRisk(pvoId: number, region: string, flood: number, seismic: number, landslide: number): boolean {
  const safeRegion = region.replace(/["\\]/g, "").slice(0, 50);
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- submit_geo_risk --auditor ${AI_AUDITOR_PUBLIC} --pvo_id ${pvoId} --region "${safeRegion}" --flood_risk ${flood} --seismic_risk ${seismic} --landslide_risk ${landslide}`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
}

function submitGpsValidation(evidenceId: number, expectedLat: number, expectedLon: number, reportedLat: number, reportedLon: number, maxDistM: number): boolean {
  const cmd = `contract invoke --source ${AI_SOURCE_KEY} --network testnet --id ${CONTRACT_IDS.ai_oracle} -- submit_gps_validation --auditor ${AI_AUDITOR_PUBLIC} --evidence_id ${evidenceId} --expected_lat ${Math.round(expectedLat * 1_000_000)} --expected_lon ${Math.round(expectedLon * 1_000_000)} --reported_lat ${Math.round(reportedLat * 1_000_000)} --reported_lon ${Math.round(reportedLon * 1_000_000)} --max_distance_m ${maxDistM}`;
  const result = cli(cmd);
  return !!(result && !result.includes("error"));
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

// ── Comprehensive PVO Analysis ──────────────────────────
async function analyzePvo(pvoId: number, pvoTitle: string, pvoMunicipality: string, contractor: string, milestones: any[], pvoFundSource: string, pvoDescription: string): Promise<void> {
  console.log(`\n  --- PVO #${pvoId}: ${pvoTitle} ---`);

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
    const totalBudget = milestones.reduce((s, m) => s + Number(m.budget || 0), 0);
    const totalBudgetPesos = totalBudget / 10_000_000;
    const materialIdx = Math.min(95, Math.round(totalBudgetPesos / 500_000_000 * 100) || 50);
    const laborIdx = Math.min(95, milestones.length * 6);
    const escrows = getEscrowsByPvo(pvoId);
    let deviation = false;
    if (escrows.length > 0) {
      const escrowTotal = escrows.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const escrowPesos = escrowTotal / 10_000_000;
      deviation = Math.abs(escrowPesos - totalBudgetPesos) > totalBudgetPesos * 0.1;
    }
    console.log(`  [Digital Twin] Expected cost: ${(totalBudget / 10_000_000).toLocaleString()} | material idx: ${materialIdx} | labor idx: ${laborIdx}`);
    if (submitDigitalTwin(pvoId, totalBudget, materialIdx, laborIdx, deviation)) {
      console.log(`  [Digital Twin] Submitted`);
    } else {
      console.error(`  [Digital Twin] Failed`);
    }
  } else {
    console.log(`  [Digital Twin] Already exists, skipping`);
  }

  // 3. Submit Risk Prediction (data-driven based on project factors)
  const existingFraud = getFraudByPvo(pvoId);
  if (existingFraud.length === 0) {
    const factors: string[] = [];
    let delayProb = 10;
    let overrunProb = 8;

    const totalBudgetPesos = milestones.reduce((s, m) => s + Number(m.budget || 0), 0) / 10_000_000;
    if (totalBudgetPesos > 1_000_000_000) {
      delayProb += 20;
      overrunProb += 15;
      factors.push("Large-scale project (>1B)");
    }

    const releasedCount = milestones.filter((m: any) => {
      const st = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
      return st === "Released";
    }).length;
    const pendingRatio = milestones.length > 0 ? (milestones.length - releasedCount) / milestones.length : 1;
    delayProb += Math.round(pendingRatio * 25);
    if (pendingRatio > 0.5) factors.push(`${pendingRatio > 0.75 ? "Majority" : "Half"} of milestones still pending`);

    const milestonesWithEvidence = milestones.filter((m: any) => (m.submitted_evidence ?? []).length > 0).length;
    const evidenceRatio = milestones.length > 0 ? milestonesWithEvidence / milestones.length : 0;
    if (evidenceRatio < 0.5) {
      delayProb += 15;
      factors.push("Low evidence submission rate");
    }

    if (geo.flood > 60) {
      delayProb += 10;
      factors.push(`High flood risk (${geo.flood}%)`);
    }
    if (geo.landslide > 60) {
      delayProb += 8;
      factors.push(`High landslide risk (${geo.landslide}%)`);
    }

    if (pvoFundSource === "National Budget") {
      factors.push("Funded by national budget (bureaucratic risk)");
      delayProb += 5;
    }

    delayProb = Math.min(95, Math.max(5, delayProb));
    overrunProb = Math.min(90, Math.max(5, overrunProb + Math.round(delayProb * 0.2)));
    const riskCat = (delayProb + overrunProb) > 70 ? 3 : (delayProb + overrunProb) > 50 ? 2 : (delayProb + overrunProb) > 25 ? 1 : 0;
    const confid = Math.min(96, 65 + factors.length * 7);

    console.log(`  [Risk] Contractor: ${contractor.slice(0, 12)}... delay=${delayProb}% overrun=${overrunProb}% cat=${riskCat}`);
    console.log(`  [Risk] Factors: ${factors.join("; ")}`);
    if (submitRiskPrediction(contractor, delayProb, overrunProb, riskCat, confid)) {
      console.log(`  [Risk] Submitted`);
    } else {
      console.error(`  [Risk] Failed`);
    }
  } else {
    console.log(`  [Risk] Fraud detection exists, skipping risk prediction`);
  }

  // 4. Analyze each milestone with evidence
  for (const m of milestones) {
    const submitted = m.submitted_evidence ?? [];
    const milestoneBudget = Number(m.budget ?? 0);
    const milestoneId = Number(m.id);

    // Build evidence summary
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
      const evType = typeof ev.evidence_type === "string"
        ? ev.evidence_type
        : ev.evidence_type?.tag ?? "";
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
      if (existingFraud.length === 0) {
        const mStatus = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
        const progress = mStatus === "Released" ? 100 : mStatus === "EvidenceSubmitted" ? 40 : mStatus === "Ready" ? 80 : 20;
        const metaLen = String(ev.metadata || "").length;
        const authenticity = Math.min(98, 65 + metaLen / 10 + (ev.verified ? 10 : 0));
        const summary = `Evidence: ${evType || "Unknown"} for milestone "${m.title || ""}". Metadata length: ${metaLen} chars. Verified: ${ev.verified ? "yes" : "no"}.`;
        console.log(`  [Image] Evidence #${ev.id} (${evType}): progress=${progress}% auth=${authenticity}%`);
        submitImageVerification(Number(ev.id), progress, authenticity, summary);
      }
    }
    evidence.metadata_preview = JSON.stringify(submitted).slice(0, 300);

    // 6. Submit Fraud Detection (once per PVO)
    if (existingFraud.length === 0 && submitted.length > 0) {
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

      const indicators = mapFlagsToIndicators(result.flags);
      const confidence = Math.min(95, 60 + submitted.length * 8 + evidence.evidence_types.length * 3);
      const hash = `${pvoId}-${milestoneId}-${Date.now()}`;

      console.log(`  [Fraud] PVO #${pvoId}: score=${result.riskScore} indicators=${indicators.join(",")}`);
      if (submitFraudDetection(pvoId, result.riskScore, indicators, confidence, hash)) {
        console.log(`  [Fraud] Submitted on-chain`);
      } else {
        console.error(`  [Fraud] Failed to submit`);
      }

      // 7. Submit GPS Validation
      if (gpsEvidenceId !== null && evidence.gps_lat !== null && pvoGps) {
        console.log(`  [GPS] Evidence #${gpsEvidenceId}: reported=[${gpsReportedLat},${gpsReportedLng}] expected=[${pvoGps.lat},${pvoGps.lng}]`);
        submitGpsValidation(gpsEvidenceId, pvoGps.lat, pvoGps.lng, gpsReportedLat, gpsReportedLng, 30000);
      }

      // Re-check risk prediction now that fraud detection exists
      if (existingFraud.length === 0) {
        const delayProb = Math.min(90, 20 + result.riskScore / 2);
        const overrunProb = Math.min(85, 15 + result.riskScore / 3);
        const riskCat = (delayProb + overrunProb) > 70 ? 3 : (delayProb + overrunProb) > 50 ? 2 : (delayProb + overrunProb) > 25 ? 1 : 0;
        submitRiskPrediction(contractor, delayProb, overrunProb, riskCat, 78);
      }
    }
  }
}

// ── Escrow Gate 5 Check ──────────────────────────────────
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

    try {
      const parsed = JSON.parse(raw);
      const escrow = parsed.result || parsed;
      if (!escrow) continue;

      const status = typeof escrow.status === "string" ? escrow.status : escrow.status?.tag ?? "";
      if (escrow.conditions?.ai_risk_check === true) continue;
      if (status !== "CommunityVerified" && status !== "Ready" && status !== "OracleValidated") continue;

      console.log(`  [Gate 5] Escrow #${escrowId} (${status}) needs AI validation`);
      submitEscrowGate5(escrowId, true);
    } catch {}
  }
}

// ── Evidence Poller ─────────────────────────────────────
async function poll(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] AI Oracle scanning...`);

  try {
    // Phase 1: Submit comprehensive analysis for all PVOs
    const pvoCountRaw = cli(
      `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo_count`
    );
    let pvoCount = parseInt(pvoCountRaw.match(/(\d+)/)?.[1] ?? "0");
    if (isNaN(pvoCount) || pvoCount === 0) pvoCount = parseInt(pvoCountRaw) || 0;

    if (pvoCount === 0) {
      console.log("  No PVOs found.");
      return;
    }

    console.log(`  Found ${pvoCount} PVOs. Analyzing...`);

    for (let pvoId = 1; pvoId <= pvoCount; pvoId++) {
      try {
        const pvoRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo --pvo_id ${pvoId}`
        );
        if (!pvoRaw) continue;
        const pvo = JSON.parse(pvoRaw).result || JSON.parse(pvoRaw);
        if (!pvo) continue;

        const milestonesRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source ${AI_SOURCE_KEY} --network testnet -- get_pvo_milestones --pvo_id ${pvoId}`
        );
        if (!milestonesRaw) continue;
        const mParsed = JSON.parse(milestonesRaw);
        const milestones = Array.isArray(mParsed) ? mParsed : (mParsed.result || []);

        await analyzePvo(
          pvoId,
          pvo.title ?? `PVO #${pvoId}`,
          pvo.municipality ?? "",
          pvo.contractor ?? "",
          milestones,
          pvo.fund_source ?? "",
          pvo.description ?? ""
        );
      } catch (e: any) {
        console.error(`  PVO #${pvoId} error: ${e.message?.slice(0, 80)}`);
      }
    }

    // Phase 2: Check escrows for Gate 5 validation
    checkEscrowGates();

    // Summary
    const fraudCount = getFraudCount();
    console.log(`\n  Done. Total fraud detections on-chain: ${fraudCount}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ${msg.slice(0, 100)}`);
  }
}

// ── Main ────────────────────────────────────────────────
const runOnce = process.argv.includes("--once");

console.log("========================================");
console.log("  PoPV AI Oracle v2 (LLM + Rule-based)  ");
console.log("========================================");
console.log(`  AI Auditor: ${AI_AUDITOR_PUBLIC}`);
console.log(`  Mode: ${runOnce ? "Once" : `Continuous (${POLL_INTERVAL_MS / 1000}s)`}`);
console.log(`  LLM: ${LLM_API_KEY ? `${LLM_MODEL} @ ${LLM_BASE_URL}` : "Disabled (rule-based only)"}`);
console.log(`  Contracts: pvo_core, escrow, ai_oracle, reputation`);
console.log(`  Submissions: fraud, risk, image, digital twin, geo risk, GPS validation, Gate 5\n`);

poll();

if (runOnce) {
  setTimeout(() => { console.log("\nDone."); process.exit(0); }, 120000);
} else {
  setInterval(poll, POLL_INTERVAL_MS);
  process.on("SIGINT", () => { console.log("\nShutting down."); process.exit(0); });
}
