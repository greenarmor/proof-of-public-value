import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { uploadToIPFS } from "../ipfs";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { Modal } from "../components/Modal";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function InspectorPanel() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"pvos" | "submit" | "reports" | "history">("pvos");
  const [submitModal, setSubmitModal] = useState(false);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the inspector panel.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Inspector Panel</h1>
      <p className="text-slate-500 mb-6">Field inspections, on-chain evidence submission, and inspection history.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["pvos", "submit", "reports", "history"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "pvos" && "🏗️ All Projects"}
            {tab === "submit" && "📝 Submit Inspection"}
            {tab === "reports" && "📊 My Reports"}
            {tab === "history" && "📋 Evidence History"}
          </button>
        ))}
      </div>

      {activeTab === "pvos" && <AllProjects address={address!} />}
      {activeTab === "reports" && <MyReports address={address!} />}
      {activeTab === "history" && <EvidenceHistory address={address!} />}

      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit Inspection Report">
        <SubmitInspection address={address!} onDone={() => setSubmitModal(false)} />
      </Modal>
    </div>
  );
}

function AllProjects({ address }: { address: string }) {
  const [pvos, setPvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [inspectMilestone, setInspectMilestone] = useState<any>(null);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_pvo({ pvo_id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        setPvos(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadMilestones = async (pvoId: number) => {
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const mResult = await client.get_pvo_milestones({ pvo_id: pvoId });
      setMilestones((mResult.result || []) as any[]);
    } catch {}
  };

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="btn-ghost mb-4 text-sm">← Back to all projects</button>
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900">{selected.title}</h2>
          <p className="text-sm text-slate-500 mt-1">{selected.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div><p className="stat-label">Location</p><p className="text-sm font-medium">{selected.municipality}</p></div>
            <div><p className="stat-label">Est. Budget</p><p className="text-sm font-medium">{currency}{formatBudget(String(selected.total_budget))}</p></div>
            <div><p className="stat-label">Contractor</p><p className="text-sm font-medium font-mono"><WalletAddress addr={selected.contractor} chars={4}/></p></div>
            <div><p className="stat-label">Milestones</p><p className="text-sm font-medium">{(selected.milestones || []).length}</p></div>
          </div>
        </div>

        <h3 className="font-semibold text-slate-900 mb-4">Milestones</h3>
        <div className="space-y-3">
          {milestones.map((m: any) => (
            <div key={Number(m.id)} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-slate-900">Milestone #{Number(m.id)}: {m.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Status: {statusToString(m.status)} · Budget: {currency}{(Number(m.budget) / PPHP_SCALE).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-purple">{statusToString(m.status)}</span>
                  <button
                    onClick={() => setInspectMilestone(inspectMilestone?.id === m.id ? null : { id: Number(m.id), pvoId: Number(selected.id), title: m.title })}
                    className="btn-primary text-xs px-3 py-1.5">
                    🔍 {inspectMilestone?.id === m.id ? "Cancel" : "Submit Inspection"}
                  </button>
                </div>
              </div>
              {m.submitted_evidence && m.submitted_evidence.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {m.submitted_evidence.map((ev: any, i: number) => (
                    <div key={i} className="bg-slate-50 rounded p-2">
                      <span className="font-medium text-slate-700">{statusToString(ev.evidence_type)}</span>
                      <span className="text-slate-400 ml-1">{ev.verified ? "✓" : "○"}</span>
                    </div>
                  ))}
                </div>
              )}
              {inspectMilestone?.id === m.id && (
                <InspectionForm
                  address={address}
                  pvoId={Number(selected.id)}
                  milestoneId={Number(m.id)}
                  milestoneTitle={m.title}
                  onDone={() => { setInspectMilestone(null); loadMilestones(Number(selected.id)); }}
                />
              )}
            </div>
          ))}
          {milestones.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No milestones for this PVO.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pvos.map((pvo: any) => (
        <div key={Number(pvo.id)} className="card p-5 hover:shadow-md cursor-pointer transition"
          onClick={() => { setSelected(pvo); loadMilestones(Number(pvo.id)); }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">PVO #{Number(pvo.id)}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{pvo.department}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{pvo.title}</h3>
              <p className="text-sm text-slate-500">{pvo.municipality}</p>
            </div>
            <span className="badge badge-purple">{statusToString(pvo.status)}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            <span>{currency}{formatBudget(String(pvo.total_budget))}</span>
            <span>{(pvo.milestones || []).length} milestones</span>
            <span className="text-xs text-slate-400">Contractor: <WalletAddress addr={pvo.contractor} chars={4}/></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmitInspection({ address, onDone }: { address: string; onDone: () => void }) {
  const [pvos, setPvos] = useState<{ id: number; title: string }[]>([]);
  const [selectedPvoId, setSelectedPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [rating, setRating] = useState("Pass");
  const [notes, setNotes] = useState("");
  const [photoHash, setPhotoHash] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: { id: number; title: string }[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_pvo({ pvo_id: i });
            if (r.result) list.push({ id: Number(r.result.id), title: r.result.title });
          } catch {}
        }
        setPvos(list);
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");

    let hash = photoHash;
    if (file) {
      setUploading(true);
      try {
        hash = await uploadToIPFS(file);
        setPhotoHash(hash);
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

    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const metadata = `${rating}: ${notes}`;

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.pvo_core);

      const op = contract.call("submit_evidence",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(selectedPvoId)),
        xdr.ScVal.scvU32(Number(milestoneId)),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("InspectionReport")]),
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
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setTxState("done");
      setTxMsg("Inspection report submitted on-chain!");
      setSelectedPvoId(""); setMilestoneId(""); setNotes(""); setPhotoHash(""); setFile(null);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending" || uploading;

  return (
    <>
      {txMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : txState === "error" ? "❌ " : ""}{txMsg}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
          <select value={selectedPvoId} onChange={(e) => setSelectedPvoId(e.target.value)} className="select" required>
            <option value="">Select a project...</option>
            {pvos.map(p => <option key={p.id} value={p.id}>PVO #{p.id} - {p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Milestone ID</label>
          <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Result</label>
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="select">
            <option value="Pass">Pass - Meets Standards</option>
            <option value="Conditional">Conditional - Minor Issues</option>
            <option value="Fail">Fail - Does Not Meet Standards</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Photo Evidence (Optional)</label>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-brand-400 transition"
            onClick={() => document.getElementById("insp-file")?.click()}>
            {file ? (
              <div className="text-sm">
                <span className="text-brand-600 font-medium">{file.name}</span>
                <span className="text-slate-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-xs text-red-500 hover:underline">remove</button>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                <span className="text-2xl block mb-1">📷</span>Click to attach photo evidence
              </div>
            )}
            <input id="insp-file" type="file" className="hidden"
              accept="image/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <input type="text" value={photoHash} onChange={(e) => setPhotoHash(e.target.value)} className="input font-mono text-xs mt-2"
            placeholder="Or paste IPFS hash (Qm...)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={5}
            placeholder="Detailed findings, measurements, compliance with specifications..." required />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {uploading ? "Uploading to IPFS..." : busy ? "Signing..." : "Submit Inspection Report On-Chain"}
        </button>
        {busy && <p className="text-xs text-brand-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

function MyReports({ address }: { address: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const allReports: any[] = [];

        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const pvoResult = await client.get_pvo({ pvo_id: i });
            if (!pvoResult.result) continue;
            const pvo = pvoResult.result as any;

            const mResult = await client.get_pvo_milestones({ pvo_id: i });
            const milestones = (mResult.result || []) as any[];

            for (const m of milestones) {
              const items = m.submitted_evidence || [];
              for (const ev of items) {
                if (ev.submitter === address && statusToString(ev.evidence_type) === "Inspection Report") {
                  allReports.push({
                    pvoId: i,
                    pvoTitle: pvo.title,
                    milestoneId: Number(m.id),
                    milestoneTitle: m.title,
                    evidenceId: Number(ev.id),
                    type: statusToString(ev.evidence_type),
                    hash: ev.data_hash,
                    metadata: ev.metadata || "",
                    verified: ev.verified,
                    submittedAt: Number(ev.submitted_at),
                  });
                }
              }
            }
          } catch {}
        }
        allReports.sort((a, b) => b.evidenceId - a.evidenceId);
        setReports(allReports);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address]);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (reports.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="font-semibold text-slate-700 mb-1">No inspection reports yet</h3>
        <p className="text-sm text-slate-400">Reports you submit will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">Evidence #{r.evidenceId}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">PVO #{r.pvoId}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">Milestone #{r.milestoneId}</span>
              </div>
              <h4 className="font-medium text-slate-900">{r.pvoTitle}</h4>
              <p className="text-sm text-slate-500">{r.milestoneTitle}</p>
            </div>
            <span className={`badge ${r.verified ? "badge-green" : "badge-amber"}`}>{r.verified ? "Verified" : "Pending"}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Hash: {r.hash ? r.hash.slice(0, 16) + "..." : "-"}</span>
            {r.metadata && <span>Notes: {r.metadata.slice(0, 60)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceHistory({ address }: { address: string }) {
  const [allEvidence, setAllEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const items: any[] = [];

        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const pvoResult = await client.get_pvo({ pvo_id: i });
            if (!pvoResult.result) continue;
            const pvo = pvoResult.result as any;

            const mResult = await client.get_pvo_milestones({ pvo_id: i });
            const milestones = (mResult.result || []) as any[];

            for (const m of milestones) {
              const evItems = m.submitted_evidence || [];
              for (const ev of evItems) {
                items.push({
                  pvoId: i,
                  pvoTitle: pvo.title,
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
        items.sort((a, b) => b.evidenceId - a.evidenceId);
        setAllEvidence(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address]);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (allEvidence.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-slate-700 mb-1">No evidence found</h3>
        <p className="text-sm text-slate-400">Evidence will appear once contractors and inspectors submit reports.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">All Evidence ({allEvidence.length} items)</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">ID</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Project</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Milestone</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Submitter</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {allEvidence.map((ev, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-3 font-mono text-xs text-slate-500">#{ev.evidenceId}</td>
              <td className="px-4 py-3 text-slate-900">{ev.pvoTitle}<br /><span className="text-xs text-slate-400">PVO #{ev.pvoId}</span></td>
              <td className="px-4 py-3 text-slate-900">{ev.milestoneTitle}<br /><span className="text-xs text-slate-400">MS #{ev.milestoneId}</span></td>
              <td className="px-4 py-3"><span className="badge badge-blue">{ev.type}</span></td>
              <td className="px-4 py-3 font-mono text-xs"><WalletAddress addr={ev.submitter} chars={4}/></td>
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

function InspectionForm({ address, pvoId, milestoneId, milestoneTitle, onDone }: {
  address: string; pvoId: number; milestoneId: number; milestoneTitle: string; onDone: () => void;
}) {
  const [rating, setRating] = useState("Pass");
  const [notes, setNotes] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");

    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_IDS.pvo_core);

      const metadata = JSON.stringify({
        rating,
        notes,
        inspector: address,
        inspected_at: new Date().toISOString(),
      });

      const hash = metadata.slice(0, 64);

      const op = contract.call("submit_evidence",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        xdr.ScVal.scvU32(milestoneId),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("InspectionReport")]),
        xdr.ScVal.scvString(hash),
        xdr.ScVal.scvString(metadata),
      );

      const sourceAccount = await server.getAccount(address);
      const tx = new TransactionBuilder(sourceAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);

      setTxState("done");
      setTxMsg(`Inspection report submitted for ${milestoneTitle}!`);
      setTimeout(onDone, 1500);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      {txMsg && (
        <div className={`p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Inspection Rating</label>
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="input text-sm">
            <option value="Pass">✅ Pass - Evidence quality acceptable</option>
            <option value="Fail">❌ Fail - Evidence quality unacceptable</option>
            <option value="Flagged">⚠️ Flagged - Requires further review</option>
          </select>
        </div>
        <div className="text-xs text-slate-400 pt-5">
          PVO #{pvoId} · Milestone #{milestoneId}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Inspection Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          className="input text-sm" rows={3}
          placeholder={`e.g. Drone imagery clear and timestamped. GPS coordinates within expected range.${rating === "Fail" ? " Photo metadata shows image taken before project start date - evidence may be fabricated." : " Evidence quality acceptable for Gate 1 review."}`}
          required />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full py-2 text-sm">
        {busy ? "Submitting..." : "📋 Submit Inspection Report On-Chain"}
      </button>
    </form>
  );
}
