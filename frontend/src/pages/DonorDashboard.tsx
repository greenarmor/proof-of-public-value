import { useState } from "react";
import { useWallet } from "../wallet";
import { formatBudget } from "../helpers";
import { getCurrency } from "../config";

interface Grant {
  id: number;
  pvoId: number;
  projectTitle: string;
  donorOrg: string;
  amount: number;
  currency: string;
  status: "Committed" | "Disbursed" | "Under Review" | "Completed";
  region: string;
  impactScore: number;
}

interface ImpactMetric {
  label: string;
  value: string;
  target: string;
  progress: number;
  icon: string;
}

const mockGrants: Grant[] = [
  { id: 1, pvoId: 1, projectTitle: "Road Paving — Brgy. San Isidro", donorOrg: "World Bank", amount: 5000000, currency: "USD", status: "Disbursed", region: "NCR", impactScore: 78 },
  { id: 2, pvoId: 2, projectTitle: "Bridge Construction — Marcos Hwy", donorOrg: "JICA", amount: 1200000, currency: "USD", status: "Committed", region: "Region IV-A", impactScore: 85 },
  { id: 3, pvoId: 3, projectTitle: "School Building — District 5", donorOrg: "Asian Development Bank", amount: 800000, currency: "USD", status: "Under Review", region: "Region V", impactScore: 0 },
  { id: 4, pvoId: 4, projectTitle: "Water System — Brgy. Liwanag", donorOrg: "USAID", amount: 350000, currency: "USD", status: "Completed", region: "Region VI", impactScore: 92 },
];

const mockMetrics: ImpactMetric[] = [
  { label: "Beneficiaries Reached", value: "45,200", target: "100,000", progress: 45, icon: "👥" },
  { label: "Projects Completed", value: "4", target: "12", progress: 33, icon: "✅" },
  { label: "Infrastructure (km)", value: "8.5", target: "25", progress: 34, icon: "🛣️" },
  { label: "Budget Efficiency", value: "87%", target: "90%", progress: 97, icon: "📊" },
];

export function DonorDashboard() {
  const { connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"portfolio" | "impact" | "commit" | "transparency">("portfolio");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🌍</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the international donor dashboard.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">International Donor Dashboard</h1>
      <p className="text-slate-500 mb-6">Grant portfolio, impact metrics, fund commitment, and full transparency tracking.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["portfolio", "impact", "commit", "transparency"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "portfolio" && "📊 Grant Portfolio"}
            {tab === "impact" && "📈 Impact Metrics"}
            {tab === "commit" && "🤝 Commit Funds"}
            {tab === "transparency" && "🔍 Transparency"}
          </button>
        ))}
      </div>

      {activeTab === "portfolio" && <PortfolioTab grants={mockGrants} />}
      {activeTab === "impact" && <ImpactTab metrics={mockMetrics} />}
      {activeTab === "commit" && <CommitForm />}
      {activeTab === "transparency" && <TransparencyTab grants={mockGrants} />}
    </div>
  );
}

