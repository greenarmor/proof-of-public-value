# Citizen Reward System

## Overview

The AI Oracle automatically rewards citizens who submit verified community reports with pPHP tokens. The reward amount is a percentage of the PVO's total budget, scaled by the citizen's on-chain reputation tier.

## Trigger Condition

A citizen is rewarded when:
1. Their community report has been **verified** (`cr.verified === true`) by other citizens
2. The PVO has a non-zero `total_budget` on-chain
3. They haven't already been rewarded for this specific report
4. `ADMIN_SECRET_KEY` is configured in the AI oracle `.env`

## Reward Calculation

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

The reward is `Math.floor(winningBidStroops × tier_percentage)` stroops.

1 pPHP = 10,000,000 stroops

**Example:** A "Guardian" tier citizen submitting a verified report for a ₱5M PVO receives:

```
5,000,000 pesos = 50,000,000,000,000 stroops (budget in stroops)
50,000,000,000,000 × 0.00010 = 5,000,000,000 stroops
= 500 pPHP
```

## Flow

```
AI Oracle scans community_oracle.get_reports_by_pvo(pvoId)
  ↓
For each VERIFIED report:
  1. Check if already rewarded (in-memory Set + disk persistence)
  2. Fetch citizen's reputation from reputation contract
  3. Calculate tier and reward amount
  4. Mint pPHP via token contract (pPHP.mint)
  5. Persist reward ID to ~/popv-rewarded-reports.json
```

## Anti-Duplication

- **In-memory**: `rewardedReports` Set tracks `{reportId}:{citizenAddress}` during runtime
- **Disk persistence**: `~/popv-rewarded-reports.json` stores all rewarded IDs, loaded on startup
- **Restart-safe**: Even after AI oracle restart, previously rewarded citizens are never rewarded again for the same report

## On-Chain Transaction

The reward is a **Soroban `mint` invocation** on the pPHP token contract:

```javascript
pPHP_contract.mint(
  citizen_address,    // recipient
  reward_stroops,     // i128 amount
)
```

Signed by the admin wallet with 3 RPC retry attempts.

## Requirements

- `ADMIN_SECRET_KEY` env var (admin wallet with pPHP mint authority)
- `AI_AUDITOR_SECRET` env var (for escrow gate 5 validation)
- Admin wallet must be funded on Stellar testnet
- pPHP token contract must have admin registered as minter
- Citizen must have submitted a **verified** community report

## Integration with Mobile App

The mobile citizen field report flow connects to the reward system:

1. Citizen walks to PVO site → GPS proximity detected
2. Submits field report with photo evidence via IPFS
3. Report recorded on-chain in Community Oracle contract
4. Other citizens verify the report
5. AI Oracle detects verified report → calculates reward
6. pPHP minted to citizen's wallet automatically
7. Citizen can see pPHP balance in mobile wallet

## Disabling Rewards

Set `ADMIN_SECRET_KEY` to empty or don't set it. The AI oracle will print `[Reward] ADMIN_SECRET not set, skipping` and continue all other analyses.
