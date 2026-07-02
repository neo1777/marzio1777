> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

### Verifica del piano attuale (gap trovati)

Il piano ha già un §5 "Strategia di test" e un §4.6 "Perché rules e 74 rule-test restano validi". L'impianto è corretto (piramide a quattro piani, rule-test che restano in TS, integration su emulator come banco di non-regressione). Verificando §5/§4.6 contro dossier + codice reale ho però trovato dieci punti da correggere o esplicitare, tutti load-bearing per la promessa "Marzio non regredisce".

| # | Punto del piano | Gap verificato alla fonte | Correzione |
|---|---|---|---|
| G1 | §5.1: "porting 1:1 dei 66 vitest … `audio/{id3,indexedDB,audioEngine,useAudioQueue}` → `package:test` Dart" | **13 dei 66 NON sono logica pura.** `audioEngine.test.ts` (9 test: singleton, grafo nodi, blob-URL revoke, `fftSize 128`, EQ 320/1000/3200, MIME) e `indexedDB.test.ts` (4 test: schema `marzio1777_audio` v1, store/indici) provano **comportamento di via-di-fuga**, non funzioni pure. Il piano si autocontraddice: in §5.1 dice giustamente "id3 (parsing) e la formula del cap: pura logica" ma elenca comunque `audioEngine`/`indexedDB` come unit Dart 1:1. | Solo **53/66** portano 1:1 a unit Dart puri (46 `utils` + 4 `id3` parsing + 3 `useAudioQueue` formula cap). I **13** di `audioEngine`/`indexedDB` vanno **ri-collocati in §5.5** come contract test per-impl, eseguiti per-piattaforma. |
| G2 | §5.4: "le 7 CF restano testabili sull'emulator functions (`functions/` è invariato)" | **Verificato: zero test per le CF.** `functions/package.json` ha solo `build/lint/serve/deploy/logs` (nessuno script `test`); nessun `*.test.*` in `functions/src/`. La formula di `enforceQueuePerUserLimit` (sito 2 del "patto a 3") e l'Haversine di `validateCaptureDistance` oggi **non hanno copertura automatica**. | "Testabili" ≠ "testate". Esplicitare che la copertura del contratto client↔CF la danno **solo gli integration test** (Dart → emulator `--only firestore,functions`); aggiungere uno smoke test functions è un guadagno a basso costo (opzionale, non tocca la logica CF → vincolo "CF invariati" rispettato). |
| G3 | §5.2: "Firestore mockato con `fake_cloud_firestore` per i widget data-driven" | **`fake_cloud_firestore` NON valuta le security rules.** Un widget test può passare mentre la write reale sarebbe **respinta dalla rule**. Senza questa avvertenza, widget verdi danno falsa fiducia sull'anti-regressione. | Stabilire la regola: i fake servono solo a **renderizzare** UI data-driven; **ogni write-path ha un integration test sull'emulator reale** (con `firestore.rules` caricate). Il gate anti-regressione gira sull'emulator, mai sui fake. |
| G4 | §5.3: "contro l'emulator Firestore+Auth (già configurato in `firebase.json`: porte firestore/auth)" | Le porte reali sono **firestore 8099, auth 9099** (`firebase.json`). CLAUDE.md e il dossier (riga 148) dicono "porta 8080": è **drift di documentazione**. Il Dart che punta a 8080 non si connette. | Le chiamate Dart sono `useFirestoreEmulator('localhost', 8099)` e `useAuthEmulator('localhost', 9099)`. Correzione concreta, non opzionale. |
| G5 | §5.1: "testare `getMaxQueuedFor` in Dart … stesso intero della rule e della CF" | Manca il **meccanismo**: dal Dart non si può invocare la formula della rule. Inoltre la rule esige `effectiveMaxAtCreate is int` e Dart distingue `int`/`double` (in JS era un solo `Number` con `Math.floor` al boundary). | Servono **due** test: (a) golden-vector unit condiviso `(points, maxQueuedPerUser, bonusPerHundredPoints) → int atteso`; (b) integration sull'emulator che il valore Dart sia **accettato** da `queue.create` e uno forgiato respinto. Più assert di **tipo runtime `int`** sul payload. |
| G6 | §5 (assente) | Il dossier marca come invariante che molti campi siano `FieldValue.serverTimestamp()` (`collectedAt`, `revealedAt`, `transferStartedAt/CompletedAt`, `currentTrackStartedAt`) e che gli ICE candidate usino `Timestamp.now()`, **mai `Date.now()`** — era un bug fixato in B7. Il piano non ha alcun guard. | Aggiungere un **write-shape contract test** che verifica l'uso del sentinel `serverTimestamp()` (non `DateTime.now()`) sui campi server-stamped. |
| G7 | §4.6/§5.3: tesi "stesse shape ⇒ rule verdi" | La tesi anti-regressione non nomina **come si prova** che il client Dart emetta le stesse shape. Resta aspirazione. | Introdurre **golden-fixture dei payload di scrittura** (set di campi, tipi, `is int`, sentinel server-time) catturati dal client React e asseriti contro l'output Dart, più accettazione sull'emulator. È il vero meccanismo anti-regressione. |
| G8 | §5.2: "golden test mirati" | Manca il caveat: i golden Flutter sono **sensibili a font/renderer/piattaforma** (CanvasKit web vs nativo) e flakano senza pin di piattaforma + `loadAppFonts()`. Inoltre non esiste un golden React da diffare: la baseline è **approvazione umana**, non parità automatica. | Pinnare i golden a **una piattaforma CI** con font bundled; dichiararli prova di non-regressione **del solo Flutter** nel tempo, non prova di parità verso React (quella è integration + revisione visiva). |
| G9 | §4.4: "il fallback graceful va portato fedelmente" | Giusto, ma la strategia di test **non testa mai il ramo di fallback** (CF down → legacy fast-path). È load-bearing: con CF irraggiungibile, cattura e `queue.create` devono comunque funzionare passando solo per la rule. | Integration test dedicato: emulator **senza** functions (o callable che ritorna `unavailable`) → il client Dart prosegue, la write resta validata dalla rule. |
| G10 | §5.3 (parziale) | Il claim quiz owner-side è idempotente via `localStorage[marzio1777:quiz-claimed:{roundId}:{uid}]` (in Dart → `shared_preferences`/equivalente). Il piano non testa il **doppio-claim su retry** né la monotonicità lato rule. | Test esplicito: secondo `claimMyAnswerPoints` → `0`; e a livello rule che `pointsAwarded` già `>0` non sia ri-incrementabile. |

