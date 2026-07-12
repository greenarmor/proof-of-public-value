import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Client as EscrowClient, type Escrow as ChainEscrow } from "../contracts/escrow/src";
import { Client as AIOracleClient } from "../contracts/ai_oracle/src";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { formatBudget, formatAddress, formatTimestamp, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { useWallet } from "../wallet";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { getCached, setCached } from "../dataCache";

const PROVENANCE_API = "https://provenance.chain.popv.quest";
const PROVENANCE_API_BASE =
  (typeof window !== "undefined" && (window as any).__PROVENANCE_API__) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PROVENANCE_API) ||
  PROVENANCE_API;

const ProjectMap = lazy(() => import("./ProjectMap"));

interface PVOData {
  id: number;
  title: string;
  description: string;
  department: string;
  municipality: string;
  total_budget: string;
  status: string;
  contractor: string;
  public_value_score: number;
  milestones: number[];
  created_at: number;
  contractor_assigned: boolean;
  gpsCoordinates?: Array<{ lat: number; lng: number; milestoneId: number; evidenceId: number }>;
  latitude?: number;
  longitude?: number;
  milestonesReleased: number;
  milestonesTotal: number;
  budgetReleased: number;
}

function parseCoords(desc: string): { lat?: number; lng?: number; clean: string } {
  const match = desc.match(/^\[(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\]\s*/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
      clean: desc.slice(match[0].length),
    };
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
  const { address, connected, hasRole } = useWallet();
  const cachedInit = getCached<PVOData[]>("transparency_pvos");
  const [pvos, setPvos] = useState<PVOData[]>(cachedInit.data || []);
  const [loading, setLoading] = useState(!cachedInit.data);
  const [selected, setSelected] = useState<PVOData | null>(null);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [escrowsLoading, setEscrowsLoading] = useState(false);
  const [provenanceData, setProvenanceData] = useState<any>(null);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;
  const [pvoFunding, setPvoFunding] = useState<
    Record<number, { funded: number; escrowed: number; released: number }>
  >({});
  const [bidMap, setBidMap] = useState<Record<number, number>>({});

  const loadPVOs = useCallback(async () => {
    const cached = getCached<PVOData[]>("transparency_pvos");
    if (cached.stale || !cached.data) setLoading(true);
    try {
      const client = new PvoCoreClient({
        contractId: CONTRACT_IDS.pvo_core,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const cnt = await client.get_pvo_count();
      const list: PVOData[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) {
            const { lat, lng, clean } = parseCoords(r.result.description || "");
            const pvo: PVOData = {
              id: r.result.id,
              title: r.result.title,
              description: clean,
              department: r.result.department,
              municipality: r.result.municipality,
              total_budget: String(r.result.total_budget),
              status: statusToString(r.result.status),
              contractor: r.result.contractor,
              public_value_score: r.result.public_value_score,
              milestones: r.result.milestones as any,
              created_at: Number(r.result.created_at),
              gpsCoordinates: [],
              latitude: lat,
              longitude: lng,
              milestonesReleased: 0,
              milestonesTotal: ((r.result.milestones as any[]) || []).length,
              budgetReleased: 0,
              contractor_assigned: (r.result as any).contractor_assigned ?? false,
            };

            // Fetch milestone evidence to extract GPS coordinates + count Released
            try {
              const mResult = await client.get_pvo_milestones({ pvo_id: i });
              const milestones = (mResult.result || []) as any[];
              const coords: PVOData["gpsCoordinates"] = [];
              let releasedCount = 0;
              let budgetReleased = 0;
              // Check escrow status to count released milestones
              const escCli = new EscrowClient({
                contractId: CONTRACT_IDS.escrow,
                networkPassphrase: NETWORK_PASSPHRASE,
                rpcUrl: RPC_URL,
              });
              let escList: any[] = [];
              try {
                escList = ((await escCli.get_escrows_by_pvo({ pvo_id: i })).result || []) as any[];
              } catch {}
              for (const m of milestones) {
                const esc = escList.find((e: any) => Number(e.milestone_id) === Number(m.id));
                const escReleased =
                  esc && (esc.status?.tag === "Released" || esc.status === "Released");
                if (escReleased) {
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
                      coords.push({
                        lat: parseFloat(latMatch[1]),
                        lng: parseFloat(lngMatch[1]),
                        milestoneId: Number(m.id),
                        evidenceId: Number(ev.id),
                      });
                    } else {
                      const parts = meta.split(",");
                      if (
                        parts.length === 2 &&
                        !isNaN(Number(parts[0])) &&
                        !isNaN(Number(parts[1]))
                      ) {
                        coords.push({
                          lat: parseFloat(parts[0]),
                          lng: parseFloat(parts[1]),
                          milestoneId: Number(m.id),
                          evidenceId: Number(ev.id),
                        });
                      }
                    }
                  }
                }
              }
              pvo.gpsCoordinates = coords;
              pvo.milestonesReleased = releasedCount;
              pvo.budgetReleased = budgetReleased;
              if (
                releasedCount > 0 &&
                releasedCount === pvo.milestonesTotal &&
                budgetReleased >= Number(pvo.total_budget) / PPHP_SCALE
              ) {
                pvo.status = "Completed";
              }
              // Compute value score: average gate completion across all milestones
              let totalScore = 0;
              for (const e of escList) {
                const c = e.conditions || {};
                let passed = 0;
                if (c.engineer_approval) passed++;
                if (c.compliance_validation) passed++;
                if (c.community_oracle_validation) passed++;
                if ((c.community_confirmation || 0) >= (c.community_required || 1)) passed++;
                if (c.ai_risk_check) passed++;
                totalScore += (passed / 5) * 100;
              }
              // Milestones without escrows count as 0
              const score =
                pvo.milestonesTotal > 0 ? Math.round(totalScore / pvo.milestonesTotal) : 0;
              pvo.public_value_score = Math.min(100, score);
            } catch {}

            list.push(pvo);
          }
        } catch {}
      }
      setPvos(list);
      setCached("transparency_pvos", list);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch winning bids after PVOs are loaded
  useEffect(() => {
    if (loading || pvos.length === 0) return;
    (async () => {
      try {
        const { Client: PM } = await import("../contracts/procurement_market/src");
        const pm = new PM({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const tCount = await pm.get_tender_count();
        const bMap: Record<number, number> = {};
        const maxScan = Number(tCount.result) + 10;
        for (let i = 1; i <= maxScan; i++) {
          try {
            const tr = await pm.get_tender({ id: i });
            if (tr.result && tr.result.status?.tag === "Awarded" && tr.result.winner) {
              const pid = Number(tr.result.pvo_id);
              const bidsResult = await pm.get_bids_by_tender({ tender_id: Number(tr.result.id) });
              const bids = bidsResult.result || [];
              let bestBid: any = null;
              for (const b of bids) {
                if (!bestBid || Number(b.final_score) > Number(bestBid.final_score)) {
                  bestBid = b;
                }
              }
              if (bestBid) {
                bMap[pid] = (bMap[pid] || 0) + Number(bestBid.price);
              }
            }
          } catch {}
        }
        setBidMap(bMap);
      } catch {}
    })();
  }, [loading, pvos.length]);

  // Fetch funding data (grants + escrows) per PVO
  useEffect(() => {
    (async () => {
      try {
        const { Client: GC } = await import("../contracts/grant_commitment/src");
        const gc = new GC({
          contractId: CONTRACT_IDS.grant_commitment,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const grants = (await gc.get_all_grants()).result || [];

        const ec = new EscrowClient({
          contractId: CONTRACT_IDS.escrow,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const ecCnt = Number((await ec.get_escrow_count()).result);
        const allEscrows: any[] = [];
        for (let eid = 1; eid <= ecCnt; eid++) {
          try {
            const r = await ec.get_escrow({ escrow_id: eid });
            if (r.result) allEscrows.push(r.result);
          } catch {}
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

  useEffect(() => {
    loadPVOs();
  }, [loadPVOs]);

  // Load escrows when a PVO is selected
  const loadEscrows = useCallback(async (pvoId: number) => {
    setEscrowsLoading(true);
    try {
      const client = new EscrowClient({
        contractId: CONTRACT_IDS.escrow,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const result = await client.get_escrows_by_pvo({ pvo_id: pvoId });
      const raw = (result.result || []) as ChainEscrow[];
      const mapped = raw.map((e) => ({
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
    } catch {
    } finally {
      setEscrowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) {
      setEscrows([]);
      return;
    }
    loadEscrows(selected.id);
  }, [selected, loadEscrows]);

  // Load provenance when a PVO is selected
  useEffect(() => {
    if (!selected) {
      setProvenanceData(null);
      return;
    }
    (async () => {
      setProvenanceLoading(true);
      setProvenanceData(null); // clear old data when selecting new PVO
      try {
        const res = await fetch(`${PROVENANCE_API_BASE}/api/provenance/${selected.id}`);
        if (res.ok) setProvenanceData(await res.json());
      } catch {
      } finally {
        setProvenanceLoading(false);
      }
    })();
  }, [selected]);

  const filtered = filter
    ? pvos.filter(
        (p) =>
          p.title.toLowerCase().includes(filter.toLowerCase()) ||
          p.department.toLowerCase().includes(filter.toLowerCase()) ||
          p.municipality.toLowerCase().includes(filter.toLowerCase()),
      )
    : pvos;
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  if (loading)
    return <BlockchainLoader text="Loading projects from Stellar testnet..." />;

  return (
    <div className="lg:h-auto h-[calc(100vh-4rem)] flex flex-col overflow-hidden lg:overflow-visible">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Public Transparency Portal</h1>
          <p className="text-slate-500 text-sm">
            {pvos.length} project{pvos.length !== 1 ? "s" : ""} tracked on-chain · No wallet
            required
          </p>
        </div>
        {/* Search - hidden on mobile, shown on desktop */}
        <div className="hidden md:flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by name, dept, location..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input max-w-[260px] text-sm"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="text-xs text-brand-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile: sticky map + scrollable list. Desktop: side-by-side */}
      <div className="flex-1 lg:flex-none flex flex-col lg:flex-row lg:gap-4 min-h-0">
        <div className="lg:w-[45%] lg:sticky lg:top-20 lg:self-start flex-shrink-0 h-[40vh] lg:h-[70vh]">
          <Suspense fallback={<div className="skeleton-shimmer h-full rounded-xl" />}>
            <ProjectMap pvos={filtered} selectedPvoId={selected?.id} />
          </Suspense>
        </div>

        {/* Right panel: grid or detail - scrollable on mobile */}
        <div className="flex-1 min-w-0 overflow-y-auto lg:overflow-visible">
          {/* Mobile search - sticky below map */}
          <div className="md:hidden sticky top-0 z-10 bg-white pb-2">
            <input
              type="text"
              placeholder="Filter by name, dept, location..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input w-full text-sm"
            />
            {filter && (
              <button
                onClick={() => setFilter("")}
                className="text-xs text-brand-600 hover:underline mt-1"
              >
                Clear filter
              </button>
            )}
          </div>
          {selected ? (
            /* PVO Detail - expanded in right panel */
            <div>
              <button onClick={() => setSelected(null)} className="btn-ghost mb-4 text-sm">
                ← Back to all projects
              </button>
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-slate-400">PVO #{selected.id}</span>
                      <span className={`badge ${STATUS_COLORS[selected.status] || "badge-blue"}`}>
                        {selected.status}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{selected.title}</h1>
                    <p className="text-slate-500 mt-1">{selected.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <dt className="stat-label">Department</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">
                      {selected.department}
                    </dd>
                  </div>
                  <div>
                    <dt className="stat-label">Location</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">
                      {selected.municipality}
                    </dd>
                  </div>
                  {bidMap[selected.id] > 0 && (
                    <>
                      <div>
                        <dt className="stat-label">Winning Bid</dt>
                        <dd className="text-sm font-medium text-emerald-600 mt-1">
                          {currency}{(bidMap[selected.id] / PPHP_SCALE / 1_000_000).toFixed(1)}M
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt className="stat-label">Contractor</dt>
                    <dd className="text-sm font-medium mt-1">
                      {(() => {
                        if (!selected.contractor_assigned) {
                          return (
                            <span className="text-amber-600">TBD - assigned after bidding</span>
                          );
                        }
                        return <WalletAddress addr={selected.contractor} />;
                      })()}
                    </dd>
                  </div>
                  <div>
                    <dt className="stat-label">Created</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">
                      {formatTimestamp(selected.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="stat-label">Score</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">
                      {selected.public_value_score}/100
                    </dd>
                  </div>
                  <div>
                    <dt className="stat-label">Milestones</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">
                      {selected.milestonesReleased}/{selected.milestonesTotal}
                    </dd>
                  </div>
                </div>
              </div>

              {/* PVO Progress - same as card grid */}
              {pvoFunding[selected.id] &&
                Number(selected.total_budget) > 0 &&
                (() => {
                  const bidAmount = bidMap[selected.id] || Number(selected.total_budget);
                  const budget = bidAmount;
                  const funded = pvoFunding[selected.id].funded;
                  const escrowed = pvoFunding[selected.id].escrowed;
                  const released = pvoFunding[selected.id].released;
                  const rPct = Math.min(100, Math.round((released / budget) * 100));
                  const fundedPct = Math.min(100, (funded / budget) * 100);
                  const escrowedPct = Math.min(100, (escrowed / budget) * 100);
                  const remaining = Math.max(0, bidAmount - escrowed);
                  return (
                    <div className="card p-4 mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">
                          {formatBudget(selected.total_budget)}
                          {bidMap[selected.id] > 0 && (
                            <span className="text-emerald-600 ml-2">→ Winning Bid: {currency}{(bidMap[selected.id] / PPHP_SCALE / 1_000_000).toFixed(1)}M</span>
                          )}
                        </span>
                        <span className="text-slate-400">
                          {selected.milestonesReleased}/{selected.milestonesTotal} milestones
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Released to contractor</span>
                          <span className="font-medium text-purple-600">{rPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${rPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">
                            Escrowed {formatBudget(String(escrowed))}
                          </span>
                          {remaining > 0 && (
                            <span className="text-amber-500">
                              +{formatBudget(String(remaining))} available
                            </span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 rounded-l-full transition-all"
                            style={{ width: escrowedPct + "%" }}
                          />
                          {escrowedPct < fundedPct && (
                            <div
                              className="h-full bg-amber-300 transition-all"
                              style={{ width: fundedPct - escrowedPct + "%" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* AI Oracle Analysis */}
              <ForensicCard pvoId={Number(selected.id)} contractor={selected.contractor} />

              {/* Provenance Chain */}
              {provenanceLoading ? (
                <div className="mt-4 card p-4 text-center text-sm text-slate-400">Loading provenance chain...</div>
              ) : provenanceData ? (
                <ExpandableProvenance data={provenanceData} />
              ) : null}

              {/* Escrow Cards */}
              {escrowsLoading ? (
                <div className="card p-4 mt-4 text-center text-sm text-slate-400">
                  Loading escrows...
                </div>
              ) : escrows.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    🔒 Escrows ({escrows.length})
                    <button
                      onClick={() => selected && loadEscrows(selected.id)}
                      className="ml-2 text-xs text-slate-400 hover:text-indigo-500 font-normal"
                    >
                      ↻ Refresh
                    </button>
                  </h3>
                  {escrows.map((e) => {
                    const gates = [
                      { label: "Engineer", done: e.engineer },
                      { label: "Compliance", done: e.compliance },
                      { label: "Oracle", done: e.oracle },
                      {
                        label: `Community (${e.community}/${e.communityRequired})`,
                        done: e.community >= e.communityRequired,
                      },
                      { label: "AI Risk", done: e.ai },
                    ];
                    const passed = gates.filter((g: any) => g.done).length;
                    const provMilestone = provenanceData?.milestones?.find(
                      (m: any) => m.milestone_id === e.milestoneId,
                    );
                    const provGates = provMilestone?.gates ?? [];
                    const gateTxHashes: Record<number, string> = {};
                    for (const pg of provGates) {
                      if (pg.tx_hash) gateTxHashes[pg.gate_number] = pg.tx_hash;
                    }
                    const hasTxLinks = Object.keys(gateTxHashes).length > 0;
                    return (
                      <div key={e.id} className="card p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono text-slate-400">
                              Escrow #{e.id} · Milestone #{e.milestoneId}
                            </span>
                            <p className="font-semibold text-slate-900 mt-0.5">
                              {currency}
                              {(e.amount / PPHP_SCALE).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasTxLinks && (
                              <span className="badge text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
                                🔗 Auditable
                              </span>
                            )}
                            <span
                              className={`badge text-xs ${e.status === "Released" ? "badge-green" : e.status === "Refunded" ? "badge-red" : "badge-blue"}`}
                            >
                              {e.status}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 mb-2">
                          {gates.map((gate: any, i: number) => {
                            const txHash = gateTxHashes[i + 1];
                            return (
                              <div
                                key={i}
                                className={`rounded-md p-1 text-center text-[10px] font-medium border ${gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                              >
                                <div className="text-xs">{gate.done ? "✓" : "○"}</div>
                                {gate.label}
                                {txHash && (
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[9px] text-indigo-500 hover:text-indigo-700 mt-0.5"
                                    title={`TX: ${txHash}`}
                                  >
                                    🔗 {txHash.slice(0, 6)}…
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400">
                              {passed}/5 gates · Funder: <WalletAddress addr={e.funder} chars={4} />
                            </span>
                            {connected && e.status === "Ready" && <ReleaseButton escrowId={e.id} />}
                          </div>
                          <div className="flex items-center gap-3">
                            {connected && hasRole("Citizen") && e.status !== "Released" ? (
                              e.compliance ? (
                                <CitizenReportBadge
                                  pvoId={Number(selected.id)}
                                  milestoneId={e.milestoneId}
                                  escrowId={e.id}
                                  projectLat={selected.latitude}
                                  projectLng={selected.longitude}
                                />
                              ) : (
                                <span
                                  className="text-[10px] text-slate-300 cursor-not-allowed"
                                  title="Available after Compliance (Gate 2)"
                                >
                                  📸 Report (locked)
                                </span>
                              )
                            ) : connected && hasRole("Citizen") && e.status === "Released" ? (
                              <span
                                className="text-[10px] text-slate-300 cursor-not-allowed"
                                title="Funds already released"
                              >
                                📸 Released
                              </span>
                            ) : null}
                            <span className="text-[10px] text-slate-400">
                              Recipient: <WalletAddress addr={e.recipient} chars={4} />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-4 mt-4 text-center text-sm text-slate-400">
                  No escrows for this PVO yet.
                </div>
              )}
            </div>
          ) : /* Card grid */
          paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-lg text-slate-400">
                {filter ? "No projects match" : "No projects on-chain yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
                {paginated.map((pvo) => (
                  <button
                    key={pvo.id}
                    onClick={() => setSelected(pvo)}
                    className="card-interactive text-left p-4 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono text-[11px] text-slate-400">#{pvo.id}</span>
                      <span
                        className={`badge text-[10px] ${STATUS_COLORS[pvo.status] || "badge-blue"}`}
                      >
                        {pvo.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2 group-hover:text-brand-700 transition-colors">
                      {pvo.title}
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      {pvo.department} · {pvo.municipality}
                    </p>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">
                        {formatBudget(pvo.total_budget)}
                      </span>
                      <span className="text-slate-400">
                        {pvo.milestonesReleased}/{pvo.milestonesTotal} milestones
                      </span>
                    </div>
                    {bidMap[pvo.id] > 0 && (
                      <div className="flex items-center gap-2 text-[11px] mb-1">
                        <span className="text-emerald-600 font-medium">
                          Winning Bid: {currency}{(bidMap[pvo.id] / PPHP_SCALE / 1_000_000).toFixed(1)}M
                        </span>
                      </div>
                    )}
                    {/* PVO Progress - released / budget */}
                    {pvoFunding[pvo.id] &&
                      Number(pvo.total_budget) > 0 &&
                      (() => {
                        const bidAmount = bidMap[pvo.id] || Number(pvo.total_budget); const budget = bidAmount;
                        const released = pvoFunding[pvo.id].released;
                        const pct = Math.min(100, Math.round((released / budget) * 100));
                        return (
                          <div className="mb-2">
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-slate-400">Released</span>
                              <span className="font-medium text-purple-600">{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    {pvoFunding[pvo.id] &&
                      Number(pvo.total_budget) > 0 &&
                      (() => {
                        const bidAmount = bidMap[pvo.id] || Number(pvo.total_budget); const budget = bidAmount;
                        const funded = pvoFunding[pvo.id].funded;
                        const escrowed = pvoFunding[pvo.id].escrowed;
                        const fundedPct = Math.min(100, (funded / budget) * 100);
                        const escrowedPct = Math.min(100, (escrowed / budget) * 100);
                        const remaining = Math.max(0, bidAmount - escrowed);
                        return (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-[10px] mb-0.5">
                              <span className="text-slate-400">
                                Escrowed {currency}
                                {(escrowed / PPHP_SCALE / 1_000_000).toFixed(1)}M
                              </span>
                              {remaining > 0 && (
                                <span className="text-amber-500">
                                  +{currency}
                                  {(remaining / PPHP_SCALE / 1_000_000).toFixed(1)}M available
                                </span>
                              )}
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-emerald-500 rounded-l-full transition-all"
                                style={{ width: escrowedPct + "%" }}
                              />
                              {escrowedPct < fundedPct && (
                                <div
                                  className="h-full bg-amber-300 transition-all"
                                  style={{ width: fundedPct - escrowedPct + "%" }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Value Score</span>
                        <span className="font-semibold text-slate-600">
                          {pvo.public_value_score}/100
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className={`progress-fill ${pvo.public_value_score >= 75 ? "progress-green" : pvo.public_value_score >= 50 ? "progress-amber" : "progress-red"}`}
                          style={{ width: `${pvo.public_value_score}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pb-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-xs rounded-lg transition ${
                        p === page
                          ? "bg-brand-600 text-white font-semibold"
                          : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Expandable Provenance Card ──────────────────────────
function ExpandableProvenance({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 space-y-3">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors">
        <span>{open ? "▼" : "▶"}</span>
        🔗 Provenance Chain ({data.timeline?.length || 0} events)
      </button>
      {open && (
        <div className="card p-4 bg-slate-50/50 border-slate-200">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(data.timeline || []).slice().reverse().map((e: any, i: number) => (
              <div key={i} className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700">{e.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    {e.timestamp > 0 && <span>{new Date(e.timestamp).toLocaleString()}</span>}
                    <span>{e.contract}</span>
                    {e.ledger && <span>ledger #{e.ledger}</span>}
                  </div>
                </div>
                {e.tx_hash && (
                  <a href={`https://stellar.expert/explorer/testnet/tx/${e.tx_hash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-1.5 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[10px] font-medium whitespace-nowrap">
                    🔗 {e.tx_hash.slice(0, 6)}…
                  </a>
                )}
              </div>
            ))}
          </div>
          {(data.milestones || []).filter((m: any) => m.gates?.length > 0).map((m: any) => (
            <div key={m.milestone_id} className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-2">{m.milestone_title}</p>
              <div className="grid grid-cols-5 gap-1">
                {(m.gates || []).map((g: any) => (
                  <div key={g.gate_number} className={`rounded px-1.5 py-1 text-center text-[10px] font-medium ${g.tx_hash ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                    <div>{g.gate_name}</div>
                    {g.tx_hash && (
                      <a href={`https://stellar.expert/explorer/testnet/tx/${g.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700">
                        {g.status === 'passed' ? '✓' : g.status}
                      </a>
                    )}
                    {!g.tx_hash && <div>{g.status}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CitizenReportBadge({
  pvoId,
  milestoneId,
  escrowId,
  projectLat,
  projectLng,
}: {
  pvoId: number;
  milestoneId: number;
  escrowId: number;
  projectLat?: number;
  projectLng?: number;
}) {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsChecked, setGpsChecked] = useState(false);
  const [withinRange, setWithinRange] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [gate3Done, setGate3Done] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const MAX_DISTANCE_KM = 2;

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      setMessage({ text: "GPS not supported on this device.", ok: false });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const glat = pos.coords.latitude;
        const glng = pos.coords.longitude;
        setLat(glat.toFixed(7));
        setLng(glng.toFixed(7));
        setGpsChecked(true);
        if (projectLat != null && projectLng != null) {
          const dist = haversineKm(glat, glng, projectLat, projectLng);
          setDistance(dist);
          setWithinRange(dist <= MAX_DISTANCE_KM);
          if (dist > MAX_DISTANCE_KM) {
            setMessage({ text: `You are ${dist.toFixed(2)} km away. Must be within ${MAX_DISTANCE_KM} km of project site.`, ok: false });
          } else {
            setMessage({ text: `Within ${dist.toFixed(2)} km of project. Report enabled.`, ok: true });
          }
        } else {
          setWithinRange(true);
          setMessage({ text: "Location captured.", ok: true });
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsChecked(false);
        const msgs: Record<number, string> = {
          1: "Location permission denied. Enable GPS to report.",
          2: "Position unavailable. Check your GPS settings.",
          3: "GPS timeout. Try again.",
        };
        setMessage({ text: msgs[err.code] || "GPS failed.", ok: false });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const canSubmit = gpsChecked && withinRange && !!lat && !!lng;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (!canSubmit) {
      setMessage({ text: "Must verify your location first.", ok: false });
      return;
    }
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal } =
        await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.community_oracle);
      const op = contract.call(
        "submit_report",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        xdr.ScVal.scvU32(milestoneId),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
        xdr.ScVal.scvString(JSON.stringify({ lat, lng, notes }).slice(0, 64)),
        nativeToScVal(Math.round(Number(lat || 0) * 1_000_000), { type: "i128" } as any),
        nativeToScVal(Math.round(Number(lng || 0) * 1_000_000), { type: "i128" } as any),
      );
      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setMessage({ text: "✅ Report submitted! Now validate the gate below.", ok: true });
      setReportDone(true);
    } catch (er: any) {
      const msg = String(er?.message || er);
      if (msg.includes("insufficient")) setMessage({ text: "❌ Need at least 1 RPT.", ok: false });
      else if (msg.includes("rejected")) setMessage({ text: "Cancelled.", ok: false });
      else setMessage({ text: `❌ ${msg.slice(0, 120)}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const addConfirmation = async () => {
    if (!address) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } =
        await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call(
        "add_community_confirmation",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(escrowId),
      );
      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setMessage({ text: "✅ Gate 4 (Community Confirmation) added!", ok: true });
      setTimeout(() => setOpen(false), 2500);
    } catch (er: any) {
      setMessage({ text: `❌ ${String(er?.message).slice(0, 120)}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const validateOracle = async () => {
    if (!address) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } =
        await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call(
        "community_oracle_validate",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(escrowId),
      );
      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setMessage({ text: "✅ Gate 3 (Community Oracle) validated!", ok: true });
      setGate3Done(true);
    } catch (er: any) {
      setMessage({ text: `❌ ${String(er?.message).slice(0, 120)}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
      >
        📸 Report
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 right-0 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4"
          style={{ minWidth: 320 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-emerald-700">📸 Citizen Report</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕
            </button>
          </div>
          {message && (
            <div
              className={`mb-2 p-2 rounded text-xs ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
            >
              {message.text}
            </div>
          )}
          {!reportDone ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-500">Milestone #</label>
                <input
                  type="text"
                  value={`Milestone #${milestoneId}`}
                  readOnly
                  className="input text-xs bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              {projectLat != null && projectLng != null && (
                <div className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-500">
                  Project site: {projectLat.toFixed(4)}, {projectLng.toFixed(4)}
                  {distance != null && <span className="ml-2 text-slate-600 font-medium">({distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(2)} km`} away)</span>}
                </div>
              )}
              <button
                type="button"
                onClick={useGps}
                disabled={gpsLoading}
                className={`w-full py-2 rounded-lg text-xs font-medium border transition-colors ${
                  withinRange
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : gpsChecked
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {gpsLoading
                  ? "📍 Locating..."
                    : withinRange
                    ? "✅ Verified on-site"
                    : gpsChecked
                    ? "❌ Too far from project"
                    : "📍 Verify My Location"}
              </button>
              {!gpsChecked && (
                <p className="text-[10px] text-amber-600 text-center">GPS required. You must be within {MAX_DISTANCE_KM} km of the project to report.</p>
              )}
              {gpsChecked && !withinRange && (
                <p className="text-[10px] text-red-600 text-center">You are outside the {MAX_DISTANCE_KM} km reporting radius. Move closer to the project site.</p>
              )}
              <div>
                <label className="text-[10px] text-slate-500">What did you observe?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input text-xs"
                  rows={2}
                  placeholder="Workers on site? Road visible? Equipment present?"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="btn-primary w-full text-xs py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing..." : canSubmit ? "📤 Submit On-Chain" : "🔒 Verify location first"}
              </button>
            </form>
          ) : (
            <div className="space-y-2">
              {!gate3Done ? (
                <>
                  <p className="text-xs text-emerald-600">
                    ✅ Report submitted. Now validate the oracle gate:
                  </p>
                  <button
                    onClick={validateOracle}
                    disabled={submitting}
                    className="btn-primary w-full text-xs py-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? "Signing..." : "🔓 Validate Gate 3 (Oracle)"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-emerald-600">
                    ✅ Gate 3 passed! Add your confirmation for Gate 4:
                  </p>
                  <button
                    onClick={addConfirmation}
                    disabled={submitting}
                    className="btn-primary w-full text-xs py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {message?.ok
                      ? "✅ Confirmed"
                      : submitting
                        ? "Signing..."
                        : "✅ Confirm Gate 4 (Community)"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReleaseButton({ escrowId }: { escrowId: number }) {
  const { address } = useWallet();
  const [releasing, setReleasing] = useState(false);
  const [done, setDone] = useState(false);

  const handleRelease = async () => {
    if (!address) return;
    setReleasing(true);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } =
        await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call(
        "release",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(escrowId),
      );
      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setDone(true);
    } catch {
    } finally {
      setReleasing(false);
    }
  };

  if (done) return <span className="badge-green text-xs px-2 py-1">✅ Released</span>;
  return (
    <button
      onClick={handleRelease}
      disabled={releasing}
      className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 font-semibold"
    >
      {releasing ? "..." : "💸 Release"}
    </button>
  );
}

// ── AI Oracle Analysis Card ───────────────────────────
function ForensicCard({ pvoId, contractor }: { pvoId: number; contractor: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const aiClient = new AIOracleClient({ contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result: any = {};
        try {
          const fr = await aiClient.get_fraud_by_pvo({ pvo_id: pvoId });
          const frauds = (fr.result || []) as any[];
          if (frauds.length > 0) result.fraud = frauds[frauds.length - 1];
        } catch {}
        try {
          if (contractor) {
            const rr = await aiClient.get_latest_risk_prediction({ contractor });
            result.risk = rr.result;
          }
        } catch {}
        try {
          const gr = await aiClient.get_geo_risk({ pvo_id: pvoId });
          result.geo = gr.result;
        } catch {}
        try {
          const tr = await aiClient.get_digital_twin({ pvo_id: pvoId });
          result.twin = tr.result;
        } catch {}
        setData(result);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [pvoId, contractor]);

  if (loading) return <div className="card p-4 mt-4 skeleton h-24" />;
  if (!data || (!data.fraud && !data.risk && !data.geo && !data.twin)) return null;

  const catLabels = ["Low", "Medium", "High", "Critical"];

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">🤖 AI Oracle Analysis</h3>
      <div className="card p-4 bg-purple-50/30 border-purple-100">
        <div className="grid grid-cols-2 gap-3">
          {data.fraud && (
            <div className="border border-gray-200 bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Fraud Detection</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${Number(data.fraud.risk_score) >= 75 ? "bg-red-500" : Number(data.fraud.risk_score) >= 50 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${Number(data.fraud.risk_score)}%` }} />
                </div>
                <span className="font-mono text-xs font-medium">{Number(data.fraud.risk_score)}/100</span>
              </div>
              <p className="text-xs text-gray-400">Data Coverage: {Number(data.fraud.confidence || 0)}%</p>
              {(data.fraud.indicators || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(data.fraud.indicators || []).map((ind: any, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-red-50 text-red-700">{(typeof ind === "string" ? ind : ind?.tag ?? "").replace(/([A-Z])/g, " $1").trim()}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {data.risk && (
            <div className="border border-gray-200 bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Risk Prediction</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-gray-400">Delay</p><p className="font-medium text-gray-700">{Number(data.risk.delay_probability)}%</p></div>
                <div><p className="text-gray-400">Overrun</p><p className="font-medium text-gray-700">{Number(data.risk.overrun_probability)}%</p></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Category: <span className="font-medium">{catLabels[Number(data.risk.risk_category)] ?? "Unknown"}</span></p>
            </div>
          )}
          {data.geo && (
            <div className="border border-gray-200 bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Geo Risk - {data.geo.region || ""}</p>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div><p className="text-gray-400">Flood</p><p className={`font-medium ${Number(data.geo.flood_risk) > 60 ? "text-red-600" : "text-gray-700"}`}>{Number(data.geo.flood_risk)}%</p></div>
                <div><p className="text-gray-400">Seismic</p><p className={`font-medium ${Number(data.geo.seismic_risk) > 60 ? "text-red-600" : "text-gray-700"}`}>{Number(data.geo.seismic_risk)}%</p></div>
                <div><p className="text-gray-400">Landslide</p><p className={`font-medium ${Number(data.geo.landslide_risk) > 60 ? "text-red-600" : "text-gray-700"}`}>{Number(data.geo.landslide_risk)}%</p></div>
              </div>
            </div>
          )}
          {data.twin && (
            <div className={`border rounded-lg p-3 ${data.twin.deviation_alert === true ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
              <p className="text-xs font-medium text-slate-500 mb-2">Digital Twin {data.twin.deviation_alert === true && <span className="badge badge-red ml-1">Deviation</span>}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-gray-400">Material Idx</p><p className="font-medium text-gray-700">{Number(data.twin.material_cost_index)}</p></div>
                <div><p className="text-gray-400">Labor Idx</p><p className="font-medium text-gray-700">{Number(data.twin.labor_cost_index)}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
