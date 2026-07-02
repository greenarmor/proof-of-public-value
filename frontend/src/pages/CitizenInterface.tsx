import { useState, useCallback } from "react";
import { useWallet } from "../wallet";

const REPORT_TYPES = [
  "GpsPhoto", "GpsVideo", "FloodReport", "CompletionVerification",
  "QualityReport", "DamageReport", "UsageReport",
] as const;

export function CitizenInterface() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"browse" | "report" | "my">("browse");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to browse projects and submit community reports.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Citizen Interface</h1>
      <p className="text-gray-500 mb-6">Browse infrastructure projects, submit reports, and track your civic reputation.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["browse", "report", "my"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "browse" && "🗺️ Browse Projects"}
            {tab === "report" && "📸 Submit Report"}
            {tab === "my" && "⭐ My Reputation"}
          </button>
        ))}
      </div>

      {activeTab === "browse" && <CitizenBrowse />}
      {activeTab === "report" && <CitizenReport />}
      {activeTab === "my" && <CitizenReputation />}
    </div>
  );
}

function CitizenBrowse() {
  const projects = [
    { id: 1, title: "Road Paving Project", department: "DPWH", location: "Quezon City", status: "In Progress", confidence: 85 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <input type="text" placeholder="Search by name or location..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
        <select className="px-3 py-2 border border-gray-300 rounded-lg">
          <option>All Departments</option>
          <option>DPWH</option>
          <option>DOH</option>
        </select>
      </div>

      {projects.map((p) => (
        <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.department} · {p.location}</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700">{p.status}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">Community Confidence: {p.confidence}%</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[200px] overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${p.confidence}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CitizenReport() {
  const [pvoId, setPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [reportType, setReportType] = useState<string>("GpsPhoto");
  const [dataHash, setDataHash] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Community Report</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
            <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/([A-Z])/g, " $1").trim()}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Latitude</label>
            <input type="number" value={lat} onChange={(e) => setLat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="14.5995" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Longitude</label>
            <input type="number" value={lon} onChange={(e) => setLon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="120.9842" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Hash / Photo Reference</label>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="IPFS hash or file reference" required />
        </div>
        <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Submit Report
        </button>
      </form>
    </div>
  );
}

function CitizenReputation() {
  const stats = { totalReports: 2, verifiedReports: 1, confidenceRating: 70 };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Your Civic Reputation</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="text-3xl font-bold text-purple-600">{stats.totalReports}</dt>
            <dd className="text-sm text-gray-500 mt-1">Total Reports</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-green-600">{stats.verifiedReports}</dt>
            <dd className="text-sm text-gray-500 mt-1">Verified</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-blue-600">{stats.confidenceRating}%</dt>
            <dd className="text-sm text-gray-500 mt-1">Confidence</dd>
          </div>
        </div>
        <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-400 to-purple-600 rounded-full" style={{ width: `${stats.confidenceRating}%` }} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• Submit verified reports to increase your confidence rating</p>
          <p>• Higher confidence means your future reports carry more weight</p>
          <p>• Reports with GPS coordinates and photos earn higher trust</p>
        </div>
      </div>
    </div>
  );
}
