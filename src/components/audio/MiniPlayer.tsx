import React from 'react';
import { LocalTrack } from '../../types/audio';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  track: LocalTrack | null;
  isPlaying: boolean;
  progressPercent: number;
  onPlayPause: () => void;
  onExpand: () => void;
}

export default function MiniPlayer({ track, isPlaying, progressPercent, onPlayPause, onExpand }: Props) {
  if (!track) return null;

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-[72px] md:bottom-6 left-2 right-2 md:left-auto md:right-6 md:w-80 bg-[#1a1a24]/95 backdrop-blur-md border border-[#24352b] rounded-xl shadow-2xl z-50 overflow-hidden flex cursor-pointer"
      onClick={onExpand}
    >
       {/* Background progress bar */}
       <div 
         className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#FFA000] to-[#C2410C] transition-all duration-300 pointer-events-none" 
         style={{ width: `${progressPercent}%` }} 
       />

       <div className="w-14 items-center justify-center flex bg-[#0A0A0F] border-r border-[#24352b] relative shrink-0">
          {track.coverDataUrl ? (
             <img src={track.coverDataUrl} className="w-full h-full object-cover" alt="" />
          ) : (
             <div className="w-8 h-8 rounded-full border border-slate-700"></div>
          )}
       </div>

       <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2">
          <h4 className="text-sm font-bold text-[#F5F0E1] truncate">{track.title}</h4>
          <p className="text-xs text-[#879b8f] truncate">{track.artist}</p>
       </div>

       <div className="px-3 flex items-center justify-center">
          <button 
             onClick={(e) => { e.stopPropagation(); onPlayPause(); }} 
             className="w-10 h-10 rounded-full hover:bg-[#24352b] flex items-center justify-center text-white transition-colors"
          >
             {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
       </div>
    </motion.div>
  );
}
