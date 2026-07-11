# Chapter 1: Getting Started

Learn the basics of PoPV and set up your identity.

---

## What You'll Learn

- What a Public Value Object (PVO) is
- How roles work on the platform
- How to set up your Stellar account

---

## Key Concepts

### Public Value Object (PVO)

A PVO is a digital representation of a public investment. Think of it as a smart folder that contains:

- Project name, description, and budget
- A list of milestones (phases of work)
- Evidence for each milestone
- Approval and compliance status
- A public value score

Every infrastructure project has exactly one PVO.

### Roles

PoPV uses 14 roles. Different roles can do different things:

➡️ **See the [Role Guide](role-guide.md)** for detailed information about each role's dashboard, contracts, and capabilities.

| Role | What They Do |
|------|-------------|
| Administrator | Manage role assignments, system config |
| CentralBank | Mint CBDC pPHP, redeem pPHP, mark grants disbursed |
| GovernmentAgency | Create PVOs, allocate budget, manage procurement |
| Contractor | Execute projects, submit evidence |
| Engineer | Approve milestone completion |
| Inspector | Conduct field inspections |
| Auditor | Audit financial records |
| CommissionOnAudit | Regulatory compliance oversight |
| AntiCorruptionAgency | Investigate fraud, detect corruption patterns |
| FundingAgency | Fund escrows, manage disbursements |
| InternationalDonor | Transparent cross-border funding |
| AIAuditor | Monitor AI risk scoring and validation |
| Supplier | Manage deliveries and catalog |
| Citizen | Verify projects on the ground, submit reports |

---

## Exercises

### Exercise 1.1: Check Your Identity

List your configured identities:

```bash
stellar keys ls
```

You should see all 14 role identities (pre-configured for this manual):

??? success "Expected Output"
    ```
    alice
    agency
    contractor
    engineer
    inspector
    auditor
    coa
    supplier
    anti_corruption
    funding_agency
    international_donor
    ai_auditor
    citizen
    central_bank
    ```

### Exercise 1.2: Testnet Demo Wallets

All 14 wallets are funded on testnet and assigned roles on-chain. Public keys only - secret keys are in `.dev-logs/role-credentials.md` (gitignored).

| # | Alias | Role | Public Key |
|---|-------|------|-----------|
| 1 | alice | Administrator | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` |
| 2 | agency | GovernmentAgency | `GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2` |
| 3 | contractor | Contractor | `GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF` |
| 4 | engineer | Engineer | `GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ` |
| 5 | inspector | Inspector | `GAPFYWRZYETAWKY4G7VCAAIZ64PZLMDF4MWRYYTLRU4QTN6RLXSXQNGV` |
| 6 | auditor | Auditor | `GAAL24R63KQJADAOLLMC6PLK7VZW2VCYBDLJYHT6X73NY73W7R4XIAYN` |
| 7 | coa | CommissionOnAudit | `GCDE4KUZV7JC7RGESQYCBKKK2ALB6B7HTALB3KYIACGKNVKTVAMKSFJB` |
| 8 | supplier | Supplier | `GCOWOAKYKW3PNKY6HBVTHRJBXBQ3PT2V4N6KGR3ROMKLMUSVDJVYLGMM` |
| 9 | anti_corruption | AntiCorruptionAgency | `GBU4SHHRZPIHJL3BX6LYQMS5WW4HYXENBHSUHSEFPZQCZQ25ZOQWC6E7` |
| 10 | funding_agency | FundingAgency | `GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO` |
| 11 | international_donor | InternationalDonor | `GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44` |
| 12 | ai_auditor | AIAuditor | `GATLFXDNY2OIRX437GHRWR5CWFV7EQ7ORNYIND7APGNGU3HCNYI45AWW` |
| 13 | citizen | Citizen | `GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES` |

To import any wallet in Freighter: Add Account → Import Secret Key (from `.dev-logs/role-credentials.md`).

---

### Exercise 1.3: View Your Address

```bash
stellar keys address alice
```

??? success "Expected Output"
    ```
    GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV
    ```

---

### Exercise 1.4: Check Your Testnet Balance

```bash
stellar account balance alice --network testnet
```

??? success "Expected Output"
    Shows your XLM balance. Should be non-zero (funded by Friendbot).

---

### Exercise 1.5: Verify Testnet Connection

```bash
stellar network info --network testnet
```

??? success "Expected Output"
    ```
    Network Id: cee0302d59844d32bdca915c8203dd44b33fbb7edc19051ea37abedf28ecd472
    Protocol Version: 27
    Passphrase: Test SDF Network ; September 2015
    ```

---

## Next Steps

Now that you understand the basics and have a working identity, proceed to:

➡️ **[Chapter 2: Creating Projects](creating-projects.md)**
