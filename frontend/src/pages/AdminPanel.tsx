import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as AccessControlClient } from "../contracts/access_control/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { Modal } from "../components/Modal";

const ROLES = [
  "Citizen", "Engineer", "Inspector", "Contractor", "Supplier",
  "GovernmentAgency", "Auditor", "CommissionOnAudit",
  "AntiCorruptionAgency", "FundingAgency", "InternationalDonor",
  "Administrator", "AIAuditor",
] as const;

interface SystemHealth {
  label: string;
  value: string;
  status: "healthy" | "warning" | "error";
}

export function AdminPanel() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"roles" | "pledges" | "disputes" | "health" | "upgrade" | "settings" | "pledges">("roles");
  const [assignModal, setAssignModal] = useState(false);
  const [mintModal, setMintModal] = useState(false);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your Administrator wallet to manage the system.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
      <p className="text-gray-500 mb-6">Manage roles, handle disputes, and monitor system health.</p>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 border-b border-gray-200">
          {(["roles", "pledges", "disputes", "health", "upgrade", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "roles" && "👥 Roles"}
              {tab === "pledges" && "💸 Pledges"}
              {tab === "pledges" && "💸 Pledges"}
              {tab === "disputes" && "⚖️ Dispute Resolution"}
              {tab === "health" && "📊 Health"}
              {tab === "upgrade" && "🔄 Upgrade"}
              {tab === "settings" && "⚡ Settings"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAssignModal(true)} className="btn-primary text-xs px-4 py-2">👤 Assign Role</button>
          <button onClick={() => setMintModal(true)} className="btn-secondary text-xs px-4 py-2">🪙 Mint RPT</button>
        </div>
      </div>

      {activeTab === "roles" && <RoleManagement />}
      {activeTab === "pledges" && <PledgeManager />}
      {activeTab === "pledges" && <PledgeManager />}
      {activeTab === "disputes" && <DisputeResolution />}
      {activeTab === "health" && <SystemHealthMonitor />}
      {activeTab === "upgrade" && <ContractUpgrade />}
      {activeTab === "settings" && <SettingsTab />}

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Role">
        <AssignRoleForm onDone={() => setAssignModal(false)} />
      </Modal>
      <Modal open={mintModal} onClose={() => setMintModal(false)} title="Mint RPT Tokens">
        <MintRPTForm onDone={() => setMintModal(false)} />
      </Modal>
    </div>
  );
}

function RoleManagement() {
  const { address } = useWallet();
  const [assignments, setAssignments] = useState<{ address: string; role: string }[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const client = new AccessControlClient({ contractId: CONTRACT_IDS.access_control, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const all: { address: string; role: string }[] = [];
      for (const r of ROLES.slice()) {
        try {
          const result = await client.get_addresses_by_role({ role: { tag: r, values: undefined } as any });
          const addresses = result.result;
          if (addresses) {
            for (const addr of addresses) {
              all.push({ address: addr, role: r });
            }
          }
        } catch {}
      }
      setAssignments(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleRevoke = async (addr: string, r: string) => {
    if (!address) return;
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.access_control);
      const op = contract.call("revoke_role",
        new Address(address).toScVal(),
        new Address(addr).toScVal(),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(r)]),
      );
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();
      await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction((await server.prepareTransaction(tx)).toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }
      await loadAssignments();
    } catch (err: any) { console.error(err); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold">Current Role Assignments</h3>
        <button onClick={loadAssignments} className="text-sm text-purple-600 hover:underline">Refresh</button>
      </div>
      {loadingAssignments ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No roles assigned yet. Use the Assign Role button above.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Address</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs text-gray-600"><WalletAddress addr={a.address} chars={8}/></td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700">{a.role.replace(/([A-Z])/g, " $1").trim()}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleRevoke(a.address, a.role)}
                    className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AssignRoleForm({ onDone }: { onDone: () => void }) {
  const { address } = useWallet();
  const [userAddress, setUserAddress] = useState("");
  const [role, setRole] = useState<string>("Contractor");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !userAddress) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const adminAddr = new Address(address);
      const targetAddr = new Address(userAddress);
      const ops: any[] = [];
      const acContract = new Contract(CONTRACT_IDS.access_control);
      ops.push(acContract.call("assign_role", adminAddr.toScVal(), targetAddr.toScVal(), xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(role)])));
      const extraPerms: string[] = [];
      if (role === "AntiCorruptionAgency") {
        const aiC = new Contract(CONTRACT_IDS.ai_oracle);
        ops.push(aiC.call("add_ai_auditor", adminAddr.toScVal(), targetAddr.toScVal()));
        extraPerms.push("AI Oracle");
        const compC = new Contract(CONTRACT_IDS.compliance_engine);
        ops.push(compC.call("add_compliance_officer", adminAddr.toScVal(), targetAddr.toScVal()));
        extraPerms.push("Compliance Engine");
      }
      if (role === "AIAuditor") {
        const aiC = new Contract(CONTRACT_IDS.ai_oracle);
        ops.push(aiC.call("add_ai_auditor", adminAddr.toScVal(), targetAddr.toScVal()));
        extraPerms.push("AI Oracle");
      }
      if (role === "Auditor" || role === "CommissionOnAudit") {
        const compC = new Contract(CONTRACT_IDS.compliance_engine);
        ops.push(compC.call("add_compliance_officer", adminAddr.toScVal(), targetAddr.toScVal()));
        extraPerms.push("Compliance Engine");
      }
      const txBuilder = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE });
      ops.forEach((op: any) => txBuilder.addOperation(op));
      const tx = txBuilder.setTimeout(30).build();
      const permSummary = extraPerms.length > 0 ? ` + auto-whitelisted: ${extraPerms.join(", ")}` : "";
      setMessage({ text: `Check Freighter to sign ${ops.length} operation(s)...`, ok: true });
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }
      setMessage({ text: `Role ${role} assigned to ${formatAddress(userAddress)}!${permSummary}`, ok: true });
      setUserAddress("");
      setTimeout(onDone, 2000);
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, ok: false });
    } finally { setSubmitting(false); }
  };

  return (
    <>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <div className="mb-4">
        <p className="text-sm text-gray-400">Only the Administrator wallet can assign roles. The contract enforces this on-chain.</p>
        <p className="text-xs text-gray-400 mt-1">Auto-whitelist: AntiCorruptionAgency → AI Oracle + Compliance. AIAuditor → AI Oracle. Auditor/COA → Compliance.</p>
      </div>
      <form className="space-y-4" onSubmit={handleAssign}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address (G...)</label>
          <input type="text" value={userAddress} onChange={(e) => setUserAddress(e.target.value)} className="input font-mono text-xs" placeholder="G..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="select">
            {ROLES.map((r) => <option key={r} value={r}>{r.replace(/([A-Z])/g, " $1").trim()}</option>)}
          </select>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? "Assigning..." : "Assign Role"}
        </button>
      </form>
    </>
  );
}

