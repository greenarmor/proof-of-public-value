const PINATA_KEY = import.meta.env.VITE_PINATA_API_KEY || "";
const PINATA_SECRET = import.meta.env.VITE_PINATA_SECRET || "";

export async function uploadToIPFS(file: File): Promise<string> {
  if (!PINATA_KEY || !PINATA_SECRET) {
    throw new Error("Pinata API keys not configured");
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    body: fd,
    headers: {
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IPFS upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const d = await res.json();
  return d.IpfsHash;
}

export function ipfsGatewayUrl(hash: string): string {
  const clean = hash.startsWith("Qm") ? hash : hash;
  return `https://gateway.pinata.cloud/ipfs/${clean}`;
}
