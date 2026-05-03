import { useState, useEffect, useRef } from 'react';
import { WebRTCTransfer } from '../utils/webrtc';
import { db } from '../lib/firebase';
import { doc, onSnapshot, Unsubscribe, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getTrack } from '../utils/indexedDB';

export function useWebRTCTransferDJ(sessionId: string) {
   const [transferringItemId, setTransferringItemId] = useState<string | null>(null);
   const [progress, setProgress] = useState(0);
   const [error, setError] = useState<string | null>(null);
   const transferRef = useRef<WebRTCTransfer | null>(null);

   const initiateTransfer = async (queueItemId: string, proposerId: string, onReady: (blob: Blob) => void, onFail: (err: string) => void) => {
      setTransferringItemId(queueItemId);
      setProgress(0);
      setError(null);
      
      if (transferRef.current) {
         transferRef.current.destroy();
      }
      
      transferRef.current = new WebRTCTransfer('dj', sessionId, proposerId, queueItemId, {
         onProgress: (p) => setProgress(p),
         onTrackReceived: (blob) => {
            setTransferringItemId(null);
            onReady(blob);
         },
         onError: (err) => {
            setError(err);
            onFail(err);
         }
      });
      
      await transferRef.current.initiateAsDJ();
   };
   
   useEffect(() => {
      return () => {
         if (transferRef.current) transferRef.current.destroy();
      };
   }, []);
   
   return { initiateTransfer, transferringItemId, progress, error };
}

export function useWebRTCTransferProposer(sessionId: string) {
   const { user } = useAuth();
   const [progress, setProgress] = useState(0);
   const [isTransferring, setIsTransferring] = useState(false);
   const transferRef = useRef<WebRTCTransfer | null>(null);
   
   useEffect(() => {
      if (!user || !sessionId) return;
      
      const unsub = onSnapshot(doc(db, 'audio_sessions', sessionId, 'signaling', user.uid), async (snap) => {
         const data = snap.data();
         if (!data || !data.djOffer) return;
         if (data.sessionId !== sessionId) return;
         
         // DJ has sent an offer for a queue item. We need to answer and send the blob.
         const offerTs = data.djOffer.createdAt;
         if (Date.now() - offerTs > 60000) return; // stale offer
         
         if (isTransferring) return; // already handling
         setIsTransferring(true);
         setProgress(0);
         
         const queueItemId = data.djOffer.queueItemId;
         
         try {
            // Find which track was requested. Need to fetch queue item to get localTrackId
            const qDoc = await getDoc(doc(db, 'audio_sessions', sessionId, 'queue', queueItemId));
            if (!qDoc.exists()) throw new Error('Coda non trovata');
            
            const qData = qDoc.data();
            const localTrack = await getTrack(qData.localTrackId);
            
            if (!localTrack || !localTrack.blob) {
               throw new Error('File audio non trovato nel dispositivo');
            }
            
            if (transferRef.current) transferRef.current.destroy();
            
            transferRef.current = new WebRTCTransfer('proposer', sessionId, user.uid, queueItemId, {
               onProgress: (p) => setProgress(p),
               onConnected: async () => {
                  try {
                     await transferRef.current?.sendBlobBinary(localTrack.blob);
                     setTimeout(() => setIsTransferring(false), 2000); // give it some time before reset
                  } catch(e) {
                     console.error('Send failed', e);
                     setIsTransferring(false);
                  }
               },
               onError: (err) => {
                  console.error('Proposer upload error:', err);
                  setIsTransferring(false);
               }
            });
            
            await transferRef.current.answerAsProposer(data.djOffer);
            
         } catch(e) {
            console.error('Failed to handle DJ offer', e);
            setIsTransferring(false);
         }
      });
      
      return () => {
         unsub();
         if (transferRef.current) transferRef.current.destroy();
      };
   }, [user, sessionId, isTransferring]);

   return { isTransferring, progress };
}
