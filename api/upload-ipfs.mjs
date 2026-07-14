/**
 * IPFS Upload API - Vercel Serverless Function
 * Accepts JSON with text content, pins it to Pinata IPFS.
 *
 * POST /api/upload-ipfs
 * Body: { content: "..." }
 * Returns: { hash: "Qm...", url: "..." }
 */

import FormData from "form-data";

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
    const { content } = req.body || {};
    const text = content || "PoPV field evidence";

    const form = new FormData();
    form.append("file", Buffer.from(text, "utf-8"), {
      filename: "evidence.txt",
      contentType: "text/plain",
    });

    const pinataResp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        pinata_api_key: PINATA_KEY,
        pinata_secret_api_key: PINATA_SECRET,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!pinataResp.ok) {
      const errText = await pinataResp.text().catch(() => "");
      return res.status(502).json({ error: `Pinata error (${pinataResp.status}): ${errText.slice(0, 200)}` });
    }

    const data = await pinataResp.json();
    return res.status(200).json({ hash: data.IpfsHash, url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` });
  } catch (err) {
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Unknown error" });
  }
}
