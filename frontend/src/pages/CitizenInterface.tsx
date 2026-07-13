import { useState, useEffect } from "react";
import { useWallet } from "../wallet";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { Client as CommunityOracleClient } from "../contracts/community_oracle/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";
import { formatAddress } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { IpfsLink } from "../components/IpfsLink";
import { RPT_ASSET, RPT_MIN_BALANCE } from "../config";

export function CitizenInterface() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"browse"|"my">("browse");
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
        <p className="text-slate-500">Hunt PVOs, submit reports, earn reputation.</p>
      </div>
      <CitizenDashboard />
      <PvoHunter />
      <div className="flex items-center justify-between mb-6 bg-slate-100 rounded-xl p-1">
        {(["browse","my"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab===tab?"bg-white text-brand-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            {tab==="browse"?"🗺️ Browse":"⭐ Reputation"}
          </button>
        ))}
      </div>
      {activeTab==="browse" && <CitizenBrowse />}
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
          <span className="font-semibold text-sm">🪙 Wallet</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${canReport?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
            {canReport?"✅ Ready":"⚠️ Setup Needed"}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">RPT</span>
            <span className="text-lg font-bold text-brand-600">{rptBalance ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="text-xs text-slate-400">pPHP</span>
            <PphpBalanceInline address={address!} />
          </div>
        </div>
        {!canReport && needsSetup && (
          <button onClick={setupTrustline} disabled={trustlineLoading}
            className="w-full mt-3 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition font-medium">
            {trustlineLoading?"Opening Freighter...":"🔓 Create RPT Trustline"}
          </button>
        )}
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
          <a href="/portal" className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">🏛️ Browse Projects & Report</a>
          <a href="#browse" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700">⭐ My Reports</a>
        </div>
      </div>
    </div>
  );
}

function CitizenBrowse() {
  const { address } = useWallet();
  const [reports,setReports]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[verifying,setVerifying]=useState<number|null>(null);const[vmsg,setVmsg]=useState<string|null>(null);
  useEffect(()=>{(async()=>{
    try{const c=new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL});const cnt=await c.get_report_count();const items:any[]=[];for(let i=1;i<=Number(cnt.result)&&i<=20;i++){try{const r=await c.get_report({report_id:i});if(r.result)items.push(r.result)}catch{}}setReports(items)}catch(e){console.error(e)}finally{setLoading(false)}})()},[]);

  const doVerify = async (reportId: number, weight: number) => {
    if (!address) return;
    setVerifying(reportId); setVmsg(null);
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.community_oracle);
      const op = contract.call("verify_report",
        new Address(address).toScVal(),  // verifier: Address
        xdr.ScVal.scvU32(reportId),       // report_id: u32
        xdr.ScVal.scvU32(weight),         // verifier_weight: u32
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try {
        await server.sendTransaction(signedTx);
      } catch (e: any) {
        // Ignore result parsing errors - transaction was submitted
        if (!e.message?.includes("switch") && !e.message?.includes("undefined")) throw e;
      }
      setVmsg(`Report #${reportId} verified with weight ${weight}! ✅`);
    } catch(er:any) { setVmsg(`Error: ${er.message?.slice(0,150)}`); }
    finally { setVerifying(null); }
  };

  if(loading) return <BlockchainLoader text="Loading community reports..." />;
  return( <div className="space-y-3">
    {vmsg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{vmsg}</div>}
    {reports.map((r:any)=>(<div key={r.id}className="card p-4"><div className="flex items-start justify-between mb-2"><div><span className="badge-green">{typeof r.report_type==="string"?r.report_type:r.report_type?.tag}</span><span className="ml-2 text-sm text-slate-500">PVO #{r.pvo_id}·M#{r.milestone_id}</span></div>{r.verified?<span className="badge-green">✅ Verified</span>:<span className="badge-amber">⏳ Pending</span>}</div>
      <div className="text-xs text-slate-400 mb-2">By <WalletAddress addr={r.citizen}/>·{r.confidence_score||0}% confidence {r.citizen===address&&<span className="text-brand-600 font-medium ml-1">(You)</span>}<IpfsLink hash={r.data_hash} short /></div>
      {!r.verified && r.citizen !== address && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
          <button onClick={()=>doVerify(r.id,30)} disabled={verifying===r.id} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">✅ Verify (30%)</button>
          <button onClick={()=>doVerify(r.id,10)} disabled={verifying===r.id} className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">⚠️ Low (10%)</button>
          <button onClick={()=>doVerify(r.id,60)} disabled={verifying===r.id} className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">💎 High (60%)</button>
        </div>
      )}
    </div>))}{reports.length===0&&<div className="text-center py-16 text-slate-400">No community reports yet.</div>}</div>);
}

