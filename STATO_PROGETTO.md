# Stato del Progetto marzio1777

> File di riepilogo master, scritto **2026-05-05**. Tiene traccia di tutte le
> fasi del progetto: cosa è stato fatto, **come** e **perché**, cosa resta da
> fare. Per i dettagli architetturali rimanere su `TECHNICAL_DOCS_IT.md`,
> `AINULINDALE_TECHNICAL_SPEC.md`, `GAMING_SYSTEM_IT.md`,
> `security_spec_IT.md`. `MIGRATION.md` resta come documento di transizione
> Fase 1 → 2/2.5 e va letto in coppia con questo file.

---

## Contesto

**marzio1777** è una PWA React 19 + Vite + TypeScript + Tailwind v4 +
Firebase per la community privata del paese di Marzio. Stack di principio:

- **Frontend**: SPA React 19 con `BrowserRouter` su basename
  `/marzio1777/` (deploy a `https://neo1777.github.io/marzio1777/`).
- **Stato persistente community**: Firestore (Auth Google + persistentLocalCache).
- **Audio personale**: IndexedDB locale (`marzio1777_audio`). I file audio
  **non escono** verso il cloud — il trasferimento DJ ↔ Listener è P2P
  WebRTC con Firestore solo come signaling.
- **Cloud Functions**: 7 attive su `marzio1777`/`europe-west1`/`nodejs22`,
  Firebase Blaze plan.
- **Filosofia**: zero nuove dipendenze npm senza discussione, backward
  compatibility prioritaria, rule changes sempre con test (52+ rule test
  + 63+ unit test), commit conventional in inglese.

---

## Fase 0 — Genesi (Aprile 2026 e precedenti)

Commit di base, feature individuali introdotte gradualmente:

- `5baf2c5` `feat: Enhance security and data privacy`
- `66249b1` `feat: Enhance user onboarding and security rules`
- `071d445` `feat(IlCinematografo): Add photo liking functionality`
- `3606c22` `feat: Enhance UI with Framer Motion animations`
- `e5af318` `feat(map): Add interactive decade and author filters`
- `ecf921c` `feat: Enhance post liking with toggle and customizable reactions`
- `2b3f014` `feat: Add game design document and tab`
- `86004b6` `feat: Implement game features and Firebase security rules`
- `ddeece0` `feat: Add and document gaming and audio modules`
- `c879e0f` `refactor(Istruzioni): Rename 'game' tab to 'readme'`
- `0ef7ca8` `feat: Integrate Leaflet map styles and user position hook`

**Cosa**: shell base con 11 sezioni in `/dashboard/*` (Piazza, Bivacco,
Baule, Mappa, Cinematografo, Giochi, Ainulindalë, Profilo, Admin,
Alberone, Istruzioni). Auth Google + ruoli `Root | Admin | Guest` con
stati `pending | approved`. Posts/comments/eventi/chat. Mappa Leaflet con
filtri decennio e autore. Cinematografo con quiz "indovina chi/anno".

**Perché**: costruire un'app di community internamente coerente prima di
introdurre i moduli "ambiziosi" (Giochi AR, Ainulindalë).

---

## Fase 1 — MVP completo (fino a Maggio 2026 - inizio batch B1)

Commit chiave: tutti quelli precedenti a `f4c14e4`.

**Cosa è stato consegnato**:

1. **Il Campo dei Giochi**: due tipi di evento sullo stesso doc
   `game_events` (`treasure_hunt` e `photo_quiz`), macchina a stati
   `draft → scheduled → lobby → active → completed/aborted`.
   - Treasure Hunt: spawn item geolocalizzato (`spawning.ts` con disk
     uniform sampling + min-separation), AR overlay (`ARCaptureLayer`),
     cattura via `runTransaction` per garantire un solo vincitore in
     caso di tap simultanei.
   - Photo Quiz: host rotativo, `currentHostId` validato dalla rule via
     `exists()+get()` sulla sub-collection participants, wizard 4-step
     `QuizHostCreateRound.tsx`, draft auto-saved in `localStorage`.
2. **L'Ainulindalë**: modulo audio con tre sotto-moduli — Biblioteca
   personale (IndexedDB), Sessione DJ, Sessione Listener. `AudioEngine`
   singleton con grafo Web Audio fisso (source → gain → eqLow 320Hz →
   eqMid 1kHz → eqHigh 3.2kHz → analyser fft128 → destination).
