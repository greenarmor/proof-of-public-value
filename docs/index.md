# Proof of Public Value  -  User Manual

> **Category:** DeFi & Ecosystem Composability  -  APAC Stellar Hackathon
> **Serverless dApp** on Stellar Soroban testnet. Stablecoins + payment rails + smart contract enforcement. No backend, no database  -  the blockchain is the infrastructure.

---

## 🏆 Why This Hackathon Project Exists

The **APAC Stellar Hackathon** challenges builders to create financial infrastructure powered by Stellar's payment rails. The **DeFi & Ecosystem Composability** category asks: how can stablecoins and Soroban smart contracts be combined to build real-world financial systems that don't just move money  -  but enforce accountability?

**PoPV answers that question with a system that uses Stellar as the backbone of government transparency.**

Stablecoins like USDC are the settlement layer  -  real value locked in escrow, released only when work is proven. Soroban smart contracts are the enforcement layer  -  13 contracts that verify, validate, and gatekeep every peso before it moves. The result is composable infrastructure: any government can plug in their own stablecoin, their own validators, their own citizens, and the system works the same way.

This is not just a hackathon entry. It is a statement: **the technology to end government corruption already exists.** Stellar provides the rails. Soroban provides the logic. PoPV provides the proof.

Government corruption is not a technology problem  -  it's a trust problem. Public funds flow based on signatures and paperwork, not on proof of work completed. Auditors arrive years late. Citizens have no voice. The system trusts officials to be honest, and when they're not, nobody finds out until the money is gone.

**This hackathon project proves that it doesn't have to be this way.**

By combining Stellar Soroban smart contracts with a serverless frontend and real stablecoin settlement, PoPV creates a system where:

- **Every project** is a programmable PVO on-chain  -  immutable, auditable, public
- **Every unit of currency** is locked behind 5 independent verification gates  -  no single person controls release
- **Every citizen** becomes a verifier  -  GPS field reports are the final gate
- **Every decision** is recorded forever on Stellar  -  who approved, when, and why

No backend. No database. No centralized server. Just Stellar contracts, a stablecoin, and a static frontend. Anyone can deploy it. Everyone can audit it. No one can cheat it.

**This is what the Build Better Hackathon is about: building technology that makes the world better.** And there is no better place to start than the billions of pesos lost to corruption every year.

---

## ⛓️ Serverless by Design  -  Stellar Soroban as the Backend

PoPV has **no backend server, no database, no API layer.** The Stellar blockchain is the entire infrastructure.

| Traditional App | PoPV |
|-----------------|------|
| Node.js / Python backend | ❌ None  -  Stellar Soroban contracts handle all logic |
| PostgreSQL / MongoDB | ❌ None  -  Soroban persistent storage |
| REST API endpoints | ❌ None  -  RPC calls to `soroban-testnet.stellar.org:443` |
| Auth server (JWT/OAuth) | ❌ None  -  Freighter wallet signs transactions |
| File storage (S3) | ❌ None  -  IPFS for evidence, Soroban events for audit trail |
| Deployment server (EC2/VPS) | ❌ None  -  Static HTML/CSS/JS on Vercel (free) |

**13 Soroban smart contracts** execute every business rule on-chain:
- `access_control`  -  13 role-based permissions
- `pvo_core`  -  PVO lifecycle, milestones, evidence, budget validation
- `escrow`  -  5-gate conditional fund lock + InProgress auto-transition
- `grant_commitment`  -  Donor pledges with exact-budget enforcement
- `community_oracle`  -  Citizen report verification
- `reputation`  -  RPT soulbound token gatekeeper (anti-Sybil)
- `ai_oracle`  -  Fraud detection engine
- `compliance_engine`  -  Regulatory validation
- `audit_trail`  -  Immutable decision log
- `value_score`  -  0-100 public value rating
- `public_index`  -  National department rankings
- `procurement_market`  -  Supplier pre-qualification
- `pphp_sac`  -  Stellar Asset Contract settlement token (SAC, 7 decimals)

**Cross-contract calls** enable complex workflows without centralized orchestration:
```
escrow.release() → pvo_core.update_pvo_status(InProgress)
grant_commitment.commit() → pvo_core.get_pvo_budget() (verify exact match)
community_oracle.verify() → reputation.check_balance(RPT ≥ 1)
```

**Result:** Anyone can clone the repo, run `npm run build && npm start`, and have a fully functional government accountability platform. No server provisioning. No database setup. No infrastructure. The Stellar testnet IS the production environment.

### AI Oracle  -  One Service, Every Frontend

The AI Oracle is the **only off-chain component**. It's a standalone TypeScript service (`ai-oracle/service.ts`) that:

- Polls testnet for EngineerApproved milestones
- Runs local fraud detection (GPS bounding box, metadata scanning, description analysis)
- Submits `ai_validate(passed, risk_score)` on-chain
- **One instance serves all frontend deployments**

