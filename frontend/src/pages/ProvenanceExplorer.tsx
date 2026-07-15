import { useState, useEffect, useCallback } from "react";
import { formatAddress } from "../helpers";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { getCached, setCached } from "../dataCache";

// ── Types (mirrors provenance-indexer) ───────────────────
type GateStatus = "pending" | "passed" | "failed";

interface GateRecord {
  gate_number: number;
  gate_name: string;
  contract_fn: string;
  status: GateStatus;
  actor?: string;
  risk_score?: number;
  tx_hash?: string;
  ledger?: number;
  timestamp?: number;
}

interface EscrowSummary {
  escrow_id: number;
  pvo_id: number;
  milestone_id: number;
  amount: number;
  status: string;
  funder: string;
  recipient: string;
  funded: boolean;
  released: boolean;
  released_at?: number;
}

interface MilestoneProvenance {
  milestone_id: number;
  milestone_title: string;
  description: string;
  budget: number;
  status: string;
  evidence_count: number;
  evidence_types: string[];
  escrow?: EscrowSummary;
  gates: GateRecord[];
}

interface TimelineEntry {
  order: number;
  timestamp: number;
  type: string;
  description: string;
  tx_hash?: string;
  ledger?: number;
  actor?: string;
  contract: string;
}

interface PVOProvenance {
  pvo_id: number;
  title: string;
  department: string;
  municipality: string;
  description: string;
  total_budget: number;
  status: string;
  funding_agency: string;
  contractor?: string;
  project_manager?: string;
  fund_source: string;
  public_value_score: number;
  contractor_assigned: boolean;
  milestones: MilestoneProvenance[];
  timeline: TimelineEntry[];
  stats: {
    total_escrowed: number;
    total_released: number;
    total_funded: number;
    gates_passed: number;
    gates_total: number;
    evidence_submitted: number;
  };
}

interface HealthInfo {
  status: string;
  lastUpdated: number | null;
  lastLedger: number | null;
  pvoCount: number;
  escrowCount: number;
  eventCount: number;
  uptime: number;
}

// ── Config ──────────────────────────────────────────────
const API_BASE = "https://provenance.chain.popv.quest";

const PROV_API_KEY = "";

const STELLAR_EXPERT_TX = "https://stellar.expert/explorer/testnet/tx/";

const STATUS_COLORS: Record<string, string> = {
  Proposed: "bg-blue-100 text-blue-700",
  Approved: "bg-cyan-100 text-cyan-700",
  InProgress: "bg-amber-100 text-amber-700",
  UnderReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Suspended: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
  Pending: "bg-gray-100 text-gray-600",
  EvidenceSubmitted: "bg-indigo-100 text-indigo-700",
  EngineerApproved: "bg-teal-100 text-teal-700",
  AIValidated: "bg-violet-100 text-violet-700",
  CommunityVerified: "bg-emerald-100 text-emerald-700",
  CompliancePassed: "bg-lime-100 text-lime-700",
  Released: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Created: "bg-gray-100 text-gray-600",
  Funded: "bg-cyan-100 text-cyan-700",
  OracleValidated: "bg-yellow-100 text-yellow-700",
  Ready: "bg-green-100 text-green-700",
  Refunded: "bg-red-100 text-red-700",
  Disputed: "bg-red-100 text-red-700",
};

function statusBadge(status: string): string {
  return STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
}

function gateColor(status: GateStatus): string {
  switch (status) {
    case "passed": return "bg-green-500";
    case "failed": return "bg-red-500";
    default: return "bg-slate-300";
  }
}

function gateIcon(status: GateStatus): string {
  switch (status) {
    case "passed": return "✓";
    case "failed": return "✕";
    default: return "○";
  }
}

function txLink(hash: string): string {
  return `${STELLAR_EXPERT_TX}${hash}`;
}

// ── Components ──────────────────────────────────────────

function StatCard({ label, value, sublabel, icon }: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
        <span className="text-2xl opacity-50">{icon}</span>
      </div>
    </div>
  );
}

function GatePill({ gate }: { gate: GateRecord }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
        gate.status === "passed"
          ? "bg-green-50 text-green-700 border border-green-200"
          : gate.status === "failed"
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-slate-50 text-slate-500 border border-slate-200"
      }`}
    >
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${gateColor(gate.status)}`}>
        {gateIcon(gate.status)}
      </span>
      <span className="text-xs font-semibold text-slate-400">G{gate.gate_number}</span>
      <span>{gate.gate_name}</span>
      {gate.risk_score !== undefined && gate.risk_score > 0 && (
        <span className="text-xs text-amber-600 font-mono">risk: {gate.risk_score}</span>
      )}
    </div>
  );
}

