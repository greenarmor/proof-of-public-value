import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { Client as ProcurementMarketClient } from "../contracts/procurement_market/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { Modal } from "../components/Modal";

interface Tender {
  id: number;
  title: string;
  description: string;
  budget: string;
  status: { tag: string };
  agency: string;
  winner?: string;
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function ProcurementMarketplace() {
  const { address, connected, connect, hasRole } = useWallet();
  const canCreateTender = hasRole("GovernmentAgency", "Administrator");
  const [activeTab, setActiveTab] = useState<"browse" | "award">("browse");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);

  useEffect(() => {
    if (!canCreateTender) setActiveTab("browse");
  }, [canCreateTender]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new ProcurementMarketClient({
          contractId: CONTRACT_IDS.procurement_market,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const count = await client.get_tender_count();
        const list: Tender[] = [];
        // Scan beyond count to catch sparse IDs
        const maxScan = Number(count.result) + 10;
        for (let i = 1; i <= maxScan; i++) {
          const r = await client.get_tender({ id: i });
          if (r.result) list.push({
            id: r.result.id, title: r.result.title,
            description: (r.result as any).description || "",
            budget: String(r.result.budget),
            status: r.result.status, agency: r.result.agency,
            winner: (r.result as any).winner || undefined,
          });
        }
        setTenders(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to access the procurement marketplace.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">🏗️ Procurement Marketplace</h1>
      <p className="text-gray-500 mb-6">Multi-criteria bidding with integrity-weighted ranking and auto-award.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab("browse")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "browse" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          📋 Browse Tenders
        </button>
        {canCreateTender && (
          <button onClick={() => setActiveTab("award")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "award" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            🏆 Award
          </button>
        )}
      </div>

      {activeTab === "browse" && <BrowseTenders tenders={tenders} loading={loading} />}
      
      {activeTab === "award" && canCreateTender && <AwardTab address={address!} tenders={tenders} loading={loading} />}

      {canCreateTender && (
        <div className="mt-4">
          <button onClick={() => setCreateModal(true)} className="btn-primary text-sm px-4 py-2">
            ➕ Create Tender
          </button>
        </div>
      )}
      {canCreateTender && (
        <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Tender">
          <CreateTenderForm address={address!} onDone={() => { setCreateModal(false); setTenders([]); setLoading(true); }} />
        </Modal>
      )}
    </div>
  );
}

function BrowseTenders({ tenders, loading }: { tenders: Tender[]; loading: boolean }) {
  const currency = getCurrency();
  const [bidModal, setBidModal] = useState<Tender | null>(null);
  if (loading) return <div className="text-center py-10 text-gray-400">Loading tenders...</div>;

  return (
    <>
    <div className="grid gap-4">
      {tenders.map(t => (
        <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{t.title}</h3>
              <p className="text-sm text-gray-500">{t.description}</p>
              <p className="text-xs text-gray-400 mt-1">Agency: <WalletAddress addr={t.agency} chars={6}/></p>
            </div>
            <span className={`px-2 py-1 text-xs rounded font-medium ${
              t.status.tag === "Open" ? "bg-green-50 text-green-700" :
              t.status.tag === "Awarded" ? "bg-blue-50 text-blue-700" :
              "bg-gray-100 text-gray-600"
            }`}>{t.status.tag}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>Budget: {currency}{(Number(t.budget) / PPHP_SCALE).toLocaleString()}</span>
            {t.winner && <span>Winner: <WalletAddress addr={t.winner} chars={6}/></span>}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Scoring: Price (max 50) + Quality (max 30) + Timeline (max 20)</span>
            {t.status.tag === "Open" && (
              <button onClick={() => setBidModal(t)} className="btn-primary text-xs px-3 py-1">📤 Bid</button>
            )}
          </div>
        </div>
      ))}
      {tenders.length === 0 && <div className="text-center py-10 text-gray-400">No tenders yet. Create one with the "Create Tender" tab.</div>}
    </div>
    <Modal open={!!bidModal} onClose={() => setBidModal(null)} title="Submit Bid">
      {bidModal && <BidForm tender={bidModal} onDone={() => setBidModal(null)} />}
    </Modal>
    </>
  );
}

function CreateTenderForm({ address, onDone }: { address: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [pvoId, setPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("0");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const currency = getCurrency();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Number(budget);
      if (!amt || amt <= 0) throw new Error("Budget must be positive");
      if (!deadline) throw new Error("Deadline required");

      const dl = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.procurement_market);
      const amtSAC = Math.round(amt * PPHP_SCALE);

      const op = contract.call("create_tender",
        new Address(address).toScVal(),
        nativeToScVal(Number(pvoId) || 1, { type: "u32" }),
        nativeToScVal(Number(milestoneId) || 0, { type: "u32" }),
        xdr.ScVal.scvString(title),
        xdr.ScVal.scvString(description || title),
        new ScInt(amtSAC).toI128(),
        nativeToScVal(dl, { type: "u64" }),
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
      setTxMsg("Tender created on-chain!");
      setTitle(""); setPvoId(""); setMilestoneId(""); setDescription(""); setBudget(""); setDeadline("");
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)} className="input" placeholder="1" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID (0 = all milestones)</label>
            <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="input" placeholder="1" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tender Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Asphalt Supply for Road Paving" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} placeholder="500 tons of asphalt grade A, delivered to site" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (pPHP SAC units)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" placeholder="200000000" required />
            {budget && <p className="text-xs text-gray-400 mt-1">{currency}{(Number(budget) / PPHP_SCALE).toLocaleString()}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bid Submission Deadline</label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" required />
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-700">
            <strong>Scoring formula:</strong> Price (max 50) + Quality (max 30) + Timeline (max 20) + Integrity (max 20).
            Integrity score is pulled from the contractor's on-chain reputation.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? "Signing..." : "Create Tender On-Chain"}
        </button>
        {busy && <p className="text-xs text-purple-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

function AwardTab({ address, tenders, loading }: { address: string; tenders: Tender[]; loading: boolean }) {
  const currency = getCurrency();

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>;

  const openTenders = tenders.filter(t => t.status.tag === "Open" && !t.winner);

  if (openTenders.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h3 className="font-semibold text-slate-700 mb-1">No open tenders to award</h3>
        <p className="text-sm text-slate-400">Create a tender first, then suppliers can bid. Come back here to award.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {openTenders.map(t => <TenderAwardCard key={t.id} tender={t} currency={currency} address={address} />)}
    </div>
  );
}

function TenderAwardCard({ tender, currency, address }: { tender: Tender; currency: string; address: string }) {
  const [bids, setBids] = useState<any[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const client = new ProcurementMarketClient({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const r = await client.get_bids_by_tender({ tender_id: tender.id });
        const list = (r.result || []) as any[];
        list.sort((a: any, b: any) => Number(b.final_score) - Number(a.final_score));
        setBids(list);
      } catch {} finally { setBidsLoading(false); }
    })();
  }, [tender.id]);

  const handleAward = async () => {
    setTxState("preparing"); setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.procurement_market);
      const op = contract.call("award_tender", new Address(address).toScVal(), xdr.ScVal.scvU32(tender.id));
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      setTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      setTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setTxState("done");
      setTxMsg("Tender awarded! Contract auto-picks highest-scoring bid.");
    } catch (err: any) { setTxState("error"); setTxMsg(err.message?.slice(0, 150) || "Failed"); }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <div className="card p-5">
      {txMsg && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-mono">Tender #{tender.id}</span>
            <span className="badge-green text-xs">Open</span>
          </div>
          <h3 className="font-semibold text-slate-900">{tender.title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{tender.description}</p>
          <p className="text-xs text-slate-400 mt-1">Budget: {currency}{(Number(tender.budget)/PPHP_SCALE).toLocaleString()}</p>
        </div>
        <button onClick={handleAward} disabled={busy || bids.length === 0}
          className="btn-primary text-sm px-4 py-2">
          {busy ? "Awarding..." : "🏆 Award Tender"}
        </button>
      </div>

      {/* Bids list */}
      <div className="border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Bids ({bids.length}) — highest final score wins</p>
        {bidsLoading ? (
          <div className="skeleton h-16 rounded-lg" />
        ) : bids.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No bids yet. Suppliers submit via the Supplier Portal.</p>
        ) : (
          <div className="space-y-2">
            {bids.map((b: any) => (
              <div key={Number(b.id)} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <div>
                  <span className="font-mono text-xs text-slate-600"><WalletAddress addr={b.contractor} chars={6}/></span>
                  <span className="text-xs text-slate-400 ml-2">{currency}{(Number(b.price)/PPHP_SCALE).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">Q:{Number(b.quality_score)} T:{Number(b.timeline_days)}d R:{Number(b.reputation_score)}</span>
                  <span className="font-bold text-brand-600">{Number(b.final_score)}/120</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BidForm({ tender, onDone }: { tender: Tender; onDone: () => void }) {
  const { address } = useWallet();
  const [price, setPrice] = useState("");
  const [quality, setQuality] = useState("80");
  const [timeline, setTimeline] = useState("180");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const currency = getCurrency();
  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address!);
      const contract = new Contract(CONTRACT_IDS.procurement_market);

      const op = contract.call("submit_bid",
        new Address(address!).toScVal(),
        xdr.ScVal.scvU32(tender.id),
        new ScInt(Number(price)).toI128(),
        xdr.ScVal.scvU32(Number(quality)),
        xdr.ScVal.scvU32(Number(timeline)),
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
      setTxMsg("Bid submitted! Score will appear after award.");
      setTimeout(onDone, 2000);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 200) || "Bid failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {txMsg && (
        <div className={`p-2 rounded-lg text-xs ${txState === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {txState === "done" ? "✅ " : "❌ "}{txMsg}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Price (SAC)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="input text-xs" required />
          {price && <p className="text-[10px] text-slate-400">{currency}{(Number(price)/PPHP_SCALE).toLocaleString()}</p>}
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Quality (0-100)</label>
          <input type="number" value={quality} onChange={e => setQuality(e.target.value)} className="input text-xs" min="0" max="100" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Timeline (days)</label>
          <input type="number" value={timeline} onChange={e => setTimeline(e.target.value)} className="input text-xs" min="1" />
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary text-xs w-full py-1.5">
        {busy ? "Submitting..." : "📤 Submit Bid"}
      </button>
    </form>
  );
}
