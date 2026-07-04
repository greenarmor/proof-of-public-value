# Chapter 7: Role Guide

Every role in PoPV, what it can do, which contracts it touches, and how the dashboards work.

---

## Role Overview

PoPV uses 13 roles. Each role has a dedicated dashboard in the frontend, tied to live on-chain contracts.

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

### Administrator

| Field | Value |
|-------|-------|
| Alias | `alice` |
| Route | `/admin` |
| Dashboard | Admin Panel |
| Contract | `access_control` |
| Can access | All dashboards |

The Administrator assigns and revokes roles, mints RPT tokens, and manages the system. This is the only role that can call `assign_role` and `revoke_role` on the `access_control` contract.

**Key functions:**

```bash
# Assign a role
stellar contract invoke --source alice --network testnet --send=yes \
  --id CCJKHTUZEDT4E5W2VIW2KSOPKMA5Z6K4QUMYSTQOBFTUSLBSM3OBCMVP \
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
  --id CAJHYJL5E6IPHMYMCODTI5PBLK4TNN2YCT34KAUBIFIL4SJSQW5MVNOD \
  -- create_pvo \
  --creator GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN \
  --title '"Road Paving Project"' \
  --description '"Paving 10km of national road"' \
  --funding_agency GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN \
  --contractor GAZENYNRLICJYECZ66IGSOHH2N246P3CGZMI2DJ2G3RFK6A5WF42LPRW \
  --project_manager GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN \
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
| Contracts | `escrow` (Gate 2: engineer_approval), `pvo_core` (read milestones) |

Licensed professional who verifies that physical work meets specifications. This is **Gate 2** in the 5-gate escrow system.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Pending Reviews | Milestones with submitted evidence not yet approved | `pvo_core` milestones + `escrow.get_escrows_by_pvo` | `escrow.engineer_approve` via TransactionBuilder + Freighter |
| Approved | Escrows where engineer gate passed | `escrow.get_escrow` filtered by `engineer_approval` | None (read-only) |
| All PVOs | Browse all projects, drill into milestones | `pvo_core.get_pvo` + `get_pvo_milestones` | None (read-only) |

**What they do:**

1. Review submitted evidence (photos, drone imagery, specs) with full details
2. Approve milestones on the escrow contract to pass Gate 2
3. View all approved milestones and their payment status
4. Browse all PVOs for project context

```bash
# Gate 2: Engineer approval
stellar contract invoke --source engineer --network testnet --send=yes \
  --id CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6 \
  -- engineer_approve \
  --engineer GB7JLZ33J643CIAKC3APGMTVD2MAYNFI3C4EDDOOYVHOKTWVMDHJ42MN \
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

Conducts field inspections independently from the engineer. While the engineer checks technical specifications and signs off Gate 2 on the escrow, the inspector provides independent verification by submitting `InspectionReport` evidence to the pvo_core contract.

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
    The inspector does not have a dedicated gate in the escrow contract. They submit `InspectionReport` evidence to pvo_core as supporting documentation. The engineer references this when approving Gate 2 on the escrow.

---

### Auditor

| Field | Value |
|-------|-------|
| Alias | `auditor` |
| Routes | `/auditor`, `/compliance` |
| Dashboards | Auditor Dashboard, Compliance Dashboard |
| Contracts | `audit_trail`, `escrow` (Gate 4: compliance_validate), `compliance_engine` |

Audits financial records and checks regulatory compliance. This is **Gate 4** in the 5-gate escrow system. The Auditor and CommissionOnAudit share the same dashboards.

**Dashboard tabs:**

| Tab | What's wired | Data source | Write actions |
|-----|-------------|-------------|--------------|
| Audit Trail | Every audit entry with category, actor, rationale | `audit_trail.get_entry` looped | None (read-only) |
| Compliance Gate | Escrows needing compliance validation | `escrow.get_escrow` filtered for AI-validated, not yet compliance-passed | `escrow.compliance_validate` (Pass/Reject Gate 4) via TransactionBuilder + Freighter |
| Violations | Active compliance violations | `compliance_engine.get_violation` looped | None (read-only) |

**What they do:**

1. Review all audit entries across all PVOs (approvals, payments, evidence, compliance, disputes)
2. Pass or reject compliance validation on escrows at Gate 4
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
  --id CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6 \
  -- dispute \
  --disputer GACVW3NYKARN3C7TJFQVVTOVRPD5BF3KCQDSYUMSEDBGYPFBWWMF7OTC \
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
  --id CCBXEOHTCHQDO57I5UA7XJKLHBGOUEPUNE6I4AEJ4GSHO6QDA2GIFOZM \
  -- commit_grant \
  --donor GDUOHRAMDVFJKC4DOLF2OFGTQXL7NSZASZUNN5IZEXR3ZPQVBWMRW76D \
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
| Dashboard | AI Monitor |
| Contracts | `ai_oracle` |

Monitors the AI risk scoring system. The AI oracle checks for 8 fraud indicators including ghost projects, duplicate invoices, collusion patterns, and budget anomalies. This is **Gate 3** in the 5-gate escrow system.

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
    Gate 2: Engineer approves
    Gate 3: AI validates
    Gate 4: Compliance passes
    Gate 5: Community confirms

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
| `access_control` | `CCJKHTUZEDT4E5W2VIW2KSOPKMA5Z6K4QUMYSTQOBFTUSLBSM3OBCMVP` |
| `pvo_core` | `CAJHYJL5E6IPHMYMCODTI5PBLK4TNN2YCT34KAUBIFIL4SJSQW5MVNOD` |
| `escrow` | `CAD7IAKM6RQFNX3RO5GL65LDFIVHWIHUGB26A7GUDJMUTIJRPDXAXQM6` |
| `grant_commitment` | `CCBXEOHTCHQDO57I5UA7XJKLHBGOUEPUNE6I4AEJ4GSHO6QDA2GIFOZM` |
| `community_oracle` | `CDTZOXPFVGN7SFRMANOJ4C3KN6PHJARPMDLN7ZTLLXJAWUCU4YPGK7RS` |
| `ai_oracle` | `CDR5OICDQYT33V7XPPD63YAUDMKRTWSKN7MD5VPS5K773PVU5AAMID43` |
| `compliance_engine` | `CCRSE76TWXO6TPEWMBKT2577AVYPKKNF5LSWUGUFXKA5XQGPFFZMGRTD` |
| `audit_trail` | `CA2O7WXT6PQJLE4HW5KFDMWI4AJWSPDDO7K2OM756HMMF2E7RJDPBROZ` |
| `procurement_market` | `CCPQYSIVVFOH6CAB5J3QMBZF6EOHJEIVQMZAPMFZCSWRMJRRUMWBJBW3` |
| `pPHP token` | `CA6U3UQ6NXANCOVNFJVQEDCKDZJ5KOIGROG7BU55AMJC2NEWBB2GFLE6` |
| `RPT token` | `CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ` |
