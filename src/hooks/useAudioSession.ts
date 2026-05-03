import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, writeBatch, serverTimestamp, query, where, orderBy, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { AudioSession, SessionRules } from '../types/audio';

export function useAudioSession(sessionId: string) {
  const { user } = useAuth();
  const [session, setSession] = useState<AudioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'audio_sessions', sessionId),
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() } as AudioSession);
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [sessionId]);

  const joinSession = async () => {
    if (!user || !sessionId || session?.status !== 'open') return;
    try {
      const pRef = doc(db, 'audio_sessions', sessionId, 'participants', user.uid);
      await setDoc(pRef, {
        userId: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        tracksProposed: 0,
        tracksPlayed: 0,
        status: 'joined'
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const leaveSession = async () => {
    if (!user || !sessionId) return;
    try {
      const pRef = doc(db, 'audio_sessions', sessionId, 'participants', user.uid);
      await updateDoc(pRef, {
        status: 'left',
        leftAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateSession = async (patch: Partial<AudioSession>) => {
    if (!sessionId) return;
    try {
       await updateDoc(doc(db, 'audio_sessions', sessionId), patch as any);
    } catch(e) {
       console.error(e);
    }
  };

  const closeSession = async (finalStats: any, eventMultiplier = 1) => {
    if (!sessionId || !user) return;
    try {
       const batch = writeBatch(db);
       const sRef = doc(db, 'audio_sessions', sessionId);

       const totalTracksPlayed = finalStats.totalTracksPlayed || 0;
       const totalDurationMs = finalStats.totalDurationMs || 0;
       const longSession = totalDurationMs > 30 * 60 * 1000;
       // djBonusAwarded becomes immutably true the first time the long-session
       // bonus is granted; rule blocks any further write to it. Skip if the
       // session already has it (re-close edge case after a refresh).
       const awardLongBonus = longSession && session?.djBonusAwarded !== true;

       const sessionPatch: Record<string, unknown> = {
          status: 'closed',
          closedAt: serverTimestamp(),
          finalStats: {
             ...finalStats,
             closedAt: serverTimestamp(),
          },
       };
       if (awardLongBonus) sessionPatch.djBonusAwarded = true;
       batch.update(sRef, sessionPatch);

       if (totalTracksPlayed > 0) {
          let points = 5;
          if (awardLongBonus) points += 10;
          const scaled = Math.round(points * eventMultiplier);
          if (scaled > 0) {
             batch.update(doc(db, 'users', user.uid), {
                points: increment(scaled),
             });
          }
       }

       await batch.commit();
    } catch (e) {
       console.error(e);
    }
  };

  return { session, loading, error, joinSession, leaveSession, updateSession, closeSession };
}

export function useAudioSessionsList() {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'audio_sessions'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AudioSession)));
      setLoading(false);
    });
    
    return () => unsub();
  }, []);
  
  return { sessions, loading };
}
