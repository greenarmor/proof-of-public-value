import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { formatBudget } from "../helpers";
import "leaflet/dist/leaflet.css";

interface PVOData {
  id: number; title: string; description: string; department: string;
  municipality: string; total_budget: string; status: string;
  contractor: string; public_value_score: number; milestones: number[]; created_at: number;
  gpsCoordinates?: Array<{ lat: number; lng: number; milestoneId: number; evidenceId: number }>;
  latitude?: number; longitude?: number;
}

const geo: Record<string, [number, number]> = {
  "Quezon City": [14.6760, 121.0437], "Manila": [14.5995, 120.9842],
  "Marikina": [14.6507, 121.1029], "Pasig": [14.5869, 121.0614],
  "Malaybalay": [8.1575, 125.1278], "Zamboanga": [6.9214, 122.0790],
  "Davao": [7.1907, 125.4553], "Cebu": [10.3157, 123.8854],
  "Baguio": [16.4023, 120.5960], "Iloilo": [10.7202, 122.5621],
  "Cagayan de Oro": [8.4542, 124.6319], "Taguig": [14.5176, 121.0509],
  "Makati": [14.5547, 121.0244], "Mandaluyong": [14.5794, 121.0352],
  "San Juan": [14.6000, 121.0333], "Caloocan": [14.6500, 120.9667],
  "Valenzuela": [14.7000, 120.9667], "Navotas": [14.6667, 120.9333],
  "Malabon": [14.6667, 120.9333], "Paranaque": [14.4667, 121.0167],
  "Las Pinas": [14.4500, 120.9833], "Muntinlupa": [14.3833, 121.0500],
  "Antipolo": [14.5833, 121.1667], "Taytay": [14.5667, 121.1333],
  "Cainta": [14.5833, 121.1167], "Angeles": [15.1500, 120.5833],
  "Olongapo": [14.8333, 120.2833], "Bacolod": [10.6667, 122.9500],
  "General Santos": [6.1167, 125.1667], "Butuan": [8.9500, 125.5333],
};

function getCoords(pvo: PVOData): [number, number] {
  if (pvo.latitude && pvo.longitude) {
    return [pvo.latitude + pvo.id * 0.0001, pvo.longitude + pvo.id * 0.0002];
  }
  const match = Object.keys(geo).find(k => pvo.municipality.toLowerCase().includes(k.toLowerCase()));
  if (match) {
    const [lat, lng] = geo[match];
    return [lat + pvo.id * 0.001, lng + pvo.id * 0.002];
  }
  return [12.8797 + pvo.id * 0.12, 121.7740 + pvo.id * 0.1];
}

function PVOMarker({ pvo, selected, onRegister }: { pvo: PVOData; selected: boolean; onRegister: (id: number, m: L.Marker | null) => void }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const m = markerRef.current;
    if (m) onRegister(pvo.id, m);
    return () => { onRegister(pvo.id, null); };
  }, [pvo.id, onRegister]);

  return (
    <Marker position={getCoords(pvo)} ref={markerRef} zIndexOffset={selected ? 1000 : 0}>
      <Popup>
        <strong>{pvo.title}</strong><br />
        {pvo.department} · {pvo.municipality}<br />
        Budget: {formatBudget(pvo.total_budget)}<br />
        Score: {pvo.public_value_score}/PPHP_SCALE<br />
        <span className="text-[10px] text-slate-400">{pvo.milestones.length} milestones</span>
      </Popup>
    </Marker>
  );
}

function MapFlyTo({ pvos, selectedPvoId }: { pvos: PVOData[]; selectedPvoId?: number }) {
  const map = useMap();
  useEffect(() => {
    if (selectedPvoId) {
      const pvo = pvos.find(p => p.id === selectedPvoId);
      if (pvo) map.flyTo(getCoords(pvo), 14, { duration: 0.8 });
    } else {
      map.flyTo([14.5995, 120.9842], 6, { duration: 0.8 });
    }
  }, [selectedPvoId, pvos, map]);
  return null;
}

export default function ProjectMap({ pvos, selectedPvoId }: { pvos: PVOData[]; selectedPvoId?: number }) {
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const registerMarker = useCallback((id: number, m: L.Marker | null) => {
    if (m) markerRefs.current.set(id, m);
    else markerRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (selectedPvoId) {
      setTimeout(() => {
        const marker = markerRefs.current.get(selectedPvoId);
        if (marker) marker.openPopup();
      }, 100);
    }
  }, [selectedPvoId]);

  return (
    <div style={{ height: "70vh", width: "100%" }} className="rounded-xl overflow-hidden border-2 border-brand-100">
      <MapContainer center={[14.5995, 120.9842]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFlyTo pvos={pvos} selectedPvoId={selectedPvoId} />
        {pvos.map((pvo) => (
          <PVOMarker key={pvo.id} pvo={pvo} selected={selectedPvoId === pvo.id} onRegister={registerMarker} />
        ))}
        {pvos.flatMap((pvo) =>
          (pvo.gpsCoordinates || []).map((gps, i) => (
            <Marker key={`gps-${pvo.id}-${i}`} position={[gps.lat, gps.lng]} zIndexOffset={2000}>
              <Popup>
                <strong>{pvo.title}</strong><br />
                📍 GPS Evidence #{gps.evidenceId}<br />
                Milestone #{gps.milestoneId}<br />
                {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>
    </div>
  );
}
