# Chapter 7: Role Guide

Every role in PoPV, what it can do, which contracts it touches, and how the dashboards work.

---

## Role Overview

PoPV uses 14 roles. Each role has a dedicated dashboard in the frontend, tied to live on-chain contracts.

```
Public Pages (no wallet needed)
├── Projects          TransparencyPortal
├── Index             Public department rankings
└── Search            Economic memory / full-text search

Role Dashboards (wallet required)
├── Citizen           → community_oracle (reports), RPT token
├── GovernmentAgency  → pvo_core (create PVOs), procurement_market
├── Contractor        → pvo_core (evidence), escrow (recipient)
├── Engineer          → escrow (engineer gate)
├── Inspector         → escrow (inspector checks)
├── Supplier          → procurement_market (catalog, deliveries)
├── Auditor           → audit_trail, compliance_engine
├── CommissionOnAudit → audit_trail, compliance_engine
├── AntiCorruptionAgency → escrow (dispute), ai_oracle
├── FundingAgency     → escrow (create, fund, release, refund)
├── InternationalDonor → grant_commitment (pledge, track)
├── AIAuditor         → ai_oracle (risk scoring)
├── CentralBank       → pphp_token (mint/redeem), grant_commitment (disburse)
└── Administrator     → access_control, all dashboards
```

---

## The Two Access Control Systems

PoPV has two independent access control layers. Understanding the difference is critical:

### 1. access_control Contract (Frontend Gating)

The `access_control` contract stores role assignments. The frontend reads these to decide which dashboards you can see.

```
assign_role(addr, "Engineer")
    │
    ▼
Stored in access_control contract storage
    │
    ▼
Frontend ProtectedRoute checks: hasRole("Engineer")?
    │
    ▼
If yes → show Engineer Panel
If no  → show Access Denied
```

This is **not** cryptographic authorization. It controls what the UI displays. Anyone with the Engineer role assigned can see the Engineer dashboard.

### 2. Contract-Level require_auth() (On-Chain Gating)

Each contract function calls `require_auth()` on the caller's address. This is real cryptographic authorization enforced by the Stellar network.

```rust
// escrow contract
pub fn fund_escrow(env: Env, funder: Address, escrow_id: u32, amount: i128) {
    funder.require_auth();  // <-- only the funder's signature works
    // ...
}
```

Even if someone can see the dashboard, they cannot call functions reserved for other addresses. The `require_auth()` check is enforced by consensus, not by the frontend.

---

## Role Details

### CentralBank

| Field | Value |
|-------|-------|
| Alias | `central_bank` |
| Route | `/central-bank` |
| Dashboard | Central Bank Dashboard |
| Contracts | `pphp_token`, `grant_commitment` |
| Can mint | ✅ (only role) |

The CentralBank controls monetary supply. It mints pPHP to the FundingAgency (government budget allocation), disburses donor pledges, and redeems pPHP when contractors cash out. This role is separated from the Administrator - the Administrator manages the system but cannot mint or redeem currency.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Direct Fund | Mint pPHP to FundingAgency | `pphp_token.mint(caller, to, amount)` | CentralBank-gated mint |
| Pledges | Donor pledge approval + mint + disburse | `grant_commitment.get_all_grants`, `pphp_token.mint` | Two-step: mint + mark disbursed |
| Redeem | Contractor cash-out (burn pPHP) | `pphp_token.redeem(caller, from, amount)` | CentralBank-gated redeem |

**Key functions:**

```bash
# Mint pPHP to Funding Agency
stellar contract invoke --source central_bank --network testnet --send=yes \
  --id <pphp_token_address> \
  -- mint \
  --caller GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO \
  --to GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO \
  --amount 100000000000000000

# Redeem (cash-out contractor)
stellar contract invoke --source central_bank --network testnet --send=yes \
  --id <pphp_token_address> \
  -- redeem \
  --caller GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO \
  --from GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF \
  --amount 50000000000000000
```

---

### Administrator

| Field | Value |
|-------|-------|
| Alias | `alice` |
| Route | `/admin` |
| Dashboard | Admin Panel |
| Contract | `access_control` |
| Can access | All dashboards |

The Administrator assigns and revokes roles, mints RPT tokens, and manages the system. This is the only role that can call `assign_role` and `revoke_role` on the `access_control` contract. **Note:** The Administrator CANNOT mint or redeem pPHP - that is exclusively the CentralBank role.

