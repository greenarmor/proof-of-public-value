# Appendix A: Glossary of Terms

> Every term used in Proof of Public Value, explained.

---

## Core Concepts

### PVO (Public Value Object)

A **Public Value Object** is the digital representation of a real-world public infrastructure project on the Stellar blockchain. Think of it as a "programmable government project."

Every PVO stores:
- **Title**  -  e.g., "C-5 Road Extension Phase II"
- **Department**  -  e.g., "DPWH" (Department of Public Works and Highways)
- **Municipality**  -  where the project is physically located
- **Total Budget**  -  locked in pPHP SAC atomic units (pesos × 10⁷)
- **Contractor**  -  the company doing the work
- **Funding Agency**  -  the entity providing the budget
- **Fund Source**  -  GAA (General Appropriations Act), ODA (Official Development Assistance), etc.
- **Status**  -  Proposed → InProgress → Completed → Suspended / Terminated
- **Public Value Score**  -  a 0-100 rating computed from milestones, community reports, and compliance
- **Milestones**  -  the list of project phases that must be completed before full payment

**In one sentence:** A PVO is a government project turned into a smart contract that cannot be paid until proven complete.

---

### Milestone

A **Milestone** is a single phase or deliverable within a PVO. Instead of paying the entire project budget upfront (the root cause of corruption), the project is broken into milestones  -  each one independently verified before any money is released.

Each milestone has:
- **Title**  -  e.g., "Foundation and Piling", "Bridge Deck Installation"
- **Description**  -  what work this phase covers
- **Budget**  -  how much of the total PVO budget this phase is worth
- **Status**  -  Pending → EvidenceSubmitted → EngineerApproved → AIValidated → CompliancePassed → CommunityVerified → Released
- **Required Evidence**  -  what the contractor must submit (e.g., drone imagery, GPS coordinates, engineering reports, photos)
- **Community Required**  -  how many verified citizen field reports are needed just for this milestone
- **Community Confirmations**  -  how many verified reports have been submitted so far
- **Engineer Approved**  -  has a licensed engineer signed off?
- **AI Validated**  -  has the AI oracle run fraud/anomaly detection?
- **Compliance Passed**  -  has procurement/safety compliance been checked?

**Each milestone has its own escrow**  -  money for each phase is locked independently and can only be released when that specific phase passes all gates.

---

## Escrow System

### Escrow

An **Escrow** is a smart contract lockbox that holds funds (pPHP tokens) and releases them **only when 5 independent conditions are met**. No single person  -  not the contractor, not the funding agency, not the administrator  -  can release funds alone.

**Properties:**
- **Asset-agnostic**  -  can hold pPHP (testnet), USDC (mainnet), or any Stellar token
- **5-gate conditional release**  -  all gates must pass before any peso moves
- **Independent per milestone**  -  each milestone gets its own escrow, so if one phase fails, the rest remain unaffected
- **Auto-completes PVO**  -  when the last escrow is released, the PVO automatically transitions to "Completed"
- **Dispute window**  -  anyone can dispute before release, pausing all escrows under that PVO

**Lifecycle:**
1. **Created**  -  funding agency creates the escrow, specifying recipient, PVO, milestone, and community threshold
2. **Funded**  -  funding agency deposits the exact milestone amount (in pPHP SAC units)
3. **Gates Progress**  -  engineer approves → compliance → community oracle → community confirmations → AI validates
4. **Ready**  -  all 5 gates passed; anyone can trigger release
5. **Released**  -  funds transferred to contractor; PVO auto-completes if this was the last milestone

---

### The 5 Gates (Why "No Proof. No Payment." Works)

| Gate | Who | What Happens |
|------|-----|-------------|
| **1. Engineer Approval** | Licensed Engineer | Physically inspects the work. Signs off that the milestone meets structural specifications. |
| **2. Compliance Validation** | Auditor / COA | Checks procurement law compliance, budget rules, safety regulations, anti-corruption requirements. |
| **3. Community Oracle** | Citizens (via reports) | The Community Oracle contract checks whether verified citizen reports exist for the project. Reports must pass verification. |
| **4. Community Confirmations** | Citizens (GPS field reports) | Citizens visit the site, submit GPS-tagged evidence. The counter must reach the threshold set when the escrow was created. |
| **5. AI Risk Check** | AI Oracle | Scans ALL evidence collected through gates 1-4 for anomalies: duplicate GPS, metadata tampering, suspicious patterns. Runs last for maximum data. |

