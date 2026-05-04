import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, or, and } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Map, MapPin } from 'lucide-react';
import { useRBAC } from '../hooks/useRBAC';
import { Avatar } from '../components/ui';
import { liveUserAvatarHtml } from '../lib/leafletIcons';

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

const createLiveUserIcon = (user: any) => {
  const name = user.displayName?.split(' ')[0] || 'User';
  // Offline-safe avatar HTML — mirrors <Avatar> policy (photoURL preferred,
  // initial-on-#2D5A27 fallback). Replaces the previous DiceBear CDN URL.
  const avatarHtml = liveUserAvatarHtml({ photoURL: user.photoURL, name: user.displayName, size: 36 });

  return L.divIcon({
    html: `
      <div style="display: flex; flex-direction: column; items-center; justify-content: center; transform: translate(-50%, -100%); width: 60px;">
         <div style="position: relative; width: 36px; height: 36px; margin: 0 auto;">
            ${avatarHtml}
            <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background-color: #10b981; border: 2px solid white; border-radius: 50%;"></div>
         </div>
         <div style="background-color: rgba(16, 185, 129, 0.9); color: white; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 12px; margin-top: 4px; text-align: center; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif;">
            ${name}
         </div>
      </div>
    `,
    className: 'live-user-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -45]
  });
};

