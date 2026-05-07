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

## Sessione UX 2026-05-06 — scrollbar, salvataggio caccia, avatar autore, alert opachi

L'utente segnala una raffica di difetti UX rendering + un blocker
funzionale sul flusso di creazione caccia AR. L'audit ha trovato
quattordici bug distinti riconducibili a quattro pattern. Tutti chiusi
in un solo passaggio.

### #1 — Scrollbar nera/grossa su tema scuro

**Sintomo**: i container che dovrebbero scrollare senza barra (sidebar,
liste, filtri swipeable) mostrano comunque la scrollbar di sistema, che
nel tema notte appare come una grossa barra grigia chiara fuori
palette. La classe `.scrollbar-hide` era usata in 9 file (`Layout.tsx`,
`LaPiazza.tsx`, `IlBaule.tsx`, `IlBivacco.tsx`, `LAlberone.tsx`,
`IlCampoDeiGiochi.tsx`, `ProfiloPersonale.tsx`, `AdminPanel.tsx`) ma
**non era definita da nessuna parte** — niente plugin
`tailwind-scrollbar-hide` in `package.json`, niente utility custom in
`src/index.css`. Era una classe morta.

**Fix**: aggiunta in `src/index.css` come utility `@layer utilities`
con `scrollbar-width: none` (Firefox) + `::-webkit-scrollbar { display:
none }`. In più, restyle globale slim+dark-friendly per le scrollbar
che restano (form lunghi, Istruzioni): track trasparente, thumb 6px
oro/verde su scuro / grigio su chiaro, hover lievemente più saturo.
Zero deps nuove, ~30 LOC.

### #2 — Salvataggio caccia AR fallisce silenziosamente

**Sintomo**: dopo aver compilato titolo/descrizione/data e piazzato i
punti sulla mappa, premendo "Salva" appare "Errore durante la
creazione" — nessuna informazione sulla causa reale.

**Diagnosi**: `GameCreator.handleSave` aveva `alert("Errore durante la
creazione")` come catch-all. Confrontando il payload con
`firestore.rules:282-291`, tre potenziali PERMISSION_DENIED erano
mascherati: `scheduledKickoff > request.time` (kickoff già passato
quando si clicca Salva), `pointsMultiplier` NaN se input vuoto, e
`points is int` su payload float-like.

**Fix in 4 punti** (`src/pages/GameCreator.tsx` +
`src/hooks/useGameEvents.ts`):

- Validazione client pre-call: kickoff > now+30s, multiplier clampato
  a [0.5, 5.0].
- Surface err.message: il catch-all del salvataggio mostra ora
  `error?.message`.
- `createGameItem` con `Math.floor(points)` + `spawnedAt:
  serverTimestamp()`.
- `handleGenerateLegacy` con err.message.

### #3 — Avatar dell'autore sparito dai post nella Piazza

**Diagnosi**: tre punti rotti in cascata. `Post` interface senza
`authorPhotoURL`; `IlBaule.handleUpload` e
`IlBivacco.CreateEventModal` non salvavano `user.photoURL`;
`LaPiazza:214` non passava `photoURL` all'Avatar (Avatar degrada
correttamente al fallback iniziale → fallback visibile sempre).

**Fix**: `Post.authorPhotoURL?: string | null` opzionale
(backward-compat post legacy), salvato in IlBaule e IlBivacco, letto
in LaPiazza.

### #4 — Race condition punti + alert opachi sparsi

**Fix**:

- `IlBivacco.tsx`: `(user.points || 0) + 5` → `increment(5)` (Firestore
  atomic). La rule `incoming().points >= existing().points` avrebbe
  potuto respingere il read-modify-write con valore locale stantio.
- 7 alert silenziosi in `EventDetailModal`, `PhotoQuizPlay`,
  `IlBaule` (×4), `AdminPanel` (×2): tutti surfaceano ora
  `err.message`.

### File toccati

