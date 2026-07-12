import { ipfsGatewayUrl } from "../ipfs";

export function IpfsLink({ hash, short = false }: { hash?: string; short?: boolean }) {
  if (!hash || hash === "0" || hash.length < 10) return null;
  const isIpfs = hash.startsWith("Qm") || hash.startsWith("baf");
  if (!isIpfs) return null;
  return (
    <a
      href={ipfsGatewayUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:text-indigo-800 underline text-xs font-mono inline-flex items-center gap-1"
    >
      📄 {short ? hash.slice(0, 12) + "..." : hash.slice(0, 24) + "..."}
    </a>
  );
}
