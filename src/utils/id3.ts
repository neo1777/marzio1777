import { ID3Tags } from '../types/audio';

function readString(dataView: DataView, offset: number, length: number, encoding: number): string {
  let result = '';
  // extremely basic encoding support for ID3
  // encoding 0: ISO-8859-1
  // encoding 1: UTF-16 with BOM
  // encoding 2: UTF-16BE
  // encoding 3: UTF-8
  try {
    if (encoding === 0 || encoding === 3) { // Treats ISO-8859-1 as ASCII / UTF-8 compat for now
      const bytes = new Uint8Array(dataView.buffer, offset, length);
      const decoder = new TextDecoder(encoding === 3 ? 'utf-8' : 'iso-8859-1');
      let str = decoder.decode(bytes);
      // remove null characters
      str = str.replace(/\0/g, '');
      return str;
    } else if (encoding === 1 || encoding === 2) {
      // UTF-16
      const utf16Bytes = new Uint8Array(dataView.buffer, offset, length);
      const decoder = new TextDecoder('utf-16');
      let str = decoder.decode(utf16Bytes);
      str = str.replace(/\0/g, '');
      return str;
    }
  } catch (e) {
    console.error("String decoding error", e);
  }
  return result;
}

function parseFilename(filename: string): ID3Tags {
  const cleanName = filename.replace(/\.[^/.]+$/, ""); // remove extension
  const parts = cleanName.split(' - ');
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim()
    };
  }
  return { title: cleanName };
}

export async function parseID3(file: File): Promise<ID3Tags> {
  const tags: ID3Tags = {};
  try {
    const chunk = file.slice(0, 10 * 1024 * 1024); // read up to 10MB
    const buffer = await chunk.arrayBuffer();
    const view = new DataView(buffer);

    // check ID3 magic
    if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
      return parseFilename(file.name);
    }

    const version = view.getUint8(3); // typically 3 or 4
    if (version !== 3 && version !== 4) {
      return parseFilename(file.name);
    }

    const flags = view.getUint8(5);
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);

    let offset = 10;
    
    // Skip extended header if present
    if (flags & 0x40) {
      const extSize = view.getUint32(offset);
      offset += extSize;
    }

    while (offset < size) {
      if (offset + 10 > buffer.byteLength) break;
      
      let frameId = '';
      for (let i = 0; i < 4; i++) {
        const charCode = view.getUint8(offset + i);
        if (charCode === 0) break;
        frameId += String.fromCharCode(charCode);
      }
      
      if (!frameId || frameId.length < 4) break;

      let frameSize = 0;
      if (version === 3) {
        frameSize = view.getUint32(offset + 4);
      } else {
        // v2.4 uses syncsafe integers for frame sizes too
        frameSize = (view.getUint8(offset + 4) << 21) | (view.getUint8(offset + 5) << 14) | (view.getUint8(offset + 6) << 7) | view.getUint8(offset + 7);
      }

      const frameFlags = view.getUint16(offset + 8);
      
      offset += 10;
      
      if (frameSize === 0) continue;
      if (offset + frameSize > buffer.byteLength) break;

      // Ensure frameSize is not corrupted avoiding large allocations
      if(frameSize > 5 * 1024 * 1024) {
         offset += frameSize;
         continue;
      }

      if (frameId.startsWith('T') && frameId !== 'TXXX') {
        const encoding = view.getUint8(offset);
        const text = readString(view, offset + 1, frameSize - 1, encoding);
        
        if (frameId === 'TIT2') tags.title = text;
        else if (frameId === 'TPE1') tags.artist = text;
        else if (frameId === 'TALB') tags.album = text;
        else if (frameId === 'TYER' || frameId === 'TDRC') tags.year = parseInt(text.substring(0, 4), 10) || undefined;
        else if (frameId === 'TCON') tags.genre = text;
      } else if (frameId === 'APIC') {
        const encoding = view.getUint8(offset);
        let mimeType = '';
        let mimeOffset = offset + 1;
        while (view.getUint8(mimeOffset) !== 0) {
          mimeType += String.fromCharCode(view.getUint8(mimeOffset));
          mimeOffset++;
        }
        mimeOffset++; // skip null terminator
        
        const pictureType = view.getUint8(mimeOffset); // eg. 3 is front cover
        mimeOffset++;
        
        // Skip description string
        while (mimeOffset < offset + frameSize) {
           if (view.getUint8(mimeOffset) === 0) {
              if (encoding === 1 || encoding === 2) {
                 if (view.getUint8(mimeOffset + 1) === 0) {
                    mimeOffset += 2;
                    break;
                 }
              } else {
                 mimeOffset++;
                 break;
              }
           }
           mimeOffset++;
        }

        const imageSize = frameSize - (mimeOffset - offset);
        if (imageSize > 0) {
          const imageBytes = new Uint8Array(buffer, mimeOffset, imageSize);
          let binary = '';
          for(let i=0; i<imageBytes.length; i++) {
             binary += String.fromCharCode(imageBytes[i]);
          }
          const b64 = btoa(binary);
          tags.coverDataUrl = `data:${mimeType};base64,${b64}`;
        }
      }

      offset += frameSize;
    }
  } catch (e) {
    console.error("ID3 Parsing Error:", e);
  }

  // Fallback missing title/artist to filename
  const filenameTags = parseFilename(file.name);
  if (!tags.title) tags.title = filenameTags.title;
  if (!tags.artist) tags.artist = filenameTags.artist || 'Unknown Artist';

  return tags;
}

export async function parseAudioFile(file: File): Promise<ID3Tags & { durationMs: number }> {
    const tags = await parseID3(file);
    
    // Calcolo durata via Web Audio API
    // Per file leggeri ok decodificare, per grandi mp3 puo' richiedere 1-2 secondi.
    // L'alternativa per durata veloce degli MP3 sarebbe parsare gli header MPEG, ma decodeAudioData e robusto p.e. per ogg/m4a
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    let durationMs = 0;
    try {
       // Only read first few MB ideally unless needed for m4a/ogg. For now decoding entire buffer to get exact length.
       // It's client-side, runs once on upload.
       const arrayBuffer = await file.arrayBuffer();
       const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
       durationMs = audioBuffer.duration * 1000;
       
    } catch(e) {
       console.error("Duration calc error, fallback to 0", e);
    } finally {
        if(audioCtx.state !== 'closed') audioCtx.close();
    }

    return {
       ...tags,
       durationMs
    };
}