Deploy it anywhere: VPS, Raspberry Pi, cron job, or Vercel serverless function. No cloud dependencies. No API keys. No GPU. Pure rule-based fraud detection.

```bash
# Manual run:
npx tsx ai-oracle/service.ts --once

# Cron (every 5 min):
*/5 * * * * cd /path/to/popv && npx tsx ai-oracle/service.ts --once
```

---

## 🇵🇭 Philippines as Case Study  -  Open to Every Government

**Proof of Public Value is not built for one country. It is built for any government that wants to prove its integrity.**

The Philippines serves as our primary case study because the pattern of corruption here is well-documented and devastatingly familiar:

- **₱10 Billion PDAF pork barrel scam**  -  lawmakers funneled public funds to ghost NGOs
- **Billions in DPWH ghost infrastructure**  -  projects paid for but never built
- **Funds released upfront**  -  contractors paid before a brick was laid
- **Projects never verified**  -  no citizen oversight, no independent audit
- **Accountability delayed for years**  -  by the time auditors arrive, evidence is gone

But this pattern is not unique to the Philippines. It happens in Indonesia, Brazil, Kenya, India, Mexico, Nigeria  -  anywhere public funds flow without verification, corruption follows.

**PoPV is open-source, serverless, and nationality-agnostic.** The Stellar blockchain doesn't care which country deploys it. The 5-gate verification works the same whether you're building roads in Manila, bridges in Nairobi, or schools in São Paulo. Any government can clone the repo, deploy the contracts, and start proving value to its citizens.

---

## 🏛️ Our Mission: Step Up, or Be Watched

**To every government official in every country:** You were given a sacred trust  -  to be the custodian of public wealth, not its owner. Every peso, dollar, rupee, or shilling of the public budget belongs to the people. Your job is to protect it, allocate it wisely, and spend it transparently. If you have been doing that  -  this system proves your integrity. If you haven't  -  this system exposes you.

**PoPV exists to digitalize accountability.** We are not here to replace government. We are here to give government the tools to prove they are doing their job  -  and to give citizens the power to verify it themselves.

**To the honest public servant:** This platform protects you. Every decision you make is recorded on an immutable blockchain. Your approvals are timestamped. Your compliance checks are auditable. When accusations fly, you have cryptographic proof that you did the right thing.

**To the corrupt:** Your time is up. There are no more paper trails to tamper with. No more signatures to forge. No more "lost documents." Every citizen with a phone is now an auditor. Every GPS-tagged report is a permanent record. Every peso is tracked from budget to contractor to ground.

**To every citizen, in every nation:** You are no longer a bystander. Your GPS report is the final gate. Without citizen verification, not a single unit of currency is released from escrow. You don't need to be an auditor. You don't need to work for a government agency. You just need to visit a project site and report what you see  -  or don't see.

**We built this system to help fix what's broken.** Digitalization is not just about efficiency. It's about transparency that cannot be undone. It's about accountability that cannot be dodged. It's about giving the people the tools to demand proof  -  and giving honest officials the tools to provide it.

**Government officials: step up. Citizens: watch. The system: prove it.**

