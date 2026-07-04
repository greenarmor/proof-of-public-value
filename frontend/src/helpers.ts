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

// System role wallets — only these get stellar.expert links
const ROLE_WALLETS = new Set([
  "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV",
  "GAUMOR3FOVZCUPUZGFGORYWXQVE7IDAI7XTZCWNOL3EKK6GI3F4KGYDN",
  "GAZENYNRLICJYECZ66IGSOHH2N246P3CGZMI2DJ2G3RFK6A5WF42LPRW",
  "GB7JLZ33J643CIAKC3APGMTVD2MAYNFI3C4EDDOOYVHOKTWVMDHJ42MN",
  "GC7KDB6WJXNE7SJH3ZITQ56MNHGJGKXBS47IUBUMBLZFHHXQXFPDICSI",
  "GC3E277DKK7C7AIQ5G4G632RRPSWJBX33DB4OB54SS3XEKUY6EW5Z5F7",
  "GAXUYK7RP3TWWOOBRDQJ7FBVG5C7ZF2PUQ3AAT2JA2U2QEMI5MUGO4OK",
  "GAETC2ETXVK452VRPIWXA25TCQFSP6TYSPOSTC6UXM7AJFMZOK3LB33T",
  "GACVW3NYKARN3C7TJFQVVTOVRPD5BF3KCQDSYUMSEDBGYPFBWWMF7OTC",
  "GBVHSRHLDZPZ6A7VIYS6G572OHI2WEW24Q4GGRFZBLY2ZGPM3LHPSEZF",
  "GDUOHRAMDVFJKC4DOLF2OFGTQXL7NSZASZUNN5IZEXR3ZPQVBWMRW76D",
  "GAKJTLALTPWV4DLQGUCBMSO36EL3YIXK6X774D27Q3HBIR4GPDX2BL5J",
  "GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES",
]);

// Sensitive wallets — never linked to protect funders from OSINT
const BLOCKED_WALLETS = new Set([
  "GBVHSRHLDZPZ6A7VIYS6G572OHI2WEW24Q4GGRFZBLY2ZGPM3LHPSEZF", // funding_agency
  "GDUOHRAMDVFJKC4DOLF2OFGTQXL7NSZASZUNN5IZEXR3ZPQVBWMRW76D", // international_donor
]);

export function isRoleWallet(addr: string): boolean {
  return ROLE_WALLETS.has(addr);
}

export function isBlockedWallet(addr: string): boolean {
  return BLOCKED_WALLETS.has(addr);
}

export function formatBudget(budget: string | number | bigint): string {
  const str = typeof budget === "string" ? budget.replace(/,/g, "") : String(budget);
  const num = Number(str);
  if (isNaN(num)) return "0";
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
