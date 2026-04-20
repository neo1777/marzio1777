import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { Camera, MapPin, Sparkles, Upload, Database, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';

// Image compression utility
const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality JPEG
      };
      img.onerror = (e) => reject(e);
    };
  });
};

export default function IlBaule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [caption, setCaption] = useState('');
  const [decade, setDecade] = useState('Anni 80');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressedBase64 = await compressImage(file);
        setImagePreview(compressedBase64);
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Errore nello sviluppo del rullino.');
      }
      setLoading(false);
    }
  };

  const captureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        alert("Permesso di geolocalizzazione negato.");
      });
    } else {
      alert("Geolocalizzazione non supportata.");
    }
  };

  const handleEnhance = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert("⚠️ API Key di Gemini non configurata! Aggiungila nelle Impostazioni (icona in alto a destra) per usare le funzioni AI.");
      return;
    }
    if (!imagePreview) return;

    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Extract base64 part
      const base64Data = imagePreview.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
           "Sei un abitante nostalgico del paese di Marzio. Analizza l'immagine fornita e scrivi una didascalia (max 2 frasi) intrisa di affetto, ricordi e riferimenti alla natura, al paese e alla comunità d'epoca (anni 70/80/90). Scrivi in italiano in tono confidenziale.",
           { inlineData: { data: base64Data, mimeType: 'image/jpeg' }}
        ]
      });
      
      if (response.text) {
         setCaption(response.text);
      }
    } catch (error) {
      console.error(error);
      alert("Errore nell'analisi AI. Controlla che le tue API Key siano valide e abbiano credito.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!imagePreview || !user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName,
        imageUrl: imagePreview, // Fits in Firestore because it's compressed < 1MB
        caption,
        decade,
        location,
        timestamp: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0
      });

      // Gamification points: +10 for upload, +5 if mapped
      const pointsToEarn = 10 + (location ? 5 : 0);
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(pointsToEarn)
      });

      navigate('/dashboard/piazza');
    } catch (e) {
      console.error(e);
      alert("Errore durante l'elaborazione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col border-b border-slate-800 pb-4">
         <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-1">Acquisizione Dati</h2>
         <div className="flex items-center gap-2 text-2xl font-bold text-slate-200 tracking-tight">
            Il Baule <Database size={20} className="text-indigo-400" />
         </div>
      </header>

      <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex-1 overflow-y-auto">
        {!imagePreview ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-slate-700 bg-slate-800/20 rounded-xl aspect-[4/3] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group"
          >
            {loading ? (
               <Loader2 className="animate-spin text-indigo-400 mb-4" size={32} />
            ) : (
              <div className="w-16 h-16 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center mb-4 text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors shadow-lg">
                <Camera size={28} />
              </div>
            )}
            <p className="font-mono text-xs text-slate-300 uppercase tracking-widest">Inizializza Scanner</p>
            <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase">Carica record visivo</p>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-700 shadow-lg shadow-black/40">
              <img src={imagePreview} className="w-full h-full object-contain opacity-90 scanner-effect" alt="Preview" />
              <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgoJPHJlY3Qgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+Cjwvc3ZnPg==')] opacity-30 mix-blend-overlay"></div>
              <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 bg-slate-900/80 text-slate-300 p-2 rounded-lg border border-slate-700 hover:text-white hover:bg-slate-800 backdrop-blur-sm transition-colors">
                 ✕ 
              </button>
            </div>

            <div className="space-y-5">
              <div>
                 <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">Metadati Didascalia</label>
                 <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-colors font-mono" placeholder="Descrivi il record..." />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                 <button onClick={handleEnhance} disabled={isAiLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 font-mono text-xs uppercase tracking-wider rounded-lg transition-colors border border-indigo-500/20 disabled:opacity-50">
                   {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                   {isAiLoading ? 'Analisi in corso...' : 'Auto-Descrizione (AI)'}
                 </button>
                 <button onClick={captureLocation} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 font-mono text-xs uppercase tracking-wider rounded-lg transition-colors border ${location ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-300'}`}>
                   <MapPin size={14} /> {location ? 'Coordinate Acquisite' : 'Acquisisci GPS (+5m)'}
                 </button>
              </div>

              <div>
                 <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">Timestamp Cronologico</label>
                 <select value={decade} onChange={e => setDecade(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-colors font-mono">
                   <option>Anni 70</option>
                   <option>Anni 80</option>
                   <option>Anni 90</option>
                   <option>Anni 00+</option>
                 </select>
              </div>

              <div className="pt-2">
                <button disabled={loading} onClick={handleUpload} className="w-full py-3 bg-indigo-600 text-white font-mono text-xs uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Elaborazione Database...</> : <><Upload size={16} /> Salva nel Database (+10m)</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