➡️ **[🎭 Start Role-Playing Now](https://greenarmor.github.io/proof-of-public-value/onboarding)**  -  Pick any role and walk through the system.

---

➡️ **Reference: [Appendix A  -  Glossary of Terms](appendices.md)**  -  Every term explained: PVOs, Milestones, Escrows, Gates, Roles, RPT, pPHP, SAC units, and more.

➡️ **Read: [Why PoPV Exists  -  The Philippine Corruption Crisis](philippines-corruption.md)**

---

## The Problem

Every year, governments lose **$2.6 trillion to corruption**  -  ghost projects, inflated budgets, substandard infrastructure, and untraceable fund flows.

The root cause: **public money is released based on signatures and paperwork, not on proof of value created.** Funds flow to contractors before a brick is laid. Evidence is paper-based and easily tampered with. Auditors arrive years after money is spent.

---

## What PoPV Solves

Proof of Public Value enforces one rule: **No Proof. No Payment.**

Every public project becomes a **Public Value Object (PVO)**  -  a programmable digital entity on Stellar. Funds are locked in escrow smart contracts and released **only after passing 5 independent verification gates:**

| Gate | Who | What |
|------|-----|------|
| 1. Engineer | Licensed Professional | Physical work meets specifications |
| 2. AI Risk | AI Oracle | Fraud detection, anomaly scanning, metadata verification |
| 3. Compliance | Auditor / COA | Procurement law, budget rules, safety regulations |
| 4. Community Oracle | Citizens | Verified GPS field reports confirm project exists on the ground |
| 5. Community Confirmations | Citizens | Must reach the threshold set at escrow creation  -  multiple independent witnesses |

If any gate fails, funds remain locked. No single person can release money.

---

## How It Works  -  Full Lifecycle

### 1. Government Agency Creates a PVO

A Government Agency wallet creates a Public Value Object on-chain. Each PVO has a title, department, municipality, and total budget (in pesos). The contractor field is left as a placeholder - assigned after the bidding process.

The PVO starts as **Proposed**.

### 2. Procurement Bidding

Once a PVO is created, the government agency opens a tender linked to a specific milestone via the procurement_market contract. Contractors submit bids with price, quality score, and timeline. The contract scores bids using a weighted formula and awards the highest scorer, then cross-calls pvo_core.assign_contractor to update the PVO on-chain. This means the contractor field remains empty until bidding completes. The Create PVO form shows "TBD - assigned after bidding" for new projects.

### 3. Government Agency Defines Milestones

Instead of paying the entire budget upfront, the project is broken into milestones  -  individual phases each with their own budget, evidence requirements, and community confirmation threshold. For example:

- **Milestone 1:** Site Preparation  -  ₱50M
- **Milestone 2:** Foundation  -  ₱150M
- **Milestone 3:** Structure  -  ₱200M
- **Milestone 4:** Finishing  -  ₱100M

Budget input is in **pesos**  -  the contract auto-converts to SAC atomic units (pesos × 10,000,000).

### 4. International Donor Pledges Exact PVO Budget

Donors (World Bank, JICA, ADB, etc.) commit grants through the Donor Dashboard. The commitment contract enforces **exact-match pledging**: the pledge must equal **PVO budget minus already-committed funds**. This prevents over/under-committing.

The grant status is **Committed**.

### 5. Admin Mints pPHP & Marks Disbursed

From the **Admin/System Panel → Pledges tab**, the administrator clicks **"Mint & Disburse"** on a Committed grant. This:

1. Mints the exact pPHP SAC amount to the Funding Agency's wallet (Transaction 1)
2. Marks the grant as **Disbursed** on-chain (Transaction 2)

These are two separate transactions because Freighter only supports one operation per transaction.

### 6. Funding Agency Creates Escrows Per Milestone

From the **Funding Agency Dashboard → Donor Commitments tab**, each Disbursed grant shows a **"Create Escrow"** button. Clicking it opens a form with:

- **Recipient (Contractor)**  -  autocomplete dropdown of all Contractor-role wallet addresses
- **PVO ID**  -  pre-filled from the grant, non-editable
- **Milestone ID**  -  autocomplete showing all milestones under that PVO; selecting one auto-fills the amount
- **Amount**  -  in pPHP SAC units (with peso conversion shown below)
- **Community Confirmations Required**  -  how many verified citizen GPS field reports must confirm this milestone

The funding agency can create **multiple escrows** against a single grant  -  one per milestone. The button stays visible until all funds are escrowed.

### 7. Escrow is Funded

The funding agency deposits the milestone amount into the escrow contract. The escrow status becomes **Funded**.

### 8. Five Gates Verify the Work

Each gate is an independent on-chain verification:

**Gate 1  -  Engineer:** Licensed engineer signs off that physical work meets specifications.

**Gate 2  -  AI Oracle:** AI scans evidence for anomalies  -  duplicate GPS, metadata tampering, suspicious patterns.

**Gate 3  -  Compliance:** Auditor or COA validates procurement law, budget rules, safety regulations.

**Gate 4  -  Community Oracle:** Citizens submit GPS-tagged field reports through the mobile app. The Community Oracle contract verifies report authenticity.

**Gate 5  -  Community Confirmations:** Each verified report increments a counter. When the counter reaches the threshold set at escrow creation, this gate passes. Higher thresholds = stronger anti-corruption for high-risk projects.

### 9. Escrow Releases  -  PVO Goes InProgress

Once all 5 gates pass, anyone can trigger release. The escrow contract:

1. Transfers the pPHP tokens to the contractor
2. Cross-calls `pvo_core.update_pvo_status(InProgress)`  -  auto-transitioning the PVO from Proposed to **InProgress**

The PVO stays InProgress until **all milestones are Released AND the total Released milestone budgets equal or exceed the PVO budget**. Only then can it become **Completed**.

### 10. Repeat for Remaining Milestones

Steps 5-8 repeat for each remaining milestone. After all milestones are released and the budget is fully accounted for, the PVO can be marked **Completed**.

### Status Flow Summary

```
Committed → Disbursed → Escrows Created → Escrows Released → PVO InProgress → All Done → PVO Completed
```

---

## PVO Status Lifecycle

| Status | Meaning | Trigger |
|--------|---------|---------|
| **Proposed** | PVO created, awaiting funding | Agency creates PVO on-chain |
| **InProgress** | At least one milestone escrow released | Escrow cross-calls `update_pvo_status` |
| **Completed** | All milestones Released AND total released ≥ total budget | Explicit call (only succeeds if conditions met) |
| **Suspended** | Under investigation, all escrows paused | Dispute raised |
| **Terminated** | Project permanently cancelled | Admin action |

**Key rule:** A PVO CANNOT be Completed if:
1. Any milestone is still in a pre-Release status, OR
2. The sum of all Released milestone budgets is less than the PVO total budget

---

## Grant Status Explained

| Status | Meaning | Who Acts Next |
|--------|---------|---------------|
| **Committed** | Donor pledged exact PVO budget on-chain. pPHP transferred to funding agency. | Admin: Mint & Disburse |
| **Disbursed** | pPHP minted and sent to funding agency wallet. Funds ready for escrowing. | Funding Agency: Create Escrow |
| **Completed** | All escrows for this PVO released through 5 gates. Grant fully settled. |  -  |
| **Cancelled** | Donor revoked pledge before disbursement. Budget slot freed. |  -  |

---

## Donor Commitments Tab (Funding Agency Dashboard)

The Donor Commitments tab shows all grants with real-time status:

- **Committed**  -  "Donor pledged  -  awaiting admin mint" + Create Escrow button
- **Disbursed**  -  "pPHP minted to funding agency  -  ready for escrow" + Create Escrow button
- **Completed**  -  "All gates passed, payment released" (no button)
- **Cancelled**  -  "Grant revoked before disbursement"

Grants are sorted: Committed first, then Disbursed, then others. A **↻ Refresh** button re-reads the chain.

The summary card shows **Total Donor Pledges** (sum of all grant amounts) in pesos.

---

## Budget Tracking  -  Funded vs Escrowed

Every PVO card (Transparency Portal and Agency Dashboard) shows a visual budget allocation bar:

- **Green bar**  -  amount already locked in escrow
- **Amber bar**  -  amount committed by donors but not yet escrowed
- **Gray background**  -  total PVO budget

The bar lets you see at a glance: "₱50M escrowed, ₱800M committed but still available."

---

## Map Pin Color Legend

| Color | Status |
|-------|--------|
| 🟢 Green | Completed |
| 🟠 Orange | Proposed |
| 🔵 Blue | InProgress / Approved |
| 🔴 Red | Suspended / Terminated |
| ⚪ Gray | Unknown / Under Review |
| 🟣 Purple | GPS Evidence (citizen field reports) |

Pins are custom SVG `divIcon` markers with drop shadows  -  no external image dependencies.

---

## SAC Atomic Units

All on-chain amounts are stored in **SAC atomic units**: pesos × 10,000,000 (10⁷).

| Amount | SAC Units |
|--------|-----------|
| ₱1 | 10,000,000 |
| ₱1,000 | 10,000,000,000 |
| ₱1,000,000 | 10,000,000,000,000 |
| ₱500,000,000 | 5,000,000,000,000,000 |

The frontend divides by `PPHP_SCALE` (10⁷) for display. PVO budgets, donor pledges, escrow amounts, and milestone budgets all use the same scale.

The **Milestone Budget** form accepts input in pesos and shows the SAC unit equivalent below: "= 500,000,000,000,000 SAC units (₱50,000,000)".

---

## Create Escrow Form  -  Autocomplete

The Create Escrow form has intelligent autocomplete on all fields:

- **Recipient (Contractor)**  -  dropdown of all addresses with the Contractor role from `access_control`
- **PVO ID**  -  when opened from a grant row, pre-filled and locked. Manual entry shows search by title or ID
- **Milestone ID**  -  loaded when PVO is selected. Shows milestone title, budget. Selecting a milestone auto-fills the Amount field

---

## RPT Reputation Token Gate

Citizens need RPT tokens (minimum balance: 1) to submit field reports. This is a **real security gate**  -  it prevents Sybil attacks (one person creating thousands of fake wallets).

- RPT is soulbound  -  cannot be transferred between wallets
- Only admin can mint RPT
- Citizens get 100 RPT on initial setup

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PoPV Contract System                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  access_control  │────▶│        pvo_core              │   │
│  │  13 roles        │     │  PVO + Milestones + Budget   │   │
│  └─────────────────┘     │  + Evidence + Status Flow    │   │
│                           └──────────┬──────────────────┘   │
│                                      │                       │
│                    ┌─────────────────┼─────────────────┐   │
│                    ▼                 ▼                   ▼   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   escrow     │  │ community_   │  │  reputation      │  │
│  │  5-gate lock │  │ oracle       │  │  RPT gate + score│  │
│  │  InProgress  │  │ report verify │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ audit_trail  │  │ value_score  │  │   ai_oracle      │  │
│  │ Black Box    │  │ Public Value │  │  Fraud Detection │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │public_index  │  │ compliance_  │  │ procurement_     │  │
│  │Nat'l Rankings│  │ engine       │  │ market           │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  grant_commitment                                     │   │
│  │  Donor pledges (Committed→Disbursed→Completed)        │   │
│  │  Exact-budget enforcement + disbursement tracking     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Testnet)

