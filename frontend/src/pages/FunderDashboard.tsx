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
  const [activeTab, setActiveTab] = useState<"escrows" | "awarded" | "commitments" | "guide">("escrows");
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createModal, setCreateModal] = useState(false);
  const [prefillPvoId, setPrefillPvoId] = useState<number>(0);
  const [prefillMilestoneId, setPrefillMilestoneId] = useState<number>(0);
  const [prefillAmount, setPrefillAmount] = useState<string>("");
  const [prefillRecipient, setPrefillRecipient] = useState<string>("");

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

      </div>

      <div className="flex gap-1 mb-6 mt-4 border-b border-slate-200">
        {(["escrows", "awarded", "commitments", "guide"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "escrows" && `🔒 Escrows (${escrows.length})`}
            {tab === "awarded" && "📋 Awarded PVOs"}
            {tab === "commitments" && "🌍 Donor Commitments"}
            {tab === "guide" && "📖 How It Works"}
          </button>
        ))}
      </div>

      {activeTab === "escrows" && <EscrowList escrows={escrows} loading={loading} address={address!} onAction={refresh} onCreate={() => { setPrefillPvoId(0); setPrefillMilestoneId(0); setPrefillAmount(""); setPrefillRecipient(""); setCreateModal(true); }} />}
      {activeTab === "awarded" && <AwardedPvosTab key={refreshKey} onCreateEscrow={(pvoId, milestoneId, amount, recipient) => { setPrefillPvoId(pvoId); setPrefillMilestoneId(milestoneId); setPrefillAmount(amount); setPrefillRecipient(recipient); setCreateModal(true); }} existingEscrows={escrows} />}
      {activeTab === "commitments" && <DonorCommitmentsTab key={refreshKey} onCreateEscrow={(pvoId: number) => { setPrefillPvoId(pvoId); setPrefillMilestoneId(0); setPrefillAmount(""); setPrefillRecipient(""); setCreateModal(true); }} />}
      {activeTab === "guide" && <EscrowGuide />}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Escrow">
        <CreateEscrowForm key={`${prefillPvoId}-${prefillMilestoneId}`} address={address!} prefillPvoId={prefillPvoId} prefillMilestoneId={prefillMilestoneId} prefillAmount={prefillAmount} prefillRecipient={prefillRecipient} onCreated={() => { refresh(); setCreateModal(false); setPrefillPvoId(0); setPrefillMilestoneId(0); setPrefillAmount(""); setPrefillRecipient(""); }} />
      </Modal>
    </div>
  );
}

