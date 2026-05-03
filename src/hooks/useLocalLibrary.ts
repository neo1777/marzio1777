import { useState, useCallback, useEffect } from 'react';
import { LocalTrack, LocalPlaylist } from '../types/audio';
import * as db from '../utils/indexedDB';
import { parseAudioFile } from '../utils/id3';

export function useLocalLibrary() {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{used: number, total: number}>({used: 0, total: 0});

  const refreshTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      const all = await db.getAllTracks();
      setTracks(all);
      const q = await db.getStorageQuota();
      setQuota(q);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load library");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTracks();
  }, [refreshTracks]);

  const uploadFiles = useCallback(async (files: File[], onProgress?: (msg: string) => void) => {
    setError(null);
    for (let i = 0; i < files.length; i++) {
       const file = files[i];
       if(!file.type.startsWith('audio/')) continue;
       if(file.size > 50 * 1024 * 1024) continue; // max 50MB
       
       onProgress?.(`Elaborazione ${file.name}...`);
       
       try {
           const parsed = await parseAudioFile(file);
           
           const newTrack: LocalTrack = {
              id: crypto.randomUUID(),
              title: parsed.title || 'Senza Titolo',
              artist: parsed.artist || 'Artista Sconosciuto',
              album: parsed.album,
              year: parsed.year,
              genre: parsed.genre,
              durationMs: parsed.durationMs,
              coverDataUrl: parsed.coverDataUrl,
              blob: file,
              mimeType: file.type || 'audio/mp3',
              sizeBytes: file.size,
              uploadedAt: Date.now(),
              playCount: 0,
              isFavorite: false,
              customTags: []
           };
           
           await db.addTrack(newTrack);
       } catch(e) {
           console.error("Upload error for file " + file.name, e);
       }
    }
    await refreshTracks();
  }, [refreshTracks]);

  const deleteTrack = useCallback(async (id: string) => {
    await db.deleteTrack(id);
    await refreshTracks();
  }, [refreshTracks]);

  const toggleFavorite = useCallback(async (id: string) => {
    const track = await db.getTrack(id);
    if(track) {
       track.isFavorite = !track.isFavorite;
       await db.updateTrack(track);
       await refreshTracks();
    }
  }, [refreshTracks]);

  const updateTrackObj = useCallback(async(track: LocalTrack) => {
     await db.updateTrack(track);
     await refreshTracks();
  }, [refreshTracks]);

  const searchLocal = useCallback(async (query: string) => {
    return await db.searchTracks(query);
  }, []);

  return {
    tracks,
    isLoading,
    error,
    storageQuota: quota,
    uploadFiles,
    deleteTrack,
    toggleFavorite,
    updateTrackObj,
    searchLocal,
    refreshTracks
  };
}
