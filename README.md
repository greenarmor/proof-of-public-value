# Proof of Public Value (PoPV)

> **"No Proof. No Payment."** — Public money must prove measurable value before it's released.

PoPV is a serverless blockchain application on **Stellar Soroban** that makes government spending accountable. Every budget allocation becomes a programmable **Public Value Object (PVO)** with 5-gate conditional payments: engineer approval, compliance check, community verification, community confirmations, and AI fraud detection — with every decision linked to an immutable Stellar transaction hash.

---

## Architecture

```
PVO → Milestones → Tender → Bids → Award → Escrow → Fund →
  Gate 1: Engineer → Gate 2: Compliance → Gate 3: Community Oracle →
  Gate 4: Community Confirmations → Gate 5: AI Fraud Detection →
  Release → Provenance Audit Trail (tx hash linked)
```

---

## Deployed Contracts (Testnet)



**Total: 176 tests, 127 functions, ~145 KB WASM**

---

## pPHP Token (Settlement Asset)

pPHP (Philippine Peso Testnet) is a custom Soroban token implementing `TokenInterface`. It powers the escrow system's real token transfers on testnet.

| Field | Value |
|-------|-------|
| Asset Code | `pPHP` |

| Decimals | 2 (100 centavos = ₱1.00) |
| Supply | Unlimited (admin-gated mint) |
| Purpose | Escrow settlement token — fund, release, refund |
| Minting | Admin-only via CLI |

### Why pPHP Exists

Stellar testnet's Friendbot caps at **10,000 XLM per account**. PoPV escrows simulate government projects ranging from millions to billions of pesos:

```
Road Paving Project:  ₱15,000,000  = 15,000,000 XLM  →  Friendbot × 1,500 requests
Bridge Construction:  ₱500,000,000 = 500,000,000 XLM →  Friendbot × 50,000 requests
National Budget:      ₱5,000,000,000 = 5B XLM         →  Impossible
```

pPHP solves this: unlimited mintable supply with 2 decimal places (100 centavos = ₱1). Zero value, zero backing — pure simulation. It exists to test the escrow lock/unlock logic at realistic peso amounts without burning through XLM faucets.

### How It Works

The escrow contract is asset-agnostic — it accepts a `token_address` parameter. On testnet, that address is pPHP. On mainnet, it becomes USDC, GovPHP, EURC, or any backed asset.

```
Funder mints pPHP → funds escrow → tokens locked in escrow vault
    ↓
All 5 gates pass → escrow transfers pPHP to contractor
    ↓
Contractor holds real pPHP on-chain
```

### Testnet vs Mainnet

| Environment | Token | Backing | Why |
|-------------|-------|---------|-----|
| Testnet | **pPHP** | Nothing (simulation) | Unlimited mint — bypass Friendbot 10K XLM limit |
| Mainnet | USDC | Circle USD reserves | Stablecoin, 1:1 USD backing |
| Mainnet | XLM | Stellar network value | Native asset, liquid |
| Mainnet | GovPHP | Peso deposits at custodian bank | If government issues a PHP-backed token |
| Mainnet | EURC | Circle EUR reserves | For EU-funded projects |

The same escrow Rust binary runs unchanged on both networks. Only the `token_address` parameter changes.

### RPT Token (Citizen Reporting Credential)

| Field | Value |
|-------|-------|
| Asset Code | `RPT` |
| Issuer | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` (alice) |
| Contract | `CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ` |
| Purpose | Citizens must hold RPT to submit community reports |
| Minting | Admin-only via Admin Panel |

---

## Testnet Demo Wallets (Public Keys Only)

> ⚠️ **Testnet only — never use these on mainnet.**
> Secret keys are stored in `.dev-logs/role-credentials.md` (gitignored — never committed).
> To import in Freighter: Add Account → Import Secret Key or Seed Phrase.



All wallets are funded via Friendbot and assigned their roles on-chain via `access_control.assign_role`.
CLI aliases (`alice`, `agency`, `contractor`, etc.) are registered in the Stellar CLI for `--source` invocation.

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
| 9 | AntiCorruptionAgency | `/anticorruption` | Anti-Corruption Dashboard |
| 10 | FundingAgency | `/funder` | Funding Agency Dashboard (Escrow) |
| 11 | InternationalDonor | `/donor` | International Donor Dashboard |
| 12 | AIAuditor | `/ai` | AI Monitor |
| 13 | Citizen | `/citizen` | Citizen Interface |
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

**Live version:** [www.popv.quest](https://www.popv.quest) — no setup needed. Just connect Freighter.

### Path A: Frontend Only (reuse existing testnet contracts)

No Rust, no contracts, no Stellar CLI. Just the UI.

```bash
git clone https://github.com/greenarmor/proof-of-public-value.git
cd proof-of-public-value
npm install --include=dev
cd frontend && npm install --include=dev && cd ..
npm run dev   # -> http://localhost:5174
```

➡️ **[Full Local Deploy Guide](docs/local-frontend-runbook.md)** — Node.js setup, Freighter wallet import, 15-step role-play walkthrough, troubleshooting.

### Path B: Full System (deploy your own contracts)

Requires Rust, Stellar CLI, and Soroban SDK. Deploys 12 contracts under your control.

```bash
node .dev-logs/lean-reset.js   # deploys all contracts, assigns roles, mints tokens
npm run dev                    # -> http://localhost:5174
```

**Partial deploy** (only redeploy changed contracts, keeps state of others):
```bash
node .dev-logs/partial-deploy.js pvo_core escrow procurement_market
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
│   ├── access_control/    # 13-role authorization
│   ├── pvo_core/          # PVO lifecycle + milestones + evidence
│   ├── escrow/            # Dynamic conditional escrow
│   ├── community_oracle/  # Citizen verification network
│   ├── reputation/        # Contractor Integrity Graph
│   ├── audit_trail/       # Immutable decision log
│   ├── value_score/       # Public value measurement
│   ├── ai_oracle/         # AI fraud/risk/image analysis
│   ├── public_index/      # National department rankings
│   ├── compliance_engine/ # Auto-pause on violations
│   ├── procurement_market/# Integrity-weighted bidding
│   └── grant_commitment/ # Donor pledge recording
├── frontend/              # React + TypeScript (18 dashboards, 13 role-based + 3 public + admin + 2 finance)
├── mobile/                # Flutter (11 screens)
├── services/event-indexer/# Stellar event monitoring
├── scripts/deploy.sh      # Deployment automation
└── docs/                  # MkDocs user manual
```

## License

This project implements the **Proof of Public Value** protocol for accountable public spending on the Stellar network.
