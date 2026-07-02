import { useState, useEffect, useCallback } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { RPC_URL, NETWORK_PASSPHRASE, CONTRACT_IDS } from "../config";
import { formatBudget, formatAddress, formatTimestamp, statusToString } from "../helpers";

interface PVOData {
  id: number;
  title: string;
  description: string;
  department: string;
  municipality: string;
  total_budget: string;
  status: string;
  contractor: string;
  public_value_score: number;
  milestones: number[];
  created_at: number;
}

export function TransparencyPortal() {
  const [pvos, setPvos] = useState<PVOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPvo, setSelectedPvo] = useState<PVOData | null>(null);

  const loadPVOs = useCallback(async () => {
    setLoading(true);
    try {
      const pvoClient = new PvoCoreClient({
        contractId: CONTRACT_IDS.pvo_core,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });

      const countResult = await pvoClient.get_pvo_count();
      const count = countResult.result;

      const pvoList: PVOData[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const result = await pvoClient.get_pvo({ pvo_id: i });
          const pvo = result.result;
          if (pvo) {
            pvoList.push({
              id: pvo.id,
              title: pvo.title,
              description: pvo.description,
              department: pvo.department,
              municipality: pvo.municipality,
              total_budget: String(pvo.total_budget),
              status: statusToString(pvo.status),
              contractor: pvo.contractor,
              public_value_score: pvo.public_value_score,
              milestones: pvo.milestones as unknown as number[],
              created_at: Number(pvo.created_at),
            });
          }
        } catch (e) {
          console.error(`Failed to load PVO ${i}:`, e);
        }
      }
      setPvos(pvoList);
    } catch (e) {
      console.error("Failed to load PVOs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPVOs();
  }, [loadPVOs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Loading public projects...</div>
      </div>
    );
  }

  if (selectedPvo) {
    return <PVODetail pvo={selectedPvo} onBack={() => setSelectedPvo(null)} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Public Transparency Portal</h1>
        <p className="text-gray-500">
          Browse all government infrastructure projects on-chain. {pvos.length} projects tracked.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pvos.map((pvo) => (
          <button
            key={pvo.id}
            onClick={() => setSelectedPvo(pvo)}
            className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700">
                {pvo.status}
              </span>
              <span className="text-sm text-gray-400">#{pvo.id}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1 truncate">{pvo.title}</h3>
            <p className="text-sm text-gray-500 mb-3">{pvo.department} · {pvo.municipality}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-gray-700">⨎ {formatBudget(pvo.total_budget)}</span>
              <span className="text-gray-400">{pvo.milestones.length} milestones</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Value Score</span>
                <span className="font-semibold text-gray-700">{pvo.public_value_score}/100</span>
              </div>
              <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                  style={{ width: `${pvo.public_value_score}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      {pvos.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          No projects found on-chain yet.
        </div>
      )}
    </div>
  );
}

function PVODetail({ pvo, onBack }: { pvo: PVOData; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-gray-500 hover:text-gray-700">
        ← Back to all projects
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pvo.title}</h1>
            <p className="text-gray-500 mt-1">{pvo.description}</p>
          </div>
          <span className="inline-block px-3 py-1 text-sm font-medium rounded bg-blue-50 text-blue-700">
            {pvo.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Department</dt>
            <dd className="text-sm font-medium text-gray-900 mt-1">{pvo.department}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Location</dt>
            <dd className="text-sm font-medium text-gray-900 mt-1">{pvo.municipality}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Budget</dt>
            <dd className="text-sm font-medium text-gray-900 mt-1">⨎ {formatBudget(pvo.total_budget)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Contractor</dt>
            <dd className="text-sm font-mono text-gray-900 mt-1">{formatAddress(pvo.contractor)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Created</dt>
            <dd className="text-sm font-medium text-gray-900 mt-1">{formatTimestamp(pvo.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Value Score</dt>
            <dd className="text-sm font-medium text-gray-900 mt-1">{pvo.public_value_score}/100</dd>
          </div>
        </div>
      </div>
    </div>
  );
}
