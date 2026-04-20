import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, MapPin, Activity, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

export default function LaPiazza() {
  const { user } = useAuth();
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

  const filteredPosts = activeDecade === 'Tutti' ? posts : posts.filter(p => p.decade === activeDecade);

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
           <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-1">Feed Globale</h2>
           <div className="flex items-center gap-2 text-2xl font-bold text-slate-200 tracking-tight">
              La Piazza <Activity size={20} className="text-emerald-500" />
           </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['Tutti', 'Anni 70', 'Anni 80', 'Anni 90', 'Anni 00+'].map(dec => (
            <button key={dec} onClick={() => setActiveDecade(dec)} className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-mono transition-colors border ${activeDecade === dec ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(79,70,229,0.1)]' : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800/80 hover:text-slate-300'}`}>
              {dec}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl w-fit">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-xs font-mono text-slate-400">Caricamento Dataset...</span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 text-center">
             <p className="text-sm font-mono text-slate-500">Nessun record trovato per questa query.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map(post => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={post.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-lg shadow-black/20">
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-800/50 bg-slate-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden"><img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${post.authorId}`} alt="avatar" /></div>
                    <div>
                      <p className="font-semibold text-sm text-slate-200">{post.authorName || 'Nodo Anonimo'}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { locale: it, addSuffix: true }) : 'Elaborazione...'}</p>
                    </div>
                  </div>
                  {post.decade && <span className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase font-mono tracking-wider rounded">{post.decade}</span>}
                </div>
                
                {/* Image */}
                <div className="relative border-b border-slate-800/50 bg-black flex items-center justify-center">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="Memory Record" className="w-full max-h-[500px] object-cover opacity-90" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full aspect-[4/3] flex items-center justify-center bg-slate-900">
                      <span className="text-slate-600 font-mono text-xs">NESSUN DATO VISIVO</span>
                    </div>
                  )}
                </div>

                {/* Actions & Caption */}
                <div className="p-5">
                  <p className="text-slate-300 text-sm leading-relaxed mb-4"><span className="font-semibold text-slate-100 mr-2">{post.authorName || 'Anonimo'}</span>{post.caption}</p>
                  
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-800/50">
                    <button className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-400 transition-colors">
                      <Heart size={16} />
                      <span className="font-mono text-xs">{post.likesCount || 0}</span>
                    </button>
                    <button onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)} className={`flex items-center gap-1.5 transition-colors ${expandedPostId === post.id ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-400'}`}>
                      <MessageCircle size={16} />
                      <span className="font-mono text-xs uppercase">{post.commentsCount || 0} Log</span>
                    </button>
                    {post.location && (
                      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono uppercase px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
                        <MapPin size={12} /> Geo-Localizzato
                      </div>
                    )}
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

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    try {
      await addDoc(collection(db, `posts/${postId}/comments`), {
        authorId: user.uid,
        authorName: user.displayName,
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
      await updateDoc(doc(db, 'users', user.uid), { points: increment(2) });
      setText('');
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-4 mt-2 border-t border-slate-800/50 overflow-hidden">
       <div className="space-y-3 mb-4 max-h-40 overflow-y-auto scrollbar-hide">
         {comments.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono">Nessun log. Inserisci un commento.</p>
         ) : (
            comments.map(c => (
              <div key={c.id} className="bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-300">{c.authorName || 'Anonimo'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{c.timestamp ? formatDistanceToNow(c.timestamp.toDate(), { locale: it }) : ''} fa</span>
                </div>
                <p className="text-xs text-slate-400">{c.text}</p>
              </div>
            ))
         )}
       </div>
       <form onSubmit={handlePost} className="flex gap-2">
         <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi un ricordo..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-colors font-mono" />
         <button type="submit" disabled={!text.trim()} className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 border border-indigo-500/30 w-10 h-10 flex items-center justify-center rounded-lg transition-all disabled:opacity-50">
           <Send size={16} />
         </button>
       </form>
    </motion.div>
  );
}