function GateDetailRow({ gate }: { gate: GateRecord }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${gateColor(gate.status)} flex-shrink-0`}>
        {gate.gate_number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">{gate.gate_name}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              gate.status === "passed"
                ? "bg-green-100 text-green-700"
                : gate.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {gate.status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-400">
          <span>fn: <code className="text-slate-600">{gate.contract_fn}</code></span>
          {gate.actor && <span>by: {formatAddress(gate.actor)}</span>}
          {gate.timestamp && <span>{new Date(gate.timestamp).toLocaleString()}</span>}
          {gate.ledger && <span>ledger: #{gate.ledger}</span>}
        </div>
      </div>
      {gate.tx_hash && (
        <a
          href={txLink(gate.tx_hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-medium whitespace-nowrap"
        >
          🔗 {gate.tx_hash.slice(0, 8)}…{gate.tx_hash.slice(-4)}
        </a>
      )}
    </div>
  );
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No events recorded yet.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">{e.description}</p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
              <span className="font-mono">{e.contract}</span>
              {e.ledger && <span>ledger #{e.ledger}</span>}
              {e.actor && <span>{formatAddress(e.actor)}</span>}
              {e.timestamp > 0 && <span>{new Date(e.timestamp).toLocaleString()}</span>}
            </div>
          </div>
          {e.tx_hash && (
            <a
              href={txLink(e.tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-medium whitespace-nowrap"
            >
              🔗 {e.tx_hash.slice(0, 6)}…
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function MilestoneCard({ milestone, pvoTimeline }: { milestone: MilestoneProvenance; pvoTimeline: TimelineEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"gates" | "timeline">("gates");
  const hasEscrow = !!milestone.escrow;
  const gatesPassed = milestone.gates.filter((g) => g.status === "passed").length;
  const hasTxHashes = milestone.gates.some((g) => g.tx_hash);

  // Filter PVO timeline to entries relevant to this milestone's escrow
  const escrowTimeline = pvoTimeline.filter((t) =>
    milestone.escrow && (
      t.type.includes("escrow") ||
      (t.description || "").includes(`Escrow #${milestone.escrow.escrow_id}`) ||
      (t.description || "").includes(`MS #${milestone.milestone_id}`)
    )
  );

  return (
    <div className={`rounded-lg border ${hasEscrow ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-slate-50/50"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/50 rounded-lg transition-colors"
      >
        <span className="text-sm text-slate-400 w-5">{expanded ? "▼" : "▶"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">{milestone.milestone_title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(milestone.status)}`}>
              {milestone.status}
            </span>
            {hasTxHashes && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                🔗 {milestone.gates.filter((g) => g.tx_hash).length} tx linked
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
            <span>₱{milestone.budget.toLocaleString()}</span>
            {milestone.evidence_count > 0 && (
              <span>📎 {milestone.evidence_count} evidence</span>
            )}
            {milestone.escrow && (
              <>
                <span>🔒 Escrow #{milestone.escrow.escrow_id}</span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${statusBadge(milestone.escrow.status)}`}>
                  {milestone.escrow.status}
                </span>
                <span>₱{milestone.escrow.amount.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        {hasEscrow && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {milestone.gates.map((g) => (
              <div
                key={g.gate_number}
                title={`Gate ${g.gate_number}: ${g.gate_name} (${g.status})`}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${gateColor(g.status)}`}
              >
                {g.gate_number}
              </div>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {milestone.description && (
            <p className="text-sm text-slate-500 mb-3 italic">{milestone.description}</p>
          )}

          {hasEscrow && (
            <>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTab("gates")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === "gates" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Gate Records ({gatesPassed}/{milestone.gates.length})
                </button>
                <button
                  onClick={() => setTab("timeline")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === "timeline" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Escrow Timeline
                </button>
              </div>

              {tab === "gates" && (
                <div className="bg-white rounded-lg border border-slate-100 p-3">
                  {milestone.gates.map((g) => (
                    <GateDetailRow key={g.gate_number} gate={g} />
                  ))}
                </div>
              )}

              {tab === "timeline" && (
                <div className="bg-white rounded-lg border border-slate-100 p-3">
                  <TimelineList entries={escrowTimeline} />
                </div>
              )}
            </>
          )}

          {!hasEscrow && (
            <div className="text-sm text-slate-400 italic py-2">
              No escrow created for this milestone yet. Gates will appear once escrow is funded.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PVOProvenanceCard({ pvo }: { pvo: PVOProvenance }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"milestones" | "timeline">("milestones");

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-lg text-slate-400 mt-0.5 w-5">{expanded ? "▼" : "▶"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400">PVO #{pvo.pvo_id}</span>
              <h3 className="text-base font-bold text-slate-800">{pvo.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(pvo.status)}`}>
                {pvo.status}
              </span>
              {pvo.contractor_assigned && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                  Contractor Assigned
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
              <span>{pvo.department}</span>
              <span>📍 {pvo.municipality}</span>
              <span>₱{pvo.total_budget.toLocaleString()}</span>
              <span>{pvo.milestones.length} milestones</span>
              {pvo.stats.gates_total > 0 && (
                <span className="text-indigo-500 font-medium">
                  {pvo.stats.gates_passed}/{pvo.stats.gates_total} gates passed
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex gap-1">
              {pvo.milestones.filter((m) => m.escrow).flatMap((m) => m.gates).length > 0 ? (
                pvo.milestones
                  .filter((m) => m.escrow)
                  .flatMap((m) => m.gates)
                  .reduce((acc: number[], g) => {
                    if (!acc.includes(g.gate_number)) acc.push(g.gate_number);
                    return acc;
                  }, [])
                  .sort()
                  .map((gn) => {
                    const gates = pvo.milestones.flatMap((m) => m.gates).filter((g) => g.gate_number === gn);
                    const allPassed = gates.length > 0 && gates.every((g) => g.status === "passed");
                    return (
                      <div
                        key={gn}
                        title={`Gate ${gn}: ${gates[0]?.gate_name}`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          allPassed ? "bg-green-500" : "bg-slate-300"
                        }`}
                      >
                        {gn}
                      </div>
                    );
                  })
              ) : (
                <span className="text-xs text-slate-300">no escrows</span>
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">Escrowed</p>
              <p className="text-sm font-bold text-slate-700">₱{pvo.stats.total_escrowed.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-400">Released</p>
              <p className="text-sm font-bold text-green-700">₱{pvo.stats.total_released.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-2 text-center">
              <p className="text-xs text-indigo-400">Evidence</p>
              <p className="text-sm font-bold text-indigo-700">{pvo.stats.evidence_submitted}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-xs text-amber-400">Value Score</p>
              <p className="text-sm font-bold text-amber-700">{pvo.public_value_score}/100</p>
            </div>
          </div>

          {pvo.contractor && (
            <div className="mb-3 text-xs text-slate-500">
              <span className="font-medium">Contractor:</span>{" "}
              <code className="bg-slate-50 px-1.5 py-0.5 rounded">{formatAddress(pvo.contractor)}</code>
              {" · "}
              <span className="font-medium">Fund Source:</span> {pvo.fund_source}
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTab("milestones")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "milestones" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Milestones & Gates ({pvo.milestones.length})
            </button>
            <button
              onClick={() => setTab("timeline")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "timeline" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Full Timeline ({pvo.timeline.length})
            </button>
          </div>

          {tab === "milestones" && (
            <div className="space-y-2">
              {pvo.milestones.map((m) => (
                <MilestoneCard key={m.milestone_id} milestone={m} pvoTimeline={pvo.timeline} />
              ))}
              {pvo.milestones.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-4">No milestones created.</p>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-[500px] overflow-y-auto">
              <TimelineList entries={pvo.timeline} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceStatus({ health }: { health: HealthInfo | null }) {
  if (!health) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-600">Service Offline</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-xs font-medium text-green-700">
        Indexer Active · {health.eventCount} events · ledger #{health.lastLedger ?? "?"}
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────
export function ProvenanceExplorer() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [pvos, setPvos] = useState<PVOProvenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    // Check cache first for instant navigation
    const cached = getCached<any[]>("provenance_pvos");
    if (cached.data) {
      setPvos(cached.data);
      setLoading(false);
      if (!cached.stale) return;
    }

    try {
      const headers = PROV_API_KEY ? { "x-api-key": PROV_API_KEY } : undefined;
      const [healthResp, pvoResp] = await Promise.all([
        fetch(`${API_BASE}/api/health`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/provenance`, { headers }).then((r) => r.json()).catch(() => null),
      ]);
      setHealth(healthResp);
      if (Array.isArray(pvoResp)) {
        setPvos(pvoResp);
        setCached("provenance_pvos", pvoResp);
        setError(null);
      } else if (pvoResp?.error) {
        setError(pvoResp.error);
      }
    } catch {
      setError("Cannot reach provenance indexer service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredPVOs = pvos
    .filter((p) => {
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.department.toLowerCase().includes(search.toLowerCase()) ||
        p.municipality.toLowerCase().includes(search.toLowerCase()) ||
        `pvo ${p.pvo_id}`.includes(search.toLowerCase()) ||
        p.contractor?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => b.pvo_id - a.pvo_id); // newest first

  const totalPages = Math.max(1, Math.ceil(filteredPVOs.length / PAGE_SIZE));
  const pagedPVOs = filteredPVOs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  
  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalEscrowed = pvos.reduce((s, p) => s + p.stats.total_escrowed, 0);
  const totalReleased = pvos.reduce((s, p) => s + p.stats.total_released, 0);
  const totalGatesPassed = pvos.reduce((s, p) => s + p.stats.gates_passed, 0);
  const totalGatesTotal = pvos.reduce((s, p) => s + p.stats.gates_total, 0);
  const totalTxLinked = pvos.reduce(
    (s, p) =>
      s +
      p.timeline.filter((t) => t.tx_hash).length +
      p.milestones
        .filter((m) => m.escrow)
        .flatMap((m) => m.gates)
        .filter((g) => g.tx_hash).length,
    0
  );

  const allStatuses = Array.from(new Set(pvos.map((p) => p.status))).sort();

  if (loading) {
    return <BlockchainLoader text="Loading provenance data from Stellar testnet..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📋 Provenance Explorer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete audit trail: PVO → Milestone → Gate → Transaction. Every decision linked to its on-chain proof.
          </p>
        </div>
        <ServiceStatus health={health} />
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Provenance Indexer Not Running</p>
              <p className="text-xs text-amber-600 mt-1">
                Start it with:{" "}
                <code className="bg-amber-100 px-2 py-0.5 rounded font-mono">
                  npx tsx provenance-indexer/service.ts
                </code>
              </p>
              <p className="text-xs text-amber-500 mt-1">
                Or build once: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">npx tsx provenance-indexer/service.ts --build</code>
                {" "}then serve: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">npx tsx provenance-indexer/service.ts --once</code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="PVOs Tracked" value={pvos.length} icon="📋" />
        <StatCard label="Total Escrowed" value={`₱${(totalEscrowed / 1_000_000).toFixed(2)}M`} sublabel={`${pvos.reduce((s, p) => s + p.stats.total_funded, 0)} funded`} icon="🔒" />
        <StatCard label="Total Released" value={`₱${(totalReleased / 1_000_000).toFixed(2)}M`} icon="💸" />
        <StatCard label="Gates Passed" value={`${totalGatesPassed}/${totalGatesTotal}`} icon="✅" />
        <StatCard label="TX Linked" value={totalTxLinked} sublabel="with tx hashes" icon="🔗" />
        <StatCard label="Events Indexed" value={health?.eventCount ?? 0} icon="📡" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PVO, department, municipality, contractor..."
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="all">All Statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          ↻ Refresh
        </button>
        {(typeof window !== "undefined" && window.location.hostname === "localhost") && (
          <label className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
            📂 Import Store
            <input type="file" accept=".json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const store = JSON.parse(reader.result as string);
                if (store.pvOs && Array.isArray(store.pvOs)) {
                  setPvos(store.pvOs);
                  setHealth(prev => prev ? { ...prev, eventCount: store.eventCount ?? store.events?.length ?? 0, lastLedger: store.lastLedger ?? 0 } : null);
                  setError(null);
                } else {
                  setError("Invalid store file: missing pvOs array");
                }
              } catch { setError("Failed to parse JSON file"); }
            };
            reader.readAsText(file);
          }} />
        </label>
        )}
      </div>

      <div className="space-y-3">
        {pagedPVOs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400">
              {filteredPVOs.length === 0
                ? pvos.length === 0
                  ? "No PVOs found. The indexer will pick them up on the next poll."
                  : "No PVOs match your filters."
                : ""}
            </p>
          </div>
        ) : (
          pagedPVOs.map((pvo) => <PVOProvenanceCard key={pvo.pvo_id} pvo={pvo} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium disabled:opacity-30 hover:bg-slate-50 transition-colors">
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-indigo-600 text-white" : "border border-slate-200 hover:bg-slate-50"}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium disabled:opacity-30 hover:bg-slate-50 transition-colors">
            Next →
          </button>
          <span className="text-xs text-slate-400 ml-2">{filteredPVOs.length} total</span>
        </div>
      )}

      <div className="text-xs text-slate-400 text-center pt-4 border-t border-slate-100">
        Data from local provenance indexer ({API_BASE}) · TX links open in Stellar Expert
      </div>
    </div>
  );
}
