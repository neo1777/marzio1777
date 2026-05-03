import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameEvent, LeaderboardEntry } from '../hooks/useGameEvents';
import { Crown, ArrowLeft } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export default function GameResults() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { event, loading } = useGameEvent(eventId || '');
  const prefersReducedMotion = useReducedMotion();

  if (loading) return null;
  if (!event) return <div>Evento non trovato</div>;

  const leaderboard: LeaderboardEntry[] = event.finalLeaderboard || [];

  return (
    <div className="h-full flex flex-col items-center justify-start p-6 bg-slate-50 dark:bg-[#151e18] overflow-y-auto">
       <button onClick={() => navigate('/dashboard/giochi')} className="self-start flex items-center gap-2 text-slate-500 mb-6">
          <ArrowLeft size={20} />
          <span>Torna</span>
       </button>

       <motion.div 
         initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }} 
         animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }} 
         className="text-center mb-8"
       >
          <Crown size={64} className="text-amber-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold dark:text-white mb-2">Risultati Finali</h1>
          <p className="text-slate-500">{event.title}</p>
       </motion.div>

       <div className="w-full max-w-md space-y-3" aria-live="polite">
          {leaderboard.map((lb, idx) => (
             <motion.div 
               key={lb.userId}
               initial={prefersReducedMotion ? { opacity: 0 } : { x: -20, opacity: 0 }} 
               animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }} 
               transition={{ delay: prefersReducedMotion ? 0 : idx * 0.1 }}
               className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
             >
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`}
                   </div>
                   <p className="font-bold dark:text-slate-200">{lb.displayName}</p>
                </div>
                <p className="font-bold text-lg dark:text-white">{lb.points} pt</p>
             </motion.div>
          ))}
          {leaderboard.length === 0 && (
             <p className="text-center text-slate-500">Nessun punteggio registrato.</p>
          )}
       </div>
    </div>
  );
}
