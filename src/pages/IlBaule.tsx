import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Camera, MapPin, Sparkles, Upload, Loader2, BookOpen, Image as ImageIcon, MonitorUp, Settings2, RotateCw, Wand2, Check, Crosshair, Search, Map as MapIcon, ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/canvasUtils';
import { MapContainer, TileLayer, Marker, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

const customMarkerHtml = `<div style="background-color: #2D5A27; width: 1.5rem; height: 1.5rem; border-radius: 50% 50% 50% 0; border: 2px solid #fff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;"><div style="background-color: white; width: 0.5rem; height: 0.5rem; border-radius: 50%;"></div></div>`;
const pinIcon = L.divIcon({ html: customMarkerHtml, className: 'custom-bento-marker', iconSize: [24, 24], iconAnchor: [12, 24] });

function LocationPicker({ onSelect }: { onSelect: (ll: {lat: number, lng: number}) => void }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

export default function IlBaule() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'upload' | 'crop' | 'edit'>('upload');
  const [loading, setLoading] = useState(false);

  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [uncompressedImage, setUncompressedImage] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);
  const [isMagicScan, setIsMagicScan] = useState(false);
  
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(0.8);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [decade, setDecade] = useState('Anni 80');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Visibility States
  const [visibilityStatus, setVisibilityStatus] = useState<string>('private');
  const [showInCinematografo, setShowInCinematografo] = useState<boolean>(true);
  const [visibilityTime, setVisibilityTime] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationMode, setLocationMode] = useState<'menu' | 'manual' | 'address'>('menu');
  const [addressQuery, setAddressQuery] = useState('');
  const [tempLocation, setTempLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver((m) => {
      m.forEach((mutation) => {
        if (mutation.attributeName === 'class') setIsDark(document.documentElement.classList.contains('dark'));
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const handleFilesSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const firstFile = fileArray[0];
    
    if (fileArray.length > 1) {
      setFileQueue(fileArray.slice(1));
    } else {
      setFileQueue([]);
    }
    
    loadIntoCropper(firstFile);
  };

  const loadIntoCropper = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setUncompressedImage(reader.result as string);
      setStep('crop');
      setLoading(false);
      // Reset cropper state for the new file
      setZoom(1);
      setRotation(0);
      setAspectRatio(4 / 3);
      setIsMagicScan(false);
      setImagePreview(null);
      setCaption(''); // clear caption for the new file
      setVisibilityStatus('private');
      setShowInCinematografo(true);
      setVisibilityTime('');
    };
    reader.onerror = () => {
      alert("Errore nella lettura del file.");
      setLoading(false);
      handleNextInQueue();
    };
  };

  const handleNextInQueue = () => {
    if (fileQueue.length > 0) {
      const nextFile = fileQueue[0];
      setFileQueue(fileQueue.slice(1));
      loadIntoCropper(nextFile);
    } else {
      // Done with batch
      navigate('/dashboard/piazza');
    }
  };

  const cancelBatch = () => {
    setFileQueue([]);
    setStep('upload');
    setUncompressedImage(null);
    setImagePreview(null);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSkipCrop = async () => {
    if (!uncompressedImage) return;
    setLoading(true);
    try {
      const image = new Image();
      image.src = uncompressedImage;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      
      const canvas = document.createElement('canvas');
      let width = image.width;
      let height = image.height;
      const MAX_DIM = 1200;
      
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
      }
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', compressionQuality);
      setImagePreview(compressedBase64);
      setStep('edit');
    } catch (err) {
      console.error(err);
      alert("Errore durante l'elaborazione dell'immagine Originale.");
    }
    setLoading(false);
  };

  const handleConfirmCrop = async () => {
    if (!uncompressedImage || !croppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedImageBase64 = await getCroppedImg(
        uncompressedImage,
        croppedAreaPixels,
        rotation,
        { horizontal: false, vertical: false },
        compressionQuality,
        isMagicScan
      );
      setImagePreview(croppedImageBase64);
      setStep('edit');
    } catch(err) {
      console.log(err);
      alert("Errore durante l'elaborazione dell'immagine.");
    }
    setLoading(false);
  };

  const handleAutoGPS = () => {
    setIsSearchingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setShowLocationModal(false);
        setIsSearchingLocation(false);
      }, () => {
        alert("Permesso di geolocalizzazione negato.");
        setIsSearchingLocation(false);
      });
    } else {
      alert("Geolocalizzazione non supportata.");
      setIsSearchingLocation(false);
    }
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!addressQuery.trim()) return;
    setIsSearchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setShowLocationModal(false);
      } else {
        alert('Indirizzo non trovato.');
      }
    } catch(err) {
      alert('Errore di ricerca.');
    }
    setIsSearchingLocation(false);
  };

  const handleEnhance = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert("⚠️ API Key dello Scrittore AI non trovata! Aggiungila nelle Impostazioni (icona ingranaggio).");
      return;
    }
    if (!imagePreview) return;

    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
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
      alert("Errore nell'analisi AI. Controlla che le tue API Key siano valide.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!imagePreview || !user) return;
    setLoading(true);
    try {
      const imageId = `${user.uid}_${Date.now()}`;
      const storageRef = ref(storage, `marzio_photos/${imageId}.jpg`);
      
      await uploadString(storageRef, imagePreview, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);

      const postData: any = {
        authorId: user.uid,
        authorName: user.displayName,
        imageUrl: downloadUrl,
        caption,
        decade,
        location,
        timestamp: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        visibilityStatus,
        showInCinematografo
      };

      if (visibilityStatus === 'scheduled' && visibilityTime) {
        postData.visibilityTime = new Date(visibilityTime).getTime();
      }

      await addDoc(collection(db, 'posts'), postData);

      const pointsToEarn = 10 + (location ? 5 : 0);
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(pointsToEarn)
      });

      handleNextInQueue();
    } catch (e) {
      console.error(e);
      alert("Errore durante l'archiviazione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-6">
      <header className="flex flex-col border-b border-slate-200 dark:border-[#24352b] pb-4 transition-colors">
         <h2 className="text-xs font-bold font-sans uppercase tracking-widest text-[#8C928D] dark:text-slate-500 mb-1">Album Condiviso</h2>
         <div className="flex items-center gap-2 text-3xl font-serif font-bold text-[#2D5A27] dark:text-[#42a83a] tracking-tight">
            Il Baule <BookOpen size={24} className="text-[#8B5A2B]" />
         </div>
      </header>

      <div className="bg-white dark:bg-[#151e18] p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-[#24352b] flex-1 overflow-y-auto transition-colors flex flex-col">
        {profile?.role === 'Guest' ? (
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#24352b] rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-[#1a261f]">
                 <BookOpen size={28} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-serif font-bold text-slate-700 dark:text-slate-300 mb-2">Accesso in Lettura</h3>
              <p className="text-sm font-sans text-slate-500 dark:text-slate-400 max-w-md">I visitatori non possono aggiungere foto al Baule. Contatta l'amministratore Root se desideri ottenere i permessi per contribuire ai ricordi.</p>
           </div>
        ) : step === 'upload' && (
          <div className="flex-1 flex flex-col justify-center space-y-8">
            
            {/* Desktop Upload Zone */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFilesSelect(e.dataTransfer.files); }}
              onClick={() => desktopInputRef.current?.click()}
              className="hidden md:flex border-2 border-dashed border-slate-300 dark:border-[#24352b] bg-slate-50 dark:bg-[#111814] rounded-2xl aspect-[4/2] flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a261f] hover:border-[#F5A623] dark:hover:border-[#F5A623] transition-all group"
            >
              {loading ? (
                 <Loader2 className="animate-spin text-[#F5A623] mb-4" size={36} />
              ) : (
                <div className="w-20 h-20 bg-white dark:bg-[#151e18] rounded-2xl border border-slate-200 dark:border-[#24352b] flex items-center justify-center mb-6 text-[#8C928D] dark:text-slate-500 group-hover:text-[#F5A623] transition-colors shadow-sm">
                  <MonitorUp size={32} />
                </div>
              )}
              <p className="font-serif font-bold text-xl text-[#1a2e16] dark:text-slate-200 mb-2">Seleziona Immagini</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-sans">Trascina PNG, JPG, SVG o clicca</p>
              <input type="file" multiple accept="image/*, image/svg+xml" className="hidden" ref={desktopInputRef} onChange={(e) => handleFilesSelect(e.target.files)} />
            </div>

            {/* Mobile Upload Buttons */}
            <div className="md:hidden flex flex-col gap-4">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] py-8 rounded-2xl text-[#1a2e16] dark:text-slate-200 shadow-sm active:bg-slate-100 dark:active:bg-[#1a261f]"
              >
                <div className="p-4 bg-white dark:bg-[#151e18] rounded-full shadow-sm"><Camera size={28} className="text-[#2D5A27]" /></div>
                <span className="font-bold font-sans text-lg">Fotocamera</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] py-8 rounded-2xl text-[#1a2e16] dark:text-slate-200 shadow-sm active:bg-slate-100 dark:active:bg-[#1a261f]"
              >
                <div className="p-4 bg-white dark:bg-[#151e18] rounded-full shadow-sm"><ImageIcon size={28} className="text-[#F5A623]" /></div>
                <span className="font-bold font-sans text-lg">Libreria Foto</span>
              </button>

              <input type="file" accept="image/*, image/svg+xml" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => handleFilesSelect(e.target.files)} />
              <input type="file" accept="image/*, image/svg+xml" multiple className="hidden" ref={fileInputRef} onChange={(e) => handleFilesSelect(e.target.files)} />
            </div>

            {/* Advanced Settings Panel */}
            <div className="border border-slate-200 dark:border-[#24352b] rounded-xl overflow-hidden bg-slate-50 dark:bg-[#111814] transition-colors">
               <button 
                 onClick={() => setShowAdvancedSettings(!showAdvancedSettings)} 
                 className="flex items-center justify-between w-full p-4 text-sm font-bold font-sans text-slate-700 dark:text-slate-300"
               >
                 <span className="flex items-center gap-2"><Settings2 size={16} /> Impostazioni Avanzate di Compressione</span>
                 <span>{showAdvancedSettings ? '−' : '+'}</span>
               </button>
               {showAdvancedSettings && (
                 <div className="p-4 border-t border-slate-200 dark:border-[#24352b] space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">
                         <span>Qualità File</span>
                         <span>{Math.round(compressionQuality * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0.1" max="1" step="0.1" 
                        value={compressionQuality} onChange={(e) => setCompressionQuality(parseFloat(e.target.value))} 
                        className="w-full accent-[#2D5A27] dark:accent-[#42a83a]"
                      />
                      <p className="text-[10px] text-slate-400 mt-2">Personalizza il livello di compressione JPEG. Valori bassi (es. 40%) riducono lo spazio, ideali per connessioni lente e server poveri. Valori alti trattengono dettagli.</p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {step === 'crop' && uncompressedImage && (
          <div className="flex-1 flex flex-col space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#24352b] pb-3">
               <h3 className="font-bold text-sm text-[#1a2e16] dark:text-slate-200">
                 Adatta Geometria o Scannerizza
                 {fileQueue.length > 0 && <span className="ml-2 text-xs font-normal bg-[#2D5A27]/10 text-[#2D5A27] dark:bg-[#42a83a]/20 dark:text-[#42a83a] px-2 py-0.5 rounded-full">{fileQueue.length} in coda</span>}
               </h3>
               <button onClick={cancelBatch} className="text-xs text-slate-500 font-bold uppercase hover:text-red-500 transition-colors">Annulla Tutto</button>
             </div>
             
             <div className="relative w-full h-[40vh] bg-slate-100 dark:bg-[#0d1310] rounded-xl overflow-hidden">
               <Cropper
                 image={uncompressedImage}
                 crop={crop}
                 zoom={zoom}
                 rotation={rotation}
                 aspect={aspectRatio}
                 onCropChange={setCrop}
                 onRotationChange={setRotation}
                 onZoomChange={setZoom}
                 onCropComplete={onCropComplete}
                 classes={{ containerClassName: 'react-easy-crop-container' }}
               />
             </div>

             <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
               <button onClick={() => setAspectRatio(4 / 3)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aspectRatio === 4/3 ? 'bg-[#2D5A27] text-white border-[#2D5A27] dark:bg-[#42a83a] dark:text-[#0d1310] dark:border-[#42a83a]' : 'bg-slate-50 dark:bg-[#111814] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#24352b]'}`}>Polaroid (4:3)</button>
               <button onClick={() => setAspectRatio(1)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aspectRatio === 1 ? 'bg-[#2D5A27] text-white border-[#2D5A27] dark:bg-[#42a83a] dark:text-[#0d1310] dark:border-[#42a83a]' : 'bg-slate-50 dark:bg-[#111814] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#24352b]'}`}>Quadrato (1:1)</button>
               <button onClick={() => setAspectRatio(16 / 9)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aspectRatio === 16/9 ? 'bg-[#2D5A27] text-white border-[#2D5A27] dark:bg-[#42a83a] dark:text-[#0d1310] dark:border-[#42a83a]' : 'bg-slate-50 dark:bg-[#111814] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#24352b]'}`}>Panorama (16:9)</button>
               <button onClick={() => setAspectRatio(3 / 4)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aspectRatio === 3/4 ? 'bg-[#2D5A27] text-white border-[#2D5A27] dark:bg-[#42a83a] dark:text-[#0d1310] dark:border-[#42a83a]' : 'bg-slate-50 dark:bg-[#111814] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#24352b]'}`}>Ritratto (3:4)</button>
             </div>

             <div className="grid grid-cols-2 gap-3 pb-2">
                <button 
                  onClick={() => setRotation(r => r + 90)} 
                  className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl hover:bg-slate-100 dark:hover:bg-[#1a261f] transition-all text-slate-700 dark:text-slate-300"
                >
                   <RotateCw size={18} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Ruota 90°</span>
                </button>
                <button 
                  onClick={() => setIsMagicScan(!isMagicScan)} 
                  className={`flex flex-col items-center justify-center gap-1 p-3 border rounded-xl transition-all ${isMagicScan ? 'bg-[#2D5A27]/10 border-[#2D5A27] text-[#2D5A27] dark:bg-[#42a83a]/20 dark:border-[#42a83a] dark:text-[#42a83a]' : 'bg-slate-50 dark:bg-[#111814] border-slate-200 dark:border-[#24352b] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a261f]'}`}
                >
                   <Wand2 size={18} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Migliora Scansione</span>
                </button>
             </div>

             <div className="flex flex-col sm:flex-row gap-3">
               <button 
                  onClick={handleSkipCrop} 
                  disabled={loading}
                  className="w-full sm:w-2/5 py-4 bg-slate-50 dark:bg-[#111814] text-slate-700 dark:text-slate-300 font-bold font-sans text-xs uppercase tracking-wider border border-slate-200 dark:border-[#24352b] rounded-xl hover:bg-slate-100 dark:hover:bg-[#1a261f] transition-all flex items-center justify-center gap-2"
               >
                 {loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} 
                 Tieni Originale
               </button>
               <button 
                  onClick={handleConfirmCrop} 
                  disabled={loading}
                  className="w-full sm:w-3/5 py-4 bg-[#2D5A27] text-white font-bold font-sans text-sm tracking-wider rounded-xl shadow-md hover:bg-[#20401b] dark:bg-[#346b2d] dark:hover:bg-[#42a83a] transition-all flex items-center justify-center gap-2"
               >
                 {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 
                 Conferma Selezione
               </button>
             </div>
          </div>
        )}

        {step === 'edit' && imagePreview && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="polaroid-frame max-w-sm mx-auto polaroid-loading transition-colors rounded-xl">
              <div className="border border-slate-200 dark:border-[#24352b] rounded-sm overflow-hidden bg-slate-100 dark:bg-[#080d0a] flex items-center justify-center">
                 <img src={imagePreview} className="w-full max-h-[60vh] object-contain" alt="Preview" />
              </div>
              <button title="Annulla Caricamento" onClick={cancelBatch} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-[#151e18] text-slate-500 dark:text-slate-400 shadow-md border border-slate-200 dark:border-[#24352b] flex items-center justify-center hover:text-red-500 transition-colors z-10">
                 ✕ 
              </button>
            </div>

            <div className="space-y-6 pt-4">
              <div>
                 <label className="block text-xs font-bold font-sans text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">I tuoi ricordi</label>
                 <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans" placeholder="Descrivi il momento fotografato..." />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                 <button onClick={handleEnhance} disabled={isAiLoading} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 font-bold font-sans text-xs uppercase tracking-wider rounded-xl transition-colors border border-purple-200 dark:border-purple-900/50 disabled:opacity-50">
                   {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                   {isAiLoading ? 'Scrivendo...' : 'Ricordo AI'}
                 </button>
                 <button onClick={() => { setShowLocationModal(true); setLocationMode('menu'); }} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold font-sans text-xs uppercase tracking-wider rounded-xl transition-colors border ${location ? 'bg-[#2D5A27]/10 text-[#2D5A27] dark:text-[#42a83a] border-[#2D5A27]/20 dark:border-[#42a83a]/30' : 'bg-slate-50 dark:bg-[#111814] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#24352b] hover:bg-slate-100 dark:hover:bg-[#1a261f]'}`}>
                   <MapPin size={16} /> {location ? 'Punto Selezionato' : 'Puntina Mappa (+5m)'}
                 </button>
              </div>

              <div>
                 <label className="block text-xs font-bold font-sans text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Decennio Storico</label>
                 <select value={decade} onChange={e => setDecade(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans font-bold">
                   <option>Anni 70</option>
                   <option>Anni 80</option>
                   <option>Anni 90</option>
                   <option>Anni 00+</option>
                 </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold font-sans text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Visibilità (Piazza)</label>
                    <select value={visibilityStatus} onChange={e => setVisibilityStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans font-bold">
                       <option value="private">Privato (Solo tu)</option>
                       <option value="public">Pubblica Subito!</option>
                       <option value="scheduled">Programmata A Tempo</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold font-sans text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Stanza Cinematografo</label>
                    <select value={showInCinematografo ? 'true' : 'false'} onChange={e => setShowInCinematografo(e.target.value === 'true')} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a] transition-all font-sans font-bold">
                       <option value="true">Sì, proiettala</option>
                       <option value="false">No, nascondila</option>
                    </select>
                 </div>
              </div>

              {visibilityStatus === 'scheduled' && (
                 <div>
                    <label className="block text-xs font-bold font-sans text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Rilascio Programmato</label>
                    <input type="datetime-local" value={visibilityTime} onChange={e => setVisibilityTime(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#2D5A27] dark:focus:border-[#42a83a] transition-all font-sans font-bold" />
                 </div>
              )}

              <div className="pt-4">
                <button disabled={loading} onClick={handleUpload} className="w-full py-4 bg-[#2D5A27] text-white font-bold font-sans text-sm tracking-wider rounded-xl shadow-lg shadow-[#2D5A27]/20 hover:bg-[#20401b] dark:bg-[#346b2d] dark:hover:bg-[#42a83a] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Salvataggio...</> : 
                   fileQueue.length > 0 ? <><Upload size={18} /> Incolla e Prossima ({fileQueue.length}) (+10m)</> :
                   <><Upload size={18} /> Incolla nell'Album (+10m)</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2D5A27]/40 dark:bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full max-w-md bg-white dark:bg-[#151e18] rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 dark:border-[#24352b]">
               
               <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#24352b]">
                 <div className="flex items-center gap-3">
                   {locationMode !== 'menu' && (
                     <button onClick={() => setLocationMode('menu')} className="p-1 rounded-md text-slate-400 hover:text-[#2D5A27] hover:bg-slate-100 dark:hover:bg-[#1a261f] transition-colors"><ArrowLeft size={18} /></button>
                   )}
                   <h3 className="font-bold text-sm text-[#1a2e16] dark:text-slate-200 uppercase tracking-widest">
                     {locationMode === 'menu' ? 'Posizione dello Scatto' : locationMode === 'address' ? 'Cerca Posizione' : 'Mappa Libera'}
                   </h3>
                 </div>
                 <button onClick={() => setShowLocationModal(false)} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-[#1a261f] transition-colors"><X size={20} /></button>
               </div>

               <div className="p-6">
                 {/* Menu Options */}
                 {locationMode === 'menu' && (
                    <div className="flex flex-col gap-3">
                      <button onClick={handleAutoGPS} disabled={isSearchingLocation} className="flex items-center gap-4 w-full p-4 text-left border border-slate-200 dark:border-[#24352b] rounded-xl hover:border-[#2D5A27] dark:hover:border-[#42a83a] hover:bg-slate-50 dark:hover:bg-[#1a261f] transition-all group">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                          {isSearchingLocation ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-[#2D5A27] dark:group-hover:text-[#42a83a]">Coordinate GPS in automatico</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Prendi latitutine e longitudine esatti dal dispositivo</p>
                        </div>
                      </button>

                      <button onClick={() => setLocationMode('address')} className="flex items-center gap-4 w-full p-4 text-left border border-slate-200 dark:border-[#24352b] rounded-xl hover:border-[#2D5A27] dark:hover:border-[#42a83a] hover:bg-slate-50 dark:hover:bg-[#1a261f] transition-all group">
                        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-[#F5A623] flex items-center justify-center shrink-0"><Search size={18} /></div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-[#2D5A27] dark:group-hover:text-[#42a83a]">Cerca tramite Indirizzo</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Digita la via, il numero o un punto di interesse</p>
                        </div>
                      </button>

                      <button onClick={() => { setTempLocation(location || {lat: 45.9238, lng: 8.8655}); setLocationMode('manual') }} className="flex items-center gap-4 w-full p-4 text-left border border-slate-200 dark:border-[#24352b] rounded-xl hover:border-[#2D5A27] dark:hover:border-[#42a83a] hover:bg-slate-50 dark:hover:bg-[#1a261f] transition-all group">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-[#2D5A27] dark:text-[#42a83a] flex items-center justify-center shrink-0"><MapIcon size={18} /></div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-[#2D5A27] dark:group-hover:text-[#42a83a]">Visualizza e piazza su Mappa</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Clicca manualmente sull'area cartografica esatta</p>
                        </div>
                      </button>
                    </div>
                 )}

                 {/* Address Search */}
                 {locationMode === 'address' && (
                    <form onSubmit={handleAddressSearch} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Inserisci Via o Luogo</label>
                        <input type="text" value={addressQuery} onChange={e => setAddressQuery(e.target.value)} placeholder="Es. Via Roma, Marzio" autoFocus className="w-full border border-slate-200 dark:border-[#24352b] bg-slate-50 dark:bg-[#111814] text-slate-800 dark:text-slate-200 p-3 rounded-lg outline-none focus:ring-1 focus:ring-[#2D5A27] dark:focus:ring-[#42a83a]" />
                      </div>
                      <button type="submit" disabled={isSearchingLocation || !addressQuery} className="w-full py-3 bg-[#2D5A27] hover:bg-[#20401b] dark:bg-[#346b2d] dark:hover:bg-[#42a83a] text-white rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50">
                        {isSearchingLocation ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} 
                        Cerca Geometria
                      </button>
                    </form>
                 )}

                 {/* Manual Map Picker */}
                 {locationMode === 'manual' && (
                    <div className="flex flex-col gap-4">
                      <div className="w-full h-64 bg-slate-100 dark:bg-[#111814] rounded-lg overflow-hidden border border-slate-200 dark:border-[#24352b] relative z-0">
                         <MapContainer center={tempLocation || [45.9238, 8.8655]} zoom={16} scrollWheelZoom={true} className="w-full h-full z-0 font-sans" zoomControl={true} key={isDark ? 'dark' : 'light'}>
                           <LayersControl position="topright">
                             <LayersControl.BaseLayer name="Esploratore (Satellitare)">
                               <TileLayer
                                 attribution='&copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
                                 url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                 maxZoom={19}
                               />
                             </LayersControl.BaseLayer>
                             <LayersControl.BaseLayer name="Sentieri e Strade (OpenStreetMap)" checked={!isDark}>
                               <TileLayer
                                 attribution='&copy; OpenStreetMap'
                                 url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                                 maxZoom={19}
                               />
                             </LayersControl.BaseLayer>
                             <LayersControl.BaseLayer name="Visione Notturna" checked={isDark}>
                               <TileLayer
                                 attribution='&copy; CartoDB'
                                 url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                 maxZoom={19}
                               />
                             </LayersControl.BaseLayer>
                           </LayersControl>
                           <LocationPicker onSelect={(ll) => setTempLocation(ll)} />
                           {tempLocation && <Marker position={[tempLocation.lat, tempLocation.lng]} icon={pinIcon} />}
                         </MapContainer>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                         <p>Tocca la mappa per spostare il puntatore.</p>
                      </div>
                      <button onClick={() => { setLocation(tempLocation); setShowLocationModal(false); }} disabled={!tempLocation} className="w-full py-3 bg-[#2D5A27] hover:bg-[#20401b] dark:bg-[#346b2d] dark:hover:bg-[#42a83a] text-white rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50">
                        <MapPin size={16} /> Conferma Posizione
                      </button>
                    </div>
                 )}
               </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
