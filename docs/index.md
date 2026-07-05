# Proof of Public Value - Hackathon User Manual

> **Track:** Local Finance & Real World Access - Stellar Build Better Hackathon

---

## The Problem

Every year, governments lose **$2.6 trillion to corruption** - ghost projects that exist only on paper, inflated budgets, substandard infrastructure, and untraceable fund flows.

The root cause: **public money is released based on signatures and paperwork, not on proof that value was actually created.** Funds flow to contractors before a brick is laid. Evidence is paper-based and easily tampered with. Auditors arrive years after money is spent.

**The Philippines is a primary case study.** From the ₱10 billion PDAF pork barrel scam to billions in DPWH ghost infrastructure projects, the pattern is always the same: funds released upfront, projects never verified on the ground, and no one held accountable until years later.

➡️ **Read: [Why PoPV idea Exists - The Philippine Corruption Crisis](philippines-corruption.md)**

## What PoPV Solves

Proof of Public Value enforces one rule: **No Proof. No Payment.**

Every public project becomes a **Public Value Object (PVO)** - a programmable digital entity on the Stellar blockchain. Funds are locked in a dynamic escrow smart contract and released **only after passing 5 independent verification gates:**

| Gate | Who Verifies | What They Check |
|------|-------------|-----------------|
| 1. Evidence | Contractor | Drone imagery, GPS, photos, engineering reports |
| 2. Engineer | Licensed Professional | Physical work meets specifications |
| 3. AI Risk | Artificial Intelligence | Fraud detection, anomaly scanning |
| 4. Compliance | Auditor / COA | Procurement law, budget rules, safety |
| 5. Community | Citizens | GPS-tagged photos, flood reports, quality checks |

If **any gate fails**, funds remain locked. No single person can release money - it requires cryptographic consensus.

---

## Stellar Integration (DeFi Escrow)

PoPV is **serverless** - there is no backend, no database, no centralized server. **The Stellar blockchain is the infrastructure.**

### Dynamic DeFi Escrow

Every milestone has an independent escrow contract on Stellar. Funds are deposited and locked with multi-condition unlock rules:

```rust
// Funds release only when all 5 conditions are met
if !engineer_approved { return false; }
if !ai_validated { return false; }
if !compliance_passed { return false; }
if community_confirmations < required { return false; }
if !evidence_submitted { return false; }
// Release payment via Stellar rails
escrow.release(funds, recipient);
```

### Settlement Token: Testnet vs Mainnet

The escrow uses a `token_address` parameter to specify which token to lock and release. This makes the escrow **asset-agnostic**.

**On testnet**, PoPV uses **pPHP** (Philippine Peso Testnet), a custom Soroban token with unlimited mintable supply. It has no real-world value, no peg, and no liquidity. It exists purely to test the escrow lock/unlock logic with realistic peso amounts (millions) that would be impossible with Friendbot's 10K XLM limit.

**On mainnet**, pPHP is replaced by a real backed asset. The same escrow code runs unchanged. Only the `token_address` parameter switches:

| Environment | Token | Backing | Value |
|-------------|-------|---------|-------|
| Testnet | pPHP | Nothing (simulation) | 0 |
| Mainnet | USDC | Circle USD reserves | 1 USD |
| Mainnet | GovPHP | Peso deposits at custodian bank | 1 peso |
| Mainnet | EURC | Circle EUR reserves | 1 EUR |

The escrow is a **lockbox**, not a currency. Its job is to hold tokens until 5 gates pass, then release them. The token contract provides the value. On testnet we use a worthless token to prove the lockbox works. On mainnet we plug in a real one.

??? info "Want the full details?"
    See **[Appendix B: pPHP Token & Escrow Settlement](pphp-token.md)** for mint/balance CLI exercises, the full escrow lifecycle with real token transfers, and the complete testnet-vs-mainnet value model explanation.

### International Donor Commitments

International donors (World Bank, JICA, USAID, etc.) follow a **commit then disburse** model, just like in real development finance:

1. **Commit & Transfer** - The donor records a pledge on-chain via the `grant_commitment` contract. This records the organization name, PVO ID, amount, and donor address, **and atomically transfers pPHP from the donor to the Funding Agency** in a single transaction. No separate mint-and-send step needed.

2. **Disburse** - When the funding agency is ready, they create an escrow for the PVO and fund it with real tokens. The donor marks the commitment as "Disbursed."

3. **Complete** - After the escrow releases funds through all 5 gates, the donor marks the commitment as "Completed."

The funding agency dashboard has a **Donor Commitments** tab that shows all pledges. This lets the agency see which donors have committed to which projects before creating escrows.

### On-Chain Audit Trail

Every decision is immutably recorded on Stellar:

