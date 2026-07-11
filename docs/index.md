# Proof of Public Value  -  User Manual

> **Category:** DeFi & Ecosystem Composability  -  APAC Stellar Hackathon
> **Serverless dApp** on Stellar Soroban testnet. Stablecoins + payment rails + smart contract enforcement. No backend, no database  -  the blockchain is the infrastructure.

---

## 🏆 Why This Hackathon Project Exists

The **APAC Stellar Hackathon** challenges builders to create financial infrastructure powered by Stellar's payment rails. The **DeFi & Ecosystem Composability** category asks: how can stablecoins and Soroban smart contracts be combined to build real-world financial systems? We believe they should not just move money  -  they should enforce accountability.

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
| Off-chain services | Provenance Indexer (optional, experimental) + AI Oracle  -  standalone TS services |

**13 Soroban smart contracts** execute every business rule on-chain:
- `access_control`  -  14 role-based permissions
- `pvo_core`  -  PVO lifecycle, milestones, evidence, budget validation
- `escrow`  -  5-gate conditional fund lock + InProgress auto-transition
- `grant_commitment`  -  Donor pledges with CentralBank-gated disbursement
- `community_oracle`  -  Citizen report verification
- `reputation`  -  RPT soulbound token gatekeeper (anti-Sybil)
- `ai_oracle`  -  Fraud detection engine
- `compliance_engine`  -  Regulatory validation
- `audit_trail`  -  Immutable decision log
- `value_score`  -  0-100 public value rating
- `public_index`  -  National department rankings
- `procurement_market`  -  Competitive bidding with min-bid enforcement
- `pphp_token`  -  Soroban token with CentralBank-gated mint/redeem (CBDC model)

**Cross-contract calls** enable complex workflows without centralized orchestration:
```
escrow.fund() → pvo_core.update_pvo_status(InProgress)
grant_commitment.commit() → pvo_core.get_pvo_budget() (verify exact match)
procurement_market.submit_bid() → access_control.has_any_role(Contractor, Supplier)
pphp_token.mint() → access_control.has_role(caller, CentralBank)
pphp_token.redeem() → access_control.has_role(caller, CentralBank)
grant_commitment.admin_mark_disbursed() → access_control.has_role(caller, CentralBank)
```

**Result:** Anyone can clone the repo, run `npm run build && npm start`, and have a fully functional government accountability platform. No server provisioning. No database setup. No infrastructure. The Stellar testnet serves as the development and demonstration environment for the live demo at www.popv.quest.

### AI Oracle & Provenance Indexer - Independent Services, Every Frontend

The AI Oracle and Provenance Indexer are the **only off-chain components**. These standalone TypeScript services run independently:

**AI Oracle** (`ai-oracle/service.ts`):

- Polls testnet for EngineerApproved milestones
- Runs local fraud detection (GPS bounding box, metadata scanning, description analysis)
- Submits `ai_validate(passed, risk_score)` on-chain
- **One instance serves all frontend deployments**

**Provenance Indexer** (`provenance-indexer/service.ts`):

> ⚠️ **Optional - Experimental Extension.** The Provenance Chain is not required for core PoPV functionality. All gate verification, fund locking, and release logic runs entirely on Stellar Soroban. The provenance indexer was built as an experiment to explore how we can offload query and indexing work from the blockchain, helping Stellar's performance by handling read-heavy audit requests off-chain.  
>
> **Goal:** Eventually run serverless via scheduled functions or edge workers. Right now it runs on a background server reading from Stellar - a stepping stone toward a fully serverless audit trail.

- Polls Stellar testnet for contract events via SDK `getEvents()`
- Reads contract state (PVOs, milestones, escrows, audit entries) to build full provenance trees
- Builds hierarchical audit chain: **PVO (parent) → Milestone (child) → Gate records (sub-records)**
- Each gate record links to its **Stellar transaction hash** for immutable audit trackback
- Serves a JSON API on `http://127.0.0.1:3111` for the **Provenance Explorer** frontend
- Accessible by: Funding Agency, COA, Auditor, Administrator
- Polls every 30s, currently tracking 3 PVOs, 4 escrows, 19 events, 2/20 gates passed