Numeri del piano **confermati corretti** (non toccarli): 66 vitest, 74 rule-test, 23 pagine, 7 CF, 53 `onSnapshot`. La formulazione "i rule-test NON si portano in Dart, restano in TypeScript" (§4.6/§5.4) è esatta ed è il cardine del gate.

---

## 5. Strategia di test e anti-regressione (versione operativa)

**Perché due fronti, non uno.** Con il backend invariato (§4), ogni write è giudicata due volte: dal **client Dart** (deve *produrre* la shape giusta) e dalla **rule** (deve *giudicarla* giusta). Il test deve quindi provare cose diverse ai due lati. I **74 rule-test** restano la prova che la rule giudica bene; i nuovi test Dart provano che il client produce bene. Il punto di incontro — e l'unico vero banco di non-regressione di Marzio — è l'**emulator Firestore con `firestore.rules` caricate**: lì le due verità si toccano. Tutto ciò che non passa per l'emulator (unit puri, widget con fake) **non** è prova anti-regressione: è prova di logica e di rendering.

### 5.A La piramide a cinque livelli

| Livello | Cosa | Strumento | Da dove viene | Conta come anti-regressione? |
|---|---|---|---|---|
| **L0 — Logica pura Dart** | 53 dei 66 vitest portati 1:1 | `package:test` | `utils/{geo,spawning,scoring,eventState}` (46) + `id3` parsing (4) + `getMaxQueuedFor` (3) | No (prova logica; protegge il porting) |
| **L1 — Contract test vie-di-fuga** | I 13 vitest ri-collocati (G1) + nuovi | `flutter_test` per impl | `audioEngine` (9), `indexedDB` (4); + `SignalingChannel`, `OrientationService` | Parziale (prova il contratto, non la rule) |
| **L2 — Widget + golden** | Le 23 pagine/componenti (net-new) | `flutter_test` + `golden_toolkit` | nessuna baseline React (G8) | No (prova rendering Flutter nel tempo) |
| **L3 — Integration su emulator** | Flussi e2e realtime/auth/CF + **write-shape contract** | `integration_test` → emulator 8099/9099/5001 | net-new; **il cuore anti-regressione** | **Sì — è il gate** |
| **L4 — Rule-test TS + CF** | 74 rule-test invariati + smoke CF | `node:test`+`tsx`+`@firebase/rules-unit-testing` | repo, **invariato** | **Sì — è il gate** |

