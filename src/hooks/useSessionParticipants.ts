import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { SessionParticipant } from '../types/audio';
import { useAuth } from '../contexts/AuthContext';

export function useSessionParticipants(sessionId: string, isDJ: boolean) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  
  useEffect(() => {
    if (!sessionId) return;
    
    const q = query(
      collection(db, 'audio_sessions', sessionId, 'participants'),
      orderBy('lastSeenAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setParticipants(snap.docs.map(d => ({ userId: d.id, ...d.data() } as SessionParticipant)));
    });
    
    return () => unsub();
  }, [sessionId]);
  
  // Heartbeat
  useEffect(() => {
     if (!sessionId || !user) return;
     
     const interval = setInterval(() => {
        updateDoc(doc(db, 'audio_sessions', sessionId, 'participants', user.uid), {
           lastSeenAt: serverTimestamp()
        }).catch(e => console.error('Heartbeat failed', e));
     }, 30000);
     
     return () => clearInterval(interval);
  }, [sessionId, user]);
  
  // Auto-leave offline (DJ only or cloud function)
  // For now, let's keep it simple: DJ cleans up offline users (idle > 60s)
  useEffect(() => {
     if (!sessionId || !isDJ) return;
     
     const interval = setInterval(() => {
        const now = Date.now();
        const batch = writeBatch(db);
        let count = 0;
        
        participants.forEach(p => {
           if (p.status === 'joined' && p.lastSeenAt) {
              const lastSeen = p.lastSeenAt.toMillis ? p.lastSeenAt.toMillis() : Date.now(); // Handle server timestamp latency
              if (now - lastSeen > 65000) { // 65 seconds
                 batch.update(doc(db, 'audio_sessions', sessionId, 'participants', p.userId), {
                    status: 'left',
                    leftAt: serverTimestamp()
                 });
                 count++;
              }
           }
        });
        
        if (count > 0) {
           batch.commit().catch(e => console.error('Cleanup failed', e));
        }
     }, 10000); // Check every 10s
     
     return () => clearInterval(interval);
  }, [sessionId, isDJ, participants]);

  return { participants };
}
