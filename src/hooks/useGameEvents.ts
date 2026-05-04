import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, serverTimestamp, runTransaction, increment, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GameItem } from './useNearestItem';

export interface GameEvent {
  id: string;
  type: 'treasure_hunt' | 'photo_quiz';
  status: 'draft' | 'scheduled' | 'lobby' | 'active' | 'completed' | 'aborted';
  title: string;
  description: string;
  organizerId: string;
  startTime: any;
  scheduledKickoff: any;
  endTime: any;
  pointsMultiplier: number;
  visibilityOfOthers: boolean;
  invitedUserIds: string[];
  photoQuizConfig?: {
    totalRounds: number;
    answerTimeSeconds: number;
    questionTypes: string[];
    scoringMode: string;
    // Upper bound for per-round points. Default 10 (matches the spec'd
    // 'fixed' mode); admins can raise it for special events but the rule
    // caps the actual `pointsAwarded` at maxPointsPerRound × pointsMultiplier.
    maxPointsPerRound?: number;
    currentHostId?: string;
    rotateHost?: boolean;
  };
  currentRound?: number;
  finalLeaderboard?: LeaderboardEntry[];
}

export interface Participant {
  userId: string;
  displayName: string;
  photoURL: string;
  status: 'invited' | 'joined' | 'declined' | 'kicked';
  invitedAt: any;
  respondedAt: any;
  shareLocationDuringEvent: boolean;
}

export function useGameEvents(statusFilter?: 'active' | 'past' | 'upcoming') {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'game_events'));
    
    // We will just fetch all non-drafts for now and filter client side for simplicity,
    // or use proper simple queries if indexes are a concern.
    q = query(collection(db, 'game_events'), where('status', '!=', 'draft'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: GameEvent[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as GameEvent);
      });

      // Filter
      const filtered = data.filter(e => {
        if (statusFilter === 'active') return e.status === 'active' || e.status === 'lobby';
        if (statusFilter === 'upcoming') return e.status === 'scheduled' || e.status === 'lobby' || e.status === 'active';
        if (statusFilter === 'past') return e.status === 'completed' || e.status === 'aborted';
        return true;
      });

      // Sort
      filtered.sort((a, b) => {
         const timeA = a.scheduledKickoff?.toDate?.()?.getTime() || 0;
         const timeB = b.scheduledKickoff?.toDate?.()?.getTime() || 0;
         if (statusFilter === 'past') return timeB - timeA; // Descending
         return timeA - timeB; // Ascending
      });

      setEvents(filtered);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter]);

  return { events, loading };
}