La logica è quella della piramide §5 attuale, ma con due correzioni grounded: i 13 contract test escono da L0 (G1) e l'emulator è dichiarato l'unico piano che vale come gate (G3).

### 5.B Il gate anti-regressione (cosa deve essere verde, in che ordine)

Il gate è una **sequenza ordinata** da eseguire prima di ogni cutover (M4) e — in forma incrementale — alla chiusura di ogni step. L'ordine è dal più economico/veloce al più costoso, così un rosso precoce ferma la pipeline prima di pagare l'emulator.

1. **`flutter analyze` pulito** (entrambe le impl delle vie-di-fuga compilano, anche quella non nel bundle — è già l'esito dello spike).
2. **L0 unit Dart verdi** — `flutter test test/unit` (i 53 portati).
3. **L1 contract verdi** — `flutter test test/contract` (per ogni impl; l'EQ nativo SoLoud marcato `skip`/`TODO` con messaggio esplicito, non mascherato — G1, §3.8a).
4. **L2 widget/golden verdi** — `flutter test --update-goldens` solo in revisione; in CI **senza** `--update-goldens`, su piattaforma pinnata + `loadAppFonts()` (G8).
5. **L3 integration su emulator** — il piano critico (vedi 5.D). Comando:
   `firebase emulators:exec --only firestore,auth,functions "flutter test integration_test"` (Dart punta a 8099/9099 — G4; functions emulator 5001 per il contratto callable).
6. **L4a — i 74 rule-test, invariati e verdi** (la rete di sicurezza del backend):
   `firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts firestore.rules.audio.test.ts"` (JDK 21+, `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`).
7. **L4b — smoke CF** (opzionale ma raccomandato, G2): un test che invoca `validateCaptureDistance`/`enforceQueuePerUserLimit` sull'emulator functions e ne verifica out-of-range/resource-exhausted. Non modifica le CF.

**Regola del gate:** un cutover (web swap o submit store) parte **solo** se 1→7 sono verdi sull'HEAD candidato. Se uno fallisce, il rollback web è già pronto per costruzione (ripubblicare `dist/` React — §6.1).

**Il write-shape contract (G6, G7) — il meccanismo mancante.** È il nucleo che rende vera la frase "stesse shape ⇒ rule verdi". Per ogni flusso critico si cattura una volta, dal client React, il payload esatto di scrittura e lo si congela in `test/fixtures/shapes/<flusso>.json`: insieme di campi, tipi (`is int` vs `double`), e marcatori per i sentinel server-time. L'integration test Dart asserisce due cose: (a) il `Map<String,dynamic>` prodotto dal repository Dart ha **lo stesso set di chiavi e tipi** del fixture, con `serverTimestamp()` dove il fixture marca `__server_timestamp__` e `int` dove marca `is_int` (G5, G6); (b) la write è **accettata** dall'emulator con le rule reali. Così un drift di shape (un campo rinominato, un `double` al posto di un `int`, un `DateTime.now()` al posto di `serverTimestamp()`) fallisce *prima* del cutover, esattamente dove la rule lo respingerebbe in produzione con il criptico "Missing or insufficient permissions".

### 5.C Piano di test per fase / milestone (incrementale)

Ogni milestone aggiunge il proprio strato senza togliere i precedenti: a M3 girano L0+L1+L2+L3+L4 di tutto ciò che è entrato fino a lì.

- **M0 — Fase 0 (fondazioni + parallel-backend).**
  - *Funzionale*: L0 dei 53 unit verdi; primo widget test (lista La Piazza); prima integration su emulator (La Piazza read + like).
  - *Anti-regressione*: write-shape contract del **like** (`affectedKeys hasOnly ['likesCount','likedBy']`, set-diff pinnato all'uid, cap `likedBy ≤ 5000`) → emulator accetta; **auth/ruoli** integration (Root-by-email forza Root+approved; nuovo Guest+pending; admin approva pending→approved cross-user) — è critico già a M0 perché è il footgun `isValidUser(data, userId)`.
  - *Gate*: 74 rule-test verdi as-is; in particolare `Sporca #31 — Like Forger`, `Admin/Root user management`, `3. Privilege Escalator`, `6. Email Spoofing`.

- **M1 — Fase 1 (moduli duri).**
  - *Funzionale*: L1 contract delle 4 vie-di-fuga (`AudioEngine` web FFT/EQ reale + nativo SoLoud FFT; `LocalLibraryStore` web/nativo; `SignalingChannel`; `OrientationService`); **WebRTC `FileTransfer` echo eseguito a runtime** (round-trip 40000→40000 byte, 3 chunk + meta JSON) con `LoopbackSignaling` mock (G/§5.5); il test EQ nativo **dichiara lo stub** (§3.8a).
  - *Anti-regressione*: il **"patto a 4"** — golden-vector unit di `getMaxQueuedFor` (G5) + integration `queue.create` accettata col valore Dart e respinta col forgiato; una cattura Flame transazionale + un round quiz e2e su emulator con **CF `validateCaptureDistance` verde** *e* il suo **fallback** (CF down → legacy fast-path, G9).
  - *Gate*: rule-test `queue.create — bonus formula (Sporca #24)`, `12. Game Events Security` verdi; smoke CF (L4b).

- **M2 — Fase 2 (volume comunità).**
  - *Funzionale*: L2 widget+golden delle ~13 pagine (wizard step-validation, `Dialog` dvh-aware, empty-state guest, hint kickoff); fake_cloud_firestore solo per il rendering (G3).
  - *Anti-regressione*: per **ogni pagina** che scrive (post, evento, RSVP, spesa, chat) un integration write-shape contract sull'emulator. Il filtro client `shareLiveLocation == true` su La Mappa va testato come **caso che la rule assume** (la rule non lo rende, lo pretende dal client).
  - *Gate*: rule-test invariati verdi; `Events update (RSVP cross-user + author edit)`.

- **M3 — Fase 3 (integrazione dura).**
  - *Funzionale*: integration completa — **sessione DJ con P2P di un brano reale web↔mobile**; un treasure hunt e un photo quiz end-to-end; idempotenza claim quiz (doppio claim → 0, G10).
  - *Anti-regressione*: tutte le 6 righe della matrice 5.D verdi sull'emulator; ramo fallback CF testato in entrambi i flussi (cattura e coda); write-shape contract dei campi server-stamped audio (`transferStartedAt/CompletedAt` = sentinel; ICE = `Timestamp.now()`, non `Date.now()` — G6).
  - *Gate*: rule-test `B7 — answers.update self-claim`, `signaling — ownership (Sporca #30)`, `queue.update — Theme Hijacker (#25/#26)`, `B7 — finalLeaderboard immutability` verdi.

- **M4 — cutover web + store.**
  - *Gate completo 5.B (1→7)* su due target: **web via chromedriver** (target del cutover) **e android emulator** (target mobile). Staging sullo **stesso progetto** Firebase con shape validate dall'emulator prima del live. Prova di **rollback** provata (ripubblicare `dist/`).

- **M5 — desktop (stretch).**
  - Build desktop test; **fallback no-sensor AR** testato come caso *normale* (camera assente Linux); test di non-preclusione `TenantConfig` (un solo punto per istanza, base-href via `--dart-define`).

### 5.D Matrice: feature → test funzionale → test anti-regressione

I sei flussi critici. "Funzionale" = prova che fa la cosa giusta; "Anti-regressione" = prova che il client Dart resta compatibile con rule/CF/dati di Marzio (gira sull'emulator, L3); "Gate" = i rule-test TS che devono restare verdi (L4).

| Feature | Test funzionale (L0–L3) | Test anti-regressione (L3 emulator, write-shape) | Gate (rule-test TS, L4) |
|---|---|---|---|
| **Cattura item atomica** (`captureItemTransaction`, treasure_hunt) | Integration: due client tap sullo stesso item `spawned` → **un solo vincitore** a `collected`, l'altro riceve "Oggetto già catturato" (semantica `runTransaction`); `users.points += points×multiplier`; leaderboard `increment`. + fallback `validateCaptureDistance` (out-of-range → throw; unavailable → legacy fast-path). | `items.update` accettata: transizione `spawned→collected`, `isEventParticipant`, immutabilità `lat/lng/points/templateId`, `collectedAt = serverTimestamp()`, `collectedAtLat/Lng` numerici o `null`; pre-check kickoff (`< scheduledKickoff` → throw). | `12. Game Events Security` (items.update concorrente "solo un vincitore"; respinto se non-participant; time-window). |
| **Claim quiz owner-side** (`revealRound` + `claimMyAnswerPoints`) | Integration: host scrive `correctIndex`+`revealedAt`; ogni client ricalcola `pointsAwarded`, scrive su `answers/{me}`, `increment` leaderboard+`users.points`+`metrics.quizStreak`; risposta sbagliata → `pts=0` + reset streak; **doppio claim → 0** (idempotenza `shared_preferences`, G10). | `answers.update` due path (self-claim + host-triade); `revealedAt != null`; `affectedKeys hasOnly ['pointsAwarded']`; `pointsAwarded ∈ [0, maxPointsPerRound×multiplier]`; `selectedIndex==correctIndex` se `pts>0`; monotonicità (`pointsAwarded>0` non ri-incrementabile). | `B7 — answers.update self-claim post-reveal`; cap `users.points` +1000/tx. |
| **`queue.create` col cap** (patto a 4) | L0 golden-vector `getMaxQueuedFor`; integration: proposer con N punti propone fino al cap, l'(N+1) respinto; CF `enforceQueuePerUserLimit` (count effettivo) + fallback. | `effectiveMaxAtCreate is int` **== `effectiveMaxQueued(sessionId)`**; il valore Dart accettato, uno forgiato (9999) respinto; `proposedBy == auth.uid`; proposer già `participant` (due `setDoc` sequenziali, non batch). | `queue.create — bonus formula (Sporca #24 Queue Stuffer)`. |
| **RSVP cross-user** (`setRSVP`) | Integration: **non-autore** conferma presenza (update); ramo create con `identity`. | update `affectedKeys ⊆ ['status','respondedAt','shareLocationDuringEvent','leftAt']`; **footgun-fix**: `isValidEvent` gating solo author-edit, RSVP pinnato a `attendees.diff(...).affectedKeys hasOnly [auth.uid]` (anti attendee-forger). | `Events update (RSVP cross-user + author edit)` (non-author RSVP OK; forge entry altrui fail). |
| **P2P transfer** (`webrtc.ts` / `FileTransfer`) | L1 contract con `LoopbackSignaling`: round-trip 40000→40000, 3 chunk 16KB + meta JSON; MIME whitelist `audio/*`; `totalChunks ≤ MAX_TOTAL_CHUNKS (3200)`; backpressure `bufferedAmount > 1MB`; fast-path DJ-locale (`proposedBy==djId` → no self-wedge). Integration: signaling reale su emulator. | `signaling/{userId}` ownership (proposer-or-DJ); `expireAt` 60s; ICE = `Timestamp.now()` **non `Date.now()`** (G6); `transferStartedAt/CompletedAt = serverTimestamp()`. | `signaling — ownership (Sporca #30 Signaling Spammer)`; `audio_sessions.update post-close (#28)`. |
| **Auth / ruoli** (`AuthContext` + `useRBAC`) | Integration: login crea `users/{uid}`; Root-by-email → Root+approved; nuovo → Guest+pending; legacy `< 2024-01-01` → approved, oltre cutoff → pending+warn; **no leak** del profile-listener su logout/login rapido. | `users.update` self-branch (niente `role`/`accountStatus` nel diff); branch admin/root cross-user (`role != 'Root'` su entrambi i lati); `isValidUser(data, userId)` con `data.uid == userId` (NON `== auth.uid` — il footgun corretto 2026-05-23). | `Admin/Root user management (cross-user users.update)`; `3. Privilege Escalator`; `6. Email Spoofing`; `7. PII Blanket Test`. |

### 5.E File, layout e comandi (azionabile)

Layout di test nel progetto Flutter di destinazione:
- `test/unit/` — L0 (porting 1:1 dei 53). Un file per util: `geo_test.dart`, `spawning_test.dart`, `scoring_test.dart`, `event_state_test.dart`, `id3_test.dart`, `queue_cap_test.dart` (`getMaxQueuedFor`).
- `test/contract/` — L1: `audio_engine_web_test.dart`, `audio_engine_native_test.dart` (EQ `skip`+TODO), `local_library_store_*_test.dart`, `signaling_channel_test.dart`, `orientation_service_test.dart`, `file_transfer_test.dart` (echo con `LoopbackSignaling`).
- `test/widget/` + `test/golden/` — L2 (font pinnati, `loadAppFonts()`).
- `test/fixtures/shapes/*.json` — i write-shape contract (G7) e `test/fixtures/queue_cap_vectors.json` (golden-vector condiviso col test JS audio, G5).
- `integration_test/` — L3: `capture_test.dart`, `quiz_claim_test.dart`, `queue_create_test.dart`, `rsvp_test.dart`, `p2p_test.dart`, `auth_roles_test.dart`, `cf_fallback_test.dart`.

Comandi (ordine del gate 5.B):
1. `flutter analyze`
2. `flutter test test/unit test/contract test/widget test/golden`
3. `firebase emulators:exec --only firestore,auth,functions "flutter test integration_test"` (Dart → 8099/9099/5001, **G4**)
4. `firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts firestore.rules.audio.test.ts"` (i 74, **invariati**, JDK 21+)

Punti di verifica rapidi: i 74 rule-test devono restare **byte-identici** (sono il backend, §4.6 — non si toccano mai durante la migrazione); il golden-vector del cap deve essere lo **stesso fixture** consumato dal test JS esistente (`firestore.rules.audio.test.ts`, describe `Sporca #24`) e dal nuovo unit Dart, così i quattro siti (client React, client Dart, CF, rule) restano provatamente allineati; il write-shape contract va catturato **una volta dal client React in produzione-equivalente** prima di iniziare il porting di quel flusso, altrimenti la baseline anti-regressione non esiste.

File di riferimento (assoluti): `/home/neo1777/Scrivania/marzio1777-main/firestore.rules.test.ts`, `/home/neo1777/Scrivania/marzio1777-main/firestore.rules.audio.test.ts`, `/home/neo1777/Scrivania/marzio1777-main/firebase.json`, `/home/neo1777/Scrivania/marzio1777-main/src/__tests__/{games/utils,audio/id3,audio/indexedDB,audio/audioEngine,audio/useAudioQueue}.test.ts`, `/home/neo1777/Scrivania/marzio1777-main/functions/package.json` (nessun test CF), `/home/neo1777/Scrivania/marzio1777-main/src/hooks/{useAudioQueue,usePhotoQuiz,useGameEvents}.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/utils/webrtc.ts`.
