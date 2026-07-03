import { useState } from "react";
import { useWallet } from "../wallet";
import { formatAddress, formatBudget } from "../helpers";
import { getCurrency } from "../config";

interface Milestone {
  id: number;
  title: string;
  status: "Pending" | "EvidenceSubmitted" | "Approved" | "Released";
  budget: number;
  progress: number;
  dueDate: string;
  gates: { engineer: boolean; ai: boolean; compliance: boolean; community: boolean };
}

interface TeamMember {
  address: string;
  role: string;
  name: string;
  assignedTasks: number;
}

const mockMilestones: Milestone[] = [
  { id: 1, title: "Site Preparation", status: "Released", budget: 2000000, progress: 100, dueDate: "Jun 15, 2026", gates: { engineer: true, ai: true, compliance: true, community: true } },
  { id: 2, title: "Foundation Pouring", status: "EvidenceSubmitted", budget: 3500000, progress: 80, dueDate: "Jul 10, 2026", gates: { engineer: true, ai: true, compliance: false, community: false } },
  { id: 3, title: "Structural Framework", status: "Pending", budget: 4500000, progress: 0, dueDate: "Aug 15, 2026", gates: { engineer: false, ai: false, compliance: false, community: false } },
];

const mockTeam: TeamMember[] = [
  { address: "G...LPRW", role: "Contractor", name: "BuildRight Construction", assignedTasks: 3 },
  { address: "G...42MN", role: "Engineer", name: "Eng. Cruz", assignedTasks: 2 },
  { address: "G...Z5F7", role: "Inspector", name: "Insp. Reyes", assignedTasks: 1 },
  { address: "G...4OK", role: "Auditor", name: "COA-Region IV", assignedTasks: 0 },
];

export function ProjectManagerDashboard() {
  const { connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "team" | "timeline">("overview");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to access the project management dashboard.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Project Manager Dashboard</h1>
      <p className="text-slate-500 mb-6">Milestone coordination, team management, and project timeline oversight.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["overview", "milestones", "team", "timeline"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "overview" && "📊 Overview"}
            {tab === "milestones" && "🏗️ Milestones"}
            {tab === "team" && "👥 Team"}
            {tab === "timeline" && "📅 Timeline"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <Overview milestones={mockMilestones} />}
      {activeTab === "milestones" && <Milestones milestones={mockMilestones} />}
      {activeTab === "team" && <Team team={mockTeam} />}
      {activeTab === "timeline" && <Timeline milestones={mockMilestones} />}
    </div>
  );
}

function Overview({ milestones }: { milestones: Milestone[] }) {
  const currency = getCurrency();
  const totalBudget = milestones.reduce((sum, m) => sum + m.budget, 0);
  const released = milestones.filter((m) => m.status === "Released").reduce((sum, m) => sum + m.budget, 0);
  const avgProgress = Math.round(milestones.reduce((sum, m) => sum + m.progress, 0) / milestones.length);
  const pendingGates = milestones.reduce((count, m) =>
    count + Object.values(m.gates).filter((g) => !g).length, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Budget", value: `${currency} ${formatBudget(totalBudget)}`, color: "text-slate-900" },
          { label: "Disbursed", value: `${currency} ${formatBudget(released)}`, color: "text-emerald-600" },
          { label: "Avg Progress", value: `${avgProgress}%`, color: "text-brand-600" },
          { label: "Pending Gates", value: String(pendingGates), color: "text-amber-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Project Progress</h3>
        {milestones.map((m) => (
          <div key={m.id} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">{m.title}</span>
              <span className="text-slate-500">{m.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${m.progress === 100 ? "progress-green" : "progress-purple"}`} style={{ width: `${m.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Milestones({ milestones }: { milestones: Milestone[] }) {
  const currency = getCurrency();
  return (
    <div className="space-y-4">
      {milestones.map((m) => (
        <div key={m.id} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">Milestone #{m.id}: {m.title}</h3>
              <p className="text-sm text-slate-500">{currency} {formatBudget(m.budget)} · Due {m.dueDate}</p>
            </div>
            <span className={`badge ${
              m.status === "Released" ? "badge-green" :
              m.status === "Approved" ? "badge-blue" :
              m.status === "EvidenceSubmitted" ? "badge-amber" : "badge-purple"
            }`}>{m.status.replace(/([A-Z])/g, " $1").trim()}</span>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Progress</span>
              <span className="font-medium text-slate-700">{m.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${m.progress === 100 ? "progress-green" : "progress-purple"}`} style={{ width: `${m.progress}%` }} />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            {[
              { label: "Engineer", done: m.gates.engineer },
              { label: "AI", done: m.gates.ai },
              { label: "Compliance", done: m.gates.compliance },
              { label: "Community", done: m.gates.community },
            ].map((gate) => (
              <div key={gate.label} className={`px-3 py-1 rounded-lg text-xs font-medium ${
                gate.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
              }`}>
                {gate.done ? "✓" : "○"} {gate.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Team({ team }: { team: TeamMember[] }) {
  return (
    <div className="table-card">
      <table className="w-full">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Wallet</th>
            <th>Active Tasks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {team.map((member) => (
            <tr key={member.address}>
              <td className="font-medium text-slate-900">{member.name}</td>
              <td>
                <span className="badge badge-purple">{member.role}</span>
              </td>
              <td className="font-mono text-xs text-slate-500">{formatAddress(member.address, 4)}</td>
              <td className="text-slate-600">{member.assignedTasks}</td>
              <td>
                <button className="text-xs text-brand-600 hover:underline">View Profile</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
      {milestones.map((m, idx) => (
        <div key={m.id} className="relative mb-6 last:mb-0">
          <div className={`absolute -left-[22px] w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs ${
            m.status === "Released" ? "bg-emerald-500" :
            m.status === "EvidenceSubmitted" ? "bg-amber-500" :
            m.status === "Approved" ? "bg-blue-500" : "bg-slate-300"
          }`}>
            <span className="text-white font-bold">{idx + 1}</span>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">{m.title}</h4>
              <span className="text-xs text-slate-400">{m.dueDate}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{m.progress}% complete · {m.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