- **Who** approved (cryptographic address)
- **What** they approved (milestone ID, evidence hash)
- **When** (blockchain timestamp)
- **Why** (rationale, supporting IPFS documents)
- **Risk score** and compliance result

### Soroban Events

All 11 contracts emit typed Stellar events for real-time indexing. Every state change - from PVO creation to payment release - is publicly auditable.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PoPV Contract System                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  access_control  │────▶│        pvo_core              │   │
│  │  13 roles        │     │  PVO + Milestones + Evidence │   │
│  └─────────────────┘     └──────────┬──────────────────┘   │
│                                      │                       │
│                    ┌─────────────────┼─────────────────┐   │
│                    │                 │                   │   │
│                    ▼                 ▼                   ▼   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   escrow     │  │ community_   │  │  reputation      │  │
│  │  DeFi locks  │  │ oracle       │  │  Integrity Graph │  │
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
│  │  International donor pledges (Committed -> Disbursed) │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Testnet)

| Contract | ID | Functions | Tests |
|----------|----|-----------|-------|
| `access_control` | `CCJK...BCMVP` | 9 | 11 |
| `pvo_core` | `CAJH...MVNOD` | 17 | 18 |
| `escrow` | `CAD7...XQM6` | 14 | 15 |
| `community_oracle` | `CDTZ...K7RS` | 8 | 12 |
| `reputation` | `CACW...4ADN` | 12 | 19 |
| `audit_trail` | `CA2O...BROZ` | 10 | 12 |
| `value_score` | `CCTC...3YN` | 11 | 20 |
| `ai_oracle` | `CDR5...ID43` | 13 | 17 |
| `public_index` | `CCN7...JG7J` | 7 | 7 |
| `compliance_engine` | `CCRS...GRTD` | 8 | 8 |
| `procurement_market` | `CB4Q...TUDQ` | 5 | 5 |
| `pPHP token` | `CA6U...FLE6` | 8 | 8 |
| `grant_commitment` | `CDTJ...FFWRK` | 7 | 13 |

**183 tests, all passing. 0 npm vulnerabilities.**

---

## Try It Live

**Frontend:** `http://localhost:5174` (run `npm run dev` in `frontend/`)

1. **Public pages** - Browse projects, national index, search - no wallet needed
2. **Connect Freighter** - Click "Connect Wallet" (install [Freighter](https://freighter.app) first)
3. **Citizen** - Connect citizen wallet → click "Create RPT Trustline" → submit GPS report
4. **Admin** - Connect alice wallet → assign roles → mint RPT → manage system

### Demo Wallets (Testnet)

> ⚠️ **Testnet only.** Secret keys are in `.dev-logs/role-credentials.md` (gitignored).
> To import in Freighter: Add Account → Import Secret Key or Seed Phrase.

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

All wallets are funded via Friendbot and assigned their roles on-chain.

---

## Quick Start

```bash
# Run frontend
cd frontend && npm install && npm run dev

# Build contracts
stellar contract build

# Run all tests
cargo test

# Deploy all contracts
./scripts/deploy.sh

# Run e2e
cd frontend && npx tsx e2e-test.ts
```

---

## Exercises

### Exercise 1: Explore Without Login

1. Open the Public Transparency Portal
2. Browse available projects - see budgets, status, value scores
3. View the National Index with department rankings
4. Use the Economic Memory search

### Exercise 2: Citizen Verification

1. Connect the citizen wallet in Freighter
2. Go to Citizen Interface → check RPT status
3. Click "Create RPT Trustline" → sign in Freighter
4. Admin mints RPT tokens to you via Admin Panel
5. Submit a GPS-tagged photo or video report
6. Another citizen/verifier verifies your report
7. Check your reputation score

### Exercise 3: Full Payment Flow

1. Create a PVO (Agency Dashboard)
2. Define a milestone with evidence requirements
3. Fund the escrow
4. Contractor submits evidence (drone imagery, GPS)
5. Engineer approves → AI validates → Compliance checks → Citizens verify
6. Release milestone payment
7. Verify audit trail entry is recorded

### Exercise 4: Admin Operations

1. Assign roles to wallet addresses
2. Mint RPT tokens to citizen wallets
3. Check system health monitor
4. Change currency symbol setting

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Stellar Testnet |
| Smart Contracts | Soroban SDK v26, Rust (#![no_std]) |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| Mobile | Flutter 3.x (Android/iOS) |
| DeFi | Dynamic escrow, conditional payments, auto-pause |
| Identity | Stellar key pairs + Freighter wallet |
| Storage | Soroban persistent storage + IPFS for evidence |
| Events | Soroban contract events with event indexer |
| RPC | `soroban-testnet.stellar.org:443` |