**Key functions:**

```bash
# Assign a role
stellar contract invoke --source alice --network testnet --send=yes \
  --id CCAOA7UZDDRVB3Y6RPV5RZXWXODREUSNDDZQLD3EI2KZVGAJIGG4WWMN \
  -- assign_role \
  --assigner GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV \
  --address <recipient_address> \
  --role '"FundingAgency"'
```

---

### GovernmentAgency

| Field | Value |
|-------|-------|
| Alias | `agency` |
| Routes | `/agency`, `/procurement` |
| Dashboards | Agency Dashboard, Procurement Marketplace |
| Contracts | `pvo_core`, `procurement_market` |

Creates PVOs (Public Value Objects), allocates budgets, defines milestones, and manages procurement tenders. This is the role that starts the project lifecycle.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Project Overview | All PVOs from chain | `pvo_core.get_pvo_count` + loop | None (read-only) |
| New PVO | Form with all PVO fields | — | `pvo_core.create_pvo` via raw TransactionBuilder + Freighter |
| Define Milestone | Form with evidence type picker | — | `pvo_core.create_milestone` with `Vec<EvidenceType>` encoding via TransactionBuilder |

**What they do:**

1. Create a PVO with title, description, budget, department, municipality, contractor, and fund source
2. Define milestones with required evidence types and community confirmation thresholds
3. Open procurement tenders for contractor bidding (via Procurement Marketplace at `/procurement`)
4. Monitor project progress through the Agency Dashboard overview table

```bash
# Create a PVO on-chain
stellar contract invoke --source agency --network testnet --send=yes \
  --id CCWMZE527DTPNR4KVKTJMOUQ6A4ITKXNNO2NFDEVESMGCXZVWD6AZGE4 \
  -- create_pvo \
  --creator GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2 \
  --title '"Road Paving Project"' \
  --description '"Paving 10km of national road"' \
  --funding_agency GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2 \
  --contractor GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF \
  --project_manager GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2 \
  --department '"DPWH"' \
  --municipality '"Quezon City"' \
  --total_budget 10000000000 \
  --fund_source '"National Budget 2026"'
```

!!! note "project_manager parameter"
    The `project_manager` field exists in the pvo_core contract as vestigial data. It is no longer used for authorization (the ProjectManager role was removed). Pass the agency's own address.

---

### Contractor

| Field | Value |
|-------|-------|
| Alias | `contractor` |
| Route | `/contractor` |
| Dashboard | Contractor Portal |
| Contracts | `pvo_core` (evidence), `escrow` (recipient) |

Executes projects and submits evidence for each milestone. The contractor is the **recipient** in escrow contracts - when all gates pass, tokens are released to the contractor's wallet.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| My Projects | Contractor's assigned PVOs | `pvo_core.get_pv_os_by_contractor` + `get_pvo_milestones` | None (read-only) |
| Submit Evidence | IPFS upload + form | — | `pvo_core.submit_evidence` via TransactionBuilder + Freighter (Gate 1) |
| Payments | Escrows where recipient = contractor | `escrow.get_escrow` filtered by address | None (read-only) |
| History | All submitted evidence across PVOs | `pvo_core` milestone evidence arrays | None (read-only) |

**What they do:**

1. View assigned PVOs and drill into milestone details with 4-gate progress bars
2. Submit evidence (drone imagery, GPS, photos, engineering reports) via IPFS, then recorded on-chain as Gate 1
3. Track escrow status - see which gates have passed and whether payment was released
4. View full evidence submission history with verification status

---

### Engineer

| Field | Value |
|-------|-------|
| Alias | `engineer` |
| Route | `/engineer` |
| Dashboard | Engineer Panel |
| Contracts | `escrow` (Gate 1: engineer_approval), `pvo_core` (read milestones) |

Licensed professional who verifies that physical work meets specifications. This is **Gate 1** in the 5-gate escrow system.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Pending Reviews | Milestones with submitted evidence not yet approved | `pvo_core` milestones + `escrow.get_escrows_by_pvo` | `escrow.engineer_approve` via TransactionBuilder + Freighter |
| Approved | Escrows where engineer gate passed | `escrow.get_escrow` filtered by `engineer_approval` | None (read-only) |
| All PVOs | Browse all projects, drill into milestones | `pvo_core.get_pvo` + `get_pvo_milestones` | None (read-only) |