`src/index.css`, `src/types.ts`, `src/pages/GameCreator.tsx`,
`src/hooks/useGameEvents.ts`, `src/pages/IlBaule.tsx`,
`src/pages/IlBivacco.tsx`, `src/pages/LaPiazza.tsx`,
`src/pages/PhotoQuizPlay.tsx`, `src/pages/AdminPanel.tsx`,
`src/components/EventDetailModal.tsx`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` 11.48s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 2) — flusso gioco AR end-to-end

L'utente segnala che premendo "Salva" sulla mappa di placement degli
items appare "Compila tutti i campi base" anche se in quella schermata
non ci sono campi visibili. Chiede inoltre verifica completa del
gioco AR (processo, GPS, cattura). Audit comprensivo eseguito da agent
Explore + lettura diretta di `GameCreator`, `TreasureHuntPlay`,
`GameLobby`, `useHighAccuracyPosition`, `useNearestItem`,
`PermissionsGate`, `useGameEvents.setRSVP`, `lib/geoUtils`.

### #1 — Wizard creazione caccia: validazione step 1 → 2 mancante

Il pulsante "Avanti: Posiziona Elementi" (step 1 di GameCreator) faceva
solo `setStep(2)` senza validare titolo/descrizione/data. Cliccandolo
con i campi vuoti si arrivava allo step 2 (mappa di placement), e solo
dopo aver piazzato gli oggetti il "Salva" mostrava "Compila tutti i
campi base" su una schermata che — appunto — non mostrava più quei
campi.

**Fix in `src/pages/GameCreator.tsx`**:
- Validazione esplicita nel click handler dell'Avanti: alert con la
  lista dei campi mancanti, no `setStep(2)`.
- Pulsante Avanti **disabled** se i base fields mancano + hint
  testuale ambra sopra ("Compila titolo, descrizione e data prima di
  posizionare gli elementi").
- Anche il pulsante Crea Quiz (path photo_quiz) ora rispetta lo
  stesso vincolo.
- **Guardia di rispetto contratto** nello step 2: se per qualunque
  motivo si renderizza con i base fields vuoti (refresh, ritorno da
  history, link diretto), mostra una pagina dedicata con CTA "Torna
  ai Dettagli Evento" invece di lasciar partire `handleSave`.
- Il pulsante "Salva" del placement è ora disabled se `items.length
  === 0` — UX coerente col check già presente lato handler.

### #2 — Range guards su `radius` e `autoCount`

`<input type="number" value={radius}>` accettava 0 o negativi. Combinato
con `generateUniformPointsInRadius(radius=0, ...)`, il loop interno con
`minSeparationMeters=8` collassava su candidati identici al centro e
girava fino a `maxAttempts` senza generare nulla.

**Fix in `src/pages/GameCreator.tsx`**:
- `autoCount` clampato a `[1, 100]`.
- `radius` clampato a `[10, 5000]` metri.

**Fix in `src/lib/geoUtils.ts`**:
- Early return `[]` per `count<=0 || radiusMeters<=0` (difesa lato
  generatore — il clamp UI è solo la prima linea).
- Clamp del `cos(centerLat)` a `>=0.01` per evitare divisioni quasi-zero
  vicino ai poli (irrilevante per Marzio a ~46°, ma rende la funzione
  riutilizzabile altrove).

### #3 — TreasureHuntPlay: GPS denied non guidato + accuracy non visibile

Se l'utente nega la permission GPS (o il device non ha GPS), la
mappa mostrava perpetuamente "Ricerca Satellite..." senza alcun
suggerimento su come uscire dal loop. Inoltre l'accuracy del GPS (nota
fragile su desktop, può sfiorare i 50-100m) non era mostrata da nessuna
parte — l'utente non aveva modo di sapere se la cattura sarebbe stata
attendibile.

**Fix in `src/pages/TreasureHuntPlay.tsx`**:
- Letto anche l'`error` dal hook `useHighAccuracyPosition`.
- Quando `position === null && gpsError`: schermata dedicata con
  l'errore reale, istruzioni e bottone "Ricarica" (CTA esplicita
  invece del loop).
- HUD radar: aggiunto badge "GPS ±N m" colorato (verde ≤20m, ambra
  ≤50m, rosso >50m). Sempre visibile durante il gioco.

**Bonus**: l'`if (dist > 15 && process.env.NODE_ENV !== 'development')`
non funzionava in Vite (Vite non popola `process.env.NODE_ENV` se non
glielo dici). Cambiato a `import.meta.env.DEV` con commento esplicito.

### #4 — Lobby: avatar partecipanti placeholder + nomi "Giocatore"

`GameLobby.tsx` mostrava ogni partecipante come un'icona SVG generica
+ il testo "Giocatore" (o "Tu" per sé stessi). Causa root: `setRSVP`
non salvava `displayName` né `photoURL` quando creava il doc
`participants/{uid}`, quindi il client non aveva mai i dati identità
disponibili.

**Fix in `src/hooks/useGameEvents.ts`**:
- `setRSVP` accetta ora un parametro opzionale `identity:
  {displayName, photoURL}` e li scrive **solo nel ramo create** (la
  rule `participants.update` restringe il diff a status/respondedAt/
  shareLocationDuringEvent/leftAt — gli identity field sono
  immutable post-create per design).

**Fix in `src/components/GameEventCard.tsx`**:
- Le 4 chiamate a `setRSVP` (Partecipo / Passo / Cambia idea /
  Partecipa-da-declined) passano ora `profile.displayName` e
  `profile.photoURL`.

**Fix in `src/pages/GameLobby.tsx`**:
- Render dei partecipanti riusa il componente `<Avatar>` standard
  con `photoURL={p.photoURL}` + `name={p.displayName}`. Fallback
  graceful se uno dei due è null.
- Live leaderboard e final leaderboard mostrano `p.displayName`
  invece del fisso "Giocatore".

### File toccati

`src/pages/GameCreator.tsx`, `src/pages/TreasureHuntPlay.tsx`,
`src/pages/GameLobby.tsx`, `src/components/GameEventCard.tsx`,
`src/hooks/useGameEvents.ts`, `src/lib/geoUtils.ts`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` 11.58s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 3) — wizard pronto-all'uso

Dopo il deploy del round 2 l'utente ha verificato che la mappa salva
correttamente, e ha chiesto tre miglioramenti UX al wizard di
creazione caccia: data di default già impostata, mappa centrata sulla
sua posizione anche su desktop dove il GPS è lento, e una ricerca per
città/indirizzo non invasiva. Plus: lentezza percepita nel raggiungere
la pagina di gioco al primo tentativo.

