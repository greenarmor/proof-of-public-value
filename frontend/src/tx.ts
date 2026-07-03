import { rpc } from "@stellar/stellar-sdk";
import { RPC_URL } from "./config";

export class TxError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly diagnostic?: string,
  ) {
    super(message);
    this.name = "TxError";
  }
}

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 120_000;

const server = new rpc.Server(RPC_URL);

export async function invokeWithRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      const delay = 1000 * Math.pow(2, i);
      console.warn(`RPC retry ${i + 1}/${retries} in ${delay}ms: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

export async function pollTx(txHash: string, timeoutMs = MAX_POLL_MS): Promise<rpc.Api.GetTransactionResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await invokeWithRetry(() => server.getTransaction(txHash));
      if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) return tx;
      if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new TxError("Transaction failed", "TX_FAILED", JSON.stringify(tx));
      }
    } catch (err) {
      if (err instanceof TxError) throw err;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new TxError("Transaction timed out");
}

export function formatError(err: unknown): string {
  if (err instanceof TxError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function getServer(): rpc.Server {
  return server;
}