**What they do:**

1. Review submitted evidence (photos, drone imagery, specs) with full details
2. Approve milestones on the escrow contract to pass Gate 1
3. View all approved milestones and their payment status
4. Browse all PVOs for project context

```bash
# Gate 1: Engineer approval
stellar contract invoke --source engineer --network testnet --send=yes \
  --id CBZPT5NLMKVVV2FA3QDDZXXGFOI6D4KYVAO6QC5N2YFPWZ3DHJZV6S6X \
  -- engineer_approve \
  --engineer GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ \
  --escrow_id 1
```

---

### Inspector

| Field | Value |
|-------|-------|
| Alias | `inspector` |
| Route | `/inspector` |
| Dashboard | Inspector Panel |
| Contracts | `pvo_core` (submit InspectionReport evidence) |

Conducts field inspections independently from the engineer. While the engineer checks technical specifications and signs off Gate 1 on the escrow, the inspector provides independent verification by submitting `InspectionReport` evidence to the pvo_core contract.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| All Projects | Every PVO with milestone drill-down | `pvo_core.get_pvo` + `get_pvo_milestones` | None (read-only) |
| Submit Inspection | IPFS upload + form | — | `pvo_core.submit_evidence` (InspectionReport) via TransactionBuilder + Freighter |
| My Reports | InspectionReport evidence filtered by submitter | `pvo_core` milestone evidence arrays | None (read-only) |
| Evidence History | All evidence across all PVOs | `pvo_core` milestone evidence arrays | None (read-only) |

**What they do:**

1. Browse all PVOs with contractor, budget, location, and status
2. Submit inspection reports on-chain with Pass/Conditional/Fail ratings
3. Upload photo evidence to IPFS as supporting documentation
4. Track all inspection reports submitted with verification status

!!! note "No escrow gate"
    The inspector does not have a dedicated gate in the escrow contract. They submit `InspectionReport` evidence to pvo_core as supporting documentation. The engineer references this when approving Gate 1 on the escrow.

### Engineer vs Inspector: The Check-and-Balance Pair

In Philippine public works, these are two separate people from two separate organizations:

| | Engineer (Consultant) | Inspector (DPWH / LGU) |
|---|----------------------|------------------------|
| **Employer** | Hired by contractor | Government employee |
| **Sector** | Private | Public |
| **What they verify** | Structural integrity, spec compliance | Physical conditions on site |
| **Contract function** | `escrow.engineer_approve()` | `pvo_core.submit_evidence(InspectionReport)` |
| **Escrow gate** | ✅ Gate 1 — **required for payment** | ❌ No gate — supporting evidence |
| **Effect on money** | Blocks or releases funds | Documents conditions, no financial impact |
| **Dashboard** | `/engineer` | `/inspector` |
| **Conflict check** | Engineer is paid by contractor → potential bias | Inspector is independent → accountability layer |

**Why both?** The engineer is paid by the contractor and signs off on payment release — a potential conflict of interest. The inspector works for the government and provides independent evidence. If an engineer approves shoddy work, the inspector's field report with photos creates an audit trail. The engineer can be penalized via the reputation contract for false approvals.

**In the escrow flow:**

```
Contractor submits evidence
    │
Engineer reviews → approves Gate 1 → FUNDS CAN BE RELEASED
    │                    │
Inspector visits site → submits InspectionReport → AUDIT TRAIL EXISTS
                         (doesn't block or release funds)
```

The inspector's report is **evidence**, not a gate. It documents what the inspector found so that if the engineer wrongly approves, there's a permanent on-chain record proving otherwise.

### Why the Engineer Gate Is Intentionally the Weakest

In Philippine public works, the engineer is paid by the contractor. This is **not a bug in PoPV — it's a reality** that the system is designed around:

```
Contractor pays Engineer → Engineer reviews Contractor's work → CONFLICT
```

PoPV does not try to prevent this conflict. Instead, it **assumes it exists** and layers independent verification on top:

```
Gate 1: Engineer approves  ← weakest, single source, potential bias
    ↓
Gate 2: Compliance checks   ← independent constitutional authority (COA)
    ↓
Gate 3: Community oracle    ← verified GPS field reports from citizens
    ↓
Gate 4: Community confirms  ← threshold of independent witnesses met
    ↓
Gate 5: AI Oracle validates ← cross-references patterns from ALL contracts
    ↓
AntiCorruption can dispute ANY escrow at ANY time
    ↓
Reputation ledger tracks EVERY decision permanently
```

