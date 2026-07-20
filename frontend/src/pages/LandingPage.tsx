import { useLocation, NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(
      /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 768),
    );
  }, []);
  return m;
}
import { useWallet } from "../wallet";

export function LandingPage() {
  const { connect, connectMobile } = useWallet();
  const isMobile = useIsMobile();
  const location = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState({ hero: 0, stats: 0, features: 0, grid: 0, cta: 0 });

  // Scroll to hash section on mount/navigation
  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location]);

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
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 overflow-x-hidden">
      {/* ──── Hero ──── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden"
      >
        {/* Parallax background blobs */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(circle at 70% 30%, rgba(14,165,233,0.08) 0%, transparent 60%)",
            transform: `translateY(${offsets.hero * 0.5}px)`,
          }}
        />
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-100/30 blur-3xl"
          style={{
            transform: `translateY(${offsets.hero * 0.2}px) translateX(${offsets.hero * 0.1}px)`,
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-sky-100/20 blur-3xl"
          style={{ transform: `translateY(${-offsets.hero * 0.3}px)` }}
        />

        <div className="relative z-10 max-w-4xl">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-sm font-medium text-brand-600">
              Now live on Stellar Testnet - Mobile App Available
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6">
            <span className="text-slate-900">Be the</span>
            <br />
            <span className="gradient-brand bg-clip-text text-transparent">Change.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-4 leading-relaxed">
            You don't fight corruption with anger. You defeat it with awareness.
          </p>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Step into every role of government - citizen, engineer, auditor, central banker - and
            see how blockchain transforms public funds into accountable, verifiable proof. No
            wrestling. No protests. Just clarity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isMobile ? (
              <button
                onClick={connectMobile}
                className="px-8 py-4 rounded-2xl gradient-brand text-white font-semibold text-lg hover:scale-105 transition-all duration-300 shadow-lg shadow-brand-200"
              >
                📱 Connect Wallet
              </button>
            ) : (
              <button
                onClick={connect}
                className="px-8 py-4 rounded-2xl gradient-brand text-white font-semibold text-lg hover:scale-105 transition-all duration-300 shadow-lg shadow-brand-200"
              >
                👛 Connect Freighter
              </button>
            )}
            <a
              href="#journey"
              className="px-8 py-4 rounded-2xl bg-slate-100 text-slate-600 font-medium text-lg hover:bg-slate-200 transition-all"
            >
              Start Your Journey ↓
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Install{" "}
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline transition-colors font-medium"
            >
              Freighter
            </a>{" "}
            to connect
          </p>
        </div>

        <div className="absolute bottom-8 z-10 animate-bounce">
          <svg
            className="w-6 h-6 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>

      {/* ──── Your Journey ──── */}
      <section id="journey" className="relative py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Your Journey to Accountability
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Start as a Citizen. Earn trust. Rise through every role of government - while
              blockchain keeps score.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                emoji: "📸",
                title: "Citizen Reporter",
                desc: "Download the app. Walk to project sites. Submit GPS-tagged proof. Earn pPHP rewards.",
                color: "border-emerald-400 bg-emerald-50",
              },
              {
                step: "2",
                emoji: "⭐",
                title: "Build Reputation",
                desc: "Verified reports increase your civic score. Higher tiers unlock bigger rewards and new role invitations.",
                color: "border-amber-400 bg-amber-50",
              },
              {
                step: "3",
                emoji: "🎭",
                title: "Role-Play Government",
                desc: "Get promoted to Engineer, Auditor, or Central Banker. Experience how every peso is tracked.",
                color: "border-brand-400 bg-brand-50",
              },
              {
                step: "4",
                emoji: "🔗",
                title: "Blockchain Judge",
                desc: "Every action is recorded on Stellar. Smart contracts verify, release, or freeze funds automatically.",
                color: "border-sky-400 bg-sky-50",
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`relative p-6 rounded-2xl border-2 ${item.color} transition-transform hover:scale-105`}
              >
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                  {item.step}
                </div>
                <div className="text-3xl mb-3">{item.emoji}</div>
                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-slate-400 text-sm mb-4">
              The system doesn't ask for permission. It asks for proof.
            </p>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white font-semibold hover:scale-105 transition-all shadow-lg shadow-brand-200"
            >
              🎭 Start Role-Playing Now
            </a>
          </div>
        </div>
      </section>

      {/* ──── Problem / Stats ──── */}
      <section id="problem" className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-b from-white to-slate-50"
          style={{ transform: `translateY(${offsets.stats}px)` }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">
              The Problem
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              Public money, <span className="text-red-500">zero accountability</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every year, governments lose $2.6 trillion to corruption. Ghost projects, inflated
              budgets, and untraceable fund flows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: "$2.6T", label: "Lost to corruption annually", icon: "🏛️" },
              { value: "5 Gates", label: "Independent verification layers", icon: "🔒" },
              { value: "13 Roles", label: "No single point of failure", icon: "👥" },
            ].map((stat, i) => (
              <div
                key={i}
                className="group p-8 rounded-3xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500 text-center"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-4xl mb-4 flex justify-center">{stat.icon}</div>
                <div className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">
                  {stat.value}
                </div>
                <p className="text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── How It Works ──── */}
      <section id="features" className="relative py-32 px-6 bg-slate-50 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ transform: `translateY(${offsets.features}px)` }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">
              How It Works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Five gates. One rule.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every project becomes a Public Value Object. Funds stay locked until all five
              verifications pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-20">
            <div className="md:col-span-3 p-4 rounded-2xl bg-brand-50 text-center flex flex-col items-center justify-center">
              <div className="text-2xl mb-2">📎</div>
              <p className="text-sm font-semibold text-brand-700">Evidence First</p>
              <p className="text-xs text-brand-500 mt-1">Contractor submits proof</p>
            </div>
            <div className="md:col-span-9">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { title: "Engineer", icon: "🔧", desc: "Technical sign-off" },
                  { title: "Compliance", icon: "⚖️", desc: "Legal check" },
                  { title: "Community", icon: "📸", desc: "GPS reports" },
                  { title: "Confirmations", icon: "👥", desc: "Threshold met" },
                  { title: "AI Risk", icon: "🤖", desc: "Runs last" },
                ].map((gate, i) => (
                  <div
                    key={i}
                    className="group p-4 rounded-2xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500 text-center"
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="text-brand-500 font-mono text-xs mb-2 font-semibold">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-2xl mb-2 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50">
                      {gate.icon}
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 mb-1">{gate.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{gate.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── Features Grid ──── */}
      <section id="capabilities" className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white"
          style={{ transform: `translateY(${offsets.grid}px)` }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-brand-600 font-semibold text-sm tracking-widest uppercase mb-4">
              Capabilities
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Built for{" "}
              <span className="gradient-brand bg-clip-text text-transparent">transparency</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🔗",
                title: "Serverless",
                desc: "No backend. No database. Stellar is the infrastructure.",
              },
              {
                icon: "🤖",
                title: "AI Forensic Engine",
                desc: "13-flag cross-contract analysis: fraud, risk, geo, digital twin, GPS. Zero random data.",
              },
              {
                icon: "📡",
                title: "IPFS Evidence",
                desc: "Photos, drone imagery, documents stored immutably on IPFS.",
              },
              {
                icon: "🔐",
                title: "Multi-Gate",
                desc: "No single party can release funds. Five independent verifications required.",
              },
              {
                icon: "💰",
                title: "Real Settlement",
                desc: "Testnet uses pPHP simulation token. Mainnet supports USDC, GovPHP, XLM, or any Stellar asset.",
              },
              {
                icon: "📊",
                title: "Public Index",
                desc: "Department rankings measuring value per peso spent.",
              },
              {
                icon: "🏗️",
                title: "Integrity Bidding",
                desc: "Contractors scored on reputation, not just lowest price.",
              },
              {
                icon: "🌍",
                title: "Cross-Border",
                desc: "International donors commit on-chain with full traceability.",
              },
              {
                icon: "📋",
                title: "Immutable Audit",
                desc: "Every decision recorded permanently on Stellar with tx hash links.",
              },
              {
                icon: "🔍",
                title: "Provenance Chain",
                desc: "Append-only audit trail: every event permanently linked to its Stellar transaction hash.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-3xl bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500 text-center"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-500 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2 text-center">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed text-center">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section
        id="connect"
        className="relative py-32 px-6 bg-gradient-to-br from-brand-50 via-white to-sky-50 overflow-hidden"
      >
        <div className="absolute inset-0" style={{ transform: `translateY(${offsets.cta}px)` }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-slate-900">
            Ready to make public spending
            <br />
            <span className="gradient-brand bg-clip-text text-transparent">proof-based.</span>
          </h2>
          <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
            Connect your wallet to access all 13 role dashboards. Browse projects, commit grants,
            approve milestones, and verify public value.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={connect}
              className="px-10 py-5 rounded-2xl gradient-brand text-white font-semibold text-xl hover:scale-105 transition-all duration-300 shadow-xl shadow-brand-200"
            >
              <span className="flex items-center gap-3">
                Connect Wallet
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </button>
            <NavLink
              to="/onboarding"
              className="px-8 py-5 rounded-2xl bg-white border-2 border-brand-200 text-brand-700 font-semibold text-lg hover:border-brand-400 hover:bg-brand-50 transition-all duration-300"
            >
              <span className="flex items-center gap-2">
                <span>🎭</span> Role-Play Demo
              </span>
            </NavLink>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Available on Stellar Testnet · Open source · Serverless · 40 contract tests passing
          </p>
        </div>
      </section>

      {/* ──── Footer ──── */}
      <footer className="py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center text-white text-xs font-bold">
              P
            </span>
            <span className="text-sm font-medium">Proof of Public Value</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>Stellar Testnet</span>
            <span>·</span>
            <span>13 Contracts</span>
            <span>·</span>
            <span>13 Roles</span>
            <span>·</span>
            <span>40 Contract Tests</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
