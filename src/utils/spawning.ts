import { haversineDistance } from './geo';

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
