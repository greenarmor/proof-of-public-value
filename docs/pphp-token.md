# Appendix B: pPHP Token — CBDC Model with CentralBank

How PoPV uses a CentralBank-gated Soroban token to simulate CBDC settlement, with mint and redeem controlled by a dedicated central bank role - not the Administrator.

---

## What You'll Learn

- Why pPHP is now a Soroban token (not SAC)
- How the CentralBank role controls monetary supply
- The full CBDC lifecycle: mint → escrow → redeem
- How donor pledges are disbursed by CentralBank
- How this maps to real-world CBDC models

---

## The CentralBank Model

pPHP implements a **two-tier CBDC model**:

| Tier | Actor | Function |
|------|-------|----------|
| **Issuance** | CentralBank | Mints and burns pPHP via `has_role(CentralBank)` |
| **Distribution** | FundingAgency | Receives minted pPHP, funds escrows |
| **Settlement** | Escrow Contract | Holds pPHP until 5 gates pass |
| **Redemption** | CentralBank | Burns pPHP when contractor cashes out |

**Key separation:** The Administrator manages the system (roles, config) but CANNOT mint or redeem pPHP. Only the CentralBank wallet can.

---

## Token Details

| Field | Value |
|-------|-------|
| Name | Philippine Peso Testnet |
| Symbol | `pPHP` |
| Decimals | `7` (1 peso = 10,000,000 stroops, SAC-compatible) |
| Contract Type | Soroban `TokenInterface` |
| Role Enforcement | `access_control.has_role(caller, CentralBank)` on mint + redeem |
| Admin Functions | `update_access_control_address` only |

---

## Amount Encoding

All on-chain amounts are in **SAC atomic units** (pesos × 10⁷). The frontend uses `PPHP_SCALE = 10_000_000`.

| Real Value | On-Chain (stroops) |
|------------|-------------------|
| 1 peso | `10,000,000` |
| 1,000 pesos | `10,000,000,000` |
| 1,000,000 pesos | `10,000,000,000,000` |
| 50,000,000 pesos | `500,000,000,000,000` |

`i128` max is ~170 quintillion. No overflow risk.

---

## Contract Functions

```
initialize(access_control_address, admin, decimal, name, symbol)
mint(caller, to, amount)        → only CentralBank (cross-calls access_control)
redeem(caller, from, amount)    → only CentralBank (cross-calls access_control)
update_access_control_address(admin, new_address)  → admin-only
balance(id)                     → i128 (anyone)
total_supply()                  → i128 (anyone)
```

All standard `TokenInterface` functions (`transfer`, `approve`, `transfer_from`, `burn`, `burn_from`) are also available.

---

## CBDC Lifecycle

### Mint (Government Budget Allocation)
```
CentralBank.mint(caller=CB, to=FundingAgency, amount)
    │
    ▼
access_control.has_role(caller, CentralBank)? → ✅
    │
    ▼
pPHP created → FundingAgency balance increases → total_supply increases
```

### Escrow (Project Funding)
```
FundingAgency.fund_escrow() → pPHP moves FA wallet → escrow contract vault
    │
    ▼
5 gates pass (Engineer, Compliance, Oracle, Community, AI)
    │
    ▼
escrow.release() → pPHP moves escrow vault → contractor wallet
```

### Redeem (Contractor Cash-Out)
```
CentralBank.redeem(caller=CB, from=contractor, amount)
    │
    ▼
access_control.has_role(caller, CentralBank)? → ✅
    │
    ▼
pPHP burned → contractor balance decreases → total_supply decreases
    ↓ (off-chain)
CentralBank pays contractor real pesos
```

---

## Donor-Funded Flow

1. Donor commits pledge → `grant_commitment.commit_grant(donor, pvo_id, amount, org, "pPHP")`
2. CentralBank approves → `pphp_token.mint(caller=CB, to=FA, amount)` + `grant_commitment.admin_mark_disbursed(caller=CB, grant_id)`
3. FundingAgency funds escrow → `escrow.fund_escrow(funder, escrow_id, amount)`
4. Gates pass → `escrow.release()` → contractor receives pPHP
5. Contractor redeems → `pphp_token.redeem(caller=CB, from=contractor, amount)`

---

## National Budget Flow

1. CentralBank Direct Fund → `pphp_token.mint(caller=CB, to=FA, amount)`
2. FundingAgency funds escrow → same as donor flow
3. Gates pass → contractor receives pPHP
4. Contractor redeems → same as donor flow

---

## Role Matrix

| Role | Can Mint? | Can Redeem? | Can Mark Disbursed? |
|------|:---:|:---:|:---:|
| **CentralBank** | ✅ | ✅ | ✅ |
| Administrator | ❌ | ❌ | ❌ |
| FundingAgency | ❌ | ❌ | ❌ |
| InternationalDonor | ❌ | ❌ | ❌ |

---

## Exercises

### B.1: Check Token Metadata

```bash
TOKEN=$(grep pphp: frontend/src/config.ts | head -1 | cut -d'"' -f2)

stellar contract invoke --source alice --network testnet \
  --id $TOKEN -- symbol

stellar contract invoke --source alice --network testnet \
  --id $TOKEN -- decimals

stellar contract invoke --source alice --network testnet \
  --id $TOKEN -- total_supply
```

### B.2: CentralBank Mints pPHP

```bash
TOKEN=$(grep pphp: frontend/src/config.ts | head -1 | cut -d'"' -f2)
FA="GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO"

stellar contract invoke --source central_bank --network testnet --send=yes \
  --id $TOKEN \
  -- mint \
  --caller GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO \
  --to $FA \
  --amount 100000000000000000  # 10B pesos
```

### B.3: CentralBank Redeems (Contractor Cash-Out)

```bash
TOKEN=$(grep pphp: frontend/src/config.ts | head -1 | cut -d'"' -f2)
CONTRACTOR="GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF"

stellar contract invoke --source central_bank --network testnet --send=yes \
  --id $TOKEN \
  -- redeem \
  --caller GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO \
  --from $CONTRACTOR \
  --amount 50000000000000000  # 5B pesos
```
