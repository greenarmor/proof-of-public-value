import { rpc } from "@stellar/stellar-sdk";
import { RPC_URL, CONTRACT_IDS } from "./config";

export function getServer(): rpc.Server {
  return new rpc.Server(RPC_URL);
}

export function getContractId(key: keyof typeof CONTRACT_IDS): string {
  return CONTRACT_IDS[key];
}

export function formatAddress(addr: string, chars = 6): string {
  if (!addr) return "";
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatBudget(budget: string | number | bigint): string {
  const num = typeof budget === "bigint" ? Number(budget) : Number(budget);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function statusToString(status: { tag: string }): string {
  if (!status || !status.tag) return "Unknown";
  return status.tag.replace(/([A-Z])/g, " $1").trim();
}
