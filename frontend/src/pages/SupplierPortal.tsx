import { useState } from "react";
import { useWallet } from "../wallet";
import { formatAddress, formatBudget } from "../helpers";
import { getCurrency } from "../config";

interface Delivery {
  id: number;
  pvoId: number;
  material: string;
  quantity: string;
  supplier: string;
  deliveryDate: string;
  status: "Pending" | "In Transit" | "Delivered" | "Verified";
  poNumber: string;
}

interface Material {
  id: number;
  name: string;
  specification: string;
  unit: string;
  unitPrice: number;
  stock: number;
}

const mockDeliveries: Delivery[] = [
  { id: 1, pvoId: 1, material: "Portland Cement Type I", quantity: "500 bags", supplier: "G...LPRW", deliveryDate: "Jul 4, 2026", status: "In Transit", poNumber: "PO-2026-0042" },
  { id: 2, pvoId: 1, material: "Deformed Steel Bars (12mm)", quantity: "2000 pcs", supplier: "G...LPRW", deliveryDate: "Jul 3, 2026", status: "Delivered", poNumber: "PO-2026-0041" },
  { id: 3, pvoId: 2, material: "Asphalt Binder Course", quantity: "850 tons", supplier: "G...LPRW", deliveryDate: "Jul 2, 2026", status: "Verified", poNumber: "PO-2026-0039" },
];

const mockMaterials: Material[] = [
  { id: 1, name: "Portland Cement Type I", specification: "ASTM C150", unit: "bag (40kg)", unitPrice: 280, stock: 1500 },
  { id: 2, name: "Deformed Steel Bars", specification: "12mm Grade 60", unit: "piece (12m)", unitPrice: 580, stock: 3200 },
  { id: 3, name: "Ready-Mix Concrete", specification: "28 MPa @ 28 days", unit: "cubic meter", unitPrice: 5500, stock: 0 },
  { id: 4, name: "Asphalt Binder", specification: "AC-20", unit: "ton", unitPrice: 4200, stock: 120 },
];

export function SupplierPortal() {
  const { connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"deliveries" | "catalog" | "purchase" | "tracking">("deliveries");

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Wallet Connection Required</h2>
        <p className="text-slate-500 mb-4">Connect your wallet to manage supply chain deliveries.</p>
        <button onClick={connect} className="btn-primary px-6 py-3">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Supplier Portal</h1>
      <p className="text-slate-500 mb-6">Material catalog, purchase orders, delivery tracking, and inventory management.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["deliveries", "catalog", "purchase", "tracking"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "deliveries" && "🚚 Deliveries"}
            {tab === "catalog" && "📋 Material Catalog"}
            {tab === "purchase" && "🛒 Create PO"}
            {tab === "tracking" && "📍 Tracking"}
          </button>
        ))}
      </div>

      {activeTab === "deliveries" && <DeliveriesTab deliveries={mockDeliveries} />}
      {activeTab === "catalog" && <CatalogTab materials={mockMaterials} />}
      {activeTab === "purchase" && <PurchaseOrderForm />}
      {activeTab === "tracking" && <TrackingTab deliveries={mockDeliveries} />}
    </div>
  );
}

function DeliveriesTab({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <div className="table-card">
      <table className="w-full">
        <thead>
          <tr>
            <th>PO #</th>
            <th>PVO</th>
            <th>Material</th>
            <th>Qty</th>
            <th>Supplier</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id}>
              <td className="font-mono text-xs text-slate-500">{d.poNumber}</td>
              <td>#{d.pvoId}</td>
              <td className="font-medium text-slate-900">{d.material}</td>
              <td className="text-slate-600">{d.quantity}</td>
              <td className="font-mono text-xs text-slate-500">{formatAddress(d.supplier, 4)}</td>
              <td className="text-slate-500">{d.deliveryDate}</td>
              <td>
                <span className={`badge ${
                  d.status === "Verified" ? "badge-green" :
                  d.status === "Delivered" ? "badge-blue" :
                  d.status === "In Transit" ? "badge-amber" : "badge-purple"
                }`}>{d.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogTab({ materials }: { materials: Material[] }) {
  const currency = getCurrency();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {materials.map((m) => (
        <div key={m.id} className="card p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-slate-900">{m.name}</h3>
              <p className="text-xs text-slate-400">{m.specification}</p>
            </div>
            <span className={`badge ${m.stock > 0 ? "badge-green" : "badge-red"}`}>
              {m.stock > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 text-sm">
            <div>
              <p className="text-xs text-slate-400">Unit Price</p>
              <p className="font-semibold text-slate-900">{currency} {formatBudget(m.unitPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Stock</p>
              <p className="font-semibold text-slate-900">{m.stock.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Unit</p>
              <p className="text-slate-600">{m.unit}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PurchaseOrderForm() {
  const [pvoId, setPvoId] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");

  return (
    <div className="card p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4 text-slate-900">Create Purchase Order</h2>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PVO ID</label>
          <input type="number" value={pvoId} onChange={(e) => setPvoId(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
          <select value={material} onChange={(e) => setMaterial(e.target.value)} className="select">
            <option value="">Select material...</option>
            <option value="Portland Cement Type I">Portland Cement Type I</option>
            <option value="Deformed Steel Bars (12mm)">Deformed Steel Bars (12mm)</option>
            <option value="Ready-Mix Concrete (28 MPa)">Ready-Mix Concrete (28 MPa)</option>
            <option value="Asphalt Binder (AC-20)">Asphalt Binder (AC-20)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" placeholder="e.g. 500 bags" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Address</label>
            <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" placeholder="G..." required />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-3">Submit Purchase Order</button>
      </form>
    </div>
  );
}

function TrackingTab({ deliveries }: { deliveries: Delivery[] }) {
  const active = deliveries.filter((d) => d.status === "In Transit" || d.status === "Pending");
  return (
    <div className="space-y-4">
      {active.map((d) => (
        <div key={d.id} className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">{d.material}</h3>
              <p className="text-sm text-slate-500">{d.poNumber} · {d.quantity}</p>
            </div>
            <span className="badge badge-amber">{d.status}</span>
          </div>
          <div className="flex items-center gap-2">
            {["Ordered", "Dispatched", "In Transit", "On Site", "Verified"].map((step, i) => {
              const currentIdx = d.status === "Pending" ? 0 : d.status === "In Transit" ? 2 : 4;
              const done = i <= currentIdx;
              return (
                <div key={step} className="flex-1 text-center">
                  <div className={`h-2 rounded-full ${done ? "bg-brand-500" : "bg-slate-200"}`} />
                  <span className={`text-[10px] mt-1 block ${done ? "text-brand-600 font-medium" : "text-slate-400"}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {active.length === 0 && <div className="text-center py-10 text-slate-400">No active deliveries to track.</div>}
    </div>
  );
}
