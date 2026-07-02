# Chapter 2: Creating Projects

Learn how government agencies create Public Value Objects (PVOs) and define milestones.

---

## What You'll Learn

- How to create a PVO
- How to define milestones with evidence requirements
- How milestone budgets work

---

## Scenario

You are a **Government Agency** creating a road paving project in Quezon City with a ₱10 million budget.

---

## Exercises

### Exercise 2.1: Deploy the PVO Core Contract

First, deploy the contract to testnet:

```bash
WASM=$(pwd)/target/wasm32v1-none/release/pvo_core.wasm

stellar contract deploy \
  --wasm $WASM \
  --source alice \
  --network testnet \
  --alias popv_pvo_core
```

!!! tip "Save the Contract ID"
    The deploy command outputs a contract ID. You'll use it in all subsequent commands. The `--alias` lets you reference it by name instead.

??? success "Expected Output"
    ```
    ✅ Deployed contract to testnet
    Contract ID: CXY...
    ```

---

### Exercise 2.2: Initialize the Contract

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- initialize
```

??? success "Expected Output"
    Returns `1` (the first counter ID).

---

### Exercise 2.3: Create a Public Value Object

Create the road paving project:

```bash
ALICE=$(stellar keys address alice)
BOB=$(stellar keys address bob)

stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- create_pvo \
    --creator alice \
    --title "Road Paving Project" \
    --description "Paving 10km of national road in Quezon City" \
    --funding_agency "$ALICE" \
    --contractor "$BOB" \
    --project_manager "$ALICE" \
    --department "DPWH" \
    --municipality "Quezon City" \
    --total_budget 10000000 \
    --fund_source "National Budget 2026"
```

??? success "Expected Output"
    Returns the PVO ID (e.g., `2`).

---

### Exercise 2.4: View Your PVO

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- get_pvo --pvo_id 2
```

??? success "Expected Output"
    Shows the full PVO struct with title, status (Proposed), budget, etc.

---

### Exercise 2.5: Define Milestone 1 — Site Preparation

Each milestone needs a budget, required evidence types, and a community verification threshold.

```bash
# Evidence type IDs:
#   0 = DroneImagery
#   1 = SatelliteImagery
#   2 = GpsCoordinates
#   3 = TimestampedPhoto
#   4 = TimestampedVideo
#   5 = IoTSensor
#   6 = EngineeringReport
#   7 = LabResult
#   8 = InspectionReport
#   9 = CommunityVerification

stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- create_milestone \
    --creator alice \
    --pvo_id 2 \
    --title "Site Preparation" \
    --description "Clear and grade the site" \
    --budget 3000000 \
    --required_evidence '[0, 2]' \
    --community_required 3
```

??? question "What does community_required mean?"
    At least 3 citizens must verify this milestone before it can be released. This prevents single bad actors from falsely confirming work.

---

### Exercise 2.6: Define Milestone 2 — Paving

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- create_milestone \
    --creator alice \
    --pvo_id 2 \
    --title "Paving" \
    --description "Lay asphalt over 10km" \
    --budget 5000000 \
    --required_evidence '[0, 6, 7]' \
    --community_required 5
```

---

### Exercise 2.7: List All Milestones

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- get_pvo_milestones --pvo_id 2
```

??? success "Expected Output"
    Returns an array of 2 milestones: Site Preparation and Paving.

---

### Exercise 2.8: Budget Validation

Try creating a milestone that exceeds the PVO budget:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- create_milestone \
    --creator alice \
    --pvo_id 2 \
    --title "Over Budget" \
    --description "This should fail" \
    --budget 20000000 \
    --required_evidence '[0]' \
    --community_required 1
```

??? danger "Expected Output"
    ```
    panic: milestone budget exceeds PVO total budget
    ```
    The system prevents over-committing funds.

---

## Checklist

- [ ] PVO Core contract deployed
- [ ] Contract initialized
- [ ] PVO created with ₱10M budget
- [ ] Milestone 1: Site Preparation (₱3M, drone + GPS, 3 citizens)
- [ ] Milestone 2: Paving (₱5M, drone + engineering report + lab result, 5 citizens)
- [ ] Budget validation tested

---

## Next Steps

➡️ **[Chapter 3: Submitting Evidence](submitting-evidence.md)**
