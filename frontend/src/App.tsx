import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { WalletProvider, useWallet } from "./wallet";
import { TransparencyPortal } from "./pages/TransparencyPortal";
import { AgencyDashboard } from "./pages/AgencyDashboard";
import { ContractorPortal } from "./pages/ContractorPortal";
import { EngineerPanel } from "./pages/EngineerPanel";
import { CitizenInterface } from "./pages/CitizenInterface";
import { AuditorDashboard } from "./pages/AuditorDashboard";
import { IndexLeaderboard } from "./pages/IndexLeaderboard";
import { ComplianceDashboard } from "./pages/ComplianceDashboard";
import { ProcurementMarketplace } from "./pages/ProcurementMarketplace";
import { EconomicMemory } from "./pages/EconomicMemory";
import { AIDashboard } from "./pages/AIDashboard";
import { AdminPanel } from "./pages/AdminPanel";
import { formatAddress } from "./helpers";

interface NavItem { to: string; label: string; icon: string; roles?: string[]; color?: string; }

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Projects", icon: "🏛️", color: "from-blue-500 to-cyan-400" },
  { to: "/index", label: "Index", icon: "🏆", color: "from-amber-500 to-yellow-400" },
  { to: "/memory", label: "Search", icon: "🔍", color: "from-slate-500 to-slate-400" },
  { to: "/citizen", label: "Citizen", icon: "📸", roles: ["Citizen", "Administrator"], color: "from-green-500 to-emerald-400" },
  { to: "/agency", label: "Agency", icon: "🏢", roles: ["GovernmentAgency", "Administrator"], color: "from-brand-600 to-brand-400" },
  { to: "/contractor", label: "Contractor", icon: "🚧", roles: ["Contractor", "Administrator"], color: "from-orange-500 to-amber-400" },
  { to: "/engineer", label: "Engineer", icon: "🔧", roles: ["Engineer", "Administrator"], color: "from-teal-500 to-cyan-400" },
  { to: "/auditor", label: "Auditor", icon: "📊", roles: ["Auditor", "CommissionOnAudit", "Administrator"], color: "from-red-500 to-pink-400" },
  { to: "/procurement", label: "Tenders", icon: "🏗️", roles: ["GovernmentAgency", "Administrator"], color: "from-indigo-500 to-blue-400" },
  { to: "/ai", label: "AI", icon: "🤖", roles: ["AIAuditor", "Administrator"], color: "from-purple-500 to-violet-400" },
  { to: "/compliance", label: "Comply", icon: "⚖️", roles: ["Auditor", "CommissionOnAudit", "Administrator"], color: "from-rose-500 to-red-400" },
  { to: "/admin", label: "Admin", icon: "⚙️", roles: ["Administrator"], color: "from-slate-600 to-slate-500" },
];

function AccessDenied() {
  const { connect, connected } = useWallet();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-7xl mb-6 animate-bounce">🔒</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
      <p className="text-slate-500 mb-6 max-w-md">Your wallet does not have the required role for this dashboard.</p>
      {!connected ? (
        <div className="space-y-3">
          <button onClick={connect} className="btn-primary px-8 py-3">Connect Wallet</button>
          <p className="text-sm text-slate-400">
            Install <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">Freighter</a> to connect
          </p>
        </div>
      ) : (
        <button onClick={() => navigate("/")} className="btn-secondary">Go to Public Projects →</button>
      )}
    </div>
  );
}

function Header() {
  const { address, connected, connect, disconnect, hasRole } = useWallet();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!connected) return false;
    return hasRole(...item.roles);
  });

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg text-slate-900 tracking-tight">
            <span className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-sm">P</span>
            <span className="hidden sm:inline">PoPV</span>
          </NavLink>
          <nav className="hidden lg:flex items-center gap-0.5">
            {visibleItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : "nav-link-inactive"}`}>
                <span className="mr-1">{item.icon}</span>{item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-mono text-slate-700">{formatAddress(address!, 4)}</span>
              </div>
              <button onClick={disconnect} className="text-sm text-slate-400 hover:text-red-500 transition-colors">Disconnect</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={connect} className="btn-primary text-xs px-4 py-2">Connect Wallet</button>
              <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 transition-colors">
                <span>Need Freighter?</span>
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          )}
          {/* Mobile menu toggle */}
          <button className="lg:hidden btn-ghost p-2" onClick={() => {}}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function ProtectedRoute({ element, roles }: { element: React.ReactNode; roles?: string[] }) {
  const { connected, hasRole } = useWallet();
  if (!roles || roles.length === 0) return <>{element}</>;
  if (!connected) return <AccessDenied />;
  if (!hasRole(...roles)) return <AccessDenied />;
  return <>{element}</>;
}

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
            <Routes>
              <Route path="/" element={<TransparencyPortal />} />
              <Route path="/index" element={<IndexLeaderboard />} />
              <Route path="/memory" element={<EconomicMemory />} />
              <Route path="/citizen" element={<ProtectedRoute element={<CitizenInterface />} roles={["Citizen", "Administrator"]} />} />
              <Route path="/agency" element={<ProtectedRoute element={<AgencyDashboard />} roles={["GovernmentAgency", "Administrator"]} />} />
              <Route path="/contractor" element={<ProtectedRoute element={<ContractorPortal />} roles={["Contractor", "Administrator"]} />} />
              <Route path="/engineer" element={<ProtectedRoute element={<EngineerPanel />} roles={["Engineer", "Administrator"]} />} />
              <Route path="/auditor" element={<ProtectedRoute element={<AuditorDashboard />} roles={["Auditor", "CommissionOnAudit", "Administrator"]} />} />
              <Route path="/procurement" element={<ProtectedRoute element={<ProcurementMarketplace />} roles={["GovernmentAgency", "Administrator"]} />} />
              <Route path="/ai" element={<ProtectedRoute element={<AIDashboard />} roles={["AIAuditor", "Administrator"]} />} />
              <Route path="/compliance" element={<ProtectedRoute element={<ComplianceDashboard />} roles={["Auditor", "CommissionOnAudit", "Administrator"]} />} />
              <Route path="/admin" element={<ProtectedRoute element={<AdminPanel />} roles={["Administrator"]} />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-200/80 py-6 text-center">
            <p className="text-sm text-slate-400">Proof of Public Value · Stellar Testnet · {new Date().getFullYear()}</p>
            <p className="text-xs text-slate-300 mt-1">No Proof. No Payment.</p>
          </footer>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
