# PoPV Citizen Reward System

## Overview

The AI Oracle automatically rewards citizens who submit verified community reports with pPHP tokens. The reward amount is calculated as a percentage of the PVO's total budget, scaled by the citizen's on-chain reputation tier.

## Trigger Condition

A citizen is rewarded when:
1. Their community report has been **verified** (`cr.verified === true`) by other citizens
2. The PVO has a non-zero `total_budget` on-chain
3. They haven't already been rewarded for this specific report

## Reward Calculation

The reward is based on **two factors**:

### 1. Reputation Tier

Computed from the citizen's on-chain reputation score (fetched from the `reputation` contract via `get_reputation`):

| Tier | Confidence Score | Reward % of PVO Budget |
|------|-----------------|----------------------|
| Guardian | ≥ 96 | 0.010% (0.00010) |
| Elite | ≥ 81 | 0.008% (0.00008) |
| Trusted | ≥ 51 | 0.005% (0.00005) |
| Rising | ≥ 21 | 0.003% (0.00003) |
| New | < 21 | 0.001% (0.00001) |

### 2. PVO Budget

The reward is `Math.floor(winningBidStroops × tier_percentage)` stroops (1 pPHP = 10,000,000 stroops).

**Example:** A "Guardian" tier citizen submitting a verified report for a ₱5M PVO receives:
```
5,000,000 × 10,000,000 = 50,000,000,000,000 stroops (budget)
50,000,000,000,000 × 0.00010 = 500,000,000 stroops
= 50 pPHP
```

## Flow

```
1. AI Oracle scans community_oracle.get_reports_by_pvo(pvoId)
2. For each VERIFIED report:
   a. Check if already rewarded (in-memory Set + disk persistence)
   b. Fetch citizen's reputation from reputation contract
   c. Calculate tier and reward amount
   d. Mint pPHP via token contract (pPHP.mint)
   e. Persist reward ID to ~/popv-rewarded-reports.json
3. Each citizen is rewarded once per report
```

## Anti-Duplication

- **In-memory**: `rewardedReports` Set tracks `{reportId}:{citizenAddress}` during runtime
- **Disk persistence**: `~/popv-rewarded-reports.json` stores all rewarded IDs, loaded on startup
- **Restart-safe**: Even after AI oracle restart, previously rewarded citizens won't be rewarded again for the same report

## On-Chain Transaction

The reward is a **Soroban `mint` invocation** on the pPHP token contract:

```javascript
pPHP_contract.mint(
  citizen_address,    // recipient
  reward_stroops,     // i128 amount
)
```

Signed by the admin wallet (`ADMIN_SECRET_KEY`) with 3 RPC retry attempts.

## Requirements

- `ADMIN_SECRET_KEY` env var must be set (admin wallet with pPHP mint authority)
- Admin wallet must be funded on Stellar testnet
- pPHP token contract must have admin registered as minter
- Citizen must have submitted a **verified** community report

## Disabling Rewards

Set `ADMIN_SECRET_KEY` to empty or don't set it. The AI oracle will print `[Reward] ADMIN_SECRET not set, skipping` and continue all other analyses.
