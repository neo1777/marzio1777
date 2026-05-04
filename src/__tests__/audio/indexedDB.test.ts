import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import * as db from '../../utils/indexedDB';
import { LocalTrack } from '../../types/audio';

describe('IndexedDB', () => {
    beforeEach(async () => {
       // fake-indexeddb automatically polyfills the global indexedDB.
       // The DB name must match the one used in src/utils/indexedDB.ts
       // (`marzio1777_audio`). The previous value (`AinulindaleDB`) was a
       // no-op cleanup — a renaming leftover that fake-indexeddb tolerated
       // but didn't isolate runs against.
       await new Promise<void>((resolve) => {
           const req = indexedDB.deleteDatabase('marzio1777_audio');
           req.onsuccess = () => resolve();
           req.onerror = () => resolve();
           req.onblocked = () => resolve();
       });
    });

    it('addTrack and getTrack works', async () => {
       const mockBlob = new Blob(['test audio data'], { type: 'audio/mpeg' });
       const track: LocalTrack = {
           id: 'test-track-123',
           title: 'Test Song',
           artist: 'Test Artist',
           album: 'Test Album',
           durationMs: 120000,
           blob: mockBlob,
           mimeType: 'audio/mpeg',
           sizeBytes: mockBlob.size,
           isFavorite: false,
           playCount: 0,
           uploadedAt: Date.now(),
           customTags: []
       };

       await db.addTrack(track);

       const retrieved = await db.getTrack('test-track-123');
       expect(retrieved).not.toBeNull();
       expect(retrieved?.title).toBe('Test Song');
       expect(retrieved?.artist).toBe('Test Artist');
    });

    it('getAllTracks returns array', async () => {
       const tracks = await db.getAllTracks();
       expect(Array.isArray(tracks)).toBe(true);
    });

    it('deleteTrack removes', async () => {
       const mockBlob = new Blob(['test'], { type: 'audio/mpeg' });
       const track: LocalTrack = {
           id: 'to-delete',
           title: 'To Delete',
           artist: 'A',
           durationMs: 1000,
           blob: mockBlob,
           mimeType: 'audio/mpeg',
           sizeBytes: mockBlob.size,
           isFavorite: false,
           playCount: 0,
           uploadedAt: Date.now(),
           customTags: []
       };
       await db.addTrack(track);
       
       await db.deleteTrack('to-delete');
       const retrieved = await db.getTrack('to-delete');
       expect(retrieved).toBeNull();
    });

    it('getStorageQuota returns objects', async () => {
       const q = await db.getStorageQuota();
       expect(typeof q.used).toBe('number');
       expect(typeof q.total).toBe('number');
    });
});