Deploy anywhere: VPS, Raspberry Pi, cron job, or serverless function. No cloud dependencies. No API keys. No GPU.

```bash
# AI Oracle:
npx tsx ai-oracle/service.ts --once           # Manual run
*/5 * * * * cd /path/to/popv && npx tsx ai-oracle/service.ts --once  # Cron

# Provenance Indexer:
npx tsx provenance-indexer/service.ts         # Continuous (30s poll, serves API on :3111)
npx tsx provenance-indexer/service.ts --once  # Build once, serve for 10s
npx tsx provenance-indexer/service.ts --build # Build only, no server
```

**Provenance API Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Service status, uptime, event count, ledger position |
| `GET /api/provenance` | All PVO provenance trees (PVO → Milestones → Gates) |
| `GET /api/provenance/:pvoId` | Single PVO provenance chain with timeline |
| `GET /api/provenance/:pvoId/timeline` | Chronological event timeline per PVO |
| `GET /api/events` | All captured contract events with tx hashes |
| `GET /api/events/:contractName` | Events filtered by contract |

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
| 2. Compliance | Auditor / COA | Procurement law, budget rules, safety regulations |
| 3. Community Oracle | Citizens | Verified GPS field reports confirm project exists on the ground |
| 4. Community Confirmations | Citizens | Must reach the threshold set at escrow creation  -  multiple independent witnesses |
| 5. AI Risk | AI Oracle | Fraud detection, anomaly scanning, metadata verification  -  runs last for maximum data |

If any gate fails, funds remain locked. No single person can release money.

---

## How It Works  -  Full Lifecycle

### 1. Government Agency Creates a PVO

A Government Agency wallet creates a Public Value Object on-chain from the **Agency Dashboard**. The form takes: title, description, department, municipality, total budget (in pesos), fund source (National Budget or Donor), and a deadline date. The contractor field uses a placeholder address - assigned only after bidding.

Budget input is in **pesos** - the frontend auto-converts to SAC atomic units (pesos x 10,000,000).

The PVO starts as **Proposed**.

### 2. Government Agency Defines Milestones

In the Agency Dashboard, each PVO row has an expandable milestone list. A **"+ Add"** button appears when milestone budgets have not yet covered the total PVO budget. Each milestone has its own title, description, budget (in pesos), required evidence types, and community confirmation threshold. For example:

- **Milestone 1:** Site Preparation  -  ₱50M
- **Milestone 2:** Foundation  -  ₱150M
- **Milestone 3:** Structure  -  ₱200M
- **Milestone 4:** Finishing  -  ₱100M

When the sum of all milestone budgets equals the PVO budget, the **"+ Add"** button is replaced by a **"Tender"** button - meaning the PVO is ready for bidding.

### 3. Procurement Bidding (Procurement Marketplace)

The Government Agency creates a tender from the Agency Dashboard's **"Tender"** button (pre-fills PVO title and budget as read-only). The tender is linked to the PVO with `milestone_id = 0` (all milestones).

**Contractors** visit the **Procurement Marketplace** (`/procurement`) where they see two views:
- **Browse Tenders** - open tenders with a **"Bid"** button. Contractors submit a bid with price, quality score, and timeline days.
- **Award tab** - only visible to GovernmentAgency and Administrator (contractors cannot see it)

**Awarding:** The GovernmentAgency opens the **Award** tab, reviews all bids sorted by final score, and clicks **"Award Tender"**. The contract auto-selects the highest-scoring bid and cross-calls `pvo_core.assign_contractor()`. The winning contractor now appears in the Contractor Portal.

**Scoring formula (max 120):** Price (50) + Quality (30) + Timeline (20) + Integrity from reputation contract (20).

### 4. Funding Path A: National Budget (Direct Fund)