function PortfolioTab({ grants }: { grants: Grant[] }) {
  const totalCommitted = grants.reduce((s, g) => s + g.amount, 0);
  const totalDisbursed = grants.filter((g) => g.status === "Disbursed" || g.status === "Completed").reduce((s, g) => s + g.amount, 0);
  const activeGrants = grants.filter((g) => g.status === "Committed" || g.status === "Disbursed").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Committed", value: `$${formatBudget(totalCommitted)}`, color: "text-slate-900" },
          { label: "Disbursed", value: `$${formatBudget(totalDisbursed)}`, color: "text-emerald-600" },
          { label: "Active Grants", value: String(activeGrants), color: "text-brand-600" },
          { label: "Regions Covered", value: String(new Set(grants.map((g) => g.region)).size), color: "text-blue-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {grants.map((g) => (
          <div key={g.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-400">{g.donorOrg}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">{g.region}</span>
                </div>
                <h3 className="font-semibold text-slate-900">{g.projectTitle}</h3>
                <p className="text-sm text-slate-500">PVO #{g.pvoId} · ${formatBudget(g.amount)} {g.currency}</p>
              </div>
              <span className={`badge ${
                g.status === "Completed" ? "badge-green" :
                g.status === "Disbursed" ? "badge-blue" :
                g.status === "Committed" ? "badge-purple" : "badge-amber"
              }`}>{g.status}</span>
            </div>
            {g.impactScore > 0 && (
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">Impact Score</span>
                <div className="flex-1 max-w-[200px]">
                  <div className="progress-bar">
                    <div className={`progress-fill ${g.impactScore >= 80 ? "progress-green" : "progress-amber"}`}
                      style={{ width: `${g.impactScore}%` }} />
                  </div>
                </div>
                <span className={`text-sm font-bold ${g.impactScore >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{g.impactScore}/100</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactTab({ metrics }: { metrics: ImpactMetric[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metrics.map((m) => (
        <div key={m.label} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{m.icon}</span>
            <div>
              <h3 className="font-semibold text-slate-900">{m.label}</h3>
              <p className="text-sm text-slate-500">{m.value} / {m.target} target</p>
            </div>
          </div>
          <div className="progress-bar mb-1">
            <div className={`progress-fill ${m.progress >= 80 ? "progress-green" : m.progress >= 50 ? "progress-purple" : "progress-amber"}`}
              style={{ width: `${m.progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{m.progress}% of target</span>
            <span className={`font-medium ${m.progress >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
              {m.progress >= 80 ? "On Track" : "Behind"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitForm() {
  const [pvoId, setPvoId] = useState("");
  const [amount, setAmount] = useState("");
  const [org, setOrg] = useState("");
  const currency = getCurrency();

  return (
    <div className="card p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4 text-slate-900">Commit Grant Funding</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
          <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Donor Organization</label>
          <select value={org} onChange={(e) => setOrg(e.target.value)} className="select">
            <option value="">Select organization...</option>
            <option>World Bank</option>
            <option>Asian Development Bank</option>
            <option>JICA</option>
            <option>USAID</option>
            <option>European Union</option>
            <option>UNDP</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (USD)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="e.g. 500000" required />
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="text-sm text-brand-700">
            <strong>Transparent Commitment:</strong> Grant funds are committed on-chain with full traceability.
            Disbursement is gated by verified milestones, AI risk assessment, and community validation.
          </p>
        </div>
        <button type="submit" className="btn-primary w-full py-3">Commit Funding</button>
      </form>
    </div>
  );
}

function TransparencyTab({ grants }: { grants: Grant[] }) {
  const completed = grants.filter((g) => g.status === "Completed");
  const avgImpact = completed.length > 0
    ? Math.round(completed.reduce((s, g) => s + g.impactScore, 0) / completed.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Funds Flow Transparency</h3>
        <div className="space-y-3">
          {grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  g.status === "Completed" ? "bg-emerald-500" :
                  g.status === "Disbursed" ? "bg-blue-500" :
                  g.status === "Committed" ? "bg-brand-500" : "bg-amber-500"
                }`} />
                <div>
                  <span className="text-sm font-medium text-slate-900">{g.projectTitle}</span>
                  <span className="text-xs text-slate-400 ml-2">{g.donorOrg}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">${formatBudget(g.amount)}</p>
                <p className="text-xs text-slate-400">{g.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="stat-label mb-2">Avg Impact Score</p>
          <p className="text-3xl font-bold text-emerald-600">{avgImpact || "—"}{avgImpact > 0 && <span className="text-lg text-slate-400">/100</span>}</p>
          <p className="text-xs text-slate-400 mt-1">Completed projects only</p>
        </div>
        <div className="card p-5">
          <p className="stat-label mb-2">Zero Waste Policy</p>
          <p className="text-3xl font-bold text-brand-600">100%</p>
          <p className="text-xs text-slate-400 mt-1">On-chain verified disbursements</p>
        </div>
        <div className="card p-5">
          <p className="stat-label mb-2">Community Verified</p>
          <p className="text-3xl font-bold text-blue-600">All</p>
          <p className="text-xs text-slate-400 mt-1">Reports cross-checked by citizens</p>
        </div>
      </div>
    </div>
  );
}
