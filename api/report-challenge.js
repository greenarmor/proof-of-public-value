/**
 * Report Challenge API
 * Generates a challenge that the citizen must sign to prove wallet ownership.
 */

const challenges = new Map();

module.exports = async function handler(req, res) {
  const address = req.query.address;
  if (!address || !address.startsWith("G")) {
    return res.status(400).json({ error: "Valid address required" });
  }

  const challenge = `popv-report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  challenges.set(address, { challenge, expires: Date.now() + 300000 }); // 5 min expiry

  // Clean expired
  for (const [k, v] of challenges) {
    if (v.expires < Date.now()) challenges.delete(k);
  }

  return res.status(200).json({ challenge, expiresIn: 300 });
};
