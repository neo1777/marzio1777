import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createGameEvent, createGameItem, advanceGameEventStatus } from '../hooks/useGameEvents';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Save, MapPin, Trophy, Wand2, HelpCircle, Compass, ChevronRight } from 'lucide-react';
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

const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function GameCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { position: userPosition } = useHighAccuracyPosition();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Event Data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoff, setKickoff] = useState('');
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
  const [center, setCenter] = useState<[number, number]>([41.9028, 12.4964]); 

  // Initialize center to user position
  useEffect(() => {
    if (userPosition && !isSettingCenter && items.length === 0) {
      setCenter([userPosition.lat, userPosition.lng]);
    }
  }, [userPosition]);

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
      return;
    }
    if (spawnMode !== 'manual' && spawnMode !== 'hybrid') return;
    const tmpl = pickTemplate();
    setItems((prev) => [
      ...prev,
      { lat: latlng.lat, lng: latlng.lng, points: tmpl.points, templateId: tmpl.id, emoji: tmpl.emoji, label: tmpl.label }
    ]);
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
     } catch(e) {
        console.error(e);
        alert("Errore caricamento posts");
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

    setLoading(true);
    try {
      const kickoffDate = new Date(kickoff);
      
      const eventData: any = {
         title,
         description,
         type,
         pointsMultiplier: parseFloat(pointsMultiplier),
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
    } catch (error) {
      console.error(error);
      alert("Errore durante la creazione");
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
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Moltiplicatore Punti</label>
                    <input type="number" step="0.1" value={pointsMultiplier} onChange={(e) => setPointsMultiplier(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
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
                                   <input type="number" value={tmpl.points} onChange={(e) => {
                                      const newT = [...itemTemplates];
                                      newT[idx].points = parseInt(e.target.value) || 0;
                                      setItemTemplates(newT);
                                   }} className="w-full p-2 rounded bg-white dark:bg-slate-700 border-none outline-none dark:text-white text-sm text-center" />
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
                          <input type="number" value={autoCount} onChange={(e) => setAutoCount(parseInt(e.target.value) || 1)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
                       </div>
                       {spawnMode !== 'legacy_posts' && (
                         <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Raggio (metri)</label>
                            <input type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value) || 100)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none dark:text-white" />
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

              {type === 'treasure_hunt' ? (
                 <button onClick={() => setStep(2)} className="w-full py-3 mt-4 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white font-bold transition-colors">
                    Avanti: Posiziona Elementi
                 </button>
              ) : (
                 <button onClick={handleSave} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Crea Quiz
                 </button>
              )}
           </div>
        </div>
     );
  }

  // Map step for treasure hunt
  return (
    <div className="h-full flex flex-col pt-4">
      <div className="flex items-center justify-between px-4 mb-4">
         <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Posiziona gli item ({items.length})</h1>
         <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg font-bold text-sm">Indietro</button>
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-[#2D5A27] text-white rounded-lg font-bold text-sm flex items-center gap-2">
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
            <button onClick={() => { if(userPosition) setCenter([userPosition.lat, userPosition.lng]) }} className="p-3 bg-white rounded-full shadow-lg text-slate-700 pointer-events-auto"><Compass size={20} /></button>
            <button onClick={() => setIsSettingCenter(!isSettingCenter)} className={`p-3 rounded-full shadow-lg pointer-events-auto ${isSettingCenter ? 'bg-[#2D5A27] text-white' : 'bg-white text-slate-700'}`}><MapPin size={20} /></button>
         </div>

         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-200 text-sm font-bold text-slate-700 pointer-events-none flex items-center gap-2">
            {isSettingCenter ? (
                <><MapPin size={16} className="text-red-500" /> Tocca la mappa per impostare il centro</>
            ) : ( (spawnMode === 'manual' || spawnMode === 'hybrid') ? (
               <><MapPin size={16} className="text-[#2D5A27]" /> Tocca mappa per spawn manuale</>
            ) : (
               <><Wand2 size={16} className="text-[#2D5A27]" /> Clicca Genera per {autoCount} oggetti</>
            ))}
         </div>
      </div>
    </div>
  );
}