function PvoHunter() {
  const { roles } = useWallet();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const HUNT_RADIUS_KM = 10;

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const startHunt = () => {
    if (!navigator.geolocation) { setError("GPS not supported"); return; }
    setScanning(true); setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setPosition({ lat: userLat, lng: userLng });
        try {
          const { Client: PC } = await import("../contracts/pvo_core/src");
          const pc = new PC({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
          const cnt = await pc.get_pvo_count();
          const found: any[] = [];
          for (let i = 1; i <= Number(cnt.result); i++) {
            try {
              const r = await pc.get_pvo({ pvo_id: i });
              if (!r.result) continue;
              const desc = r.result.description || "";
              const coordMatch = desc.match(/^\[(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\]/);
              if (!coordMatch) continue;
              const pvoLat = parseFloat(coordMatch[1]);
              const pvoLng = parseFloat(coordMatch[2]);
              const dist = haversine(userLat, userLng, pvoLat, pvoLng);
              if (dist <= HUNT_RADIUS_KM) {
                found.push({ id: i, title: r.result.title, municipality: r.result.municipality, distance: dist, lat: pvoLat, lng: pvoLng });
              }
            } catch {}
          }
          found.sort((a, b) => a.distance - b.distance);
          setNearby(found);
        } catch { setError("Failed to load PVOs"); }
        setScanning(false);
      },
      () => { setError("GPS denied — enable location to hunt"); setScanning(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const isCitizen = roles.includes("Citizen") || roles.includes("Administrator");
  if (!isCitizen) return null;

  return (
    <div className="card p-5 mb-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-indigo-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📍</span>
          <div>
            <h3 className="font-bold text-slate-900">PVO Hunter</h3>
            <p className="text-xs text-slate-500">Find government projects near you</p>
          </div>
        </div>
        <button onClick={startHunt} disabled={scanning} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${scanning ? "bg-indigo-200 text-indigo-400" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"}`}>
          {scanning ? "🔍 Scanning..." : position ? "🔄 Re-Scan" : "🔍 Scan Area"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {position && !scanning && (
        <p className="text-xs text-slate-400 mb-2">Your position: {position.lat.toFixed(4)}, {position.lng.toFixed(4)} · Radius: {HUNT_RADIUS_KM}km</p>
      )}
      {nearby.length === 0 && position && !scanning && (
        <div className="text-center py-6 text-slate-400">
          <p className="text-4xl mb-2">🌍</p>
          <p className="text-sm">No PVOs within {HUNT_RADIUS_KM}km</p>
          <p className="text-xs mt-1">Try a different location or increase the radius</p>
        </div>
      )}
      {nearby.length > 0 && (
        <div className="space-y-2">
          {nearby.map((pvo) => {
            const distStr = pvo.distance < 1 ? `${Math.round(pvo.distance * 1000)}m` : `${pvo.distance.toFixed(1)}km`;
            const rarity = pvo.distance < 0.5 ? "🟡 Legendary" : pvo.distance < 2 ? "🟣 Rare" : pvo.distance < 5 ? "🔵 Uncommon" : "⚪ Common";
            return (
              <a key={pvo.id} href={`/portal?pvo=${pvo.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/80 hover:bg-white border border-slate-200 hover:border-indigo-300 transition-all hover:scale-[1.02] cursor-pointer">
                <div className="text-3xl">{pvo.distance < 1 ? "🏆" : pvo.distance < 3 ? "🏗️" : "📋"}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">#{pvo.id} {pvo.title}</p>
                  <p className="text-xs text-slate-500">{pvo.municipality} · <span className="text-indigo-600 font-medium">{distStr}</span> away · {rarity}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">📸 Report</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PphpBalanceInline({ address }: { address: string }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [hasTl, setHasTl] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
        if (!r.ok) { setHasTl(false); return; }
        const data = await r.json();
        const b = data.balances?.find((b: any) =>
          b.asset_code === "pPHP" && b.asset_issuer === "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO"
        );
        if (b) {
          setBalance(Number(b.balance).toLocaleString());
          setHasTl(true);
        } else {
          setHasTl(false);
        }
      } catch { setHasTl(false); }
    })();
  }, [address]);

  if (hasTl === null) return <span className="text-xs text-slate-400">...</span>;
  if (!hasTl) return <CreatePphpTrustlineButton address={address} />;
  return <span className="text-lg font-bold text-purple-600">{balance ?? "0"}</span>;
}

function CreatePphpTrustlineButton({ address }: { address: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const addTl = async () => {
    setLoading(true);
    try {
      const { Asset, Operation, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.changeTrust({ asset: new Asset("pPHP", "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO") }))
        .setTimeout(30).build();
      const sr = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      const signedTx = TransactionBuilder.fromXDR(sr.signedTxXdr, NETWORK_PASSPHRASE);
      await server.sendTransaction(signedTx);
      setDone(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      alert("Trustline error: " + (e.message || "").slice(0, 80));
    } finally { setLoading(false); }
  };

  if (done) return <span className="text-xs text-emerald-600">✅ Added</span>;
  return (
    <button onClick={addTl} disabled={loading}
      className="text-xs text-purple-600 hover:text-purple-800 underline">
      {loading ? "..." : "Add Trustline"}
    </button>
  );
}

function CitizenReputation() {
  const{address}=useWallet();const[rep,setRep]=useState<any>(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{if(!address)return;(async()=>{try{const c=new CommunityOracleClient({contractId:CONTRACT_IDS.community_oracle,networkPassphrase:NETWORK_PASSPHRASE,rpcUrl:RPC_URL});const r=await c.get_citizen_reputation({citizen:address});setRep(r.result)}catch(e){console.error(e)}finally{setLoading(false)}})()},[address]);
  if(loading)return<div className="skeleton-shimmer h-40 rounded-xl"/>;
  const t=rep?.total_reports??0;const v=rep?.verified_reports??0;const cf=rep?.confidence_rating??50;
  return( <div className="space-y-4"><div className="card p-6"><h2 className="text-lg font-semibold mb-4">Your Civic Reputation</h2><div className="grid grid-cols-3 gap-6 text-center"><div><div className="text-3xl font-bold text-brand-600">{t}</div><div className="text-sm text-slate-500 mt-1">Total</div></div><div><div className="text-3xl font-bold text-emerald-600">{v}</div><div className="text-sm text-slate-500 mt-1">Verified</div></div><div><div className="text-3xl font-bold text-blue-600">{cf}%</div><div className="text-sm text-slate-500 mt-1">Confidence</div></div></div><div className="mt-4 progress-bar"><div className="progress-fill progress-purple" style={{width:`${cf}%`}}/></div></div><div className="card p-5 mt-4"><h3 className="font-semibold mb-2">How It Works</h3><div className="space-y-2 text-sm text-slate-600"><p>• Submit verified reports → higher confidence</p><p>• Higher confidence → reports carry more weight</p><p>• GPS + photos = higher trust</p></div></div></div>);
}