### #1 — Default `kickoff` = ora + 10 min

Il campo `<input type="datetime-local">` partiva vuoto e l'utente
doveva sempre digitare data + ora a mano. Pre-popolato a "ora locale +
10 minuti", che è il minimo che soddisfa con margine il guard
client-side (`kickoff > now+30s`) e la rule (`scheduledKickoff >
request.time`). Helper dedicato `defaultKickoffLocal()` perché
`Date.toISOString()` ritorna UTC e l'input vuole local time
`YYYY-MM-DDTHH:mm`. Se l'utente vuole spostarla, modifica
liberamente il campo come prima.

### #2 — GPS veloce + centro mappa default su Marzio

Due problemi combinati:

- `useHighAccuracyPosition` chiamava solo `watchPosition` con
  `enableHighAccuracy: true, maximumAge: 0`. Su desktop questa
  configurazione può tardare 5-10s prima di emettere la prima callback
  (Wi-Fi triangulation iniziale lenta), e nel frattempo `userPosition
  === null`. Rifatto: una `getCurrentPosition` one-shot in parallelo
  al `watchPosition`, così il primo fix arriva in 1-2s. Inoltre l'hook
  ora accetta un secondo parametro `highAccuracy` (default `true` per
  non rompere i caller esistenti); GameCreator lo passa a `false` —
  la modalità coarse + `maximumAge: 60s` permette al browser di
  servire una posizione fresca da cache invece di re-triangolare ogni
  volta. Per TreasureHuntPlay (gameplay attivo) resta `true` perché
  lì il radius di cattura è 15m e l'accuracy conta.
- Il `[center]` iniziale era `[41.9028, 12.4964]` (Roma). All'arrivo
  del primo fix la mappa "saltava" dalla capitale a Marzio, con re-pan
  visibile. Cambiato il fallback a `[45.9238, 8.8655]` (Marzio) — già
  usato come default in IlBaule per coerenza.

