# 🛠️ marzio1777 — Architettura Tecnica & Documentazione per Sviluppatori

Questo documento fornisce una panoramica professionale e altamente dettagliata delle decisioni architetturali, dei modelli dati, degli algoritmi e dei flussi tecnici che alimentano l'applicazione `marzio1777`. Serve come singola fonte di verità per sviluppatori e collaboratori.

*Ultima revisione: Maggio 2026 — integrazione del modulo Il Campo dei Giochi (Concept A — Caccia ai Ricordi, Concept B — Quiz del Bivacco) e del modulo L'Ainulindalë (Biblioteca audio personale, Sessioni del Coro, trasferimento P2P via WebRTC).*

## 1. 🏗️ Architettura & Tech Stack

`marzio1777` è costruita come una Single Page Application (SPA) altamente reattiva.
- **Frontend Framework:** React 18 (Functional Components, Hooks), sviluppato via Vite per HMR e build ottimizzate.
- **Linguaggio:** TypeScript esplicitamente per un type-checking rigoroso su payload esterni e riferimenti al DOM.
- **Backend as a Service (BaaS):** Ecosistema Firebase:
  - **Firestore:** Gestione di stato NoSQL e relazioni. Persistenza offline tramite `persistentLocalCache` (API moderna Firebase v12+, sostituisce `enableIndexedDbPersistence` deprecata).
  - **Firebase Auth:** Verifica identità via provider OAuth Google.
  - **Firebase Storage:** Archiviazione binaria per gli asset immagine compressi. **NON utilizzato per file audio** — i Temi de L'Ainulindalë vivono esclusivamente in IndexedDB locale lato utente, vedi §4.12.
- **Gestione dello Stato:** React Context API (`AuthContext`) per gli stati globali, potenziato da hook locali `useState`, `useRef`, e `useEffect` che si affidano ad `onSnapshot` di Firebase per reattività in tempo reale senza dover usare librerie esterne come Redux.
- **Styling Engine:** Tailwind CSS gestisce la composizione utility-first. Stati complessi sono mappati a CSS standard in `index.css`.
- **Animazioni:** Framer Motion (`AnimatePresence` per transizioni tra rotte e componenti).
- **Icons:** Lucide React.
- **Maps:** react-leaflet 5.x su Leaflet 1.9.x.
- **Integrazione AI:** Google Gemini API usata per la generazione descrizioni immagini del `Magic Scan`.
- **Confetti & Particelle:** `canvas-confetti` (riusato per i feedback like, le catture di Concept A, i reveal di quiz, le particelle di cattura nel Walkman).
- **Storage Locale:** **IndexedDB nativo** (no Dexie, no idb library) per la Biblioteca Personale audio.
- **Audio:** **Web Audio API** nativa per playback, EQ, visualizer.
- **P2P Transfer:** **WebRTC** nativa con signaling via Firestore (no PeerJS, no simple-peer, no signaling server dedicato).
- **Lock Screen & Background Audio:** **Media Session API** + **Wake Lock API** native.

