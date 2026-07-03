import { useState } from "react";
import { useWallet } from "../wallet";

const CATEGORIES = [
  "Approval", "Payment", "EvidenceReview", "ComplianceCheck",
  "AIRiskAssessment", "MilestoneRelease", "RoleChange",
  "DisputeResolution", "ContractModification", "ProcurementAward",
] as const;

interface AuditEntry {
  id: number;
  pvoId: number;
  category: string;
  actor: string;
  riskScore: number;
  timestamp: string;
  action: string;
}

const mockEntries: AuditEntry[] = [
  { id: 1, pvoId: 1, category: "MilestoneRelease", actor: "G...ACMSV", riskScore: 10, timestamp: "Jul 3, 2026", action: "Milestone 2 released" },
];

export function AuditorDashboard() {
  const { address, connected, connect } = useWallet();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to access the audit trail.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  const filtered = mockEntries.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterRisk === "high" && e.riskScore < 50) return false;
    if (filterRisk === "medium" && (e.riskScore < 20 || e.riskScore >= 50)) return false;
    if (filterRisk === "low" && e.riskScore >= 20) return false;
    return true;
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Auditor Dashboard</h1>
      <p className="text-gray-500 mb-6">Full audit trail with filtering, risk scoring, and compliance status.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Entries", value: mockEntries.length, color: "text-gray-900" },
          { label: "High Risk", value: "0", color: "text-red-600" },
          { label: "PVOs Tracked", value: "1", color: "text-purple-600" },
          { label: "Compliance %", value: "100%", color: "text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-500">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${stat.color}`}>{stat.value}</dd>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/([A-Z])/g, " $1").trim()}</option>)}
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All Risk Levels</option>
          <option value="high">High Risk (≥50)</option>
          <option value="medium">Medium Risk (20-49)</option>
          <option value="low">Low Risk (&lt;20)</option>
        </select>
        <button onClick={() => alert("Export CSV coming soon")} className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          📥 Export CSV
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Risk</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-500">#{entry.id}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700">
                    {entry.category.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-900">{entry.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.actor}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    entry.riskScore >= 50 ? "text-red-600" : entry.riskScore >= 20 ? "text-yellow-600" : "text-green-600"
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {entry.riskScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{entry.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">No audit entries match your filters.</div>
        )}
      </div>
    </div>
  );
}
