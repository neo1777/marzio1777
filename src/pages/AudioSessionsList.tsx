import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioSessionsList } from '../hooks/useAudioSession';
import { useRBAC } from '../hooks/useRBAC';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui';
import { Music, Users, ListMusic, PlusCircle, HeadphonesIcon, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AudioSession } from '../types/audio';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Avatar } from '../components/ui';

export function AudioSessionsList() {
   const { sessions, loading } = useAudioSessionsList();
   const { user, isAdminOrRoot: canCreateSession } = useRBAC();
   const navigate = useNavigate();

   if (loading) {
      return <div className="h-full flex items-center justify-center p-8"><span className="animate-pulse text-xl text-primary/50 text-center">Caricamento delle sessioni live...</span></div>;
   }

   return (
      <div className="max-w-4xl mx-auto p-4 sm:p-8 pt-24 space-y-8">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  Il Coro delle Frazioni
               </h1>
               <p className="text-muted-foreground text-lg mt-2 font-medium">Sessioni di ascolto condivise in Tempo Reale</p>
            </div>
            {canCreateSession && (
               <Button onClick={() => navigate('/dashboard/ainulindale/sessioni/nuova')} size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                  <PlusCircle className="mr-2 h-5 w-5" /> Nuovo Coro
               </Button>
            )}
         </div>

         {sessions.length === 0 ? (
            <Card className="border-dashed bg-card/40 backdrop-blur-sm border-2">
               <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <HeadphonesIcon className="h-16 w-16 mb-4 text-primary/20" />
                  <p className="text-xl font-medium text-foreground">Nessun coro attivo in questo momento.</p>
                  <p className="mt-2 text-sm">Torna più tardi o attendi che un Curatore ne apra uno.</p>
               </CardContent>
            </Card>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {sessions.map((session, idx) => (
                  <SessionCard key={session.id} session={session} idx={idx} />
               ))}
            </div>
         )}
      </div>
   );
}

function SessionCard({ session, idx }: { session: AudioSession, idx: number }) {
   const navigate = useNavigate();
   const { isRoot } = useRBAC();

   // Root-only test cleanup. Sub-collections (queue/participants/signaling)
   // are pruned by the cleanupOrphanSessions cron (functions/src/index.ts).
   const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Cancellare definitivamente la sessione "${session.title}"?`)) return;
      try {
         await deleteDoc(doc(db, 'audio_sessions', session.id));
      } catch (err: any) {
         alert(`Cancellazione fallita: ${err?.message || 'errore sconosciuto'}`);
      }
   };

   return (
      <motion.div
         initial={{ opacity: 0, y: 30 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: idx * 0.1, duration: 0.5, ease: 'easeOut' }}
         whileHover={{ y: -5 }}
      >
         <Card
            className="cursor-pointer hover:border-primary/50 transition-colors h-full flex flex-col overflow-hidden bg-card/60 backdrop-blur-md shadow-xl relative"
            onClick={() => navigate(`/dashboard/ainulindale/sessioni/${session.id}`)}
         >
            {isRoot && (
               <button
                  onClick={handleDelete}
                  aria-label="Elimina sessione"
                  title="Elimina sessione (Root)"
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-sm"
               >
                  <Trash2 size={14} />
               </button>
            )}
            <div className="h-2 bg-gradient-to-r from-primary to-primary/50 w-full" />
            <CardHeader className="pb-4">
               <CardTitle className="text-xl line-clamp-1">{session.title}</CardTitle>
               <CardDescription className="line-clamp-2 min-h-[40px] text-sm text-foreground/60">{session.description || 'Nessuna descrizione'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end space-y-6">
               
               <div className="flex items-center space-x-3 bg-secondary/30 p-3 rounded-lg">
                  <Avatar photoURL={session.djPhotoURL} name={session.djName} size="md" ringClass="ring-2 ring-primary/20" />
                  <div className="flex flex-col">
                     <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Curatore</span>
                     <span className="text-sm font-medium">{session.djName || 'Anonimo'}</span>
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground group">
                     <Music className="w-4 h-4 mr-3 text-primary/70 group-hover:text-primary transition-colors" />
                     {session.currentTrackTitle ? (
                        <div className="flex flex-col">
                           <span className="font-medium text-foreground line-clamp-1">{session.currentTrackTitle}</span>
                           <span className="text-xs">{session.currentTrackArtist}</span>
                        </div>
                     ) : (
                        <span className="italic">In attesa...</span>
                     )}
                  </div>
                  
                  <div className="flex bg-secondary/20 rounded-md p-2 divide-x divide-border mt-2">
                     <div className="flex-1 flex items-center justify-center text-xs font-semibold text-foreground/80">
                        <ListMusic className="w-3.5 h-3.5 mr-1.5" />
                        {session.queuedCount} in coda
                     </div>
                     <div className="flex-1 flex items-center justify-center text-xs font-semibold text-foreground/80">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        {session.participantCount} presenti
                     </div>
                  </div>
               </div>
            </CardContent>
         </Card>
      </motion.div>
   );
}
