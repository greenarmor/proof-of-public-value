#!/usr/bin/env node
/**
 * PoPV AI Oracle v2 — LLM-Powered Fraud Detection Engine
 *
 * Watches Stellar testnet for escrows that need AI validation (Gate 5).
 * Sends PVO + milestone + evidence data to an LLM for fraud analysis.
 * Submits pass/fail + risk score on-chain via escrow.ai_validate.
 *
 * Usage:
 *   npx tsx ai-oracle/service.ts --once
 *   npx tsx ai-oracle/service.ts              # poll every 60s
 *
 * LLM Config (env vars):
 *   AI_LLM_API_KEY      — API key (OpenAI, Groq, DeepSeek, etc.)
 *   AI_LLM_BASE_URL     — defaults to https://api.openai.com/v1
 *   AI_LLM_MODEL        — defaults to gpt-4o-mini
 *
 * Wallet Config:
 *   AI_AUDITOR_SECRET    — AI Auditor wallet secret key
 *   AI_AUDITOR_SOURCE    — read-only account for contract queries
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
  console.log("  📄 Loaded .env from", envPath);
}

// ── Config ──────────────────────────────────────────────
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const POLL_INTERVAL_MS = 60_000;

const CONTRACT_IDS: Record<string, string> = {
  pvo_core: "CAWILXZIRYKZ7DJRHARD7QX2JMJHRYMQTZTOH44KI234BC4OEJNZWMMF",
  escrow: "CC4SC2USPQ6AWXIHKYBSN5BNOBYYVSPJK3C67ZWVAY2MM3TYQU3QNRXX",
};

const READ_SOURCE = process.env.AI_AUDITOR_SOURCE ?? "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const CREDS_PATH = join(__dirname, "..", ".dev-logs", "newrolecreden.md");

// LLM config
const LLM_API_KEY = process.env.AI_LLM_API_KEY ?? "";
const LLM_BASE_URL = process.env.AI_LLM_BASE_URL ?? "https://api.openai.com/v1";
const LLM_MODEL = process.env.AI_LLM_MODEL ?? "gpt-4o-mini";

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
    const match = creds.match(/AIAuditor.*?`(S[A-Z0-9]+)`/s);
    if (match) {
      console.log("  📖 Read AI Auditor key from newrolecreden.md");
      return match[1];
    }
  } catch {}
  console.error("❌ AI_AUDITOR_SECRET not set.");
  process.exit(1);
}

const AI_AUDITOR_SECRET = getSecretKey();
const HOME = process.env.HOME ?? "/root";
const STELLAR = `${HOME}/.local/bin/stellar`;
const AI_AUDITOR_PUBLIC = Keypair.fromSecret(AI_AUDITOR_SECRET).publicKey();

const opts = {
  env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` },
  encoding: "utf-8" as BufferEncoding,
};

function cli(cmd: string): string {
  try { return execSync(`${STELLAR} ${cmd} 2>/dev/null`, opts).trim(); }
  catch { return ""; }
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
BUDGET: ₱${budgetPesos}
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

    // Extract JSON from response (handle markdown-wrapped JSON)
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
    console.error(`  ⚠️ LLM failed: ${e.message?.slice(0, 100)}. Falling back to rule-based.`);
    throw e; // Let caller handle fallback
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

// ── On-Chain Submission ─────────────────────────────────
function submitValidation(
  pvoId: number,
  milestoneId: number,
  escrowId: number,
  passed: boolean,
): void {
  const cmd = [
    "contract invoke",
    `--source-account ${AI_AUDITOR_PUBLIC}`,
    "--network testnet",
    `--id ${CONTRACT_IDS.escrow}`,
    "--send=yes",
    "--",
    "ai_validate",
    `--auditor ${AI_AUDITOR_PUBLIC}`,
    `--escrow_id ${escrowId}`,
    `--passed ${passed}`,
  ].join(" ");

  console.log(`  📤 Escrow #${escrowId}: ai_validate passed=${passed}`);
  const result = cli(cmd);
  if (!result || result.includes("error")) {
    console.error(`  ❌ Failed: ${result.slice(0, 200)}`);
  } else {
    console.log(`  ✅ Submitted on-chain`);
  }
}

// ── Evidence Poller ─────────────────────────────────────
async function poll(): Promise<void> {
  console.log(`\n🔍 [${new Date().toISOString()}] Scanning...`);

  try {
    const escCountRaw = cli(
      `contract invoke --id ${CONTRACT_IDS.escrow} --source-account ${READ_SOURCE} --network testnet -- get_escrow_count`
    );
    let escCount = parseInt(escCountRaw.match(/"result":"?(\d+)"?/)?.[1] ?? "0");
    if (isNaN(escCount) || escCount === 0) escCount = parseInt(escCountRaw) || 0;

    if (escCount === 0) {
      console.log("  No escrows yet.");
      return;
    }

    for (let escrowId = 1; escrowId <= escCount; escrowId++) {
      const raw = cli(
        `contract invoke --id ${CONTRACT_IDS.escrow} --source-account ${READ_SOURCE} --network testnet -- get_escrow --escrow_id ${escrowId}`
      );
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const escrow = parsed.result || parsed;
        if (!escrow) continue;

        const status = typeof escrow.status === "string" ? escrow.status : escrow.status?.tag ?? "";
        // AI risk check is Gate 5 — run after CommunityVerified or when escrow is Ready
        if (escrow.conditions?.ai_risk_check === true) continue;
        if (status !== "CommunityVerified" && status !== "Ready" && status !== "OracleValidated") continue;

        const pvoId = Number(escrow.pvo_id);
        const milestoneId = Number(escrow.milestone_id);
        console.log(`  🎯 Escrow #${escrowId} — PVO #${pvoId} M#${milestoneId} (${status})`);

        const pvoRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source-account ${READ_SOURCE} --network testnet -- get_pvo --pvo_id ${pvoId}`
        );
        const pvo = pvoRaw ? (JSON.parse(pvoRaw).result || JSON.parse(pvoRaw)) : null;
        const pvoTitle = pvo?.title ?? `PVO #${pvoId}`;

        const milestonesRaw = cli(
          `contract invoke --id ${CONTRACT_IDS.pvo_core} --source-account ${READ_SOURCE} --network testnet -- get_pvo_milestones --pvo_id ${pvoId}`
        );
        if (!milestonesRaw) continue;
        const mParsed = JSON.parse(milestonesRaw);
        const milestones = (mParsed.result || []) as any[];
        const m = milestones.find((x: any) => Number(x.id) === milestoneId);
        if (!m) { console.log("     ⚠️ Milestone not found"); continue; }

        const budget = Number(m.budget ?? 0);
        console.log(`     ${m.title} · ₱${(budget / 10_000_000).toLocaleString()}`);

        const submitted = m.submitted_evidence ?? [];
        const evidence: Evidence = {
          gps_lat: null,
          gps_lng: null,
          evidence_types: [],
          metadata_preview: "",
        };

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
            }
          }
        }
        evidence.metadata_preview = JSON.stringify(submitted).slice(0, 300);

        // Try LLM first, fall back to rule-based
        let result: AnalysisResult;
        if (LLM_API_KEY) {
          try {
            result = await analyzeWithLLM(
              pvoTitle, m.title ?? "", m.description ?? "", budget, evidence
            );
            console.log(`  🤖 LLM: risk=${result.riskScore} flags=${result.flags.join(",") || "none"} — ${result.reasoning}`);
          } catch {
            result = analyzeRuleBased(evidence);
            console.log(`  📏 Rule: risk=${result.riskScore} flags=${result.flags.join(",") || "none"}`);
          }
        } else {
          result = analyzeRuleBased(evidence);
          console.log(`  📏 Rule: risk=${result.riskScore} flags=${result.flags.join(",") || "none"}`);
        }

        submitValidation(pvoId, milestoneId, escrowId, result.passed);
      } catch {
        // Malformed escrow data — skip
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ⚠️ ${msg.slice(0, 100)}`);
  }
}

// ── Main ────────────────────────────────────────────────
const runOnce = process.argv.includes("--once");

console.log("╔══════════════════════════════════╗");
console.log("║  PoPV AI Oracle v2 (LLM + Rule)  ║");
console.log("╚══════════════════════════════════╝");
console.log(`  AI Auditor: ${AI_AUDITOR_PUBLIC}`);
console.log(`  Mode: ${runOnce ? "Once" : `Continuous (${POLL_INTERVAL_MS / 1000}s)`}`);
console.log(`  LLM: ${LLM_API_KEY ? `${LLM_MODEL} @ ${LLM_BASE_URL}` : "Disabled (rule-based only)"}`);
console.log(`  RPC: ${RPC_URL}\n`);

poll();

if (runOnce) {
  setTimeout(() => { console.log("\n✅ Done."); process.exit(0); }, 10000);
} else {
  setInterval(poll, POLL_INTERVAL_MS);
  process.on("SIGINT", () => { console.log("\n👋 Shutting down."); process.exit(0); });
}