A single compromised gate cannot release money. Even if the engineer colludes with the contractor, four other independent verifiers must also say yes. And if any one of them says no, the funds stay locked.

The system's security comes from **distribution of trust**, not from perfect individuals. Every gate is designed to be checkable by the others.

### Engineer Reputation & Accountability

The engineer's **reputation score** is visible on their dashboard. It tracks their professional integrity on-chain:

The engineer's **reputation score** is visible on their dashboard. It tracks their professional integrity on-chain:

```
Engineer approves Gate 1 → escrow proceeds
    │
Inspector submits contradicting report → Audit trail created
    │
Auditor flags engineer via record_audit_finding(engineer, severity) → −5×severity from reputation
    │
Engineer's reputation drops → visible on their dashboard
    │
Future contractors see low-reputation engineer → less likely to hire
```

**How to penalize an engineer (Auditor action):**

```bash
# Auditor calls reputation contract to dock engineer's score
stellar contract invoke --source auditor --network testnet --send=yes \
  --id CDWMWDIVX5I2C2XH42WVEVA5JXW6HAWYRRLWSMYZHTO3OMEJRZ6EVVLU \
  -- record_audit_finding \
  --caller GAAL24R63KQJADAOLLMC6PLK7VZW2VCYBDLJYHT6X73NY73W7R4XIAYN \
  --entity GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ \
  --severity 5
```

This creates a permanent record of the finding and reduces the engineer's score by 25 points (severity 5 × 5). The penalty is visible in the engineer's reputation badge on their dashboard and in all reputation queries.

---

### Inspector vs Auditor: Physical vs Financial Oversight

These are two independent government roles checking different things at different levels:

| | Inspector (DPWH / LGU) | Auditor (COA) |
|---|---|----------------------|
| **Employer** | Government agency (DPWH, LGU) | Constitutional office (Commission on Audit) |
| **Level** | Physical — site conditions | Financial / regulatory — procurement law, budget rules |
| **What they check** | Concrete thickness, asphalt quality, drainage | Receipts, bidding process, budget allocation, safety regs |
| **Evidence type** | Photos, GPS coordinates, inspection notes | Audit entries, compliance reports, violation records |
| **Contract function** | `pvo_core.submit_evidence(InspectionReport)` | `escrow.compliance_validate()` + `audit_trail` |
| **Escrow gate** | ❌ No gate — supporting evidence | ✅ Gate 2 — **required for payment** |
| **Effect on money** | Documents conditions, no financial impact | Blocks or releases funds |
| **Dashboard** | `/inspector` | `/auditor`, `/compliance` |
| **How they override engineer** | Submit photos proving poor quality → audit trail | Reject compliance → Gate 2 fails → funds stay locked |

**Why both?** The inspector catches what's **wrong on the ground** (cracked concrete, uneven asphalt). The auditor catches what's **wrong on paper** (inflated prices, skipped bidding, regulatory violations). An inspector's photo of bad concrete is evidence. An auditor's rejection of compliance stops payment.

**In the escrow flow:**

```
Engineer approves Gate 1
    │
Inspector visits → submits InspectionReport → "Foundation has cracks"
    │                                            (doesn't block funds)
Auditor reviews → sees inspector's photos + engineer's approval
    │
Auditor rejects Gate 2 → FUNDS STAY LOCKED
    │            (COA has constitutional override authority)
AntiCorruption sees pattern → disputes escrow → funds frozen
```

The inspector documents. The auditor acts.

---

### Auditor

| Field | Value |
|-------|-------|
| Alias | `auditor` |
| Routes | `/auditor`, `/compliance` |
| Dashboards | Auditor Dashboard, Compliance Dashboard |
| Contracts | `audit_trail`, `escrow` (Gate 2: compliance_validate), `compliance_engine` |

Audits financial records and checks regulatory compliance. This is **Gate 2** in the 5-gate escrow system. The Auditor and CommissionOnAudit share the same dashboards.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Audit Trail | Every audit entry with category, actor, rationale | `audit_trail.get_entry` looped | None (read-only) |
| Compliance Gate | Escrows needing compliance validation | `escrow.get_escrow` filtered for engineer-approved, not yet compliance-passed | `escrow.compliance_validate` (Pass/Reject Gate 2) via TransactionBuilder + Freighter |
| Violations | Active compliance violations | `compliance_engine.get_violation` looped | None (read-only) |

