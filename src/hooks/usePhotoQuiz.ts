import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, serverTimestamp, runTransaction, increment, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface QuizRound {
   id: string;
   roundNumber: number;
   status: 'waiting' | 'active' | 'revealed' | 'finished';
   type: 'guess_who' | 'guess_year' | 'guess_place' | 'guess_caption' | 'chronology';
   sourcePostId?: string | null;
   questionText?: string;
   mediaUrl: string;
   questionOptions: string[];
   correctIndex?: number; // fetched from parent when revealed
   startedAt?: any;
   endsAt?: any;
   revealedAt?: any;
   winnerId?: string | null;
}

export interface QuizAnswer {
   userId: string;
   displayName: string;
   selectedIndex: number; // 0..3
   timestamp: any;
   pointsAwarded: number;
}

export function useQuizRounds(eventId: string) {
   const [rounds, setRounds] = useState<QuizRound[]>([]);

   useEffect(() => {
      if (!eventId) return;
      const q = query(collection(db, `game_events/${eventId}/quizRounds`), orderBy('roundNumber', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
         const rr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizRound));
         setRounds(rr);
      });
      return unsub;
   }, [eventId]);

   return { rounds };
}

export function useCurrentRound(eventId: string, currentRoundNumber: number) {
   const [round, setRound] = useState<QuizRound | null>(null);

   useEffect(() => {
      if (!eventId || !currentRoundNumber) return;
      const q = query(
         collection(db, `game_events/${eventId}/quizRounds`), 
         where('roundNumber', '==', currentRoundNumber)
      );
      const unsub = onSnapshot(q, (snap) => {
         if (!snap.empty) {
            setRound({ id: snap.docs[0].id, ...snap.docs[0].data() } as QuizRound);
         } else {
            setRound(null);
         }
      });
      return unsub;
   }, [eventId, currentRoundNumber]);

   return { round };
}

export function useRoundAnswers(eventId: string, roundId: string | undefined) {
   const [answers, setAnswers] = useState<QuizAnswer[]>([]);

   useEffect(() => {
      if (!eventId || !roundId) {
         setAnswers([]);
         return;
      }
      const q = query(collection(db, `game_events/${eventId}/quizRounds/${roundId}/answers`));
      const unsub = onSnapshot(q, (snap) => {
         const items = snap.docs.map(d => ({ ...d.data() } as QuizAnswer));
         setAnswers(items);
      });
      return unsub;
   }, [eventId, roundId]);

   return { answers };
}

