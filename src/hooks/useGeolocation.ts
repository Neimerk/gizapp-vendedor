import { useEffect, useState } from "react";

export type GeoState = {
  coords: [number, number] | null;
  error: string | null;
  loading: boolean;
};

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ coords: null, error: null, loading: true });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, error: "GPS não disponível", loading: false });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setState({ coords: [coords.latitude, coords.longitude], error: null, loading: false }),
      (err) => setState({ coords: null, error: err.message, loading: false }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
