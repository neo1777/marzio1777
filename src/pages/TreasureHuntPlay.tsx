import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../contexts/AuthContext';
import { useGameEvent, captureItemTransaction } from '../hooks/useGameEvents';
import { useHighAccuracyPosition, calculateDistance } from '../hooks/useHighAccuracyPosition';
import { getHotColdStatus, GameItem } from '../hooks/useNearestItem';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Compass, Crosshair, Radar } from 'lucide-react';
import ARCaptureLayer from '../components/ARCaptureLayer';
import CompassArrow from '../components/CompassArrow';
import { useWakeLock } from '../hooks/useWakeLock';
import { createMarkerIcon } from '../lib/leafletIcons';

const userIcon = createMarkerIcon('blue');
const spawnedIcon = createMarkerIcon('gold');

// A component to recenter map and fix sizing
function MapController({ lat, lng, itemsCount, arOpen, status }: { lat: number, lng: number, itemsCount: number, arOpen: boolean, status?: string }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map, itemsCount, arOpen, status]);

  return <Marker position={[lat, lng]} icon={userIcon} />;
}

export default function TreasureHuntPlay() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { event } = useGameEvent(eventId || '');
  const { position } = useHighAccuracyPosition();
  
  const [items, setItems] = useState<GameItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [activeArItem, setActiveArItem] = useState<GameItem | null>(null);

  // Keeps the screen awake during an active hunt; auto re-acquires after
  // visibilitychange and degrades cleanly under restrictive permissions policy
  // (e.g. iframe previews). See useWakeLock for the feature-policy guard.
  useWakeLock(event?.status === 'active');

  useEffect(() => {
     if (!eventId) return;
     const q = query(collection(db, `game_events/${eventId}/items`));
     const unsub = onSnapshot(q, (snapshot) => {
        const arr: GameItem[] = [];
        snapshot.forEach(d => arr.push({ id: d.id, ...d.data() } as GameItem));
        setItems(arr);
        setLoadingItems(false);
     });
     return () => unsub();
  }, [eventId]);

  const activeItems = items.filter(i => i.status === 'spawned');
  const myCollectedItems = items.filter(i => i.status === 'collected' && i.collectedBy === user?.uid);

  // Find Nearest
  let nearestItem: GameItem | null = null;
  let minDistance: number | null = null;

  if (position && activeItems.length > 0) {
     minDistance = Infinity;
     activeItems.forEach(item => {
        const dist = calculateDistance(position.lat, position.lng, item.lat, item.lng);
        if (dist < minDistance!) {
           minDistance = dist;
           nearestItem = item;
        }
     });
  }

  const handleOpenAR = (item: GameItem) => {
     if (!position) return;
     const dist = calculateDistance(position.lat, position.lng, item.lat, item.lng);
     if (dist > 15 && process.env.NODE_ENV !== 'development') { // Limit distance in production
        alert(`Sei troppo lontano! Avvicinati ancora di ${(dist - 15).toFixed(0)}m`);
        return;
     }

     if (navigator.vibrate) navigator.vibrate(60);
     setActiveArItem(item);
  };

  const handleCaptureCommit = async (item: GameItem) => {
     if (!user || !eventId || !profile) return;
     try {
        await captureItemTransaction(eventId, item.id, user.uid, profile.displayName || 'Giocatore', item.label || 'Mistero', item.points, event?.pointsMultiplier || 1, position?.lat, position?.lng);
        if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
        setActiveArItem(null);
     } catch(e: any) {
        console.error(e);
        alert(e.message || 'Errore durante la cattura!');
        setActiveArItem(null);
     }
  };

  if (!event || event.status !== 'active') {
     return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-[#151e18]">
           <Trophy size={48} className="text-slate-400 mb-4" />
           <p className="font-bold text-slate-700 dark:text-slate-300">Partita non attiva o terminata.</p>
           <button onClick={() => navigate(`/dashboard/giochi`)} className="mt-4 px-4 py-2 bg-[#2D5A27] text-white rounded-lg font-bold">Torna al Campo</button>
        </div>
     );
  }

  const radar = getHotColdStatus(minDistance);

  return (
     <div className="h-full flex flex-col relative overflow-hidden bg-slate-100 dark:bg-[#1a261f]">
        
        {activeArItem && (
           <ARCaptureLayer 
              item={activeArItem} 
              onCatch={handleCaptureCommit} 
              onCancel={() => setActiveArItem(null)} 
           />
        )}

        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
           <div className="flex items-center justify-between pointer-events-auto">
               <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-lg px-4 py-3 rounded-2xl flex items-center gap-3 border border-slate-200 dark:border-slate-700">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center">
                     <Trophy size={20} />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Punteggio (MVP)</p>
                     <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        {myCollectedItems.reduce((acc, i) => acc + i.points, 0) * (event.pointsMultiplier ?? 1)} pt
                     </p>
                  </div>
               </div>
               
               <button onClick={() => navigate(`/dashboard/giochi/${eventId}/lobby`)} className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-lg w-12 h-12 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-md">
                  <Compass size={24} />
               </button>
           </div>

           <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-lg px-4 py-3 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700 pointer-events-auto">
              <div className="flex items-center gap-3">
                 <Radar size={20} className={`${radar.color} ${radar.pulse ? 'animate-pulse' : ''}`} />
                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Radar</p>
                    <p className={`font-bold ${radar.color}`}>{radar.label}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rimasti</p>
                 <p className="font-bold text-slate-800 dark:text-slate-200">{activeItems.length}</p>
              </div>
           </div>
        </div>

        {/* Compass Pointer */}
        {nearestItem && position && (
           <div className="absolute right-4 bottom-8 z-[1000] pointer-events-none">
              <CompassArrow 
                playerPos={{ lat: position.lat, lng: position.lng }} 
                targetPos={{ lat: nearestItem.lat, lng: nearestItem.lng }} 
              />
           </div>
        )}

        {/* Map */}
        <div className="flex-1 w-full bg-slate-200 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-0 relative min-h-[300px] flex flex-col">
           {position ? (
              <div className="flex-1 relative w-full h-full">
                 <MapContainer center={[position.lat, position.lng]} zoom={18} zoomControl={false} className="w-full h-full absolute inset-0 font-sans" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    
                    <MapController lat={position.lat} lng={position.lng} itemsCount={activeItems.length} arOpen={activeArItem !== null} status={event?.status} />

                    {activeItems.map(item => (
                       <Marker key={item.id} position={[item.lat, item.lng]} icon={spawnedIcon}>
                          <Popup className="font-sans">
                             <div className="text-center">
                                <p className="font-bold text-lg mb-1">{item.emoji}</p>
                                <p className="font-bold text-sm mb-2 text-slate-600">{item.points * (event.pointsMultiplier ?? 1)} pt</p>
                                <button
                                   onClick={() => handleOpenAR(item)}
                                   className="bg-[#2D5A27] hover:bg-[#23471f] text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors min-h-[56px] w-full mt-2"
                                   aria-label={`Cattura ${item.label} in AR`}
                                >
                                   📸 CATTURA IN AR
                                </button>
                             </div>
                          </Popup>
                       </Marker>
                    ))}
                 </MapContainer>
              </div>
           ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                 <div className="text-center animate-pulse text-slate-400">
                    <Crosshair size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-bold tracking-widest uppercase text-sm">Ricerca Satellite...</p>
                 </div>
              </div>
           )}
        </div>
     </div>
  );
}
