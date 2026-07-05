import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config", { PPHP_SCALE };
import { Client as AuditClient } from "../contracts/audit_trail/src";
import { Client as EscrowClient } from "../contracts/escrow/src";
import { formatAddress, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function AuditorDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"trail" | "approve" | "compliance">("trail");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to audit financial records and verify compliance.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Auditor Dashboard</h1>
      <p className="text-slate-500 mb-6">Audit financial records, verify compliance, and approve escrow Gate 4.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["trail", "approve", "compliance"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "trail" && "📊 Audit Trail"}
            {tab === "approve" && "✅ Compliance Gate"}
            {tab === "compliance" && "⚖️ Violations"}
          </button>
        ))}
      </div>

      {activeTab === "trail" && <AuditTrailTab />}
      {activeTab === "approve" && <ComplianceGateTab address={address!} />}
      {activeTab === "compliance" && <ViolationsTab />}
    </div>
  );
}

function AuditTrailTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new AuditClient({ contractId: CONTRACT_IDS.audit_trail, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_entry_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_entry({ entry_id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        list.reverse();
        setEntries(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (entries.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="font-semibold text-slate-700 mb-1">No audit entries yet</h3>
        <p className="text-sm text-slate-400">Entries appear when milestones are approved, payments released, or disputes resolved.</p>
      </div>
    );
  }

  const catColors: Record<string, string> = {
    Approval: "badge-green", Payment: "badge-blue", EvidenceReview: "badge-purple",
    ComplianceCheck: "badge-amber", AIRiskAssessment: "badge-purple", ProcurementAward: "badge-blue",
    ContractModification: "badge-amber", DisputeResolution: "badge-red", MilestoneRelease: "badge-green",
    RoleChange: "badge-purple",
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Audit Trail ({entries.length} entries)</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">ID</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">PVO</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Actor</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-400">#{Number(e.id)}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">PVO #{Number(e.pvo_id)}</td>
              <td className="px-4 py-3">
                <span className={`badge ${catColors[statusToString(e.category)] || "badge-blue"} text-[10px]`}>
                  {statusToString(e.category)}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs"><WalletAddress addr={e.actor} chars={4}/></td>
              <td className="px-4 py-3 text-xs text-slate-600 max-w-[300px] truncate">{e.rationale || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComplianceGateTab({ address }: { address: string }) {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const client = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await client.get_escrow_count();
      const list: any[] = [];
      for (let i = 1; i <= Number(cnt.result); i++) {
        try {
          const r = await client.get_escrow({ escrow_id: i });
          if (r.result) {
            const e = r.result as any;
            // Show escrows that are funded and AI-validated but not yet compliance-passed
            if (e.conditions.ai_risk_check && !e.conditions.compliance_validation && e.status.tag !== "Created") {
              list.push(e);
            }
          }
        } catch {}
      }
      setEscrows(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="card p-5 skeleton h-32" />)}</div>;

  if (escrows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="font-semibold text-slate-700 mb-1">No escrows awaiting compliance validation</h3>
        <p className="text-sm text-slate-400">Escrows that have passed AI validation and need compliance approval will appear here.</p>
      </div>
    );
  }

  const currency = getCurrency();

  return (
    <div className="space-y-3">
      {escrows.map((e: any) => (
        <EscrowComplianceCard key={Number(e.id)} escrow={e} currency={currency} address={address} onAction={load} />
      ))}
    </div>
  );
}

function EscrowComplianceCard({ escrow, currency, address, onAction }: {
  escrow: any; currency: string; address: string; onAction: () => void;
}) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const escrowId = Number(escrow.id);

  const handleApprove = async (passed: boolean) => {
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);

      const op = contract.call("compliance_validate",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(escrowId),
        xdr.ScVal.scvBool(passed),
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
      setTxMsg(passed ? "Compliance approved! Gate 4 passed." : "Compliance rejected.");
      setTimeout(() => onAction(), 3000);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  const gates = [
    { label: "Engineer", done: escrow.conditions.engineer_approval },
    { label: "AI", done: escrow.conditions.ai_risk_check },
    { label: "Compliance", done: escrow.conditions.compliance_validation },
    { label: "Oracle", done: (escrow.conditions as any).community_oracle_validation || false },
    { label: `Community (${Number(escrow.conditions.community_confirmation)}/${Number(escrow.conditions.community_required)})`, done: Number(escrow.conditions.community_confirmation) >= Number(escrow.conditions.community_required) },
  ];
  const passed = gates.filter(g => g.done).length;

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
            <span className="text-xs text-slate-400 font-mono">Escrow #{escrowId}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">PVO #{Number(escrow.pvo_id)}</span>
          </div>
          <p className="font-semibold text-slate-900">{currency}{(Number(escrow.amount) / PPHP_SCALE).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Recipient: <WalletAddress addr={escrow.recipient} chars={4}/> · Funder: <WalletAddress addr={escrow.funder} chars={4}/>
          </p>
        </div>
        <span className="badge badge-amber">{statusToString(escrow.status)}</span>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {gates.map((gate, i) => (
          <div key={i} className={`rounded-lg p-1.5 text-center text-[11px] font-medium border ${
            gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"
          }`}>
            <div className="text-sm mb-0.5">{gate.done ? "✓" : "○"}</div>
            {gate.label}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">{passed}/5 gates passed</span>
        <div className="flex gap-2">
          <button onClick={() => handleApprove(true)} disabled={busy}
            className="btn-primary text-xs px-4 py-2">
            {busy ? "Signing..." : "✓ Pass Compliance (Gate 4)"}
          </button>
          <button onClick={() => handleApprove(false)} disabled={busy}
            className="btn-danger text-xs px-4 py-2">
            ✗ Reject
          </button>
          {busy && <span className="text-xs text-brand-600 self-center animate-pulse">Check Freighter...</span>}
        </div>
      </div>
    </div>
  );
}

function ViolationsTab() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { Client: ComplianceClient } = await import("../contracts/compliance_engine/src");
        const client = new ComplianceClient({ contractId: CONTRACT_IDS.compliance_engine, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_violation_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_violation({ id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        list.reverse();
        setViolations(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (violations.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">⚖️</div>
        <h3 className="font-semibold text-slate-700 mb-1">No active violations</h3>
        <p className="text-sm text-slate-400">All projects are currently compliant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map((v: any, i: number) => (
        <div key={i} className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">Violation #{Number(v.id)}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">PVO #{Number(v.pvo_id)}</span>
              </div>
              <p className="font-medium text-slate-900">{v.description || "Compliance violation"}</p>
              <p className="text-xs text-slate-400 mt-1">Rule: {v.rule_id || "—"}</p>
            </div>
            <span className="badge badge-red">Active</span>
          </div>
        </div>
      ))}
    </div>
  );
}
