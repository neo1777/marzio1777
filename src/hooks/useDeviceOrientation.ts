import { useState, useEffect, useRef } from 'react';

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<{alpha: number, beta: number, gamma: number, heading: number | null}>({ alpha: 0, beta: 0, gamma: 0, heading: null });
  const [permission, setPermission] = useState<'granted' | 'denied' | 'unavailable' | 'prompt'>('prompt');
  // `available` is true once an actual orientation event has been received
  // (i.e. the device has a working gyroscope and is emitting). Distinguishes
  // "permission granted but no physical sensor" (desktop, VMs, some kiosks)
  // from "permission denied" — the AR overlay uses this to fall back to a
  // tap-to-capture mode instead of pretending to track an absent sensor and
  // leaving the emoji glued to screen-center.
  const [available, setAvailable] = useState<boolean>(false);
  const eventsReceivedRef = useRef(false);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!eventsReceivedRef.current) {
        eventsReceivedRef.current = true;
        setAvailable(true);
      }
      setOrientation({
        alpha: e.alpha ?? 0,
        beta: e.beta ?? 0,
        gamma: e.gamma ?? 0,
        heading: (e as any).webkitCompassHeading !== undefined ? (e as any).webkitCompassHeading : (e.alpha !== null ? 360 - e.alpha : null),
      });
    };

    if (permission === 'denied' || permission === 'unavailable') {
      setAvailable(false);
      return;
    }

    if (permission === 'granted' || permission === 'prompt') {
      eventsReceivedRef.current = false;
      setAvailable(false);
      window.addEventListener('deviceorientationabsolute', handleOrientation as any);
      window.addEventListener('deviceorientation', handleOrientation);

      // 5s grace: if no orientation event arrives, treat the sensor as
      // effectively absent. Cleared as soon as the first event lands
      // (handleOrientation flips eventsReceivedRef before the timer fires).
      const t = setTimeout(() => {
        if (!eventsReceivedRef.current) setAvailable(false);
      }, 5000);

      return () => {
        clearTimeout(t);
        window.removeEventListener('deviceorientationabsolute', handleOrientation as any);
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, [permission]);

  const requestPermission = async (): Promise<'granted' | 'denied' | 'unavailable'> => {
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const state = await DOE.requestPermission();
        const res = state === 'granted' ? 'granted' : 'denied';
        setPermission(res);
        return res;
      } catch {
        setPermission('denied');
        return 'denied';
      }
    }
    // Android is granted by default
    if (DOE) {
      setPermission('granted');
      return 'granted';
    }
    
    setPermission('unavailable');
    return 'unavailable';
  };

  return { orientation, permission, available, requestPermission };
}
