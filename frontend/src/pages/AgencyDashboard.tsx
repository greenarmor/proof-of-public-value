import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { Modal } from "../components/Modal";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function AgencyDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "create_pvo" | "create_milestone">("overview");
  const [pvoModal, setPvoModal] = useState(false);
  const [tenderModal, setTenderModal] = useState(false);
  const [tenderPvoId, setTenderPvoId] = useState(0);
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [prefillMilestonePvoId, setPrefillMilestonePvoId] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your Freighter wallet to manage projects.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Government Agency Dashboard</h1>
          <p className="text-gray-500">Create and manage Public Value Objects (PVOs) on-chain.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPvoModal(true)} className="btn-primary text-xs px-4 py-2">➕ New PVO</button>
          <button onClick={() => setMilestoneModal(true)} className="btn-secondary text-xs px-4 py-2">🏗️ Define Milestone</button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { id: "overview", label: "📋 Project Overview" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <ProjectOverview key={refreshKey} onNewPvo={() => setPvoModal(true)} onNewMilestone={(pvoId) => { setPrefillMilestonePvoId(pvoId); setMilestoneModal(true); }} onOpenTender={(pvoId) => { setTenderPvoId(pvoId); setTenderModal(true); }} />}
      <Modal open={pvoModal} onClose={() => setPvoModal(false)} title="Create New PVO">
        <CreatePVOForm address={address!} onDone={() => { setPvoModal(false); setRefreshKey(k => k + 1); }} />
      </Modal>
      <Modal open={milestoneModal} onClose={() => { setMilestoneModal(false); setRefreshKey(k => k + 1); }} title="Define Milestone">
        <CreateMilestoneForm address={address!} prefillPvoId={prefillMilestonePvoId || undefined} onDone={() => { setMilestoneModal(false); setPrefillMilestonePvoId(0); setRefreshKey(k => k + 1); }} />
      </Modal>
      <Modal open={tenderModal} onClose={() => setTenderModal(false)} title="Create Tender - All Milestones">
        {tenderPvoId > 0 && <TenderForm pvoId={tenderPvoId} address={address!} onDone={() => { setTenderModal(false); setTenderPvoId(0); }} />}
      </Modal>
    </div>
  );
}