**Key insight:** Gates 3 and 4 are different. Gate 3 checks if the **oracle** has verified reports on file. Gate 4 counts how many **unique verified reports** exist  -  this is the threshold you set.

---

### Community Confirmations Threshold

When creating an escrow, the funding agency sets **how many verified citizen GPS field reports are required** to unlock the final gate. This is the **community proof-of-life** for the project.

**How it works:**
1. Citizens visit the project site with the mobile app
2. They submit GPS-tagged reports (photos, videos, descriptions)
3. The Community Oracle verifies each report (checks GPS plausibility, prevents duplicates)
4. Each verified report increments the `community_confirmation` counter on the escrow
5. When `community_confirmation ≥ community_required`, the final gate unlocks

**Strategic use:**
- **Low-risk projects** (visible infrastructure in urban areas): set to 1-3
- **Medium-risk projects** (rural bridges, school buildings): set to 3-5
- **High-risk projects** (mountain roads, flood control, areas with corruption history): set to 5-10
- **Maximum transparency**: set higher  -  forces multiple independent on-the-ground verifications

---

## Token System

### pPHP (Philippine Peso Testnet Token)

A **Soroban SAC token** (Stellar Asset Contract) on testnet that simulates the Philippine Peso. Properties:

- **SAC (Stellar Asset Contract)**  -  a native Stellar token standard with 7 decimals
- **Unlimited mintable supply**  -  admin can mint any amount for testing
- **Testnet only**  -  has no real-world value, no peg, no liquidity
- **Purpose**  -  allows testing with realistic peso amounts (millions, billions) that would be impossible with Friendbot's 10K XLM limit

**On mainnet**, pPHP is replaced by a real backed asset (USDC, EURC, or a peso-backed stablecoin). The escrow contract code is identical  -  only the token address changes.

---

### SAC Atomic Units

All on-chain amounts in PoPV are stored in **SAC atomic units**: pesos × 10⁷ (10,000,000).

| Amount | In SAC Units |
|--------|-------------|
| ₱1 | 10,000,000 |
| ₱1,000 | 10,000,000,000 |
| ₱1,000,000 | 10,000,000,000,000 |
| ₱500,000,000 | 5,000,000,000,000,000 |

**Why?** The Stellar SAC token standard uses 7 decimal places. This is the smallest indivisible unit of the token. The frontend divides by `PPHP_SCALE` (10⁷) to display human-readable pesos.

---

### RPT (Reputation Token)

A **soulbound reputation token** that tracks citizen trustworthiness. Properties:

- **Required for reporting**  -  citizens must hold at least 1 RPT to submit field reports (anti-spam gate)
- **Minimum balance gate**  -  `set_citizen_credential(min_balance: 1)` on the reputation contract
- **Soulbound**  -  cannot be transferred between wallets
- **Minted by admin**  -  only the administrator can issue RPT tokens
- **Scoring**  -  reputation score is computed from report accuracy, verification rate, and community endorsements

**This is NOT bypassed**  -  it's a real security gate. Without RPT, a wallet cannot submit reports. This prevents Sybil attacks (one person creating thousands of fake wallets to fake community confirmations).

---

## Contracts

### Access Control (access_control)

The **role-based permission system**. Every action in PoPV checks the caller's role before allowing execution. 13 roles:

| Role | Can Do |
|------|--------|
| Citizen | Submit reports, verify others' reports |
| Engineer | Approve milestones (physical inspection) |
| Inspector | Verify evidence quality |
| Contractor | Submit milestone evidence |
| Supplier | Register in procurement market |
| GovernmentAgency | Create PVOs, define milestones |
| Auditor | Compliance validation |
| CommissionOnAudit | Final compliance sign-off |
| AntiCorruptionAgency | Investigate disputes, flag projects |
| FundingAgency | Create/fund escrows, disburse grants |
| InternationalDonor | Commit grants, pledge funds |
| Administrator | System management, role assignment |
| AIAuditor | Run AI validation on evidence |

The access control contract is the **first contract deployed**  -  all other contracts depend on it for role verification.