3. **WebRTC P2P**: chunk 16KB ordered + header JSON `{type:'meta',
   totalChunks, mimeType}`, timeout 15s con `resetTimeout` su ogni
   chunk, signaling come sub-collection `audio_sessions/{}/signaling/{}`.
4. **Sicurezza Zero-Trust**: 30+ rule in `firestore.rules` con primitive
   gating (`isSignedIn`, `isRoot`, `isAdminOrRoot`, `isApprovedUser`,
   helper event-scoped) + validatori `isValid*` per entità.

**Come**: tutto consolidato senza Cloud Functions, perché il piano Spark
gratuito non le permette. Le invarianti sicurezza-critiche delegate alla
rule + alla `runTransaction` lato client.

**Perché**: arrivare a un'app **funzionalmente completa** prima di
aggiungere il livello server-side. Stato MVP = "girabile end-to-end con
comunità ridotta, anti-cheat al 70%".

---

## Fase B1–B6 — Hardening audit (Maggio 2026)

Audit comprensivo di Maggio 2026 ha identificato **24 discrepanze** fra
spec/doc e codice. Tutte chiuse nei batch B1–B6. Riepilogo per macro-area:

### B1 (`f4c14e4` `fix(security): harden auth flow, queue rule and signaling rule`)
- **Cosa**: chiusura race auto-approvazione login (l'utente Google con
  email approvata veniva auto-approvato dalla rule, ma il client poteva
  scriverne `approved` da solo). `loginWithGoogle()` ora è thin wrapper
  su `signInWithPopup`; tutta la creazione del profilo è di proprietà
  esclusiva di `AuthContext.onAuthStateChanged`. Branch legacy
  ristretto a `createdAt < 2024-01-01`. Spostamento di `signaling/{}`
  da top-level a sub-collection `audio_sessions/{}/signaling/{}`.
  `enableIndexedDbPersistence` deprecato → `initializeFirestore({
  localCache: persistentLocalCache({ tabManager:
  persistentMultipleTabManager() }) })`.
- **Perché**: sporche storiche #18 (auto-approvazione race) e #30
  (signaling spammer top-level).

### B2 (`19e8d28` `refactor(audio): align engine, scoring and signaling with spec`)
- **Cosa**: `DJEngine.markCurrentPlayed` ora calcola `Math.round(2 ×
  eventMultiplier)` invece di hardcoded `pts=2`. `closeSession`
  accredita +5 base + (se `totalDurationMs > 30 min`) +10 long-session
  bonus, scalati × multiplier in batch atomico, con flag
  `djBonusAwarded` immutabile-a-true. AudioEngine `fftSize` da 256 →
  128 (allineato a TECHNICAL_DOCS_IT §4.13). DJEngine `currentTrackStartedAt`
  da `Date.now()` epoch a `serverTimestamp()` via dependency injection.
- **Perché**: il moltiplicatore eventi era documentato ma non applicato.
  Il bonus DJ era scrivibile ripetutamente (no flag immutabile).

### B3 (`7e5a023` `refactor(pwa): centralize Wake Lock and inline Leaflet markers`)
- **Cosa**: nuovo hook `useWakeLock(active: boolean)` con guard moderna
  `permissionsPolicy` + fallback `featurePolicy` + re-acquire automatico
  su `visibilitychange === 'visible'`. Sostituisce le tre call point
  ad-hoc (TreasureHuntPlay, useAudioPlayer, AudioSessionDJ). Leaflet
  marker icons da CDN esterni → `src/lib/leafletIcons.ts` (DivIcon SVG
  inline ~600 byte/marker, palette `blue|gold|green|crimson`).
- **Perché**: il Wake Lock falliva silenziosamente in iframe preview /
  dispositivi con feature-policy restrittiva. Le icone Leaflet da CDN
  facevano 404 in modalità PWA-installata offline.

