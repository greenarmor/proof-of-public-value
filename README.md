# Proof of Public Value (PoPV)

> **"No Proof. No Payment."** — Public money must prove measurable value before it's released.

PoPV is a serverless blockchain application on **Stellar Soroban** that makes government spending accountable. Every budget allocation becomes a programmable **Public Value Object (PVO)** with 5-gate conditional payments — engineer approval, AI validation, compliance check, community verification, and evidence immutability.

---

## Architecture

```
National Budget → PVO → Milestones → Evidence Collection
→ Engineer Approval → AI Validation → Compliance Check → Community Verification
→ Escrow Release → Payment Settlement → Permanent Audit Trail
```

---

## Deployed Contracts (Testnet)

| Contract | Testnet ID | WASM | Functions | Tests |
|----------|-----------|------|-----------|-------|
| `access_control` | `CCJKHTUZEDT4E5W2VIW2KSOPKMA5Z6K4QUMYSTQOBFTUSLBSM3OBCMVP` | 7.9 KB | 9 | 11 |
| `pvo_core` | `CAJHYJL5E6IPHMYMCODTI5PBLK4TNN2YCT34KAUBIFIL4SJSQW5MVNOD` | 19.9 KB | 17 | 18 |
| `escrow` | `CDTH4UPAZW6CZXONDGRFBSIYRLFWJX4XSQ5YKOCYP7BL24CACQTEDZT3` | 13.2 KB | 14 | 15 |
| `community_oracle` | `CDTZOXPFVGN7SFRMANOJ4C3KN6PHJARPMDLN7ZTLLXJAWUCU4YPGK7RS` | 11.2 KB | 8 | 12 |
| `reputation` | `CACWGE2KH37SNHJOMXRMGAXYGWDT7HX7XDF7O5PE36DTDJO2C4OJ4ADN` | 12.2 KB | 12 | 19 |
| `audit_trail` | `CA2O7WXT6PQJLE4HW5KFDMWI4AJWSPDDO7K2OM756HMMF2E7RJDPBROZ` | 10.1 KB | 10 | 12 |
| `value_score` | `CCTC3HR4RIKQQWMPUU5XQ3BLNWUPCTLPDANHTWVWQZYWVVSCPXXSE3YN` | 9.6 KB | 11 | 20 |
| `ai_oracle` | `CDR5OICDQYT33V7XPPD63YAUDMKRTWSKN7MD5VPS5K773PVU5AAMID43` | 16.5 KB | 13 | 17 |
| `public_index` | `CCN74K6E6NKEXMT2U5Y3JQ5RYCDP2MYBV3OJG4PSUH2WUNFRXHNSJG7J` | 9.1 KB | 7 | 7 |
| `compliance_engine` | `CCRSE76TWXO6TPEWMBKT2577AVYPKKNF5LSWUGUFXKA5XQGPFFZMGRTD` | 7.6 KB | 8 | 8 |
| `procurement_market` | `CCPQYSIVVFOH6CAB5J3QMBZF6EOHJEIVQMZAPMFZCSWRMJRRUMWBJBW3` | 10.8 KB | 5 | 5 |

**Total: 154 tests, 114 functions, ~131 KB WASM**

---

## RPT Token (Citizen Reporting Credential)

| Field | Value |
|-------|-------|
| Asset Code | `RPT` |
| Issuer | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` (alice) |
| Contract | `CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ` |
| Purpose | Citizens must hold RPT to submit community reports |
| Minting | Admin-only via Admin Panel |

---

## Testnet Addresses (Public Keys Only)

| Role | Alias | Address |
|------|-------|---------|
| Administrator | alice | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` |
| GovernmentAgency | agency | `GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN` |
| Contractor | contractor | `GAZENYNRLICJYECZ66IGSOHH2N246P3CGZMI2DJ2G3RFK6A5WF42LPRW` |
| Engineer | engineer | `GB7JLZ33J643CIAKC3APGMTVD2MAYNFI3C4EDDOOYVHOKTWVMDHJ42MN` |
| Auditor | auditor | `GC3E277DKK7C7AIQ5G4G632RRPSWJBX33DB4OB54SS3XEKUY6EW5Z5F7` |
| CommissionOnAudit | coa | `GAXUYK7RP3TWWOOBRDQJ7FBVG5C7ZF2PUQ3AAT2JA2U2QEMI5MUGO4OK` |
| AIAuditor | ai_auditor | `GAKJTLALTPWV4DLQGUCBMSO36EL3YIXK6X774D27Q3HBIR4GPDX2BL5J` |
| Citizen | citizen | `GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES` |
| Test | bob | `GBMDONMPUNDQNGCPUOEPDEIQ2DONEG3AELWZEDSS67ZIDWLPSLJFBV5E` |

