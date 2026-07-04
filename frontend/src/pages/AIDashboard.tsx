import { useState, useEffect, useCallback } from "react";
import { Client as AIOracleClient } from "../contracts/ai_oracle/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";

interface FraudResult {
  id: number;
  pvo_id: number;
  risk_score: number;
  indicators: string[];
  confidence: number;
  auditor: string;
  timestamp: number;
  evidence_hash: string;
}

export function AIDashboard() {
  const [activeTab, setActiveTab] = useState<"fraud" | "risk" | "image" | "twin" | "geo" | "gps">("fraud");
  const [fraudResults, setFraudResults] = useState<FraudResult[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFraud = useCallback(async () => {
    setLoading(true);
    try {
      const client = new AIOracleClient({
        contractId: CONTRACT_IDS.ai_oracle,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const count = await client.get_fraud_count();
      const results: FraudResult[] = [];
      const total = Number(count.result);
      for (let i = 1; i <= total; i++) {
        const r = await client.get_fraud_detection({ id: i });
        if (r.result) {
          results.push({
            id: r.result.id,
            pvo_id: r.result.pvo_id,
            risk_score: r.result.risk_score,
            indicators: r.result.indicators.map((ind: any) =>
              typeof ind === "string" ? ind : ind.tag
            ),
            confidence: r.result.confidence,
            auditor: r.result.auditor,
            timestamp: Number(r.result.timestamp),
            evidence_hash: r.result.evidence_hash,
          });
        }
      }
      setFraudResults(results);
    } catch (e) {
      console.error("Failed to load AI fraud results:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "fraud") loadFraud();
  }, [activeTab, loadFraud]);

  const riskCategories = ["Low", "Medium", "High", "Critical"];
  const riskColors = ["bg-green-100 text-green-700", "bg-yellow-100 text-yellow-700", "bg-orange-100 text-orange-700", "bg-red-100 text-red-700"];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Monitoring Dashboard</h1>
      <p className="text-gray-500 mb-6">AI-powered fraud detection, risk prediction, image verification, and digital twin analysis.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Fraud Alerts", value: fraudResults.filter((f) => f.risk_score >= 50).length, color: "text-red-600" },
          { label: "Total Scans", value: fraudResults.length, color: "text-gray-900" },
          { label: "High Risk", value: fraudResults.filter((f) => f.risk_score >= 75).length, color: "text-orange-600" },
          { label: "Avg Confidence", value: fraudResults.length > 0 ? `${Math.round(fraudResults.reduce((s, r) => s + r.confidence, 0) / fraudResults.length)}%` : "—", color: "text-purple-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-500">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${stat.color}`}>{stat.value}</dd>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["fraud", "risk", "image", "twin", "geo", "gps"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "fraud" && "🔍 Fraud Detection"}
            {tab === "risk" && "📈 Risk Prediction"}
            {tab === "image" && "🛰️ Image Verification"}
            {tab === "twin" && "🏗️ Digital Twin"}
            {tab === "geo" && "🌍 Geo Risk"}
            {tab === "gps" && "📍 GPS Valid"}
          </button>
        ))}
      </div>

      {activeTab === "fraud" && (
        <FraudTab results={fraudResults} loading={loading} />
      )}
      {activeTab === "risk" && <RiskTab />}
      {activeTab === "image" && <ImageTab />}
      {activeTab === "twin" && <DigitalTwinTab />}
      {activeTab === "geo" && <GeoRiskTab pvoId={1} />}
      {activeTab === "gps" && <GpsValidationTab />}
    </div>
  );
}

function FraudTab({ results, loading }: { results: FraudResult[]; loading: boolean }) {
  if (loading) return <div className="text-center py-10 text-gray-400">Loading AI analysis...</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">PVO</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Risk</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Indicators</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Confidence</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs">#{r.id}</td>
              <td className="px-4 py-3">PVO #{r.pvo_id}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full w-16 overflow-hidden">
                    <div className={`h-full rounded-full ${r.risk_score >= 75 ? "bg-red-500" : r.risk_score >= 50 ? "bg-orange-500" : r.risk_score >= 25 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${r.risk_score}%` }} />
                  </div>
                  <span className="font-mono text-xs">{r.risk_score}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {r.indicators.map((ind) => (
                    <span key={ind} className="px-1.5 py-0.5 text-xs rounded bg-red-50 text-red-700">
                      {ind.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">{r.confidence}%</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.evidence_hash.slice(0, 12)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length === 0 && <div className="text-center py-10 text-gray-400">No fraud detection results yet.</div>}
    </div>
  );
}

function RiskTab() {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        // Read PVOs to get contractor addresses
        const { Client: PvoClient } = await import("../contracts/pvo_core/src");
        const pvoClient = new PvoClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await pvoClient.get_pvo_count();
        const results: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await pvoClient.get_pvo({ pvo_id: i });
            if (r.result) {
              const risk = await client.get_latest_risk_prediction({ contractor: (r.result as any).contractor });
              if (risk.result) results.push({ ...risk.result, pvoId: Number((r.result as any).id), contractor: (r.result as any).contractor });
            }
          } catch {}
        }
        setRisks(results);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;
  if (risks.length === 0) return <div className="card p-6 text-center text-slate-400">No risk predictions yet. AI auditors can submit via ai_oracle.</div>;

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">Contractor Risk Predictions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risks.map((r, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">PVO #{r.pvoId}</span>
              <span className={`badge ${Number(r.risk_level) <= 2 ? "badge-green" : Number(r.risk_level) <= 3 ? "badge-amber" : "badge-red"}`}>
                Risk Level {Number(r.risk_level || 0)}/5
              </span>
            </div>
            <p className="text-sm text-gray-500">{r.reason || 'No details'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageTab() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const items: any[] = [];
        for (let i = 1; i <= 20; i++) {
          try {
            const r = await client.get_image_verification({ id: i });
            if (r.result) items.push(r.result);
          } catch { break; }
        }
        setResults(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;
  if (results.length === 0) return <div className="card p-6 text-center text-slate-400">No image verifications yet.</div>;

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">Image Verification Results</h3>
      <div className="space-y-4">
        {results.map((v, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Verification #{Number(v.id)}</span>
              <span className={`badge ${v.verified === true ? "badge-green" : "badge-red"}`}>
                {v.verified === true ? "Authentic" : "Tampered"}
              </span>
            </div>
            <p className="text-sm text-gray-500">Confidence: {Number(v.confidence || 0)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DigitalTwinTab() {
  const [twins, setTwins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const { Client: PvoClient } = await import("../contracts/pvo_core/src");
        const pvoClient = new PvoClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await pvoClient.get_pvo_count();
        const items: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_digital_twin({ pvo_id: i });
            if (r.result) items.push(r.result);
          } catch {}
        }
        setTwins(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;
  if (twins.length === 0) return <div className="card p-6 text-center text-slate-400">No digital twins generated yet.</div>;

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">Digital Twins</h3>
      <div className="space-y-4">
        {twins.map((t, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">PVO #{Number(t.pvo_id)}</span>
              <span className="badge badge-purple">Twin #{Number(t.id)}</span>
            </div>
            <p className="text-sm text-gray-500">Expected Cost: {Number(t.expected_cost || 0)} · Actual: {Number(t.actual_cost || 0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeoRiskTab({ pvoId }: { pvoId: number }) {
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new AIOracleClient({
          contractId: CONTRACT_IDS.ai_oracle,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const r = await client.get_geo_risk({ pvo_id: pvoId });
        setRisk(r.result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [pvoId]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>;
  if (!risk) return <div className="text-center py-10 text-gray-400">No geo risk data for PVO #{pvoId}.</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold mb-4">Geographic Risk — {risk.region}</h3>
      <p className="text-sm text-gray-400 mb-6">Flood, seismic, and landslide risk assessment.</p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Flood", val: risk.flood_risk, c: "bg-blue-500" },
          { label: "Seismic", val: risk.seismic_risk, c: "bg-orange-500" },
          { label: "Landslide", val: risk.landslide_risk, c: "bg-amber-700" },
        ].map((r) => (
          <div key={r.label} className="border rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">{r.label}<span>{r.val}%</span></div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.val}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-gray-500">Overall Score</span>
        <span className="font-bold text-lg">{risk.overall_risk_score}/100</span>
      </div>
    </div>
  );
}

function GpsValidationTab() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const items: any[] = [];
        for (let i = 1; i <= 20; i++) {
          try {
            const r = await client.get_gps_validation({ id: i });
            if (r.result) items.push(r.result);
          } catch { break; }
        }
        setResults(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (results.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-400">
        <h3 className="font-semibold mb-4 text-slate-700">GPS Validation</h3>
        No GPS validations yet. AI auditors submit via ai_oracle.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">GPS Coordinate Validation</h3>
      <div className="space-y-4">
        {results.map((v, i) => (
          <div key={i} className={`border rounded-lg p-4 ${v.valid === true ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Validation #{Number(v.id)}</span>
              <span className={`badge ${v.valid === true ? "badge-green" : "badge-red"}`}>
                {v.valid === true ? "In Range" : "Out of Range"}
              </span>
            </div>
            <p className="text-sm text-gray-500">PVO #{Number(v.pvo_id || 0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
