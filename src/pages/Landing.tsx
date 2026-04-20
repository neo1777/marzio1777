import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle } from '../lib/firebase';
import { motion } from 'framer-motion';

export default function Landing() {
  const { user, loading } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (err: any) {
      if (err.message && err.message.includes('api-key-not-valid')) {
        setLoginError("ATTENZIONE: Le chiavi del database Firebase non sono valide. L'ambiente AI Studio non è riuscito a generare in automatico un progetto Cloud. \n\nPer proseguire: apri 'src/firebase-applet-config.json' e copia all'interno i dati del tuo vero progetto Firebase.");
      } else {
        setLoginError("Errore critico di autenticazione: " + (err.message || 'Sconosciuto'));
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-slate-500 text-sm uppercase tracking-widest">Inizializzazione Sistema...</div>;

  if (user) return <Navigate to="/dashboard/piazza" />;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] -z-10" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900/50 rounded-2xl shadow-2xl p-8 border border-slate-800 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
        
        <div className="w-16 h-16 bg-indigo-600/20 rounded-xl border border-indigo-500/30 mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
           <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 2L4 12h3v10h10V12h3L12 2zm0 18H9v-8H6.5L12 4.5 17.5 12H15v8h-3z" />
           </svg>
        </div>
        
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-2">Gateway di Sicurezza</p>
        <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight uppercase">marzio1777</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">Database centralizzato per 300 nodi. Archivi storici e rete mesh comunitaria in tempo reale.</p>

        {loginError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
            <p className="text-xs text-red-400 font-mono uppercase tracking-wider mb-2 font-bold">ERRORE DATABASE</p>
            <p className="text-xs text-red-300 leading-relaxed font-mono whitespace-pre-wrap">{loginError}</p>
          </div>
        )}

        <button 
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-3 border border-white/10 hover:border-white/20 backdrop-blur-sm"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
          Autenticati via Google
        </button>
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Rete {loginError ? 'Offline' : 'Online'}</p>
        </div>
        
        <div className="absolute bottom-4 left-0 right-0 text-center">
           <p className="text-[10px] text-slate-600 font-mono">Un progetto sviluppato da <span className="font-bold text-indigo-400">Neo1777</span></p>
        </div>
      </motion.div>
    </div>
  );
}
