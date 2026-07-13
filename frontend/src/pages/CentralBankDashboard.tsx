import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, PPHP_SCALE, getCurrency } from "../config";

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function CentralBankDashboard() {
  const { address, connected, connect, hasRole } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "direct" | "pledges" | "redeem">("overview");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🏦</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Central Bank Dashboard</h2>
        <p className="text-slate-500 mb-4">Connect your CentralBank wallet to manage monetary operations.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  if (!hasRole("CentralBank")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Restricted</h2>
        <p className="text-slate-500">Only the CentralBank wallet can access this dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-1">🏦 Central Bank Dashboard</h1>
      <p className="text-slate-500 mb-6">Monetary operations: mint, disburse pledges, and redeem pPHP.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["overview", "direct", "pledges", "redeem"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "overview" && "📊 Overview"}
            {tab === "direct" && "💰 Direct Fund"}
            {tab === "pledges" && "💸 Pledges"}
            {tab === "redeem" && "💱 Redeem"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <GrantsOverview />}
      {activeTab === "direct" && (
        <div>
          <DirectFundForm address={address!} />
        </div>
      )}
      {activeTab === "pledges" && <PledgeManager address={address!} />}
      {activeTab === "redeem" && <RedeemPanel address={address!} />}

    </div>
  );
}

