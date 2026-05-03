import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore';
import { Button, Input, Label, Textarea, Switch, Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui';

export function AudioSessionCreate() {
   const { user, profile } = useAuth();
   const isRoot = profile?.role === 'Root';
   const isAdmin = profile?.role === 'Admin' || isRoot;
   const navigate = useNavigate();

   const [step, setStep] = useState(1);
   const [loading, setLoading] = useState(false);
   
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   
   const [rules, setRules] = useState({
      maxQueuedPerUser: 2,
      bonusPerHundredPoints: 1,
      allowDuplicates: false,
      autoSkipOfflineProposers: true
   });

   if (!user || (!isRoot && !isAdmin)) {
      return <div className="p-8 text-center text-destructive font-semibold">Accesso negato. Solo gli amministratori possono creare sessioni.</div>;
   }

   const handleCreate = async () => {
      if (!title) return;
      setLoading(true);
      try {
         const sessionId = doc(collection(db, 'audio_sessions')).id;
         const batch = writeBatch(db);
         
         batch.set(doc(db, 'audio_sessions', sessionId), {
            id: sessionId,
            type: 'audio_session',
            djId: user.uid,
            djName: user.displayName || 'DJ',
            djPhotoURL: user.photoURL || '',
            title,
            description,
            status: 'open',
            mode: 'auto',
            createdAt: serverTimestamp(),
            closedAt: null,
            currentQueueItemId: null,
            currentTrackTitle: null,
            currentTrackArtist: null,
            currentTrackDurationMs: null,
            currentTrackStartedAt: null,
            rules,
            participantCount: 0,
            queuedCount: 0,
            playedCount: 0
         });
         
         batch.set(doc(db, 'audio_sessions', sessionId, 'participants', user.uid), {
            userId: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            joinedAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
            tracksProposed: 0,
            tracksPlayed: 0,
            status: 'joined'
         });
         
         await batch.commit();
         navigate(`/ainulindale/live/${sessionId}`);
      } catch (e) {
         console.error(e);
         setLoading(false);
      }
   };

   return (
      <div className="max-w-xl mx-auto p-4 sm:p-8 pt-24 space-y-6">
         <h1 className="text-3xl font-bold">Nuovo Coro</h1>
         
         <Card className="bg-card/50 backdrop-blur-md shadow-lg border-primary/20">
            {step === 1 && (
               <>
                  <CardHeader>
                     <CardTitle>Dettagli della Sessione</CardTitle>
                     <CardDescription>Dai un nome a questo evento di ascolto condiviso.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label>Titolo della Sessione</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Radiodrammi del Martedì" className="bg-background" />
                     </div>
                     <div className="space-y-2">
                        <Label>Descrizione (opzionale)</Label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Di cosa parleremo in questa sessione?" className="bg-background min-h-[100px]" />
                     </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                     <Button onClick={() => setStep(2)} disabled={!title}>Avanti</Button>
                  </CardFooter>
               </>
            )}
            
            {step === 2 && (
               <>
                  <CardHeader>
                     <CardTitle>Regole del Coro</CardTitle>
                     <CardDescription>Definisci i limiti per i partecipanti.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-medium">
                           <Label>Brani in coda per utente (Base)</Label>
                           <span>{rules.maxQueuedPerUser}</span>
                        </div>
                        <input type="range" min="1" max="5" value={rules.maxQueuedPerUser} onChange={e => setRules({...rules, maxQueuedPerUser: parseInt(e.target.value)})} className="w-full accent-primary" />
                     </div>
                     
                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-medium">
                           <Label>Bonus Coda per ogni 100 Punti Frazione</Label>
                           <span>+{rules.bonusPerHundredPoints}</span>
                        </div>
                        <input type="range" min="0" max="3" value={rules.bonusPerHundredPoints} onChange={e => setRules({...rules, bonusPerHundredPoints: parseInt(e.target.value)})} className="w-full accent-primary" />
                        <p className="text-xs text-muted-foreground">Un utente con 250pt e un bonus di 1 avrà {rules.maxQueuedPerUser + 2} slot totali.</p>
                     </div>
                     
                     <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="space-y-0.5">
                           <Label>Ammessa la Ripetizione</Label>
                           <p className="text-xs text-muted-foreground">Lo stesso brano può essere inserito più volte?</p>
                        </div>
                        <Switch checked={rules.allowDuplicates} onCheckedChange={c => setRules({...rules, allowDuplicates: c})} />
                     </div>
                     
                     <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="space-y-0.5">
                           <Label>Skip Automatico Offline</Label>
                           <p className="text-xs text-muted-foreground">Salta il brano se chi lo ha proposto ha lasciato la stanza.</p>
                        </div>
                        <Switch checked={rules.autoSkipOfflineProposers} onCheckedChange={c => setRules({...rules, autoSkipOfflineProposers: c})} />
                     </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t border-border/50 pt-6">
                     <Button variant="ghost" onClick={() => setStep(1)}>Indietro</Button>
                     <Button onClick={handleCreate} disabled={loading} className="w-32">{loading ? "Creazione..." : "Apri il Coro"}</Button>
                  </CardFooter>
               </>
            )}
         </Card>
      </div>
   );
}
