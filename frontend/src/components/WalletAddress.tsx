import { formatAddress, isRoleWallet } from "../helpers";

export function WalletAddress({ addr, chars = 6, className = "" }: { addr: string; chars?: number; className?: string }) {
  if (!addr) return <span className={className}>—</span>;
  if (!isRoleWallet(addr)) return <span className={className}>{formatAddress(addr, chars)}</span>;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/account/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} text-brand-600 hover:text-brand-800 hover:underline transition-colors`}
      title={`View ${addr.slice(0, 12)}... on Stellar.Expert`}
    >
      {formatAddress(addr, chars)}
    </a>
  );
}