export async function submitQuizAnswer(eventId: string, roundId: string, userId: string, displayName: string, selectedIndex: number) {
   const answerRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}/answers/${userId}`);
   await setDoc(answerRef, {
      userId,
      displayName,
      selectedIndex,
      timestamp: serverTimestamp(),
      pointsAwarded: 0 // Will be evaluated when revealed by host
   });
}

import { calculateQuizPoints } from '../utils/scoring';

export async function advanceQuizRound(eventId: string, nextRound: number, currentRoundId?: string, newHostId?: string | null) {
   const evRef = doc(db, 'game_events', eventId);

   if (currentRoundId) {
      // Mark old round as finished. Best-effort: a missing or already-finished
      // round shouldn't block the host advancing.
      const oldRoundRef = doc(db, `game_events/${eventId}/quizRounds/${currentRoundId}`);
      try {
         await updateDoc(oldRoundRef, { status: 'finished' });
      } catch {
         // tolerated
      }
   }

   // Materialise the next round if it doesn't exist yet (host hasn't composed it).
   const newRoundRef = doc(db, `game_events/${eventId}/quizRounds`, `round_${nextRound}`);
   const nextRoundSnap = await getDoc(newRoundRef);

   if (!nextRoundSnap.exists()) {
      await setDoc(newRoundRef, {
         roundNumber: nextRound,
         status: 'waiting',
         type: 'guess_place',
         mediaUrl: '',
         questionOptions: [],
         revealedAt: null,
      });
   }

   // Read the event's current status so we only include `status: 'active'` when
   // it's a real transition. Re-writing 'active' over 'active' is accepted by
   // the rule (identity transition) but is a no-op write that masks intent.
   const evSnap = await getDoc(evRef);
   const currentStatus = evSnap.data()?.status;

   const gameUpdate: Record<string, unknown> = { currentRound: nextRound };
   if (currentStatus !== 'active') gameUpdate.status = 'active';
   if (newHostId) gameUpdate['photoQuizConfig.currentHostId'] = newHostId;

   await updateDoc(evRef, gameUpdate);
}

/**
 * Host-only: reveal the round by lifting `correctIndex` from the secret
 * sub-collection into the public round doc and stamping `revealedAt`.
 * Performs no scoring — points are claimed by each participant client-side
 * via `claimMyAnswerPoints` once the round is in 'revealed' status.
 *
 * Why split: the legacy `evaluateRoundAnswers` wrote `users/{otherUid}.points`
 * from the host's session, which the rules legitimately reject (only the
 * owner can mutate their own points doc). Splitting also removes the
 * O(N participants) bottleneck on the host and makes scoring tolerant to
 * reconnections.
 */
export async function revealRound(eventId: string, roundId: string): Promise<{ correctIndex: number }> {
   const secretSnap = await getDoc(doc(db, `game_events/${eventId}/quizRounds/${roundId}/secret/correctness`));
   const correctIndex = secretSnap.data()?.correctIndex ?? -1;
   await updateDoc(doc(db, `game_events/${eventId}/quizRounds/${roundId}`), {
      status: 'revealed',
      revealedAt: serverTimestamp(),
      correctIndex,
   });
   return { correctIndex };
}

/**
 * Owner-side claim: each participant credits their own points once the round
 * is revealed. Idempotency is enforced by a localStorage flag (claim is a
 * single-shot per round per user; refreshing or re-rendering won't double-spend).
 *
 * The Firestore rule on `answers.update` re-derives the correctness from the
 * now-public `correctIndex` and bounds `pointsAwarded` by `maxPointsPerRound *
 * pointsMultiplier`, so a malicious client can't forge a positive score.
 */
const CLAIM_KEY = (roundId: string, userId: string) => `marzio1777:quiz-claimed:${roundId}:${userId}`;

export function hasClaimedRound(roundId: string, userId: string): boolean {
   try { return localStorage.getItem(CLAIM_KEY(roundId, userId)) === '1'; } catch { return false; }
}

export async function claimMyAnswerPoints(opts: {
   eventId: string;
   roundId: string;
   userId: string;
   displayName: string;
   scoringMode: 'fixed' | 'decay';
   maxPointsPerRound: number;
   eventMultiplier: number;
}): Promise<number> {
   const { eventId, roundId, userId, displayName, scoringMode, maxPointsPerRound, eventMultiplier } = opts;

   if (hasClaimedRound(roundId, userId)) return 0;

   const roundRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}`);
   const ansRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}/answers/${userId}`);

   try {
      const ptsAwarded = await runTransaction(db, async (tx) => {
         const roundSnap = await tx.get(roundRef);
         if (!roundSnap.exists()) throw new Error('round not found');
         const round = roundSnap.data();
         if (round.revealedAt == null) throw new Error('round not yet revealed');

         const ansSnap = await tx.get(ansRef);
         if (!ansSnap.exists()) return 0; // user didn't answer

         const ans = ansSnap.data();
         if (typeof ans.pointsAwarded === 'number' && ans.pointsAwarded > 0) {
            // already claimed in a previous tab/session
            return 0;
         }

         const correctIndex: number = round.correctIndex;
         const isCorrect = ans.selectedIndex === correctIndex && correctIndex >= 0;

         let pts = 0;
         if (isCorrect) {
            const ansTimeMs = ans.timestamp?.toMillis?.() ?? Date.now();
            const startedAtMs = round.startedAt?.toMillis?.() ?? ansTimeMs;
            const endsAtMs = round.endsAt?.toMillis?.() ?? (startedAtMs + 60_000);
            const elapsedMs = ansTimeMs - startedAtMs;
            const windowMs = Math.max(1, endsAtMs - startedAtMs);
            pts = calculateQuizPoints(scoringMode, true, elapsedMs, windowMs, maxPointsPerRound);
            pts = Math.max(0, Math.round(pts * eventMultiplier));
         }

         tx.update(ansRef, { pointsAwarded: pts });

         const userRef = doc(db, `users/${userId}`);
         if (pts > 0) {
            const lbRef = doc(db, `game_events/${eventId}/leaderboard/${userId}`);
            tx.set(lbRef, {
               userId,
               displayName,
               points: increment(pts),
            }, { merge: true });

            // Phase 2.5: bump points + extend the Veggente quiz streak.
            // The rule's owner-side users.update branch allows points
            // increment and metrics writes in the same transaction
            // (affectedKeys.hasOnly([points, updatedAt, metrics])).
            tx.update(userRef, {
               points: increment(pts),
               'metrics.quizStreak': increment(1),
            });
         } else {
            // Wrong answer (or no answer earned) — reset the streak.
            // Owner-side metrics-only branch on users.update accepts this.
            tx.update(userRef, {
               'metrics.quizStreak': 0,
            });
         }

         return pts;
      });

      try { localStorage.setItem(CLAIM_KEY(roundId, userId), '1'); } catch {}
      return ptsAwarded;
   } catch (e) {
      console.warn('claimMyAnswerPoints failed', e);
      return 0;
   }
}
