# MIGRATION — Marzio1777

**Stato MVP (Maggio 2026):**
- ✅ Il Campo dei Giochi (Concept A — Caccia, Concept B — Quiz) funzionante
- ✅ L'Ainulindalë Fase 1 (Biblioteca personale + Walkman) funzionante
- ✅ L'Ainulindalë Fase 2 (Sessioni del Coro + WebRTC P2P transfer) funzionante
- ✅ Correzioni post-audit applicate: `collectedAtLat/Lng` audit log,
  `finalLeaderboard` embedded immutable, validazione `currentHostId`
  con `exists()+get()`, Firebase v12 `persistentLocalCache`
  (ora reale, via `initializeFirestore` + `persistentMultipleTabManager`),
  Wake Lock `featurePolicy` hardening (hook condiviso `useWakeLock`),
  container Leaflet stabile con `MapController.invalidateSize()` debounce 200ms,
  marker Leaflet inline DivIcon SVG (no CDN esterno, PWA offline-safe)
- ✅ Hardening rule audio: queue.create valida `effectiveMaxAtCreate` contro
  `effectiveMaxQueued(sessionId)` (chiude il 90% di Sporca #24); signaling
  spostato a sub-collection `audio_sessions/{id}/signaling/{userId}` con
  ownership stretto (chiude Sporca #30)
- ✅ DJ scoring: pointsAwarded × eventMultiplier (linkedGameEventId), bonus +5
  base + (>30 min di musica) +10 long-session, flag `djBonusAwarded`
  one-way per anti double-spend, `currentTrackStartedAt` come `serverTimestamp()`
- ✅ Hook `useRBAC` centralizzato; `useAudioEngineRaw` per separare API raw
  del DJ dalla pipeline Walkman; routing audio rinominato a `/sessioni/*`
- ⏳ Cloud Functions tutte rimandate a Fase 2 (vedi sotto)
- ⏳ Quiz auto-generators rimandati a Fase 2 (architettura pluggable già pronta)
- ⏳ FCM notifiche pre-evento rimandate a Fase 2
- ⏳ **Per-user count delle proposte queue attive** rimandato a CF Fase 2:
  il DSL Firestore non può contare documenti, quindi la formula bonus è
  validata in rule sul valore *snapshot* `effectiveMaxAtCreate` ma il count
  vero richiede una callable function (vedi §"Cloud Functions L'Ainulindalë").

---

## Fase 2 — Quiz Auto-Generators

Il Quiz del Bivacco è funzionante con creazione round manuale. L'host
compone domanda + 4 opzioni + corretta tramite il wizard 4-step in
`QuizHostCreateRound.tsx`. Tempo medio target: < 30 secondi per round.

**Architettura pluggable già in place:**
- `/src/utils/quizGenerators.ts` contiene il `Record<QuestionType, QuestionGenerator>`
  con tutti e 5 i type registrati (`guess_who`, `guess_year`, `guess_place`,
  `guess_caption`, `chronology`). Tutti ritornano `null` per ora.
- Il documento `quizRounds/{roundId}` ha già il campo `sourcePostId: string | null`
  pronto a ricevere sia la selezione manuale dell'host (MVP) sia l'output
  automatico del generator (Fase 2).
- `isAutoGenerationAvailable(type)` ritorna sempre `false` in MVP.

**Steps per implementare la Fase 2 (zero migration richiesta):**

1. Sostituire il body di ogni generator in `quizGenerators.ts`:
   - `guess_who`: estrai `taggedPeople[]` o `authorName` dal post sorgente,
     pesca 3 distrattori da `poolPosts` filtrando per persone diverse.
   - `guess_year`: usa `decade` dal post, distrattori sono altri 3 decenni
     con range ±20 anni.
   - `guess_place`: reverse-geocode `location` (richiede API esterna o
     cache lato Firestore); distrattori sono località vicine ma diverse.
   - `guess_caption`: usa `caption` reale, distrattori sono caption di
     altri 3 post + leggera permutazione semantica.
   - `chronology`: pesca 4 post da decadi diverse, output è la sequenza
     ordinata corretta.

2. Aggiornare `isAutoGenerationAvailable()` per leggere quali generators
   sono effettivamente implementati (es. set di type abilitati o probe
   con post di test).

3. Verificare che `QuizHostCreateRound.tsx` mostri il badge verde
   "Auto disponibile" + pulsante "Genera" sui type che ritornano true.
   La UI è già pronta per riceverlo, NON va modificata.

4. (Opzionale) Cloud Function `validateQuizScore` per chiudere la
   limitazione corrente sul decay scoring server-side.

**Schema dati:** invariato. Nessun campo aggiunto, nessuna migration
Firestore necessaria. La transizione avviene live, on the fly, senza
downtime e senza touch dei round già giocati.

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

## Fase 2 — Tech Debt & Refactoring

**`useRBAC()` helper centralizzato.** L'implementazione corrente di
Fase 2 audio ha la logica RBAC duplicata in ogni componente
`AudioSession*` (es. `profile?.role === 'Admin'`). Funziona ed è
isolata, ma:

1. Creare `/src/hooks/useRBAC.ts` che derivi da `useAuth()` e esponga:
   ```typescript
   const { isRoot, isAdmin, isAdminOrRoot, isApproved, isPending } = useRBAC();
   ```
2. Sostituire tutte le occorrenze di `profile?.role === 'X'` nei file
   audio (e successivamente anche in quelli giochi se desiderato).
3. NON modificare `AuthContext.tsx`: il hook è derivato, non sostitutivo.

**Effort stimato:** 30 minuti, zero rischio di rottura. Da fare nel
prossimo ciclo di polish post-MVP. Tracciato come `// TODO: useRBAC`
nei file interessati.

**FullScreenPlayer encapsulation review.** Le esposizioni aggiuntive
di `useAudioPlayer` (engine, playBlob, getCurrentTime, getDuration)
sono usate solo da `AudioSessionDJ` e `DJEngine`. Considerare
spostamento di queste API in un hook dedicato `useAudioEngineRaw()`
per mantenere `useAudioPlayer` come API pulita per Walkman/MiniPlayer.

**Effort stimato:** 1 ora, basso rischio (nessun consumer esterno
ai 2 file Phase 2). Tradeoff: più file vs più clean separation.
Da valutare in base a evoluzione futura del modulo.

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
