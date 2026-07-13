# Appendix C: How the AI Oracle Works

A comprehensive guide to PoPV's AI forensic engine - fraud detection, risk prediction, image/GPS verification, digital twin simulation, geo-risk assessment, and forensic case analysis.

---

## What the AI Is

The AI Oracle is a **forensic analysis engine** that cross-references on-chain data across 10 Soroban contracts to detect fraud, predict risk, verify evidence, and trace the full project transaction journey from creation to release.

### 🔑 Primary Data Sources: Citizens & Inspectors

The AI is not black-box machine learning. It is **fully rule-based, fully data-driven**. Its accuracy depends entirely on two human roles:

| Role | What They Submit | AI Analysis |
|---|---|---|
| **Citizen Reporter** 📸 | GPS-tagged field reports via `community_oracle` | GPS proximity check, verified report count, ghost project detection, community consensus scoring |
| **Engineer/Inspector** 🔧 | Drone imagery, engineering reports, lab results, GPS coordinates via `pvo_core.submit_evidence` | Image authenticity scoring, metadata analysis, evidence coverage ratio, shell company risk, material/labor cost deviation |

**No citizen reports?** → Ghost project flag. **No inspector evidence?** → Shell company risk flag. **GPS mismatch?** → Fraud indicator. The AI's forensic flags are direct reflections of what humans observe on the ground.

It operates as an **off-chain Node.js service** (`ai-oracle/service.ts`) that reads from all contracts, builds forensic case files per PVO, and submits analysis results to the on-chain `ai_oracle` contract. The frontend then reads from the contract to display findings.

```
10 Contracts → Forensic Analysis Engine → ai_oracle contract → Public Dashboard
```

The engine is deterministic and data-driven - zero random values, zero mock data. Every metric derives from real on-chain state.

## Six Analysis Categories (v3 Forensic Engine)

The engine scans 10 contracts to build a per-PVO forensic case file containing timeline events, anomaly flags, and cross-contract analysis.

### 1. Fraud Detection (8 indicators + forensic adjustment)

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

Each detection is submitted with a **risk score (0-100)** and **confidence percentage**. The risk score is NOT random - it's derived from the severity of the anomaly.

### 2. Risk Prediction

Reputation-driven contractor risk model. Predicts the probability of delays and budget overruns based on the contractor's on-chain track record.

**Contract struct:**

```rust
pub struct RiskPrediction {
    pub contractor: Address,
    pub delay_probability: u32,     // 0-100%
    pub overrun_probability: u32,   // 0-100%
    pub risk_category: u32,         // 1=Low, 2=Medium, 3=High
    pub confidence: u32,            // 0-100%
}
```

**How the AI computes it:**

```
delay_risk = (100 - reputation_score) + (disputes × 15) + (budget_size_factor)
overrun_risk = (100 - reputation_score) + (disputes × 10) + (budget_size_factor)

where budget_size_factor = 10 if > ₱10M, 5 if > ₱1M, 0 otherwise

Risk Level 1 (Low):    delay < 30%
Risk Level 2 (Medium): delay 30-60%  
Risk Level 3 (High):   delay > 60%
```

The reputation score comes from the `reputation` contract, which tracks completed projects, audit findings, safety violations, and community complaints. This is real on-chain data - not self-reported.

**Gate 5 impact:** Risk Category 3 (High) triggers a Gate 5 rejection. The AI auditor won't approve an escrow for a contractor with a high risk profile unless other analysis categories override the concern.

### 3. GPS Validation

Compares GPS coordinates submitted by contractors/inspectors against the project's expected location. Uses the **Haversine formula** to compute great-circle distance.

**Contract struct:**

```rust
pub struct GpsValidation {
    pub evidence_id: u32,
    pub expected_lat: i64,    // microdegrees (× 1,000,000)
    pub expected_lng: i64,
    pub reported_lat: i64,
    pub reported_lng: i64,
}
```

**How the AI computes it:**

```
d = 2r × arcsin(√(sin²(Δlat/2) + cos(lat₁)cos(lat₂)sin²(Δlng/2)))
```

