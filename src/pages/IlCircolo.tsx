import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Terminal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export default function IlCircolo() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const channelId = "piazzetta_principale";

  useEffect(() => {
    setDoc(doc(db, 'chats', channelId), { name: "La Piazzetta", createdBy: "System", createdAt: serverTimestamp() }, { merge: true });

    const q = query(collection(db, `chats/${channelId}/messages`), orderBy('timestamp', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m: any[] = [];
      snapshot.forEach(d => m.push({ id: d.id, ...d.data() }));
      setMessages(m);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
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
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch(e) { console.error(e); }
  };

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col gap-6">
       <header className="flex flex-col border-b border-slate-800 pb-4">
         <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-1">Nodo di Comunicazione</h2>
         <div className="flex items-center gap-2 text-2xl font-bold text-slate-200 tracking-tight">
            Il Circolo <Terminal size={20} className="text-indigo-400" />
         </div>
       </header>

       <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg shadow-black/20">
          <div className="bg-slate-900/80 p-3 border-b border-slate-800 flex items-center justify-between">
             <span className="text-xs font-mono text-indigo-400">CANALE: LA_PIAZZETTA</span>
             <span className="flex items-center gap-2 text-[10px] text-emerald-500 font-mono"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> IN DIRETTA</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
             {messages.length === 0 ? <p className="text-center text-slate-500 mt-10 text-xs font-mono">Nessun log presente. Avvia trasmissione.</p> : null}
             {messages.map(msg => {
                const isMe = msg.authorId === user?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 font-mono mb-1 px-1">{isMe ? 'TU' : (msg.authorName || 'ANONIMO').toUpperCase()}</span>
                    <div className={`px-4 py-2 text-sm rounded-lg max-w-[80%] border ${isMe ? 'bg-indigo-600/20 text-indigo-100 border-indigo-500/30 rounded-tr-none' : 'bg-slate-800/50 text-slate-300 border-slate-700/50 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                    {msg.timestamp && <span className="text-[10px] text-slate-600 font-mono mt-1 px-1">{formatDistanceToNow(msg.timestamp.toDate(), { locale: it })} fa</span>}
                  </div>
                );
             })}
             <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/80 flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-colors font-mono" 
              placeholder="Inserisci comando o messaggio..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
            />
            <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 hover:text-indigo-300 border border-indigo-500/30 w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 transition-all">
               <Send size={16} />
            </button>
          </form>
       </div>
    </div>
  );
}