> **Filosofia "Zero-Dipendenze-Nuove":** l'introduzione di tutti i moduli successivi al core (Campo dei Giochi, L'Ainulindalë) **non aggiunge alcuna dipendenza npm**. Il livello AR è realizzato con API native browser (`navigator.mediaDevices.getUserMedia`, `DeviceOrientationEvent`, `navigator.wakeLock`, `navigator.vibrate`). Geolocazione tramite `Geolocation.watchPosition`. Calcoli geo (Haversine, disk point picking) come utility pure interne. WebRTC P2P, IndexedDB, ID3 parsing, Web Audio Engine, Media Session — tutto su API native, zero npm. Decisioni documentate nelle sezioni §4.7-§4.14 con motivazioni tecniche complete. Bundle delta complessivo (Campo dei Giochi + L'Ainulindalë): **~70KB minified+gzipped**.

---

## 1.5 🎨 Animazioni e UI/UX (Framer Motion)

L'applicazione integra animazioni fluide di livello enterprise utilizzando **Framer Motion**:
- **Transizioni di Pagina (`Layout.tsx`)**: Utilizzo di `<AnimatePresence mode="wait">` su rotta con effetti dissolvenza incrociata e 'slide up'.
- **Micro-interazioni Feedback**: Il pulsante "Mi Piace" (cuore) applica un feedback multi-step (`scale: [1, 1.15, 1]`) per una risposta tattile immediata, oltre ad effetti particellari specifici ("🍃" in LaPiazza).
- **Gamification e Count-Ups**: All'interno del Profilo Personale le statistiche utilizzano `mode="popLayout"` per le transizioni numeriche supportando il CountUp con `spring` physics e variazioni momentanee esteriche della colorazione per attrarre l'occhio sui progressi.
- **Gestione Asincrona (Il Baule)**: Durante la 'Magic Scan' AI, feedback visivi a caricamento ciclico (`rotate: 360`, *infinite linear loop*) migliorano la UX sui tempi d'attesa invisibili, evitando frustrazioni da "schermo bloccato".
- **AR Capture Layer (Il Campo dei Giochi):** L'oggetto virtuale fluttua sul video stream con `motion.div` animato in loop infinito (path randomico ma deterministico per round) e applica parallasse via `useDeviceOrientation` quando disponibile. La cattura conclude con un `scale + opacity → 0` accoppiato a un burst `canvas-confetti` proporzionato al valore in punti dell'oggetto.
- **Quiz Distribution Bars (Concept B):** dopo il reveal del round, le barre di distribuzione percentuale delle 4 opzioni si animano con `whileInView` e `springs` differenziati per dare la sensazione "salgono mentre tu guardi", con la barra corretta che pulsa.
- **Vinyl Spinning (L'Ainulindalë):** il player full-screen del Walkman applica una rotazione continua 0→360° in 6s loop sulla cover (CSS animation per efficienza, sospesa quando il brano è in pausa). Il visualizer waveform reagisce al `AnalyserNode` di Web Audio in tempo reale.
- **Quiz Wizard Steps (Concept B):** transizioni step-by-step nel `QuizHostCreateRound` con fade+slide direzionali (avanti = slide left, indietro = slide right).
- **Reduced Motion:** ogni animazione del modulo giochi e audio rispetta `useReducedMotion()` di Framer Motion. Quando attivo, tutti i loop infiniti, parallasse e bounce sono sostituiti da transizioni statiche o riduzioni 0-1.

---

## 2. 💾 Schema Dati Firestore

Il database usa una struttura NoSQL basata su documenti con documenti globali normalizzati e sottocollezioni annidate per funzionalità relazionali.

### 1. `users` (Collection)
Memorizza profilo privato, credenziali e le configurazioni RBAC.
- `uid` (Document ID)
- `email` (String) — Dati Sensibili (Protetti)
- `apiKey` (String) — Dati Sensibili (Protetti)
- `displayName` (String)
- `photoURL` (String)
- `role` (String) → `"Guest" | "Admin" | "Root"`
- `accountStatus` (String) → `"pending" | "approved"`
- `points` (Number) → Determina i livelli Gamification (Altitudine). Viene incrementato tramite `increment()` atomico **anche** dalle catture di Concept A, dalle risposte corrette di Concept B (con moltiplicatore evento applicato), e dalle proposte musicali eseguite in L'Ainulindalë.
- `bio` (String)
- `shareLiveLocation` (Boolean) → Attiva/disattiva tracciamento geolocalizzato
- `createdAt` (Timestamp)

### 2. `user_locations` (Collection) — *Split Collection Pattern*
Memorizza rigorosamente la presenza geografica pubblica. Isolata da `users` per prevenire leakage PII.
- `userId` (Document ID)
- `displayName` (String)
- `photoURL` (String)
- `shareLiveLocation` (Boolean)
- `liveLocation` (Object) → `{lat: Number, lng: Number, updatedAt: Timestamp}`

### 3. `posts` (Collection)
Feed principale per `LaPiazza` e `IlCinematografo`. Mix di foto e update testuali.
- `imageUrl` (String — Base64 o CDN URL)
- `caption` (String)
- `decade` (String)
- `location` (Object) → `{lat: Number, lng: Number}`
- `authorId` (String — mappato su `users.uid`)
- `authorName` (String)
- `timestamp` (Timestamp)
- `likesCount` (Number)
- `commentsCount` (Number)
- `visibilityStatus` (String) → `"public" | "private" | "scheduled"`
- `visibilityTime` (Number)
- `showInCinematografo` (Boolean)

*(Subcollection)* `posts/{id}/comments`
- `postId`, `text`, `authorId`, `authorName`, `timestamp`

### 4. `events`, `chats` (Collections)
Alimentano `IlBivacco` (Eventi) e `L'Alberone` (Chat real-time). Usano gli stessi modelli di ownership rigorosa.

### 5. `game_events` (Collection) — *Modulo Il Campo dei Giochi*
Modello agnostico rispetto al tipo di gioco: lo stesso schema regge sia il treasure hunt (Concept A) sia il quiz (Concept B), con due sotto-strutture configurazione type-specific. Pensato esplicitamente per essere estensibile a futuri concept.

- `id` (Document ID)
- `type` (String) → `"treasure_hunt" | "photo_quiz"` — *immutabile dopo create*
- `status` (String) → `"draft" | "scheduled" | "lobby" | "active" | "completed" | "aborted"` — transizioni controllate da rule
- `title` (String, ≤100 char)
- `description` (String, ≤500 char)
- `organizerId` (String — `users.uid`) — *immutabile dopo create*
- `createdAt` (Timestamp)
- `startTime` (Timestamp) — apertura della lobby
- `scheduledKickoff` (Timestamp) — passaggio a `active`
- `endTime` (Timestamp | null) — null = termina alla raccolta totale o manualmente
- `completedAt` (Timestamp | null)
- `pointsMultiplier` (Number, 0.5..5.0)
- `visibilityOfOthers` (Boolean) — opt-in per evento per posizioni live degli altri giocatori
- `invitedUserIds` (Array<String>, max 100)
- `treasureHuntConfig` (Object | null) — popolato solo se `type === 'treasure_hunt'`
- `photoQuizConfig` (Object | null) — popolato solo se `type === 'photo_quiz'`, contiene tra l'altro `currentHostId` per il sistema di rotazione
- `currentParticipantsCount` (Number) — denormalizzato
- `totalItemsCount` (Number, opzionale)
- `itemsCollectedCount` (Number, opzionale)
- `currentRoundId` (String, opzionale)
- `roundsPlayed` (Number, opzionale)
- `finalLeaderboard` (Array<LeaderboardEntry>, opzionale) — **embedded immutabile** popolato alla transizione `active → completed`. Ordine per `points DESC`. Una volta scritto, rule garantisce che non possa essere modificato. Vedi §10 per dettaglio rule.

*(Subcollection)* `game_events/{eventId}/items` — *solo treasure_hunt*
Oggetti virtuali sparsi sulla mappa. `lat/lng/points/templateId` immutabili dopo create.
- `id`, `templateId`, `emoji`, `label`, `points`, `captureRadius`
- `lat`, `lng` — *immutabili*
- `status` → `"spawned" | "collected" | "expired"`
- `spawnedAt`, `collectedBy`, `collectedAt`
- `collectedAtLat`, `collectedAtLng` — coordinate dichiarate dal giocatore al momento della cattura, scritte in transazione atomica per audit log e investigazione ex-post di "The Teleporter" (vedi §10)
- `legacyPostId` (opzionale, modalità Post Legacy)

*(Subcollection)* `game_events/{eventId}/participants`
RSVP e presenza individuale. Auto-popolata via cloud function (futura) o creata dal client su accept invito.
- `userId` (Document ID), `displayName`, `photoURL`
- `status` → `"invited" | "joined" | "declined" | "kicked"`
- `invitedAt`, `respondedAt`, `joinedAt`, `leftAt`
- `shareLocationDuringEvent` (Boolean) — override per-utente del setting evento

*(Subcollection)* `game_events/{eventId}/leaderboard`
Score real-time durante l'evento. Documento per partecipante. **Lo snapshot finale è scritto come array embedded `finalLeaderboard` direttamente sul documento padre `game_events/{eventId}` — vedi sopra.** La sub-collection `leaderboard/{userId}` resta solo per l'aggiornamento real-time durante `status: 'active'`; non vi è più un documento `leaderboard/final`.
- `userId`, `displayName`, `photoURL`
- `points` (Number) — accumulato durante l'evento
- `captures` (Number, treasure_hunt)
- `correctAnswers` / `totalAnswers` / `averageResponseMs` (photo_quiz)

*(Subcollection)* `game_events/{eventId}/quizRounds` — *solo photo_quiz*
Un documento per ogni round del quiz.
- `id`, `roundNumber`, `postId` (legacy/optional), `questionType`, `questionText`
- `sourcePostId` (String | null) — **nuovo campo**: id del post da cui è stata derivata o ispirata la domanda. Popolato dal wizard `QuizHostCreateRound` (composizione manuale in MVP). In Fase 2, verrà popolato dai generators automatici di `quizGenerators.ts` senza alcuna migration dello schema.
- `options` (String[4]) — shufflate
- `startedAt`, `endsAt`, `revealedAt` (null pre-reveal)
- `hostId`

*(Sub-Sub-Collection)* `game_events/{eventId}/quizRounds/{roundId}/secret/correctness`
**Cassaforte separata per la risposta corretta**: `correctIndex` non è leggibile dai partecipanti standard, solo da `currentHostId`/Organizer/Root. Al reveal, il valore viene copiato nel doc parent, dove a quel punto le rule lo rendono leggibile a tutti.

*(Sub-Sub-Collection)* `game_events/{eventId}/quizRounds/{roundId}/answers`
Una risposta per partecipante per round. `submittedAt` deve essere `< endsAt` (anti-cheat). `pointsAwarded` valutato post-reveal.

### 6. `audio_sessions` (Collection) — *Modulo L'Ainulindalë*
Sessione DJ aperta da un Admin/Root, durante la quale i partecipanti propongono Temi musicali alla coda condivisa.

```typescript
interface AudioSession {
  id: string;                        // doc ID
  type: 'audio_session';             // discriminator
  djId: string;                      // users.uid (Admin/Root) — IMMUTABILE
  djName: string;                    // denormalizzato
  djPhotoURL: string;
  title: string;
  description?: string;
  status: 'open' | 'closed';         // immutabile a 'closed'
  mode: 'auto' | 'manual';           // DJ può togglare durante 'open'
  createdAt: Timestamp;              // IMMUTABILE
  closedAt: Timestamp | null;
  
  // Now playing (denormalizzato per i listener)
  currentQueueItemId: string | null;
  currentTrackTitle: string | null;
  currentTrackArtist: string | null;
  currentTrackDurationMs: number | null;
  currentTrackStartedAt: Timestamp | null;
  
  rules: {
    maxQueuedPerUser: number;         // default 2
    bonusPerHundredPoints: number;    // default 1
    allowDuplicates: boolean;         // default false
    autoSkipOfflineProposers: boolean;
  };
  
  participantCount: number;
  queuedCount: number;
  playedCount: number;
  
  linkedGameEventId?: string | null;  // collegamento opzionale a un game_event
  
  finalStats?: {
    totalDurationMs: number;
    totalTracksPlayed: number;
    participantsCount: number;
    topProposers: Array<{ userId, displayName, tracksPlayed }>;
    closedAt: Timestamp;
  };  // popolato alla transizione open → closed, IMMUTABILE
}
```

*(Subcollection)* `audio_sessions/{sessionId}/queue/{itemId}`
Tema proposto da un utente alla coda condivisa.

```typescript
interface QueueItem {
  id: string;
  proposedBy: string;                // IMMUTABILE
  proposedByName: string;
  proposedByPhotoURL: string;
  proposedAt: Timestamp;
  
  // Metadati traccia (i bytes audio NON sono qui, vivono in IndexedDB del proposer)
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string;
  trackYear?: number;
  trackDurationMs: number;
  trackCoverDataUrl?: string;        // base64 ≤ 50KB (cover art embedded)
  
  // Riferimento alla traccia nella Biblioteca del proponente
  localTrackId: string;              // id IndexedDB lato proposer, IMMUTABILE
  
  status:
    | 'queued'        // in coda
    | 'transferring'  // P2P in corso
    | 'ready'         // file ricevuto dal DJ
    | 'playing'
    | 'played'        // archiviato
    | 'skipped'
    | 'failed';       // P2P fallito
  
  position: number;                  // FIFO order, riordinabile dal DJ
  
  // Audit P2P
  transferStartedAt?: Timestamp;
  transferCompletedAt?: Timestamp;
  transferFailureReason?: string;
  
  pointsAwarded?: number;            // assegnati a 'played'
}
```

*(Subcollection)* `audio_sessions/{sessionId}/participants/{userId}`
Stesso pattern di `game_events.participants`: tracking presenza, heartbeat `lastSeenAt`, contatori `tracksProposed` / `tracksPlayed`.

*(Subcollection)* `audio_sessions/{sessionId}/signaling/{userId}`
Canale signaling WebRTC per il transfer P2P. Vita brevissima (cancellato a connessione stabilita o dopo 60s di idle). Vedi §4.14.

### Indexes consigliati
```
game_events:                         (status ASC, scheduledKickoff DESC)
game_events:                         (organizerId ASC, status ASC)
game_events/.../items:               (status ASC, spawnedAt ASC)
game_events/.../leaderboard:         (points DESC)
game_events/.../participants:        (status ASC)

audio_sessions:                      (status ASC, createdAt DESC)
audio_sessions:                      (djId ASC, status ASC)
audio_sessions/.../queue:            (status ASC, position ASC)
audio_sessions/.../queue:            (proposedBy ASC, status ASC)
```

---

## 3. 🔐 Sicurezza, PBAC & RBAC (Regole Firebase Zero-Trust)

La piattaforma usa una Architettura Zero-Trust applicata nativamente tramite le regole Firestore.

1. **Flusso Registrazione Utente (Anti-Bot & Meccanismo Approvazione):**
   - Nuove registrazioni forzate in `accountStatus: "pending"` e `role: "Guest"` tranne se email equivale al Root (`nicolainformatica@gmail.com`).
   - Root utente viene subito promosso a `approved` e ruolo `Root`.

2. **La Gerarchia a 3 Livelli + 2 dinamici:**
   - **Root:** Livello più alto (`isRoot()`). Può bypassare ogni limite.
   - **Admin:** Può visualizzare nuovi utenti in coda e approvarli. Promuove Guest in Admin. Crea eventi di gioco e Sessioni del Coro.
   - **Guest (`Guest` / Pending):** Confini ristretti a read-only visivi finché in attesa o vuoti, bloccati e non in grado di vedere le collection vere (inclusa `game_events` e `audio_sessions`).
   - **Round Host (dinamico, solo Quiz):** Determinato runtime via `game_events.photoQuizConfig.currentHostId`. Helper rule dedicato `isCurrentHost(eventId)`. Può creare round, scrivere/leggere `secret/correctness`, fare reveal, assegnare `pointsAwarded`. Il passaggio dello scettro è limitato all'host uscente, all'organizer e al Root, **e il nuovo `currentHostId` deve essere un participant con `status == 'joined'`** (vedi §4.8 e §10).
   - **Session Conductor (dinamico, solo L'Ainulindalë):** Il `djId` di una `audio_sessions/{sessionId}`. Helper rule dedicato `isSessionDJ(sessionId)`. Può modificare `currentQueueItemId`, `mode`, `status`, riordinare la coda, settare `pointsAwarded` sui queue items.

3. **Integrità Esplicita:**
   - Qualsiasi `create`/`update` passa per helpers di validazione forzando la corretta scrittura per campi.
   - Per `game_events`, una function `validStatusTransition(old, new)` codifica esplicitamente le transizioni ammesse (draft→scheduled→lobby→active→completed, con aborted come uscita d'emergenza da qualsiasi punto pre-completed).
   - Per `items.update` (cattura): validato che `resource.data.status == 'spawned'`, `request.resource.data.collectedBy == request.auth.uid`, e che `lat/lng/points/templateId` siano invariati. Il check di distanza geografica vera (Haversine) è demandato a Cloud Function in Fase 2 — limitazione documentata, l'audit log delle catture include `collectedAtLat/Lng` per investigazione ex-post.
   - Per `quizRounds/answers`: rule garantiscono `selectedIndex ∈ [0..3]`, `userId == request.auth.uid`, `submittedAt < endsAt`, e blindano `pointsAwarded` con range valido `[0, maxPointsPerRound]` e check `selectedIndex == correctIndex` (eseguibile in rule perché `correctIndex` è già pubblico post-reveal).
   - Per `game_events.update` con cambio di `currentHostId`: la rule isola il diff con `affectedKeys()`, verifica che `request.auth.uid` sia uno tra `oldCurrentHostId | organizerId | Root`, **e verifica con `exists()` + `get()` che il nuovo host sia un participant con `status == 'joined'`**. Un host malizioso non può scrivere `currentHostId = "alieno-uid"` per congelare il quiz.
   - Per `game_events.update` quando `status == 'completed'`: il campo `finalLeaderboard` è dichiarato immutabile via clausola `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))`. Permette la write nella sola transizione `active → completed` (perché in quel momento `resource.data.status == 'active'`).
   - Per `audio_sessions` e sub-collections: rule analoghe come da §10.

---

## 4. 🧩 Moduli Core e Logiche

### 4.1 "Il Baule" Engine di Upload
Gestione batch per immagini, calcoli geometrici per l'inquadratura box e canvas rendering system ("Alpha-Channel Blackout" fix). Filtro visivo matrice Magic Scan simulato tramite filtri css.

### 4.2 Integrazione L'AI (Gemini Vision)
Chiamate API client-side tramite `@google/genai` con chiave salvata reattivamente dal server e isolata in memory. Prompt apposito e dedicato.

### 4.3 "Il Cinematografo" (Slideshow & Gamification)
Usa `useRef` stabili, animazioni pesate, e gamification mechanics togliendo crediti visivi su richiesta bloccati tramite `mode` (inclusa la modalità 'solo_immagini' per UI immersive hide). Assegnazione interattiva database (`users`) di +5 Punti / -2 Punti per i giochi single-player Indovina Chi/Anno (rimasti invariati). Concept B — Quiz del Bivacco è la sua estensione multiplayer.

### 4.4 "Il Bivacco" (Event Logistics Engine)
Il Wallet System calcola bilanci su snapshot read live del conto per stabilire i debiti e crediti per evento.

### 4.5 Geolocalizzazione (`LaMappa`) e Pattern Container
Doppia implementazione react-leaflet. Passaggio dark/light tile automatizzato su observer di classList e aggiornamenti GPS continui ma filtrati e resi obsoleti lato observer dopo time decay precisi. È presente un pannello Floating per filtrare dinamicamente i pin sulla cartina tramite filtri decostruiti live su array decenni e autori.

**Pattern container Leaflet stabile** (replicato anche in `TreasureHuntMap` di Concept A, vedi §4.7):
```jsx
<div className="flex-1 w-full relative min-h-[300px]">
  <div className="absolute inset-0">
    <MapContainer center={[lat, lng]} zoom={18} className="w-full h-full">
      {/* TileLayer + children */}
      <MapController lat={lat} lng={lng} itemsCount={N} arOpen={bool} status={evtStatus} />
    </MapContainer>
  </div>
</div>
```

`MapController` esegue `map.invalidateSize()` con debounce 200ms su tutte le dependencies che possono modificare il layout (cambio numero items, apertura AR Layer, transizione di status dell'evento). Senza questo, Leaflet renderizza tile a quadrati e pezzi mancanti — pattern già scoperto e documentato.

### 4.6 Privacy, Post Visibility & Gestione Archivio
I frontend di fetch saltano documenti senza timestamp congrui, privacy toggle o switch cinematografo.

### 4.7 "Il Campo dei Giochi" — Concept A: Caccia ai Ricordi
Il treasure hunt geolocalizzato. Il flusso completo:

1. **Configurazione (admin):** Wizard `GameCreator` consente 4 modalità di spawning: `auto` (uniform disk point picking via formula `r = R · √(random()); θ = 2π · random()` con jitter check di `min_separation` 8m), `manual` (tap su mappa), `hybrid` (auto + edit) e `legacy_posts` (campionamento dai `posts` pubblici geo-localizzati).
2. **Lobby (5 min pre-kickoff):** apertura sala d'attesa, richiesta permessi (geolocalizzazione, fotocamera, DeviceOrientation per iOS) gestita via `PermissionsGate`. Wake lock attivato.
3. **Kickoff:** transizione di stato `lobby → active`, fade-in scaglionato degli items sulla mappa, `useHighAccuracyPosition` attivo (`enableHighAccuracy: true, timeout: 15000, maximumAge: 2000`).
4. **Caccia:** loop di calcolo distanze Haversine giocatore↔items. Quando un item entra in `captureRadius`, viene mostrato in stato `capturable`, accoppiato a feedback aptici (`navigator.vibrate(60)` su Android), `HotColdRadar` (barra calore in basso) e `CompassArrow` (freccia direzionale via `webkitCompassHeading`/`alpha` da `useDeviceOrientation`).
5. **Cattura:** apertura `ARCaptureLayer`. Vedi §4.9.
6. **End-game:** raccolta totale o stop manuale. Snapshot scritto come `finalLeaderboard` embedded nel doc evento (vedi §2). Animazione confetti proporzionata al rank.

**Math utilities** (file `utils/geo.ts` e `utils/spawning.ts`):
- `haversineDistance(a, b)` in metri
- `bearing(from, to)` in gradi
- `generateUniformPointsInRadius(centerLat, centerLng, radiusMeters, count, minSeparation)` con max-attempts e degrado automatico di `min_separation` se troppo aggressivo

### 4.8 "Il Campo dei Giochi" — Concept B: Quiz del Bivacco
Photo-trivia multiplayer real-time con sincronizzazione host-driven via Firestore.

**Architettura:**
- L'host (di default `organizerId`, opzionalmente rotativo) crea un nuovo `quizRounds/{roundId}` con `startedAt: serverTimestamp()` e `endsAt: startedAt + answerTimeMs`. `correctIndex` è scritto **esclusivamente** in `quizRounds/{roundId}/secret/correctness`, accessibile solo a host triade.
- I partecipanti, via `onSnapshot` su `quizRounds`, ricevono il round in tempo reale. Renderano la foto fullscreen + 4 opzioni shuffled (le posizioni delle opzioni sono identiche per tutti perché calcolate dal seed `roundId`).
- Ogni partecipante crea il proprio `answers/{userId}` (rule: solo prima di `endsAt`, una sola volta).
- Allo scadere del timer, l'host preme "Rivela": copia `correctIndex` dal `secret/` al doc parent e setta `revealedAt`. La rule sblocca lettura di `correctIndex` e lettura aggregata delle `answers/*`.
- Scoring lato client (`utils/scoring.ts`):
  - `fixed mode`: 10pt corretta, 0pt sbagliata
  - `decay mode`: `points = max(0, round(maxPoints · (1 - timeMs/maxTimeMs)))` con floor a 1pt minimo se corretta entro il tempo
- La rule su `answers.update` valida `pointsAwarded` in range `[0, maxPointsPerRound]` e impone `selectedIndex == correctIndex` quando `pointsAwarded > 0` (anti-cheat sul punteggio).
- Transazione atomica per: scrivere `pointsAwarded` su `answers/{userId}` + `increment(points)` su `leaderboard/{userId}` + `increment(points · pointsMultiplier)` su `users/{userId}.points`.

**Composizione domande — UI Wizard 4-step** (`QuizHostCreateRound.tsx`):
- Step 1: scelta del post sorgente dalla griglia dei `posts` pubblici (con filtri decennio/autore + search)
- Step 2: scelta tipo domanda (5 tipologie, badge "Manuale" su tutte in MVP)
- Step 3: compilazione testuale di domanda + 4 opzioni + indicazione corretta
- Step 4: recap + slider tempo risposta + pulsante "🚀 Lancia Round!"
- Auto-save bozza in `localStorage` con chiave `marzio1777:quiz-draft:{eventId}` (resilienza a refresh)

**Architettura pluggable per i generators automatici** (`/src/utils/quizGenerators.ts`):
```typescript
export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who: (post, pool) => null,      // TODO Fase 2
  guess_year: (post, pool) => null,     // TODO Fase 2
  guess_place: (post, pool) => null,    // TODO Fase 2
  guess_caption: (post, pool) => null,  // TODO Fase 2
  chronology: (post, pool) => null,     // TODO Fase 2
};
```
In MVP tutti ritornano `null` (composizione manuale forzata). In Fase 2, sostituendo il body di ognuno con la logica di generazione automatica, la UI di `QuizHostCreateRound` mostra automaticamente il pulsante "Genera" (gated by `isAutoGenerationAvailable(type)`). **Nessuna migration dello schema necessaria** — il campo `sourcePostId` su `quizRounds/{roundId}` è già pronto a ricevere sia la selezione manuale sia l'output automatico.

**Rotazione Host (rotateHost === true):** ogni round, l'host uscente calcola il prossimo `currentHostId` ordinando i `participants.status === 'joined'` per `userId` (immutabile, deterministico) e prendendo il successivo con wrap-around. Solo l'host uscente, l'organizer o il Root possono scrivere il nuovo `currentHostId` (rule via `diff().affectedKeys()` + `exists()` check sul nuovo host come da §3 e §10). Edge case: se `joinedPlayers.length === 0`, fallback automatico a `organizerId`.

**5 Question Types:** `guess_who`, `guess_year`, `guess_place` (reverse-geocoded da `post.location`), `guess_caption` (4 didascalie tra cui quella reale), `chronology` (4 foto da ordinare). Ogni tipo ha un generatore dedicato che produce `{questionText, options[4], correctIndex}` partendo da un `Post` — implementazione in Fase 2.

### 4.9 AR Capture Layer — Architettura Tecnica

**Decisione architetturale:** layer fotocamera HTML5 leggero, **non** WebXR né AR.js né MindAR.

| Approccio | Bundle | iOS Safari (2026) | Android Chrome | Adatto al use-case? |
|---|---|---|---|---|
| **HTML5 Camera Overlay (scelto)** | ~0KB | ✅ supportato | ✅ supportato | ✅ |
| WebXR `immersive-ar` | ~50KB polyfill | ❌ non supportato | ✅ ARCore | ❌ — esclude metà degli utenti iPhone |
| AR.js + AFRAME | ~3MB | ⚠️ parziale | ✅ | ⚠️ overkill per il flow "conferma cattura" |
| MindAR | ~10MB+ | ✅ | ✅ | ❌ — solo image/face tracking, non geo |

**Stack di implementazione:**
- `navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}})` per il video stream sul `<video>` di sfondo, con cleanup garantito (`stream.getTracks().forEach(t => t.stop())`) in unmount, route change e `visibilitychange`.
- `<motion.div>` di Framer Motion sopra il video, con animazione di fluttuazione `x/y/rotate` in loop infinito (ridotto a statico se `prefers-reduced-motion`).
- `useDeviceOrientation()` hook che gestisce il caso iOS (`DeviceOrientationEvent.requestPermission()` su gesture utente, granted/denied/unavailable). Quando granted, `event.gamma` e `event.beta` applicano un parallasse leggero (-20px..+20px) che simula "l'oggetto è fisso nello spazio".
- Tap → transazione Firestore atomica (vedi §4.10).
- Wake lock attivo durante la sessione di gioco (`navigator.wakeLock.request('screen')`), release in cleanup e su `visibilitychange`. Wrappato in feature-policy check per evitare warning in iframe (es. AI Studio preview, Stackblitz embed).

### 4.10 Atomic Capture Transactions (Anti-Race)

Quando due o più giocatori sono entrambi nel `captureRadius` di un item nello stesso istante, il sistema deve garantire che **uno solo vinca**. Implementazione completa:

```typescript
await runTransaction(db, async (tx) => {
  const itemRef = doc(db, `game_events/${eventId}/items/${itemId}`);
  const itemSnap = await tx.get(itemRef);
  if (!itemSnap.exists()) throw new Error('Item not found');
  if (itemSnap.data().status !== 'spawned') throw new Error('Already collected');

  tx.update(itemRef, {
    status: 'collected',
    collectedBy: currentUser.uid,
    collectedAt: serverTimestamp(),
    collectedAtLat: position.coords.latitude,    // audit log
    collectedAtLng: position.coords.longitude,   // audit log
  });

  const leaderboardRef = doc(db, `game_events/${eventId}/leaderboard/${currentUser.uid}`);
  tx.set(leaderboardRef, {
    userId: currentUser.uid,
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
    points: increment(itemPoints),
    captures: increment(1),
  }, { merge: true });

  const userRef = doc(db, `users/${currentUser.uid}`);
  tx.update(userRef, {
    points: increment(itemPoints * eventMultiplier),
  });
});
```

Firestore garantisce isolamento ottimistico: se un'altra transazione modifica `itemRef` prima della commit, il sistema rifa il replay; al secondo replay `status === 'collected'` farà fallire il check, e il client riceve un errore gestito gracefully ("Troppo lento! Qualcun altro l'ha preso"). Le coordinate `collectedAtLat/Lng` permettono in Fase 2 a una Cloud Function di validare server-side la distanza Haversine `< captureRadius` chiudendo definitivamente "The Teleporter".

### 4.11 Punti Altitudine Unificati
Incremento atomico nativo Firestore (`increment(N)`) elimina le query prelevatrici e scongiura code incastrate asincrone. **L'economia dei punti è unica e cumulativa**: i punti di Concept A (catture × moltiplicatore), Concept B (risposte corrette × moltiplicatore), e L'Ainulindalë (proposte musicali eseguite × moltiplicatore se la sessione è linked a un game_event) confluiscono nello stesso `users.points` che alimenta i Gagliardetti del Profilo. Nessuna economia parallela: un giocatore che caccia molto, vince molti quiz e propone molta musica scala la stessa scala di Altitudine.

### 4.12 L'Ainulindalë — Biblioteca Personale (IndexedDB)

Storage locale di tracce audio caricate dall'utente. Database name: `marzio1777_audio`, version 1. Due object store: `tracks` e `playlists`.

**Schema `tracks`:**
```typescript
interface LocalTrack {
  id: string;                        // UUID v4
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  durationMs: number;                // calcolato da Web Audio API
  coverDataUrl?: string;             // estratto da APIC frame
  blob: Blob;                        // file audio originale
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  lastPlayedAt?: number;
  playCount: number;
  isFavorite: boolean;
  customTags: string[];
}
```

**Helper `/src/utils/indexedDB.ts`** espone API: `addTrack`, `getTrack`, `getAllTracks`, `searchTracks`, `deleteTrack`, `updateTrack`, `getStorageQuota`, `exportPlaylist`, `importPlaylist`. Tutte le operazioni in `transaction` con commit atomico. Cache in-memory dei metadati per la list view.

**Quota:** ~50% dello storage device tipico (browser-dependent). Limite per traccia: **50MB**. Avviso UI quando quota >80%.

**ID3 Parser** (`/src/utils/id3.ts`): parser custom ~150 righe, zero dipendenze. Supporta ID3v2.3 e v2.4. Estrae: `TIT2` (title), `TPE1` (artist), `TALB` (album), `TYER`/`TDRC` (year), `TCON` (genre), `APIC` (cover). Gestisce encoding ISO-8859-1, UTF-16 BE/LE, UTF-8. Fallback al filename `Artist - Title.mp3` se ID3 assente.

**Walkman UI:**
- Pagina `PersonalLibrary.tsx`: lista tracce con search/filter, upload zone drag&drop, storage indicator
- `MiniPlayer.tsx` persistente fixed bottom durante riproduzione
- `FullScreenPlayer.tsx` modal con vinile rotante, visualizer, controlli completi, EQ 3-band
- `Visualizer.tsx`: 32 barre verticali da `AnalyserNode`, gradient ambra→crimson
- `Equalizer.tsx`: 3 slider verticali low/mid/high (±12dB)
- `MediaSession API`: integrazione lock screen iOS/Android con metadata + 6 action handler (play, pause, prev, next, seekto, seekbackward, seekforward)

### 4.13 L'Ainulindalë — Sessioni del Coro (DJ Engine)

Un Admin/Root apre una `audio_sessions/{sessionId}` (vedi schema §2.6). I listener si collegano, propongono Temi alla coda, il DJ (= conductor) li suona uno dopo l'altro.

**Hub `/src/pages/IlAinulindale.tsx`**: 3 tab — **Biblioteca** (rimanda a PersonalLibrary), **Sessioni Attive** (lista `audio_sessions.status == 'open'`), **Apri Sessione** (Admin/Root only, wizard 3-step).

**Pannello DJ** (`AudioSessionDJ.tsx`):
- Now Playing in alto
- Lista coda drag&drop con menu per item (Suona ora / Skip / Kick / Anteprima)
- Toggle Auto/Manuale prominente
- Pulsante "Apri Coro" (status: open) e "Chiudi Coro"

**Vista Listener** (`AudioSessionListener.tsx`):
- Now Playing sincronizzato (timer locale, calcola progress da `currentTrackStartedAt` + `Date.now()`)
- Coda scrollable con propria posizione evidenziata
- Pulsante "Proponi un Tema" → modal `ProposeTrackModal` con la propria Biblioteca

**DJ Engine** (`/src/utils/djEngine.ts`):
Auto-pilot loop in mode 'auto':
```typescript
async function djAutoEngine() {
  while (session.status === 'open' && session.mode === 'auto') {
    const current = await getCurrentItem();
    
    if (!current) {
      const next = await getFirstQueued();
      if (next) {
        await initiateTransfer(next);
        if (next.status === 'ready') await playItem(next);
        else await markSkipped(next, 'transfer_failed');
      } else await sleep(2000);
      continue;
    }
    
    // Pre-fetch a 30s dalla fine
    const remainingMs = current.durationMs - audioEngine.currentTimeMs;
    if (remainingMs < 30_000) {
      const next = await getFirstQueued();
      if (next?.status === 'queued') initiateTransfer(next);
    }
    
    if (audioEngine.ended) {
      await markPlayed(current);
      await awardPoints(current);  // +2 al proposer × pointsMultiplier (se linked)
    }
    
    await sleep(1000);
  }
}
```

Mode 'manual': stesso engine ma stop dopo ogni traccia, attesa input DJ "Suona Prossimo".

**Vincoli su `queue.create` (validati lato rule)**:
- Utente è participant (`participants/{userId}.status == 'joined'`)
- `proposedBy == request.auth.uid`
- Numero queue items con `proposedBy == auth.uid` AND `status in ['queued', 'transferring', 'ready']` ≤ `maxQueuedPerUser_effettivo`
- Formula bonus: `effettivo = rules.maxQueuedPerUser + floor(user.points / 100) * rules.bonusPerHundredPoints`
- Se `rules.allowDuplicates == false`, no duplicati attivi
- Metadata e `localTrackId` immutabili dopo create

### 4.14 L'Ainulindalë — Trasferimento P2P (WebRTC)

Pattern **Firestore-as-signaling**: niente WebSocket dedicato, niente backend aggiuntivo. SDP offer/answer e ICE candidate scritti come documenti Firestore in `audio_sessions/{sessionId}/signaling/{userId}`, ascoltati con `onSnapshot`.

**Flow del DJ che inizia il transfer**:

1. DJ crea `RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })` — STUN gratuito Google
2. DJ crea `RTCDataChannel('audio', { ordered: true })`
3. DJ chiama `pc.createOffer()` → SDP offer
4. DJ scrive `signaling/{proposerId}.djOffer = { sdp, type: 'offer', queueItemId }`
5. DJ ascolta `signaling/{proposerId}.proposerAnswer` + `.proposerCandidates`
6. Proposer (con `onSnapshot` attivo) riceve l'offer
7. Proposer crea `RTCPeerConnection`, `setRemoteDescription(djOffer)`, `createAnswer()`
8. Proposer scrive `signaling/{proposerId}.proposerAnswer`
9. Entrambe le parti scoprono ICE candidates via `onicecandidate` event, scritti in `arrayUnion`
10. RTCDataChannel apre (event `onopen` su entrambi i lati)
11. DJ marca `queue/{X}.status = 'transferring'` + `transferStartedAt`
12. Proposer legge file da IndexedDB (`LocalTrack.blob`), chunka in pezzi da **16KB**
13. Proposer invia: header `{ chunkIndex, totalChunks, mimeType }`, poi binary data
14. DJ riassembla, valida total chunks, marca `queue/{X}.status = 'ready'` + `transferCompletedAt`
15. Cleanup: `pc.close()`, `signaling/{proposerId}` cancellato
16. DJ play(blob) tramite `Audio` element + Web Audio API graph

**Vincoli & Sicurezza:**
- Max file size: **50MB** (3200 chunk a 16KB max)
- MIME validation: il primo chunk dichiara `mimeType`, DJ verifica whitelist `audio/*`
- Timeout transfer: **15 secondi**. Oltre → `status: 'failed'`, engine skippa al successivo
- Cleanup `signaling/*` dopo transfer completo o timeout

**Fallback graceful:** se 3 transfer consecutivi falliscono (NAT severo, problemi di rete), la sessione passa automaticamente in **Curation Pura**: il DJ può solo suonare tracce dalla SUA libreria, la coda diventa wishlist suggestion. Banner UI notifica.

**Audio Engine** (`/src/utils/audioEngine.ts`): wrapper class su Web Audio API. Graph: source → GainNode (volume) → BiquadFilter low (lowshelf) → BiquadFilter mid (peaking) → BiquadFilter high (highshelf) → AnalyserNode → destination. API: `load(blob | url)`, `play()`, `pause()`, `seek(s)`, `setVolume(0-1)`, `setEQ(low, mid, high)`, `getCurrentTime()`, `getDuration()`, `isPlaying()`, `getAnalyser()`, `on(event, cb)`, `destroy()`. Singleton via `getAudioEngine()` per riuso AudioContext.

---

## 5. 🛣️ Routing & Componenti — Modulo Giochi & L'Ainulindalë

### Route aggiunte
```
# Campo dei Giochi
/giochi                          → IlCampoDeiGiochi (hub eventi attivi/in arrivo)
/giochi/dashboard                → GameDashboard (admin only)
/giochi/dashboard/nuovo          → GameCreator (wizard)
/giochi/:eventId/lobby           → GameLobby
/giochi/:eventId/play            → GamePlayRouter (smista A/B in base a type)
/giochi/:eventId/risultati       → GameResults
/giochi/archivio                 → GameArchive

# L'Ainulindalë
/ainulindale                     → IlAinulindale (hub 3 tab)
/ainulindale/biblioteca          → PersonalLibrary (Walkman)
/ainulindale/sessioni            → AudioSessionsList
/ainulindale/sessioni/nuova      → AudioSessionCreate (Admin/Root only, wizard)
/ainulindale/sessioni/:sessionId → AudioSessionDJ | AudioSessionListener
                                   (smista in base a djId === currentUser.uid)
```

### Componenti chiave
- **Concept A:** `TreasureHuntPlay`, `TreasureHuntMap`, `MapController`, `ItemMarker`, `PlayerLocationMarker`, `OtherPlayersLayer`, `HotColdRadar`, `CompassArrow`, `ARCaptureLayer`, `CaptureSuccess`, `TreasureHuntHUD`
- **Concept B:** `PhotoQuizPlay`, `QuizQuestionScreen`, `QuizOptionButton`, `QuizCircularTimer`, `QuizRevealAnimation`, `QuizDistributionBars`, `QuizLeaderboardTransition`, `QuizHostControls`, `QuizHostCreateRound` (wizard 4-step)
- **Condivisi giochi:** `GameEventCard`, `ParticipantsAvatarStack`, `GameEventCountdown`, `GameLeaderboardLive`, `GameOverScreen`, `PermissionsGate`
- **L'Ainulindalë — Walkman:** `MiniPlayer`, `FullScreenPlayer`, `Visualizer`, `Equalizer`, `UploadZone`, `TrackCard`, `PlaylistManager`
- **L'Ainulindalë — Sessioni:** `AudioSessionCard`, `QueueItemCard`, `ProposeTrackModal`, `TransferProgressIndicator`, `SignalingMonitor` (debug only)

### Hooks custom
- **Giochi:** `useGameEvent`, `useGameItems`, `useGameParticipants`, `useGameLeaderboard`, `useQuizRound`, `useQuizAnswers`, `useHighAccuracyPosition`, `useDeviceOrientation`, `useCameraStream`, `useHaversineDistance`, `useNearestItem`, `useCaptureItem`, `useSubmitQuizAnswer`, `useAdvanceQuizRound`
- **L'Ainulindalë:** `useLocalLibrary`, `useAudioPlayer`, `useAudioSession`, `useAudioQueue`, `useSessionParticipants`, `useWebRTCTransfer`, `useMediaSession`, `useStorageQuota`

---

## 6. 🎨 Theming, UI, & Strategia Viewport
Blocco custom delle overflow a livello flex parent CSS e gestione reattanza mobile/tablet standard Tailwind ma mirata a simulare PWA pura chiusa a "sandbox".

**Micro-interazioni Modulari:** Le animazioni di interaction (like) sono completamente customizzabili lato persistenza. Le variabili fisiche (icona — tramite l'opzione "none" attivabile un puro e semplice `scale` del battito cardiaco senza particelle —, colore tint, gravità/distanza vettoriale Y e velocità/durata temporale) sono vincolate al payload Firestore utente. A livello di Database, per i like vi è un vincolo Zero-Trust tramite il meccanismo di aggiunta/sottrazione uid usando l'array `likedBy` con i metodi `arrayUnion` e `arrayRemove`, permettendo ad un singolo utente di poter mettere solo un like esatto (stile toggle) e prevenendo aggiornamenti compulsivi asincroni ad `increment(1)`.

**Differenziazione visiva del Campo dei Giochi:** la nuova tab adotta un'estetica coerente con il resto dell'app ma con due tonalità semantiche distinte:
- Concept A — verde foresta + ambra (terra, natura, caccia)
- Concept B — blu indaco + oro (notte, salotto, intelletto)

**Estetica de L'Ainulindalë (dark-flame):**
```
sfondo principale:  #0A0A0F (nero ardesia)
sfondo secondario:  #16161D
testo primario:     #F5F0E1 (avorio caldo, color pergamena)
accento ambra:      #FFA000
accento crimson:    #C2410C
accento oro:        #D4A856 (Gagliardetti audio)
glow effects:       rgba(255, 160, 0, 0.4)
```

L'Ainulindalë è dark-first: anche con tema light dell'app, il modulo audio forza dark per immersione musicale. Vinyl spinning sul cover full-screen, ember particles dalle copertine durante playback (riusa `canvas-confetti` con config dedicata), waveform glow ambra pulsante.

**Accessibilità (sistematica su tutti i moduli):** `prefers-reduced-motion` rispettato via `useReducedMotion()` di Framer Motion in TUTTE le animazioni (vinile, particelle, parallasse, transizioni step). `aria-live="polite"` su leaderboard, cambio round, "Risposta Registrata", queue updates, validation errors. `aria-label` dinamici su pulsanti opzione quiz, cattura AR, controlli player audio. Tap-target ≥ 56px su mobile. Contrasto AAA su HUD del Concept A e player full-screen audio (testo bianco con text-shadow nero per leggibilità su sfondo variabile). Screen reader: timer quiz announce ogni 5s rimanenti, timer player audio announce ogni 30s.

---

## 7. 🚀 Gamification, Punti & Altitudine
Incremento atomico nativo Firestore (`increment(N)`) elimina le query prelevatrici e scongiura code incastrate asincrone. Costruzione del profilo in base al cumulativo (sbarramento tag).

Con il Campo dei Giochi e L'Ainulindalë, l'economia si arricchisce di:
- **Moltiplicatore Evento:** ogni `game_event` ha un `pointsMultiplier` (range 0.5–5.0). Si applica al guadagno dei punti di gioco prima del consolidamento sui Punti Altitudine globali. Una `audio_sessions` linked a un `game_event` eredita il moltiplicatore: una proposta musicale eseguita durante un evento Ferragosto 2x vale +4 invece di +2.
- **Snapshot di Classifica:** array `finalLeaderboard` embedded immutabile sul doc `game_events`, consultabile in archivio. Per L'Ainulindalë: `finalStats` embedded sul doc `audio_sessions` (totalDurationMs, totalTracksPlayed, topProposers).
- **Gagliardetti audio (futuri):** *Il Cantore* (50 proposte), *Il Sub-Creatore* (25 proposte played), *Il Conduttore* (5 sessioni come DJ), *Il Maestro del Coro* (20 sessioni > 30min), *Le Voci di Ilúvatar* (10 sessioni come listener), *Il Discordante* (5 proposte skippate consecutive). Calcolati in Fase 2 da snapshot.
- **Anti-inflazione:** non sono mai possibili catture o risposte negative dell'event multiplier; il moltiplicatore è applicato solo al guadagno, mai a sottrazione.

---

## 8. 🛠️ Build Pipeline e CI/CD
Deployment continuo da repository github via node/Vite scripts automatizzati. App auto configurata in PWA via webmanifest a compilation avvenuta.

**Build delta complessivo:**
| Modulo | Delta |
|---|---|
| Il Campo dei Giochi | ~30KB minified+gzip |
| L'Ainulindalë (Biblioteca + Sessioni + WebRTC) | ~40KB minified+gzip |
| **Totale post-MVP** | **~70KB** |

Nessuna dipendenza npm aggiunta — il delta è puro codice React + utility TypeScript locali. Verificato in CI con `vite build` baseline pre-modules vs post-modules.

**Testing:** Vitest per unit test sugli helper puri (`haversineDistance`, `generateUniformPointsInRadius`, `validStatusTransition`, `calculateQuizPoints`, `parseID3`, `chunkArrayBuffer`, AudioEngine). `@firebase/rules-unit-testing` su Firebase Local Emulator per i test delle rule (concorrenza items.update, protezione `correctIndex`, transizioni di stato non valide bloccate, validazione nuovo currentHostId, immutabilità finalLeaderboard, queue.create con bonus formula, signaling write authorization, ecc.). Il test runner delle rule audio è in `firestore.rules.audio.test.ts`.

**Cloud Functions (Fase 2 — non in MVP):**
- Validazione server-side della distanza Haversine sulla cattura (verifica che `collectedAtLat/Lng` sia entro `captureRadius` da `lat/lng` dell'item)
- Cleanup degli eventi `active` da > 24h (passaggio automatico a `aborted` con notifica organizer)
- Cleanup periodico dei documenti `signaling/*` orfani (>60s inattivi)
- Notifiche FCM 30 minuti pre-kickoff e all'apertura della lobby
- Hash check SHA-256 dei file trasferiti via P2P (anti-corruption)

**MIGRATION.md** alla root del repo documenta il piano della Fase 2 per i quiz generators, le Cloud Functions, e l'estensione del modulo a futuri Concept C/D/E.

---

## 9. 🔄 Cleanup & Migrazioni Recenti

**Firebase v12 migration (Maggio 2026):** sostituzione di `enableIndexedDbPersistence(db)` deprecato con la nuova API `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Sostituzione transparent, nessun cambiamento API esposta. Console pulita dal warning di deprecation.

**Wake Lock feature-policy hardening:** wrappato `navigator.wakeLock.request()` in check `document.featurePolicy?.allowsFeature?.('screen-wake-lock')` per evitare warning in iframe (AI Studio preview, Stackblitz, embed di terze parti). Comportamento runtime invariato in PWA installata.

**TreasureHuntMap rendering pattern:** identificato e fixato bug Leaflet di tile flickering durante una caccia, dovuto a `flex-1` instabile + assenza di `invalidateSize()` su cambi layout (HUD, AR Layer, items dinamici, transizione status). Pattern stabile documentato in §4.5, applicato anche a future mappe.

---

*Fine documento. Per la specifica gameplay/design dell'esperienza giocatore vedi `GAMING_SYSTEM_IT.md`. Per il blueprint completo del modulo audio vedi `AINULINDALE_TECHNICAL_SPEC.md`. Per la matrice difensiva vedi `security_spec_IT.md`.*
