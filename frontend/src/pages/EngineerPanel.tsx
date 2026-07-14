import { useState, useEffect, useCallback } from "react";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Client as EscrowClient } from "../contracts/escrow/src";
import { Client as ReputationClient } from "../contracts/reputation/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { ipfsGatewayUrl } from "../ipfs";

interface MilestoneData {
  id: number; pvoId: number; pvoTitle: string;
  title: string; description: string; budget: string; status: string;
  submitted_evidence: any[]; engineer_approved: boolean;
}

interface EscrowData {
  id: number; pvoId: number; milestoneId: number;
  amount: number; status: string; engineerApproval: boolean;
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function EngineerPanel() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "all">("pending");
  const [reputation, setReputation] = useState<number | null>(null);
  const [approvedMilestones, setApprovedMilestones] = useState<MilestoneData[]>([]);

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const client = new ReputationClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const r = await client.get_reputation({ entity: address });
        if (r.result) setReputation(Number(r.result.reputation_score));
      } catch {}
    })();
  }, [address]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to review evidence and approve milestones.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Engineer Panel</h1>
      <div className="flex items-center gap-3 mb-2">
        <p className="text-gray-500">Review submitted evidence and approve milestones on-chain.</p>
        {reputation !== null && (
          <span className={`badge text-xs ${reputation >= 80 ? "badge-green" : reputation >= 50 ? "badge-amber" : "badge-red"}`}>
            🛡️ Reputation: {reputation}/100
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["pending", "approved", "all"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "pending" && "🔍 Pending Reviews"}
            {tab === "approved" && "✅ Approved"}
            {tab === "all" && "📋 All PVOs"}
          </button>
        ))}
      </div>

      {activeTab === "pending" && <PendingReviews address={address!} onApproved={(m) => setApprovedMilestones(prev => [m, ...prev])} />}
      {activeTab === "approved" && <ApprovedMilestones address={address!} extraApproved={approvedMilestones} />}
      {activeTab === "all" && <AllPVOs />}
    </div>
  );
}

