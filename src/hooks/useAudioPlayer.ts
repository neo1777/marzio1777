import { useState, useCallback, useEffect, useRef } from 'react';
import { getAudioEngine } from '../utils/audioEngine';
import { LocalTrack } from '../types/audio';
import * as db from '../utils/indexedDB';

export function useAudioPlayer() {
  const engine = getAudioEngine();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<LocalTrack | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<LocalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const [volume, setVolumeState] = useState(() => parseFloat(localStorage.getItem('ainulindale_volume') || '1'));
  const [shuffleMode, setShuffleMode] = useState(() => localStorage.getItem('ainulindale_shuffle') === 'true');
  const [repeatMode, setRepeatMode] = useState<'off'|'one'|'all'>(() => (localStorage.getItem('ainulindale_repeat') as any) || 'off');
  const [bgPlayback, setBgPlayback] = useState(() => localStorage.getItem('ainulindale_bg_playback') === 'true');

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Re-apply saved values to engine on mount
  useEffect(() => {
     engine.setVolume(volume);

     return () => {
        if ('mediaSession' in navigator) {
           navigator.mediaSession.setActionHandler('play', null);
           navigator.mediaSession.setActionHandler('pause', null);
           navigator.mediaSession.setActionHandler('previoustrack', null);
           navigator.mediaSession.setActionHandler('nexttrack', null);
           navigator.mediaSession.setActionHandler('seekbackward', null);
           navigator.mediaSession.setActionHandler('seekforward', null);
           navigator.mediaSession.setActionHandler('seekto', null);
        }
     };
  }, []);

  const requestWakeLock = async () => {
    if (bgPlayback && 'wakeLock' in navigator && isPlaying) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock error', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Sync state from engine and Wakelock
  useEffect(() => {
    const onPlay = () => {
       setIsPlaying(true);
       requestWakeLock();
    };
    const onPause = () => {
       setIsPlaying(false);
       releaseWakeLock();
    };
    const onTimeUpdate = () => {
      setCurrentTime(engine.getCurrentTime());
      if(engine.getDuration() !== duration && engine.getDuration() > 0) setDuration(engine.getDuration());
    };
    
    const onEnded = () => {
       if (repeatMode === 'one') {
          engine.seek(0);
          engine.play();
       } else {
          next();
       }
    };

    engine.on('play', onPlay);
    engine.on('pause', onPause);
    engine.on('timeupdate', onTimeUpdate);
    engine.on('ended', onEnded);

    return () => {
      engine.off('play', onPlay);
      engine.off('pause', onPause);
      engine.off('timeupdate', onTimeUpdate);
      engine.off('ended', onEnded);
    };
  }, [repeatMode]);

  useEffect(() => {
     if(isPlaying) requestWakeLock();
     else releaseWakeLock();
  }, [bgPlayback, isPlaying]);

  const updateMediaSession = (track: LocalTrack) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        artwork: track.coverDataUrl ? [{ src: track.coverDataUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });

      navigator.mediaSession.setActionHandler('play', () => engine.play());
      navigator.mediaSession.setActionHandler('pause', () => engine.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('seekbackward', (d) => engine.seek(engine.getCurrentTime() - (d.seekOffset ?? 10)));
      navigator.mediaSession.setActionHandler('seekforward', (d) => engine.seek(engine.getCurrentTime() + (d.seekOffset ?? 10)));
      navigator.mediaSession.setActionHandler('seekto', (d) => engine.seek(d.seekTime ?? 0));
    }
  };

  const playQueue = async (newQueue: LocalTrack[], startIndex: number = 0) => {
    if(newQueue.length === 0) return;
    setQueue(newQueue);
    
    // Build actual playlist logic considering shuffle later if needed, but for now simple swap
    setCurrentIndex(startIndex);
    const track = newQueue[startIndex];
    
    await playTrack(track);
  };

  // Direct blob play (e.g. for DJ session)
  const playBlob = async (blob: Blob) => {
     try {
        await engine.load(blob);
        await engine.play();
     } catch (e) {
        console.error("Play blob error", e);
     }
  };

  const playTrack = async(track: LocalTrack) => {
     try {
       await engine.load(track.blob);
       setCurrentTrack(track);
       setDuration(track.durationMs / 1000); // approx until engine parses
       await engine.play();
       updateMediaSession(track);
       
       // Update playcount
       track.playCount += 1;
       track.lastPlayedAt = Date.now();
       db.updateTrack(track); // fire and forget
     } catch (e) {
        console.error("Play error", e);
     }
  }

  const next = () => {
    if (queue.length === 0) return;
    let nextIdx = currentIndex + 1;
    if (shuffleMode) {
       nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
       if (repeatMode === 'all') nextIdx = 0;
       else return; // Stop at end of queue
    }
    
    setCurrentIndex(nextIdx);
    playTrack(queue[nextIdx]);
  };

  const prev = () => {
    if (engine.getCurrentTime() > 3) {
      engine.seek(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = currentIndex - 1;
    if (shuffleMode) {
       prevIdx = Math.floor(Math.random() * queue.length);
    } else if (prevIdx < 0) {
       if (repeatMode === 'all') prevIdx = queue.length - 1;
       else prevIdx = 0; 
    }
    
    setCurrentIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  const togglePlay = () => {
    if (isPlaying) engine.pause();
    else engine.play();
  };

  const seek = (time: number) => {
    engine.seek(time);
  };

  const setVolume = (v: number) => {
    engine.setVolume(v);
    setVolumeState(v);
    localStorage.setItem('ainulindale_volume', v.toString());
  };

  const setEQ = (low: number, mid: number, high: number) => {
     engine.setEQ(low, mid, high);
  };

  const toggleShuffle = () => {
     const nextVal = !shuffleMode;
     setShuffleMode(nextVal);
     localStorage.setItem('ainulindale_shuffle', nextVal.toString());
  };

  const toggleRepeat = () => {
     const modes: ('off'|'all'|'one')[] = ['off', 'all', 'one'];
     const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
     setRepeatMode(modes[nextIdx]);
     localStorage.setItem('ainulindale_repeat', modes[nextIdx]);
  };

  const toggleBgPlayback = () => {
     const nextVal = !bgPlayback;
     setBgPlayback(nextVal);
     localStorage.setItem('ainulindale_bg_playback', nextVal.toString());
  };

  return {
    isPlaying,
    currentTrack,
    currentTime,
    duration,
    queue,
    currentIndex,
    volume,
    shuffleMode,
    repeatMode,
    bgPlayback,
    
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setEQ,
    toggleShuffle,
    toggleRepeat,
    toggleBgPlayback,
    playQueue,
    
    // Exposed for DJ direct wrapper:
    engine,
    playBlob,
    pause: () => engine.pause(),
    resume: () => engine.play(),
    stop: () => { engine.pause(); engine.seek(0); setIsPlaying(false); },
    getCurrentTime: () => engine.getCurrentTime(),
    getDuration: () => engine.getDuration()
  };
}
