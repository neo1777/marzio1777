import React, { useState, useMemo } from 'react';
import { useLocalLibrary } from '../hooks/useLocalLibrary';
import UploadZone from '../components/audio/UploadZone';
import TrackCard from '../components/audio/TrackCard';
import { LocalTrack } from '../types/audio';
import { Search, Loader2, Music } from 'lucide-react';

interface Props {
  onPlayTrack: (track: LocalTrack, trackList: LocalTrack[]) => void;
}

export default function PersonalLibrary({ onPlayTrack }: Props) {
  const { tracks, isLoading, error, storageQuota, uploadFiles, deleteTrack, toggleFavorite } = useLocalLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFav, setFilterFav] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleUpload = async (files: File[]) => {
     setIsUploading(true);
     await uploadFiles(files, (msg) => setUploadProgress(msg));
     setIsUploading(false);
  };

  const filteredTracks = useMemo(() => {
     let res = tracks;
     if (filterFav) res = res.filter(t => t.isFavorite);
     if (searchQuery) {
        const q = searchQuery.toLowerCase();
        res = res.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
     }
     return res;
  }, [tracks, searchQuery, filterFav]);

  const handlePlay = (track: LocalTrack) => {
     onPlayTrack(track, filteredTracks);
  };

  const formatQuota = (bytes: number) => {
     if (!bytes) return '0 MB';
     const mb = bytes / (1024 * 1024);
     if (mb > 1024) return (mb / 1024).toFixed(1) + ' GB';
     return mb.toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] p-4 sm:p-6 overflow-y-auto">
      
      <div className="mb-6">
         <h1 className="text-3xl font-serif font-bold text-[#F5F0E1] mb-2">La Biblioteca Personale</h1>
         <p className="text-[#879b8f]">La tua collezione locale di Temi in alta fedeltà. Nessun file viene inviato al cloud.</p>
      </div>

      <UploadZone onUpload={handleUpload} isUploading={isUploading} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
               type="text" 
               placeholder="Cerca per titolo, artista o album..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full bg-[#16161D] border border-[#24352b] rounded-xl pl-10 pr-4 py-3 text-[#F5F0E1] focus:outline-none focus:border-[#C2410C] transition-colors"
            />
         </div>
         <button 
            onClick={() => setFilterFav(!filterFav)}
            className={`px-4 py-3 rounded-xl border font-bold text-sm transition-colors ${filterFav ? 'bg-[#C2410C]/20 border-[#C2410C] text-[#C2410C]' : 'bg-[#16161D] border-[#24352b] text-slate-400 hover:text-white'}`}
         >
            Preferiti
         </button>
      </div>

      {isLoading ? (
         <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="animate-spin w-8 h-8 mb-4" />
            <p>Caricamento libreria...</p>
         </div>
      ) : error ? (
         <div className="flex-1 flex items-center justify-center text-red-500 p-8 border border-red-900/50 rounded-xl bg-red-950/20">
            <p>{error}</p>
         </div>
      ) : filteredTracks.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-[#24352b] rounded-2xl p-8 text-center min-h-[200px]">
            <Music className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-bold text-[#F5F0E1] mb-1">Nessun Tema trovato</p>
            <p>La tua biblioteca è vuota o la ricerca non ha prodotto risultati.</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-32">
            {filteredTracks.map(track => (
               <TrackCard 
                  key={track.id} 
                  track={track} 
                  onPlay={handlePlay} 
                  onToggleFav={toggleFavorite} 
                  onDelete={deleteTrack} 
               />
            ))}
         </div>
      )}

      {/* Footer Meta */}
      <div className="mt-auto pt-6 border-t border-[#24352b] text-center text-xs text-[#879b8f] font-mono flex items-center justify-center gap-4">
         <span>{tracks.length} tracce locali</span>
         <span>•</span>
         <span>Quota device: {formatQuota(storageQuota.used)} usati / {formatQuota(storageQuota.total)} liberi</span>
      </div>

    </div>
  );
}