### B4 (`d00f1b3` `refactor(rbac): centralize role checks via useRBAC; fix Post.location type`)
- **Cosa**: nuovo hook `useRBAC()` con flag derivati
  `isRoot/isAdmin/isGuest/isAdminOrRoot/isApproved/isPending`. ~40
  occorrenze migrate da `useAuth().profile.role === 'Root'` style.
  `Post.location` promosso da `string` a `PostLocation { lat, lng } |
  null`, rimosso `[key: string]: any`. Documenti tipi di Quiz allineati
  al runtime: `currentRound: number` (1-indexed) + child `quizRounds.{
  auto-id }.roundNumber: number`.
- **Perché**: i check di ruolo erano sparsi e lievemente divergenti tra
  componenti. `Post.location` come stringa libera apriva a XSS.

### B5 (`1226f25` `refactor(audio): rename /ainulindale/live route tree to /sessioni`)
- **Cosa**: rotte audio rinominate da `/ainulindale/live/*` a
  `/ainulindale/sessioni/*`. Niente di più — solo coerenza tra UI
  italiana e route paths.
- **Perché**: dissonanza UX (etichetta "Sessioni" ma URL `/live`).

### B6 (`1805236` `chore: prune dead deps, modernize UI primitives, add audio rule tests` + `c521360`)
- **Cosa**: rimozione `motion`, `express`, `@types/express`, `dotenv`,
  `autoprefixer`, vite duplicato, eslint 10.2.1; eslint upgradato a
  ^9.18.0; nuovo script `npm run lint:rules` per
  `@firebase/eslint-plugin-security-rules`. UI primitives riscritte
  (`Button` con varianti `default|secondary|ghost|destructive|outline|
  link` × `sm|default|lg|icon`, `Switch` ARIA-compliant `role="switch"
  aria-checked`, `Dialog` su portal con escape/click-outside,
  focus-visible rings ovunque). Nuovo `firestore.rules.audio.test.ts`
  con 11 test (Sporche #23/#24/#28/#30). 19 unit test giochi.
- **Perché**: 5 dipendenze duplicate o non usate. UI primitives erano
  inconsistenti a focus-management. Nessun test rule lato audio.

---

## Fase B7 — Post-audit hardening (Maggio 2026, `bd7cf36`)

Secondo audit ha aperto un batch B7 separato per gap NON coperti dai
B1–B6. Tutti chiusi qui:

1. **Cap `users.points` sottodimensionato**: la rule consentiva `+50/tx`
   ma con `pointsMultiplier ∈ [0.5, 5.0]` un treasure-hunt event
   legittimamente accredita 200+. Cap alzato a `+1000/tx`.
2. **Quiz scoring host-side respinto**: prima l'host scriveva
   `users/{altro}.points = increment(...)` per ogni risposta — la rule
   permette l'increment solo all'owner del doc. **Fix**: split in
   `revealRound` (host pubblica `correctIndex` + `revealedAt`) +
   `claimMyAnswerPoints` (ogni client claim per sé in transazione, con
   idempotency via `localStorage[marzio1777:quiz-claimed:{round}:{uid}]`).
3. **Sporche #25/#26 "Theme Hijacker"**: la rule `queue.update`
   permetteva al DJ di riscrivere `proposedBy/localTrackId/trackTitle/
   trackArtist/trackDurationMs`. Aggiunto check ridondante
   `incoming().proposedBy == existing().proposedBy` (e analoghi) come
   defense-in-depth, oltre a `affectedKeys().hasOnly([...])`. Cap
   `pointsAwarded ∈ [0, 50]` enforced.
4. **Cross-leaderboard write / cross-participant kick**: ownership-stretto
   su entrambe (`leaderboard.{uid}.write`: solo self/organizer/Root;
   `participants.{uid}.delete`: solo self/organizer/Root).
5. **Race `finalLeaderboard`**: `advanceGameEventStatus` per
   `active → completed` faceva due `getDoc` separati + un `updateDoc`
   non transazionale → due chiamate concorrenti potevano entrambe
   leggere `status: 'active'` e scrivere `finalLeaderboard` due volte.
   **Fix**: wrap in `runTransaction` con re-check di `status === 'active'`
   dentro la transazione.
6. **`AuthContext` profile listener leak**: l'unsubscribe veniva
   restituito da una callback `async` ma `useEffect` non aspetta
   promesse → il vecchio listener restava attivo dopo logout/login.
   **Fix**: `profileUnsubRef = useRef<Unsubscribe | null>(null)` con
   chiamata esplicita `profileUnsubRef.current?.()` su ogni transizione.
7. **Bug minori**: `webrtc.ts` `Date.now()` → `Timestamp.now()` per ICE
   candidates + `Timestamp.fromMillis(Date.now() + 60_000)` per
   `expireAt`. `scoring.ts` floor 1pt universale (era 0pt nel decay
   extreme). `vite.config.ts` PWA icons da CDN DiceBear → `public/icon.svg`
   inline (~400 byte M1777 monogram).

**Test aggiunti**: 6 nuovi describe block in `firestore.rules.test.ts`
(cap users.points 1000, answers.update self-claim, answers.update host-
triade, leaderboard ownership-stretto, participants.delete ownership,
finalLeaderboard immutability post-completed). Nuovo describe in
`firestore.rules.audio.test.ts` con 8 casi Theme Hijacker. 38/38 unit +
52/52 rule test verdi.

---

## Fase B8 — Audit gaps residui (Maggio 2026)

`8147d4d` `fix(b8): close audit gaps — avatars, webrtc, item cap, like forger, tests`
+ `3a834b0` `fix(audio): unbreak ainulindale rendering and library nav`

- **Avatar offline-safe**: nuovo componente `Avatar` in `src/components/ui/index.tsx`
  che renderizza `photoURL` con fallback iniziale-su-bg-colorato; sostituisce
  7 punti dove l'app usava DiceBear/picsum CDN che fallivano in PWA-installata.
- **WebRTC MIME/cap/cleanup**: validazione MIME audio, cap chunk, cleanup
  tracker timeout robusto.
- **`items.points` cap**: rule cap su `1 ≤ points ≤ 200`.
- **Sporca #31 "Like Forger"**: `posts.likedBy` ora deve contenere
  `auth.uid` quando si fa like, non un array arbitrario.
- **Token Tailwind v4 mancanti**: 18 token shadcn-style aggiunti al `@theme`
  di `src/index.css` (causavano "pagina nera apri sessione").
- **NavItem `/biblioteca` non matched**: corretto a `/dashboard/ainulindale`.

---

## Fase 2 — Cloud Functions, Quiz auto-gen, Gagliardetti, FCM (Maggio 2026)

Quando il piano Firebase è stato aggiornato a Blaze, la fase è partita.
Tutto deployato su `marzio1777` / `europe-west1` / `nodejs22`.

### Quiz auto-generators (`638fb6a`)
- **Cosa**: 4/5 generators implementati in `src/utils/quizGenerators.ts`
  con seeded RNG `mulberry32` per determinismo. Tipi:
  `guess_author`, `guess_year`, `guess_decade`, `count_likes`. Tutti
  ritornano `Promise<GeneratedQuestion | null>`.
- **Come**: l'host quiz nel wizard può cliccare "Genera automaticamente"
  e il sistema produce 4 distrattori plausibili + 1 corretta basandosi
  su `posts` filtrati per autore/anno/likes count.
- **Perché**: pre-Fase 2 il wizard era solo manuale, ogni round
  richiedeva ~2 minuti di compilazione. Auto-gen = round in 5 secondi.

### Gagliardetti — catalogo da metriche snapshot (`eecd888`)
- **Cosa**: 13 gagliardetti calcolati da metriche `users.{uid}.metrics.*`
  via collection-group queries cached 1h (`useUserGagliardetti.ts`).
  Esempi: Custode dell'Archivio (50 post), Cuore di Marzio (top likes
  ricevuti in un mese), Geometra (50 cattura treasure-hunt), Maestro
  del Bivacco (10 quiz vinti).
