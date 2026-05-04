# MIGRATION — Marzio1777

**Stato MVP (Maggio 2026, post-batch B7):**
- ✅ Il Campo dei Giochi (Concept A — Caccia, Concept B — Quiz) funzionante
- ✅ L'Ainulindalë Fase 1 (Biblioteca personale + Walkman) funzionante
- ✅ L'Ainulindalë Fase 2 (Sessioni del Coro + WebRTC P2P transfer) funzionante
- ✅ Correzioni post-audit B1–B6 applicate: `collectedAtLat/Lng` audit log,
  `finalLeaderboard` embedded immutable, validazione `currentHostId`
  con `exists()+get()`, Firebase v12 `persistentLocalCache`,
  Wake Lock `featurePolicy` hardening, marker Leaflet inline SVG.
- ✅ Hardening rule audio (B1–B6): queue.create valida `effectiveMaxAtCreate`
  contro `effectiveMaxQueued(sessionId)`; signaling sub-collection.
- ✅ DJ scoring (B2): pointsAwarded × eventMultiplier, +5/+10 long-session
  bonus protetti da `djBonusAwarded` one-way.
- ✅ **Batch B7 — Post-audit hardening (Maggio 2026):**
  - Cap `users.points` increment 50→1000 per coerenza con `pointsMultiplier ∈ [0.5, 5.0]`
  - Quiz scoring split owner-side: `revealRound` (host) + `claimMyAnswerPoints` (client)
    con localStorage idempotency. Pre-fix `evaluateRoundAnswers` veniva respinto
    dalla rule `users.update`.
  - Sporche #25/#26 "Theme Hijacker" chiuse al 100% via `affectedKeys.hasOnly`
    + check espliciti su metadati immutabili
  - `validQueueStatusTransition` stretta (no shortcut `queued → ready/failed`)
  - Cap quiz `pointsAwarded` allineato a `maxPointsPerRound × pointsMultiplier`
    (era `pointsMultiplier × 100` ignorando il `maxPointsPerRound` reale)
  - Ownership stretto su `leaderboard.write` e `participants.delete` (gap
    identificati in audit B7 — partecipante terzo non può più sovrascrivere
    il leaderboard di un avversario o kickarlo)
  - Race-safety `advanceGameEventStatus` via `runTransaction`
  - `AuthContext` profile listener cleanup via `useRef`
  - WebRTC signaling `Timestamp` invece di epoch number
  - PWA icon `public/icon.svg` inline (no CDN DiceBear)
  - `scoring.calculateQuizPoints` decay floor universale a 1pt
  - 24 nuovi test rule (cap, self-claim, queue immutable, leaderboard, participants)
  - `audioEngine.test.ts` riscritto con verifiche concrete (vs smoke `expect(true)`)
