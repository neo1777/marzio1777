import { useState, useEffect, useRef } from 'react';

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

// `highAccuracy=false` returns a coarse fix quickly and tolerates ~1min stale
// readings; right for the wizard map where the user just needs a sensible
// initial centre. The default (true, fresh) is what the active-game HUD wants
// because the capture radius check is 15m and accuracy matters.
export function useHighAccuracyPosition(active = true, highAccuracy = true) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata');
      return;
    }

    // Kick off a one-shot getCurrentPosition for a fast initial fix, then
    // hand over to watchPosition for ongoing updates. On desktop, watch alone
    // can take 5-10s to fire its first callback; the one-shot bypasses that.
    const setFromCoords = (pos: GeolocationPosition) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
      setError(null);
    };

    navigator.geolocation.getCurrentPosition(
      setFromCoords,
      () => { /* swallow — watchPosition below will surface persistent errors */ },
      { enableHighAccuracy: highAccuracy, timeout: 8000, maximumAge: highAccuracy ? 0 : 60_000 }
    );

    watchId.current = navigator.geolocation.watchPosition(
      setFromCoords,
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: highAccuracy ? 0 : 60_000,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [active, highAccuracy]);

  return { position, error };
}

// Haversine formula to calculate distance between two points in meters
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
