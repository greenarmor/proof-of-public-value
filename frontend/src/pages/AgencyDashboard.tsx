import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency } from "../config";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function AgencyDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "create_pvo" | "create_milestone">("overview");

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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Government Agency Dashboard</h1>
      <p className="text-gray-500 mb-6">Create and manage Public Value Objects (PVOs) on-chain.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { id: "overview", label: "📋 Project Overview" },
          { id: "create_pvo", label: "➕ New PVO" },
          { id: "create_milestone", label: "🏗️ Define Milestone" },
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

      {activeTab === "overview" && <ProjectOverview />}
      {activeTab === "create_pvo" && <CreatePVOForm address={address!} />}
      {activeTab === "create_milestone" && <CreateMilestoneForm address={address!} />}
    </div>
  );
}

function ProjectOverview() {
  const [pvos, setPvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (pvos.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No projects yet</h3>
        <p className="text-sm text-gray-400">Create your first PVO using the New PVO tab.</p>
      </div>
    );
  }

  const totalBudget = pvos.reduce((s: number, p: any) => s + Number(p.total_budget), 0);
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

function CreatePVOForm({ address }: { address: string }) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [fundSource, setFundSource] = useState("");
  const [contractor, setContractor] = useState("");
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

      const op = contract.call("create_pvo",
        new Address(address).toScVal(),
        xdr.ScVal.scvString(title),
        xdr.ScVal.scvString(description),
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
      setTxMsg("PVO created on-chain! Refresh overview to see it.");
      setTitle(""); setDepartment(""); setMunicipality(""); setBudget(""); setDescription(""); setFundSource(""); setContractor("");
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";
  const currency = getCurrency();

  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-2 text-gray-900">Create New PVO</h2>
      <p className="text-sm text-gray-500 mb-4">Creates a Public Value Object on the pvo_core contract. This is the first step in the project lifecycle.</p>

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="DPWH" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
            <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="input" placeholder="Quezon City" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
          <input type="text" value={contractor} onChange={(e) => setContractor(e.target.value)} className="input font-mono text-xs" placeholder="GAZENYNRLICJYECZ66IGSOHH2N246P3CGZMI2DJ2G3RFK6A5WF42LPRW" />
          {contractor && <p className="text-xs text-gray-400 mt-1">Contractor: {formatAddress(contractor)}</p>}
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
    </div>
  );
}

function CreateMilestoneForm({ address }: { address: string }) {
  const [pvoId, setPvoId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [communityRequired, setCommunityRequired] = useState("3");
  const [evidenceTypes, setEvidenceTypes] = useState<string[]>(["DroneImagery"]);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

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

      const amt = Number(budget);
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
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-2 text-gray-900">Define Milestone</h2>
      <p className="text-sm text-gray-500 mb-4">Creates a milestone on the pvo_core contract. Each milestone will later have an escrow for payment.</p>

      {txMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (centavos)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="500000000" required />
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
    </div>
  );
}
