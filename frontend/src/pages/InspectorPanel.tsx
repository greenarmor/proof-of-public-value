import { useState } from "react";
import { useWallet } from "../wallet";
import { formatAddress } from "../helpers";

interface Inspection {
  id: number;
  pvoId: number;
  milestone: string;
  type: string;
  scheduledDate: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Failed";
  site: string;
  contractor: string;
}

interface Defect {
  id: number;
  pvoId: number;
  severity: "Critical" | "Major" | "Minor";
  description: string;
  reportedDate: string;
  status: "Open" | "Resolved";
}

const mockInspections: Inspection[] = [
  { id: 1, pvoId: 1, milestone: "Site Preparation", type: "Quality Check", scheduledDate: "Jul 5, 2026", status: "Scheduled", site: "Brgy. San Isidro, Quezon City", contractor: "G...LPRW" },
  { id: 2, pvoId: 1, milestone: "Foundation Pouring", type: "Structural", scheduledDate: "Jul 8, 2026", status: "Scheduled", site: "Brgy. San Isidro, Quezon City", contractor: "G...LPRW" },
  { id: 3, pvoId: 2, milestone: "Asphalt Laying", type: "Material Quality", scheduledDate: "Jul 3, 2026", status: "Completed", site: "Marcos Highway, Marikina", contractor: "G...LPRW" },
];

const mockDefects: Defect[] = [
  { id: 1, pvoId: 2, severity: "Major", description: "Uneven asphalt thickness detected on Lane 2 (12mm deviation)", reportedDate: "Jul 3, 2026", status: "Open" },
  { id: 2, pvoId: 1, severity: "Minor", description: "Minor surface cracking near drainage inlet", reportedDate: "Jul 2, 2026", status: "Resolved" },
];

export function InspectorPanel() {
  const { connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"queue" | "reports" | "defects" | "schedule">("queue");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the inspector panel.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Inspector Panel</h1>
      <p className="text-slate-500 mb-6">Field inspections, quality verification, and defect tracking for public works.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["queue", "reports", "defects", "schedule"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "queue" && "📋 Inspection Queue"}
            {tab === "reports" && "📝 Submit Report"}
            {tab === "defects" && "⚠️ Defect Log"}
            {tab === "schedule" && "📅 Schedule"}
          </button>
        ))}
      </div>

      {activeTab === "queue" && <InspectionQueue inspections={mockInspections} />}
      {activeTab === "reports" && <SubmitReport />}
      {activeTab === "defects" && <DefectLog defects={mockDefects} />}
      {activeTab === "schedule" && <ScheduleView inspections={mockInspections} />}
    </div>
  );
}

function InspectionQueue({ inspections }: { inspections: Inspection[] }) {
  const pending = inspections.filter((i) => i.status === "Scheduled" || i.status === "In Progress");
  return (
    <div className="space-y-4">
      {pending.map((insp) => (
        <div key={insp.id} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">{insp.milestone} — {insp.type}</h3>
              <p className="text-sm text-slate-500">PVO #{insp.pvoId} · {insp.site}</p>
            </div>
            <span className={`badge ${insp.status === "Scheduled" ? "badge-blue" : "badge-amber"}`}>{insp.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><span className="text-slate-400">Contractor:</span> <code className="text-xs text-slate-600">{formatAddress(insp.contractor, 4)}</code></div>
            <div><span className="text-slate-400">Scheduled:</span> {insp.scheduledDate}</div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button className="btn-primary text-xs px-4 py-2">Start Inspection</button>
            <button className="btn-secondary text-xs px-4 py-2">Reschedule</button>
          </div>
        </div>
      ))}
      {pending.length === 0 && <div className="text-center py-10 text-slate-400">No pending inspections.</div>}
    </div>
  );
}

function SubmitReport() {
  const [pvoId, setPvoId] = useState("");
  const [milestone, setMilestone] = useState("");
  const [rating, setRating] = useState("Pass");
  const [notes, setNotes] = useState("");
  const [photoHash, setPhotoHash] = useState("");

  return (
    <div className="card p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4 text-slate-900">Inspection Report</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
            <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Milestone</label>
            <input type="text" value={milestone} onChange={(e) => setMilestone(e.target.value)} className="input" placeholder="e.g. Foundation Pouring" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Result</label>
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="select">
            <option value="Pass">Pass — Meets Standards</option>
            <option value="Conditional">Conditional — Minor Issues</option>
            <option value="Fail">Fail — Does Not Meet Standards</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Photo Evidence (IPFS Hash)</label>
          <input type="text" value={photoHash} onChange={(e) => setPhotoHash(e.target.value)} className="input" placeholder="Qm..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={5}
            placeholder="Detailed findings, measurements, compliance with specifications..." required />
        </div>
        <button type="submit" className="btn-primary w-full py-3">Submit Inspection Report</button>
      </form>
    </div>
  );
}

function DefectLog({ defects }: { defects: Defect[] }) {
  return (
    <div className="space-y-4">
      {defects.map((d) => (
        <div key={d.id} className="card p-5">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`badge ${
                d.severity === "Critical" ? "badge-red" : d.severity === "Major" ? "badge-amber" : "badge-blue"
              }`}>{d.severity}</span>
              <span className="text-sm text-slate-400">PVO #{d.pvoId}</span>
            </div>
            <span className={`badge ${d.status === "Open" ? "badge-red" : "badge-green"}`}>{d.status}</span>
          </div>
          <p className="text-sm text-slate-700">{d.description}</p>
          <p className="text-xs text-slate-400 mt-2">Reported {d.reportedDate}</p>
        </div>
      ))}
    </div>
  );
}

function ScheduleView({ inspections }: { inspections: Inspection[] }) {
  return (
    <div className="table-card">
      <table className="w-full">
        <thead>
          <tr>
            <th>ID</th>
            <th>PVO</th>
            <th>Milestone</th>
            <th>Type</th>
            <th>Site</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((i) => (
            <tr key={i.id}>
              <td className="font-mono text-slate-400">#{i.id}</td>
              <td>#{i.pvoId}</td>
              <td className="font-medium text-slate-900">{i.milestone}</td>
              <td className="text-slate-600">{i.type}</td>
              <td className="text-slate-500 text-xs">{i.site}</td>
              <td className="text-slate-500">{i.scheduledDate}</td>
              <td>
                <span className={`badge ${i.status === "Completed" ? "badge-green" : i.status === "Scheduled" ? "badge-blue" : "badge-amber"}`}>
                  {i.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
