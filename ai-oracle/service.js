#!/usr/bin/env node
/**
 * PoPV AI Oracle — Standalone Fraud Detection Engine
 *
 * Watches Stellar testnet for EngineerApproved milestones.
 * Runs rule-based fraud detection locally. Submits pass/fail on-chain.
 *
 * Usage:
 *   node ai-oracle/service.js --once       # Manual: run once, exit
 *   node ai-oracle/service.js              # Continuous: poll every 60s
 *
 * Config:
 *   export AI_AUDITOR_SECRET="S..."        # Required
 *   (Reads from .dev-logs/newrolecreden.md if not set)
 *
 * Host anywhere: VPS, Raspberry Pi, cron job, serverless function.
 * No external dependencies beyond the Stellar RPC endpoint.
 * No Rust. No contracts. No local blockchain.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────
const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const POLL_INTERVAL_MS = 60000;

// Contract IDs — synced with frontend/src/config.ts
const CONTRACT_IDS = {
  pvo_core: "CCFBBSDV2KEVO4EIEFL5QNS3QZP4VH24RSBWLKANWBC5SYRVCCWM4AVR",
  ai_oracle: "CDWZ7HQZ5IIFHCOB3HLYTDNA4MGKYWHZ6VWI2GR7TGZEFGMLJBWBQG7C",
};

const CREDS_PATH = path.join(__dirname, "..", ".dev-logs", "newrolecreden.md");

// ── AI Auditor Wallet ───────────────────────────────────
function getSecretKey() {
  if (process.env.AI_AUDITOR_SECRET) return process.env.AI_AUDITOR_SECRET;

  try {
    const creds = fs.readFileSync(CREDS_PATH, "utf-8");
    const match = creds.match(/AIAuditor.*?`(S[A-Z0-9]+)`/s);
    if (match) {
      console.log("  📖 Read AI Auditor key from newrolecreden.md");
      return match[1];
    }
  } catch {}

  console.error("❌ AI_AUDITOR_SECRET not set and not found in credentials file.");
  console.error(`   Expected: ${CREDS_PATH}`);
  console.error("   Set it: export AI_AUDITOR_SECRET=S...");
  process.exit(1);
}

const AI_AUDITOR_SECRET = getSecretKey();
const HOME = process.env.HOME || "/root";
const STELLAR = `${HOME}/.local/bin/stellar`;

const AI_AUDITOR_PUBLIC = execSync(
  `${STELLAR} keys address --secret ${AI_AUDITOR_SECRET}`
).toString().trim();

const opts = {
  env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` },
  encoding: "utf-8",
};

function cli(cmd) {
  try {
    return execSync(`${STELLAR} ${cmd} 2>/dev/null`, opts).trim();
  } catch (e) {
    return "";
  }
}

// ── AI Fraud Detection Engine ───────────────────────────
function analyzeEvidence(evidence) {
  const flags = [];
  let riskScore = 0;

  // Check 1: GPS within Philippine bounding box
  if (evidence.gps_lat && evidence.gps_lng) {
    const lat = parseFloat(evidence.gps_lat);
    const lng = parseFloat(evidence.gps_lng);
    if (lat < 4 || lat > 21 || lng < 116 || lng > 127) {
      flags.push("GPS_OUTSIDE_PHILIPPINES");
      riskScore += 40;
    }
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) {
      flags.push("GPS_NEAR_ZERO");
      riskScore += 50;
    }
  }

  // Check 2: Suspicious metadata patterns
  if (evidence.metadata) {
    const meta = String(evidence.metadata).toLowerCase();
    if (/test|demo|fake|sample/.test(meta)) {
      flags.push("SUSPICIOUS_METADATA");
      riskScore += 20;
    }
  }

  // Check 3: Evidence description completeness
  if (!evidence.description || String(evidence.description).length < 10) {
    flags.push("INSUFFICIENT_DESCRIPTION");
    riskScore += 10;
  }

  return { passed: riskScore < 50, riskScore, flags };
}

// ── On-Chain Submission ─────────────────────────────────
function submitValidation(pvoId, milestoneId, passed, riskScore) {
  const cmd = [
    "contract invoke",
    "--source-account", AI_AUDITOR_PUBLIC,
    "--network testnet",
    `--id ${CONTRACT_IDS.pvo_core}`,
    "--",
    "ai_validate",
    `--auditor ${AI_AUDITOR_PUBLIC}`,
    `--milestone_id ${milestoneId}`,
    `--passed ${passed}`,
  ].join(" ");

  console.log(`  📤 pvo=${pvoId} m#=${milestoneId} passed=${passed} risk=${riskScore}`);
  const result = cli(cmd);
  if (result.includes("error")) {
    console.error(`  ❌ Failed: ${result.slice(0, 200)}`);
  } else {
    console.log(`  ✅ Validated on-chain`);
  }
}

// ── Evidence Poller ─────────────────────────────────────
async function poll() {
  console.log(`\n🔍 [${new Date().toISOString()}] Scanning...`);

  try {
    const pvoCount = parseInt(
      cli(`contract invoke --id ${CONTRACT_IDS.pvo_core} --network testnet -- get_pvo_count`)
        .match(/"result":"(\d+)"/)?.[1] || "0"
    );

    if (pvoCount === 0) {
      console.log("  No PVOs yet.");
      return;
    }

    for (let pvoId = 1; pvoId <= Math.min(pvoCount, 20); pvoId++) {
      const raw = cli(
        `contract invoke --id ${CONTRACT_IDS.pvo_core} --network testnet -- get_pvo_milestones --pvo_id ${pvoId}`
      );
      if (!raw) continue;

      try {
        const milestones = JSON.parse(raw).result || [];
        for (const m of milestones) {
          const status = m.status?.tag || m.status;
          if (status !== "EngineerApproved") continue;

          console.log(`  🎯 PVO #${pvoId} M#${m.id} — Engineer Approved`);
          console.log(`     ${m.title} · ${(m.budget / 10_000_000).toLocaleString()} PHP`);

          const evidence = {
            gps_lat: null,
            gps_lng: null,
            description: m.description || "",
            metadata: JSON.stringify(m.submitted_evidence || []),
          };

          for (const ev of m.submitted_evidence || []) {
            const evType = ev.evidence_type?.tag || ev.evidence_type;
            if (evType === "GpsCoordinates" && ev.metadata) {
              const parts = String(ev.metadata).split(",");
              if (parts.length === 2) {
                evidence.gps_lat = parseFloat(parts[0]);
                evidence.gps_lng = parseFloat(parts[1]);
              }
            }
          }

          const { passed, riskScore, flags } = analyzeEvidence(evidence);
          console.log(`  🤖 risk=${riskScore} flags=${flags.length ? flags.join(",") : "none"}`);
          submitValidation(pvoId, m.id, passed, riskScore);
        }
      } catch {}
    }
  } catch (e) {
    console.error(`  ⚠️ ${e.message?.slice(0, 100)}`);
  }
}

// ── Main ────────────────────────────────────────────────
const runOnce = process.argv.includes("--once");

console.log("╔══════════════════════════════════╗");
console.log("║   PoPV AI Oracle Service         ║");
console.log("╚══════════════════════════════════╝");
console.log(`  AI Auditor: ${AI_AUDITOR_PUBLIC}`);
console.log(`  Mode: ${runOnce ? "Once (manual)" : `Continuous (${POLL_INTERVAL_MS / 1000}s)`}`);
console.log(`  RPC: ${RPC_URL}\n`);

poll();

if (runOnce) {
  setTimeout(() => {
    console.log("\n✅ Done.");
    process.exit(0);
  }, 5000);
} else {
  setInterval(poll, POLL_INTERVAL_MS);
  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down.");
    process.exit(0);
  });
}
