import { useState, useEffect } from "react";
import { BlockchainLoader } from "../components/BlockchainLoader";
import { Client as ComplianceEngineClient } from "../contracts/compliance_engine/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";

interface Violation {
  id: number;
  pvo_id: number;
  rule: { tag: string };
  description: string;
  severity: number;
  auto_paused: boolean;
  resolved: boolean;
  reporter: string;
  timestamp: number;
}

export function ComplianceDashboard() {
  const [active, setActive] = useState<Violation[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new ComplianceEngineClient({
          contractId: CONTRACT_IDS.compliance_engine,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const [activeResult, countResult] = await Promise.all([
          client.get_active_violations(),
          client.get_violation_count(),
        ]);
        setActive((activeResult.result || []).map((v: any) => ({
          id: v.id, pvo_id: v.pvo_id, rule: v.rule,
          description: v.description, severity: v.severity,
          auto_paused: v.auto_paused, resolved: v.resolved,
          reporter: v.reporter, timestamp: Number(v.timestamp),
        })));
        setAllCount(Number(countResult.result));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading compliance data...</div>;

  const paused = active.filter(v => v.auto_paused).length;
  const avgSeverity = active.length > 0 ? Math.round(active.reduce((s, v) => s + v.severity, 0) / active.length) : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">⚖️ Autonomous Compliance</h1>
      <p className="text-gray-500 mb-6">Real-time compliance monitoring with auto-pause on critical violations.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Violations", val: allCount, c: "text-gray-900" },
          { label: "Active", val: active.length, c: "text-red-600" },
          { label: "Auto-Paused", val: paused, c: "text-orange-600" },
          { label: "Avg Severity", val: `${avgSeverity}%`, c: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <dt className="text-sm text-gray-500">{s.label}</dt>
            <dd className={`text-2xl font-bold ${s.c}`}>{s.val}</dd>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">PVO</th>
              <th className="text-left px-4 py-3">Rule</th>
              <th className="text-left px-4 py-3">Severity</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {active.map(v => (
              <tr key={v.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">#{v.id}</td>
                <td className="px-4 py-3">PVO #{v.pvo_id}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-red-50 text-red-700">
                    {(v.rule.tag || "").replace(/([A-Z])/g, " $1").trim()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v.severity >= 70 ? "bg-red-500" : "bg-yellow-500"}`}
                        style={{ width: `${v.severity}%` }} />
                    </div>
                    <span className="text-xs">{v.severity}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${v.auto_paused ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {v.auto_paused ? "⏸️ Auto-Paused" : "⚠️ Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {active.length === 0 && <div className="text-center py-10 text-gray-400">✅ All PVOs compliant. No active violations.</div>}
      </div>

      {active.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          ⚠️ {paused} PVO{paused !== 1 ? "s" : ""} auto-paused due to critical compliance violations.
          Funds are locked until violations are resolved.
        </div>
      )}
    </div>
  );
}
