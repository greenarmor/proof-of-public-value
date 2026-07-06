import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { Modal } from "../components/Modal";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function AgencyDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "create_pvo" | "create_milestone">("overview");
  const [pvoModal, setPvoModal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(false);

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

      {activeTab === "overview" && <ProjectOverview onNewPvo={() => setPvoModal(true)} onNewMilestone={() => setMilestoneModal(true)} />}
      <Modal open={pvoModal} onClose={() => setPvoModal(false)} title="Create New PVO">
        <CreatePVOForm address={address!} onDone={() => setPvoModal(false)} />
      </Modal>
      <Modal open={milestoneModal} onClose={() => setMilestoneModal(false)} title="Define Milestone">
        <CreateMilestoneForm address={address!} onDone={() => setMilestoneModal(false)} />
      </Modal>
    </div>
  );
}

function ProjectOverview({ onNewPvo, onNewMilestone }: { onNewPvo: () => void; onNewMilestone: () => void }) {
  const [pvos, setPvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pvoFunding, setPvoFunding] = useState<Record<number, { funded: number; escrowed: number }>>({});
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
    // Fetch escrow and grant totals per PVO
    (async () => {
      try {
        const { Client: GC } = await import("../contracts/grant_commitment/src");
        const gc = new GC({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const grants = (await gc.get_all_grants()).result || [];
        const { Client: EC } = await import("../contracts/escrow/src");
        const ec = new EC({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const ecCnt = Number((await ec.get_escrow_count()).result);
        const funding: Record<number, { funded: number; escrowed: number }> = {};
        for (const g of grants) { const pid = Number(g.pvo_id); if (!funding[pid]) funding[pid]={funded:0,escrowed:0}; funding[pid].funded += Number(g.amount); }
        for (let eid=1;eid<=ecCnt;eid++){try{const r=await ec.get_escrow({escrow_id:eid});if(r.result){const pid=Number(r.result.pvo_id);if(!funding[pid])funding[pid]={funded:0,escrowed:0};funding[pid].escrowed+=Number(r.result.amount);}}catch{}}
        setPvoFunding(funding);
      } catch {}
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (pvos.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No projects yet</h3>
        <p className="text-sm text-gray-400 mb-4">Create your first PVO to get started.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onNewPvo} className="btn-primary text-sm px-5 py-2.5">➕ Create PVO</button>
          <button onClick={onNewMilestone} className="btn-secondary text-sm px-5 py-2.5">🏗️ Define Milestone</button>
        </div>
      </div>
    );
  }

  const totalBudget = pvos.reduce((s: number, p: any) => s + Number(p.total_budget)/100, 0);
  const totalMilestones = pvos.reduce((s: number, p: any) => s + (p.milestones || []).length, 0);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Projects", value: pvos.length, color: "text-gray-900" },
          { label: "Total Budget", value: `${currency}${(totalBudget / 100 / 1_000_000).toFixed(1)}M`, color: "text-purple-600" },
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Escrowed</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Available</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
            </tr>
          </thead>
          <tbody>
            {pvos.map((p: any) => (
              <tr key={Number(p.id)} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">#{Number(p.id)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">{p.department}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{currency}{formatBudget(String(p.total_budget))}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const f = pvoFunding[Number(p.id)];
                    const budget = Number(p.total_budget);
                    if (!f || budget === 0) return <span className="text-gray-300">—</span>;
                    const escPct = Math.min(100, (f.escrowed / budget) * 100);
                    return (
                      <div>
                        <span className="text-xs text-emerald-600 font-medium">{currency}{(f.escrowed / PPHP_SCALE / 1_000_000).toFixed(1)}M</span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-0.5"><div className="h-full bg-emerald-500 rounded-full" style={{width: escPct+"%"}}/></div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const f = pvoFunding[Number(p.id)];
                    const budget = Number(p.total_budget);
                    if (!f || budget === 0) return <span className="text-gray-300">—</span>;
                    const remaining = Math.max(0, f.funded - f.escrowed);
                    const availPct = Math.min(100, (remaining / budget) * 100);
                    return remaining > 0 ? (
                      <div>
                        <span className="text-xs text-amber-600 font-medium">{currency}{(remaining / PPHP_SCALE / 1_000_000).toFixed(1)}M</span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-0.5"><div className="h-full bg-amber-400 rounded-full" style={{width: availPct+"%"}}/></div>
                      </div>
                    ) : <span className="text-xs text-slate-400">Fully escrowed</span>;
                  })()}
                </td>
                <td className="px-4 py-3"><span className="badge badge-blue">{statusToString(p.status)}</span></td>
                <td className="px-4 py-3"><span className="font-semibold text-gray-700">{Number(p.public_value_score)}</span><span className="text-gray-400">/100</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [contractor, setContractor] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Number(budget);
      if (!amt || amt <= 0) throw new Error("Budget must be positive");

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
        new Address(address).toScVal(),       // funding_agency = self
        new Address(contractor || address).toScVal(), // contractor
        pm,                                     // project_manager (vestigial)
        xdr.ScVal.scvString(department),
        xdr.ScVal.scvString(municipality),
        new ScInt(amt).toI128(),
        xdr.ScVal.scvString(fundSource),
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
      setTxMsg("PVO created on-chain!");
      setTitle(""); setDepartment(""); setMunicipality(""); setBudget(""); setDescription(""); setFundSource(""); setContractor(""); setLatitude(""); setLongitude("");
      setTimeout(onDone, 1500);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (centavos)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="10000000000" required />
            {budget && <p className="text-xs text-gray-400 mt-1">{currency}{(Number(budget) / 100).toLocaleString()}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fund Source</label>
            <input type="text" value={fundSource} onChange={(e) => setFundSource(e.target.value)} className="input" placeholder="National Budget 2026" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Address (optional)</label>
          <input type="text" value={contractor} onChange={(e) => setContractor(e.target.value)} className="input font-mono text-xs" placeholder="GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF" />
          {contractor && <p className="text-xs text-gray-400 mt-1">Contractor: <WalletAddress addr={contractor}/></p>}
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

function CreateMilestoneForm({ address, onDone }: { address: string; onDone: () => void }) {
  const [pvoId, setPvoId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [communityRequired, setCommunityRequired] = useState("3");
  const [evidenceTypes, setEvidenceTypes] = useState<string[]>(["DroneImagery"]);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  // Auto-search PVOs
  const [pvos, setPvos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

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
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setTxState("done");
      setTxMsg("Milestone created on-chain!");
      setPvoId(""); setTitle(""); setDescription(""); setBudget("");
      setCommunityRequired("3"); setEvidenceTypes(["DroneImagery"]);
      setTimeout(onDone, 1500);
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
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="input" placeholder="Type project title..." />
            {pvoId && <p className="text-xs text-brand-600 mt-1">PVO #{pvoId} selected</p>}
            {showDropdown && (searchQuery || filtered.length > 0) && (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (in Pesos)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="e.g. 5000000 = ₱5,000,000" required min="1" step="0.01" />
            <p className="text-xs text-slate-400 mt-1">{budget && Number(budget) > 0 ? `= ${(Number(budget) * PPHP_SCALE).toLocaleString(undefined, {maximumFractionDigits: 0})} SAC units (₱${Number(budget).toLocaleString()})` : "1 peso = 10,000,000 SAC units"}</p>
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