function PendingReviews({ address, onApproved }: { address: string; onApproved: (m: MilestoneData) => void }) {
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [approvedKeys, setApprovedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const markApproved = (pvoId: number, msId: number) => {
    const key = `${pvoId}:${msId}`;
    setApprovedKeys(prev => [...prev, key]);
    const m = milestones.find(x => x.pvoId === pvoId && x.id === msId);
    if (m) onApproved(m);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pvoClient = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const countResult = await pvoClient.get_pvo_count();
      const count = Number(countResult.result);
      const all: MilestoneData[] = [];

      async function processPvo(pvoId: number) {
        const pvoResult = await pvoClient.get_pvo({ pvo_id: pvoId });
        if (!pvoResult.result) throw new Error("not found");
        const pvo = pvoResult.result as any;
        const pvoTitle = pvo.title;
        const mResult = await pvoClient.get_pvo_milestones({ pvo_id: pvoId });
        const chainMilestones = (mResult.result || []) as any[];
        for (const m of chainMilestones) {
          if (m.submitted_evidence && m.submitted_evidence.length > 0) {
            all.push({
              id: Number(m.id), pvoId, pvoTitle, title: m.title,
              description: m.description, budget: String(m.budget),
              status: statusToString(m.status),
              submitted_evidence: m.submitted_evidence,
              engineer_approved: m.engineer_approved,
            });
          }
        }
      }

      for (let i = 1; i <= count; i++) {
        try { await processPvo(i); } catch {}
      }
      // Scan forward for non-sequential PVO IDs
      let scanned = 0;
      let id = count + 1;
      while (scanned < 15) {
        try {
          await processPvo(id);
          scanned = 0;
        } catch { scanned++; }
        id++;
      }
      setMilestones(all);
    } catch (e) {
      console.error("Failed to load milestones:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = milestones.filter(m => !approvedKeys.includes(`${m.pvoId}:${m.id}`));

  if (loading) return <BlockchainLoader text="Loading milestones and evidence..." />;

  if (visible.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="font-semibold text-gray-700 mb-1">No pending reviews</h3>
        <p className="text-sm text-gray-400">Milestones with submitted evidence will appear here for your approval.</p>
      </div>
    );
  }

  const currency = getCurrency();

  return (
    <div className="space-y-4">
      {visible.map(m => (
        <MilestoneReviewCard key={`${m.pvoId}-${m.id}`} milestone={m} currency={currency} address={address} onAction={load} onApproved={markApproved} />
      ))}
    </div>
  );
}

function MilestoneReviewCard({ milestone, currency, address, onAction, onApproved, readonly }: {
  milestone: MilestoneData; currency: string; address: string; onAction: () => void; onApproved: (pvoId: number, msId: number) => void; readonly?: boolean;
}) {
  const [txState, setTxState] = useState<TxState>(readonly ? "done" : "idle");
  const [txMsg, setTxMsg] = useState("");

  // Check escrow state on mount - if already approved, show done immediately
  useEffect(() => {
    (async () => {
      try {
        const escrowClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const escrowsResult = await escrowClient.get_escrows_by_pvo({ pvo_id: milestone.pvoId });
        const escrows = (escrowsResult.result || []) as any[];
        const escrow = escrows.find((e: any) => Number(e.milestone_id) === milestone.id);
        if (escrow?.conditions?.engineer_approval === true) {
          setTxState("done");
        }
      } catch {}
    })();
  }, [milestone.pvoId, milestone.id]);

  const handleApprove = async () => {
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const escrowClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      // Find the escrow for this milestone
      const escrowsResult = await escrowClient.get_escrows_by_pvo({ pvo_id: milestone.pvoId });
      const escrows = (escrowsResult.result || []) as any[];
      const escrow = escrows.find((e: any) => Number(e.milestone_id) === milestone.id);

      if (!escrow) {
        setTxState("error");
        setTxMsg("No escrow found for this milestone. Create one first.");
        return;
      }
      const escrowStatus = escrow.status?.tag || escrow.status || "";
      if (escrowStatus === "Created") {
        setTxState("error");
        setTxMsg("⚠️ Escrow not yet funded. The Funding Agency must fund it in the Escrows tab before Gate 1 can proceed.");
        return;
      }

      // Guard: if already approved on-chain, skip
      if (escrow.conditions?.engineer_approval === true) {
        setTxState("done");
        setTxMsg("Already approved on-chain.");
        return;
      }

      const escrowId = Number(escrow.id);
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);

      const op = contract.call("engineer_approve",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(escrowId),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);

      setTxState("done");
      setTxMsg("Engineer approved on escrow. Gate 1 passed!");
      onApproved(milestone.pvoId, milestone.id);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <div className="card p-5">
      {txMsg && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-mono">PVO #{milestone.pvoId}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">Milestone #{milestone.id}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{milestone.title}</h3>
          <p className="text-sm text-gray-500">{milestone.description}</p>
        </div>
        <span className="badge badge-amber">{milestone.status}</span>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
        <span>Budget: {currency}{(Number(milestone.budget) / PPHP_SCALE).toLocaleString()}</span>
        <span>·</span>
        <span>{milestone.submitted_evidence.length} evidence items</span>
      </div>

      {/* Inspector Reports - dedicated section for pre-visit briefing */}
      {(() => {
        const inspectionReports = milestone.submitted_evidence.filter((ev: any) => {
          const t = statusToString(ev.evidence_type);
          return t === "Inspection Report" || t === "InspectionReport";
        });
        if (inspectionReports.length === 0) return null;
        return (
          <div className="mb-4 p-4 rounded-lg bg-purple-50 border border-purple-200">
            <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-2">
              🔍 Inspector Reports ({inspectionReports.length}) - Pre-Visit Briefing
            </p>
            {inspectionReports.map((ev: any, i: number) => {
              let data: any = null;
              try { if (ev.metadata) data = JSON.parse(ev.metadata); } catch {}
              return (
                <div key={i} className="bg-white rounded-lg p-3 mb-2 last:mb-0 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      data?.rating === "Pass" ? "bg-green-100 text-green-700" :
                      data?.rating === "Fail" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {data?.rating === "Pass" ? "✅" : data?.rating === "Fail" ? "❌" : "⚠️"} {data?.rating || "N/A"}
                    </span>
                    {data?.inspector && <span className="text-xs text-purple-500 font-mono">Inspector: {formatAddress(data.inspector, 6)}</span>}
                    {data?.inspected_at && <span className="text-xs text-gray-400">{new Date(data.inspected_at).toLocaleString()}</span>}
                  </div>
                  {data?.notes ? (
                    <p className="text-xs text-purple-700 leading-relaxed">{data.notes}</p>
                  ) : (
                    <p className="text-xs text-purple-400 italic">No notes provided.</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Evidence previews */}
      {milestone.submitted_evidence.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Evidence</p>
          {milestone.submitted_evidence.slice(0, 3).map((ev: any, i: number) => {
            const typeName = statusToString(ev.evidence_type);
            const isInspection = typeName === "Inspection Report" || typeName === "InspectionReport";
            let inspectionData: any = null;
            if (isInspection && ev.metadata) {
              try { inspectionData = JSON.parse(ev.metadata); } catch {}
            }
            return (
            <div key={i} className={`rounded-lg p-3 text-sm ${isInspection ? "bg-purple-50 border border-purple-200" : "bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isInspection ? "text-purple-700" : "text-gray-700"}`}>
                    {isInspection ? "🔍 " : ""}{typeName}
                  </span>
                  {isInspection && <span className="badge bg-purple-100 text-purple-700 text-[10px]">Inspector</span>}
                </div>
                <span className={`badge ${ev.verified ? "badge-green" : "badge-amber"} text-[10px]`}>{ev.verified ? "Verified" : "Pending"}</span>
              </div>
              {isInspection && inspectionData ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      inspectionData.rating === "Pass" ? "bg-green-100 text-green-700" :
                      inspectionData.rating === "Fail" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {inspectionData.rating === "Pass" ? "✅" : inspectionData.rating === "Fail" ? "❌" : "⚠️"} {inspectionData.rating}
                    </span>
                    {inspectionData.inspector && (
                      <span className="text-xs text-purple-500 font-mono">by {formatAddress(inspectionData.inspector, 6)}</span>
                    )}
                  </div>
                  {inspectionData.notes && (
                    <p className="text-xs text-purple-600">{inspectionData.notes}</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {ev.data_hash ? (
                      <a
                        href={ipfsGatewayUrl(ev.data_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline"
                      >
                        📄 IPFS: {ev.data_hash.slice(0, 20)}...
                      </a>
                    ) : "No IPFS hash"}
                  </p>
                  {ev.metadata && <p className="text-xs text-gray-400 mt-0.5 truncate">{String(ev.metadata).slice(0, 100)}</p>}
                </>
              )}
            </div>
          )})}
          {milestone.submitted_evidence.length > 3 && (
            <p className="text-xs text-gray-400">+ {milestone.submitted_evidence.length - 3} more items</p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-3 border-t border-gray-100">
        {txState === "done" ? (
          <span className="badge-green text-sm px-4 py-2">✓ Approved - Gate 1 Passed</span>
        ) : (
          <button onClick={handleApprove} disabled={busy}
            className="btn-primary text-sm px-4 py-2">
            {busy ? "Signing..." : "✓ Engineer Approve (Gate 1)"}
          </button>
        )}
        {busy && <span className="text-xs text-purple-600 self-center animate-pulse">Check Freighter...</span>}
      </div>
    </div>
  );
}

function ApprovedMilestones({ address, extraApproved }: { address: string; extraApproved: MilestoneData[] }) {
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const countResult = await client.get_escrow_count();
        const count = Number(countResult.result);
        const all: EscrowData[] = [];
        async function processEscrow(escrowId: number) {
          const result = await client.get_escrow({ escrow_id: escrowId });
          if (!result.result) throw new Error("not found");
          const e = result.result as any;
          if (e.conditions.engineer_approval === true) {
            all.push({
              id: Number(e.id), pvoId: Number(e.pvo_id), milestoneId: Number(e.milestone_id),
              amount: Number(e.amount), status: statusToString(e.status), engineerApproval: true,
            });
          }
        }
        for (let i = 1; i <= count; i++) { await processEscrow(i); }
        let s = 0; let id = count + 1;
        while (s < 15) { try { await processEscrow(id); s = 0; } catch { s++; } id++; }
        all.sort((a: any, b: any) => b.id - a.id);
        setEscrows(all);
      } catch (e) {
        console.error("Failed to load approved escrows:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (loading) return <BlockchainLoader text="Loading data from Stellar testnet..." />;

  if (escrows.length === 0 && extraApproved.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="font-semibold text-gray-700 mb-1">No approved milestones yet</h3>
        <p className="text-sm text-gray-400">Milestones you approve will appear here.</p>
      </div>
    );
  }

  const currency = getCurrency();

  return (
    <div className="space-y-3">
      {extraApproved.map((m, idx) => (
        <div key={`extra-${idx}`} className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge-green text-xs">✓ Gate 1 Passed</span>
            <span className="text-xs text-gray-500">Just approved — awaiting chain sync</span>
          </div>
          <MilestoneReviewCard 
            milestone={{...m, engineer_approved: true}} 
            currency={getCurrency()} 
            address={address} 
            onAction={() => {}} 
            onApproved={() => {}}
            readonly
          />
        </div>
      ))}
      {escrows.map(e => (
        <div key={e.id} className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">Escrow #{e.id}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">PVO #{e.pvoId}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">Milestone #{e.milestoneId}</span>
              </div>
              <p className="font-medium text-gray-900">{currency}{(e.amount / PPHP_SCALE).toLocaleString()}</p>
            </div>
            <span className="badge badge-green">Engineer Approved</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Status: {e.status}</p>
        </div>
      ))}
    </div>
  );
}

function AllPVOs() {
  const [pvos, setPvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: any[] = [];
        const maxId = Number(cnt.result);
        for (let i = 1; i <= maxId; i++) {
          try {
            const r = await client.get_pvo({ pvo_id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        let nc = 0;
        let si = maxId + 1;
        while (nc < 15) {
          try {
            const r = await client.get_pvo({ pvo_id: si });
            if (r.result) { list.push(r.result); nc = 0; } else { nc++; }
          } catch { nc++; }
          si++;
        }
        setPvos(list);
      } catch (e) {
        console.error("Failed to load PVOs:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMilestones = async (pvoId: number) => {
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const mResult = await client.get_pvo_milestones({ pvo_id: pvoId });
      setMilestones((mResult.result || []) as any[]);
    } catch {}
  };

  if (loading) return <BlockchainLoader text="Loading data from Stellar testnet..." />;

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="btn-ghost mb-4 text-sm">← Back to all PVOs</button>
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div><p className="stat-label">Department</p><p className="text-sm font-medium">{selected.department}</p></div>
            <div><p className="stat-label">Est. Budget</p><p className="text-sm font-medium">{currency}{formatBudget(String(selected.total_budget))}</p></div>
            <div><p className="stat-label">Status</p><span className="badge badge-blue">{statusToString(selected.status)}</span></div>
            <div><p className="stat-label">Milestones</p><p className="text-sm font-medium">{(selected.milestones || []).length}</p></div>
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-4">Milestones</h3>
        <div className="space-y-3">
          {milestones.map((m: any) => (
            <div key={Number(m.id)} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{m.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Status: {statusToString(m.status)} · Engineer: {m.engineer_approved ? "✓" : "○"} · AI: {m.ai_validated ? "✓" : "○"} · Community: {Number(m.community_confirmations)}/{Number(m.community_required)}
                  </p>
                </div>
                <span className="badge badge-purple">{statusToString(m.status)}</span>
              </div>
              {m.submitted_evidence && m.submitted_evidence.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">{m.submitted_evidence.length} evidence items</p>
                </div>
              )}
            </div>
          ))}
          {milestones.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No milestones for this PVO.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pvos.map((pvo: any) => (
        <div key={Number(pvo.id)} className="card p-5 hover:shadow-md cursor-pointer transition" onClick={() => { setSelected(pvo); loadMilestones(Number(pvo.id)); }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">PVO #{Number(pvo.id)}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{pvo.department}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{pvo.title}</h3>
              <p className="text-sm text-gray-500">{pvo.municipality}</p>
            </div>
            <span className="badge badge-purple">{statusToString(pvo.status)}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{currency}{formatBudget(String(pvo.total_budget))}</span>
            <span>{(pvo.milestones || []).length} milestones</span>
          </div>
        </div>
      ))}
    </div>
  );
}