export default function LaMappa() {
  const { user, profile, isGuest, isPending } = useRBAC();
  const [posts, setPosts] = useState<any[]>([]);
  const marzioCenter: [number, number] = [45.9238, 8.8655];
  const [isDark, setIsDark] = useState(false);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    if (!user) return;
    if (isPending || isGuest) {
        setPosts([]);
        setLiveUsers([]);
        return;
    }
    
    // Explicit list query to satisfy strict security rules for posts
    const qPosts = query(
      collection(db, 'posts'),
      or(
        where('visibilityStatus', 'in', ['public', 'scheduled']),
        where('authorId', '==', user.uid)
      )
    );
    
    const unsubscribePosts = onSnapshot(qPosts, (snapshot) => {
      const p: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.location) {
           let isVisible = false;
           if (data.authorId === user.uid) {
              isVisible = true;
           } else if (data.visibilityStatus === 'public') {
              isVisible = true;
           } else if (data.visibilityStatus === 'scheduled' && data.visibilityTime && data.visibilityTime <= Date.now()) {
              isVisible = true;
           } else if (!data.visibilityStatus) {
              isVisible = true;
           }
           
           if (isVisible) {
              p.push({ id: doc.id, ...data });
           }
        }
      });
      setPosts(p);
    });

    // Explicit list query to satisfy security rules for user_locations
    const qUsers = query(collection(db, 'user_locations'), where('shareLiveLocation', '==', true));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
       const u: any[] = [];
       const now = Date.now();
       snapshot.forEach(doc => {
          const data = doc.data();
          if (data.shareLiveLocation && data.liveLocation) {
             // Only show if updated in the last 15 minutes (900000 ms) to avoid stale data
             if (data.liveLocation.updatedAt && (now - data.liveLocation.updatedAt.toMillis()) < 900000) {
                u.push({ id: doc.id, ...data });
             }
          }
       });
       setLiveUsers(u);
    });

    return () => {
       unsubscribePosts();
       unsubscribeUsers();
    };
  }, [user]);

  const decades = Array.from(new Set(posts.map(p => p.decade).filter(Boolean))).sort() as string[];
  const authors = Array.from(new Set(posts.map(p => p.authorName || 'Anonimo'))).sort() as string[];

  const filteredPosts = posts.filter(post => {
      const matchDecade = selectedDecade === 'all' || post.decade === selectedDecade;
      const matchAuthor = selectedAuthor === 'all' || (post.authorName || 'Anonimo') === selectedAuthor;
      return matchDecade && matchAuthor;
  });

  return (
    <div className="max-w-4xl mx-auto w-full h-[calc(100vh-8rem)] md:h-full flex flex-col gap-4 p-4 md:p-0">
       <header className="flex flex-col border-b border-slate-200 dark:border-[#24352b] pb-2 md:pb-4 transition-colors shrink-0">
         <h2 className="text-xs font-bold font-sans uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Cartografia Storica</h2>
         <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a] tracking-tight">
            La Mappa <Map size={24} className="text-[#8B5A2B]" />
         </div>
       </header>

       <div className="flex-1 bg-white dark:bg-[#151e18] p-2 md:p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-[#24352b] relative z-0 flex flex-col transition-colors">
          <div className="absolute top-6 left-6 z-[400] bg-white/90 dark:bg-[#111814]/90 backdrop-blur border border-slate-200 dark:border-[#24352b] p-4 rounded-xl shadow-md transition-colors">
             <div 
               className="flex items-center justify-between gap-4 cursor-pointer" 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
             >
                 <div className="flex items-center gap-2 mb-1">
                     <h2 className="text-sm font-bold font-sans uppercase tracking-widest text-slate-700 dark:text-slate-200">Mappa Ricordi</h2>
                     <MapPin size={16} className="text-[#8B5A2B]" />
                 </div>
                 <div className="text-xs font-bold text-slate-500">{isFilterOpen ? 'Nascondi Filtri' : 'Filtra'}</div>
             </div>
             <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400 uppercase">Luoghi Mostrati: {filteredPosts.length} / {posts.length}</p>
             
             {isFilterOpen && (
               <div className="mt-4 flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-[#24352b]">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Decennio</label>
                    <select 
                       value={selectedDecade} 
                       onChange={e => setSelectedDecade(e.target.value)}
                       className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded p-1 text-xs outline-none text-slate-700 dark:text-slate-300"
                    >
                       <option value="all">Tutti i decenni</option>
                       {decades.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Autore</label>
                    <select 
                       value={selectedAuthor} 
                       onChange={e => setSelectedAuthor(e.target.value)}
                       className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded p-1 text-xs outline-none text-slate-700 dark:text-slate-300"
                    >
                       <option value="all">Tutti gli autori</option>
                       {authors.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
               </div>
             )}
          </div>
          
          <div className="flex-1 min-h-[300px] md:min-h-0 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-[#24352b] bg-[#F4F1E1] dark:bg-[#0d1310] transition-colors relative">
            <div className="absolute inset-0">
               <MapContainer center={marzioCenter} zoom={16} className="w-full h-full z-0" zoomControl={true} key={isDark ? 'dark' : 'light'}>
               <LayersControl position="topright">
                 <LayersControl.BaseLayer name="Esploratore (Satellitare HDR)">
                   <TileLayer
                     attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                     url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>
                 
                 <LayersControl.BaseLayer name="Sentieri e Strade (OpenStreetMap)" checked={true}>
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

                 <LayersControl.BaseLayer name="Visione Notturna">
                   <TileLayer
                     attribution='&copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
                     url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                     maxZoom={19}
                   />
                 </LayersControl.BaseLayer>
               </LayersControl>

               {filteredPosts.map(post => (
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
               
               {liveUsers.map(liveUser => (
                  <Marker key={liveUser.id} position={[liveUser.liveLocation.lat, liveUser.liveLocation.lng]} icon={createLiveUserIcon(liveUser)}>
                     <Popup className={`vintage-popup ${isDark ? 'dark-mode-popup' : ''}`}>
                        <div className="w-48 overflow-hidden bg-emerald-50 dark:bg-[#132c1c] border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 m-0 shadow-xl flex items-center gap-3">
                           <div className="relative">
                              <Avatar photoURL={liveUser.photoURL} name={liveUser.displayName} size="md" className="border-2 border-emerald-500" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                           </div>
                           <div>
                              <p className="font-bold font-sans text-emerald-900 dark:text-emerald-100 text-sm leading-tight">{liveUser.displayName}</p>
                              <p className="text-[10px] font-sans font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-1">In Movimento</p>
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
