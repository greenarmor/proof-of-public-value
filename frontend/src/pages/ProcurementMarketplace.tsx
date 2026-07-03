import { useState, useEffect } from "react";
import { Client as ProcurementMarketClient } from "../contracts/procurement_market/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "../config";

interface Tender {
  id: number;
  title: string;
  budget: string;
  status: { tag: string };
  agency: string;
  winner?: string;
}

export function ProcurementMarketplace() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const client = new ProcurementMarketClient({
          contractId: CONTRACT_IDS.procurement_market,
          networkPassphrase: NETWORK_PASSPHRASE,
          rpcUrl: RPC_URL,
        });
        const count = await client.get_tender_count();
        const list: Tender[] = [];
        for (let i = 1; i <= Number(count.result); i++) {
          const r = await client.get_tender({ id: i });
          if (r.result) list.push({
            id: r.result.id, title: r.result.title,
            budget: String(r.result.budget),
            status: r.result.status, agency: r.result.agency,
            winner: r.result.winner || undefined,
          });
        }
        setTenders(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading tenders...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">🏗️ Procurement Marketplace</h1>
      <p className="text-gray-500 mb-6">Multi-criteria bidding with integrity-weighted ranking and auto-award.</p>

      <div className="grid gap-4">
        {tenders.map(t => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{t.title}</h3>
                <p className="text-sm text-gray-500">Agency: {t.agency.slice(0, 12)}...</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                t.status.tag === "Open" ? "bg-green-50 text-green-700" :
                t.status.tag === "Awarded" ? "bg-blue-50 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>{t.status.tag}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <span>Budget: ⨎ {Number(t.budget).toLocaleString()}</span>
              {t.winner && <span>Winner: {t.winner.slice(0, 12)}...</span>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              Scoring: Price (0-50) + Quality (0-30) + Timeline (0-20) + Integrity (0-20)
            </div>
          </div>
        ))}
        {tenders.length === 0 && <div className="text-center py-10 text-gray-400">No tenders yet.</div>}
      </div>
    </div>
  );
}