- ✅ **Cloud Functions hardening — Fase 2 (Maggio 2026, codice in `functions/`)**: 5 CF
  scritte e pronte al deploy. **Richiede passaggio Firebase Blaze plan** dal lato
  operatore + `firebase deploy --only functions` manuale. Implementate:
  `validateCaptureDistance` (Haversine server-side, chiude #14 Teleporter),
  `enforceQueuePerUserLimit` (count effettivo doc attivi, chiude residuo #24),
  `cleanupOrphanSignaling` (cron 5 min), `cleanupStuckEvents` (cron giornaliero),
  `cleanupOrphanSessions` (cron giornaliero). Skeleton per Fase 2.5:
  `validateP2PTransferIntegrity` (richiede `blobSha256` field), `auditMassSkip`
  (richiede `audit_state/{sessionId}`). Wiring client già pronto in
  `useGameEvents.captureItemTransaction` e `useAudioQueue.proposeTrack` con
  fallback graceful "CF non deployata → legacy fast-path". Rule
  `items.update` accetta sia path server-validated (con `serverValidatedAt`
  ≤ 30s) sia legacy (audit log via `collectedAtLat/Lng`). Nuova rule
  `audit_log/{}` (read-only Root, write CF-only). `notifyKickoff` (FCM)
  rimandata a sessione dedicata (richiede VAPID + UI permessi + dedicated SW).
- ✅ **Quiz auto-generators (4/5) — chiusi in Fase 2 (Maggio 2026)**: `guess_who`, `guess_year`, `guess_caption`, `chronology` implementati con seeded RNG (mulberry32 keyed off `post.id`) per output deterministico. `guess_place` resta `null` con commento esplicito (richiede reverse-geocoding via Nominatim + caching, deferred a Fase 2.5). Wizard `QuizHostCreateRound.tsx` step 3 ora usa il pulsante "Genera distrattori" wired a `questionGenerators[type](source, pool)`. 14 test unit verdi.
- ⏳ FCM notifiche pre-evento rimandate a Fase 2
- ✅ **Gagliardetti pesati da snapshot — Fase 2 (Maggio 2026)**: catalogo
  completo 13 gagliardetti in `src/lib/gagliardetti.ts` (4 historical
  point-based + 4 giochi + 5 audio). Hook `useUserGagliardetti` calcola
  metriche con 6 collection-group queries (cached 1h in localStorage).
  ProfiloPersonale mostra earned + progress per ognuno, raggruppati per
  categoria. Indici composti `COLLECTION_GROUP` aggiunti a
  `firestore.indexes.json` per `participants`, `leaderboard`, `queue`,
  `audio_sessions`, `answers`. 7 nuovi unit test. **Gagliardetti che
  richiedono tracking continuo (5 risposte consecutive, 10 sessioni Host
  senza disconnessioni, 5 skip consecutivi) deferiti a Fase 2.5 con
  contatori denormalizzati su `users/{uid}.{metric}`.**
- ⏳ **Per-user count delle proposte queue attive** rimandato a CF Fase 2:
  il DSL Firestore non può contare documenti, quindi la formula bonus è
  validata in rule sul valore *snapshot* `effectiveMaxAtCreate` ma il count
  vero richiede una callable function (vedi §"Cloud Functions L'Ainulindalë").

---

## Fase 2 — Quiz Auto-Generators ✅ chiuso (Maggio 2026, 4/5)

**Stato:** 4 generators su 5 sono `auto`-available. `guess_place` resta
manuale (`null`) finché non si implementa il reverse-geocoding (Fase 2.5).

**Implementazione (`/src/utils/quizGenerators.ts`):**

- **`guess_who`**: distrattori = 3 `authorName` distinti dal pool, pickati
  via `pickUniqueSeeded(pool, 3, p => p.authorName, post.id)`. Shuffle
  Fisher-Yates con `mulberry32(hashString(post.id + ':who'))`. Ritorna
  `null` se il pool ha < 3 autori distinti diversi dal source.
- **`guess_year`**: distrattori = 3 decadi distinte. Prima fonte: decadi
  presenti nel pool; fallback: candidati sintetici a `±10y, ±20y` dal
  source. Output formato come "Anni 70" / "Anni 2000".
- **`guess_place`**: ❌ ancora `null`. Reverse-geocoding (Nominatim free
  tier 1 req/s) richiede cache lato Firestore + post-processing dei
  risultati per garantire distrattori distinguibili. Fase 2.5 dedicata.
- **`guess_caption`**: distrattori = 3 caption di altri post (length ≥ 5),
  pickate con il solito seeded shuffle.
- **`chronology`**: collect 4 decadi distinte (sourceDecade + 3 random dal
  pool). Output: 4 stringhe "Anni X → Anni Y → ..." con una sola
  ordinata cronologicamente.

**Determinismo:** tutti i generators usano `mulberry32(hashString(post.id))`
come seed. Risultato: lo stesso `(post, pool)` produce sempre lo stesso
output. UX consistente se l'host re-rolla, test unit asseribili senza
flakiness.

**Wiring UI (`src/components/QuizHostCreateRound.tsx`):**
- Step 2: badge "Auto" verde su 4 tipi disponibili, "Manuale" su `guess_place`.
- Step 3: pulsante "Genera distrattori" abilitato se
  `selectedPost && draft.questionType && isAutoGenerationAvailable(draft.questionType)`.
  Click → `questionGenerators[type](source, posts)` → popola
  `questionText`/`options`/`correctIndex` nel draft. Se il generator
  ritorna `null` (pool insufficiente), `alert()` invita a un altro post.

**Test:** 14 nuovi test in `src/__tests__/games/utils.test.ts`
(`Quiz Generators — Phase 2`). Coprono: source senza dati, pool < 3
distrattori, output 4-options con source-as-correct, determinismo,
fallback synthetic per pool thin, formato 2-digit / 4-digit decade.

**Schema dati:** invariato (era pronto da B7). Nessuna migration.

---

## Fase 2 — Cloud Functions del Campo dei Giochi

- `validateCaptureDistance(eventId, itemId, playerLat, playerLng)`
  → chiude la "Sporca #14: The Teleporter" tramite Haversine server-side.
  I campi `collectedAtLat/Lng` sono già scritti dal client al momento
  della cattura atomica.
- `cleanupStuckEvents()` → cron giornaliero che transita gli eventi
  `active` da > 24h a `aborted`. Notifica all'organizer.
- `notifyKickoff(eventId)` → FCM 30 minuti pre-kickoff e all'apertura
  della lobby. Richiede setup FCM tokens raccolti da `users.fcmTokens[]`.

---

## Fase 2 — Cloud Functions de L'Ainulindalë

- `cleanupOrphanSignaling()` → cron ogni 5 minuti che cancella i
  documenti in `audio_sessions/{X}/signaling/{userId}` con `expireAt`
  scaduto. Mitigazione completa di "Sporca #30: The Signaling Spammer".
- `enforceQueuePerUserLimit(sessionId, proposerId)` → callable invocata
  prima della create di un nuovo queue item; conta i doc attivi del
  proposer nella sub-collection `queue` e respinge se eccede la formula
  bonus. Chiude la lacuna lasciata aperta dall'enforcement statico
  (`effectiveMaxAtCreate` blocca solo il forging del valore, non il count
  effettivo dei doc attivi — il DSL Firestore non può contare).
- `validateP2PTransferIntegrity(sessionId, queueItemId, sha256)` →
  callable function lato DJ post-transfer per verificare che il blob
  ricevuto matchi l'hash dichiarato dal proposer. Chiude la limitazione
  "tampered files" attualmente non mitigata. Richiede aggiunta del
  campo `blobSha256` su `queue/{itemId}` (proposer lo calcola pre-send,
  DJ verifica post-receive).
- `auditMassSkip(sessionId)` → trigger su `queue/{X}.status` change to
  'skipped': se il DJ ha skippato N>10 in M<60s consecutivi, scrive
  un alert su `audit_log/{auto}` consultabile da Root. Mitigazione
  parziale di "Sporca #29: The Mass Skipper" (rimane tollerato per
  design, ma tracciato).
- `cleanupOrphanSessions()` → cron giornaliero che chiude le sessioni
  `open` senza `lastSeenAt` recente del DJ (>2h). Setta `status:
  'closed'` con `finalStats` ridotti (popola con i dati disponibili,
  flag `cleanedUpByCron: true`).

**Migration di schema richiesta per integrity check:**
- Aggiungere `blobSha256: string | null` su `QueueItem` interface in
  `/src/types/audio.ts`. Il client proposer calcola `sha256(blob)`
  dopo il read da IndexedDB e prima dell'invio P2P.
- Rule update su `queue.create`: se `blobSha256` valorizzato deve essere
  hex-string di 64 caratteri.
- Backward-compatible: round già giocati con `blobSha256: null`
  continuano a funzionare, la verifica è opt-in lato Cloud Function.

---

## Tech Debt — Storia (chiuso in B4/B7)

**`useRBAC()` helper centralizzato** ✅ chiuso in B4 (`d00f1b3`). Hook
derivato in `src/hooks/useRBAC.ts`; ~40 occorrenze di `profile?.role === 'X'`
migrate.

**Hook split `useAudioPlayer` / `useAudioEngineRaw`** ✅ chiuso in B2
(`19e8d28`). Le API raw del singleton `AudioEngine` (engine, playBlob,
pause, resume, stop, getCurrentTime, getDuration, isPlaying) sono ora in
`src/hooks/useAudioEngineRaw.ts`, consumate dal pannello DJ. `useAudioPlayer`
resta state-level Walkman.

**Quiz host-side scoring** ✅ chiuso in B7 (`evaluateRoundAnswers` cancellato,
sostituito da `revealRound` + `claimMyAnswerPoints` owner-side). La rule
`users.update` consente l'increment solo all'owner; il vecchio flusso era
respinto in produzione.

**Sporche #25/#26 "Theme Hijacker"** ✅ chiuse al 100% in B7 (rule
`audio_sessions/{}/queue.update` con `affectedKeys.hasOnly` + check espliciti
su metadati immutabili).

**Cap `users.points` incoerente con multiplier range** ✅ chiuso in B7
(50→1000/transaction).

**`advanceGameEventStatus` race su `→ completed`** ✅ chiuso in B7
(wrap in `runTransaction`).

**Cross-leaderboard / cross-participant write/delete** ✅ chiusi in B7
(ownership stretto: self-only o organizer/Root).

**`AuthContext` profile listener leak** ✅ chiuso in B7 (cleanup via `useRef`).

---

## Fase 3 — Estensione Concept di Gioco

Architettura `game_events` agnostica per `type`. Per aggiungere un
Concept C/D/E:

1. Estendi il type union in `types.ts`.
2. Aggiungi una sub-config (es. `gymkanaConfig: GymkanaConfig | null`).
3. Crea il componente di play dedicato e routa via `GamePlayRouter`.
4. Estendi le rule Firestore con il match block del nuovo type.

Nessuna modifica al sistema RBAC, ai punti, al leaderboard o agli
inviti. Riusi tutto.

**Concept candidati documentati** (vedi `GAMING_SYSTEM_IT.md` §10.2):
- Concept C — La Gimkana (sequenza di tappe ordinate, ibrido outdoor/quiz)
- Concept D — Il Foto-Reportage (upload competitivo a tempo + voto comunitario)
- Concept E — Il Karaoke del Bivacco (parzialmente assorbito da L'Ainulindalë)

---

## Fase 3 — Estensione L'Ainulindalë

Architettura `audio_sessions` agnostica e isolata. Estensioni future:

1. **Karaoke synced** — aggiungere `lyricsLrc: string | null` su
   `QueueItem` (formato LRC con timestamps). Il listener vede i versi
   evidenziati in tempo reale. Zero modifiche allo schema sessione,
   zero impatto su Game Field.
2. **Video chat embedded in sessione** — slot UI in `AudioSessionDJ`
   e `AudioSessionListener` per integrazione di Daily.co o Jitsi via
   iframe. Zero modifiche allo schema (la chat è esterna). Prevista
   anche per modalità Quiz a distanza (vedi §5.7 GAMING_SYSTEM).
3. **Smart playlist** — Cloud Function `suggestNextTrack(sessionId)`
   che propone al DJ la prossima traccia in base a genere/decade/BPM
   delle precedenti. Richiede metadata aggiuntivi parziali su
   `QueueItem` (`genre`, `bpm`) compilati dal proposer in fase di
   propose. Backward-compatible (campi opzionali).
4. **Cross-session contribution** — un proposer può inviare una
   traccia a una sessione anche se non è online quando viene played
   (transferimento via cloud temporaneo). Richiederebbe Firebase
   Storage temporaneo (TTL 1h) — **violerebbe la regola "no audio nel
   cloud"**, da valutare attentamente prima di approvarlo. In
   alternativa: il proposer può schedulare la presenza in una
   determinata sessione futura.

---

## Convenzioni di Migrazione

- **Backward compatibility prioritaria.** Ogni nuovo campo è
  opzionale (`field?: T | null`). I documenti pre-esistenti continuano
  a funzionare senza touch.
- **Schema migration solo se obbligatorio.** Preferiamo always
  feature-flagging in codice invece di scrivere script di migration.
  Firestore non ha schema enforcement, è il client a difendere
  l'invariante.
- **Rule changes sempre con test.** Ogni modifica a `firestore.rules`
  passa per `@firebase/rules-unit-testing` su emulator. Il test runner
  è in CI (`firestore.rules.test.ts` per giochi, `.audio.test.ts`
  per L'Ainulindalë).
- **Cloud Functions con feature flag remoto.** Ogni CF ha un toggle
  in `users/{rootId}.featureFlags` letto all'avvio. Permette di
  disabilitarla senza redeploy se causa problemi in produzione.
- **Versioning della spec.** Quando un cambio è breaking, scrivere
  in `MIGRATION.md` la sezione "Vrebakings note Y.Z" con before/after
  e step di upgrade utenti. Per ora non ce ne sono (tutto opt-in).
