# Appendix C: How the AI Oracle Works

A comprehensive guide to PoPV's fraud detection, risk prediction, and verification engine.

---

## What the AI Is (and Isn't)

The AI Oracle is a **deterministic heuristic engine**, not a machine learning model. It does not call OpenAI, Anthropic, or any external API. There is zero network access, zero API keys, and zero recurring costs.

Instead, it cross-references on-chain data across all contracts using mathematical rules:

```
PVOs + Escrows + Reputation + Audit Trail + Community Reports + Compliance
                              │
                              ▼
                    Heuristic analysis engine
                              │
                              ▼
                    Findings submitted to ai_oracle
                              │
                              ▼
                    Public dashboard at /ai
```

### Why no actual ML?

Soroban smart contracts cannot access the internet, load models, or run floating-point math. All computation happens off-chain in the analysis script, and only the **results** are stored on-chain. This is the same architecture used by Chainlink oracles, price feeds, and every production blockchain oracle.

## Five Analysis Categories

### 1. Fraud Detection (8 indicators)

The engine scans for 8 fraud patterns defined in the `ai_oracle` contract:

| Indicator | Detection Rule | Data Sources |
|-----------|---------------|-------------|
| `CollusionPattern` | Same contractor assigned to 3+ PVOs | `pvo_core.get_pvo_count` + `get_pvo` |
| `GhostProject` | PVO with zero escrows and zero audit entries | `escrow.get_escrows_by_pvo` + `audit_trail.get_entry` |
| `AbnormalBudgetGrowth` | Milestone budgets exceed PVO budget by >10% | `pvo_core.get_pvo_milestones` |
| `RepeatedContractorWin` | Escrow total > 150% of PVO budget | `escrow.get_escrows_by_pvo` |
| `DuplicateInvoice` | Same IPFS hash submitted across PVOs | Cross-PVO evidence comparison |
| `UnusualPaymentTiming` | Escrow release within first hour of creation | `escrow.get_escrow` timestamps |
| `MaterialCostInflation` | Material cost index >130% | `ai_oracle.update_digital_twin` data |
| `ShellCompanyRisk` | Contractor has zero reputation on record | `reputation.get_reputation` |

Each detection is submitted with a **risk score (0-100)** and **confidence percentage**. The risk score is NOT random — it's derived from the severity of the anomaly.

### 2. Risk Prediction

Reputation-driven contractor risk model:

```
delay_risk = (100 - reputation_score) + (disputes * 15) + (budget_size_factor)
overrun_risk = (100 - reputation_score) + (disputes * 10) + (budget_size_factor)

Risk Level 1 (Low):    delay < 30%
Risk Level 2 (Medium): delay 30-60%
Risk Level 3 (High):   delay > 60%
```

The reputation score comes from the `reputation` contract, which tracks completed projects, audit findings, safety violations, and community complaints. This is real on-chain data — not self-reported.

### 3. GPS Validation

Uses the **Haversine formula** to compute the distance between the project's municipality coordinates and the GPS coordinates submitted in evidence:

```
d = 2r * arcsin(sqrt(sin^2(dlat/2) + cos(lat1)cos(lat2)sin^2(dlng/2)))
```

| Distance | Interpretation |
|----------|---------------|
| < 5 km | Within municipality — likely valid |
| 5-50 km | Nearby — needs review |
| > 50 km | Suspicious — possible fake coordinates |

Coordinates are extracted from the evidence `metadata` field (format: `"lat:14.5995,lng:120.9842"`). The expected coordinates come from a geocoded lookup of the PVO's municipality.

### 4. Digital Twin (Cost Simulation)

Compares expected vs actual spending:

```
Expected cost = PVO total_budget
Actual cost   = sum of all escrow amounts for that PVO

Material Index = 90 + (actual/expected * 10)  // 100 = on budget
Labor Index    = 85 + (actual/expected * 15)  // 100 = on budget
Deviation Alert = actual > expected * 1.2
```

Indexes above 120 indicate significant cost inflation. Below 80 suggests under-funding or premature stage.

### 5. Image / Evidence Verification

Pings the IPFS gateway to verify that submitted evidence files actually exist:

```
Fetch HEAD request -> https://gateway.pinata.cloud/ipfs/{hash}
  |-- 200 OK    -> Content-type, size -> Verified
  |-- 4xx/5xx   -> Not accessible -> Flagged
  |-- Timeout    -> Gateway unreachable -> Recorded but not verified
```

This does NOT analyze image content (no computer vision). It only verifies that the file the contractor claimed to upload actually exists on IPFS.

## Architecture

```
.aim/ai-service.ts (off-chain, runs on demand)
    │
    |-- reads pvo_core         -> PVO metadata, milestones, evidence
    |-- reads escrow           -> escrow amounts, statuses, gate progress
    |-- reads reputation       -> contractor integrity scores
    |-- reads audit_trail      -> decision history, actor patterns
    |-- reads community_oracle -> citizen reports, flags
    |-- reads compliance_engine -> active violations
    │
    |-- runs heuristics (math only, no API calls)
    │
    |-- writes ai_oracle       -> fraud_detection, risk_prediction,
                                    gps_validation, digital_twin,
                                    image_verification
                                    (signed by ai_auditor secret key)
```

## Running the Analysis

```bash
cd frontend && npm run ai
```

This is a one-liner. It loads all chain data, runs all five heuristics, and submits findings. Results appear immediately on the public `/ai` dashboard.

### Requirements

The `ai_auditor` wallet must be authorized on the `ai_oracle` contract (one-time setup):

```bash
stellar contract invoke --source alice --network testnet --send=yes \
  --id CDR5OICDQYT33V7XPPD63YAUDMKRTWSKN7MD5VPS5K773PVU5AAMID43 \
  -- add_ai_auditor \
  --admin GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV \
  --auditor GAKJTLALTPWV4DLQGUCBMSO36EL3YIXK6X774D27Q3HBIR4GPDX2BL5J
```

## Production Deployment

The analysis script can be scheduled as:

| Option | Frequency | Cost |
|--------|-----------|------|
| GitHub Actions cron | Every 15 min | Free (2000 min/month) |
| AWS Lambda | Every 5 min | ~$0/month (free tier) |
| Local cron | Every hour | Free |
| Manual trigger | On-demand | Free |

The service requires:

- Stellar RPC access (free public endpoint)
- IPFS gateway access (free public gateway)
- `ai_auditor` secret key (already configured)
- Zero API keys, zero subscriptions, zero paid services

## Why This Approach

Real-time AI inference on blockchains is not possible — smart contracts are deterministic enclaves with no I/O. Every production oracle (Chainlink, Pyth, Band Protocol) uses the same architecture:

1. Off-chain service reads data / runs model
2. Signs transaction with authorized key
3. Submits results to on-chain contract
4. Smart contracts reference the stored results

Our AI Oracle does exactly this, but with deterministic heuristics instead of black-box ML. Every finding is **reproducible** — anyone can re-run the analysis and get identical results. This is important for auditability: an auditor can verify that a fraud flag was raised because the same contractor appeared in 5 PVOs, not because "the model said so."
