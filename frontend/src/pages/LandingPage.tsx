import { useState, useEffect, useRef } from "react";
import { useWallet } from "../wallet";

export function LandingPage() {
  const { connect } = useWallet();
  const heroRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState({ hero: 0, stats: 0, features: 0, grid: 0, cta: 0 });

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setOffsets({
        hero: y * 0.4,
        stats: Math.max(0, (y - 300) * 0.15),
        features: Math.max(0, (y - 900) * 0.1),
        grid: Math.max(0, (y - 1500) * 0.08),
        cta: Math.max(0, (y - 2100) * 0.05),
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 overflow-x-hidden">
      {/* ──── Hero ──── */}
      <section id="hero" ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Parallax background blobs */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 50%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(circle at 70% 30%, rgba(14,165,233,0.08) 0%, transparent 60%)",
            transform: `translateY(${offsets.hero * 0.5}px)`,
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-100/30 blur-3xl"
          style={{ transform: `translateY(${offsets.hero * 0.2}px) translateX(${offsets.hero * 0.1}px)` }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-sky-100/20 blur-3xl"
          style={{ transform: `translateY(${-offsets.hero * 0.3}px)` }} />

        <div className="relative z-10 max-w-4xl">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-sm font-medium text-brand-600">Now live on Stellar Testnet</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6">
            <span className="text-slate-900">No Proof.</span>
            <br />
            <span className="gradient-brand bg-clip-text text-transparent">
              No Payment.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Public money must prove measurable value before it's released.
            Every budget allocation becomes a programmable digital entity with
            5-gate conditional payments on the Stellar blockchain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={connect}
              className="px-8 py-4 rounded-2xl gradient-brand text-white font-semibold text-lg hover:scale-105 transition-all duration-300 shadow-lg shadow-brand-200">
              Connect Freighter
            </button>
            <a href="#features"
              className="px-8 py-4 rounded-2xl bg-slate-100 text-slate-600 font-medium text-lg hover:bg-slate-200 transition-all">
              See How It Works ↓
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Install <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700 underline transition-colors font-medium">Freighter</a> to connect
          </p>
        </div>

        <div className="absolute bottom-8 z-10 animate-bounce">
          <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ──── Problem / Stats ──── */}
      <section id="problem" className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50"
          style={{ transform: `translateY(${offsets.stats}px)` }} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">The Problem</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              Public money,{" "}
              <span className="text-red-500">zero accountability</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every year, governments lose $2.6 trillion to corruption. Ghost projects,
              inflated budgets, and untraceable fund flows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: "$2.6T", label: "Lost to corruption annually", icon: "🏛️" },
              { value: "5 Gates", label: "Independent verification layers", icon: "🔒" },
              { value: "13 Roles", label: "No single point of failure", icon: "👥" },
            ].map((stat, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500"
                style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="text-4xl mb-4">{stat.icon}</div>
                <div className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">{stat.value}</div>
                <p className="text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── How It Works ──── */}
      <section id="features" className="relative py-32 px-6 bg-slate-50 overflow-hidden">
        <div className="absolute inset-0"
          style={{ transform: `translateY(${offsets.features}px)` }} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Five gates. One rule.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every project becomes a Public Value Object. Funds stay locked until all five verifications pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-20">
            {[
              { step: "01", title: "Evidence", icon: "📎", desc: "Contractor submits GPS, drone, engineering reports" },
              { step: "02", title: "Engineer", icon: "🔧", desc: "Licensed professional verifies structural integrity" },
              { step: "03", title: "AI Oracle", icon: "🤖", desc: "Automated fraud detection, risk scoring, validation" },
              { step: "04", title: "Compliance", icon: "⚖️", desc: "Auditor checks procurement law and budget rules" },
              { step: "05", title: "Community", icon: "📸", desc: "Citizens submit GPS-tagged field reports" },
            ].map((gate, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500"
                style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="text-brand-500 font-mono text-xs mb-3 font-semibold">{gate.step}</div>
                <div className="text-3xl mb-3">{gate.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{gate.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{gate.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Features Grid ──── */}
      <section id="capabilities" className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white"
          style={{ transform: `translateY(${offsets.grid}px)` }} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">Capabilities</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Built for{" "}
              <span className="gradient-brand bg-clip-text text-transparent">transparency</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔗", title: "Serverless", desc: "No backend. No database. Stellar is the infrastructure." },
              { icon: "🤖", title: "AI-Powered", desc: "Automated fraud detection, risk prediction, and verification." },
              { icon: "📡", title: "IPFS Evidence", desc: "Photos, drone imagery, documents stored immutably on IPFS." },
              { icon: "🔐", title: "Multi-Gate", desc: "No single party can release funds. Four verifications required." },
              { icon: "💰", title: "Real Tokens", desc: "Escrow holds actual on-chain assets via pPHP, USDC, or GovPHP." },
              { icon: "📊", title: "Public Index", desc: "Department rankings measuring value per peso spent." },
              { icon: "🏗️", title: "Integrity Bidding", desc: "Contractors scored on reputation, not just lowest price." },
              { icon: "🌍", title: "Cross-Border", desc: "International donors commit on-chain with full traceability." },
              { icon: "📋", title: "Immutable Audit", desc: "Every decision recorded permanently on Stellar." },
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500 text-center"
                style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-500 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50">{feature.icon}</div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2 text-center">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed text-center">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section id="connect" className="relative py-32 px-6 bg-gradient-to-br from-brand-50 via-white to-sky-50 overflow-hidden">
        <div className="absolute inset-0"
          style={{ transform: `translateY(${offsets.cta}px)` }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-slate-900">
            Ready to make public spending
            <br />
            <span className="gradient-brand bg-clip-text text-transparent">proof-based.</span>
          </h2>
          <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
            Connect your wallet to access all 13 role dashboards. Browse projects,
            commit grants, approve milestones, and verify public value.
          </p>
          <button onClick={connect}
            className="px-10 py-5 rounded-2xl gradient-brand text-white font-semibold text-xl hover:scale-105 transition-all duration-300 shadow-xl shadow-brand-200">
            <span className="flex items-center gap-3">
              Connect Wallet
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
          <p className="mt-6 text-sm text-slate-400">
            Available on Stellar Testnet · Open source · Serverless · 24 E2E tests passing
          </p>
        </div>
      </section>

      {/* ──── Footer ──── */}
      <footer className="py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center text-white text-xs font-bold">P</span>
            <span className="text-sm font-medium">Proof of Public Value</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>Stellar Testnet</span>
            <span>·</span>
            <span>13 Contracts</span>
            <span>·</span>
            <span>13 Roles</span>
            <span>·</span>
            <span>24 E2E Tests</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
