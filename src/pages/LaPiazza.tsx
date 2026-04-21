import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, MapPin, Send, Leaf } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import confetti from 'canvas-confetti';

import { useNavigate } from 'react-router-dom';

export default function LaPiazza() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDecade, setActiveDecade] = useState('Tutti');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p: any[] = [];
      snapshot.forEach(doc => p.push({ id: doc.id, ...doc.data() }));
      setPosts(p);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLike = async (postId: string) => {
    // Custom Snow/Leaf Confetti explosion on Like
    const duration = 2000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#F5A623', '#2D5A27', '#ffffff'] // Oro scoiattolo, Verde, Neve
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#F5A623', '#2D5A27', '#ffffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());

    try {
      await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
    } catch(err) {
      console.error(err);
    }
  };

  const isVisible = (post: any) => {
    if (!user) return false;
    if (post.authorId === user.uid) return true; // I can see my own
    if (post.visibilityStatus === 'public') return true;
    if (post.visibilityStatus === 'scheduled' && post.visibilityTime && post.visibilityTime <= Date.now()) return true;
    
    // Legacy posts without visibilityStatus are public
    if (!post.visibilityStatus) return true;

    return false;
  };

  const visiblePosts = posts.filter(isVisible);
  const filteredPosts = activeDecade === 'Tutti' ? visiblePosts : visiblePosts.filter(p => p.decade === activeDecade);

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-[#24352b] pb-4 gap-4 transition-colors">
        <div>
           <h2 className="text-xs font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Bacheca Comunale</h2>
           <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a] tracking-tight">
              La Piazza <Leaf size={24} className="text-[#F5A623]" />
           </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['Tutti', 'Anni 70', 'Anni 80', 'Anni 90', 'Anni 00+'].map(dec => (
            <button key={dec} onClick={() => setActiveDecade(dec)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold font-sans transition-all ${activeDecade === dec ? 'bg-[#F5A623] text-white shadow-md' : 'bg-white dark:bg-[#151e18] text-[#8C928D] dark:text-slate-400 border border-slate-200 dark:border-[#24352b] hover:border-[#F5A623] hover:text-[#F5A623]'}`}>
              {dec}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center gap-3 p-6 bg-white dark:bg-[#151e18] border border-slate-200 dark:border-[#24352b] rounded-2xl w-fit shadow-sm transition-colors">
            <div className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse"></div>
            <span className="text-sm font-sans font-medium text-slate-500 dark:text-slate-400">Ricerca negli archivi...</span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 bg-white/50 dark:bg-[#151e18]/50 rounded-2xl border border-slate-200 dark:border-[#24352b] text-center transition-colors">
             <p className="text-sm font-sans text-slate-500 dark:text-slate-400">Nessuna fotografia in questo decennio.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredPosts.map(post => (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} key={post.id} className="polaroid-frame max-w-xl mx-auto rounded-xl transition-colors">
                
                {post.type === 'event' ? (
                   <div className="p-8 bg-gradient-to-br from-[#f56a23]/10 to-[#f56a23]/5 dark:from-[#f56a23]/20 dark:to-[#f56a23]/5 border-b border-slate-200 dark:border-[#24352b] text-center rounded-t-sm flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-[#f56a23]/20 text-[#f56a23] rounded-full flex items-center justify-center mb-4">
                         <MapPin size={28} />
                      </div>
                      <h4 className="text-xl font-serif font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-2">{post.title}</h4>
                      <p className="text-sm font-sans text-slate-600 dark:text-slate-300 font-medium">Appuntamento a: {post.location}</p>
                      <button className="mt-6 border border-[#f56a23] text-[#f56a23] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#f56a23] hover:text-white transition-colors" onClick={() => navigate('/dashboard/bivacco')}>
                         Vai a Il Bivacco
                      </button>
                   </div>
                ) : (
                   <div className="relative bg-slate-100 dark:bg-[#080d0a] flex items-center justify-center border border-slate-200 dark:border-[#24352b] overflow-hidden rounded-sm" style={{ minHeight: '300px' }}>
                     {post.imageUrl ? (
                       <img src={post.imageUrl} alt="Memory Record" className="w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                     ) : (
                       <div className="w-full aspect-[4/3] flex items-center justify-center bg-slate-50 dark:bg-[#111814]">
                         <span className="text-slate-400 dark:text-slate-500 font-sans font-medium text-sm">Foto non disponibile</span>
                       </div>
                     )}
                   </div>
                )}

                {/* Caption & Meta directly under the photo like a polaroid */}
                <div className="pt-6 px-2">
                  {post.type !== 'event' && (
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-xl font-bold text-[#1a2e16] dark:text-[#e2e8f0]">{post.decade}</h3>
                      <div className="flex items-center gap-2">
                        {post.location && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#2D5A27] dark:text-[#42a83a] font-sans font-bold uppercase px-2 py-1 bg-[#2D5A27]/5 dark:bg-[#42a83a]/10 rounded border border-[#2D5A27]/20 dark:border-[#42a83a]/30">
                            <MapPin size={12} /> Marzio
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!post.type || post.type === 'photo' ? (
                     <p className="text-slate-700 dark:text-slate-300 text-base leading-relaxed mb-6 font-serif italic">"{post.caption}"</p>
                  ) : (
                     <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-6 font-sans italic">Un nuovo appuntamento è stato organizzato. Entra ne Il Bivacco per segnare cosa porterai e dare la tua conferma di partecipazione!</p>
                  )}
                  
                  {/* Author Row */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-[#24352b]">
                    <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${post.authorId}`} alt="avatar" className="w-8 h-8 rounded-full border border-slate-200 dark:border-[#24352b] bg-slate-50 dark:bg-[#111814]" />
                    <div>
                      <p className="font-bold text-sm text-[#1a2e16] dark:text-[#e2e8f0] font-sans">{post.authorName || 'Villeggiante Anonimo'}</p>
                      <p className="text-xs text-[#8C928D] dark:text-slate-500 font-sans">{post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { locale: it, addSuffix: true }) : 'In caricamento...'}</p>
                    </div>
                    
                    <div className="ml-auto flex gap-3">
                       <button onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-colors ${expandedPostId === post.id ? 'bg-[#4A90E2]/10 text-[#4A90E2]' : 'bg-slate-50 dark:bg-[#1a261f] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#24352b]'}`}>
                         <MessageCircle size={16} />
                         {post.commentsCount || 0}
                       </button>

                       {/* Button held for interaction */}
                       <button 
                         onClick={() => handleLike(post.id)} 
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                       >
                         <Heart size={16} />
                         {post.likesCount || 0}
                       </button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                     {expandedPostId === post.id && (
                        <CommentsSection postId={post.id} user={user} />
                     )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentsSection({ postId, user }: { postId: string, user: any }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const c: any[] = [];
      snapshot.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
      setComments(c);
    });
    return () => unsubscribe();
  }, [postId]);

  const { profile } = useAuth();

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || profile?.role === 'Guest') return;
    try {
      await addDoc(collection(db, `posts/${postId}/comments`), {
        authorId: user.uid,
        authorName: user.displayName,
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
      
      // +2 Punti Altitudine for commenting
      await updateDoc(doc(db, 'users', user.uid), { points: increment(2) });
      
      setText('');
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-6 mt-4 border-t border-slate-100 dark:border-[#24352b] overflow-hidden">
       <div className="space-y-4 mb-4 max-h-40 overflow-y-auto scrollbar-hide">
         {comments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-sans italic">Nessuno ha ancora condiviso un ricordo. Sii il primo.</p>
         ) : (
            comments.map(c => (
              <div key={c.id} className="bg-slate-50 dark:bg-[#1a261f] p-3 rounded-xl border border-slate-100 dark:border-[#24352b]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-[#2D5A27] dark:text-[#42a83a]">{c.authorName || 'Anonimo'}</span>
                  <span className="text-[10px] text-[#8C928D] dark:text-slate-500 font-sans">{c.timestamp ? formatDistanceToNow(c.timestamp.toDate(), { locale: it }) : ''} fa</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-sans">{c.text}</p>
              </div>
            ))
         )}
       </div>
       <form onSubmit={handlePost} className="flex gap-2">
         <input type="text" value={text} onChange={e => setText(e.target.value)} disabled={profile?.role === 'Guest'} placeholder={profile?.role === 'Guest' ? "I Guest non possono commentare" : "Condividi un aneddoto..."} className="flex-1 bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] text-slate-800 dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all shadow-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-[#0d1310]" />
         <button type="submit" disabled={!text.trim() || profile?.role === 'Guest'} className="bg-[#4A90E2] text-white hover:bg-blue-600 w-11 h-11 flex items-center justify-center rounded-xl shadow-md transition-all disabled:opacity-50">
           <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
         </button>
       </form>
    </motion.div>
  );
}