function MintRPTForm({ onDone }: { onDone: () => void }) {
  const { address } = useWallet();
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [recentMints, setRecentMints] = useState<{ to: string; amount: string }[]>([]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !wallet) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { Contract, Address, rpc, TransactionBuilder, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);

      const rptContract = new Contract("CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ");
      const toScVal = new Address(wallet).toScVal();
      const amountScVal = nativeToScVal(Number(amount), { type: "i128" } as any);

      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(rptContract.call("mint", toScVal, amountScVal))
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      const simStr = JSON.stringify(sim);
      if (simStr.includes("trustline entry is missing")) {
        throw new Error(`Wallet ${formatAddress(wallet, 8)} has no RPT trustline. Ask them to create it on the Citizen page first.`);
      }
      if (simStr.includes("Error")) {
        throw new Error(`Simulation failed: ${simStr.slice(0, 200)}`);
      }
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (signedResp?.error) {
        throw new Error(signedResp.error.message || "Freighter signing failed");
      }

      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      const result = await server.sendTransaction(signedTx);

      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        setMessage({ text: `Minted ${amount} RPT to ${formatAddress(wallet, 8)}! Tx: ${result.hash.slice(0, 10)}...`, ok: true });
        setRecentMints((prev) => [{ to: wallet, amount }, ...prev].slice(0, 5));
        setWallet("");
        setTimeout(onDone, 2000);
      } else {
        throw new Error(`Transaction status: ${result.status}`);
      }
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}. Did you sign in Freighter?`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <p className="text-sm text-gray-400 mb-4">Mint RPT to any wallet that has a trustline. Wallet must create trustline first via the Citizen page.</p>
      <form className="space-y-4" onSubmit={handleMint}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Wallet (G...)</label>
            <input type="text" value={wallet} onChange={(e) => setWallet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500"
              placeholder="G..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              min="1" required />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
            {submitting ? "Opening Freighter..." : "Mint RPT"}
          </button>
        </form>

      {recentMints.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="p-4 font-semibold border-b border-gray-100">Recent Mints (This Session)</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">To</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentMints.map((m, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{formatAddress(m.to, 8)}</td>
                  <td className="px-4 py-2 font-medium text-purple-600">{m.amount} RPT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DisputeResolution() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { Client: EscClient } = await import("../contracts/escrow/src");
        const client = new EscClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_escrow_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_escrow({ escrow_id: i });
            if (r.result && (r.result as any).status.tag === "Disputed") {
              list.push(r.result);
            }
          } catch {}
        }
        setEscrows(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4"><p className="stat-label">Disputed Escrows</p><p className="stat-value text-yellow-600">{escrows.length}</p></div>
        <div className="card p-4"><p className="stat-label">Total in Dispute</p><p className="stat-value text-slate-900">{getCurrency()}{(escrows.reduce((s: number, e: any) => s + Number(e.amount), 0) / PPHP_SCALE / 1_000_000).toFixed(1)}M</p></div>
        <div className="card p-4"><p className="stat-label">Resolution</p><p className="stat-value text-gray-400">Refund only</p></div>
      </div>
      {escrows.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No disputed escrows. Anti-corruption agency can file disputes.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">PVO</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Funder</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr></thead>
            <tbody>
              {escrows.map((e: any) => (
                <tr key={Number(e.id)} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs">#{Number(e.id)}</td>
                  <td className="px-4 py-3">#{Number(e.pvo_id)}</td>
                  <td className="px-4 py-3 font-medium">{getCurrency()}{(Number(e.amount) / PPHP_SCALE).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs"><WalletAddress addr={e.funder} chars={4}/></td>
                  <td className="px-4 py-3"><span className="badge badge-red">Disputed</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SystemHealthMonitor() {
  const health: SystemHealth[] = [
    { label: "PVO Core Contract", value: "v0.1.0", status: "healthy" },
    { label: "Escrow Contract", value: "v0.1.0", status: "healthy" },
    { label: "Reputation Ledger", value: "v0.1.0", status: "healthy" },
    { label: "Community Oracle", value: "v0.1.0", status: "healthy" },
    { label: "Access Control", value: "v0.1.0", status: "healthy" },
    { label: "Audit Trail", value: "v0.1.0", status: "healthy" },
    { label: "Value Score", value: "v0.1.0", status: "healthy" },
    { label: "Testnet RPC", value: "soroban-testnet.stellar.org", status: "healthy" },
  ];

  const colors = { healthy: "bg-green-100 text-green-700", warning: "bg-yellow-100 text-yellow-700", error: "bg-red-100 text-red-700" };
  const dots = { healthy: "bg-green-500", warning: "bg-yellow-500", error: "bg-red-500" };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold">System Status</h3>
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          All Systems Operational
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {health.map((h) => (
            <tr key={h.label} className="border-t border-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{h.label}</td>
              <td className="px-4 py-3 text-gray-500">{h.value}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded ${colors[h.status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dots[h.status]}`} />
                  {h.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
        Last checked: {new Date().toLocaleString()}
      </div>
    </div>
  );
}