Aggiunto `hasUserCentered` come flag: una volta che l'utente ha
spostato il centro intenzionalmente (tap sulla mappa con "imposta
centro", click su un risultato della ricerca città, click su "centra
su di me"), il useEffect smette di sovrascrivere il centro con gli
update GPS successivi. Prima del flag, ogni nuovo callback GPS poteva
strappare via il centro che l'utente aveva appena selezionato.

### #3 — Pulsante "Centra su di me" affidabile + indicator

Il pulsante Compass nell'overlay sinistro chiamava
`if(userPosition) setCenter(...)`. Se cliccato prima del fix GPS non
faceva niente, senza feedback. Ora il pulsante usa l'icona
`LocateFixed` (più chiara), è esplicitamente `disabled` quando
`userPosition === null`, e ha tooltip + `aria-label` ("Centra su di
me" / "GPS non ancora disponibile"). Il pulsante "Imposta centro
mappa" (tap-to-place) ha analogamente tooltip e aria-label.

Aggiunto un terzo stato alla pill di status in alto al centro: se
`userPosition === null` mostra "Recupero posizione GPS..." con
spinner, così l'utente capisce perché il pulsante "centra su di me"
è disabled e che la ricerca è in corso.

### #4 — Ricerca per città/indirizzo non invasiva

Aggiunto un solo nuovo pulsante (icona `Search`) nella top bar dello
step 2, allineato a "Indietro"/"Salva". Click → modal centrato a
schermo (overlay scuro, click-outside chiude, Escape chiude via
nativo `<button>`) con un campo di testo, bottone "Cerca", e lista
risultati. Backend: `nominatim.openstreetmap.org/search?format=json`
con header `Accept-Language: it`, `limit=5` — esattamente il pattern
già usato da IlBaule per il geotag delle foto, zero deps nuove. Click
su un risultato → `setCenter` immediato + `hasUserCentered = true` +
chiusura modal.

UX deliberatamente minima per rispettare il vincolo "la pagina è già
piena di tasti": un solo pulsante in più nella top bar, niente
dropdown live-search sopra la mappa, niente overlay flottanti. La
modal vive su `z-[1100]` quindi galleggia sopra tutto incluso il pin
"in setting" della mappa.

### #5 — Lentezza percepita al primo accesso al gioco

L'utente ha riferito di aver dovuto ricaricare più volte per
arrivare alla pagina in gioco. Cause più probabili:
- chunk lazy-loaded del routing → primo paint richiede fetch di
  `GamePlayRouter` + `useGameEvents` + chunk Leaflet (~150 KB
  combinato);
- watchPosition lento su desktop (vedi #2);
- service worker che serve cache stale dopo il deploy nuovo, finché
  non arriva il pill "Aggiorna app" o l'auto-refresh visibility.

Mitigato in questa sessione il punto GPS (#2). Per la cache, il flusso
auto-update PWA esistente (commit `e50724f`) di solito copre il caso
ma può richiedere un primo hard reload per scaricare il nuovo bundle.
Non aggiungiamo prefetch aggressivo dei chunk gioco in questo round —
sarebbe un cambiamento più strutturale; se la lentezza persiste anche
sui prossimi accessi (cache calda, GPS rapido), apriamo un round
dedicato.

### File toccati

`src/pages/GameCreator.tsx`, `src/hooks/useHighAccuracyPosition.ts`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` 11.41s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 4) — GPS timeout tollerante

L'utente sul deploy del round 3 vede sulla pagina di gioco AR:
"GPS non disponibile / Timeout expired / Abilita la geolocalizzazione...".
Il messaggio è quello che ho aggiunto al round 2, ma scattava troppo
presto: il `watchPosition` con timeout 10s ha emesso un TIMEOUT prima
che il browser desktop riuscisse a triangolare via Wi-Fi, e la mia UI
trattava qualunque errore come fatale.

### #1 — Distinguere errore permesso da errore transitorio

L'API W3C Geolocation ha tre codici:
1. `PERMISSION_DENIED` — l'utente ha negato e il browser non riproverà.
2. `POSITION_UNAVAILABLE` — il device non riesce a determinare la
   posizione (no GPS, network down).
3. `TIMEOUT` — il fix non è arrivato in tempo, ma `watchPosition`
   continua a tentare.

Solo (1) è davvero fatale. (2) e (3) sono spesso transitori su desktop
con triangolazione Wi-Fi/IP.

**Fix in `src/hooks/useHighAccuracyPosition.ts`**:
- L'hook ora restituisce `error: { code, message } | null` invece di
  `string | null`. Espone il codice così i caller possono decidere
  cosa fare (interface `GeoError` esportata).
- Timeout del `watchPosition` portato da 10s a **30s** (i desktop
  routinamente impiegano 10-20s per il primo fix). Timeout della
  one-shot `getCurrentPosition` da 8s a **15s**.

### #2 — Schermata d'errore solo dopo 20s sui transitori

**Fix in `src/pages/TreasureHuntPlay.tsx`**:
- Aggiunto `showGpsError` con `useEffect` dipendente da `gpsError`:
  - Se `gpsError.code === 1` (PERMISSION_DENIED) → mostra errore
    immediatamente.
  - Altrimenti (TIMEOUT/UNAVAILABLE) → aspetta 20s prima di renderlo.
    Se nel frattempo arriva una posizione, `setError(null)` viene
    chiamato dall'hook e l'effect cancella il timer.
- Spinner della schermata "Ricerca Satellite..." ora ha un sottotitolo
  esplicito: "Sui desktop senza GPS può richiedere fino a mezzo
  minuto" — così l'utente non pensa che sia bloccato.

### #3 — Fallback "Continua senza GPS" con centro evento

Anche se il GPS davvero non funziona, l'utente desktop dovrebbe poter
*vedere* la mappa con i marker degli oggetti per capire dove si trova
la caccia. Aggiunto `gpsBypass` come state opzionale + CTA "Continua
senza GPS" nella schermata d'errore.

In modalità `gpsBypass`:
- La mappa renderizza centrata su `event.treasureHuntConfig.centerLat/Lng`
  (il centro che l'organizzatore ha impostato durante la creazione)
  con fallback Marzio se l'evento non ce l'ha.
- I marker degli items spawned sono mostrati, ma il loro popup riporta
  "Riattiva il GPS per catturare" invece del bottone CATTURA.
- Banner ambra in alto: "Stai navigando senza GPS. Vedi gli oggetti ma
  per catturarli serve la posizione attiva."
- `handleOpenAR` con `position === null && gpsBypass` mostra alert
  esplicito invece del no-op silente.

Schermata errore aggiornata: tre opzioni distinte
- (1) Riprova → `window.location.reload()`
- (2) Continua senza GPS → `setGpsBypass(true)`
- Messaggio differenziato per code 1 (istruzioni concrete su
  permission re-grant) vs altri (spiegazione del comportamento
  desktop).

### File toccati

`src/hooks/useHighAccuracyPosition.ts`, `src/pages/TreasureHuntPlay.tsx`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` 12.02s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 5) — add-to-queue blocked by participant rule

L'utente prova ad aggiungere "Back In Black" — ACDC alla coda di un
Coro chiamato "tyty" e riceve "Missing or insufficient permissions."
Il flusso parte da `AddToSessionModal` (FullScreenPlayer / TrackCard
"Aggiungi a un Coro") che chiama `proposeTrackToSession` standalone,
introdotto nella sessione del 2026-05-04.

### Diagnosi

La rule `audio_sessions/{}/queue.create` (firestore.rules:537-543)
richiede:

```
isApprovedUser() && isSessionParticipant(sessionId) && ...
```

`isSessionParticipant` controlla che esista
`audio_sessions/{}/participants/{auth.uid}` con `status == 'joined'`.

`proposeTrackToSession` faceva `setDoc` direttamente sul doc queue
senza mai garantire l'esistenza di un participant doc. Funzionava per
chi aveva già aperto la sessione come listener (perché un join
precedente aveva creato il doc), ma falliva al primo proposing
"cieco" da Library / FullScreenPlayer — l'esatto pattern che il modal
abilita di proposito.

### Fix in `src/hooks/useAudioQueue.ts`

In `proposeTrackToSession`, prima del `setDoc` sulla queue, idempotently
ensure che il proposer sia participant:

```ts
const pSnap = await getDoc(pRef);
if (!pSnap.exists()) {
   await setDoc(pRef, { /* schema completo: userId, displayName,
                         photoURL, joinedAt, lastSeenAt, tracksProposed,
                         tracksPlayed, status: 'joined' */ });
} else if (pSnap.data().status !== 'joined') {
   await updateDoc(pRef, { status: 'joined', lastSeenAt: serverTimestamp() });
}
```

Schema partecipant rispecchia esattamente quello che `AudioSessionCreate`
scrive per il DJ stesso (`userId`, `displayName`, `photoURL`, `joinedAt`,
`lastSeenAt`, `tracksProposed: 0`, `tracksPlayed: 0`, `status: 'joined'`).
Niente migrazione richiesta.

Il branch `setDoc` è gating da `!pSnap.exists()` per non scontrarsi con
la rule `participants.update` che restringe il diff a
`['lastSeenAt', 'status', 'leftAt', 'tracksProposed', 'tracksPlayed']`
— gli identity field sono immutabili post-create.

### Bonus: `Math.floor` su `effectiveMaxAtCreate`

La rule asserts `incoming().effectiveMaxAtCreate is int` e fa
`session.rules.maxQueuedPerUser + (int(userPoints/100) * bonusPerHundredPoints)`.
Il client calcolava lo stesso valore senza `Math.floor` esplicito al
boundary. Per i casi attuali (`maxQueuedPerUser=2`, `bonus=1`) il
risultato è sempre intero, ma una sessione con valori decimali nei
rules avrebbe potuto produrre un mismatch. Floor difensivo al
boundary chiude il caso.

### File toccati

`src/hooks/useAudioQueue.ts`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` 11.34s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 6) — fast-path locale per DJ === proposer

L'utente segnala che dopo aver aggiunto un brano al Coro e averlo
eseguito, tornando alla sessione il brano resta bloccato in
"caricamento" / `transferring`. Test in locale, file già in
biblioteca, no problema di rete.

### Diagnosi

Quando il DJ propone una propria traccia (auto-prova della sua
sessione) il flusso `proposeTrackToSession → DJEngine.startTransfer →
initiateTransfer` chiama un handshake WebRTC con se stesso:

- Il proposer (DJ stesso) aprirebbe un listener su
  `audio_sessions/{id}/signaling/{auth.uid}` per ricevere l'offer.
- Il DJ scrive l'offer sullo stesso path.
- Sub-collection con un solo doc address per UID → conflitto: il
  doc è scritto/letto dallo stesso UID; il proposer-side listener
  non è nemmeno montato (chi propone via Library/FullScreenPlayer
  non apre il pannello DJ); la connection RTCPeerConnection con sé
  stesso non si stabilisce.
- Il timeout 15s del `WebRTCTransfer` scatta → `setItemStatus
  failed` invece di `ready`. **Ma** il `failed` viene scritto solo
  se il flow arriva al timeout — se il caller non riceve mai né
  success né error (caso self-signaling), l'item resta
  `transferring` permanentemente. UI: "in caricamento" indefinito.

Caso comune: stessa persona test in locale, oppure DJ che propone
una propria traccia per arricchire la coda.

### Fix in `src/utils/djEngine.ts` + `src/pages/AudioSessionDJ.tsx`

`DJEngine` accetta una nuova dipendenza opzionale
`getLocalTrackBlob: (localTrackId: string) => Promise<Blob | null>`.
In `startTransfer`, se `item.proposedBy === this.session.djId`,
salta l'`initiateTransfer` WebRTC e legge direttamente il blob
dall'IndexedDB locale:

```ts
if (this.getLocalTrackBlob && this.session
    && item.proposedBy === this.session.djId) {
   this.getLocalTrackBlob(item.localTrackId)
      .then((blob) => blob ? onReady(blob) : onFail('non trovato'))
      .catch((e) => onFail(e?.message ?? 'errore'));
   return;
}
```

`AudioSessionDJ` wires la nuova dipendenza chiamando `getTrack` da
`src/utils/indexedDB.ts`:

```ts
getLocalTrackBlob: async (localTrackId) => {
   const t = await getLocalTrack(localTrackId);
   return t?.blob ?? null;
},
```

Effetto runtime:
- DJ propone una propria traccia → `startTransfer` la marca
  `transferring`, legge il blob da IndexedDB in <100ms, marca
  `ready` + auto-play.
- DJ propone una traccia di un altro participant → flusso WebRTC
  immutato.
- Difensivo: se la traccia non è in IndexedDB del DJ (es. l'aveva
  cancellata localmente fra il propose e il play), `onFail`
  produce un messaggio chiaro invece del timeout 15s.

### File toccati

`src/utils/djEngine.ts`, `src/pages/AudioSessionDJ.tsx`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` ~11s, zero deps nuove.

---

## Sessione UX 2026-05-06 (round 7) — coda Coro: tutti gli item marcati 'played'

L'utente segnala: dopo aver aggiunto vari brani al Coro e premuto
play, tutti gli item della coda vengono marcati come 'played' in
rapida successione (anche quelli non ancora effettivamente suonati).
Ipotesi iniziale "stesso titolo": smentita (tutti gli item hanno
`id` Firestore univoci, il match è per id non per titolo).

### Diagnosi

`DJEngine.tick()` aveva due problemi composti:

1. **Polling-only end-of-track**: il check "brano finito" era
   `prog.duration > 0 && timeRemainingMs <= 0`. L'`AudioEngine`
   emetteva già un evento `'ended'` (registrato in
   `audioEngine.ts:51`) ma **nessuno lo ascoltava** — il
   `DJEngine` non era mai stato wired. Il polling era l'unico
   meccanismo, ed è fragile.

2. **Race "stale duration" durante `playBlob` swap**: quando il
   DJEngine cambia traccia, `playBlob(blobNew)` triggera
   `audioEl.src = newURL; audioEl.load()`. Per un breve istante
   l'`HTMLAudioElement` può riportare:
   - `currentTime = 0` (nuovo brano)
   - `duration` = vecchio valore (cache pre-swap) o `NaN`

   Il guard `prog.duration > 0` cattura il caso NaN, ma se
   `duration` mostra ancora il valore del brano precedente, il
   tick calcola `timeRemainingMs = (oldDuration - 0) * 1000` →
   positivo, OK. **Ma** se per qualche tick consecutivo
   `currentTime` sale rapidamente al valore precedente (replay
   buffer interno) e `duration` resta fermo, può capitare che
   `timeRemainingMs <= 0` scatti su un brano appena iniziato.
   Risultato: `markCurrentPlayed` → `setState('idle')` → tick
   successivo prende il prossimo `ready` item → `playItem(next)`
   → si ripete a cascata. Effetto utente: tutta la coda diventa
   `played` in 5-10 secondi.

### Fix in `src/utils/djEngine.ts`

Tre modifiche in concerto:

1. **Source-of-truth = evento `'ended'`**. Aggiunto metodo
   pubblico `handleTrackEnded()` che incanala l'evento `'ended'`
   dell'`AudioEngine` nel handler centralizzato
   `handleEndOfTrack()`. È wired da `AudioSessionDJ` con
   `audioEngine.on('ended', () => engineRef.current?.handleTrackEnded())`.
   Quando `'ended'` scatta sappiamo *con certezza* che il brano
   è finito.

2. **Polling fallback più conservativo**. Il check nel `tick()`
   resta come backup (Safari iOS può perdere `'ended'` su
   stalled buffer), ma con triplo guard:
   - `prog.currentTime > 0` (non leggiamo lo stato durante una
     transizione `src` swap dove il vecchio brano riporta tail)
   - `Date.now() - playStartedAt >= 2000` (almeno 2s di
     wall-clock dal `playItem()` che ha avviato il brano —
     metadata HA avuto tempo di stabilizzarsi)
   - `timeRemainingMs <= 250` (era `<= 0`, adesso un piccolo
     margine per accogliere drift di `currentTime` vs `duration`
     senza perdere veri end-of-track)

   Plus: il pre-fetch a 30s dalla fine ora richiede
   `timeRemainingMs > 0` per non scattare durante un transient
   "duration negativa".

3. **Re-entrancy guard `isHandlingEnd`**. Sia il `'ended'` event
   che il polling possono in teoria sparare insieme. Il flag
   protegge `handleEndOfTrack` da doppia chiamata (no-op in
   pratica perché `markCurrentPlayed` controlla già
   `currentItemId`, ma evita il transient extra `setState`).

Plus: `playStartedAt` viene resettato in `markCurrentPlayed` per
evitare che un `tick` post-`markCurrentPlayed` veda ancora
`sinceStart >= 2000` su un brano che non sta più suonando.

### Wiring in `src/pages/AudioSessionDJ.tsx`

Nuovo `useEffect` (mounted once, indipendente dal lifecycle del
DJEngine) che fa subscribe/unsubscribe del listener `'ended'`
sull'`AudioEngine`. Routes l'evento a
`engineRef.current?.handleTrackEnded()` — defensive optional
chaining nel caso il DJEngine non sia ancora costruito (primo
render con `session` ancora null).

### Risultato runtime

- **Brano finito naturalmente**: `'ended'` scatta → `handleTrackEnded()` →
  `markCurrentPlayed()` → `setState('idle')`. Tick successivo
  prende il prossimo ready. Esattamente come prima ma con
  trigger affidabile.
- **Polling-only fallback** (Safari iOS): scatta dopo che i tre
  guard sono soddisfatti — almeno 2s dopo il `playItem` e con
  `currentTime > 0`. Non più falsi positivi durante swap.
- **Cambio brano via `forcePlayNext` (skip manuale)**: usa
  `markCurrentPlayed(true)` come prima, marca `skipped` e parte
  il prossimo. Comportamento immutato.

### File toccati

`src/utils/djEngine.ts`, `src/pages/AudioSessionDJ.tsx`.

**Test**: `npm run lint` pulito, `npm test` 63/63 verdi, `npm run
build` ~11s, zero deps nuove.

---

## Sessione UX 2026-05-07 (round 1) — gameplay AR: cattura sempre fallita & emoji statica

**Contesto.** Test in produzione su desktop dell'utente. Due bug
concomitanti rendono inutilizzabile il gioco AR:
1. Apri "Cattura in AR", l'oggetto rimane sempre al centro dello
   schermo indipendentemente da come ti giri o ti muovi.
2. Vibrazione (`navigator.vibrate(60)` su apertura, OK), poi tap
   sull'oggetto → `Missing or insufficient permissions`.

### Diagnosi

**"Sempre al centro"** —
`src/components/ARCaptureLayer.tsx` calcola gli offset `xOffset/yOffset`
da `orientation.gamma/beta` esposti da `useDeviceOrientation`. Il listener
si registra anche quando il device non ha gyro (desktop, alcuni VM, kiosk):
`DeviceOrientationEvent` esiste ma nessun evento viene mai emesso →
`beta/gamma` restano a 0 → offset 0 → emoji incollato al centro. Inoltre
in `GameLobby.tsx:47` il `PermissionsGate` veniva saltato per
`isOrganizer`, quindi su iOS l'organizer non vedeva mai
`DeviceOrientationEvent.requestPermission()` partire — e il listener
silenziosamente non riceveva nulla.

**"Missing or insufficient permissions" sul tap** — la rule
`firestore.rules:342` (`items.update`) richiede `isEventParticipant(eventId)`.
`createGameEvent` (`src/hooks/useGameEvents.ts:174`) creava il `game_event`
ma **non scriveva** il doc `participants/{organizerId}` — l'organizer non
era mai un participant `joined`. Quindi qualsiasi cattura veniva respinta
dalla rule per il primo organizer del proprio gioco. Inoltre la rule
`isWithinTimeWindow` (`firestore.rules:344`) richiede
`request.time >= scheduledKickoff`: se l'organizer fa "Inizia Partita"
prima del kickoff schedulato, ogni cattura viene respinta finché il
timer non si raggiunge — e il messaggio era "no permissions" criptico.

### Fix concertati

1. **Auto-join organizer come participant** (`useGameEvents.createGameEvent`)
   - Firma estesa: `createGameEvent(eventData, organizerIdentity?)`.
   - Dopo il `setDoc` del `game_event`, chiama `setRSVP(eventId, organizerId, 'joined', identity)` per upsertare `participants/{organizerId}`. Schema identico al ramo create di `setRSVP`. Rule-conforme: `participants.create` (`firestore.rules:374`) ammette `isApprovedUser() && userId == request.auth.uid`. L'organizer è già approved (ha passato `game_events.create.isAdminOrRoot()`).
   - `GameCreator.handleSave` ora passa `{ displayName, photoURL }` da `useAuth().profile` con fallback su `user.displayName/photoURL`.

2. **Pre-check tempo lato client** (`captureItemTransaction`)
   - Dopo la lettura dell'`event` dentro la transazione, se `Date.now() < scheduledKickoff` → `throw new Error("L'evento non è ancora ufficialmente iniziato. Aspetta il kickoff alle HH:mm.")`.
   - Surface user-friendly invece del generico permission-denied.

3. **`available` derivation in `useDeviceOrientation`**
   - Aggiunto stato derivato `available: boolean` (default `false`, diventa `true` solo dopo aver effettivamente ricevuto un `DeviceOrientationEvent`). Timer 5s: se `permission === 'granted'/'prompt'` e nessun evento entro 5s, `available` resta `false` (sensore fisicamente assente).
   - Distingue chiaramente "permesso negato" da "device senza sensore".

4. **Fallback statico in `ARCaptureLayer`**
   - `useStaticPlacement = !sensorAvailable || prefersReducedMotion`.
   - Se vero, `xOffset/yOffset = 0` e l'animazione `rotate` è disabilitata (resta solo `scale` pulsante per indicare il target).
   - Microcopy ambra in basso: "Modalità senza giroscopio: l'oggetto non si muove con il device." chiarisce all'utente cosa sta succedendo.

5. **PermissionsGate non skippato per organizer treasure_hunt** (`GameLobby.tsx:47`)
   - Guard cambiata da `!isOrganizer` a `!isQuiz`. Anche l'organizer di una caccia AR deve concedere camera/GPS/orientation. Per il quiz il PermissionsGate resta no-op (tutte le `require*` props a `false`).

6. **Test rule regression** (`firestore.rules.test.ts`)
   - 3 nuovi casi nel describe `12. Game Events Security`:
     - `items.update rejected when caller is not in participants` — chiude la diagnosi (1).
     - `items.update rejected before scheduledKickoff (time window)` — chiude la diagnosi (2).
     - `items.update succeeds for joined organizer in active window` — happy-path post-fix.

### Note di test

- `npm run lint` pulito.
- `npm test` 63/63 verdi.
- `npm run build` ~11s, bundle pulito.
- Rule test: 61/63 verdi. **I 2 fail (`rejects double-like`, `accepts a legitimate unlike`) sono pre-esistenti** sul commit `c9b9eab` (verificato con `git stash`+rerun). Riguardano la rule `posts.update` like/unlike, non sono legati al lavoro R1. Vanno trattati in un round dedicato.

### File toccati

`src/hooks/useGameEvents.ts`, `src/hooks/useDeviceOrientation.ts`,
`src/components/ARCaptureLayer.tsx`, `src/pages/GameLobby.tsx`,
`src/pages/GameCreator.tsx`, `firestore.rules.test.ts`.

Zero deps nuove. Niente migration di schema (l'upsert participant è
già rule-conforme con la rule esistente).

---

## Sessione UX 2026-05-07 (round 2) — mobile scroll/safe-area sistemico

**Contesto.** L'utente segnala che "molte pagine, soprattutto giochi /
eventi / musica, e in particolare i flussi 'crea nuovo X', non scrollano
correttamente sul mobile e hanno parti che non si vedono". Audit a tappeto
ha confermato un pattern ricorrente: `pb-8` sotto la bottom-nav `h-16 +
pb-safe`, modali con `max-h-[90vh]` che esplodono sotto la barra Safari,
wizard con `h-full flex` senza `min-h-0` (regola Flexbox: un flex item
con `min-height:auto` rompe l'overflow del parent).

### Diagnosi

`src/components/Layout.tsx` è già conforme: `h-[100dvh]` al root (riga
115), `flex-1 overflow-y-auto p-0 md:p-6 scrollbar-hide relative min-h-0`
sul wrapper Outlet (riga 289), header mobile `absolute top-0` dentro
`<main>` (relative implicito) → resta visivamente fisso perché lo scroll
avviene nel div figlio. **Falso positivo dell'audit iniziale**.

I veri problemi erano nei figli:
1. Modali (`Dialog`, `CreateEventModal`, `EventDetailModal`) con
   `max-h-[90vh]` → sulla barra-Safari-shrinks-runtime il modal si
   posiziona quando la barra è visibile e resta lì quando collassa,
   bottom edge cropped.
2. Pagine con bottom-nav (IlBivacco, PersonalLibrary, AudioSessionCreate)
   con `pb-8`/`pb-32`/`pt-24` non considerano `env(safe-area-inset-bottom)`
   sui device con notch — ultimo item finisce sotto la nav.
3. Wizard (`GameCreator` step 0/1, `IlAinulindale` Routes container)
   con `h-full flex flex-col` ma senza `min-h-0` → il flex-item espande
   oltre il parent e l'overflow salta.
4. Cropper `IlBaule` con `h-[40vh]` fissi → su mobile con tastiera
   visibile il cropper esce dal viewport.

### Fix

1. **`src/index.css`** — nuova utility `.pb-nav-safe`:
   ```css
   .pb-nav-safe {
      padding-bottom: calc(4rem + env(safe-area-inset-bottom));
   }
   ```
   Riutilizzabile su qualsiasi pagina che scrolla sotto la bottom-nav.

2. **`src/components/ui/index.tsx` `DialogContent`** — `max-h-[min(90vh,
   90dvh)] overflow-y-auto`. `dvh` è il viewport "dinamico" che riflette
   il chrome corrente del browser; `min(90vh, 90dvh)` fallback su `vh` se
   `dvh` non è supportato (browser legacy).

3. **`src/pages/IlBivacco.tsx`** — `pb-8 → pb-nav-safe md:pb-8` sulla
   home, `max-h-[90vh] → max-h-[min(90vh,90dvh)]` sul `CreateEventModal`.

4. **`src/components/EventDetailModal.tsx`** — `max-h-[95vh] sm:
   max-h-[85vh] → max-h-[min(...,...dvh)]`; header `pt-12 → pt-8 sm:pt-12`
   per ridurre lo spreco verticale su mobile stretto.

5. **`src/pages/PersonalLibrary.tsx`** — `pb-32 → pb-nav-safe md:pb-32`.

6. **`src/pages/IlBaule.tsx`** — cropper `h-[40vh] → h-[min(40vh,40dvh)]
   min-h-[300px]`; preview `max-h-[60vh] → max-h-[min(60vh,60dvh)]`.

7. **`src/pages/AudioSessionCreate.tsx`** — `pt-24 (orfano) → pb-nav-safe
   md:pb-8`. Layout già compensa l'header mobile con `pt-16`, il `pt-24`
   creava 32px di gap inutile.

8. **`src/pages/IlAinulindale.tsx`** — Routes container `flex-1
   overflow-hidden → flex-1 min-h-0 overflow-hidden`. Garantisce che il
   container nested abbia altezza vincolata correttamente.

9. **`src/pages/GameCreator.tsx`** — wrapper step 0/1/2 standardizzati a
   `h-full min-h-0 flex flex-col overflow-y-auto pb-nav-safe md:pb-6`.

### Note di test

- `npm run lint` pulito.
- `npm test` 63/63 unit verdi.
- `npm run build` ~11.7s, bundle pulito.
- Niente test rule (questo round è solo CSS / layout).

### File toccati

`src/index.css`, `src/components/ui/index.tsx`,
`src/components/EventDetailModal.tsx`, `src/pages/IlBivacco.tsx`,
`src/pages/PersonalLibrary.tsx`, `src/pages/IlBaule.tsx`,
`src/pages/AudioSessionCreate.tsx`, `src/pages/IlAinulindale.tsx`,
`src/pages/GameCreator.tsx`.

9 file, zero deps nuove. Le modifiche sono retrocompatibili
(`min(vh,dvh)` cade su `vh` se il browser non supporta `dvh`,
`.pb-nav-safe` è una utility additiva).

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
