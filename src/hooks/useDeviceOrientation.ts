import { useState, useEffect } from 'react';

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<{alpha: number, beta: number, gamma: number, heading: number | null}>({ alpha: 0, beta: 0, gamma: 0, heading: null });
  const [permission, setPermission] = useState<'granted' | 'denied' | 'unavailable' | 'prompt'>('prompt');

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setOrientation({
        alpha: e.alpha ?? 0,
        beta: e.beta ?? 0,
        gamma: e.gamma ?? 0,
        heading: (e as any).webkitCompassHeading !== undefined ? (e as any).webkitCompassHeading : (e.alpha !== null ? 360 - e.alpha : null),
      });
    };

    if (permission === 'granted' || permission === 'prompt') {
      window.addEventListener('deviceorientationabsolute', handleOrientation as any);
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
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

  return { orientation, permission, requestPermission };
}
