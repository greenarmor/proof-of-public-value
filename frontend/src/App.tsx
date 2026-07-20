import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { Fragment } from "react";
import { Contract, rpc, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { WalletProvider, useWallet } from "./wallet";
import { TransparencyPortal } from "./pages/TransparencyPortal";
import { RolePlayOnboarding } from "./pages/RolePlayOnboarding";
import { AgencyDashboard } from "./pages/AgencyDashboard";
import { ContractorPortal } from "./pages/ContractorPortal";
import { EngineerPanel } from "./pages/EngineerPanel";
import { CitizenInterface } from "./pages/CitizenInterface";
import { AuditorDashboard } from "./pages/AuditorDashboard";
import { IndexLeaderboard } from "./pages/IndexLeaderboard";
import { ComplianceDashboard } from "./pages/ComplianceDashboard";
import { ProcurementMarketplace } from "./pages/ProcurementMarketplace";
import { EscrowMonitor } from "./pages/EscrowMonitor";
import { EconomicMemory } from "./pages/EconomicMemory";
import { AIDashboard } from "./pages/AIDashboard";
import { AdminPanel } from "./pages/AdminPanel";
import { CentralBankDashboard } from "./pages/CentralBankDashboard";
import { InspectorPanel } from "./pages/InspectorPanel";
import { SupplierPortal } from "./pages/SupplierPortal";
import { AntiCorruptionDashboard } from "./pages/AntiCorruptionDashboard";
import { FunderDashboard } from "./pages/FunderDashboard";
import { DonorDashboard } from "./pages/DonorDashboard";
import { LandingPage } from "./pages/LandingPage";
import { CitizenOnboarding } from "./pages/CitizenOnboarding";
import { ProvenanceExplorer } from "./pages/ProvenanceExplorer";
import { formatAddress } from "./helpers";
import { Client as PvoCoreClient } from "./contracts/pvo_core/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "./config";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/portal", label: "Public Portal", icon: "🏛️", group: "public" },
  { to: "/onboarding", label: "Role-Play", icon: "🎭", group: "public" },
  { to: "/provenance", label: "Explorer", icon: "📋", roles: ["Administrator"], group: "public" },
  { to: "/escrows", label: "Escrows", icon: "🔒", roles: ["Administrator"], group: "public" },
  { to: "/#features", label: "How It Works", icon: "🔄", group: "landing" },
  { to: "/#capabilities", label: "Capabilities", icon: "✨", group: "landing" },
  { to: "/#connect", label: "Connect", icon: "🔗", group: "landing" },

  {
    to: "/citizen",
    label: "Citizen",
    icon: "📸",
    roles: ["Citizen", "Administrator"],
    group: "engagement",
  },

  {
    to: "/agency",
    label: "Agency",
    icon: "🏢",
    roles: ["GovernmentAgency", "Administrator"],
    group: "government",
  },
  {
    to: "/procurement",
    label: "Tenders",
    icon: "🏗️",
    roles: ["GovernmentAgency", "Administrator"],
    group: "government",
  },

  {
    to: "/contractor",
    label: "Contractor",
    icon: "🚧",
    roles: ["Contractor", "Administrator"],
    group: "delivery",
  },
  {
    to: "/engineer",
    label: "Engineer",
    icon: "🔧",
    roles: ["Engineer", "Administrator"],
    group: "government",
  },
  {
    to: "/inspector",
    label: "Inspector",
    icon: "🔎",
    roles: ["Inspector", "Administrator"],
    group: "government",
  },
  {
    to: "/supplier",
    label: "Supplier",
    icon: "📦",
    roles: ["Supplier", "Administrator"],
    group: "delivery",
  },

  {
    to: "/auditor",
    label: "Auditor",
    icon: "📊",
    roles: ["Auditor", "CommissionOnAudit", "Administrator"],
    group: "oversight",
  },
  {
    to: "/compliance",
    label: "Compliance",
    icon: "⚖️",
    roles: ["Auditor", "CommissionOnAudit", "Administrator"],
    group: "oversight",
  },
  {
    to: "/anticorruption",
    label: "Anti-Corruption",
    icon: "🛡️",
    roles: ["AntiCorruptionAgency", "Administrator"],
    group: "oversight",
  },
  {
    to: "/ai",
    label: "AI Monitor",
    icon: "🤖",
    roles: ["AIAuditor", "Administrator"],
    group: "public",
  },

  {
    to: "/funder",
    label: "Funding Agency",
    icon: "💰",
    roles: ["FundingAgency", "Administrator"],
    group: "government",
  },
  {
    to: "/donor",
    label: "Int'l Donor",
    icon: "🌍",
    roles: ["InternationalDonor", "Administrator"],
    group: "finance",
  },

  {
    to: "/central-bank",
    label: "Central Bank",
    icon: "🏦",
    roles: ["CentralBank", "Administrator"],
    group: "system",
  },
  { to: "/admin", label: "System Panel", icon: "⚙️", roles: ["Administrator"], group: "system" },
];

