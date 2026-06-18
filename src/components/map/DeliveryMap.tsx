import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress, getRoute, fmtDist, fmtDur, type RouteInfo } from "../../services/geo";

const courierIcon = new L.DivIcon({
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#15803d);border:3px solid white;box-shadow:0 3px 14px rgba(22,163,74,0.55);display:flex;align-items:center;justify-content:center;">
    <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
  </div>`,
});

const destIcon = new L.DivIcon({
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  html: `<div style="position:relative;width:34px;height:44px;">
    <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#ef4444,#f97316);border:3px solid white;box-shadow:0 3px 14px rgba(239,68,68,0.5);position:absolute;top:0;left:0;"></div>
    <div style="position:absolute;top:9px;left:9px;width:14px;height:14px;border-radius:50%;background:white;"></div>
  </div>`,
});

function AutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length === 0) return;
    fitted.current = true;
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [52, 52], maxZoom: 16 });
    } else {
      map.setView(positions[0], 15);
    }
  }, [positions.length]);
  return null;
}

type Props = {
  address: string;
  courierCoords?: [number, number] | null;
  height?: number;
};

export default function DeliveryMap({ address, courierCoords, height = 280 }: Props) {
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound">("loading");
  const routeDone = useRef(false);

  useEffect(() => {
    setStatus("loading");
    routeDone.current = false;
    geocodeAddress(address).then((coords) => {
      setDestCoords(coords);
      setStatus(coords ? "ok" : "notfound");
    });
  }, [address]);

  // Calculate route once when both coords are ready
  useEffect(() => {
    if (!courierCoords || !destCoords || routeDone.current) return;
    routeDone.current = true;
    getRoute(courierCoords, destCoords).then(setRoute);
  }, [courierCoords, destCoords]);

  const allPositions: [number, number][] = [
    ...(courierCoords ? [courierCoords] : []),
    ...(destCoords ? [destCoords] : []),
  ];

  const center: [number, number] = destCoords ?? courierCoords ?? [-23.55, -46.63];

  return (
    <div style={{ height }} className="relative overflow-hidden rounded-2xl border border-[#e2e8f0]">
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f8fafc]">
          <p className="text-xs text-[#94a3b8] animate-pulse">Carregando mapa…</p>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        <AutoFit positions={allPositions} />

        {courierCoords && (
          <Marker position={courierCoords} icon={courierIcon}>
            <Popup>
              <span className="text-xs font-bold">Você está aqui</span>
            </Popup>
          </Marker>
        )}

        {destCoords && (
          <Marker position={destCoords} icon={destIcon}>
            <Popup>
              <span className="text-xs font-bold">Destino da entrega</span>
            </Popup>
          </Marker>
        )}

        {route && (
          <Polyline positions={route.path} color="#16a34a" weight={5} opacity={0.85} />
        )}
      </MapContainer>

      {/* Info bar */}
      {route && (
        <div className="absolute bottom-3 left-1/2 z-[999] -translate-x-1/2 flex gap-2 pointer-events-none">
          <div className="rounded-full bg-white px-4 py-1.5 text-xs font-black text-[#0f172a] shadow-lg ring-1 ring-black/5">
            📍 {fmtDist(route.distance)}
          </div>
          <div className="rounded-full bg-[#16a34a] px-4 py-1.5 text-xs font-black text-white shadow-lg">
            ⏱ {fmtDur(route.duration)}
          </div>
        </div>
      )}

      {!courierCoords && status === "ok" && (
        <div className="absolute bottom-3 left-3 z-[999] rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 pointer-events-none">
          GPS desativado — ative para ver rota
        </div>
      )}

      {status === "notfound" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f8fafc]/70 z-[999]">
          <p className="text-xs text-[#94a3b8]">Endereço não encontrado no mapa</p>
        </div>
      )}
    </div>
  );
}
