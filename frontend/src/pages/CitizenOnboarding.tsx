import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL } from "../config";
import { signTransaction } from "@stellar/freighter-api";
import { Asset, Operation, TransactionBuilder, rpc } from "@stellar/stellar-sdk";

const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

type ClaimState = "idle" | "checking" | "needs-trustline" | "adding-trustline" | "claiming" | "assigning-role" | "done" | "error";

export function CitizenOnboarding() {
  const { address, connected, connect, roles } = useWallet();
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [rptBalance, setRptBalance] = useState<number | null>(null);

  const isNoRole = connected && roles.length === 0;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${HORIZON_URL}/accounts/${address}`);
        if (!resp.ok) return;
        const data = await resp.json();
        const b = data.balances?.find(
          (b: any) => b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER,
        );
        if (!cancelled) setRptBalance(b ? Math.floor(Number(b.balance)) : 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [address]);

  // Auto-check RPT status when no-role user connects
  useEffect(() => {
    if (isNoRole && rptBalance === 0 && claimState === "idle") {
      setClaimState("needs-trustline");
    }
    if (isNoRole && rptBalance !== null && rptBalance >= 1 && claimState === "idle") {
      setClaimState("done");
    }
  }, [isNoRole, rptBalance, claimState]);

  const addTrustline = async () => {
    if (!address) return;
    setClaimState("adding-trustline");
    setErrorMsg("");
    try {
            const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tx = new TransactionBuilder(acct, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset("RPT", RPT_ISSUER),
          }),
        )
        .setTimeout(30)
        .build();

      const sr: any = await signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (sr?.error) throw new Error(sr.error.message || "Signing failed");
      const signedTx = TransactionBuilder.fromXDR(sr.signedTxXdr, NETWORK_PASSPHRASE);
      const result = await server.sendTransaction(signedTx);
      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        await new Promise((r) => setTimeout(r, 3000));
        claimRpt();
      } else {
        throw new Error(`Transaction status: ${result.status}`);
      }
    } catch (err: any) {
      if (err.message?.includes("already") || err.message?.includes("exist")) {
        claimRpt();
      } else {
        setErrorMsg(err.message || "Failed to add trustline");
        setClaimState("error");
      }
    }
  };

  const requestCitizenRole = async () => {
    if (!address) return;
    setClaimState("assigning-role");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/claim-citizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Role assignment failed");
      }
      setClaimState("done");
    } catch (err: any) {
      setErrorMsg(`Got RPT but role assignment failed: ${err.message}. An admin can assign your role manually.`);
      setClaimState("error");
    }
  };

  const claimRpt = async () => {
    if (!address) return;
    setClaimState("claiming");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/claim-rpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.needsTrustline) {
          setClaimState("needs-trustline");
          return;
        }
        throw new Error(data.error || "Claim failed");
      }
      if (data.alreadyOwned) {
        setRptBalance(1);
        requestCitizenRole();
        return;
      }
      setRptBalance(1);
      requestCitizenRole();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to claim RPT");
      setClaimState("error");
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">🏛️</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Proof of Public Value</h2>
        <p className="text-slate-500 mb-6 max-w-md">Connect your Freighter wallet to begin your journey as a citizen guardian of public funds.</p>
        <button onClick={connect} className="btn-primary px-8 py-4 text-lg">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🤝</div>
        <h1 className="text-3xl font-bold text-slate-900">You Are the Final Gate</h1>
        <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
          In PoPV, citizens are the most powerful participants. You verify that government projects are real  -  on the ground, with your own eyes. Your reports become cryptographic proof that funds should be released.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">1 RPT</p>
          <p className="text-xs text-slate-400 mt-1">Citizen Credential</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">Gate 3 & 4</p>
          <p className="text-xs text-slate-400 mt-1">Your Verification Gates</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">₱0</p>
          <p className="text-xs text-slate-400 mt-1">Cannot be released without you</p>
        </div>
      </div>

      {/* RPT Credential Card - auto for no-role users */}
      {isNoRole && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">🎫</div>
            <div>
              <h3 className="font-semibold text-slate-900">Get Your Citizen Credential</h3>
              <p className="text-xs text-slate-400">1 RPT (Reporting Token) is required to submit field reports</p>
            </div>
          </div>

          {/* Status indicators */}
          {claimState === "done" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-emerald-700 font-medium">✅ You have 1 RPT! You can now submit citizen reports.</p>
              <a href="/citizen" className="inline-block mt-3 btn-primary px-6 py-2 text-sm">📸 Go to Citizen Interface</a>
            </div>
          )}

          {claimState === "needs-trustline" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-blue-700 text-sm mb-3">Step 1: Add RPT trustline to your wallet, then we will mint 1 RPT to you automatically.</p>
              <button onClick={addTrustline} className="btn-primary px-6 py-2.5 text-sm">
                📝 Add RPT Trustline
              </button>
              <p className="text-xs text-slate-400 mt-2">Opens Freighter to sign the trustline transaction</p>
            </div>
          )}

          {claimState === "adding-trustline" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 text-sm animate-pulse">⏳ Adding trustline... Check Freighter popup.</p>
            </div>
          )}

          {claimState === "claiming" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 text-sm animate-pulse">⏳ Minting 1 RPT to your wallet...</p>
            </div>
          )}

          {claimState === "assigning-role" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 text-sm animate-pulse">⏳ Assigning Citizen role on-chain...</p>
            </div>
          )}

          {claimState === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 text-sm mb-3">❌ {errorMsg}</p>
              <button onClick={() => setClaimState("needs-trustline")} className="btn-secondary px-6 py-2 text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* Show current balance */}
          {rptBalance !== null && rptBalance > 0 && claimState === "done" && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span>Balance: {rptBalance} RPT</span>
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">How You Protect Public Money</h2>
        <div className="space-y-3">
          {[
            { step: 1, icon: "🎫", title: "Get Your RPT Credential", desc: "RPT (Reporting Token) is your citizen credential. 1 RPT = your voice counts. Add a trustline and claim it automatically, no admin needed." },
            { step: 2, icon: "🔍", title: "Find a Project Near You", desc: "Browse the Public Transparency Portal for projects in your area. Each PVO card shows location, budget, and progress. Click into any project to see its full detail  -  including which milestones still need community verification." },
            { step: 3, icon: "📸", title: "Visit the Site & Report", desc: "Go to the project location. Take GPS-tagged photos. Submit your report through the Citizen Interface. Your coordinates are validated against the project's expected location. Only reports within range count." },
            { step: 4, icon: "✅", title: "Verify Other Citizens' Reports", desc: "Gate 3 (Community Oracle) requires verified field reports from multiple independent citizens. No single person can pass this gate alone. Community consensus is required." },
            { step: 5, icon: "🔐", title: "Confirm the Gate", desc: "Once enough verified reports exist, you confirm the Community Gate (Gate 4). This is the final lock  -  funds cannot be released until citizens say the work is real." },
          ].map((item) => (
            <div key={item.step} className="card p-4 flex gap-4">
              <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">{item.icon}</div>
              <div>
                <h3 className="font-semibold text-slate-900">Step {item.step}: {item.title}</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why It Matters */}
      <div className="card p-6 bg-brand-50 border-brand-200">
        <h2 className="font-bold text-slate-900 mb-3">Why Your Participation Matters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-1">
            <p><strong>Without citizens:</strong></p>
            <p className="text-red-600">✗ Ghost projects go undetected</p>
            <p className="text-red-600">✗ Contractors paid for work never done</p>
            <p className="text-red-600">✗ No ground-truth verification</p>
          </div>
          <div className="space-y-1">
            <p><strong>With citizens:</strong></p>
            <p className="text-emerald-600">✓ Every project verified by real people</p>
            <p className="text-emerald-600">✓ Cryptographic proof on Stellar blockchain</p>
            <p className="text-emerald-600">✓ No peso released without community consensus</p>
          </div>
        </div>
        <p className="text-xs text-brand-600 mt-4 font-medium">
          "No proof. No payment. The citizens are the proof."
        </p>
      </div>

      {/* Get Started */}
      <div className="text-center space-y-3 pb-8">
        <h2 className="text-xl font-bold text-slate-900">Ready to Start?</h2>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/portal" className="btn-primary px-6 py-3">🏛️ Browse Projects</a>
          <a href="/citizen" className="btn-secondary px-6 py-3">📸 Citizen Interface</a>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Connected as: <code className="text-[11px]">{address?.slice(0, 16)}...</code>
        </p>
      </div>
    </div>
  );
}
