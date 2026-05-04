import type { Post } from '../types';

export type QuestionType =
  | 'guess_who'
  | 'guess_year'
  | 'guess_place'
  | 'guess_caption'
  | 'chronology';

export interface GeneratedQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  postId: string;
}

/**
 * REGISTRY DEI QUESTION GENERATORS PER IL QUIZ DEL BIVACCO.
 *
 * Status (Phase 2 partial — closed in commit fixing §15.B of AUDIT_REPORT):
 * - guess_who:      ✅ implemented (distractors = 3 different authorNames)
 * - guess_year:     ✅ implemented (distractors = 3 decades within ±20y)
 * - guess_place:    ⏳ still null — requires reverse-geocoding (Nominatim or
 *                   cached). Kept manual for MVP; the wizard `Manuale` badge
 *                   stays on this type until a Phase 2.5 deliverable.
 * - guess_caption:  ✅ implemented (distractors = 3 random other captions)
 * - chronology:     ✅ implemented (4 decade permutations, one is correct)
 *
 * Determinism: all generators use a seeded RNG keyed off `post.id`. Two host
 * sessions with the same source post + pool produce the same distractor set,
 * which keeps the UX consistent if the host re-rolls the wizard, and lets the
 * unit tests assert exact outputs without flakiness.
 *
 * Schema invariance: still emit `{questionText, options[4], correctIndex,
 * postId}`. The `quizRounds.{sourcePostId}` field on Firestore was already
 * carved out for this; no migration required.
 */
export type QuestionGenerator = (
  post: Post,
  poolPosts: Post[]
) => GeneratedQuestion | null;

const AUTO_AVAILABLE: Record<QuestionType, boolean> = {
  guess_who: true,
  guess_year: true,
  // Reverse-geocoding (Nominatim / cached lat-lng → place name) deferred
  // to Phase 2.5; the wizard keeps the `Manuale` badge on this type and
  // the host composes manually.
  guess_place: false,
  guess_caption: true,
  chronology: true,
};

export function isAutoGenerationAvailable(type: QuestionType): boolean {
  return AUTO_AVAILABLE[type] ?? false;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** mulberry32 PRNG — small, deterministic, fast. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

/** Fisher-Yates shuffle with a seeded RNG (deterministic per `seedKey`). */
function shuffleSeeded<T>(arr: T[], seedKey: string): T[] {
  const rng = mulberry32(hashString(seedKey));
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `n` unique values keyed by `keyFn`, deterministic by `seedKey`. */
function pickUniqueSeeded<T>(
  pool: T[],
  n: number,
  keyFn: (t: T) => string | undefined | null,
  seedKey: string
): string[] {
  const shuffled = shuffleSeeded(pool, seedKey);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of shuffled) {
    const k = keyFn(item);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length === n) break;
  }
  return out;
}

/** Parse a `decade` string like '1970', '70', '70s' or 'Anni 70' into a year. */
function parseDecade(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d{2,4})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (isNaN(n)) return null;
  if (n < 100) return 1900 + n;
  return n;
}

function formatDecade(year: number): string {
  // 1900–1999 → short form ("Anni 70", matches the README copy and the
  // existing decade filter UI). 2000+ → full year to avoid the "Anni 00"
  // ambiguity (year 0 / year 100 / year 2000) and to keep ordering visible
  // in the chronology generator's join.
  if (year >= 2000) return `Anni ${year}`;
  return `Anni ${String(year).slice(-2)}`;
}

// ─── Generators ────────────────────────────────────────────────────────────

const guess_who: QuestionGenerator = (post, pool) => {
  if (!post.authorName || post.authorName.trim().length === 0) return null;
  const others = pool.filter(
    p => p.authorName && p.authorName.trim().length > 0 && p.authorName !== post.authorName
  );
  const distractors = pickUniqueSeeded(others, 3, p => p.authorName, post.id);
  if (distractors.length < 3) return null;
  const all = shuffleSeeded([post.authorName, ...distractors], post.id + ':who');
  const correctIndex = all.indexOf(post.authorName) as 0 | 1 | 2 | 3;
  return {
    questionText: 'Chi compare in questa foto?',
    options: all as [string, string, string, string],
    correctIndex,
    postId: post.id,
  };
};

