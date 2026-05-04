import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, ScrollArea } from '../ui';
import { useAudioSessionsList } from '../../hooks/useAudioSession';
import { proposeTrackToSession } from '../../hooks/useAudioQueue';
import { useAuth } from '../../contexts/AuthContext';
import { LocalTrack } from '../../types/audio';
import { Headphones, Music, CheckCircle2 } from 'lucide-react';

interface Props {
   isOpen: boolean;
   onClose: () => void;
   track: LocalTrack | null;
}

export default function AddToSessionModal({ isOpen, onClose, track }: Props) {
   const { sessions, loading } = useAudioSessionsList();
   const { user, profile } = useAuth();
   const [submittingId, setSubmittingId] = useState<string | null>(null);
   const [done, setDone] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const handlePick = async (sessionId: string) => {
      if (!track || !user || !profile) return;
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      setSubmittingId(sessionId);
      setError(null);
      try {
         await proposeTrackToSession(track, session, user, profile);
         setDone(true);
         setTimeout(() => { setDone(false); onClose(); }, 1200);
      } catch (e: any) {
         setError(e?.message || 'Errore durante la proposta');
      } finally {
         setSubmittingId(null);
      }
   };

   return (
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setError(null); setDone(false); onClose(); } }}>
         <DialogContent className="max-w-md w-full p-6 bg-card/95 backdrop-blur-xl border-primary/20">
            <DialogHeader>
               <DialogTitle>Aggiungi alla coda di un Coro</DialogTitle>
               <DialogDescription>
                  {track ? `"${track.title}" — ${track.artist}` : 'Nessun brano selezionato'}
               </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-60 rounded-md border border-primary/10 bg-background/30 p-2 mt-2">
               {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Caricamento sessioni...</div>
               ) : sessions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                     <Headphones className="w-8 h-8 opacity-30" />
                     <span>Nessun Coro aperto in questo momento.</span>
                     <span className="text-xs">Chiedi a un Curatore di aprirne uno.</span>
                  </div>
               ) : (
                  <div className="space-y-1">
                     {sessions.map(s => (
                        <button
                           key={s.id}
                           onClick={() => handlePick(s.id)}
                           disabled={!!submittingId}
                           className="w-full flex items-center p-2 rounded-lg cursor-pointer transition-colors hover:bg-primary/10 border border-transparent hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                           <Music className="w-5 h-5 text-primary mr-3 shrink-0" />
                           <div className="flex flex-col overflow-hidden flex-1">
                              <span className="font-medium text-sm truncate">{s.title}</span>
                              <span className="text-xs text-muted-foreground truncate">DJ {s.djName}</span>
                           </div>
                           {submittingId === s.id && (
                              <span className="text-xs text-primary animate-pulse ml-2">Aggiungo...</span>
                           )}
                        </button>
                     ))}
                  </div>
               )}
            </ScrollArea>

            {done && (
               <div className="flex items-center gap-2 text-sm text-green-500 font-medium mt-2">
                  <CheckCircle2 size={16} /> Brano aggiunto alla coda.
               </div>
            )}
            {error && <div className="text-sm text-destructive font-medium mt-2">{error}</div>}

            <DialogFooter className="mt-4">
               <Button variant="ghost" onClick={onClose}>Chiudi</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