---

### Grant Commitment (grant_commitment)

The **international donor pledge system**. Models real-world development finance:

1. **Commit**  -  Donor records a pledge specifying PVO, amount, and org name. The pledge must **exactly match** the PVO's remaining budget (prevents over/under-pledging).
2. **Disburse**  -  Admin mints pPHP to the funding agency and marks the grant as disbursed.
3. **Complete**  -  After escrow release, the grant is marked completed.

**Exact-amount enforcement**: the contract cross-calls `pvo_core.get_pvo_budget()` and sums existing grants. If the pledge doesn't equal the remaining budget, the transaction is rejected on-chain.

---

### Community Oracle (community_oracle)

The **citizen report verification engine**. Handles:

- Report submission (GPS, media, description)
- Report verification (cross-checks GPS plausibility, prevents duplicate reports)
- Submission tracking per PVO/milestone
- Verified report counting for escrow gate satisfaction

Works in tandem with the **reputation contract**  -  only citizens with RPT tokens can submit.

---

### Compliance Engine (compliance_engine)

Validates that each milestone meets:
- Procurement law requirements
- Budget allocation rules
- Safety and environmental regulations
- Anti-corruption checks

---

### AI Oracle (ai_oracle)

The **fraud detection system**. Scans submitted evidence for:
- Duplicate or tampered GPS coordinates
- Metadata anomalies in photos/videos
- Statistical outliers in budget vs. output
- Pattern matching against known fraud signatures

Outputs a risk score and pass/fail decision.

---

### Escrow (escrow)