**What they do:**

1. Review all audit entries across all PVOs (approvals, payments, evidence, compliance, disputes)
2. Pass or reject compliance validation on escrows at Gate 2
3. View active regulatory violations from the compliance engine
4. Share dashboard access with CommissionOnAudit (COA)

---

### CommissionOnAudit (COA)

| Field | Value |
|-------|-------|
| Alias | `coa` |
| Routes | `/auditor`, `/compliance` |
| Dashboards | Auditor Dashboard, Compliance Dashboard |
| Contracts | `audit_trail`, `compliance_engine` |

The Commission on Audit is the Philippines' constitutional fiscal watchdog. In PoPV, COA has the same dashboard access as Auditors but represents the regulatory authority. COA provides independent oversight of government spending.

---

### AntiCorruptionAgency

| Field | Value |
|-------|-------|
| Alias | `anti_corruption` |
| Route | `/anticorruption` |
| Dashboard | Anti-Corruption Dashboard |
| Contracts | `escrow` (dispute), `ai_oracle`, `audit_trail` |

Investigates fraud and can **dispute** an escrow at any time before release. When an escrow is disputed, funds are locked and can only be refunded (not released).

**What they do:**

1. Monitor all escrows and AI risk scores across 4 live contracts
2. Review audit trail entries for suspicious patterns
3. File a dispute on any escrow to freeze funds pending investigation

```bash
# Dispute an escrow
stellar contract invoke --source anti_corruption --network testnet --send=yes \
  --id CBZPT5NLMKVVV2FA3QDDZXXGFOI6D4KYVAO6QC5N2YFPWZ3DHJZV6S6X \
  -- dispute \
  --disputer GBU4SHHRZPIHJL3BX6LYQMS5WW4HYXENBHSUHSEFPZQCZQ25ZOQWC6E7 \
  --escrow_id 1
```

---

### FundingAgency

| Field | Value |
|-------|-------|
| Alias | `funding_agency` |
| Route | `/funder` |
| Dashboard | Funding Agency Dashboard |
| Contracts | `escrow` (create, fund, release, refund), `grant_commitment` (read) |

The FundingAgency is the domestic budget authority. They create escrows, fund them with real tokens, and can release or refund based on gate status.

**What they do:**

1. View all escrows and their 5-gate progress
2. Create new escrows (recipient = contractor, amount in centavos, token = pPHP)
3. Fund escrows with real pPHP token transfers
4. Release funds when all gates pass
5. Refund funds when an escrow is disputed
6. View **Donor Commitments** tab to see international donor pledges

!!! info "Donor Commitments Tab"
    The Funding Agency dashboard includes a **Donor Commitments** tab that reads from the `grant_commitment` contract. This shows all international donor pledges (World Bank, JICA, USAID, etc.) so the agency knows which projects have external funding commitments before creating escrows.

---

### InternationalDonor

| Field | Value |
|-------|-------|
| Alias | `international_donor` |
| Route | `/donor` |
| Dashboard | International Donor Dashboard |
| Contracts | `grant_commitment` |

International donors follow a **commit then disburse** model, exactly like real development finance.

!!! example "How donor funding works"
    A donor from the World Bank does **not** wire money to the Funding Agency. Instead:

    1. **Commit** - The donor records a pledge on the `grant_commitment` contract. This stores the organization name, PVO ID, amount, and donor address on-chain. **No tokens move.** It is a public, immutable promise.

    2. **Disburse** - When the Funding Agency is ready, they create an escrow for the PVO and fund it with real tokens. The donor then marks the commitment as "Disbursed."

    3. **Complete** - After the escrow releases funds through all 5 gates, the donor marks the commitment as "Completed."

**Commit Funds tab:**

The Commit Funds form calls `commit_grant` on-chain via a signed transaction. The donor selects their organization, enters a PVO ID and amount (in centavos), and signs with Freighter. The pledge is recorded permanently.

```bash
# Commit a grant pledge on-chain
stellar contract invoke --source international_donor --network testnet --send=yes \
  --id CDTJ5YY4VX6UA6YMKSSPDLIUXKXENUV6JYKMOBM6762XTBGGNQXFFWRK \
  -- commit_grant \
  --donor GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44 \
  --pvo_id 1 \
  --amount 500000000 \
  --org_name '"World Bank"'
```

