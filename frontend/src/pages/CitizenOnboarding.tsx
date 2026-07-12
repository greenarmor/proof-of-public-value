import { useWallet } from "../wallet";

export function CitizenOnboarding() {
  const { address, connected, connect } = useWallet();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">🏛️</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Proof of Public Value</h2>
        <p className="text-slate-500 mb-6 max-w-md">Connect your Freighter wallet to begin your journey as a citizen guardian of public funds.</p>
        <button onClick={connect} className="btn-primary px-8 py-4 text-lg">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🤝</div>
        <h1 className="text-3xl font-bold text-slate-900">You Are the Final Gate</h1>
        <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
          In PoPV, citizens are the most powerful participants. You verify that government projects are real — on the ground, with your own eyes. Your reports become cryptographic proof that funds should be released.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">1 RPT</p>
          <p className="text-xs text-slate-400 mt-1">Soulbound Token Required</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">Gate 4 & 5</p>
          <p className="text-xs text-slate-400 mt-1">Your Verification Gates</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">₱0</p>
          <p className="text-xs text-slate-400 mt-1">Cannot be released without you</p>
        </div>
      </div>

      {/* How It Works */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">How You Protect Public Money</h2>
        <div className="space-y-3">
          {[
            { step: 1, icon: "🎫", title: "Get Your RPT Soulbound Token", desc: "RPT (Reporting Token) is your citizen credential. 1 RPT = your voice counts. Request it from the Admin Panel or ask your community leader. Without RPT, you cannot submit verified field reports." },
            { step: 2, icon: "🔍", title: "Find a Project Near You", desc: "Browse the Public Transparency Portal for projects in your area. Each PVO card shows location, budget, and progress. Click into any project to see its full detail — including which milestones still need community verification." },
            { step: 3, icon: "📸", title: "Visit the Site & Report", desc: "Go to the project location. Take GPS-tagged photos. Submit your report through the Citizen Interface. Your coordinates are validated against the project's expected location. Only reports within range count." },
            { step: 4, icon: "✅", title: "Verify Other Citizens' Reports", desc: "Gate 4 (Community Oracle) requires verified field reports from multiple independent citizens. No single person can pass this gate alone. Community consensus is required." },
            { step: 5, icon: "🔐", title: "Confirm the Gate", desc: "Once enough verified reports exist, you confirm the Community Gate (Gate 5). This is the final lock — funds cannot be released until citizens say the work is real." },
          ].map((item) => (
            <div key={item.step} className="card p-4 flex gap-4">
              <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">{item.icon}</div>
              <div>
                <h3 className="font-semibold text-slate-900">Step {item.step}: {item.title}</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why It Matters */}
      <div className="card p-6 bg-brand-50 border-brand-200">
        <h2 className="font-bold text-slate-900 mb-3">Why Your Participation Matters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-1">
            <p><strong>Without citizens:</strong></p>
            <p className="text-red-600">✗ Ghost projects go undetected</p>
            <p className="text-red-600">✗ Contractors paid for work never done</p>
            <p className="text-red-600">✗ No ground-truth verification</p>
          </div>
          <div className="space-y-1">
            <p><strong>With citizens:</strong></p>
            <p className="text-emerald-600">✓ Every project verified by real people</p>
            <p className="text-emerald-600">✓ Cryptographic proof on Stellar blockchain</p>
            <p className="text-emerald-600">✓ No peso released without community consensus</p>
          </div>
        </div>
        <p className="text-xs text-brand-600 mt-4 font-medium">
          "No proof. No payment. The citizens are the proof."
        </p>
      </div>

      {/* Get Started */}
      <div className="text-center space-y-3 pb-8">
        <h2 className="text-xl font-bold text-slate-900">Ready to Start?</h2>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/portal" className="btn-primary px-6 py-3">🏛️ Browse Projects</a>
          <a href="/citizen" className="btn-secondary px-6 py-3">📸 Citizen Interface</a>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Connected as: <code className="text-[11px]">{address?.slice(0, 16)}...</code>
        </p>
      </div>
    </div>
  );
}