function ContractUpgrade() {
  const contracts = [
    { name: "access_control", wasm: "access_control.wasm", version: "v0.1.0" },
    { name: "audit_trail", wasm: "audit_trail.wasm", version: "v0.1.0" },
    { name: "community_oracle", wasm: "community_oracle.wasm", version: "v0.1.0" },
    { name: "escrow", wasm: "escrow.wasm", version: "v0.1.0" },
    { name: "pvo_core", wasm: "pvo_core.wasm", version: "v0.1.0" },
    { name: "reputation", wasm: "reputation.wasm", version: "v0.1.0" },
    { name: "value_score", wasm: "value_score.wasm", version: "v0.1.0" },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        ⚠️ Contract upgrades on Stellar require deploying a new WASM to a new contract ID.
        Existing storage is NOT automatically migrated.
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contract</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">WASM</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Version</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.name} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.wasm}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">{c.version}</span></td>
                <td className="px-4 py-3">
                  <button className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Upgrade</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Run `stellar contract build` then `stellar contract deploy` to upgrade contracts.</p>
    </div>
  );
}

function SettingsTab() {
  const [currency, setCur] = useState(() => {
    try { return localStorage.getItem("popv_currency") || "₱"; } catch { return "₱"; }
  });

  const changeCurrency = (sym: string) => {
    setCur(sym);
    try { localStorage.setItem("popv_currency", sym); } catch {}
  };

  return (
    <div className="card p-6 max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">🌐 Currency Symbol</h2>
        <p className="text-sm text-slate-500 mb-4">Customize the currency symbol shown across all dashboards.</p>
        <div className="flex gap-2 flex-wrap">
          {["₱", "$", "€", "£", "¥", "₿"].map(sym => (
            <button key={sym} onClick={() => changeCurrency(sym)}
              className={`px-5 py-3 rounded-xl text-xl font-medium transition-all duration-200 ${
                currency === sym ? "bg-brand-600 text-white shadow-lg scale-110" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}>
              {sym}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Current: <strong className="text-brand-600">{currency}</strong> · Saved in browser</p>
      </div>
    </div>
  );
}

function PledgeManager() {
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState("56"); // ₱56 per $1 USD
  const [busy, setBusy] = useState<number | null>(null);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      try {
        const { Client } = await import("../contracts/grant_commitment/src");
        const gc = new Client({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await gc.get_all_grants();
        setPledges((result.result || []).filter((g: any) => (g.status as any)?.tag === "Committed" || g.status === "Committed"));
      } catch (e) { console.error("PledgeManager:", e); } finally { setLoading(false); }
    })();
  }, []);

  const handleConvert = async (pledge: any) => {
    setBusy(pledge.id);
    try {
      const { TransactionBuilder, Contract, Address, rpc, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const FUNDING = "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO";
      const pphpAmount = Math.round(Number(pledge.amount) * Number(rate) * 10_000_000);

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount("GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
      const sacContract = new Contract("CCJRBA36WHKFDUJMNW2BPP7OYHNUJHJ4MYAQW4ORCTF2IEIOWW5ZA32X");

      // Mint SAC pPHP to funding agency
      const mintOp = sacContract.call("mint", new Address(FUNDING).toScVal(), new ScInt(pphpAmount).toI128());

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })

      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);

      setPledges(prev => prev.filter(p => p.id !== pledge.id));
      alert(`Minted ${(pphpAmount/10_000_000).toLocaleString()} pPHP to Funding Agency`);
    } catch (e: any) {
      alert("Error: " + (e.message || e).slice(0, 200));
    } finally { setBusy(null); }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Loading pledges...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="text-sm text-slate-600">Exchange Rate ({currency} per $1)</label>
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} className="input w-24 ml-2" />
        </div>
      </div>
      {pledges.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No pending pledges to convert.</div>
      ) : (
        <div className="space-y-3">
          {pledges.map((p: any) => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{p.org_name} — PVO #{p.pvo_id}</p>
                <p className="text-sm text-slate-500">{p.currency} {Number(p.amount).toLocaleString()} ≈ {((Number(p.amount) * Number(rate))).toLocaleString()} pPHP</p>
              </div>
              <button onClick={() => handleConvert(p)} className="btn-primary text-xs px-3 py-1.5">
                💸 Convert &amp; Mint
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PledgeManager() {
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 56, EUR: 61, JPY: 0.37, GBP: 72 });
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { Client } = await import("../contracts/grant_commitment/src");
        const gc = new Client({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await gc.get_all_grants();
        setPledges((result.result || []).filter((g: any) => (g.status as any)?.tag === "Committed" || g.status === "Committed"));
      } catch (e) { console.error("PledgeManager:", e); } finally { setLoading(false); }
    })();
    (async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/PHP");
        const data = await res.json();
        if (data.rates) {
          setRates({ USD: +(1 / data.rates.USD).toFixed(2), EUR: +(1 / data.rates.EUR).toFixed(2), JPY: +(1 / data.rates.JPY).toFixed(4), GBP: +(1 / data.rates.GBP).toFixed(2) });
        }
      } catch {}
    })();
  }, []);

  const handleConvert = async (pledge: any) => {
    setBusy(pledge.id);
    try {
      const { TransactionBuilder, Contract, Address, rpc, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const FUNDING = "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO";
      const rate = rates[pledge.currency] || 56;
      const pphpValue = Math.round(Number(pledge.amount) * rate * 10_000_000);
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount("GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
      const sacContract = new Contract("CCJRBA36WHKFDUJMNW2BPP7OYHNUJHJ4MYAQW4ORCTF2IEIOWW5ZA32X");
      const mintOp = sacContract.call("mint", new Address(FUNDING).toScVal(), new ScInt(pphpValue).toI128());
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(mintOp).setTimeout(30).build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setPledges(prev => prev.filter(p => p.id !== pledge.id));
      alert("Minted " + (pphpValue/10_000_000).toLocaleString() + " pPHP to Funding Agency");
    } catch (e: any) { alert("Error: " + (e.message || e).slice(0, 200)); } finally { setBusy(null); }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Loading pledges...</div>;
  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-2 text-xs text-slate-500">
        {Object.entries(rates).map(([cur, r]) => (<span key={cur} className="bg-slate-50 px-2 py-1 rounded">{cur}/PHP: ₱{r}</span>))}
        <span className="text-slate-400 italic">Live rates</span>
      </div>
      {pledges.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No pending pledges to convert.</div>
      ) : (
        <div className="space-y-3">
          {pledges.map((p: any) => {
            const r = rates[p.currency] || 56;
            const pesos = Math.round(Number(p.amount) * r);
            return (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div><p className="font-semibold text-slate-900">{p.org_name} — PVO #{p.pvo_id}</p>
                  <p className="text-sm text-slate-500">{p.currency} {Number(p.amount).toLocaleString()} · @₱{r}/{p.currency} ≈ ₱{pesos.toLocaleString()}</p></div>
                <button onClick={() => handleConvert(p)} disabled={busy === p.id} className="btn-primary text-xs px-3 py-1.5">{busy === p.id ? "Minting..." : "💸 Convert & Mint"}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
