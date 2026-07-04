import { formatAddress, isRoleWallet } from "../helpers";
import { useWallet } from "../wallet";

export function WalletAddress({ addr, chars = 6, className = "" }: {
  addr: string; chars?: number; className?: string;
}) {
  const { address: connectedAddress } = useWallet();

  if (!addr) return <span className={className}>—</span>;

  const isContract = addr.startsWith("C");
  const userHasRole = connectedAddress ? isRoleWallet(connectedAddress) : false;
  const canLink = isContract || (userHasRole && isRoleWallet(addr));
  const display = formatAddress(addr, chars);

  if (!canLink) return <span className={className}>{display}</span>;

  const type = isContract ? "contract" : "account";
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/${type}/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} text-brand-600 hover:text-brand-800 hover:underline transition-colors`}
      title={`View on Stellar.Expert`}
    >
      {display}
    </a>
  );
}
