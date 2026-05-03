import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, writeBatch, query, where, orderBy, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { QueueItem, AudioSession } from '../types/audio';
import { LocalTrack } from '../types/audio';

export function getMaxQueuedFor(points: number, rules: AudioSession['rules']) {
  return rules.maxQueuedPerUser + Math.floor((points || 0) / 100) * rules.bonusPerHundredPoints;
}

export function useAudioQueue(sessionId: string) {
  const { user, profile: userData } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setQueue([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'audio_sessions', sessionId, 'queue'),
      orderBy('position', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() } as QueueItem)));
      setLoading(false);
    });

    return () => unsub();
  }, [sessionId]);

  const proposeTrack = async (track: LocalTrack, session: AudioSession) => {
    if (!user || !userData) throw new Error('Not authenticated');
    
    // Client side check maxQueued
    const userActiveItems = queue.filter(
       q => q.proposedBy === user.uid && 
       ['queued', 'transferring', 'ready', 'playing'].includes(q.status)
    );
    
    if (userActiveItems.length >= getMaxQueuedFor(userData.points, session.rules)) {
       throw new Error('Hai raggiunto il limite di brani in coda per i tuoi punti. Attendi che ne venga suonato uno.');
    }
    
    if (!session.rules.allowDuplicates) {
       const isDuplicate = queue.some(q => 
          q.trackTitle.toLowerCase() === track.title.toLowerCase() && 
          q.trackArtist.toLowerCase() === track.artist.toLowerCase()
       );
       if (isDuplicate) {
          throw new Error('Questo brano è già in coda e la sessione non ammette duplicati.');
       }
    }
    
    const itemId = doc(collection(db, 'audio_sessions', sessionId, 'queue')).id;
    const maxPos = queue.length > 0 ? Math.max(...queue.map(q => q.position)) : 0;
    
    const newItem: Partial<QueueItem> = {
       proposedBy: user.uid,
       proposedByName: user.displayName || 'Unknown',
       proposedByPhotoURL: user.photoURL || '',
       proposedAt: serverTimestamp(),
       trackTitle: track.title,
       trackArtist: track.artist,
       trackAlbum: track.album || '',
       trackDurationMs: track.durationMs,
       localTrackId: track.id,
       status: 'queued',
       position: maxPos + 1
    };
    
    if (track.coverDataUrl) {
       newItem.trackCoverDataUrl = track.coverDataUrl;
    }
    
    await setDoc(doc(db, 'audio_sessions', sessionId, 'queue', itemId), newItem);
  };

  const withdrawProposal = async (itemId: string) => {
     await deleteDoc(doc(db, 'audio_sessions', sessionId, 'queue', itemId));
  };

  const setItemStatus = async (itemId: string, status: QueueItem['status'], data: Partial<QueueItem> = {}) => {
     await updateDoc(doc(db, 'audio_sessions', sessionId, 'queue', itemId), {
        status,
        ...data
     });
  };

  const reorderQueue = async (reorderedItems: QueueItem[]) => {
     const batch = writeBatch(db);
     reorderedItems.forEach((item, idx) => {
        batch.update(doc(db, 'audio_sessions', sessionId, 'queue', item.id), {
           position: idx + 1
        });
     });
     await batch.commit();
  };

  return { queue, loading, proposeTrack, withdrawProposal, setItemStatus, reorderQueue };
}
