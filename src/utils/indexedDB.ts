import { LocalTrack, LocalPlaylist } from '../types/audio';

const DB_NAME = 'marzio1777_audio';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle disconnected
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('tracks')) {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
        trackStore.createIndex('artist', 'artist', { unique: false });
        trackStore.createIndex('album', 'album', { unique: false });
        trackStore.createIndex('year', 'year', { unique: false });
        trackStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        trackStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
    };
  });
}

export async function addTrack(track: LocalTrack): Promise<LocalTrack> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const request = store.add(track);

    request.onsuccess = () => resolve(track);
    request.onerror = () => reject(request.error);
  });
}

export async function getTrack(id: string): Promise<LocalTrack | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTracks(): Promise<LocalTrack[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const request = store.getAll();

    request.onsuccess = () => {
       // Sort by uploadedAt descendant by default
       const tracks = request.result as LocalTrack[];
       tracks.sort((a, b) => b.uploadedAt - a.uploadedAt);
       resolve(tracks);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function searchTracks(query: string): Promise<LocalTrack[]> {
  const allTracks = await getAllTracks();
  if (!query.trim()) return allTracks;
  
  const q = query.toLowerCase();
  return allTracks.filter(t => 
    t.title.toLowerCase().includes(q) || 
    t.artist.toLowerCase().includes(q) || 
    (t.album && t.album.toLowerCase().includes(q))
  );
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateTrack(track: LocalTrack): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const request = store.put(track);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getStorageQuota(): Promise<{ used: number; total: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      total: estimate.quota || 0
    };
  }
  return { used: 0, total: 0 };
}

// Playlists (skeletons for now)
export async function getPlaylists(): Promise<LocalPlaylist[]> {
   const db = await getDB();
   return new Promise((resolve, reject) => {
     const tx = db.transaction('playlists', 'readonly');
     const store = tx.objectStore('playlists');
     const request = store.getAll();
     request.onsuccess = () => resolve(request.result);
     request.onerror = () => reject(request.error);
   });
}

export async function addPlaylist(playlist: LocalPlaylist): Promise<void> {
   const db = await getDB();
   return new Promise((resolve, reject) => {
     const tx = db.transaction('playlists', 'readwrite');
     const store = tx.objectStore('playlists');
     const request = store.put(playlist);
     request.onsuccess = () => resolve();
     request.onerror = () => reject(request.error);
   });
}
