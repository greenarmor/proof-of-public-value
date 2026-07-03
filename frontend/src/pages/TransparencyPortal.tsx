import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_IDS } from "../config";
import { formatBudget, formatAddress, formatTimestamp, statusToString } from "../helpers";

const ProjectMap = lazy(() => import("./ProjectMap"));

interface PVOData {
  id: number; title: string; description: string; department: string;
  municipality: string; total_budget: string; status: string;
  contractor: string; public_value_score: number; milestones: number[]; created_at: number;
}

const STATUS_COLORS: Record<string, string> = {
  Proposed: "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Under Review": "bg-purple-50 text-purple-700 border-purple-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
  Suspended: "bg-red-50 text-red-700 border-red-200",
  Terminated: "bg-slate-50 text-slate-700 border-slate-200",
};

export function TransparencyPortal() {
  const [pvos, setPvos] = useState<PVOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PVOData | null>(null);
  const [filter, setFilter] = useState("");

  const loadPVOs = useCallback(async () => {
    setLoading(true);
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await client.get_pvo_count();
      const list: PVOData[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) list.push({ id: r.result.id, title: r.result.title, description: r.result.description, department: r.result.department, municipality: r.result.municipality, total_budget: String(r.result.total_budget), status: statusToString(r.result.status), contractor: r.result.contractor, public_value_score: r.result.public_value_score, milestones: r.result.milestones as any, created_at: Number(r.result.created_at) });
        } catch {}
      }
      setPvos(list);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPVOs(); }, [loadPVOs]);

  const filtered = filter ? pvos.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()) || p.department.toLowerCase().includes(filter.toLowerCase()) || p.municipality.toLowerCase().includes(filter.toLowerCase())) : pvos;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center"><div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"/><p className="text-slate-400">Loading projects from Stellar testnet...</p></div>
    </div>
  );

  if (selected) return (
    <div>
      <button onClick={() => setSelected(null)} className="btn-ghost mb-4">← Back to all projects</button>
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2"><span className="font-mono text-sm text-slate-400">PVO #{selected.id}</span><span className={`badge ${STATUS_COLORS[selected.status] || "badge-blue"}`}>{selected.status}</span></div>
            <h1 className="text-2xl font-bold text-slate-900">{selected.title}</h1><p className="text-slate-500 mt-1">{selected.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          {[["Department",selected.department],["Location",selected.municipality],["Budget",formatBudget(selected.total_budget)],["Contractor",formatAddress(selected.contractor)],["Created",formatTimestamp(selected.created_at)],["Score",`${selected.public_value_score}/100`],["Milestones",selected.milestones.length]].map(([l,v])=>(
            <div key={l as string}><dt className="stat-label">{l}</dt><dd className="text-sm font-medium text-slate-900 mt-1">{v}</dd></div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Public Transparency Portal</h1>
          <p className="text-slate-500 text-sm">{pvos.length} project{pvos.length!==1?"s":""} tracked on-chain · No wallet required</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Filter by name, dept, location..." value={filter} onChange={e=>setFilter(e.target.value)} className="input max-w-[260px] text-sm" />
          {filter&&<button onClick={()=>setFilter("")} className="text-xs text-brand-600 hover:underline">Clear</button>}
        </div>
      </div>

      {/* Split: Map + Grid */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-[45%] lg:sticky lg:top-20 lg:self-start">
          <Suspense fallback={<div className="skeleton-shimmer h-[70vh] rounded-xl"/>}>
            <ProjectMap pvos={filtered} />
          </Suspense>
        </div>
        <div className="flex-1">
          {filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-20 text-center"><div className="text-5xl mb-4">📭</div><p className="text-lg text-slate-400">{filter?"No projects match":"No projects on-chain yet"}</p></div>
          ):(
            <div className="grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
              {filtered.map(pvo=>(
                <button key={pvo.id} onClick={()=>setSelected(pvo)} className="card-interactive text-left p-4 group">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-[11px] text-slate-400">#{pvo.id}</span>
                    <span className={`badge text-[10px] ${STATUS_COLORS[pvo.status]||"badge-blue"}`}>{pvo.status}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2 group-hover:text-brand-700 transition-colors">{pvo.title}</h3>
                  <p className="text-xs text-slate-500 mb-3">{pvo.department} · {pvo.municipality}</p>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-semibold text-slate-700">{formatBudget(pvo.total_budget)}</span>
                    <span className="text-slate-400">{pvo.milestones.length} milestone{pvo.milestones.length!==1?"s":""}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Value Score</span><span className="font-semibold text-slate-600">{pvo.public_value_score}/100</span>
                    </div>
                    <div className="progress-bar"><div className={`progress-fill ${pvo.public_value_score>=75?"progress-green":pvo.public_value_score>=50?"progress-amber":"progress-red"}`} style={{width:`${pvo.public_value_score}%`}}/></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