export function useGameEvent(eventId: string) {
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const unsub = onSnapshot(doc(db, 'game_events', eventId), (doc) => {
      if (doc.exists()) {
        setEvent({ id: doc.id, ...doc.data() } as GameEvent);
      } else {
        setEvent(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [eventId]);

  return { event, loading };
}

export function useGameParticipants(eventId: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const { user } = useAuth();
  
  useEffect(() => {
    if (!eventId) return;
    const q = query(collection(db, `game_events/${eventId}/participants`));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Participant[] = [];
      snapshot.forEach(doc => {
        data.push({ userId: doc.id, ...doc.data() } as Participant);
      });
      setParticipants(data);
    }, (err) => {
      console.error(err);
    });
    return () => unsub();
  }, [eventId]);

  const currentUserParticipant = participants.find(p => p.userId === user?.uid);

  return { participants, currentUserParticipant };
}

export async function setRSVP(eventId: string, userId: string, status: 'joined' | 'declined') {
  try {
     const pRef = doc(db, `game_events/${eventId}/participants/${userId}`);
     const pSnap = await getDoc(pRef);
     if (pSnap.exists()) {
        await updateDoc(pRef, {
           status,
           respondedAt: serverTimestamp()
        });
     } else {
        await setDoc(pRef, {
           userId,
           status,
           respondedAt: serverTimestamp(),
           shareLocationDuringEvent: true, // Default
           invitedAt: serverTimestamp() // Fallback if record didn't exist
        });
     }
  } catch (error) {
     console.error("Set RSVP Error", error);
     throw error;
  }
}

export async function createGameEvent(eventData: Partial<GameEvent>) {
   const eventRef = doc(collection(db, 'game_events'));
   const payload = {
      ...eventData,
      status: 'draft',
      createdAt: serverTimestamp(),
   };
   await setDoc(eventRef, payload);
   return eventRef.id;
}

export async function advanceGameEventStatus(eventId: string, newStatus: GameEvent['status']) {
   const eventRef = doc(db, 'game_events', eventId);

   if (newStatus === 'completed') {
      // The leaderboard read happens *outside* the transaction (a Firestore
      // transaction can't read a query, only point reads). To avoid the
      // race "two clients complete the event with stale snapshots", we
      // re-check the status inside the transaction and refuse if someone
      // already flipped it: rule + immutability of `finalLeaderboard`
      // post-completed gives us a final guard, but we want a clear UX
      // error rather than a permission-denied bubble.
      const lbSnap = await getDocs(collection(db, `game_events/${eventId}/leaderboard`));
      const finalLeaderboard = lbSnap.docs
         .map(d => d.data() as LeaderboardEntry)
         .sort((a, b) => b.points - a.points);

      await runTransaction(db, async (tx) => {
         const evSnap = await tx.get(eventRef);
         if (!evSnap.exists()) throw new Error('Event non trovato');
         const evData = evSnap.data();
         if (evData.status === 'completed') {
            // Someone already finalised: do nothing, finalLeaderboard is immutable.
            return;
         }
         tx.update(eventRef, {
            status: 'completed',
            organizerId: evData.organizerId,
            type: evData.type,
            createdAt: evData.createdAt,
            finalLeaderboard,
         });
      });
      return;
   }

   const currentSnap = await getDoc(eventRef);
   if (!currentSnap.exists()) throw new Error('Event non trovato');
   const data = currentSnap.data();
   await updateDoc(eventRef, {
      status: newStatus,
      organizerId: data.organizerId,
      type: data.type,
      createdAt: data.createdAt,
   });
}

export async function createGameItem(eventId: string, itemData: Omit<GameItem, 'id' | 'status' | 'collectedBy'>) {
   const itemRef = doc(collection(db, `game_events/${eventId}/items`));
   await setDoc(itemRef, {
      ...itemData,
      status: 'spawned',
      collectedBy: null
   });
   return itemRef.id;
}

export async function captureItemTransaction(eventId: string, itemId: string, userId: string, userDisplayName: string, itemName: string, itemPoints: number, eventMultiplier: number, playerLat?: number, playerLng?: number) {
   // Phase 2 hardening (§15.A.1): if the player provided coordinates, ask
   // the Cloud Function `validateCaptureDistance` to do a server-side
   // Haversine + write `serverValidatedAt` on the item. The rule then
   // accepts the transition. If the CF isn't deployed yet (Spark plan,
   // pre-deploy state), the call throws `not-found` / `unavailable` and
   // we fall back to the legacy fast-path — the rule still accepts
   // captures on items without `serverValidatedAt`.
   if (typeof playerLat === 'number' && typeof playerLng === 'number') {
      try {
         const validate = httpsCallable<
            { eventId: string; itemId: string; playerLat: number; playerLng: number },
            { ok: boolean; distanceMeters: number }
         >(functions, 'validateCaptureDistance');
         await validate({ eventId, itemId, playerLat, playerLng });
      } catch (e: any) {
         // `out-of-range` from the CF means the player was too far;
         // surface that to the user instead of swallowing it.
         if (e?.code === 'functions/out-of-range') {
            throw new Error(e?.message || 'Sei troppo distante per catturare questo oggetto.');
         }
         // Any other error (CF not deployed, network, etc.) → fall back
         // to the legacy fast-path silently. Audit log via collectedAtLat/Lng
         // remains the mitigation in this branch.
         console.warn('validateCaptureDistance unavailable, falling back to legacy capture path', e);
      }
   }

   await runTransaction(db, async (tx) => {
      const itemRef = doc(db, `game_events/${eventId}/items/${itemId}`);
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists()) throw new Error("Item non trovato");

      const itemData = itemSnap.data();
      if (itemData.status !== 'spawned') throw new Error("Oggetto già catturato da qualcun altro!");

      // Update item
      tx.update(itemRef, {
         status: 'collected',
         collectedBy: userId,
         collectedAtLat: playerLat || null,
         collectedAtLng: playerLng || null,
         collectedAt: serverTimestamp()
      });

      // Update leaderboard
      const lbRef = doc(db, `game_events/${eventId}/leaderboard/${userId}`);
      const pointsToAdd = itemData.points * eventMultiplier;
      
      tx.set(lbRef, {
         userId: userId,
         displayName: userDisplayName,
         points: increment(pointsToAdd),
         captures: increment(1),
      }, { merge: true });

      // Update user points (Altitudine)
      const userRef = doc(db, `users/${userId}`);
      tx.update(userRef, {
         points: increment(pointsToAdd)
      });
   });
}

export interface LeaderboardEntry {
   userId: string;
   displayName: string;
   points: number;
   captures?: number;
}

export function useGameLeaderboard(eventId: string) {
   const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

   useEffect(() => {
      if (!eventId) return;
      const q = query(
         collection(db, `game_events/${eventId}/leaderboard`),
         orderBy('points', 'desc')
      );
      const unsub = onSnapshot(q, (snap) => {
         const lb = snap.docs.map(doc => ({ ...doc.data() } as LeaderboardEntry));
         setLeaderboard(lb);
      });
      return unsub;
   }, [eventId]);

   return { leaderboard };
}
