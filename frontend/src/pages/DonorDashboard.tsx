import { useState, useEffect, useCallback } from "react";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { useWallet } from "../wallet";
import { formatAddress, formatBudget } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as GrantClient, type Grant as ChainGrant } from "../contracts/grant_commitment/src";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Modal } from "../components/Modal";

type GrantStatusTag = "Committed" | "Disbursed" | "Completed" | "Cancelled";

interface GrantData {
  id: number; pvoId: number; donor: string; amount: number;
  orgName: string; currency: string; status: GrantStatusTag; createdAt: number;
}

interface PVOCard { id: number; title: string; department: string; municipality: string; totalBudget: string; status: string; remaining: string; }

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

function statusFromChain(s: any): GrantStatusTag {
  if (s && typeof s === "object" && s.tag) return s.tag as GrantStatusTag;
  return typeof s === "string" ? s as GrantStatusTag : "Committed";
}

const CURRENCIES = ["USD","EUR","JPY","GBP"] as const;

const STATUS_COLORS: Record<GrantStatusTag, string> = { Committed: "badge-purple", Disbursed: "badge-blue", Completed: "badge-green", Cancelled: "badge-red" };

export function DonorDashboard() {
  const { address, connected, connect } = useWallet();
  const [tab, setTab] = useState<"projects" | "pledges">("projects");
  const [pvos, setPvos] = useState<PVOCard[]>([]);
  const [grants, setGrants] = useState<GrantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pledgeModal, setPledgeModal] = useState<{ pvoId: number; title: string; remaining: string } | null>(null);
  const currency = getCurrency();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const gc = new GrantClient({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const gr = await gc.get_all_grants();
      setGrants((gr.result || []).map((g: any) => ({
        id: Number(g.id), pvoId: Number(g.pvo_id), donor: g.donor, amount: Number(g.amount),
        orgName: g.org_name, currency: g.currency || "USD", status: statusFromChain(g.status), createdAt: Number(g.created_at),
      })));

      const pc = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const cnt = await pc.get_pvo_count();
      const total = Number(cnt.result);
      const list: PVOCard[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const r = await pc.get_pvo({ pvo_id: i });
          if (r.result) {
            const pvo = r.result as any;
            // Only show PVOs with a winning contractor (tender awarded)
            if (!pvo.contractor_assigned) continue;
            list.push({
              id: pvo.id, title: pvo.title, department: pvo.department,
              municipality: pvo.municipality, totalBudget: String(pvo.total_budget),
              status: String((pvo.status as any)?.tag || pvo.status || "Proposed"),
              remaining: "0",
            });
          }
        } catch {}
      }
      // Fetch remaining funding + winning bid for each PVO
      for (const pvo of list) {
        try {
          const rem = await gc.get_pvo_remaining({ pvo_id: pvo.id });
          pvo.remaining = String(rem.result || 0);
        } catch {}
      }
      // Look up winning bid amounts
      try {
        const { Client: PM } = await import("../contracts/procurement_market/src");
        const pm = new PM({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const tCount = await pm.get_tender_count();
        const maxScan = Number(tCount.result) + 10;
        for (let i = 1; i <= maxScan; i++) {
          try {
            const tr = await pm.get_tender({ id: i });
            if (tr.result && tr.result.status?.tag === "Awarded" && tr.result.winner) {
              const pid = Number(tr.result.pvo_id);
              const bidsResult = await pm.get_bids_by_tender({ tender_id: Number(tr.result.id) });
              const bids = bidsResult.result || [];
              let best: any = null;
              for (const b of bids) {
                if (!best || Number(b.final_score) > Number(best.final_score)) best = b;
              }
              if (best) {
                const pvo = list.find(p => p.id === pid);
                if (pvo) (pvo as any).winningBid = String(best.price);
              }
            }
          } catch {}
        }
      } catch {}
      setPvos(list);
    } catch (e) { console.error("DonorDashboard loadAll:", e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🌍</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Donor Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect as International Donor to browse projects and pledge funds.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  const myGrants = grants.filter(g => g.donor === address);
  const getPvoPledges = (pvoId: number) => grants.filter(g => g.pvoId === pvoId);
  const totalPledged = myGrants.reduce((s, g) => s + g.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🌍 International Donor</h1>
          <p className="text-slate-500 mt-1">Discover projects and pledge funds in your chosen currency.</p>
        </div>
        <div className="flex gap-2">
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Pledged</p>
            <p className="text-2xl font-bold text-brand-600">{myGrants.length} grants</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["projects", "pledges"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
            {t === "projects" ? `🏗️ Available Projects (${pvos.length})` : `📊 My Pledges (${myGrants.length})`}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-20 text-slate-400">Loading...</div>}

      {!loading && tab === "projects" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pvos.map(pvo => {
            const pledges = getPvoPledges(pvo.id);
            const remaining = Number(pvo.remaining);
            const fullyFunded = remaining <= 0;
            return (
              <div key={pvo.id} className={`card p-5 hover:shadow-md transition ${fullyFunded ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{pvo.title}</h3>
                    <p className="text-xs text-slate-400">{pvo.department} · {pvo.municipality}</p>
                  </div>
                  <span className={`badge text-xs ${pvo.status === "Completed" ? "badge-green" : pvo.status === "Proposed" ? "badge-blue" : "badge-purple"}`}>{pvo.status}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Budget: {currency}{(Number(pvo.totalBudget) / PPHP_SCALE / 1_000_000).toFixed(1)}M
                    {(pvo as any).winningBid && Number((pvo as any).winningBid) !== Number(pvo.totalBudget) && (
                      <span className="text-emerald-600 ml-1">
                        → Winning: {currency}{(Number((pvo as any).winningBid) / PPHP_SCALE / 1_000_000).toFixed(1)}M
                      </span>
                    )}
                  </span>
                  <span className={`text-xs font-medium ${fullyFunded ? "text-emerald-600" : "text-brand-600"}`}>
                    {fullyFunded ? "✅ Fully Funded" : `Needed: ${currency}${formatBudget(pvo.remaining)}`}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 items-center">
                  {!fullyFunded && (
                    <button onClick={() => setPledgeModal({ pvoId: pvo.id, title: pvo.title, remaining: pvo.remaining })}
                      className="btn-primary text-xs px-3 py-1.5">🤝 Pledge Exact Amount</button>
                  )}
                  {pledges.map(g => (
                    <span key={g.id} className="text-[10px] text-slate-400 font-mono">{g.currency} {g.amount.toLocaleString()}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === "pledges" && myGrants.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-semibold text-slate-700 mb-1">No pledges yet</h3>
          <p className="text-sm text-slate-400">Browse Available Projects and pledge your support.</p>
        </div>
      )}

      {!loading && tab === "pledges" && myGrants.length > 0 && (
        <div className="space-y-3">
          {myGrants.map(g => (
            <div key={g.id} className="card p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">{g.orgName}</span>
                <p className="font-semibold text-slate-900">{g.currency} {g.amount.toLocaleString()} → PVO #{g.pvoId}</p>
              </div>
              <span className={`badge ${STATUS_COLORS[g.status]}`}>{g.status}</span>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!pledgeModal} onClose={() => setPledgeModal(null)} title={`Pledge to: ${pledgeModal?.title || ""}`}>
        {pledgeModal && (
          <PledgeForm address={address!} pvoId={pledgeModal.pvoId} remaining={pledgeModal.remaining} onDone={() => { loadAll(); setPledgeModal(null); }} />
        )}
      </Modal>
    </div>
  );
}

function PledgeForm({ address, pvoId, remaining, onDone }: { address: string; pvoId: number; remaining: string; onDone: () => void }) {
  const requiredAmount = Number(remaining);
  const [amount, setAmount] = useState(String(requiredAmount));
  const [org, setOrg] = useState("World Bank");
  const cur = getCurrency();
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing"); setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be positive");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.grant_commitment);
      const op = contract.call("commit_grant",
        new Address(address).toScVal(), xdr.ScVal.scvU32(pvoId), new ScInt(amt).toI128(),
        xdr.ScVal.scvString(org), xdr.ScVal.scvString("pPHP"),
      );
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }
      setTxState("done"); setTxMsg(`Pledged ${cur}${formatBudget(amount)}! Transfer foreign currency to CentralBank: GBRDP...BBBHO`);
      setTimeout(onDone, 2000);
    } catch (err: any) {
      setTxState("error"); setTxMsg(err.message?.slice(0, 150) || "Failed");
    }
  };

  return (
    <>
      {txMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" && "✅ "}{txMsg}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
          <select value={org} onChange={e => setOrg(e.target.value)} className="select" required>
            <option>World Bank</option><option>Asian Development Bank</option><option>JICA</option>
            <option>USAID</option><option>European Union</option><option>UNDP</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Exact Amount Required (pesos)</label>
          <input type="number" value={amount} readOnly className="input bg-slate-50 font-mono" />
          <p className="text-xs text-slate-400 mt-1">{cur}{formatBudget(amount)} - this is the full remaining budget for this PVO.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            <strong>Exact pledge required:</strong> This PVO needs exactly {cur}{formatBudget(remaining)} more. Partial pledges are rejected on-chain.
          </p>
        </div>
        <button type="submit" disabled={txState !== "idle" && txState !== "error"} className="w-full py-3 btn-primary">
          {txState === "idle" || txState === "error" ? `Pledge ${cur}${formatBudget(amount)} On-Chain` :
           txState === "preparing" ? "Preparing..." : txState === "signing" ? "Check Freighter..." : "Sending..."}
        </button>
      </form>
    </>
  );
}
