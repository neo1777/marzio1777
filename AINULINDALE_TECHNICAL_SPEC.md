# 🎵 L'Ainulindalë — La Grande Musica del Bivacco

*Specifica tecnica completa per il modulo audio condiviso di Marzio1777.*
*Maggio 2026 — Production-ready blueprint, zero-dipendenze-nuove, integrato col Campo dei Giochi.*

---

## Sommario

1. [Visione & Filosofia](#1-visione--filosofia)
2. [Architettura ad Alto Livello](#2-architettura-ad-alto-livello)
3. [Schema Dati Firestore](#3-schema-dati-firestore)
4. [Schema IndexedDB Locale](#4-schema-indexeddb-locale)
5. [Modulo: La Biblioteca Personale & Il Walkman](#5-modulo-la-biblioteca-personale--il-walkman)
6. [Modulo: Le Sessioni del Coro (DJ)](#6-modulo-le-sessioni-del-coro-dj)
7. [Modulo: La Coda dei Temi](#7-modulo-la-coda-dei-temi)
8. [Modulo: WebRTC P2P Transfer](#8-modulo-webrtc-p2p-transfer)
9. [Audio Engine (Web Audio API)](#9-audio-engine-web-audio-api)
10. [Sicurezza & Rules Firestore](#10-sicurezza--rules-firestore)
11. [Gamification](#11-gamification)
12. [UI/UX & Branding](#12-uiux--branding)
13. [Performance & Lifecycle](#13-performance--lifecycle)
14. [Limitazioni Note & Roadmap](#14-limitazioni-note--roadmap)

---

## 1. Visione & Filosofia

> *"Allora Ilúvatar disse loro: 'Voglio ora che da questo Tema, datovi insieme, voi facciate, in armonia, una Grande Musica.' E le voci degli Ainur, simili ad arpe e a liuti, e a flauti e a trombe... cominciarono a foggiare il Tema di Ilúvatar in una Grande Musica."*
> — Ainulindalë, Il Silmarillion

L'Ainulindalë è il modulo audio condiviso di Marzio1777. Ogni utente ha la sua **Biblioteca Personale** (libreria locale di tracce caricate sul proprio device, conservate in IndexedDB, mai sul cloud). Un Admin o Root può aprire una **Sessione del Coro**: gli altri utenti vi accedono e propongono *Temi* (tracce dalla loro libreria) alla **Coda Comune**. Il Conduttore (DJ) li suona via P2P direttamente dal device del proponente, senza che il file passi mai dai server di Anthropic, Firebase, o di chiunque altro.

**Tre principi**, religiosamente rispettati:

1. **Locale prima di tutto.** I file MP3/M4A/OGG/FLAC vivono nel device dell'utente, in IndexedDB. Non finiscono mai su Firebase Storage. Niente costi di banda, niente questioni di copyright distribuito, niente trasferimento di dati personali. Solo metadati (titolo, artista, durata) viaggiano.

2. **P2P quando si condivide.** Quando un utente propone una traccia e il DJ la sceglie, il file viene trasferito **direttamente device-to-device via WebRTC DataChannel**. Firestore fa solo da signaling server (passa SDP e ICE candidate), zero infrastruttura aggiuntiva. Il file passa via la connessione P2P, viene suonato, viene scartato.

3. **Auto-pilot di default.** Il DJ apre la sessione e si dimentica di lei. La Coda gira FIFO da sola, il prossimo file viene pre-trasferito quando il corrente è a 30 secondi dalla fine, la transizione è automatica. Il pannello DJ esiste per chi vuole davvero "fare il DJ" (skip, riordina, kick, mode manuale, blacklist), ma è opzionale.

L'estetica è coerente: dark-flame (nero ardesia + ambra + crimson), vinile che gira, copertine in stile cassette/LP, visualizer waveform. Adatta sia al canto degli Ainur sia al metal serio: Marzio1777 ha utenti che ascoltano Vai e Satriani, non Bieber.

---

## 2. Architettura ad Alto Livello

```
┌─────────────────────────────────────────────────────────────────┐
│                      L'AINULINDALË                              │
│                                                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐   │
│  │ LA BIBLIOTECA      │  │  LE SESSIONI DEL CORO            │   │
│  │ (personale)        │  │  (condivise)                     │   │
│  │                    │  │                                  │   │
│  │ • Upload tracce    │  │ ┌─ DJ (Admin/Root) ───────────┐  │   │
│  │ • IndexedDB local  │  │ │ • Apre sessione             │  │   │
│  │ • Walkman player   │  │ │ • Suona dalla sua Biblioteca│  │   │
│  │ • Playlist locali  │  │ │ • Pannello control opz.     │  │   │
│  │ • EQ + visualizer  │  │ │ • Mode: auto / manuale      │  │   │
│  └────────────────────┘  │ └─────────────────────────────┘  │   │
│           │              │                                  │   │
│           │              │ ┌─ Listener (chiunque) ────────┐ │   │
│           ▼              │ │ • Vede coda real-time        │ │   │
│  ┌────────────────────┐  │ │ • Propone Temi dalla         │ │   │
│  │ INDEXEDDB          │  │ │   propria Biblioteca         │ │   │
│  │ tracks{} +         │  │ │ • Streaming P2P del proprio  │ │   │
│  │ playlists{}        │  │ │   file quando il DJ sceglie  │ │   │
│  └────────────────────┘  │ └──────────────────────────────┘ │   │
│                          └──────────────────────────────────┘   │
│                                          │                      │
│           ┌──────────────────────────────┘                      │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ FIRESTORE                                            │        │
│  │ • audio_sessions/{sessionId}            (state)      │        │
│  │ • audio_sessions/.../queue/{itemId}     (FIFO)       │        │
│  │ • audio_sessions/.../signaling/{userId} (WebRTC SDP) │        │
│  │ • users/{userId}.points                 (+gamific.)  │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│           ┌────── WebRTC DataChannel (P2P) ──────┐              │
│           │   File audio binario (chunk 16KB)    │              │
│           │   SOLO mentre serve, mai persistito  │              │
│           └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Tre sotto-moduli, una integrazione

- **La Biblioteca Personale** (§5) — funziona offline, è un walkman completo. Vive da sola.
- **Le Sessioni del Coro** (§6) — vivono solo quando un DJ apre una sessione. Si appoggiano alla Biblioteca per scegliere cosa proporre/suonare.
- **WebRTC P2P** (§8) — è il tessuto invisibile che fa funzionare la sessione. Senza, la sessione cade in fallback "DJ suona dalla SUA biblioteca", funzionalmente ridotto ma non rotto.

### Stack tecnico (zero-dipendenze-nuove)

- **IndexedDB** nativo (no Dexie, no idb)
- **Web Audio API** nativo (no Howler, no Tone.js — già presente come dipendenza ma riusiamo il minimo)
- **WebRTC** nativo (no PeerJS, no simple-peer)
- **Media Session API** nativo (lock screen integration)
- **Wake Lock API** nativo (già in uso per la Caccia)
- **Firestore + Firestore real-time listeners** (già nello stack)
- **React 19 + Tailwind + Framer Motion + Lucide** (già nello stack)

Bundle delta stimato: **~40KB minified+gzipped**.

---

## 3. Schema Dati Firestore

### `audio_sessions` (Collection root)

Una sessione di DJ. Vive solo durante l'evento, viene chiusa al termine.

```typescript
interface AudioSession {
  id: string;                        // doc ID
  type: 'audio_session';             // discriminator (futuro: extensible)
  djId: string;                      // users.uid (Admin/Root)
  djName: string;                    // denormalizzato
  djPhotoURL: string;                // denormalizzato
  title: string;                     // "Serata Metal di Ferragosto"
  description?: string;              // opzionale
  status: 'open' | 'closed';         // immutabile a 'closed'
  mode: 'auto' | 'manual';           // DJ può togglare
  createdAt: Timestamp;
  closedAt: Timestamp | null;
  
  // Stato playback (denormalizzato per i listener)
  currentQueueItemId: string | null; // id item attualmente in play
  currentTrackTitle: string | null;
  currentTrackArtist: string | null;
  currentTrackDurationMs: number | null;
  currentTrackStartedAt: Timestamp | null; // serverTimestamp
  
  // Regole
  rules: {
    maxQueuedPerUser: number;         // default 2
    bonusPerHundredPoints: number;    // default 1 (250pt -> +2 max queued)
    allowDuplicates: boolean;         // default false
    autoSkipOfflineProposers: boolean; // default true (se proposer offline, salta)
  };
  
  // Counters denormalizzati (per UI fast)
  participantCount: number;
  queuedCount: number;
  playedCount: number;
  
  // Integrazione opzionale con un game_event
  linkedGameEventId?: string | null;  // se la sessione è "musica di Ferragosto"

  // Flag one-way (false → true via rule, mai revertibile). Settato nel batch
  // di chiusura quando totalDurationMs > 30 min, per accreditare il +10
  // long-session bonus al DJ una sola volta. Vedi §11 (Gamification).
  djBonusAwarded?: boolean;
}
```

### `audio_sessions/{sessionId}/queue/{itemId}` (Subcollection)

Ogni elemento della coda è un Tema proposto da un utente.

```typescript
interface QueueItem {
  id: string;                        // doc ID
  proposedBy: string;                // users.uid del proponente
  proposedByName: string;            // denormalizzato
  proposedByPhotoURL: string;        // denormalizzato
  proposedAt: Timestamp;
  
  // Metadata della traccia (solo metadati, NON il file)
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string;
  trackYear?: number;
  trackDurationMs: number;
  trackCoverDataUrl?: string;        // base64 dell'art embedded (max 50KB)
  
  // Riferimento alla traccia nella Biblioteca del proponente
  // (è un id IndexedDB lato proponente, NON un URL — serve solo per il P2P)
  localTrackId: string;
  
  // Stato
  status:
    | 'queued'        // in coda, attesa
    | 'transferring'  // P2P in corso, file in arrivo al DJ
    | 'ready'         // file ricevuto dal DJ, pronto a suonare
    | 'playing'       // in esecuzione
    | 'played'        // suonato, archiviato
    | 'skipped'       // skippato dal DJ
    | 'failed';       // P2P fallito o proposer offline
  
  position: number;                  // FIFO order, può essere riordinato dal DJ
  
  // Audit P2P (server-stamped via serverTimestamp)
  transferStartedAt?: Timestamp;
  transferCompletedAt?: Timestamp;
  transferFailureReason?: string;    // 'timeout' | 'proposer_offline' | 'rejected' | ecc.

  // Gamification
  pointsAwarded?: number;            // assegnati al played: round(2 × eventMultiplier)

  // Snapshot della formula bonus al create-time. La rule queue.create lo
  // valida contro `effectiveMaxQueued(sessionId)` ricostruita in DSL: chiude
  // il forge della "Sporca #24 Queue Stuffer" (90% del vettore). Il count
  // effettivo dei doc attivi del proposer resta CF Fase 2: il DSL Firestore
  // non può contare documenti.
  effectiveMaxAtCreate?: number;
}
```

### `audio_sessions/{sessionId}/signaling/{userId}` (Subcollection)

Canale di signaling WebRTC. Vita brevissima (cancellato a connessione stabilita o dopo 60s di idle). Vedi §8.

```typescript
interface SignalingDoc {
  userId: string;                    // doc ID = utente che ha l'altro lato
  sessionId: string;
  
  // Quando il DJ inizia un transfer, scrive un offer per il proposer
  djOffer?: {
    sdp: string;
    type: 'offer';
    queueItemId: string;
    createdAt: Timestamp;
  };
  
  // Il proposer risponde con answer
  proposerAnswer?: {
    sdp: string;
    type: 'answer';
    createdAt: Timestamp;
  };
  
  // ICE candidates, da entrambe le parti
  djCandidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number; addedAt: Timestamp }>;
  proposerCandidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number; addedAt: Timestamp }>;
  
  // Timestamp di pulizia
  expireAt: Timestamp;                // ~60s da creazione
}
```

### Indexes consigliati

```
audio_sessions:                      (status ASC, createdAt DESC)
audio_sessions:                      (djId ASC, status ASC)
audio_sessions/.../queue:            (status ASC, position ASC)
audio_sessions/.../queue:            (proposedBy ASC, status ASC)
```

---

## 4. Schema IndexedDB Locale

Il file `/src/utils/indexedDB.ts` gestisce due object store. Database name: `marzio1777_audio`.

### Object store `tracks`

```typescript
interface LocalTrack {
  id: string;                        // UUID v4 generato client-side
  
  // Metadati estratti da ID3 o inseriti a mano
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;                    // se presente in ID3
  durationMs: number;                // calcolato da Web Audio API
  
  // Cover art (estratta da APIC frame se presente)
  coverDataUrl?: string;             // base64
  
  // File binario
  blob: Blob;                        // il file audio originale (mp3/m4a/ogg/flac)
  mimeType: string;
  sizeBytes: number;
  
  // Metadati gestionali
  uploadedAt: number;                // Date.now()
  lastPlayedAt?: number;
  playCount: number;
  isFavorite: boolean;
  
  // Tag custom dell'utente
  customTags: string[];              // ['Metal', 'Anni 90', 'Da serata']
}

// Indici
const trackIndices = ['artist', 'album', 'year', 'lastPlayedAt', 'isFavorite'];
```

### Object store `playlists`

```typescript
interface LocalPlaylist {
  id: string;                        // UUID
  name: string;
  description?: string;
  trackIds: string[];                // ordered list of LocalTrack.id
  createdAt: number;
  updatedAt: number;
  coverTrackId?: string;             // usa la cover di questa traccia come icona
}
```

### Patterns di accesso

- `addTrack(file: File): Promise<LocalTrack>` — parse ID3, estrae cover, calcola durata, salva
- `getAllTracks(): Promise<LocalTrack[]>` — per la libreria
- `getTrackById(id): Promise<LocalTrack | null>` — per il P2P transfer
- `searchTracks(query: string): Promise<LocalTrack[]>` — fulltext su titolo/artista/album
- `deleteTrack(id): Promise<void>`
- `getStorageQuota(): Promise<{used: number, total: number}>` — via `navigator.storage.estimate()`

### Quota e limiti

- Browser tipico: ~50% dello spazio device disponibile
- Limite per traccia: **50MB** (un MP3 normale ~5-10MB, FLAC ~30MB)
- Avviso quando quota >80%
- Cleanup manuale (l'utente cancella tracce dalla UI)

---

## 5. Modulo: La Biblioteca Personale & Il Walkman

### Pagina `/ainulindale/biblioteca`

Lista delle tracce caricate, con:
- **Upload zone** in alto: drag&drop o tap per selezione multipla
- **Progress bar** durante upload (parsing ID3 + estrazione cover + write IndexedDB)
- **Search bar** + filtri rapidi (artista, album, anno, tag custom, preferiti)
- **Lista virtuale** (per gestire 1000+ tracce senza lag — tecnica `react-window`-like manuale, no nuova dep)
- **Card traccia**: cover (96x96 default), titolo, artista, durata, play button, menu (preferiti, tag, elimina)
- **Storage indicator** in basso: "Usato 1.2GB / 8GB disponibili"

### Player (Il Walkman)

Mini-player persistente in basso quando una traccia è in riproduzione:
- Cover thumbnail
- Titolo + artista (scrolling se troppo lungo)
- Progress bar tappabile (seek)
- Play/Pause + Prev/Next
- Tap per espandere a full-screen player

Full-screen player:
- Cover grande con effetto vinyl-spinning (rotazione lenta, con `prefersReducedMotion` rispettato)
- Visualizer waveform sotto (opzionale, tap per togglare)
- Controlli completi: play/pause, prev/next, shuffle, repeat (off/all/one)
- Slider volume
- Slider posizione
- Lyrics (se presenti in ID3 USLT frame — opzionale)
- EQ a 3 bande (low/mid/high, ±12dB)
- "Aggiungi a playlist" / "Aggiungi a coda Sessione attiva"

### Media Session API (lock screen)

Quando una traccia parte:

```typescript
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.coverDataUrl ? [{ src: track.coverDataUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.setActionHandler('play', () => audioEngine.play());
  navigator.mediaSession.setActionHandler('pause', () => audioEngine.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => playerStore.prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => playerStore.next());
  navigator.mediaSession.setActionHandler('seekbackward', (d) => audioEngine.seek(audioEngine.currentTime - (d.seekOffset ?? 10)));
  navigator.mediaSession.setActionHandler('seekforward', (d) => audioEngine.seek(audioEngine.currentTime + (d.seekOffset ?? 10)));
  navigator.mediaSession.setActionHandler('seekto', (d) => audioEngine.seek(d.seekTime ?? 0));
}
```

Risultato: lock screen iOS/Android mostra cover + titolo + controlli nativi. Funziona anche in PWA installata in background.

### Background playback

PWA installata + Wake Lock + Audio element correttamente configurato = playback continua anche con schermo spento. Uso `navigator.wakeLock.request('screen')` come già pattern esistente per la Caccia, ma su `audio` quando l'utente esplicitamente attiva "Continua in background" nelle impostazioni del Walkman.

### ID3 Parsing — Implementazione

File `/src/utils/id3.ts`. Parser minimale, ~150 righe, niente dipendenze.

Struttura ID3v2.3/v2.4:
- Header 10 byte (signature 'ID3', version, flags, size)
- Sequenza di frame (4 byte ID + 4 byte size + 2 byte flags + payload)

Frame da estrarre:
- `TIT2` → title
- `TPE1` → artist
- `TALB` → album
- `TYER` o `TDRC` → year
- `TCON` → genre
- `APIC` → cover (con sub-parsing del MIME type e picture type)

```typescript
export async function parseID3(blob: Blob): Promise<ID3Tags> {
  const buffer = await blob.slice(0, 10 * 1024 * 1024).arrayBuffer(); // primi 10MB max
  const view = new DataView(buffer);
  
  // Verifica signature 'ID3'
  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return {}; // no ID3, fallback al filename
  }
  
  // ... parser completo dei frame, gestione encoding (ISO-8859-1, UTF-16, UTF-8)
  // Estrazione APIC con MIME type detection
}
```

Fallback se ID3 assente: il filename viene parsato per `Artist - Title.mp3` pattern.

### Componenti React

```
/src/pages/PersonalLibrary.tsx       — lista tracce + upload + ricerca
/src/components/audio/TrackCard.tsx
/src/components/audio/UploadZone.tsx
/src/components/audio/MiniPlayer.tsx — fixed bottom
/src/components/audio/FullScreenPlayer.tsx — modal
/src/components/audio/Visualizer.tsx — canvas waveform
/src/components/audio/Equalizer.tsx
/src/hooks/useLocalLibrary.ts        — IndexedDB wrapper
/src/hooks/useAudioPlayer.ts         — Web Audio API wrapper
/src/utils/indexedDB.ts
/src/utils/id3.ts
/src/utils/audioEngine.ts            — class wrapper su Web Audio API
```

---

## 6. Modulo: Le Sessioni del Coro (DJ)

### Pagina `/ainulindale` (hub)

Tre tab:
- **🎵 La Biblioteca** — la mia libreria personale (§5)
- **🔥 Sessioni Attive** — lista delle sessioni `status: 'open'` in real-time
- **⚙️ Apri una Sessione** — visibile solo a Admin/Root, crea una nuova sessione

Card di sessione attiva:
- Nome + descrizione
- Avatar del DJ
- Numero partecipanti (count denormalizzato)
- Track attualmente in riproduzione (cover mini + titolo)
- Numero in coda
- Tap → entra come listener

### Creazione di una sessione (DJ)

Wizard semplice, 3 step:

**Step 1 — Identità.**
- Nome sessione (default: "Sessione di {DjName}")
- Descrizione opzionale
- Linked event opzionale (dropdown dei `game_events.status == 'active'` se ce n'è uno)

**Step 2 — Regole.**
- Slider: max canzoni in coda per utente (1-5, default 2)
- Slider: bonus per 100pt Altitudine (0-3, default 1)
- Toggle: permetti duplicati (default off)
- Toggle: auto-skip se proponente offline (default on)

**Step 3 — Conferma & Apri.**
- Recap
- Pulsante grande "🎼 Apri il Coro"

Crea il documento `audio_sessions/{sessionId}` con `status: 'open'`. Il DJ è automaticamente partecipante.

### Pannello DJ (durante sessione)

Visibile solo al DJ. Layout:

**In alto: Now Playing.**
- Cover + titolo + artista + posizione
- Tempo trascorso / totale
- Controlli: pausa/riprendi, skip, volume

**Centro: La Coda.**
- Lista degli `queue/*` ordinati per `position` ASC
- Per ogni item: avatar proponente, cover, titolo, artista, durata, status badge
- Drag handle per riordinare (drag&drop)
- Tap su item → menu: "Suona ora", "Skip", "Kick", "Anteprima 5s"

**In basso: Mode toggle + impostazioni.**
- Switch **Auto / Manuale** prominente
- In Auto: il sistema avanza da solo, il DJ vede solo il flusso
- In Manuale: dopo ogni traccia, il DJ deve premere "Prossimo Tema"
- Pulsante "🔥 Chiudi il Coro" (passa `status: 'closed'`)

### Vista Listener (durante sessione)

Layout simile ma senza controlli DJ:

- **Now Playing** in alto (sincronizzato con `currentTrackStartedAt`, calcolo `progressMs = now - startedAt`)
- **La Coda** scrollable, con la propria posizione evidenziata
- Per ogni mio item posso fare "Ritira" (rimuovere da coda)
- In basso: pulsante prominente "🎵 Proponi un Tema" → apre modal con la mia Biblioteca filtrata

### Flow di proposta (proposer)

1. Listener apre la sessione, vede coda + ora in riproduzione
2. Tap "Proponi un Tema"
3. Modal mostra la sua Biblioteca con search + filtri
4. Tap su una traccia → conferma "Proponi *titolo* di *artista*?"
5. Conferma → crea documento `queue/{itemId}` con `status: 'queued'`, `localTrackId` = id IndexedDB locale, metadati copiati
6. UI feedback: "Tema in coda alla posizione N"
7. Vincoli applicati lato rule (vedi §10): max queued, no duplicates se policy attiva, etc.

### Sincronizzazione playback per listener

I listener NON ricevono il file audio. Vedono solo i metadati e un timer sincronizzato col DJ.

```typescript
// Sync del progress
const elapsedMs = Date.now() - session.currentTrackStartedAt.toMillis();
const progressMs = Math.min(elapsedMs, session.currentTrackDurationMs);
const progressPercent = (progressMs / session.currentTrackDurationMs) * 100;
```

Aggiornato a 1Hz tramite `setInterval` locale, niente Firestore polling.

Se il proposer è anche listener della propria sessione, può "ascoltare in cuffia" la sua libreria locale in sync col DJ — opt-in toggle. Questo è UX sofisticato che si può rimandare a Fase 2.

---

## 7. Modulo: La Coda dei Temi

### Stato e ciclo di vita di un QueueItem

```
[queued] ──(DJ sta per suonarlo, ~30s prima)──> [transferring]
                                                        │
                                                        ▼
                                                 ┌──[ready]──> [playing] ─> [played]
                                                 │
                                                 └──(timeout / fail)──> [failed]
                                                                          │
                                                                          ▼
                                                                       [skipped]
DJ skip manuale: [queued|ready] ──────────────────────────────────────> [skipped]
DJ kick: rimosso del tutto dalla coda (delete del doc)
```

### Engine FIFO automatico (mode = 'auto')

Il pannello DJ esegue un loop in background:

```typescript
// Pseudocodice del DJ engine
async function djAutoEngine() {
  while (session.status === 'open' && session.mode === 'auto') {
    const current = await getCurrentItem();  // status: 'playing'
    
    if (!current) {
      // Nessuna traccia in riproduzione, cerca prossima 'ready' o avvia trasferimento per la prossima 'queued'
      const next = await getFirstQueued();
      if (next) {
        await initiateTransfer(next);  // → status: 'transferring'
        await waitForReadyOrFail(next);
        if (next.status === 'ready') await playItem(next);
        else await markSkipped(next, 'transfer_failed');
      } else {
        await sleep(2000);  // coda vuota, attendi
      }
      continue;
    }
    
    // Traccia in riproduzione, controlla se siamo a < 30s dalla fine
    const remainingMs = current.durationMs - audioEngine.currentTimeMs;
    if (remainingMs < 30_000) {
      const next = await getFirstQueued();
      if (next && next.status === 'queued') {
        initiateTransfer(next);  // pre-fetch, non bloccante
      }
    }
    
    // Quando current finisce
    if (audioEngine.ended || remainingMs < 100) {
      await markPlayed(current);
      await awardPoints(current);  // +2 al proposer, vedi §11
    }
    
    await sleep(1000);
  }
}
```

### Mode Manuale

Stesso engine ma:
- Non parte automaticamente la traccia successiva al fine corrente
- Invece, mostra al DJ "Prossimo: X di Y. Pronto?" + pulsante "▶ Suona"
- Il pre-transfer parte comunque (stesso timing), così quando il DJ preme play il file è già pronto

### Regole della coda (lato client + rule Firestore)

**Vincoli su `queue.create`:**

- L'utente è approvato (Guest+)
- L'utente è partecipante della sessione (creato un doc di partecipazione, simile al sistema Bivacco — dettaglio sotto)
- `proposedBy == request.auth.uid`
- Il numero di item con `proposedBy == request.auth.uid` AND `status in ['queued', 'transferring', 'ready']` non supera `session.rules.maxQueuedPerUser + bonus(altitudePoints)`
- Se `session.rules.allowDuplicates == false`, non esiste già un altro item con stesso `trackTitle + trackArtist` in stato non-`played`/non-`skipped`
- `position` viene assegnato dal client come `max(positions) + 1` ma **validato** dalla rule che sia >= 0

**Vincoli su `queue.update`** (post-B7, Maggio 2026):

- Solo il DJ può chiamare `update` (`isSessionDJ(sessionId)`)
- `affectedKeys().hasOnly(['status', 'position', 'transferStartedAt', 'transferCompletedAt', 'transferFailureReason', 'pointsAwarded'])` — qualsiasi altro campo viene respinto
- Defense-in-depth ridondante: `proposedBy`, `localTrackId`, `trackTitle`, `trackArtist`, `trackDurationMs` confrontati esplicitamente con `existing()` (in caso di future-relaxation di `affectedKeys`)
- `validQueueStatusTransition`: `queued → transferring | skipped`, `transferring → ready | failed`, `ready → playing | skipped`, `playing → played | skipped`, `failed → skipped`. **Non più ammesso lo shortcut `queued → ready/failed`** (era una rilassatezza pre-B7 non prevista dalla spec).
- `pointsAwarded ∈ [0, 50]` quando modificato
- Solo il proposer può fare `delete` del proprio item se `status == 'queued'` (ritirare la propria proposta)
- Risultato: chiusura al 100% di Sporca #25 e #26 "Theme Hijacker"

### Partecipazione alla sessione

Sub-collection (riusiamo il pattern del Campo dei Giochi):
```
audio_sessions/{sessionId}/participants/{userId}
  - userId, displayName, photoURL
  - joinedAt, leftAt
  - tracksProposed (counter)
  - tracksPlayed (counter)
  - status: 'joined' | 'left'
```

Il listener crea il proprio doc `participants/{userId}` quando entra. Permette al DJ di vedere "Chi c'è" e applicare le regole gamification per-utente.

---

## 8. Modulo: WebRTC P2P Transfer

Il cuore tecnico più delicato. Disegno conservativo, con fallback graceful.

### Pattern: Firestore-as-signaling

Niente WebSocket, niente backend. Firestore stesso fa da signaling server: SDP offer/answer e ICE candidate vengono scritti come documenti, ascoltati con `onSnapshot`.

### Flow completo (DJ inizia transfer)

```
DJ sta per suonare la traccia X (status: 'queued')
                │
                ▼
1. DJ crea RTCPeerConnection con STUN gratuito (Google: stun:stun.l.google.com:19302)
2. DJ crea RTCDataChannel('audio', {ordered: true})
3. DJ chiama pc.createOffer() → SDP offer
4. DJ scrive in Firestore: signaling/{proposerId}.djOffer = {sdp, type: 'offer', queueItemId: X}
5. DJ ascolta signaling/{proposerId}.proposerAnswer + .proposerCandidates
                │
                ▼
6. Proposer (con onSnapshot attivo su signaling/{proposerId}) riceve l'offer
7. Proposer crea RTCPeerConnection con stesso STUN
8. Proposer setRemoteDescription(djOffer)
9. Proposer createAnswer() → SDP answer
10. Proposer scrive: signaling/{proposerId}.proposerAnswer = {sdp, type: 'answer'}
11. Proposer ascolta .djCandidates
                │
                ▼
12. Entrambe le parti scoprono ICE candidates (onicecandidate event):
    - DJ scrive in .djCandidates[]  (arrayUnion)
    - Proposer scrive in .proposerCandidates[]  (arrayUnion)
    - Entrambi ascoltano e fanno pc.addIceCandidate() su quelli ricevuti
                │
                ▼
13. RTCDataChannel apre (onopen su entrambi i lati)
14. DJ marca queue/{X}.status = 'transferring' + transferStartedAt
15. Proposer legge file da IndexedDB (LocalTrack.blob)
16. Proposer chunka in pezzi da 16KB
17. Proposer invia: chunk header (size + index + total), poi binary data
18. DJ riassembla in Blob, valida total chunks ricevuti
19. DJ marca queue/{X}.status = 'ready' + transferCompletedAt
20. RTCPeerConnection.close() — cleanup
21. Firestore signaling/{proposerId} cancellato
                │
                ▼
22. DJ play(blob) tramite Audio element + Web Audio API
```

### Timeout e fallback

```typescript
const TRANSFER_TIMEOUT_MS = 15_000;

async function initiateTransfer(item: QueueItem) {
  await updateDoc(itemRef, { status: 'transferring', transferStartedAt: serverTimestamp() });
  
  try {
    const blob = await Promise.race([
      doWebRTCTransfer(item),
      sleep(TRANSFER_TIMEOUT_MS).then(() => { throw new Error('timeout'); }),
    ]);
    
    pendingBlobs.set(item.id, blob);
    await updateDoc(itemRef, { status: 'ready', transferCompletedAt: serverTimestamp() });
  } catch (err) {
    await updateDoc(itemRef, { 
      status: 'failed', 
      transferFailureReason: err.message,
    });
    // L'engine principale skip-perà automaticamente al prossimo
  }
}
```

### Sicurezza & vincoli

- **Max file size: 50MB.** Chunking di 16KB → max 3200 chunk. Quando il DJ riceve il primo chunk con `total > 3200`, rifiuta.
- **MIME validation.** Il primo chunk include `mimeType` dichiarato dal proposer; il DJ verifica che sia in whitelist `audio/*`. Se no, rifiuta.
- **Hash check (opzionale, Fase 2).** Il proposer dichiara un hash SHA-256 del file all'inizio; il DJ ricalcola alla fine e confronta. Anti-corruption durante transfer.
- **Sessione closed.** Se la sessione passa a `closed` durante un transfer, il DJ chiude tutte le RTCPeerConnection in unmount.

### Pulizia signaling docs

I documenti `signaling/{userId}` hanno `expireAt` settato a +60s. Una Cloud Function in Fase 2 farà cleanup periodico. In MVP, il client del DJ cancella esplicitamente `signaling/{userId}` quando la connessione è stabilita (o fallita).

### Componente helper

```typescript
// /src/utils/webrtc.ts
export class WebRTCTransfer {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private receivedChunks: Map<number, ArrayBuffer> = new Map();
  
  constructor(private role: 'dj' | 'proposer', private sessionId: string, private otherUserId: string) {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
  }
  
  async asDJStartTransfer(queueItemId: string): Promise<Blob> { /* ... */ }
  async asProposerSendBlob(blob: Blob, queueItemId: string): Promise<void> { /* ... */ }
  
  cleanup() {
    this.dc?.close();
    this.pc.close();
  }
}
```

### Edge case: proposer offline

Il DJ scrive `djOffer`, ma il proposer non è connesso a Firestore. Dopo 15s di timeout, transfer fallisce, item marcato `failed`, engine skippa al successivo. Lo status del proposer in `participants/{userId}` viene aggiornato a `left` se non è online da > 60s (heartbeat tramite `lastSeenAt` periodico).

### Fallback senza WebRTC (graceful degradation)

Se il browser non supporta WebRTC (rarissimo nel 2026), oppure se 3 transfer consecutivi falliscono, la sessione passa automaticamente in **modalità Curation Pura**: il DJ può solo suonare tracce dalla SUA libreria. La coda diventa un "wishlist" che il DJ vede come suggestion, ma deve avere lui il file. Un banner UI lo notifica.

---

## 9. Audio Engine (Web Audio API)

File `/src/utils/audioEngine.ts`. Una classe wrapper che astrae Web Audio API.

### Architettura nodi

```
[Source: Audio element + MediaElementSource]
         │
         ▼
[GainNode: volume globale]
         │
         ▼
[BiquadFilter low (lowshelf)]
         │
         ▼
[BiquadFilter mid (peaking)]
         │
         ▼
[BiquadFilter high (highshelf)]
         │
         ▼
[AnalyserNode: per visualizer]
         │
         ▼
[Destination: speakers]
```

### API esposta

```typescript
class AudioEngine {
  load(blob: Blob | string /* URL */): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(v: number /* 0-1 */): void;
  
  setEQ(low: number, mid: number, high: number): void;  // dB ±12
  
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  
  getAnalyser(): AnalyserNode;  // per il visualizer
  
  on(event: 'ended' | 'play' | 'pause' | 'timeupdate' | 'error', cb: () => void): void;
  
  destroy(): void;
}
```

### Crossfade (opzionale, Fase 2)

Per supportare il crossfade tra traccia corrente e successiva, servirebbero **due AudioEngine in parallelo** con due GainNode che si invertono. Implementazione semplice:

```typescript
// Quando current finisce a 3 secondi dalla fine, parte fade-out su current e fade-in su next
const FADE_MS = 3000;
currentEngine.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS / 1000);
nextEngine.gainNode.gain.value = 0;
nextEngine.play();
nextEngine.gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_MS / 1000);
```

In MVP **gapless** (zero pausa tra tracce) è sufficiente, crossfade è enhancement.

### Visualizer

Component `/src/components/audio/Visualizer.tsx`:

```typescript
const analyser = audioEngine.getAnalyser();
analyser.fftSize = 128;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

function draw() {
  if (!isPlaying) return;
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(dataArray);
  // disegna barre o waveform su canvas
  // colore: amber/crimson gradient su sfondo nero
}
```

Aspetto: barre verticali, gradient ambra→crimson, glow effetto, BPM-reactive (intensità correlata al volume medio).

---

## 10. Sicurezza & Rules Firestore

### Invarianti chiave

- **Solo Admin/Root crea audio_sessions.** Rule esplicita.
- **Solo il DJ creator può modificare il proprio audio_session.** Eccezione: `participants` lo aggiunge il singolo utente per se stesso.
- **`status: 'closed'` è terminale.** Una volta chiusa, niente è modificabile (lettura archivio sempre permessa).
- **`djId`, `type`, `createdAt` immutabili.**
- **Queue items immutabili nei metadati (titolo, artista, durata, proposedBy, localTrackId) dopo create.**
- **`status` di queue item segue una macchina a stati; la rule valida le transizioni.**
- **Solo il DJ può modificare `currentQueueItemId` e `currentTrackStartedAt`** (è il "now playing").
- **Solo il proposer può fare `delete` del proprio item, e solo se `status == 'queued'`.**
- **Validazione di `pointsAwarded`** simile al Quiz: range valido, e solo dopo `status == 'played'`.

### Rule helper essenziali

```javascript
function isSessionDJ(sessionId) {
  return get(/databases/$(database)/documents/audio_sessions/$(sessionId)).data.djId == request.auth.uid;
}

function isSessionParticipant(sessionId) {
  return exists(/databases/$(database)/documents/audio_sessions/$(sessionId)/participants/$(request.auth.uid))
    && get(/databases/$(database)/documents/audio_sessions/$(sessionId)/participants/$(request.auth.uid)).data.status == 'joined';
}

function validQueueStatusTransition(oldStatus, newStatus, isDJ) {
  return (
    (oldStatus == 'queued' && newStatus in ['transferring', 'skipped'] && isDJ)
    || (oldStatus == 'transferring' && newStatus in ['ready', 'failed'] && isDJ)
    || (oldStatus == 'ready' && newStatus in ['playing', 'skipped'] && isDJ)
    || (oldStatus == 'playing' && newStatus in ['played', 'skipped'] && isDJ)
    || (oldStatus == 'failed' && newStatus == 'skipped' && isDJ)
    || oldStatus == newStatus
  );
}
```

### Le Sporche di L'Ainulindalë (Le 7 di Sauron)

23. **The Phantom DJ** — partecipante che cerca di scrivere su `audio_sessions` con `djId == self.uid` ma non è Admin/Root. Bloccato.
24. **The Queue Stuffer** — utente che cerca di mettere 100 tracce in coda bypassando il limite. **Bloccato a livello formula**: la rule `queue.create` valida che `incoming().effectiveMaxAtCreate == effectiveMaxQueued(sessionId)`, dove l'helper rule riproduce in DSL `rules.maxQueuedPerUser + int(getUserDoc().points / 100) * rules.bonusPerHundredPoints`. Chiude il forge del valore. **Il count effettivo dei doc attivi resta CF Fase 2** (il DSL Firestore non può contare documenti — vedi `MIGRATION.md`, callable `enforceQueuePerUserLimit`).
25. **The Theme Hijacker** — utente che cerca di modificare `proposedBy`, `localTrackId` o i metadati traccia di un item creato da altri. **Bloccato al 100% (B7, Maggio 2026)** via `affectedKeys.hasOnly([status, position, transferStartedAt, transferCompletedAt, transferFailureReason, pointsAwarded])` + check espliciti `incoming().proposedBy == existing().proposedBy` (e analoghi) come defense-in-depth. Pre-B7 la rule controllava solo lo status; il DJ poteva tecnicamente riscrivere i metadati. Test: `firestore.rules.audio.test.ts` casi "DJ cannot rewrite proposedBy/trackTitle/localTrackId".
26. **The Player Ghost** — partecipante che modifica `currentQueueItemId` o `currentTrackStartedAt` su `audio_sessions`. Bloccato (solo DJ).
27. **The Resurrectionist (audio variant)** — write su `audio_sessions/{closed}` o sui suoi `queue/*` post-close. Bloccato.
28. **The Mass Skipper** — DJ malizioso che skippa tutte le tracce di un partecipante per dispetto. *Tollerato per design* (community-level trust); il proposer vede `skipped` con timestamp e può segnalare al Root.
29. **The Signaling Spammer** — utente che scrive falsi offer/answer in `signaling/*` di altri per disturbare. **Bloccato dalla rule sub-collection** `match /audio_sessions/{sessionId}/signaling/{userId}`: solo il proposer (`userId == request.auth.uid`) o il DJ della sessione (`isSessionDJ(sessionId)`) possono fare read/create/update/delete. `sessionId` è ora implicito nel path (era top-level prima del Maggio 2026). Test rule in `firestore.rules.audio.test.ts`.

### Test runner (estensione delle rule tests)

Suite `firestore.rules.audio.test.ts`:

- Guest pending non vede `audio_sessions/*`
- Guest approvato vede solo le sessioni `status: 'open'`
- Solo Admin/Root crea audio_sessions
- DJ != organizzatore non può modificare la sessione di un altro
- Partecipante può creare il proprio `participants/{userId}`
- Partecipante NON può creare `participants/{altroUserId}`
- Queue.create rispetta `maxQueuedPerUser` + bonus formula
- Queue.update da non-DJ → respinta
- Queue.delete da proposer-stesso con `status: 'queued'` → permessa
- Queue.delete da proposer con `status: 'playing'` → respinta
- Queue.update con transizione di stato non valida → respinta
- Signaling write da terza parte → respinta

---

## 11. Gamification

### Punti Altitudine — nuove sorgenti

| Azione | Punti | Note |
|---|---|---|
| Caricare una traccia in Biblioteca | +1 | Una tantum per traccia (non per ri-upload) |
| Proporre una traccia in sessione | +1 | Indipendente dal play |
| Una propria traccia viene **suonata** | +2 | × `eventMultiplier` (se sessione linked a game_event); calcolato `Math.round(2 × eventMultiplier)` in `DJEngine.markCurrentPlayed` |
| Fare il DJ in una sessione (almeno 1 traccia suonata) | +5 | Una tantum a fine sessione, accreditato in batch atomico da `closeSession` × `eventMultiplier` |
| Sessione DJ con > 30 min di musica | +10 | Long-session bonus protetto dal flag `audio_sessions.djBonusAwarded` (one-way, immutabile a `true` via rule). Anti double-spend: la rule respinge ogni tentativo di rimettere `false` o di ri-incrementare. × `eventMultiplier` |

### Bonus alla coda (regola dinamica)

```
maxQueuedPerUser_effettivo = session.rules.maxQueuedPerUser 
                           + floor(user.points / 100) * session.rules.bonusPerHundredPoints
```

Esempio: `maxQueuedPerUser: 2`, `bonusPerHundredPoints: 1`, utente con 350pt:
- max effettivo = 2 + floor(350/100) * 1 = 2 + 3 = 5

Significa che chi ha contribuito di più alla comunità può proporre più tracce. Coerente con la filosofia "i veterani hanno più voce".

### Gagliardetti (futuri, derivati da snapshot)

- **Il Cantore** — proposto 50 tracce totali (cumulativo)
- **Il Sub-Creatore** — 25 tracce proposte sono state effettivamente suonate
- **Il Conduttore** — DJ in 5 sessioni
- **Il Maestro del Coro** — DJ in 20 sessioni con > 30min ciascuna
- **Le Voci di Ilúvatar** — partecipato a 10 sessioni come listener
- **Il Discordante (humour)** — proposto 5 tracce skippate consecutivamente dallo stesso DJ

I gagliardetti vengono calcolati a partire dagli snapshot delle sessioni chiuse (analoghi a `leaderboard/final` del Campo dei Giochi). Implementazione in Fase 2.

### Snapshot di sessione

Quando `status: 'open' → 'closed'`, viene scritto nel doc `audio_sessions/{sessionId}` un campo `finalStats`:

```typescript
finalStats: {
  totalDurationMs: number;
  totalTracksPlayed: number;
  participantsCount: number;
  topProposers: Array<{ userId, displayName, tracksPlayed }>;  // top 5
  closedAt: Timestamp;
}
```

Read-only post-close.

---

## 12. UI/UX & Branding

### Naming & glossario interno

- **L'Ainulindalë** — il modulo nel suo insieme
- **La Biblioteca** — libreria personale (tab 1)
- **Sessioni Attive** — lista sessioni DJ aperte (tab 2)
- **Apri il Coro** — wizard di creazione (tab 3, Admin/Root only)
- **Tema** — singola traccia
- **Conduttore** — il DJ (un Admin/Root attivo)
- **Cantore** — utente che propone Temi
- **La Coda** — la queue
- **La Forgia** — pannello DJ (sezione "control room")
- **La Sala** — vista listener

### Palette colori

```
sfondo principale:  #0A0A0F (nero ardesia)
sfondo secondario:  #16161D (nero più chiaro)
testo primario:     #F5F0E1 (avorio caldo, color pergamena)
accento ambra:      #FFA000
accento crimson:    #C2410C
accento oro:        #D4A856 (per i Gagliardetti)
warning:            #F59E0B
error:              #DC2626
glow effects:       rgba(255, 160, 0, 0.4)
```

Effetti speciali:
- **Vinyl spinning** — cover fullscreen ha rotazione 0→360 in 6s loop, paused se `prefersReducedMotion`
- **Ember particles** — particelle ambra che fluttuano dal cover quando una traccia è in riproduzione (riusa `canvas-confetti` esistente con config personalizzata)
- **Waveform glow** — il visualizer ha box-shadow ambra pulsante
- **Sigil di Ilúvatar** — un piccolo sigillo decorativo (SVG) appare nel logo del modulo, simbolo di "armonia"

### Dark mode è il default

L'Ainulindalë è dark-first. La modalità chiara dell'app esiste ancora per Piazza/Bivacco/etc, ma in L'Ainulindalë anche con tema light app, il modulo forza il dark per via dell'estetica musicale immersiva.

### Accessibilità

- `prefersReducedMotion` rispettato: vinyl no spin, niente particelle, transizioni statiche
- `aria-live="polite"` su Now Playing changes
- `aria-label` su tutti i pulsanti player (play/pause/next/prev/seek)
- Tap target ≥ 56px su mobile
- Contrasto AAA su testo bianco/avorio su nero
- Screen reader: il timer del player announce ogni 30s

### Flusso visuale di un session entry

```
Tap su sessione attiva
  → animazione: la card "esplode" in fullscreen
  → fade-in sequenziale: cover, titolo, artista, coda
  → timer di sync parte
  → pulsante "Proponi un Tema" pulsa una volta per attirare l'attenzione
```

---

## 13. Performance & Lifecycle

### Bundle delta stimato

| Modulo | Delta |
|---|---|
| IndexedDB wrapper + ID3 parser | ~5KB |
| Audio Engine (Web Audio API wrapper) | ~3KB |
| WebRTC helper | ~4KB |
| Components React (player, library, sessione) | ~20KB |
| Hooks + utils | ~5KB |
| Branding/styles aggiuntivi | ~3KB |
| **Totale stimato** | **~40KB minified+gzip** |

Zero npm dependencies aggiunte.

### Listener strategy

- `audio_sessions/{id}` — un listener globale quando si è dentro una sessione
- `queue/*` — un listener (con limit 50) per la lista scorrevole
- `signaling/{userId}` — listener temporaneo, attivo solo durante un transfer
- `participants/*` — listener leggero per la lista partecipanti

Tutti detach esplicito su unmount, route change, sessione chiusa.

### Audio lifecycle

- Audio element creato lazy alla prima play
- Web Audio Context **una sola istanza** per app, riusata
- Quando si esce dalla app/tab, la traccia continua se `mediaSession` attiva (è il punto del background playback)
- Se l'utente entra in un'altra sessione, la sessione corrente viene **leftAt** automaticamente

### IndexedDB performance

- Bulk operations in transazione singola
- Nessun listener su IndexedDB (lettura on-demand)
- Cache in-memory dei metadati (titolo, artista, ecc.) per la list view
- I `Blob` sono caricati solo on-demand al play

### Battery budget

Target: ≤ 3% drain in 30 min di playback. Web Audio API è efficiente, nessun re-render React durante playback (l'engine notifica via callback diretto, non state React per ogni timeupdate).

---

## 14. Limitazioni Note & Roadmap

### Limitazioni accettate per MVP

| Limitazione | Impatto | Mitigazione futura |
|---|---|---|
| No streaming Spotify/YouTube | UX limitata a file user-owned | API ufficiali in Fase 3 (richiedono player embedded con ads) |
| No mix multi-source dal vivo | DJ ha solo crossfade locale | Fase 3 (grosso lavoro) |
| ID3 parser custom, gestisce ID3v2.3/2.4 ma non v1 raro | Pochi file colpiti | Estensione parser quando emerge |
| Hash check del transfer optional | Anti-corruption non implementato | Fase 2: SHA-256 sul primo chunk |
| Cleanup signaling docs solo client-side | Possibili documenti orfani in caso di crash | Cloud Function periodica Fase 2 |
| Heartbeat partecipanti via campo `lastSeenAt` | Detezione "left" ritardata fino a 60s | OK per use case |

### Roadmap

**Fase 1 (MVP, oggetto di questa spec):**
- Biblioteca personale + Walkman completo
- Sessione DJ + Coda real-time + WebRTC P2P + Auto/Manual mode
- Gamification base (punti)
- Fallback Curation Pura se WebRTC fallisce

**Fase 2 (post-MVP, 1-3 mesi dopo):**
- Crossfade tra tracce
- SHA-256 hash check
- Cloud Function `cleanupSignalingDocs`
- Gagliardetti calcolati da snapshot
- "Ascolta in cuffia" sync per il proposer
- Playlist condivise (collaborative playlists in una sessione)

**Fase 3 (futuro):**
- Spotify Connect / YouTube Music integration (con player embedded ufficiali)
- Mix multi-source con AudioWorklet
- Effetti DJ avanzati (filter sweep, scratching simulato, beat detection)
- Backup IndexedDB → Firebase Storage opt-in (privacy/cost trade-off)

---

## Riepilogo per il Lettore Frettoloso

L'Ainulindalë è il modulo audio condiviso di Marzio1777. Tre pilastri:
1. **Biblioteca Personale** locale in IndexedDB con walkman completo (player, EQ, visualizer, lock screen)
2. **Sessioni del Coro** dove un Admin/Root fa da DJ, gli altri propongono Temi, la coda gira automatica con WebRTC P2P transfer device-to-device
3. **Integrazione completa** col sistema Punti Altitudine, gagliardetti e Bivacco esistenti

Stack: zero-dipendenze-nuove. Tutto su API native (IndexedDB, Web Audio, WebRTC, Media Session) + Firestore signaling.

Estetica: dark-flame (nero+ambra+crimson), vinyl spinning, waveform glow, vibe metal-prog-Tolkien per gente seria.

Bundle delta: ~40KB. Compatible con la filosofia di Marzio: privata, locale, P2P quando si condivide, mai dati personali sul cloud più del necessario.

*"E il Tema della Grande Musica fu il Bivacco e il Camino, e tutti coloro che vi sedevano." — non è di Tolkien, l'ha scritta Marzio1777 in una sessione di Ferragosto del 2026.* 🍺🔥🎸
