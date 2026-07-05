import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, FUNDING_AGENCY, getCurrency, PPHP_SCALE } from "../config";
import { Client as GrantClient, type Grant as ChainGrant } from "../contracts/grant_commitment/src";
import { Modal } from "../components/Modal";
import { Autosuggest } from "../components/Autosuggest";

type GrantStatusTag = "Committed" | "Disbursed" | "Completed" | "Cancelled";

interface GrantData {
  id: number;
  pvoId: number;
  donor: string;
  amount: number;
  orgName: string;
  status: GrantStatusTag;
  createdAt: number;
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

function statusFromChain(s: any): GrantStatusTag {
  if (s && typeof s === "object" && s.tag) return s.tag as GrantStatusTag;
  if (typeof s === "string") return s as GrantStatusTag;
  return "Committed";
}

function grantFromChain(g: ChainGrant): GrantData {
  return {
    id: Number(g.id),
    pvoId: Number(g.pvo_id),
    donor: g.donor,
    amount: Number(g.amount),
    orgName: g.org_name,
    status: statusFromChain(g.status),
    createdAt: Number(g.created_at),
  };
}

const STATUS_COLORS: Record<GrantStatusTag, string> = {
  Committed: "badge-purple",
  Disbursed: "badge-blue",
  Completed: "badge-green",
  Cancelled: "badge-red",
};

export function DonorDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"portfolio" | "transparency">("portfolio");
  const [grants, setGrants] = useState<GrantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [commitModal, setCommitModal] = useState(false);
  const currency = getCurrency();

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      const client = new GrantClient({
        contractId: CONTRACT_IDS.grant_commitment,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const result = await client.get_all_grants();
      const chainGrants = result.result || [];
      const mapped = chainGrants.map(grantFromChain);
      mapped.sort((a, b) => b.id - a.id);
      setGrants(mapped);
    } catch (e) {
      console.error("Failed to load grants:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGrants(); }, [loadGrants, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🌍</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the international donor dashboard.</p>
        <p className="text-xs text-slate-400 font-mono mb-4 bg-slate-50 px-3 py-1 rounded">Donor wallet: GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">International Donor Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500">Commit grant funding on-chain and transfer assets to the Funding Agency in one transaction.</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading}
          className="btn-secondary text-xs px-3 py-2">
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
        <button onClick={() => setCommitModal(true)} className="btn-primary text-xs px-4 py-2">
          🤝 Commit Funds
        </button>
      </div>

      <div className="flex gap-1 mb-6 mt-4 border-b border-slate-200">
        {(["portfolio", "transparency"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "portfolio" && `📊 Grant Portfolio (${grants.length})`}
            {tab === "transparency" && "🔍 Transparency"}
          </button>
        ))}
      </div>

      {activeTab === "portfolio" && <PortfolioTab grants={grants} loading={loading} address={address!} />}
      {activeTab === "transparency" && <TransparencyTab grants={grants} loading={loading} address={address!} onAction={refresh} />}

      <Modal open={commitModal} onClose={() => setCommitModal(false)} title="Commit Grant Funding">
        <CommitForm address={address!} onCommitted={() => { refresh(); setCommitModal(false); }} />
      </Modal>
    </div>
  );
}