const GROUP_LABELS: Record<string, string> = {
  engagement: "Community",
  government: "Government",
  delivery: "Project Delivery",
  oversight: "Oversight & Audit",
  finance: "Funding",
  system: "System",
};

const GROUP_ORDER = ["engagement", "government", "delivery", "oversight", "finance", "system"];

function Home() {
  const { connected, connect, roles } = useWallet();
  if (!connected) return <LandingPage />;
  if (roles.length === 0) return <LandingPage />;
  return <TransparencyPortal />;
}

function AccessDenied() {
  const { connect, connected } = useWallet();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-7xl mb-6 animate-bounce">🔒</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
      <p className="text-slate-500 mb-6 max-w-md">
        Your wallet does not have the required role for this dashboard.
      </p>
      {!connected ? (
        <div className="space-y-3">
          <button onClick={connect} className="btn-primary px-8 py-3">
            Connect Wallet
          </button>
          <p className="text-sm text-slate-400">
            Install{" "}
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline font-medium"
            >
              Freighter
            </a>{" "}
            to connect
          </p>
        </div>
      ) : (
        <button onClick={() => navigate("/")} className="btn-secondary">
          Go to Public Projects →
        </button>
      )}
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(
      /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 768),
    );
  }, []);
  return mobile;
}

function Header() {
  const { address, connected, connect, disconnect, roles, hasRole, connectMobile } = useWallet();
  const isMobile = useIsMobile();
  const [dashboardsOpen, setDashboardsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const publicItems = NAV_ITEMS.filter(
    (i) =>
      i.group === "public" &&
      (!i.roles || i.roles.some((r) => hasRole(r))) &&
      !(connected && roles.length > 0 && i.to === "/onboarding"),
  );
  const landingItems = NAV_ITEMS.filter((i) => i.group === "landing");
  const roleItems = NAV_ITEMS.filter((i) => i.group !== "public" && i.group !== "system");
  const systemItems = NAV_ITEMS.filter((i) => i.group === "system");

  const visibleRoleItems = roleItems.filter((item) => {
    if (!connected) return false;
    return hasRole(...(item.roles || []));
  });
  const visibleSystemItems = systemItems.filter((item) => {
    if (!connected) return false;
    return hasRole(...(item.roles || []));
  });

  const grouped = GROUP_ORDER.filter((g) => g !== "public")
    .map((g) => ({ group: g, items: visibleRoleItems.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  const activeRoleLabel = [...visibleRoleItems, ...visibleSystemItems].find(
    (i) => window.location.pathname === i.to,
  );

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <NavLink
            to="/#hero"
            className="flex items-center gap-2 font-bold text-lg text-slate-900 tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-sm">
              P
            </span>
            <span className="hidden sm:inline">PoPV</span>
          </NavLink>

          {/* Desktop: primary nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {/* Landing page nav - hidden when wallet connected with role */}
            {(!connected || roles.length === 0) &&
              landingItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="nav-link nav-link-inactive">
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            {publicItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : "nav-link-inactive"}`
                }
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}

            {/* Dashboards dropdown */}
            {connected && (
              <div
                className="relative"
                onMouseEnter={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  setDashboardsOpen(true);
                }}
                onMouseLeave={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = setTimeout(() => setDashboardsOpen(false), 150);
                }}
              >
                <button
                  onClick={() => setDashboardsOpen((o) => !o)}
                  className={`nav-link ${dashboardsOpen || activeRoleLabel ? "nav-link-active" : "nav-link-inactive"}`}
                >
                  <span className="mr-1">📊</span>Dashboards
                  <span className="ml-1 text-[9px]">
                    {visibleRoleItems.length > 0 ? `${visibleRoleItems.length}` : ""}
                  </span>
                  <svg
                    className={`w-3 h-3 ml-0.5 transition-transform ${dashboardsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dashboardsOpen && (
                  <div className="absolute top-full left-0 mt-1 w-[400px] bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 grid grid-cols-2 gap-x-1 gap-y-0">
                    {visibleRoleItems.length === 0 && visibleSystemItems.length === 0 ? (
                      <NavLink
                        to="/citizen-onboarding"
                        onClick={() => setDashboardsOpen(false)}
                        className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-brand-50"
                      >
                        <span>🤝</span>My Dashboard
                      </NavLink>
                    ) : null}
                    {grouped.map(({ group, items }) => (
                      <Fragment key={group}>
                        <p className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 pt-1.5 pb-0.5">
                          {GROUP_LABELS[group]}
                        </p>
                        {items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setDashboardsOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`
                            }
                          >
                            <span className="text-sm">{item.icon}</span>
                            <span>{item.label}</span>
                          </NavLink>
                        ))}
                      </Fragment>
                    ))}
                    {visibleSystemItems.length > 0 && (
                      <>
                        <div className="col-span-2 border-t border-slate-100 mt-1" />
                        {visibleSystemItems.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setDashboardsOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`
                            }
                          >
                            <span className="text-sm">{item.icon}</span>
                            <span>{item.label}</span>
                          </NavLink>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-mono text-slate-700">
                  {formatAddress(address!, 4)}
                </span>
                {roles.length > 0 && (
                  <span className="hidden sm:inline text-[10px] text-slate-400 ml-1">
                    · {roles.join(", ")}
                  </span>
                )}
              </div>
              <button
                onClick={disconnect}
                className="hidden sm:inline text-sm text-slate-400 hover:text-red-500 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isMobile ? (
                <a
                  href="https://github.com/greenarmor/proof-of-public-value/releases"
                  target="_blank"
                  rel="noopener"
                  className="btn-primary text-xs px-3 py-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  📱 Download the App
                </a>
              ) : (
                <button onClick={connect} className="btn-primary text-xs px-3 py-2">
                  👛 Connect Freighter
                </button>
              )}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 transition-colors"
              >
                <span>Need Freighter?</span>
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button className="lg:hidden btn-ghost p-2" onClick={() => setMobileOpen((o) => !o)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white max-h-[80vh] overflow-y-auto">
          <nav className="px-4 py-3 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Public
              </p>
              {(!connected || roles.length === 0) &&
                landingItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 w-full text-left"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              {publicItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {GROUP_LABELS[group]}
                </p>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`
                    }
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
            {visibleSystemItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  System
                </p>
                {visibleSystemItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`
                    }
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>
        </div>
      )}
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

function DevBanner() {
  const [pvoCount, setPvoCount] = useState<number | null>(null);

  const checkPvoCount = useCallback(async () => {
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_IDS.pvo_core);
      const account = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("get_pvo_count"))
        .setTimeout(30)
        .build();
      const sim: any = await server.simulateTransaction(tx);
      if (sim.result?.retval?.value !== undefined) {
        setPvoCount(Number(sim.result.retval.value()));
      }
    } catch {
      setPvoCount(null);
    }
  }, []);

  useEffect(() => {
    checkPvoCount();
    const interval = setInterval(checkPvoCount, 30_000);
    return () => clearInterval(interval);
  }, [checkPvoCount]);

  if (pvoCount === null || pvoCount > 0) return null;

  return (
    <div className="sticky bottom-0 z-40 bg-amber-50 border-t border-amber-200 overflow-hidden">
      <div className="py-2 whitespace-nowrap" style={{ animation: "marquee 18s linear infinite" }}>
        <span className="text-sm text-amber-800 font-medium px-4">
          Smart contracts may be redeployed when gaps are found and fixed during active development
          - only affected contracts are reset while the rest keep their state
        </span>
      </div>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/citizen-onboarding" element={<CitizenOnboarding />} />
              <Route path="/portal" element={<TransparencyPortal />} />
              <Route path="/onboarding" element={<RolePlayOnboarding />} />
              <Route path="/index" element={<IndexLeaderboard />} />
              <Route path="/memory" element={<EconomicMemory />} />
              <Route
                path="/citizen"
                element={
                  <ProtectedRoute
                    element={<CitizenInterface />}
                    roles={["Citizen", "Administrator"]}
                  />
                }
              />
              <Route
                path="/agency"
                element={
                  <ProtectedRoute
                    element={<AgencyDashboard />}
                    roles={["GovernmentAgency", "Administrator"]}
                  />
                }
              />
              <Route
                path="/contractor"
                element={
                  <ProtectedRoute
                    element={<ContractorPortal />}
                    roles={["Contractor", "Administrator"]}
                  />
                }
              />
              <Route
                path="/engineer"
                element={
                  <ProtectedRoute
                    element={<EngineerPanel />}
                    roles={["Engineer", "Administrator"]}
                  />
                }
              />
              <Route
                path="/auditor"
                element={
                  <ProtectedRoute
                    element={<AuditorDashboard />}
                    roles={["Auditor", "CommissionOnAudit", "Administrator"]}
                  />
                }
              />
              <Route
                path="/procurement"
                element={
                  <ProtectedRoute
                    element={<ProcurementMarketplace />}
                    roles={["GovernmentAgency", "Administrator", "Contractor", "Supplier"]}
                  />
                }
              />
              <Route
                path="/provenance"
                element={
                  <ProtectedRoute element={<ProvenanceExplorer />} roles={["Administrator"]} />
                }
              />
              <Route
                path="/ai"
                element={
                  <ProtectedRoute
                    element={<AIDashboard />}
                    roles={["AIAuditor", "Administrator"]}
                  />
                }
              />
              <Route
                path="/escrows"
                element={<ProtectedRoute element={<EscrowMonitor />} roles={["Administrator"]} />}
              />
              <Route
                path="/compliance"
                element={
                  <ProtectedRoute
                    element={<ComplianceDashboard />}
                    roles={["Auditor", "CommissionOnAudit", "Administrator"]}
                  />
                }
              />
              <Route
                path="/inspector"
                element={
                  <ProtectedRoute
                    element={<InspectorPanel />}
                    roles={["Inspector", "Administrator"]}
                  />
                }
              />
              <Route
                path="/supplier"
                element={
                  <ProtectedRoute
                    element={<SupplierPortal />}
                    roles={["Supplier", "Administrator"]}
                  />
                }
              />
              <Route
                path="/funder"
                element={
                  <ProtectedRoute
                    element={<FunderDashboard />}
                    roles={["FundingAgency", "Administrator"]}
                  />
                }
              />
              <Route
                path="/donor"
                element={
                  <ProtectedRoute
                    element={<DonorDashboard />}
                    roles={["InternationalDonor", "Administrator"]}
                  />
                }
              />
              <Route
                path="/anticorruption"
                element={
                  <ProtectedRoute
                    element={<AntiCorruptionDashboard />}
                    roles={["AntiCorruptionAgency", "Administrator"]}
                  />
                }
              />
              <Route
                path="/admin"
                element={<ProtectedRoute element={<AdminPanel />} roles={["Administrator"]} />}
              />
              <Route
                path="/central-bank"
                element={
                  <ProtectedRoute element={<CentralBankDashboard />} roles={["CentralBank", "Administrator"]} />
                }
              />
            </Routes>
          </main>
          <footer className="border-t border-slate-200/80 py-6 text-center">
            <p className="text-sm text-slate-400">
              Proof of Public Value · Stellar Testnet · {new Date().getFullYear()}
            </p>
            <p className="text-xs text-slate-300 mt-1">No Proof. No Payment.</p>
          </footer>
          <DevBanner />
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
