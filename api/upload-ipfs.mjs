/**
 * IPFS Upload API - Vercel Serverless Function
 * Pins citizen evidence (text or base64 image) to Pinata IPFS via pinJSONToIPFS.
 *
 * POST /api/upload-ipfs
 * Body: { content?: "...", image?: "base64..." }
 * Returns: { hash: "Qm...", url: "..." }
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
    const { content, image } = req.body || {};

    const pinataContent = image && image.length > 100
      ? { image, contentType: "image/jpeg", timestamp: new Date().toISOString(), type: "field_evidence" }
      : { text: content || "PoPV field evidence", timestamp: new Date().toISOString(), type: "field_evidence" };

    const body = JSON.stringify({
      pinataContent,
      pinataMetadata: {
        name: image ? "popv-photo" : "popv-evidence",
        keyvalues: { app: "popv", type: "field-report" },
      },
    });

    const pinataResp = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: PINATA_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
      body,
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
