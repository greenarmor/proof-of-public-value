import { useState, useEffect } from "react";
import { Client as PublicIndexClient } from "../contracts/public_index/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";

interface Benchmark {
  department: string;
  avg_value_score: number;
  pvo_count: number;
  total_budget: string;
  completed_projects: number;
  on_time_rate: number;
  rank: number;
}

interface Snapshot {
  timestamp: number;
  total_pvos: number;
  total_budget: string;
  avg_value_score: number;
  departments_ranked: number;
  top_dept: string;
  top_dept_score: number;
}

export function IndexLeaderboard() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new PublicIndexClient({
          contractId: CONTRACT_IDS.public_index,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });

        const [benchResult, snapResult] = await Promise.all([
          client.get_all_benchmarks(),
          client.get_latest_snapshot(),
        ]);

        setBenchmarks(
          (benchResult.result || []).map((b: any) => ({
            department: b.department,
            avg_value_score: b.avg_value_score,
            pvo_count: b.pvo_count,
            total_budget: String(b.total_budget),
            completed_projects: b.completed_projects,
            on_time_rate: b.on_time_rate,
            rank: b.rank,
          }))
        );

        if (snapResult.result) {
          const s = snapResult.result;
          setSnapshot({
            timestamp: Number(s.timestamp),
            total_pvos: s.total_pvos,
            total_budget: String(s.total_budget),
            avg_value_score: s.avg_value_score,
            departments_ranked: s.departments_ranked,
            top_dept: s.top_dept,
            top_dept_score: s.top_dept_score,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading Public Value Index...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">🇵🇭 National Public Value Index</h1>
      <p className="text-gray-500 mb-6">Department benchmarking, rankings, and national spending impact.</p>

      {snapshot && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total PVOs", value: snapshot.total_pvos, color: "text-gray-900" },
            { label: "Avg Value Score", value: `${snapshot.avg_value_score}/100`, color: "text-purple-600" },
            { label: "Depts Ranked", value: snapshot.departments_ranked, color: "text-blue-600" },
            { label: "Top Dept", value: `${snapshot.top_dept} (${snapshot.top_dept_score})`, color: "text-green-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border rounded-lg p-4">
              <dt className="text-sm text-gray-500">{stat.label}</dt>
              <dd className={`text-2xl font-bold ${stat.color}`}>{stat.value}</dd>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rank</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">PVOs</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Completed</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">On-Time %</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks
              .sort((a, b) => a.rank - b.rank)
              .map((b) => (
                <tr key={b.department} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                      b.rank === 1 ? "bg-yellow-100 text-yellow-800" :
                      b.rank === 2 ? "bg-gray-200 text-gray-700" :
                      b.rank === 3 ? "bg-orange-100 text-orange-800" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {b.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{b.department}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full"
                          style={{ width: `${b.avg_value_score}%` }} />
                      </div>
                      <span className="text-gray-600">{b.avg_value_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.pvo_count}</td>
                  <td className="px-4 py-3 text-gray-600">{b.completed_projects}</td>
                  <td className="px-4 py-3 text-gray-600">{b.on_time_rate}%</td>
                </tr>
              ))}
          </tbody>
        </table>
        {benchmarks.length === 0 && <div className="text-center py-10 text-gray-400">No departments ranked yet.</div>}
      </div>
    </div>
  );
}
