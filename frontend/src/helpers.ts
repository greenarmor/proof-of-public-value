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
  "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV", // Administrator (Alice)
  "GCHNRJGVPQXIDC3AOCZMLBLFUSGOELDBHO4NG637H67RULGSOIZYJOAH", // Citizen (Bob)
  "GCLKPYQALOM6WKX3LSJ3OA2STGPZIOZY4B6NUDPWJHTFRSMBLJEJE4ES", // Citizen
  "GCSABAMCW3TBATE43TQWCH3YKSHPHCIGCKL44DWSJHKFOLDSZGWA72CZ", // Engineer
  "GAPFYWRZYETAWKY4G7VCAAIZ64PZLMDF4MWRYYTLRU4QTN6RLXSXQNGV", // Inspector
  "GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF", // Contractor
  "GCOWOAKYKW3PNKY6HBVTHRJBXBQ3PT2V4N6KGR3ROMKLMUSVDJVYLGMM", // Supplier
  "GDLLOPL2UMTGK2QW62IIJTEANBO4NX5QP4TEJAOP67SCDVG2D5AIY5X2", // GovernmentAgency
  "GAAL24R63KQJADAOLLMC6PLK7VZW2VCYBDLJYHT6X73NY73W7R4XIAYN", // Auditor
  "GCDE4KUZV7JC7RGESQYCBKKK2ALB6B7HTALB3KYIACGKNVKTVAMKSFJB", // CommissionOnAudit
  "GBU4SHHRZPIHJL3BX6LYQMS5WW4HYXENBHSUHSEFPZQCZQ25ZOQWC6E7", // AntiCorruptionAgency
  "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO", // FundingAgency
  "GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44", // InternationalDonor
  "GATLFXDNY2OIRX437GHRWR5CWFV7EQ7ORNYIND7APGNGU3HCNYI45AWW", // AIAuditor
]);

// Sensitive wallets — never linked to protect funders from OSINT
const BLOCKED_WALLETS = new Set([
  "GBM5YDPFH5NI7IRLHYFGLBAAIZGBOO5WGQQRNG3YWLTLHVF7GVJZ5PBO", // funding_agency
  "GBUI4XJKULCT25R4TVDYFIJXV74FTR65WYCP3F4XYAC6DQ4LHUYBEV44", // international_donor
]);

export function isRoleWallet(addr: string): boolean {
  return ROLE_WALLETS.has(addr);
}

export function isBlockedWallet(addr: string): boolean {
  return BLOCKED_WALLETS.has(addr);
}

export function formatBudget(budget: string | number | bigint): string {
  // PVO budgets are stored in centavos (2 decimals). Divide by 100 for pesos.
  const str = typeof budget === "string" ? budget.replace(/,/g, "") : String(budget);
  const num = Number(str) / 100;
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
