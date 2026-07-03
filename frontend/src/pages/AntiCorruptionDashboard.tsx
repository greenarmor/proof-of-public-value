import { useState } from "react";
import { useWallet } from "../wallet";
import { formatAddress } from "../helpers";

interface Alert {
  id: number;
  pvoId: number;
  type: "Price Discrepancy" | "Duplicate Payment" | "Shell Company" | "Bid Rigging" | "Timeline Anomaly";
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  aiRiskScore: number;
  status: "Investigating" | "Confirmed" | "Dismissed" | "Reported";
  detectedDate: string;
  actor: string;
}

interface Investigation {
  id: number;
  caseNumber: string;
  pvoId: number;
  title: string;
  status: "Open" | "Evidence Gathering" | "Escalated" | "Closed";
  openedDate: string;
  assignedTo: string;
}

const mockAlerts: Alert[] = [
  { id: 1, pvoId: 1, type: "Price Discrepancy", severity: "High", description: "Cement unit price 35% above market average for region IV-A", aiRiskScore: 72, status: "Investigating", detectedDate: "Jul 3, 2026", actor: "G...LPRW" },
  { id: 2, pvoId: 2, type: "Bid Rigging", severity: "Critical", description: "3 bidders share same registered address pattern", aiRiskScore: 91, status: "Investigating", detectedDate: "Jul 2, 2026", actor: "G...GYDN" },
  { id: 3, pvoId: 1, type: "Timeline Anomaly", severity: "Medium", description: "Milestone approved 5 days before scheduled inspection", aiRiskScore: 45, status: "Dismissed", detectedDate: "Jul 1, 2026", actor: "G...42MN" },
];

const mockInvestigations: Investigation[] = [
  { id: 1, caseNumber: "INV-2026-0012", pvoId: 2, title: "Suspicious Bid Patterns — Road Paving Project", status: "Evidence Gathering", openedDate: "Jul 2, 2026", assignedTo: "ACA Agent Santos" },
  { id: 2, caseNumber: "INV-2026-0011", pvoId: 1, title: "Price Inflation — Cement Procurement", status: "Open", openedDate: "Jul 3, 2026", assignedTo: "ACA Agent Cruz" },
];

