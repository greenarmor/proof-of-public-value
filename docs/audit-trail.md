# Chapter 6: Audit Trail

Learn how the Financial Black Box records every decision permanently.

---

## What You'll Learn

- How to record decisions in the audit trail
- How to query audit history
- How to find high-risk entries
- Why immutability matters

---

## Key Concept: Financial Black Box

Like an airplane's black box, the audit trail records every important decision permanently. Investigators can replay every decision years later.

Each entry captures:

| Field | Description |
|-------|-------------|
| `actor` | Who made the decision |
| `actor_role` | Their role (e.g., "Commission on Audit") |
| `category` | Type of decision (10 categories) |
| `action` | What was done |
| `rationale` | Why it was done |
| `supporting_doc_hash` | Reference to supporting documents |
| `ai_recommendation` | What AI recommended |
| `risk_score` | Risk assessment (0-100) |
| `compliance_result` | Compliance outcome |
| `signature_hash` | Digital signature reference |

---

## Decision Categories

| ID | Category | Example Use |
|----|----------|-------------|
| 0 | Approval | Approve a milestone |
| 1 | Payment | Release escrow funds |
| 2 | EvidenceReview | Review submitted evidence |
| 3 | ComplianceCheck | Verify regulatory compliance |
| 4 | AIRiskAssessment | AI fraud risk evaluation |
| 5 | ProcurementAward | Award contract to contractor |
| 6 | ContractModification | Change contract terms |
| 7 | DisputeResolution | Resolve a dispute |
| 8 | MilestoneRelease | Release milestone funds |
| 9 | RoleChange | Assign or revoke a role |

---

## Exercises

### Exercise 6.1: Deploy the Audit Trail Contract

```bash
WASM=$(pwd)/target/wasm32v1-none/release/audit_trail.wasm

stellar contract deploy \
  --wasm $WASM \
  --source alice \
  --network testnet \
  --alias popv_audit
```

---

### Exercise 6.2: Initialize

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- initialize
```

---

### Exercise 6.3: Record a Milestone Approval

Record the decision to approve Milestone 1:

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- record_decision \
    --actor alice \
    --pvo_id 2 \
    --category 0 \
    --action "Approved Milestone 1: Site Preparation" \
    --rationale "All evidence verified, drone and GPS confirmed" \
    --supporting_doc_hash "ipfs://QmApprovalDocs" \
    --ai_recommendation "low risk, proceed" \
    --risk_score 15 \
    --compliance_result "passed" \
    --signature_hash "ipfs://QmSignature"
```

??? success "Expected Output"
    Returns an entry ID.

---

### Exercise 6.4: Record an AI Risk Assessment

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- record_decision \
    --actor alice \
    --pvo_id 2 \
    --category 4 \
    --action "AI fraud check for Milestone 1" \
    --rationale "No anomalies detected in evidence" \
    --supporting_doc_hash "ipfs://QmAiReport" \
    --ai_recommendation "no fraud indicators" \
    --risk_score 5 \
    --compliance_result "passed" \
    --signature_hash "ipfs://QmAiSig"
```

---

### Exercise 6.5: Record a Payment Release

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- record_decision \
    --actor alice \
    --pvo_id 2 \
    --category 1 \
    --action "Released ₱3M for Milestone 1" \
    --rationale "All 5 gates passed, funds released from escrow" \
    --supporting_doc_hash "ipfs://QmPaymentProof" \
    --ai_recommendation "approved" \
    --risk_score 10 \
    --compliance_result "passed" \
    --signature_hash "ipfs://QmPaySig"
```

---

### Exercise 6.6: View Full Audit History for a PVO

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_pvo_audit_history --pvo_id 2
```

??? success "Expected Output"
    Returns all 3 entries: approval, AI assessment, and payment release - in chronological order.

---

### Exercise 6.7: Record with Role

Record a decision with a specific role label:

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- record_decision_with_role \
    --actor alice \
    --actor_role "Commission on Audit" \
    --pvo_id 2 \
    --category 3 \
    --action "Compliance audit for PVO" \
    --rationale "All procurement laws followed" \
    --supporting_doc_hash "ipfs://QmCoaReport" \
    --ai_recommendation "no issues" \
    --risk_score 0 \
    --compliance_result "passed" \
    --signature_hash "ipfs://QmCoaSig"
```

---

### Exercise 6.8: Find High-Risk Entries

Flag all decisions with risk score ≥ 50:

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_high_risk_entries --min_risk_score 50
```

??? question "What would trigger high risk?"
    AI might flag: duplicate invoices, ghost projects, unusual payment timing, abnormal budget growth, repeated contractor wins, or collusion indicators.

---

### Exercise 6.9: Filter by Category

Find all payment decisions:

```bash
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_entries_by_category --category 1
```

---

### Exercise 6.10: Filter by Actor

Find all decisions by a specific person:

```bash
ALICE=$(stellar keys address alice)

stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_entries_by_actor --actor "$ALICE"
```

---

### Exercise 6.11: Verify Immutability

Entries cannot be modified once recorded. Verify by reading the same entry twice:

```bash
# Read entry 1
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_entry --entry_id 1

# Read it again - should be identical
stellar contract invoke \
  --id popv_audit \
  --source alice \
  --network testnet \
  -- get_entry --entry_id 1
```

??? success "Expected Output"
    Both reads return identical data. The audit trail is append-only - no update or delete functions exist.

---

## Why This Matters

| Scenario | Without Audit Trail | With PoPV Audit Trail |
|----------|--------------------|-----------------------|
| Investigation | Paper records, easily lost | Permanent on-chain history |
| Accountability | "Who approved this?" → unclear | Every decision has actor, time, rationale |
| AI transparency | AI is a black box | AI recommendations recorded with each decision |
| Fraud prevention | Fake invoices slip through | Pattern analysis across all entries |
| Public trust | Citizens must trust blindly | Anyone can verify the decision trail |

---

## Checklist

- [ ] Audit Trail contract deployed and initialized
- [ ] Milestone approval recorded
- [ ] AI risk assessment recorded
- [ ] Payment release recorded
- [ ] Full audit history retrieved for a PVO
- [ ] Decision with role recorded
- [ ] High-risk entries queried
- [ ] Category and actor filters tested
- [ ] Immutability verified

---

## Next Steps

➡️ **[Appendix A: Escrow Deep Dive](escrow-deep-dive.md)**
