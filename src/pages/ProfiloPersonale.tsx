import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Camera, Award, ChevronUp, MapPin, Edit3, Settings2, Save, Cpu, HardDrive, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GestioneArchivio from '../components/GestioneArchivio';

export default function ProfiloPersonale() {
  const { user, profile } = useAuth();
  
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

  useEffect(() => {
    if (profile?.bio) {
       setBio(profile.bio);
    }
    if (profile?.shareLiveLocation !== undefined) {
       setShareLiveLocation(profile.shareLiveLocation);
    }
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

  // Badge Logic Gamification
  const badges = [
    { name: 'Il Villeggiante', desc: 'Hai iniziato a frequentare Marzio', thres: 10,  color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
    { name: 'Custode del Baule', desc: 'Molto attivo tra gli archivi antichi', thres: 50, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    { name: 'Lo Storico', desc: 'Stai riportando in vita il secolo scorso', thres: 100, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
    { name: 'Sindaco di Marzio', desc: 'Leggenda locale e grande organizzatore', thres: 150, color: 'bg-purple-500/10 text-purple-600 border-purple-200' }
  ];

  const nextBadge = badges.find(b => points < b.thres);
  const progressToNext = nextBadge ? (points / nextBadge.thres) * 100 : 100;

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
                       <img src={profile.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.uid}`} alt="avatar" className="w-24 h-24 rounded-full border-4 border-slate-50 dark:border-[#111814] shadow-md object-cover bg-white" />
                       <div className="flex-1">
                          <h3 className="text-2xl font-bold font-serif text-[#1a2e16] dark:text-[#e2e8f0] flex items-center gap-2">
                             {profile.displayName}
                             {(profile.role === 'Root' || profile.role === 'Admin') && (
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
                               initial={{ scale: 1.1, color: '#f56a23', filter: 'brightness(1.2)' }}
                               animate={{ scale: 1, color: 'inherit', filter: 'brightness(1)' }}
                               transition={{ type: "spring", stiffness: 300, damping: 20 }}
                               className="text-4xl font-black font-serif text-[#2D5A27] dark:text-[#42a83a] flex items-center"
                            >
                               <ChevronUp size={30} className="-mr-1"/>{currentAltitude}<span className="text-lg text-slate-400 ml-1">m</span>
                            </motion.span>
                         <MapPin size={24} className="text-slate-200 dark:text-[#24352b]" />
                      </div>
                      
                      {nextBadge ? (
                         <div className="mt-4">
                           <div className="flex justify-between text-xs font-bold font-sans mb-1 text-slate-600 dark:text-slate-400">
                                 <motion.span
                                    initial={{ scale: 1.2, color: '#f56a23' }}
                                    animate={{ scale: 1, color: 'inherit' }}
                                    transition={{ duration: 0.2 }}
                                 >
                                    Punti esp: {points}
                                 </motion.span>
                              <span>Prox Riconoscimento a: {nextBadge.thres}</span>
                           </div>
                           <div className="w-full bg-slate-100 dark:bg-[#111814] h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${progressToNext}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-gradient-to-r from-[#2D5A27] to-[#42a83a]"></motion.div>
                           </div>
                           <p className="text-[10px] text-slate-500 mt-2 text-center italic">Partecipa per salire di quota...</p>
                         </div>
                      ) : (
                         <p className="text-sm font-bold text-amber-500 mt-4 text-center">Hai raggiunto la vetta della Piambello!</p>
                      )}
                    </div>

                    {/* Badges Earned */}
                    <div className="bg-white dark:bg-[#1a261f] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6 space-y-3">
                       <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-2">Gagliardetti Ottenuti</h4>
                       <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                          {badges.filter(b => points >= b.thres).length === 0 && (
                             <p className="text-sm text-slate-400 italic text-center py-6">Nessun gagliardetto ancora ottenuto.</p>
                          )}
                          {badges.filter(b => points >= b.thres).reverse().map((b, i) => (
                             <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${b.color}`}>
                                <Award size={20} className="shrink-0" />
                                <div>
                                   <p className="font-bold text-sm tracking-tight">{b.name}</p>
                                   <p className="text-[10px] font-medium opacity-80">{b.desc}</p>
                                </div>
                             </div>
                          ))}
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