- **Come**: ogni gagliardetto ha una `condition()` su `metrics`. La
  pagina ProfiloPersonale mostra solo quelli ottenuti + progresso sui
  prossimi.
- **Perché**: pre-Fase 2 esistevano solo 3 badge semplici (Villeggiante /
  Custode / Sindaco) hardcoded sulle altitudini.

### Cloud Functions hardening (`34b0ab1`)
**7 CF live + 2 skeleton Phase 3**:

1. `validateCaptureDistance` (callable) — Haversine server-side, chiude
   Sporca #14 "The Teleporter". Wired in `useGameEvents.captureItemTransaction`
   con fallback graceful "CF non deployata → legacy fast-path".
2. `enforceQueuePerUserLimit` (callable) — count effettivo doc attivi,
   chiude residuo Sporca #24. Wired in `useAudioQueue.proposeTrack` e
   nel nuovo `proposeTrackToSession` standalone.
3. `notifyKickoff` (cron 5 min) — FCM Web Push 30 min pre-kickoff +
   lobby open. Idempotency via flag `game_events.{id}.notifications.{
   kickoff30Notified, lobbyNotified }`. Prune token invalidi via
   `arrayRemove`.
4. `cleanupOrphanSignaling` (cron 5 min) — `signaling.expireAt < now()`.
5. `cleanupStuckEvents` (cron daily 04:00 Rome).
6. `cleanupOrphanSessions` (cron daily 04:15 Rome).
7. `auditMassSkip` (Firestore onUpdate, skeleton — TODO Fase 3).
8. `validateP2PTransferIntegrity` (callable skeleton — Fase 3, richiede
   campo `blobSha256` sulla `QueueItem`).