function ProjectOverview({ onNewPvo, onNewMilestone, onOpenTender }: { onNewPvo: () => void; onNewMilestone: (pvoId: number) => void; onOpenTender: (pvoId: number) => void }) {
  const [pvos, setPvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pvoFunding, setPvoFunding] = useState<Record<number, { funded: number; escrowed: number; released: number }>>({});
  const [pvoMilestoneBudgets, setPvoMilestoneBudgets] = useState<Record<number, number>>({});
  const [pvoCompleted, setPvoCompleted] = useState<Record<number, boolean>>({});
  const [selectedPvo, setSelectedPvo] = useState<number | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [mlLoading, setMlLoading] = useState(false);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = Number((await client.get_pvo_count()).result);
        const list: any[] = [];
        // get_pvo_count returns map length, not the counter (max ID).
        // Failed txs increment counter without storing PVOs, creating gaps.
        // Scan from 1 to cnt*3 + 50 to cover all possible ID gaps.
        const scanLimit = Math.max(cnt * 3 + 50, 200);
        for (let i = 1; i <= scanLimit; i++) {
          try {
            const r = await client.get_pvo({ pvo_id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        setPvos(list);

        // Check escrow release status per PVO to compute Completed
        const { Client: EscrowClient } = await import("../contracts/escrow/src");
        const escClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const completedMap: Record<number, boolean> = {};
        for (const pvo of list) {
          const pid = Number(pvo.id);
          try {
            const milestones = (await client.get_pvo_milestones({ pvo_id: pid })).result || [];
            let escList: any[] = [];
            try { escList = ((await escClient.get_escrows_by_pvo({ pvo_id: pid })).result || []) as any[]; } catch {}
            let releasedCount = 0;
            for (const m of milestones) {
              const esc = escList.find((e: any) => Number(e.milestone_id) === Number(m.id));
              if (esc && (esc.status?.tag === "Released" || esc.status === "Released")) {
                releasedCount++;
              }
            }
            completedMap[pid] = releasedCount > 0 && releasedCount === milestones.length;
          } catch {}
        }
        setPvoCompleted(completedMap);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // Fetch escrow and grant totals per PVO
    (async () => {
      try {
        const { Client: GC } = await import("../contracts/grant_commitment/src");
        const gc = new GC({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const grants = (await gc.get_all_grants()).result || [];
        const { Client: EC } = await import("../contracts/escrow/src");
        const ec = new EC({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ecCnt = Number((await ec.get_escrow_count()).result);
        const funding: Record<number, { funded: number; escrowed: number; released: number }> = {};
        for (const g of grants) { const pid = Number(g.pvo_id); if (!funding[pid]) funding[pid]={funded:0,escrowed:0,released:0}; funding[pid].funded += Number(g.amount); }
        for (let eid=1;eid<=ecCnt;eid++){try{const r=await ec.get_escrow({escrow_id:eid});if(r.result){const pid=Number(r.result.pvo_id);if(!funding[pid])funding[pid]={funded:0,escrowed:0,released:0};funding[pid].escrowed+=Number(r.result.amount);const s=r.result.status;const eStatus=typeof s==="string"?s:typeof s==="number"?String(s):(s as any)?.tag||"";if(eStatus==="Released")funding[pid].released+=Number(r.result.amount);}}catch{}}
        setPvoFunding(funding);
      } catch {}
    })();
  }, []);

  const loadMilestones = async (pvoId: number) => {
    setMlLoading(true);
    try {
      const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const result = await client.get_pvo_milestones({ pvo_id: pvoId });
      const ml = (result.result || []) as any[];
      setMilestones(ml);
      const total = ml.reduce((sum: number, m: any) => sum + Number(m.budget || 0), 0);
      setPvoMilestoneBudgets(prev => ({ ...prev, [pvoId]: total }));
    } catch { setMilestones([]); }
    finally { setMlLoading(false); }
  };

  const togglePvo = (pvoId: number) => {
    if (selectedPvo === pvoId) { setSelectedPvo(null); setMilestones([]); }
    else { setSelectedPvo(pvoId); loadMilestones(pvoId); }
  };

  if (loading) return <BlockchainLoader text="Loading PVOs from Stellar testnet..." />;

  if (pvos.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No projects yet</h3>
        <p className="text-sm text-gray-400 mb-4">Create your first PVO to get started.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onNewPvo} className="btn-primary text-sm px-5 py-2.5">➕ Create PVO</button>
          <button onClick={() => onNewMilestone(0)} className="btn-secondary text-sm px-5 py-2.5">🏗️ Define Milestone</button>
        </div>
      </div>
    );
  }

  const totalBudget = pvos.reduce((s: number, p: any) => s + Number(p.total_budget), 0) / PPHP_SCALE;
  const totalMilestones = pvos.reduce((s: number, p: any) => s + (p.milestones || []).length, 0);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Projects", value: pvos.length, color: "text-gray-900" },
          { label: "Total Est. Budget", value: `${currency}${(totalBudget / 1_000_000).toFixed(1)}M`, color: "text-purple-600" },
          { label: "Active Milestones", value: totalMilestones, color: "text-blue-600" },
          { label: "Avg Score", value: `${Math.round(pvos.reduce((s: number, p: any) => s + Number(p.public_value_score), 0) / pvos.length)}/100`, color: "text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Dept.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Est. Budget</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Milestones</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {pvos.map((p: any) => (
              <React.Fragment key={Number(p.id)}>
              <tr onClick={() => togglePvo(Number(p.id))} className={`border-t border-gray-100 cursor-pointer transition-colors ${selectedPvo === Number(p.id) ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">#{Number(p.id)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{p.title}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{p.department}</td>
                <td className="px-4 py-3 font-mono text-gray-600 text-xs">{currency}{formatBudget(String(p.total_budget))}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="font-semibold text-purple-600">{(p.milestones || []).length}</span>
                  <span className="text-gray-400 ml-1">defined</span>
                  {(() => {
                    const f = pvoFunding[Number(p.id)];
                    const budget = Number(p.total_budget);
                    const escrowed = f ? f.escrowed : 0;
                    const mlTotal = pvoMilestoneBudgets[Number(p.id)] || 0;
                    const milestonesCoverBudget = mlTotal >= budget && budget > 0;
                    if (budget <= 0 || escrowed < budget) {
                      return milestonesCoverBudget ? (
                        <button onClick={(e) => { e.stopPropagation(); onOpenTender(Number(p.id)); }} className="ml-2 text-[10px] text-orange-600 hover:underline font-medium">📋 Tender</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); onNewMilestone(Number(p.id)); }} className="ml-2 text-[10px] text-purple-600 hover:underline">+ Add</button>
                      );
                    }
                    return null;
                  })()}
                </td>
                <td className="px-4 py-3">{(() => {
                    const isCompleted = pvoCompleted[Number(p.id)] === true;
                    const displayStatus = isCompleted ? "Completed" : statusToString(p.status);
                    const badgeColor = isCompleted ? "badge-green" : "badge-blue";
                    return <span className={`badge ${badgeColor} text-xs`}>{displayStatus}</span>;
                  })()}</td>
              </tr>
              {selectedPvo === Number(p.id) && (
                <tr key={`ml-${p.id}`}>
                  <td colSpan={6} className="px-4 py-3 bg-purple-50/50">
                    <MilestoneList pvoId={Number(p.id)} milestones={milestones} loading={mlLoading} onRefresh={() => loadMilestones(Number(p.id))} />
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MilestoneList({ pvoId, milestones, loading, onRefresh }: {
  pvoId: number; milestones: any[]; loading: boolean; onRefresh: () => void;
}) {
  const currency = getCurrency();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">🏗️ Milestones for PVO #{pvoId}</span>
      </div>
      {loading ? (
        <div className="space-y-1 py-2">
          {[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-8 rounded" />)}
        </div>
      ) : milestones.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">No milestones defined yet. Click "+ Add Milestone" to create one.</div>
      ) : (
        <div className="space-y-1">
          {milestones.map((m: any) => {
            const mStatus = typeof m.status === "string" ? m.status : m.status?.tag || "Pending";
            const statusColor = mStatus === "Released" ? "text-emerald-600" : mStatus === "Pending" ? "text-gray-400" : "text-blue-600";
            return (
              <div key={Number(m.id)} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs border border-gray-100">
                <div>
                  <span className="font-medium text-gray-700">#{Number(m.id)} {m.title}</span>
                  <span className="text-gray-400 ml-2">{currency}{(Number(m.budget) / PPHP_SCALE).toLocaleString()}</span>
                </div>
                <span className={statusColor}>{mStatus}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreatePVOForm({ address, onDone }: { address: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [fundSource, setFundSource] = useState("");
  const [deadline, setDeadline] = useState("");
  const placeholderAddr = useRef("GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Math.round(Number(budget) * PPHP_SCALE);
      if (!amt || amt <= 0) throw new Error("Budget must be positive");
      const deadlineTs = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.pvo_core);

      // project_manager is vestigial - no longer used for auth, pass agency address
      const pm = new Address(address).toScVal();

      // Encode GPS coordinates into description for on-chain map retrieval
      const desc = (latitude && longitude)
        ? `[${latitude},${longitude}] ${description}`
        : description;

      const op = contract.call("create_pvo",
        new Address(address).toScVal(),
        xdr.ScVal.scvString(title),
        xdr.ScVal.scvString(desc),
        new Address(address).toScVal(),
        new Address(placeholderAddr.current).toScVal(),
        pm,
        xdr.ScVal.scvString(department),
        xdr.ScVal.scvString(municipality),
        new ScInt(amt).toI128(),
        xdr.ScVal.scvString(fundSource),
        nativeToScVal(deadlineTs, { type: "u64" }),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      const sendResp = await server.sendTransaction(signedTx);
      if (sendResp.status === "ERROR") throw new Error("Transaction rejected by network");
      if (sendResp.status !== "PENDING" && sendResp.status !== "DUPLICATE") throw new Error(`Tx status: ${sendResp.status}`);

      // Wait for on-chain confirmation before refreshing
      setTxMsg("Confirming on-chain...");
      let confirmed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const txResp = await server.getTransaction(sendResp.hash);
          if (txResp.status === "SUCCESS") { confirmed = true; break; }
          if (txResp.status === "FAILED") throw new Error("Transaction failed on-chain");
        } catch (e) { if (String(e).includes("Failed")) throw e; }
      }
      if (!confirmed) throw new Error("Transaction not confirmed after 40s");

      setTxState("done");
      setTxMsg("PVO created on-chain!");
      setTitle(""); setDepartment(""); setMunicipality(""); setBudget(""); setDescription(""); setFundSource("National Budget"); setLatitude(""); setLongitude("");
      setTimeout(onDone, 800);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";
  const currency = getCurrency();

  return (
    <>
      {txMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Road Paving Project" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">📍 Location (coordinates preferred)</label>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <input type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                className="input font-mono text-xs" placeholder="Latitude e.g. 14.6507" step="any" />
              <p className="text-[10px] text-slate-400 mt-0.5">Latitude</p>
            </div>
            <div>
              <input type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                className="input font-mono text-xs" placeholder="Longitude e.g. 121.1029" step="any" />
              <p className="text-[10px] text-slate-400 mt-0.5">Longitude</p>
            </div>
          </div>
          <button type="button" onClick={() => {
            navigator.geolocation.getCurrentPosition(
              p => { setLatitude(p.coords.latitude.toFixed(6)); setLongitude(p.coords.longitude.toFixed(6)); },
              () => {}
            );
          }} className="text-xs text-brand-600 hover:underline -mt-1 mb-2">
            📍 Use my current location
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="DPWH" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipality (fallback)</label>
            <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="input" placeholder="Quezon City" required />
          </div>
        </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Est. Budget (in Pesos)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="500000000" min="1" step="0.01" />
            {budget && Number(budget) > 0 && <p className="text-xs text-gray-400 mt-1">= {(Number(budget) * PPHP_SCALE).toLocaleString()} SAC units (₱{Number(budget).toLocaleString()})</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fund Source</label>
            <input type="text" value={fundSource} onChange={(e) => setFundSource(e.target.value)} className="input" placeholder="National Budget 2026" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
          <input type="text" value="TBD - assigned after bidding" readOnly className="input text-slate-400 cursor-not-allowed" />
          <p className="text-xs text-amber-600 mt-1">Contractor will be assigned on-chain after the bidding process is complete.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} placeholder="Paving 10km of national road..." required />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? "Signing..." : "Create PVO On-Chain"}
        </button>
        {busy && <p className="text-xs text-purple-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

function TenderForm({ pvoId, address, onDone }: { pvoId: number; address: string; onDone: () => void }) {
  const [pvoTitle, setPvoTitle] = useState("");
  const [pvoBudget, setPvoBudget] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const r = await client.get_pvo({ pvo_id: pvoId });
        if (r.result) {
          setPvoTitle(r.result.title);
          setPvoBudget(String(r.result.total_budget));
        }
      } catch {}
    })();
  }, [pvoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.procurement_market);
      const dl = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      const op = contract.call("create_tender",
        new Address(address).toScVal(),
        nativeToScVal(pvoId, { type: "u32" }),
        nativeToScVal(0, { type: "u32" }), // milestone_id=0 = all milestones
        xdr.ScVal.scvString(`PVO #${pvoId} - ${pvoTitle}`),
        xdr.ScVal.scvString(desc || "Whole project tender for PVO #" + pvoId),
        new ScInt(Number(pvoBudget) || 1).toI128(),
        nativeToScVal(dl, { type: "u64" }),
      );
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      const sendResp = await server.sendTransaction(signedTx);
      if (sendResp.status === "ERROR") throw new Error("Transaction rejected by network");
      if (sendResp.status !== "PENDING" && sendResp.status !== "DUPLICATE") throw new Error(`Tx status: ${sendResp.status}`);
      setTxMsg("Confirming on-chain...");
      let confirmed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const txResp = await server.getTransaction(sendResp.hash);
          if (txResp.status === "SUCCESS") { confirmed = true; break; }
          if (txResp.status === "FAILED") throw new Error("Transaction failed on-chain");
        } catch (e) { if (String(e).includes("Failed")) throw e; }
      }
      if (!confirmed) throw new Error("Transaction not confirmed after 40s");
      setTxState("done");
      setTxMsg("Tender created on-chain!");
      setTimeout(onDone, 800);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {txMsg && <div className={`p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{txState === "done" ? "✅ " : "❌ "}{txMsg}</div>}
      <div><p className="text-xs text-amber-600 mb-2">Tender for PVO #{pvoId} - covers all milestones. Contractors bid on the whole project.</p></div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Tender Title</label><input type="text" value={`PVO #${pvoId} - ${pvoTitle}`} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="input" rows={2} placeholder="Describe the scope of work..." /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Est. Budget (SAC units)</label><input type="text" value={pvoBudget} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed font-mono" />
          {pvoBudget && <p className="text-xs text-gray-400 mt-1">{currency}{(Number(pvoBudget) / PPHP_SCALE).toLocaleString()}</p>}
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Bid Submission Deadline</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="input" /></div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy ? "Signing..." : "Create Tender On-Chain"}</button>
    </form>
  );
}

function CreateMilestoneForm({ address, prefillPvoId, onDone }: { address: string; prefillPvoId?: number; onDone: () => void }) {
  const [pvoId, setPvoId] = useState(prefillPvoId ? String(prefillPvoId) : "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [communityRequired, setCommunityRequired] = useState("3");
  const [evidenceTypes, setEvidenceTypes] = useState<string[]>(["DroneImagery"]);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [existingMilestoneTotal, setExistingMilestoneTotal] = useState(0);

  // Auto-search PVOs
  const [pvos, setPvos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-set PVO title when pre-filled
  useEffect(() => {
    if (prefillPvoId) {
      const pvo = pvos.find((p: any) => Number(p.id) === prefillPvoId);
      if (pvo) { setSearchQuery(pvo.title); setPvoId(String(prefillPvoId)); }
    }
  }, [prefillPvoId, pvos]);

  // Load existing milestones for the selected PVO to calculate remaining budget
  useEffect(() => {
    if (!pvoId) { setExistingMilestoneTotal(0); return; }
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ml = await client.get_pvo_milestones({ pvo_id: Number(pvoId) });
        const total = ((ml.result || []) as any[]).reduce((sum: number, m: any) => sum + Number(m.budget || 0), 0);
        setExistingMilestoneTotal(total / PPHP_SCALE);
      } catch { setExistingMilestoneTotal(0); }
    })();
  }, [pvoId]);

  useEffect(() => {
    (async () => {
      try {
        const client = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try { const r = await client.get_pvo({ pvo_id: i }); if (r.result) list.push(r.result); } catch {}
        }
        setPvos(list);
      } catch {}
    })();
  }, []);

  const filtered = searchQuery
    ? pvos.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : pvos.slice(0, 5);

  const allTypes = ["DroneImagery", "SatelliteImagery", "GpsCoordinates", "TimestampedPhoto", "TimestampedVideo", "IoTSensor", "EngineeringReport", "LabResult", "InspectionReport", "CommunityVerification"];

  const toggleType = (t: string) => {
    setEvidenceTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Math.round(Number(budget) * PPHP_SCALE);
      if (!amt || amt <= 0) throw new Error("Budget must be positive");
      if (evidenceTypes.length === 0) throw new Error("Select at least one evidence type");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.pvo_core);

      // Encode Vec<EvidenceType> - each enum is ScvVec([ScvSymbol(variant)])
      const evTypes = xdr.ScVal.scvVec(
        evidenceTypes.map(t => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(t)]))
      );

      const op = contract.call("create_milestone",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(pvoId)),
        xdr.ScVal.scvString(title),
        xdr.ScVal.scvString(description),
        new ScInt(amt).toI128(),
        evTypes,
        xdr.ScVal.scvU32(Number(communityRequired)),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      const sendResp = await server.sendTransaction(signedTx);
      if (sendResp.status === "ERROR") throw new Error("Transaction rejected by network");
      if (sendResp.status !== "PENDING" && sendResp.status !== "DUPLICATE") throw new Error(`Tx status: ${sendResp.status}`);
      setTxMsg("Confirming on-chain...");
      let confirmed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const txResp = await server.getTransaction(sendResp.hash);
          if (txResp.status === "SUCCESS") { confirmed = true; break; }
          if (txResp.status === "FAILED") throw new Error("Transaction failed on-chain");
        } catch (e) { if (String(e).includes("Failed")) throw e; }
      }
      if (!confirmed) throw new Error("Transaction not confirmed after 40s");

      setTxState("done");
      setTxMsg("Milestone created on-chain!");
      setPvoId(""); setTitle(""); setDescription(""); setBudget("");
      setCommunityRequired("3"); setEvidenceTypes(["DroneImagery"]);
      setTimeout(onDone, 800);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <>
      {txMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search PVO</label>
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => { if (!prefillPvoId) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="input" placeholder="Type project title..." readOnly={!!prefillPvoId} />
            {pvoId && <p className="text-xs text-brand-600 mt-1">PVO #{pvoId} selected {prefillPvoId ? "(locked)" : ""}</p>}
            {!prefillPvoId && showDropdown && (searchQuery || filtered.length > 0) && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filtered.map((pvo: any) => (
                  <button type="button" key={Number(pvo.id)}
                    onMouseDown={() => { setPvoId(String(pvo.id)); setSearchQuery(pvo.title); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700 transition-colors">
                    <span className="font-medium">#{String(pvo.id)} {pvo.title}</span>
                    <span className="text-xs text-slate-400 ml-2">{pvo.department} · {pvo.municipality}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">No PVOs match</div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Est. Budget (in Pesos)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="e.g. 5000000 = ₱5,000,000" required min="1" step="0.01" />
            <p className="text-xs text-slate-400 mt-1">{budget && Number(budget) > 0 ? `= ${(Number(budget) * PPHP_SCALE).toLocaleString(undefined, {maximumFractionDigits: 0})} SAC units (₱${Number(budget).toLocaleString()})` : "1 peso = 10,000,000 SAC units"}</p>
            {pvoId && (() => {
              const selectedPVO = pvos.find((p: any) => Number(p.id) === Number(pvoId));
              if (!selectedPVO) return null;
              const totalBudget = Number(selectedPVO.total_budget) / PPHP_SCALE;
              const milestoneAmount = Number(budget) || 0;
              const alreadyAllocated = existingMilestoneTotal;
              const remaining = totalBudget - alreadyAllocated - milestoneAmount;
              const totalAfter = totalBudget - alreadyAllocated;
              const pct = totalBudget > 0 ? Math.min(100, Math.round(((alreadyAllocated + milestoneAmount) / totalBudget) * 100)) : 0;
              const overBudget = remaining < 0;
              return (
                <div className={`mt-2 p-3 rounded-lg border text-xs ${overBudget ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                  <div className="flex justify-between mb-1"><span>PVO Total Est. Budget:</span><span className="font-semibold">₱{totalBudget.toLocaleString()}</span></div>
                  {alreadyAllocated > 0 && (
                    <div className="flex justify-between mb-1"><span>Already Allocated:</span><span>₱{alreadyAllocated.toLocaleString()}</span></div>
                  )}
                  {milestoneAmount > 0 && (
                    <>
                      <div className="flex justify-between mb-1"><span>This Milestone:</span><span>₱{milestoneAmount.toLocaleString()} ({pct}%)</span></div>
                      <div className="flex justify-between mb-1 font-semibold"><span>Total After:</span><span>₱{(alreadyAllocated + milestoneAmount).toLocaleString()}</span></div>
                      {overBudget ? (
                        <div className="pt-1 border-t border-red-200 text-red-700 font-semibold">⚠️ Over budget by ₱{Math.abs(remaining).toLocaleString()}</div>
                      ) : (
                        <div className="flex justify-between pt-1 border-t border-blue-200">
                          <span>Remaining:</span>
                          <span className="font-bold">{remaining === 0 ? "₱0 (fully allocated)" : `₱${remaining.toLocaleString()}`}</span>
                        </div>
                      )}
                    </>
                  )}
                  {milestoneAmount === 0 && (
                    <div className="flex justify-between pt-1 border-t border-blue-200">
                      <span>Remaining:</span>
                      <span className="font-bold">{totalAfter === 0 ? "₱0 (fully allocated)" : `₱${totalAfter.toLocaleString()}`}</span>
                    </div>
                  )}
                  {(alreadyAllocated + milestoneAmount) > 0 && !overBudget && (
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-brand-500 rounded-full h-1.5 transition-all" style={{width: `${pct}%`}} />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Site Preparation" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} placeholder="Clearing and leveling the construction site..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Community Confirmations Required</label>
          <input type="number" value={communityRequired} onChange={(e) => setCommunityRequired(e.target.value)} className="input" min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required Evidence Types</label>
          <div className="flex flex-wrap gap-2">
            {allTypes.map(t => (
              <button type="button" key={t} onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  evidenceTypes.includes(t)
                    ? "bg-purple-100 border-purple-300 text-purple-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-purple-200"
                }`}>
                {t.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? "Signing..." : "Create Milestone On-Chain"}
        </button>
        {busy && <p className="text-xs text-purple-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}
