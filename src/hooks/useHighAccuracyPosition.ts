import { useState, useEffect, useRef } from 'react';

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

// PositionError codes per the W3C Geolocation API:
// 1 = PERMISSION_DENIED  → user said no, won't change without browser action
// 2 = POSITION_UNAVAILABLE → device can't determine location (no GPS, etc.)
// 3 = TIMEOUT → fix didn't arrive in time; watchPosition will keep retrying
export interface GeoError {
  code: 1 | 2 | 3;
  message: string;
}

// `highAccuracy=false` returns a coarse fix quickly and tolerates ~1min stale
// readings; right for the wizard map where the user just needs a sensible
// initial centre. The default (true, fresh) is what the active-game HUD wants
// because the capture radius check is 15m and accuracy matters.
export function useHighAccuracyPosition(active = true, highAccuracy = true) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
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
      setError({ code: 2, message: 'Geolocalizzazione non supportata' });
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
      { enableHighAccuracy: highAccuracy, timeout: 15_000, maximumAge: highAccuracy ? 0 : 60_000 }
    );

    // Bumped the watch timeout to 30s. Desktops doing IP/Wi-Fi triangulation
    // routinely take 10-20s for the first fix; the previous 10s threshold
    // produced a TIMEOUT error before the browser had a chance to deliver
    // anything. The TIMEOUT is recoverable (watchPosition keeps retrying)
    // so consumers can afford to wait a bit before surfacing it as fatal.
    watchId.current = navigator.geolocation.watchPosition(
      setFromCoords,
      (err) => {
        setError({ code: err.code as 1 | 2 | 3, message: err.message });
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 30_000,
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