For PVOs with fund source "National Budget", the **CentralBank** uses the **Central Bank Dashboard's "Direct Fund"** tab. This mints CBDC pPHP directly to the Funding Agency wallet - no donor needed. Skip to step 6.

### 5. Funding Path B: International Donor Pledges Exact PVO Budget

Donors (World Bank, JICA, ADB, etc.) commit grants through the Donor Dashboard. The commitment contract enforces **exact-match pledging**: the pledge must equal **PVO budget minus already-committed funds**. This prevents over/under-committing.

The grant status is **Committed**.

### 6. CentralBank Mints pPHP & Marks Disbursed (Donor Path Only)

From the **Central Bank Dashboard**, the CentralBank wallet clicks **"Approve & Mint"** on a Committed grant in the Pledges tab. This:

1. Mints the exact CBDC pPHP amount to the Funding Agency's wallet (Transaction 1)
2. Marks the grant as **Disbursed** on-chain (Transaction 2)

These are two separate transactions because Freighter only supports one operation per transaction.

### 7. Funding Agency Creates Escrows Per Milestone

From the **Funding Agency Dashboard**, the **"Awarded PVOs"** tab shows all PVOs with contractors assigned through bidding. Each PVO is an expandable card showing:

- PVO title, budget, location, contractor address
- Escrow progress (e.g. "1/4 milestones escrowed")

Clicking a PVO expands to reveal its milestones. Each milestone shows title, description, budget in pesos, and an **"Escrow"** button (or "Escrowed" badge if already escrowed). Clicking **"Escrow"** opens the Create Escrow form pre-filled with:

- **Recipient (Contractor)**  -  pre-filled from the awarded bid winner (read-only)
- **PVO ID**  -  pre-filled (read-only)
- **Milestone ID**  -  pre-filled (read-only)
- **Amount**  -  in pesos, pre-filled from milestone budget (editable)
- **Community Confirmations Required**  -  how many verified citizen GPS field reports must confirm this milestone

For **National Budget PVOs**, a blue info box confirms "funded directly by the government, no donor pledges needed." For **Donor-funded PVOs**, a pledge progress bar shows committed vs total budget.

The Funding Agency creates one escrow per milestone.

### 8. Escrow is Funded

The funding agency deposits the milestone amount into the escrow contract. The escrow status becomes **Funded**.

### 9. Five Gates Verify the Work

Each gate is an independent on-chain verification.

**Before the gates - Evidence + Inspector:**
The contractor submits milestone evidence (drone imagery, GPS, photos, engineering reports). The **Inspector** independently reviews this evidence for quality, clarity, and completeness - submitting an `InspectionReport` on-chain. This report strengthens the Engineer's decision at Gate 1.

**Gate 1  -  Engineer:** Licensed engineer signs off that physical work meets specifications. References contractor evidence AND the Inspector's independent quality report.

**Gate 2  -  Compliance:** Auditor or COA validates procurement law, budget rules, safety regulations.

**Gate 3  -  Community Oracle:** Citizens submit GPS-tagged field reports through the mobile app. The Community Oracle contract verifies report authenticity.

**Gate 4  -  Community Confirmations:** Each verified report increments a counter. When the counter reaches the threshold set at escrow creation, this gate passes. Higher thresholds = stronger anti-corruption for high-risk projects.

**Gate 5  -  AI Fraud Detection:** AI scans ALL evidence submitted across all prior gates for anomalies  -  duplicate GPS, metadata tampering, suspicious patterns, description completeness. Runs last so it has maximum data to analyze.

### 10. Escrow Releases  -  PVO Goes InProgress

Once all 5 gates pass, anyone can trigger release. The escrow contract:

1. Transfers the pPHP tokens to the contractor
2. Cross-calls `pvo_core.update_pvo_status(InProgress)`  -  auto-transitioning the PVO from Proposed to **InProgress**

The PVO stays InProgress until **all milestones are Released AND the total Released milestone budgets equal or exceed the PVO budget**. Only then can it become **Completed**.

### 11. Repeat for Remaining Milestones

