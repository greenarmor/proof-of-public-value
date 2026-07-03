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

interface NavItem {
  to: string;
  label: string;
  roles?: string[];  // empty = public
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "🏛️ Public Projects" },
  { to: "/index", label: "🏆 National Index" },
  { to: "/memory", label: "🔍 Search" },
  { to: "/citizen", label: "📸 Citizen", roles: ["Citizen", "Administrator"] },
  { to: "/agency", label: "🏢 Agency", roles: ["GovernmentAgency", "Administrator"] },
  { to: "/contractor", label: "🚧 Contractor", roles: ["Contractor", "Administrator"] },
  { to: "/engineer", label: "🔧 Engineer", roles: ["Engineer", "Administrator"] },
  { to: "/auditor", label: "📊 Auditor", roles: ["Auditor", "CommissionOnAudit", "Administrator"] },
  { to: "/procurement", label: "🏗️ Tenders", roles: ["GovernmentAgency", "Administrator"] },
  { to: "/ai", label: "🤖 AI Monitor", roles: ["AIAuditor", "Administrator"] },
  { to: "/compliance", label: "⚖️ Compliance", roles: ["Auditor", "CommissionOnAudit", "Administrator"] },
  { to: "/admin", label: "⚙️ Admin", roles: ["Administrator"] },
];

function AccessDenied() {
  const { connect, connected } = useWallet();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-6xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
      <p className="text-gray-500 mb-4">Your wallet does not have the required role for this dashboard.</p>
      {!connected ? (
        <button onClick={connect} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Connect Wallet
        </button>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">Connected wallet does not have authorization.</p>
          <button onClick={() => navigate("/")} className="text-sm text-purple-600 hover:underline">
            Go to Public Portal →
          </button>
        </>
      )}
    </div>
  );
}

function Header() {
  const { address, connected, connect, disconnect, hasRole } = useWallet();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!connected) return false;
    return hasRole(...item.roles);
  });

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="text-xl font-bold text-gray-900 tracking-tight">
            PoPV
          </NavLink>
          <nav className="hidden lg:flex items-center gap-0.5">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive ? "bg-purple-50 text-purple-700" : "text-gray-500 hover:text-gray-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div>
          {connected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {formatAddress(address!)}
              </span>
              <button onClick={disconnect} className="text-sm text-gray-400 hover:text-gray-600">
                Disconnect
              </button>
            </div>
          ) : (
            <button onClick={connect} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
              Connect Wallet
            </button>
          )}
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
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main className="max-w-7xl mx-auto px-4 py-8">
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
          <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
            Proof of Public Value · Stellar Testnet · {new Date().getFullYear()}
          </footer>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
