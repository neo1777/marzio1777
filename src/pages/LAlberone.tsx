import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Send, TreeDeciduous, Users, Smile, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const MOTION_DURATION = { instant: 0.1, short: 0.18, medium: 0.26, long: 0.36 };
const MOTION_EASING = { out: [0.0, 0.0, 0.2, 1] as any, inOut: [0.4, 0.0, 0.2, 1] as any };
import { it } from 'date-fns/locale';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export default function LAlberone() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const channelId = "alberone_principale";

  // Handle click outside emoji picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Seleziona un'immagine (JPG, PNG, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("L'immagine è troppo grande (max 5MB)");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    
    // reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setNewMessage(prevInput => prevInput + emojiObject.emoji);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    try {
      await addDoc(collection(db, `chats/${channelId}/messages`), {
        authorId: user.uid,
        authorName: user.displayName,
        text: newMessage.trim(),
        imageUrl: selectedImage,
        communityId: 'marzio',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
      setSelectedImage(null);
      setShowEmojiPicker(false);
    } catch(e: any) {
      console.error(e);
      alert(`Messaggio non inviato: ${e?.message || 'errore di rete'}`);
    }
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

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-[#F8F9FA] dark:bg-[#0d1310] background-pattern transition-colors relative">
             {messages.length === 0 ? <div className="text-center mt-10"><p className="text-sm text-slate-400 font-sans italic">Nessuno si è ancora seduto sulla panchina. Sii il primo.</p></div> : null}
             <AnimatePresence initial={false}>
             {messages.map(msg => {
                const isMe = msg.authorId === user?.uid;
                return (
                  <motion.div 
                     key={msg.id} 
                     initial={{ opacity: 0, y: 16 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: MOTION_DURATION.short, ease: MOTION_EASING.out }}
                     className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-[#8C928D] dark:text-slate-500 font-bold font-sans mb-1 px-1">{isMe ? 'TU' : (msg.authorName || 'ANONIMO').toUpperCase()}</span>
                    <div className={`px-4 py-2.5 text-sm rounded-2xl max-w-[80%] shadow-sm flex flex-col gap-2 ${isMe ? 'bg-[#2D5A27] text-white rounded-tr-sm' : 'bg-white dark:bg-[#151e18] text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-[#24352b] rounded-tl-sm'}`}>
                      {msg.imageUrl && (
                        <img 
                           src={msg.imageUrl} 
                           alt="allegato" 
                           className="max-w-[200px] sm:max-w-xs rounded-xl shadow-sm border border-black/10 dark:border-white/10"
                        />
                      )}
                      {msg.text && <span>{msg.text}</span>}
                    </div>
                    {msg.timestamp && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans mt-1 px-1">{formatDistanceToNow(msg.timestamp.toDate(), { locale: it })} fa</span>}
                  </motion.div>
                );
             })}
             </AnimatePresence>
             <div ref={bottomRef} />
          </div>

          {selectedImage && (
             <div className="px-4 py-2 bg-slate-100 dark:bg-[#1a261f] border-t border-slate-200 dark:border-[#24352b] flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                   <img src={selectedImage} alt="preview" className="w-10 h-10 object-cover rounded-md border border-slate-300 dark:border-[#24352b]" />
                   <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Immagine allegata</span>
                </div>
                <button onClick={() => setSelectedImage(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-[#2c4033] rounded-full text-slate-500 transition-colors">
                   <X size={16} />
                </button>
             </div>
          )}

          <form onSubmit={handleSend} className="p-2 sm:p-4 border-t border-slate-200 dark:border-[#24352b] bg-white dark:bg-[#151e18] flex gap-2 transition-colors relative items-end">
             <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
             
             <div className="flex items-center pb-[2px]">
                <div className="relative" ref={emojiPickerRef}>
                   <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                      className="p-2 sm:p-3 text-slate-400 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-[#1a261f] rounded-xl transition-colors"
                   >
                      <Smile size={20} />
                   </button>
                   {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-4 z-50">
                         <EmojiPicker 
                            onEmojiClick={onEmojiClick} 
                            theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT} 
                            lazyLoadEmojis={true}
                         />
                      </div>
                   )}
                </div>
                
                <button 
                   type="button" 
                   onClick={() => fileInputRef.current?.click()} 
                   disabled={isUploading}
                   className="p-2 sm:p-3 text-slate-400 hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-[#1a261f] rounded-xl transition-colors disabled:opacity-50"
                >
                   <ImageIcon size={20} />
                </button>
             </div>

             <div className="flex-1 flex flex-col">
               <textarea 
                 rows={1}
                 className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans min-w-0 resize-none overflow-hidden" 
                 placeholder="Dì qualcosa alla compagnia..."
                 value={newMessage}
                 onChange={e => {
                    setNewMessage(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                 }}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSend(e as any);
                    }
                 }}
               />
             </div>
             
             <motion.button 
                type="submit" 
                whileTap={{ scale: 0.95 }}
                disabled={(!newMessage.trim() && !selectedImage) || isUploading} 
                className="bg-[#F5A623] text-white hover:bg-[#d6901e] px-4 py-3 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors shadow-md shrink-0 h-[46px]"
             >
                <Send size={18} className="translate-x-[-1px] translate-y-[1px] sm:translate-none sm:mr-1" /> <span className="hidden sm:inline font-bold text-sm">Invia</span>
             </motion.button>
          </form>
       </div>
    </div>
  );
}
