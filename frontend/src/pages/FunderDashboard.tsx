import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as EscrowClient, type Escrow as ChainEscrow } from "../contracts/escrow/src";
import { CreatePphpTrustline } from "../components/CreatePphpTrustline";
import { Client as GrantClient } from "../contracts/grant_commitment/src";
import { Modal } from "../components/Modal";

type EscrowStatus =
  | "Created" | "Funded" | "EngineerApproved" | "AIValidated"
  | "CompliancePassed" | "OracleValidated" | "CommunityVerified" | "Ready" | "Released" | "Refunded" | "Disputed";

function statusFromChain(s: any): EscrowStatus {
  if (s && typeof s === "object" && s.tag) return s.tag as EscrowStatus;
  if (typeof s === "string") return s as EscrowStatus;
  return "Created";
}

function escrowFromChain(e: ChainEscrow): EscrowData {
  return {
    id: Number(e.id),
    pvoId: Number(e.pvo_id),
    milestoneId: Number(e.milestone_id),
    funder: e.funder,
    recipient: e.recipient,
    amount: Number(e.amount),
    tokenAddress: (e as any).token_address || "",
    status: statusFromChain(e.status),
    engineerApproval: e.conditions.engineer_approval,
    aiRiskCheck: e.conditions.ai_risk_check,
    complianceValidation: e.conditions.compliance_validation,
    oracleApproval: (e.conditions as any).community_oracle_validation,
    communityConfirmation: Number(e.conditions.community_confirmation),
    communityRequired: Number(e.conditions.community_required),
    createdAt: Number(e.created_at),
    releasedAt: Number(e.released_at),
  };
}

