/**
 * IPFS Upload API - Vercel Serverless Function
 * Uploads citizen evidence (photos/videos) to Pinata IPFS.
 *
 * POST /api/upload-ipfs
 * Body: multipart/form-data with "file" field
 * Returns: { hash: "Qm...", url: "https://gateway.pinata.cloud/ipfs/..." }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PINATA_KEY = process.env.PINATA_API_KEY || process.env.VITE_PINATA_API_KEY;
  const PINATA_SECRET = process.env.PINATA_SECRET || process.env.VITE_PINATA_SECRET;

  if (!PINATA_KEY || !PINATA_SECRET) {
    return res.status(500).json({ error: "Pinata API keys not configured" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", req.body, { filename: "evidence.jpg", contentType: "image/jpeg" });

    const pinataResp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      body: form,
      headers: {
        pinata_api_key: PINATA_KEY,
        pinata_secret_api_key: PINATA_SECRET,
        ...form.getHeaders(),
      },
    });

    if (!pinataResp.ok) {
      const text = await pinataResp.text().catch(() => "");
      return res.status(502).json({ error: `Pinata error (${pinataResp.status}): ${text.slice(0, 200)}` });
    }

    const data = await pinataResp.json();
    const hash = data.IpfsHash;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      hash,
      url: `https://gateway.pinata.cloud/ipfs/${hash}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
