import { useState, useEffect } from "react";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS, getCurrency, PPHP_SCALE } from "../config";
import { Client as EscrowClient, type Escrow as ChainEscrow } from "../contracts/escrow/src";
import { Client as PvoCoreClient } from "../contracts/pvo_core/src";
import { formatAddress, formatBudget, statusToString } from "../helpers";
import { WalletAddress } from "../components/WalletAddress";

interface EscrowView {
  id: number;
  pvoId: number;
  milestoneId: number;
  pvoTitle: string;
  contractor: string;
  amount: number;
  status: string;
  engineer: boolean;
  ai: boolean;
  compliance: boolean;
  oracle: boolean;
  community: number;
  communityRequired: number;
  funder: string;
}

export function EscrowMonitor() {
  const [escrows, setEscrows] = useState<EscrowView[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = getCurrency();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const escClient = new EscrowClient({ contractId: CONTRACT_IDS.escrow, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });
        const pvoClient = new PvoCoreClient({ contractId: CONTRACT_IDS.pvo_core, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });

        // Load PVOs for name/contractor lookup
        const pvoMap = new Map<number, { title: string; contractor: string }>();
        const pvoCnt = await pvoClient.get_pvo_count();
        for (let i = 1; i <= Number(pvoCnt.result); i++) {
          try {
            const r = await pvoClient.get_pvo({ pvo_id: i });
            if (r.result) pvoMap.set(i, { title: r.result.title, contractor: r.result.contractor });
          } catch {}
        }

        // Load all escrows
        const escCnt = await escClient.get_escrow_count();
        const list: EscrowView[] = [];
        for (let i = 1; i <= Number(escCnt.result); i++) {
          try {
            const r = await escClient.get_escrow({ escrow_id: i });
            if (r.result) {
              const e = r.result as ChainEscrow;
              const pvo = pvoMap.get(Number(e.pvo_id));
              list.push({
                id: Number(e.id),
                pvoId: Number(e.pvo_id),
                milestoneId: Number(e.milestone_id),
                pvoTitle: pvo?.title || `PVO #${e.pvo_id}`,
                contractor: e.recipient,
                amount: Number(e.amount),
                status: statusToString(e.status),
                engineer: e.conditions.engineer_approval,
                ai: e.conditions.ai_risk_check,
                compliance: e.conditions.compliance_validation,
                oracle: (e.conditions as any).community_oracle_validation || false,
                community: Number(e.conditions.community_confirmation),
                communityRequired: Number(e.conditions.community_required),
                funder: e.funder,
              });
            }
          } catch {}
        }
        list.sort((a, b) => b.id - a.id);
        setEscrows(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center"><div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"/><p className="text-slate-400">Loading escrows from Stellar testnet...</p></div>
    </div>
  );

  const totalValue = escrows.reduce((s, e) => s + e.amount, 0);
  const active = escrows.filter(e => e.status !== "Released" && e.status !== "Refunded");
  const released = escrows.filter(e => e.status === "Released");
  const disputed = escrows.filter(e => e.status === "Disputed");

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">🔒 Escrow Monitor</h1>
      <p className="text-slate-500 mb-6">All active escrows on-chain with project details, gate status, and contractor information.</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Escrows", value: escrows.length, color: "text-slate-900" },
          { label: "Active", value: active.length, color: "text-brand-600" },
          { label: "Total Value", value: `${currency}${(totalValue / PPHP_SCALE / 1_000_000).toFixed(1)}M`, color: "text-blue-600" },
          { label: "Released", value: released.length, color: "text-emerald-600" },
          { label: "Disputed", value: disputed.length, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {escrows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="font-semibold text-slate-700">No escrows on-chain yet</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map(e => {
            const gates = [
              { label: "Engineer", done: e.engineer },
              { label: "AI", done: e.ai },
              { label: "Compliance", done: e.compliance },
              { label: "Oracle", done: (e as any).oracle },
              { label: "Community", done: e.community >= e.communityRequired },
            ];
            const passed = gates.filter(g => g.done).length;

            const sColors: Record<string, string> = {
              Created: "badge-amber", Funded: "badge-blue", EngineerApproved: "badge-purple",
              AIValidated: "badge-purple", CompliancePassed: "badge-purple", OracleValidated: "badge-purple",
              CommunityVerified: "badge-purple",
              Ready: "badge-green", Released: "badge-green", Refunded: "badge-red", Disputed: "badge-red",
            };

            return (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono">Escrow #{e.id}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400 font-mono">PVO #{e.pvoId}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">Milestone #{e.milestoneId}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm">{e.pvoTitle}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{currency}{(e.amount / PPHP_SCALE).toLocaleString()}</span>
                      <span className="text-slate-300">|</span>
                      <span>Contractor: <WalletAddress addr={e.contractor} chars={6}/></span>
                      <span className="text-slate-300">|</span>
                      <span>Funder: <WalletAddress addr={e.funder} chars={6}/></span>
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${sColors[e.status] || "badge-blue"}`}>{e.status}</span>
                </div>

                {/* Gate progress */}
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {gates.map((gate, i) => (
                    <div key={i} className={`rounded-lg p-1.5 text-center text-[11px] font-medium border ${
                      gate.done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}>
                      <div className="text-sm mb-0.5">{gate.done ? "✓" : "○"}</div>
                      {gate.label}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{passed}/5 gates passed</span>
                  {e.status === "Released" && (
                    <span className="text-xs text-emerald-600 font-medium">✓ Paid to contractor</span>
                  )}
                  {e.status === "Refunded" && (
                    <span className="text-xs text-red-500 font-medium">↩ Refunded to funder</span>
                  )}
                  {e.status === "Disputed" && (
                    <span className="text-xs text-red-500 font-medium">⚠ Disputed — funds frozen</span>
                  )}
                  {e.status === "Ready" && (
                    <span className="text-xs text-brand-600 font-medium">🔓 Ready for release</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
