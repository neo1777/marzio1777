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

export async function configureQuizRound(eventId: string, roundId: string, payload: Partial<QuizRound>, correctIndex?: number) {
   const roundRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}`);
   await updateDoc(roundRef, payload);
   if (typeof correctIndex === 'number') {
      const secretRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}/secret/correctness`);
      await setDoc(secretRef, { correctIndex });
   }
}

import { calculateQuizPoints } from '../utils/scoring';

export async function advanceQuizRound(eventId: string, nextRound: number, currentRoundId?: string, newHostId?: string | null) {
   // Update the game event to point to the new round
   const evRef = doc(db, 'game_events', eventId);
   
   if (currentRoundId) {
      // Mark old round as finished
      const oldRoundRef = doc(db, `game_events/${eventId}/quizRounds/${currentRoundId}`);
      try {
         await updateDoc(oldRoundRef, { status: 'finished' });
      } catch (e) {
         // might not exist if manipulating wildly, safe ignore in prototype
      }
   }

   // Create the next round dynamically if it's new
   const newRoundRef = doc(db, `game_events/${eventId}/quizRounds`, `round_${nextRound}`);
   const nextRoundSnap = await getDoc(newRoundRef);
   
   if (!nextRoundSnap.exists()) {
      await setDoc(newRoundRef, {
         roundNumber: nextRound,
         status: 'waiting',
         type: 'guess_place', // defaults
         mediaUrl: '',
         questionOptions: [],
         revealedAt: null
      });
   }

   const gameUpdate: any = {
      currentRound: nextRound,
      status: 'active'
   };
   if (newHostId) {
      gameUpdate['photoQuizConfig.currentHostId'] = newHostId;
   }

   await updateDoc(evRef, gameUpdate);
}

export async function setRoundStatus(eventId: string, roundId: string, status: 'waiting' | 'active' | 'revealed' | 'finished', correctIndex?: number) {
   const roundRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}`);
   const updateData: any = { status };
   if (status === 'active') {
      const evSnap = await getDoc(doc(db, `game_events/${eventId}`));
      const timeSecs = evSnap.data()?.photoQuizConfig?.answerTimeSeconds || 20;
      updateData.startedAt = serverTimestamp();
      updateData.endsAt = new Date(Date.now() + timeSecs * 1000 + 3000); // + 3s grace period
   }
   if (status === 'revealed') {
      updateData.revealedAt = serverTimestamp();
      if (typeof correctIndex === 'number') {
         updateData.correctIndex = correctIndex;
      }
   }
   await updateDoc(roundRef, updateData);
}

// Evaluation when revealed
export async function evaluateRoundAnswers(eventId: string, roundId: string, timeLimitSeconds: number, maxPoints: number, scoringMode: 'fixed' | 'decay' = 'decay') {
   const roundSnap = await getDoc(doc(db, `game_events/${eventId}/quizRounds/${roundId}`));
   const roundData = roundSnap.data();
   const startedAtMs = roundData?.startedAt?.toMillis() || Date.now();
   
   // Fetches the secret correctness
   const secretSnap = await getDoc(doc(db, `game_events/${eventId}/quizRounds/${roundId}/secret/correctness`));
   const correctIndex = secretSnap.data()?.correctIndex ?? -1;

   const answersSnap = await getDocs(collection(db, `game_events/${eventId}/quizRounds/${roundId}/answers`));

   let fastestUserId = null;
   let fastestTime = Infinity;

   for (const ansDoc of answersSnap.docs) {
      const ansData = ansDoc.data();
      let pts = 0;
      if (ansData.selectedIndex === correctIndex && correctIndex !== -1) {
         const ansTimeMs = ansData.timestamp?.toMillis() || Date.now();
         const elapsedMs = ansTimeMs - startedAtMs;
         
         pts = calculateQuizPoints(scoringMode, true, elapsedMs, timeLimitSeconds * 1000, maxPoints);

         if (elapsedMs < fastestTime) {
            fastestTime = elapsedMs;
            fastestUserId = ansData.userId;
         }
      }

      await runTransaction(db, async (tx) => {
         const ansRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}/answers/${ansDoc.id}`);
         tx.update(ansRef, { pointsAwarded: pts });

         if (pts > 0) {
            // Update Leaderboard
            const lbRef = doc(db, `game_events/${eventId}/leaderboard/${ansData.userId}`);
            tx.set(lbRef, {
               userId: ansData.userId,
               displayName: ansData.displayName,
               points: increment(pts)
            }, { merge: true });

            // Update user global points
            const userRef = doc(db, `users/${ansData.userId}`);
            tx.update(userRef, {
               points: increment(pts)
            });
         }
      });
   }

   await updateDoc(doc(db, `game_events/${eventId}/quizRounds/${roundId}`), {
      winnerId: fastestUserId
   });

   return { fastestUserId, correctIndex };
}
