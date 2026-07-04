# Appendix A: Escrow Deep Dive

Advanced exercises on the Dynamic Escrow contract.

---

## What You'll Learn

- How to create and fund escrows
- The full unlock condition flow
- How disputes and refunds work

---

## Exercises

### Exercise A.1: Deploy and Initialize

The escrow contract is already deployed to testnet at `CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6`. You can use it directly.

To deploy your own instance:

```bash
WASM=$(pwd)/target/wasm32v1-none/release/escrow.wasm

stellar contract deploy \
  --wasm $WASM \
  --source alice \
  --network testnet \
  --alias popv_escrow

stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- initialize
```

!!! info "pPHP Token Required"
    The escrow contract now transfers real tokens. You need the pPHP token contract address to create escrows. See [Appendix B: pPHP Token](pphp-token.md) for details.

---

### Exercise A.2: Create an Escrow

Create an escrow for Milestone 1 (3M pesos = 300,000,000 centavos), requiring 2 community confirmations:

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"
PPHP="CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6"
ALICE=$(stellar keys address alice)
BOB=$(stellar keys address bob)

stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet \
  -- create_escrow \
    --funder alice \
    --recipient "$BOB" \
    --pvo_id 2 \
    --milestone_id 3 \
    --amount 300000000 \
    --token_address "$PPHP" \
    --community_required 2
```

??? success "Expected Output"
    Returns escrow ID. Status is `Created`.

!!! tip "Amount in Centavos"
    Amounts are in pPHP centavos (2 decimals). 300,000,000 centavos = 3,000,000 pesos. See [Appendix B](pphp-token.md) for the full encoding table.

---

### Exercise A.3: Fund the Escrow

The funder deposits the exact amount. **Real pPHP tokens transfer from the funder wallet to the escrow contract address:**

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"

stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet --send=yes \
  -- fund_escrow \
    --funder alice \
    --escrow_id 1 \
    --amount 300000000
```

??? success "Expected Output"
    Status changes to `Funded`. Funder's pPHP balance decreases by 3M pesos. Tokens are locked in the escrow contract.

---

### Exercise A.4: Complete All Unlock Conditions

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"

# Gate 1: Engineer approval
stellar contract invoke \
  --id $ESCROW \
  --source engineer \
  --network testnet --send=yes \
  -- engineer_approve --engineer engineer --escrow_id 1

# Gate 2: AI validation
stellar contract invoke \
  --id $ESCROW \
  --source ai_auditor \
  --network testnet --send=yes \
  -- ai_validate --auditor ai_auditor --escrow_id 1 --passed true

# Gate 3: Compliance
stellar contract invoke \
  --id $ESCROW \
  --source auditor \
  --network testnet --send=yes \
  -- compliance_validate --compliance_officer auditor --escrow_id 1 --passed true

# Gate 4: Community (need 2)
for ALIAS in citizen alice; do
  stellar contract invoke \
    --id $ESCROW \
    --source $ALIAS \
    --network testnet --send=yes \
    -- add_community_confirmation --citizen $ALIAS --escrow_id 1
done
```

??? success "Expected Output"
    After the last condition, status auto-advances to `Ready`.

---

### Exercise A.5: Check Conditions

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"

stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet \
  -- check_conditions --escrow_id 1
```

??? success "Expected Output"
    Returns `true`.

---

### Exercise A.6: Release Funds

**Real pPHP tokens transfer from the escrow contract to the recipient (contractor):**

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"

stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet --send=yes \
  -- release \
    --caller alice \
    --escrow_id 1
```

??? success "Expected Output"
    Returns `true`. Status changes to `Released`. Contractor's pPHP balance increases by 3M pesos.

---

### Exercise A.7: Test Dispute and Refund

Create a second escrow (5M pesos) and dispute it. **Refund returns real pPHP tokens to the funder:**

```bash
ESCROW="CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6"
PPHP="CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6"
BOB=$(stellar keys address bob)

# Create new escrow
stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet --send=yes \
  -- create_escrow \
    --funder alice \
    --recipient "$BOB" \
    --pvo_id 2 \
    --milestone_id 4 \
    --amount 500000000 \
    --token_address "$PPHP" \
    --community_required 3

# Fund it
stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet --send=yes \
  -- fund_escrow \
    --funder alice \
    --escrow_id 2 \
    --amount 500000000

# Dispute it
stellar contract invoke \
  --id $ESCROW \
  --source anti_corruption \
  --network testnet --send=yes \
  -- dispute \
    --disputer anti_corruption \
    --escrow_id 2

# Refund the disputed escrow (tokens return to funder)
stellar contract invoke \
  --id $ESCROW \
  --source alice \
  --network testnet --send=yes \
  -- refund \
    --funder alice \
    --escrow_id 2
```

??? success "Expected Output"
    Status: `Disputed` then `Refunded`. Funder's pPHP balance is restored.

---

## Escrow Safety Rules

| Rule | Enforcement |
|------|------------|
| Amount must be positive | `panic("amount must be positive")` |
| Only funder funds | Checks `escrow.funder == funder` |
| Exact amount only | `panic("funding amount must match")` |
| No double release | `panic("escrow already released")` |
| No refund after release | `panic("cannot refund released escrow")` |
| No refund if unlocked | `panic("cannot refund escrow with met conditions")` |
| Real token transfers | Uses `token::Client` for fund/release/refund |
| Dispute blocks release | Status must not be `Released` |
