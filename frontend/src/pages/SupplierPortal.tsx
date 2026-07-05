import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as ProcurementClient } from "../contracts/procurement_market/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { Modal } from "../components/Modal";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function SupplierPortal() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"tenders" | "my_bids">("tenders");
  const [bidModal, setBidModal] = useState(false);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to view procurement tenders and submit bids.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Supplier Portal</h1>
      <p className="text-slate-500 mb-6">Browse procurement tenders and submit bids on-chain.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["tenders", "bid", "my_bids"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "tenders" && "📋 Tenders"}
            {tab === "bid" && "📝 Submit Bid"}
            {tab === "my_bids" && "📊 My Bids"}
          </button>
        ))}
      </div>

      {activeTab === "tenders" && <TendersTab />}
      {activeTab === "my_bids" && <MyBidsTab address={address!} />}

      <Modal open={bidModal} onClose={() => setBidModal(false)} title="Submit Bid">
        <SubmitBidTab address={address!} onDone={() => setBidModal(false)} />
      </Modal>

      <Modal open={bidModal} onClose={() => setBidModal(false)} title="Submit Bid">
        <SubmitBidTab address={address!} onDone={() => setBidModal(false)} />
      </Modal>
    </div>
  );
}

function TendersTab() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidModal, setBidModal] = useState(false);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new ProcurementClient({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_tender_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_tender({ id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        list.reverse();
        setTenders(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (tenders.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-slate-700 mb-1">No tenders available</h3>
        <p className="text-sm text-slate-400">Procurement tenders will appear here once agencies create them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tenders.map((t: any) => (
        <div key={Number(t.id)} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">Tender #{Number(t.id)}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">PVO #{Number(t.pvo_id)}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{t.title}</h3>
              <p className="text-sm text-slate-500">{t.description}</p>
            </div>
            <span className="badge badge-blue">{statusToString(t.status)}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>Budget: {currency}{(Number(t.budget) / PPHP_SCALE).toLocaleString()}</span>
            <span>Agency: <WalletAddress addr={t.agency} chars={4}/></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmitBidTab({ address, onDone }: { address: string; onDone: () => void }) {
  const [tenders, setTenders] = useState<any[]>([]);
  const [tenderId, setTenderId] = useState("");
  const [price, setPrice] = useState("");
  const [qualityScore, setQualityScore] = useState("80");
  const [timelineDays, setTimelineDays] = useState("90");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const client = new ProcurementClient({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_tender_count();
        const list: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_tender({ id: i });
            if (r.result) list.push(r.result);
          } catch {}
        }
        setTenders(list);
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const priceAmt = Number(price);
      if (!priceAmt || priceAmt <= 0) throw new Error("Price must be positive");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.procurement_market);

      const op = contract.call("submit_bid",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(tenderId)),
        new ScInt(priceAmt).toI128(),
        xdr.ScVal.scvU32(Number(qualityScore)),
        xdr.ScVal.scvU32(Number(timelineDays)),
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
      setTxMsg("Bid submitted on-chain!");
      setTenderId(""); setPrice("");
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Tender</label>
          <select value={tenderId} onChange={(e) => setTenderId(e.target.value)} className="select" required>
            <option value="">Select a tender...</option>
            {tenders.map((t: any) => (
              <option key={Number(t.id)} value={Number(t.id)}>
                Tender #{Number(t.id)} - {t.title} ({currency}{(Number(t.budget) / PPHP_SCALE).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bid Price (pPHP SAC units)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="180000000" required />
            {price && <p className="text-xs text-slate-400 mt-1">{currency}{(Number(price) / PPHP_SCALE).toLocaleString()}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quality Score (0-100)</label>
            <input type="number" value={qualityScore} onChange={(e) => setQualityScore(e.target.value)} className="input" min="0" max="100" placeholder="80" />
            <p className="text-xs text-slate-400 mt-1">Self-reported. Scored as (score/PPHP_SCALE) × 30</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Timeline (days)</label>
          <input type="number" value={timelineDays} onChange={(e) => setTimelineDays(e.target.value)} className="input" placeholder="90" />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            <strong>Scoring (contract-enforced):</strong><br />
            Price (discount% × 50) + Quality (self-reported, score/100 × 30) + Timeline (100 − days×10, max 20) + <strong>Integrity (from reputation contract, score/100 × 20)</strong>.<br />
            Your on-chain reputation score is pulled automatically from the reputation contract.
            Build your reputation by completing projects on time and within budget.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? "Signing..." : "Submit Bid On-Chain"}
        </button>
        {busy && <p className="text-xs text-brand-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

function MyBidsTab({ address }: { address: string }) {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidModal, setBidModal] = useState(false);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const client = new ProcurementClient({ contractId: CONTRACT_IDS.procurement_market, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_tender_count();
        const myBids: any[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await client.get_bids_by_tender({ tender_id: i });
            const tenderBids = r.result || [];
            for (const bid of tenderBids) {
              if ((bid as any).bidder === address) {
                myBids.push({ ...bid, tenderId: i });
              }
            }
          } catch {}
        }
        myBids.reverse();
        setBids(myBids);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address]);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  if (bids.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="font-semibold text-slate-700 mb-1">No bids submitted yet</h3>
        <p className="text-sm text-slate-400">Your bids will appear here after you submit to open tenders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bids.map((b: any, i: number) => (
        <div key={i} className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">Tender #{b.tenderId}</span>
              </div>
              <p className="font-semibold text-slate-900">{currency}{(Number(b.amount) / PPHP_SCALE).toLocaleString()}</p>
            </div>
            <span className="badge badge-purple">Submitted</span>
          </div>
        </div>
      ))}
    </div>
  );
}
