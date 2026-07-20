import { useState } from "react";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";

const ROLES = [
  {
    id: "citizen",
    title: "Citizen Reporter",
    icon: "\u{1F4F8}",
    color: "bg-emerald-500",
    desc: "Download the PoPV Citizen mobile app. Visit project sites. Submit GPS-tagged field reports. Your evidence is the final gate  -  without citizens, no funds are released.",
    steps: [
      "Download & install PoPV Citizen from GitHub Releases",
      "Create or import a Stellar wallet in the app",
      "Enable location + camera permissions",
      "Walk within 100m of any project site",
      "The Hunter Panel auto-detects the project",
      "Tap 'Show on Map & Report' or 'Field Report'",
      "Submit GPS-tagged photo evidence on-chain",
    ],
  },
  {
    id: "engineer",
    title: "Licensed Engineer",
    icon: "🔧",
    color: "bg-blue-500",
    desc: "Inspect physical work. Sign off on structural quality. You are Gate 1  -  the technical gatekeeper.",
    steps: [
      "Connect the Engineer wallet in Freighter",
      "Go to Engineer Panel",
      "Review submitted evidence for a milestone",
      "Physically verify the work (roleplay: review drone imagery, GPS)",
      "Approve the milestone if it meets specifications",
      "Gate 1 passes  -  escrow advances to compliance",
    ],
  },
  {
    id: "ai_auditor",
    title: "AI Auditor",
    icon: "🤖",
    color: "bg-purple-500",
    desc: "Run fraud detection on evidence. Scan for GPS anomalies, metadata tampering, and suspicious patterns. Gate 5  -  runs last for maximum data.",
    steps: [
      "Connect the AI Auditor wallet in Freighter",
      "Go to AI Dashboard",
      "Run AI validation on milestones with gates 1-4 passed",
      "AI analyzes GPS coordinates, metadata, description quality",
      "Assigns risk score: <50 = PASS, ≥50 = FAIL",
      "Gate 5 passes  -  all gates complete, escrow ready for release",
    ],
  },
  {
    id: "auditor",
    title: "Auditor / COA",
    icon: "⚖️",
    color: "bg-amber-500",
    desc: "Validate procurement law compliance, budget rules, and safety regulations. Gate 2  -  the legal gatekeeper.",
    steps: [
      "Connect the Auditor wallet in Freighter",
      "Go to Auditor Dashboard",
      "Review milestone compliance",
      "Check procurement law, budget allocation, safety rules",
      "Pass the compliance check",
      "Gate 2 passes  -  escrow advances to community verification",
    ],
  },
  {
    id: "funding_agency",
    title: "Funding Agency",
    icon: "💰",
    color: "bg-cyan-500",
    desc: "Create and fund escrows. Lock funds behind 5 verification gates. You hold the purse strings  -  but cannot release funds alone.",
    steps: [
      "Connect the Funding Agency wallet in Freighter",
      "Go to Funding Agency Dashboard → Donor Commitments tab",
      "Find a Disbursed grant  -  click Create Escrow",
      "Select recipient, PVO, and milestone (autocomplete)",
      "Set community confirmation threshold",
      "Submit  -  escrow created on-chain",
      "Go to Escrows tab → Fund Escrow  -  deposit pPHP",
      "Escrow is now locked behind 5 gates",
    ],
  },
  {
    id: "donor",
    title: "International Donor",
    icon: "🌍",
    color: "bg-indigo-500",
    desc: "Pledge funds to public projects. Your money is locked until every gate passes. Trust, but verify.",
    steps: [
      "Connect the International Donor wallet in Freighter",
      "Go to Donor Dashboard",
      "Browse PVOs with remaining budget",
      "Pledge to a PVO  -  amount must exactly match remaining budget",
      "Submit  -  pPHP transferred to Funding Agency atomically",
      "Your pledge is recorded on-chain as Committed",
    ],
  },
  {
    id: "contractor",
    title: "Contractor",
    icon: "🏗️",
    color: "bg-orange-500",
    desc: "Bid on government tenders. Submit competitive offers with price, quality, and timeline. Win contracts, do the work, submit evidence. Prove you built what you were paid to build.",
    steps: [
      "Connect the Contractor wallet in Freighter",
      "Go to Procurement Marketplace  -  browse open tenders",
      "Submit a bid with price, quality score, and timeline",
      "If awarded, your PVOs appear in Contractor Portal",
      "Each submission is recorded on-chain  -  immutable audit trail",
    ],
  },
  {
    id: "agency",
    title: "Government Agency",
    icon: "🏛️",
    color: "bg-slate-600",
    desc: "Create PVOs. Define milestones with budgets and evidence requirements. You define what gets built and how it's verified.",
    steps: [
      "Connect the Government Agency wallet in Freighter",
      "Go to Agency Dashboard",
      "Click Create PVO  -  enter title, department, budget (contractor assigned after bidding)",
      "Define milestones per PVO (1 tender covers all milestones)",
      "Open tender via Procurement Marketplace  -  contractors bid",
      "Award the winning bid  -  contractor auto-assigned to PVO on-chain",
    ],
  },
  {
    id: "central_bank",
    title: "Central Bank (CBDC)",
    icon: "🏦",
    color: "bg-amber-600",
    desc: "Control the CBDC (Central Bank Digital Currency) monetary supply. pPHP is the on-chain Philippine Peso. Mint it for national budgets and donor pledges. Redeem it when contractors cash out. You are the monetary authority.",
    steps: [
      "Connect the Central Bank wallet in Freighter",
      "Go to Central Bank Dashboard",
      "Direct Fund tab: mint CBDC pPHP to Funding Agency for national budget allocation",
      "Pledges tab: approve donor pledges by minting CBDC pPHP and marking grants as disbursed",
      "Redeem tab: burn CBDC pPHP when contractors cash out their escrow payments",
      "Every CBDC mint, transfer, and burn is recorded on-chain for full monetary transparency",
    ],
  },
  {
    id: "admin",
    title: "Administrator",
    icon: "👑",
    color: "bg-red-500",
    desc: "Manage the system. Assign roles. System governance.",
    steps: [
      "Connect the Administrator (alice) wallet in Freighter",
      "Go to System Panel -> Roles tab",
      "Assign roles to wallet addresses",
      "Go to Health tab -> monitor system status",
    ],
  },
];

