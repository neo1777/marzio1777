import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Camera, Map as MapIcon, MessageCircle, LogOut, Settings, Award, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout() {
  const { profile } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const points = profile?.points || 0;
  const baseAltitude = 728; // Marzio altitude
  const currentAltitude = baseAltitude + points;

  // Simple badges derivation based on points/metrics
  const hasVillegiante = points >= 10;
  const hasCustode = points >= 50;
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row md:p-6 md:gap-6 overflow-hidden font-sans relative">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/50 border border-slate-800 rounded-2xl flex-shrink-0 shadow-xl overflow-hidden relative">
        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 flex-shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">M</div>
             <div>
               <h1 className="text-lg font-semibold tracking-tight text-white leading-tight uppercase">marzio1777</h1>
               <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight mt-1">by Neo1777</p>
             </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-indigo-400 transition-colors p-1 bg-slate-800/40 rounded-md">
            <Settings size={14} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 py-6 overflow-y-auto">
          <NavItem to="/dashboard/piazza" icon={<Home size={18} />} label="La Piazza" />
          <NavItem to="/dashboard/baule" icon={<Camera size={18} />} label="Il Baule" />
          <NavItem to="/dashboard/mappa" icon={<MapIcon size={18} />} label="Mappa Ricordi" />
          <NavItem to="/dashboard/circolo" icon={<MessageCircle size={18} />} label="Il Circolo" />
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/30">
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between px-2">
               <span className="text-[10px] font-mono text-slate-500 uppercase">Altitudine</span>
               <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1"><ChevronUp size={12}/>{currentAltitude}m</span>
            </div>
            {hasVillegiante && (
              <div className="px-2 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md flex items-center gap-2">
                <Award size={12} className="text-indigo-400" />
                <span className="text-[10px] font-mono text-indigo-300 uppercase">Il Villeggiante</span>
              </div>
            )}
            {hasCustode && (
              <div className="px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center gap-2">
                <Award size={12} className="text-amber-400" />
                <span className="text-[10px] font-mono text-amber-300 uppercase">Custode Baule</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 mb-4 p-2 bg-slate-800/40 rounded-xl">
            <img src={profile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} className="w-8 h-8 rounded-full border border-slate-700" alt="avatar" referrerPolicy="no-referrer" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-200">{profile?.displayName}</p>
              <p className="text-[10px] text-indigo-400 font-mono uppercase truncate">{profile?.role || 'GUEST'}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-400 font-bold uppercase tracking-wider hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-700">
            <LogOut size={14} />
            <span>Termina Sessione</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden pt-16 md:pt-0 pb-16 md:pb-0 shadow-xl">
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 text-slate-200 flex items-center justify-between px-4 shadow-md z-10">
          <h1 className="text-sm font-semibold tracking-widest uppercase">marzio1777</h1>
          <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-indigo-400">
             <Settings size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 text-slate-400 flex justify-around items-center h-16 pb-safe z-20">
        <MobileNavItem to="/dashboard/piazza" icon={<Home size={22} />} />
        <MobileNavItem to="/dashboard/baule" icon={<Camera size={22} />} />
        <MobileNavItem to="/dashboard/mappa" icon={<MapIcon size={22} />} />
        <MobileNavItem to="/dashboard/circolo" icon={<MessageCircle size={22} />} />
      </nav>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${isActive ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, icon }: { to: string, icon: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => `p-3 rounded-xl transition-all duration-200 ${isActive ? 'text-indigo-400 bg-indigo-600/10 border border-indigo-500/20' : 'text-slate-500 active:bg-slate-800'}`}>
      {icon}
    </NavLink>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const saveKey = () => {
    localStorage.setItem('gemini_api_key', key);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
         <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Impostazioni Avanzate</h3>
         <p className="text-xs text-slate-400 mb-6 font-mono">Configura i nodi di intelligenza artificiale locale.</p>
         
         <div className="space-y-4">
           <div>
             <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Gemini API Key</label>
             <input type="password" value={key} onChange={e => setKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-colors font-mono" placeholder="AIzaSy..." />
             <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Questa chiave risiede solo nel tuo browser locale. Abilita la funzione di auto-descrizione nel Baule.</p>
           </div>
           
           <div className="flex gap-3 pt-4">
              <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-700 transition-colors">Annulla</button>
              <button onClick={saveKey} className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-500 transition-colors">Salva Config</button>
           </div>
         </div>
      </motion.div>
    </div>
  );
}
