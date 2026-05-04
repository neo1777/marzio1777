import React, { useState } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import PersonalLibrary from './PersonalLibrary';
import MiniPlayer from '../components/audio/MiniPlayer';
import FullScreenPlayer from '../components/audio/FullScreenPlayer';
import { LocalTrack } from '../types/audio';
import { AnimatePresence } from 'framer-motion';
import { Disc3, Radio, PlusCircle } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AudioSessionsList } from './AudioSessionsList';
import { AudioSessionCreate } from './AudioSessionCreate';
import { AudioSessionDJ } from './AudioSessionDJ';
import { AudioSessionListener } from './AudioSessionListener';
import { useAuth } from '../contexts/AuthContext';
import { useAudioSession } from '../hooks/useAudioSession';

function IlAinulindaleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const player = useAudioPlayer();

  const handlePlayTrack = (track: LocalTrack, trackList: LocalTrack[]) => {
     try {
        const startIndex = trackList.findIndex(t => t.id === track.id);
        player.playQueue(trackList, Math.max(0, startIndex));
     } catch (e) {
        console.error('[Ainulindalë] play error', e);
     }
  };

  const getActiveTab = () => {
     if (location.pathname.includes('/sessioni/nuova')) return 'nuova';
     if (location.pathname.includes('/sessioni')) return 'sessioni';
     return 'biblioteca';
  };
  const activeTab = getActiveTab();

  const TabButton = ({ id, label, icon: Icon, path }: { id: string, label: string, icon: any, path: string }) => (
     <button 
        onClick={() => navigate(path)}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 border-b-2 transition-colors ${activeTab === id ? 'border-[#FFA000] text-[#FFA000]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
     >
        <Icon size={20} />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
     </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-[#F5F0E1] relative">
      
      {/* Header bar */}
      <div className="bg-[#16161D] border-b border-[#24352b] px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFA000] to-[#C2410C] flex items-center justify-center shadow-lg shadow-[#C2410C]/20">
               <Disc3 size={24} className="text-white" />
            </div>
            <div>
               <h1 className="text-xl font-serif font-bold text-white tracking-wide">L'Ainulindalë</h1>
               <p className="text-[10px] text-[#FFA000] font-mono tracking-widest uppercase">La Grande Musica del Bivacco</p>
            </div>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#16161D] border-b border-[#24352b] shrink-0">
         <TabButton id="biblioteca" label="Biblioteca" icon={Disc3} path="/dashboard/ainulindale" />
         <TabButton id="sessioni" label="Sessioni" icon={Radio} path="/dashboard/ainulindale/sessioni" />
         <TabButton id="nuova" label="Apri Sessione" icon={PlusCircle} path="/dashboard/ainulindale/sessioni/nuova" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
         <Routes>
            <Route index element={<PersonalLibrary onPlayTrack={handlePlayTrack} />} />
            <Route path="sessioni" element={<AudioSessionsList />} />
            <Route path="sessioni/nuova" element={<AudioSessionCreate />} />
            <Route path="sessioni/:id/dj" element={<AudioSessionDJ />} />
            <Route path="sessioni/:id" element={<AudioSessionWrapper />} />
         </Routes>
      </div>

      {/* Flow Players */}
      <AnimatePresence>
         {player.currentTrack && !showFullPlayer && (
            <MiniPlayer
               track={player.currentTrack}
               isPlaying={player.isPlaying}
               progressPercent={(player.currentTime / (player.duration || 1)) * 100}
               onPlayPause={player.togglePlay}
               onExpand={() => setShowFullPlayer(true)}
               onClose={player.stop}
            />
         )}
      </AnimatePresence>

      <AnimatePresence>
         {showFullPlayer && player.currentTrack && (
            <FullScreenPlayer
               track={player.currentTrack}
               isPlaying={player.isPlaying}
               currentTime={player.currentTime}
               duration={player.duration}
               volume={player.volume}
               shuffleMode={player.shuffleMode}
               repeatMode={player.repeatMode}
               bgPlayback={player.bgPlayback}
               onPlayPause={player.togglePlay}
               onNext={player.next}
               onPrev={player.prev}
               onSeek={player.seek}
               onVolume={player.setVolume}
               onToggleShuffle={player.toggleShuffle}
               onToggleRepeat={player.toggleRepeat}
               onToggleBgPlayback={player.toggleBgPlayback}
               onClose={() => setShowFullPlayer(false)}
               onStop={() => { player.stop(); setShowFullPlayer(false); }}
            />
         )}
      </AnimatePresence>

    </div>
  );
}

// Wrapper to decide if DJ or Listener view based on session.djId.
function AudioSessionWrapper() {
   const { id } = useParams<{id: string}>();
   const { user } = useAuth();
   const { session, loading } = useAudioSession(id!);

   if (loading || !session) return <div className="p-8">Caricamento...</div>;

   if (session.djId === user?.uid) {
      return <AudioSessionDJ />;
   } else {
      return <AudioSessionListener />;
   }
}

export default IlAinulindaleLayout;
