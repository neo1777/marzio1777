import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, ScrollArea } from '../ui';
import { useLocalLibrary } from '../../hooks/useLocalLibrary';
import { LocalTrack } from '../../types/audio';
import { Search, Music } from 'lucide-react';

interface ProposeTrackModalProps {
   isOpen: boolean;
   onClose: () => void;
   onPropose: (track: LocalTrack) => Promise<void>;
}

export function ProposeTrackModal({ isOpen, onClose, onPropose }: ProposeTrackModalProps) {
   const { tracks, isLoading: loading } = useLocalLibrary();
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedTrack, setSelectedTrack] = useState<LocalTrack | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const filtered = tracks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
   );

   const handlePropose = async () => {
      if (!selectedTrack) return;
      setSubmitting(true);
      setError(null);
      try {
         await onPropose(selectedTrack);
         onClose();
      } catch (err: any) {
         setError(err.message || 'Errore durante la proposta');
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose()}}>
         <DialogContent className="max-w-md w-full p-6 bg-card/95 backdrop-blur-xl border-primary/20">
            <DialogHeader>
               <DialogTitle>Proponi un Brano</DialogTitle>
               <DialogDescription>
                  Scegli un brano dalla tua biblioteca da aggiungere alla coda.
               </DialogDescription>
            </DialogHeader>
            
            <div className="relative mb-4">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                  placeholder="Cerca nella tua biblioteca..." 
                  className="pl-9 bg-background/50 border-primary/20"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
               />
            </div>
            
            <ScrollArea className="h-60 rounded-md border border-primary/10 bg-background/30 p-2">
               {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Caricamento...</div>
               ) : filtered.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Nessun brano trovato.</div>
               ) : (
                  <div className="space-y-1">
                     {filtered.map(track => (
                        <div 
                           key={track.id}
                           onClick={() => setSelectedTrack(track)}
                           className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${selectedTrack?.id === track.id ? 'bg-primary/20 border border-primary/50' : 'hover:bg-primary/10 border border-transparent'}`}
                        >
                           {track.coverDataUrl ? (
                              <img src={track.coverDataUrl} className="w-10 h-10 rounded-md object-cover mr-3" />
                           ) : (
                              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mr-3">
                                 <Music className="w-5 h-5 text-muted-foreground" />
                              </div>
                           )}
                           <div className="flex flex-col overflow-hidden">
                              <span className="font-medium text-sm truncate">{track.title}</span>
                              <span className="text-xs text-muted-foreground truncate">{track.artist}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </ScrollArea>
            
            {error && <div className="text-sm text-destructive font-medium mt-2">{error}</div>}
            
            <DialogFooter className="mt-4">
               <Button variant="ghost" onClick={onClose}>Annulla</Button>
               <Button onClick={handlePropose} disabled={!selectedTrack || submitting}>
                  {submitting ? 'Aggiunta...' : 'Metti in coda'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