const guess_year: QuestionGenerator = (post, pool) => {
  const sourceYear = parseDecade(post.decade);
  if (sourceYear === null) return null;
  const correctText = formatDecade(sourceYear);

  // Try distractors from the actual pool first (real decades that exist);
  // fall back to synthetic ±20y decades if the pool is too thin.
  const poolDecades = new Set<number>();
  for (const p of pool) {
    const y = parseDecade(p.decade);
    if (y !== null && y !== sourceYear) poolDecades.add(y);
  }
  const candidates = Array.from(poolDecades);
  const rng = mulberry32(hashString(post.id + ':year'));
  // Add synthetic candidates within ±20y to widen the pool for thin archives.
  for (const offset of [-20, -10, 10, 20]) {
    const candidate = sourceYear + offset;
    if (candidate > 1850 && candidate < 2030) candidates.push(candidate);
  }
  // Deduplicate, drop the source.
  const uniqueCandidates = Array.from(new Set(candidates)).filter(y => y !== sourceYear);
  if (uniqueCandidates.length < 3) return null;

  // Shuffle and take 3.
  for (let i = uniqueCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [uniqueCandidates[i], uniqueCandidates[j]] = [uniqueCandidates[j], uniqueCandidates[i]];
  }
  const distractorTexts = uniqueCandidates.slice(0, 3).map(formatDecade);
  // Guard against accidental collisions after formatting (e.g. 1970 + offset 0 → 1970)
  const uniqueTexts = Array.from(new Set(distractorTexts)).filter(t => t !== correctText);
  if (uniqueTexts.length < 3) return null;

  const all = shuffleSeeded([correctText, ...uniqueTexts.slice(0, 3)], post.id + ':year');
  const correctIndex = all.indexOf(correctText) as 0 | 1 | 2 | 3;
  return {
    questionText: 'In che decennio è stata scattata?',
    options: all as [string, string, string, string],
    correctIndex,
    postId: post.id,
  };
};

const guess_place: QuestionGenerator = (_post, _pool) => {
  // Reverse-geocoding (lat-lng → place name) deferred to Phase 2.5.
  // Reasons: (a) free-tier Nominatim is rate-limited (1 req/s), so the host
  // wizard would need a cache; (b) results need post-processing to be
  // distinguishable as quiz options ("Marzio (VA), Italia" vs "Marzio (CO),
  // Italia"). Kept null so the wizard shows the `Manuale` badge.
  return null;
};

const guess_caption: QuestionGenerator = (post, pool) => {
  if (!post.caption || post.caption.trim().length < 5) return null;
  const others = pool.filter(
    p => p.id !== post.id && p.caption && p.caption.trim().length >= 5 && p.caption !== post.caption
  );
  const distractors = pickUniqueSeeded(others, 3, p => p.caption, post.id);
  if (distractors.length < 3) return null;
  const all = shuffleSeeded([post.caption, ...distractors], post.id + ':caption');
  const correctIndex = all.indexOf(post.caption) as 0 | 1 | 2 | 3;
  return {
    questionText: 'Qual è la didascalia originale?',
    options: all as [string, string, string, string],
    correctIndex,
    postId: post.id,
  };
};

const chronology: QuestionGenerator = (post, pool) => {
  // Need ≥4 distinct decades total (source + 3 others). Format the question
  // as "put these decades in chronological order"; one option string is the
  // correct sorted permutation, the other three are distinct wrong shuffles.
  const sourceYear = parseDecade(post.decade);
  if (sourceYear === null) return null;
  const decadeYears = new Set<number>([sourceYear]);
  for (const p of pool) {
    if (p.id === post.id) continue;
    const y = parseDecade(p.decade);
    if (y !== null) decadeYears.add(y);
  }
  if (decadeYears.size < 4) return null;

  // Pick 4 distinct decades — always include the source, then 3 random others.
  const others = Array.from(decadeYears).filter(y => y !== sourceYear);
  const rng = mulberry32(hashString(post.id + ':chronology'));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const fourYears = [sourceYear, ...others.slice(0, 3)];
  const correctOrder = [...fourYears].sort((a, b) => a - b);
  const correctText = correctOrder.map(formatDecade).join(' → ');

  // Generate 3 distinct wrong permutations.
  const wrongs = new Set<string>();
  let attempts = 0;
  while (wrongs.size < 3 && attempts < 50) {
    const perm = fourYears.slice();
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const text = perm.map(formatDecade).join(' → ');
    if (text !== correctText) wrongs.add(text);
    attempts++;
  }
  if (wrongs.size < 3) return null;

  const all = shuffleSeeded([correctText, ...Array.from(wrongs).slice(0, 3)], post.id + ':chronology-final');
  const correctIndex = all.indexOf(correctText) as 0 | 1 | 2 | 3;
  return {
    questionText: 'Metti questi decenni in ordine cronologico:',
    options: all as [string, string, string, string],
    correctIndex,
    postId: post.id,
  };
};

export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who,
  guess_year,
  guess_place,
  guess_caption,
  chronology,
};