function EscrowList({ escrows, loading, address, onAction, onCreate }: {
  escrows: EscrowData[]; loading: boolean; address: string; onAction: () => void; onCreate: () => void;
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
        <p className="text-sm text-slate-400 mb-4">Select a PVO, choose a milestone, and create an escrow for it.</p>
        <button onClick={onCreate} className="btn-primary px-6 py-3">🔒 Create Escrow</button>
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

      <div className="flex justify-end">
        <button onClick={onCreate} className="btn-primary text-sm px-4 py-2">🔒 Create Escrow</button>
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
  const [rates, setRates] = useState<Record<string, number>>({ USD: 56, EUR: 61, JPY: 0.37, GBP: 72 });
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
        const resp: any = await server.simulateTransaction(tx);
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
    { label: "Compliance", done: escrow.complianceValidation },
    { label: "Oracle", done: (escrow as any).oracleApproval },
    { label: `Community (${escrow.communityConfirmation}/${escrow.communityRequired})`, done: escrow.communityConfirmation >= escrow.communityRequired },
    { label: "AI Risk", done: escrow.aiRiskCheck },
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
      await server.sendTransaction(signedTx);

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

function CreateEscrowForm({ address, prefillPvoId, prefillMilestoneId, prefillAmount, prefillRecipient, onCreated }: { address: string; prefillPvoId?: number; prefillMilestoneId?: number; prefillAmount?: string; prefillRecipient?: string; onCreated: () => void }) {
  const [recipient, setRecipient] = useState(prefillRecipient || "");
  const [pvoId, setPvoId] = useState(String(prefillPvoId || ""));
  const [milestoneId, setMilestoneId] = useState(String(prefillMilestoneId || ""));
  const [amount, setAmount] = useState(prefillAmount || "");
  const [communityRequired, setCommunityRequired] = useState("1");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [grantsF, setGrantsF] = useState<any[]>([]);
  const [pvBudgets, setPvBudgets] = useState<Record<number,number>>({});
  const [pvFundSources, setPvFundSources] = useState<Record<number,string>>({});
  const [pvList, setPvList] = useState<{id:number;title:string;municipality:string;budget:number}[]>([]);
  const [contractors, setContractors] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<{id:number;title:string;budget:number}[]>([]);
  const [showRecipientDd, setShowRecipientDd] = useState(false);
  const [showPvoDd, setShowPvoDd] = useState(false);
  const [showMilestoneDd, setShowMilestoneDd] = useState(false);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      try {
        const { Client: GC } = await import("../contracts/grant_commitment/src");
        const gc = new GC({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        setGrantsF(((await gc.get_all_grants()).result || []));
        const { Client: PC } = await import("../contracts/pvo_core/src");
        const pc = new PC({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await pc.get_pvo_count();
        const b: Record<number,number> = {};
        const pl: {id:number;title:string;municipality:string;budget:number}[] = [];
        const fs: Record<number,string> = {};
        for (let i = 1; i <= Number(cnt.result); i++) { try { const r = await pc.get_pvo({ pvo_id: i }); if (r.result) { b[r.result.id] = Number(r.result.total_budget); fs[r.result.id] = r.result.fund_source || ""; pl.push({id:r.result.id,title:r.result.title,municipality:r.result.municipality,budget:Number(r.result.total_budget)}); } } catch {} }
        setPvBudgets(b); setPvFundSources(fs);
        setPvList(pl);
      } catch {}
      try {
        const { Client: AC } = await import("../contracts/access_control/src");
        const ac = new AC({ contractId: CONTRACT_IDS.access_control, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await ac.get_addresses_by_role({ role: { tag: "Contractor", values: undefined } as any });
        setContractors(result.result || []);
      } catch {}
    })();
  }, []);

  // Fetch milestones when PVO is selected
  useEffect(() => {
    if (!pvoId) { setMilestones([]); return; }
    (async () => {
      try {
        const { Client: PC } = await import("../contracts/pvo_core/src");
        const pc = new PC({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await pc.get_pvo_milestones({ pvo_id: Number(pvoId) });
        const ml = (result.result || []).map((m: any) => ({ id: Number(m.id), title: m.title || "", budget: Number(m.budget) }));
        setMilestones(ml);
      } catch { setMilestones([]); }
    })();
  }, [pvoId]);

  const filteredContractors = contractors.filter(c => c.toLowerCase().includes(recipient.toLowerCase()));
  const filteredPvos = pvList.filter(p => !pvoId || p.title.toLowerCase().includes(pvoId.toLowerCase()) || String(p.id).includes(pvoId));
  const filteredMilestones = milestones.filter(m => !milestoneId || m.title.toLowerCase().includes(milestoneId.toLowerCase()) || String(m.id).includes(milestoneId));

  const pvoGrants = grantsF.filter((g: any) => Number(g.pvo_id) === Number(pvoId));
  const pledged = pvoGrants.reduce((s: number, g: any) => s + Number(g.amount), 0);
  const budget = pvBudgets[Number(pvoId)] || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((pledged / budget) * 100)) : 0;
  const fundSource = pvFundSources[Number(pvoId)] || "";
  const isDonorFunded = fundSource.toLowerCase().includes("donor") || fundSource.toLowerCase().includes("international");
  const amountSAC = Number(amount) * PPHP_SCALE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be positive");
      const amtSAC = Math.round(amt * PPHP_SCALE);

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call("create_escrow",
        new Address(address).toScVal(),
        new Address(recipient).toScVal(),
        xdr.ScVal.scvU32(Number(pvoId)),
        xdr.ScVal.scvU32(Number(milestoneId)),
        nativeToScVal(amtSAC, { type: "i128" }),
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
      await server.sendTransaction(signedTx);

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
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient (Contractor)</label>
            <input type="text" value={recipient} onChange={e => { setRecipient(e.target.value); setShowRecipientDd(true); }}
              onFocus={() => setShowRecipientDd(true)}
              onBlur={() => setTimeout(() => setShowRecipientDd(false), 200)}
              className="input font-mono text-xs" placeholder="Search contractor address..." required />
            {showRecipientDd && filteredContractors.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredContractors.slice(0, 8).map(c => (
                  <button key={c} type="button" onMouseDown={() => { setRecipient(c); setShowRecipientDd(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-brand-50 border-b border-slate-100 last:border-b-0">
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
              <input type="text" value={pvoId} onChange={e => { setPvoId(e.target.value); setShowPvoDd(true); }}
                onFocus={() => { if (!prefillPvoId) setShowPvoDd(true); }}
                onBlur={() => setTimeout(() => setShowPvoDd(false), 200)}
                className="input" placeholder="Search by ID or title…" readOnly={!!prefillPvoId} required />
              {!prefillPvoId && showPvoDd && filteredPvos.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredPvos.slice(0, 10).map(p => (
                    <button key={p.id} type="button" onMouseDown={() => { setPvoId(String(p.id)); setShowPvoDd(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-slate-100 last:border-b-0">
                      <span className="text-sm font-medium text-slate-900">#{p.id} {p.title}</span>
                      <span className="text-xs text-slate-400 ml-2">{p.municipality}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Milestone ID</label>
              <input type="text" value={milestoneId} onChange={e => { setMilestoneId(e.target.value); setShowMilestoneDd(true); }}
                onFocus={() => { if (!prefillMilestoneId) setShowMilestoneDd(true); }}
                onBlur={() => setTimeout(() => setShowMilestoneDd(false), 200)}
                className="input" placeholder={pvoId ? "Select milestone..." : "Select PVO first"} disabled={!pvoId} readOnly={!!prefillMilestoneId} required />
              {showMilestoneDd && filteredMilestones.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredMilestones.slice(0, 10).map(m => (
                    <button key={m.id} type="button" onMouseDown={() => { setMilestoneId(String(m.id)); setShowMilestoneDd(false); if (m.budget > 0) setAmount(String(m.budget / PPHP_SCALE)); }}
                      className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-slate-100 last:border-b-0">
                      <span className="text-sm font-medium text-slate-900">#{m.id} {m.title}</span>
                      <span className="text-xs text-slate-400 ml-2">{m.budget > 0 ? `${currency}${(m.budget / PPHP_SCALE).toLocaleString()}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {pvoId && budget > 0 && isDonorFunded && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500">Pledged: {currency}{(pledged / PPHP_SCALE).toLocaleString()} / {currency}{(budget / PPHP_SCALE).toLocaleString()}</span>
                <span className={`font-semibold ${pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: pct + "%" }} />
              </div>
              {amountSAC > 0 && amountSAC > pledged && (
                <p className="text-red-600 mt-1">⚠️ Escrow ({currency}{Number(amount).toLocaleString()}) exceeds pledged ({currency}{(pledged / PPHP_SCALE).toLocaleString()})</p>
              )}
            </div>
          )}
          {pvoId && budget > 0 && !isDonorFunded && (
            <div className="bg-blue-50 rounded-xl p-3 text-xs">
              <span className="text-blue-600"><strong>National Budget PVO</strong> — funded directly by the government, no donor pledges needed.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (in Pesos)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input"
                placeholder="e.g. 5000000 for ₱5,000,000" required />
              <p className="text-xs text-slate-400 mt-1">{amount && Number(amount) > 0 ? `${currency}${Number(amount).toLocaleString()} = ${(Number(amount) * PPHP_SCALE).toLocaleString(undefined, {maximumFractionDigits: 0})} SAC units` : "Enter amount in pesos"}</p>
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

function AwardedPvosTab({ onCreateEscrow, existingEscrows }: {
  onCreateEscrow: (pvoId: number, milestoneId: number, amount: string, recipient: string) => void;
  existingEscrows: EscrowData[];
}) {
  const currency = getCurrency();
  const [loading, setLoading] = useState(true);
  const [awardedPvos, setAwardedPvos] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [milestoneCache, setMilestoneCache] = useState<Record<number, any[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const { Client: PM } = await import("../contracts/procurement_market/src");
        const pm = new PM({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const tCount = await pm.get_tender_count();
        const awardedPvoIds = new Set<number>();
        const contractorMap: Record<number, string> = {};
        for (let i = 1; i <= Number(tCount.result); i++) {
          try {
            const tr = await pm.get_tender({ id: i });
            if (tr.result && tr.result.status?.tag === "Awarded" && tr.result.winner) {
              awardedPvoIds.add(Number(tr.result.pvo_id));
              contractorMap[Number(tr.result.pvo_id)] = tr.result.winner;
            }
          } catch {}
        }
        if (awardedPvoIds.size === 0) { setAwardedPvos([]); return; }
        const { Client: PC } = await import("../contracts/pvo_core/src");
        const pc = new PC({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const list: any[] = [];
        for (const pid of awardedPvoIds) {
          try {
            const r = await pc.get_pvo({ pvo_id: pid });
            if (r.result) {
              const pvo = r.result as any;
              pvo.contractor = contractorMap[pid] || pvo.contractor;
              list.push(pvo);
            }
          } catch {}
        }
        setAwardedPvos(list);
      } catch (e) { console.error("Failed to load awarded PVOs:", e); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleExpand = async (pvoId: number) => {
    if (expandedId === pvoId) { setExpandedId(null); return; }
    setExpandedId(pvoId);
    if (!milestoneCache[pvoId]) {
      try {
        const { Client: PC } = await import("../contracts/pvo_core/src");
        const pc = new PC({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await pc.get_pvo_milestones({ pvo_id: pvoId });
        const milestones = (result.result || []).map((m: any) => ({
          id: Number(m.id), title: m.title || "", description: m.description || "", budget: Number(m.budget),
          status: m.status?.tag || "Pending",
        }));
        setMilestoneCache(prev => ({ ...prev, [pvoId]: milestones }));
      } catch { setMilestoneCache(prev => ({ ...prev, [pvoId]: [] })); }
    }
  };

  const hasEscrow = (pvoId: number, milestoneId: number) =>
    existingEscrows.some(e => e.pvoId === pvoId && e.milestoneId === milestoneId);

  if (loading) return <div className="text-center py-10 text-slate-400">Loading awarded PVOs...</div>;

  if (awardedPvos.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-slate-700 mb-1">No awarded PVOs yet</h3>
        <p className="text-sm text-slate-400">PVOs with contractors assigned through bidding will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {awardedPvos.map(pvo => {
        const pvoId = Number(pvo.id);
        const isExpanded = expandedId === pvoId;
        const milestones = milestoneCache[pvoId] || [];
        const totalMs = milestones.length;
        const escrowedMs = milestones.filter(m => hasEscrow(pvoId, m.id)).length;
        return (
          <div key={pvoId} className="card overflow-hidden">
            <button onClick={() => toggleExpand(pvoId)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400 font-mono">PVO #{pvoId}</span>
                  <span className="badge-green text-xs">Contractor Assigned</span>
                </div>
                <h3 className="font-semibold text-slate-900">{pvo.title}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span>{currency}{(Number(pvo.total_budget) / PPHP_SCALE).toLocaleString()}</span>
                  <span>{pvo.municipality || pvo.department}</span>
                  <span>Contractor: <WalletAddress addr={pvo.contractor} chars={6} /></span>
                  {totalMs > 0 && <span className="text-slate-400">{escrowedMs}/{totalMs} milestones escrowed</span>}
                </div>
              </div>
              <div className="text-2xl text-slate-400">{isExpanded ? "▾" : "▸"}</div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50">
                {milestones.length === 0 ? (
                  <p className="text-sm text-slate-400 p-4 text-center">No milestones defined for this PVO.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {milestones.map((m: any) => {
                      const escrowed = hasEscrow(pvoId, m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">Milestone #{m.id}: {m.title}</span>
                              {escrowed && <span className="badge-blue text-xs">Escrowed</span>}
                            </div>
                            <span className="text-xs text-slate-400">
                              {m.description && `${m.description} · `}
                              {currency}{(m.budget / PPHP_SCALE).toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => onCreateEscrow(pvoId, m.id, String(m.budget / PPHP_SCALE), pvo.contractor)}
                            disabled={escrowed}
                            className={`text-xs px-4 py-2 ${escrowed ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}>
                            {escrowed ? "✓ Escrowed" : "🔒 Escrow"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DonorCommitmentsTab({ onCreateEscrow }: { onCreateEscrow: (pvoId: number) => void }) {
  const currency = getCurrency();
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

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
        chainGrants.sort((a: any, b: any) => {
          const order = (s: string) => s === "Committed" ? 0 : s === "Disbursed" ? 1 : 2;
          const aOrd = order(a.status?.tag || a.status);
          const bOrd = order(b.status?.tag || b.status);
          return aOrd - bOrd || Number(b.id) - Number(a.id);
        });
        setGrants(chainGrants);
      } catch(e){} finally{setLoading(false)}
    })();
  }, [refreshKey]);

  const [pvoBudgets, setPvoBudgets] = useState<Record<number, string>>({});
  useEffect(() => { (async () => { try { const { Client } = await import("../contracts/pvo_core/src"); const pc = new Client({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL }); const cnt = await pc.get_pvo_count(); const b: Record<number,string>={}; for(let i=1;i<=Number(cnt.result);i++){ try{const r=await pc.get_pvo({pvo_id:i}); if(r.result) b[r.result.id]=String(r.result.total_budget); }catch{}} setPvoBudgets(b); }catch{}})(); }, []);

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
            <p className="stat-value text-brand-600">{currency}{(grants.reduce((sum: number, g: any) => sum + Number(g.amount), 0) / PPHP_SCALE).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} className="text-xs text-brand-600 hover:underline">↻ Refresh</button>
            <span className="stat-value text-slate-900">{grants.length}</span>
            <span className="stat-label">grants</span>
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
                  <p className="text-sm text-slate-500">{currency}{(Number(g.amount) / PPHP_SCALE).toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Donor: <WalletAddress addr={g.donor} chars={6}/></p>
                </div>
                <span className={`badge ${colorClass}`}>{status}</span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {(status === "Committed" || status === "Disbursed") && (
                  <div className="flex items-center gap-3 w-full">
                    <div>
                      {status === "Committed" && (
                        <p className="text-xs text-purple-600 font-medium">Donor pledged — awaiting admin mint</p>
                      )}
                      {status === "Disbursed" && (
                        <p className="text-xs text-blue-600 font-medium">pPHP minted to funding agency — ready for escrow</p>
                      )}
                      <p className="text-xs text-slate-500">Pledged: {currency}{(Number(g.amount) / PPHP_SCALE).toLocaleString()} / Budget: {pvoBudgets[Number(g.pvo_id)] ? currency + (Number(pvoBudgets[Number(g.pvo_id)]) / PPHP_SCALE).toLocaleString() : "..."}</p>
                    </div>
                    <button onClick={() => onCreateEscrow(Number(g.pvo_id))} className="btn-primary text-xs px-3 py-1 ml-auto">
                      ➕ Create Escrow
                    </button>
                  </div>
                )}
                {status === "Completed" && (
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">All gates passed, payment released</p>
                    <p className="text-xs text-slate-400 mt-0.5">Escrow released funds to the contractor after all 5 gates passed. The PVO milestone is complete. This grant is fully settled.</p>
                  </div>
                )}
                {status === "Cancelled" && (
                  <div>
                    <p className="text-xs text-red-500 font-medium">Grant revoked before disbursement</p>
                    <p className="text-xs text-slate-400 mt-0.5">The donor cancelled this commitment. Funds were never locked in escrow. The PVO budget slot is available again for another donor.</p>
                  </div>
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
    { n: 1, title: "Create Escrow", icon: "📝", desc: "Funder creates an escrow with recipient, PVO, milestone, amount, and sets the Community Confirmations Required threshold — the number of verified citizen GPS field reports needed to unlock the final gate.", actor: "FundingAgency" },
    { n: 2, title: "Fund Escrow", icon: "💰", desc: "Funder deposits the exact amount from their pPHP balance. Escrow status changes to Funded.", actor: "FundingAgency" },
    { n: 3, title: "Engineer Approve", icon: "🔧", desc: "Assigned engineer verifies structural quality and approves the milestone.", actor: "Engineer" },
    { n: 4, title: "AI Risk Check", icon: "🤖", desc: "AI oracle validates evidence and assigns a risk score. Must pass.", actor: "AIAuditor" },
    { n: 5, title: "Compliance Validate", icon: "⚖️", desc: "Compliance officer checks regulatory adherence.", actor: "Auditor / COA" },
    { n: 6, title: "Community Oracle", icon: "📊", desc: "Citizen reports from the community oracle verify real-world project existence.", actor: "Citizens" },
    { n: 7, title: "Community Confirm", icon: "📸", desc: "Citizens submit GPS-tagged field reports. Each verified report increments the counter. When the counter reaches the threshold set at escrow creation, the gate passes. Higher thresholds = stronger anti-corruption, slower release.", actor: "Citizens" },
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
      <div className="card p-5 mb-4 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-800 mb-1">📸 Community Confirmations Threshold</h3>
        <p className="text-sm text-amber-700">
          When creating an escrow, the funding agency sets how many <strong>verified citizen GPS field reports</strong> are required to unlock the final gate.
          Each citizen must visit the project site, submit a report with GPS coordinates and evidence, and have it verified by the Community Oracle.
          Only verified reports count. Set a higher number for projects in high-corruption areas — this forces multiple independent on-the-ground verifications before any peso is released.
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
