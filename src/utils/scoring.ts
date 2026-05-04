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

  // Linear decay with a 1pt floor for any correct answer submitted within the
  // round window. Spec promised the floor universally; the previous code
  // dropped to 0 for very-late-but-valid answers (e.g. 9999/10000) because
  // floor(10 * 0.0001) = 0. Keeping the linear curve but flooring at 1pt
  // preserves the "speed matters" gradient without ever zero-ing a correct
  // in-window submission.
  const decay = 1 - (timeMs / maxTimeMs);
  return Math.max(1, Math.floor(maxPoints * decay));
}