Steps 7-10 repeat for each remaining milestone. After all milestones are released and the budget is fully accounted for, the PVO can be marked **Completed**.

### Status Flow Summary

**National Budget path:**
```
PVO Created → Milestones Defined → Tender → Bids → Award → CentralBank Direct Fund → Escrows Created → Funded → 5 Gates → Released → PVO InProgress → All Milestones Released → PVO Completed
```

**Donor path:**
```
PVO Created → Milestones Defined → Tender → Bids → Award → Donor Pledges → CentralBank Mints & Disburses → Escrows Created → Funded → 5 Gates → Released → PVO InProgress → All Milestones Released → PVO Completed
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
│  │  14 roles        │     │  PVO + Milestones + Budget   │   │
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
| `access_control` | See config.ts | 9 | 11 |
| `pvo_core` | See config.ts | 18 | 18 |
| `escrow` | See config.ts | 18 | 15 |
| `community_oracle` | See config.ts | 8 | 12 |
| `reputation` | See config.ts | 12 | 19 |
| `audit_trail` | See config.ts | 10 | 12 |
| `value_score` | See config.ts | 11 | 20 |
| `ai_oracle` | See config.ts | 13 | 17 |
| `public_index` | See config.ts | 7 | 7 |
| `compliance_engine` | See config.ts | 8 | 8 |
| `procurement_market` | See config.ts | 9 | 14 |
| `pPHP SAC` | `CCJRB...A32X` | 8 | 8 |
| `grant_commitment` | See config.ts | 8 | 15 |

**74 tests (pvo_core + escrow + procurement_market + grant_commitment + access_control) all passing.**

Contract IDs are in `frontend/src/config.ts` and auto-updated by the lean-reset or partial-deploy scripts.

---

## Try It Live

**Production build:** `npm run build && npm start` from project root → `http://localhost:5174`

