import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, Plus, ShoppingBag, Wallet, Clock, ChevronRight, Check, X, HelpCircle, Flame } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { useRBAC } from '../hooks/useRBAC';
import EventDetailModal from '../components/EventDetailModal';

export default function IlBivacco() {
  const { user, profile, isGuest, isPending } = useRBAC();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    if (isPending || isGuest) {
        setEvents([]);
        setLoading(false);
        return;
    }
    // Ordiniamo per data evento (stringa yyyy-mm-dd o timestamp) decrescente o crescente
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const e: any[] = [];
      snapshot.forEach(doc => e.push({ id: doc.id, ...doc.data() }));
      setEvents(e);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const upcomingEvents = events.filter(e => {
     if (!e.date) return false;
     const evtDate = new Date(e.date);
     const today = new Date();
     today.setHours(0,0,0,0);
     return evtDate >= today;
  });
  
  const pastEvents = events.filter(e => {
     if (!e.date) return false;
     const evtDate = new Date(e.date);
     const today = new Date();
     today.setHours(0,0,0,0);
     return evtDate < today;
  }).reverse();

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-[#24352b] pb-4 gap-4">
        <div>
           <h2 className="text-xs font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Ritrovi e Grigliate</h2>
           <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#f56a23] dark:text-[#f56a23] tracking-tight">
              Il Bivacco <Flame size={24} className="text-[#F5A623]" />
           </div>
        </div>
        {!isGuest && (
          <button 
             onClick={() => setShowCreateModal(true)}
             className="flex items-center gap-2 bg-[#f56a23] hover:bg-[#e05612] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-[#f56a23]/20 transition-all text-sm"
          >
             <Plus size={18} />
             Nuovo Appuntamento
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-8 space-y-10 scrollbar-hide">
        {loading ? (
           <div className="flex items-center gap-3 w-fit">
              <div className="w-2 h-2 rounded-full bg-[#f56a23] animate-pulse"></div>
              <span className="text-sm font-sans font-medium text-slate-500">Organizzando la legna...</span>
           </div>
        ) : (
          <>
            <section>
              <h3 className="text-lg font-bold font-serif mb-4 flex items-center gap-2 text-[#1a2e16] dark:text-[#e2e8f0]">
                 <Calendar className="text-[#f56a23]" size={20} /> Prossimi Appuntamenti
              </h3>
              {upcomingEvents.length === 0 ? (
                 <div className="p-8 bg-white/50 dark:bg-[#151e18]/50 rounded-2xl border border-dashed border-slate-300 dark:border-[#24352b] text-center">
                    <p className="text-sm font-sans text-slate-500 dark:text-slate-400">Nessun evento in programma. Rompi il ghiaccio!</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingEvents.map(evt => (
                       <EventCard key={evt.id} evt={evt} onClick={() => setSelectedEvent(evt)} user={user} />
                    ))}
                 </div>
              )}
            </section>

            {pastEvents.length > 0 && (
               <section className="opacity-70 grayscale-[30%]">
                 <h3 className="text-lg font-bold font-serif mb-4 flex items-center gap-2 text-[#1a2e16] dark:text-[#e2e8f0]">
                    <Clock className="text-slate-400" size={20} /> Eventi Passati
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastEvents.map(evt => (
                       <EventCard key={evt.id} evt={evt} onClick={() => setSelectedEvent(evt)} user={user} />
                    ))}
                 </div>
               </section>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && <CreateEventModal onClose={() => setShowCreateModal(false)} user={user} />}
        {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} user={user} />}
      </AnimatePresence>
    </div>
  );
}

const EventCard: React.FC<{ evt: any, onClick: () => void, user: any }> = ({ evt, onClick, user }) => {
  const dateObj = new Date(evt.date);
  const day = format(dateObj, 'dd');
  const month = format(dateObj, 'MMM', { locale: it }).toUpperCase();
  
  const attendeesCount = evt.attendees ? Object.values(evt.attendees).filter((a:any) => a.status === 'yes').length : 0;
  const myStatus = evt.attendees?.[user?.uid]?.status;

  return (
    <motion.div 
       initial={{ opacity: 0, y: 16 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, scale: 0.9 }}
       transition={{ duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
       whileHover={{ scale: 1.02 }}
       whileTap={{ scale: 0.98 }}
       onClick={onClick}
       className="bg-white dark:bg-[#1a261f] p-4 rounded-2xl border border-slate-200 dark:border-[#24352b] shadow-sm cursor-pointer flex gap-4 overflow-hidden relative group"
    >
       <div className="absolute top-0 right-0 w-24 h-24 bg-[#f56a23]/5 dark:bg-[#f56a23]/10 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-110"></div>
       
       <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl min-w-[70px] h-[70px] z-10">
          <span className="text-xs font-bold text-[#f56a23] mb-[-4px]">{month}</span>
          <span className="text-2xl font-black text-[#1a2e16] dark:text-[#e2e8f0] font-serif">{day}</span>
       </div>
       
       <div className="flex-1 z-10 min-w-0">
          <h4 className="font-bold text-[#1a2e16] dark:text-[#e2e8f0] text-base truncate mb-1">{evt.title}</h4>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">
             <MapPin size={12} />
             <span className="truncate">{evt.location}</span>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Users size={12} className="text-[#4A90E2]" />
                {attendeesCount} parteciperanno
             </div>
             {myStatus && (
                <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${myStatus === 'yes' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:border-green-800' : myStatus === 'no' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800' : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
                   {myStatus === 'yes' ? 'Ci sei' : myStatus === 'no' ? 'Assente' : 'In forse'}
                </div>
             )}
          </div>
       </div>
       
       <div className="flex items-center justify-center text-slate-300 group-hover:text-[#f56a23] transition-colors z-10">
          <ChevronRight size={20} />
       </div>
    </motion.div>
  );
}

function CreateEventModal({ onClose, user }: { onClose: () => void, user: any }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !user) return;
    setLoading(true);

    try {
      const eventDateTime = new Date(`${date}T${time || '12:00'}`).toISOString();
      await addDoc(collection(db, 'events'), {
        title,
        date: eventDateTime,
        location: location || 'Marzio (Spazio da definire)',
        description,
        authorId: user.uid,
        authorName: user.displayName,
        timestamp: serverTimestamp(),
        attendees: {
           [user.uid]: {
              status: 'yes',
              name: user.displayName,
              photoURL: user.photoURL,
              guestCount: 0
           }
        }
      });
      // Aggiungiamo anche il log nella piazza per unificazione!
      await addDoc(collection(db, 'posts'), {
        type: 'event',
        title,
        date: eventDateTime,
        location: location || 'Marzio',
        authorId: user.uid,
        authorName: user.displayName,
        timestamp: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0
      });

      // Premiamo chi crea un evento
      await updateDoc(doc(db, 'users', user.uid), { 
         points: (user.points || 0) + 5 
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a2e16]/40 dark:bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-[#151e18] rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-[#24352b] overflow-hidden flex flex-col max-h-[90vh]">
         <div className="p-4 border-b border-slate-100 dark:border-[#24352b] flex justify-between items-center bg-slate-50 dark:bg-[#1a261f]">
            <h3 className="font-serif font-bold text-lg text-[#1a2e16] dark:text-[#e2e8f0]">Organizza Appuntamento</h3>
            <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={20}/></button>
         </div>
         
         <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Titolo</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Grigliata di Ferragosto" className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23] focus:ring-1 focus:ring-[#f56a23] transition-all" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Data</label>
                 <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23] transition-all" />
               </div>
               <div>
                 <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Ora</label>
                 <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23] transition-all" />
               </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Luogo</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Es. Alberone, Il prato grande..." className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23] transition-all" />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Dettagli</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Scrivi un messaggio per invitare tutti..." className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23] transition-all resize-none"></textarea>
            </div>
            
            <button disabled={loading} type="submit" className="w-full py-3.5 bg-[#f56a23] text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-[#f56a23]/30 hover:bg-[#e05612] transition-colors mt-2 disabled:opacity-50">
               {loading ? 'Preparazione...' : 'Accendi il Fuoco'}
            </button>
         </form>
      </motion.div>
    </div>
  );
}