> ⚠️ **Secret keys are stored in `.dev-logs/` which is gitignored — never committed.**

---

## Dashboard Access Control

| # | Role | Route | Dashboard |
|---|------|-------|----------|
| 1 | Administrator | `/admin` | All dashboards (full access) |
| 2 | GovernmentAgency | `/agency`, `/procurement` | Agency Dashboard, Procurement Marketplace |
| 3 | Contractor | `/contractor` | Contractor Portal |
| 4 | Engineer | `/engineer` | Engineer Panel |
| 5 | Inspector | `/inspector` | Inspector Panel |
| 6 | Auditor | `/auditor`, `/compliance` | Auditor Dashboard, Compliance Dashboard |
| 7 | CommissionOnAudit | `/auditor`, `/compliance` | Auditor Dashboard, Compliance Dashboard |
| 8 | Supplier | `/supplier` | Supplier Portal |
| 9 | ProjectManager | `/pm` | Project Manager Dashboard |
| 10 | AntiCorruptionAgency | `/anticorruption` | Anti-Corruption Dashboard |
| 11 | FundingAgency | `/funder` | Funding Agency Dashboard (Escrow) |
| 12 | InternationalDonor | `/donor` | International Donor Dashboard |
| 13 | AIAuditor | `/ai` | AI Monitor |
| 14 | Citizen | `/citizen` | Citizen Interface |
| — | No role | `/`, `/index`, `/memory` | Public pages only |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Stellar Testnet |
| Smart Contracts | Soroban SDK v26, Rust |
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 |
| Wallet | Freighter browser extension |
| Mobile | Flutter 3.x (Android/iOS) |
| SDK | `@stellar/stellar-sdk` v16 |
| File Storage | IPFS (Pinata) |
| RPC | `soroban-testnet.stellar.org` |

---

## Quick Start

```bash
# Install frontend
cd frontend && npm install

# Run dev server
npm run dev

# Run e2e tests
npx tsx e2e-test.ts

# Build contracts
stellar contract build

# Deploy all
./scripts/deploy.sh

# Run all tests
cargo test
```

---

## Features

- **5-Gate Payment Release** — Funds unlock only after engineer, AI, compliance, community, and evidence verification
- **AI Fraud Detection** — 8 indicator types (ghost projects, duplicate invoices, collusion, etc.)
- **Citizen Verification** — GPS-tagged photo reports via IPFS with RPT token staking
- **Immutable Audit Trail** — Every decision permanently recorded on-chain
- **Public Value Index** — Department rankings measuring value per peso spent
- **Procurement Marketplace** — Integrity-weighted bidding with reputation scoring
- **Autonomous Compliance** — Auto-pause funds on regulatory violations
- **Serverless** — No backend, no database — blockchain is the infrastructure

---

## Project Structure

```
stellar/
├── contracts/
│   ├── access_control/    # 14-role authorization
│   ├── pvo_core/          # PVO lifecycle + milestones + evidence
│   ├── escrow/            # Dynamic conditional escrow
│   ├── community_oracle/  # Citizen verification network
│   ├── reputation/        # Contractor Integrity Graph
│   ├── audit_trail/       # Immutable decision log
│   ├── value_score/       # Public value measurement
│   ├── ai_oracle/         # AI fraud/risk/image analysis
│   ├── public_index/      # National department rankings
│   ├── compliance_engine/ # Auto-pause on violations
│   └── procurement_market/# Integrity-weighted bidding
├── frontend/              # React + TypeScript (19 dashboards, 14 role-based + 3 public)
├── mobile/                # Flutter (11 screens)
├── services/event-indexer/# Stellar event monitoring
├── scripts/deploy.sh      # Deployment automation
└── docs/                  # MkDocs user manual
```

## License

This project implements the **Proof of Public Value** protocol for accountable public spending on the Stellar network.
