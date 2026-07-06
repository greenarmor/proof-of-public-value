import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Client as EscrowClient, type Escrow as ChainEscrow } from "../contracts/escrow/src";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { formatBudget, formatAddress, formatTimestamp, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";

const ProjectMap = lazy(() => import("./ProjectMap"));

interface PVOData {
  id: number; title: string; description: string; department: string;
  municipality: string; total_budget: string; status: string;
  contractor: string; public_value_score: number; milestones: number[]; created_at: number;
  gpsCoordinates?: Array<{ lat: number; lng: number; milestoneId: number; evidenceId: number }>;
  latitude?: number; longitude?: number;
  milestonesReleased: number;
  milestonesTotal: number;
  budgetReleased: number;
}

function parseCoords(desc: string): { lat?: number; lng?: number; clean: string } {
  const match = desc.match(/^\[(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\]\s*/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), clean: desc.slice(match[0].length) };
  }
  return { clean: desc };
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
  const currency = getCurrency();
  const [pvos, setPvos] = useState<PVOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PVOData | null>(null);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [escrowsLoading, setEscrowsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [pvoFunding, setPvoFunding] = useState<Record<number, { funded: number; escrowed: number; released: number }>>({});

  const loadPVOs = useCallback(async () => {
    setLoading(true);
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await client.get_pvo_count();
      const list: PVOData[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) {
            const { lat, lng, clean } = parseCoords(r.result.description || "");
            const pvo: PVOData = { id: r.result.id, title: r.result.title, description: clean, department: r.result.department, municipality: r.result.municipality, total_budget: String(r.result.total_budget), status: statusToString(r.result.status), contractor: r.result.contractor, public_value_score: r.result.public_value_score, milestones: r.result.milestones as any, created_at: Number(r.result.created_at), gpsCoordinates: [], latitude: lat, longitude: lng, milestonesReleased: 0, milestonesTotal: (r.result.milestones as any[] || []).length, budgetReleased: 0 };

            // Fetch milestone evidence to extract GPS coordinates + count Released
            try {
              const mResult = await client.get_pvo_milestones({ pvo_id: i });
              const milestones = (mResult.result || []) as any[];
              const coords: PVOData["gpsCoordinates"] = [];
              let releasedCount = 0;
              let budgetReleased = 0;
              for (const m of milestones) {
                // Count Released milestones + sum budgets
                const mStatus = statusToString(m.status);
                if (mStatus === "Released") {
                  releasedCount++;
                  budgetReleased += Number(m.budget || 0);
                }
                // GPS extraction
                const items = m.submitted_evidence || [];
                for (const ev of items) {
                  const type = statusToString(ev.evidence_type);
                  if (type === "Gps Coordinates" && ev.metadata) {
                    // Parse "lat:14.599512,lng:120.984220" or "14.599512,120.984220"
                    const meta: string = ev.metadata;
                    const latMatch = meta.match(/lat:?\s*(-?\d+\.?\d*)/i);
                    const lngMatch = meta.match(/lng:?\s*(-?\d+\.?\d*)/i);
                    if (latMatch && lngMatch) {
                      coords.push({ lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]), milestoneId: Number(m.id), evidenceId: Number(ev.id) });
                    } else {
                      const parts = meta.split(",");
                      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                        coords.push({ lat: parseFloat(parts[0]), lng: parseFloat(parts[1]), milestoneId: Number(m.id), evidenceId: Number(ev.id) });
                      }
                    }
                  }
                }
              }
              pvo.gpsCoordinates = coords;
              pvo.milestonesReleased = releasedCount;
              pvo.budgetReleased = budgetReleased;
            } catch {}

            list.push(pvo);
          }
        } catch {}
      }
      setPvos(list);
    } catch {} finally { setLoading(false); }
  }, []);

  // Fetch funding data (grants + escrows) per PVO
  useEffect(() => {
    (async () => {
      try {
        const { Client: GC } = await import("../contracts/grant_commitment/src");
        const gc = new GC({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const grants = (await gc.get_all_grants()).result || [];

        const ec = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ecCnt = Number((await ec.get_escrow_count()).result);
        const allEscrows: any[] = [];
        for (let eid = 1; eid <= ecCnt; eid++) {
          try { const r = await ec.get_escrow({ escrow_id: eid }); if (r.result) allEscrows.push(r.result); } catch {}
        }

        const funding: Record<number, { funded: number; escrowed: number; released: number }> = {};
        for (const g of grants) {
          const pid = Number(g.pvo_id);
          if (!funding[pid]) funding[pid] = { funded: 0, escrowed: 0, released: 0 };
          funding[pid].funded += Number(g.amount);
        }
        for (const e of allEscrows) {
          const pid = Number(e.pvo_id);
          if (!funding[pid]) funding[pid] = { funded: 0, escrowed: 0, released: 0 };
          funding[pid].escrowed += Number(e.amount);
          // Check if escrow was Released to contractor
          let eStatus = "";
          if (e.status) {
            if (typeof e.status === "string") eStatus = e.status;
            else if (typeof e.status === "number") eStatus = String(e.status);
            else eStatus = (e.status as any).tag || "";
          }
          if (eStatus === "Released") {
            funding[pid].released += Number(e.amount);
          }
        }
        setPvoFunding(funding);
      } catch {}
    })();
  }, []);

  useEffect(() => { loadPVOs(); }, [loadPVOs]);

  // Load escrows when a PVO is selected
  useEffect(() => {
    if (!selected) { setEscrows([]); return; }
    (async () => {
      setEscrowsLoading(true);
      try {
        const client = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_escrows_by_pvo({ pvo_id: selected.id });
        const raw = (result.result || []) as ChainEscrow[];
        const mapped = raw.map(e => ({
          id: Number(e.id),
          milestoneId: Number(e.milestone_id),
          funder: e.funder,
          recipient: e.recipient,
          amount: Number(e.amount),
          status: statusToString(e.status),
          engineer: e.conditions.engineer_approval,
          ai: e.conditions.ai_risk_check,
          compliance: e.conditions.compliance_validation,
          oracle: (e.conditions as any).community_oracle_validation || false,
          community: Number(e.conditions.community_confirmation),
          communityRequired: Number(e.conditions.community_required),
        }));
        setEscrows(mapped);
      } catch {} finally { setEscrowsLoading(false); }
    })();
  }, [selected]);

  const filtered = filter ? pvos.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()) || p.department.toLowerCase().includes(filter.toLowerCase()) || p.municipality.toLowerCase().includes(filter.toLowerCase())) : pvos;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center"><div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"/><p className="text-slate-400">Loading projects from Stellar testnet...</p></div>
    </div>
  );

  return (
    <div>
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

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map — always visible on left */}
        <div className="lg:w-[45%] lg:sticky lg:top-20 lg:self-start">
          <Suspense fallback={<div className="skeleton-shimmer h-[70vh] rounded-xl"/>}>
            <ProjectMap pvos={filtered} selectedPvoId={selected?.id} />
          </Suspense>
        </div>

        {/* Right panel: grid or detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            /* PVO Detail — expanded in right panel */
            <div>
              <button onClick={() => setSelected(null)} className="btn-ghost mb-4 text-sm">← Back to all projects</button>
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-slate-400">PVO #{selected.id}</span>
                      <span className={`badge ${STATUS_COLORS[selected.status] || "badge-blue"}`}>{selected.status}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{selected.title}</h1>
                    <p className="text-slate-500 mt-1">{selected.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                  <div><dt className="stat-label">Department</dt><dd className="text-sm font-medium text-slate-900 mt-1">{selected.department}</dd></div>
                  <div><dt className="stat-label">Location</dt><dd className="text-sm font-medium text-slate-900 mt-1">{selected.municipality}</dd></div>
                  <div><dt className="stat-label">Budget</dt><dd className="text-sm font-medium text-slate-900 mt-1">{formatBudget(selected.total_budget)}</dd></div>
                  <div><dt className="stat-label">Contractor</dt><dd className="text-sm font-medium mt-1"><WalletAddress addr={selected.contractor}/></dd></div>
                  <div><dt className="stat-label">Created</dt><dd className="text-sm font-medium text-slate-900 mt-1">{formatTimestamp(selected.created_at)}</dd></div>
                  <div><dt className="stat-label">Score</dt><dd className="text-sm font-medium text-slate-900 mt-1">{selected.public_value_score}/100</dd></div>
                  <div><dt className="stat-label">Milestones</dt><dd className="text-sm font-medium text-slate-900 mt-1">{selected.milestonesReleased}/{selected.milestonesTotal} released</dd></div>
                </div>
              </div>

              {/* PVO Progress — same as card grid */}
              {pvoFunding[selected.id] && Number(selected.total_budget) > 0 && (() => {
                const budget = Number(selected.total_budget);
                const funded = pvoFunding[selected.id].funded;
                const escrowed = pvoFunding[selected.id].escrowed;
                const released = pvoFunding[selected.id].released;
                const rPct = Math.min(100, Math.round((released / budget) * 100));
                const fundedPct = Math.min(100, (funded / budget) * 100);
                const escrowedPct = Math.min(100, (escrowed / budget) * 100);
                const remaining = Math.max(0, funded - escrowed);
                return (
                <div className="card p-4 mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{formatBudget(selected.total_budget)}</span>
                    <span className="text-slate-400">{selected.milestonesReleased}/{selected.milestonesTotal} milestones</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-slate-400">Released to contractor</span>
                      <span className="font-medium text-purple-600">{rPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{width: `${rPct}%`}}/>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-slate-400">Escrowed {formatBudget(String(escrowed))}</span>
                      {remaining > 0 && <span className="text-amber-500">+{formatBudget(String(remaining))} available</span>}
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{width: escrowedPct + "%"}}/>
                      {escrowedPct < fundedPct && (
                        <div className="h-full bg-amber-300 transition-all" style={{width: (fundedPct - escrowedPct) + "%"}}/>
                      )}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Escrow Cards */}
              {escrowsLoading ? (
                <div className="card p-4 mt-4 text-center text-sm text-slate-400">Loading escrows...</div>
              ) : escrows.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">🔒 Escrows ({escrows.length})</h3>
                  {escrows.map(e => {
                    const gates = [
                      { label: "Engineer", done: e.engineer },
                      { label: "AI", done: e.ai },
                      { label: "Compliance", done: e.compliance },
                      { label: "Oracle", done: e.oracle },
                      { label: `Community (${e.community}/${e.communityRequired})`, done: e.community >= e.communityRequired },
                    ];
                    const passed = gates.filter((g: any) => g.done).length;
                    return (
                      <div key={e.id} className="card p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono text-slate-400">Escrow #{e.id} · Milestone #{e.milestoneId}</span>
                            <p className="font-semibold text-slate-900 mt-0.5">{currency}{(e.amount / PPHP_SCALE).toLocaleString()}</p>
                          </div>
                          <span className={`badge text-xs ${e.status === "Released" ? "badge-green" : e.status === "Refunded" ? "badge-red" : "badge-blue"}`}>{e.status}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 mb-2">
                          {gates.map((gate: any, i: number) => (
                            <div key={i} className={`rounded-md p-1 text-center text-[10px] font-medium border ${gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                              <div className="text-xs">{gate.done ? "✓" : "○"}</div>
                              {gate.label}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400">{passed}/5 gates · Funder: <WalletAddress addr={e.funder} chars={4} /></span>
                          <span className="text-[10px] text-slate-400">Recipient: <WalletAddress addr={e.recipient} chars={4} /></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-4 mt-4 text-center text-sm text-slate-400">No escrows for this PVO yet.</div>
              )}
            </div>
          ) : (
            /* Card grid */
            filtered.length===0?(
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
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{formatBudget(pvo.total_budget)}</span>
                      <span className="text-slate-400">{pvo.milestonesReleased}/{pvo.milestonesTotal} milestones</span>
                    </div>
                    {/* PVO Progress — released / budget */}
                    {pvoFunding[pvo.id] && Number(pvo.total_budget) > 0 && (() => {
                      const budget = Number(pvo.total_budget);
                      const released = pvoFunding[pvo.id].released;
                      const pct = Math.min(100, Math.round((released / budget) * 100));
                      return (
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-slate-400">Released</span>
                            <span className="font-medium text-purple-600">{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{width: `${pct}%`}}/>
                          </div>
                        </div>
                      );
                    })()}
                    {pvoFunding[pvo.id] && Number(pvo.total_budget) > 0 && (() => {
                      const budget = Number(pvo.total_budget);
                      const funded = pvoFunding[pvo.id].funded;
                      const escrowed = pvoFunding[pvo.id].escrowed;
                      const fundedPct = Math.min(100, (funded / budget) * 100);
                      const escrowedPct = Math.min(100, (escrowed / budget) * 100);
                      const remaining = Math.max(0, funded - escrowed);
                      return (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className="text-slate-400">Escrowed {currency}{(escrowed / PPHP_SCALE / 1_000_000).toFixed(1)}M</span>
                            {remaining > 0 && <span className="text-amber-500">+{currency}{(remaining / PPHP_SCALE / 1_000_000).toFixed(1)}M available</span>}
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: escrowedPct + "%" }} />
                            {escrowedPct < fundedPct && (
                              <div className="h-full bg-amber-300 transition-all" style={{ width: (fundedPct - escrowedPct) + "%" }} />
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Value Score</span><span className="font-semibold text-slate-600">{pvo.public_value_score}/100</span>
                      </div>
                      <div className="progress-bar"><div className={`progress-fill ${pvo.public_value_score>=75?"progress-green":pvo.public_value_score>=50?"progress-amber":"progress-red"}`} style={{width:`${pvo.public_value_score}%`}}/></div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
