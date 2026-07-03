import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { Client as CommunityOracleClient } from "../contracts/community_oracle/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";
import { formatAddress } from "../helpers";
import { RPT_ASSET, RPT_MIN_BALANCE } from "../config";

const REPORT_TYPES = ["GpsPhoto","GpsVideo","FloodReport","CompletionVerification","QualityReport","DamageReport","UsageReport"] as const;

export function CitizenInterface() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"browse"|"report"|"my">("browse");
  if (!connected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-7xl mb-6">📸</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Connect Your Wallet</h2>
      <p className="text-slate-500 mb-6 max-w-md">Browse projects, submit community reports, and track your civic reputation.</p>
      <button onClick={connect} className="btn-primary px-8 py-3 text-base">Connect Wallet</button>
    </div>
  );
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Citizen Interface</h1>
        <p className="text-slate-500">Browse, report, and track your civic impact.</p>
      </div>
      <CitizenDashboard />
      <div className="flex gap-0 mb-6 bg-slate-100 rounded-xl p-1">
        {(["browse","report","my"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab===tab?"bg-white text-brand-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            {tab==="browse"?"🗺️ Browse":tab==="report"?"📸 Report":"⭐ Reputation"}
          </button>
        ))}
      </div>
      {activeTab==="browse" && <CitizenBrowse />}
      {activeTab==="report" && <CitizenReport />}
      {activeTab==="my" && <CitizenReputation />}
    </div>
  );
}