export function AntiCorruptionDashboard() {
  const { connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"alerts" | "investigations" | "riskmap" | "reports">("alerts");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🛡️</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the anti-corruption monitoring system.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Anti-Corruption Agency</h1>
      <p className="text-slate-500 mb-6">AI-powered fraud detection, investigation case management, and corruption risk monitoring.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["alerts", "investigations", "riskmap", "reports"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "alerts" && "🚨 Fraud Alerts"}
            {tab === "investigations" && "📁 Investigations"}
            {tab === "riskmap" && "🗺️ Risk Map"}
            {tab === "reports" && "📤 Reports"}
          </button>
        ))}
      </div>

      {activeTab === "alerts" && <AlertsTab alerts={mockAlerts} />}
      {activeTab === "investigations" && <InvestigationsTab investigations={mockInvestigations} />}
      {activeTab === "riskmap" && <RiskMapTab alerts={mockAlerts} />}
      {activeTab === "reports" && <ReportsTab />}
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: Alert[] }) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const filtered = alerts.filter((a) => severityFilter === "all" || a.severity.toLowerCase() === severityFilter);
  const critical = alerts.filter((a) => a.severity === "Critical" || a.severity === "High").length;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Alerts", value: alerts.length, color: "text-slate-900" },
          { label: "Critical/High", value: critical, color: "text-red-600" },
          { label: "Investigating", value: alerts.filter((a) => a.status === "Investigating").length, color: "text-amber-600" },
          { label: "Avg AI Risk", value: `${Math.round(alerts.reduce((s, a) => s + a.aiRiskScore, 0) / alerts.length)}`, color: "text-brand-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="select max-w-xs">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="space-y-4">
        {filtered.map((alert) => (
          <div key={alert.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`badge ${
                  alert.severity === "Critical" ? "badge-red" :
                  alert.severity === "High" ? "badge-amber" :
                  alert.severity === "Medium" ? "badge-blue" : "badge-green"
                }`}>{alert.severity}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{alert.type}</h3>
                  <p className="text-xs text-slate-400">PVO #{alert.pvoId} · Actor: {formatAddress(alert.actor, 4)}</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  alert.aiRiskScore >= 70 ? "text-red-600" :
                  alert.aiRiskScore >= 40 ? "text-amber-600" : "text-emerald-600"
                }`}>{alert.aiRiskScore}</div>
                <p className="text-xs text-slate-400">AI Risk Score</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-3">{alert.description}</p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Detected: {alert.detectedDate}</span>
                <span className={`badge ${alert.status === "Confirmed" || alert.status === "Reported" ? "badge-red" : alert.status === "Investigating" ? "badge-amber" : "badge-green"}`}>{alert.status}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs px-3 py-1.5">Open Case</button>
                <button className="btn-secondary text-xs px-3 py-1.5">View Evidence</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvestigationsTab({ investigations }: { investigations: Investigation[] }) {
  return (
    <div className="space-y-4">
      {investigations.map((inv) => (
        <div key={inv.id} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs font-mono text-slate-400">{inv.caseNumber}</code>
                <span className={`badge ${
                  inv.status === "Escalated" ? "badge-red" :
                  inv.status === "Closed" ? "badge-green" :
                  inv.status === "Evidence Gathering" ? "badge-amber" : "badge-blue"
                }`}>{inv.status}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{inv.title}</h3>
              <p className="text-sm text-slate-500">PVO #{inv.pvoId} · Opened {inv.openedDate}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Assigned to: <span className="font-medium text-slate-700">{inv.assignedTo}</span></span>
            <div className="flex gap-2">
              <button className="btn-primary text-xs px-3 py-1.5">View Case Files</button>
              <button className="btn-secondary text-xs px-3 py-1.5">Add Evidence</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskMapTab({ alerts }: { alerts: Alert[] }) {
  const pvoRisks = alerts.reduce((acc, a) => {
    if (!acc[a.pvoId]) acc[a.pvoId] = { maxRisk: 0, alertCount: 0 };
    acc[a.pvoId].maxRisk = Math.max(acc[a.pvoId].maxRisk, a.aiRiskScore);
    acc[a.pvoId].alertCount++;
    return acc;
  }, {} as Record<number, { maxRisk: number; alertCount: number }>);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Corruption Risk by Project</h3>
        {Object.entries(pvoRisks).map(([pvoId, data]) => (
          <div key={pvoId} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">PVO #{pvoId}</span>
              <span className="text-slate-500">{data.alertCount} alert(s)</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${data.maxRisk >= 70 ? "progress-red" : data.maxRisk >= 40 ? "progress-amber" : "progress-green"}`}
                style={{ width: `${data.maxRisk}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={`font-medium ${data.maxRisk >= 70 ? "text-red-600" : data.maxRisk >= 40 ? "text-amber-600" : "text-emerald-600"}`}>
                Risk Score: {data.maxRisk}/100
              </span>
              <span className="text-slate-400">
                {data.maxRisk >= 70 ? "High Risk" : data.maxRisk >= 40 ? "Moderate Risk" : "Low Risk"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Alert Type Distribution</h3>
        <div className="space-y-2">
          {Object.entries(
            alerts.reduce((acc, a) => {
              acc[a.type] = (acc[a.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{type}</span>
              <span className="badge badge-amber">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="card p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4 text-slate-900">File Corruption Report</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
          <input type="number" className="input" placeholder="Project under investigation" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Report Category</label>
          <select className="select">
            <option value="">Select category...</option>
            <option>Price Manipulation</option>
            <option>Collusion / Bid Rigging</option>
            <option>Ghost Projects / Padding</option>
            <option>Falsified Evidence</option>
            <option>Unauthorized Payment Release</option>
            <option>Conflict of Interest</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description</label>
          <textarea className="input" rows={5}
            placeholder="Describe the irregularity, include evidence references, dates, and parties involved..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supporting Evidence (IPFS Hash)</label>
          <input type="text" className="input" placeholder="Qm... (documents, photos, transactions)" />
        </div>
        <button type="submit" className="btn-primary w-full py-3">Submit Report</button>
      </form>
    </div>
  );
}
