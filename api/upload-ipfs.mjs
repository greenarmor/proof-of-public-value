/**
 * IPFS Upload API - Vercel Serverless Function
 * Pins citizen evidence to Pinata IPFS.
 *
 * POST /api/upload-ipfs
 * Body: { content: "..." }
 * Returns: { hash: "Qm...", url: "..." }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PINATA_KEY = process.env.PINATA_API_KEY || process.env.VITE_PINATA_API_KEY;
  const PINATA_SECRET = process.env.PINATA_SECRET || process.env.VITE_PINATA_SECRET;

  // Debug: show what vars are available
  if (!PINATA_KEY || !PINATA_SECRET) {
    return res.status(500).json({
      error: "Pinata API keys not configured",
      debug: {
        has_pinata_key: !!process.env.PINATA_API_KEY,
        has_pinata_secret: !!process.env.PINATA_SECRET,
        has_vite_key: !!process.env.VITE_PINATA_API_KEY,
        has_vite_secret: !!process.env.VITE_PINATA_SECRET,
        env_keys: Object.keys(process.env).filter(k => k.toLowerCase().includes('pinata') || k.toLowerCase().includes('api_key') || k.toLowerCase().includes('secret')).slice(0, 10),
      }
    });
  }

  try {
    const { content } = req.body || {};
    const text = content || "PoPV field evidence";

    // Pin JSON content - includes text + metadata
    const body = JSON.stringify({
      pinataContent: {
        text: text,
        timestamp: new Date().toISOString(),
        type: "field_evidence",
      },
      pinataMetadata: {
        name: "popv-evidence",
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