interface EscrowData {
  id: number;
  pvoId: number;
  milestoneId: number;
  funder: string;
  recipient: string;
  amount: number;
  tokenAddress: string;
  status: EscrowStatus;
  engineerApproval: boolean;
  aiRiskCheck: boolean;
  complianceValidation: boolean;
  oracleApproval: boolean;
  communityConfirmation: number;
  communityRequired: number;
  createdAt: number;
  releasedAt: number;
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function FunderDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"escrows" | "commitments" | "guide">("escrows");
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createModal, setCreateModal] = useState(false);

  const loadEscrows = useCallback(async () => {
    setLoading(true);
    try {
      const client = new EscrowClient({
        contractId: CONTRACT_IDS.escrow,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const countResult = await client.get_escrow_count();
      const count = Number(countResult.result);
      const all: EscrowData[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const result = await client.get_escrow({ escrow_id: i });
          if (result.result) {
            all.push(escrowFromChain(result.result));
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
  }, []);

  useEffect(() => { loadEscrows(); }, [loadEscrows, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">💰</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to manage escrow funding.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Funding Agency Dashboard</h1>
          <p className="text-slate-500 mt-1">On-chain escrow management with 5-gate release conditions.</p>
          <CreatePphpTrustline address={address!} />
        </div>
        <button onClick={refresh} disabled={loading}
          className="btn-secondary text-xs px-3 py-2">
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
        <button onClick={() => setCreateModal(true)} className="btn-primary text-xs px-4 py-2">
          ➕ Create Escrow
        </button>
      </div>

      <div className="flex gap-1 mb-6 mt-4 border-b border-slate-200">
        {(["escrows", "commitments", "guide"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "escrows" && `🔒 Escrows (${escrows.length})`}
            {tab === "commitments" && "🌍 Donor Commitments"}
            {tab === "guide" && "📖 How It Works"}
          </button>
        ))}
      </div>

      {activeTab === "escrows" && <EscrowList escrows={escrows} loading={loading} address={address!} onAction={refresh} />}
      {activeTab === "commitments" && <DonorCommitmentsTab />}
      {activeTab === "guide" && <EscrowGuide />}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Escrow">
        <CreateEscrowForm address={address!} onCreated={() => { refresh(); setCreateModal(false); }} />
      </Modal>
    </div>
  );
}

function EscrowList({ escrows, loading, address, onAction }: {
  escrows: EscrowData[]; loading: boolean; address: string; onAction: () => void;
}) {
  const currency = getCurrency();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="card p-5 skeleton h-48" />)}
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="font-semibold text-slate-700 mb-1">No escrows yet</h3>
        <p className="text-sm text-slate-400">Create an escrow to start tracking funded milestones.</p>
      </div>
    );
  }

  const totalAmount = escrows.reduce((s, e) => s + e.amount, 0);
  const fundedAmount = escrows.filter(e => e.status !== "Created").reduce((s, e) => s + e.amount, 0);
  const releasedAmount = escrows.filter(e => e.status === "Released").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Escrows", value: String(escrows.length), color: "text-slate-900" },
          { label: "Total Value", value: `${currency}${(totalAmount / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-blue-600" },
          { label: "Funded", value: `${currency}${(fundedAmount / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-brand-600" },
          { label: "Released", value: `${currency}${(releasedAmount / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-emerald-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {escrows.map(e => (
          <EscrowCard key={e.id} escrow={e} currency={currency} address={address} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<EscrowStatus, string> = {
  Created: "badge-amber", Funded: "badge-blue", EngineerApproved: "badge-purple",
  AIValidated: "badge-purple", CompliancePassed: "badge-purple", OracleValidated: "badge-purple",
  CommunityVerified: "badge-purple",
  Ready: "badge-green", Released: "badge-green", Refunded: "badge-red", Disputed: "badge-red",
};

function EscrowCard({ escrow, currency, address, onAction }: {
  escrow: EscrowData; currency: string; address: string; onAction: () => void;
}) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [pphpBalance, setPphpBalance] = useState<bigint | null>(null);

  const isFunder = escrow.funder === address;

  // Check funder's pPHP balance for the "Fund Escrow" button
  useEffect(() => {
    if (!isFunder || escrow.status !== "Created") return;
    (async () => {
      try {
        const { Contract, Address, rpc, TransactionBuilder, scValToBigInt } = await import("@stellar/stellar-sdk");
        const server = new rpc.Server(RPC_URL);
        const contract = new Contract(CONTRACT_IDS.pphp_sac);
        const account = await server.getAccount(address);
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(contract.call("balance", new Address(address).toScVal()))
          .setTimeout(30).build();
        const resp = await server.simulateTransaction(tx);
        if (!resp.error && resp.result?.retval) {
          setPphpBalance(scValToBigInt(resp.result.retval));
        }
      } catch {}
    })();
  }, [isFunder, escrow.status, address]);

  const balanceUnits = pphpBalance !== null ? Number(pphpBalance) : null;
  const hasEnough = balanceUnits !== null && balanceUnits >= escrow.amount;

  const gates = [
    { label: "Engineer", done: escrow.engineerApproval },
    { label: "AI Risk", done: escrow.aiRiskCheck },
    { label: "Compliance", done: escrow.complianceValidation },
    { label: "Oracle", done: (escrow as any).oracleApproval },
    { label: `Community (${escrow.communityConfirmation}/${escrow.communityRequired})`, done: escrow.communityConfirmation >= escrow.communityRequired },
  ];
  const gatesPassed = gates.filter(g => g.done).length;

  const sendTx = async (fnName: string, fnArgs: any[]) => {
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call(fnName, ...fnArgs);

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
      setTxMsg("Transaction confirmed!");
      setTimeout(() => onAction(), 3000);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const handleFund = async () => {
    const { Address, xdr, nativeToScVal } = await import("@stellar/stellar-sdk");
    await sendTx("fund_escrow", [
      new Address(address).toScVal(),
      xdr.ScVal.scvU32(escrow.id),
      nativeToScVal(escrow.amount, { type: "i128" }),
    ]);
  };

  const handleRelease = async () => {
    const { Address, xdr } = await import("@stellar/stellar-sdk");
    await sendTx("release", [new Address(address).toScVal(), xdr.ScVal.scvU32(escrow.id)]);
  };

  const handleDispute = async () => {
    const { Address, xdr } = await import("@stellar/stellar-sdk");
    await sendTx("dispute", [new Address(address).toScVal(), xdr.ScVal.scvU32(escrow.id)]);
  };

  const handleRefund = async () => {
    const { Address, xdr } = await import("@stellar/stellar-sdk");
    await sendTx("refund", [new Address(address).toScVal(), xdr.ScVal.scvU32(escrow.id)]);
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <div className="card p-5">
      {txMsg && (
        <div className={`mb-3 p-3 rounded-xl text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" && "✅ "}{txMsg}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">Escrow #{escrow.id}</h3>
            <span className={`badge ${STATUS_COLORS[escrow.status]}`}>{escrow.status.replace(/([A-Z])/g, " $1").trim()}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            PVO #{escrow.pvoId} · Milestone #{escrow.milestoneId} · {currency}{(escrow.amount / PPHP_SCALE).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Funder: <WalletAddress addr={escrow.funder} chars={4}/>{isFunder && " (You)"}</p>
          <p>Recipient: <WalletAddress addr={escrow.recipient} chars={4}/></p>
        </div>
      </div>

      {/* 5-Gate Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500 font-medium">Release Gates</span>
          <span className="text-slate-400">{gatesPassed}/5 passed</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {gates.map((gate, i) => (
            <div key={i} className={`rounded-lg p-2 text-center text-xs font-medium border ${
              gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="text-base mb-0.5">{gate.done ? "✓" : "○"}</div>
              {gate.label}
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        {escrow.status === "Created" && isFunder && (
          <>
            <button onClick={handleFund} disabled={busy || (pphpBalance !== null && !hasEnough)}
              className={`text-xs px-4 py-2 ${pphpBalance !== null && !hasEnough ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}
              title={pphpBalance !== null && !hasEnough ? `Insufficient pPHP balance. You have ${(balanceUnits! / 10_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})} but need ${(escrow.amount / 10_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}` : ""}>
              {busy ? "Signing..." : `Fund Escrow (${currency}${(escrow.amount / PPHP_SCALE).toLocaleString()})`}
            </button>
            {pphpBalance !== null && !hasEnough && (
              <span className="text-xs text-red-500 self-center">
                ⚠️ Insufficient pPHP — you have {(balanceUnits! / 10_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})} pPHP
              </span>
            )}
          </>
        )}
        {escrow.status === "Ready" && (
          <button onClick={handleRelease} disabled={busy} className="btn-primary text-xs px-4 py-2">
            {busy ? "Releasing..." : "🔓 Release Funds"}
          </button>
        )}
        {escrow.status !== "Released" && escrow.status !== "Refunded" && (
          <button onClick={handleDispute} disabled={busy} className="btn-danger text-xs px-4 py-2">
            ⚠️ Dispute
          </button>
        )}
        {escrow.status === "Disputed" && isFunder && (
          <button onClick={handleRefund} disabled={busy} className="btn-secondary text-xs px-4 py-2">
            ↩️ Refund
          </button>
        )}
        {escrow.status === "Created" && !isFunder && (
          <p className="text-xs text-slate-400 py-2">Only the funder can fund this escrow.</p>
        )}
        {escrow.status === "Released" && (
          <span className="badge-green self-center">✓ Funds released to <WalletAddress addr={escrow.recipient} chars={4}/></span>
        )}
        {busy && <span className="text-xs text-brand-600 self-center animate-pulse">Check Freighter...</span>}
      </div>
    </div>
  );
}

function CreateEscrowForm({ address, onCreated }: { address: string; onCreated: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [pvoId, setPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [amount, setAmount] = useState("");
  const [communityRequired, setCommunityRequired] = useState("1");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const currency = getCurrency();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be positive");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call("create_escrow",
        new Address(address).toScVal(),
        new Address(recipient).toScVal(),
        xdr.ScVal.scvU32(Number(pvoId)),
        xdr.ScVal.scvU32(Number(milestoneId)),
        nativeToScVal(amt, { type: "i128" }),
        new Address(CONTRACT_IDS.pphp).toScVal(),
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
      setTxMsg("Escrow created! Loading...");
      setRecipient(""); setPvoId(""); setMilestoneId(""); setAmount("");
      setTimeout(() => onCreated(), 3000);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 200) || "Failed to create escrow");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <>
      {txMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" && "✅ "}{txMsg}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient (Contractor)</label>
            <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} className="input font-mono text-xs"
              placeholder="G..." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
              <input type="number" value={pvoId} onChange={e => setPvoId(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Milestone ID</label>
              <input type="number" value={milestoneId} onChange={e => setMilestoneId(e.target.value)} className="input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (pPHP SAC units)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input"
                placeholder="e.g. 50000000000000 = ₱5,000,000" required />
              <p className="text-xs text-slate-400 mt-1">{amount && Number(amount) > 0 ? `${currency}${(Number(amount) / PPHP_SCALE).toLocaleString()}` : "1 peso = 10,000,000 SAC units"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Community Confirmations Required</label>
              <input type="number" value={communityRequired} onChange={e => setCommunityRequired(e.target.value)} className="input"
                min="1" required />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-700">
              <strong>pPHP Token Escrow:</strong> Escrows are funded in pPHP SAC (7 decimals). 1 peso = 10,000,000 SAC units.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              <strong>Multi-Gate Escrow:</strong> Funds are locked until all 5 gates pass:
              Engineer approval, AI risk check, Compliance validation, Community Oracle, and Community confirmation.
            </p>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full py-3">
            {busy ? "Creating..." : "Create Escrow"}
          </button>
        </form>
      </>
      );
}

function DonorCommitmentsTab() {
  const currency = getCurrency();
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new GrantClient({
          contractId: CONTRACT_IDS.grant_commitment,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const result = await client.get_all_grants();
        const chainGrants = result.result || [];
        setGrants(chainGrants);
      } catch(e){} finally{setLoading(false)}
    })();
    (async()=>{try{const r=await fetch("https://open.er-api.com/v6/latest/PHP");const d=await r.json();if(d.rates)setRates({USD:+(1/d.rates.USD).toFixed(2),EUR:+(1/d.rates.EUR).toFixed(2),JPY:+(1/d.rates.JPY).toFixed(4),GBP:+(1/d.rates.GBP).toFixed(2)})}catch{}})();
  }, []);
      } catch (e) {
        console.error("Failed to load donor commitments:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusTag = (s: any): string => {
    if (s && typeof s === "object" && s.tag) return s.tag;
    if (typeof s === "string") return s;
    return "Unknown";
  };

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (grants.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-slate-700 mb-1">No donor commitments yet</h3>
        <p className="text-sm text-slate-400">When international donors commit grant funding, their pledges appear here.</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="card p-4 bg-brand-50 border-brand-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label">Total Donor Pledges</p>
            <p class="stat-value text-brand-600">{grants.map(g => g.currency + " " + Number(g.amount).toLocaleString()).join(", ") || "None"}</p>
          </div>
          <div className="text-right">
            <p className="stat-label">Active Grants</p>
            <p className="stat-value text-slate-900">{grants.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {grants.map((g: any) => {
          const status = statusTag(g.status);
          const colorClass = status === "Completed" ? "badge-green" :
            status === "Disbursed" ? "badge-blue" :
            status === "Cancelled" ? "badge-red" : "badge-purple";
          return (
            <div key={Number(g.id)} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-400">{g.org_name}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">PVO #{Number(g.pvo_id)}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900">Grant #{Number(g.id)}</h3>
                  <p className="text-sm text-slate-500">{g.currency} {Number(g.amount).toLocaleString()} <span className="text-xs text-slate-400">≈ {currency}{(Math.round(Number(g.amount)*(rates[g.currency]||56))).toLocaleString()} pPHP</span>
                  <p className="text-xs text-slate-400 mt-1">Donor: <WalletAddress addr={g.donor} chars={6}/></p>
                </div>
                <span className={`badge ${colorClass}`}>{status}</span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {status === "Committed" && (
                  <p className="text-xs text-slate-500">Ready for disbursement. Create an escrow to fund this PVO.</p>
                )}
                {status === "Disbursed" && (
                  <p className="text-xs text-blue-600">Funds disbursed into escrow.</p>
                )}
                {status === "Completed" && (
                  <p className="text-xs text-emerald-600">Grant fully completed.</p>
                )}
                {status === "Cancelled" && (
                  <p className="text-xs text-red-500">Grant cancelled by donor.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EscrowGuide() {
  const steps = [
    { n: 0, title: "Donor Commits + Transfers", icon: "🌍", desc: "International donor commits a grant, atomically transferring pPHP to the Funding Agency wallet.", actor: "InternationalDonor" },
    { n: 1, title: "Create Escrow", icon: "📝", desc: "Funder creates an escrow with recipient, PVO, milestone, amount, and required community confirmations.", actor: "FundingAgency" },
    { n: 2, title: "Fund Escrow", icon: "💰", desc: "Funder deposits the exact amount from their pPHP balance. Escrow status changes to Funded.", actor: "FundingAgency" },
    { n: 3, title: "Engineer Approve", icon: "🔧", desc: "Assigned engineer verifies structural quality and approves the milestone.", actor: "Engineer" },
    { n: 4, title: "AI Risk Check", icon: "🤖", desc: "AI oracle validates evidence and assigns a risk score. Must pass.", actor: "AIAuditor" },
    { n: 5, title: "Compliance Validate", icon: "⚖️", desc: "Compliance officer checks regulatory adherence.", actor: "Auditor / COA" },
    { n: 6, title: "Community Oracle", icon: "📊", desc: "Citizen reports from the community oracle verify real-world project existence.", actor: "Citizens" },
    { n: 7, title: "Community Confirm", icon: "📸", desc: "Citizens submit field reports. Must reach the required threshold.", actor: "Citizens" },
    { n: 8, title: "Release or Dispute", icon: "🔓", desc: "Once all gates pass (Ready), anyone can trigger release. Dispute can be raised anytime before release.", actor: "Any Role" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="card p-6 mb-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">5-Gate Escrow System + Donor Funding</h2>
        <p className="text-sm text-slate-500">
          Donors first commit and transfer pPHP to the Funding Agency. Then every escrow passes through 5 independent verification gates before funds can be released.
          This ensures no single party can authorize payment alone — preventing corruption and ensuring quality.
        </p>
      </div>
      <div className="space-y-3">
        {steps.map(step => (
          <div key={step.n} className="card p-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
              {step.n}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{step.icon}</span>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
              </div>
              <p className="text-sm text-slate-600">{step.desc}</p>
            </div>
            <span className="badge badge-purple text-xs shrink-0">{step.actor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
