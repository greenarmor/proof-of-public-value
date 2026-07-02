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

---

### Exercise A.2: Create an Escrow

Create an escrow for Milestone 1 (₱3M), requiring 2 community confirmations:

```bash
ALICE=$(stellar keys address alice)
BOB=$(stellar keys address bob)

stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- create_escrow \
    --funder alice \
    --recipient "$BOB" \
    --pvo_id 2 \
    --milestone_id 3 \
    --amount 3000000 \
    --community_required 2
```

??? success "Expected Output"
    Returns escrow ID. Status is `Created`.

---

### Exercise A.3: Fund the Escrow

The funder deposits the exact amount:

```bash
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- fund_escrow \
    --funder alice \
    --escrow_id 1 \
    --amount 3000000
```

??? success "Expected Output"
    Status changes to `Funded`.

---

### Exercise A.4: Complete All Unlock Conditions

```bash
# Gate 1: Engineer approval
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- engineer_approve --escrow_id 1

# Gate 2: AI validation
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- ai_validate --escrow_id 1 --passed true

# Gate 3: Compliance
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- compliance_validate --escrow_id 1 --passed true

# Gate 4: Community (need 2)
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- add_community_confirmation --escrow_id 1

stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- add_community_confirmation --escrow_id 1
```

??? success "Expected Output"
    After the last condition, status auto-advances to `Ready`.

---

### Exercise A.5: Check Conditions

```bash
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- check_conditions --escrow_id 1
```

??? success "Expected Output"
    Returns `true`.

---

### Exercise A.6: Release Funds

```bash
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- release \
    --caller alice \
    --escrow_id 1
```

??? success "Expected Output"
    Returns `true`. Status changes to `Released`.

---

### Exercise A.7: Test Dispute and Refund

Create a second escrow and dispute it:

```bash
# Create new escrow
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- create_escrow \
    --funder alice \
    --recipient "$BOB" \
    --pvo_id 2 \
    --milestone_id 4 \
    --amount 5000000 \
    --community_required 3

# Fund it
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- fund_escrow \
    --funder alice \
    --escrow_id 2 \
    --amount 5000000

# Dispute it
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- dispute \
    --disputer alice \
    --escrow_id 2

# Refund the disputed escrow
stellar contract invoke \
  --id popv_escrow \
  --source alice \
  --network testnet \
  -- refund \
    --funder alice \
    --escrow_id 2
```

??? success "Expected Output"
    Status: `Disputed` → `Refunded`. Funds return to funder.

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
| Dispute blocks release | Status must not be `Released` |
