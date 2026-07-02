import { useState } from "react";
import { useWallet } from "../wallet";

export function EngineerPanel() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"review" | "approve" | "notes">("review");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Wallet Connection Required</h2>
        <p className="text-gray-500 mb-4">Connect your wallet to review evidence and approve milestones.</p>
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Engineer & Inspector Panel</h1>
      <p className="text-gray-500 mb-6">Review submitted evidence, approve milestones, and submit inspection reports.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["review", "approve", "notes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "review" && "🔍 Pending Evidence"}
            {tab === "approve" && "✅ Approve Milestones"}
            {tab === "notes" && "📝 Field Notes"}
          </button>
        ))}
      </div>

      {activeTab === "review" && <ReviewEvidence />}
      {activeTab === "approve" && <ApproveMilestones />}
      {activeTab === "notes" && <FieldNotes />}
    </div>
  );
}

function ReviewEvidence() {
  const items = [
    { id: 3, pvoId: 1, milestoneId: 2, type: "DroneImagery", hash: "hash123", metadata: "drone flyover", submitted: "Jul 3, 2026" },
    { id: 4, pvoId: 1, milestoneId: 2, type: "GpsCoordinates", hash: "gps456", metadata: "site coords", submitted: "Jul 3, 2026" },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Evidence #{item.id}</h3>
              <p className="text-sm text-gray-500">PVO #{item.pvoId} · Milestone #{item.milestoneId}</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-50 text-yellow-700">Pending Review</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Type:</span> {item.type.replace(/([A-Z])/g, " $1").trim()}</div>
            <div><span className="text-gray-500">Hash:</span> <code className="text-xs">{item.hash}</code></div>
            <div><span className="text-gray-500">Metadata:</span> {item.metadata}</div>
            <div><span className="text-gray-500">Submitted:</span> {item.submitted}</div>
          </div>
          <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
            <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Approve</button>
            <button className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Reject</button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="text-center py-10 text-gray-400">No evidence pending review.</div>}
    </div>
  );
}

function ApproveMilestones() {
  const milestones = [
    { id: 2, pvoId: 1, title: "Site Preparation", status: "EvidenceSubmitted", evidence: "2/2 required", confirmations: 2 },
  ];

  return (
    <div className="space-y-4">
      {milestones.map((m) => (
        <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{m.title}</h3>
              <p className="text-sm text-gray-500">PVO #{m.pvoId} · Milestone #{m.id}</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700">{m.status.replace(/([A-Z])/g, " $1").trim()}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">5-Gate Progress</span>
                <span className="font-medium text-gray-700">5/5 complete</span>
              </div>
              <div className="mt-2 flex gap-1">
                {["Engineer", "AI", "Compliance", "Community", "Ready"].map((gate, i) => (
                  <div key={gate} className="flex-1">
                    <div className="h-2 bg-green-500 rounded-full" />
                    <span className="text-[10px] text-gray-400 mt-0.5 block text-center">{gate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            Engineer Approve Milestone #{m.id}
          </button>
        </div>
      ))}
    </div>
  );
}

function FieldNotes() {
  const [notes, setNotes] = useState("");
  const [pvoId, setPvoId] = useState("");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Submit Field Notes</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PVO ID</label>
          <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={5}
            placeholder="Site inspection findings, observations, recommendations..." required />
        </div>
        <button type="submit" className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Submit Field Notes
        </button>
      </form>
    </div>
  );
}
