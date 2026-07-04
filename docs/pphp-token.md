# Appendix B: pPHP Token & Escrow Settlement

How PoPV uses a custom on-chain token to settle real escrow payments, solving the testnet XLM limit and enabling realistic multi-million peso testing.

---

## What You'll Learn

- Why pPHP exists instead of using native XLM
- How amounts are encoded (centavos, not pesos)
- How to mint pPHP and check balances
- How escrow transfers real tokens on fund, release, and refund
- How this maps to production (mainnet)

---

## The Problem pPHP Solves

Stellar testnet's Friendbot funds wallets with a maximum of **10,000 XLM**. Real infrastructure projects cost **5 to 50 million pesos**. Using native XLM directly would exhaust test wallets instantly.

pPHP is a custom Soroban fungible token with **unlimited mintable supply** controlled by the Administrator, so we can simulate realistic government budgets without XLM constraints.

---

## Token Details

| Field | Value |
|-------|-------|
| Name | Philippine Peso Testnet |
| Symbol | `pPHP` |
| Decimals | `2` (1 peso = 100 centavos) |
| Admin | `alice` (Administrator) |
| Contract | `CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6` |
| Interface | Soroban `TokenInterface` (SAC-compatible) |

---

## Amount Encoding

All on-chain amounts are in **centavos** (the smallest unit). Divide by 100 to get pesos.

| Real Value | Centavos (on-chain) | Notes |
|------------|---------------------|-------|
| 1.00 peso | `100` | Minimum unit |
| 1,000 pesos | `100,000` | Small milestone |
| 1,000,000 pesos | `100,000,000` | Medium project |
| 50,000,000 pesos | `5,000,000,000` | Large infrastructure |
| 1,000,000,000 pesos | `100,000,000,000` | National budget line item |

`i128` max is ~170 quintillion. No overflow risk even for national budgets.

---

## How Escrow Uses pPHP

The escrow contract (`CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6`) stores a `token_address` field. When you create an escrow, you specify which token to use:

```
create_escrow(funder, recipient, pvo_id, milestone_id, amount, token_address, community_required)
```

The contract then uses `soroban_sdk::token::Client` to transfer real tokens:

| Action | Token Flow | Who Signs |
|--------|-----------|-----------|
| `fund_escrow` | Funder to Escrow Contract | Funder |
| `release` | Escrow Contract to Recipient | Any caller (gates must pass) |
| `refund` | Escrow Contract to Funder | Funder |

Before release, tokens are **locked inside the escrow contract address**. No one can access them until all 5 gates pass or a refund is triggered.

---

## Exercises

### Exercise B.1: Check Your pPHP Balance

```bash
stellar contract invoke --source alice --network testnet \
  --id CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6 \
  -- balance --id $(stellar keys address funding_agency)
```

??? success "Expected Output"
    ```
    "600000000"
    ```
    That is 6,000,000 pesos (600M centavos).

---

### Exercise B.2: Admin Mints pPHP to a Wallet

Only the Administrator (`alice`) can mint:

```bash
stellar contract invoke --source alice --network testnet --send=yes \
  --id CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6 \
  -- mint --to $(stellar keys address funding_agency) --amount 1000000000
```

This mints 10,000,000 pesos (1 billion centavos) to the funding agency wallet.

??? success "Expected Output"
    Transaction submitted successfully.

---

### Exercise B.3: Check Token Metadata

```bash
# Symbol
stellar contract invoke --source alice --network testnet \
  --id CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6 \
  -- symbol

# Decimals
stellar contract invoke --source alice --network testnet \
  --id CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6 \
  -- decimals

# Total supply
stellar contract invoke --source alice --network testnet \
  --id CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6 \
  -- total_supply
```

??? success "Expected Output"
    ```
    "pPHP"
    2
    <total minted so far>
    ```

---

### Exercise B.4: Create and Fund a 5M Peso Escrow

```bash
PPHP="CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6"
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"
FUNDER=$(stellar keys address funding_agency)
CONTRACTOR=$(stellar keys address contractor)

# Create escrow: 5M pesos = 500,000,000 centavos
ESCROW_ID=$(stellar contract invoke --source funding_agency --network testnet --send=yes \
  --id $ESCROW \
  -- create_escrow \
    --funder "$FUNDER" \
    --recipient "$CONTRACTOR" \
    --pvo_id 1 \
    --milestone_id 1 \
    --amount 500000000 \
    --token_address "$PPHP" \
    --community_required 3)

echo "Escrow ID: $ESCROW_ID"

# Fund it: real pPHP tokens move from funder to escrow contract
stellar contract invoke --source funding_agency --network testnet --send=yes \
  --id $ESCROW \
  -- fund_escrow --funder "$FUNDER" --escrow_id "$ESCROW_ID" --amount 500000000
```

