import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Film, Eye, EyeOff, Clock, Trash2, Calendar, Globe, Lock } from 'lucide-react';
import { format } from 'date-fns';

export default function GestioneArchivio() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Per il bulk editor
  const [bulkCinematografo, setBulkCinematografo] = useState<boolean | null>(null);
  const [bulkVisibility, setBulkVisibility] = useState<string | null>(null);
  const [bulkVisibilityTime, setBulkVisibilityTime] = useState<string>('');
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type !== 'event') {
          p.push({ id: doc.id, ...data });
        }
      });
      // Sort in JS to avoid index requirement
      p.sort((a, b) => {
        const tA = a.timestamp?.toMillis() || 0;
        const tB = b.timestamp?.toMillis() || 0;
        return tB - tA;
      });
      setPosts(p);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const updatePost = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'posts', id), updates);
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    try {
      await deleteDoc(doc(db, 'posts', postToDelete));
      setPostToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deletePost = (id: string) => {
    setPostToDelete(id);
  };

  const handleBulkUpdate = async () => {
    const promises = posts.map(post => {
      const updates: any = {};
      if (bulkCinematografo !== null) updates.showInCinematografo = bulkCinematografo;
      if (bulkVisibility !== null) updates.visibilityStatus = bulkVisibility;
      if (bulkVisibility === 'scheduled' && bulkVisibilityTime) {
         updates.visibilityTime = new Date(bulkVisibilityTime).getTime();
      }
      if (Object.keys(updates).length > 0) {
         return updateDoc(doc(db, 'posts', post.id), updates);
      }
      return Promise.resolve();
    });
    setLoading(true);
    await Promise.all(promises);
    setLoading(false);
    setBulkCinematografo(null);
    setBulkVisibility(null);
    setBulkVisibilityTime('');
    window.alert('Aggiornamento di massa completato!');
  };

  if (loading) return <div className="text-center py-10 text-slate-500">Recupero dell'archivio...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-[#1a261f] rounded-2xl border border-slate-200 dark:border-[#24352b] p-6">
        <h3 className="text-lg font-bold text-[#1a2e16] dark:text-[#e2e8f0] mb-4 font-serif">Azioni Rapide (Tutto il tuo archivio)</h3>
        <div className="flex flex-wrap gap-4 items-center">
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Visibilità Globale</label>
              <select className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg p-2 text-sm text-slate-700 dark:text-slate-200 outline-none" value={bulkVisibility || ''} onChange={e => setBulkVisibility(e.target.value || null)}>
                 <option value="">-- Nessuna Modifica --</option>
                 <option value="public">Rendi tutto Pubblico</option>
                 <option value="private">Rendi tutto Privato</option>
                 <option value="scheduled">Programmata A Tempo</option>
              </select>
           </div>

           {bulkVisibility === 'scheduled' && (
              <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-slate-500 uppercase">Data/Ora Rilascio</label>
                 <input type="datetime-local" value={bulkVisibilityTime} onChange={e => setBulkVisibilityTime(e.target.value)} className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg p-2 text-sm text-slate-700 dark:text-slate-200 outline-none" />
              </div>
           )}
           
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Cinematografo</label>
              <select className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg p-2 text-sm text-slate-700 dark:text-slate-200 outline-none" value={bulkCinematografo === null ? '' : bulkCinematografo ? 'true' : 'false'} onChange={e => setBulkCinematografo(e.target.value === '' ? null : e.target.value === 'true')}>
                 <option value="">-- Nessuna Modifica --</option>
                 <option value="true">Aggiungi tutto al Cinematografo</option>
                 <option value="false">Rimuovi tutto dal Cinematografo</option>
              </select>
           </div>

           {(bulkVisibility !== null || bulkCinematografo !== null) && (
              <button onClick={handleBulkUpdate} className="mt-6 bg-[#2D5A27] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#1b3b17] transition-colors shadow-md">Applica a Tutti ({posts.length})</button>
           )}
        </div>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
           <p className="text-slate-500 text-center py-10">Non hai ancora caricato immagini nel tuo archivio.</p>
        ) : (
           posts.map(post => (
             <PostManagerRow key={post.id} post={post} onUpdate={updatePost} onDelete={deletePost} />
           ))
        )}
      </div>

      {postToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#2D5A27]/40 dark:bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#151e18] rounded-2xl shadow-xl overflow-hidden p-6 border border-slate-200 dark:border-[#24352b]">
            <h3 className="font-bold text-lg text-[#1a2e16] dark:text-[#e2e8f0] mb-2">Eliminare questo ricordo?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Attenzione: l'eliminazione sarà permanente e non potrai più recuperare il post o l'immagine allegata.</p>
            <div className="flex justify-end gap-3">
               <button onClick={() => setPostToDelete(null)} className="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Annulla</button>
               <button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-md flex items-center gap-2"><Trash2 size={16}/> Elimina Definitivamente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostManagerRow({ post, onUpdate, onDelete }: { post: any, onUpdate: any, onDelete: any }) {
  const [localVis, setLocalVis] = useState(post.visibilityStatus || 'private');
  const [localCinema, setLocalCinema] = useState(post.showInCinematografo !== false); // default to true if undefined
  const [localDate, setLocalDate] = useState(post.visibilityTime ? new Date(post.visibilityTime).toISOString().slice(0, 16) : '');

  // Sync state if props change from outside (e.g., bulk update)
  useEffect(() => {
     setLocalVis(post.visibilityStatus || 'private');
     setLocalCinema(post.showInCinematografo !== false);
     setLocalDate(post.visibilityTime ? new Date(post.visibilityTime).toISOString().slice(0, 16) : '');
  }, [post.visibilityStatus, post.showInCinematografo, post.visibilityTime]);

  const handleSave = () => {
     const updates: any = {
        visibilityStatus: localVis,
        showInCinematografo: localCinema
     };
     if (localVis === 'scheduled' && localDate) {
        updates.visibilityTime = new Date(localDate).getTime();
     }
     onUpdate(post.id, updates);
  };

  const hasChanges = localVis !== (post.visibilityStatus || 'private') || 
                     localCinema !== (post.showInCinematografo !== false) || 
                     (localVis === 'scheduled' && localDate !== (post.visibilityTime ? new Date(post.visibilityTime).toISOString().slice(0, 16) : ''));

  return (
    <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-[#1a261f] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 transition-all">
       <div className="w-full md:w-32 h-32 shrink-0 bg-slate-100 dark:bg-[#111814] rounded-lg overflow-hidden flex items-center justify-center relative">
          {post.imageUrl ? (
             <img src={post.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
             <Film className="text-slate-300" />
          )}
          <div className="absolute top-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[9px] text-white font-bold">{post.decade}</div>
          {post.visibilityStatus === 'scheduled' && post.visibilityTime && post.visibilityTime > Date.now() && (
             <div className="absolute top-1 right-1 bg-blue-600/90 rounded px-1.5 py-0.5 text-[9px] text-white font-bold flex items-center gap-1 backdrop-blur-md shadow-lg border border-blue-400/30">
                <Clock size={10} />
                Programmato
             </div>
          )}
       </div>

       <div className="flex-1 flex flex-col justify-between">
          <p className="text-sm font-serif italic text-slate-700 dark:text-slate-300 line-clamp-2">"{post.caption}"</p>
          
          <div className="mt-4 flex flex-wrap gap-4 items-end">
             <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Visibilità nella Piazza</label>
                <div className="flex items-center bg-slate-50 dark:bg-[#111814] rounded-lg p-1 border border-slate-200 dark:border-[#24352b]">
                   <button onClick={() => setLocalVis('public')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${localVis === 'public' ? 'bg-[#2D5A27] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Globe size={14}/> Pubblico</button>
                   <button onClick={() => setLocalVis('private')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${localVis === 'private' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Lock size={14}/> Privato</button>
                   <button onClick={() => setLocalVis('scheduled')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${localVis === 'scheduled' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Clock size={14}/> A Tempo</button>
                </div>
             </div>

             {localVis === 'scheduled' && (
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Data di Rilascio</label>
                   <input type="datetime-local" value={localDate} onChange={e => setLocalDate(e.target.value)} className="bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none" />
                </div>
             )}

             <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cinematografo</label>
                <button onClick={() => setLocalCinema(!localCinema)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${localCinema ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-[#111814] dark:border-[#24352b]'}`}>
                   {localCinema ? <Eye size={14} /> : <EyeOff size={14} />}
                   {localCinema ? ' Mostra' : ' Nascondi'}
                </button>
             </div>
          </div>
       </div>

       <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-4 shrink-0 md:pl-4 md:border-l border-slate-100 dark:border-[#24352b]">
          {hasChanges ? (
             <button onClick={handleSave} className="bg-[#F5A623] hover:bg-[#d6901e] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md w-full md:w-auto">Applica Modifiche</button>
          ) : (
             <div className="text-[10px] text-slate-400 font-bold uppercase py-2">Salvato ✓</div>
          )}
          <button onClick={() => onDelete(post.id)} className="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 p-2 rounded-lg transition-all" title="Elimina questo ricordo"><Trash2 size={16} /></button>
       </div>
    </div>
  );
}
