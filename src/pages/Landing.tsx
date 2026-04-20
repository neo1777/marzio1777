import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle } from '../lib/firebase';
import { motion } from 'framer-motion';
import { Mountain, Trees } from 'lucide-react';

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

  if (loading) return <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0d1310] flex items-center justify-center font-sans text-slate-500 dark:text-slate-400 text-sm uppercase tracking-widest transition-colors duration-300">Inizializzazione...</div>;

  if (user) return <Navigate to="/dashboard/piazza" />;

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0d1310] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 w-full h-1/2 bg-[#2D5A27]/5 dark:bg-[#2D5A27]/10 -z-10 rounded-b-[40%]"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-[#151e18] rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/40 p-10 border border-slate-100 dark:border-[#24352b] text-center relative overflow-hidden transition-colors duration-300"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#2D5A27] via-[#F5A623] to-[#4A90E2] dark:from-[#42a83a] dark:via-[#F5A623] dark:to-[#4A90E2]"></div>
        
        <div className="w-20 h-20 bg-[#F7F5F0] dark:bg-[#111814] rounded-full border-2 border-white dark:border-[#24352b] shadow-md dark:shadow-black/20 mx-auto flex items-center justify-center mb-6 relative transition-colors duration-300">
           <Mountain className="w-10 h-10 text-[#2D5A27] dark:text-[#42a83a] absolute" strokeWidth={1.5} />
           <Trees className="w-5 h-5 text-[#F5A623] absolute bottom-3 right-3" strokeWidth={2} />
        </div>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans uppercase tracking-widest mb-2 font-medium">BENVENUTI A</p>
        <h1 className="text-4xl font-serif text-[#2D5A27] dark:text-[#42a83a] mb-3 tracking-tight font-bold italic uppercase">marzio1777</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-sans">Una piazza digitale per chi ha nel cuore i boschi, la nebbia salendo i tornanti e le estati al fresco.</p>

        {loginError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-lg text-left transition-colors duration-300">
            <p className="text-xs text-red-800 dark:text-red-400 font-sans uppercase tracking-wider mb-2 font-bold">ERRORE D'ACCESSO</p>
            <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed font-sans whitespace-pre-wrap">{loginError}</p>
          </div>
        )}

        <button 
          onClick={handleLogin}
          className="w-full py-3.5 px-4 bg-[#2D5A27] hover:bg-[#20401b] dark:bg-[#346b2d] dark:hover:bg-[#42a83a] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#2D5A27]/20 dark:shadow-[#2D5A27]/10"
        >
          <svg className="w-5 h-5 bg-white rounded-full text-[#2D5A27] dark:text-[#346b2d] p-0.5" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
          Sali in Paese (Google)
        </button>
      </motion.div>
      
      <div className="fixed bottom-6 text-center w-full pointer-events-none">
         <p className="text-xs text-slate-500/80 dark:text-slate-400/80 font-sans">Sviluppato con amore verso le nostre radici da <span className="font-bold text-[#2D5A27] dark:text-[#42a83a]">Neo1777</span></p>
      </div>
    </div>
  );
}