??? success "Expected Output"
    Escrow created and funded. Funder's pPHP balance drops by 5M pesos. Tokens are now locked in the escrow contract address.

---

### Exercise B.5: Verify Token Movement

After funding, verify that tokens actually moved:

```bash
PPHP="CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6"

# Funder balance should have decreased
stellar contract invoke --source alice --network testnet \
  --id $PPHP -- balance --id $(stellar keys address funding_agency)

# Contractor balance should still be unchanged (funds locked in escrow)
stellar contract invoke --source alice --network testnet \
  --id $PPHP -- balance --id $(stellar keys address contractor)
```

---

### Exercise B.6: Complete All 5 Gates and Release

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"
ESCROW_ID=1

# Gate 1: Engineer
stellar contract invoke --source engineer --network testnet --send=yes \
  --id $ESCROW -- engineer_approve --engineer $(stellar keys address engineer) --escrow_id "$ESCROW_ID"

# Gate 2: AI
stellar contract invoke --source ai_auditor --network testnet --send=yes \
  --id $ESCROW -- ai_validate --auditor $(stellar keys address ai_auditor) --escrow_id "$ESCROW_ID" --passed true

# Gate 3: Compliance
stellar contract invoke --source auditor --network testnet --send=yes \
  --id $ESCROW -- compliance_validate --compliance_officer $(stellar keys address auditor) --escrow_id "$ESCROW_ID" --passed true

# Gate 4: Community (3 confirmations needed)
for ALIAS in citizen alice agency; do
  stellar contract invoke --source $ALIAS --network testnet --send=yes \
    --id $ESCROW -- add_community_confirmation --citizen $(stellar keys address $ALIAS) --escrow_id "$ESCROW_ID"
done

# Release: real pPHP tokens move from escrow contract to contractor
stellar contract invoke --source funding_agency --network testnet --send=yes \
  --id $ESCROW -- release --caller $(stellar keys address funding_agency) --escrow_id "$ESCROW_ID"
```

??? success "Expected Output"
    All gates pass. Status advances to `Ready` then `Released`. Contractor's pPHP balance increases by 5M pesos.

---

### Exercise B.7: Dispute and Refund

If fraud is detected, the Anti-Corruption Agency can dispute an escrow, and the funder can reclaim funds:

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"

# Dispute
stellar contract invoke --source anti_corruption --network testnet --send=yes \
  --id $ESCROW -- dispute --disputer $(stellar keys address anti_corruption) --escrow_id 2

# Refund: tokens return from escrow contract to funder
stellar contract invoke --source funding_agency --network testnet --send=yes \
  --id $ESCROW -- refund --funder $(stellar keys address funding_agency) --escrow_id 2
```

??? success "Expected Output"
    Status: `Disputed` then `Refunded`. Funder's pPHP balance is restored. Contractor never received the funds.

---

## Token Flow Diagram

```
                         pPHP Token Transfers


  +----------+         fund_escrow         +--------------+
  |  Funder  | ---------- 5M -----------> |    Escrow     |
  |  Wallet  |                            |   Contract    |
  +----------+                            |   (locked)    |
                                           +-------+-------+
                                               |         |
                                      release   |         |  refund
                                              v         v
  +--------------+                  +--------------+
  |  Contractor  | <---- 5M ------- |    Escrow     |
  |    Wallet    |                  |   Contract    |
  +--------------+                  +--------------+

  All 5 gates must pass before release.
  Dispute blocks release and enables refund.
```

---

## Production Path (Mainnet)

On mainnet, pPHP would be replaced by a real PHP-pegged asset:

| Option | Description |
|--------|-------------|
| **GovPHP SAC token** | Government-issued Stellar Asset Credit token (requires BSP approval) |
| **USDC** | Circle's stablecoin with FX conversion (available now) |
| **EURC** | European stablecoin for international donor projects |
| **XLM** | Native Stellar Lumens (volatile, but simplest for small projects) |

The escrow's `token_address` field is asset-agnostic. Different PVOs can use different tokens without code changes.

---

## Checklist

- [ ] Checked pPHP balance
- [ ] Admin minted pPHP to a wallet
- [ ] Created escrow with `token_address` parameter
- [ ] Funded escrow (verified tokens left funder wallet)
- [ ] Completed 5 gates and released (verified tokens reached contractor)
- [ ] Tested dispute and refund (verified tokens returned to funder)
