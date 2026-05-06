import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGameEvent, createGameItem, advanceGameEventStatus } from '../hooks/useGameEvents';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createMarkerIcon } from '../lib/leafletIcons';
import { Loader2, Save, MapPin, Trophy, Wand2, HelpCircle, Compass, ChevronRight, Search, X, LocateFixed } from 'lucide-react';
import { serverTimestamp, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateUniformPointsInRadius } from '../lib/geoUtils';
import { useHighAccuracyPosition } from '../hooks/useHighAccuracyPosition';

interface ItemDraft {
  lat: number;
  lng: number;
  points: number;
  templateId: string;
  emoji?: string;
  label?: string;
}

function MapClickHandler({ onClick, enabled }: { onClick: (latlng: L.LatLng) => void, enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) onClick(e.latlng);
    },
  });
  return null;
}

interface GameItemTemplate {
  id: string;
  emoji: string;
  label: string;
  points: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  spawnWeight: number;
}

const PRESETS = [
   { id: 'birra', name: '🍺 Birra di Ferragosto', templates: [
      { id: 'birra_comune', emoji: '🍺', label: 'Birra Comune', points: 10, rarity: 'common', spawnWeight: 0.7 },
      { id: 'birra_uncommon', emoji: '🍻', label: 'Boccale DOP', points: 20, rarity: 'uncommon', spawnWeight: 0.2 },
      { id: 'birra_rare', emoji: '🍾', label: 'Bottiglia Rara', points: 50, rarity: 'rare', spawnWeight: 0.09 },
      { id: 'birra_leg', emoji: '🏆', label: 'Bottiglia Magnum', points: 100, rarity: 'legendary', spawnWeight: 0.01 },
   ]},
   { id: 'foraggiamento', name: '🍄 Foraggiamento Autunnale', templates: [
      { id: 'f_foglia', emoji: '🍂', label: 'Foglia', points: 1, rarity: 'common', spawnWeight: 0.5 },
      { id: 'f_castagna', emoji: '🌰', label: 'Castagna', points: 5, rarity: 'uncommon', spawnWeight: 0.3 },
      { id: 'f_finferlo', emoji: '🍄', label: 'Finferlo', points: 10, rarity: 'rare', spawnWeight: 0.15 },
      { id: 'f_porcino', emoji: '🌲', label: 'Porcino', points: 50, rarity: 'legendary', spawnWeight: 0.05 },
   ]},
   { id: 'halloween', name: '🎃 Halloween in Paese', templates: [
      { id: 'h_caramella', emoji: '🍬', label: 'Caramella', points: 5, rarity: 'common', spawnWeight: 0.6 },
      { id: 'h_zucca', emoji: '🎃', label: 'Zucca', points: 10, rarity: 'uncommon', spawnWeight: 0.3 },
      { id: 'h_fantasma', emoji: '👻', label: 'Fantasma', points: 20, rarity: 'rare', spawnWeight: 0.1 },
   ]},
   { id: 'trekking', name: '🏔️ Trekking del Monarca', templates: [
      { id: 't_sentiero', emoji: '🥾', label: 'Sentiero', points: 10, rarity: 'common', spawnWeight: 0.5 },
      { id: 't_baita', emoji: '🏡', label: 'Baita', points: 30, rarity: 'uncommon', spawnWeight: 0.3 },
      { id: 't_vetta', emoji: '🏔️', label: 'Vetta', points: 100, rarity: 'rare', spawnWeight: 0.2 },
   ]},
   { id: 'amsterdam', name: '🍁 Modalità Amsterdam', templates: [
      { id: 'a_foglia', emoji: '🍁', label: 'Foglia Rossa', points: 10, rarity: 'common', spawnWeight: 0.7 },
      { id: 'a_tulipano', emoji: '🌷', label: 'Tulipano', points: 20, rarity: 'uncommon', spawnWeight: 0.25 },
      { id: 'a_bici', emoji: '🚲', label: 'Bicicletta', points: 50, rarity: 'rare', spawnWeight: 0.05 },
   ]}
] as { id: string, name: string, templates: GameItemTemplate[] }[];

const customIcon = createMarkerIcon('gold');

// Marzio centre — used as the map fallback when the browser hasn't yet
// produced a GPS fix. Avoids the visible "Roma → Marzio" jump that happened
// when the wizard mounted with a 41.9°N centre and then re-centred once GPS
// arrived.
const MARZIO_FALLBACK: [number, number] = [45.9238, 8.8655];

