# Chapter 4: Approving Milestones

Learn the full milestone approval flow - from engineer sign-off to fund release.

---

## What You'll Learn

- The 5-gate approval process
- How each gate works
- How to check if a milestone is ready
- How to release a milestone

---

## The 5 Gates

A milestone must pass through ALL five gates before funds release:

```
Gate 1: Evidence Submitted     ← Contractor (Chapter 3)
    │
Gate 2: Engineer Approved      ← Engineer signs off
    │
Gate 3: AI Validated           ← Fraud/anomaly check passes
    │
Gate 4: Compliance Passed      ← Legal/regulatory check
    │
Gate 5: Community Verified     ← Enough citizens confirm
    │
    ▼
MILESTONE READY → RELEASE FUNDS
```

---

## Exercises

### Exercise 4.1: Gate 2 - Engineer Approval

An engineer reviews the submitted evidence and approves the milestone:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- engineer_approve \
    --engineer alice \
    --milestone_id 3
```

??? success "Expected Output"
    Milestone status changes to `EngineerApproved`.

---

### Exercise 4.2: Gate 3 - AI Validation

The AI audit system runs its checks. In production this is an off-chain oracle. For this exercise we call it directly:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- ai_validate \
    --milestone_id 3 \
    --passed true
```

??? question "What if AI finds risk?"
    If AI detects fraud patterns (duplicate invoices, ghost projects, etc.), it sets `passed = false`. The milestone stays locked until the risk is resolved.

---

### Exercise 4.3: Gate 4 - Compliance Check

The compliance officer validates procurement law, budget rules, and safety standards:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- compliance_check \
    --milestone_id 3 \
    --passed true
```

---

### Exercise 4.4: Gate 5 - Community Verification

At least 3 citizens must verify this milestone (as defined in Exercise 2.5):

```bash
# Each call represents one citizen verification
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- add_community_verification --milestone_id 3

stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- add_community_verification --milestone_id 3

# Third verification (meets threshold of 3)
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- add_community_verification --milestone_id 3
```

---

### Exercise 4.5: Check Readiness

Before releasing, verify all conditions are met:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- check_milestone_ready --milestone_id 3
```

??? success "Expected Output"
    Returns `true` if all 5 gates passed AND all required evidence types are submitted.

---

### Exercise 4.6: Release the Milestone

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- release_milestone --milestone_id 3
```

??? success "Expected Output"
    Returns `true`. Milestone status changes to `Released`.

---

### Exercise 4.7: Verify Final Status

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- get_milestone --milestone_id 3
```

??? success "Expected Output"
    ```
    status: Released
    engineer_approved: true
    ai_validated: true
    compliance_passed: true
    community_confirmations: 3
    ```

---

### Exercise 4.8: Try Releasing an Incomplete Milestone

Milestone 2 (Paving) hasn't gone through any gates yet:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source alice \
  --network testnet \
  -- release_milestone --milestone_id 4
```

??? danger "Expected Output"
    Returns `false`. The milestone is not released because conditions aren't met.

---

## Gate Summary

| Gate | Who | Function | What It Checks |
|------|-----|----------|---------------|
| Evidence | Contractor | `submit_evidence` | Required evidence types submitted |
| Engineer | Engineer | `engineer_approve` | Work meets technical standards |
| AI | AI Auditor | `ai_validate` | No fraud anomalies detected |
| Compliance | Auditor | `compliance_check` | Legal and regulatory compliance |
| Community | Citizens | `add_community_verification` | Threshold of citizens confirm |

---

## Checklist

- [ ] Engineer approved the milestone
- [ ] AI validation passed
- [ ] Compliance check passed
- [ ] 3 community verifications added
- [ ] `check_milestone_ready` returns `true`
- [ ] Milestone released successfully
- [ ] Verified incomplete milestone cannot be released

---

## Next Steps

➡️ **[Chapter 5: Community Verification](community-verification.md)**
