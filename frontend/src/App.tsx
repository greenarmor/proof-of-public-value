import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { WalletProvider, useWallet } from "./wallet";
import { TransparencyPortal } from "./pages/TransparencyPortal";
import { AgencyDashboard } from "./pages/AgencyDashboard";
import { ContractorPortal } from "./pages/ContractorPortal";
import { EngineerPanel } from "./pages/EngineerPanel";
import { CitizenInterface } from "./pages/CitizenInterface";
import { AuditorDashboard } from "./pages/AuditorDashboard";
import { AIDashboard } from "./pages/AIDashboard";
import { AdminPanel } from "./pages/AdminPanel";
import { formatAddress } from "./helpers";

const NAV_ITEMS = [
  { to: "/", label: "🏛️ Public Projects" },
  { to: "/agency", label: "🏢 Agency" },
  { to: "/contractor", label: "🚧 Contractor" },
  { to: "/engineer", label: "🔧 Engineer" },
  { to: "/auditor", label: "📊 Auditor" },
  { to: "/citizen", label: "📸 Citizen" },
  { to: "/ai", label: "🤖 AI Monitor" },
  { to: "/admin", label: "⚙️ Admin" },
];

function Header() {
  const { address, connected, connect, disconnect } = useWallet();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="text-xl font-bold text-gray-900 tracking-tight">
            PoPV
          </NavLink>
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
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
            <button
              onClick={connect}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
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
              <Route path="/agency" element={<AgencyDashboard />} />
              <Route path="/contractor" element={<ContractorPortal />} />
              <Route path="/engineer" element={<EngineerPanel />} />
              <Route path="/citizen" element={<CitizenInterface />} />
              <Route path="/auditor" element={<AuditorDashboard />} />
              <Route path="/ai" element={<AIDashboard />} />
              <Route path="/admin" element={<AdminPanel />} />
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
