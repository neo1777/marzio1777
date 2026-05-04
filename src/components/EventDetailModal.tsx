import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Users, ShoppingBag, Wallet, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { doc, updateDoc, collection, query, onSnapshot, addDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useRBAC } from '../hooks/useRBAC';
import { Avatar } from './ui';

export default function EventDetailModal({ event, onClose, user }: { event: any, onClose: () => void, user: any }) {
  const { profile, isGuest } = useRBAC();
  const [activeTab, setActiveTab] = useState<'details' | 'shopping' | 'wallet'>('details');
  const [attendees, setAttendees] = useState<any>(event.attendees || {});
  
  // Ascolta l'evento in realtime
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'events', event.id), (docObj) => {
       if (docObj.exists()) {
          setAttendees(docObj.data().attendees || {});
       }
    });
    return () => unsub();
  }, [event.id]);

  const handleRSVP = async (status: 'yes' | 'no' | 'maybe') => {
     try {
       const newAttendees = { ...attendees };
       newAttendees[user.uid] = {
          status,
          name: user.displayName,
          photoURL: user.photoURL,
          guestCount: newAttendees[user.uid]?.guestCount || 0
       };
       await updateDoc(doc(db, 'events', event.id), { attendees: newAttendees });
     } catch (err) {
       console.error(err);
     }
  };

  const setGuestCount = async (count: number) => {
     try {
       const newAttendees = { ...attendees };
       if (!newAttendees[user.uid]) return;
       newAttendees[user.uid].guestCount = count;
       await updateDoc(doc(db, 'events', event.id), { attendees: newAttendees });
     } catch (err) {
       console.error(err);
     }
  };

  const myRsvp = attendees[user.uid]?.status;
  const totalPeople = Object.values(attendees).reduce((acc: number, curr: any) => acc + (curr.status === 'yes' ? 1 + (curr.guestCount || 0) : 0), 0) as number;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#1a2e16]/60 dark:bg-black/70 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-[#151e18] rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-[#24352b] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[85vh]">
        
        {/* Header Immagine/Titolo */}
        <div className="relative bg-[#2D5A27] dark:bg-[#1a261f] pt-12 pb-4 px-6 text-center text-white shrink-0">
           <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={18} /></button>
           <h2 className="text-2xl font-serif font-bold text-white mb-1 shadow-sm">{event.title}</h2>
           <p className="text-sm text-green-100 font-medium flex items-center justify-center gap-2">
              <Calendar size={14}/> {format(new Date(event.date), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
           </p>
        </div>

        {/* Tabs Nav */}
        <div className="flex border-b border-slate-200 dark:border-[#24352b] bg-slate-50 dark:bg-[#111814] shrink-0">
           <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'details' ? 'border-b-2 border-[#f56a23] text-[#f56a23]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Users size={16} /> Partecipanti
           </button>
           <button onClick={() => setActiveTab('shopping')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'shopping' ? 'border-b-2 border-[#f56a23] text-[#f56a23]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <ShoppingBag size={16} /> Spesa
           </button>
           <button onClick={() => setActiveTab('wallet')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'wallet' ? 'border-b-2 border-[#f56a23] text-[#f56a23]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Wallet size={16} /> Portafoglio
           </button>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-[#151e18]">
           {activeTab === 'details' && (
              <div className="space-y-6">
                 {/* Descrizione / Info */}
                 <div className="bg-slate-50 dark:bg-[#1a261f] rounded-xl p-4 border border-slate-100 dark:border-[#24352b]">
                    <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300 mb-3 font-sans text-sm">
                       <MapPin className="text-[#2D5A27] shrink-0 mt-0.5" size={16} /> 
                       <span className="font-semibold">{event.location}</span>
                    </div>
                    {event.description && <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap italic">"{event.description}"</p>}
                    <p className="text-xs text-slate-400 mt-2 text-right">Organizzato da: <b>{event.authorName}</b></p>
                 </div>

                 {/* Il Tuo RSVP */}
                 {!isGuest && (
                 <div>
                    <h3 className="font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-3 text-sm uppercase tracking-wider">La tua presenza</h3>
                    <div className="flex flex-wrap gap-2">
                       <button onClick={() => handleRSVP('yes')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${myRsvp === 'yes' ? 'bg-green-500 text-white border-green-600 shadow-md' : 'bg-white dark:bg-[#111814] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#24352b] hover:border-green-500 hover:text-green-600'}`}>Sì, ci sono!</button>
                       <button onClick={() => handleRSVP('maybe')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${myRsvp === 'maybe' ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white dark:bg-[#111814] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#24352b] hover:border-amber-500 hover:text-amber-600'}`}>In forse</button>
                       <button onClick={() => handleRSVP('no')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${myRsvp === 'no' ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-white dark:bg-[#111814] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#24352b] hover:border-red-500 hover:text-red-600'}`}>Non posso</button>
                    </div>
                    {myRsvp === 'yes' && (
                       <div className="mt-3 flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1a261f] border border-slate-200 dark:border-[#24352b] rounded-lg">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">+ Ospiti (esterni)?</span>
                          <div className="flex items-center gap-3 bg-white dark:bg-[#111814] rounded-md border border-slate-200 dark:border-[#24352b] p-1">
                             <button onClick={() => setGuestCount(Math.max(0, (attendees[user.uid]?.guestCount || 0) - 1))} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500">-</button>
                             <span className="w-4 text-center font-bold text-sm">{attendees[user.uid]?.guestCount || 0}</span>
                             <button onClick={() => setGuestCount((attendees[user.uid]?.guestCount || 0) + 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500">+</button>
                          </div>
                       </div>
                    )}
                 </div>
                 )}

                 {/* Lista Partecipanti */}
                 <div>
                    <h3 className="font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-3 text-sm uppercase tracking-wider flex items-center justify-between">
                       <span>Confermati</span>
                       <span className="bg-[#f56a23] text-white px-2 py-0.5 rounded-full text-xs">{totalPeople} totali</span>
                    </h3>
                    <div className="space-y-2">
                       {Object.entries(attendees).filter(([_, a]: any) => a.status === 'yes').length === 0 && <p className="text-sm text-slate-400 italic">Ancora nessuna conferma.</p>}
                       {Object.entries(attendees).filter(([_, a]: any) => a.status === 'yes').map(([uid, a]: any) => (
                          <div key={uid} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#24352b] last:border-0">
                             <div className="flex items-center gap-2">
                                <Avatar photoURL={a.photoURL} name={a.name} size="sm" className="border border-slate-200 dark:border-[#24352b]" />
                                <span className="font-medium text-sm text-[#1a2e16] dark:text-[#e2e8f0]">{a.name}</span>
                             </div>
                             {a.guestCount > 0 && <span className="text-xs bg-slate-100 dark:bg-[#24352b] text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full font-bold">+{a.guestCount} compagni</span>}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'shopping' && <ShoppingList eventId={event.id} user={user} />}
           {activeTab === 'wallet' && <WalletSection eventId={event.id} user={user} attendees={attendees} />}

        </div>
      </motion.div>
    </div>
  );
}

// ------ SOTTO COMPONENTI ------

function ShoppingList({ eventId, user }: { eventId: string, user: any }) {
   const { profile, isGuest } = useRBAC();
   const [items, setItems] = useState<any[]>([]);
   const [newItem, setNewItem] = useState('');

   useEffect(() => {
      const q = query(collection(db, `events/${eventId}/items`));
      const unsub = onSnapshot(q, snap => {
         const arr: any[] = [];
         snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
         setItems(arr);
      });
      return () => unsub();
   }, [eventId]);

   const addItem = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newItem.trim()) return;
      try {
         await addDoc(collection(db, `events/${eventId}/items`), {
            name: newItem.trim(),
            assignedTo: null,
            assignedName: null,
            addedBy: user.uid,
            timestamp: serverTimestamp()
         });
         setNewItem('');
      } catch (err: any) {
         console.error(err);
         alert(`Aggiunta non riuscita: ${err?.message || 'errore di rete'}`);
      }
   };

   const toggleAssign = async (item: any) => {
      try {
         const isMine = item.assignedTo === user.uid;
         await updateDoc(doc(db, `events/${eventId}/items`, item.id), {
            assignedTo: isMine ? null : user.uid,
            assignedName: isMine ? null : user.displayName
         });
      } catch (err: any) {
         console.error(err);
         alert(`Aggiornamento non riuscito: ${err?.message || 'errore di rete'}`);
      }
   };

   const deleteItem = async (id: string) => {
      await deleteDoc(doc(db, `events/${eventId}/items`, id));
   };

   return (
      <div className="flex flex-col h-full space-y-4">
         {!isGuest && (
         <form onSubmit={addItem} className="flex gap-2">
            <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Es. 2kg di Costine, Birre, Carbone..." className="flex-1 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#f56a23]" />
            <button type="submit" disabled={!newItem.trim()} className="bg-[#2D5A27] text-white px-4 rounded-xl disabled:opacity-50"><Plus size={20}/></button>
         </form>
         )}

         <div className="space-y-2">
            {items.length === 0 && <p className="text-slate-400 text-center py-6 text-sm">Cosa manca? Aggiungi qualcosa alla lista!</p>}
            <AnimatePresence>
            {items.map(item => (
               <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1a261f] border border-slate-100 dark:border-[#24352b] rounded-xl"
               >
                  <div className="flex items-center gap-3">
                     <motion.button 
                        onClick={() => toggleAssign(item)} 
                        disabled={isGuest}
                        className={`${item.assignedTo ? 'text-[#2D5A27] dark:text-[#42a83a]' : 'text-slate-300 dark:text-slate-600'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative`}
                     >
                        {item.assignedTo ? (
                           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>
                              <CheckCircle2 size={24} />
                           </motion.div>
                        ) : (
                           <Circle size={24} />
                        )}
                     </motion.button>
                     <motion.div 
                        animate={{ opacity: item.assignedTo ? 0.6 : 1 }}
                        className={item.assignedTo ? 'line-through text-sm font-medium' : 'text-sm font-medium text-slate-700 dark:text-slate-200'}
                     >
                        {item.name}
                     </motion.div>
                  </div>
                  <div className="flex items-center gap-3">
                     <AnimatePresence>
                     {item.assignedTo && (
                        <motion.span 
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0 }}
                           className="text-[10px] font-bold uppercase bg-white dark:bg-black px-2 py-1 rounded text-[#2D5A27] shadow-sm"
                        >
                           {item.assignedName} lo porta!
                        </motion.span>
                     )}
                     </AnimatePresence>
                     {item.addedBy === user.uid && !item.assignedTo && (
                        <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                     )}
                  </div>
               </motion.div>
            ))}
            </AnimatePresence>
         </div>
      </div>
   );
}

function WalletSection({ eventId, user, attendees }: { eventId: string, user: any, attendees: any }) {
   const { profile, isGuest } = useRBAC();
   const [expenses, setExpenses] = useState<any[]>([]);
   const [desc, setDesc] = useState('');
   const [amount, setAmount] = useState('');

   useEffect(() => {
      const q = query(collection(db, `events/${eventId}/expenses`));
      const unsub = onSnapshot(q, snap => {
         const arr: any[] = [];
         snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
         setExpenses(arr);
      });
      return () => unsub();
   }, [eventId]);

   const addExpense = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(amount.replace(',', '.'));
      if (!desc.trim() || isNaN(val) || val <= 0) return;
      try {
         await addDoc(collection(db, `events/${eventId}/expenses`), {
            description: desc.trim(),
            amount: val,
            paidBy: user.uid,
            paidByName: user.displayName,
            timestamp: serverTimestamp()
         });
         setDesc('');
         setAmount('');
      } catch (err: any) {
         console.error(err);
         alert(`Spesa non registrata: ${err?.message || 'errore di rete'}`);
      }
   };

   // Calc logic: Total / valid attendees
   const totalCassa = expenses.reduce((acc, curr) => acc + (curr.amount as number), 0);
   const sharingPeople = Object.values(attendees).reduce((acc: number, curr: any) => acc + (curr.status === 'yes' ? 1 + (curr.guestCount || 0) : 0), 0) as number;
   const costPerHead = sharingPeople > 0 ? (totalCassa / sharingPeople) : 0;
   
   // My payments
   const myPayments = expenses.filter(e => e.paidBy === user.uid).reduce((acc, curr) => acc + curr.amount, 0);
   // My share (me + guests)
   const myHeads = attendees[user.uid]?.status === 'yes' ? 1 + (attendees[user.uid]?.guestCount || 0) : 0;
   const myShare = myHeads * costPerHead;
   const balance = myPayments - myShare;

   return (
      <div className="flex flex-col h-full space-y-5">
         
         <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-[#2D5A27]/10 border border-[#2D5A27]/20 rounded-xl p-4 text-center">
               <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Cassa Totale</p>
               <p className="text-2xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a]">€ {totalCassa.toFixed(2)}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
               <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Quota a Testa</p>
               <p className="text-2xl font-serif font-bold text-amber-600">€ {costPerHead.toFixed(2)}</p>
            </div>
         </div>

         {myHeads > 0 && (
            <div className={`p-4 rounded-xl border ${balance >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'} flex justify-between items-center`}>
               <div>
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">Il tuo bilancio</h4>
                  <p className="text-xs text-slate-500">Pagato: €{myPayments.toFixed(2)} | Quota (x{myHeads}): €{myShare.toFixed(2)}</p>
               </div>
               <div className={`text-xl font-bold font-mono ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
               </div>
            </div>
         )}
         
         {!isGuest && (
         <form onSubmit={addExpense} className="flex gap-2">
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Cosa hai comprato?" className="flex-[2] bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none" />
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00 €" className="flex-1 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none font-mono" />
            <button type="submit" disabled={!desc.trim() || !amount} className="bg-amber-500 text-white px-4 rounded-xl shadow-md"><Plus size={20}/></button>
         </form>
         )}

         <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            <AnimatePresence>
            {expenses.map(exp => (
               <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={exp.id} 
                  className="flex justify-between items-center p-3 border-b border-slate-100 dark:border-[#24352b]"
               >
                  <div>
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{exp.description}</p>
                     <p className="text-[10px] text-slate-500 font-medium">Anticipato da {exp.paidByName}</p>
                  </div>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
                     € {exp.amount.toFixed(2)}
                  </div>
               </motion.div>
            ))}
            </AnimatePresence>
         </div>

      </div>
   );
}
