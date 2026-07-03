import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { formatBudget } from "../helpers";

interface PVOData {
  id: number;
  title: string;
  description: string;
  department: string;
  municipality: string;
  total_budget: string;
  status: string;
  contractor: string;
  public_value_score: number;
  milestones: number[];
  created_at: number;
}

export default function ProjectMap({ pvos }: { pvos: PVOData[] }) {
  return (
    <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
      <MapContainer center={[14.5995, 120.9842]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pvos.map((pvo) => (
          <Marker key={pvo.id} position={[14.5995 + pvo.id * 0.1, 120.9842 + pvo.id * 0.1]}>
            <Popup>
              <strong>{pvo.title}</strong><br />
              {pvo.department} · {pvo.municipality}<br />
              Budget: ⨎ {formatBudget(pvo.total_budget)}<br />
              Score: {pvo.public_value_score}/100
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
