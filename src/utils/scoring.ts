export function calculateQuizPoints(
  scoringMode: 'fixed' | 'decay',
  isCorrect: boolean,
  timeMs: number,
  maxTimeMs: number,
  maxPoints: number = 10
): number {
  if (!isCorrect) return 0;
  if (scoringMode === 'fixed') return maxPoints;
  
  if (timeMs <= 0) return maxPoints;
  if (timeMs >= maxTimeMs) return Math.max(1, Math.floor(maxPoints * 0.1));
  
  const decay = 1 - (timeMs / maxTimeMs);
  return Math.floor(maxPoints * decay);
}