### FCM Web Push (`9e71631` + workflow + VAPID hardcoded `df45f3f`)
- **Cosa**: notifiche push browser per kickoff giochi. Service worker
  dedicato `public/firebase-messaging-sw.js`. Hook `useFCM` gestisce
  permission + getToken + persistenza su `users.{uid}.fcmTokens[]` (cap
  20). UI opt-in/opt-out in ProfiloPersonale con toggle Bell/BellOff.
- **Come**: VAPID **public** key hardcoded in `src/hooks/useFCM.ts`
  (commit `df45f3f`). La private key resta sui server FCM.
- **Perché incidente VAPID**: 3 deploy consecutivi avevano lasciato il
  bundle byte-identico nonostante il secret fosse settato in GitHub
  Secrets. Causa: trailing newline non visibile nel valore secret →
  l'heredoc nel workflow scriveva la chiave su 2 righe → Vite parser
  legge empty string. Workaround pragmatico: hardcode (la public key è
  visibile in ogni client comunque).

---

## Fase 2.5 — Continuous-tracking + reverse-geocoding (Maggio 2026)

- **`guess_place` reverse-geocoding** (`03e7cac`): 5° quiz generator.
  Nominatim free tier + cache `places_cache/{geoKey}` (geoKey = lat/lng
  arrotondati a 4 decimali). Helper in `src/lib/reverseGeocode.ts`.
  Tutti i generators ora con signature `Promise<GeneratedQuestion | null>`.
- **3/4 gagliardetti continuous-tracking** (`aba445a`): Veggente del
  Bivacco (`metrics.quizStreak` aggiornato in `claimMyAnswerPoints`),
  Pellegrino delle Polaroid (`metrics.huntsLegacyCompleted` su transizione
  `active → completed`), Discordante (`metrics.consecutiveSkipped`
  aggiornato in `useAudioQueue` su transizioni `queued|transferring|
  ready → skipped`).
- **L'Ospite Perfetto**: 4° gagliardetto continuous-tracking. **Resta in
  Phase 3**: richiede heartbeat host CF per validare 10 sessioni
  consecutive senza disconnessioni.

---

## Sessione di stabilizzazione UX e bug critici (2026-05-04)

Round di debugging dopo che l'utente ha iniziato a usare l'app live. Una
catena di bug interconnessi, tutti chiusi. **15 commit consecutivi** in
~3 ore di lavoro:

### Crash UX (la React tree intera evapora)

**`414bb91` `fix(ui): add global ErrorBoundary, harden audio play and AR map render`**
- **Cosa**: nuovo `src/components/ErrorBoundary.tsx` come class component
  con `getDerivedStateFromError` + `componentDidCatch` + fallback con
  CTA "Torna alla Piazza" / "Ricarica l'app". Wrap di `<Suspense>`
  dentro `<ErrorBoundary>` in `App.tsx`. Hardening
  `event.pointsMultiplier ?? 1` in `TreasureHuntPlay`. Reset state in
  catch di `useAudioPlayer.playTrack`. Guard `if (!blob)` in
  `audioEngine.load`.
