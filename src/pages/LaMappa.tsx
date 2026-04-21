import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Map, MapPin } from 'lucide-react';

const customMarkerHtmlLight = `
  <div style="background-color: #2D5A27; width: 1.5rem; height: 1.5rem; border-radius: 50% 50% 50% 0; border: 2px solid #fff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;">
    <div style="background-color: white; width: 0.5rem; height: 0.5rem; border-radius: 50%;"></div>
  </div>
`;

const customMarkerHtmlDark = `
  <div style="background-color: #42a83a; width: 1.5rem; height: 1.5rem; border-radius: 50% 50% 50% 0; border: 2px solid #111814; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;">
    <div style="background-color: #111814; width: 0.5rem; height: 0.5rem; border-radius: 50%;"></div>
  </div>
`;

const vintageIconLight = L.divIcon({
    html: customMarkerHtmlLight,
    className: 'custom-bento-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

const vintageIconDark = L.divIcon({
    html: customMarkerHtmlDark,
    className: 'custom-bento-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

export default function LaMappa() {
  const [posts, setPosts] = useState<any[]>([]);
  const marzioCenter: [number, number] = [45.9238, 8.8655];
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    L.Marker.prototype.options.icon = isDark ? vintageIconDark : vintageIconLight;
  }, [isDark]);


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
    <div className="max-w-4xl mx-auto w-full h-[calc(100vh-8rem)] md:h-full flex flex-col gap-4 p-4 md:p-0">
       <header className="flex flex-col border-b border-slate-200 dark:border-[#24352b] pb-2 md:pb-4 transition-colors shrink-0">
         <h2 className="text-xs font-bold font-sans uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Cartografia Storica</h2>
         <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a] tracking-tight">
            La Mappa <Map size={24} className="text-[#8B5A2B]" />
         </div>
       </header>

       <div className="flex-1 bg-white dark:bg-[#151e18] p-2 md:p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-[#24352b] relative z-0 flex flex-col transition-colors">
          <div className="absolute top-6 left-6 z-[400] bg-white/90 dark:bg-[#111814]/90 backdrop-blur border border-slate-200 dark:border-[#24352b] p-4 rounded-xl shadow-md hidden md:block transition-colors">
             <div className="flex items-center gap-2 mb-1">
                 <h2 className="text-sm font-bold font-sans uppercase tracking-widest text-slate-700 dark:text-slate-200">Mappa Ricordi</h2>
                 <MapPin size={16} className="text-[#8B5A2B]" />
             </div>
             <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400 uppercase">Luoghi Esplorati: {posts.length}</p>
          </div>
          
          <div className="flex-1 min-h-[300px] md:min-h-0 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-[#24352b] bg-[#F4F1E1] dark:bg-[#0d1310] transition-colors relative">
            <div className="absolute inset-0">
               <MapContainer center={marzioCenter} zoom={16} className="w-full h-full z-0" zoomControl={true} key={isDark ? 'dark' : 'light'}>
               <LayersControl position="topright">
                 <LayersControl.BaseLayer name="Esploratore (Satellitare HDR)" checked={!isDark}>
                   <TileLayer
                     attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                     url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>
                 
                 <LayersControl.BaseLayer name="Sentieri e Strade (OpenStreetMap)">
                   <TileLayer
                     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                     url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>

                 <LayersControl.BaseLayer name="Mappa Vintage (Esri Topo)">
                   <TileLayer
                     attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                     url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>

                 <LayersControl.BaseLayer name="Visione Notturna" checked={isDark}>
                   <TileLayer
                     attribution='&copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
                     url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>
               </LayersControl>

               {posts.map(post => (
                  <Marker key={post.id} position={[post.location.lat, post.location.lng]}>
                    <Popup className={`vintage-popup ${isDark ? 'dark-mode-popup' : ''}`}>
                      <div className="w-56 overflow-hidden bg-slate-50 dark:bg-[#151e18] border border-slate-200 dark:border-[#24352b] rounded-lg p-1 m-0 shadow-xl transition-colors">
                        {post.imageUrl && <div className="border border-slate-200 dark:border-[#24352b] rounded bg-white dark:bg-[#111814] p-1 mb-2"><img src={post.imageUrl} className="w-full h-32 object-cover rounded-sm" alt="Memory" referrerPolicy="no-referrer" /></div>}
                        <div className="px-2 pb-2">
                          <p className="font-bold font-sans text-[#1a2e16] dark:text-[#e2e8f0] text-sm mb-1">{post.authorName || 'Villeggiante Anonimo'}</p>
                          <p className="text-[10px] font-sans font-bold text-[#2D5A27] dark:text-[#42a83a] mb-2 uppercase">{post.decade} • {post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { locale: it }) : ''}</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-serif italic line-clamp-3 leading-relaxed">"{post.caption}"</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
               ))}
            </MapContainer>
            </div>
          </div>

          <style>{`
            .leaflet-container { font-family: 'Inter', sans-serif; background-color: ${isDark ? '#0d1310' : '#F4F1E1'}; }
            .leaflet-popup-content-wrapper { padding: 0; background: transparent; box-shadow: none; border-radius: 0.5rem; overflow: hidden; }
            .leaflet-popup-content { margin: 0; width: auto !important; }
            .leaflet-popup-tip { background: ${isDark ? '#151e18' : '#f8fafc'}; border: 1px solid ${isDark ? '#24352b' : '#e2e8f0'}; }
            .vintage-popup .leaflet-popup-content-wrapper { background-color: transparent; }
          `}</style>
       </div>
    </div>
  );
}
