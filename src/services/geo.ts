const geocodeCache = new Map<string, [number, number] | null>();

export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const key = address.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`;
    const res = await fetch(url, { headers: { "User-Agent": "BrasUX-Loja/1.0" } });
    const data = await res.json();
    const coords: [number, number] | null = data[0]
      ? [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

export type RouteInfo = {
  distance: number;
  duration: number;
  path: [number, number][];
};

export async function getRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      distance: r.distance,
      duration: r.duration,
      path: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    };
  } catch {
    return null;
  }
}

export function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function fmtDur(s: number) {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60 > 0 ? ` ${m % 60}min` : ""}`;
}