**Live Demo:** [greenarmor.github.io/proof-of-public-value](https://greenarmor.github.io/proof-of-public-value/)

**Quick Start:**
1. **Public pages**  -  Browse projects, national index, map, search  -  no wallet needed
2. **Role-Play**  -  Go to `/onboarding` → pick any role → get a demo wallet → walk through the system
3. **Connect Freighter**  -  Install [Freighter](https://freighter.app), import a demo wallet from `.dev-logs/newrolecreden.md`
4. **Provenance**  -  Go to `/provenance` (Funding Agency/COA/Auditor) → full audit trail with tx hash links
5. **15 PVOs per page**  -  Scroll, paginate, or filter by name/department/municipality
6. **Mobile-friendly**  -  Sticky map + sticky search, scrollable card list

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
| 14 | CentralBank | central_bank | `GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO` |

All wallets funded via Friendbot. Roles assigned on-chain via `access_control`. Citizens 1–4 receive 100 RPT tokens each.

---

## Quick Start

```bash
# Build & serve frontend (production)
npm run build && npm start   # → http://localhost:5174

# Start provenance indexer (separate terminal)
npx tsx provenance-indexer/service.ts   # → API on http://127.0.0.1:3111

# Build contracts
stellar contract build

# Run all tests
cargo test -p pvo_core -p escrow -p procurement_market -p grant_commitment -p access_control   # 74 tests

# Full system reset (all 12 contracts)
node .dev-logs/lean-reset.js     # ~8 min

# Partial deploy (only changed contracts, keeps state of others)
node .dev-logs/partial-deploy.js pvo_core escrow procurement_market
```

---

## Roles & Responsibilities

PoPV uses 14 on-chain roles managed by the `access_control` contract. Every action requires the correct role  -  no role can bypass another's gate.

| Role | Dashboard | Core Actions | Purpose |
|------|-----------|-------------|---------|
| **Administrator** | System Panel | Assign roles, system governance | System management, role assignment |
| **CentralBank** | Central Bank Dashboard | Mint CBDC pPHP (national budget + donor pledges), redeem pPHP for contractor cash-out, mark grants disbursed | Monetary authority, CBDC supply control |
| **GovernmentAgency** | Agency Dashboard | Create PVOs, define milestones with budgets + evidence types | Project definition, budget planning |
| **FundingAgency** | Funding Agency Dashboard | Create escrows, fund escrows, view donor commitments, provenance explorer | Lock funds behind 5-gate verification |
| **InternationalDonor** | Donor Dashboard | Pledge grants (exact-match PVO budget), commit pPHP | Fund projects conditionally |
| **Contractor** | Contractor Portal | Browse tenders at `/procurement`, submit bids, view won projects, submit milestone evidence | Prove work completed |
| **Engineer** | Engineer Panel | Approve milestones after physical inspection | Technical quality gate |
| **Auditor** | Auditor Dashboard | Compliance validation, procurement law checks, provenance explorer | Regulatory compliance gate |
| **CommissionOnAudit** | COA Dashboard | Final compliance sign-off, audit trail review, provenance explorer | Government audit oversight |
| **AIAuditor** | AI Dashboard | Run AI validation on evidence, assign risk scores | Fraud/anomaly detection gate |
| **Citizen** | Citizen Report Form | Submit GPS-tagged field reports, verify others' reports | Community verification gate |
| **Inspector** | Inspector Panel | Submit independent InspectionReports, verify drone/GPS/photo quality, flag substandard evidence | Independent evidence quality - strengthens Engineer's Gate 1 decision |

### The Inspector Role - Independent Evidence Verification

The **Inspector** is a unique role: they are part of the verification system but do **not** hold a dedicated escrow gate. Instead, they provide **independent evidence quality assurance** that strengthens the Engineer's decision at Gate 1.

**What the Inspector does:**
- Reviews contractor-submitted evidence (drone imagery, GPS coordinates, timestamped photos, engineering reports)
- Validates evidence quality: image clarity, GPS precision, report completeness
- Submits `InspectionReport` evidence to the `pvo_core` contract - an independent, timestamped, on-chain record
- Flags substandard or suspicious evidence for further investigation

**Why no dedicated gate?**
The Inspector's reports are **advisory** - they inform the Engineer's decision but don't independently lock/unlock funds. This is by design:
- **Engineer (Gate 1)**: has the authority to approve/reject based on physical inspection PLUS Inspector reports
- **Inspector**: provides the evidence baseline the Engineer needs to make an informed decision

If an Inspector flags poor quality drone imagery, the Engineer sees this when reviewing the milestone and can reject with documented cause. If the Inspector's report is positive, the Engineer gains additional confidence to approve.

**Where Inspector fits in the flow:**
```
Step 9:  Contractor submits evidence (drone, GPS, photos, reports)
Step 9b: Inspector reviews and submits InspectionReport        ← independent assessment
Step 10: Engineer reviews contractor evidence + Inspector's report → Approves or Rejects (Gate 1)
```

This creates a **two-layer technical verification**: the Inspector provides the objective evidence assessment, and the Engineer provides the professional judgment. Together they prevent rubber-stamping - the Engineer can't just "approve everything" when there's an independent Inspector report on file showing quality issues.
| **Supplier** | Procurement Market | Register in pre-qualification registry | Supply chain transparency |
| **AntiCorruptionAgency** | Anti-Corruption Dashboard | Raise disputes, investigate flagged projects, review audit trails | Corruption investigation |

### Role Interactions  -  The 5-Gate Trust Model

No single role can release funds. Each gate is held by a different role:

```
GovernmentAgency → creates PVO, defines milestones, opens tender
Contractor → submits bid at /procurement (price, quality, timeline)
GovernmentAgency → awards tender (auto-picks highest score)
FundingAgency → creates escrow per milestone (Awarded PVOs tab)
FundingAgency → funds escrow                           [Funds locked]
Contractor → submits evidence
Inspector → reviews evidence, submits InspectionReport  [Quality check]
Engineer → reviews evidence + Inspector report → approves [Gate 1]
Auditor/COA → compliance check                          [Gate 2]
Citizens → submit GPS field reports                     [Gate 3 - Oracle]
Citizens → reach confirmation threshold                 [Gate 4 - Threshold]
AI Auditor → validates for fraud                        [Gate 5 - Final]
→ Anyone triggers release                               [All gates must pass]
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
| 2 | Go to System Panel -> **Roles** | Roles | See all 14 roles with assigned wallets |
| 3 | Assign a new role | Click "Assign Role" | Enter wallet + select role |
| 4 | Go to **Health** | Health | System health dashboard |
| 5 | Go to **Settings** | Settings | Change currency symbol |

> **Note:** Pledge approval and pPHP minting have moved to the **CentralBank** role (Exercise 2b below). The Administrator manages roles and system config only.

### Exercise 2b: CentralBank  -  Mint CBDC pPHP & Approve Pledges

**Role:** CentralBank  
**Wallet:** central_bank (`GBRDP6...BBBHO`)  
**Dashboard:** Central Bank Dashboard (`/central-bank`)

| Step | Action | Tab | Notes |
|------|--------|-----|-------|
| 1 | Connect central_bank wallet |  -  | |
| 2 | Go to Central Bank Dashboard -> **Direct Fund** | Direct Fund | Mint CBDC pPHP to Funding Agency (national budget) |
| 3 | Go to **Pledges** | Pledges | See Committed donor grants |
| 4 | Click **"Approve & Mint"** on a grant |  -  | Sign 2 Freighter popups: mint pPHP + mark disbursed |
| 5 | Go to **Redeem** | Redeem | Burn pPHP when contractor cashes out |

**What happens:** The CentralBank mints CBDC pPHP into existence and sends it to the Funding Agency wallet. The grant moves from Committed -> Disbursed. The Funding Agency can now create escrows.

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

### Exercise 3b: Procurement Bidding  -  Tender, Bid, Award

**Roles:** GovernmentAgency + Contractor  
**Wallets:** gov_agency_role (`GDLLO...Y5X2`), contractor (`GDH34...VDRF`)  
**Dashboards:** Agency Dashboard + Procurement Marketplace (`/procurement`)

| Step | Role | Action | Details |
|------|------|--------|---------|
| 1 | GovernmentAgency | Open Agency Dashboard, find PVO with all milestones defined | The "+ Add" button is now "Tender" |
| 2 | GovernmentAgency | Click **"Tender"** | Pre-fills PVO title and budget (read-only), set bid deadline |
| 3 | GovernmentAgency | Submit -> signed in Freighter | Tender created as "Open" |
| 4 | Contractor | Go to `/procurement` (Procurement Marketplace) | See open tenders in Browse tab |
| 5 | Contractor | Click **"Bid"** on a tender | Enter price, quality score, timeline days |
| 6 | Contractor | Submit -> signed in Freighter | Bid submitted on-chain |
| 7 | GovernmentAgency | Go to `/procurement`, switch to **Award** tab | See all bids sorted by final score |
| 8 | GovernmentAgency | Click **"Award Tender"** | Contract auto-picks highest bid, assigns contractor |
| 9 | Contractor | Go to Contractor Portal | Won project now appears |

**Scoring formula (max 120):** Price (50) + Quality (30) + Timeline (20) + Integrity from reputation contract (20). The highest score wins automatically.

**What happens:** The contractor is formally assigned through transparent, score-based bidding. No manual selection, no favoritism - the contract formula decides.

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
| 2 | Go to **Awarded PVOs** | Awarded PVOs | Shows PVOs with contractors assigned through bidding |
| 3 | Click a PVO to expand |  -  | Reveals milestones with budgets and Escrow buttons |
| 4 | Click **"Escrow"** on a milestone |  -  | Opens Create Escrow form pre-filled: recipient, PVO ID, milestone ID, amount |
| 5 | Adjust amount or community confirmations if needed |  -  | Amount is in pesos, milestone budget pre-filled |
| 6 | Submit → signed in Freighter |  -  | Escrow created |
| 7 | Go to **Escrows** tab | Escrows | See the new escrow with "Created" status |
| 8 | Click **"Fund Escrow"** |  -  | Deposits pPHP from your wallet into escrow |
| 9 | Repeat for remaining milestones | Awarded PVOs | Escrow button shows "Escrowed" badge after each one |
| 10 | Go to **How It Works** tab | Guide | Read full 5-gate explanation |

**What happens:** The Funding Agency locks funds behind verification gates. Each milestone gets its own escrow with its own 5-gate release conditions. The escrow is now Funded  -  payment can only be released after all 5 gates pass.

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
| 4 | If passed, escrow gate 5 unlocks | AI Validated ✓ |

**What happens:** Gate 5  -  AI detects fraud patterns humans miss. Same GPS coordinate submitted twice? Metadata shows photo taken before project started? AI catches it.

---

### Exercise 9: Auditor / COA  -  Compliance Check

**Role:** Auditor + CommissionOnAudit  
**Wallets:** auditor (`GAAL2...IAYN`), coa (`GCDE4...FJB`)  
**Dashboards:** Auditor Dashboard, Compliance Dashboard

| Step | Action | Details |
|------|--------|---------|
| 1 | Connect auditor wallet | |
| 2 | Run compliance validation | Checks procurement law, budget rules, safety regulations |
| 3 | Pass the check | Escrow gate 2 unlocks  -  Compliance Passed ✓ |
| 4 | Connect coa wallet | |
| 5 | Review audit trail | Full history of who approved what and when |
| 6 | Final compliance sign-off | Regulatory oversight complete |

**What happens:** Gate 2  -  legal and regulatory verification. Ensures the project follows procurement laws, not just physical completion.

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

**What happens:** Gates 3 & 4  -  real citizens visit the site, submit GPS-tagged evidence. The RPT token gate prevents fake accounts. Higher thresholds = stronger anti-corruption for high-risk projects.

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

**Path A: National Budget (simpler, recommended for first walkthrough)**

| # | Role | Action |
|---|------|--------|
| 1 | GovernmentAgency | Create PVO with fund source "National Budget" (Agency Dashboard) |
| 2 | GovernmentAgency | Define 4 milestones covering the full PVO budget (Agency Dashboard, "+ Add" button) |
| 3 | GovernmentAgency | Create Tender when milestones cover full budget ("Tender" button replaces "+ Add") |
| 4 | Contractor | Browse tenders at `/procurement`, submit a bid (price, quality, timeline) |
| 5 | GovernmentAgency | Award tender from the Award tab (auto-picks highest bid, assigns contractor) |
| 6 | CentralBank | Direct Fund: mint CBDC pPHP to Funding Agency (Central Bank Dashboard, "Direct Fund" tab) |
| 7 | FundingAgency | Go to "Awarded PVOs" tab, expand the PVO, click "Escrow" on milestone 1 |
| 8 | FundingAgency | Fund the escrow (Escrows tab, "Fund Escrow" button) |
| 9 | Contractor | Submit evidence for milestone 1 |
| 10 | Inspector | Review evidence quality, submit InspectionReport |
| 11 | Engineer | Approve milestone 1 (Gate 1) |
| 12 | Auditor | Compliance check (Gate 2) |
| 13 | 3 Citizens | Submit and verify GPS reports (Gates 3 & 4) |
| 14 | AI Auditor | Run AI fraud check (Gate 5 - final gate) |
| 15 | Anyone | Release escrow -> PVO goes InProgress |
| 16 | Repeat steps 7-15 | For each remaining milestone |
| 14 | Anyone | Release escrow -> PVO goes InProgress |
| 15 | Repeat steps 7-14 | For each remaining milestone |
| 16 | PVO becomes **Completed** | All milestones Released + total >= budget |

**Path B: Donor-funded (includes international donor pledge flow)**

| # | Role | Action |
|---|------|--------|
| 1-5 | Same as Path A | Create PVO, milestones, tender, bid, award |
| 6 | InternationalDonor | Pledge exact PVO budget (Donor Dashboard) |
| 7 | CentralBank | Approve & Mint the grant (Central Bank Dashboard, "Pledges" tab) |
| 8-16 | Same as Path A steps 7-16 | Create escrows, fund, pass 5 gates, release, repeat |

**Key verification:** After step 14, the PVO status is **InProgress**  -  NOT Completed. The budget check prevents premature completion. Only when all milestones are released and their budgets fully cover the PVO budget does it transition to Completed.

---

### Exercise 14: Provenance Explorer  -  Complete Audit Trail with TX Hashes

**Roles:** FundingAgency, CommissionOnAudit, Auditor, Administrator  
**Dashboards:** Provenance Explorer (`/provenance`)  
**Prerequisite:** Start the provenance indexer: `npx tsx provenance-indexer/service.ts`

| Step | Action | Details |
|------|--------|---------|
| 1 | Start the provenance indexer | `npx tsx provenance-indexer/service.ts`  -  runs on port 3111, polls every 30s |
| 2 | Connect a FundingAgency, COA, Auditor, or Administrator wallet | Role-gated: only these roles can access |
| 3 | Navigate to **/provenance** | Nav item under "Oversight & Audit" group |
| 4 | View **Summary Stats** bar | Total PVOs, total escrowed/released, gates passed/pending, events indexed, tx-linked count |
| 5 | Expand a **PVO card** | See per-milestone escrow breakdown, stats (escrowed/released/evidence/value score) |
| 6 | Switch to **Milestones & Gates** tab | Expand individual milestone  →  see all 5 gates with status, actor, timestamp |
| 7 | Click a **🔗 tx hash link** | Opens Stellar Expert testnet explorer showing the on-chain transaction proof |
| 8 | Switch to **Full Timeline** tab | Chronological list: PVO created, milestones, evidence, escrows, gate transitions |
| 9 | Use **Search** and **Status Filter** | Filter PVOs by title, department, municipality, contractor, or status |
| 10 | Check **Service Status** indicator | Green dot = indexer active, red = start the service |
| 11 | Click **↻ Refresh** to pull latest data | Live refresh from the provenance API |

**Provenance tree structure:**

```
PVO (parent)
├── Milestone 1 (child)
│   ├── Escrow #1  -  ₱50M (CompliancePassed)
│   ├── Gate 1: Engineer Approval      ✅ passed  tx=f64a0a72...  🔗 View on Stellar Expert
│   ├── Gate 2: Compliance Check       ✅ passed  tx=8d38e2b0...  🔗 View on Stellar Expert
│   ├── Gate 3: Community Oracle       ⬜ pending
│   ├── Gate 4: Community Confirm      ⬜ pending
│   └── Gate 5: AI Risk Check          ⬜ pending
├── Milestone 2 (child)
│   └── Escrow #2  -  ₱50M (Created)
│       └── ... 5 gates (all pending)
└── Timeline
    ├── PVO created                    tx=3d54e07b...  🔗
    ├── Milestone #4 created           tx=fe9bb155...  🔗
    ├── Contractor assigned            tx=bab8c00d...  🔗
    ├── Escrow #1 created              tx=f8ceb49e...  🔗
    └── Escrow #1 → EngineerApproved   tx=f64a0a72...  🔗
```

**What happens:** Every decision in the system is recorded on-chain with a Stellar transaction hash. The Provenance Indexer builds the complete audit trail independently  -  no backend, no database, just Stellar events and contract state. COA auditors, funding agencies, and administrators can trace every peso from budget allocation through all 5 gates to final release, with immutable tx hash proof.

**If the service is offline:** A yellow warning box shows the exact command to start it. The Provenance Explorer respects the "no backend, no database" philosophy  -  the indexer just reads from the blockchain, which is always available.

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
| Off-Chain Services | AI Oracle (`ai-oracle/service.ts`), Provenance Indexer (`provenance-indexer/service.ts`) |
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