| Contract | ID | Functions | Tests |
|----------|----|-----------|-------|
| `access_control` | `CCBO...USY3` | 9 | 11 |
| `pvo_core` | `CCFB...4AVR` | 17 | 18 |
| `escrow` | `CBD4...SGLZ` | 14 | 15 |
| `community_oracle` | `CDEV...36ZG` | 8 | 12 |
| `reputation` | `CBBM...ZKX4` | 12 | 19 |
| `audit_trail` | `CADO...662F` | 10 | 12 |
| `value_score` | `CAWB...E76` | 11 | 20 |
| `ai_oracle` | `CDWZ...G7C` | 13 | 17 |
| `public_index` | `CDU6...7LH` | 7 | 7 |
| `compliance_engine` | `CDUL...XXD` | 8 | 8 |
| `procurement_market` | `CDZH...KSM` | 5 | 5 |
| `pPHP SAC` | `CCJR...32X` | 8 | 8 |
| `grant_commitment` | `CASS...PEG` | 7 | 13 |

**33 tests (escrow + pvo_core) × all passing. Frontend: 0 npm vulnerabilities.**

Contract IDs are in `frontend/src/config.ts` and auto-updated by the master-reset script.

---

## Try It Live

**Production build:** `npm run build && npm start` from project root → `http://localhost:5174`

