// (Complete replacement already provided in earlier instructions)
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Shield, Users, Activity, AlertTriangle, Key, UserCheck, Clock } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  accountStatus?: string;
  points: number;
  photoURL: string;
}

export default function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');

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
    const userToUpdate = users.find(u => u.uid === uid);
    if (!userToUpdate) return;

    if (profile?.role === 'Admin') {
      if (userToUpdate.role === 'Root') {
        alert("Non puoi modificare il Root.");
        return;
      }
      if (userToUpdate.role === 'Admin') {
        alert("Non puoi retrocedere un Admin. Solo il Root può farlo.");
        return;
      }
      if (newRole !== 'Admin') {
        alert("Puoi solo promuovere i Guest a Admin.");
        return;
      }
    } else if (profile?.role !== 'Root') {
      alert("Non hai i permessi per modificare i ruoli.");
      return;
    }
    
    if (uid === profile.uid) {
      alert("Non puoi modificare il tuo stesso ruolo!");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      console.error(error);
      alert("Errore nell'aggiornamento. Controlla i permessi Firebase.");
    }
  };

  const approveUser = async (uid: string, asRole: string) => {
      if (profile?.role !== 'Root' && profile?.role !== 'Admin') return;
      if (profile?.role === 'Admin' && asRole !== 'Guest') {
         alert("Gli Admin possono approvare solo come Guest.");
         return;
      }

      try {
         await updateDoc(doc(db, 'users', uid), { 
            accountStatus: 'approved',
            role: asRole,
         });
      } catch (error) {
         console.error(error);
         alert("Errore nell'approvazione. Controlla i permessi Firebase.");
      }
  };

  // Protezione Rotta
  if (!profile) return null;
  if (profile.role !== 'Root' && profile.role !== 'Admin') {
    return <Navigate to="/dashboard/piazza" />;
  }

  const approvedUsers = users.filter(u => u.accountStatus === 'approved');
  const pendingUsers = users.filter(u => u.accountStatus === 'pending');

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
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-widest">Utenti Approvati</p>
            <p className="text-2xl font-bold text-[#1a2e16] dark:text-slate-200">{approvedUsers.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#151e18] p-4 rounded-xl border border-slate-200 dark:border-[#24352b] flex items-center gap-4 shadow-sm transition-colors cursor-pointer hover:border-amber-400/50" onClick={() => setActiveTab('pending')}>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/30"><Clock size={24}/></div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-widest">In Attesa</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-500">{pendingUsers.length}</p>
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
        <div className="flex border-b border-slate-200 dark:border-[#24352b] bg-slate-50 dark:bg-[#1a261f]">
          <button 
             onClick={() => setActiveTab('approved')}
             className={`flex-1 p-4 font-bold text-sm uppercase tracking-widest transition-colors ${activeTab === 'approved' ? 'text-[#2D5A27] dark:text-[#42a83a] border-b-2 border-[#2D5A27] dark:border-[#42a83a]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
             <div className="flex items-center justify-center gap-2"><Users size={18} /> Anagrafica</div>
          </button>
          <button 
             onClick={() => setActiveTab('pending')}
             className={`flex-1 p-4 font-bold text-sm uppercase tracking-widest transition-colors ${activeTab === 'pending' ? 'text-amber-600 dark:text-amber-500 border-b-2 border-amber-600 dark:border-amber-500' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
             <div className="flex items-center justify-center gap-2"><Clock size={18} /> Richieste ({pendingUsers.length})</div>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-[#0d1310]/50 scrollbar-hide">
          {loading ? (
            <div className="flex justify-center items-center h-32 text-slate-400 dark:text-slate-500 font-sans font-bold text-sm uppercase">Caricamento archivi...</div>
          ) : activeTab === 'pending' ? (
             <div className="space-y-3">
               {pendingUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                     <UserCheck size={32} className="opacity-50" />
                     <p className="text-sm font-bold uppercase">Nessuna richiesta in attesa</p>
                  </div>
               ) : pendingUsers.map(user => (
                  <div key={user.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-[#111814] border border-amber-200 dark:border-amber-900/30 rounded-xl gap-4 hover:shadow-sm transition-all shadow-amber-500/5">
                     <div className="flex items-center gap-3">
                     <img src={user.photoURL || 'https://picsum.photos/seed/avatar/100/100'} alt={user.displayName} className="w-10 h-10 rounded-full border border-slate-200 dark:border-[#24352b] shadow-sm" referrerPolicy="no-referrer" />
                     <div>
                        <p className="font-bold font-sans text-slate-800 dark:text-slate-200">{user.displayName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">{user.email}</p>
                     </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => approveUser(user.uid, 'Guest')} className="px-4 py-2 bg-[#2D5A27] hover:bg-[#1a3817] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm">
                           Approva come Guest
                        </button>
                        {profile?.role === 'Root' && (
                           <button onClick={() => approveUser(user.uid, 'Admin')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm">
                              Approva come Admin
                           </button>
                        )}
                     </div>
                  </div>
               ))}
             </div>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map(user => (
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
                      disabled={(profile?.role !== 'Root' && profile?.role !== 'Admin') || user.uid === profile?.uid || (profile?.role === 'Admin' && user.role !== 'Guest')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider outline-none border transition-colors cursor-pointer ${
                        user.role === 'Root' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' :
                        user.role === 'Admin' ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/30 text-orange-600 dark:text-orange-400' :
                        'bg-white dark:bg-[#151e18] border-slate-300 dark:border-[#24352b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a261f]'
                      }`}
                    >
                      <option value="Guest">Guest</option>
                      <option value="Admin">Admin</option>
                      {(user.role === 'Root' || profile?.role === 'Root') && <option value="Root" disabled={user.role === 'Root' && profile?.role !== 'Root'}>Root</option>}
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
              Hai privilegi parziali. Puoi approvare registrazioni, e promuovere i Guest ad Admin, ma non puoi retrocedere gli incarichi (riservato al Root).
            </p>
         </div>
      )}
    </div>
  );
}
