import { useState } from "react";
import { NETWORK_PASSPHRASE } from "../config";

export function CreatePphpTrustline({ address }: { address: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const setup = async () => {
    setLoading(true); setMsg(null);
    try {
      const { Asset, Operation, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server("https://soroban-testnet.stellar.org:443");
      const acct = await server.getAccount(address);
      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.changeTrust({
          asset: new Asset("pPHP", "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV"),
        }))
        .setTimeout(30).build();
      const sr: any = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (sr?.error) throw new Error(sr.error.message || "Freighter signing failed");
      const signedTx = TransactionBuilder.fromXDR(sr.signedTxXdr, NETWORK_PASSPHRASE);
      const result = await server.sendTransaction(signedTx);
      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        setMsg({ text: "✅ pPHP trustline created! Admin can now mint pPHP.", ok: true });
      } else throw new Error(`Tx status: ${result.status}`);
    } catch (err: any) {
      if (err.message?.includes("already") || err.message?.includes("exist")) {
        setMsg({ text: "Trustline already exists!", ok: true });
      } else {
        setMsg({ text: `Failed: ${String(err?.message || err).slice(0, 150)}`, ok: false });
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
