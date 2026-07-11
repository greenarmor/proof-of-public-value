import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as AIOracleClient } from "../contracts/ai_oracle/src";
import { Client as EscrowClient } from "../contracts/escrow/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { formatAddress } from "../helpers";

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
  const { address, connected, connect, hasRole } = useWallet();
  const canPassGate = hasRole("AIAuditor", "Administrator");
  const [activeTab, setActiveTab] = useState<"fraud" | "risk" | "image" | "twin" | "geo" | "gps" | "gate" | "forensic">("fraud");
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
          { label: "Avg Confidence", value: fraudResults.length > 0 ? `${Math.round(fraudResults.reduce((s, r) => s + r.confidence, 0) / fraudResults.length)}%` : "-", color: "text-purple-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-500">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${stat.color}`}>{stat.value}</dd>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["fraud", "risk", "image", "twin", "geo", "gps", "forensic"] as const).map((tab) => (
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
            {tab === "forensic" && "🔎 Forensic Cases"}
          </button>
        ))}
        {canPassGate && (
          <button onClick={() => setActiveTab("gate")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "gate" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            🔓 Escrow Gate
          </button>
        )}
      </div>

      {activeTab === "fraud" && (
        <FraudTab results={fraudResults} loading={loading} />
      )}
      {activeTab === "risk" && <RiskTab />}
      {activeTab === "image" && <ImageTab />}
      {activeTab === "twin" && <DigitalTwinTab />}
      {activeTab === "geo" && <GeoRiskTab pvoId={0} />}
      {activeTab === "gps" && <GpsValidationTab />}
      {activeTab === "forensic" && <ForensicCaseTab />}
      {activeTab === "gate" && <EscrowGateTab address={address} connected={connected} onConnect={connect} />}
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
        const { Client: PvoClient } = await import("../contracts/pvo_core/src");
        const pvoClient = new PvoClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await pvoClient.get_pvo_count();
        const seen = new Set<string>();
        const results: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await pvoClient.get_pvo({ pvo_id: i });
            if (r.result) {
              const contractor = (r.result as any).contractor;
              if (seen.has(contractor)) continue;
              seen.add(contractor);

              // Gather all PVOs for this contractor
              const pvoData = (r.result as any);
              const milestones = pvoData.milestones || [];
              const msResult = await pvoClient.get_pvo_milestones({ pvo_id: i });
              const msList = (msResult.result || []) as any[];
              const releasedCount = msList.filter((m: any) => {
                const st = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
                return st === "Released";
              }).length;
              const withEvidence = msList.filter((m: any) => (m.submitted_evidence ?? []).length > 0).length;

              // Compute reasoning
              const factors: string[] = [];
              const budgetPesos = Number(pvoData.total_budget ?? 0) / PPHP_SCALE;
              if (budgetPesos > 1_000_000_000) factors.push("Large-scale project (>1B)");
              const pendingRatio = msList.length > 0 ? (msList.length - releasedCount) / msList.length : 1;
              if (pendingRatio > 0.5) factors.push(`${pendingRatio > 0.75 ? "Majority" : "Half"} of milestones still pending`);
              if (msList.length > 0 && withEvidence / msList.length < 0.5) factors.push("Low evidence submission rate");
              factors.push(`Funded by ${pvoData.fund_source || "unknown source"}`);

              // Fetch geo risk for reasoning
              let geoInfo = "";
              try {
                const geo = await client.get_geo_risk({ pvo_id: i });
                if (geo.result) {
                  const g = geo.result as any;
                  if (Number(g.flood_risk) > 60) geoInfo += `High flood risk (${g.flood_risk}%). `;
                  if (Number(g.landslide_risk) > 60) geoInfo += `High landslide risk (${g.landslide_risk}%). `;
                }
              } catch {}
              if (geoInfo) factors.push(geoInfo.trim());

              const risk = await client.get_latest_risk_prediction({ contractor });
              if (risk.result) {
                results.push({
                  ...risk.result,
                  pvoId: Number(pvoData.id),
                  pvoTitle: pvoData.title,
                  contractor,
                  reasoning: factors,
                });
              }
            }
          } catch {}
        }
        setRisks(results);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;
  if (risks.length === 0) return <div className="card p-6 text-center text-slate-400">No risk predictions yet. The AI Oracle submits these automatically.</div>;

  const catLabels = ["Low", "Medium", "High", "Critical"];
  const catColors = ["badge-green", "badge-amber", "badge-red", "badge-red"];

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">Contractor Risk Predictions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risks.map((r, i) => {
          const cat = Number(r.risk_category ?? 0);
          return (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{r.pvoTitle}</span>
                  <span className="text-xs text-gray-400 ml-2">PVO #{r.pvoId}</span>
                </div>
                <span className={`badge ${catColors[cat] ?? "badge-blue"}`}>{catLabels[cat] ?? "Unknown"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Delay</p>
                  <p className="font-medium text-gray-700">{Number(r.delay_probability ?? 0)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Overrun</p>
                  <p className="font-medium text-gray-700">{Number(r.overrun_probability ?? 0)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Confidence</p>
                  <p className="font-medium text-gray-700">{Number(r.confidence ?? 0)}%</p>
                </div>
              </div>
              {r.reasoning && Array.isArray(r.reasoning) && r.reasoning.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Risk Factors:</p>
                  <ul className="space-y-1">
                    {r.reasoning.map((factor: string, idx: number) => (
                      <li key={idx} className="text-xs text-gray-500 flex items-start gap-1">
                        <span className="text-orange-400 mt-0.5">-</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[10px] text-gray-300 font-mono mt-2">{String(r.contractor).slice(0, 16)}...</p>
            </div>
          );
        })}
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
        for (let i = 1; i <= 50; i++) {
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
        {results.map((v, i) => {
          const auth = Number(v.authenticity_score ?? 0);
          const isAuthentic = auth >= 70;
          return (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Evidence #{Number(v.evidence_id)}</span>
                <span className={`badge ${isAuthentic ? "badge-green" : "badge-red"}`}>
                  {isAuthentic ? "Authentic" : "Suspicious"}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-500">
                <p>Authenticity Score: <span className="font-medium text-gray-700">{auth}%</span></p>
                <p>Progress Estimate: <span className="font-medium text-gray-700">{Number(v.progress_percent ?? 0)}%</span></p>
                {v.summary && <p className="text-xs text-gray-400 mt-1">{String(v.summary).slice(0, 120)}</p>}
              </div>
            </div>
          );
        })}
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
        {twins.map((t, i) => {
          const cost = Number(t.expected_cost ?? 0) / PPHP_SCALE;
          const deviation = t.deviation_alert === true;
          return (
            <div key={i} className={`border rounded-lg p-4 ${deviation ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">PVO #{Number(t.pvo_id)}</span>
                {deviation && <span className="badge badge-red">Deviation Alert</span>}
              </div>
              <div className="space-y-1 text-sm text-gray-500">
                <p>Expected Cost: <span className="font-medium text-gray-700">{cost.toLocaleString()}</span></p>
                <p>Material Cost Index: <span className="font-medium text-gray-700">{Number(t.material_cost_index ?? 0)}</span></p>
                <p>Labor Cost Index: <span className="font-medium text-gray-700">{Number(t.labor_cost_index ?? 0)}</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeoRiskTab({ pvoId }: { pvoId: number }) {
  const [risks, setRisks] = useState<any[]>([]);
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
            const r = await client.get_geo_risk({ pvo_id: i });
            if (r.result) {
              const pvo = await pvoClient.get_pvo({ pvo_id: i });
              items.push({ ...r.result, pvoTitle: (pvo.result as any)?.title ?? `PVO #${i}` });
            }
          } catch {}
        }
        setRisks(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;
  if (risks.length === 0) return <div className="card p-6 text-center text-slate-400">No geo risk assessments yet.</div>;

  return (
    <div className="space-y-4">
      {risks.map((risk, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-1">Geographic Risk - {risk.region}</h3>
          <p className="text-xs text-gray-400 mb-4">{risk.pvoTitle}</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Flood", val: Number(risk.flood_risk ?? 0), c: "bg-blue-500" },
              { label: "Seismic", val: Number(risk.seismic_risk ?? 0), c: "bg-orange-500" },
              { label: "Landslide", val: Number(risk.landslide_risk ?? 0), c: "bg-amber-700" },
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
            <span className="font-bold text-lg">{Number(risk.overall_risk_score ?? 0)}/100</span>
          </div>
        </div>
      ))}
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
        No GPS validations yet. The AI Oracle submits these automatically.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4">GPS Coordinate Validation</h3>
      <div className="space-y-4">
        {results.map((v, i) => {
          const within = v.within_range === true;
          const dist = Number(v.distance_meters ?? 0);
          const fmtCoord = (raw: any) => (Number(raw) / 1_000_000).toFixed(6);
          return (
            <div key={i} className={`border rounded-lg p-4 ${within ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Evidence #{Number(v.evidence_id)}</span>
                <span className={`badge ${within ? "badge-green" : "badge-red"}`}>
                  {within ? "In Range" : "Out of Range"}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-500">
                <p>Reported: <span className="font-mono text-gray-700">[{fmtCoord(v.reported_lat)}, {fmtCoord(v.reported_lon)}]</span></p>
                <p>Expected: <span className="font-mono text-gray-700">[{fmtCoord(v.expected_lat)}, {fmtCoord(v.expected_lon)}]</span></p>
                <p>Distance: <span className="font-medium text-gray-700">{dist.toLocaleString()}m</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

interface EscrowWithOracle {
  escrow: any;
  pvoTitle: string;
  pvoMunicipality: string;
  contractor: string;
  milestone: any;
  fraudData: any;
  riskData: any;
  geoData: any;
  twinData: any;
}

function EscrowGateTab({ address, connected, onConnect }: { address: string | null; connected: boolean; onConnect: () => void }) {
  const [escrows, setEscrows] = useState<EscrowWithOracle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const escrowClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const aiClient = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const { Client: PvoClient } = await import("../contracts/pvo_core/src");
      const pvoClient = new PvoClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });

      const cnt = await escrowClient.get_escrow_count();
      const list: EscrowWithOracle[] = [];

      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await escrowClient.get_escrow({ escrow_id: i });
          if (!r.result) continue;
          const escrow = r.result as any;
          const pvoId = Number(escrow.pvo_id);

          let pvoTitle = `PVO #${pvoId}`;
          let pvoMunicipality = "";
          let contractor = "";
          try {
            const pvoR = await pvoClient.get_pvo({ pvo_id: pvoId });
            if (pvoR.result) {
              pvoTitle = (pvoR.result as any).title || pvoTitle;
              pvoMunicipality = (pvoR.result as any).municipality || "";
              contractor = (pvoR.result as any).contractor || "";
            }
          } catch {}

          let milestone = null;
          try {
            const msR = await pvoClient.get_pvo_milestones({ pvo_id: pvoId });
            const msList = (msR.result || []) as any[];
            milestone = msList.find((m: any) => Number(m.id) === Number(escrow.milestone_id)) || null;
          } catch {}

          let fraudData = null;
          try {
            const fr = await aiClient.get_fraud_by_pvo({ pvo_id: pvoId });
            const frauds = (fr.result || []) as any[];
            fraudData = frauds[frauds.length - 1] || null;
          } catch {}

          let riskData = null;
          if (contractor) {
            try {
              const rr = await aiClient.get_latest_risk_prediction({ contractor });
              riskData = rr.result || null;
            } catch {}
          }

          let geoData = null;
          try {
            const gr = await aiClient.get_geo_risk({ pvo_id: pvoId });
            geoData = gr.result || null;
          } catch {}

          let twinData = null;
          try {
            const tr = await aiClient.get_digital_twin({ pvo_id: pvoId });
            twinData = tr.result || null;
          } catch {}

          list.push({ escrow, pvoTitle, pvoMunicipality, contractor, milestone, fraudData, riskData, geoData, twinData });
        } catch {}
      }
      setEscrows(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (connected) load(); }, [connected]);

  const isReady = (e: EscrowWithOracle) => {
    const c = e.escrow.conditions;
    return !c.ai_risk_check && c.engineer_approval && c.compliance_validation && c.community_oracle_validation
      && Number(c.community_confirmation) >= Number(c.community_required);
  };
  const isValidated = (e: EscrowWithOracle) => e.escrow.conditions.ai_risk_check === true;
  const awaiting = escrows.filter(isReady);
  const validated = escrows.filter(isValidated);
  const pipeline = escrows.filter(e => !isReady(e) && !isValidated(e));

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-5xl mb-4">🔓</div>
        <h3 className="font-semibold text-slate-700 mb-2">Wallet Connection Required</h3>
        <p className="text-sm text-slate-400 mb-4">Connect your AI Auditor wallet to manage Gate 5 on escrows.</p>
        <button onClick={onConnect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="card p-5 skeleton h-32" />)}</div>;

  const currency = getCurrency();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <dt className="text-sm text-gray-500">Awaiting AI Gate</dt>
          <dd className="text-2xl font-bold text-amber-600">{awaiting.length}</dd>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <dt className="text-sm text-gray-500">AI Validated</dt>
          <dd className="text-2xl font-bold text-green-600">{validated.length}</dd>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <dt className="text-sm text-gray-500">In Pipeline</dt>
          <dd className="text-2xl font-bold text-gray-900">{pipeline.length}</dd>
        </div>
      </div>

      {escrows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="font-semibold text-slate-700 mb-1">No escrows found</h3>
          <p className="text-sm text-slate-400">Escrows will appear here once created. Gate 5 (AI fraud check) is the final gate before release.</p>
        </div>
      ) : (
        <>
          {awaiting.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Awaiting AI Validation (Gate 5)</h3>
              <div className="space-y-3">
                {awaiting.map((e) => <AIGateCard key={Number(e.escrow.id)} data={e} currency={currency} address={address!} onAction={load} />)}
              </div>
            </div>
          )}
          {validated.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">AI Validated</h3>
              <div className="space-y-3">
                {validated.map((e) => <AIGateCard key={Number(e.escrow.id)} data={e} currency={currency} address={address!} onAction={load} />)}
              </div>
            </div>
          )}
          {pipeline.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">In Pipeline (Gates 1-4)</h3>
              <div className="space-y-3">
                {pipeline.map((e) => <AIGateCard key={Number(e.escrow.id)} data={e} currency={currency} address={address!} onAction={load} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AIGateCard({ data, currency, address, onAction }: { data: EscrowWithOracle; currency: string; address: string; onAction: () => void }) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const escrow = data.escrow;
  const escrowId = Number(escrow.id);
  const pvoId = Number(escrow.pvo_id);

  const c = escrow.conditions;
  const gates = [
    { label: "Engineer", done: c.engineer_approval },
    { label: "Compliance", done: c.compliance_validation },
    { label: "Oracle", done: c.community_oracle_validation || false },
    { label: `Community (${Number(c.community_confirmation)}/${Number(c.community_required)})`, done: Number(c.community_confirmation) >= Number(c.community_required) },
    { label: "AI Risk", done: c.ai_risk_check },
  ];

  const status = typeof escrow.status === "string" ? escrow.status : escrow.status?.tag ?? "";
  const readyForGate5 = !c.ai_risk_check && c.engineer_approval && c.compliance_validation && c.community_oracle_validation
    && Number(c.community_confirmation) >= Number(c.community_required);

  const fraudRisk = data.fraudData ? Number(data.fraudData.risk_score ?? 0) : null;
  const fraudConfidence = data.fraudData ? Number(data.fraudData.confidence ?? 0) : null;
  const fraudIndicators = data.fraudData
    ? (data.fraudData.indicators || []).map((ind: any) => typeof ind === "string" ? ind : ind?.tag ?? "")
    : [];
  const riskDelay = data.riskData ? Number(data.riskData.delay_probability ?? 0) : null;
  const riskOverrun = data.riskData ? Number(data.riskData.overrun_probability ?? 0) : null;
  const riskCat = data.riskData ? Number(data.riskData.risk_category ?? 0) : null;
  const geoFlood = data.geoData ? Number(data.geoData.flood_risk ?? 0) : null;
  const geoSeismic = data.geoData ? Number(data.geoData.seismic_risk ?? 0) : null;
  const geoLandslide = data.geoData ? Number(data.geoData.landslide_risk ?? 0) : null;
  const twinDeviation = data.twinData ? data.twinData.deviation_alert === true : false;
  const twinMaterial = data.twinData ? Number(data.twinData.material_cost_index ?? 0) : null;
  const twinLabor = data.twinData ? Number(data.twinData.labor_cost_index ?? 0) : null;

  const oracleRecommendation = fraudRisk !== null ? (fraudRisk < 50 ? "pass" : "reject") : null;
  const catLabels = ["Low", "Medium", "High", "Critical"];
  const hasOracleData = fraudRisk !== null || riskDelay !== null || geoFlood !== null || twinMaterial !== null;

  const submitVerdict = async (passed: boolean) => {
    setTxState("preparing"); setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call("ai_validate", new Address(address).toScVal(), xdr.ScVal.scvU32(escrowId), xdr.ScVal.scvBool(passed));
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setTxState("done");
      setTxMsg(passed ? "AI Gate 5 PASSED - submitted on-chain." : "AI Gate 5 REJECTED - submitted on-chain.");
      setTimeout(() => onAction(), 3000);
    } catch (err: any) { setTxState("error"); setTxMsg(err.message?.slice(0, 150) || "Failed"); }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <div className="card p-5">
      {txMsg && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✓ " : "✗ "}{txMsg}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-mono">Escrow #{escrowId}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{data.pvoTitle} (PVO #{pvoId})</span>
          </div>
          {data.milestone && <p className="font-semibold text-slate-900">{data.milestone.title}</p>}
          <p className="text-xs text-slate-400 mt-0.5">
            {currency}{(Number(escrow.amount)/PPHP_SCALE).toLocaleString()} · {(data.milestone?.submitted_evidence || []).length} evidence items
          </p>
        </div>
        <span className={`badge ${status === "Released" ? "badge-green" : status === "Funded" ? "badge-blue" : "badge-amber"}`}>{status}</span>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {gates.map((gate, i) => (
          <div key={i} className={`rounded-lg p-1.5 text-center text-[11px] font-medium border ${gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
            <div className="text-sm mb-0.5">{gate.done ? "✓" : "○"}</div>{gate.label}
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-medium text-slate-500 mb-3">AI Oracle On-Chain Analysis</p>

        {!hasOracleData ? (
          <p className="text-xs text-slate-400">No AI Oracle analysis submitted yet for this PVO. Run the oracle service to generate analysis.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-3">
            {fraudRisk !== null && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Fraud Detection</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${fraudRisk >= 75 ? "bg-red-500" : fraudRisk >= 50 ? "bg-orange-500" : fraudRisk >= 25 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${fraudRisk}%` }} />
                  </div>
                  <span className="font-mono text-xs font-medium">{fraudRisk}/100</span>
                </div>
                {fraudConfidence !== null && <p className="text-xs text-gray-400">Confidence: {fraudConfidence}%</p>}
                {fraudIndicators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {fraudIndicators.map((ind: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-red-50 text-red-700">{ind.replace(/([A-Z])/g, " $1").trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {riskDelay !== null && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Risk Prediction</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-gray-400">Delay</p><p className="font-medium text-gray-700">{riskDelay}%</p></div>
                  <div><p className="text-gray-400">Overrun</p><p className="font-medium text-gray-700">{riskOverrun}%</p></div>
                </div>
                {riskCat !== null && <p className="text-xs text-gray-400 mt-1">Category: <span className="font-medium">{catLabels[riskCat] ?? "Unknown"}</span></p>}
              </div>
            )}

            {geoFlood !== null && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Geo Risk - {data.geoData?.region || data.pvoMunicipality}</p>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div><p className="text-gray-400">Flood</p><p className={`font-medium ${geoFlood > 60 ? "text-red-600" : "text-gray-700"}`}>{geoFlood}%</p></div>
                  <div><p className="text-gray-400">Seismic</p><p className={`font-medium ${geoSeismic! > 60 ? "text-red-600" : "text-gray-700"}`}>{geoSeismic}%</p></div>
                  <div><p className="text-gray-400">Landslide</p><p className={`font-medium ${geoLandslide! > 60 ? "text-red-600" : "text-gray-700"}`}>{geoLandslide}%</p></div>
                </div>
              </div>
            )}

            {twinMaterial !== null && (
              <div className={`border rounded-lg p-3 ${twinDeviation ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                <p className="text-xs font-medium text-slate-500 mb-2">Digital Twin {twinDeviation && <span className="badge badge-red ml-1">Deviation</span>}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-gray-400">Material Idx</p><p className="font-medium text-gray-700">{twinMaterial}</p></div>
                  <div><p className="text-gray-400">Labor Idx</p><p className="font-medium text-gray-700">{twinLabor}</p></div>
                </div>
              </div>
            )}
          </div>
        )}

        {readyForGate5 && txState !== "done" && (
          <div className="border-t pt-3">
            {oracleRecommendation && (
              <div className={`mb-3 p-3 rounded-lg text-sm ${oracleRecommendation === "pass" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                <p className="font-medium">AI Oracle Recommendation: {oracleRecommendation === "pass" ? "✓ PASS" : "✗ REJECT"}</p>
                <p className="text-xs mt-1">
                  {oracleRecommendation === "pass"
                    ? `Risk score ${fraudRisk}/100 is below threshold (50). No critical fraud indicators detected.`
                    : `Risk score ${fraudRisk}/100 exceeds threshold (50). Fraud indicators require review.`}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => submitVerdict(true)} disabled={busy}
                className="btn-primary text-sm px-4 py-2 flex-1">
                {busy ? "Signing..." : "✓ Submit PASS (Gate 5)"}
              </button>
              <button onClick={() => submitVerdict(false)} disabled={busy}
                className="btn-secondary text-sm px-4 py-2 flex-1 border-red-200 text-red-700 hover:bg-red-50">
                {busy ? "..." : "✗ Submit REJECT"}
              </button>
            </div>
            {busy && <p className="text-xs text-brand-600 text-center mt-2 animate-pulse">Check Freighter for signing prompt...</p>}
          </div>
        )}

        {txState === "done" && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">{gates.filter(g => g.done).length}/5 gates passed</span>
            <span className="badge-green text-xs px-4 py-2">Gate 5 Submitted</span>
          </div>
        )}

        {!readyForGate5 && !c.ai_risk_check && (
          <div className="border-t pt-3">
            <p className="text-xs text-slate-400">Escrow must pass Gates 1-4 (Engineer, Compliance, Oracle, Community) before AI Gate 5 can be submitted.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Forensic Case Tab ───────────────────────────────────

interface ForensicFlag {
  flag: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

interface ForensicTimelineEntry {
  timestamp: number;
  event: string;
  detail: string;
  category: string;
}

interface ForensicCase {
  pvoId: number;
  pvoTitle: string;
  status: string;
  municipality: string;
  contractor: string;
  fundSource: string;
  totalBudget: number;
  flags: ForensicFlag[];
  timeline: ForensicTimelineEntry[];
  escrowCount: number;
  grantCount: number;
  tenderCount: number;
  violationCount: number;
  communityReportCount: number;
  verifiedReportCount: number;
  contractorRepScore: number | null;
  isCompliant: boolean;
  valueScore: number | null;
  auditEntryCount: number;
  fundingGap: number | null;
  releasedMilestones: number;
  totalMilestones: number;
  evidenceCount: number;
}

function ForensicCaseTab() {
  const [cases, setCases] = useState<ForensicCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPvo, setSelectedPvo] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const PvoClient = (await import("../contracts/pvo_core/src")).Client;
        const pvoClient = new PvoClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const escrowClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const aiClient = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const GrantClient = (await import("../contracts/grant_commitment/src")).Client;
        const grantClient = new GrantClient({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ComplianceClient = (await import("../contracts/compliance_engine/src")).Client;
        const complianceClient = new ComplianceClient({ contractId: CONTRACT_IDS.compliance_engine, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const CommunityClient = (await import("../contracts/community_oracle/src")).Client;
        const communityClient = new CommunityClient({ contractId: CONTRACT_IDS.community_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const RepClient = (await import("../contracts/reputation/src")).Client;
        const repClient = new RepClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ValueClient = (await import("../contracts/value_score/src")).Client;
        const valueClient = new ValueClient({ contractId: CONTRACT_IDS.value_score, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const AuditClient = (await import("../contracts/audit_trail/src")).Client;
        const auditClient = new AuditClient({ contractId: CONTRACT_IDS.audit_trail, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ProcClient = (await import("../contracts/procurement_market/src")).Client;
        const procClient = new ProcClient({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });

        const cnt = await pvoClient.get_pvo_count();
        const allPvos: { pvoId: number; contractor: string }[] = [];
        const caseFiles: ForensicCase[] = [];

        const pvoCache: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          const r = await pvoClient.get_pvo({ pvo_id: i });
          pvoCache.push(r.result);
          if (r.result) allPvos.push({ pvoId: i, contractor: String((r.result as any).contractor || "") });
        }
        const contractorCounts: Record<string, number> = {};
        for (const p of allPvos) {
          if (p.contractor && p.contractor.length > 5) {
            contractorCounts[p.contractor] = (contractorCounts[p.contractor] || 0) + 1;
          }
        }

        for (let i = 1; i <= Number(cnt.result); i++) {
          const pvo = pvoCache[i - 1] as any;
          if (!pvo) continue;

          const flags: ForensicFlag[] = [];
          const timeline: ForensicTimelineEntry[] = [];
          const contractor = String(pvo.contractor || "");
          const totalBudgetPesos = Number(pvo.total_budget || 0) / PPHP_SCALE;

          timeline.push({ timestamp: Number(pvo.created_at || 0), event: "PVO Created", detail: `"${pvo.title}" budget ${totalBudgetPesos.toLocaleString()} funded by ${pvo.fund_source || "unknown"}`, category: "genesis" });
          const pvoStatus = typeof pvo.status === "string" ? pvo.status : pvo.status?.tag ?? "";

          const msR = await pvoClient.get_pvo_milestones({ pvo_id: i });
          const milestones = (msR.result || []) as any[];
          let evidenceCount = 0;
          let releasedCount = 0;
          for (const m of milestones) {
            const mStatus = typeof m.status === "string" ? m.status : m.status?.tag ?? "";
            if (mStatus !== "Pending") {
              timeline.push({ timestamp: 0, event: `Milestone ${mStatus}`, detail: `MS #${m.id}: ${m.title}`, category: "milestone" });
            }
            if (mStatus === "Released") releasedCount++;
            const ev = m.submitted_evidence || [];
            evidenceCount += ev.length;
            for (const e of ev) {
              const evType = typeof e.evidence_type === "string" ? e.evidence_type : e.evidence_type?.tag ?? "Unknown";
              timeline.push({ timestamp: Number(e.submitted_at || 0), event: "Evidence Submitted", detail: `${evType} for MS #${m.id}`, category: "evidence" });
            }
          }

          let escrowCount = 0;
          let escrows: any[] = [];
          let actualBudget: number | null = null;
          let actualBudgetPerMs: number | null = null;
          try {
            const eR = await escrowClient.get_escrows_by_pvo({ pvo_id: i });
            escrows = (eR.result || []) as any[];
            escrowCount = escrows.length;
            for (const e of escrows) {
              timeline.push({ timestamp: Number(e.created_at || 0), event: "Escrow Created", detail: `Escrow #${e.id}: ${Number(e.amount || 0) / PPHP_SCALE} for MS #${e.milestone_id}`, category: "escrow" });
              const eStatus = typeof e.status === "string" ? e.status : e.status?.tag ?? "";
              if (eStatus === "Released" && Number(e.released_at || 0) > 0) {
                timeline.push({ timestamp: Number(e.released_at), event: "Escrow Released", detail: `Escrow #${e.id} released`, category: "escrow" });
              }
              if (eStatus === "Disputed") { flags.push({ flag: "EscrowDisputed", severity: "high" }); }
              const ms = milestones.find((m: any) => Number(m.id) === Number(e.milestone_id));
              if (ms && Number(ms.budget) > 0) {
                const ratio = Number(e.amount) / Number(ms.budget);
                if (ratio > 1.1 || ratio < 0.9) flags.push({ flag: `EscrowBudgetMismatch: escrow ${Math.round(ratio * 100)}% of milestone budget`, severity: "medium" });
              }
            }
          } catch {}

          let grantCount = 0;
          let fundingGap: number | null = null;
          try {
            const gR = await grantClient.get_grants_by_pvo({ pvo_id: i });
            const grants = (gR.result || []) as any[];
            grantCount = grants.length;
            for (const g of grants) {
              timeline.push({ timestamp: Number(g.created_at || 0), event: "Grant Committed", detail: `${g.org_name || "Donor"}: ${Number(g.amount || 0) / PPHP_SCALE}`, category: "funding" });
            }
            const remaining = await grantClient.get_pvo_remaining({ pvo_id: i });
            const remainingNum = Number(remaining.result || 0) / PPHP_SCALE;
            if (remainingNum > 0) { fundingGap = remainingNum; flags.push({ flag: `FundingGap: ${remainingNum.toLocaleString()} unfunded`, severity: "medium" }); }
          } catch {}

          let tenderCount = 0;
          try {
            const tCnt = await procClient.get_tender_count();
            for (let t = 1; t <= Number(tCnt.result); t++) {
              const tender = await procClient.get_tender({ id: t });
              if (tender.result && Number((tender.result as any).pvo_id) === i) {
                tenderCount++;
                const td = tender.result as any;
                timeline.push({ timestamp: Number(td.created_at || 0), event: "Tender Created", detail: `${td.title}: ${Number(td.budget || 0) / PPHP_SCALE}`, category: "procurement" });
                const bids = ((await procClient.get_bids_by_tender({ tender_id: t })).result || []) as any[];
                if (bids.length === 1) flags.push({ flag: "SingleBidTender", severity: "low" });
                const prices = bids.map((b: any) => Number(b.price || 0));
                if (prices.length >= 2) {
                  const minP = Math.min(...prices), maxP = Math.max(...prices);
                  if (minP > 0 && (maxP - minP) / minP < 0.02) flags.push({ flag: "SuspiciousBidClustering", severity: "low" });
                }
                if (td.winner) timeline.push({ timestamp: 0, event: "Tender Awarded", detail: `Tender #${t} awarded`, category: "procurement" });

                // Capture winning bid as actual budget reference
                const tStatus = typeof td.status === "string" ? td.status : td.status?.tag ?? "";
                if ((tStatus === "Awarded" || td.winner) && bids.length > 0 && actualBudget === null) {
                  const winner = bids.reduce((best: any, b: any) =>
                    (Number(b.final_score || 0) > Number(best.final_score || 0)) ? b : best, bids[0]);
                  actualBudget = Number(winner.price || 0);
                  if (milestones.length > 0) actualBudgetPerMs = actualBudget / milestones.length;
                  const actualPesos = actualBudget / PPHP_SCALE;
                  const estimatedPesos = Number(pvo.total_budget || 0) / PPHP_SCALE;
                  if (estimatedPesos > 0 && Math.abs(actualPesos - estimatedPesos) / estimatedPesos > 0.05) {
                    const pct = Math.round((actualPesos - estimatedPesos) / estimatedPesos * 100);
                    flags.push({ flag: `BudgetDeviation: winning bid ${actualPesos.toLocaleString()} vs estimated ${estimatedPesos.toLocaleString()} (${pct > 0 ? "+" : ""}${pct}%)`, severity: "medium" });
                  }
                }
              }
            }
          } catch {}

          // Now recompute escrow budget flags using actual budget if available
          if (actualBudgetPerMs !== null) {
            // Remove stale EscrowBudgetMismatch flags based on estimated milestone budgets
            const staleFlags = flags.filter(f => f.flag.startsWith("EscrowBudgetMismatch"));
            for (const sf of staleFlags) {
              const idx = flags.indexOf(sf);
              if (idx >= 0) flags.splice(idx, 1);
            }
            // Recompute using actual budget per milestone
            for (const e of escrows) {
              const ms = milestones.find((m: any) => Number(m.id) === Number(e.milestone_id));
              if (!ms) continue;
              const ratio = Number(e.amount || 0) / actualBudgetPerMs;
              if (ratio > 1.1 || ratio < 0.9) {
                flags.push({ flag: `EscrowBudgetMismatch: escrow ${Math.round(ratio * 100)}% of actual per-MS (${(actualBudgetPerMs / PPHP_SCALE).toLocaleString()})`, severity: "medium" });
              }
            }
          }

          let violationCount = 0;
          let isCompliant = true;
          try {
            const vR = await complianceClient.get_violations_by_pvo({ pvo_id: i });
            const violations = (vR.result || []) as any[];
            violationCount = violations.length;
            for (const v of violations) {
              const rule = typeof v.rule === "string" ? v.rule : v.rule?.tag ?? "Unknown";
              timeline.push({ timestamp: Number(v.timestamp || 0), event: v.resolved ? "Violation Resolved" : "Violation Detected", detail: `${rule} (severity ${v.severity})`, category: "compliance" });
              if (!v.resolved && Number(v.severity) >= 70) flags.push({ flag: `CriticalViolation: ${rule}`, severity: "high" });
            }
            const compR = await complianceClient.is_pvo_compliant({ pvo_id: i });
            isCompliant = compR.result === true;
          } catch {}

          let communityReportCount = 0;
          let verifiedReportCount = 0;
          try {
            const cR = await communityClient.get_reports_by_pvo({ pvo_id: i });
            const reports = (cR.result || []) as any[];
            communityReportCount = reports.length;
            for (const cr of reports) {
              timeline.push({ timestamp: Number(cr.timestamp || 0), event: cr.verified ? "Report Verified" : "Report Submitted", detail: `${typeof cr.report_type === "string" ? cr.report_type : cr.report_type?.tag ?? "Report"}`, category: "community" });
            }
            const vCount = await communityClient.get_verified_report_count({ pvo_id: i });
            verifiedReportCount = Number(vCount.result || 0);
          } catch {}

          let contractorRepScore: number | null = null;
          if (contractor && contractor.length > 10) {
            try {
              const repR = await repClient.get_reputation({ entity: contractor });
              if (repR.result) {
                const rep = repR.result as any;
                contractorRepScore = Number(rep.reputation_score || 0);
                if (contractorRepScore < 40) flags.push({ flag: `LowReputation: ${contractorRepScore}/100`, severity: "low" });
                if (Number(rep.safety_violations || 0) > 0) flags.push({ flag: `SafetyViolations: ${rep.safety_violations}`, severity: "high" });
                if (Number(rep.audit_findings || 0) > 2) flags.push({ flag: `MultipleAuditFindings: ${rep.audit_findings}`, severity: "low" });
              } else {
                flags.push({ flag: "NoReputationRecord: no performance history", severity: "info" });
              }
            } catch { flags.push({ flag: "NoReputationRecord: no performance history", severity: "info" }); }

            if (contractorCounts[contractor] >= 3) {
              flags.push({ flag: `CollusionPattern: holds ${contractorCounts[contractor]} PVOs`, severity: "critical" });
            }
          }

          if (milestones.length > 0 && escrowCount === 0 && evidenceCount === 0 && communityReportCount === 0) {
            flags.push({ flag: "GhostProject: has milestones but no activity", severity: "critical" });
          }

          let valueScore: number | null = null;
          try {
            const vsR = await valueClient.get_score({ pvo_id: i });
            if (vsR.result) { valueScore = Number((vsR.result as any).overall_score || 0); }
          } catch {}

          let auditEntryCount = 0;
          try {
            const auditR = await auditClient.get_pvo_audit_history({ pvo_id: i });
            const entries = (auditR.result || []) as any[];
            auditEntryCount = entries.length;
            for (const entry of entries) {
              const cat = typeof entry.category === "string" ? entry.category : entry.category?.tag ?? "Unknown";
              timeline.push({ timestamp: Number(entry.timestamp || 0), event: `Audit: ${cat}`, detail: `${entry.actor_role || "Unknown"}: ${(entry.action || "").slice(0, 50)}`, category: "audit" });
            }
          } catch {}

          try {
            const frR = await aiClient.get_fraud_by_pvo({ pvo_id: i });
            const frauds = (frR.result || []) as any[];
            if (frauds.length > 0) {
              const latest = frauds[frauds.length - 1];
              timeline.push({ timestamp: Number(latest.timestamp || 0), event: "AI Fraud Detection", detail: `Risk: ${latest.risk_score}/100, confidence: ${latest.confidence}%`, category: "ai" });
            }
          } catch {}
          try {
            if (contractor) {
              const riskR = await aiClient.get_latest_risk_prediction({ contractor });
              if (riskR.result) {
                const r = riskR.result as any;
                timeline.push({ timestamp: Number(r.timestamp || 0), event: "AI Risk Prediction", detail: `Delay: ${r.delay_probability}%, Overrun: ${r.overrun_probability}%, Category: ${r.risk_category}`, category: "ai" });
              }
            }
          } catch {}

          timeline.sort((a, b) => a.timestamp - b.timestamp);

          caseFiles.push({
            pvoId: i, pvoTitle: pvo.title || `PVO #${i}`, status: pvoStatus,
            municipality: pvo.municipality || "", contractor, fundSource: pvo.fund_source || "",
            totalBudget: totalBudgetPesos, flags, timeline, escrowCount, grantCount, tenderCount,
            violationCount, communityReportCount, verifiedReportCount, contractorRepScore, isCompliant,
            valueScore, auditEntryCount, fundingGap, releasedMilestones: releasedCount,
            totalMilestones: milestones.length, evidenceCount,
          });
        }
        setCases(caseFiles);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (selectedPvo !== null) {
    const caseData = cases.find((c) => c.pvoId === selectedPvo);
    if (caseData) return <ForensicCaseDetail data={caseData} onBack={() => setSelectedPvo(null)} />;
  }

  if (cases.length === 0) return <div className="card p-6 text-center text-slate-400">No PVOs found.</div>;

  const sevColors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
    info: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3 mb-2">
        <div className="bg-white border border-gray-200 rounded-lg p-3"><dt className="text-xs text-gray-500">Total PVOs</dt><dd className="text-xl font-bold text-gray-900">{cases.length}</dd></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><dt className="text-xs text-gray-500">Critical Flags</dt><dd className="text-xl font-bold text-red-600">{cases.reduce((s, c) => s + c.flags.filter(f => f.severity === "critical").length, 0)}</dd></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><dt className="text-xs text-gray-500">Ghost Projects</dt><dd className="text-xl font-bold text-orange-600">{cases.filter(c => c.flags.some(f => f.flag.includes("GhostProject"))).length}</dd></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><dt className="text-xs text-gray-500">Total Flags</dt><dd className="text-xl font-bold text-purple-600">{cases.reduce((s, c) => s + c.flags.length, 0)}</dd></div>
      </div>

      {cases.map((c) => (
        <div key={c.pvoId} onClick={() => setSelectedPvo(c.pvoId)}
          className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-purple-300 hover:shadow-sm transition">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{c.pvoTitle}</span>
                <span className="text-xs text-gray-400">PVO #{c.pvoId}</span>
              </div>
              <p className="text-xs text-gray-400">{c.municipality} · {c.status} · Budget: {c.totalBudget.toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
              {c.flags.slice(0, 4).map((f, i) => (
                <span key={i} className={`px-1.5 py-0.5 text-xs rounded border ${sevColors[f.severity]}`}>{f.flag.split(":")[0].replace(/([A-Z])/g, " $1").trim()}</span>
              ))}
              {c.flags.length > 4 && <span className="text-xs text-gray-400">+{c.flags.length - 4}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
            <span>{c.timeline.length} events</span>
            <span>{c.escrowCount} escrows</span>
            <span>{c.grantCount} grants</span>
            <span>{c.tenderCount} tenders</span>
            <span>{c.violationCount} violations</span>
            <span>{c.communityReportCount} reports</span>
            <span>{c.releasedMilestones}/{c.totalMilestones} milestones</span>
            <span>{c.evidenceCount} evidence</span>
            {c.contractorRepScore !== null && <span>Rep: {c.contractorRepScore}</span>}
            {c.fundingGap !== null && <span className="text-orange-500">Gap: {c.fundingGap.toLocaleString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const catIcons: Record<string, string> = {
  genesis: "📋", milestone: "📌", evidence: "📎", escrow: "💰",
  funding: "🤝", procurement: "📮", compliance: "⚠", community: "👥",
  audit: "📝", ai: "🤖",
};

const catColors: Record<string, string> = {
  genesis: "border-l-blue-400", milestone: "border-l-purple-400", evidence: "border-l-cyan-400", escrow: "border-l-green-400",
  funding: "border-l-indigo-400", procurement: "border-l-pink-400", compliance: "border-l-red-400", community: "border-l-teal-400",
  audit: "border-l-gray-400", ai: "border-l-violet-400",
};

function ForensicCaseDetail({ data, onBack }: { data: ForensicCase; onBack: () => void }) {
  const sevColors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
    info: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const fmtTime = (ts: number) => {
    if (!ts) return "";
    try { return new Date(ts * 1000).toLocaleString(); } catch { return ""; }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-purple-600 hover:text-purple-800">← Back to all cases</button>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{data.pvoTitle}</h2>
            <p className="text-sm text-gray-400">PVO #{data.pvoId} · {data.municipality} · {data.status}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>Budget: <strong>{data.totalBudget.toLocaleString()}</strong></span>
              <span>Fund: <strong>{data.fundSource}</strong></span>
              <span>Contractor: <code className="text-xs">{data.contractor.slice(0, 16)}...</code></span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border rounded p-2"><p className="text-xs text-gray-400">Rep Score</p><p className="font-bold text-gray-900">{data.contractorRepScore ?? "N/A"}</p></div>
            <div className="border rounded p-2"><p className="text-xs text-gray-400">Value Score</p><p className="font-bold text-gray-900">{data.valueScore ?? "N/A"}</p></div>
            <div className={`border rounded p-2 ${data.isCompliant ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}><p className="text-xs text-gray-400">Compliance</p><p className="font-bold text-gray-900">{data.isCompliant ? "Pass" : "Fail"}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: "Escrows", val: data.escrowCount }, { label: "Grants", val: data.grantCount },
            { label: "Tenders", val: data.tenderCount }, { label: "Violations", val: data.violationCount },
            { label: "Community", val: data.communityReportCount }, { label: "Verified", val: data.verifiedReportCount },
            { label: "Audit Entries", val: data.auditEntryCount }, { label: "Evidence", val: data.evidenceCount },
            { label: "Milestones", val: `${data.releasedMilestones}/${data.totalMilestones}` },
            { label: "Funding Gap", val: data.fundingGap !== null ? data.fundingGap.toLocaleString() : "None" },
          ].map((s) => (
            <div key={s.label} className="border border-gray-200 rounded p-2 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-sm font-medium text-gray-700">{s.val}</p>
            </div>
          ))}
        </div>

        {data.flags.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-500 mb-2">Forensic Flags ({data.flags.length})</p>
            <div className="flex flex-wrap gap-2">
              {data.flags.map((f, i) => (
                <span key={i} className={`px-2 py-1 text-xs rounded border ${sevColors[f.severity]}`}>{f.flag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold mb-4">Forensic Timeline ({data.timeline.length} events)</h3>
        <div className="space-y-2">
          {data.timeline.map((entry, i) => (
            <div key={i} className={`flex gap-3 border-l-2 pl-3 py-1.5 ${catColors[entry.category] || "border-l-gray-300"}`}>
              <div className="flex-shrink-0 text-sm">{catIcons[entry.category] || "o"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{entry.event}</span>
                  {entry.timestamp > 0 && <span className="text-xs text-gray-300 flex-shrink-0">{fmtTime(entry.timestamp)}</span>}
                </div>
                {entry.detail && <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
