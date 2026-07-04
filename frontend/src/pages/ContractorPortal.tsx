import { useState, useCallback } from "react";
import { useWallet } from "../wallet";
import { uploadToIPFS } from "../ipfs";

export function ContractorPortal() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"projects" | "evidence" | "history" | "docs">("projects");

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
        {(["projects", "evidence", "docs", "history"] as const).map((tab) => (
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
            {tab === "evidence" && "📎 Upload Evidence"}
            {tab === "docs" && "📄 Documents"}
            {tab === "history" && "💳 Payments"}
          </button>
        ))}
      </div>

      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "evidence" && <EvidenceTab />}
      {activeTab === "docs" && <DocumentsTab />}
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
            <span>Budget: ₱ {p.budget}</span>
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const types = ["DroneImagery", "SatelliteImagery", "GpsCoordinates", "TimestampedPhoto", "EngineeringReport", "InspectionReport"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hash = dataHash;
    if (file) {
      setUploading(true);
      try {
        hash = await uploadToIPFS(file);
        setDataHash(hash);
        setStatus({ text: `Uploaded! ${hash.slice(0, 20)}...`, ok: true });
      } catch (err: any) {
        setStatus({ text: `IPFS upload failed: ${err.message}`, ok: false });
        setUploading(false);
        return;
      }
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Evidence</h2>
      {status && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${status.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {status.text}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidence File (Optional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition"
            onClick={() => document.getElementById("evidence-file")?.click()}>
            {file ? (
              <div className="text-sm">
                <span className="text-purple-600 font-medium">{file.name}</span>
                <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-xs text-red-500 hover:underline">remove</button>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <span className="text-2xl block mb-1">📎</span>Click to attach evidence file
              </div>
            )}
            <input id="evidence-file" type="file" className="hidden"
              accept="image/*,video/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mt-2 font-mono text-xs" placeholder="Or paste IPFS hash (Qm...)" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metadata / Notes</label>
          <textarea value={metadata} onChange={(e) => setMetadata(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={3} placeholder="Drone flyover of site preparation..." />
        </div>
        <button type="submit" disabled={uploading} className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
          {uploading ? "Uploading to IPFS..." : "Submit Evidence"}
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
              <td className="px-4 py-3 text-gray-600">₱ {p.amount}</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700">{p.status}</span></td>
              <td className="px-4 py-3 text-gray-500">{p.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab() {
  const [docName, setDocName] = useState("");
  const [docHash, setDocHash] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const submitted = [
    { name: "Engineering Report Q2", hash: "Qm...abc", date: "Jul 2, 2026", status: "Verified" },
    { name: "Material Certificate", hash: "Qm...def", date: "Jul 1, 2026", status: "Pending" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hash = docHash;
    if (file) {
      setUploading(true);
      try {
        hash = await uploadToIPFS(file);
        setDocHash(hash);
        setStatus({ text: `Uploaded! ${hash.slice(0, 20)}...`, ok: true });
      } catch (err: any) {
        setStatus({ text: `IPFS upload failed: ${err.message}`, ok: false });
        setUploading(false);
        return;
      }
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold mb-4">Submit Document</h3>
        {status && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${status.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {status.text}
          </div>
        )}
        <form className="space-y-4 max-w-lg" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
              <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
              <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document File</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition"
              onClick={() => document.getElementById("doc-file")?.click()}>
              {file ? (
                <div className="text-sm">
                  <span className="text-purple-600 font-medium">{file.name}</span>
                  <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="ml-2 text-xs text-red-500 hover:underline">remove</button>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">
                  <span className="text-2xl block mb-1">📄</span>Click to attach document
                </div>
              )}
              <input id="doc-file" type="file" className="hidden"
                accept=".pdf,.doc,.docx,image/*"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <input type="text" value={docHash} onChange={(e) => setDocHash(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mt-2 font-mono text-xs" placeholder="Or paste IPFS hash (Qm...)" required />
          </div>
          <button type="submit" disabled={uploading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50">
            {uploading ? "Uploading to IPFS..." : "Submit Document"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <h3 className="p-4 font-semibold border-b border-gray-100">Submitted Documents</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Hash</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {submitted.map((d, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{d.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.hash}</td>
                <td className="px-4 py-3 text-gray-500">{d.date}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded ${d.status === "Verified" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
