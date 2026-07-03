import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { Client as CommunityOracleClient } from "../contracts/community_oracle/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, RPT_MIN_BALANCE } from "../config";
import { ReportType } from "../contracts/community_oracle/src";

const REPORT_TYPES = ["GpsPhoto","GpsVideo","FloodReport","CompletionVerification","QualityReport","DamageReport","UsageReport"] as const;

export default function CitizenReportForm() {
  const { address } = useWallet();
  const [pvoId, setPvoId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [reportType, setReportType] = useState<string>("GpsPhoto");
  const [dataHash, setDataHash] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const uploadToIPFS = async (f: File): Promise<string> => {
    const fd = new FormData(); fd.append("file", f);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST", body: fd,
      headers: { "pinata_api_key": (import.meta as any).env?.VITE_PINATA_API_KEY || "", "pinata_secret_api_key": (import.meta as any).env?.VITE_PINATA_SECRET || "" }
    });
    if (!res.ok) throw new Error("IPFS upload failed");
    const d = await res.json(); return d.IpfsHash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    let hash = dataHash;
    if (file) {
      setUploading(true); setMessage(null);
      try { hash = await uploadToIPFS(file); setDataHash(hash); setMessage({ text: `Uploaded! ${hash.slice(0,12)}...`, ok: true }); }
      catch (er: any) { setMessage({ text: `IPFS failed: ${er.message}`, ok: false }); setUploading(false); return; }
      setUploading(false);
    }
    if (!hash) { setMessage({ text: "Attach a photo or paste an IPFS hash.", ok: false }); return; }

    setSubmitting(true);
    setMessage({ text: "Simulating transaction...", ok: true });

    try {
      const { signTransaction } = await import("@stellar/freighter-api");

      const client = new CommunityOracleClient({
        contractId: CONTRACT_IDS.community_oracle,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
        publicKey: address,
      });

      const pvoNum = Number(pvoId);
      const milNum = Number(milestoneId);
      if (!pvoNum || pvoNum <= 0 || !milNum || milNum <= 0) {
        setMessage({ text: "❌ PVO ID and Milestone ID must be positive.", ok: false });
        setSubmitting(false); return;
      }

      const tag = REPORT_TYPES.indexOf(reportType as any) >= 0 ? reportType : "GpsPhoto";
      const gpsLat = lat ? Number(lat) : 0;
      const gpsLon = lon ? Number(lon) : 0;

      // Pass tag directly as string — generated client handles enum serialization
      const tx = await client.submit_report({
        citizen: address,
        pvo_id: pvoNum,
        milestone_id: milNum,
        report_type: { tag } as any,
        data_hash: hash,
        gps_lat: gpsLat as any,
        gps_lon: gpsLon as any,
      });

      setMessage({ text: "Check Freighter to sign...", ok: true });

      await tx.signAndSend({
        signTransaction: async (xdr: string) => {
          const resp = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE });
          if (resp?.error) throw new Error(resp.error.message || "Freighter rejected");
          return resp.signedTxXdr;
        },
      } as any);

      setMessage({ text: `Report submitted! ✅`, ok: true });
      setPvoId(""); setMilestoneId(""); setDataHash(""); setLat(""); setLon(""); setFile(null);
    } catch (er: any) {
      const msg = String(er?.message || er);
      if (msg.includes("insufficient") || msg.includes("balance")) setMessage({ text: "❌ Insufficient RPT balance.", ok: false });
      else if (msg.includes("trustline")) setMessage({ text: "❌ No RPT trustline.", ok: false });
      else if (msg.includes("rejected") || msg.includes("declined")) setMessage({ text: "Cancelled in Freighter.", ok: false });
      else setMessage({ text: `Error: ${msg.slice(0, 200)}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Community Report</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-700">
          <strong>🪙 RPT Required</strong><br/>Must hold {RPT_MIN_BALANCE}+ RPT to report.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={e => setPvoId(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Milestone ID</label>
            <input type="number" value={milestoneId} onChange={e => setMilestoneId(e.target.value)} className="input" required />
          </div>
        </div>
        <p className="text-xs text-slate-400 -mt-3">
          💡 <strong>PVO ID</strong> = project number. <strong>Milestone ID</strong> = specific milestone. Find them on the Public Portal.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <select value={reportType} onChange={e => setReportType(e.target.value)} className="select">
            {REPORT_TYPES.map(t => <option key={t} value={t}>{t.replace(/([A-Z])/g, " $1").trim()}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">📷 Photo/Video</label>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition" onClick={() => document.getElementById("fi")?.click()}>
            {file ? (
              <div className="text-sm"><span className="text-brand-600 font-medium">{file.name}</span><span className="text-slate-400 ml-2">({(file.size/1024).toFixed(1)} KB)</span></div>
            ) : (
              <div className="text-slate-400 text-sm"><span className="text-2xl block mb-1">📁</span>Click to attach</div>
            )}
            <input id="fi" type="file" accept="image/*,video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GPS Lat (microdegrees)</label>
            <input type="number" value={lat} onChange={e => setLat(e.target.value)} className="input" placeholder="14599512" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GPS Lon (microdegrees)</label>
            <input type="number" value={lon} onChange={e => setLon(e.target.value)} className="input" placeholder="120984220" />
          </div>
        </div>
        <button type="button" onClick={() => {
          navigator.geolocation.getCurrentPosition(
            p => { setLat(String(Math.round(p.coords.latitude * 1e6))); setLon(String(Math.round(p.coords.longitude * 1e6))); },
            () => setMessage({ text: "Location denied. Enter manually.", ok: false })
          );
        }} className="text-xs text-brand-600 hover:underline -mt-2">
          📍 Use my current location
        </button>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Or paste IPFS hash</label>
          <input type="text" value={dataHash} onChange={e => setDataHash(e.target.value)} className="input font-mono text-xs" placeholder="Qm..." />
        </div>

        <button type="submit" disabled={submitting || uploading} className="btn-primary w-full py-3">
          {uploading ? "Uploading to IPFS..." : submitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
