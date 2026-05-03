import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAudioSession } from '../hooks/useAudioSession';
import { useAudioQueue, getMaxQueuedFor } from '../hooks/useAudioQueue';
import { useSessionParticipants } from '../hooks/useSessionParticipants';
import { useWebRTCTransferProposer } from '../hooks/useWebRTCTransfer';
import { QueueItemCard } from '../components/audio/QueueItemCard';
import { ProposeTrackModal } from '../components/audio/ProposeTrackModal';
import { Button, Card, ScrollArea } from '../components/ui';
import { Music, UploadCloud, Users, ArrowLeft, Headphones } from 'lucide-react';
import { LocalTrack } from '../types/audio';

export function AudioSessionListener() {
   const { id } = useParams<{ id: string }>();
   const { user, profile: userData } = useAuth();
   const navigate = useNavigate();
   
   const { session, loading, joinSession, leaveSession } = useAudioSession(id!);
   const { queue, proposeTrack, withdrawProposal } = useAudioQueue(id!);
   const { participants } = useSessionParticipants(id!, false);
   const { isTransferring, progress } = useWebRTCTransferProposer(id!);
   
   const [modalOpen, setModalOpen] = useState(false);
   const [joined, setJoined] = useState(false);

   useEffect(() => {
      if (session && user && session.status === 'open' && !joined) {
         joinSession();
         setJoined(true);
      }
   }, [session, user, joined]);

   // Leave on unmount
   useEffect(() => {
      return () => {
         if (joined) leaveSession();
      };
   }, [joined]);

   if (loading || !session) {
      return <div className="h-full flex items-center justify-center p-8"><span className="animate-pulse">Sintonizzazione...</span></div>;
   }

   if (session.status === 'closed') {
      return (
         <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold">Il Coro è concluso</h2>
            <p className="text-muted-foreground">Grazie per aver partecipato a questa sessione.</p>
            <Button onClick={() => navigate('/dashboard/ainulindale/sessioni')} variant="outline">Torna alla lista</Button>
         </div>
      );
   }

   const userActiveItems = queue.filter(q => q.proposedBy === user?.uid && ['queued', 'transferring', 'ready', 'playing'].includes(q.status));
   const maxAllowed = getMaxQueuedFor(userData?.points || 0, session.rules);
   const canPropose = userActiveItems.length < maxAllowed;

   const activeQueue = queue.filter(q => !['played', 'skipped', 'failed'].includes(q.status));

   const handlePropose = async (track: LocalTrack) => {
      await proposeTrack(track, session);
   };

   return (
      <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 pt-20 max-w-4xl mx-auto gap-6 bg-background">
         <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
            <div className="flex items-center space-x-4">
               <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/ainulindale/sessioni')} className="rounded-full hover:bg-secondary">
                  <ArrowLeft className="w-5 h-5" />
               </Button>
               <div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">{session.title}</h1>
                  <p className="text-sm text-muted-foreground flex items-center mt-1">
                     <Headphones className="w-3.5 h-3.5 mr-1" /> DJ {session.djName}
                     <span className="mx-2">•</span>
                     <Users className="w-3.5 h-3.5 mr-1" /> {participants.filter(p=>p.status==='joined').length} ascoltatori
                  </p>
               </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm bg-secondary/30 px-3 py-1.5 rounded-full border">
               <span className="font-semibold">{userActiveItems.length}</span>
               <span className="text-muted-foreground">/</span>
               <span className="text-muted-foreground">{maxAllowed} Slot</span>
            </div>
         </header>

         {/* Now Playing Widget */}
         <Card className="bg-card/50 backdrop-blur-md shadow-lg border-primary/20 overflow-hidden relative">
            {session.currentQueueItemId && queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl && (
               <img 
                 src={queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl} 
                 className="absolute inset-0 w-full h-full object-cover opacity-10 blur-xl scale-110 pointer-events-none" 
               />
             )}
            <div className="p-6 flex items-center space-x-6 relative z-10">
               {session.currentQueueItemId ? (
                  <>
                     <img 
                        src={queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl || ''} 
                        className="w-24 h-24 rounded-lg shadow-lg object-cover ring-2 ring-primary/20"
                     />
                     <div className="flex-1">
                        <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1 flex items-center">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-2" /> In onda
                        </div>
                        <h2 className="text-2xl font-bold line-clamp-1">{session.currentTrackTitle}</h2>
                        <p className="text-muted-foreground line-clamp-1">{session.currentTrackArtist}</p>
                     </div>
                  </>
               ) : (
                  <div className="w-full flex flex-col items-center justify-center p-4 text-muted-foreground">
                     <Music className="w-12 h-12 opacity-20 mb-4" />
                     <p>Nessun brano in riproduzione</p>
                  </div>
               )}
            </div>
         </Card>

         {/* Proposer Transfer Status */}
         {isTransferring && (
            <div className="bg-primary/20 text-primary p-4 rounded-xl shadow-inner border border-primary/30 flex flex-col gap-2">
               <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center"><UploadCloud className="w-4 h-4 mr-2" /> Invio traccia al Curatore...</span>
                  <span>{progress}%</span>
               </div>
               <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
               </div>
            </div>
         )}
         
         {/* Queue */}
         <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-semibold text-lg flex items-center gap-2">
                  La Coda
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-xs">{activeQueue.length}</span>
               </h3>
               <Button onClick={() => setModalOpen(true)} disabled={!canPropose} className="shadow-md">
                  Proponi Tema
               </Button>
            </div>
            
            <ScrollArea className="flex-1 bg-card/20 rounded-xl border p-4">
               <div className="space-y-3">
                  {activeQueue.length === 0 ? (
                     <div className="text-center text-muted-foreground py-12">La coda è vuota. Proponi il primo brano!</div>
                  ) : (
                     activeQueue.map(item => (
                        <QueueItemCard 
                           key={item.id} 
                           item={item} 
                           isDJ={false} 
                           isProposer={item.proposedBy === user?.uid} 
                           onWithdraw={withdrawProposal}
                        />
                     ))
                  )}
               </div>
            </ScrollArea>
         </div>

         <ProposeTrackModal 
            isOpen={modalOpen} 
            onClose={() => setModalOpen(false)} 
            onPropose={handlePropose} 
         />
      </div>
   );
}
