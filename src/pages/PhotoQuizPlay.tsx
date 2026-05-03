import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGameEvent, useGameLeaderboard, useGameParticipants } from '../hooks/useGameEvents';
import { 
   useQuizRounds, 
   useCurrentRound, 
   useRoundAnswers, 
   submitQuizAnswer, 
   advanceQuizRound, 
   setRoundStatus, 
   evaluateRoundAnswers 
} from '../hooks/usePhotoQuiz';
import { Loader2, Users, CheckCircle, Clock, Trophy, Crown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QuizHostCreateRound from '../components/QuizHostCreateRound';

export default function PhotoQuizPlay() {
   const { eventId } = useParams();
   const navigate = useNavigate();
   const { user, profile } = useAuth();
   
   const [isCreatingRound, setIsCreatingRound] = useState(false);
   const { event } = useGameEvent(eventId || '');
   const { leaderboard } = useGameLeaderboard(eventId || '');
   const { participants } = useGameParticipants(eventId || '');
   const { rounds } = useQuizRounds(eventId || '');
   const prefersReducedMotion = useReducedMotion();
   
   const currentRoundNumber = event?.currentRound || 0;
   const { round } = useCurrentRound(eventId || '', currentRoundNumber);
   const { answers } = useRoundAnswers(eventId || '', round?.id);

   // Determine host dynamically: if a round exists, its hostId dictates the host, otherwise fallback to organizer
   const currentHostId = event?.photoQuizConfig?.currentHostId || event?.organizerId;
   const isHost = currentHostId === user?.uid;
   const isOrganizer = event?.organizerId === user?.uid;

   const hasAnswered = answers.some(a => a.userId === user?.uid);
   const myAnswer = answers.find(a => a.userId === user?.uid);

   // Timer logic
   const [timeLeft, setTimeLeft] = useState<number | null>(null);

   const getQuestionText = (type: string | undefined) => {
      switch(type) {
         case 'guess_who': return 'Chi è il soggetto nella foto?';
         case 'guess_year': return 'In che anno è stata scattata?';
         case 'guess_place': return 'Dove è stata scattata questa foto?';
         case 'guess_caption': return 'Qual è la descrizione giusta?';
         case 'chronology': return 'In che decennio è successo?';
         default: return 'Rispondi alla domanda';
      }
   };

   useEffect(() => {
      if (round?.status === 'active' && round.startedAt) {
         const totalTime = event?.photoQuizConfig?.answerTimeSeconds || 20;
         const interval = setInterval(() => {
            const started = round.startedAt.toMillis();
            const elapsed = (Date.now() - started) / 1000;
            const remaining = Math.max(0, Math.floor(totalTime - elapsed));
            setTimeLeft(remaining);
            if (remaining <= 0) {
               // Time up! Host action? Just show 0.
               clearInterval(interval);
            }
         }, 1000);
         return () => clearInterval(interval);
      } else {
         setTimeLeft(null);
      }
   }, [round?.status, round?.startedAt, event?.photoQuizConfig?.answerTimeSeconds]);

   if (!event || !user) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

   // Host Handlers
   const handleNextRound = async () => {
      if (!eventId || !event) return;
      const nextNum = currentRoundNumber + 1;
      
      // We must not exceed total rounds
      if (nextNum > (event.photoQuizConfig?.totalRounds || 1)) {
         alert("Quiz Terminato!");
         const { advanceGameEventStatus } = await import('../hooks/useGameEvents');
         await advanceGameEventStatus(eventId, 'completed');
         navigate(`/dashboard/giochi/${eventId}/lobby`);
         return;
      }

      let nextHostId = currentHostId;
      if (event.photoQuizConfig?.rotateHost) {
         const joinedPlayers = participants.filter(p => p.status === 'joined').map(p => p.userId).sort();
         const currentIndex = joinedPlayers.indexOf(currentHostId || '');
         
         if (joinedPlayers.length > 0) {
            if (currentIndex >= 0) {
               nextHostId = joinedPlayers[(currentIndex + 1) % joinedPlayers.length];
            } else {
               // Current host is no longer in joined list, pick first available or organizer
               nextHostId = joinedPlayers[0];
            }
         } else {
            // No players left! Force fallback to organizer
            nextHostId = event.organizerId;
         }
      }

      await advanceQuizRound(eventId, nextNum, round?.id, nextHostId);
   };

   const handleReveal = async () => {
      if (!eventId || !round) return;
      const { correctIndex } = await evaluateRoundAnswers(
         eventId, 
         round.id, 
         event.photoQuizConfig?.answerTimeSeconds || 20, 
         100 * (event.pointsMultiplier || 1),
         'decay' // Ensure decay scoring
      );
      await setRoundStatus(eventId, round.id, 'revealed', correctIndex);
   };

   // Player Handlers
   const handleSelectAnswer = async (index: number) => {
      if (hasAnswered || !eventId || !round || !profile) return;
      try {
         await submitQuizAnswer(eventId, round.id, user.uid, profile.displayName || 'Anonimo', index);
      } catch (e) {
         console.error(e);
         alert("Errore invio risposta");
      }
   };

   // RENDER HOST VIEW
   if (isHost) {
      return (
         <div className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-y-auto w-full">
            <div className="p-4 bg-slate-800 flex justify-between items-center shadow-lg sticky top-0 z-10 w-full flex-shrink-0">
               <div>
                  <h1 className="font-bold text-lg">{event.title} (Host)</h1>
                  <p className="text-sm text-slate-400">Round {currentRoundNumber} di {event.photoQuizConfig?.totalRounds}</p>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => navigate(`/dashboard/giochi/${eventId}/lobby`)} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-bold text-sm">Esci</button>
               </div>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center">
               {(!round || round.status === 'waiting') ? (
                  <div className="text-center w-full max-w-lg mt-4">
                     <h2 className="text-2xl font-bold mb-8">
                        {round ? `Sei l'Host del Round ${round.roundNumber}!` : 'Pronto per iniziare?'}
                     </h2>
                     <p className="text-slate-400 mb-6 font-medium">Scegli la prossima combinazione di foto e domanda per sfidare gli altri giocatori.</p>
                     
                     <div className="grid grid-cols-1 gap-4 mb-8 text-left">
                        <button 
                           onClick={() => setIsCreatingRound(true)} 
                           className="w-full bg-[#f56a23] hover:bg-[#e05e1b] p-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors text-white shadow-lg shadow-[#f56a23]/20"
                        >
                           <span className="text-3xl">+</span>
                           <h4 className="font-bold text-xl">Crea Nuovo Round</h4>
                           <p className="text-sm text-white/80">Scegli una foto e scrivi la domanda</p>
                        </button>
                     </div>
                  </div>
               ) : (
                  <div className="w-full max-w-2xl flex flex-col gap-6">
                     <div className="bg-slate-800 p-6 rounded-2xl text-center shadow-xl">
                        {round.status === 'active' && (
                           <>
                              <h2 className="text-xl font-bold text-indigo-400 mb-2">Round {round.roundNumber} - Risposte in corso</h2>
                              <p className="text-xs text-indigo-300 font-medium bg-indigo-900/40 py-1.5 px-4 rounded-full inline-block mb-2">
                                 L'host visualizza la risposta corretta dopo il tempo limite.
                              </p>
                              <div className="flex justify-center items-center gap-8 my-6">
                                 <div className="flex flex-col items-center">
                                    <Clock size={40} className={`mb-2 ${timeLeft && timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                                    <span className="text-4xl font-bold font-mono">{timeLeft !== null ? timeLeft : '--'}s</span>
                                 </div>
                                 <div className="flex flex-col items-center">
                                    <Users size={40} className="mb-2 text-blue-400" />
                                    <span className="text-4xl font-bold">{answers.length}</span>
                                    <span className="text-sm text-slate-400">risposte</span>
                                 </div>
                              </div>
                              <button onClick={handleReveal} className="mt-4 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl text-lg shadow-lg">
                                 Stop e Rivela Risultati
                              </button>
                           </>
                        )}
                        {round.status === 'revealed' && (
                           <>
                              <h2 className="text-xl font-bold text-green-400 mb-4">Round {round.roundNumber} Concluso!</h2>
                              <div className="p-4 bg-black/40 rounded-xl mb-6">
                                 <p className="text-sm text-slate-400 mb-1">La risposta corretta era</p>
                                 <p className="text-2xl font-bold text-white">
                                    {round.correctIndex !== undefined ? round.questionOptions[round.correctIndex] : '...'}
                                 </p>
                              </div>
                              <button onClick={handleNextRound} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl drop-shadow-lg">
                                 {currentRoundNumber >= (event.photoQuizConfig?.totalRounds || 1) ? 'Termina Evento' : 'Prossima Domanda'}
                              </button>
                           </>
                        )}
                     </div>

                     {/* Mini Leaderboard preview for Host */}
                     <div className="bg-slate-800 p-4 rounded-2xl">
                        <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2"><Trophy size={18}/> Top 5 Classifica</h3>
                        {leaderboard.slice(0,5).map((l, i) => (
                           <div key={l.userId} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                              <span className="font-bold">{i+1}. {l.displayName}</span>
                              <span className="text-amber-400 font-bold">{l.points} pt</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>

            <AnimatePresence>
               {isCreatingRound && round && (
                  <QuizHostCreateRound 
                     eventId={eventId || ''} 
                     hostId={user.uid}
                     roundId={round.id}
                     roundNumber={currentRoundNumber || 1}
                     onClose={() => setIsCreatingRound(false)} 
                     onSuccess={async () => {
                        setIsCreatingRound(false);
                     }}
                  />
               )}
            </AnimatePresence>
         </div>
      );
   }

   // Calculate host name
   const hostProfile = participants.find(p => p.userId === currentHostId);
   const hostDisplayName = hostProfile?.userId === event.organizerId ? 'Organizzatore' : (hostProfile?.userId || 'Host Sconosciuto');

   // RENDER PLAYER VIEW
   return (
      <div className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden w-full relative">
         <div className="absolute top-4 left-4 z-50">
            <button onClick={() => navigate(`/dashboard/giochi/${eventId}/lobby`)} className="p-2 bg-black/50 backdrop-blur rounded-full text-white/70 hover:text-white">
               <Loader2 size={24} className="opacity-0 hidden" />
               <span>Esci</span>
            </button>
         </div>

         {/* Host Banner */}
         <div className="absolute top-4 right-4 z-50">
            <div className="px-3 py-1 bg-indigo-900/80 backdrop-blur rounded-full text-sm font-semibold flex items-center gap-2 border border-indigo-500/30">
               <Crown size={14} className="text-amber-400" />
               <span className="text-indigo-200">Host:</span> {hostDisplayName}
            </div>
         </div>

         {!round || round.status === 'waiting' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
               <Loader2 size={48} className="animate-spin text-indigo-500 mb-6" />
               <h2 className="text-2xl font-bold text-white mb-2">Attendi l'Host</h2>
               <p className="text-slate-400">Il quiz inizierà a breve...</p>
            </div>
         ) : (
            <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
               <div className="h-2/5 md:h-1/2 w-full relative bg-black">
                  <img src={round.mediaUrl} alt="Mistero" className="w-full h-full object-contain" />
                  
                  {round.status === 'active' && (
                     <div className="absolute top-4 right-4 bg-black/60 backdrop-blur rounded-full px-4 py-2 font-mono font-bold text-xl border border-white/10 flex items-center gap-2 shadow-lg">
                        <Clock size={18} className={timeLeft && timeLeft <= 5 ? "text-red-400" : "text-amber-400"} />
                        {timeLeft}
                     </div>
                  )}
               </div>

               <div className="flex-1 p-4 flex flex-col">
                  {round.status === 'active' && !hasAnswered && (
                     <motion.div 
                        initial={prefersReducedMotion ? { opacity: 0 } : { y: 50, opacity: 0 }} 
                        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }} 
                        className="flex-1 flex flex-col"
                     >
                        <h3 className="text-xl font-bold text-center mb-6 mt-4" aria-live="polite">
                           {round.questionText || getQuestionText(round.type)}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pb-4">
                           {round.questionOptions.map((opt, idx) => (
                              <button 
                                 key={idx} 
                                 onClick={() => handleSelectAnswer(idx)}
                                 className="bg-slate-800 hover:bg-indigo-600 p-4 rounded-xl text-lg font-bold transition-colors border border-slate-700 active:scale-95 min-h-[56px]"
                                 aria-label={`Scegli opzione: ${opt}`}
                              >
                                 {opt}
                              </button>
                           ))}
                        </div>
                     </motion.div>
                  )}

                  {round.status === 'active' && hasAnswered && (
                     <motion.div 
                        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }} 
                        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }} 
                        className="flex-1 flex flex-col items-center justify-center text-center"
                     >
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                           <CheckCircle size={40} className="text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2" aria-live="polite">Risposta Registrata!</h3>
                        <p className="text-slate-400">Hai scelto: <strong className="text-white">{myAnswer?.selectedIndex !== undefined ? round.questionOptions[myAnswer.selectedIndex] : '...'}</strong></p>
                        <p className="text-slate-500 mt-8 text-sm">In attesa che scada il tempo...</p>
                     </motion.div>
                  )}

                  {round.status === 'revealed' && (
                     <motion.div 
                        initial={prefersReducedMotion ? { opacity: 0 } : { y: 20, opacity: 0 }} 
                        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }} 
                        className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto"
                        aria-live="polite"
                     >
                        <p className="text-sm text-slate-400 mb-1 uppercase tracking-wider font-bold">La Risposta Esatta</p>
                        <h3 className="text-4xl font-bold text-white mb-8 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                           {round.correctIndex !== undefined ? round.questionOptions[round.correctIndex] : '...'}
                        </h3>

                        {myAnswer ? (
                           <div className={`p-6 rounded-2xl w-full border mb-8 ${myAnswer.selectedIndex === round.correctIndex ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-red-900/30 border-red-500/30'}`}>
                              {myAnswer.selectedIndex === round.correctIndex ? (
                                 <>
                                    <div className="flex justify-center mb-4"><Crown size={40} className="text-amber-400 drop-shadow-lg" /></div>
                                    <h4 className="text-xl font-bold text-emerald-400 mb-2">Esatto!</h4>
                                    <p className="text-2xl font-black text-white">+{myAnswer.pointsAwarded} pt</p>
                                    <p className="text-xs text-slate-400 mt-2">La tua velocità ha influenzato il punteggio</p>
                                 </>
                              ) : (
                                 <>
                                    <h4 className="text-xl font-bold text-red-400 mb-2">Peccato!</h4>
                                    <p className="text-slate-400">Avevi scelto: <span className="line-through">{myAnswer.selectedIndex !== undefined ? round.questionOptions[myAnswer.selectedIndex] : '...'}</span></p>
                                    <p className="text-2xl font-black text-slate-500 mt-2">0 pt</p>
                                 </>
                              )}
                           </div>
                        ) : (
                           <div className="p-6 rounded-2xl w-full bg-slate-800 border border-slate-700 mb-8">
                              <h4 className="text-xl font-bold text-slate-400 mb-2">Tempo Scaduto!</h4>
                              <p className="text-slate-500">Non hai fatto in tempo a rispondere.</p>
                           </div>
                        )}

                        <div className="w-full text-left bg-slate-800/80 p-5 rounded-2xl">
                           <h4 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-wider border-b border-slate-700 pb-2">Distribuzione Risposte</h4>
                           <div className="flex flex-col gap-3">
                              {round.questionOptions.map((opt, idx) => {
                                 const count = answers.filter(a => a.selectedIndex === idx).length;
                                 const percent = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0;
                                 const isCorrect = idx === round.correctIndex;
                                 const isMine = myAnswer?.selectedIndex === idx;
                                 
                                 return (
                                    <div key={idx} className="flex flex-col gap-1">
                                       <div className="flex justify-between text-sm">
                                          <span className="truncate flex-1 pr-2 flex items-center gap-2">
                                             {opt} 
                                             {isCorrect && <CheckCircle size={14} className="text-emerald-400" />}
                                             {isMine && <span className="text-[10px] bg-slate-600 px-1 rounded-sm text-slate-200">TU</span>}
                                          </span>
                                          <span className="font-mono text-slate-400 ml-2 font-bold">{count} ({percent}%)</span>
                                       </div>
                                       <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden relative">
                                          <motion.div 
                                             initial={{ width: 0 }}
                                             animate={{ width: `${percent}%` }}
                                             transition={{ duration: 1, ease: "easeOut" }}
                                             className={`absolute top-0 bottom-0 left-0 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                          />
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>

                        <p className="text-sm text-slate-500 mt-8 mb-4">Attendi che l'Host avvii il prossimo round...</p>
                     </motion.div>
                  )}
               </div>
            </div>
         )}
      </div>
   );
}