**Portfolio tab:** Reads `get_all_grants()` to show every pledge with org name, amount, and status.

**Transparency tab:** Shows funds flow and lets the donor update the grant status (Committed -> Disbursed -> Completed).

??? question "Why not send tokens directly?"
    In real development finance, donors pledge at conferences and disburse months later after conditions are met (bidding, procurement, contractor selection). PoPV mirrors this. The commitment proves the promise was made. The escrow proves the money was actually sent and held by the contract until verified. If the donor sent tokens directly to the funding agency, there would be no escrow, no 5-gate verification, and no way to prevent the funds from being diverted.

---

### Supplier

| Field | Value |
|-------|-------|
| Alias | `supplier` |
| Route | `/supplier` |
| Dashboard | Supplier Portal |
| Contracts | `procurement_market` |

Suppliers browse procurement tenders and submit bids on-chain. They participate in integrity-weighted bidding alongside contractors.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Tenders | All open procurement tenders | `procurement_market.get_tender` looped | None (read-only) |
| Submit Bid | Tender selector + amount form | — | `procurement_market.submit_bid` via TransactionBuilder + Freighter |
| My Bids | Bids filtered by supplier address | `procurement_market.get_bids_by_tender` filtered | None (read-only) |

**What they do:**

1. Browse all procurement tenders with budgets and agency info
2. Submit bids to open tenders on-chain
3. Track all bids submitted by their address

---

### AIAuditor

| Field | Value |
|-------|-------|
| Alias | `ai_auditor` |
| Route | `/ai` |
| Dashboard | AI Monitor (public) |
| Contracts | `ai_oracle` |

The AI Oracle performs automated cross-contract analysis for fraud detection, risk prediction, GPS validation, digital twin simulation, and image verification. This is **Gate 5** in the 5-gate escrow system.

The dashboard is **public** — anyone can view AI findings at `/ai` without a wallet. See **[Appendix C: How the AI Oracle Works](ai-oracle.md)** for a comprehensive explanation of the heuristic engine, architecture, and production deployment options.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Fraud | Fraud detection results with indicators | `ai_oracle.get_fraud_count` + `get_fraud_detection` | None (read-only) |
| Risk | Contractor risk predictions per PVO | `ai_oracle.get_latest_risk_prediction` per contractor | None (read-only) |
| Image | Image verification reports | `ai_oracle.get_image_verification` looped | None (read-only) |
| Digital Twin | Cost simulation per PVO | `ai_oracle.get_digital_twin` per PVO | None (read-only) |
| Geo Risk | Geo-risk assessments per PVO | `ai_oracle.get_geo_risk` per PVO | None (read-only) |
| GPS | GPS coordinate validations | `ai_oracle.get_gps_validation` looped | None (read-only) |

**What they do:**

1. View fraud detection results with risk scores and indicator flags
2. Check contractor risk predictions (delay risk, budget overrun)
3. Verify drone/satellite imagery authenticity
4. Monitor digital twin cost simulations
5. Validate GPS coordinates against expected project locations
6. Submit fraud detections, risk predictions, and validations via `ai_oracle` contract functions

---

### Citizen

| Field | Value |
|-------|-------|
| Alias | `citizen` |
| Route | `/citizen` |
| Dashboard | Citizen Interface |
| Contracts | `community_oracle` (reports), RPT token |
| Token Required | RPT (1 minimum balance) |

Citizens are the **fifth gate** - community verification. They visit project sites, take GPS-tagged photos, and submit reports via IPFS. This ground-truth layer is what makes PoPV resistant to ghost projects.

**What they do:**

1. Create an RPT token trustline (required to submit reports)
2. Submit GPS-tagged photo reports with IPFS evidence
3. Verify other citizens' reports to build community consensus
4. Their reports contribute to the `community_confirmation` count on escrows

See **[Chapter 5: Community Verification](community-verification.md)** for the full guide on RPT tokens, report types, and the verification process.

---

## Grant Commitment Lifecycle

This diagram shows how international donor pledges connect to the escrow system:

