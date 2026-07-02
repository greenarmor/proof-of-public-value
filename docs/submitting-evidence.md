# Chapter 3: Submitting Evidence

Learn how contractors submit evidence to prove milestone progress.

---

## What You'll Learn

- How to submit different types of evidence
- How evidence links to milestones
- What happens when evidence is submitted

---

## Scenario

You are **Bob** (the Contractor). Milestone 1 (Site Preparation) has been started. You need to submit evidence that the site has been cleared and graded.

---

## Key Concept: Evidence Types

Each milestone defines which evidence types are **required** before it can be released.

| ID | Type | Example |
|----|------|---------|
| 0 | Drone Imagery | Aerial photos of cleared site |
| 1 | Satellite Imagery | Satellite view confirming progress |
| 2 | GPS Coordinates | Location data proving work location |
| 3 | Timestamped Photo | Ground photo with timestamp |
| 4 | Timestamped Video | Video walkthrough with timestamp |
| 5 | IoT Sensor | Structural sensor readings |
| 6 | Engineering Report | Engineer's certification document |
| 7 | Lab Result | Concrete strength test results |
| 8 | Inspection Report | Inspector's field report |
| 9 | Community Verification | Citizen confirmation |

---

## Exercises

### Exercise 3.1: Submit Drone Imagery Evidence

Submit drone footage of the cleared site:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- submit_evidence \
    --submitter bob \
    --pvo_id 2 \
    --milestone_id 3 \
    --evidence_type 0 \
    --data_hash "ipfs://QmDroneFootageHash123" \
    --metadata "Aerial survey of cleared site, 10km stretch"
```

!!! info "Data Hash"
    The `data_hash` field stores a reference to your evidence file (typically an IPFS hash or content hash). The actual file is stored off-chain; only the reference lives on-chain.

??? success "Expected Output"
    Returns an evidence ID. Milestone status changes to `EvidenceSubmitted`.

---

### Exercise 3.2: Submit GPS Coordinates Evidence

Submit GPS data proving the work location:

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- submit_evidence \
    --submitter bob \
    --pvo_id 2 \
    --milestone_id 3 \
    --evidence_type 2 \
    --data_hash "ipfs://QmGpsDataHash456" \
    --metadata "GPS coordinates along 10km stretch, QC"
```

---

### Exercise 3.3: Check Milestone Status

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- get_milestone --milestone_id 3
```

??? success "Expected Output"
    The milestone now shows `status: EvidenceSubmitted` and 2 submitted evidence items.

---

### Exercise 3.4: Submit Wrong Evidence Type

Milestone 1 requires Drone Imagery (0) and GPS Coordinates (2). Try submitting a Lab Result (7):

```bash
stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- submit_evidence \
    --submitter bob \
    --pvo_id 2 \
    --milestone_id 3 \
    --evidence_type 7 \
    --data_hash "ipfs://QmLabResultHash789" \
    --metadata "Concrete strength test"
```

??? question "What happens?"
    The evidence is accepted and stored, but it doesn't count toward the required evidence types. The milestone won't be ready until types 0 and 2 are both submitted.

---

### Exercise 3.5: Try Submitting to a Released Milestone

Once a milestone is released, no more evidence can be submitted:

```bash
# First check if the milestone is released
stellar contract invoke \
  --id popv_pvo_core \
  --source bob \
  --network testnet \
  -- get_milestone --milestone_id 3
```

If the milestone were already `Released`, attempting to submit would fail with:
```
panic: cannot submit evidence to completed milestone
```

---

## Evidence Submission Rules

| Rule | Behavior |
|------|----------|
| Milestone must not be Released/Rejected | Submitting to closed milestone panics |
| Evidence type is recorded but not validated | Extra evidence is stored but doesn't fulfill requirements |
| Multiple submissions allowed | Each submission gets a unique ID |
| Auth required | Only the submitter address can call |

---

## Checklist

- [ ] Drone imagery evidence submitted
- [ ] GPS coordinates evidence submitted
- [ ] Milestone status is `EvidenceSubmitted`
- [ ] Both required evidence types are present

---

## Next Steps

➡️ **[Chapter 4: Approving Milestones](approving-milestones.md)**
