import { useState, useEffect, useCallback } from "react";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { useWallet } from "../wallet";
import { uploadToIPFS } from "../ipfs";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Client as EscrowClient, type Escrow as ChainEscrow } from "../contracts/escrow/src";
import { Client as RepClient } from "../contracts/reputation/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { CreatePphpTrustline } from "../components/CreatePphpTrustline";
import { Modal } from "../components/Modal";

// --- chain data types ---

interface PVOData {
  id: number; title: string; description: string; department: string;
  municipality: string; total_budget: string; status: string;
  contractor: string; milestones: number[]; created_at: number;
}

interface MilestoneData {
  id: number; title: string; description: string; budget: string;
  status: string; submitted_evidence: any[];
  engineer_approved: boolean; ai_validated: boolean;
  compliance_passed: boolean; community_confirmations: number;
  community_required: number; released?: boolean;
}

interface EscrowData {
  id: number; pvoId: number; milestoneId: number;
  funder: string; recipient: string; amount: number;
  status: string; engineerApproval: boolean;
  aiRiskCheck: boolean; complianceValidation: boolean;
  oracleValidation: boolean;
  communityConfirmation: number; communityRequired: number;
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

// --- main component ---

export function ContractorPortal() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"projects" | "payments" | "history">("projects");
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [prefillPvoId, setPrefillPvoId] = useState(0);
  const [prefillMilestoneId, setPrefillMilestoneId] = useState(0);
  const [reputation, setReputation] = useState<any | null>(null);
  const [repLoading, setRepLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!address) return;
    (async () => {
      setRepLoading(true);
      try {
        const repClient = new RepClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const r = await repClient.get_reputation({ entity: address });
        setReputation(r.result || null);
      } catch { setReputation(null); }
      finally { setRepLoading(false); }
    })();
  }, [address]);

  const confirmRegistration = async () => {
    setConfirming(true);
    try {
      const repClient = new RepClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const tx = await repClient.register_entity({ entity: address!, entity_type: { tag: "Contractor", values: void 0 } });
      await tx.signAndSend();
      setReputation({ reputation_score: 100, completed_projects: 0, success_rate: 100 });
    } catch (e: any) { console.error(e); alert("Confirmation failed: " + (e.message?.slice(0, 80) || "Unknown")); }
    finally { setConfirming(false); }
  };

  const refreshReputation = async () => {
    setRepLoading(true);
    try {
      const repClient = new RepClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const r = await repClient.get_reputation({ entity: address! });
      setReputation(r.result || null);
    } catch { setReputation(null); }
    finally { setRepLoading(false); }
  };

  const openEvidence = (pvoId: number, milestoneId: number) => {
    setPrefillPvoId(pvoId);
    setPrefillMilestoneId(milestoneId);
    setEvidenceModal(true);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to view assigned projects.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contractor Portal</h1>
      <p className="text-gray-500 mb-2">Manage your assigned projects, submit evidence on-chain, and track payments.</p>

      {!repLoading && (
        <div className={`card p-4 mb-4 border ${reputation ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          {reputation ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">✓ Contractor Confirmed</p>
                <p className="text-xs text-green-600 mt-0.5">Reputation: {reputation.reputation_score}/100 · {reputation.completed_projects || 0} projects · {reputation.success_rate || 100}% success</p>
              </div>
              <button onClick={refreshReputation} disabled={confirming}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                ↻ Refresh
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Contractor Confirmation Required</p>
                <p className="text-xs text-amber-600 mt-0.5">Confirm your identity on-chain to build your reputation and track record. This is required before your projects are considered verified.</p>
              </div>
              <button onClick={confirmRegistration} disabled={confirming}
                className="btn-primary text-xs px-4 py-2 whitespace-nowrap">
                {confirming ? "Confirming..." : "✓ Confirm Contractor"}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="card p-3 mb-4 bg-purple-50 border-purple-200 flex items-center justify-between">
        <p className="text-sm text-purple-700">Looking for projects to bid on? Browse open tenders and submit your proposal.</p>
        <a href="/procurement" className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">🏗️ Procurement Marketplace</a>
      </div>
      <CreatePphpTrustline address={address!} />

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(["projects", "payments", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "projects" && "📋 My Projects"}
            {tab === "payments" && "💳 Payments"}
            {tab === "history" && "📄 History"}
          </button>
        ))}
      </div>

      {activeTab === "projects" && <ProjectsTab address={address!} onSubmitEvidence={openEvidence} />}
      {activeTab === "payments" && <PaymentsTab address={address!} />}
      {activeTab === "history" && <HistoryTab address={address!} />}

      <Modal open={evidenceModal} onClose={() => setEvidenceModal(false)} title="Submit Evidence">
        <EvidenceTab key={`${prefillPvoId}-${prefillMilestoneId}`} address={address!} prefillPvoId={prefillPvoId} prefillMilestoneId={prefillMilestoneId} onDone={() => setEvidenceModal(false)} />
      </Modal>
    </div>
  );
}

// --- Projects Tab ---

function ProjectsTab({ address, onSubmitEvidence }: { address: string; onSubmitEvidence: (pvoId: number, milestoneId: number) => void }) {
  const [pvos, setPvos] = useState<PVOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PVOData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);

  const loadPVOs = useCallback(async () => {
    setLoading(true);
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const result = await client.get_pv_os_by_contractor({ contractor: address });
      const chainPvos = (result.result || []) as any[];
      setPvos(chainPvos.map((p: any) => ({
        id: Number(p.id),
        title: p.title,
        description: p.description,
        department: p.department,
        municipality: p.municipality,
        total_budget: String(p.total_budget),
        status: statusToString(p.status),
        contractor: p.contractor,
        milestones: (p.milestones || []) as number[],
        created_at: Number(p.created_at),
      })));
    } catch (e) {
      console.error("Failed to load PVOs:", e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const loadMilestones = useCallback(async (pvoId: number) => {
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const result = await client.get_pvo_milestones({ pvo_id: pvoId });
      const chainM = (result.result || []) as any[];
      // Load escrows to check release status
      let escList: any[] = [];
      try {
        const escClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        escList = ((await escClient.get_escrows_by_pvo({ pvo_id: pvoId })).result || []) as any[];
      } catch {}
      setMilestones(chainM.map((m: any) => {
        const esc = escList.find((e: any) => Number(e.milestone_id) === Number(m.id));
        const released = esc && (esc.status?.tag === "Released" || esc.status === "Released");
        return {
          id: Number(m.id),
          title: m.title,
          description: m.description,
          budget: String(m.budget),
          status: released ? "Completed" : statusToString(m.status),
          submitted_evidence: m.submitted_evidence || [],
          engineer_approved: m.engineer_approved,
          ai_validated: m.ai_validated,
          compliance_passed: m.compliance_passed,
          community_confirmations: Number(m.community_confirmations),
          community_required: Number(m.community_required),
          released,
        };
      }));
    } catch (e) {
      console.error("Failed to load milestones:", e);
    }
  }, []);

  useEffect(() => { loadPVOs(); }, [loadPVOs]);

  const handleSelect = (pvo: PVOData) => {
    setSelected(pvo);
    loadMilestones(pvo.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2].map(i => <div key={i} className="card p-5 skeleton h-32" />)}
      </div>
    );
  }

  if (selected) {
    const sColors: Record<string, string> = {
      Proposed: "badge-blue", Approved: "badge-green", "In Progress": "badge-amber",
      "Under Review": "badge-purple", Completed: "badge-green", Suspended: "badge-red", Terminated: "badge-red",
    };
    const mColors: Record<string, string> = {
      Pending: "badge-amber", EvidenceSubmitted: "badge-blue", EngineerApproved: "badge-purple",
      AIValidated: "badge-purple", CommunityVerified: "badge-purple", CompliancePassed: "badge-purple",
      Released: "badge-green", Rejected: "badge-red",
    };
    const currency = getCurrency();
    return (
      <div>
        <button onClick={() => setSelected(null)} className="btn-ghost mb-4 text-sm">← Back to projects</button>
        <div className="card p-6 mb-6">
          {(() => {
            const allReleased = milestones.length > 0 && milestones.every((m: any) => m.released);
            return (<>
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-xs text-slate-400 font-mono">PVO #{selected.id}</span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{selected.title}</h2>
              <p className="text-sm text-gray-500">{selected.description}</p>
            </div>
            <span className={`badge ${sColors[allReleased ? "Completed" : selected.status] || "badge-blue"}`}>{allReleased ? "Completed" : selected.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="stat-label">Department</p><p className="text-sm font-medium">{selected.department}</p></div>
            <div><p className="stat-label">Location</p><p className="text-sm font-medium">{selected.municipality}</p></div>
            <div><p className="stat-label">Est. Budget</p><p className="text-sm font-medium">{currency}{formatBudget(selected.total_budget)}</p></div>
            <div><p className="stat-label">Milestones</p><p className="text-sm font-medium">{selected.milestones.length}</p></div>
          </div>
          </>
          );
          })()}
        </div>

        <h3 className="font-semibold text-gray-900 mb-4">Milestones</h3>
        <div className="space-y-3">
          {milestones.map(m => {
            return (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{m.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                  <span className={`badge ${mColors[m.status] || "badge-blue"}`}>{m.status}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span>Budget: {currency}{(Number(m.budget) / PPHP_SCALE).toLocaleString()}</span>
                  <span>·</span>
                  <span>{m.submitted_evidence.length} evidence items</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Payments: check Payments tab for gate status</span>
                  {!m.released ? (
                    <button onClick={() => onSubmitEvidence(selected.id, m.id)} className="btn-primary text-xs px-3 py-1">
                      📎 Submit Evidence
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300 cursor-not-allowed">✅ Completed</span>
                  )}
                </div>
              </div>
            );
          })}
          {milestones.length === 0 && (
            <div className="card p-6 text-center text-slate-400">No milestones found for this PVO.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pvos.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🚧</div>
          <h3 className="font-semibold text-gray-700 mb-1">No projects assigned</h3>
          <p className="text-sm text-gray-400">You are not listed as the contractor on any PVO yet.</p>
          <p className="text-sm text-gray-400 mt-2">Win a tender to get assigned - go to the <a href="/procurement" className="text-brand-600 hover:underline font-medium">Procurement Marketplace</a> to browse open tenders and submit bids.</p>
        </div>
      )}
      {pvos.map((p) => (
        <div key={p.id} className="card p-5 hover:shadow-md cursor-pointer transition" onClick={() => handleSelect(p)}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">PVO #{p.id}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{p.department}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.municipality}</p>
            </div>
            <span className="badge badge-purple">View Details →</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>Budget: {getCurrency()}{formatBudget(p.total_budget)}</span>
            <span>{p.milestones.length} milestones</span>
            <span className="text-xs text-slate-400">{p.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Evidence Tab ---

function EvidenceTab({ address, prefillPvoId, prefillMilestoneId, onDone }: { address: string; prefillPvoId: number; prefillMilestoneId: number; onDone: () => void }) {
  const [pvos, setPvos] = useState<{ id: number; title: string }[]>([]);
  const [selectedPvoId, setSelectedPvoId] = useState(String(prefillPvoId || ""));
  const [milestoneId, setMilestoneId] = useState(String(prefillMilestoneId || ""));
  const [evidenceType, setEvidenceType] = useState("");
  const [requiredTypes, setRequiredTypes] = useState<string[]>([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [dataHash, setDataHash] = useState("");
  const [metadata, setMetadata] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  // Load contractor's PVOs for the selection dropdown
  useEffect(() => {
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_pv_os_by_contractor({ contractor: address });
        const chainPvos = (result.result || []) as any[];
        setPvos(chainPvos.map((p: any) => ({ id: Number(p.id), title: p.title })));
      } catch (e) {
        console.error("Failed to load PVOs for evidence tab:", e);
      }
    })();
  }, [address]);

  // Load milestone required evidence types when PVO + milestone are selected
  useEffect(() => {
    if (!selectedPvoId || !milestoneId) { setRequiredTypes([]); setTypesLoaded(false); return; }
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_pvo_milestones({ pvo_id: Number(selectedPvoId) });
        const ms = (result.result || []) as any[];
        const m = ms.find((x: any) => Number(x.id) === Number(milestoneId));
        if (m) {
          setMilestoneTitle(m.title || "");
          const reqRaw = m.required_evidence || [];
          const reqTypes = reqRaw.map((e: any) => {
            if (typeof e === "object" && e.tag) return e.tag;
            if (typeof e === "string") return e;
            return String(e);
          });
          if (reqTypes.length > 0) {
            setRequiredTypes(reqTypes);
            if (!evidenceType) setEvidenceType(reqTypes[0]);
          } else {
            const fallback = ["TimestampedPhoto", "DroneImagery", "GpsCoordinates", "EngineeringReport"];
            setRequiredTypes(fallback);
            if (!evidenceType) setEvidenceType(fallback[0]);
          }
        }
      } catch {
        const fallback = ["TimestampedPhoto", "DroneImagery", "GpsCoordinates", "EngineeringReport"];
        setRequiredTypes(fallback);
        if (!evidenceType) setEvidenceType(fallback[0]);
      }
      setTypesLoaded(true);
    })();
  }, [selectedPvoId, milestoneId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");

    let hash = dataHash;

    // Upload to IPFS first if file is selected
    if (file) {
      setUploading(true);
      try {
        hash = await uploadToIPFS(file);
        setDataHash(hash);
        setTxMsg(`IPFS uploaded: ${hash.slice(0, 20)}...`);
      } catch (err: any) {
        setTxState("error");
        setTxMsg(`IPFS upload failed: ${err.message}`);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (!hash) {
      setTxState("error");
      setTxMsg("Please provide a file or IPFS hash.");
      return;
    }

    // Submit evidence on-chain via raw TransactionBuilder
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.pvo_core);

      const op = contract.call("submit_evidence",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(selectedPvoId)),
        xdr.ScVal.scvU32(Number(milestoneId)),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(evidenceType)]),
        xdr.ScVal.scvString(hash),
        xdr.ScVal.scvString(metadata),
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
      setTxMsg("Evidence submitted on-chain! ID will be visible in milestones.");
      setMilestoneId(""); setDataHash(""); setMetadata(""); setFile(null);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending" || uploading;

  return (
    <>
      <p className="text-sm text-slate-500 -mt-2 mb-4">
        Uploads to IPFS then records the evidence on the pvo_core contract. This is <strong>Gate 1</strong> of the 5-gate escrow system.
      </p>

      {txMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : txState === "error" ? "❌ " : ""}{txMsg}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select value={selectedPvoId} onChange={(e) => setSelectedPvoId(e.target.value)} className="select" required disabled={!!prefillPvoId}>
            <option value="">Select a project...</option>
            {pvos.map(p => <option key={p.id} value={p.id}>PVO #{p.id} - {p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
          <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
            className="input" placeholder="e.g. 3" readOnly={!!prefillMilestoneId} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Type {milestoneTitle && <span className="text-slate-400 font-normal">({milestoneTitle})</span>}</label>
          {!typesLoaded ? (
            <select className="select" disabled>
              <option>Loading evidence types...</option>
            </select>
          ) : (
            <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} className="select">
              {requiredTypes.map((t) => <option key={t} value={t}>{t.replace(/([A-Z])/g, " $1").trim()}</option>)}
            </select>
          )}
          <p className="text-xs text-slate-400 mt-1">Auto-assigned from milestone requirements.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidence File</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition"
            onClick={() => document.getElementById("evidence-file")?.click()}>
            {file ? (
              <div className="text-sm">
                <span className="text-purple-600 font-medium">{file.name}</span>
                <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-xs text-red-500 hover:underline">remove</button>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <span className="text-2xl block mb-1">📎</span>Click to attach evidence file
              </div>
            )}
            <input id="evidence-file" type="file" className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Attach a file for IPFS upload, or paste an existing hash below.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IPFS Hash</label>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="input font-mono text-xs" placeholder="Qm... (auto-filled if you select a file)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metadata / Notes</label>
          <textarea value={metadata} onChange={(e) => setMetadata(e.target.value)}
            className="input" rows={4} placeholder={`e.g. "Site visit for ${milestoneTitle || "milestone"}. Concrete pouring completed and verified on-site. GPS coordinates match project plan. Photos taken from north and south angles."`} />
          <p className="text-xs text-slate-400 mt-1">Describe what was done, when, and how it was verified. This is recorded on-chain permanently.</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-700">
            <strong>Gate 1:</strong> Submitting evidence moves the milestone to "EvidenceSubmitted" status.
            The engineer, AI, compliance, and community must then verify before escrow payments can be released.
          </p>
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {uploading ? "Uploading to IPFS..." : busy ? "Signing..." : "Submit Evidence On-Chain"}
        </button>
        {busy && <p className="text-xs text-purple-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

// --- Payments Tab ---

function PaymentsTab({ address }: { address: string }) {
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const countResult = await client.get_escrow_count();
        const count = Number(countResult.result);
        const all: EscrowData[] = [];
        for (let i = 1; i <= count; i++) {
          try {
            const result = await client.get_escrow({ escrow_id: i });
            if (result.result) {
              const e = result.result as ChainEscrow;
              if ((e as any).recipient === address || e.recipient === address) {
                all.push({
                  id: Number(e.id),
                  pvoId: Number(e.pvo_id),
                  milestoneId: Number(e.milestone_id),
                  funder: e.funder,
                  recipient: e.recipient,
                  amount: Number(e.amount),
                  status: statusToString(e.status),
                  engineerApproval: e.conditions.engineer_approval,
                  aiRiskCheck: e.conditions.ai_risk_check,
                  complianceValidation: e.conditions.compliance_validation,
                  oracleValidation: (e.conditions as any).community_oracle_validation || false,
                  communityConfirmation: Number(e.conditions.community_confirmation),
                  communityRequired: Number(e.conditions.community_required),
                });
              }
            }
          } catch {}
        }
        all.sort((a, b) => b.id - a.id);
        setEscrows(all);
      } catch (e) {
        console.error("Failed to load escrows:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (loading) {
    return <BlockchainLoader text="Loading data from Stellar testnet..." />;
  }

  if (escrows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">💳</div>
        <h3 className="font-semibold text-gray-700 mb-1">No payments found</h3>
        <p className="text-sm text-gray-400">You are not the recipient of any escrow contracts.</p>
      </div>
    );
  }

  const totalPending = escrows.filter(e => e.status !== "Released" && e.status !== "Refunded").reduce((s, e) => s + e.amount, 0);
  const totalReleased = escrows.filter(e => e.status === "Released").reduce((s, e) => s + e.amount, 0);

  const sColors: Record<string, string> = {
    Created: "badge-amber", Funded: "badge-blue", EngineerApproved: "badge-purple",
    AIValidated: "badge-purple", CompliancePassed: "badge-purple", CommunityVerified: "badge-purple",
    Ready: "badge-green", Released: "badge-green", Refunded: "badge-red", Disputed: "badge-red",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Escrows", value: String(escrows.length), color: "text-slate-900" },
          { label: "Pending", value: `${currency}${(totalPending / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-amber-600" },
          { label: "Released", value: `${currency}${(totalReleased / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-emerald-600" },
          { label: "Your Address", value: formatAddress(address, 4), color: "text-purple-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value text-sm ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {escrows.map(e => {
          const gates = [
            { label: "Engineer", done: e.engineerApproval },
            { label: "Compliance", done: e.complianceValidation },
            { label: "Oracle", done: e.oracleValidation },
            { label: `Community (${e.communityConfirmation}/${e.communityRequired})`, done: e.communityConfirmation >= e.communityRequired },
            { label: "AI Risk", done: e.aiRiskCheck },
          ];
          const passed = gates.filter(g => g.done).length;
          return (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">Escrow #{e.id}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">PVO #{e.pvoId}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">Milestone #{e.milestoneId}</span>
                  </div>
                  <p className="font-semibold text-gray-900">{currency}{(e.amount / PPHP_SCALE).toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Funded by <WalletAddress addr={e.funder} chars={4}/></p>
                </div>
                <span className={`badge ${sColors[e.status] || "badge-blue"}`}>{e.status}</span>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-2">
                {gates.map((gate, i) => (
                  <div key={i} className={`rounded-lg p-1.5 text-center text-[11px] font-medium border ${
                    gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}>
                    <div className="text-sm mb-0.5">{gate.done ? "✓" : "○"}</div>
                    {gate.label}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">{passed}/5 gates passed</span>
                {e.status === "Released" && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Payment received</span>
                )}
                {e.status === "Refunded" && (
                  <span className="text-xs text-red-500 font-medium">⚠ Refunded to funder</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- History Tab ---

function HistoryTab({ address }: { address: string }) {
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        // Get contractor's PVOs
        const pvoResult = await client.get_pv_os_by_contractor({ contractor: address });
        const chainPvos = (pvoResult.result || []) as any[];

        const allEvidence: any[] = [];
        for (const pvo of chainPvos) {
          const pvoId = Number(pvo.id);
          const pvoTitle = pvo.title;
          try {
            const mResult = await client.get_pvo_milestones({ pvo_id: pvoId });
            const milestones = (mResult.result || []) as any[];
            for (const m of milestones) {
              const items = m.submitted_evidence || [];
              for (const ev of items) {
                allEvidence.push({
                  pvoId,
                  pvoTitle,
                  milestoneId: Number(m.id),
                  milestoneTitle: m.title,
                  evidenceId: Number(ev.id),
                  type: statusToString(ev.evidence_type),
                  hash: ev.data_hash,
                  metadata: ev.metadata || "",
                  verified: ev.verified,
                  submittedAt: Number(ev.submitted_at),
                  submitter: ev.submitter,
                });
              }
            }
          } catch {}
        }
        allEvidence.sort((a, b) => b.evidenceId - a.evidenceId);
        setEvidence(allEvidence);
      } catch (e) {
        console.error("Failed to load evidence history:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (loading) {
    return <BlockchainLoader text="Loading data from Stellar testnet..." />;
  }

  if (evidence.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📄</div>
        <h3 className="font-semibold text-gray-700 mb-1">No evidence submitted yet</h3>
        <p className="text-sm text-gray-400">Evidence you submit on-chain will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Evidence History ({evidence.length} items)</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Evidence ID</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Milestone</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Hash</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((ev, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">#{ev.evidenceId}</td>
              <td className="px-4 py-3 text-gray-900">{ev.pvoTitle}<br /><span className="text-xs text-gray-400">PVO #{ev.pvoId}</span></td>
              <td className="px-4 py-3 text-gray-900">{ev.milestoneTitle}<br /><span className="text-xs text-gray-400">MS #{ev.milestoneId}</span></td>
              <td className="px-4 py-3"><span className="badge badge-blue">{ev.type}</span></td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.hash ? ev.hash.slice(0, 12) + "..." : "-"}</td>
              <td className="px-4 py-3">
                <span className={`badge ${ev.verified ? "badge-green" : "badge-amber"}`}>
                  {ev.verified ? "Verified" : "Pending"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