function DirectFundForm({ address }: { address: string }) {
  const [pvoId, setPvoId] = useState("");
  const [amount, setAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [txMsg, setTxMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tokenContract = new Contract(CONTRACT_IDS.pphp);
      const FA = "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO";
      const sacAmt = Math.round(Number(amount) * PPHP_SCALE);
      const op = tokenContract.call("mint", new Address(FA).toScVal(), new ScInt(sacAmt).toI128());
      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      await server.sendTransaction(TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE));
      setTxMsg(`Minted ${amount} PHP to Funding Agency`);
    } catch (err: any) {
      setTxMsg(err.message?.slice(0, 200) || "Failed");
    } finally { setIsBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {txMsg && <div className={`p-3 rounded-lg text-sm ${txMsg.startsWith("Minted") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{txMsg.startsWith("Minted") ? "✅ " : "❌ "}{txMsg}</div>}
      <p className="text-xs text-amber-600">For National Budget PVOs - mint pPHP directly to Funding Agency. No donor required.</p>
      <div><label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label><input type="number" value={pvoId} onChange={e => setPvoId(e.target.value)} className="input" placeholder="1" /></div>
      <div><label className="block text-sm font-medium text-slate-700 mb-1">Amount (in pesos)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="500000000" />
        {amount && <p className="text-xs text-slate-400 mt-1">= {(Number(amount) * PPHP_SCALE).toLocaleString()} SAC units (₱{Number(amount).toLocaleString()})</p>}
      </div>
      <button type="submit" disabled={isBusy} className="btn-primary w-full py-3">{isBusy ? "Signing..." : "Mint to Funding Agency"}</button>
    </form>
  );
}

function PledgeManager({ address }: { address: string }) {
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [busyStep, setBusyStep] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { Client } = await import("../contracts/grant_commitment/src");
        const gc = new Client({
          contractId: CONTRACT_IDS.grant_commitment,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const result = await gc.get_all_grants();
        const raw = (result.result || []).filter(
          (g: any) => (g.status as any)?.tag === "Committed" || g.status === "Committed",
        );
        const seen = new Set();
        const unique = raw.filter((g: any) => !seen.has(g.id) && seen.add(g.id));
        setPledges(unique);
      } catch (e) {
        console.error("PledgeManager:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const handleConvert = async (pledge: any) => {
    setBusy(pledge.id);
    setBusyStep("Minting pPHP...");
    let mintSucceeded = false;
    try {
      const { TransactionBuilder, Contract, Address, rpc, ScInt, nativeToScVal } =
        await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const FUNDING = "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO";
      const pphpAmount = Number(pledge.amount);

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);

      // 1) Mint exact pledged amount to funding agency (separate tx - Freighter rejects multi-op)
      const tokenContract = new Contract(CONTRACT_IDS.pphp);
      const mintOp = tokenContract.call(
        "mint",
        new Address(FUNDING).toScVal(),
        new ScInt(pphpAmount).toI128(),
      );

      let tx1 = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(mintOp)
        .setTimeout(30)
        .build();
      tx1 = await server.prepareTransaction(tx1);
      let signedResp: any = await signTransaction(tx1.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      let signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      mintSucceeded = true;

      // Brief delay so Freighter can process the first tx before the second popup
      setBusyStep("Awaiting Freighter (step 2/2)...");
      await new Promise((r) => setTimeout(r, 1500));

      // Step 2) Mark grant as Disbursed on-chain
      setBusyStep("Marking grant disbursed...");
      try {
        const gcContract = new Contract(CONTRACT_IDS.grant_commitment);
        const markDisbursedOp = gcContract.call(
          "admin_mark_disbursed",
          new Address(address).toScVal(),
          nativeToScVal(pledge.id, { type: "u32" }),
        );
        let tx2 = new TransactionBuilder(await server.getAccount(address), {
          fee: "100000",
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(markDisbursedOp)
          .setTimeout(30)
          .build();
        tx2 = await server.prepareTransaction(tx2);
        signedResp = await signTransaction(tx2.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
        if (signedResp?.error) throw new Error(signedResp.error.message);
        signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
        await server.sendTransaction(signedTx);
      } catch (markErr: any) {
        console.error("mark_disbursed failed:", markErr.message);
        // Mint succeeded but mark failed - show warning so user can retry
        alert(`pPHP minted but grant status update failed. Use the retry button or CLI:\nstellar contract invoke --send=yes --source central_bank --network testnet --id ${CONTRACT_IDS.grant_commitment} -- admin_mark_disbursed --caller ${address} --grant_id ${pledge.id}`);
      }

      // Mint succeeded - re-fetch to remove from list
      setTimeout(() => setRefreshKey(k => k + 1), 2000);
    } catch (e: any) {
      alert("Error: " + (e.message || e).slice(0, 200));
      // Re-fetch even on partial success (mint may have succeeded, mark may have failed)
      if (mintSucceeded) {
        setRefreshKey(k => k + 1);
      }
    } finally {
      setBusy(null);
      setBusyStep("");
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-400">Loading pledges...</div>;

  return (
    <div>
      {pledges.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No pending pledges to convert.</div>
      ) : (
        <div className="space-y-3 max-w-lg">
          {pledges.map((p: any) => {
            const pesos = Number(p.amount) / PPHP_SCALE;
            return (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {p.org_name} - PVO #{p.pvo_id}
                  </p>
                  <p className="text-sm text-slate-500">
                    ₱{pesos.toLocaleString()} pPHP (exact PVO budget)
                  </p>
                </div>
                <button
                  onClick={() => handleConvert(p)}
                  disabled={busy === p.id}
                  className={`text-sm px-4 py-2 ${busy === p.id ? "btn-primary opacity-60" : "btn-primary"}`}>
                  {busy === p.id ? busyStep || "Processing..." : "Approve & Mint"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RedeemPanel({ address }: { address: string }) {
  const [contractor, setContractor] = useState("");
  const [amount, setAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [txMsg, setTxMsg] = useState("");

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setTxMsg("");
    try {
      const { TransactionBuilder, Contract, Address, rpc, ScInt } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tokenContract = new Contract(CONTRACT_IDS.pphp);
      const redeemAmt = Math.round(Number(amount) * PPHP_SCALE);
      const op = tokenContract.call("burn", new Address(contractor).toScVal(), new ScInt(redeemAmt).toI128());
      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      await server.sendTransaction(TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE));
      setTxMsg(`Redeemed ${amount} PHP from contractor - burned from circulation`);
    } catch (err: any) {
      setTxMsg(err.message?.slice(0, 200) || "Failed");
    } finally { setIsBusy(false); }
  };

  return (
    <form onSubmit={handleRedeem} className="space-y-4 max-w-lg">
      {txMsg && <div className={`p-3 rounded-lg text-sm ${txMsg.startsWith("Redeemed") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{txMsg.startsWith("Redeemed") ? "✅ " : "❌ "}{txMsg}</div>}
      <p className="text-xs text-amber-600">Contractor cash-out: burn pPHP from circulation and release real pesos off-chain.</p>
      <div><label className="block text-sm font-medium text-slate-700 mb-1">Contractor Wallet</label><input type="text" value={contractor} onChange={e => setContractor(e.target.value)} className="input font-mono text-xs" placeholder="G..." required /></div>
      <div><label className="block text-sm font-medium text-slate-700 mb-1">Amount (in pesos)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="1000000" />
        {amount && <p className="text-xs text-slate-400 mt-1">= {(Number(amount) * PPHP_SCALE).toLocaleString()} SAC units (₱{Number(amount).toLocaleString()})</p>}
      </div>
      <button type="submit" disabled={isBusy} className="btn-primary w-full py-3 bg-amber-600 hover:bg-amber-700">{isBusy ? "Signing..." : "Redeem & Burn"}</button>
    </form>
  );
}

// ── Grants Overview ──────────────────────────────────────
function GrantsOverview() {
  const currency = getCurrency();
  const { address } = useWallet();
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [pvoEscrowStatus, setPvoEscrowStatus] = useState<Record<number, { escrowCount: number; releasedCount: number }>>({});

  // Check escrow activity per PVO to show accurate project status
  useEffect(() => {
    (async () => {
      try {
        const { Client: EscrowClient } = await import("../contracts/escrow/src");
        const ec = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const statusMap: Record<number, { escrowCount: number; releasedCount: number }> = {};
        const cnt = await ec.get_escrow_count();
        for (let i = 1; i <= Number(cnt.result); i++) {
          try {
            const r = await ec.get_escrow({ escrow_id: i });
            if (r.result) {
              const st = typeof r.result.status === "string" ? r.result.status : r.result.status?.tag ?? "";
              const pvoId = Number(r.result.pvo_id);
              if (!statusMap[pvoId]) statusMap[pvoId] = { escrowCount: 0, releasedCount: 0 };
              statusMap[pvoId].escrowCount++;
              if (st === "Released") statusMap[pvoId].releasedCount++;
            }
          } catch {}
        }
        setPvoEscrowStatus(statusMap);
      } catch {}
    })();
  }, []);

  const handleComplete = async (grantId: number) => {
    if (!address) return;
    setCompleting(grantId);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_IDS.grant_commitment);
      const op = contract.call("update_status", new Address(address).toScVal(), xdr.ScVal.scvU32(grantId), xdr.ScVal.scvSymbol("Completed"));
      const tx = new TransactionBuilder(await server.getAccount(address), { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE }).addOperation(op).setTimeout(30).build();
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);
      await server.sendTransaction(TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE));
      setGrants(prev => prev.map(g => Number(g.id) === grantId ? {...g, status: "Completed"} : g));
    } catch (e: any) { alert("Only admin or donor can complete grants.\n" + (e.message?.slice(0, 100) || "Unknown")); }
    finally { setCompleting(null); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { Client } = await import("../contracts/grant_commitment/src");
        const gc = new Client({ contractId: CONTRACT_IDS.grant_commitment, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await gc.get_all_grants();
        const all = (result.result || []).sort((a: any, b: any) => Number(b.id) - Number(a.id));
        setGrants(all);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="card p-12 skeleton h-48" />;

  const statusTag = (s: any) => (s && typeof s === "object" && s.tag) ? s.tag : (typeof s === "string" ? s : "?");
  const statusColor = (s: string) => s === "Disbursed" ? "badge-blue" : s === "Completed" ? "badge-green" : s === "Cancelled" ? "badge-red" : "badge-purple";
  const statusLabel = (g: any) => {
    const st = statusTag(g.status);
    if (st === "Disbursed") {
      const pvoId = Number(g.pvo_id);
      const esc = pvoEscrowStatus[pvoId];
      if (esc && esc.releasedCount > 0 && esc.releasedCount >= esc.escrowCount) return "Completed";
      if (esc && esc.releasedCount > 0) return "Partially Released";
      if (esc && esc.escrowCount > 0) return "Active";
      return "Funded";
    }
    return st;
  };
  const totals = { committed: 0, disbursed: 0, completed: 0 };
  for (const g of grants) {
    const st = statusTag(g.status);
    if (st === "Committed") totals.committed++;
    else if (st === "Disbursed") totals.disbursed++;
    else if (st === "Completed") totals.completed++;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center"><p className="text-xs text-slate-400">Total Grants</p><p className="text-xl font-bold text-slate-900">{grants.length}</p></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-400">Awaiting</p><p className="text-xl font-bold text-purple-600">{totals.committed}</p></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-400">Funded</p><p className="text-xl font-bold text-blue-600">{totals.disbursed}</p></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-400">Completed</p><p className="text-xl font-bold text-green-600">{totals.completed}</p></div>
      </div>

      {grants.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-slate-400">No grants yet.</p></div>
      ) : (
        <div className="space-y-3">
          {grants.map((g: any) => {
            const st = statusTag(g.status);
            return (
              <div key={Number(g.id)} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{g.org_name || "Donor"}</span>
                      <span className="text-xs text-slate-400">Grant #{Number(g.id)}</span>
                      <span className="text-xs text-slate-400">· PVO #{Number(g.pvo_id)}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{currency}{(Number(g.amount) / PPHP_SCALE).toLocaleString()} · {g.currency || "pPHP"}</p>
                  </div>
                  <span className={`badge ${statusColor(st)}`}>{statusLabel(g)}</span>
                </div>
                {g.donor && <p className="text-xs text-slate-400">Donor: <code className="text-[10px]">{String(g.donor).slice(0, 16)}...</code></p>}
                {g.created_at > 0 && <p className="text-xs text-slate-400 mt-1">Created: {new Date(Number(g.created_at) * 1000).toLocaleString()}</p>}
                {st === "Disbursed" && (
                  <button onClick={() => handleComplete(Number(g.id))} disabled={completing === Number(g.id)}
                    className="mt-2 text-xs px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                    {completing === Number(g.id) ? "..." : "✓ Mark Complete"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
