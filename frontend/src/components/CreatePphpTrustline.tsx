import { useState } from "react";
import { NETWORK_PASSPHRASE } from "../config";

export function CreatePphpTrustline({ address }: { address: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const setup = async () => {
    setLoading(true); setMsg(null);
    try {
      const { TransactionBuilder, Operation, Asset, Horizon, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      // Classic Horizon server — ChangeTrust requires classic operations, not Soroban RPC
      const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
      const acct = await horizon.loadAccount(address);

      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.changeTrust({
          asset: new Asset("pPHP", "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV"),
        }))
        .setTimeout(30).build();

      const signed: any = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signed?.error) throw new Error(signed.error.message);

      const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
      await horizon.submitTransaction(signedTx);
      setMsg({ text: "✅ pPHP trustline created! Admin can now mint pPHP to you.", ok: true });
    } catch (e: any) {
      if (e.message?.includes("already") || e.message?.includes("exist")) {
        setMsg({ text: "Trustline already exists!", ok: true });
      } else {
        setMsg({ text: e.message?.slice(0, 120) || "Failed", ok: false });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
      {msg && (
        <div className={`mb-3 p-3 rounded-lg text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}
      <p className="text-sm text-purple-700 mb-2">
        <strong>🪙 pPHP Tokens:</strong> pPHP is the settlement token used in escrows. Create a trustline to receive and hold pPHP in your wallet.
      </p>
      <button onClick={setup} disabled={loading}
        className="btn-primary text-xs px-4 py-2">
        {loading ? "Opening Freighter..." : "🔓 Create pPHP Trustline"}
      </button>
    </div>
  );
}
