import { useEffect, useState } from 'react';
import { collectionGroup, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
   computeGagliardetti,
   GagliardettoState,
   UserMetrics,
   ZERO_METRICS,
} from '../lib/gagliardetti';
import type { UserProfile } from '../types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = (uid: string) => `marzio1777:gagliardetti:${uid}`;

interface CachedSnapshot {
   metrics: UserMetrics;
   ts: number;
}

function readCache(uid: string): CachedSnapshot | null {
   try {
      const raw = localStorage.getItem(CACHE_KEY(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedSnapshot;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed;
   } catch {
      return null;
   }
}

function writeCache(uid: string, metrics: UserMetrics) {
   try {
      const payload: CachedSnapshot = { metrics, ts: Date.now() };
      localStorage.setItem(CACHE_KEY(uid), JSON.stringify(payload));
   } catch {
      // private mode / quota exceeded — silently drop
   }
}

/**
 * Compute every metric needed by the gagliardetti catalog. Each call hits
 * Firestore with ~6 collection-group queries; results cached locally for
 * 1h. Cheap on the Spark plan (a few reads per opening of the Profile
 * page) — but if the count grows, switch to denormalised counters on the
 * user doc, updated by transactions in the existing closeSession /
 * advanceGameEventStatus paths.
 */
async function fetchUserMetrics(uid: string, basePoints: number): Promise<UserMetrics> {
   // Run the queries in parallel. `getCountFromServer` is the cheap
   // Firestore primitive for "how many docs match this filter"; charges
   // 1 read per query regardless of how many docs are counted.
   //
   // We accept a small over-count for the listener count (it picks up
   // the user's own DJ sessions); we subtract `djSessionsTotal` after.
   const [
      gameJoinsSnap,
      gameWinsSnap,
      huntLeaderboardSnap,
      tracksProposedSnap,
      tracksPlayedSnap,
      djSessionsSnap,
      djSessionsLongSnap,
      listenerSessionsSnap,
      quizCorrectSnap,
   ] = await Promise.all([
      getCountFromServer(query(
         collectionGroup(db, 'participants'),
         where('userId', '==', uid),
         where('status', '==', 'joined')
      )),
      // Game wins: events where the user appears in the finalLeaderboard
      // top spot. We can't query "first element of array" in Firestore;
      // instead, fetch the docs the user appears in and decide client-side
      // (small N for a single user). For now just count the docs where
      // `finalLeaderboard` contains their userId — the wins / losses split
      // is finalised below. Empty `Promise.resolve` placeholder for shape.
      Promise.resolve({ data: () => ({ count: 0 }) }),
      getDocs(query(
         collectionGroup(db, 'leaderboard'),
         where('userId', '==', uid)
      )),
      getCountFromServer(query(
         collectionGroup(db, 'queue'),
         where('proposedBy', '==', uid)
      )),
      getCountFromServer(query(
         collectionGroup(db, 'queue'),
         where('proposedBy', '==', uid),
         where('status', '==', 'played')
      )),
      getCountFromServer(query(
         collectionGroup(db, 'audio_sessions'),
         where('djId', '==', uid)
      )),
      // Long DJ sessions need a finalStats.totalDurationMs > 30min. Not
      // directly queryable on a nested field path with a > filter unless
      // we promote it to a top-level `totalDurationMs` field. For Phase 2
      // we approximate: count closed sessions and let the caller filter
      // with a threshold derived from full doc fetch. To keep the read
      // count low, we fetch the docs (small N expected) and count
      // client-side.
      getDocs(query(
         collectionGroup(db, 'audio_sessions'),
         where('djId', '==', uid),
         where('status', '==', 'closed')
      )),
      // Listener: participants subcollection of audio_sessions. Reuses
      // the same userId field. We over-count by including the user's own
      // DJ self-join, then subtract djSessionsTotal.
      getCountFromServer(query(
         collectionGroup(db, 'participants'),
         where('userId', '==', uid),
         where('status', '==', 'joined')
      )),
      // Quiz correct answers: collectionGroup on `answers` filtered by
      // userId + pointsAwarded > 0.
      getCountFromServer(query(
         collectionGroup(db, 'answers'),
         where('userId', '==', uid),
         where('pointsAwarded', '>', 0)
      )),
   ]);

   // Hunt cumulative points: sum of leaderboard.points for the user
   // across all events. (Includes both treasure_hunt and photo_quiz
   // entries — for now we attribute to huntPoints; a finer split would
   // need a `gameType` denormalised on the leaderboard doc.)
   let huntPoints = 0;
   let quizWins = 0;
   huntLeaderboardSnap.forEach(d => {
      const data = d.data() as any;
      if (typeof data.points === 'number') huntPoints += data.points;
   });

   // Game wins: count finalLeaderboard arrays where the first entry's
   // userId === uid. This requires a doc fetch per game_event, which we
   // skip for now — replace with a denormalised `users.{uid}.gameWins`
   // counter incremented by the rule-validated transition `active →
   // completed` in Phase 2.5.
   void gameWinsSnap;

   // Long DJ sessions: client-side filter
   let djSessionsLong = 0;
   djSessionsLongSnap.forEach(d => {
      const data = d.data() as any;
      const ms = data?.finalStats?.totalDurationMs;
      if (typeof ms === 'number' && ms > 30 * 60 * 1000) djSessionsLong++;
   });

   const djSessionsTotal = djSessionsSnap.data().count;
   // listenerSessions counts both the gameEvents/participants docs AND the
   // audio_sessions/participants docs because both subcollections are named
   // 'participants'. Strip the gameJoins component to get audio-only.
   const totalParticipantJoins = listenerSessionsSnap.data().count;
   const gameJoins = gameJoinsSnap.data().count;
   const audioJoinsAll = Math.max(0, totalParticipantJoins - gameJoins);
   const listenerSessions = Math.max(0, audioJoinsAll - djSessionsTotal);

   return {
      points: basePoints,
      gamesJoined: gameJoins,
      huntPoints,
      gameWinsTotal: 0, // wired in Phase 2.5 with denormalised counter
      quizWins,
      quizCorrectTotal: quizCorrectSnap.data().count,
      tracksProposed: tracksProposedSnap.data().count,
      tracksPlayed: tracksPlayedSnap.data().count,
      djSessionsTotal,
      djSessionsLong,
      listenerSessions,
      // Phase 2.5 continuous-tracking metrics overlaid by the caller
      // from the live profile (see hook below) — fetched values here
      // are placeholders.
      quizStreak: 0,
      consecutiveSkipped: 0,
      huntsLegacyCompleted: 0,
   };
}

/**
 * Overlay the Phase 2.5 continuous-tracking metrics from the live profile
 * onto the (cached or freshly computed) snapshot metrics. The Phase 2.5
 * counters live on `users/{uid}.metrics` and are mutated by transactions
 * in usePhotoQuiz, useAudioQueue, useGameEvents — reading them straight
 * from the profile keeps the badges responsive without extra reads.
 */
function overlayContinuousMetrics(base: UserMetrics, profileMetrics: UserProfile['metrics']): UserMetrics {
   const m = profileMetrics ?? {};
   return {
      ...base,
      quizStreak: typeof m.quizStreak === 'number' ? m.quizStreak : 0,
      consecutiveSkipped: typeof m.consecutiveSkipped === 'number' ? m.consecutiveSkipped : 0,
      huntsLegacyCompleted: typeof m.huntsLegacyCompleted === 'number' ? m.huntsLegacyCompleted : 0,
   };
}

export function useUserGagliardetti(
   uid: string | undefined,
   points: number = 0,
   profileMetrics?: UserProfile['metrics']
) {
   const [states, setStates] = useState<GagliardettoState[]>(() => computeGagliardetti(ZERO_METRICS));
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (!uid) {
         setStates(computeGagliardetti(ZERO_METRICS));
         return;
      }

      // Synchronous cache hit — paint immediately, skip the fetch.
      const cached = readCache(uid);
      if (cached) {
         // Always overlay the freshest `points` from the live profile so
         // the historical badges respond in real time even on cache hit.
         const merged: UserMetrics = overlayContinuousMetrics(
            { ...cached.metrics, points },
            profileMetrics
         );
         setStates(computeGagliardetti(merged));
         return;
      }

      setLoading(true);
      setError(null);
      let cancelled = false;
      fetchUserMetrics(uid, points)
         .then(metrics => {
            if (cancelled) return;
            writeCache(uid, metrics);
            const overlaid = overlayContinuousMetrics(metrics, profileMetrics);
            setStates(computeGagliardetti(overlaid));
         })
         .catch(e => {
            if (cancelled) return;
            console.warn('useUserGagliardetti failed', e);
            setError(e?.message || 'Errore nel calcolo dei gagliardetti');
            // On error fall back to the points-only badges (the historical
            // category still works without any query).
            const fallback = overlayContinuousMetrics({ ...ZERO_METRICS, points }, profileMetrics);
            setStates(computeGagliardetti(fallback));
         })
         .finally(() => {
            if (!cancelled) setLoading(false);
         });

      return () => {
         cancelled = true;
      };
   }, [uid, points, profileMetrics?.quizStreak, profileMetrics?.consecutiveSkipped, profileMetrics?.huntsLegacyCompleted]);

   const earned = states.filter(s => s.earned);

   return { states, earned, loading, error };
}