| Distance | Interpretation | Gate 5 effect |
|----------|---------------|---------------|
| < 5 km | Within municipality - likely valid | ✅ Pass |
| 5-50 km | Nearby - needs review | ⚠️ Warning |
| > 50 km | Suspicious - possible fake coordinates | ❌ Reject |

**Coordinate sources:**

1. **Expected**: PVO coordinates from `[lat,lng]` prefix in description field (created by agency in the New PVO form)
2. **Fallback**: Municipality geocoding lookup (if no PVO coordinates were entered)
3. **Reported**: GPS evidence submitted by contractor/inspector via `submit_evidence` with `GpsCoordinates` type

**Gate 5 impact:** Multiple GPS validation failures (>50km from expected) trigger a Gate 5 rejection. The AI won't approve an escrow when evidence coordinates don't match the project location.

### 4. Digital Twin (Cost Simulation)

A real-time cost simulation that tracks whether actual spending matches the budgeted amount. Think of it as a **shadow ledger** that runs alongside the real escrow system.

**Contract struct:**

```rust
pub struct DigitalTwin {
    pub pvo_id: u32,
    pub expected_cost: i128,        // PVO total budget
    pub material_cost_index: u32,   // 100 = on budget, >120 = inflated
    pub labor_cost_index: u32,      // 100 = on budget, >120 = inflated  
    pub deviation_alert: bool,      // true if actual > expected × 1.2
}
```

**How the AI computes it:**

```
Expected cost   = PVO total_budget
Actual cost     = sum of all escrow amounts for that PVO
Material Index  = 90 + (actual/expected × 10)
Labor Index     = 85 + (actual/expected × 15)
Deviation Alert = actual > expected × 1.2
```

| Index | Range | Meaning |
|-------|-------|---------|
| < 80 | Under-funded | Milestones not yet created, or premature stage |
| 80-120 | On track | Spending aligns with budget |
| > 120 | Cost inflation | Significantly over budget - red flag |
| > 130 | Severe | Material cost index triggers `MaterialCostInflation` fraud flag |

**Gate 5 impact:** A deviation alert (actual > 120% of expected) triggers a Gate 5 rejection. The AI won't approve an escrow when costs have already exceeded the budget significantly.

**Example:**

```
PVO #3 Budget:    ₱8,000,000
Escrows Created:  ₱6,500,000
Escrows Released: ₱4,200,000

Expected Cost:    ₱8,000,000
Actual Cost:      ₱4,200,000
Material Index:   95% (on track)
Labor Index:      93% (on track)
Deviation Alert:  false
→ ✅ Pass Gate 5
```

### 5. Image / Evidence Verification

Verifies that evidence files submitted by contractors actually exist on IPFS. Pings the IPFS gateway to confirm the hash is accessible and records content metadata.

**Contract struct:**

```rust
pub struct ImageVerification {
    pub evidence_id: u32,
    pub progress_percent: u32,     // estimated completion %
    pub authenticity_score: u32,   // 0-100, based on IPFS availability
    pub summary: String,           // Human-readable findings
}
```

**How the AI verifies:**

```
Fetch HEAD request → https://gateway.pinata.cloud/ipfs/{hash}
  ├── 200 OK    → Content-type, size → authenticity: 85-95%
  ├── 4xx/5xx   → Not accessible → authenticity: 20%
  └── Timeout    → Gateway unreachable → authenticity: 50% (exists on-chain, can't verify)
```

**What it does NOT do:** No computer vision. No image recognition. No AI-powered content analysis. It only verifies that the file the contractor claimed to upload actually exists on IPFS and is accessible.

**Gate 5 impact:** Low authenticity scores (< 30%) from inaccessible IPFS content contribute to fraud risk. Multiple failed verifications across a PVO's evidence chain can trigger a Gate 5 rejection.

### 6. Geo Risk Assessment

Evaluates environmental risk factors for the project location. Modeled after Philippine geographical hazards - flooding, landslides, and seismic activity.

**Contract struct:**

```rust
pub struct GeoRiskAssessment {
    pub pvo_id: u32,
    pub flood_risk: u32,            // 0-5 scale
    pub landslide_risk: u32,        // 0-5 scale
    pub earthquake_risk: u32,       // 0-5 scale  
    pub overall_risk: u32,          // max of above
}
```

