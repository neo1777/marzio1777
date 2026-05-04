import React, { useState, useEffect } from 'react';
import { useRBAC } from '../hooks/useRBAC';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Camera, Award, ChevronUp, MapPin, Edit3, Settings2, Save, Cpu, HardDrive, UserCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GestioneArchivio from '../components/GestioneArchivio';
import { Avatar } from '../components/ui';
import { useUserGagliardetti } from '../hooks/useUserGagliardetti';
import type { GagliardettoState } from '../lib/gagliardetti';

export default function ProfiloPersonale() {
  const { user, profile, isAdminOrRoot } = useRBAC();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'profilo' | 'archivio'>('profilo');

  // Modifiable User Data
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Local Settings
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Animation Settings
  const [animIcon, setAnimIcon] = useState('❄️');
  const [animColor, setAnimColor] = useState('red');
  const [animSpeed, setAnimSpeed] = useState(0.5); // duration
  const [animDistance, setAnimDistance] = useState(-30);

  useEffect(() => {
    if (profile?.bio) {
       setBio(profile.bio);
    }
    if (profile?.shareLiveLocation !== undefined) {
       setShareLiveLocation(profile.shareLiveLocation);
    }
    if (profile?.animIcon) setAnimIcon(profile.animIcon);
    if (profile?.animColor) setAnimColor(profile.animColor);
    if (profile?.animSpeed) setAnimSpeed(profile.animSpeed);
    if (profile?.animDistance) setAnimDistance(profile.animDistance);
  }, [profile]);


  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { bio });
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSaveLocalSettings = () => {
    localStorage.setItem('gemini_api_key', geminiKey);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  if (!profile) return null;

  const points = profile.points || 0;
  const baseAltitude = 728;
  const currentAltitude = baseAltitude + points;

  // Phase 2 §15.C: full Gagliardetti catalog computed from snapshot metrics
  // (collection-group queries cached 1h in localStorage). Replaces the old
  // hardcoded `badges` array that only fired on raw `points` thresholds.
  const { states: gagliardetti, loading: gagliardettiLoading } = useUserGagliardetti(user?.uid, points, profile.metrics);

  // For the "next milestone" progress bar at the top of the Gamification
  // panel: pick the unearned gagliardetto with the smallest `target -
  // current` gap so the user always sees the closest goal.
  const nextGagliardetto: GagliardettoState | undefined = gagliardetti
    .filter(g => !g.earned && g.def.target !== null)
    .sort((a, b) => (a.def.target! - a.current) - (b.def.target! - b.current))[0];
  const progressToNext = nextGagliardetto
    ? Math.min(100, Math.round(nextGagliardetto.progress * 100))
    : 100;

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-[#24352b] pb-4 gap-4">
        <div>
           <h2 className="text-xs font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">La Taverna</h2>
           <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#1a2e16] dark:text-[#e2e8f0] tracking-tight">
              Profilo Locale
           </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-[#111814] p-1 rounded-xl">
           <button onClick={() => setActiveTab('profilo')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'profilo' ? 'bg-white dark:bg-[#24352b] text-[#2D5A27] dark:text-[#42a83a] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <UserCircle size={18} /> Profilo
           </button>
           <button onClick={() => setActiveTab('archivio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'archivio' ? 'bg-white dark:bg-[#24352b] text-[#2D5A27] dark:text-[#42a83a] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <HardDrive size={18} /> Gestione Archivio
           </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
         <AnimatePresence mode="wait">
            {activeTab === 'profilo' ? (
               <motion.div key="profilo" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6 pt-2">
                 {/* Profile Card */}
                 <div className="bg-white dark:bg-[#1a261f] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#2D5A27]/5 dark:bg-[#42a83a]/10 rounded-bl-full -z-0"></div>
                    
                    <div className="flex flex-col sm:flex-row gap-6 relative z-10">
                       <Avatar photoURL={profile.photoURL} name={profile.displayName} size="xl" className="border-4 border-slate-50 dark:border-[#111814] shadow-md" />
                       <div className="flex-1">
                          <h3 className="text-2xl font-bold font-serif text-[#1a2e16] dark:text-[#e2e8f0] flex items-center gap-2">
                             {profile.displayName}
                             {isAdminOrRoot && (
                                <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{profile.role}</span>
                             )}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{profile.email}</p>
                          
                          {editing ? (
                             <div className="space-y-3">
                                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Raccontaci qualcosa su di te o i tuoi ricordi a Marzio..." className="w-full text-sm p-3 rounded-lg border border-[#2D5A27]/50 dark:border-[#42a83a]/50 bg-slate-50 dark:bg-[#111814] outline-none resize-none focus:ring-1 focus:ring-[#2D5A27]" rows={3}></textarea>
                                <div className="flex gap-2">
                                   <button onClick={handleSaveProfile} disabled={loading} className="text-xs bg-[#2D5A27] text-white px-4 py-1.5 rounded-md font-bold hover:bg-[#1b3b17] transition-all disabled:opacity-50 flex items-center gap-1"><Save size={14} /> Salva Appunti</button>
                                   <button onClick={() => setEditing(false)} className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-1.5 rounded-md font-bold hover:bg-slate-300 transition-all">Annulla</button>
                                </div>
                             </div>
                          ) : (
                             <div className="group relative pr-8">
                                <p className="text-sm font-sans italic text-slate-700 dark:text-slate-300 leading-relaxed max-w-lg">
                                   {bio || "Nessun appunto personale. Scrivi qualcosa per far sapere chi sei."}
                                </p>
                                <button onClick={() => setEditing(true)} className="absolute top-0 right-0 text-slate-300 hover:text-[#2D5A27] transition-colors"><Edit3 size={16}/></button>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Gamification Area */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Altitude Progress */}
                    <div className="bg-white dark:bg-[#1a261f] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-4">La tua Altitudine</h4>
                      <div className="flex items-center justify-between mb-2">
                            <motion.span 
                               initial={{ scale: 1.1, filter: 'brightness(1.2)' }}
                               animate={{ scale: 1, filter: 'brightness(1)' }}
                               transition={{ type: "spring", stiffness: 300, damping: 20 }}
                               className="text-4xl font-black font-serif text-[#2D5A27] dark:text-[#42a83a] flex items-center"
                            >
                               <ChevronUp size={30} className="-mr-1"/>{currentAltitude}<span className="text-lg text-slate-400 ml-1">m</span>
                            </motion.span>
                         <MapPin size={24} className="text-slate-200 dark:text-[#24352b]" />
                      </div>
                      
                      {nextGagliardetto ? (
                         <div className="mt-4">
                           <div className="flex justify-between text-xs font-bold font-sans mb-1 text-slate-600 dark:text-slate-400">
                                 <motion.span
                                    initial={{ scale: 1.2 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.2 }}
                                 >
                                    Punti esp: {points}
                                 </motion.span>
                              <span title={nextGagliardetto.def.description}>Prox: {nextGagliardetto.def.emoji} {nextGagliardetto.def.name}</span>
                           </div>
                           <div className="w-full bg-slate-100 dark:bg-[#111814] h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${progressToNext}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-gradient-to-r from-[#2D5A27] to-[#42a83a]"></motion.div>
                           </div>
                           <p className="text-[10px] text-slate-500 mt-2 text-center italic">{nextGagliardetto.current} / {nextGagliardetto.def.target} — Partecipa per salire di quota...</p>
                         </div>
                      ) : (
                         <p className="text-sm font-bold text-amber-500 mt-4 text-center">Hai conquistato tutti i gagliardetti!</p>
                      )}
                    </div>

                    {/* Gagliardetti — full catalog (earned + in-progress) */}
                    <div className="bg-white dark:bg-[#1a261f] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6 space-y-3">
                       <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500">Gagliardetti</h4>
                          {gagliardettiLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
                       </div>
                       <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                          {(['historical', 'games', 'audio'] as const).map(cat => {
                             const inCat = gagliardetti.filter(g => g.def.category === cat);
                             if (inCat.length === 0) return null;
                             const earnedInCat = inCat.filter(g => g.earned);
                             const label = cat === 'historical' ? 'Comunità' : cat === 'games' ? 'Campo dei Giochi' : "L'Ainulindalë";
                             return (
                                <div key={cat} className="space-y-2">
                                   <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                      {label} · {earnedInCat.length}/{inCat.length}
                                   </p>
                                   {inCat.map(g => (
                                      <div
                                         key={g.def.id}
                                         className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                                            g.earned
                                               ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                                               : 'bg-slate-50 dark:bg-[#111814] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#24352b] opacity-70'
                                         }`}
                                         title={g.def.description}
                                      >
                                         <span className={`text-2xl shrink-0 ${g.earned ? '' : 'grayscale opacity-60'}`} aria-hidden>{g.def.emoji}</span>
                                         <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs tracking-tight truncate">{g.def.name}</p>
                                            <p className="text-[10px] font-medium opacity-80 truncate">{g.def.description}</p>
                                            {!g.earned && g.def.target !== null && (
                                               <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                                                  <div
                                                     className="h-full bg-[#2D5A27] dark:bg-[#42a83a] transition-[width]"
                                                     style={{ width: `${Math.round(g.progress * 100)}%` }}
                                                  />
                                               </div>
                                            )}
                                         </div>
                                         {g.earned && <Award size={16} className="shrink-0" />}
                                         {!g.earned && g.def.target !== null && (
                                            <span className="text-[10px] font-mono shrink-0 tabular-nums">
                                               {g.current}/{g.def.target}
                                            </span>
                                         )}
                                      </div>
                                   ))}
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>

                 {/* Local App Settings */}
                 <div className="bg-slate-50 dark:bg-[#111814] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6 overflow-hidden">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-4 flex items-center gap-2"><Settings2 size={16} /> Impostazioni e Privacy</h4>
                    <div className="space-y-6 max-w-xl">
                      
                      {/* Live Location Toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 dark:border-[#24352b] rounded-xl bg-white dark:bg-[#1a261f]">
                         <div>
                            <h5 className="text-sm font-bold text-[#1a2e16] dark:text-[#e2e8f0] flex items-center gap-2"><MapPin size={16} className={shareLiveLocation ? 'text-emerald-500' : 'text-slate-400'}/> Condivisione Posizione in Tempo Reale</h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Permette agli altri utenti di vederti in tempo reale sulla "Mappa" tramite un'icona quando hai l'app aperta.</p>
                         </div>
                         <button 
                            onClick={async () => {
                               const newVal = !shareLiveLocation;
                               setShareLiveLocation(newVal);
                               if (user) await updateDoc(doc(db, 'users', user.uid), { shareLiveLocation: newVal });
                            }} 
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shareLiveLocation ? 'bg-[#2D5A27] dark:bg-[#42a83a]' : 'bg-slate-300 dark:bg-slate-700'}`}
                         >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shareLiveLocation ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                      </div>

                      {/* Animation Preferences */}
                      <div className="p-4 border border-slate-200 dark:border-[#24352b] rounded-xl bg-white dark:bg-[#1a261f]">
                         <h5 className="text-sm font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-3">Personalizzazione Animazioni Feedback (Like)</h5>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm">Scegli come visualizzare le micro-interazioni quando metti "Mi Piace" (Es. fiocchi di neve, foglie).</p>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Particella (Icona)</label>
                             <select value={animIcon} onChange={async (e) => {
                                setAnimIcon(e.target.value);
                                if (user) await updateDoc(doc(db, 'users', user.uid), { animIcon: e.target.value });
                             }} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg px-3 py-2 text-sm outline-none text-slate-700 dark:text-slate-300">
                                <option value="none">Senza Particelle (Battito Cuore)</option>
                                <option value="❄️">❄️ Fiocco di neve</option>
                                <option value="🍃">🍃 Foglia</option>
                                <option value="🔥">🔥 Fuoco</option>
                                <option value="💫">💫 Scintille</option>
                                <option value="💖">💖 Cuore Scintillante</option>
                                <option value="🍄">🍄 Fungo</option>
                                <option value="🌲">🌲 Pino</option>
                                <option value="🍺">🍺 Birra</option>
                             </select>
                           </div>
                           
                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Colore Tinta Unita</label>
                             <select value={animColor} onChange={async (e) => {
                                setAnimColor(e.target.value);
                                if (user) await updateDoc(doc(db, 'users', user.uid), { animColor: e.target.value });
                             }} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg px-3 py-2 text-sm outline-none">
                                <option value="red">Rosso</option>
                                <option value="blue">Blu</option>
                                <option value="emerald">Smeraldo</option>
                                <option value="amber">Ambra</option>
                                <option value="purple">Viola</option>
                                <option value="slate">Ardesia (Grigio scuro)</option>
                             </select>
                           </div>

                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Durata / Lentezza (Secondi)</label>
                             <input type="range" min="0.2" max="2" step="0.1" value={animSpeed} onChange={async (e) => {
                               const val = parseFloat(e.target.value);
                               setAnimSpeed(val);
                               if (user) await updateDoc(doc(db, 'users', user.uid), { animSpeed: val });
                             }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                             <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>Veloce ({animSpeed}s)</span>
                                <span>Lento</span>
                             </div>
                           </div>

                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Distanza (Altezza)</label>
                             <input type="range" min="-80" max="-10" step="5" value={animDistance} onChange={async (e) => {
                               const val = parseInt(e.target.value);
                               setAnimDistance(val);
                               if (user) await updateDoc(doc(db, 'users', user.uid), { animDistance: val });
                             }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                             <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>Corta</span>
                                <span>Lunga ({Math.abs(animDistance)}px)</span>
                             </div>
                           </div>
                         </div>
                      </div>

                      {/* API Key */}
                      <div>
                        <label className="block text-xs font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Cpu size={14}/> Gemini AI Api Key (Locale)</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                           <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} className="flex-1 bg-white dark:bg-[#1a261f] border border-slate-200 dark:border-[#24352b] rounded-lg p-3 text-sm text-[#1a2e16] dark:text-[#e2e8f0] outline-none focus:border-[#2D5A27] focus:ring-1 focus:ring-[#2D5A27] transition-all font-mono" placeholder="AIzaSy..." />
                           <button onClick={handleSaveLocalSettings} className="bg-[#2D5A27] text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-[#1b3b17] transition-colors shrink-0">Salva Chiave</button>
                        </div>
                        {savedMsg && <p className="text-xs font-bold text-green-600 mt-2">Impostazioni Salvate Localmente ✓</p>}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed max-w-sm">
                           Necessaria agli automatismi dell'intelligenza artificiale per l'analisi visiva delle vecchie fotografie d'archivio e per la stesura automatica dei ricordi.
                        </p>
                      </div>
                    </div>
                 </div>

               </motion.div>
            ) : (
               <motion.div key="archivio" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pt-2">
                 <GestioneArchivio />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
}
