import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin } from 'lucide-react';

const customMarkerHtml = `
  <div style="background-color: #4f46e5; width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 2px solid #818cf8; box-shadow: 0 0 10px rgba(79, 70, 229, 0.5); display: flex; align-items: center; justify-content: center;">
    <div style="background-color: white; width: 0.5rem; height: 0.5rem; border-radius: 50%;"></div>
  </div>
`;

const bentoIcon = L.divIcon({
    html: customMarkerHtml,
    className: 'custom-bento-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

L.Marker.prototype.options.icon = bentoIcon;

export default function LaMappa() {
  const [posts, setPosts] = useState<any[]>([]);
  const marzioCenter: [number, number] = [45.9238, 8.8655];

  useEffect(() => {
    const q = query(collection(db, 'posts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.location) p.push({ id: doc.id, ...data });
      });
      setPosts(p);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="h-full w-full relative flex flex-col rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
       <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur border border-slate-800 p-4 rounded-xl shadow-lg hidden md:block">
         <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-200">Mappa Ricordi</h2>
            <MapPin size={14} className="text-indigo-400" />
         </div>
         <p className="text-[10px] font-mono text-slate-500 uppercase">Geolocalizzazione Nodi</p>
       </div>
       
       <MapContainer center={marzioCenter} zoom={15} className="w-full flex-1 z-0" zoomControl={false}>
          <TileLayer
            attribution='&copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            className="map-tiles"
          />
          {posts.map(post => (
             <Marker key={post.id} position={[post.location.lat, post.location.lng]}>
               <Popup className="bento-popup">
                 <div className="w-56 overflow-hidden bg-slate-900 border border-slate-800 rounded-lg p-0 m-0">
                   {post.imageUrl && <div className="border-b border-slate-800"><img src={post.imageUrl} className="w-full h-32 object-cover opacity-90" alt="Memory" referrerPolicy="no-referrer" /></div>}
                   <div className="p-3">
                     <p className="font-semibold text-slate-200 text-sm mb-1">{post.authorName || 'Nodo Anonimo'}</p>
                     <p className="text-[10px] font-mono text-indigo-400 mb-2 uppercase">{post.decade} • {post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { locale: it }) : ''}</p>
                     <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{post.caption}</p>
                   </div>
                 </div>
               </Popup>
             </Marker>
          ))}
       </MapContainer>

       <style>{`
         .leaflet-container { font-family: 'Inter', sans-serif; background-color: #0f172a; }
         .leaflet-popup-content-wrapper { padding: 0; background: transparent; box-shadow: none; border-radius: 0.5rem; overflow: hidden; }
         .leaflet-popup-content { margin: 0; width: auto !important; }
         .leaflet-popup-tip { background: #0f172a; border: 1px solid #1e293b; }
         .bento-popup .leaflet-popup-content-wrapper {
             background-color: transparent;
         }
       `}</style>
    </div>
  );
}