- **Perché**: senza ErrorBoundary, qualsiasi throw di render dentro
  `<Outlet />` smontava tutta la tree; l'utente vedeva schermo nero.
  `<Suspense>` cattura solo le promise di chunk-fetch lazy, non i
  runtime error.

**`d6ed3e7` `fix(audio): close coro creation gap, dismissable player, legacy session crash`**
- **Cosa**: 3 fix in un colpo. (a) X rossa sul MiniPlayer + X
  nell'header del FullScreenPlayer per fermare e chiudere player
  (`useAudioPlayer.stop()` clear track/queue/MediaSession). (b) Alert
  visibile nel catch di `AudioSessionCreate.handleCreate` invece del
  silenzioso `console.error`. (c) Guard `(session.mode ?? 'auto').
  toUpperCase()` in `AudioSessionDJ:184` + fallback in
  `getMaxQueuedFor(rules?)` per rules undefined su sessioni legacy.

**`a8174e5` `fix(audio): split coro creation batch so participant.create sees the session`**
- **Cosa**: il `writeBatch` in `AudioSessionCreate` era atomico:
  scriveva session + participants in un colpo. Ma la rule del
  participant (firestore.rules:577) richiede
  `get(audio_sessions/{id}).data.status == 'open'` — e dentro il batch
  quel `get` valuta lo snapshot pre-batch dove il session non esiste
  ancora. Splittato in due `setDoc` sequenziali (prima session, poi
  participant).
- **Perché**: la creazione coro andava in errore "Missing or
  insufficient permissions" — l'utente vedeva il pulsante "Apri il Coro"
  inert.

**`d33929f` `fix(audio): hoist DJ activeQueue useMemo above early returns (React #310)`**
- **Cosa**: in `AudioSessionDJ.tsx` il `useMemo` di `activeQueue` era
  alla riga 175, **dopo tre early-return condizionali**. React tracks
  hooks per call order: render 1 con `loading=true` esce prima del
  useMemo (N hooks), render 2 con `loading=false` ci arriva (N+1
  hooks) → React error #310. Spostato il useMemo sopra le guard.
- **Perché**: cliccare su una sessione esistente faceva apparire
  "Qualcosa è andato storto" nell'ErrorBoundary. Era IL crash che
  l'ErrorBoundary catturava — il fix `mode.toUpperCase` precedente non
  era la root cause.

**`d8433a8` `fix(spa): emit dist/404.html so GitHub Pages serves the SPA on deep links`**
- **Cosa**: post-build copia `dist/index.html` in `dist/404.html`.
- **Perché**: hard-refresh su `/dashboard/piazza` su GitHub Pages
  restituiva 404 statico — il server non sa che le rotte sono SPA
  client-side. Pattern standard SPA-on-Pages: 404.html identico a
  index.html → GitHub risponde codice 404 ma il body è l'app, che
  client-side risolve la URL.

### Feature deliberatamente attivate

**`159375b` `feat(root): delete buttons on session and game-event cards for test cleanup`**
- **Cosa**: bottone delete (icona Trash2) su `SessionCard` e
  `GameEventCard`, visibile solo per Root, conferma via
  `window.confirm`. Sul GameEventCard il bottone si **disabilita
  automaticamente** quando `event.status === 'active'` (mirror del
  vincolo della rule firestore.rules:309).
- **Perché**: l'utente Root voleva pulire i test data senza dover
  passare dalla Console Firebase. Le rule `audio_sessions.delete` e
  `game_events.delete` permettevano già `isRoot()`.
- **Caveat**: cancellare il top-level non cancella le sub-collection
  (queue/participants/signaling per sessioni; items/participants/
  leaderboard/quizRounds/answers per game_events). Le pulisce la CF
  cron `cleanupOrphanSessions` daily 04:15 Rome.

**`876dd92` `feat(audio): enable "add to session queue" from FullScreenPlayer`**
- **Cosa**: bottone `ListPlus` nell'header del FullScreenPlayer (era
  pinned su "Disponibile in fase 2") ora apre `AddToSessionModal`. Il
  modal lista sessioni aperte via `useAudioSessionsList` e su click
  chiama la nuova funzione standalone `proposeTrackToSession` esportata
  da `useAudioQueue.ts`. Quella funzione riproduce la logica di
  `proposeTrack` ma legge la queue via `getDocs` one-shot invece di
  subscribire — così è chiamabile da surface non-scoped a una sessione.
