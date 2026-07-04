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

| Role | What They Do |
|------|-------------|
| Administrator | Manage role assignments, system config |
| GovernmentAgency | Create PVOs, allocate budget, manage procurement |
| Contractor | Execute projects, submit evidence |
| Engineer | Approve milestone completion |
| Inspector | Conduct field inspections |
| ProjectManager | Oversee project execution and timelines |
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
    project_manager
    anti_corruption
    funding_agency
    international_donor
    ai_auditor
    citizen
    ```

### Exercise 1.2: Testnet Demo Wallets

All 14 wallets are funded on testnet and assigned roles on-chain. Public keys only - secret keys are in `.dev-logs/role-credentials.md` (gitignored).

| # | Alias | Role | Public Key |
|---|-------|------|-----------|
| 1 | alice | Administrator | `GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV` |
| 2 | agency | GovernmentAgency | `GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN` |
| 3 | contractor | Contractor | `GAZENYNRLICJYECZ66IGSOHH2N246P3CGZMI2DJ2G3RFK6A5WF42LPRW` |
| 4 | engineer | Engineer | `GB7JLZ33J643CIAKC3APGMTVD2MAYNFI3C4EDDOOYVHOKTWVMDHJ42MN` |
| 5 | inspector | Inspector | `GC7KDB6WJXNE7SJH3ZITQ56MNHGJGKXBS47IUBUMBLZFHHXQXFPDICSI` |
| 6 | auditor | Auditor | `GC3E277DKK7C7AIQ5G4G632RRPSWJBX33DB4OB54SS3XEKUY6EW5Z5F7` |
| 7 | coa | CommissionOnAudit | `GAXUYK7RP3TWWOOBRDQJ7FBVG5C7ZF2PUQ3AAT2JA2U2QEMI5MUGO4OK` |
| 8 | supplier | Supplier | `GAETC2ETXVK452VRPIWXA25TCQFSP6TYSPOSTC6UXM7AJFMZOK3LB33T` |
| 9 | project_manager | ProjectManager | `GB4WQNIJ64WZ72VBJRSPJ7WNS2HOH4NXCASUIO7ZZFPNSXRURNN55THV` |
| 10 | anti_corruption | AntiCorruptionAgency | `GACVW3NYKARN3C7TJFQVVTOVRPD5BF3KCQDSYUMSEDBGYPFBWWMF7OTC` |
| 11 | funding_agency | FundingAgency | `GBVHSRHLDZPZ6A7VIYS6G572OHI2WEW24Q4GGRFZBLY2ZGPM3LHPSEZF` |
| 12 | international_donor | InternationalDonor | `GDUOHRAMDVFJKC4DOLF2OFGTQXL7NSZASZUNN5IZEXR3ZPQVBWMRW76D` |
| 13 | ai_auditor | AIAuditor | `GAKJTLALTPWV4DLQGUCBMSO36EL3YIXK6X774D27Q3HBIR4GPDX2BL5J` |
| 14 | citizen | Citizen | `GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES` |

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
