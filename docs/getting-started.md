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
| Citizen | Verify projects on the ground |
| Engineer | Approve milestone completion |
| Inspector | Conduct field inspections |
| Contractor | Execute projects, submit evidence |
| Project Manager | Oversee project execution |
| Government Agency | Create PVOs, allocate budget |
| Auditor | Audit financial records |
| Commission on Audit | Regulatory compliance |
| Anti-Corruption Agency | Investigate fraud |
| Funding Agency | Fund escrows |
| Administrator | Manage role assignments |

---

## Exercises

### Exercise 1.1: Check Your Identity

List your configured identities:

```bash
stellar keys ls
```

You should see `alice` and `bob` (pre-configured for this manual).

??? success "Expected Output"
    ```
    alice
    bob
    ```

---

### Exercise 1.2: View Your Address

```bash
stellar keys address alice
```

??? success "Expected Output"
    ```
    GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV
    ```

---

### Exercise 1.3: Check Your Testnet Balance

```bash
stellar account balance alice --network testnet
```

??? success "Expected Output"
    Shows your XLM balance. Should be non-zero (funded by Friendbot).

---

### Exercise 1.4: Verify Testnet Connection

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
