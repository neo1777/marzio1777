import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LocalTrack } from '../../types/audio';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, ChevronDown, ListPlus, Volume2, SlidersHorizontal, Moon, X } from 'lucide-react';
import Visualizer from './Visualizer';
import Equalizer from './Equalizer';
import { getAudioEngine } from '../../utils/audioEngine';

interface Props {
  track: LocalTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleMode: boolean;
  repeatMode: 'off' | 'one' | 'all';
  bgPlayback: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleBgPlayback: () => void;
  onClose: () => void;
  onStop: () => void;
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function FullScreenPlayer(props: Props) {
  const { track, isPlaying, currentTime, duration, onClose } = props;
  const [showEQ, setShowEQ] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const analyser = getAudioEngine().getAnalyser();

  if (!track) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-[#0A0A0F] text-[#F5F0E1] flex flex-col pt-safe px-4 pb-safe sm:p-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center py-4 sm:py-6">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors" aria-label="Riduci a icona">
          <ChevronDown size={28} />
        </button>
        <span className="text-xs font-bold tracking-widest text-[#879b8f] uppercase">In Riproduzione</span>
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 transition-colors opacity-50 cursor-not-allowed group relative">
            <ListPlus size={24} />
            <div className="absolute top-full right-0 mt-2 bg-[#24352b] text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              Aggiungi alla coda della Sessione (Disponibile in fase 2)
            </div>
          </button>
          <button
            onClick={props.onStop}
            className="p-2 text-slate-400 hover:text-red-300 transition-colors"
            aria-label="Ferma e chiudi"
            title="Ferma e chiudi il player"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full justify-center">
        {/* Cover Art / Vinyl */}
        <div className="relative w-full aspect-square max-h-[300px] mx-auto mb-8 sm:mb-12 rounded-2xl sm:rounded-full bg-[#16161D] shadow-2xl flex items-center justify-center overflow-hidden border-4 border-[#1a1a24]">
           {track.coverDataUrl ? (
              <img 
                src={track.coverDataUrl} 
                className={`w-full h-full object-cover transition-all duration-700 ${isPlaying && !prefersReducedMotion ? 'spin-slow rounded-full scale-100' : 'scale-105 rounded-2xl'}`} 
                alt="cover" 
                style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              />
           ) : (
              <div className={`w-full h-full flex items-center justify-center text-[#24352b] ${isPlaying && !prefersReducedMotion ? 'spin-slow rounded-full' : ''}`} style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              </div>
           )}
           {/* Center hole for vinyl effect */}
           {(!prefersReducedMotion || isPlaying) && (
             <div className="absolute w-8 h-8 bg-[#0A0A0F] rounded-full border border-[#24352b] z-10"></div>
           )}
        </div>

        {/* Info */}
        <div className="text-center mb-6">
           <h2 className="text-2xl font-bold truncate mb-1 text-[#F5F0E1]">{track.title}</h2>
           <p className="text-lg text-[#FFA000] truncate">{track.artist}</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
           <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={currentTime}
              onChange={(e) => props.onSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#24352b] rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FFA000] cursor-pointer"
           />
           <div className="flex justify-between text-xs text-[#879b8f] font-mono mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
           </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-between mb-8 px-4">
           <button onClick={props.onToggleShuffle} className={`p-3 transition-colors ${props.shuffleMode ? 'text-[#FFA000]' : 'text-slate-500 hover:text-white'}`}>
              <Shuffle size={20} />
           </button>
           
           <div className="flex items-center gap-4 sm:gap-6">
              <button onClick={props.onPrev} className="p-3 text-white hover:text-[#FFA000] transition-colors rounded-full active:scale-95">
                 <SkipBack size={28} fill="currentColor" />
              </button>
              <button 
                 onClick={props.onPlayPause} 
                 className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#FFA000] to-[#C2410C] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#C2410C]/20 hover:scale-105 active:scale-95 transition-transform"
              >
                 {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={props.onNext} className="p-3 text-white hover:text-[#FFA000] transition-colors rounded-full active:scale-95">
                 <SkipForward size={28} fill="currentColor" />
              </button>
           </div>

           <button onClick={props.onToggleRepeat} className={`p-3 transition-colors relative flex items-center justify-center ${props.repeatMode !== 'off' ? 'text-[#FFA000]' : 'text-slate-500 hover:text-white'}`}>
              <Repeat size={20} />
              {props.repeatMode === 'one' && <span className="absolute text-[8px] font-bold mt-0.5">1</span>}
           </button>
        </div>

        {/* Bottom Bar: Visualizer / EQ / Volume */}
        <div className="mt-auto pb-4">
           {showEQ ? (
             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
               <Equalizer onEQChange={(l, m, h) => getAudioEngine().setEQ(l, m, h)} />
             </motion.div>
           ) : (
             <Visualizer analyser={analyser} isPlaying={isPlaying} />
           )}

           <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                 <Volume2 size={16} className="text-slate-500" />
                 <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={props.volume} 
                    onChange={(e) => props.onVolume(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#24352b] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                 />
              </div>
              <div className="flex gap-4">
                 <button onClick={props.onToggleBgPlayback} className={`p-2 rounded-full transition-colors ${props.bgPlayback ? 'bg-[#2D5A27]/20 text-[#42a83a]' : 'text-slate-500 hover:text-white'}`} title="Background Playback (Keep awake)">
                    <Moon size={18} />
                 </button>
                 <button onClick={() => setShowEQ(!showEQ)} className={`p-2 transition-colors ${showEQ ? 'text-[#FFA000]' : 'text-slate-500 hover:text-white'}`}>
                    <SlidersHorizontal size={18} />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
