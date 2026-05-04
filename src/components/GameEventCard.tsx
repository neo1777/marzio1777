import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameEvent, useGameParticipants, setRSVP } from '../hooks/useGameEvents';
import { Map, Camera, Clock, Users, Check, X, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRBAC } from '../hooks/useRBAC';
import { motion } from 'framer-motion';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Props {
  event: GameEvent;
}

export default function GameEventCard({ event }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isRoot } = useRBAC();
  const { participants, currentUserParticipant } = useGameParticipants(event.id);

  // Root-only test cleanup. The rule mirrors this guard: it forbids deleting
  // events whose status is 'active' (firestore.rules:309). Subcollections
  // (items/participants/leaderboard/quizRounds/answers) are not auto-pruned —
  // for now they age out via the existing cleanupStuck* cron functions.
  const canDelete = isRoot && event.status !== 'active';
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) return;
    if (!confirm(`Cancellare definitivamente la partita "${event.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'game_events', event.id));
    } catch (err: any) {
      alert(`Cancellazione fallita: ${err?.message || 'errore sconosciuto'}`);
    }
  };

  const isQuiz = event.type === 'photo_quiz';
  const Icon = isQuiz ? Camera : Map;
  const colorClass = isQuiz ? 'text-indigo-600 dark:text-indigo-400' : 'text-[#2D5A27] dark:text-[#42a83a]';
  const bgClass = isQuiz ? 'bg-indigo-50 dark:bg-indigo-900/20 shadow-indigo-100/50' : 'bg-[#2D5A27]/5 dark:bg-[#2D5A27]/10 shadow-[#2D5A27]/10';

  const dateStr = event.scheduledKickoff?.toDate?.()?.toLocaleString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const isOrganizer = user?.uid === event.organizerId;
  const canRSVP = !isOrganizer && (event.status === 'scheduled' || event.status === 'lobby');

  const joinedCount = participants.filter(p => p.status === 'joined').length;

  return (
    <div className={`p-5 rounded-2xl border border-slate-100 dark:border-[#24352b] ${bgClass} shadow-md overflow-hidden relative`}>
      {isRoot && (
        <button
          onClick={handleDelete}
          disabled={!canDelete}
          aria-label="Elimina partita"
          title={canDelete ? 'Elimina partita (Root)' : 'Una partita in corso non può essere cancellata'}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 dark:bg-[#151e18]/80 text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/80 disabled:hover:text-red-500 transition-colors shadow-sm"
        >
          <Trash2 size={14} />
        </button>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-[#151e18] shadow-sm`}>
            <Icon size={24} className={colorClass} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1a2e16] dark:text-[#e2e8f0] font-serif leading-tight">{event.title}</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 opacity-90">{isQuiz ? 'Il Quiz del Bivacco' : 'Caccia ai Ricordi'}</p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          event.status === 'active' ? 'bg-red-500 text-white animate-pulse' :
          event.status === 'lobby' ? 'bg-amber-500 text-white' :
          event.status === 'completed' ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
          'bg-[#2D5A27]/10 text-[#2D5A27] dark:bg-[#42a83a]/20 dark:text-[#42a83a]'
        }`}>
          {event.status === 'active' ? 'In Corso' :
           event.status === 'lobby' ? 'Lobby Aperta' :
           event.status === 'completed' ? 'Completato' :
           'In Programma'}
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 line-clamp-2">
        {event.description}
      </p>

      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#151e18] px-2.5 py-1 rounded-md shadow-sm border border-slate-50 dark:border-[#24352b]">
          <Clock size={14} className={colorClass} />
          {dateStr || 'Data da definire'}
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#151e18] px-2.5 py-1 rounded-md shadow-sm border border-slate-50 dark:border-[#24352b]">
          <Users size={14} className={colorClass} />
          {joinedCount} Iscritti
        </div>
        {event.pointsMultiplier > 1 && (
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md shadow-sm border border-amber-100 dark:border-amber-900/30">
            x{event.pointsMultiplier} Punti
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        {canRSVP && !currentUserParticipant?.status ? (
           <div className="flex items-center gap-2">
             <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => user && setRSVP(event.id, user.uid, 'joined')}
                className="flex items-center gap-1.5 bg-[#2D5A27] hover:bg-[#23471f] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
             >
                <Check size={16} /> Partecipo
             </motion.button>
             <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => user && setRSVP(event.id, user.uid, 'declined')}
                className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#24352b] dark:hover:bg-[#2c4033] text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
             >
                <X size={16} /> Passo
             </motion.button>
           </div>
        ) : canRSVP && currentUserParticipant?.status === 'joined' ? (
           <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm font-bold text-[#2D5A27] dark:text-[#42a83a]">
                 <CheckCircle2 size={16} /> Iscritto
              </span>
              <button 
                 onClick={() => user && setRSVP(event.id, user.uid, 'declined')}
                 className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 ml-2"
              >
                 Cambia idea
              </button>
           </div>
        ) : canRSVP && currentUserParticipant?.status === 'declined' ? (
           <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Hai declinato l'invito.</span>
              <button 
                 onClick={() => user && setRSVP(event.id, user.uid, 'joined')}
                 className="text-xs text-[#2D5A27] dark:text-[#42a83a] font-bold hover:underline underline-offset-2 ml-2"
              >
                 Partecipa
              </button>
           </div>
        ) : isOrganizer ? (
           <span className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#2D5A27] dark:text-[#42a83a]" /> 
              Organizzatore
           </span>
        ) : <div/>}

        <button 
          onClick={() => navigate(event.status === 'completed' ? `/dashboard/giochi/${event.id}/results` : `/dashboard/giochi/${event.id}/lobby`)}
          className={`flex items-center justify-center px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
            event.status === 'active' || event.status === 'lobby' 
               ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25' 
               : 'bg-white hover:bg-slate-50 dark:bg-[#1a261f] dark:hover:bg-[#24352b] text-[#1a2e16] dark:text-slate-200 border border-slate-200 dark:border-[#2c4033]'
          }`}
        >
          {event.status === 'active' ? 'Entra in Gioco' :
           event.status === 'lobby' ? 'Vai alla Lobby' :
           event.status === 'completed' ? 'Vedi Risultati' :
           'Dettagli'}
        </button>
      </div>
    </div>
  );
}