**Live Demo:** [greenarmor.github.io/proof-of-public-value](https://greenarmor.github.io/proof-of-public-value/)

**Quick Start:**
1. **Public pages**  -  Browse projects, national index, map, search  -  no wallet needed
2. **Role-Play**  -  Go to `/onboarding` → pick any role → get a demo wallet → walk through the system
3. **Connect Freighter**  -  Install [Freighter](https://freighter.app), import a demo wallet from `.dev-logs/newrolecreden.md`
4. **15 PVOs per page**  -  Scroll, paginate, or filter by name/department/municipality
5. **Mobile-friendly**  -  Sticky map + sticky search, scrollable card list

### Demo Wallets (Testnet)

> ⚠️ **Testnet only.** Secret keys in `.dev-logs/newrolecreden.md` (gitignored).
> Import in Freighter: Add Account → Import Secret Key or Seed Phrase.

| # | Role | Alias | Public Key |
|---|------|-------|-----------|
| 1 | Administrator | alice | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` |
| 2 | GovernmentAgency | agency | `GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2` |
| 3 | Contractor | contractor | `GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF` |
| 4 | Engineer | engineer | `GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ` |
| 5 | Inspector | inspector | `GAPFYWRZYETAWKY4G7VCAAIZ64PZLMDF4MWRYYTLRU4QTN6RLXSXQNGV` |
| 6 | Auditor | auditor | `GAAL24R63KQJADAOLLMC6PLK7VZW2VCYBDLJYHT6X73NY73W7R4XIAYN` |
| 7 | CommissionOnAudit | coa | `GCDE4KUZV7JC7RGESQYCBKKK2ALB6B7HTALB3KYIACGKNVKTVAMKSFJB` |
| 8 | Supplier | supplier | `GCOWOAKYKW3PNKY6HBVTHRJBXBQ3PT2V4N6KGR3ROMKLMUSVDJVYLGMM` |
| 9 | AntiCorruptionAgency | anti_corruption | `GBU4SHHRZPIHJL3BX6LYQMS5WW4HYXENBHSUHSEFPZQCZQ25ZOQWC6E7` |
| 10 | FundingAgency | funding_agency | `GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO` |
| 11 | InternationalDonor | international_donor | `GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44` |
| 12 | AIAuditor | ai_auditor | `GATLFXDNY2OIRX437GHRWR5CWFV7EQ7ORNYIND7APGNGU3HCNYI45AWW` |
| 13 | Citizen | citizen | `GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES` |

All wallets funded via Friendbot. Roles assigned on-chain via `access_control`. Citizens 1–4 receive 100 RPT tokens each.

---

## Quick Start

```bash
# Build & serve frontend (production)
npm run build && npm start   # → http://localhost:5174

# Build contracts
stellar contract build

# Run all tests
cargo test -p escrow -p pvo_core   # 33 tests

# Full system reset
node .dev-logs/master-reset.js     # ~8 min
```

---

## Roles & Responsibilities

PoPV uses 13 on-chain roles managed by the `access_control` contract. Every action requires the correct role  -  no role can bypass another's gate.

| Role | Dashboard | Core Actions | Purpose |
|------|-----------|-------------|---------|
| **Administrator** | System Panel | Assign roles, mint RPT, mint pPHP, mark grants disbursed | System governance, token issuance |
| **GovernmentAgency** | Agency Dashboard | Create PVOs, define milestones with budgets + evidence types | Project definition, budget planning |
| **FundingAgency** | Funding Agency Dashboard | Create escrows, fund escrows, view donor commitments | Lock funds behind 5-gate verification |
| **InternationalDonor** | Donor Dashboard | Pledge grants (exact-match PVO budget), commit pPHP | Fund projects conditionally |
| **Contractor** | Contractor Portal | View assigned PVOs, submit milestone evidence (drone, GPS, photos, reports) | Prove work completed |
| **Engineer** | Engineer Panel | Approve milestones after physical inspection | Technical quality gate |
| **Auditor** | Auditor Dashboard | Compliance validation, procurement law checks | Regulatory compliance gate |
| **CommissionOnAudit** | COA Dashboard | Final compliance sign-off, audit trail review | Government audit oversight |
| **AIAuditor** | AI Dashboard | Run AI validation on evidence, assign risk scores | Fraud/anomaly detection gate |
| **Citizen** | Citizen Report Form | Submit GPS-tagged field reports, verify others' reports | Community verification gate |
| **Inspector** | Inspector Panel | Verify evidence quality, validate reports | Evidence quality assurance |
| **Supplier** | Procurement Market | Register in pre-qualification registry | Supply chain transparency |
| **AntiCorruptionAgency** | Anti-Corruption Dashboard | Raise disputes, investigate flagged projects, review audit trails | Corruption investigation |

### Role Interactions  -  The 5-Gate Trust Model

No single role can release funds. Each gate is held by a different role:

```
Contractor → submits evidence
Engineer → approves physical work       [Gate 1]
AI Auditor → validates for fraud        [Gate 2]
Auditor/COA → compliance check          [Gate 3]
Citizens → submit GPS field reports     [Gate 4  -  Oracle]
Citizens → reach confirmation threshold [Gate 5  -  Threshold]
→ Funding Agency creates escrow         [Funds locked]
→ Anyone triggers release               [All gates must pass]
```

---

## Exercises

### Exercise 1: Public Transparency Portal (No Wallet Required)

**Goal:** Browse the public-facing project registry.

1. Open `http://localhost:5174`
2. Browse the **Transparency Portal**  -  20 PVOs with budgets, status, value scores
3. Click any PVO to see detail panel: milestones, escrows, gates progress
4. Observe the **funded vs escrowed** bar  -  green = locked in escrow, amber = committed but available
5. View the **Project Map**  -  color-coded pins per status
6. Note PVO #1 is **InProgress** (blue pin)  -  one milestone escrow was released

---

### Exercise 2: Administrator  -  System Governance

**Role:** Administrator  
**Wallet:** alice (`GBDNQE...ACMSV`)  
**Dashboard:** System Panel

| Step | Action | Tab | Notes |
|------|--------|-----|-------|
| 1 | Connect alice wallet |  -  | |
| 2 | Go to System Panel → **Roles** | Roles | See all 13 roles with assigned wallets |
| 3 | Assign a new role | Click "Assign Role" | Enter wallet + select role |
| 4 | Go to **Pledges** | Pledges | See Committed donor grants |
| 5 | Click **"Mint & Disburse"** on a grant |  -  | Sign 2 Freighter popups: mint pPHP + mark disbursed |
| 6 | Go to **Health** | Health | System health dashboard |
| 7 | Go to **Settings** | Settings | Change currency symbol |

**What happens:** The admin mints pPHP into existence and sends it to the Funding Agency wallet. The grant moves from Committed → Disbursed. The Funding Agency can now create escrows.

---

### Exercise 3: Government Agency  -  Create PVO & Milestones

**Role:** GovernmentAgency  
**Wallet:** gov_agency_role (`GDLLO...Y5X2`)  
**Dashboard:** Agency Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect gov_agency_role wallet | |
| 2 | Click **"Create PVO"** | Title, department, municipality, budget (in pesos), contractor address, description |
| 3 | Submit → signed in Freighter | PVO appears in overview table |
| 4 | Click **"Define Milestone"** | Search for PVO by title |
| 5 | Enter milestone title + description | |
| 6 | Enter budget **in pesos** (e.g., 50000000 = ₱50M) | See SAC unit conversion below field |
| 7 | Select **evidence types** | DroneImagery, GpsCoordinates, TimestampedPhoto, EngineeringReport, etc. |
| 8 | Set **Community Confirmations Required** | e.g., 3 citizens must verify |
| 9 | Submit → signed in Freighter | Milestone created on-chain |

**What happens:** The PVO defines what needs to be built. Milestones define how payment is released in phases  -  each phase has its own budget, evidence requirements, and citizen verification threshold.

---

### Exercise 4: International Donor  -  Pledge Funds

**Role:** InternationalDonor  
**Wallet:** international_donor (`GBUI4...EV44`)  
**Dashboard:** Donor Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect international_donor wallet | |
| 2 | Browse PVOs in Donor Dashboard | Each card shows budget, remaining, status |
| 3 | Fully-funded PVOs are **greyed out** | |
| 4 | Click **"Pledge"** on a PVO with remaining budget | Pledge form pre-fills exact remaining amount (read-only) |
| 5 | Enter org name (e.g., "World Bank") | |
| 6 | Submit → signed in Freighter | Grant appears as Committed in Admin Panel |

**What happens:** The donor's pPHP is transferred atomically to the Funding Agency. The pledge must exactly equal the PVO's remaining budget  -  the contract rejects mismatches on-chain. The grant waits for admin to mint and disburse.

---

### Exercise 5: Funding Agency  -  Create & Fund Escrows

**Role:** FundingAgency  
**Wallet:** funding_agency (`GBM5Y...5PBO`)  
**Dashboard:** Funding Agency Dashboard

| Step | Action | Tab | Details |
|------|--------|-----|---------|
| 1 | Connect funding_agency wallet |  -  | |
| 2 | Go to **Donor Commitments** | Commitments | See all grants sorted: Committed first, then Disbursed |
| 3 | Click **↻ Refresh** |  -  | Re-reads from chain |
| 4 | Find a **Disbursed** grant |  -  | Shows pPHP amount + "ready for escrow" |
| 5 | Click **"Create Escrow"** |  -  | Opens modal |
| 6 | Type in **Recipient** field |  -  | Autocomplete shows all Contractor wallet addresses |
| 7 | **PVO ID** is pre-filled (read-only) |  -  | Locked to the grant's PVO |
| 8 | Click **Milestone ID** field |  -  | Autocomplete shows all milestones for this PVO |
| 9 | Select a milestone |  -  | Auto-fills the Amount field with milestone budget |
| 10 | Set **Community Confirmations Required** |  -  | How many citizen GPS reports needed |
| 11 | Submit → signed in Freighter |  -  | Escrow created |
| 12 | Go to **Escrows** tab | Escrows | See the new escrow |
| 13 | Click **"Fund Escrow"** |  -  | Deposits pPHP from your wallet into escrow |
| 14 | Go to **How It Works** tab | Guide | Read full 5-gate explanation |

**What happens:** The Funding Agency locks funds behind verification gates. The escrow is now Funded  -  payment can only be released after all 5 gates pass. Create multiple escrows against the same grant for each milestone. The button stays visible until all funds are escrowed.

---

### Exercise 6: Contractor  -  Submit Evidence

**Role:** Contractor  
**Wallet:** contractor (`GDH34...VDRF`)  
**Dashboard:** Contractor Portal

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect contractor wallet | |
| 2 | View assigned PVOs | Budget, milestones count, status |
| 3 | Submit milestone evidence | Upload drone imagery, GPS coordinates, timestamped photos, engineering reports |
| 4 | Each evidence submission recorded on-chain | Immutable audit trail |

**What happens:** Evidence submission starts the 5-gate verification. Without evidence, no gate can proceed. The contractor proves the work was actually done.

---

### Exercise 7: Engineer  -  Technical Approval

**Role:** Engineer  
**Wallet:** engineer (`GCSAB...72CZ`)  
**Dashboard:** Engineer Panel

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect engineer wallet | |
| 2 | View PVOs with milestones pending approval | |
| 3 | Approve a milestone | Signs off that physical work meets specifications |
| 4 | Escrow gate 1 passes | Engineer Approved ✓ |

**What happens:** Gate 1  -  the licensed engineer's sign-off is the first of five independent verifications required before any peso is released.

---

### Exercise 8: AI Auditor  -  Fraud Detection

**Role:** AIAuditor  
**Wallet:** ai_auditor (`GATLF...AWW`)  
**Dashboard:** AI Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect ai_auditor wallet | |
| 2 | Run AI validation on evidence | Scans for duplicate GPS, metadata tampering, anomalies |
| 3 | AI assigns risk score | Green = low risk, Red = flagged |
| 4 | If passed, escrow gate 2 unlocks | AI Validated ✓ |

**What happens:** Gate 2  -  AI detects fraud patterns humans miss. Same GPS coordinate submitted twice? Metadata shows photo taken before project started? AI catches it.

---

### Exercise 9: Auditor / COA  -  Compliance Check

**Role:** Auditor + CommissionOnAudit  
**Wallets:** auditor (`GAAL2...IAYN`), coa (`GCDE4...FJB`)  
**Dashboards:** Auditor Dashboard, Compliance Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect auditor wallet | |
| 2 | Run compliance validation | Checks procurement law, budget rules, safety regulations |
| 3 | Pass the check | Escrow gate 3 unlocks  -  Compliance Passed ✓ |
| 4 | Connect coa wallet | |
| 5 | Review audit trail | Full history of who approved what and when |
| 6 | Final compliance sign-off | Regulatory oversight complete |

**What happens:** Gate 3  -  legal and regulatory verification. Ensures the project follows procurement laws, not just physical completion.

---

### Exercise 10: Citizen  -  Community Verification

**Role:** Citizen  
**Wallets:** citizen_1 through citizen_4 (see credentials file)  
**Dashboard:** Citizen Report Form

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect citizen_1 wallet | |
| 2 | Check RPT trustline is set up | If not, admin must first mint RPT (Exercise 2) |
| 3 | Click **"Submit Report"** | |
| 4 | Enter GPS coordinates, description, photos | Report links to a PVO and milestone |
| 5 | Submit → signed in Freighter | |
| 6 | Another citizen verifies the report | Verification cross-checks GPS plausibility |
| 7 | Each verified report increments counter | Community Confirmations ++ |
| 8 | When counter ≥ threshold | Community Oracle gate + Community Confirmations gate pass ✓ |
| 9 | Repeat with citizen_2, citizen_3 to reach threshold | |

**What happens:** Gates 4 & 5  -  real citizens visit the site, submit GPS-tagged evidence. The RPT token gate prevents fake accounts. Higher thresholds = stronger anti-corruption for high-risk projects.

---

### Exercise 11: Inspector  -  Evidence Quality

**Role:** Inspector  
**Wallet:** inspector (`GAPFY...NGV`)  
**Dashboard:** Inspector Panel

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect inspector wallet | |
| 2 | Review submitted evidence | Check drone imagery quality, GPS accuracy, report completeness |
| 3 | Validate or flag evidence | |

---

### Exercise 12: Anti-Corruption Agency  -  Disputes

**Role:** AntiCorruptionAgency  
**Wallet:** anti_corruption (`GBU4S...E7`)  
**Dashboard:** Anti-Corruption Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect anti_corruption wallet | |
| 2 | Review flagged projects | |
| 3 | Raise dispute on suspicious escrow | Dispute status → suspends all escrows under that PVO |
| 4 | Review audit trail | Full cryptographic history of who did what |

**What happens:** The dispute mechanism is the emergency brake. Any flagged project pauses all payments until investigation concludes.

---

### Exercise 13: Full End-to-End Walkthrough

**Goal:** Complete the entire lifecycle  -  PVO creation through payment release.

**Roles needed:** GovernmentAgency, Administrator, InternationalDonor, FundingAgency, Contractor, Engineer, AIAuditor, Auditor, 3 Citizens

| # | Role | Action |
|---|------|--------|
| 1 | GovernmentAgency | Create PVO (Exercise 3, steps 1–3) |
| 2 | GovernmentAgency | Define 2 milestones (Exercise 3, steps 4–9) |
| 3 | InternationalDonor | Pledge exact PVO budget (Exercise 4) |
| 4 | Administrator | Mint & Disburse the grant (Exercise 2, step 5) |
| 5 | FundingAgency | Create Escrow for milestone 1 (Exercise 5, steps 5–11) |
| 6 | FundingAgency | Fund the escrow (Exercise 5, step 13) |
| 7 | Contractor | Submit evidence (Exercise 6) |
| 8 | Engineer | Approve milestone (Exercise 7) |
| 9 | AI Auditor | Validate for fraud (Exercise 8) |
| 10 | Auditor | Compliance check (Exercise 9) |
| 11 | 3 Citizens | Submit and verify GPS reports (Exercise 10) |
| 12 | Anyone | Release escrow → PVO goes InProgress |
| 13 | Repeat steps 5–12 for milestone 2 | |
| 14 | Verify PVO is NOT yet Completed | Only ₱100M of ₱500M released |
| 15 | Continue creating escrows until full budget covered | |
| 16 | PVO becomes **Completed** | All milestones Released + total ≥ budget |

**Key verification:** After step 12, the PVO status is **InProgress**  -  NOT Completed. The budget check prevents premature completion. Only when all milestones are released and their budgets fully cover the PVO budget does it transition to Completed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Stellar Testnet (Soroban) |
| Smart Contracts | Soroban SDK v26, Rust `#![no_std]` |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| Mobile | Flutter 3.x (Android/iOS) |
| Wallet | Freighter browser extension |
| Storage | Soroban persistent storage + IPFS for evidence |
| Events | Soroban contract events |
| Token Standard | Stellar Asset Contract (SAC), 7 decimals |
| RPC | `soroban-testnet.stellar.org:443` |

---

## Security Features

- **RPT Gatekeeper**  -  Citizens need reputation tokens to report (anti-Sybil)
- **Exact-amount pledges**  -  Donors cannot over/under-commit; contract panics on mismatch
- **5-gate consensus**  -  No single role can release funds
- **Immutable audit trail**  -  Every decision recorded on Stellar
- **Freighter retry logic**  -  Production builds include retry for Freighter content script race condition
- **Cross-contract validation**  -  Escrow checks PVO integrity, grant commitment checks PVO budget

---

## Production Notes

- **Freighter handshake:** Production bundles execute faster than Freighter's content script injects. PoPV includes retry logic (300ms delay, 10 retries at 500ms) to handle this race condition.
- **React StrictMode:** Double-renders only in dev mode. Production builds (`npm start`) are single-render.
- **Port 5174:** Production serve uses port 5174 to avoid conflicts with other local services.