- **Perché**: la Fase 2 aveva chiuso il setup CF/rules ma il bottone
  era rimasto disabilitato per dimenticanza.

**`ef99c37` `feat(audio): enable "Aggiungi a un Coro" from the library track menu`**
- **Cosa**: stessa cosa di `876dd92` ma applicata al menu tre-puntini di
  `TrackCard` nella Biblioteca. Voce "Aggiungi a Playlist" rinominata
  in "Aggiungi a un Coro" e abilitata. La voce "Modifica Tag" resta
  disabilitata con tooltip "Disponibile in fase 3".

### Audit a tappeto pattern simili

**`babad1a` `fix(ux): surface silent firestore failures and harden DJ avatar fallback`**
- **Cosa**: pass sistematico per i pattern già emersi (catch silenzioso
  user-initiated). 6 hit confermati, tutti fixati con `alert(err.message)`:
  - `IlCinematografo.handleGuess` (+5/-2 punti) + `handleLike`
  - `LAlberone.handleSend` chat
  - `LaPiazza.handlePost` commenti
  - `EventDetailModal.addItem` + `toggleAssign` + `addExpense`
  - Bonus: `<img src={session.djPhotoURL}>` in SessionCard sostituito
    con il componente `Avatar` offline-safe.
- **Perché**: stesso anti-pattern di "Apri il Coro feels inert" — un
  catch che logga e basta lascia l'utente senza feedback su cosa sia
  fallito (es. una rule denial).

**`9d54e1a` `fix(audio): make EQ and background-playback controls discoverable`**
- **Cosa**: i controlli Equalizzatore e Background-playback erano
  implementati ma resi come icone 18px slate-500 senza label nell'angolo
  del FullScreenPlayer — l'utente ragionevolmente concludeva "i doc
  parlano di un EQ ma non lo vedo". Sostituiti con pill-chip etichettati
  ("EQ", "Sfondo") con border attiva, header sopra il pannello che
  nomina la sezione corrente ("Spettro" / "Equalizzatore (±12 dB)"),
  title= e aria-label= ovunque.
- **Perché**: scopribilità feature.

---

## Fase 3 — Da fare

Stato di Maggio 2026: tutto MVP + Fase 2 + Fase 2.5 al 75% chiuso. Resta:

### Audio (Ainulindalë)

- **Crossfade fra tracce** (~80 LOC): documentato nel
  `AINULINDALE_TECHNICAL_SPEC.md` §815-826. Richiede 2 `AudioEngine` in
  parallelo con due `GainNode` invertiti + slider durata fade. Il MVP
  attuale è gapless (zero pausa fra tracce), sufficiente per uso
  normale.
- **Playlist locali** (~200 LOC): l'object store `playlists` esiste in
  `indexedDB.ts` (`addPlaylist`/`getPlaylists` skeleton), ma manca la
  UI di creazione/editing/play. Voce "Modifica Tag" + "Aggiungi a
  Playlist" attualmente disabilitate nel menu TrackCard.
- **Editing ID3 tag** post-import: utente può rinominare title/artist/
  album/year. Nessuna UI attualmente.
- **`validateP2PTransferIntegrity`**: skeleton CF deployata, ritorna
  `unimplemented`. Per attivarla serve: (a) campo `blobSha256` sulla
  `QueueItem` calcolato dal proposer al chunk-0, (b) il DJ ricalcola
  l'hash sul blob completo e chiama la CF, (c) la CF verifica match e
  scrive `transferIntegrityVerified: true` o respinge il transfer.

### Giochi

- **L'Ospite Perfetto** (4° gagliardetto continuous-tracking): 10
  sessioni Host audio consecutive senza disconnessioni. Richiede una
  heartbeat CF dedicata che marchia `users.{uid}.metrics.hostStreak`
  quando una sessione chiude `gracefully`.
- **`auditMassSkip`** (skeleton CF): rilevare un host Quiz che skippa
  >5 round consecutivi senza partecipanti che rispondano (Sporca #19
  "Round Skipper"). Skeleton deployata, body da scrivere.
