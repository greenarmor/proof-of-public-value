# Proof of Public Value (PoPV)

> "Public Money Must Prove Public Value." — No Proof. No Payment.

A Stellar Soroban smart contract system where every government budget allocation becomes a programmable **Public Value Object (PVO)**. Payments are released only after cryptographically verifiable evidence proves measurable public value has been created.

## Architecture

```
National Budget → Budget Allocation → PVO → Milestones → Evidence Collection
→ AI Validation → Compliance Validation → Community Validation
→ Smart Contract Validation → Escrow Release → Payment Settlement → Audit Trail
```

## Contracts

| Contract | WASM | Functions | Tests | Purpose |
|----------|------|-----------|-------|---------|
| `access_control` | 7.8 KB | 9 | 11 | Role-based authorization (14 roles) |
| `pvo_core` | 19.8 KB | 17 | 15 | Public Value Object lifecycle, milestones, evidence |
| `escrow` | 12.1 KB | 14 | 15 | Dynamic milestone-based fund release |
| `community_oracle` | 10.5 KB | 8 | 12 | Citizen verification network |
| `reputation` | 11.3 KB | 12 | 17 | Contractor Integrity Graph |
| `audit_trail` | 10.1 KB | 10 | 12 | Financial Black Box (immutable decisions) |
| `value_score` | 9.5 KB | 11 | 17 | Public Value Score (weighted scoring) |

**Total: 81 exported functions, 99 tests, all passing.**

## Core Modules Implemented

1. **Money DNA** — Full provenance tracking via PVO fund source, department, contractor chain
2. **Proof of Progress** — Milestone-based evidence collection (drone, GPS, IoT, lab results, etc.)
3. **Public Value Score** — Weighted scoring across 10 categories (engineering, budget, safety, etc.)
4. **Contractor Integrity Graph** — Reputation ledger tracking delays, overruns, audit findings
5. **Community Oracle Network** — Citizen reports with confidence scoring and reputation
6. **Dynamic Escrow** — Multi-condition unlock (engineer + AI + compliance + community)
7. **Financial Black Box** — Immutable audit trail with AI recommendations, risk scores, signatures
8. **Autonomous Compliance** — Payment pause on failed compliance checks

## Project Structure

```
stellar/
├── Cargo.toml                         # Workspace
├── .stellar/config.toml               # Testnet config
├── .gitignore
└── contracts/
    ├── access_control/                # Role registry & authorization
    │   └── src/{lib.rs, test.rs}
    ├── pvo_core/                      # PVO + Milestones + Evidence
    │   └── src/{lib.rs, test.rs}
    ├── escrow/                        # Dynamic escrow with condition gates
    │   └── src/{lib.rs, test.rs}
    ├── community_oracle/              # Citizen verification
    │   └── src/{lib.rs, test.rs}
    ├── reputation/                    # Contractor Integrity Graph
    │   └── src/{lib.rs, test.rs}
    ├── audit_trail/                   # Financial Black Box
    │   └── src/{lib.rs, test.rs}
    └── value_score/                   # Public Value Score + Index
        └── src/{lib.rs, test.rs}
```

## Prerequisites

| Tool | Version |
|------|---------|
| Rust | 1.96.1+ |
| Stellar CLI | 27.0.0 |
| wasm32v1-none target | installed |

## Build

```bash
stellar contract build
```

## Test

```bash
cargo test
```

## Deploy to Testnet

```bash
# Deploy access_control
stellar contract deploy \
  --wasm target/wasm32v1-none/release/access_control.wasm \
  --source alice --network testnet

# Deploy pvo_core
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pvo_core.wasm \
  --source alice --network testnet

# Deploy escrow
stellar contract deploy \
  --wasm target/wasm32v1-none/release/escrow.wasm \
  --source alice --network testnet
```

## Testnet Identities

| Alias | Address |
|-------|---------|
| alice | GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV |
| bob   | GBMDONMPUNDQNGCPUOEPDEIQ2DONEG3AELWZEDSS67ZIDWLPSLJFBV5E |

## License

This project implements the **Proof of Public Value** protocol for accountable public spending on the Stellar network.
