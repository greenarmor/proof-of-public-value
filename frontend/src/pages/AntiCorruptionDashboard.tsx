import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet";
import { formatAddress, formatTimestamp } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, PPHP_SCALE } from "../config";
import { uploadToIPFS } from "../ipfs";
import { Client as AiOracleClient, type FraudDetectionResult } from "../contracts/ai_oracle/src";
import { Client as ComplianceClient, type ViolationRecord } from "../contracts/compliance_engine/src";
import { Client as AuditClient, type AuditEntry } from "../contracts/audit_trail/src";
import { Client as EscrowClient } from "../contracts/escrow/src";

const FRAUD_INDICATORS = [
  "DuplicateInvoice", "GhostProject", "AbnormalBudgetGrowth", "UnusualPaymentTiming",
  "CollusionPattern", "RepeatedContractorWin", "MaterialCostInflation", "ShellCompanyRisk",
] as const;

const COMPLIANCE_RULES = [
  "ProcurementLaw", "COAregulation", "EnvironmentalRegulation",
  "BudgetDeviation", "SafetyViolation", "LaborCompliance",
] as const;

function indicatorsFromChain(inds: any[]): string[] {
  return inds.map(i => (typeof i === "object" && i?.tag) ? i.tag : String(i));
}

function ruleFromChain(r: any): string {
  if (typeof r === "object" && r?.tag) return r.tag;
  if (typeof r === "string") return r;
  return "Unknown";
}

function categoryFromChain(c: any): string {
  if (typeof c === "object" && c?.tag) return c.tag;
  if (typeof c === "string") return c;
  return "Unknown";
}

type TxState = "idle" | "preparing" | "signing" | "sending" | "done" | "error";

