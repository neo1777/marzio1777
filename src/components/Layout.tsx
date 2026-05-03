import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Camera, Map as MapIcon, TreeDeciduous, LogOut, Award, ChevronUp, ShieldAlert, Mountain, Moon, Sun, Flame, UserCircle, Film, BookOpen, Trophy, Disc3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function Layout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [alberoneUnread, setAlberoneUnread] = useState(0);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    if (!user) return;
    if (profile?.accountStatus === 'pending' || profile?.role === 'Guest') return;
    
    if (location.pathname === '/dashboard/alberone') {
       localStorage.setItem('alberoneLastRead', Date.now().toString());
       setAlberoneUnread(0);
       return;
    }

    const lastReadStr = localStorage.getItem('alberoneLastRead');
    const lastReadMs = lastReadStr ? parseInt(lastReadStr, 10) : (Date.now() - 1000 * 60 * 60 * 24);
    const lastReadDate = new Date(lastReadMs);

    const q = query(
      collection(db, 'chats/alberone_principale/messages'),
      where('timestamp', '>', lastReadDate),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
       let count = 0;
       snapshot.forEach(doc => {
          const data = doc.data();
          if (data.authorId !== user.uid) {
             count++;
          }
       });
       setAlberoneUnread(count);
    }, (err) => console.error("Chat unread hook error:", err));

    return () => unsubscribe();
  }, [user, location.pathname, profile?.role, profile?.accountStatus]);

  const [pendingUsers, setPendingUsers] = useState(0);

  useEffect(() => {
     if (!user || !profile) return;
     if (profile.role === 'Admin' || profile.role === 'Root') {
        const q = query(collection(db, 'users'), where('accountStatus', '==', 'pending'));
        const unsub = onSnapshot(q, (snap) => {
           setPendingUsers(snap.size);
        });
        return () => unsub();
     }
  }, [user, profile]);

  const points = profile?.points || 0;
  const baseAltitude = 728; // Marzio altitude
  const currentAltitude = baseAltitude + points;

  // Simple badges derivation based on points/metrics
  const hasVillegiante = points >= 10;
  const hasCustode = points >= 50;
  const hasSindaco = points >= 150;
  
  return (
    <div className="h-[100dvh] bg-[#F7F5F0] dark:bg-[#0d1310] text-[#1a2e16] dark:text-[#e2e8f0] flex flex-col md:flex-row md:p-6 md:gap-6 overflow-hidden font-sans relative transition-colors duration-300">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-[#2D5A27]/5 dark:bg-[#2D5A27]/10 -z-10 rounded-l-full blur-3xl"></div>

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#151e18] border border-slate-100 dark:border-[#24352b] rounded-2xl flex-shrink-0 shadow-lg overflow-hidden relative transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-[#24352b] flex justify-between items-start bg-slate-50/50 dark:bg-[#1a261f]/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex-shrink-0 bg-[#2D5A27] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#2D5A27]/20">
                <Mountain size={20} />
             </div>
             <div>
               <h1 className="text-lg font-serif font-bold tracking-tight text-[#2D5A27] dark:text-[#42a83a] leading-tight">marzio1777</h1>
               <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight mt-0.5">by Neo1777</p>
             </div>
          </div>
          <div className="flex gap-1">
             <button onClick={toggleTheme} className="text-slate-400 hover:text-[#2D5A27] dark:hover:text-[#42a83a] transition-colors p-1.5 bg-slate-100 dark:bg-[#24352b] rounded-md">
               {isDark ? <Sun size={14} /> : <Moon size={14} />}
             </button>
             <button onClick={() => navigate('/dashboard/profilo')} className="text-slate-400 hover:text-[#2D5A27] dark:hover:text-[#42a83a] transition-colors p-1.5 bg-slate-100 dark:bg-[#24352b] rounded-md">
               <UserCircle size={14} />
             </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 py-6 overflow-y-auto">
          <NavItem to="/dashboard/piazza" icon={<Home size={18} />} label="La Piazza" />
          <NavItem to="/dashboard/bivacco" icon={<Flame size={18} />} label="Il Bivacco" />
          <NavItem to="/dashboard/cinematografo" icon={<Film size={18} />} label="Il Cinematografo" />
          <NavItem to="/dashboard/giochi" icon={<Trophy size={18} />} label="Il Campo dei Giochi" />
          <NavItem to="/dashboard/baule" icon={<Camera size={18} />} label="Il Baule" />
          <NavItem to="/dashboard/ainulindale/biblioteca" icon={<Disc3 size={18} />} label="L'Ainulindalë" />
          <NavItem to="/dashboard/mappa" icon={<MapIcon size={18} />} label="Mappa Ricordi" />
          <NavItem to="/dashboard/alberone" icon={<TreeDeciduous size={18} />} label="L'Alberone" badge={alberoneUnread} />
          {(profile?.role === 'Root' || profile?.role === 'Admin') && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[#24352b]">
              <NavItem to="/dashboard/admin" icon={<ShieldAlert size={18} />} label="Gestione" admin badge={pendingUsers} />
              <NavItem to="/dashboard/istruzioni" icon={<BookOpen size={18} />} label="Istruzioni (Doc)" admin />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-[#24352b] bg-slate-50/50 dark:bg-[#1a261f]/50">
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between px-2">
               <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Altitudine</span>
               <span className="text-xs font-sans text-[#2D5A27] dark:text-[#42a83a] font-bold flex items-center gap-1"><ChevronUp size={12}/>{currentAltitude}m</span>
            </div>
            {hasVillegiante && (
              <div className="px-2 py-1.5 bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-md flex items-center gap-2">
                <Award size={12} className="text-[#F5A623]" />
                <span className="text-[10px] font-sans font-semibold text-amber-700 dark:text-amber-500 uppercase">Il Villeggiante</span>
              </div>
            )}
            {hasCustode && (
              <div className="px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center gap-2">
                <Camera size={12} className="text-blue-500 dark:text-blue-400" />
                <span className="text-[10px] font-sans font-semibold text-blue-700 dark:text-blue-400 uppercase">Custode Baule</span>
              </div>
            )}
            {hasSindaco && (
              <div className="px-2 py-1.5 bg-[#2D5A27]/10 border border-[#2D5A27]/20 rounded-md flex items-center gap-2">
                <Award size={12} className="text-[#2D5A27] dark:text-[#42a83a]" />
                <span className="text-[10px] font-sans font-semibold text-green-800 dark:text-green-500 uppercase">Sindaco di Marzio</span>
              </div>
            )}
          </div>
          
          <div onClick={() => navigate('/dashboard/profilo')} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-[#24352b] transition-colors flex items-center gap-3 mb-4 p-2 bg-white dark:bg-[#111814] border border-slate-100 dark:border-[#24352b] shadow-sm rounded-xl">
            <img src={profile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} className="w-8 h-8 rounded-full border border-slate-200 dark:border-[#24352b]" alt="avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-[#1a2e16] dark:text-[#e2e8f0]">{profile?.displayName}</p>
              <p className={`text-[10px] font-sans uppercase font-bold truncate ${profile?.role === 'Root' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>{profile?.role || 'OSPITE'}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors border border-transparent">
            <LogOut size={14} />
            <span>Lascia il Paese</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 min-w-0 relative flex flex-col bg-white/80 dark:bg-[#151e18]/80 backdrop-blur-sm border md:border-slate-100 dark:md:border-[#24352b] md:rounded-2xl overflow-hidden pt-16 md:pt-0 pb-16 md:pb-0 shadow-xl shadow-slate-200/50 dark:shadow-black/50 transition-colors duration-300">
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#151e18]/90 backdrop-blur border-b border-slate-100 dark:border-[#24352b] flex items-center justify-between px-4 shadow-sm z-10">
          <div className="flex items-center gap-2">
             <Mountain size={20} className="text-[#2D5A27] dark:text-[#42a83a]" />
             <h1 className="text-base font-serif font-bold text-[#2D5A27] dark:text-[#42a83a]">marzio1777</h1>
          </div>
          <div className="flex gap-3">
             <button onClick={toggleTheme} className="text-slate-400 hover:text-[#2D5A27] dark:hover:text-[#42a83a]">
               {isDark ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => navigate('/dashboard/profilo')} className="text-slate-400 hover:text-[#2D5A27] dark:hover:text-[#42a83a]">
                <UserCircle size={20} />
             </button>
          </div>
        </div>
        
        {/* Pending or Guest Overlay */}
        {(profile?.accountStatus === 'pending' || profile?.role === 'Guest') && location.pathname !== '/dashboard/profilo' && (
           <div className="absolute inset-0 bg-white/60 dark:bg-[#151e18]/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                 <ShieldAlert size={32} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#1a2e16] dark:text-slate-200 mb-2">
                 {profile?.accountStatus === 'pending' ? 'Accesso in Attesa' : 'Accesso Ospite'}
              </h2>
              <p className="max-w-md text-slate-600 dark:text-slate-400 leading-relaxed font-sans mb-6">
                 {profile?.accountStatus === 'pending' 
                   ? "La tua richiesta di registrazione è in attesa di approvazione da parte di un Amministratore o del Sindaco. Sarai ricontattato o potrai accedere presto."
                   : "Hai un account Ospite. L'applicazione è riservata e attualmente non puoi vedere i contenuti della comunità."
                 }
              </p>
              <button onClick={logout} className="px-6 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2">
                 <LogOut size={16} />
                 Esci dall'applicazione
              </button>
           </div>
        )}

        <div className="flex-1 overflow-y-auto p-0 md:p-6 scrollbar-hide relative min-h-0">
           <Outlet />
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#151e18] border-t border-slate-100 dark:border-[#24352b] text-slate-400 flex justify-around items-center h-16 pb-safe z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.5)] transition-colors duration-300">
        <MobileNavItem to="/dashboard/piazza" icon={<Home size={22} />} />
        <MobileNavItem to="/dashboard/bivacco" icon={<Flame size={22} />} />
        <MobileNavItem to="/dashboard/giochi" icon={<Trophy size={22} />} />
        <MobileNavItem to="/dashboard/baule" icon={<Camera size={22} />} />
        <MobileNavItem to="/dashboard/ainulindale/biblioteca" icon={<Disc3 size={22} />} />
        <MobileNavItem to="/dashboard/mappa" icon={<MapIcon size={22} />} />
        <MobileNavItem to="/dashboard/alberone" icon={<TreeDeciduous size={22} />} badge={alberoneUnread} />
        {(profile?.role === 'Root' || profile?.role === 'Admin') && (
           <>
              <MobileNavItem to="/dashboard/admin" icon={<ShieldAlert size={22} />} admin badge={pendingUsers} />
              <MobileNavItem to="/dashboard/istruzioni" icon={<BookOpen size={22} />} admin />
           </>
        )}
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label, admin, badge }: { to: string, icon: React.ReactNode, label: string, admin?: boolean, badge?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) => `flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold ${isActive ? (admin ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-[#2D5A27] text-white shadow-md shadow-[#2D5A27]/20') : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a261f] hover:text-[#2D5A27] dark:hover:text-[#42a83a] border border-transparent'}`}>
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3">
             {icon}
             <span>{label}</span>
          </div>
          {!!badge && badge > 0 && (
             <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
               {badge > 9 ? '9+' : badge}
             </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function MobileNavItem({ to, icon, admin, badge }: { to: string, icon: React.ReactNode, admin?: boolean, badge?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) => `relative p-3 rounded-xl transition-all duration-200 ${isActive ? (admin ? 'text-red-500 bg-red-50 dark:bg-red-950/30' : 'text-[#2D5A27] dark:text-[#42a83a] bg-[#2D5A27]/10') : 'text-slate-400 dark:text-slate-500 active:bg-slate-50 dark:active:bg-[#1a261f]'}`}>
      {({ isActive }) => (
        <>
          {icon}
          {!!badge && badge > 0 && (
             <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-[8px] font-bold bg-red-500 text-white rounded-full ring-2 ring-white dark:ring-[#151e18]">
               {badge > 9 ? '9+' : badge}
             </span>
          )}
        </>
      )}
    </NavLink>
  );
}
