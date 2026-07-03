import { useState, useCallback } from "react";
import { useWallet } from "../wallet";
import { formatBudget, formatAddress } from "../helpers";

export function AgencyDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "create_pvo" | "create_milestone" | "fund">("overview");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your Freighter wallet to manage projects.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Government Agency Dashboard</h1>
      <p className="text-gray-500 mb-6">Create and manage Public Value Objects (PVOs).</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { id: "overview", label: "📋 Project Overview" },
          { id: "create_pvo", label: "➕ New PVO" },
          { id: "create_milestone", label: "🏗️ Define Milestone" },
          { id: "fund", label: "💰 Fund Escrow" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <ProjectOverview />}
      {activeTab === "create_pvo" && <CreatePVOForm />}
      {activeTab === "create_milestone" && <CreateMilestoneForm />}
      {activeTab === "fund" && <FundEscrowForm />}
    </div>
  );
}

function ProjectOverview() {
  const projects = [
    { id: 1, title: "Road Paving Project", department: "DPWH", location: "Quezon City", budget: "10000000", status: "Proposed", milestones: 1, score: 0, contractor: "G...ACMSV" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Projects", value: projects.length, color: "text-gray-900" },
          { label: "Total Budget", value: `⨎ ${projects.reduce((s, p) => s + Number(p.budget), 0).toLocaleString()}`, color: "text-purple-600" },
          { label: "Active Milestones", value: projects.reduce((s, p) => s + p.milestones, 0), color: "text-blue-600" },
          { label: "Avg Value Score", value: `${projects.reduce((s, p) => s + p.score, 0) / projects.length}/100`, color: "text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-500">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${stat.color}`}>{stat.value}</dd>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status Pipeline</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">#{p.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">{p.department}</td>
                <td className="px-4 py-3 font-mono text-gray-600">⨎ {formatBudget(p.budget)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {["Proposed", "Approved", "InProgress", "Completed"].map((stage) => (
                      <div key={stage} className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${p.status === stage ? "bg-green-500 ring-2 ring-green-200" : "bg-gray-200"}`} />
                        <span className="text-[10px] text-gray-400">{stage}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-700">{p.score}</span>
                  <span className="text-gray-400">/100</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreatePVOForm() {
  const { address } = useWallet();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [fundSource, setFundSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setResult(null);
    try {
      setResult("Use \`stellar contract invoke --id pvo_core -- create_pvo ...\` via CLI to create PVOs.");
    } catch (err) {
      setResult(`Error: ${err}`);
    } finally {
      setSubmitting(false);
    }
  }, [address]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">Create New PVO</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Road Paving Project" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="DPWH" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
            <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Quezon City" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (stroops)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="10000000" required />
            {budget && <p className="text-xs text-gray-400 mt-1">≈ ⨎ {formatBudget(budget)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fund Source</label>
            <input type="text" value={fundSource} onChange={(e) => setFundSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="National Budget 2026" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={3} placeholder="Paving 10km of national road..." required />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
          {submitting ? "Submitting..." : "Create PVO"}
        </button>
      </form>
      {result && <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{result}</div>}
    </div>
  );
}

function CreateMilestoneForm() {
  const { address } = useWallet();
  const [pvoId, setPvoId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [communityRequired, setCommunityRequired] = useState("2");
  const [evidenceTypes, setEvidenceTypes] = useState<string[]>(["DroneImagery"]);

  const allTypes = ["DroneImagery", "SatelliteImagery", "GpsCoordinates", "TimestampedPhoto", "EngineeringReport", "InspectionReport"];

  const toggleType = (t: string) => {
    setEvidenceTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">Define Milestone</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Community Required</label>
            <input type="number" value={communityRequired} onChange={(e) => setCommunityRequired(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" min="0" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Site Preparation" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="3000000" required />
          {budget && <p className="text-xs text-gray-400 mt-1">≈ ⨎ {formatBudget(budget)}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={2} placeholder="Clear and grade the site..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required Evidence Types</label>
          <div className="flex flex-wrap gap-2">
            {allTypes.map((t) => (
              <button key={t} type="button" onClick={() => toggleType(t)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  evidenceTypes.includes(t) ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {t.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Create Milestone
        </button>
      </form>
    </div>
  );
}

function FundEscrowForm() {
  const [escrowId, setEscrowId] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Fund Escrow</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Escrow ID</label>
          <input type="number" value={escrowId} onChange={(e) => setEscrowId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (stroops)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Must match escrow amount" required />
          {amount && <p className="text-xs text-gray-400 mt-1">≈ ⨎ {formatBudget(amount)}</p>}
        </div>
        <p className="text-xs text-gray-400">
          ⚠️ Amount must exactly match the escrow amount. Funds are locked until all 5 gates pass.
        </p>
        <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Fund Escrow
        </button>
      </form>
    </div>
  );
}
