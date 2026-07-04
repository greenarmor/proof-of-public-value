import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as AIOracleClient } from "../contracts/ai_oracle/src";
import { Client as EscrowClient } from "../contracts/escrow/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency } from "../config";
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
  const [activeTab, setActiveTab] = useState<"fraud" | "risk" | "image" | "twin" | "geo" | "gps" | "gate">("fraud");
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
      {activeTab === "geo" && <GeoRiskTab pvoId={1} />}
      {activeTab === "gps" && <GpsValidationTab />}
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
type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

function EscrowGateTab({ address, connected, onConnect }: { address: string | null; connected: boolean; onConnect: () => void }) {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-5xl mb-4">🔓</div>
        <h3 className="font-semibold text-slate-700 mb-2">Wallet Connection Required</h3>
        <p className="text-sm text-slate-400 mb-4">Connect your AI Auditor wallet to pass Gate 3 on escrows.</p>
        <button onClick={onConnect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const client = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await client.get_escrow_count();
      const list: any[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_escrow({ escrow_id: i });
          if (r.result) {
            const e = r.result as any;
            if (!e.conditions.ai_risk_check && e.status.tag === "Funded") {
              list.push(e);
            }
          }
        } catch {}
      }
      setEscrows(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="card p-5 skeleton h-32" />)}</div>;

  if (escrows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🤖</div>
        <h3 className="font-semibold text-slate-700 mb-1">No escrows awaiting AI validation</h3>
        <p className="text-sm text-slate-400">Funded escrows that need AI risk check will appear here.</p>
      </div>
    );
  }

  const currency = getCurrency();

  return (
    <div className="space-y-3">
      {escrows.map((e: any) => <AIGateCard key={Number(e.id)} escrow={e} currency={currency} address={address!} onAction={load} />)}
    </div>
  );
}

function AIGateCard({ escrow, currency, address, onAction }: { escrow: any; currency: string; address: string; onAction: () => void }) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const escrowId = Number(escrow.id);

  const handleGate = async (passed: boolean) => {
    setTxState("preparing"); setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call("ai_validate", new Address(address).toScVal(), xdr.ScVal.scvU32(escrowId), xdr.ScVal.scvBool(passed));
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      setTxState("signing"); const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      setTxState("sending"); const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }
      setTxState("done"); setTxMsg(passed ? "AI validated! Gate 3 passed." : "AI rejected.");
      setTimeout(() => onAction(), 3000);
    } catch (err: any) { setTxState("error"); setTxMsg(err.message?.slice(0, 150) || "Failed"); }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";
  const gates = [
    { label: "Engineer", done: escrow.conditions.engineer_approval },
    { label: "AI", done: escrow.conditions.ai_risk_check },
    { label: "Compliance", done: escrow.conditions.compliance_validation },
    { label: `Community (${Number(escrow.conditions.community_confirmation)}/${Number(escrow.conditions.community_required)})`, done: Number(escrow.conditions.community_confirmation) >= Number(escrow.conditions.community_required) },
  ];

  return (
    <div className="card p-5">
      {txMsg && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-xs text-slate-400 font-mono">Escrow #{escrowId}</span><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">PVO #{Number(escrow.pvo_id)}</span></div>
          <p className="font-semibold text-slate-900">{currency}{(Number(escrow.amount)/100).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">Recipient: {formatAddress(escrow.recipient, 4)} · Funder: {formatAddress(escrow.funder, 4)}</p>
        </div>
        <span className="badge badge-amber">{escrow.status.tag || escrow.status}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {gates.map((gate, i) => (
          <div key={i} className={`rounded-lg p-1.5 text-center text-[11px] font-medium border ${gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
            <div className="text-sm mb-0.5">{gate.done ? "✓" : "○"}</div>{gate.label}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">{gates.filter(g => g.done).length}/4 gates passed</span>
        <div className="flex gap-2">
          <button onClick={() => handleGate(true)} disabled={busy} className="btn-primary text-xs px-4 py-2">{busy ? "Signing..." : "✓ Pass AI (Gate 3)"}</button>
          <button onClick={() => handleGate(false)} disabled={busy} className="btn-danger text-xs px-4 py-2">✗ Reject</button>
          {busy && <span className="text-xs text-brand-600 self-center animate-pulse">Check Freighter...</span>}
        </div>
      </div>
    </div>
  );
}
