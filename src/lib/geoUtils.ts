const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const λ1 = toRad(from.lng);
  const λ2 = toRad(to.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function generateUniformPointsInRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  count: number,
  minSeparationMeters: number = 8
): Array<{ lat: number; lng: number }> {
  const result: Array<{ lat: number; lng: number }> = [];
  let attempts = 0;
  const maxAttempts = count * 50;

  while (result.length < count && attempts < maxAttempts) {
    attempts++;
    const r = radiusMeters * Math.sqrt(Math.random());
    const θ = 2 * Math.PI * Math.random();
    const latOffset = (r * Math.cos(θ)) / 111_320;
    const lngOffset = (r * Math.sin(θ)) / (111_320 * Math.cos((centerLat * Math.PI) / 180));
    const candidate = { lat: centerLat + latOffset, lng: centerLng + lngOffset };

    const tooClose = result.some(
      (p) => haversineDistance(p, candidate) < minSeparationMeters
    );
    if (!tooClose) result.push(candidate);
  }
  return result;
}
