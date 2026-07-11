# Run PoPV Frontend Locally (No Contract Deployment)

> Connect to the existing deployed contracts on Stellar testnet.  
> No Rust, no `stellar contract build`, no lean-reset. Just the UI.  
> **Live version:** [www.popv.quest](https://www.popv.quest) - no setup needed. Just connect Freighter.

---

## What You Need

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 22+ | JavaScript runtime |
| npm | 10+ | Package manager |
| Git | any | Clone the repo |
| Freighter | latest | Stellar wallet browser extension |
| Chrome or Firefox | latest | Browser |

**You do NOT need:** Rust, Stellar CLI, Docker, Soroban SDK, or any contract tools.

---

## Step 1: Install Node.js

### macOS
```bash
# Option A: Direct download
# https://nodejs.org → Download LTS (22.x) → Install

# Option B: Homebrew
brew install node@22
```

### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Windows
Download from https://nodejs.org → LTS 22.x → run installer.

### Verify
```bash
node --version   # should show v22.x
npm --version    # should show 10.x
```

---

## Step 2: Install Git

### macOS
```bash
brew install git
# or: xcode-select --install
```

### Ubuntu
```bash
sudo apt install -y git
```

### Windows
Download from https://git-scm.com → run installer.

### Verify
```bash
git --version
```

---

## Step 3: Install Freighter Wallet

Freighter is the Stellar browser extension wallet. You need it to sign transactions.

### Install
- [**Chrome Web Store**](https://chromewebstore.google.com/detail/freighter/bacdhkkjdbjmnkbeaknincojmfogjimi) - Click "Add to Chrome"
- [**Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/freighter/) - Click "Add to Firefox"

### First-Time Setup
1. Open Freighter (click the puzzle icon in Chrome toolbar → pin Freighter)
2. Click **"Create Wallet"**
3. Create a password (write it down!)
4. Save the 12-word recovery phrase (write it down! Never share it!)
5. Confirm the recovery phrase

### Import Existing Role Wallets

You'll need wallets with on-chain roles. Get the secret keys from the project maintainer or `.dev-logs/newrolecreden.md`.

For each role you want to test:
1. Freighter → settings gear → **"Add Account"**
2. Select **"Import Secret Key"**
3. Paste the secret key (starts with `S`, 56 characters)
4. Name it so you remember the role (e.g. "alice-admin", "agency", "contractor")

Example secret key format:
```
REDACTED_SECRET_KEY
```

### Fund New Wallets

If your wallet has 0 XLM, you can't pay transaction fees. Fund it:

1. Copy the wallet's public key (starts with `G`, 56 characters)
2. Go to: https://laboratory.stellar.org/#account-creator
3. Paste the public key
4. Click **"Create Account"** - funded with 10,000 testnet XLM

---

## Step 4: Clone the Repo

```bash
git clone https://github.com/greenarmor/proof-of-public-value.git
cd proof-of-public-value
```

---

## Step 5: Install Dependencies

```bash
# Install root dependencies (concurrently, typescript, stellar-sdk)
npm install --include=dev

# Install frontend dependencies (React, Vite, Tailwind)
cd frontend && npm install --include=dev && cd ..
```

This takes 1-2 minutes depending on your internet.

---

## Step 6: Verify Contract IDs

The frontend reads from already-deployed contracts on Stellar testnet. Contract IDs are in `frontend/src/config.ts`:

```bash
head -16 frontend/src/config.ts
```

You should see entries like:
```typescript
access_control: "CCAL...",
escrow: "CCA3...",
pvo_core: "CBZM...",
```

These point to the live testnet contracts. No changes needed. If the project maintainer redeployed contracts, they updated this file. Run `git pull` to stay in sync.

---

## Step 7: Start the Dev Server

```bash
npm run dev
```

This starts Vite on **http://localhost:5174** with hot reload.

If port 5174 is already in use:
```bash
lsof -ti:5174 | xargs kill -9
npm run dev
```

---

## Step 8: Open the App

Go to **http://localhost:5174** in Chrome or Firefox (the browser where you installed Freighter).

### Public Pages (no wallet needed)

| URL | What |
|-----|------|
| `/` | Landing page |
| `/portal` | Transparency Portal - browse all PVOs, see gates, funding progress |
| `/provenance` | Provenance Explorer - audit trail with tx hash links |
| `/escrows` | Escrow Monitor |
| `/onboarding` | Role-Play guide |
| `/index` | National Index |
| `/ai` | AI Monitor |

### Connect a Wallet

1. Click **"Connect Freighter"** (or the wallet icon in the top-right navbar)
2. Freighter popup opens → enter your password → click **Connect**
3. The navbar changes to show your wallet address and role
4. A **"Dashboards"** dropdown appears with your role pages

### Role Dashboards (wallet required)

| Role | Dashboard URL | What you can do |
|------|--------------|-----------------|
| Administrator | `/admin` | Assign roles, mint RPT |
| CentralBank | `/central-bank` | Mint CBDC pPHP, redeem pPHP, mark grants disbursed |
| GovernmentAgency | `/agency` | Create PVOs, define milestones, open tenders |
| Contractor | `/contractor` | Browse tenders, submit bids, submit evidence |
| Engineer | `/engineer` | Approve milestones (Gate 1) |
| Auditor / COA | `/auditor` | Compliance checks (Gate 2) |
| FundingAgency | `/funder` | Create and fund escrows |
| Citizen | `/citizen` | Submit GPS field reports (Gate 3-4) |
| Inspector | `/inspector` | Submit inspection reports |
| AIAuditor | `/ai` | Run AI fraud detection (Gate 5) |
| InternationalDonor | `/donor` | Pledge grants |
| Supplier | `/procurement` | Register in procurement market |
| AntiCorruptionAgency | `/anticorruption` | Raise disputes |

---

## Step 9: Full Role-Play Walkthrough

Use the **Role-Play** page (`/onboarding`) or follow this manual flow:

| # | Connect as | Go to | Action | Freighter Sign? |
|---|-----------|-------|--------|----------------|
| 1 | `agency` | Agency Dashboard | Click "Create PVO" - fill title, dept, budget, fund source | ✅ Yes |
| 2 | `agency` | Agency Dashboard | Click "+ Add" on the PVO - define milestones with budgets | ✅ Yes |
| 3 | `agency` | Agency Dashboard | Click "Tender" on the PVO - set bid deadline | ✅ Yes |
| 4 | `contractor` | `/procurement` | Browse open tenders - click "Bid" - enter price, quality | ✅ Yes |
| 5 | `agency` | `/procurement` → Award tab | Click "Award Tender" - auto-picks highest bid | ✅ Yes |
| 6 | `central_bank` | Central Bank Dashboard | Click "Direct Fund" - mint CBDC pPHP to Funding Agency | ✅ Yes |
| 7 | `funding_agency` | Awarded PVOs tab | Expand PVO - click "Escrow" on a milestone | ✅ Yes |
| 8 | `funding_agency` | Escrows tab | Click "Fund Escrow" on the created escrow | ✅ Yes |
| 9 | `contractor` | Contractor Portal | Click PVO - expand milestone - "Submit Evidence" | ✅ Yes |
| 10 | `inspector` | Inspector Panel | Click PVO - expand milestone - "Submit Inspection" | ✅ Yes |
| 11 | `engineer` | Engineer Panel | Review evidence + inspector report - click "Approve" | ✅ Yes |
| 12 | `auditor` | Auditor Dashboard → Compliance | Click "Pass" on the compliance check | ✅ Yes |
| 13 | `citizen` | `/portal` - click PVO - find escrow | Click "📸 Report" - enter GPS - Submit - Validate Gate 3 - Confirm Gate 4 | ✅ Yes (×3) |
| 14 | `ai_auditor` | `/ai` dashboard | Click "Run AI Fraud Check" (Gate 5) | ✅ Yes |
| 15 | any wallet | `/portal` - click PVO - find escrow | Click "💸 Release" - funds go to contractor | ✅ Yes |

After release: PVO shows Completed, contractor receives pPHP, all gates green.

---

## Optional: Off-Chain Services

These enhance the experience but are NOT required:

### Provenance Indexer (adds tx hash links to gates)

```bash
npx tsx provenance-indexer/service.ts
```
- Runs on http://127.0.0.1:3111
- Adds clickable Stellar transaction links to every gate
- Shows full audit timeline per PVO

### AI Oracle (auto fraud detection)

```bash
AI_AUDITOR_SECRET=<secret-key> npx tsx ai-oracle/service.ts --once
```
- Auto-scans for PVOs needing AI validation
- Submits Gate 5 verdict on-chain
- One instance serves all frontends worldwide

---

## Troubleshooting

### "Module not found" errors
```bash
npm install --include=dev
cd frontend && npm install --include=dev && cd ..
```

### Blank PVO list / No projects showing
```bash
git pull  # get latest contract IDs
npm run dev  # restart server
# Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win)
```

### Freighter won't connect
- Refresh the page after installing Freighter
- Make sure you're on `http://localhost:5174` (NOT `https`)
- Disable other wallet extensions (MetaMask, Coinbase, etc.)
- Check Freighter is unlocked (enter password first)

### "Access Denied" on a dashboard
- Your wallet doesn't have that role
- Connect as `alice` (admin) → Admin Panel → assign the role

### Port 5174 already in use
```bash
lsof -ti:5174 | xargs kill -9
```

### "insufficient balance" on transaction
- Your wallet needs testnet XLM for fees
- Fund it: https://laboratory.stellar.org/#account-creator

### "trustline entry is missing" (RPT error)
- As citizen, go to Citizen Report Form first - it auto-creates the RPT trustline

---

## That's It

No contract deployment. No Rust. No Stellar CLI. The blockchain IS the backend.

