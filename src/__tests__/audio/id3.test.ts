import { describe, it, expect } from 'vitest';
import { parseID3, parseAudioFile } from '../../utils/id3';

function createMockBlob(content: number[]): Blob {
  return new Blob([new Uint8Array(content)]);
}

describe('ID3 Parser', () => {
  it('parses valid ID3v2.3 tag', async () => {
    // Manually create a mock ID3v2.3 buffer with TIT2 (Title)
    // 'ID3', version 3, 0 flags, size 20
    const header = [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14];
    // 'TIT2', size 5 (without syncsafe), flags: 0, 0
    const frameHeader = [0x54, 0x49, 0x54, 0x32, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00];
    // Encoding 0, 'T', 'E', 'S', 'T'
    const frameBody = [0x00, 0x54, 0x45, 0x53, 0x54];
    
    const file = new File([new Uint8Array([...header, ...frameHeader, ...frameBody])], 'test.mp3');
    
    const result = await parseID3(file);
    expect(result.title).toBe('TEST');
  });

  it('parses valid ID3v2.4 tag', async () => {
    // ID3v2.4 frame size is syncsafe
    const header = [0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14];
    const frameHeader = [0x54, 0x49, 0x54, 0x32, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00];
    const frameBody = [0x00, 0x54, 0x45, 0x53, 0x54];
    
    const file = new File([new Uint8Array([...header, ...frameHeader, ...frameBody])], 'test.mp3');
    
    const result = await parseID3(file);
    expect(result.title).toBe('TEST');
  });

  it('falls back to filename if no tags', async () => {
    const file = new File([], 'Pink Floyd - Time.mp3');
    const result = await parseID3(file);
    expect(result.artist).toBe('Pink Floyd');
    expect(result.title).toBe('Time');
  });

  it('extracts APIC (cover JPEG embedded)', async () => {
    const header = [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1B]; // updated total size
    // APIC, size 17
    const frameHeader = [0x41, 0x50, 0x49, 0x43, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00];
    // Encoding 0, mime "image/jpeg", \0, type 3, \0, "img"
    const frameBody = [
       0x00, 
       0x69, 0x6d, 0x61, 0x67, 0x65, 0x2f, 0x6a, 0x70, 0x65, 0x67, 0x00, 
       0x03,
       0x00,
       0x69, 0x6d, 0x67
    ];
    
    const file = new File([new Uint8Array([...header, ...frameHeader, ...frameBody])], 'test.mp3');
    const result = await parseID3(file);
    expect(result.coverDataUrl).toContain('data:image/jpeg;base64,aW1n');
  });

});