```
Step 1: COMMIT (no tokens move)
    InternationalDonor → grant_commitment.commit_grant()
    Stores: {donor, pvo_id, amount, org_name, status: "Committed"}
    Result: Public, immutable pledge on-chain

Step 2: FUNDING AGENCY SEES THE PLEDGE
    FundingAgency opens dashboard → "Donor Commitments" tab
    Reads: grant_commitment.get_all_grants()
    Decision: Create escrow for this PVO

Step 3: ESCROW CREATED AND FUNDED (tokens move)
    FundingAgency → escrow.create_escrow(pvo_id, amount, contractor)
    FundingAgency → escrow.fund_escrow(escrow_id, amount)
    pPHP tokens transfer from funder to escrow contract

Step 4: 5 GATES PASS
    Gate 1: Contractor submits evidence
    Gate 1: Engineer approves
    Gate 2: Compliance passes
    Gate 3: Community oracle verifies
    Gate 4: Community confirms (threshold)
    Gate 5: AI validates

Step 5: RELEASE (tokens move)
    escrow.release()
    pPHP tokens transfer from escrow to contractor

Step 6: DONOR UPDATES STATUS
    InternationalDonor → grant_commitment.update_status(Disbursed)
    InternationalDonor → grant_commitment.update_status(Completed)
```

---

## Dashboard Access Control Matrix

| # | Role | Route(s) | Dashboard | Contract(s) |
|---|------|----------|-----------|-------------|
| 1 | Administrator | `/admin` + all | Admin Panel | `access_control` |
| 2 | GovernmentAgency | `/agency`, `/procurement` | Agency, Procurement | `pvo_core`, `procurement_market` |
| 3 | Contractor | `/contractor` | Contractor Portal | `pvo_core`, `escrow` |
| 4 | Engineer | `/engineer` | Engineer Panel | `escrow` |
| 5 | Inspector | `/inspector` | Inspector Panel | `pvo_core` |
| 6 | Auditor | `/auditor`, `/compliance` | Auditor, Compliance | `audit_trail`, `compliance_engine` |
| 7 | CommissionOnAudit | `/auditor`, `/compliance` | Auditor, Compliance | `audit_trail`, `compliance_engine` |
| 8 | Supplier | `/supplier` | Supplier Portal | `procurement_market` |
| 9 | AntiCorruptionAgency | `/anticorruption` | Anti-Corruption | `escrow`, `ai_oracle`, `audit_trail` |
| 10 | FundingAgency | `/funder` | Funding Agency | `escrow`, `grant_commitment` |
| 11 | InternationalDonor | `/donor` | International Donor | `grant_commitment` |
| 12 | AIAuditor | `/ai` | AI Monitor | `ai_oracle` |
| 13 | Citizen | `/citizen` | Citizen Interface | `community_oracle`, RPT token |
| - | No role | `/`, `/index`, `/memory` | Public pages only | None |

---

## Contract Reference

| Contract | Testnet ID |
|----------|-----------|
| `access_control` | `CCAOA7UZDDRVB3Y6RPV5RZXWXODREUSNDDZQLD3EI2KZVGAJIGG4WWMN` |
| `pvo_core` | `CCWMZE527DTPNR4KVKTJMOUQ6A4ITKXNNO2NFDEVESMGCXZVWD6AZGE4` |
| `escrow` | `CBZPT5NLMKVVV2FA3QDDZXXGFOI6D4KYVAO6QC5N2YFPWZ3DHJZV6S6X` |
| `grant_commitment` | `CDTJ5YY4VX6UA6YMKSSPDLIUXKXENUV6JYKMOBM6762XTBGGNQXFFWRK` |
| `community_oracle` | `CBPOFXY2W6XGT4SHLSTJHPCV7VIQH3Z4ZSUOZA2CVYBUV7XQVUPZVQGS` |
| `ai_oracle` | `CAVD64WSZLOVV35RFKPG2OFVRCR3F3LGXQYSFR2JTDSGIBYKBXKUBP25` |
| `compliance_engine` | `CBUKSKFM26BMIMC7H7SSJ2A4LUDX5IREANPWCHWR54R5T7BDHUUCWPBH` |
| `audit_trail` | `CBQPQ5ISUYF37RM23G4UJB3RAEAT2F74PZHLNW7ZVCGAGEXZFL2E4LTO` |
| `procurement_market` | `CBKTM7F32KJJWVGYRCNNJQNXK5DHEISJMFESXAAJJYDSDSJYMRKJSHUW` |
| `pPHP token` | `CANQ5IHIQQIXSWU3LT534HUBJBKCSLL3FPU2NW6WA2MMN2D5Y5DKWA2Y` |
| `RPT token` | `CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ` |
