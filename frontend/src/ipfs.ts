export async function uploadToIPFS(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    body: fd,
    headers: {
      pinata_api_key: (import.meta as any).env?.VITE_PINATA_API_KEY || "",
      pinata_secret_api_key: (import.meta as any).env?.VITE_PINATA_SECRET || "",
    },
  });
  if (!res.ok) throw new Error("IPFS upload failed");
  const d = await res.json();
  return d.IpfsHash;
}

export function ipfsGatewayUrl(hash: string): string {
  const clean = hash.replace("Qm", "").startsWith("Qm") ? hash : hash;
  return `https://gateway.pinata.cloud/ipfs/${clean}`;
}