const DEMO_WALLETS: Record<string, { public: string; label: string }> = {
  citizen: {
    public: "GAHHOHGH3RKN3OAQ7TPLAELV35HRRXFESAPY5XWNZZWHSDKFNB2B57ST",
    label: "Citizen 1",
  },
  engineer: {
    public: "GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ",
    label: "Engineer",
  },
  ai_auditor: {
    public: "GATLFXDNY2OIRX437GHRWR5CWFV7EQ7ORNYIND7APGNGU3HCNYI45AWW",
    label: "AI Auditor",
  },
  auditor: { public: "GAAL24R63KQJADAOLLMC6PLK7VZW2VCYBDLJYHT6X73NY73W7R4XIAYN", label: "Auditor" },
  funding_agency: {
    public: "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO",
    label: "Funding Agency",
  },
  donor: {
    public: "GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44",
    label: "International Donor",
  },
  contractor: {
    public: "GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF",
    label: "Contractor",
  },
  agency: {
    public: "GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2",
    label: "Government Agency",
  },
  admin: {
    public: "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV",
    label: "Administrator (alice)",
  },
  central_bank: {
    public: "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO",
    label: "Central Bank",
  },
};

export function RolePlayOnboarding() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const role = ROLES.find((r) => r.id === selected);
  const displayedRoles = showAll ? ROLES : ROLES.slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">🏛️ Role-Play PoPV</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Governments are custodians of public wealth - not owners. Proof of Public Value proves
          that with the right tools, accountability becomes the default, not the exception. Powered
          by CBDC (Central Bank Digital Currency) on Stellar. The Philippines is our case study. Any
          government can use it.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener"
            className="btn-primary px-5 py-2.5 text-sm font-medium"
          >
            ⬇️ Install Freighter Wallet
          </a>
          <a
            href="https://greenarmor.github.io/proof-of-public-value/"
            target="_blank"
            rel="noopener"
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            📖 Read the Manual
          </a>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="card p-6 mb-8 bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          🌏 Our Mission: Step Up, or Be Watched
        </h2>
        <p className="text-slate-600 leading-relaxed">
          <strong>To every government official in every country:</strong> you were given a sacred
          trust  -  to be the custodian of public wealth, not its owner. Every peso, dollar, rupee, or
          shilling belongs to the people. Your job is to protect it, allocate it wisely, and spend
          it transparently.
          <br />
          <br />
          <strong>If you are honest, this system proves your integrity.</strong> Every decision is
          recorded on an immutable blockchain. Your approvals are timestamped. Your compliance
          checks are auditable. When accusations fly, you have cryptographic proof that you did the
          right thing.
          <br />
          <br />
          <strong>If you are corrupt, your time is up.</strong> There are no more paper trails to
          tamper with. No more signatures to forge. No more "lost documents." Every citizen with a
          phone is now an auditor. Every GPS-tagged report is a permanent record. Every peso is
          tracked from budget to tender to contractor to ground.
          <br />
          <br />
          <strong>To every citizen, in every nation:</strong> you are no longer a bystander. Your
          GPS report is the final gate. Without citizen verification, not a single peso is released
          from escrow. You don't need to be an auditor. You just need to visit a project site and
          report what you see  -  or don't see.
          <br />
          <br />
          <strong>We built this to digitalize accountability.</strong> This is not just software.
          It's a tool to help fix a broken system. Step into any role below and see how it works  - 
          then show your government what's possible.
        </p>
      </div>

      {/* Self-Host CTA */}
      <div className="card p-5 mb-8 bg-slate-800 text-white">
        <h2 className="text-lg font-bold mb-2">🚀 Deploy Your Own PoPV System</h2>
        <p className="text-slate-300 text-sm mb-4">
          Want to run PoPV for your own government, city, or community? Everything you need is
          open-source and serverless. No backend. No database. Just deploy to Vercel.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/greenarmor/proof-of-public-value"
            target="_blank"
            rel="noopener"
            className="px-4 py-2 bg-white text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-100 transition"
          >
            📦 Clone the Repo
          </a>
          <button
            onClick={() =>
              window.open("https://greenarmor.github.io/proof-of-public-value/", "_blank")
            }
            className="px-4 py-2 border border-slate-500 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition"
          >
            📖 Deployment Guide
          </button>
          <button
            onClick={() =>
              window.open("https://github.com/greenarmor/proof-of-public-value", "_blank")
            }
            className="px-4 py-2 border border-slate-500 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition"
          >
            🖥️ Source Code
          </button>
          <button
            onClick={() =>
              window.open("https://greenarmor.github.io/proof-of-public-value/", "_blank")
            }
            className="px-4 py-2 border border-slate-500 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition"
          >
            ☁️ Full Documentation
          </button>
        </div>
      </div>

      {/* Role Selection */}
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Choose Your Role</h2>
      <p className="text-sm text-slate-500 mb-6">
        Each role has pre-configured demo wallets with testnet funds and on-chain permissions.
        Import the wallet into Freighter and start role-playing immediately.
      </p>

      {/* Request Your Own Role */}
      <div className="card p-5 mb-8 bg-gradient-to-r from-purple-50 to-brand-50 border-purple-100">
        <h3 className="font-semibold text-slate-900 mb-2">🎫 Want Your Own Testnet Role?</h3>
        <p className="text-sm text-slate-600 mb-4">
          You don't have to use our demo wallets. Generate your own Stellar testnet keypair, send it
          to us with your desired role, and we'll assign it on-chain  -  your wallet, your identity,
          your role in the system.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-2">
              <strong>Step 1:</strong> Generate a keypair:
            </p>
            <code className="block bg-slate-800 text-green-400 text-xs p-2 rounded-lg mb-2">
              stellar keys generate --global my-popv-role
            </code>
            <p className="text-xs text-slate-500 mb-2">
              Or use the <strong>Freighter extension</strong> → Create Wallet → copy the public key
              (starts with G...)
            </p>
            <p className="text-xs text-slate-500 mb-2">
              <strong>Step 2:</strong> Fund it via Friendbot:
            </p>
            <code className="block bg-slate-800 text-green-400 text-xs p-2 rounded-lg mb-2">
              curl "https://friendbot.stellar.org?addr=G..."
            </code>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2">
              <strong>Step 3:</strong> Contact the developer:
            </p>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-sm font-medium text-slate-900 mb-2">📬 Send your details:</p>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>GitHub:</strong>{" "}
                  <a
                    href="https://github.com/greenarmor"
                    target="_blank"
                    rel="noopener"
                    className="text-brand-600 hover:underline"
                  >
                    @greenarmor
                  </a>
                </p>
                <p className="text-slate-600">Include in your message:</p>
                <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
                  <li>
                    Your <strong>public key</strong> (starts with G...)
                  </li>
                  <li>
                    Desired <strong>role</strong> (Citizen, Engineer, Auditor, etc.)
                  </li>
                  <li>Brief reason  -  what you want to test</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              <strong>What happens next:</strong> The developer assigns your role on-chain using the
              admin wallet. You'll get a confirmation. Then import your key into Freighter, connect,
              and start role-playing.
            </p>
          </div>
        </div>
      </div>

      {!selected ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
            {displayedRoles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className="card-interactive p-4 text-center group"
              >
                <div
                  className={`w-12 h-12 ${r.color} rounded-xl mx-auto mb-3 flex items-center justify-center text-2xl shadow-lg`}
                >
                  {r.icon}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-brand-700 transition">
                  {r.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2">{r.desc.slice(0, 80)}...</p>
              </button>
            ))}
          </div>
          {ROLES.length > 5 && (
            <div className="text-center mb-8">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-brand-600 hover:underline"
              >
                {showAll ? "Show less ▲" : `Show all ${ROLES.length} roles ▼`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setSelected(null)} className="btn-ghost text-sm mb-6">
            ← Back to all roles
          </button>

          {role && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Role Info */}
              <div className="lg:col-span-1">
                <div className="card p-5 sticky top-24">
                  <div
                    className={`w-16 h-16 ${role.color} rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg`}
                  >
                    {role.icon}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                    {role.title}
                  </h2>
                  <p className="text-sm text-slate-500 text-center mb-4">{role.desc}</p>

                  {DEMO_WALLETS[role.id] && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-4">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">
                        Demo Wallet
                      </p>
                      <p className="text-xs font-mono text-slate-700 break-all mb-2">
                        {DEMO_WALLETS[role.id].public}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(DEMO_WALLETS[role.id].public);
                          alert("Public key copied! Import this wallet into Freighter.");
                        }}
                        className="w-full py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition"
                      >
                        📋 Copy Public Key
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Secret keys are stored securely. Ask the project maintainer if you need them.
                      </p>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-700">
                      <strong>⚠️ Testnet only.</strong> These wallets have no real value. All funds
                      are simulated pPHP for testing the verification gates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Walkthrough */}
              <div className="lg:col-span-2 space-y-4">
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">📋 Step-by-Step Walkthrough</h3>
                  <div className="space-y-3">
                    {role.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-sm text-slate-600 pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">🔗 Quick Links</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="/"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      🔍 Transparency Portal
                    </a>
                    <a
                      href="/map"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      🗺️ Project Map
                    </a>
                    <a
                      href="/agency"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      🏛️ Agency Dashboard
                    </a>
                    <a
                      href="/funding"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      💰 Funding Agency
                    </a>
                    <a
                      href="/engineer"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      🔧 Engineer Panel
                    </a>
                    <a
                      href="/auditor"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      ⚖️ Auditor Dashboard
                    </a>
                    <a
                      href="https://github.com/greenarmor/proof-of-public-value/releases"
                      target="_blank"
                      rel="noopener"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      📱 Download PoPV Citizen App
                    </a>
                    <a
                      href="/central-bank"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      🏦 Central Bank
                    </a>
                    <a
                      href="/admin"
                      className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                    >
                      👑 System Panel
                    </a>
                  </div>
                </div>

                {/* The Bigger Picture */}
                <div className="card p-5 bg-gradient-to-br from-purple-50 to-brand-50 border-purple-100">
                  <h3 className="font-semibold text-slate-900 mb-2">🌏 The Bigger Picture</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This isn't just a demo. It's a working prototype of how government spending can
                    be made transparent, verifiable, and accountable through blockchain technology  - 
                    in any country, with any currency.
                    <br />
                    <br />
                    Every role you play shows how the 5-gate system prevents any single person from
                    releasing funds alone. Engineers verify. AI detects fraud. Auditors check
                    compliance. Citizens confirm on the ground. Only when EVERYONE agrees do funds
                    flow.
                    <br />
                    <br />
                    <strong>
                      This is what accountability looks like. Share it with your government.
                    </strong>
                  </p>
                </div>

                {/* Get Your Own Role */}
                <div className="card p-5 bg-gradient-to-r from-purple-50 to-brand-50 border-purple-100">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    🎫 Want Your Own Testnet Role?
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Generate your own Stellar keypair and send it to the developer to be assigned
                    this role on-chain.
                  </p>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-sm font-medium text-slate-900 mb-2">
                      📬 Contact the developer:
                    </p>
                    <p>
                      <strong>GitHub:</strong>{" "}
                      <a
                        href="https://github.com/greenarmor"
                        target="_blank"
                        rel="noopener"
                        className="text-brand-600 hover:underline"
                      >
                        @greenarmor
                      </a>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Send your <strong>public key</strong> (G...), desired role, and a brief
                      message.
                    </p>
                  </div>
                  <div className="bg-slate-800 text-green-400 text-xs p-2 rounded-lg mt-3">
                    <code>stellar keys generate --global my-popv-role</code>
                    <br />
                    <code>curl "https://friendbot.stellar.org?addr=G..."</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