export function AntiCorruptionDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"fraud" | "violations" | "audit" | "riskmap" | "report">("fraud");
  const [frauds, setFrauds] = useState<FraudDetectionResult[]>([]);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const aiClient = new AiOracleClient({
        contractId: CONTRACT_IDS.ai_oracle, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL,
      });
      const compClient = new ComplianceClient({
        contractId: CONTRACT_IDS.compliance_engine, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL,
      });
      const auditClient = new AuditClient({
        contractId: CONTRACT_IDS.audit_trail, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL,
      });

      const [fraudCountRes, activeViolationsRes, highRiskRes] = await Promise.all([
        aiClient.get_fraud_count(),
        compClient.get_active_violations(),
        auditClient.get_high_risk_entries({ min_risk_score: 30 }),
      ]);

      const fCount = Number(fraudCountRes.result);
      const fraudList: FraudDetectionResult[] = [];
      for (let i = 1; i <= fCount; i++) {
        try {
          const r = await aiClient.get_fraud_detection({ id: i });
          if (r.result) fraudList.push(r.result);
        } catch {}
      }
      fraudList.sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

      setFrauds(fraudList);
      setViolations(activeViolationsRes.result || []);
      setAuditEntries(highRiskRes.result || []);
    } catch (e) {
      console.error("Failed to load anti-corruption data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🛡️</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the anti-corruption monitoring system.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  const criticalCount = frauds.filter(f => Number(f.risk_score) >= 70).length;
  const pausedCount = violations.filter(v => v.auto_paused).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Anti-Corruption Agency</h1>
          <p className="text-slate-500">On-chain fraud detection, compliance violations, and investigation tracking.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="btn-secondary text-xs px-3 py-2">
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 mb-6">
        <div className="card p-4">
          <p className="stat-label">Fraud Alerts</p>
          <p className="stat-value text-slate-900">{frauds.length}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">High Risk (≥70)</p>
          <p className="stat-value text-red-600">{criticalCount}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Active Violations</p>
          <p className="stat-value text-amber-600">{violations.length}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Auto-Paused Projects</p>
          <p className="stat-value text-red-600">{pausedCount}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {(["fraud", "violations", "audit", "riskmap", "report"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "fraud" && `🚨 Fraud Alerts (${frauds.length})`}
            {tab === "violations" && `⚖️ Violations (${violations.length})`}
            {tab === "audit" && `📁 Audit Trail (${auditEntries.length})`}
            {tab === "riskmap" && "🗺️ Risk Map"}
            {tab === "report" && "📤 File Report"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-5 skeleton h-40" />)}
        </div>
      ) : (
        <>
          {activeTab === "fraud" && <FraudTab frauds={frauds} address={address!} onAction={refresh} />}
          {activeTab === "violations" && <ViolationsTab violations={violations} address={address!} onAction={refresh} />}
          {activeTab === "audit" && <AuditTab entries={auditEntries} />}
          {activeTab === "riskmap" && <RiskMapTab frauds={frauds} violations={violations} />}
          {activeTab === "report" && <ReportTab address={address!} onSubmitted={refresh} />}
        </>
      )}
    </div>
  );
}

function FraudTab({ frauds, address, onAction }: {
  frauds: FraudDetectionResult[]; address: string; onAction: () => void;
}) {
  const [disputeTx, setDisputeTx] = useState<Record<number, TxState>>({});
  const [disputeMsg, setDisputeMsg] = useState<Record<number, string>>({});

  const handleDisputeEscrow = async (pvoId: number, fraudId: number) => {
    setDisputeTx(s => ({ ...s, [fraudId]: "preparing" }));
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const escrowClient = new EscrowClient({
        contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL,
      });

      // Find an escrow for this PVO
      const escrowsRes = await escrowClient.get_escrows_by_pvo({ pvo_id: pvoId });
      const escrows = escrowsRes.result || [];
      if (escrows.length === 0) {
        setDisputeTx(s => ({ ...s, [fraudId]: "error" }));
        setDisputeMsg(s => ({ ...s, [fraudId]: `No escrow found for PVO #${pvoId}` }));
        return;
      }

      const target = escrows.find(e => {
        const st = typeof e.status === "object" ? e.status.tag : e.status;
        return st !== "Released" && st !== "Refunded";
      });
      if (!target) {
        setDisputeTx(s => ({ ...s, [fraudId]: "error" }));
        setDisputeMsg(s => ({ ...s, [fraudId]: `No active escrow to dispute for PVO #${pvoId}` }));
        return;
      }

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.escrow);
      const op = contract.call("dispute",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(target.id)),
      );
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setDisputeTx(s => ({ ...s, [fraudId]: "signing" }));
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setDisputeTx(s => ({ ...s, [fraudId]: "sending" }));
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setDisputeTx(s => ({ ...s, [fraudId]: "done" }));
      setDisputeMsg(s => ({ ...s, [fraudId]: `Escrow #${target.id} disputed!` }));
      setTimeout(() => onAction(), 3000);
    } catch (err: any) {
      setDisputeTx(s => ({ ...s, [fraudId]: "error" }));
      setDisputeMsg(s => ({ ...s, [fraudId]: err.message?.slice(0, 120) || "Failed" }));
    }
  };

  if (frauds.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="font-semibold text-slate-700 mb-1">No Fraud Alerts</h3>
        <p className="text-sm text-slate-400">No fraud detections recorded on-chain.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {frauds.map((f) => {
        const risk = Number(f.risk_score);
        const inds = indicatorsFromChain(f.indicators as any[]);
        const ts = formatTimestamp(Number(f.timestamp));
        const dState = disputeTx[Number(f.id)];
        const dMsg = disputeMsg[Number(f.id)];
        const busy = dState === "preparing" || dState === "signing" || dState === "sending";

        return (
          <div key={Number(f.id)} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`badge ${risk >= 70 ? "badge-red" : risk >= 40 ? "badge-amber" : "badge-green"}`}>
                  {risk >= 70 ? "Critical" : risk >= 40 ? "High" : "Medium"}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">Fraud #{f.id} - PVO #{Number(f.pvo_id)}</h3>
                  <p className="text-xs text-slate-400">Detected by <WalletAddress addr={f.auditor} chars={6}/></p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${risk >= 70 ? "text-red-600" : risk >= 40 ? "text-amber-600" : "text-emerald-600"}`}>
                  {risk}
                </div>
                <p className="text-xs text-slate-400">Risk Score</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {inds.map(ind => (
                <span key={ind} className="badge badge-purple text-xs">
                  {ind.replace(/([A-Z])/g, " $1").trim()}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm mb-3 pt-3 border-t border-slate-100">
              <div><span className="text-slate-400">Confidence:</span> <span className="font-medium text-slate-700">{Number(f.confidence)}%</span></div>
              <div><span className="text-slate-400">Evidence:</span> <code className="text-xs text-slate-600">{f.evidence_hash.slice(0, 16)}...</code></div>
              <div><span className="text-slate-400">Date:</span> <span className="text-slate-600">{ts}</span></div>
            </div>

            {dMsg && (
              <div className={`mb-3 p-2.5 rounded-lg text-xs ${dState === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {dState === "done" && "✅ "}{dMsg}
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleDisputeEscrow(Number(f.pvo_id), Number(f.id))}
                disabled={busy}
                className="btn-danger text-xs px-3 py-1.5">
                {busy ? "Disputing..." : "⚠️ Dispute Related Escrow"}
              </button>
              <span className="text-xs text-slate-400 self-center">Freezes funds pending investigation</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ViolationsTab({ violations, address, onAction }: {
  violations: ViolationRecord[]; address: string; onAction: () => void;
}) {
  const [resolveTx, setResolveTx] = useState<Record<number, TxState>>({});

  const handleResolve = async (vId: number) => {
    setResolveTx(s => ({ ...s, [vId]: "preparing" }));
    try {
      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.compliance_engine);
      const op = contract.call("resolve_violation",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(vId),
      );
      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setResolveTx(s => ({ ...s, [vId]: "signing" }));
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setResolveTx(s => ({ ...s, [vId]: "sending" }));
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setResolveTx(s => ({ ...s, [vId]: "done" }));
      setTimeout(() => onAction(), 3000);
    } catch {
      setResolveTx(s => ({ ...s, [vId]: "error" }));
    }
  };

  if (violations.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="font-semibold text-slate-700 mb-1">No Active Violations</h3>
        <p className="text-sm text-slate-400">All projects are compliant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {violations.map((v) => {
        const sev = Number(v.severity);
        const rule = ruleFromChain(v.rule);
        const ts = formatTimestamp(Number(v.timestamp));
        const rState = resolveTx[Number(v.id)];
        const busy = rState === "preparing" || rState === "signing" || rState === "sending";

        return (
          <div key={Number(v.id)} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`badge ${sev >= 70 ? "badge-red" : sev >= 40 ? "badge-amber" : "badge-blue"}`}>
                  Severity: {sev}
                </span>
                {v.auto_paused && <span className="badge badge-red">⛔ Auto-Paused</span>}
                <span className="badge badge-purple">{rule.replace(/([A-Z])/g, " $1").trim()}</span>
              </div>
              <span className="text-xs text-slate-400">#{v.id} · {ts}</span>
            </div>
            <p className="text-sm text-slate-700 mb-3">{v.description}</p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">PVO #{Number(v.pvo_id)} · Reported by <WalletAddress addr={v.reporter} chars={6}/></span>
              <div className="flex gap-2">
                {!v.resolved ? (
                  <button onClick={() => handleResolve(Number(v.id))} disabled={busy}
                    className="btn-primary text-xs px-3 py-1.5">
                    {busy ? "Resolving..." : rState === "done" ? "Resolved!" : "✓ Resolve"}
                  </button>
                ) : (
                  <span className="badge-green">Resolved</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditTab({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="font-semibold text-slate-700 mb-1">No Audit Entries</h3>
        <p className="text-sm text-slate-400">No high-risk decisions recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((e) => {
        const risk = Number(e.risk_score);
        const cat = categoryFromChain(e.category);
        const ts = formatTimestamp(Number(e.timestamp));
        return (
          <div key={Number(e.id)} className="card p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="badge badge-purple">{cat.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className={`badge ${risk >= 70 ? "badge-red" : risk >= 40 ? "badge-amber" : "badge-green"}`}>
                  Risk: {risk}
                </span>
              </div>
              <span className="text-xs text-slate-400">#{e.id} · Block {Number(e.block_height)}</span>
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">{e.action}</p>
            <p className="text-sm text-slate-600">{e.rationale}</p>
            <div className="grid grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-slate-100">
              <div><span className="text-slate-400">Actor:</span> {e.actor_role || "Unknown"} (<WalletAddress addr={e.actor} chars={6}/>)</div>
              <div><span className="text-slate-400">PVO:</span> #{Number(e.pvo_id)}</div>
              <div><span className="text-slate-400">Compliance:</span> {e.compliance_result}</div>
              <div><span className="text-slate-400">AI Recommendation:</span> {e.ai_recommendation}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskMapTab({ frauds, violations }: {
  frauds: FraudDetectionResult[]; violations: ViolationRecord[];
}) {
  const pvoData: Record<number, { maxRisk: number; fraudCount: number; violationCount: number }> = {};

  frauds.forEach(f => {
    const pid = Number(f.pvo_id);
    if (!pvoData[pid]) pvoData[pid] = { maxRisk: 0, fraudCount: 0, violationCount: 0 };
    pvoData[pid].maxRisk = Math.max(pvoData[pid].maxRisk, Number(f.risk_score));
    pvoData[pid].fraudCount++;
  });

  violations.forEach(v => {
    const pid = Number(v.pvo_id);
    if (!pvoData[pid]) pvoData[pid] = { maxRisk: 0, fraudCount: 0, violationCount: 0 };
    pvoData[pid].maxRisk = Math.max(pvoData[pid].maxRisk, Number(v.severity));
    pvoData[pid].violationCount++;
  });

  const sorted = Object.entries(pvoData).sort(([, a], [, b]) => b.maxRisk - a.maxRisk);
  const indicatorDist: Record<string, number> = {};
  frauds.forEach(f => {
    indicatorsFromChain(f.indicators as any[]).forEach(ind => {
      indicatorDist[ind] = (indicatorDist[ind] || 0) + 1;
    });
  });

  if (sorted.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <h3 className="font-semibold text-slate-700 mb-1">No Risk Data</h3>
        <p className="text-sm text-slate-400">No fraud detections or violations to map.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Corruption Risk by Project</h3>
        {sorted.map(([pvoId, data]) => (
          <div key={pvoId} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">PVO #{pvoId}</span>
              <span className="text-slate-500">
                {data.fraudCount} fraud · {data.violationCount} violation{data.violationCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${data.maxRisk >= 70 ? "progress-red" : data.maxRisk >= 40 ? "progress-amber" : "progress-green"}`}
                style={{ width: `${data.maxRisk}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={`font-medium ${data.maxRisk >= 70 ? "text-red-600" : data.maxRisk >= 40 ? "text-amber-600" : "text-emerald-600"}`}>
                Risk Score: {data.maxRisk}/100
              </span>
              <span className="text-slate-400">
                {data.maxRisk >= 70 ? "High Risk" : data.maxRisk >= 40 ? "Moderate Risk" : "Low Risk"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(indicatorDist).length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Fraud Indicator Distribution</h3>
          <div className="space-y-2">
            {Object.entries(indicatorDist)
              .sort(([, a], [, b]) => b - a)
              .map(([ind, count]) => (
                <div key={ind} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{ind.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="badge badge-amber">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTab({ address, onSubmitted }: { address: string; onSubmitted: () => void }) {
  const [mode, setMode] = useState<"fraud" | "violation">("fraud");

  // Fraud detection form
  const [fdPvoId, setFdPvoId] = useState("");
  const [fdRisk, setFdRisk] = useState("50");
  const [fdConfidence, setFdConfidence] = useState("70");
  const [fdEvidence, setFdEvidence] = useState("");
  const [fdIndicators, setFdIndicators] = useState<string[]>(["MaterialCostInflation"]);
  const [fdTxState, setFdTxState] = useState<TxState>("idle");
  const [fdMsg, setFdMsg] = useState("");
  const [fdFile, setFdFile] = useState<File | null>(null);
  const [fdUploading, setFdUploading] = useState(false);

  // Violation form
  const [vlPvoId, setVlPvoId] = useState("");
  const [vlRule, setVlRule] = useState<string>("BudgetDeviation");
  const [vlSeverity, setVlSeverity] = useState("50");
  const [vlDescription, setVlDescription] = useState("");
  const [vlTxState, setVlTxState] = useState<TxState>("idle");
  const [vlMsg, setVlMsg] = useState("");
  const [vlFile, setVlFile] = useState<File | null>(null);
  const [vlUploading, setVlUploading] = useState(false);

  const toggleIndicator = (ind: string) => {
    setFdIndicators(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
  };

  const submitFraud = async (e: React.FormEvent) => {
    e.preventDefault();
    setFdTxState("preparing");
    setFdMsg("");
    try {
      let evidenceHash = fdEvidence || "QmNoEvidence";

      if (fdFile) {
        setFdUploading(true);
        setFdMsg("Uploading evidence to IPFS...");
        evidenceHash = await uploadToIPFS(fdFile);
        setFdEvidence(evidenceHash);
        setFdUploading(false);
      }

      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.ai_oracle);

      const indicatorsScVal = xdr.ScVal.scvVec(
        fdIndicators.map(ind => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(ind)]))
      );

      const op = contract.call("submit_fraud_detection",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(fdPvoId)),
        xdr.ScVal.scvU32(Number(fdRisk)),
        indicatorsScVal,
        xdr.ScVal.scvU32(Number(fdConfidence)),
        xdr.ScVal.scvString(evidenceHash),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setFdTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setFdTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setFdTxState("done");
      setFdMsg(`Fraud detection submitted! Evidence: ${evidenceHash.slice(0, 16)}...`);
      setFdPvoId(""); setFdEvidence(""); setFdFile(null);
      setTimeout(() => onSubmitted(), 3000);
    } catch (err: any) {
      setFdUploading(false);
      setFdTxState("error");
      setFdMsg(err.message?.slice(0, 150) || "Failed");
    }
  };

  const submitViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    setVlTxState("preparing");
    setVlMsg("");
    try {
      let evidenceHash = "";
      if (vlFile) {
        setVlUploading(true);
        setVlMsg("Uploading evidence to IPFS...");
        evidenceHash = await uploadToIPFS(vlFile);
        setVlUploading(false);
      }
      const fullDescription = evidenceHash ? `${vlDescription} [Evidence: ${evidenceHash}]` : vlDescription;

      const { TransactionBuilder, Contract, Address, rpc, xdr } = await import("@stellar/stellar-sdk");
      const { signTransaction } = await import("@stellar/freighter-api");

      const server = new rpc.Server(RPC_URL);
      const account = await server.getAccount(address);
      const contract = new Contract(CONTRACT_IDS.compliance_engine);

      const op = contract.call("report_violation",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(Number(vlPvoId)),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(vlRule)]),
        xdr.ScVal.scvString(fullDescription),
        xdr.ScVal.scvU32(Number(vlSeverity)),
      );

      const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(op).setTimeout(30).build();

      setVlTxState("signing");
      const prepared = await server.prepareTransaction(tx);
      const signedResp: any = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signedResp?.error) throw new Error(signedResp.error.message);

      setVlTxState("sending");
      const signedTx = TransactionBuilder.fromXDR(signedResp.signedTxXdr, NETWORK_PASSPHRASE);
      try { await server.sendTransaction(signedTx); } catch (e: any) { if (!e.message?.includes("switch")) throw e; }

      setVlTxState("done");
      setVlMsg(evidenceHash ? `Violation reported! Evidence: ${evidenceHash.slice(0, 16)}...` : "Violation reported on-chain!");
      setVlPvoId(""); setVlDescription(""); setVlFile(null);
      setTimeout(() => onSubmitted(), 3000);
    } catch (err: any) {
      setVlUploading(false);
      setVlTxState("error");
      setVlMsg(err.message?.slice(0, 150) || "Failed");
    }
  };

  const fdBusy = fdTxState === "preparing" || fdTxState === "signing" || fdTxState === "sending" || fdUploading;
  const vlBusy = vlTxState === "preparing" || vlTxState === "signing" || vlTxState === "sending" || vlUploading;

  return (
    <div className="max-w-2xl">
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["fraud", "violation"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              mode === m ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {m === "fraud" ? "🚨 Submit Fraud Detection" : "⚖️ Report Compliance Violation"}
          </button>
        ))}
      </div>

      {mode === "fraud" ? (
        <div>
          {fdMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${fdTxState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {fdTxState === "done" && "✅ "}{fdMsg}
            </div>
          )}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-900">Submit Fraud Detection</h2>
            <p className="text-sm text-slate-400 mb-4">Record a fraud finding on-chain via the AI Oracle contract. Requires wallet to be whitelisted as an AI auditor (granted by admin via <code>add_ai_auditor</code>).</p>
            <form className="space-y-4" onSubmit={submitFraud}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
                  <input type="number" value={fdPvoId} onChange={e => setFdPvoId(e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Risk Score (0-100)</label>
                  <input type="number" value={fdRisk} onChange={e => setFdRisk(e.target.value)} className="input" min="0" max="100" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confidence (%)</label>
                  <input type="number" value={fdConfidence} onChange={e => setFdConfidence(e.target.value)} className="input" min="0" max="100" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fraud Indicators</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FRAUD_INDICATORS.map(ind => (
                    <button key={ind} type="button" onClick={() => toggleIndicator(ind)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        fdIndicators.includes(ind)
                          ? "bg-brand-50 border-brand-300 text-brand-700"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}>
                      {ind.replace(/([A-Z])/g, " $1").trim()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidence Document (Optional)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-brand-400 transition"
                  onClick={() => document.getElementById("fd-evidence")?.click()}>
                  {fdFile ? (
                    <div className="text-sm">
                      <span className="text-brand-600 font-medium">{fdFile.name}</span>
                      <span className="text-slate-400 ml-2">({(fdFile.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFdFile(null); }}
                        className="ml-2 text-xs text-red-500 hover:underline">remove</button>
                    </div>
                  ) : fdEvidence ? (
                    <div className="text-sm text-brand-600 font-mono">{fdEvidence.slice(0, 24)}...
                      <button type="button" onClick={() => setFdEvidence("")} className="ml-2 text-xs text-red-500 hover:underline">clear</button>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">
                      <span className="text-2xl block mb-1">📎</span>Click to attach evidence (PDF, image, document)
                    </div>
                  )}
                  <input id="fd-evidence" type="file" className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={e => setFdFile(e.target.files?.[0] || null)} />
                </div>
                <input type="text" value={fdEvidence} onChange={e => setFdEvidence(e.target.value)} className="input font-mono text-xs mt-2"
                  placeholder="Or paste IPFS hash directly (Qm...)" />
              </div>
              <button type="submit" disabled={fdBusy} className="btn-primary w-full py-3">
                {fdBusy ? "Submitting..." : "Submit Fraud Detection"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div>
          {vlMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${vlTxState === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {vlTxState === "done" && "✅ "}{vlMsg}
            </div>
          )}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-900">Report Compliance Violation</h2>
            <p className="text-sm text-slate-400 mb-4">Report a regulatory violation. Severity ≥ 70 triggers auto-pause on the PVO.</p>
            <form className="space-y-4" onSubmit={submitViolation}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
                  <input type="number" value={vlPvoId} onChange={e => setVlPvoId(e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rule</label>
                  <select value={vlRule} onChange={e => setVlRule(e.target.value)} className="select">
                    {COMPLIANCE_RULES.map(r => <option key={r} value={r}>{r.replace(/([A-Z])/g, " $1").trim()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Severity (0-100)</label>
                  <input type="number" value={vlSeverity} onChange={e => setVlSeverity(e.target.value)} className="input" min="0" max="100" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={vlDescription} onChange={e => setVlDescription(e.target.value)} className="input" rows={4}
                  placeholder="Describe the violation with specific details, evidence references, and parties involved..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supporting Evidence (Optional)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-brand-400 transition"
                  onClick={() => document.getElementById("vl-evidence")?.click()}>
                  {vlFile ? (
                    <div className="text-sm">
                      <span className="text-brand-600 font-medium">{vlFile.name}</span>
                      <span className="text-slate-400 ml-2">({(vlFile.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setVlFile(null); }}
                        className="ml-2 text-xs text-red-500 hover:underline">remove</button>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">
                      <span className="text-2xl block mb-1">📎</span>Click to attach evidence (PDF, image, document)
                    </div>
                  )}
                  <input id="vl-evidence" type="file" className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={e => setVlFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              {Number(vlSeverity) >= 70 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">⚠️ <strong>Auto-Pause:</strong> Severity ≥ 70 will automatically flag the PVO as non-compliant and pause fund releases.</p>
                </div>
              )}
              <button type="submit" disabled={vlBusy} className="btn-primary w-full py-3">
                {vlBusy ? "Reporting..." : "Report Violation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
