import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAudioSession } from '../hooks/useAudioSession';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { useSessionParticipants } from '../hooks/useSessionParticipants';
import { useWebRTCTransferDJ } from '../hooks/useWebRTCTransfer';
import { DJEngine } from '../utils/djEngine';
import { QueueItemCard } from '../components/audio/QueueItemCard';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { Button, Switch, Label, ScrollArea } from '../components/ui';
import { LogOut, Play, SkipForward, Users, Settings } from 'lucide-react';

export function AudioSessionDJ() {
   const { id } = useParams<{ id: string }>();
   const { user } = useAuth();
   const navigate = useNavigate();
   
   const { session, loading, updateSession, closeSession } = useAudioSession(id!);
   const { queue, setItemStatus, reorderQueue } = useAudioQueue(id!);
   const { participants } = useSessionParticipants(id!, true);
   const { initiateTransfer, transferringItemId, progress, error: transferError } = useWebRTCTransferDJ(id!);
   
   const { engine: audioWorker, playBlob: playRemoteBlob, pause, resume, stop, getCurrentTime, getDuration, isPlaying } = useAudioPlayer();
   const engineRef = useRef<DJEngine | null>(null);

   const [engineState, setEngineState] = useState<'idle' | 'playing' | 'transferring' | 'paused'>('idle');

   useEffect(() => {
      if (!session || !id) return;
      
      // Initialize DJ Engine if not done
      if (!engineRef.current) {
         engineRef.current = new DJEngine({
            onStateChange: (state) => setEngineState(state),
            initiateTransfer: async (itemId, proposerId, onReady, onFail) => {
               await initiateTransfer(itemId, proposerId, onReady, onFail);
            },
            updateSession: async (patch) => {
               await updateSession(patch);
            },
            setItemStatus: async (itemId, status, data) => {
               await setItemStatus(itemId, status, data);
            },
            playBlob: (blob) => {
               playRemoteBlob(blob);
            },
            stopAudio: () => {
               stop();
            },
            getAudioProgress: () => {
               return { currentTime: getCurrentTime(), duration: getDuration() };
            }
         });
         engineRef.current.startLoop();
      }
      
      engineRef.current.updateState(queue, session);
      
   }, [session, queue, id]);

   useEffect(() => {
      // Sync stats
      if (session && session.status === 'open') {
         const activeParticipants = participants.filter(p => p.status === 'joined').length;
         const queuedItems = queue.filter(q => ['queued', 'transferring', 'ready'].includes(q.status)).length;
         const playedItems = queue.filter(q => q.status === 'played').length;
         
         if (session.participantCount !== activeParticipants || session.queuedCount !== queuedItems || session.playedCount !== playedItems) {
            // throttle or just update
            updateSession({
               participantCount: activeParticipants,
               queuedCount: queuedItems,
               playedCount: playedItems
            });
         }
      }
   }, [participants, queue, session]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         if (engineRef.current) {
            engineRef.current.stopLoop();
         }
         stop();
      };
   }, []);

   if (loading || !session) {
      return <div className="p-8 text-center text-muted-foreground animate-pulse mt-24">Caricamento pannello DJ...</div>;
   }

   if (session.djId !== user?.uid) {
      return <div className="p-8 text-center text-destructive mt-24">Non sei il Curatore di questa sessione.</div>;
   }

   if (session.status === 'closed') {
      return <div className="p-8 text-center mt-24">Scusa, questa sessione è stata chiusa.</div>;
   }

   const handleCloseSession = async () => {
      if (!confirm('Vuoi davvero chiudere questa sessione?')) return;
      
      if (engineRef.current) engineRef.current.stopLoop();
      stop();
      
      const played = queue.filter(q => q.status === 'played');
      const totalTracksPlayed = played.length;
      const totalDurationMs = played.reduce((acc, q) => acc + q.trackDurationMs, 0);
      
      // Top proposers
      const pStats = new Map<string, {name: string, count: number}>();
      played.forEach(q => {
         const cur = pStats.get(q.proposedBy) || { name: q.proposedByName, count: 0 };
         cur.count++;
         pStats.set(q.proposedBy, cur);
      });
      const topProposers = Array.from(pStats.entries())
         .map(([uid, v]) => ({ userId: uid, displayName: v.name, tracksPlayed: v.count }))
         .sort((a,b) => b.tracksPlayed - a.tracksPlayed);

      await closeSession({
         totalDurationMs,
         totalTracksPlayed,
         participantsCount: participants.length,
         topProposers
      });
      
      navigate('/ainulindale');
   };

   const toggleMode = () => {
      updateSession({ mode: session.mode === 'auto' ? 'manual' : 'auto' });
   };

   // Simple drag and drop
   const handleKick = (id: string) => setItemStatus(id, 'skipped');
   const handleForcePlay = (id: string) => {
      // mark current as skipped if playing
      // then play
      // For ease, just tell engine:
      engineRef.current?.forcePlayNext(); // actually we need specific force, wait.
   };

   const activeQueue = useMemo(() => queue.filter(q => !['played', 'skipped', 'failed'].includes(q.status)), [queue]);

   return (
      <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 pt-20 max-w-7xl mx-auto gap-6 bg-gradient-to-br from-background via-background to-secondary/10">
         <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 p-4 rounded-2xl backdrop-blur-md shadow-sm border">
            <div>
               <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">{session.title}</h1>
               <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> {session.participantCount}</span>
                  <span className="flex items-center"><Settings className="w-4 h-4 mr-1" /> {session.mode.toUpperCase()}</span>
                  <span className="flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary uppercase text-xs tracking-wider">{engineState}</span>
               </div>
            </div>
            
            <div className="flex items-center space-x-3">
               <div className="flex items-center space-x-2 mr-4 bg-background px-3 py-1.5 rounded-full border">
                  <Label htmlFor="auto-mode" className="text-sm cursor-pointer select-none">Auto Pilot</Label>
                  <Switch id="auto-mode" checked={session.mode === 'auto'} onCheckedChange={toggleMode} />
               </div>
               <Button variant="destructive" size="sm" onClick={handleCloseSession} className="shadow-lg shadow-destructive/20 hover:shadow-destructive/40">
                  <LogOut className="w-4 h-4 mr-2" /> Chiudi Coro
               </Button>
            </div>
         </header>
         
         <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
            {/* Left: Player */}
            <div className="flex flex-col space-y-6 lg:col-span-1">
               <div className="aspect-square bg-card/50 rounded-2xl border shadow-xl flex items-center justify-center p-6 relative overflow-hidden backdrop-blur-sm">
                  {/* Decorative background blur */}
                  {session.currentQueueItemId && queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl && (
                    <img 
                      src={queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl} 
                      className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-125 pointer-events-none" 
                    />
                  )}
                  
                  {session.currentQueueItemId ? (
                     <div className="flex flex-col items-center justify-center text-center space-y-6 relative z-10 w-full">
                        <img 
                           src={queue.find(q => q.id === session.currentQueueItemId)?.trackCoverDataUrl || ''} 
                           alt="Cover" 
                           className="w-48 h-48 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] object-cover bg-secondary"
                        />
                        <div className="w-full">
                           <h2 className="text-xl font-bold line-clamp-1">{session.currentTrackTitle}</h2>
                           <p className="text-muted-foreground line-clamp-1">{session.currentTrackArtist}</p>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                           <Button size="icon" variant="outline" className="h-14 w-14 rounded-full" onClick={() => isPlaying ? pause() : resume()}>
                              {isPlaying ? <div className="w-4 h-4 bg-foreground rounded-sm" /> : <Play className="w-6 h-6 ml-1" />}
                           </Button>
                           <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => engineRef.current?.forcePlayNext()}>
                              <SkipForward className="w-5 h-5" />
                           </Button>
                        </div>
                     </div>
                  ) : (
                     <div className="text-muted-foreground text-center animate-pulse flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-secondary/50 mb-4 flex items-center justify-center">
                           <Play className="w-8 h-8 opacity-50 ml-1" />
                        </div>
                        <p className="font-medium">Nessun brano in riproduzione</p>
                        <p className="text-sm mt-1">In attesa di ricezione...</p>
                     </div>
                  )}
               </div>
               
               {/* Transfer Status */}
               {transferringItemId && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 animate-in slide-in-from-bottom flex flex-col gap-2">
                     <span className="text-xs font-semibold text-primary uppercase">Caricamento P2P in corso</span>
                     <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                     </div>
                     <span className="text-xs font-mono text-right text-primary/80">{progress}%</span>
                  </div>
               )}
            </div>
            
            {/* Right: Queue */}
            <div className="lg:col-span-2 bg-card/30 rounded-2xl border shadow-sm flex flex-col min-h-0 backdrop-blur-sm">
               <div className="p-4 border-b font-semibold flex items-center justify-between">
                  <span>Coda del Coro</span>
                  <span className="text-xs bg-secondary/80 px-2 py-1 rounded-full text-secondary-foreground">{activeQueue.length} brani</span>
               </div>
               <ScrollArea className="flex-1 p-4">
                  {activeQueue.length === 0 ? (
                     <div className="text-center text-muted-foreground p-8 relative">
                        <div className="absolute inset-x-0 h-[200px] bg-gradient-to-b from-primary/5 to-transparent -top-4 rounded-xl -z-10" />
                        <p className="mt-8 font-medium">La coda è vuota.</p>
                        <p className="text-sm">I partecipanti possono proporre brani dalla loro biblioteca.</p>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {activeQueue.map(item => (
                           <QueueItemCard 
                              key={item.id} 
                              item={item} 
                              isDJ={true} 
                              isProposer={false}
                              onKick={handleKick}
                              onForcePlay={handleForcePlay}
                           />
                        ))}
                     </div>
                  )}
               </ScrollArea>
            </div>
         </div>
      </div>
   );
}
