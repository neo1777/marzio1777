import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameEvent, useGameParticipants, advanceGameEventStatus } from '../hooks/useGameEvents';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, ArrowLeft, Users, Loader2 } from 'lucide-react';
import PermissionsGate from '../components/PermissionsGate';
import { motion, AnimatePresence } from 'framer-motion';

import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GameItem } from '../hooks/useNearestItem';

export default function GameLobby() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { event, loading } = useGameEvent(eventId || '');
  const { participants } = useGameParticipants(eventId || '');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [items, setItems] = useState<GameItem[]>([]);

  React.useEffect(() => {
     if (!eventId) return;
     const q = query(collection(db, `game_events/${eventId}/items`));
     const unsub = onSnapshot(q, (snapshot) => {
        const arr: GameItem[] = [];
        snapshot.forEach(d => arr.push({ id: d.id, ...d.data() } as GameItem));
        setItems(arr);
     });
     return () => unsub();
  }, [eventId]);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  }

  if (!event) {
    return <div className="h-full flex flex-col items-center justify-center text-slate-500">Evento non trovato.</div>;
  }

  const isOrganizer = user?.uid === event.organizerId;
  const isQuiz = event.type === 'photo_quiz';

  const joinedParticipants = participants.filter(p => p.status === 'joined');

  if (!permissionsGranted && (event.status === 'lobby' || event.status === 'active') && !isOrganizer) {
     return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
           <PermissionsGate 
              requireLocation={!isQuiz} 
              requireCamera={!isQuiz} 
              requireOrientation={!isQuiz}
              onPermissionsGranted={() => setPermissionsGranted(true)} 
           />
        </div>
     );
  }

  const handleOpenLobby = async () => {
    if(!eventId) return;
    await advanceGameEventStatus(eventId, 'lobby');
  };

  const handleStartGame = async () => {
    if(!eventId) return;
    if (isQuiz) {
       // Also initialize the quiz first round
       const { advanceQuizRound } = await import('../hooks/usePhotoQuiz');
       await advanceQuizRound(eventId, 1, undefined, user?.uid);
    } else {
       await advanceGameEventStatus(eventId, 'active');
    }
  };

  const getScore = (uid: string) => {
     return items.filter(i => i.status === 'collected' && i.collectedBy === uid)
                 .reduce((acc, i) => acc + i.points, 0) * (event?.pointsMultiplier || 1);
  };
  
  const sortedParticipants = [...joinedParticipants].sort((a, b) => getScore(b.userId) - getScore(a.userId));

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col pb-20 md:pb-0">
      <div className="flex flex-col items-center text-center mb-8 relative">
        <button 
           onClick={() => navigate('/dashboard/giochi')}
           className="absolute left-0 top-0 p-2 text-slate-400 hover:text-slate-600 background-none"
        >
           <ArrowLeft size={24} />
        </button>
        <div className="w-20 h-20 bg-[#2D5A27] dark:bg-[#1a261f] rounded-3xl flex items-center justify-center text-white dark:text-[#42a83a] shadow-xl shadow-[#2D5A27]/20 border border-[#42a83a]/20 mb-4">
          <Trophy size={40} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-2">{event.title}</h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{isQuiz ? 'Photo Quiz Multigiocatore' : 'Caccia al Tesoro AR'}</p>
      </div>

      <div className="bg-white dark:bg-[#151e18] rounded-2xl border border-slate-100 dark:border-[#24352b] p-6 text-center flex-1">
         {event.status === 'scheduled' && (
            <div className="h-full flex flex-col items-center justify-center">
               <Trophy size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
               <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">L'evento non è ancora iniziato</h2>
               <p className="text-slate-500 max-w-md">L'organizzatore non ha ancora aperto la lobby. Attendi o torna più tardi.</p>
               {isOrganizer && (
                  <button onClick={handleOpenLobby} className="mt-6 px-6 py-3 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white font-bold transition-colors">
                     Apri Lobby Ora
                  </button>
               )}
            </div>
         )}

         {event.status === 'lobby' && (
            <div className="h-full flex flex-col">
               <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Lobby Aperta</h2>
               <p className="text-slate-500 text-sm mb-6">In attesa che l'organizzatore avvii la partita...</p>
               
               <div className="flex-1 overflow-y-auto mb-6">
                  <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-[#24352b] pb-2">
                     <Users size={16} /> <span>{joinedParticipants.length} Giocatori Pronti</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <AnimatePresence>
                        {joinedParticipants.map(p => (
                           <motion.div 
                              key={p.userId}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1a261f] rounded-xl border border-slate-100 dark:border-[#24352b]"
                           >
                              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                 {/* Assuming we might fetch full user profiles. If not, placeholder. */}
                                 <svg className="w-full h-full text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                              </div>
                              <span className="text-sm font-bold truncate text-slate-700 dark:text-slate-300">{p.userId === user?.uid ? 'Tu' : 'Giocatore'}</span>
                           </motion.div>
                        ))}
                     </AnimatePresence>
                  </div>
               </div>

               {isOrganizer && (
                  <button onClick={handleStartGame} className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg shadow-red-500/30 transition-colors">
                     Inizia Partita (MVP)
                  </button>
               )}
            </div>
         )}

         {event.status === 'active' && (
            <div className="h-full flex flex-col items-center pt-8">
               <Trophy size={48} className="text-red-500 mb-4 animate-pulse" />
               <h2 className="text-2xl font-bold text-[#1a2e16] dark:text-slate-200 mb-4">La partita è in corso!</h2>
               
               <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Live Leaderboard (MVP)</h3>
                  <div className="space-y-2 text-left">
                     {sortedParticipants.map(targetUser => (
                        <div key={targetUser.userId} className="flex items-center justify-between bg-white dark:bg-slate-700 p-2 rounded-lg">
                           <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                             {targetUser.userId === user?.uid ? 'Tu' : 'Giocatore'}
                           </span>
                           <span className="font-bold text-[#2D5A27] dark:text-[#42a83a]">{getScore(targetUser.userId)} pt</span>
                        </div>
                     ))}
                  </div>
               </div>

               <button onClick={() => navigate(`/dashboard/giochi/${eventId}/play`)} className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-500/20 rounded-xl font-bold text-lg transition-colors w-full">
                  Torna in Mappa
               </button>
               {isOrganizer && (
                  <button onClick={() => advanceGameEventStatus(eventId!, 'completed')} className="mt-6 text-slate-400 underline text-sm">Termina Partita Manualmente</button>
               )}
            </div>
         )}

         {event.status === 'completed' && (
            <div className="h-full flex flex-col items-center pt-8">
               <Trophy size={48} className="text-amber-500 mb-4" />
               <h2 className="text-2xl font-bold text-[#1a2e16] dark:text-slate-200 mb-4">Partita Terminata!</h2>
               
               <div className="w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-sm text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-3">Classifica Finale</h3>
                  <div className="space-y-2 text-left">
                     {sortedParticipants.map((targetUser, idx) => (
                        <div key={targetUser.userId} className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg">
                           <span className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                             <span className="text-amber-500 font-extrabold w-4">{idx + 1}°</span>
                             {targetUser.userId === user?.uid ? 'Tu' : 'Giocatore'}
                           </span>
                           <span className="font-bold text-[#2D5A27] dark:text-[#42a83a]">{getScore(targetUser.userId)} pt</span>
                        </div>
                     ))}
                  </div>
               </div>
               <button onClick={() => navigate('/dashboard/giochi')} className="px-6 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors mt-auto">
                  Torna ai Giochi
               </button>
            </div>
         )}
      </div>
    </div>
  );
}
