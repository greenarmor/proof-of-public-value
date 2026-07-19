export async function uploadToIPFS(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload-ipfs", {
    method: "POST",
    body: fd,
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
