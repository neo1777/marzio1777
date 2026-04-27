import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, or, and, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Maximize, Minimize, ChevronLeft, ChevronRight, ChevronDown, Eye, Film, Filter, User, HelpCircle, Heart } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import EventDetailModal from '../components/EventDetailModal';

const MOTION_DURATION = { instant: 0.1, short: 0.18, medium: 0.26, long: 0.36 };
const MOTION_EASING = { out: [0.0, 0.0, 0.2, 1] as any, inOut: [0.4, 0.0, 0.2, 1] as any };

export default function IlCinematografo() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedAuthor, setSelectedAuthor] = useState<string>('Tutti');
  const [selectedDecade, setSelectedDecade] = useState<string>('Tutti');
  
  // Presentation States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gamification Modes
  const [mode, setMode] = useState<'normale' | 'indovina_chi' | 'indovina_anno' | 'solo_immagini'>('normale');
  const [revealed, setRevealed] = useState(false);
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [guessResult, setGuessResult] = useState<'none' | 'correct' | 'incorrect'>('none');
  const [likedAnimId, setLikedAnimId] = useState<string | null>(null);

  const animIcon = profile?.animIcon || '❄️';
  const animSpeed = profile?.animSpeed || 0.5;
  const animDistance = profile?.animDistance || -40;
  const animColor = profile?.animColor || 'red';

  const getColorTheme = (name: string) => {
     switch(name) {
       case 'blue': return ['rgba(59,130,246,0.4)', 'rgba(59,130,246,0.6)', 'rgba(59,130,246,0.2)'];
       case 'emerald': return ['rgba(16,185,129,0.4)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.2)'];
       case 'amber': return ['rgba(245,158,11,0.4)', 'rgba(245,158,11,0.6)', 'rgba(245,158,11,0.2)'];
       case 'purple': return ['rgba(168,85,247,0.4)', 'rgba(168,85,247,0.6)', 'rgba(168,85,247,0.2)'];
       case 'slate': return ['rgba(100,116,139,0.4)', 'rgba(100,116,139,0.6)', 'rgba(100,116,139,0.2)'];
       default: return ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.6)', 'rgba(239, 68, 68, 0.2)'];
     }
  }

  useEffect(() => {
    if (!user) return;
    if (profile?.accountStatus === 'pending' || profile?.role === 'Guest') {
        setPosts([]);
        setLoading(false);
        return;
    }
    
    // Fetch photos with explicit rule-abiding constraints
    const q = query(
      collection(db, 'posts'), 
      or(
        where('visibilityStatus', 'in', ['public', 'scheduled']),
        where('authorId', '==', user.uid)
      ),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.imageUrl && data.type !== 'event') {
          p.push({ id: doc.id, ...data });
        }
      });
      setPosts(p);
      setLoading(false);
    }, (error) => {
      console.error("Firestore query error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Filtered Posts
  const filteredPosts = posts.filter(post => {
     // Visibility check
     const isExplicitlyHiddenFromCinema = post.showInCinematografo === false;
     if (isExplicitlyHiddenFromCinema) return false;

     let isVisible = false;
     if (user && post.authorId === user.uid) {
        isVisible = true; // Can see own
     } else if (post.visibilityStatus === 'public') {
        isVisible = true;
     } else if (post.visibilityStatus === 'scheduled' && post.visibilityTime && post.visibilityTime <= Date.now()) {
        isVisible = true;
     } else if (!post.visibilityStatus) {
        isVisible = true; // Legacy
     }

     if (!isVisible) return false;

     if (selectedAuthor !== 'Tutti' && post.authorName !== selectedAuthor) return false;
     if (selectedDecade !== 'Tutti' && post.decade !== selectedDecade) return false;
     return true;
  });

  const currentPost = filteredPosts[currentIndex];

  const filteredPostsRef = useRef(filteredPosts);
  useEffect(() => {
     filteredPostsRef.current = filteredPosts;
  }, [filteredPosts]);

  useEffect(() => {
     // Reset index if out of bounds after filtering
     if (currentIndex >= filteredPosts.length && filteredPosts.length > 0) {
        setCurrentIndex(0);
     }
  }, [filteredPosts.length, currentIndex]);

  const isPlayingRef = useRef(isPlaying);
  const modeRef = useRef(mode);
  const revealedRef = useRef(revealed);
  
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  // Slideshow
  useEffect(() => {
     let interval: any;
     if (isPlaying) {
        interval = setInterval(() => {
           if (modeRef.current !== 'normale' && !revealedRef.current) {
               // wait for the user to make a guess
               return;
           }
           setRevealed(false);
           setCurrentIndex((prev) => {
               const len = filteredPostsRef.current.length;
               if (len <= 1) return prev;
               return (prev + 1) % len;
           });
        }, 8000); // 8 sec per slide to give time to guess
     }
     return () => clearInterval(interval);
  }, [isPlaying]);

  const goNext = () => {
    setRevealed(false);
    setCurrentIndex((prev) => {
       const len = filteredPosts.length;
       if (len <= 0) return 0;
       return (prev + 1) % len;
    });
  };

  const goPrev = () => {
    setRevealed(false);
    setCurrentIndex((prev) => {
       const len = filteredPosts.length;
       if (len <= 0) return 0;
       return (prev - 1 + len) % len;
    });
  };

  const toggleFullscreen = () => {
     if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(err => console.log(err));
     } else {
        document.exitFullscreen();
     }
  };

  useEffect(() => {
     const onFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
     };
     document.addEventListener('fullscreenchange', onFullscreenChange);
     return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Unique Authors & Decades for filters
  const uniqueAuthors = Array.from(new Set(posts.map(p => p.authorName || 'Anonimo')));
  const uniqueDecades = Array.from(new Set(posts.map(p => p.decade || 'Sconosciuto')));

  useEffect(() => {
     setRevealed(false);
     setGuessResult('none');
     if (!currentPost) return;

     if (mode === 'indovina_chi') {
        const correct = currentPost.authorName || 'Anonimo';
        const others = uniqueAuthors.filter(a => a !== correct).sort(() => 0.5 - Math.random()).slice(0, 3);
        setGuessOptions([correct, ...others].sort(() => 0.5 - Math.random()));
     } else if (mode === 'indovina_anno') {
        const correct = currentPost.decade || 'Sconosciuto';
        const others = uniqueDecades.filter(d => d !== correct).sort(() => 0.5 - Math.random()).slice(0, 3);
        setGuessOptions([correct, ...others].sort(() => 0.5 - Math.random()));
     }
  }, [currentIndex, mode, currentPost?.id, posts.length]);

  const handleGuess = async (guess: string) => {
     if (!user || guessResult !== 'none' || revealed) return;
     const correct = mode === 'indovina_chi' ? (currentPost.authorName || 'Anonimo') : (currentPost.decade || 'Sconosciuto');
     
     if (guess === correct) {
        setGuessResult('correct');
        setRevealed(true);
        try {
           await updateDoc(doc(db, 'users', user.uid), { points: increment(5) });
        } catch (e) { console.error(e); }
     } else {
        setGuessResult('incorrect');
        setRevealed(true);
        try {
           await updateDoc(doc(db, 'users', user.uid), { points: increment(-2) });
        } catch (e) { console.error(e); }
     }
  };

  const handleLike = async () => {
     if (!currentPost) return;

     setLikedAnimId(currentPost.id);
     setTimeout(() => {
        setLikedAnimId(null);
     }, 300); // Reset animation state after short duration

     try {
        await updateDoc(doc(db, 'posts', currentPost.id), { likesCount: increment(1) });
     } catch(err) {
        console.error(err);
     }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
         <Film className="w-12 h-12 text-[#f56a23] animate-pulse mb-4" />
         <span className="text-[#1a2e16] dark:text-[#e2e8f0] font-sans font-medium">Caricamento rullino...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4" ref={containerRef}>
      {/* Header and Controls (Hidden in Fullscreen if playing, or shown on hover ideally, but let's keep it simple) */}
      <div className={`bg-white dark:bg-[#151e18] rounded-xl p-4 border border-slate-200 dark:border-[#24352b] shadow-sm flex flex-col md:flex-row items-center gap-4 ${isFullscreen ? 'absolute top-4 left-4 right-4 z-50 opacity-10 hover:opacity-100 transition-opacity duration-300' : ''}`}>
         
         <div className="flex items-center gap-2 text-2xl font-serif font-bold text-[#f56a23] mr-auto">
            <Film size={24} /> Cinematografo
         </div>

         {/* Filters */}
         <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-[#111814] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#24352b]">
               <User size={14} className="text-slate-500 mr-2" />
               <select className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none" value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)}>
                  <option value="Tutti">Tutti l'autori</option>
                  {uniqueAuthors.map(a => <option key={a} value={a}>{a}</option>)}
               </select>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-[#111814] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#24352b]">
               <Filter size={14} className="text-slate-500 mr-2" />
               <select className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none" value={selectedDecade} onChange={(e) => setSelectedDecade(e.target.value)}>
                  <option value="Tutti">Tutte le decadi</option>
                  {uniqueDecades.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
            </div>

            <div className="flex items-center bg-[#2D5A27]/10 dark:bg-[#42a83a]/10 px-3 py-1.5 rounded-lg border border-[#2D5A27]/20 dark:border-[#42a83a]/20">
               <HelpCircle size={14} className="text-[#2D5A27] dark:text-[#42a83a] mr-2" />
               <select className="bg-transparent text-sm font-bold text-[#2D5A27] dark:text-[#42a83a] outline-none" value={mode} onChange={(e) => { setMode(e.target.value as any); setRevealed(false); }}>
                  <option value="normale">Modalità Esposizione</option>
                  <option value="solo_immagini">Solo Immagini</option>
                  <option value="indovina_chi">Gioco: Indovina Chi!</option>
                  <option value="indovina_anno">Gioco: Indovina L'Anno!</option>
               </select>
            </div>
         </div>

         {/* Playback Controls */}
         <div className="flex flex-wrap items-center gap-2 border-l pl-4 border-slate-200 dark:border-[#24352b]">
            <button onClick={() => setIsPlaying(!isPlaying)} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white transition-colors shadow-md ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#f56a23] hover:bg-[#e05612]'}`}>
               {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
            </button>
            <button onClick={toggleFullscreen} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1a261f] text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#24352b] transition-colors border border-slate-200 dark:border-[#24352b]">
               {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
         </div>
      </div>

      {/* Presentation Area */}
      <div className={`flex-1 overflow-hidden relative rounded-xl border border-slate-200 dark:border-[#24352b] ${isFullscreen ? 'bg-black border-none rounded-none' : 'bg-slate-100 dark:bg-[#080d0a]'}`}>
         
         {filteredPosts.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
               <p className="text-slate-500 font-sans font-bold">Nessuna pellicola trovata con questi filtri.</p>
            </div>
         ) : (
            <AnimatePresence mode="wait">
               {currentPost && (
                 <motion.div 
                    key={currentPost.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex items-center justify-center p-4 md:p-12"
                 >
                    <div className="relative h-full w-full flex items-center justify-center group">
                       <motion.img 
                          src={currentPost.imageUrl} 
                          alt="Proiezione" 
                          referrerPolicy="no-referrer"
                          animate={{ scale: likedAnimId === currentPost.id ? 1.05 : 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="max-h-full max-w-full object-contain rounded-sm shadow-2xl" 
                       />

                       {/* Controls overlay on hover */}
                       <div className="absolute inset-y-0 left-0 flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 backdrop-blur-sm transition-all pointer-events-auto cursor-pointer"><ChevronLeft size={24} /></button>
                       </div>
                       <div className="absolute inset-y-0 right-0 flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 backdrop-blur-sm transition-all pointer-events-auto cursor-pointer"><ChevronRight size={24} /></button>
                       </div>

                       {/* Metadata Overlay positioned at the bottom */}
                       <div className="absolute bottom-0 inset-x-0 p-8 flex flex-col items-center justify-end z-20 pointer-events-none">
                             <AnimatePresence mode="wait">
                             {mode !== 'solo_immagini' && (
                                isInfoVisible ? (
                                   <motion.div 
                                      key="info-card"
                                      initial={{ opacity: 0, y: 50 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 50, transition: { duration: 0.2 } }}
                                      className="relative bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center max-w-2xl w-full shadow-2xl pointer-events-auto"
                                   >
                                      <button 
                                         onClick={(e) => { e.stopPropagation(); setIsInfoVisible(false); }} 
                                         className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1"
                                         title="Nascondi Dettagli"
                                      >
                                         <ChevronDown size={20} />
                                      </button>
                                      
                                      {/* GIOCHI LOGIC */}
                                      {mode === 'indovina_chi' && !revealed ? (
                                         <div className="space-y-4">
                                            <HelpCircle size={32} className="mx-auto text-amber-400 animate-bounce" />
                                            <h3 className="text-white text-xl font-bold uppercase tracking-widest font-sans">Chi ha portato questo ricordo?</h3>
                                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                               {guessOptions.map(opt => (
                                                  <button key={opt} onClick={() => handleGuess(opt)} className="bg-amber-500/20 border border-amber-500/50 text-amber-100 px-4 py-2 rounded-xl font-bold hover:bg-amber-500 hover:text-black transition-colors min-w-[120px]">
                                                     {opt}
                                                  </button>
                                               ))}
                                            </div>
                                         </div>
                                      ) : mode === 'indovina_anno' && !revealed ? (
                                         <div className="space-y-4">
                                            <HelpCircle size={32} className="mx-auto text-purple-400 animate-bounce" />
                                            <h3 className="text-white text-xl font-bold uppercase tracking-widest font-sans">Di che decade è questa foto?</h3>
                                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                               {guessOptions.map(opt => (
                                                  <button key={opt} onClick={() => handleGuess(opt)} className="bg-purple-500/20 border border-purple-500/50 text-purple-100 px-4 py-2 rounded-xl font-bold hover:bg-purple-500 hover:text-white transition-colors min-w-[120px]">
                                                     {opt}
                                                  </button>
                                               ))}
                                            </div>
                                         </div>
                                      ) : (
                                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                            {guessResult !== 'none' && (
                                               <div className={`text-sm font-bold uppercase tracking-widest mb-4 ${guessResult === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                                                  {guessResult === 'correct' ? 'Risposta Esatta! +5 Punti' : 'Sbagliato! -2 Punti'}
                                               </div>
                                            )}
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                               <span className="text-xs bg-[#f56a23] text-white px-3 py-1 rounded-full font-bold uppercase tracking-widest">{currentPost.decade}</span>
                                            </div>
                                            <p className="text-white text-xl md:text-2xl font-serif italic mb-4 break-words">"{currentPost.caption}"</p>
                                            <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/20">
                                               <div className="flex items-center gap-2">
                                                  <span className="text-slate-300 font-sans text-sm">Caricata da:</span>
                                                  <span className="text-[#f56a23] font-bold font-sans text-lg">{currentPost.authorName || 'Anonimo'}</span>
                                               </div>
                                               <motion.button 
                                                  animate={likedAnimId === currentPost.id ? { scale: [1, 1.15, 1], backgroundColor: getColorTheme(animColor) } : {}}
                                                  transition={{ duration: animSpeed / 2, ease: "easeOut" }}
                                                  onClick={handleLike}
                                                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs bg-red-500/20 hover:bg-red-500/40 text-red-100 transition-colors border border-red-500/50"
                                                  title="Mi Piace"
                                               >
                                                  <AnimatePresence>
                                                     {likedAnimId === currentPost.id && (
                                                        <motion.div 
                                                           initial={{ opacity: 1, scale: 0.6, y: 0 }} 
                                                           animate={{ opacity: 0, scale: 1.5, y: animDistance }} 
                                                           exit={{ opacity: 0 }}
                                                           transition={{ duration: animSpeed, ease: "easeOut" }}
                                                           className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none text-xl"
                                                        >
                                                           {animIcon}
                                                        </motion.div>
                                                     )}
                                                  </AnimatePresence>
                                                  <Heart size={16} className={likedAnimId === currentPost.id ? "fill-current text-white" : ""} />
                                                  <span>{currentPost.likesCount || 0}</span>
                                               </motion.button>
                                            </div>
                                         </motion.div>
                                      )}
                                   </motion.div>
                                ) : (
                                   <motion.div
                                      key="info-tab"
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                                      className="absolute bottom-4 pointer-events-auto"
                                   >
                                      <button 
                                         onClick={(e) => { e.stopPropagation(); setIsInfoVisible(true); }} 
                                         className="bg-black/60 backdrop-blur-md text-white/80 hover:text-white rounded-full px-5 py-2 flex items-center gap-2 border border-white/10 hover:bg-black/80 hover:border-white/20 transition-all font-bold text-sm shadow-xl"
                                      >
                                         <Eye size={18} /> Mostra Dettagli
                                      </button>
                                   </motion.div>
                                )
                             )}
                          </AnimatePresence>
                       </div>

                    </div>
                 </motion.div>
               )}
            </AnimatePresence>
         )}
      </div>
      
      {/* Thumbnail Bar */}
      {!isFullscreen && filteredPosts.length > 0 && (
         <div className="h-20 bg-white dark:bg-[#151e18] rounded-xl border border-slate-200 dark:border-[#24352b] p-2 flex items-center gap-2 overflow-x-auto shadow-sm">
            {filteredPosts.map((p, idx) => (
               <button 
                  key={p.id} 
                  onClick={() => { setCurrentIndex(idx); setRevealed(false); }}
                  className={`relative flex-shrink-0 w-24 h-full rounded-lg overflow-hidden border-2 transition-all ${idx === currentIndex ? 'border-[#f56a23] scale-105 shadow-md' : 'border-transparent opacity-50 hover:opacity-100'}`}
               >
                  <img src={p.imageUrl} alt="thumb" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
               </button>
            ))}
         </div>
      )}

    </div>
  );
}
