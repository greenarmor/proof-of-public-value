import { useState, useEffect, useRef } from "react";
import { useWallet } from "../wallet";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, RPT_MIN_BALANCE } from "../config";
import { uploadToIPFS } from "../ipfs";

const REPORT_TYPES = ["GpsPhoto","GpsVideo","FloodReport","CompletionVerification","QualityReport","DamageReport","UsageReport"] as const;

interface PVOOption { id: number; title: string; milestones: number[]; }
interface MilestoneOption { id: number; title: string; }

function Autosuggest({ label, value, options, onChange, placeholder }: {
  label: string; value: string; options: { id: number; title: string }[];
  onChange: (id: number) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? options.filter(o => o.title.toLowerCase().includes(query.toLowerCase()))
    : options.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} className="input" placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <div key={o.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-brand-50 border-b border-slate-100 last:border-0"
              onClick={() => { onChange(o.id); setQuery(o.title); setOpen(false); }}>
              <span className="text-slate-400 text-xs mr-2">#{o.id}</span>{o.title}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm text-slate-400">No matches</div>
      )}
    </div>
  );
}

export default function CitizenReportForm({ onDone }: { onDone?: () => void }) {
  const { address } = useWallet();
  const [pvoId, setPvoId] = useState(0);
  const [milestoneId, setMilestoneId] = useState(0);
  const [reportType, setReportType] = useState<string>("GpsPhoto");
  const [dataHash, setDataHash] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pvoOptions, setPvoOptions] = useState<PVOOption[]>([]);
  const [milestoneOptions, setMilestoneOptions] = useState<MilestoneOption[]>([]);
  const [loadingPVOs, setLoadingPVOs] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { Client } = await import("../contracts/pvo_core/src");
        const client = new Client({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const cnt = await client.get_pvo_count();
        const list: PVOOption[] = [];
        for (let i = 1; i <= Number(cnt.result); i++) {
          const r = await client.get_pvo({ pvo_id: i });
          if (r.result) list.push({ id: r.result.id, title: r.result.title, milestones: r.result.milestones as number[] });
        }
        setPvoOptions(list);
      } catch {} finally { setLoadingPVOs(false); }
    })();
  }, []);

  useEffect(() => {
    if (!pvoId) { setMilestoneOptions([]); return; }
    (async () => {
      try {
        const { Client } = await import("../contracts/pvo_core/src");
        const client = new Client({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_pvo_milestones({ pvo_id: pvoId });
        const milestones = (result.result || []) as any[];
        setMilestoneOptions(milestones.map((m: any) => ({ id: Number(m.id), title: m.title })));
      } catch { setMilestoneOptions([]); }
    })();
  }, [pvoId]);

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
      const { TransactionBuilder, Contract, Address, rpc, xdr, nativeToScVal } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      if (!pvoId || pvoId <= 0 || !milestoneId || milestoneId <= 0) {
        setMessage({ text: "❌ Select a PVO and milestone.", ok: false }); setSubmitting(false); return;
      }

      const tag = REPORT_TYPES.indexOf(reportType as any) >= 0 ? reportType : "GpsPhoto";

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.community_oracle);
      const op = contract.call("submit_report",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        xdr.ScVal.scvU32(milestoneId),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(tag)]),
        xdr.ScVal.scvString(hash),
        nativeToScVal(Number(lat || 0), { type: "i128" } as any),
        nativeToScVal(Number(lon || 0), { type: "i128" } as any),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setMessage({ text: "Check Freighter to sign...", ok: true });

      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);

      setMessage({ text: `Report submitted! ✅`, ok: true });
      setPvoId(0); setMilestoneId(0); setDataHash(""); setLat(""); setLon(""); setFile(null);
      if (onDone) setTimeout(onDone, 1500);
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
    <>
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
          {loadingPVOs ? (
            <div className="col-span-2 text-sm text-slate-400">Loading projects...</div>
          ) : (
            <>
              <Autosuggest label="PVO" value={String(pvoId)} options={pvoOptions}
                onChange={id => { setPvoId(id); setMilestoneId(0); }} placeholder="Search by project name..." />
              <Autosuggest label="Milestone" value={String(milestoneId)} options={milestoneOptions}
                onChange={setMilestoneId} placeholder={pvoId ? "Search milestone..." : "Select a PVO first"} />
            </>
          )}
        </div>

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
    </>
  );
}
