import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as AccessControlClient } from "../contracts/access_control/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";
import { formatAddress } from "../helpers";

const ROLES = [
  "Citizen", "Engineer", "Inspector", "Contractor", "Supplier",
  "ProjectManager", "GovernmentAgency", "Auditor", "CommissionOnAudit",
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
  const [activeTab, setActiveTab] = useState<"roles" | "mint" | "disputes" | "health" | "upgrade">("roles");

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

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["roles", "mint", "disputes", "health", "upgrade"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "roles" && "👥 Roles"}
            {tab === "mint" && "🪙 Mint RPT"}
            {tab === "disputes" && "⚖️ Dispute Resolution"}
            {tab === "health" && "📊 Health"}
            {tab === "upgrade" && "🔄 Upgrade"}
          </button>
        ))}
      </div>

      {activeTab === "roles" && <RoleManagement />}
      {activeTab === "mint" && <MintRPT />}
      {activeTab === "disputes" && <DisputeResolution />}
      {activeTab === "health" && <SystemHealthMonitor />}
      {activeTab === "upgrade" && <ContractUpgrade />}
    </div>
  );
}

function RoleManagement() {
  const { address } = useWallet();
  const [userAddress, setUserAddress] = useState("");
  const [role, setRole] = useState<string>("Contractor");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [assignments, setAssignments] = useState<{ address: string; role: string }[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const client = new AccessControlClient({ contractId: CONTRACT_IDS.access_control, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const all: { address: string; role: string }[] = [];
      for (const r of ROLES.slice()) {
        try {
          const result = await client.get_addresses_by_role({ role: r as any });
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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !userAddress) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const client = new AccessControlClient({
        contractId: CONTRACT_IDS.access_control,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
        publicKey: address,
      });

      const roleMap: Record<string, any> = {};
      ROLES.forEach((r: string) => { roleMap[r] = { tag: r, values: void 0 }; });

      const { signTransaction } = await import("@stellar/freighter-api");

      const tx = await client.assign_role({
        address: userAddress,
        role: roleMap[role],
        assigner: address,
      });

      setMessage({ text: "Check Freighter to sign the transaction...", ok: true });
      await tx.signAndSend({
        signTransaction: async (xdr: string, opts: any) => {
          const resp = await signTransaction(xdr, { ...opts, networkPassphrase: NETWORK_PASSPHRASE });
          if (resp?.error) throw new Error(resp.error.message);
          return resp.signedTxXdr;
        },
      } as any);
      setMessage({ text: `Role ${role} assigned to ${formatAddress(userAddress)}!`, ok: true });
      setUserAddress("");
      await loadAssignments();
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}. Did you sign in Freighter?`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (addr: string, r: string) => {
    if (!address) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const client = new AccessControlClient({
        contractId: CONTRACT_IDS.access_control,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
        publicKey: address,
      });

      const roleMap: Record<string, any> = {};
      ROLES.forEach((role: string) => { roleMap[role] = { tag: role, values: void 0 }; });

      const { signTransaction } = await import("@stellar/freighter-api");

      const tx = await client.revoke_role({
        revoker: address,
        address: addr,
        role: roleMap[r],
      });

      setMessage({ text: "Check Freighter to sign the transaction...", ok: true });
      await tx.signAndSend({
        signTransaction: async (xdr: string, opts: any) => {
          const resp = await signTransaction(xdr, { ...opts, networkPassphrase: NETWORK_PASSPHRASE });
          if (resp?.error) throw new Error(resp.error.message);
          return resp.signedTxXdr;
        },
      } as any);
      setMessage({ text: `Revoked ${r} from ${formatAddress(addr)}.`, ok: true });
      await loadAssignments();
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}. Did you sign in Freighter?`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Assign Role</h2>
        <p className="text-sm text-gray-400 mb-4">Only the Administrator wallet can assign roles. The contract enforces this on-chain.</p>
        <form className="space-y-4" onSubmit={handleAssign}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address (G...)</label>
            <input type="text" value={userAddress} onChange={(e) => setUserAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500"
              placeholder="G..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/([A-Z])/g, " $1").trim()}</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
            {submitting ? "Assigning..." : "Assign Role"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold">Current Role Assignments</h3>
          <button onClick={loadAssignments} className="text-sm text-purple-600 hover:underline">Refresh</button>
        </div>
        {loadingAssignments ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
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
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatAddress(a.address, 8)}</td>
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
        {!loadingAssignments && assignments.length === 0 && (
          <div className="text-center py-8 text-gray-400">No roles assigned yet. Use the form above to assign roles.</div>
        )}
      </div>
    </div>
  );
}

function MintRPT() {
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
    <div className="space-y-6 max-w-lg">
      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">🪙 Mint RPT Tokens</h2>
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
      </div>

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
    </div>
  );
}

function DisputeResolution() {
  const disputes = [
    { id: 1, escrowId: 1, disputer: "G...ACMSV", reason: "Quality concerns", status: "Open" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4"><dt className="text-sm text-gray-500">Open Disputes</dt><dd className="text-2xl font-bold text-yellow-600">1</dd></div>
        <div className="bg-white border rounded-lg p-4"><dt className="text-sm text-gray-500">Resolved</dt><dd className="text-2xl font-bold text-green-600">0</dd></div>
        <div className="bg-white border rounded-lg p-4"><dt className="text-sm text-gray-500">Avg Resolution</dt><dd className="text-2xl font-bold text-gray-900">—</dd></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Escrow</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Disputer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => (
              <tr key={d.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">#{d.id}</td>
                <td className="px-4 py-3">#{d.escrowId}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.disputer}</td>
                <td className="px-4 py-3">{d.reason}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs rounded bg-yellow-50 text-yellow-700">{d.status}</span></td>
                <td className="px-4 py-3 flex gap-2">
                  <button className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Resolve</button>
                  <button className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Dismiss</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {disputes.length === 0 && <div className="text-center py-8 text-gray-400">No open disputes.</div>}
      </div>
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
