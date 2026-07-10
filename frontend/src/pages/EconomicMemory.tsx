import { useState } from "react";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { Client as ReputationClient } from "../contracts/reputation/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, PPHP_SCALE } from "../config";

export function EconomicMemory() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const pvoClient = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
      const repClient = new ReputationClient({ contractId: CONTRACT_IDS.reputation, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });

      const items: any[] = [];
      const pvoCount = await pvoClient.get_pvo_count();
      const q = query.toLowerCase();

      // Search PVOs by title/description/department
      for (let i = 1; i <= Number(pvoCount.result); i++) {
        const r = await pvoClient.get_pvo({ pvo_id: i });
        if (r.result) {
          const p = r.result;
          if (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)) {
            const rep: any = { type: "PVO", id: p.id, title: p.title, department: p.department, budget: String(p.total_budget), status: p.status.tag, contractor: p.contractor };
            // Get contractor reputation
            try {
              const cr = await repClient.get_reputation({ entity: p.contractor });
              if (cr.result) rep.reputation = cr.result.reputation_score;
            } catch {}
            items.push(rep);
          }
        }
      }

      setResults(items);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Economic Memory</h1>
      <p className="text-gray-500 mb-6">Search across all PVOs, contractors, departments, and spending history.</p>

      <div className="flex gap-3 mb-6">
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search projects, departments, contractors..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
        />
        <button onClick={search} disabled={searching}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
          {results.map((r, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700 mr-2">{r.type}</span>
                  <span className="font-semibold text-gray-900">{r.title}</span>
                </div>
                <span className="text-sm text-gray-400">{r.department}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                <div>Est. Budget: ₱ {Number(r.budget).toLocaleString()}</div>
                <div>Status: {r.status}</div>
                {r.reputation !== undefined && (
                  <div>Reputation: <span className={`font-medium ${r.reputation >= 80 ? "text-green-600" : r.reputation >= 50 ? "text-yellow-600" : "text-red-600"}`}>{r.reputation}/PPHP_SCALE</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && query && results.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No results found for "{query}"</p>
          <p className="text-sm">Try searching for a department name, project title, or contractor address.</p>
        </div>
      )}

      {!query && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">Search across all on-chain data</p>
          <p className="text-sm">Find projects by name, filter by department, look up contractors, and trace spending history.</p>
        </div>
      )}
    </div>
  );
}
