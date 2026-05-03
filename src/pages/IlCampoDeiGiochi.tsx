import React, { useState } from 'react';
import { Trophy, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEvents } from '../hooks/useGameEvents';
import GameEventCard from '../components/GameEventCard';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function IlCampoDeiGiochi() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const { events, loading } = useGameEvents(activeTab);
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const canOrganize = profile?.role === 'Admin' || profile?.role === 'Root';

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0 flex-col sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#2D5A27] dark:bg-[#1a261f] rounded-2xl flex items-center justify-center text-white dark:text-[#42a83a] shadow-lg shadow-[#2D5A27]/20 border border-[#42a83a]/20">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#1a2e16] dark:text-[#e2e8f0] leading-tight">Il Campo dei Giochi</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Dove i marziesi si sfidano a colpi di gagliardetti</p>
          </div>
        </div>
        
        {canOrganize && (
           <button onClick={() => navigate('/dashboard/giochi/nuovo')} className="flex items-center gap-2 bg-[#1a2e16] dark:bg-slate-800 hover:bg-[#2D5A27] dark:hover:bg-[#42a83a] text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-md">
              <Compass size={16} /> Nuovo Evento
           </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6 p-1 bg-slate-100/50 dark:bg-[#151e18] rounded-xl self-start">
         <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'upcoming' ? 'bg-white dark:bg-[#24352b] text-[#2D5A27] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
         >
            In Programma / Attivi
         </button>
         <button 
            onClick={() => setActiveTab('past')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'past' ? 'bg-white dark:bg-[#24352b] text-[#2D5A27] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
         >
            Archivio Partite
         </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0 scrollbar-hide">
         {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <Trophy size={32} className="animate-pulse mb-3 opacity-50" />
               <p className="text-sm font-bold uppercase tracking-widest">Caricamento...</p>
            </div>
         ) : events.length === 0 ? (
            <div className="bg-white dark:bg-[#151e18] p-12 rounded-2xl border border-slate-100 dark:border-[#24352b] text-center shadow-sm">
               <Compass size={48} className="mx-auto text-slate-200 dark:text-slate-600 mb-4" />
               <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {activeTab === 'upcoming' ? 'Nessun gioco in vista' : 'Nessuna partita in archivio'}
               </h2>
               <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">
                  {activeTab === 'upcoming' ? "Gli organizzatori stanno probabilmente architettando qualcosa. Torna più tardi o proponi un gioco in Piazza." : "Non ci sono ancora risultati storici."}
               </p>
            </div>
         ) : (
            <div className="grid gap-4 md:grid-cols-2">
               <AnimatePresence>
                  {events.map((event, i) => (
                     <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                     >
                        <GameEventCard event={event as any} />
                     </motion.div>
                  ))}
               </AnimatePresence>
            </div>
         )}
      </div>
    </div>
  );
}