function CitizenDashboard() {
  const { address } = useWallet();
  const [rptBalance, setRptBalance] = useState<number|null>(null);
  const [trustlineChecked, setTrustlineChecked] = useState(false);
  const [reputation, setReputation] = useState<any>(null);
  const [trustlineLoading, setTrustlineLoading] = useState(false);
  const [message, setMessage] = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    if (!address) return;
    setRptBalance(null); setTrustlineChecked(false);
    (async()=>{
      try {
        const client = new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL});
        const rep = await client.get_citizen_reputation({citizen:address});
        setReputation(rep.result);
      } catch {}
      try {
        const resp = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
        if (resp.ok) {
          const data = await resp.json();
          const b = data.balances?.find((b:any)=>b.asset_code==="RPT"&&b.asset_issuer==="GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
          setRptBalance(b?Math.floor(Number(b.balance)):0);
        } else setRptBalance(0);
      } catch { setRptBalance(0); }
      setTrustlineChecked(true);
    })();
  }, [address]);

  const setupTrustline = async () => {
    if (!address) return;
    setTrustlineLoading(true); setMessage(null);
    try {
      const { Asset, Operation, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tx = new TransactionBuilder(acct,{fee:"100000",networkPassphrase:NETWORK_PASSPHRASE}).addOperation(Operation.changeTrust({asset:new Asset("RPT","GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV")})).setTimeout(30).build();
      setMessage({text:"Check Freighter popup to sign...",ok:true});
      const sr:any = await signTransaction(tx.toXDR(),{networkPassphrase:NETWORK_PASSPHRASE});
      if (sr?.error) throw new Error(sr.error.message||"Freighter signing failed");
      const signedTx = TransactionBuilder.fromXDR(sr.signedTxXdr,NETWORK_PASSPHRASE);
      const result = await server.sendTransaction(signedTx);
      if (result.status==="PENDING"||result.status==="DUPLICATE") {
        setMessage({text:"✅ Trustline created! Admin can now mint RPT.",ok:true});
        setRptBalance(0); setTrustlineChecked(true);
      } else throw new Error(`Tx status: ${result.status}`);
    } catch (err: any) {
      if (err.message?.includes("already")||err.message?.includes("exist")) setMessage({text:"Trustline already exists!",ok:true});
      else setMessage({text:`Failed: ${err.message}`,ok:false});
    } finally { setTrustlineLoading(false); }
  };

  const canReport = rptBalance!==null && rptBalance>=RPT_MIN_BALANCE;
  const needsSetup = trustlineChecked && !canReport;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className={`card p-4 ${canReport?"border-emerald-200 bg-gradient-to-br from-emerald-50 to-white":"border-amber-200 bg-gradient-to-br from-amber-50 to-white"}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">🪙 RPT Token</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${canReport?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
            {canReport?"✅ Ready":"⚠️ Setup Needed"}
          </span>
        </div>
        {canReport ? (
          <div>
            <span className="text-3xl font-bold text-brand-600">{rptBalance}</span>
            <span className="text-sm text-slate-500 ml-1.5">RPT</span>
          </div>
        ) : needsSetup ? (
          <div>
            <p className="text-xs text-amber-700 mb-3">{rptBalance===0?"Trustline missing or 0 RPT":""}</p>
            <button onClick={setupTrustline} disabled={trustlineLoading}
              className="w-full py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition font-medium">
              {trustlineLoading?"Opening Freighter...":"🔓 Create RPT Trustline"}
            </button>
          </div>
        ) : <p className="text-xs text-slate-400">Checking RPT status...</p>}
        {message && <p className={`text-xs mt-2 ${message.ok?"text-emerald-600":"text-red-600"}`}>{message.text}</p>}
      </div>

      <div className="card p-4">
        <span className="font-semibold text-sm">⭐ Reputation</span>
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <div><div className="text-2xl font-bold text-brand-600">{reputation?.total_reports??0}</div><div className="text-[10px] text-slate-400 mt-0.5">Reports</div></div>
          <div><div className="text-2xl font-bold text-emerald-600">{reputation?.verified_reports??0}</div><div className="text-[10px] text-slate-400 mt-0.5">Verified</div></div>
          <div><div className="text-2xl font-bold text-blue-600">{reputation?.confidence_rating??50}%</div><div className="text-[10px] text-slate-400 mt-0.5">Confidence</div></div>
        </div>
        <div className="mt-3 progress-bar"><div className="progress-fill progress-purple" style={{width:`${reputation?.confidence_rating??50}%`}}/></div>
      </div>

      <div className="card p-4">
        <span className="font-semibold text-sm">⚡ Quick Actions</span>
        <div className="mt-3 space-y-2">
          <a href="#report" className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">📸 Submit Report</a>
          <a href="#browse" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700">🗺️ Browse Projects</a>
        </div>
      </div>
    </div>
  );
}

function CitizenBrowse() {
  const [reports,setReports]=useState<any[]>([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    try{const c=new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL});const cnt=await c.get_report_count();const items:any[]=[];for(let i=1;i<=Number(cnt.result)&&i<=20;i++){try{const r=await c.get_report({report_id:i});if(r.result)items.push(r.result)}catch{}}setReports(items)}catch(e){console.error(e)}finally{setLoading(false)}})()},[]);
  if(loading)return<div className="space-y-3">{[...Array(3)].map((_,i)=><div key={i}className="skeleton-shimmer h-20 rounded-xl"/>)}</div>;
  return( <div className="space-y-3">{reports.map((r:any)=>(<div key={r.id}className="card p-4"><div className="flex items-start justify-between mb-2"><div><span className="badge-green">{typeof r.report_type==="string"?r.report_type:r.report_type?.tag}</span><span className="ml-2 text-sm text-slate-500">PVO #{r.pvo_id}·M#{r.milestone_id}</span></div>{r.verified?<span className="badge-green">✅ Verified</span>:<span className="badge-amber">⏳ Pending</span>}</div><div className="text-xs text-slate-400">By {formatAddress(r.citizen)}·{r.confidence_score||0}% confidence</div></div>))}{reports.length===0&&<div className="text-center py-16 text-slate-400">No community reports yet.</div>}</div>);
}

function CitizenReport() {
  const{address}=useWallet();const[pvoId,setPvoId]=useState("");const[milestoneId,setMilestoneId]=useState("");const[reportType,setReportType]=useState("GpsPhoto");const[dataHash,setDataHash]=useState("");const[lat,setLat]=useState("");const[lon,setLon]=useState("");const[file,setFile]=useState<File|null>(null);const[uploading,setUploading]=useState(false);const[submitting,setSubmitting]=useState(false);const[message,setMessage]=useState<{text:string;ok:boolean}|null>(null);
  const uploadToIPFS=async(f:File):Promise<string>=>{const fd=new FormData();fd.append("file",f);const res=await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS",{method:"POST",body:fd,headers:{"pinata_api_key":(import.meta as any).env?.VITE_PINATA_API_KEY||"","pinata_secret_api_key":(import.meta as any).env?.VITE_PINATA_SECRET||""}});if(!res.ok)throw new Error("IPFS upload failed");const d=await res.json();return d.IpfsHash;};
  const handleSubmit=async(e:React.FormEvent)=>{e.preventDefault();if(!address)return;let hash=dataHash;if(file){setUploading(true);setMessage(null);try{hash=await uploadToIPFS(file);setDataHash(hash);setMessage({text:`Photo uploaded! Hash: ${hash.slice(0,12)}...`,ok:true})}catch(er:any){setMessage({text:`IPFS upload failed: ${er.message}`,ok:false});setUploading(false);return}setUploading(false)}if(!hash){setMessage({text:"Attach a photo or paste an IPFS hash.",ok:false});return}setSubmitting(true);try{const c=new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL,publicKey:address});const rm:Record<string,any>={};REPORT_TYPES.forEach(t=>{rm[t]={tag:t,values:void 0}});const tx=await c.submit_report({citizen:address,pvo_id:Number(pvoId),milestone_id:Number(milestoneId),report_type:rm[reportType],data_hash:hash,gps_lat:BigInt(lat||"0"),gps_lon:BigInt(lon||"0")});const r=await tx.signAndSend();setMessage({text:`Report #${r.result} submitted! ✅`,ok:true});setPvoId("");setMilestoneId("");setDataHash("");setLat("");setLon("");setFile(null)}catch(er:any){setMessage({text:`Error: ${er.message||er}`,ok:false})}finally{setSubmitting(false)}};
  return( <div className="card p-6 max-w-lg"><h2 className="text-lg font-semibold mb-4">Submit Community Report</h2>{message&&<div className={`mb-4 p-3 rounded-xl text-sm ${message.ok?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-red-50 text-red-700 border border-red-200"}`}>{message.text}</div>}<form className="space-y-4" onSubmit={handleSubmit}><div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-700"><strong>🪙 RPT Required</strong><br/>Must hold {RPT_MIN_BALANCE}+ RPT to report.</div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label><input type="number" value={pvoId} onChange={e=>setPvoId(e.target.value)}className="input" required/></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Milestone ID</label><input type="number" value={milestoneId} onChange={e=>setMilestoneId(e.target.value)}className="input" required/></div></div><p className="text-xs text-slate-400 -mt-3 leading-relaxed">💡 <strong>PVO ID</strong> = the project number (find it on the Public Portal). <strong>Milestone ID</strong> = specific milestone within that project (visible when viewing project details).</p><div><label className="block text-sm font-medium text-slate-700 mb-1">Type</label><select value={reportType} onChange={e=>setReportType(e.target.value)}className="select">{REPORT_TYPES.map(t=><option key={t} value={t}>{t.replace(/([A-Z])/g," $1").trim()}</option>)}</select></div><div><label className="block text-sm font-medium text-slate-700 mb-1">📷 Photo/Video</label><div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition" onClick={()=>document.getElementById("fi")?.click()}>{file?<div className="text-sm"><span className="text-brand-600 font-medium">{file.name}</span><span className="text-slate-400 ml-2">({(file.size/1024).toFixed(1)}KB)</span></div>:<div className="text-slate-400 text-sm"><span className="text-2xl block mb-1">📁</span>Click to attach</div>}<input id="fi" type="file" accept="image/*,video/*" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">GPS Lat</label><input type="number" value={lat} onChange={e=>setLat(e.target.value)}className="input" placeholder="14599512"/></div><div><label className="block text-sm font-medium text-slate-700 mb-1">GPS Lon</label><input type="number" value={lon} onChange={e=>setLon(e.target.value)}className="input" placeholder="120984220"/></div></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Or paste IPFS hash</label><input type="text" value={dataHash} onChange={e=>setDataHash(e.target.value)}className="input font-mono text-xs" placeholder="Qm..."/></div><button type="submit" disabled={submitting||uploading} className="btn-primary w-full py-3">{uploading?"Uploading to IPFS...":submitting?"Submitting...":"Submit Report"}</button></form></div>);
}

function CitizenReputation() {
  const{address}=useWallet();const[rep,setRep]=useState<any>(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{if(!address)return;(async()=>{try{const c=new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL});const r=await c.get_citizen_reputation({citizen:address});setRep(r.result)}catch(e){console.error(e)}finally{setLoading(false)}})()},[address]);
  if(loading)return<div className="skeleton-shimmer h-40 rounded-xl"/>;
  const t=rep?.total_reports??0;const v=rep?.verified_reports??0;const cf=rep?.confidence_rating??50;
  return( <div className="space-y-4"><div className="card p-6"><h2 className="text-lg font-semibold mb-4">Your Civic Reputation</h2><div className="grid grid-cols-3 gap-6 text-center"><div><div className="text-3xl font-bold text-brand-600">{t}</div><div className="text-sm text-slate-500 mt-1">Total</div></div><div><div className="text-3xl font-bold text-emerald-600">{v}</div><div className="text-sm text-slate-500 mt-1">Verified</div></div><div><div className="text-3xl font-bold text-blue-600">{cf}%</div><div className="text-sm text-slate-500 mt-1">Confidence</div></div></div><div className="mt-4 progress-bar"><div className="progress-fill progress-purple" style={{width:`${cf}%`}}/></div></div><div className="card p-5 mt-4"><h3 className="font-semibold mb-2">How It Works</h3><div className="space-y-2 text-sm text-slate-600"><p>• Submit verified reports → higher confidence</p><p>• Higher confidence → reports carry more weight</p><p>• GPS + photos = higher trust</p></div></div></div>);
}
