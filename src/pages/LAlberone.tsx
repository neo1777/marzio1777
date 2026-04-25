import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Send, TreeDeciduous, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export default function LAlberone() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const channelId = "alberone_principale";

  useEffect(() => {
    setDoc(doc(db, 'chats', channelId), { name: "L'Alberone", createdBy: "System", communityId: 'marzio', createdAt: serverTimestamp() }, { merge: true });

    const q = query(
      collection(db, `chats/${channelId}/messages`), 
      orderBy('timestamp', 'asc'), 
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m: any[] = [];
      snapshot.forEach(d => m.push({ id: d.id, ...d.data() }));
      setMessages(m);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, (err) => console.error("Chat fetch err:", err));
    return () => unsubscribe();
  }, [channelId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, `chats/${channelId}/messages`), {
        authorId: user.uid,
        authorName: user.displayName,
        text: newMessage.trim(),
        communityId: 'marzio',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch(e) { console.error(e); }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
       <header className="flex flex-col border-b border-slate-200 dark:border-[#24352b] pb-4 transition-colors">
         <h2 className="text-xs font-bold font-sans uppercase tracking-widest text-[#8C928D] mb-1">L'Albero del Paese</h2>
         <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a] tracking-tight">
            L'Alberone <TreeDeciduous size={28} className="text-[#8B5A2B]" />
         </div>
       </header>

       <div className="flex-1 bg-white dark:bg-[#151e18] rounded-2xl border border-slate-200 dark:border-[#24352b] flex flex-col overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20 transition-colors">
          <div className="bg-slate-50 dark:bg-[#1a261f] p-4 border-b border-slate-200 dark:border-[#24352b] flex items-center justify-between transition-colors">
             <div className="flex items-center gap-2">
                <Users size={18} className="text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-bold font-sans text-slate-700 dark:text-slate-300">Sulle panchine sotto l'albero</span>
             </div>
             <span className="flex items-center gap-2 text-xs text-[#2D5A27] dark:text-[#42a83a] font-bold font-sans"><div className="w-2 h-2 bg-[#2D5A27] dark:bg-[#42a83a] rounded-full animate-pulse"></div> IN DIRETTA</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-[#F8F9FA] dark:bg-[#0d1310] background-pattern transition-colors">
             {messages.length === 0 ? <div className="text-center mt-10"><p className="text-sm text-slate-400 font-sans italic">Nessuno si è ancora seduto sulla panchina. Sii il primo.</p></div> : null}
             {messages.map(msg => {
                const isMe = msg.authorId === user?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-[#8C928D] dark:text-slate-500 font-bold font-sans mb-1 px-1">{isMe ? 'TU' : (msg.authorName || 'ANONIMO').toUpperCase()}</span>
                    <div className={`px-4 py-2.5 text-sm rounded-2xl max-w-[80%] shadow-sm ${isMe ? 'bg-[#2D5A27] text-white rounded-tr-sm' : 'bg-white dark:bg-[#151e18] text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-[#24352b] rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                    {msg.timestamp && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans mt-1 px-1">{formatDistanceToNow(msg.timestamp.toDate(), { locale: it })} fa</span>}
                  </div>
                );
             })}
             <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-[#24352b] bg-white dark:bg-[#151e18] flex gap-3 transition-colors">
            <input 
              type="text" 
              className="flex-1 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans" 
              placeholder="Dì qualcosa alla compagnia..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
            />
            <button type="submit" disabled={!newMessage.trim()} className="bg-[#F5A623] text-white hover:bg-[#d6901e] w-12 rounded-xl flex items-center justify-center disabled:opacity-50 transition-all shadow-md">
               <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
            </button>
          </form>
       </div>
    </div>
  );
}
