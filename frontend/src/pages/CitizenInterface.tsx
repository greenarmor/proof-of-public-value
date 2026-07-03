import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as CommunityOracleClient } from "../contracts/community_oracle/src";
import { Client as ReputationClient } from "../contracts/reputation/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";
import { formatAddress } from "../helpers";

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
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "browse" && "🗺️ Browse"}
            {tab === "report" && "📸 Report"}
            {tab === "my" && "⭐ Reputation"}
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
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new CommunityOracleClient({ contractId: CONTRACT_IDS.community_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const count = await client.get_report_count();
        const items: any[] = [];
        for (let i = 1; i <= Number(count.result) && i <= 20; i++) {
          const r = await client.get_report({ report_id: i });
          if (r.result) items.push(r.result);
        }
        setReports(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading reports...</div>;

  return (
    <div className="space-y-4">
      {reports.map((r: any) => (
        <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700">
                {typeof r.report_type === "string" ? r.report_type : r.report_type?.tag}
              </span>
              <span className="ml-2 text-sm text-gray-500">PVO #{r.pvo_id} · Milestone #{r.milestone_id}</span>
            </div>
            {r.verified ? (
              <span className="text-xs text-green-600">✅ Verified</span>
            ) : (
              <span className="text-xs text-yellow-600">⏳ Pending</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Citizen: {formatAddress(r.citizen)} · Confidence: {r.confidence_score || 0}%
          </div>
        </div>
      ))}
      {reports.length === 0 && <div className="text-center py-10 text-gray-400">No community reports yet.</div>}
    </div>
  );
}

function CitizenReport() {
  const { address } = useWallet();
  const [pvoId, setPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [reportType, setReportType] = useState<string>("GpsPhoto");
  const [dataHash, setDataHash] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setMessage(null);
    try {
      // In production: sign via Freighter and submit transaction
      setMessage({ text: `Report submitted! In production, this signs via Freighter and calls community_oracle.submit_report().`, ok: true });
      setPvoId(""); setMilestoneId(""); setDataHash(""); setLat(""); setLon("");
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Community Report</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Lat (microdegrees)</label>
            <input type="number" value={lat} onChange={(e) => setLat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="14599512" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Lon (microdegrees)</label>
            <input type="number" value={lon} onChange={(e) => setLon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="120984220" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Hash / Photo Reference</label>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="IPFS hash or file reference" required />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
          {submitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

function CitizenReputation() {
  const { address } = useWallet();
  const [rep, setRep] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const client = new CommunityOracleClient({ contractId: CONTRACT_IDS.community_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_citizen_reputation({ citizen: address });
        setRep(result.result);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading reputation...</div>;
  const total = rep?.total_reports ?? 0;
  const verified = rep?.verified_reports ?? 0;
  const confidence = rep?.confidence_rating ?? 50;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Your Civic Reputation</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="text-3xl font-bold text-purple-600">{total}</dt>
            <dd className="text-sm text-gray-500 mt-1">Total Reports</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-green-600">{verified}</dt>
            <dd className="text-sm text-gray-500 mt-1">Verified</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-blue-600">{confidence}%</dt>
            <dd className="text-sm text-gray-500 mt-1">Confidence</dd>
          </div>
        </div>
        <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-400 to-purple-600 rounded-full" style={{ width: `${confidence}%` }} />
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
