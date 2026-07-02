# Chapter 5: Community Verification

Learn how citizens participate in verifying public projects through the Community Oracle.

---

## What You'll Learn

- How to submit community reports
- How citizen reputation works
- How confidence scores are calculated
- How to verify reports

---

## Why Citizens Matter

Community verification never replaces engineers — it strengthens accountability. When multiple independent citizens confirm the same thing, confidence increases. When reports conflict, it flags problems for investigation.

---

## Scenario

You are a **Citizen** living near the road paving project. You've noticed the site has been cleared and want to verify this with photographic evidence.

---

## Exercises

### Exercise 5.1: Deploy the Community Oracle Contract

```bash
WASM=$(pwd)/target/wasm32v1-none/release/community_oracle.wasm

stellar contract deploy \
  --wasm $WASM \
  --source alice \
  --network testnet \
  --alias popv_oracle
```

---

### Exercise 5.2: Initialize

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- initialize
```

---

### Exercise 5.3: Submit a GPS Photo Report

```bash
# Report type IDs:
#   0 = GpsPhoto
#   1 = GpsVideo
#   2 = FloodReport
#   3 = CompletionVerification
#   4 = QualityReport
#   5 = DamageReport
#   6 = UsageReport

stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- submit_report \
    --citizen alice \
    --pvo_id 2 \
    --milestone_id 3 \
    --report_type 0 \
    --data_hash "ipfs://QmPhotoHash001" \
    --gps_lat 143000000 \
    --gps_lon 1210000000
```

!!! info "GPS Coordinates"
    Coordinates are in integer format (degrees × 10^7). For example:
    - 14.3° N → `143000000`
    - 121.0° E → `1210000000`

??? success "Expected Output"
    Returns a report ID.

---

### Exercise 5.4: Submit a Quality Report

Another citizen submits a quality assessment:

```bash
stellar contract invoke \
  --id popv_oracle \
  --source bob \
  --network testnet \
  -- submit_report \
    --citizen bob \
    --pvo_id 2 \
    --milestone_id 3 \
    --report_type 4 \
    --data_hash "ipfs://QmQualityHash002" \
    --gps_lat 143000000 \
    --gps_lon 1210000000
```

---

### Exercise 5.5: Submit a Completion Verification

A third citizen confirms the milestone is complete:

```bash
# Use a third identity if available, or alice again
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- submit_report \
    --citizen alice \
    --pvo_id 2 \
    --milestone_id 3 \
    --report_type 3 \
    --data_hash "ipfs://QmCompletionHash003" \
    --gps_lat 143000000 \
    --gps_lon 1210000000
```

---

### Exercise 5.6: Check Your Citizen Reputation

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- get_citizen_reputation --citizen alice
```

??? success "Expected Output"
    ```
    total_reports: 2
    verified_reports: 0
    confidence_rating: 50    ← starts at 50
    ```

---

### Exercise 5.7: Calculate Confidence Score

Aggregate all citizen reports for this milestone:

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- calculate_confidence --pvo_id 2 --milestone_id 3
```

??? success "Expected Output"
    Returns a score (0-100). With 3 reports from citizens with rating 50, and none verified yet, the score reflects the average rating and verification ratio.

---

### Exercise 5.8: Verify a Report

An authorized verifier marks a report as verified, boosting the citizen's reputation:

```bash
# Get your report ID from Exercise 5.3
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- verify_report --report_id 1 --verifier_weight 20
```

??? success "Expected Output"
    The report is marked verified. Citizen's confidence_rating increases by 20 (from 50 to 70).

---

### Exercise 5.9: Check Updated Reputation

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- get_citizen_reputation --citizen alice
```

??? success "Expected Output"
    ```
    total_reports: 2
    verified_reports: 1
    confidence_rating: 70    ← increased after verification
    ```

---

### Exercise 5.10: Recalculate Confidence

After verification, confidence should be higher:

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- calculate_confidence --pvo_id 2 --milestone_id 3
```

??? question "Why is it higher?"
    The confidence formula is: `(average_citizen_rating + verification_ratio) / 2`. After verification, both the citizen rating and verification ratio increased.

---

### Exercise 5.11: List All Reports for a PVO

```bash
stellar contract invoke \
  --id popv_oracle \
  --source alice \
  --network testnet \
  -- get_reports_by_pvo --pvo_id 2
```

??? success "Expected Output"
    Returns all 3 reports with their types, timestamps, and verification status.

---

## Confidence Score Formula

```
confidence = (avg_citizen_rating + verification_ratio) / 2

Where:
  avg_citizen_rating = average confidence_rating of all reporting citizens
  verification_ratio = (verified_reports / total_reports) × 100
```

| Factor | Range | Impact |
|--------|-------|--------|
| Citizen rating | 0-100 | Verified reporters carry more weight |
| Verification ratio | 0-100% | More verified reports = higher confidence |
| Final score | 0-100 | Higher = more trustworthy |

---

## Checklist

- [ ] Community Oracle deployed and initialized
- [ ] GPS photo report submitted
- [ ] Quality report submitted
- [ ] Completion verification submitted
- [ ] Confidence score calculated
- [ ] Report verified, citizen reputation increased
- [ ] All reports listed for PVO

---

## Next Steps

➡️ **[Chapter 6: Audit Trail](audit-trail.md)**