// `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time, and
// `Date.toISOString()` returns UTC, so format manually. +10 min from now is
// the smallest reasonable default that comfortably clears the rule's
// `scheduledKickoff > request.time` guard plus 30s client-side margin.
function defaultKickoffLocal(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GameCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Coarse GPS is plenty for "centre the placement map on me". The fast
  // initial fix (one-shot getCurrentPosition + maximumAge=60s) lands in a
  // second or two on desktop, vs the 5-10s you'd wait with watchPosition +
  // enableHighAccuracy alone.
  const { position: userPosition } = useHighAccuracyPosition(true, false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Event Data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoff, setKickoff] = useState<string>(() => defaultKickoffLocal());
  const [pointsMultiplier, setPointsMultiplier] = useState('1.0');
  const [type, setType] = useState<'treasure_hunt' | 'photo_quiz'>('treasure_hunt');

  // Treasure Hunt Specific
  const [spawnMode, setSpawnMode] = useState<'manual' | 'auto' | 'hybrid' | 'legacy_posts'>('manual');
  const [isSettingCenter, setIsSettingCenter] = useState(false); // New state to track setting center mode
  const [radius, setRadius] = useState<number>(500);
  const [autoCount, setAutoCount] = useState<number>(10);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [itemTemplates, setItemTemplates] = useState<GameItemTemplate[]>(PRESETS[0].templates);
  const [center, setCenter] = useState<[number, number]>(MARZIO_FALLBACK);
  const [hasUserCentered, setHasUserCentered] = useState(false);

  // City search modal state. Kept lean: one input, one fetch to Nominatim,
  // a small list of results. Same pattern as IlBaule's address picker but
  // wired to setCenter directly without the second-step manual map.
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [citySearching, setCitySearching] = useState(false);
  const [cityResults, setCityResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  // Auto-centre on user once we get a fix, but only if the user hasn't
  // intentionally moved the map themselves (manual click on the map, city
  // search, "set centre" tool). `hasUserCentered` flips on those interactions
  // and stops fighting them with stale GPS updates.
  useEffect(() => {
    if (userPosition && !hasUserCentered && !isSettingCenter && items.length === 0) {
      setCenter([userPosition.lat, userPosition.lng]);
    }
  }, [userPosition, hasUserCentered, isSettingCenter, items.length]);

  // Photo Quiz Specific
  const [totalRounds, setTotalRounds] = useState(10);
  const [answerTime, setAnswerTime] = useState(20);

  const pickTemplate = () => {
     const r = Math.random();
     let sum = 0;
     for (const t of itemTemplates) {
        sum += t.spawnWeight;
        if (r <= sum) return t;
     }
     return itemTemplates[0]; // fallback
  };

  const handleMapClick = (latlng: L.LatLng) => {
    if (isSettingCenter) {
      setCenter([latlng.lat, latlng.lng]);
      setIsSettingCenter(false);
      setHasUserCentered(true);
      return;
    }
    if (spawnMode !== 'manual' && spawnMode !== 'hybrid') return;
    const tmpl = pickTemplate();
    setItems((prev) => [
      ...prev,
      { lat: latlng.lat, lng: latlng.lng, points: tmpl.points, templateId: tmpl.id, emoji: tmpl.emoji, label: tmpl.label }
    ]);
  };

  const handleCenterOnMe = () => {
    if (!userPosition) return;
    setCenter([userPosition.lat, userPosition.lng]);
    setHasUserCentered(true);
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    setCitySearching(true);
    setCityResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(cityQuery)}`,
        { headers: { 'Accept-Language': 'it' } }
      );
      const data = await res.json();
      setCityResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      alert(`Ricerca fallita: ${err?.message ?? 'errore di rete'}`);
    } finally {
      setCitySearching(false);
    }
  };

  const pickCityResult = (lat: string, lon: string) => {
    setCenter([parseFloat(lat), parseFloat(lon)]);
    setHasUserCentered(true);
    setShowCitySearch(false);
    setCityQuery('');
    setCityResults([]);
  };

  function SetView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center, map]);

    useEffect(() => {
       const timer = setTimeout(() => {
          map.invalidateSize();
       }, 250);
       return () => clearTimeout(timer);
    }, [map]);
    return null;
  }

  const handleGenerateAuto = () => {
     const points = generateUniformPointsInRadius(center[0], center[1], radius, autoCount);
     const newItems = points.map(p => {
        const tmpl = pickTemplate();
        return {
           ...p,
           points: tmpl.points,
           templateId: tmpl.id,
           emoji: tmpl.emoji,
           label: tmpl.label
        };
     });
     setItems(spawnMode === 'hybrid' ? [...items, ...newItems] : newItems);
  };

  const handleGenerateLegacy = async () => {
     setLoading(true);
     try {
        const postsSnap = await getDocs(collection(db, 'posts'));
        const legacyItems: ItemDraft[] = [];
        postsSnap.forEach(doc => {
           const data = doc.data();
           if (data.location && legacyItems.length < autoCount) {
              legacyItems.push({
                 lat: data.location.lat,
                 lng: data.location.lng,
                 points: 50,
                 templateId: 'legacy_post',
                 emoji: '📸',
                 label: 'Ricordo di ' + (data.authorName || 'Qualcuno')
              });
           }
        });
        setItems(legacyItems);
     } catch(e: any) {
        console.error(e);
        alert(`Errore caricamento posts: ${e?.message ?? e}`);
     } finally {
        setLoading(false);
     }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title || !description || !kickoff) {
      alert("Compila tutti i campi base");
      return;
    }
    if (type === 'treasure_hunt' && items.length === 0) {
      alert("Aggiungi almeno un item");
      return;
    }

    const kickoffDate = new Date(kickoff);
    if (isNaN(kickoffDate.getTime())) {
      alert("Data e ora non valide. Controlla il campo 'Data/Ora Inizio'.");
      return;
    }
    // The rule (firestore.rules: game_events.create) requires
    // `scheduledKickoff > request.time`. If the user picks a time that's
    // already past by the time they hit Salva, Firestore returns
    // PERMISSION_DENIED with no hint as to which guard failed. Catch it
    // here with a clear message instead.
    if (kickoffDate.getTime() <= Date.now() + 30_000) {
      alert("La data di inizio deve essere nel futuro (almeno 30 secondi da ora).");
      return;
    }

    const multiplier = parseFloat(pointsMultiplier);
    const safeMultiplier = isNaN(multiplier) ? 1 : Math.max(0.5, Math.min(5, multiplier));

    setLoading(true);
    try {
      const eventData: any = {
         title,
         description,
         type,
         pointsMultiplier: safeMultiplier,
         scheduledKickoff: kickoffDate,
         organizerId: user.uid,
         invitedUserIds: [], // MVP everyone
      };

      if (type === 'treasure_hunt') {
         eventData.treasureHuntConfig = {
            spawnMode,
            centerLat: center[0],
            centerLng: center[1],
            radiusMeters: radius,
            itemTemplates,
            defaultCaptureRadius: 15,
            showHotColdRadar: true,
            showCompassArrow: true
         };
         if (spawnMode !== 'manual') {
            eventData.totalItemsCount = autoCount;
         }
      }

      if (type === 'photo_quiz') {
         eventData.photoQuizConfig = {
            totalRounds,
            answerTimeSeconds: answerTime,
            questionTypes: ['guess_who', 'guess_year'],
            scoringMode: 'fixed'
         };
      }

// ... Removed invalid import ...
      const eventId = await createGameEvent(eventData);

      if (type === 'treasure_hunt') {
         for (const item of items) {
            await createGameItem(eventId, item);
         }
      }

      await advanceGameEventStatus(eventId, 'scheduled');


      
      navigate('/dashboard/giochi');
    } catch (error: any) {
      console.error(error);
      const msg = error?.message ?? String(error);
      alert(`Errore durante la creazione: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (step === 0) {
      return (
         <div className="max-w-2xl mx-auto h-full flex flex-col py-6 px-4">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
               <Trophy className="text-[#2D5A27] dark:text-[#42a83a]" /> 
               Nuovo Evento di Gioco
            </h1>
            <p className="text-slate-500 mb-8">Scegli che tipo di esperienza vuoi organizzare per i marziesi.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button onClick={() => { setType('treasure_hunt'); setStep(1); }} className="bg-white dark:bg-[#151e18] border-2 border-transparent hover:border-[#2D5A27] dark:hover:border-[#42a83a] rounded-2xl p-6 text-left transition-all shadow-sm group">
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 flex items-center justify-center mb-4">
                     <Compass size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">La Caccia ai Ricordi</h3>
                  <p className="text-sm text-slate-500 mb-4 h-16">Un gioco all'aperto. I giocatori dovranno muoversi fisicamente per Marzio per catturare oggetti e ricordi con la fotocamera.</p>
                  <div className="font-bold text-[#2D5A27] dark:text-[#42a83a] flex items-center gap-1 group-hover:translate-x-1 transition-transform">Scegli <ChevronRight size={16} /></div>
               </button>

               <button onClick={() => { setType('photo_quiz'); setStep(1); }} className="bg-white dark:bg-[#151e18] border-2 border-transparent hover:border-indigo-600 dark:hover:border-indigo-500 rounded-2xl p-6 text-left transition-all shadow-sm group">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-500 flex items-center justify-center mb-4">
                     <HelpCircle size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Il Quiz del Bivacco</h3>
                  <p className="text-sm text-slate-500 mb-4 h-16">Un trivia multiplayer. Ripercorrete la storia di Marzio sfidandovi a riconoscere volti e anni dalle vecchie fotografie.</p>
                  <div className="font-bold text-indigo-600 dark:text-indigo-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Scegli <ChevronRight size={16} /></div>
               </button>
            </div>
         </div>
      );
  }

  if (step === 1) {
     return (
        <div className="max-w-2xl mx-auto h-full flex flex-col py-6 px-4 overflow-y-auto">
           <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setStep(0)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg"><ChevronRight size={20} className="rotate-180" /></button>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                 Dettagli Evento
              </h1>
           </div>
           <div className="bg-white dark:bg-[#151e18] p-6 rounded-2xl border border-slate-100 dark:border-[#24352b] shadow-sm space-y-4">
              <div>
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Titolo</label>
                 <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" placeholder="Es. Caccia Straordinaria / Il Grande Quiz" />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrizione</label>
                 <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" placeholder="Breve lore dell'evento..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data/Ora Inizio</label>
                    <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Moltiplicatore Punti (0.5 – 5.0)</label>
                    <input
                       type="number"
                       step="0.1"
                       min={0.5}
                       max={5}
                       value={pointsMultiplier}
                       onChange={(e) => setPointsMultiplier(e.target.value)}
                       className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white"
                    />
                 </div>
              </div>

              {type === 'treasure_hunt' && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Modalità Spawning</label>
                 <select value={spawnMode} onChange={(e) => setSpawnMode(e.target.value as any)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white mb-4">
                    <option value="manual">Manuale (Tap Mappa)</option>
                    <option value="auto">Automatico (Raggio)</option>
                    <option value="hybrid">Ibrido (Auto + Manuale)</option>
                    <option value="legacy_posts">Legacy (dai Post Geolocalizzati)</option>
                 </select>

                 {spawnMode !== 'legacy_posts' && (
                    <div className="mb-4">
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Preset Template</label>
                       <select value={selectedPresetId} onChange={(e) => {
                          setSelectedPresetId(e.target.value);
                          const preset = PRESETS.find(p => p.id === e.target.value);
                          if (preset) setItemTemplates(preset.templates);
                       }} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white">
                          {PRESETS.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                       </select>
                    </div>
                 )}

                 {spawnMode !== 'legacy_posts' && itemTemplates && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                       <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Composizione Elementi</h4>
                       <div className="space-y-2">
                          {itemTemplates.map((tmpl, idx) => (
                             <div key={idx} className="flex items-center gap-2">
                                <span className="text-2xl">{tmpl.emoji}</span>
                                <input type="text" value={tmpl.label} onChange={(e) => {
                                   const newT = [...itemTemplates];
                                   newT[idx].label = e.target.value;
                                   setItemTemplates(newT);
                                }} className="flex-1 p-2 rounded bg-white dark:bg-slate-700 border-none outline-none dark:text-white text-sm" />
                                <div className="flex items-center gap-1 w-24">
                                   <input
                                      type="number"
                                      min={1}
                                      max={200}
                                      value={tmpl.points}
                                      onChange={(e) => {
                                         const raw = parseInt(e.target.value) || 0;
                                         // Clamp to [1, 200] — the firestore.rules
                                         // items.create check rejects anything outside
                                         // this band (worst-case capture × 5x multiplier
                                         // must stay ≤ +1000 users.points cap).
                                         const clamped = Math.min(200, Math.max(1, raw));
                                         const newT = [...itemTemplates];
                                         newT[idx].points = clamped;
                                         setItemTemplates(newT);
                                      }}
                                      className="w-full p-2 rounded bg-white dark:bg-slate-700 border-none outline-none dark:text-white text-sm text-center"
                                   />
                                   <span className="text-xs text-slate-500">pt</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {spawnMode !== 'manual' && (
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Numero Oggetti</label>
                          <input type="number" min={1} max={100} value={autoCount} onChange={(e) => setAutoCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                       </div>
                       {spawnMode !== 'legacy_posts' && (
                         <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Raggio (metri)</label>
                            <input type="number" min={10} max={5000} value={radius} onChange={(e) => setRadius(Math.min(5000, Math.max(10, parseInt(e.target.value) || 100)))} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                         </div>
                       )}
                    </div>
                 )}
              </div>
              )}

              {type === 'photo_quiz' && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Numero di Round</label>
                        <input type="number" value={totalRounds} onChange={(e) => setTotalRounds(parseInt(e.target.value) || 1)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Secondi per Domanda</label>
                        <input type="number" value={answerTime} onChange={(e) => setAnswerTime(parseInt(e.target.value) || 20)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                    </div>
                 </div>
              </div>
              )}

              {(() => {
                 const baseFieldsValid = !!title && !!description && !!kickoff;
                 const goNext = () => {
                    if (!baseFieldsValid) {
                       const missing: string[] = [];
                       if (!title) missing.push('titolo');
                       if (!description) missing.push('descrizione');
                       if (!kickoff) missing.push('data di inizio');
                       alert(`Compila prima: ${missing.join(', ')}.`);
                       return;
                    }
                    setStep(2);
                 };
                 return type === 'treasure_hunt' ? (
                    <>
                       {!baseFieldsValid && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 -mb-2 mt-2">
                             Compila titolo, descrizione e data prima di posizionare gli elementi.
                          </p>
                       )}
                       <button onClick={goNext} disabled={!baseFieldsValid} className="w-full py-3 mt-4 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500 text-white font-bold transition-colors">
                          Avanti: Posiziona Elementi
                       </button>
                    </>
                 ) : (
                    <button onClick={handleSave} disabled={loading || !baseFieldsValid} className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold transition-colors">
                       {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                       Crea Quiz
                    </button>
                 );
              })()}
           </div>
        </div>
     );
  }

  // Map step for treasure hunt. If we ever land here with the base fields
  // empty (legacy state, refresh while on step 2, etc.) bounce the user
  // back to step 1 instead of letting handleSave fail with a misleading
  // "Compila tutti i campi base" alert from a screen that shows no fields.
  if (!title || !description || !kickoff) {
     return (
        <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center p-6 gap-4">
           <Trophy size={40} className="text-amber-500" />
           <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Mancano i dettagli dell'evento</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Devi prima compilare titolo, descrizione e data di inizio prima di posizionare gli elementi sulla mappa.
           </p>
           <button onClick={() => setStep(1)} className="mt-2 px-6 py-3 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl font-bold text-sm transition-colors">
              Torna ai Dettagli Evento
           </button>
        </div>
     );
  }

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="flex items-center justify-between px-4 mb-4 gap-2">
         <h1 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-200 truncate">Posiziona gli item ({items.length})</h1>
         <div className="flex gap-2 shrink-0">
            <button
               onClick={() => setShowCitySearch(true)}
               aria-label="Cerca città o indirizzo"
               title="Cerca per città o indirizzo"
               className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
            >
               <Search size={16} />
            </button>
            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg font-bold text-sm">Indietro</button>
            <button onClick={handleSave} disabled={loading || items.length === 0} className="px-4 py-2 bg-[#2D5A27] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm flex items-center gap-2">
               {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva
            </button>
         </div>
      </div>

      {spawnMode !== 'manual' && (
         <div className="px-4 mb-4 flex justify-end gap-2">
            <button onClick={() => setItems([])} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">Resetta</button>
            <button
               onClick={spawnMode === 'legacy_posts' ? handleGenerateLegacy : handleGenerateAuto}
               className="px-3 py-1 bg-[#2D5A27] text-white rounded text-xs font-bold flex items-center gap-1"
            >
               <Wand2 size={14} /> Genera Ora
            </button>
         </div>
      )}

      <div className="flex-1 rounded-t-2xl overflow-hidden relative border-t-2 border-[#2D5A27] min-h-[400px] w-full flex flex-col">
         <div className="flex-1 relative w-full h-full">
            <MapContainer center={center} zoom={15} className="w-full h-full absolute inset-0 z-0 font-sans" style={{ width: '100%', height: '100%', minHeight: '400px' }}>
               <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
               <MapClickHandler onClick={handleMapClick} enabled={isSettingCenter || spawnMode === 'manual' || spawnMode === 'hybrid'} />
               <SetView center={center} />
               {items.map((item, i) => (
                  <Marker key={i} position={[item.lat, item.lng]} icon={customIcon} />
               ))}
            </MapContainer>
         </div>

         {/* Overlays */}
         <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
            <button
               onClick={handleCenterOnMe}
               disabled={!userPosition}
               aria-label="Centra la mappa sulla mia posizione"
               title={userPosition ? 'Centra su di me' : 'GPS non ancora disponibile'}
               className="p-3 bg-white rounded-full shadow-lg text-slate-700 pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
               <LocateFixed size={20} />
            </button>
            <button
               onClick={() => setIsSettingCenter(!isSettingCenter)}
               aria-label="Imposta centro mappa con un tap"
               title="Imposta il centro toccando la mappa"
               className={`p-3 rounded-full shadow-lg pointer-events-auto ${isSettingCenter ? 'bg-[#2D5A27] text-white' : 'bg-white text-slate-700'}`}
            >
               <MapPin size={20} />
            </button>
         </div>

         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 pointer-events-none flex items-center gap-2 max-w-[calc(100%-7rem)]">
            {isSettingCenter ? (
                <><MapPin size={16} className="text-red-500 shrink-0" /> <span className="truncate">Tocca la mappa per impostare il centro</span></>
            ) : !userPosition ? (
                <><Loader2 size={14} className="animate-spin text-[#2D5A27] shrink-0" /> <span className="truncate">Recupero posizione GPS...</span></>
            ) : ( (spawnMode === 'manual' || spawnMode === 'hybrid') ? (
               <><MapPin size={16} className="text-[#2D5A27] shrink-0" /> <span className="truncate">Tocca mappa per spawn manuale</span></>
            ) : (
               <><Wand2 size={16} className="text-[#2D5A27] shrink-0" /> <span className="truncate">Clicca Genera per {autoCount} oggetti</span></>
            ))}
         </div>
      </div>

      {showCitySearch && (
         <div className="fixed inset-0 z-[1100] flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCitySearch(false)}>
            <div className="w-full max-w-md bg-white dark:bg-[#151e18] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#24352b] overflow-hidden mt-16 sm:mt-0" onClick={(e) => e.stopPropagation()}>
               <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#24352b]">
                  <h3 className="font-serif font-bold text-base text-[#1a2e16] dark:text-slate-200 flex items-center gap-2"><Search size={16} /> Cerca città o indirizzo</h3>
                  <button onClick={() => setShowCitySearch(false)} aria-label="Chiudi" className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
               </div>
               <form onSubmit={handleCitySearch} className="p-4 flex gap-2">
                  <input
                     type="text"
                     value={cityQuery}
                     onChange={(e) => setCityQuery(e.target.value)}
                     placeholder="Es. Marzio, Varese, Piazza San Marco"
                     autoFocus
                     className="flex-1 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#2D5A27]"
                  />
                  <button type="submit" disabled={citySearching || !cityQuery.trim()} className="px-4 py-2 bg-[#2D5A27] hover:bg-[#23471f] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm flex items-center gap-1">
                     {citySearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Cerca
                  </button>
               </form>
               {cityResults.length > 0 && (
                  <ul className="max-h-64 overflow-y-auto border-t border-slate-100 dark:border-[#24352b]">
                     {cityResults.map((r, idx) => (
                        <li key={idx}>
                           <button
                              type="button"
                              onClick={() => pickCityResult(r.lat, r.lon)}
                              className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a261f] border-b border-slate-50 dark:border-[#24352b] last:border-0 flex items-start gap-2"
                           >
                              <MapPin size={14} className="text-[#2D5A27] mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{r.display_name}</span>
                           </button>
                        </li>
                     ))}
                  </ul>
               )}
               {!citySearching && cityResults.length === 0 && cityQuery && (
                  <p className="px-4 pb-4 text-xs text-slate-400 dark:text-slate-500">
                     Premi Cerca o invio. I risultati provengono da OpenStreetMap.
                  </p>
               )}
            </div>
         </div>
      )}
    </div>
  );
}
