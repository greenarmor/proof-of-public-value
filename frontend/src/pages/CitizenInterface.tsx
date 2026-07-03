import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { Client as CommunityOracleClient } from "../contracts/community_oracle/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";
import { formatAddress } from "../helpers";
import { RPT_ASSET, RPT_MIN_BALANCE } from "../config";

const REPORT_TYPES = [
  "GpsPhoto", "GpsVideo", "FloodReport", "CompletionVerification",
  "QualityReport", "DamageReport", "UsageReport",
] as const;

export function CitizenInterface() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"browse" | "report" | "my">("browse");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to browse projects and submit community reports.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Citizen Interface</h1>
      <p className="text-gray-500 mb-6">Browse infrastructure projects, submit reports, and track your civic reputation.</p>

      <CitizenDashboard />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["browse", "report", "my"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "browse" && "🗺️ Browse"}
            {tab === "report" && "📸 Report"}
            {tab === "my" && "⭐ Reputation"}
          </button>
        ))}
      </div>

      {activeTab === "browse" && <CitizenBrowse />}
      {activeTab === "report" && <CitizenReport />}
      {activeTab === "my" && <CitizenReputation />}
    </div>
  );
}

function CitizenDashboard() {
  const { address } = useWallet();
  const [rptBalance, setRptBalance] = useState<number | null>(null);
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [reputation, setReputation] = useState<any>(null);
  const [trustlineLoading, setTrustlineLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const client = new CommunityOracleClient({
          contractId: CONTRACT_IDS.community_oracle,
          networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL,
        });
        try { const rep = await client.get_citizen_reputation({ citizen: address }); setReputation(rep.result); } catch {}
      } catch {}
      // Check RPT balance - if trustline missing, show setup button
      try {
        const { rpc: srpc } = await import("@stellar/stellar-sdk");
        const server = new srpc.Server(RPC_URL);
        const account = await server.getAccount(address);
        const { TransactionBuilder, Contract, Address } = await import("@stellar/stellar-sdk");
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(new Contract(RPT_ASSET).call("balance", new Address(address).toScVal()))
          .setTimeout(30).build();
        const sim = await server.simulateTransaction(tx);
        // If we got here without error, trustline exists
        setHasTrustline(true);
        // Try to parse the balance from return value
        try { setRptBalance(Number((sim as any).result.retval ?? (sim as any).retval ?? 0)); } catch {}
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("trustline") || msg.includes("missing") || msg.includes("#13")) {
          setHasTrustline(false);
        }
      }
    })();
  }, [address]);

  const setupTrustline = async () => {
    if (!address) return;
    setTrustlineLoading(true); setMessage(null);
    try {
      const { Asset, Operation, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");
      const asset = new Asset("RPT", "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);
      const tx = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.changeTrust({ asset })).setTimeout(30).build();
      await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      setHasTrustline(true);
      setMessage({ text: "RPT trustline created!", ok: true });
    } catch (err: any) {
      if (err.message?.includes("already") || err.message?.includes("exist")) {
        setHasTrustline(true); setMessage({ text: "Trustline already exists!", ok: true });
      } else { setMessage({ text: `Failed: ${err.message}`, ok: false }); }
    } finally { setTrustlineLoading(false); }
  };

  const canReport = hasTrustline && rptBalance !== null && rptBalance >= RPT_MIN_BALANCE;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className={`border rounded-lg p-4 ${canReport ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">🪙 RPT Token</span>
          <span className={`text-xs font-bold ${canReport ? "text-green-600" : "text-amber-600"}`}>
            {canReport ? "✅ Ready" : "⚠️ Setup Needed"}
          </span>
        </div>
        {hasTrustline === false && (
          <div>
            <p className="text-xs text-amber-700 mb-2">Trustline required to hold RPT</p>
            <button onClick={setupTrustline} disabled={trustlineLoading}
              className="w-full px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {trustlineLoading ? "Opening Freighter..." : "🔓 Create RPT Trustline"}
            </button>
          </div>
        )}
        {hasTrustline && rptBalance !== null && (
          <div>
            <span className="text-2xl font-bold text-purple-600">{rptBalance}</span>
            <span className="text-xs text-gray-500 ml-1">RPT</span>
            {!canReport && <p className="text-xs text-amber-600 mt-1">Need {RPT_MIN_BALANCE}+ RPT</p>}
          </div>
        )}
        {message && <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>{message.text}</p>}
      </div>
      <div className="border rounded-lg p-4 bg-white">
        <span className="font-medium text-sm">⭐ Reputation</span>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div><div className="text-xl font-bold text-purple-600">{reputation?.total_reports ?? 0}</div><div className="text-[10px] text-gray-400">Reports</div></div>
          <div><div className="text-xl font-bold text-green-600">{reputation?.verified_reports ?? 0}</div><div className="text-[10px] text-gray-400">Verified</div></div>
          <div><div className="text-xl font-bold text-blue-600">{reputation?.confidence_rating ?? 50}%</div><div className="text-[10px] text-gray-400">Confidence</div></div>
        </div>
      </div>
      <div className="border rounded-lg p-4 bg-white">
        <span className="font-medium text-sm">⚡ Quick Actions</span>
        <div className="mt-2 space-y-1.5">
          <a href="#report" className="block text-xs text-purple-600 hover:underline">📸 Submit Report</a>
          <a href="#browse" className="block text-xs text-purple-600 hover:underline">🗺️ Browse Projects</a>
        </div>
      </div>
    </div>
  );
}

function CitizenBrowse() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new CommunityOracleClient({ contractId: CONTRACT_IDS.community_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const count = await client.get_report_count();
        const items: any[] = [];
        for (let i = 1; i <= Number(count.result) && i <= 20; i++) {
          const r = await client.get_report({ report_id: i });
          if (r.result) items.push(r.result);
        }
        setReports(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading reports...</div>;

  return (
    <div className="space-y-4">
      {reports.map((r: any) => (
        <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="px-2 py-0.5 text-xs rounded bg-green-50 text-green-700">
                {typeof r.report_type === "string" ? r.report_type : r.report_type?.tag}
              </span>
              <span className="ml-2 text-sm text-gray-500">PVO #{r.pvo_id} · Milestone #{r.milestone_id}</span>
            </div>
            {r.verified ? (
              <span className="text-xs text-green-600">✅ Verified</span>
            ) : (
              <span className="text-xs text-yellow-600">⏳ Pending</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Citizen: {formatAddress(r.citizen)} · Confidence: {r.confidence_score || 0}%
          </div>
        </div>
      ))}
      {reports.length === 0 && <div className="text-center py-10 text-gray-400">No community reports yet.</div>}
    </div>
  );
}

function CitizenReport() {
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
  const [trustlineLoading, setTrustlineLoading] = useState(false);

  const setupTrustline = async () => {
    if (!address) return;
    setTrustlineLoading(true);
    setMessage(null);
    try {
      setMessage({ text: "Opening Freighter to sign trustline... Check your wallet popup.", ok: true });
      
      // Build and sign a trust operation via the Stellar SDK
      const { Asset, Operation, TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const asset = new Asset("RPT", "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV");
      const server = new rpc.Server(RPC_URL);
      const acct = await server.getAccount(address);

      const tx = new TransactionBuilder(acct, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.changeTrust({ asset }))
        .setTimeout(30)
        .build();

      const signedResp = await signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      setMessage({ text: "RPT trustline created! You can now receive tokens.", ok: true });
    } catch (err: any) {
      if (err.message?.includes("already") || err.message?.includes("exist")) {
        setMessage({ text: "Trustline already exists. You're all set!", ok: true });
      } else {
        setMessage({ text: `Failed: ${err.message || err}`, ok: false });
      }
    } finally {
      setTrustlineLoading(false);
    }
  };

  const uploadToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    // Pin public IPFS gateway pinning
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      body: formData,
      headers: {
        "pinata_api_key": import.meta.env.VITE_PINATA_API_KEY || "",
        "pinata_secret_api_key": import.meta.env.VITE_PINATA_SECRET || "",
      },
    });

    if (!res.ok) {
      // Fallback: try public IPFS add endpoint
      const publicRes = await fetch("https://ipfs.infura.io:5001/api/v0/add", {
        method: "POST",
        body: formData,
      });
      if (!publicRes.ok) throw new Error("IPFS upload failed. Check Pinata API keys or network.");
      const data = await publicRes.json();
      return data.Hash;
    }

    const data = await res.json();
    return data.IpfsHash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    let hash = dataHash;

    if (file) {
      setUploading(true);
      setMessage(null);
      try {
        hash = await uploadToIPFS(file);
        setDataHash(hash);
        setMessage({ text: `Photo uploaded to IPFS! Hash: ${hash.slice(0, 12)}...`, ok: true });
      } catch (err: any) {
        setMessage({ text: `IPFS upload failed: ${err.message}. You can paste a hash manually below.`, ok: false });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (!hash) {
      setMessage({ text: "Please attach a photo or paste an IPFS hash.", ok: false });
      return;
    }

    setSubmitting(true);
    try {
      const client = new CommunityOracleClient({
        contractId: CONTRACT_IDS.community_oracle,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
        publicKey: address,
      });

      const reportTypeMap: Record<string, any> = {
        GpsPhoto: { tag: "GpsPhoto", values: void 0 },
        GpsVideo: { tag: "GpsVideo", values: void 0 },
        FloodReport: { tag: "FloodReport", values: void 0 },
        CompletionVerification: { tag: "CompletionVerification", values: void 0 },
        QualityReport: { tag: "QualityReport", values: void 0 },
        DamageReport: { tag: "DamageReport", values: void 0 },
        UsageReport: { tag: "UsageReport", values: void 0 },
      };

      const tx = await client.submit_report({
        citizen: address,
        pvo_id: Number(pvoId),
        milestone_id: Number(milestoneId),
        report_type: reportTypeMap[reportType],
        data_hash: hash,
        gps_lat: BigInt(lat || "0"),
        gps_lon: BigInt(lon || "0"),
      });

      const result = await tx.signAndSend();
      setMessage({ text: `Report #${result.result} submitted on-chain! ✅`, ok: true });
      setPvoId(""); setMilestoneId(""); setDataHash(""); setLat(""); setLon(""); setFile(null);
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Community Report</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
          <strong>🪙 RPT Tokens Required</strong><br/>
          Must hold {RPT_MIN_BALANCE}+ RPT to submit reports.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
            <input type="number" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/([A-Z])/g, " $1").trim()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">📷 Photo or Video</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition"
            onClick={() => document.getElementById("fileInput")?.click()}>
            {file ? (
              <div className="text-sm">
                <span className="text-purple-600 font-medium">{file.name}</span>
                <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <span className="text-2xl block mb-1">📁</span>
                Click to attach photo or video
              </div>
            )}
            <input id="fileInput" type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Lat (microdegrees)</label>
            <input type="number" value={lat} onChange={(e) => setLat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="14599512" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Lon (microdegrees)</label>
            <input type="number" value={lon} onChange={(e) => setLon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="120984220" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Or paste IPFS hash</label>
          <input type="text" value={dataHash} onChange={(e) => setDataHash(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500"
            placeholder="Qm... or bafy..." />
        </div>
        <button type="submit" disabled={submitting || uploading}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
          {uploading ? "Uploading to IPFS..." : submitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

function CitizenReputation() {
  const { address } = useWallet();
  const [rep, setRep] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const client = new CommunityOracleClient({ contractId: CONTRACT_IDS.community_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const result = await client.get_citizen_reputation({ citizen: address });
        setRep(result.result);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading reputation...</div>;
  const total = rep?.total_reports ?? 0;
  const verified = rep?.verified_reports ?? 0;
  const confidence = rep?.confidence_rating ?? 50;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Your Civic Reputation</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="text-3xl font-bold text-purple-600">{total}</dt>
            <dd className="text-sm text-gray-500 mt-1">Total Reports</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-green-600">{verified}</dt>
            <dd className="text-sm text-gray-500 mt-1">Verified</dd>
          </div>
          <div>
            <dt className="text-3xl font-bold text-blue-600">{confidence}%</dt>
            <dd className="text-sm text-gray-500 mt-1">Confidence</dd>
          </div>
        </div>
        <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-400 to-purple-600 rounded-full" style={{ width: `${confidence}%` }} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• Submit verified reports to increase your confidence rating</p>
          <p>• Higher confidence means your future reports carry more weight</p>
          <p>• Reports with GPS coordinates and photos earn higher trust</p>
        </div>
      </div>
    </div>
  );
}
