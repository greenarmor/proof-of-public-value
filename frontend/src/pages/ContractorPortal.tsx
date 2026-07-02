import { useState, useCallback } from "react";
import { useWallet } from "../wallet";

export function ContractorPortal() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"projects" | "evidence" | "history">("projects");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to view assigned projects.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contractor Portal</h1>
      <p className="text-gray-500 mb-6">Manage your assigned projects, submit evidence, and track payments.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["projects", "evidence", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "projects" && "📋 My Projects"}
            {tab === "evidence" && "📎 Submit Evidence"}
            {tab === "history" && "💳 Payment History"}
          </button>
        ))}
      </div>

      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "evidence" && <EvidenceTab />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

function ProjectsTab() {
  const mockProjects = [
    { id: 1, title: "Road Paving Project", department: "DPWH", milestone: "Site Preparation", status: "In Progress", budget: "10,000,000" },
  ];

  return (
    <div className="space-y-4">
      {mockProjects.map((p) => (
        <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.department} · Milestone: {p.milestone}</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-700">{p.status}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>Budget: ⨎ {p.budget}</span>
            <span className="text-purple-600 cursor-pointer hover:underline">View Details →</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceTab() {
  const [milestoneId, setMilestoneId] = useState("");
  const [dataHash, setDataHash] = useState("");
  const [metadata, setMetadata] = useState("");
  const [evidenceType, setEvidenceType] = useState("DroneImagery");

  const types = ["DroneImagery", "SatelliteImagery", "GpsCoordinates", "TimestampedPhoto", "EngineeringReport", "InspectionReport"];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Evidence</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
          <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Type</label>
          <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            {types.map((t) => <option key={t} value={t}>{t.replace(/([A-Z])/g, " $1").trim()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Hash (IPFS)</label>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Qm..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metadata / Notes</label>
          <textarea value={metadata} onChange={(e) => setMetadata(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={3} placeholder="Drone flyover of site preparation..." />
        </div>
        <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Submit Evidence
        </button>
      </form>
    </div>
  );
}

function HistoryTab() {
  const payments = [
    { id: 1, milestone: "Site Preparation", amount: "3,000,000", status: "Released", date: "Jul 3, 2026" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Milestone</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t border-gray-100">
              <td className="px-4 py-3 font-medium text-gray-900">{p.milestone}</td>
              <td className="px-4 py-3 text-gray-600">⨎ {p.amount}</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700">{p.status}</span></td>
              <td className="px-4 py-3 text-gray-500">{p.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
