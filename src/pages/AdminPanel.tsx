import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Shield, Users, Activity, AlertTriangle, Key } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  points: number;
  photoURL: string;
}

export default function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Solo per Root e Admin
    if (profile?.role !== 'Root' && profile?.role !== 'Admin') return;

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserData);
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const updateUserRole = async (uid: string, newRole: string) => {
    if (profile?.role !== 'Root') {
      alert("Solo il Root primario può modificare i ruoli.");
      return;
    }
    if (uid === profile.uid) {
      alert("Non puoi modificare il tuo stesso ruolo di Root!");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      console.error(error);
      alert("Errore nell'aggiornamento. Controlla i permessi Firebase.");
    }
  };

  // Protezione Rotta
  if (!profile) return null;
  if (profile.role !== 'Root' && profile.role !== 'Admin') {
    return <Navigate to="/dashboard/piazza" />;
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col border-b border-slate-200 dark:border-[#24352b] pb-4 transition-colors">
         <h2 className="text-xs font-bold font-sans uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Amministrazione</h2>
         <div className="flex items-center gap-2 text-3xl font-serif font-bold text-red-700 dark:text-red-500 tracking-tight">
            Pannello Root <Key size={24} className="text-red-500 dark:text-red-400" />
         </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#151e18] p-4 rounded-xl border border-slate-200 dark:border-[#24352b] flex items-center gap-4 shadow-sm transition-colors">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-[#4A90E2] dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-900/30"><Users size={24}/></div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-widest">Utenti Iscritti</p>
            <p className="text-2xl font-bold text-[#1a2e16] dark:text-slate-200">{users.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#151e18] p-4 rounded-xl border border-slate-200 dark:border-[#24352b] flex items-center gap-4 shadow-sm transition-colors">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30"><Shield size={24}/></div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-widest">Protezione</p>
            <p className="text-lg font-bold text-[#1a2e16] dark:text-slate-200 uppercase">In funzione</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#151e18] p-4 rounded-xl border border-slate-200 dark:border-[#24352b] flex items-center gap-4 shadow-sm transition-colors">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-900/30"><Activity size={24}/></div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-widest">Stato Rete</p>
            <p className="text-lg font-bold text-[#1a2e16] dark:text-slate-200 uppercase">Operativo</p>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white dark:bg-[#151e18] rounded-2xl shadow-md border border-slate-200 dark:border-[#24352b] flex-1 overflow-hidden flex flex-col transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-[#24352b] flex justify-between items-center bg-slate-50 dark:bg-[#1a261f]">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Users size={18} /> Anagrafica e Permessi</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-[#0d1310]/50 scrollbar-hide">
          {loading ? (
            <div className="flex justify-center items-center h-32 text-slate-400 dark:text-slate-500 font-sans font-bold text-sm uppercase">Caricamento archivi...</div>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl gap-4 hover:border-[#F5A623]/50 dark:hover:border-[#F5A623]/30 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL || 'https://picsum.photos/seed/avatar/100/100'} alt={user.displayName} className="w-10 h-10 rounded-full border border-slate-200 dark:border-[#24352b] shadow-sm" referrerPolicy="no-referrer" />
                    <div>
                      <p className="font-bold font-sans text-slate-800 dark:text-slate-200">{user.displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:w-auto w-full">
                    <div className="flex flex-col text-right hidden sm:flex">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-sans uppercase font-bold">Altitudine</span>
                      <span className="text-sm font-bold font-serif text-[#2D5A27] dark:text-[#42a83a]">{728 + user.points}m</span>
                    </div>

                    <select 
                      value={user.role} 
                      onChange={(e) => updateUserRole(user.uid, e.target.value)}
                      disabled={profile?.role !== 'Root' || user.uid === profile?.uid}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider outline-none border transition-colors cursor-pointer ${
                        user.role === 'Root' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' :
                        user.role === 'Admin' ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/30 text-orange-600 dark:text-orange-400' :
                        'bg-white dark:bg-[#151e18] border-slate-300 dark:border-[#24352b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a261f]'
                      }`}
                    >
                      <option value="Guest">Guest</option>
                      <option value="Admin">Admin</option>
                      {user.role === 'Root' && <option value="Root">Root</option>}
                    </select>

                    {user.role === 'Root' && (
                       <div className="p-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded flex-shrink-0" title="Utente Intoccabile">
                         <Shield size={16} />
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {profile?.role === 'Admin' && (
         <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl flex items-start gap-3 transition-colors">
            <AlertTriangle className="text-orange-500 flex-shrink-0" size={20} />
            <p className="text-sm text-orange-800 dark:text-orange-300 font-sans leading-relaxed">
              Hai privilegi di amministrazione per la moderazione, ma non puoi cambiare l'assegnazione dei ruoli. Solo il Root può elevare i Guest.
            </p>
         </div>
      )}
    </div>
  );
}
