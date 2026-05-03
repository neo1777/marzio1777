import { useEffect, useState } from 'react';
import { getAudioEngine } from '../utils/audioEngine';

/**
 * Raw access to the AudioEngine singleton for the DJ session flow, where the
 * Walkman state machine (queue, shuffle, repeat, mediaSession, wake-lock)
 * doesn't apply — the DJ feeds blobs received via WebRTC directly.
 *
 * Keep this hook *thin*: no localStorage, no Media Session, no Wake Lock.
 * Those concerns live in useAudioPlayer (Walkman library).
 */
export function useAudioEngineRaw() {
  const engine = getAudioEngine();
  const [isPlaying, setIsPlaying] = useState(engine.isPlaying());

  useEffect(() => {
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    engine.on('play', onPlay);
    engine.on('pause', onPause);
    engine.on('ended', onEnded);
    return () => {
      engine.off('play', onPlay);
      engine.off('pause', onPause);
      engine.off('ended', onEnded);
    };
  }, [engine]);

  const playBlob = async (blob: Blob) => {
    try {
      await engine.load(blob);
      await engine.play();
    } catch (e) {
      console.error('Play blob error', e);
    }
  };

  return {
    engine,
    isPlaying,
    playBlob,
    pause: () => engine.pause(),
    resume: () => engine.play(),
    stop: () => { engine.pause(); engine.seek(0); },
    getCurrentTime: () => engine.getCurrentTime(),
    getDuration: () => engine.getDuration(),
  };
}
