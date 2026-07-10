import { useState, useEffect } from "react";
import { NETWORK_PASSPHRASE, CONTRACT_IDS, RPC_URL } from "../config";

export function CreatePphpTrustline({ address }: { address: string }) {
  const [pphpBalance, setPphpBalance] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { Contract, Address, rpc, TransactionBuilder, scValToBigInt } = await import("@stellar/stellar-sdk");
        const server = new rpc.Server(RPC_URL);
        const contract = new Contract(CONTRACT_IDS.pphp);
        const account = await server.getAccount(address);
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(contract.call("balance", new Address(address).toScVal()))
          .setTimeout(30)
          .build();
        const resp: any = await server.simulateTransaction(tx);
        if (!resp.isError?.() && resp.result?.retval) {
          const bal = scValToBigInt(resp.result.retval);
          setPphpBalance((Number(bal) / 10_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        } else {
          setPphpBalance("0");
        }
      } catch {
        setPphpBalance("0");
      }
    })();
  }, [address]);

  if (pphpBalance === null) return null;

  return (
    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <p className="text-sm text-emerald-700">
        <strong>🪙 pPHP Balance:</strong>{" "}
        {Number(pphpBalance) > 0 ? `${pphpBalance} pPHP` : "No pPHP balance"}
      </p>
    </div>
  );
}
