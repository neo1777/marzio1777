import { useMemo } from 'react';
import { haversineDistance } from '../utils/geo';

export function useHaversineDistance(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): number | null {
  return useMemo(() => {
    if (!a || !b) return null;
    return haversineDistance(a, b);
  }, [a?.lat, a?.lng, b?.lat, b?.lng]);
}