**How the AI computes it:**

The risk scores are submitted by the AI analysis service after cross-referencing the PVO's municipality against Philippine hazard maps. The overall risk is the maximum of the three categories.

| Risk Level | Meaning | Gate 5 effect |
|------------|---------|---------------|
| 0-2 | Low risk | ✅ Pass |
| 3 | Moderate risk | ⚠️ Warning |
| 4-5 | High risk | ❌ Reject |

**Gate 5 impact:** Geo risk level 4+ triggers a Gate 5 rejection. The AI won't approve an escrow for projects in high-risk hazard zones without additional verification of mitigation measures.

## Gate 5 Decision Matrix

The AI Auditor's Gate 5 verdict is a **composite** of all five analysis types. A single high-risk finding in ANY category can trigger rejection:

| Analysis | Check | Threshold | Rejects Gate 5? |
|----------|-------|-----------|-----------------|
| Fraud | Any high-risk indicator (≥50) | Collusion, ghost project, etc. | ✅ Yes |
| Risk | Contractor risk category | Level 3 (High) | ✅ Yes |
| Digital Twin | Cost deviation alert | Actual > 120% of expected | ✅ Yes |
| Geo Risk | Overall risk level | Level 4+ | ✅ Yes |
| GPS | Validation failures | Any failed (>50km) | ✅ Yes |
| Image | Inaccessible evidence | Authenticity < 30% | ⚠️ Contributes |

**Only if ALL categories pass does the AI recommend Gate 5 approval.** This is displayed on the AI Dashboard's Escrow Gate tab where the human AI Auditor reviews the verdict and executes the transaction.

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
  --id CAVD64WSZLOVV35RFKPG2OFVRCR3F3LGXQYSFR2JTDSGIBYKBXKUBP25 \
  -- add_ai_auditor \
  --admin GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV \
  --auditor GATLFXDNY2OIRX437GHRWR5CWFV7EQ7ORNYIND7APGNGU3HCNYI45AWW
```

## 6. Forensic Case Analysis

The v3 forensic engine builds a complete **ForensicCaseFile** per PVO by querying all 10 contracts:

| Data Source | What's Collected |
|-------------|-----------------|
| `pvo_core` | PVO lifecycle, milestones, evidence |
| `escrow` | All escrows, their amounts, gate progression |
| `grant_commitment` | Donor pledges, funding gaps |
| `procurement_market` | Tenders, bids, bid clustering |
| `compliance_engine` | Violations, compliant status |
| `community_oracle` | Citizen reports, verified count |
| `reputation` | Contractor score, complaints, violations |
| `value_score` | Public value ratings |
| `audit_trail` | Decision history |
| `ai_oracle` | Prior fraud/risk submissions |

**Forensic Flags Detected (13 types):**
GhostProject, CollusionPattern, EscrowBudgetMismatch, FundingGap, UnregisteredContractor, LowReputation, SafetyViolations, MultipleAuditFindings, CriticalViolation, SingleBidTender, SuspiciousBidClustering, EscrowDisputed, HighDelayRate

Each flag has a severity (critical/high/medium/low) and contributes to the overall fraud risk score via forensic risk adjustment.

The case file is built by `collectForensicData()` in `ai-oracle/service.ts:425-672` and displayed in the **Forensic Cases** tab of the AI Dashboard.

These findings feed into the **Provenance Chain** (`provenance-indexer/service.ts`) which links every event to its Stellar transaction hash, creating an immutable, append-only audit trail served at `/provenance-store.json`.

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

Real-time AI inference on blockchains is not possible - smart contracts are deterministic enclaves with no I/O. Every production oracle (Chainlink, Pyth, Band Protocol) uses the same architecture:

1. Off-chain service reads data / runs model
2. Signs transaction with authorized key
3. Submits results to on-chain contract
4. Smart contracts reference the stored results

Our AI Oracle does exactly this, but with deterministic heuristics instead of black-box ML. Every finding is **reproducible** - anyone can re-run the analysis and get identical results. This is important for auditability: an auditor can verify that a fraud flag was raised because the same contractor appeared in 5 PVOs, not because "the model said so."
