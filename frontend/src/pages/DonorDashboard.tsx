import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, FUNDING_AGENCY, getCurrency, PPHP_SCALE } from "../config";
import { Client as GrantClient, type Grant as ChainGrant } from "../contracts/grant_commitment/src";
import { Modal } from "../components/Modal";
import { Autosuggest } from "../components/Autosuggest";

type GrantStatusTag = "Committed" | "Disbursed" | "Completed" | "Cancelled";

// Available donation assets — donors can transfer any Stellar token
// On testnet: only pPHP SAC is available. On mainnet: USDC, EURC, BRL, etc.
const DONATION_ASSETS: { code: string; issuer: string; contractId: string; name: string; decimals: number; symbol: string }[] = [
  { code: "pPHP", issuer: "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV", contractId: "CCJRBA36WHKFDUJMNW2BPP7OYHNUJHJ4MYAQW4ORCTF2IEIOWW5ZA32X", name: "Philippine Peso (testnet)", decimals: 7, symbol: "₱" },
  // Mainnet-ready: USDC (6 dec), EURC (6 dec), BRL stablecoin, etc.
  // { code: "USDC", issuer: "G...", contractId: "C...", name: "USD Coin", decimals: 6, symbol: "$" },
  // { code: "EURC", issuer: "G...", contractId: "C...", name: "Euro Coin", decimals: 6, symbol: "€" },
];

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
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balances, setBalances] = useState<{code: string; amt: bigint}[]>([]);
  const currency = getCurrency();

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const { Contract, Address, rpc, TransactionBuilder, scValToBigInt } = await import("@stellar/stellar-sdk");
        const server = new rpc.Server(RPC_URL);
        const acct = await server.getAccount(address);
        const results: {code: string; amt: bigint}[] = [];
        for (const asset of DONATION_ASSETS) {
          try {
            const contract = new Contract(asset.contractId);
            const tx = new TransactionBuilder(acct, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
              .addOperation(contract.call("balance", new Address(address).toScVal()))
              .setTimeout(30).build();
            const resp = await server.simulateTransaction(tx);
            if (!resp.error && resp.result?.retval) {
              const amt = scValToBigInt(resp.result.retval);
              results.push({ code: asset.code, amt });
              if (asset.contractId === CONTRACT_IDS.pphp) setBalance(amt);
            }
          } catch {}
        }
        setBalances(results);
      } catch {}
    })();
  }, [address]);

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

  const refresh = () => {
    setRefreshKey(k => k + 1);
    if (address) {
      (async () => {
        try {
          const { Contract, Address, rpc, TransactionBuilder, scValToBigInt } = await import("@stellar/stellar-sdk");
          const server = new rpc.Server(RPC_URL);
          const acct = await server.getAccount(address);
          const results: {code: string; amt: bigint}[] = [];
          for (const asset of DONATION_ASSETS) {
            try {
              const contract = new Contract(asset.contractId);
              const tx = new TransactionBuilder(acct, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
                .addOperation(contract.call("balance", new Address(address).toScVal()))
                .setTimeout(30).build();
              const resp = await server.simulateTransaction(tx);
              if (!resp.error && resp.result?.retval) {
                const amt = scValToBigInt(resp.result.retval);
                results.push({ code: asset.code, amt });
                if (asset.contractId === CONTRACT_IDS.pphp) setBalance(amt);
              }
            } catch {}
          }
          setBalances(results);
        } catch {}
      })();
    }
  };

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


          {balance === 0n && (
            <code className="text-xs bg-white px-2 py-1 rounded border border-red-200 font-mono">
              stellar contract invoke --source alice --network testnet --id {CONTRACT_IDS.pphp} -- mint --to {address} --amount 20000000000000
            </code>
          )}
        </div>
      )}

      {balances.length > 0 && (
        <div className="mb-6 card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-sm">💳 Donor Wallet</h3>
            <span className="text-xs font-mono text-slate-400">{address!.slice(0,8)}...{address!.slice(-4)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {balances.map(b => {
              const asset = DONATION_ASSETS.find(a => a.code === b.code);
              const scale = Math.pow(10, asset?.decimals || 7);
              const human = Number(b.amt) / scale;
              const warningThreshold = 20000000000000n;
              return (
                <div key={b.code} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{human.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-500">{b.code} ({asset?.symbol || "?"})</p>
                  {b.amt < warningThreshold && (
                    <button onClick={() => {
                      const shortage = warningThreshold - b.amt;
                      navigator.clipboard.writeText(`stellar contract invoke --source alice --network testnet --id ${CONTRACT_IDS.pphp} -- mint --to ${address} --amount ${shortage}`);
                      alert(`Mint command copied! Need ${(Number(shortage) / scale).toLocaleString()} more ${b.code}.`);
                    }} className="mt-2 text-[10px] text-amber-600 hover:underline bg-amber-50 px-2 py-0.5 rounded">
                      📋 Request more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        <CommitForm address={address!} onCommitted={() => { refresh(); setCommitModal(false); }}
          balances={balances} balanceBigInt={balance} />
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
                  <span className="text-xs text-slate-400">PVO #{g.pvoId}</span>
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
  const [selectedAsset, setSelectedAsset] = useState(DONATION_ASSETS[0]);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [pphpBalance, setPphpBalance] = useState<bigint | null>(null);
  const [pvoOptions, setPvoOptions] = useState<{ id: number; title: string }[]>([]);
  const [assetBalances, setAssetBalances] = useState<Record<string, bigint>>({});
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

  // Check donor's balances across all donation assets
  useEffect(() => {
    (async () => {
      try {
        const { Contract, Address, rpc, TransactionBuilder, scValToBigInt } = await import("@stellar/stellar-sdk");
        const server = new rpc.Server(RPC_URL);
        const acct = await server.getAccount(address);
        const bals: Record<string, bigint> = {};
        for (const asset of DONATION_ASSETS) {
          try {
            const contract = new Contract(asset.contractId);
            const tx = new TransactionBuilder(acct, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
              .addOperation(contract.call("balance", new Address(address).toScVal()))
              .setTimeout(30).build();
            const resp = await server.simulateTransaction(tx);
            if (!resp.error && resp.result?.retval) {
              bals[asset.code] = scValToBigInt(resp.result.retval);
              if (asset.code === "pPHP") setPphpBalance(bals[asset.code]);
            }
          } catch {}
        }
        setAssetBalances(bals);
      } catch {}
    })();
  }, [address]);

  const balanceUnits = pphpBalance !== null ? Number(pphpBalance) : null;
  const enteredAmount = amount ? Number(amount) : 0;
  const hasEnough = balanceUnits !== null && balanceUnits >= enteredAmount && enteredAmount > 0;

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
        orgStr,
        new Address(FUNDING_AGENCY).toScVal(),
        new Address(selectedAsset.contractId).toScVal(),
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Asset</label>
          <select value={selectedAsset.code} onChange={e => setSelectedAsset(DONATION_ASSETS.find(a => a.code === e.target.value) || DONATION_ASSETS[0])} className="select">
            {DONATION_ASSETS.map(a => (
              <option key={a.code} value={a.code}>
                {a.symbol} {a.code} — {a.name} {assetBalances[a.code] ? `(${(Number(assetBalances[a.code]) / Math.pow(10, a.decimals)).toLocaleString()})` : ""}
              </option>
            ))}
          </select>
        </div>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount ({selectedAsset.code} units)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder={`e.g. ${Math.pow(10, selectedAsset.decimals).toLocaleString().replace(/,/g,"")} = ${selectedAsset.symbol}1.00`} required />
          <p className="text-xs text-slate-400 mt-1">{selectedAsset.decimals} decimal places. 1 {selectedAsset.code} unit = {selectedAsset.symbol}{(1 / Math.pow(10, selectedAsset.decimals)).toFixed(selectedAsset.decimals)}</p>
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="text-sm text-brand-700">
            <strong>How it works:</strong> This commits a grant AND transfers pPHP to the Funding Agency
            ({formatAddress(FUNDING_AGENCY, 6)}) in one atomic transaction. The FA can immediately use
            these funds for escrow.
          </p>
          {selectedAsset.code === "pPHP" && pphpBalance !== null && (
            <p className={`text-sm mt-2 ${hasEnough ? "text-emerald-700" : "text-red-600"}`}>
              {hasEnough ? (
                <>✅ Balance sufficient: <strong>{getCurrency()}{(Number(pphpBalance) / PPHP_SCALE).toLocaleString()}</strong></>
              ) : (
                <>
                  ⚠️ Insufficient balance: you have <strong>{getCurrency()}{(Number(pphpBalance) / PPHP_SCALE).toLocaleString()}</strong> but need <strong>{getCurrency()}{(enteredAmount / PPHP_SCALE).toLocaleString()}</strong>.
                  <br/><span className="text-xs">Request admin to mint: <code className="bg-red-100 px-1 rounded">stellar contract invoke --source alice --network testnet --id {CONTRACT_IDS.pphp} -- mint --to {address} --amount {Number(enteredAmount) - Number(pphpBalance || 0n)}</code></span>
                </>
              )}
            </p>
          )}
        </div>
        <button type="submit" disabled={busy || (amount !== "" && pphpBalance !== null && !hasEnough)}
          className={`w-full py-3 ${amount !== "" && pphpBalance !== null && !hasEnough ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}>
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
                  <span className="text-sm font-medium text-slate-900">Grant #{g.id} · PVO #{g.pvoId}</span>
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