The **fund locker**. See [Escrow System](#escrow-system) above for full details.

---

### PVO Core (pvo_core)

The **project lifecycle manager**. Handles:
- PVO creation and status updates
- Milestone creation with evidence requirements
- Evidence submission tracking
- Milestone status progression (Pending → Released)
- Public value score computation

---

### Reputation (reputation)

The **citizen integrity graph**. Tracks:
- RPT token balances (soulbound)
- Report submission history
- Verification accuracy
- Community trust score

---

### Audit Trail (audit_trail)

The **immutable decision log**. Records every action:
- Who (cryptographic address)
- What (action type, target ID)
- When (blockchain timestamp)
- Why (rationale, supporting evidence hash)

All entries are on-chain and cannot be deleted or modified.

---

### Public Index (public_index)

The **national transparency dashboard**. Computes:
- Department rankings by value score
- Municipality rankings by project completion rate
- National average metrics
- Corruption risk indices

---

### Value Score (value_score)

The **public value computation engine**. Factors:
- Milestone completion rate
- Community verification rate
- Compliance pass rate
- Budget efficiency (actual vs. planned)

Output: 0-100 score per PVO, department, and nationally.

---

### Procurement Market (procurement_market)

The **pre-qualification registry**. Contractors and suppliers must register here before they can bid on PVOs. Tracks:
- Company registration
- Past performance
- Compliance history

---

## Governance Flow

### Master Reset Script

A development tool (`scripts/master-reset.js`) that redeploys all contracts, creates 20 test PVOs, mints RPT tokens to citizens, simulates donor pledges, and runs a full 5-gate escrow lifecycle. Used for testing and demonstrations. **Not for production.**

---

### Freighter Wallet

The [Freighter browser extension](https://freighter.app) is the **user's cryptographic identity** on Stellar. Every action in PoPV requires signing a transaction with the user's Freighter wallet. The wallet:

- Holds the user's Stellar secret key (never shared)
- Signs all contract interactions
- Manages token balances (XLM, pPHP, RPT)

**Production note:** Freighter's content script injects asynchronously. PoPV includes retry logic (300ms initial delay, 10 retries at 500ms intervals) to handle the race condition where the app bundle loads before the extension is ready.

---

## Status Lifecycles

### PVO Status Flow

```
Proposed → InProgress → Completed
                  ↓
          Suspended (under investigation)
                  ↓
          Terminated (project cancelled)
```

- **Proposed**: PVO created, awaiting donor funding
- **InProgress**: At least one milestone has an escrow funded
- **Completed**: All milestones released, auto-set by escrow cross-call
- **Suspended**: Dispute raised, all escrows paused
- **Terminated**: Project permanently cancelled

### Milestone Status Flow

```
Pending → EvidenceSubmitted → EngineerApproved → AIValidated → CompliancePassed → CommunityVerified → Released
```

- **Pending**: Milestone defined, no evidence submitted yet
- **EvidenceSubmitted**: Contractor uploaded deliverables
- **EngineerApproved**: Licensed engineer signed off
- **AIValidated**: AI oracle passed fraud checks
- **CompliancePassed**: Auditor/COA validated regulations
- **CommunityVerified**: Citizen confirmations reached threshold
- **Released**: Payment sent to contractor

### Grant Status Flow

```
Committed → Disbursed → Completed
     ↓
Cancelled
```

- **Committed**: Donor pledged funds, pPHP transferred to funding agency
- **Disbursed**: Funding agency created escrow and marked grant as disbursed
- **Completed**: Escrow released, grant fully settled
- **Cancelled**: Donor revoked the pledge (only before disbursement)

### Escrow Status Flow

```
Created → Funded → EngineerApproved → AIValidated → CompliancePassed → OracleValidated → CommunityVerified → Ready → Released
                                                                                                                    ↓
                                                                                                               Refunded
                                                                                                                    ↓
                                                                                                               Disputed
```

---

## Map Pin Color Legend

| Color | Status |
|-------|--------|
| 🟢 Green | Completed |
| 🟠 Orange | Proposed |
| 🔵 Blue | InProgress / Approved |
| 🔴 Red | Suspended / Terminated |
| ⚪ Gray | Unknown / Under Review |
| 🟣 Purple | GPS Evidence (citizen field reports) |

---

## Technical Patterns

### Cross-Contract Calls

Contracts communicate using Soroban's `env.invoke_contract`:
```rust
env.invoke_contract::<T>(
    &contract_address,
    &Symbol::new(&env, "function_name"),
    soroban_sdk::vec![&env, args...]
)
```

Examples in PoPV:
- Escrow → PVO Core (auto-complete on release)
- Grant Commitment → PVO Core (verify budget before pledging)
- Community Oracle → Reputation (check RPT balance)

### Storage Keys

All contract state uses `Symbol` storage keys for clarity:
```rust
const PVOS: Symbol = symbol_short!("PVOS");
const MILESTONES: Symbol = symbol_short!("MILSTNS");
const ESCROWS: Symbol = symbol_short!("ESCROWS");
```

### Events

Every state-changing operation emits a Soroban contract event:
```rust
MilestoneCreatedEvent { pvo_id, milestone_id, budget }.publish(&env);
```

This enables real-time indexing and public auditability.

---

## FAQ

**Q: Why "PVO" and not just "Project"?**
A: A PVO is more than a project  -  it's a programmable on-chain entity with enforced rules. It has an identity, a budget lock, verification gates, and an immutable audit trail. "Project" is just a label; a PVO is the enforcement mechanism.

**Q: What happens if a contractor submits fake evidence?**
A: The AI oracle scans for anomalies. If detected, the gate fails. The dispute mechanism also allows anyone to flag suspicious evidence. On-chain, the evidence hash is immutable  -  tampering is cryptographically detectable.

**Q: Can the admin bypass the gates?**
A: No. The escrow contract logic is on-chain and immutable. No role  -  not even Administrator  -  has a "skip gate" function. The only admin powers are role assignment and token minting, both auditable.

**Q: Why 5 gates instead of 3 or 7?**
A: 5 gates balance independence (no single role controls release) with practicality (not too slow). Each gate covers a distinct failure mode: physical quality (engineer), fraud detection (AI), regulatory compliance (COA), community oracle (citizen reports), and community threshold (multiple independent verifications).

**Q: What's the difference between the Community Oracle gate and Community Confirmations?**
A: The oracle gate (gate 3) checks that the **oracle contract itself** has verified reports on file. The confirmations gate (gate 4) checks that the **number of verified reports** meets the threshold. You need both: the oracle must exist and be functional, AND enough citizens must have actually shown up.

**Q: How is this different from a traditional escrow?**
A: Traditional escrow releases funds based on signatures (2-of-3 multisig, lawyer approval). PoPV escrow releases funds based on **cryptographic proof of work completed**  -  not who signed what, but whether the work was actually done and verified by independent parties with no financial interest in the outcome.
