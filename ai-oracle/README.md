# PoPV AI Oracle (TypeScript)

Standalone fraud detection engine for Proof of Public Value.

## Quick Start

```bash
# Set AI Auditor secret key
export AI_AUDITOR_SECRET="S..."

# Manual run (process all pending, exit)
npx tsx ai-oracle/service.ts --once

# Continuous mode (poll every 60s)
npx tsx ai-oracle/service.ts
```

## How It Works

1. Queries Stellar testnet for milestones with status "EngineerApproved"
2. Extracts GPS coordinates, evidence metadata, and descriptions
3. Runs 3 rule-based fraud detection checks locally
4. Submits `ai_validate(passed, risk_score)` on-chain

## Fraud Checks

| Check | Triggers | Penalty |
|-------|----------|---------|
| GPS outside Philippines | lat < 4° or > 21°, lng < 116° or > 127° | +40 |
| Near-zero GPS | lat,lng within 0.01 of (0,0) | +50 |
| Suspicious metadata | Contains "test", "demo", "fake", "sample" | +20 |
| Short description | < 10 characters | +10 |

**Risk ≥ 50 = FAIL. Risk < 50 = PASS.**

## Deployment Options

| Method | Command |
|--------|---------|
| Manual | `npx tsx ai-oracle/service.ts --once` |
| Continuous | `npx tsx ai-oracle/service.ts` |
| Cron | `*/5 * * * * cd /path/to/popv && npx tsx ai-oracle/service.ts --once` |
| Vercel | `frontend/api/ai-oracle.js` (serverless + Vercel Cron) |

## Requirements

- Node.js v18+
- Stellar CLI (`stellar`) in PATH
- AI Auditor secret key (exported as env var or in `.dev-logs/newrolecreden.md`)
- Internet (testnet RPC)

No Rust, no contracts, no local blockchain, no external APIs.

## Security

The secret key is NEVER hardcoded. It reads from:
1. `AI_AUDITOR_SECRET` environment variable (preferred - in-memory only)
2. `.dev-logs/newrolecreden.md` (gitignored, fallback)

Never commit `.env` files. Never paste the key in code. For production, use Vercel environment variables or a secrets manager.
