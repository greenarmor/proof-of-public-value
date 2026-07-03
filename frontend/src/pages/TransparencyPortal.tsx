import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_IDS } from "../config";
import { formatBudget, formatAddress, formatTimestamp, statusToString } from "../helpers";
import "leaflet/dist/leaflet.css";

const ProjectMap = lazy(() => import("./ProjectMap"));

interface PVOData {
  id: number; title: string; description: string; department: string;
  municipality: string; total_budget: string; status: string;
  contractor: string; public_value_score: number; milestones: number[]; created_at: number;
}

export function TransparencyPortal() {
  const [pvos, setPvos] = useState<PVOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPvo, setSelectedPvo] = useState<PVOData | null>(null);

  const loadPVOs = useCallback(async () => {
    setLoading(true);
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await client.get_pvo_count();
      const pvoList: PVOData[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) pvoList.push({ id: r.result.id, title: r.result.title, description: r.result.description, department: r.result.department, municipality: r.result.municipality, total_budget: String(r.result.total_budget), status: statusToString(r.result.status), contractor: r.result.contractor, public_value_score: r.result.public_value_score, milestones: r.result.milestones as any, created_at: Number(r.result.created_at) });
        } catch {}
      }
      setPvos(pvoList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPVOs(); }, [loadPVOs]);

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton-shimmer h-32 rounded-xl" />)}
    </div>
  );

  if (selectedPvo) return <PVODetail pvo={selectedPvo} onBack={() => setSelectedPvo(null)} />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Public Transparency Portal</h1>
        <p className="text-slate-500">{pvos.length} project{pvos.length !== 1 ? "s" : ""} tracked on-chain · No wallet required</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pvos.map(pvo => (
          <button key={pvo.id} onClick={() => setSelectedPvo(pvo)}
            className="card-interactive text-left p-5 group">
            <div className="flex items-start justify-between mb-3">
              <span className="badge-blue">{pvo.status}</span>
              <span className="text-xs text-slate-400 font-mono">#{pvo.id}</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1 truncate group-hover:text-brand-700 transition-colors">{pvo.title}</h3>
            <p className="text-sm text-slate-500 mb-3">{pvo.department} · {pvo.municipality}</p>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-mono text-slate-700 font-medium">⨎ {formatBudget(pvo.total_budget)}</span>
              <span className="text-slate-400">{pvo.milestones.length} milestone{pvo.milestones.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Value Score</span>
                <span className="font-semibold text-slate-700">{pvo.public_value_score}/100</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill progress-green" style={{ width: `${pvo.public_value_score}%` }} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {pvos.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg text-slate-400">No projects found on-chain yet.</p>
        </div>
      )}

      {pvos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">🗺️ Project Map</h2>
          <Suspense fallback={<div className="skeleton-shimmer h-96 rounded-xl" />}>
            <ProjectMap pvos={pvos} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function PVODetail({ pvo, onBack }: { pvo: PVOData; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">← Back to all projects</button>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{pvo.title}</h1>
            <p className="text-slate-500 mt-1">{pvo.description}</p>
          </div>
          <span className="badge-blue self-start shrink-0">{pvo.status}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          {[
            ["Department", pvo.department],
            ["Location", pvo.municipality],
            ["Budget", `⨎ ${formatBudget(pvo.total_budget)}`],
            ["Contractor", formatAddress(pvo.contractor)],
            ["Created", formatTimestamp(pvo.created_at)],
            ["Value Score", `${pvo.public_value_score}/100`],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="stat-label">{label as string}</dt>
              <dd className="text-sm font-medium text-slate-900 mt-1">{value}</dd>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">📸 Citizen Reports</h2>
        <div className="space-y-3">
          {[{ id: 1, type: "GpsPhoto", milestone: "Site Preparation", citizen: "G...ACMSV", confidence: 70 }].map(r => (
            <div key={r.id} className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
              <span className="text-2xl">📸</span>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="badge-green">{r.type}</span></div>
                <p className="text-sm text-slate-700 mt-1">Milestone: {r.milestone}</p>
                <p className="text-xs text-slate-400 mt-0.5">By {r.citizen} · {r.confidence}% confidence</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