function PortfolioTab({ grants, loading, address }: {
  grants: GrantData[]; loading: boolean; address: string;
}) {
  const currency = getCurrency();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="card p-5 skeleton h-48" />)}
      </div>
    );
  }

  if (grants.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-slate-700 mb-1">No grants committed yet</h3>
        <p className="text-sm text-slate-400">Use the Commit Funds tab to record a grant pledge on-chain.</p>
        <p className="text-xs text-slate-400 mt-2 font-mono">Donor: GBUI4X... (seed in .dev-logs/newrolecreden.md)</p>
      </div>
    );
  }

  const totalCommitted = grants.reduce((s, g) => s + g.amount, 0);
  const disbursed = grants.filter(g => g.status === "Disbursed" || g.status === "Completed").reduce((s, g) => s + g.amount, 0);
  const myGrants = grants.filter(g => g.donor === address);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Pledged", value: `${currency}${(totalCommitted / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-slate-900" },
          { label: "Disbursed", value: `${currency}${(disbursed / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-emerald-600" },
          { label: "Total Grants", value: String(grants.length), color: "text-brand-600" },
          { label: "Your Commitments", value: String(myGrants.length), color: "text-blue-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {grants.map((g) => (
          <div key={g.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-400">{g.orgName}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">PVO #{g.pvoId} ({g.currency})</span>
                </div>
                <h3 className="font-semibold text-slate-900">Grant #{g.id}</h3>
                <p className="text-sm text-slate-500">{currency}{(g.amount / PPHP_SCALE).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <span className={`badge ${STATUS_COLORS[g.status]}`}>{g.status}</span>
                <p className="text-xs text-slate-400 mt-1">
                  By <WalletAddress addr={g.donor} chars={4}/>{g.donor === address && " (You)"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommitForm({ address, onCommitted }: { address: string; onCommitted: () => void }) {
  const [pvoId, setPvoId] = useState(0);
  const [amount, setAmount] = useState("");
  const [org, setOrg] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [pvoOptions, setPvoOptions] = useState<{ id: number; title: string }[]>([]);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      try {
        const { Client } = await import("../contracts/pvo_core/src");
        const client = new Client({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: { id: number; title: string }[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) list.push({ id: r.result.id, title: r.result.title });
        }
        setPvoOptions(list);
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("preparing");
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be positive");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.grant_commitment);

      const orgStr = xdr.ScVal.scvString(org);

      const op = contract.call("commit_grant",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        new ScInt(amt).toI128(),
        xdr.ScVal.scvString(org),
        xdr.ScVal.scvString(fiatCurrency),
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        new ScInt(amt).toI128(),
        orgStr,
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
      setTxMsg("Grant committed on-chain! Loading...");
      setPvoId(0); setAmount(""); setOrg("");
      setTimeout(() => onCommitted(), 3000);
    } catch (err: any) {
      setTxState("error");
      setTxMsg(err.message?.slice(0, 150) || "Transaction failed");
    }
  };

  const busy = txState === "preparing" || txState === "signing" || txState === "sending";

  return (
    <>
      <p className="text-sm text-slate-500 -mt-2 mb-4">
        Commits a grant and transfers pPHP to the Funding Agency in one transaction.
        The FA can then use these funds to create and fund escrows for the designated PVO.
        Ensure you have pPHP tokens first — <strong>admin mints them via CLI</strong>.
      </p>

      {txMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${txState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {txState === "done" && "✅ "}{txMsg}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Autosuggest label="PVO" value={pvoId ? String(pvoId) : ""} options={pvoOptions}
          onChange={setPvoId} placeholder="Search by project name..." />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Donor Organization</label>
          <select value={org} onChange={(e) => setOrg(e.target.value)} className="select" required>
            <option value="">Select organization...</option>
            <option>World Bank</option>
            <option>Asian Development Bank</option>
            <option>JICA</option>
            <option>USAID</option>
            <option>European Union</option>
            <option>UNDP</option>
          </select>
        </div>
        <div>
<label class="block text-sm font-medium text-slate-700 mb-1">Amount ({fiatCurrency})</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder={`e.g. 5000000`} required />
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="text-sm text-brand-700">
            <strong>How it works:</strong> This commits a grant AND transfers pPHP to the Funding Agency
            ({formatAddress(FUNDING_AGENCY, 6)}) in one atomic transaction. The FA can immediately use
            these funds for escrow.
          </p>
        </div>
        <button type="submit" disabled={busy} className="w-full py-3 btn-primary">
          {busy ? "Signing..." : "Commit Funding On-Chain"}
        </button>
        {busy && <p className="text-xs text-brand-600 text-center animate-pulse">Check Freighter for signing prompt...</p>}
      </form>
    </>
  );
}

function TransparencyTab({ grants, loading, address, onAction }: {
  grants: GrantData[]; loading: boolean; address: string; onAction: () => void;
}) {
  const currency = getCurrency();

  const handleUpdateStatus = async (grantId: number, newStatus: GrantStatusTag) => {
    const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
    const { signTransaction } = await import("@stellar/freighter-api");

    try {
      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.grant_commitment);

      const statusVal = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol(newStatus),
      ]);

      const op = contract.call("update_status",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(grantId),
        statusVal,
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setTimeout(() => onAction(), 3000);
    } catch (err: any) {
      console.error("Status update failed:", err);
    }
  };

  if (loading) {
    return <div className="card p-12 skeleton h-48" />;
  }

  if (grants.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="font-semibold text-slate-700">No grants to display</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Funds Flow Transparency</h3>
        <div className="space-y-3">
          {grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  g.status === "Completed" ? "bg-emerald-500" :
                  g.status === "Disbursed" ? "bg-blue-500" :
                  g.status === "Committed" ? "bg-brand-500" : "bg-red-500"
                }`} />
                <div>
                  <span className="text-sm font-medium text-slate-900">Grant #{g.id} · PVO #{g.pvoId} ({g.currency})</span>
                  <span className="text-xs text-slate-400 ml-2">{g.orgName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{currency}{(g.amount / PPHP_SCALE).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">By <WalletAddress addr={g.donor} chars={4}/></p>
                </div>
                {g.donor === address && g.status === "Committed" && (
                  <button onClick={() => handleUpdateStatus(g.id, "Disbursed")}
                    className="btn-secondary text-xs px-2 py-1">Mark Disbursed</button>
                )}
                {g.donor === address && g.status === "Disbursed" && (
                  <button onClick={() => handleUpdateStatus(g.id, "Completed")}
                    className="btn-secondary text-xs px-2 py-1">Mark Completed</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="stat-label mb-2">Zero Waste Policy</p>
          <p className="text-3xl font-bold text-brand-600">100%</p>
          <p className="text-xs text-slate-400 mt-1">On-chain verified commitments</p>
        </div>
        <div className="card p-5">
          <p className="stat-label mb-2">Community Verified</p>
          <p className="text-3xl font-bold text-blue-600">All</p>
          <p className="text-xs text-slate-400 mt-1">Disbursements gated by 5-condition escrow</p>
        </div>
        <div className="card p-5">
          <p className="stat-label mb-2">Immutable Record</p>
          <p className="text-3xl font-bold text-emerald-600">Permanent</p>
          <p className="text-xs text-slate-400 mt-1">Every pledge stored on Stellar</p>
        </div>
      </div>
    </div>
  );
}
