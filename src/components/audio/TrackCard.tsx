import React, { useState } from 'react';
import { LocalTrack } from '../../types/audio';
import { Play, MoreVertical, Heart, Trash2, Tag, ListPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  track: LocalTrack;
  onPlay: (track: LocalTrack) => void;
  onToggleFav: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDuration(ms: number) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackCard({ track, onPlay, onToggleFav, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group bg-[#16161D] hover:bg-[#1a1a24] rounded-xl p-3 flex items-center gap-4 transition-colors border border-transparent hover:border-[#24352b]">
      
      {/* Cover / Play button */}
      <div 
        className="w-14 h-14 bg-[#0A0A0F] rounded-lg overflow-hidden relative cursor-pointer flex-shrink-0"
        onClick={() => onPlay(track)}
      >
        {track.coverDataUrl ? (
          <img src={track.coverDataUrl} alt={track.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#24352b]">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
           <Play fill="white" className="text-white w-6 h-6" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0" onClick={() => onPlay(track)}>
        <h4 className="text-[#F5F0E1] font-semibold text-base truncate">{track.title}</h4>
        <p className="text-[#879b8f] text-sm truncate">{track.artist}</p>
      </div>

      {/* Meta & Actions */}
      <div className="flex items-center gap-3">
        <span className="text-[#879b8f] text-xs font-mono hidden sm:inline-block">{formatDuration(track.durationMs)}</span>
        
        <button onClick={() => onToggleFav(track.id)} className="p-2 text-slate-500 hover:text-[#C2410C] transition-colors">
           <Heart size={18} fill={track.isFavorite ? '#C2410C' : 'transparent'} stroke={track.isFavorite ? '#C2410C' : 'currentColor'} />
        </button>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-slate-500 hover:text-[#F5F0E1] transition-colors">
            <MoreVertical size={18} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a24] border border-[#24352b] rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden"
                >
                  <button className="w-full text-left px-4 py-3 text-sm text-[#F5F0E1] hover:bg-[#24352b] flex items-center gap-3 transition-colors opacity-50 cursor-not-allowed">
                     <ListPlus size={16} /> Aggiungi a Playlist
                  </button>
                  <button className="w-full text-left px-4 py-3 text-sm text-[#F5F0E1] hover:bg-[#24352b] flex items-center gap-3 transition-colors opacity-50 cursor-not-allowed">
                     <Tag size={16} /> Modifica Tag
                  </button>
                  <div className="h-px bg-[#24352b] w-full my-1"></div>
                  <button onClick={() => { onDelete(track.id); setShowMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-950/30 flex items-center gap-3 transition-colors">
                     <Trash2 size={16} /> Elimina traccia
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