- **Concept C/D/E**: spec parla di altri 3 tipi di game event oltre a
  treasure_hunt e photo_quiz. Al momento solo i primi due implementati.
  Vedi `GAMING_SYSTEM_IT.md` §10.2-10.4 per i blueprint.

### Sicurezza / Rule

- Spostare il check di `effectiveMaxAtCreate` da rule client a CF
  callable dedicata, così gli aggiornamenti alla formula bonus non
  richiedono un nuovo deploy delle rule.
- `cleanupOrphanGameEvents` CF — al momento le sub-collection (items/
  participants/...) di un game_event cancellato restano orfane finché
  un cron generico non le aggancia. Una CF cleanup specifica
  ridurrebbe la finestra.

### UX / Discoverability

- **Toast system globale**: i bug fix recenti hanno aggiunto `alert()`
  ovunque per surface gli errori utente-iniziati. Un toast
  semi-ephemeral con queue + dismiss button sarebbe più moderno e meno
  bloccante. ~150 LOC con `framer-motion`.
- **Sidebar collapse** desktop: utenti su desktop con schermo medio
  vorrebbero collassare la sidebar laterale. Documentato come "non
  implementato" nell'AUDIT_REPORT §17.B linea 849.

### Igiene / Operational

- **Revoca il PAT GitHub** usato in questa sessione per i push
  automatici Claude Code → GitHub. Va revocato da Settings →
  Developer settings → Personal access tokens. Una volta revocato,
  generarne uno nuovo se servirà per le sessioni future.
- **Rimozione opzionale del secret `VITE_FIREBASE_VAPID_KEY`** dai
  GitHub Secrets, dato che la VAPID public key è ora hardcoded
  (`df45f3f`) e il secret è dead code.
- **Test FCM end-to-end** con l'utente reale: toggle Notifiche +
  creazione evento `scheduled` con kickoff +30 min + verifica push
  arrivata.
- **Deep-delete CF callable** Root-only per pulizia completa di un
  audio_session o game_event (top-level + tutte le sub-collection in
  un colpo). Non urgente, ~30 LOC in `functions/` + nuovo path rule.

### Documentazione

- Aggiornare README inglese sui controlli EQ/Sfondo nominati nelle
  release notes.
- Aggiornare `AUDIT_REPORT.md` per riflettere i 15 commit di questa
  sessione (è gitignored quindi solo locale).
- Aggiornare `CLAUDE.md` (gitignored) con la timeline dei nuovi
  commit per le future sessioni Claude Code.

---

## Stato live (snapshot 2026-05-05)

- **Sito**: `https://neo1777.github.io/marzio1777/`
- **Branch live**: `origin/main` allineato con local `main` su SHA
  `9d54e1a`.
- **Cloud Functions live**: 7 + 2 skeleton su `marzio1777`/
  `europe-west1`/`nodejs22`.
- **Test**: 63/63 unit pass, 52/52 rule pass, build pulito.
- **Bundle size**: ~862 KB gz 226 KB per main bundle, lazy chunks da
  ~17 KB (GameCreator) a ~440 KB (Istruzioni — markdown rendering).
- **Deploy automatico**: GitHub Actions su push a `main`, ~45-50s
  end-to-end fino a Pages live.
- **Auto-update PWA**: silent quando tab nascosto + pill manuale +
  toast verde post-reload (commit `e50724f` + `cf4353c`).

---

## Convenzioni di lavoro (riferimento)

- **Niente push automatici**: i commit si revisionano insieme; il push
  lo fa l'utente o Claude Code se esplicitamente richiesto.
- **Commit conventional in inglese**: `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`. Footer `Co-Authored-By: Claude Opus
  4.7 (1M context) <noreply@anthropic.com>` sui commit Claude.
- **Zero new dependencies** senza discussione.
- **Backward compatibility prioritaria** sugli schemi Firestore: campi
  nuovi sono `field?: T | null`, niente breaking change.
- **Rule changes sempre con test**: `firestore.rules.test.ts` o
  `firestore.rules.audio.test.ts`, runner `@firebase/rules-unit-testing`
  + `node:test` + `tsx` su emulator (richiede JDK 21+).
- **Chiedi prima di scrivere codice**: ambiguità → domanda mirata, non
  assunzioni mascherate da soluzioni.
