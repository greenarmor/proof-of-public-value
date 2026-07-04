import { useState, useEffect } from "react";

export function LandingPage({ onConnect }: { onConnect: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ──── Hero ──── */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-6">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-purple-950" />
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 50%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(59,130,246,0.2) 0%, transparent 50%)",
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/5"
              style={{
                width: Math.random() * 4 + 2 + "px",
                height: Math.random() * 4 + 2 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                animation: `float ${Math.random() * 10 + 15}s linear infinite`,
                animationDelay: `${Math.random() * 10}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm text-white/60">Now live on Stellar Testnet</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6">
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              No Proof.
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              No Payment.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Public money must prove measurable value before it's released.
            Every budget allocation becomes a programmable digital entity with
            5-gate conditional payments on the Stellar blockchain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onConnect}
              className="group relative px-8 py-4 rounded-2xl bg-white text-black font-semibold text-lg hover:scale-105 transition-all duration-300 shadow-2xl shadow-purple-500/20">
              <span className="relative z-10">Connect Freighter</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <a href="#features"
              className="px-8 py-4 rounded-2xl border border-white/10 text-white/70 font-medium text-lg hover:bg-white/5 transition-all">
              See How It Works ↓
            </a>
          </div>

          <p className="mt-6 text-sm text-white/30">
            Install <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white underline transition-colors">Freighter</a> to connect
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 z-10 animate-bounce">
          <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ──── Problem / Stats ──── */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-black to-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-purple-400 font-mono text-sm tracking-widest uppercase mb-4">The Problem</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white/90">Public money,</span>{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">zero accountability</span>
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Every year, governments lose $2.6 trillion to corruption. Ghost projects,
              inflated budgets, and untraceable fund flows — because money is released
              on signatures, not on proof of value.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: "$2.6T", label: "Lost to corruption annually", icon: "🏛️" },
              { value: "5 Gates", label: "Independent verification layers", icon: "🔒" },
              { value: "13 Roles", label: "No single point of failure", icon: "👥" },
            ].map((stat, i) => (
              <div key={i} className="group relative p-8 rounded-3xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all duration-500">
                <div className="text-4xl mb-4">{stat.icon}</div>
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <p className="text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── How It Works ──── */}
      <section id="features" className="relative py-32 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-purple-400 font-mono text-sm tracking-widest uppercase mb-4">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white/90 mb-6">
              Five gates. One rule.
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Every public project becomes a Public Value Object (PVO). Funds are locked
              in a dynamic escrow until all five independent verifications pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-20">
            {[
              { step: "01", title: "Evidence", icon: "📎", desc: "Contractor submits GPS, drone imagery, engineering reports with IPFS verification" },
              { step: "02", title: "Engineer", icon: "🔧", desc: "Licensed professional verifies structural integrity and specification compliance" },
              { step: "03", title: "AI Oracle", icon: "🤖", desc: "Automated fraud detection, risk scoring, GPS validation, cost simulation" },
              { step: "04", title: "Compliance", icon: "⚖️", desc: "Auditor checks procurement law, budget rules, and regulatory adherence" },
              { step: "05", title: "Community", icon: "📸", desc: "Citizens submit GPS-tagged field reports with RPT token staking" },
            ].map((gate, i) => (
              <div key={i} className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-purple-500/30 transition-all duration-500">
                <div className="text-purple-400 font-mono text-xs mb-3">{gate.step}</div>
                <div className="text-3xl mb-3">{gate.icon}</div>
                <h3 className="font-semibold text-white/90 mb-2">{gate.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{gate.desc}</p>
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-purple-500/0 group-hover:bg-purple-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Features Grid ──── */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-slate-950 to-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-purple-400 font-mono text-sm tracking-widest uppercase mb-4">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white/90 mb-6">
              Built for <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">transparency</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔗", title: "Serverless", desc: "No backend. No database. The Stellar blockchain is the infrastructure." },
              { icon: "🤖", title: "AI-Powered", desc: "Automated fraud detection, risk prediction, and evidence verification." },
              { icon: "📡", title: "IPFS Evidence", desc: "All photos, drone imagery, and documents stored immutably on IPFS." },
              { icon: "🔐", title: "Multi-Sig Gates", desc: "No single party can release funds. Four independent verifications required." },
              { icon: "💰", title: "Real Tokens", desc: "Escrow holds actual on-chain assets. Settlement via pPHP, USDC, or GovPHP." },
              { icon: "📊", title: "Public Index", desc: "Department rankings measuring value per peso. Full transparency for citizens." },
              { icon: "🏗️", title: "Integrity Bidding", desc: "Contractors scored on reputation, not just price. Past performance matters." },
              { icon: "🌍", title: "Cross-Border", desc: "International donors commit on-chain. Full traceability from pledge to payment." },
              { icon: "📋", title: "Immutable Audit", desc: "Every approval, every dispute, every payment recorded permanently on Stellar." },
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-500">{feature.icon}</div>
                <h3 className="font-semibold text-lg text-white/90 mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section className="relative py-32 px-6 bg-black">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-950/20 to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Ready to make public spending
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              proof-based.
            </span>
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-xl mx-auto">
            Connect your wallet to access all 13 role dashboards. Browse projects,
            commit grants, approve milestones, and verify public value.
          </p>
          <button onClick={onConnect}
            className="group relative px-10 py-5 rounded-2xl bg-white text-black font-semibold text-xl hover:scale-105 transition-all duration-300 shadow-2xl shadow-purple-500/30">
            <span className="relative z-10 flex items-center gap-3">
              Connect Wallet
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <p className="mt-6 text-sm text-white/20">
            Available on Stellar Testnet · Open source · Serverless
          </p>
        </div>
      </section>

      {/* ──── Footer ──── */}
      <footer className="py-12 px-6 border-t border-white/[0.05] bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/30">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">P</span>
            <span className="text-sm">Proof of Public Value</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/20">
            <span>Stellar Testnet</span>
            <span>·</span>
            <span>13 Contracts</span>
            <span>·</span>
            <span>13 Roles</span>
            <span>·</span>
            <span>183 Tests</span>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
