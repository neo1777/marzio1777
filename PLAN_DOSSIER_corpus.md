# SETACCIO_DOSSIER — corpus tecnico marzio1777 (Fase A, 2026-06-30)

> Dati raw sorgentati per tema, letti alla fonte. Raduna, non interpreta. Fatti = default; [INFERENZA]/[IRRISOLTO] marcati. Base per la Fase B.

## Indice temi
- sicurezza-privacy
- coda-p2p-audio
- gaming
- architettura-dati
- performance-pwa
- frontend-ux
- storico-decisioni

---

## Tema: sicurezza-privacy

> Fonti: `public/docs/security_spec_IT.md` (letto integrale, 223 righe), `firestore.rules` (letto integrale, 616 righe), `firestore.rules.test.ts` (letto integrale, 825 righe), `firestore.rules.audio.test.ts` (letto integrale, 349 righe). Riferimenti come `file:riga`. `spec` = `security_spec_IT.md`; `rules` = `firestore.rules`; `test` = `firestore.rules.test.ts`; `audio.test` = `firestore.rules.audio.test.ts`.

### A. Catalogo delle 30 "Sporche" (vettori d'attacco)

Conteggio dichiarato: 12 storiche + 10 giochi (#13–22) + 8 di Sauron (#23–30) = 30. (spec:82, spec:98, spec:111; CLAUDE.md le riassume come "12 storiche + 10 giochi #13–22 + 8 di Sauron #23–30"). [IRRISOLTO] Discrepanza aritmetica: 12+10+8 = 30, ma i numeri arrivano a #30 con la sezione 2.2 che parte da #13 e arriva a #22 (= 10 voci) e la 2.3 da #23 a #30 (= 8 voci). Inoltre la #31 "Like Forger" esiste e viene citata più volte (spec:9, spec:27, spec:104) pur non comparendo nel catalogo numerato delle sezioni 2.x.

#### 2.1 Le Dodici Sporche Storiche (Memorie & Comunità) — spec:83-96
1. **The Shadow Update** — inserire campi fasulli non validati per farli leggere (spec:85). Mitigazione: validatori `isValid*` con `keys().hasAll([...])` (rules:50, 68, 77, ecc.).
2. **The ID Poisoner** — ID stringa di dimensioni enormi (spec:86). Mitigazione: `isValidId(id)` → `id.size() <= 128` (rules:13).
3. **The Privilege Escalator (RBAC Bypass)** — utente tenta mutazione a "Admin" (spec:87). Mitigazione: `users.update` self-branch non ammette `role`/`accountStatus` nel diff (rules:122-127).
4. **The Admin Demotion (Admin Bypass)** — tentativo tra pari di destituire Admin (spec:88). Mitigazione: branch admin con `existing().role != 'Root' && incoming().role != 'Root'` (rules:164).
5. **The Value Poisoner** — payload string dove serve type specifico (spec:89). Mitigazione: check `is string`/`is number`/`is int`/`is bool` nei validatori.
6. **The Email Spoofing Test** — bypass con finta email (email_verified flag fail) (spec:90). Mitigazione: `isSignedIn()` richiede `request.auth.token.email_verified == true` (rules:10).
7. **The PII Blanket Test** — scraping query per leggere array (spec:91). Mitigazione: `users.list` solo `isAdminOrRoot()` (rules:119).
8. **The Timewarp** — creazione commento datato 2088 (spec:92). [IRRISOLTO] Non ho trovato in `rules` un check temporale esplicito su `comments.create`/`isValidComment` (rules:76-81 non valida `timestamp`).
9. **The Denial of Wallet (Arrays)** — liste eccessive in array statico (spec:93). Mitigazione: cap `likedBy ≤ 5000` (rules:72, 217), `fcmTokens ≤ 20` (rules:162).
10. **The Outcome Override** — alterazione eventi conclusi (spec:94). Mitigazione: immutabilità `finalLeaderboard` post-`completed` (rules:329).
11. **The Unauthorized Relational Grab** — prelievo commenti in query private (spec:95). Mitigazione: `comments.read` controlla `visibilityStatus`/`authorId` del post madre (rules:242).
12. **The Orphanizer** — distruzioni orfane del creatore (spec:96). Mitigazione: delete con check su autore (rules:239, 245).

[INFERENZA] La descrizione "4. The Admin Demotion" in spec contrasta col nome usato in `test`: il describe block in `test:63` si chiama "4. The Ghost Writer" e testa la creazione di un post a nome di un altro UID. I numeri delle Sporche e i numeri dei describe-block di test non coincidono 1:1.

#### 2.2 Le Dieci Sporche del Campo dei Giochi (#13–22) — spec:98-109
13. **The Phantom Item** — partecipante non-organizzatore crea `items/{itemId}` durante evento attivo (auto-spawn cheat) (spec:100). Mitigazione: `items.create` limitata a fase `draft|scheduled` e a `organizerId`/Admin/Root (rules:348-349).
14. **The Teleporter** — catturare item oltre il `captureRadius` (spec:101). ✅ Chiuso Fase 2: CF `validateCaptureDistance` (`europe-west1`, `nodejs22`) Haversine server-side + `serverValidatedAt: serverTimestamp()` ≤30s (rules:380-381). Fast-path legacy se `serverValidatedAt == null` (rules:386). Tabella: spec:126.
15. **The Phantom Host** — partecipante scrive `quizRounds/{roundId}/secret/correctness` o rivela senza essere `currentHostId` (spec:102). Mitigazione: helper `isCurrentHost(eventId)` con triade organizer/host/Root (rules:431, 437-438).
16. **The Self-Crowning** — partecipante si riscrive `currentHostId` (spec:103). Mitigazione: `affectedKeys().hasOnly(['currentHostId'])` + `exists()`+`get()` che il nuovo host sia participant `status == 'joined'` (rules:318-322).
17. **The Score Forger** — write ottimistica `pointsAwarded: 9999` su propria `answers/{userId}` post-reveal con risposta sbagliata (spec:104). **Indurito B7** con triplo cap: `revealedAt != null`, `affectedKeys.hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, maxPointsPerRound × pointsMultiplier]`, `selectedIndex == correctIndex` quando `pointsAwarded > 0` (rules:461-472); + cap `users.points` +1000/tx (rules:143); + configurazione round. Tabella: spec:136.
18. **The Late Submitter** — submit `answers/{userId}` dopo `endsAt` (spec:105). Mitigazione: `request.time < endsAt` su create (rules:448).
19. **The Ghost Capture** — "catturare" item già `collected` (spec:106). Mitigazione: `runTransaction` rileva `status` cambiato; rule `resource.data.status == 'spawned'` (rules:367).
20. **The Speed Demon (false GPS)** — GPS spoofing da DevTools (spec:107). **Tollerato per design** (community-level trust): rule respinge solo accuracy >100m (spec:107, spec:128). [INFERENZA] In `rules` non ho individuato un check esplicito "accuracy > 100m" — la mitigazione descritta in spec non è chiaramente rintracciabile nelle rule lette.
21. **The Time Bandit** — forzare evento `draft → completed` (spec:108). Mitigazione: `validStatusTransition(old, new)` ammette solo transizioni in catena (rules:333-339).
22. **The Resurrectionist** — write su `finalLeaderboard` dopo `status == 'completed'` (spec:109). Mitigazione: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))` (rules:329).

#### 2.3 Le Sette Sporche di Sauron (Ainulindalë, #23–30) — spec:111-120 (titolo dice "Sette" ma elenca 8 voci #23–30)
23. **The Phantom DJ** — Guest/Admin generico apre `audio_sessions` come `djId == auth.uid` per autorità di Conduttore (spec:113). Mitigazione: `create` restringe a `isAdminOrRoot()` + `djId == request.auth.uid` + `status == 'open'` (rules:547); now-playing solo via `isSessionDJ(sessionId)` (rules:548).
24. **The Queue Stuffer** — proposer scrive 50 queue items ignorando il limite per-utente (spec:114). Mitigazione formula: `incoming().effectiveMaxAtCreate is int && == effectiveMaxQueued(sessionId)` (rules:564-565). [IRRISOLTO dichiarato] Il count effettivo dei doc non è esprimibile in DSL Firestore; enforcement finale → CF Fase 2 `enforceQueuePerUserLimit` (spec:114; tabella spec:132 dice ✅ chiuso Fase 2).
25. **The Theme Hijacker** — modificare `proposedBy`/`localTrackId`/metadati traccia di un queue item dopo la create (spec:115). **Chiuso 100% B7**: `affectedKeys().hasOnly(['status','position','transferStartedAt','transferCompletedAt','transferFailureReason','pointsAwarded'])` + check ridondanti espliciti (rules:574-588).
26. **The Theme Hijacker (variante DJ)** — il DJ modifica metadati di proposta altrui (es. cambiare `trackTitle` per spostare blame) (spec:116). **Chiuso 100% B7**: stesso meccanismo `affectedKeys.hasOnly` + check espliciti vale anche per il DJ (rules:572-588). DJ può solo skip/play/failed e `pointsAwarded` (cap 50).
27. **The Player Ghost** — listener scrive `currentTrackStartedAt`/`currentQueueItemId` per spoofare il "now playing" (spec:117). Mitigazione: solo `isSessionDJ` può modificare now-playing (rules:548-549).
28. **The Resurrectionist (variante audio)** — write su sessione (qualsiasi sub-collection) dopo `status == 'closed'` (spec:118). Mitigazione: `update` richiede `existing().status == 'open'` (rules:550); spec parla di clausola top-level `isSessionOpen(sessionId)` (spec:118). [INFERENZA] In `rules` lette il gate `(existing().status == 'open')` è sul doc parent (rules:550); non ho trovato un helper `isSessionOpen` applicato esplicitamente a tutte le sub-collection (queue/participants/signaling) come la spec suggerisce — possibile drift doc↔rule.
29. **The Mass Skipper** — DJ marca 'skipped' centinaia di proposte in burst (spec:119). **Tollerato per design**: Root può intervenire + skeleton CF `auditMassSkip` (no-op TODO) (spec:130). Audit log skip non implementato in MVP.
30. **The Signaling Spammer** — partecipante scrive centinaia di doc in `signaling/` per saturare onSnapshot del DJ (spec:120). ✅ Chiuso Fase 2: sub-collection `signaling/{userId}` con read/create/update/delete solo a proposer (`userId == request.auth.uid`) o DJ (`isSessionDJ`) (rules:608-613). `sessionId` ora implicito nel path. CF cleanup `cleanupOrphanSignaling` (cron 5 min).

#### Sporca extra fuori-numerazione
31. **The Like Forger** — iniettare l'uid altrui in `likedBy`, double-like, falsificare conteggi (spec:9, spec:27, spec:104). Mitigazione: `affectedKeys().hasOnly(['likesCount','likedBy'])` + set-diff `toSet().difference(...).hasOnly([request.auth.uid])` + `!(request.auth.uid in existing().likedBy)` su like, simmetrico su unlike (rules:215-233). Non numerata nelle sezioni 2.x ma esplicitamente chiamata "Sporca #31".

### B. Limitazioni note e accettate (tabella spec:124-138)
- **#14 Teleporter** — ✅ chiuso Fase 2 (CF `validateCaptureDistance`) (spec:126).
- **#20 Speed Demon** — rule respinge accuracy >100m; mitigazione completa: nessuna (community-level trust) (spec:127).
- **Host vede `correctIndex` pre-reveal** — inerente al design; UX trasparente (banner "L'Host vede"); completa = Phase 3 (quiz CF orchestrator) (spec:128).
- **FCM notifiche pre-evento** — ✅ chiuso Fase 2 (`notifyKickoff` CF, `fcmTokens[]` cap 20, opt-in UI) (spec:129).
- **#29 Mass Skipper** — Root + skeleton CF `auditMassSkip` (no-op); completa = Phase 3 rolling-window counter su `audit_state/{sessionId}` (spec:130).
- **#30 Signaling orfani** — ✅ chiuso Fase 2 (CF `cleanupOrphanSignaling` cron 5 min, collectionGroup query + chunked batch delete) (spec:131).
- **#24 Queue stuffer count** — ✅ chiuso Fase 2 (CF `enforceQueuePerUserLimit`; rule `effectiveMaxAtCreate` resta safety net) (spec:132).
- **File trasferiti tampered** — hash check assente; skeleton CF `validateP2PTransferIntegrity` (ritorna `unimplemented`); completa = Phase 3 con campo `blobSha256` su `QueueItem` (spec:133).
- **License copyright tracce** — trust model; UI warning "regola dell'oro"; completa = nessuna (community-level trust) (spec:134).
- **#25/#26 Theme Hijacker DJ-side** — chiuso 100% B7 (spec:135).
- **Cross-leaderboard rewrite** — nuovo vettore audit B7, chiuso via `userId == auth.uid` su `leaderboard.write` (spec:137).
- **Cross-participant kick** — nuovo vettore audit B7, chiuso via `userId == auth.uid || isEventOrganizer || isRoot` su `participants.delete` (spec:138).
- Stato Fase 2: 8 CF live su `europe-west1`/`nodejs22` (spec:140). [IRRISOLTO] spec:140 dice "8 CF", CLAUDE.md dice "7 CF live" + 1 skeleton callable (`validateP2PTransferIntegrity`).

### C. Pattern di validazione (estratti da `rules`)

- **`keys().hasAll([...])`** — ogni validatore esige il set minimo di campi: `isValidUser` (rules:50), `isValidUserLocation` (rules:62), `isValidPost` (rules:68), `isValidComment` (rules:77), `isValidEvent` (rules:84), `isValidEventItem` (rules:91), `isValidEventExpense` (rules:96), `isValidChatChannel` (rules:104), `isValidChatMessage` (rules:110), `isValidAudioSession` (rules:527), `isValidQueueItem` (rules:532).
- **`affectedKeys().hasOnly([...])`** — limita il "blast radius" del diff. Esempi: `users.update` self-branch (rules:123, 140, 152, 160), branch admin (rules:166, 168), `posts.update` author-edit (rules:213), like/unlike (rules:215), comment-bump (rules:235), `events.update` RSVP (rules:264-265), `participants.update` (rules:401-402), `quizRounds.update` (rules:434), `answers.update` (rules:462), `audio_sessions.update` (rules:549), `queue.update` (rules:574-579).
- **Identità pinnata `data.<campo> == <docId>` / `== request.auth.uid`** — `isValidUser`: `data.uid == userId` (rules:55, fix 2026-05-23, vedi §D); `isValidPost`: `data.authorId == request.auth.uid` (rules:69); `isValidComment`: `data.authorId == request.auth.uid` (rules:78); `isValidEvent`: `data.authorId == request.auth.uid` (rules:85); `isValidEventExpense`: `data.paidBy == request.auth.uid` (rules:99); `isValidChatMessage`: `data.authorId == request.auth.uid` (rules:111); `isValidUserLocation`: `data.userId == request.auth.uid` (rules:63); `users.create`: `userId == request.auth.uid` (rules:120); `participants.create`: `userId == request.auth.uid` (rules:397); `queue.create`: `incoming().proposedBy == request.auth.uid` (rules:560); `answers.create`: `request.resource.data.userId == answerUserId` (rules:447).
- **Cap numerici** — `id.size() <= 128` (rules:13); `email.size() <= 200` (rules:52); `authorName.size() <= 100` (rules:70); `text.size() <= 2000` (rules:79, 112); `likedBy.size() <= 5000` (rules:72, 217); `fcmTokens.size() <= 20` (rules:162); `users.points` increment `<= 1000`/tx (rules:143); `items.points ∈ [1, 200]` (rules:353-354); `pointsAwarded` quiz `∈ [0, maxPointsPerRound × pointsMultiplier]` (rules:463-467); `pointsAwarded` audio `∈ [0, 50]` (rules:592); title evento `<= 100`, description `<= 500`, `pointsMultiplier ∈ [0.5, 5.0]`, `invitedUserIds.size() <= 100` (rules:308-312); `trackDurationMs ≤ 600000` (10 min, spec:73); `trackCoverDataUrl ≤ 70000` char base64 (~50KB, spec:74); `places_cache.placeName.size() <= 200`, lat/lng range (rules:490-494).
- **Flag immutabili-a-true (one-way)** — `djBonusAwarded`: `false → true` una sola volta, mai revertibile (rules:552-554; spec:55). `serverValidatedAt`: timestamp scritto solo da CF, accettato se ≤30s (rules:380-381).
- **`serverTimestamp()`** — `items.update`: `collectedAt == request.time` (rules:376); audio `transferStartedAt`/`transferCompletedAt`/`currentTrackStartedAt` sempre server-stamped (spec:76, CLAUDE.md "mai `Date.now()`"); `revealedAt: serverTimestamp()` su reveal quiz (CLAUDE.md §B7).
- **Identità via path implicito** — `signaling/{userId}` con `sessionId` implicito nel path (rules:608; spec:120).
- **Campi immutabili-dopo-create** — `organizerId`/`type`/`createdAt` su `game_events` (rules:326-328); `djId`/`rules`/`createdAt` su `audio_sessions` (rules:551); `proposedBy`/`localTrackId`/`trackTitle`/`trackArtist`/`trackDurationMs` su `queue` (rules:584-588); `lat`/`lng`/`points`/`templateId` su `items` durante cattura (rules:370-373); `authorId` su post (spec:25); `linkedGameEventId` immutabile dopo create (spec:79).
- **Validazione successore via `exists()`+`get()`** — nuovo `currentHostId` deve essere participant `status == 'joined'` (rules:321-322); nuovo host quiz (spec:45).
- **Macchine a stati codificate** — `validStatusTransition` giochi (rules:333-339); `validQueueStatusTransition` audio (rules:515-525, "tightened to spec'd flow: queued → transferring → ready/failed, no shortcut; failed → skipped").
- **Helper RBAC/scope** — `isSignedIn` (rules:10, richiede `email_verified`), `isRoot` (rules:15, by email `nicolainformatica@gmail.com`), `isAdminOrRoot` (rules:16-20), `isApprovedUser` (rules:24-26), `isEventOrganizer` (rules:30-32), `isCurrentHost` (rules:33-35), `isEventParticipant` (rules:39-42), `isWithinTimeWindow` (rules:43-46), `isSessionDJ` (rules:508-510), `isSessionParticipant` (rules:511-514), `effectiveMaxQueued` (rules:538-542).
- **Deny-by-default top-level** — `match /{document=**} { allow read, write: if false; }` (rules:5-7).

### D. Il footgun "isValidX(incoming()) AND globale" (spec:7-12; rules:204-209, 254-258)

Definizione (nota di revisione 2026-05-23, spec:7): un validatore `isValidX(incoming())` che impone `data.<campo> == request.auth.uid`, usato come **AND globale** su un `allow update` con rami cross-user, blocca ogni write cross-user legittima perché su una write parziale `incoming().<campo>` resta il valore dell'autore/target, non del chiamante.

Tre istanze corrette (stessa classe di bug):
1. **`isValidUser` / `users.update`** — imponeva `data.uid == request.auth.uid` come AND globale → approvazione `pending → approved`, promozione, cambio ruolo cross-user respinti; "tutti i nuovi iscritti congelati in `pending`" (spec:8). Fix: ribasato a `data.uid == userId` (il campo `uid` deve coincidere con l'id del documento) (rules:55-58). Segnalato dall'utente in produzione (CLAUDE.md).
2. **`isValidPost` / `posts.update`** — "Like Forger #31" indurito: like è write parziale che lascia `authorId` invariato → "Mi Piace" dei non-autori bloccati (spec:9). Fix: `isValidPost` gating solo il ramo author-edit; like/unlike e comment-bump validano da soli (rules:210-237). Rimosso anche il termine ridondante `isAdminOrRoot() || …` che lasciava all'autore-admin il bypass anti-forge (double-like) (spec:9, rules:208).
3. **`isValidEvent` / `events.update`** — RSVP è write parziale del solo `attendees` → solo l'autore dell'evento poteva confermare la presenza (spec:10). Fix: ramo dedicato RSVP che pinna la modifica all'entry propria della mappa: `attendees.diff(...).affectedKeys().hasOnly([request.auth.uid])` (anti "attendee forger") (rules:264-265).

Footgun dormiente non corretto: `expenses.update` ha `isValidEventExpense` con `paidBy == request.auth.uid` come AND globale (rules:282), ma il client non aggiorna mai una spesa (solo create/read/delete) → "footgun dormiente, non corretto per assenza di use-case" (spec:11).

Avvertimento (CLAUDE.md, memory `[[pattern-validatore-identity-and-globale]]`): è un **pattern**, non istanze isolate; prima di adottarlo su un nuovo `match`, verificare se l'update ha rami cross-user (admin/moderazione/RSVP/like) e in tal caso ribasare il check a `data.<campo> == <docId>` o spostare il validatore nel solo ramo author-only.

### E. Privacy

- **Live location opt-in (doppio livello)** — la posizione live di un giocatore è scritta solo in `user_locations` (split collection) e solo se `participants.shareLocationDuringEvent == true` (override per-utente); l'opt-in dell'evento (`game_events.visibilityOfOthers`) è solo permesso dell'organizzatore, "il consenso del singolo utente prevale sempre" (spec:47). Rule `user_locations`: read/list solo `isAdminOrRoot()` + `resource.data.shareLiveLocation == true` (rules:175-177); il client "MUST filter by shareLiveLocation == true" (rules:176). `AuthContext` osserva `navigator.geolocation` solo se `profile.shareLiveLocation === true` (CLAUDE.md).
- **Dati che non lasciano il client (audio in IndexedDB)** — "Per design, nessun byte audio è mai scritto su Firestore o Firebase Storage" (spec:77). I file musicali vivono esclusivamente nell'IndexedDB locale del proposer (`marzio1777_audio` DB), trasferiti peer-to-peer device-to-device via WebRTC (spec:77; CLAUDE.md store `tracks`+`playlists`). Solo metadati (titolo, artista, durata, cover ≤50KB) viaggiano sulle collection (spec:77). "La rule Firestore non ha bisogno di proteggere file audio perché non ne esistono" (spec:77).
- **Signaling effimero & confidenziale** — `signaling/{userId}` leggibili solo da `djId` e `userId` proprietario; create limitata a `request.auth.uid == userId` o `djId`; `expireAt` per cleanup; "Nessun dato personale o file binario è mai scritto qui — solo SDP offer/answer e ICE candidates" (spec:76; rules:608-613).
- **Isolamento PII** — `users` possiede `email`, non consultabile in array/collection read da utenze normali (spec:28); `users.list` solo `isAdminOrRoot()` (rules:119); `users.get` solo owner o admin/root (rules:118).
- **Chiavi per-utente** — chiave Gemini per-utente salvata su `users/{uid}.apiKey`, settata da pannello Admin/Root; in self-update `apiKey` è tra i campi modificabili dall'owner (rules:123). `GEMINI_API_KEY` non iniettata in produzione (CLAUDE.md). VAPID **public** key hardcoded nel bundle (servita comunque a ogni client); la private key resta sui server FCM (CLAUDE.md).
- **Secret del Quiz** — `correctIndex` scritto esclusivamente in sotto-sotto-collezione `quizRounds/{roundId}/secret/correctness`, leggibile solo dalla triade `currentHostId`/`organizerId`/Root; copiato nel doc parent (leggibile a tutti) solo al reveal (spec:43; rules:436-438). Limitazione accettata: l'host vede `correctIndex` pre-reveal (inerente al design) (spec:128).
- **`metrics` isolato** — owner scrive la propria mappa `metrics` senza bump punti, "no PII path, no points bump" (rules:151-152; semantica only-up enforced client-side).
- **Audit log** — `audit_log/{logId}`: read solo Root, write `if false` (CF-only via admin SDK) (rules:502-505).

### F. Copertura test

#### `firestore.rules.test.ts` (825 righe, giochi/comunità)
Describe block e casi:
- **1. The Shadow Update** — nega create Post con ghost field `isVerified` (test:31-40).
- **3. The Privilege Escalator** — nega self-promotion `role: 'Admin'` (test:42-61).
- **4. The Ghost Writer** — nega create post con `authorId` di un altro UID (test:63-71).
- **6. Email Spoofing** — nega write con `email_verified: false` (test:73-80).
- **7. PII Blanket Test** — nega `users.get()` (list) (test:82-87).
- **11. The Unauthorized Relational Grab** — nega fetch commenti da post privato altrui (test:89-99).
- **12. Game Events Security** — create draft (admin OK / guest fail) (test:101-147); `correctIndex` non leggibile pre-reveal (test:149-160); `items.update` concorrente "solo un vincitore" (test:162-186); `items.update` respinto se non-participant (test:188-216); respinto prima di `scheduledKickoff` (time window) (test:218-252); succede per organizer joined in finestra attiva (happy-path) (test:254-283); transizioni stato invalide bloccate `draft → active` fail, `draft → scheduled` OK (test:285-303).
  - **Current Host tests** (test:305-379): host scrive quizRound+secret+reveal; organizer scrive quizRound; non-host non scrive quizRound; non-host non cambia `currentHostId`; host uscente cambia `currentHostId` a next host; host non modifica altri campi evento.
- **B7 — Owner-side points cap (1000/tx)** (test:382-420): within cap (+500); at cap (+1000); above cap (9999999) fail; decrement fail (monotonic); cross-user write fail.
- **B7 — answers.update self-claim post-reveal** (test:422-500): claim su risposta corretta OK; pts>0 su risposta sbagliata fail; pts=0 su sbagliata OK; write su answer altrui fail; over-cap (999) fail.
- **B7 — leaderboard ownership-stretto** (test:502-532): self-row OK; cross-row fail.
- **B7 — participants.delete ownership-stretto** (test:534-571): self-leave OK; kick di altro participant da unrelated fail; organizer kick OK.
- **Sporca #31 — Like Forger** (test:573-642): owner self-like OK; forge uid altrui in `likedBy` fail; double-like fail; unlike legittimo OK; unlike che strippa altri fail.
- **items.create — points bound [1, 200]** (test:644-679): valore nella banda OK; points=0 fail; points>200 (250) fail.
- **B7 — finalLeaderboard immutability (#22 Resurrectionist)** (test:681-698): rewrite dopo `completed` fail.
- **Admin/Root user management (cross-user users.update)** (test:706-777): Admin approva pending→Guest; Admin promuove Guest→Admin (role-only); Root approva pending→Admin; Root cambia ruolo; Guest non-admin non approva (fail); Admin non modifica Root (fail); Admin non riallinea il campo `uid` mentre approva (fail).
- **Events update (RSVP cross-user + author edit)** (test:782-822): non-author RSVP OK; author edita metadata OK; non-author edita metadata fail; forge entry attendees altrui fail.

#### `firestore.rules.audio.test.ts` (349 righe, audio)
- **audio_sessions.create — DJ authority** (audio.test:113-143): Admin crea con `djId == auth.uid` OK; Admin non può spoofare `djId` (#23 Phantom DJ) fail; Guest non può creare fail.
- **queue.create — bonus formula (#24 Queue Stuffer)** (audio.test:145-204): `effectiveMaxAtCreate` matching a points=0 (=2) OK; a points=250 (=4) OK; valore forgiato (9999) fail; `effectiveMaxAtCreate` mancante fail.
- **signaling — ownership (#30 Signaling Spammer)** (audio.test:206-240): proposer crea il proprio doc OK; terza parte crea per altri fail; DJ crea per qualsiasi proposer OK.
- **audio_sessions.update post-close (#28 Resurrectionist audio)** (audio.test:242-249): write su sessione `closed` fail.
- **queue.update — Theme Hijacker (#25/#26)** (audio.test:251-347): DJ transition `queued → transferring` OK; DJ shortcut `queued → ready` fail; DJ riscrive `proposedBy` fail; riscrive `trackTitle` fail; riscrive `localTrackId` fail; DJ assegna >50 punti (9999) fail; DJ assegna 10 punti con `played` OK; listener aggiorna queue item fail.

Conteggi dichiarati (CLAUDE.md, verificato 2026-05-23): **74/74 rule test** su 2 file + **66/66 unit test** su 5 file. Runner: `firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts firestore.rules.audio.test.ts"` (richiede JDK 21+, emulator porta 8080).

#### Suite di test elencate in spec (spec:153-206) — alcuni casi descritti che [INFERENZA] non trovano riscontro 1:1 nei file di test letti
- spec:160-161 cita "`correctIndex` leggibile da tutti post-reveal" e "currentHost ≠ organizer può creare round/scrivere secret/fare reveal" — non ho trovato un test esplicito "leggibile post-reveal da tutti" in `test`.
- spec:184 "Queue.create con limite per-utente rispettato (bonus formula su user.points = 0, 250, 500)" — `audio.test` copre 0 e 250, **non** 500 (audio.test:146-174).
- spec:191-192 "Write su sessione closed (test su queue, participants, signaling, doc parent)" e "finalStats write post-closed" — `audio.test` copre solo il doc parent (`update mode`) (audio.test:242-249); non ci sono test espliciti su queue/participants/signaling post-closed né su `finalStats`.

### G. Filosofia / modello di minaccia (spec:196; CLAUDE.md)
- "Ridurre la superficie d'attacco a quanto effettivamente possibile e verificabile via rule (DSL Firestore), accettare esplicitamente le limitazioni note (Haversine server-side, hash check P2P), e demandare a Cloud Function (Fase 2) tutto ciò che il DSL non può esprimere" (spec:196).
- Trust model: "app di paese, comunità chiusa whitelisted" → GPS spoofing tollerato ("se Mario gioca da casa fingendo di essere fuori, lo si scopre alla pizzata successiva", spec:107).
- Limite DSL noto: "il count effettivo dei doc attivi del proposer non è esprimibile in DSL Firestore (non si possono contare documenti)" (spec:114).
- Patto a 3 — Cap Dinamico Coda Audio (CLAUDE.md): formula `maxQueuedPerUser + floor(points/100) * bonusPerHundredPoints` replicata in 3 siti che devono restituire lo stesso intero: client `getMaxQueuedFor` (`src/hooks/useAudioQueue.ts:11`), CF `enforceQueuePerUserLimit` (`functions/src/index.ts:164`), rule `effectiveMaxQueued` (rules:538-542). Disallineamento → `queue.create` respinta con "Missing or insufficient permissions" silenziosa.
- Convenzione vincolante (CLAUDE.md): ogni modifica a `firestore.rules` accompagnata da test; per landare in PROD le rule serve `firebase deploy --only firestore:rules` (il commit non basta; lo fa l'utente).

### H. [IRRISOLTO] Note di stato / drift
- Fix permessi 2026-05-23 (commit `96353ca` locale): "NON ancora pushato né deployato" → "finché non deployato, l'approvazione resta rotta su https://neo1777.github.io/marzio1777/" (CLAUDE.md). Quindi le rule in produzione potrebbero differire da `firestore.rules` letto qui.
- spec:140 "8 CF live" vs CLAUDE.md "7 CF live + 1 skeleton".
- Gap di tipo: `fcmTokens` usato da `useFCM.ts` + rule (rules:160-162) ma non dichiarato in `UserProfile` (`src/types.ts`) — "non bloccante" (CLAUDE.md).
- CLAUDE.md afferma che la spec "Cataloga 30 Sporche (12 storiche + 10 giochi #13–22 + 8 di Sauron #23–30)" — ma la #31 Like Forger esiste fuori numerazione e il footer di revisione 2026-05-23 la cita come #31 (spec:9).

---

## Tema: coda-p2p-audio

Letti integralmente: `AINULINDALE_TECHNICAL_SPEC.md` (1210 righe), `src/utils/{audioEngine,djEngine,webrtc,indexedDB,id3}.ts`, `src/hooks/{useAudioQueue,useWebRTCTransfer,useAudioSession,useAudioPlayer,useAudioEngineRaw,useLocalLibrary}.ts`. Nessun campionamento.

---

### A. Il "Patto a 3" — Cap Dinamico Coda (IL CUORE)

**Formula canonica**
- `maxQueuedPerUser + floor(points / 100) * bonusPerHundredPoints` — default `2 + floor(pts/100) * 1`. [da CLAUDE.md §"Patto a 3"]
- Esempio dichiarato: `maxQueuedPerUser:2`, `bonusPerHundredPoints:1`, utente 350pt → `2 + floor(350/100)*1 = 5`. `AINULINDALE_TECHNICAL_SPEC.md:934-940`
- Default field: `rules.maxQueuedPerUser` default 2; `rules.bonusPerHundredPoints` default 1 (commento "250pt -> +2 max queued"). `AINULINDALE_TECHNICAL_SPEC.md:140-145`

**Sito 1 — Client: `getMaxQueuedFor(points, rules)`** (`src/hooks/useAudioQueue.ts:11-18`)
- Corpo esatto: `const max = rules?.maxQueuedPerUser ?? 2; const bonus = rules?.bonusPerHundredPoints ?? 1; return max + Math.floor((points || 0) / 100) * bonus;` `useAudioQueue.ts:15-17`
- Fallback default `?? 2` / `?? 1` motivato: "Legacy sessions or partially-loaded snapshots can have a missing `rules` object". `useAudioQueue.ts:12-14`
- Uso 1 (pre-flight check): `if (userActiveItems.length >= getMaxQueuedFor(userData.points, session.rules)) throw ...` con `userActiveItems` = item dove `proposedBy === user.uid` e `status in ['queued','transferring','ready','playing']`. `useAudioQueue.ts:72-79`
- Uso 2 (snapshot create): in `proposeTrack`, `const effectiveMaxAtCreate = getMaxQueuedFor(userData.points, session.rules);` poi scritto nel `QueueItem`. `useAudioQueue.ts:121`, `135`, `142`
- Variante standalone `proposeTrackToSession`: `const effectiveMaxAtCreate = Math.floor(getMaxQueuedFor(userData.points, session.rules));` con commento "Force int … the create rule asserts `effectiveMaxAtCreate is int`. JS Number is float; floor at the boundary". `useAudioQueue.ts:232-236`, `251`, `256`

**Sito 2 — Cloud Function: `enforceQueuePerUserLimit`** (callable, `functions/src/index.ts:164`, `europe-west1`) [posizione da CLAUDE.md; chiamata visibile nelle sorgenti assegnate]
- Chiamata client: `httpsCallable<{sessionId:string},{ok:boolean;active:number;limit:number}>(functions,'enforceQueuePerUserLimit')` poi `await enforceLimit({ sessionId });` — presente in DUE punti: `useAudioQueue.ts:98-101` (in-hook) e `useAudioQueue.ts:210-213` (standalone).
- Formula CF (da CLAUDE.md): `limit = maxQueuedPerUser + Math.floor(userPoints / 100) * bonusPerHundredPoints`, confrontata col count effettivo dei doc attivi del proposer (`status in [queued, transferring, ready, playing]`). "il DSL Firestore non può contare, quindi questa CF è l'unica difesa server-side." [CLAUDE.md]
- Gestione errore: se `error?.code === 'functions/resource-exhausted'` → throw messaggio limite; altrimenti **fallback graceful** ("CF unavailable → fall through to setDoc, the rule will still validate effectiveMaxAtCreate"). `useAudioQueue.ts:102-117`
- Log fallback strutturato: `console.warn('[marzio1777] CF fallback active', { event:'cf_fallback_active', cf:'enforceQueuePerUserLimit', proposerId, sessionId, reason, timestamp })`. `useAudioQueue.ts:109-116` e `219-226`

**Sito 3 — Firestore rule: `effectiveMaxQueued(sessionId)`** (`firestore.rules:516-520`) [da CLAUDE.md]
- Formula identica con `int()` al posto di `Math.floor`: `rules.maxQueuedPerUser + int(getUserDoc().points / 100) * rules.bonusPerHundredPoints`. `AINULINDALE_TECHNICAL_SPEC.md:894`, `207-211`; [CLAUDE.md §"Patto a 3"]
- Rule `queue.create` (firestore.rules:542-543) confronta con `==` stretto: `incoming().effectiveMaxAtCreate is int && incoming().effectiveMaxAtCreate == effectiveMaxQueued(sessionId)`. [CLAUDE.md]

**Conseguenza disallineamento** (load-bearing): se la formula o uno dei due field `rules.*` cambia in un solo sito, la rule respinge `queue.create` con `Missing or insufficient permissions` — silenziosa per l'utente, criptica nei log; il fallback graceful client (CF down → bypass) maschera ulteriormente. [CLAUDE.md]

**Vettore d'attacco**: Sporca #24 "Queue Stuffer" — utente con molti punti salta il check client e infila N+1 brani (la rule da sola non può contare). Chiuso "al livello formula" (90% del vettore) da `effectiveMaxAtCreate`; count effettivo = CF Fase 2. `AINULINDALE_TECHNICAL_SPEC.md:894`, `205-211`; [CLAUDE.md]

[IRRISOLTO/NOTA] Nel commento dello spec si parla di "tre punti" / il check client conta anche `'playing'`; la spec §7 elenca per la rule `status in ['queued','transferring','ready']` (senza `playing`). `AINULINDALE_TECHNICAL_SPEC.md:613` vs `useAudioQueue.ts:74`.

---

### B. Trasferimento P2P WebRTC (`src/utils/webrtc.ts`)

**Costanti esatte**
- `STUN_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }`. `webrtc.ts:4-8`
- `CHUNK_SIZE = 16384; // 16KB`. `webrtc.ts:10`
- `MAX_TOTAL_CHUNKS = 3200` — commento: "3200 × 16KB = 51.2MB, just above the 50MB per-track ceiling. A proposer declaring `totalChunks: 99999999` would otherwise trigger an unbounded receiveBuffer allocation". `webrtc.ts:11-15`
- Timeout connessione/ricezione: `15000 // 15 seconds`, in `resetTimeout()`, ri-armato a ogni chunk. `webrtc.ts:63-72`, `252`
- `expireAt` signaling: `Timestamp.fromMillis(Date.now() + 60_000)`. `webrtc.ts:121`

**Header meta JSON**
- Inviato come stringa prima dei binari: `this.dataChannel.send(JSON.stringify({ type:'meta', totalChunks, mimeType: blob.type }))` con `totalChunks = Math.ceil(blob.size / CHUNK_SIZE)`. `webrtc.ts:287-292`
- Validazione difensiva lato DJ alla ricezione: rifiuta se `!mime.startsWith('audio/')` ("MIME non valido: atteso audio/*…"); rifiuta se `!Number.isInteger(total) || total <= 0 || total > MAX_TOTAL_CHUNKS` ("Numero di chunk fuori intervallo"). Poi setta `expectedChunks`, `receiveMime`, azzera `receiveBuffer`/`receivedChunks`. `webrtc.ts:228-247`

**Backpressure (bufferedAmount)**
- `if (this.dataChannel!.bufferedAmount > CHUNK_SIZE * 64) { setTimeout(sendNextChunk, 50); return; }` — soglia = 16384*64 = 1.048.576 byte (1MB), retry ogni 50ms. `webrtc.ts:304-308`
- Invio via `FileReader.readAsArrayBuffer` su `blob.slice(offset, offset+CHUNK_SIZE)`, `onload` → `dataChannel.send(result)`, `offset += CHUNK_SIZE`, `chunkIndex++`, progress, ricorsione `sendNextChunk()`. `webrtc.ts:294-329`

**DataChannel**
- DJ: `createDataChannel('audio', { ordered: true })`. `webrtc.ts:107`
- `binaryType = 'arraybuffer'`. `webrtc.ts:217`
- Ricezione binaria: `receiveBuffer.push(event.data)`, `receivedChunks++`, progress `Math.floor((receivedChunks/expectedChunks)*100)`, e su `receivedChunks === expectedChunks` → `assembleBlob()`. `webrtc.ts:249-261`
- `assembleBlob()`: `new Blob(this.receiveBuffer, {type: this.receiveMime})` → `onTrackReceived(blob)`. `webrtc.ts:272-279`

**Signaling su Firestore (sub-collection)**
- Path: `doc(db, 'audio_sessions', sessionId, 'signaling', proposerId)`. `webrtc.ts:80`, `89`, `113`, `133`, `172`, `185`, `352`
- DJ (`initiateAsDJ`): `createOffer`+`setLocalDescription`, scrive `djOffer:{sdp,type,queueItemId,createdAt:Timestamp.now()}` + `expireAt` (merge). `webrtc.ts:74-125`
- Proposer (`answerAsProposer`): `setRemoteDescription(djOffer)` → `createAnswer` → scrive `proposerAnswer:{sdp,type,createdAt}`. `webrtc.ts:127-182`
- ICE: `onicecandidate` → `arrayUnion` su `djCandidates`/`proposerCandidates` con `{candidate, sdpMid, sdpMLineIndex, addedAt: Timestamp.now()}`, fallback `setDoc(...,{merge:true})` se doc non esiste. `webrtc.ts:78-97`, `131-149`
- `subscribeToSignaling`: DJ applica `proposerAnswer` (solo se `signalingState !== 'stable'`) e `proposerCandidates`; proposer applica `djCandidates`. `webrtc.ts:184-214`
- Cleanup: `destroy()` chiude dataChannel + peerConnection + `deleteDoc(signaling/{proposerId})` best-effort ("CF cleanupOrphanSignaling (Phase 2) catches anything we miss", Spec §8 step 21). `webrtc.ts:336-353`

**Connection state / errori**
- `onconnectionstatechange`: `'connected'`→`onConnected()`; `'failed'|'disconnected'`→`handleError('Connessione interrotta')`. `webrtc.ts:99-105`, `151-157`
- `dc.onclose` lato DJ con `receivedChunks < expectedChunks` → "Connessione persa prima della fine del file". `webrtc.ts:265-269`
- `handleError` → `onError` + `destroy()`. `webrtc.ts:331-334`

**Fast-path DJ-locale** (`src/utils/djEngine.ts`, non in webrtc.ts)
- Dipendenza opzionale `getLocalTrackBlob: (localTrackId) => Promise<Blob|null>`. `djEngine.ts:44`, `61`, `71`
- In `startTransfer`: `if (this.getLocalTrackBlob && this.session && item.proposedBy === this.session.djId) { getLocalTrackBlob(item.localTrackId).then(blob => blob ? onReady(blob) : onFail('Brano non trovato nella biblioteca locale del DJ.')) … return; }`. `djEngine.ts:193-201`
- Motivazione: trasferire a se stessi "would wedge — both peers share an UID, the signaling sub-collection collides, and the listener never produces an answer → status stuck at 'transferring' forever". `djEngine.ts:38-44`, `186-192`

**Hook `useWebRTCTransfer.ts`**
- `useWebRTCTransferDJ`: crea `new WebRTCTransfer('dj', sessionId, proposerId, queueItemId, {...})` e chiama `initiateAsDJ()`; espone `initiateTransfer/transferringItemId/progress/error`. `useWebRTCTransfer.ts:8-45`
- `useWebRTCTransferProposer`: `onSnapshot(signaling/{user.uid})`; legge `djOffer`; scarta offer stale (`Date.now() - offerTsMs > 60_000`); legge `createdAt` sia Timestamp che legacy epoch ms ("was epoch ms before B7 hardening"); recupera `localTrackId` da queue item → `getTrack` da IndexedDB; `new WebRTCTransfer('proposer', ...)`; su `onConnected` → `sendBlobBinary(localTrack.blob)` poi `setTimeout(()=>setIsTransferring(false), 2000)`. `useWebRTCTransfer.ts:47-120`

**Flow completo (spec, 22 step)** — STUN→createOffer→Firestore djOffer→proposer answer→ICE arrayUnion→DataChannel open→`transferring`→chunk 16KB→riassembla→`ready`→close→delete signaling→play. `AINULINDALE_TECHNICAL_SPEC.md:651-690`

**Sicurezza & vincoli (spec)**: max 50MB → max 3200 chunk; MIME whitelist `audio/*`; hash SHA-256 opzionale (Fase 2/3, `validateP2PTransferIntegrity` skeleton, richiede campo `blobSha256`); su sessione `closed` durante transfer il DJ chiude le RTCPeerConnection. `AINULINDALE_TECHNICAL_SPEC.md:718-723`, `1087`

**Fallback / edge**: proposer offline → 15s timeout → `failed` → engine skippa; "Curation Pura" se WebRTC assente o 3 transfer consecutivi falliscono (DJ suona dalla sua libreria). `AINULINDALE_TECHNICAL_SPEC.md:754-760`

[IRRISOLTO] Lo spec §8 (pseudocodice) usa `Promise.race([doWebRTCTransfer, sleep(15000)])` e una classe `WebRTCTransfer(role, sessionId, otherUserId)` con `receivedChunks: Map<number,ArrayBuffer>`; l'implementazione reale usa timeout via `setTimeout`/`resetTimeout`, costruttore `(role, sessionId, proposerId, queueItemId, cb)` e `receiveBuffer: ArrayBuffer[]`. Spec ≠ codice (spec è blueprint). `AINULINDALE_TECHNICAL_SPEC.md:694-752` vs `webrtc.ts:17-61`, `27`

---

### C. IndexedDB (`src/utils/indexedDB.ts`)

**Schema**
- `DB_NAME = 'marzio1777_audio'`; `DB_VERSION = 1`. `indexedDB.ts:3-4`
- Store `tracks`, `keyPath: 'id'`. `indexedDB.ts:33-34`
- Indici su `tracks`: `artist`, `album`, `year`, `lastPlayedAt`, `isFavorite` (tutti `{unique:false}`). `indexedDB.ts:35-39`
- Store `playlists`, `keyPath: 'id'` (nessun indice). `indexedDB.ts:42-44`
- Spec dichiara indici identici: `['artist','album','year','lastPlayedAt','isFavorite']`. `AINULINDALE_TECHNICAL_SPEC.md:296`
- `onversionchange` → `close()` + `dbInstance=null`. `indexedDB.ts:22-25`
- Istanza cache-ata in modulo (`let dbInstance`). `indexedDB.ts:6`, `10-13`, `19`

**API**: `addTrack` (`store.add`), `getTrack` (`get`), `getAllTracks` (`getAll`, sort `b.uploadedAt - a.uploadedAt`), `searchTracks` (filter su title/artist/album lowercase), `deleteTrack`, `updateTrack` (`put`), `getStorageQuota` (`navigator.storage.estimate()` → `{used,total}`), `getPlaylists`, `addPlaylist`. `indexedDB.ts:49-158`

**Regola "mai audio su cloud"** — fatti dichiarati:
- "Mai file audio su Firebase Storage. I bytes vivono in IndexedDB locale (`marzio1777_audio` v1, store `tracks` + `playlists`). Su Firestore solo metadati (titolo, artista, durata, cover ≤50KB base64)." [CLAUDE.md §L'Ainulindalë]
- Spec: "I file MP3/M4A/OGG/FLAC vivono nel device dell'utente, in IndexedDB. Non finiscono mai su Firebase Storage. … Solo metadati … viaggiano." `AINULINDALE_TECHNICAL_SPEC.md:36`, `32`
- `QueueItem.localTrackId` = "id IndexedDB lato proponente, NON un URL — serve solo per il P2P". `AINULINDALE_TECHNICAL_SPEC.md:182-184`

**Quota / limiti**
- Limite per traccia 50MB applicato all'upload: `if(file.size > 50 * 1024 * 1024) continue;` + `if(!file.type.startsWith('audio/')) continue;`. `useLocalLibrary.ts:35-36`
- Spec: limite per traccia 50MB; browser ~50% spazio device; avviso quota >80%; cleanup manuale. `AINULINDALE_TECHNICAL_SPEC.md:323-327`
- `LocalTrack` campi: `id, title, artist, album?, year?, genre?, durationMs, coverDataUrl?, blob:Blob, mimeType, sizeBytes, uploadedAt, lastPlayedAt?, playCount, isFavorite, customTags[]`. `AINULINDALE_TECHNICAL_SPEC.md:266-293`; popolati in `useLocalLibrary.ts:43-59` (id `crypto.randomUUID()`, `mimeType: file.type || 'audio/mp3'`, `uploadedAt: Date.now()`, `playCount:0`, `isFavorite:false`, `customTags:[]`).

---

### D. AudioEngine (`src/utils/audioEngine.ts`)

**Singleton**
- `private static instance: AudioEngine | null`; `private constructor()`; `getInstance()` lazy; `getAudioEngine()` export ritorna `AudioEngine.getInstance()`. `audioEngine.ts:2`, `15`, `62-67`, `150-152`
- `destroy()` azzera `AudioEngine.instance = null`. `audioEngine.ts:142-147`
- Spec/CLAUDE: "Web Audio Context una sola istanza per app" / "non istanziare `AudioContext` altrove". `AINULINDALE_TECHNICAL_SPEC.md:1061`; [CLAUDE.md]

**Grafo nodi** (`audioEngine.ts:43-49`)
- `sourceNode → gainNode → eqLow → eqMid → eqHigh → analyser → ctx.destination`
- `sourceNode = ctx.createMediaElementSource(audioEl)`; `audioEl.crossOrigin = 'anonymous'`. `audioEngine.ts:17-20`

**EQ — frequenze / Q esatti**
- `eqLow`: type `'lowshelf'`, `frequency.value = 320`. `audioEngine.ts:24-26`
- `eqMid`: type `'peaking'`, `frequency.value = 1000`, `Q.value = 0.5`. `audioEngine.ts:28-31`
- `eqHigh`: type `'highshelf'`, `frequency.value = 3200`. `audioEngine.ts:33-35`
- `setEQ(low,mid,high)` clamp gain a `Math.max(-12, Math.min(12, x))` (±12 dB). `audioEngine.ts:104-108`
- `setVolume(v)` clamp `Math.max(0, Math.min(1, v))`. `audioEngine.ts:100-102`

**Analyser**
- `analyser.fftSize = 128` — commento: "128 → 64 frequency bins, fed to the 32-bar visualizer. Lighter than 256 … aligned with TECHNICAL_DOCS_IT §4.13 / AINULINDALE_TECHNICAL_SPEC §9." `audioEngine.ts:37-40`
- Spec §9 Visualizer: `analyser.fftSize = 128; new Uint8Array(analyser.frequencyBinCount)`. `AINULINDALE_TECHNICAL_SPEC.md:837-838`

**Eventi / API**: eventi `ended|play|pause|timeupdate|error` via `on/off/emit` (listeners map). Su `play` resume del context se `suspended` ("Must resume context on mobile"). `load(blob|string)` revoca URL precedente se `blob:` e crea `URL.createObjectURL`. `seek` clamp [0, duration]. `audioEngine.ts:51-141`, `69-98`, `122-140`

**Hook avvolgenti**
- `useAudioEngineRaw` (DJ): "Keep this hook *thin*: no localStorage, no Media Session, no Wake Lock." Espone `engine, isPlaying, playBlob, pause, resume, stop (pause+seek 0), getCurrentTime, getDuration`. `useAudioEngineRaw.ts:4-49`
- `useAudioPlayer` (Walkman): vedi §F.

---

### E. DJEngine — coda FIFO / ciclo di vita (`src/utils/djEngine.ts`)

- `BASE_TRACK_POINTS = 2`. `djEngine.ts:5`
- Stati engine: `'idle' | 'playing' | 'transferring' | 'paused'`. `djEngine.ts:3`
- Loop: `setInterval(() => this.tick(), 1000)`. `djEngine.ts:81-84`
- Dependency injection (constructor deps): `onStateChange, initiateTransfer, updateSession, setItemStatus, playBlob, stopAudio, getAudioProgress, getServerTimestamp, getLocalTrackBlob?`. `djEngine.ts:49-72`
- `updateState(queue, session, eventMultiplier=1)`. `djEngine.ts:74-79`
- **Pre-fetch 30s**: in mode `'auto'`, `timeRemainingMs <= 30000 && timeRemainingMs > 0` → `startTransfer(nextItem)` se non già transferring/pending. `djEngine.ts:134-140`
- **Polling fine-traccia triplo-guardato**: `prog.currentTime > 0 && sinceStart >= 2000 && timeRemainingMs <= 250` → `handleEndOfTrack()`. Guard contro bug "all-played-instantly" su src-swap. `djEngine.ts:110-132`, `playStartedAt` `djEngine.ts:23`, `237`
- Re-entrancy guard `isHandlingEnd` per 'ended' event + polling fallback. `djEngine.ts:29`, `278-293`
- `handleTrackEnded()` pubblico (source-of-truth: AudioEngine 'ended'). `djEngine.ts:295-300`
- `markCurrentPlayed(skipped=false)`: `pts = skipped ? 0 : Math.round(BASE_TRACK_POINTS * this.eventMultiplier)` → setItemStatus `'played'|'skipped'` con `pointsAwarded`. `djEngine.ts:262-272`
- `pendingBlobs: Map<string,Blob>` mantiene solo blob `ready`/`playing` (GC degli altri in `playItem`). `djEngine.ts:14`, `252-259`
- `startTransfer`: setItemStatus `'transferring'` con `transferStartedAt: getServerTimestamp()`; `onReady`→`'ready'`+`transferCompletedAt`; `onFail`→`failedItems.add` + `'failed'` + `transferFailureReason`. `djEngine.ts:163-204`
- Status QueueItem (8): `queued|transferring|ready|playing|played|skipped|failed`. `AINULINDALE_TECHNICAL_SPEC.md:187-194`
- Transizioni valide (rule, post-B7): `queued→transferring|skipped`, `transferring→ready|failed`, `ready→playing|skipped`, `playing→played|skipped`, `failed→skipped`; abolito shortcut `queued→ready/failed`. `AINULINDALE_TECHNICAL_SPEC.md:617-625`, `879-888`

---

### F. Walkman — `useAudioPlayer.ts` / `useAudioSession.ts` / `useLocalLibrary.ts`

**useAudioPlayer (state-level Walkman)**
- localStorage keys: `ainulindale_volume` (default '1'), `ainulindale_shuffle`, `ainulindale_repeat` ('off'|'one'|'all'), `ainulindale_bg_playback`. `useAudioPlayer.ts:17-20`, `188`, `198`, `205`, `211`
- `useWakeLock(bgPlayback && isPlaying)`. `useAudioPlayer.ts:24`
- Media Session: `MediaMetadata{title,artist,album,artwork[{src:coverDataUrl,sizes:'512x512',type:'image/jpeg'}]}` + action handler play/pause/previoustrack/nexttrack/seekbackward(±d.seekOffset??10)/seekforward/seekto. `useAudioPlayer.ts:74-91`
- `repeat 'one'` → seek(0)+play; altrimenti `next()`. shuffle → `Math.floor(Math.random()*queue.length)`. `prev()`: se `currentTime>3` → seek(0). `useAudioPlayer.ts:52-59`, `127-157`
- `playTrack`: `engine.load(track.blob)`+`play()`, poi commit state, `track.playCount += 1`, `track.lastPlayedAt = Date.now()`, `db.updateTrack` fire-and-forget. `useAudioPlayer.ts:104-125`
- `setEQ(low,mid,high)` passa diretto a `engine.setEQ`. `useAudioPlayer.ts:191-193`

**useAudioSession**
- `joinSession` solo se `session.status === 'open'`; scrive `participants/{uid}` con `status:'joined'`, counters `tracksProposed/tracksPlayed:0` (merge). `useAudioSession.ts:39-56`
- `leaveSession` → `status:'left'`, `leftAt: serverTimestamp()`. `useAudioSession.ts:58-69`
- `closeSession(finalStats, eventMultiplier=1)`: batch atomico; `longSession = totalDurationMs > 30*60*1000`; `awardLongBonus = longSession && session?.djBonusAwarded !== true`; punti base 5 (+10 se long bonus) `× eventMultiplier` via `Math.round`; `points: increment(scaled)` su `users/{uid}`; flag `djBonusAwarded=true` (one-way). Solo se `totalTracksPlayed > 0`. `useAudioSession.ts:80-120`
- `useAudioSessionsList`: query `where('status','==','open')`, `orderBy('createdAt','desc')`. `useAudioSession.ts:125-145`

**useAudioQueue (oltre §A)**
- Listener queue: `orderBy('position','asc')`. `useAudioQueue.ts:32-43`
- Discordante gagliardetto: su transizione propri item `queued|transferring|ready → skipped` → `metrics.consecutiveSkipped` `increment(1)`; `playing→played` → reset a 0; idempotency via `lastStatusRef: Map<itemId,status>`. `useAudioQueue.ts:45-66`
- Check duplicati (in-hook) solo se `!session.rules.allowDuplicates`: confronto `trackTitle`+`trackArtist` lowercase. La variante standalone salta il check duplicati. `useAudioQueue.ts:81-89`, `169-176`
- `newItem` campi: `proposedBy, proposedByName, proposedByPhotoURL, proposedAt:serverTimestamp(), trackTitle, trackArtist, trackAlbum, trackDurationMs, localTrackId, status:'queued', position:maxPos+1, effectiveMaxAtCreate, trackCoverDataUrl?`. `useAudioQueue.ts:123-142`
- `position = max(positions)+1`. `useAudioQueue.ts:120`, `231`
- `proposeTrackToSession` auto-crea/ripristina `participants/{uid}` (status `'joined'`) prima del `setDoc` queue (rule `isSessionParticipant`). `useAudioQueue.ts:192-207`; `AINULINDALE_TECHNICAL_SPEC.md:1136-1158`
- `withdrawProposal` = `deleteDoc` item; `reorderQueue` = batch update `position: idx+1`. `useAudioQueue.ts:145-164`

---

### G. ID3 parser (`src/utils/id3.ts`)

- Legge `file.slice(0, 10 * 1024 * 1024)` (primi 10MB). `id3.ts:47`
- Magic `'ID3'` (0x49 0x44 0x33); versioni accettate 3 o 4 (ID3v2.3/2.4), altrimenti `parseFilename`. `id3.ts:51-59`
- Size syncsafe: `(b6<<21)|(b7<<14)|(b8<<7)|b9`. `id3.ts:62`
- Frame size: v3 `getUint32`, v4 syncsafe. `id3.ts:84-90`
- Frame estratti: `TIT2`→title, `TPE1`→artist, `TALB`→album, `TYER`|`TDRC`→year (parseInt 4 char), `TCON`→genre, `APIC`→coverDataUrl. `id3.ts:105-153`
- Guard anti-allocazione: frame `> 5*1024*1024` saltato. `id3.ts:100-103`
- Encoding: 0 ISO-8859-1, 1 UTF-16 BOM, 2 UTF-16BE, 3 UTF-8 (TextDecoder). `id3.ts:3-30`
- APIC → `data:${mimeType};base64,${btoa(binary)}`. `id3.ts:143-152`
- Fallback filename pattern `Artist - Title.ext`; default `'Unknown Artist'`. `id3.ts:32-42`, `162-166`
- `parseAudioFile`: calcola `durationMs` via `AudioContext.decodeAudioData(file.arrayBuffer())` (`audioBuffer.duration*1000`), poi `audioCtx.close()`; fallback 0 su errore. `id3.ts:169-195`

---

### H. Note trasversali / [IRRISOLTO]

- Spec §3 dichiara `QueueItem.status` include `failed` ma il diagramma §7 mostra `failed → skipped` aggiunto solo post-B7. `AINULINDALE_TECHNICAL_SPEC.md:541-553` vs `622`
- Indici Firestore consigliati: `audio_sessions(status,createdAt)`, `(djId,status)`; `queue(status,position)`, `(proposedBy,status)`. `AINULINDALE_TECHNICAL_SPEC.md:248-255`
- Gamification audio (tabella punti): upload +1, propose +1, traccia suonata +2 (`×eventMultiplier`), DJ ≥1 traccia +5, DJ >30min +10. `AINULINDALE_TECHNICAL_SPEC.md:922-930`
- [INFERENZA] La triade Sito1/Sito2/Sito3 è completa nei sorgenti assegnati solo per il Sito 1 (client); Sito 2 (CF) e Sito 3 (rule) sono attestati dalla chiamata client + dalla documentazione CLAUDE.md/spec, non da `functions/src/index.ts` né `firestore.rules` (non assegnati / non letti).
- Cleanup signaling: client best-effort (`webrtc.ts:352`) + CF `cleanupOrphanSignaling` (cron 5 min, `europe-west1`, `expireAt < now`). `AINULINDALE_TECHNICAL_SPEC.md:1088`; [CLAUDE.md]

---

## Tema: gaming

### Macchina a stati eventi (transizioni)

- Ciclo di vita codificato: `[draft] → [scheduled] → [lobby] → [active] → [completed]`, con ramo laterale `[active] → [aborted]`. Fonte: GAMING_SYSTEM_IT.md §3.1 (righe 106-110).
- Significato stati: `draft` admin configura, evento invisibile; `scheduled` pubblicato, inviti partiti, countdown attivo; `lobby` 5 min pre-kickoff, sala d'attesa, permessi richiesti; `active` gioco in corso, leaderboard live; `completed` terminato, snapshot finale; `aborted` annullato (es. maltempo), nessun punto assegnato. Fonte: GAMING_SYSTEM_IT.md §3.1 (righe 112-117).
- "Le transizioni sono codificate in una rule helper `validStatusTransition(old, new)` e validate server-side. Ogni cambio di stato non lecito è respinto." Fonte: GAMING_SYSTEM_IT.md:119.
- Implementazione effettiva delle transizioni in `src/utils/eventState.ts`:
  - `if (oldStatus === newStatus) return true;` (identity transition ammessa). Fonte: eventState.ts:2.
  - `draft` → `['scheduled', 'aborted']`. Fonte: eventState.ts:4.
  - `scheduled` → `['lobby', 'active', 'aborted']`. Fonte: eventState.ts:5.
  - `lobby` → `['active', 'aborted']`. Fonte: eventState.ts:6.
  - `active` → `['completed', 'aborted']`. Fonte: eventState.ts:7.
  - default `return false;` (`completed`/`aborted` sono terminali, nessuna uscita). Fonte: eventState.ts:9.
- [INFERENZA] Lo `scheduled → active` diretto è ammesso dal codice (eventState.ts:5) anche se il diagramma §3.1 mostra il passaggio via `lobby`; coerente con il pulsante "Anticipa l'Inizio" descritto in §4.3 (riga 202).
- Sporca #21 "The Time Bandit" — salto di stato `draft → completed`. Bloccato. Fonte: GAMING_SYSTEM_IT.md:470.
- Tipo runtime stato evento: `status: 'draft' | 'scheduled' | 'lobby' | 'active' | 'completed' | 'aborted'`. Fonte: useGameEvents.ts:11.
- L'unica scrittura di `finalLeaderboard` avviene nella transizione `active → completed`. Fonte: CLAUDE.md (sez. Il Campo dei Giochi); useGameEvents.ts:208-237.

### I due Concept

- Principio 3: "A è Outdoor, B è Indoor; entrambi sono Marzio." I due Concept sono complementari, non ridondanti. Fonte: GAMING_SYSTEM_IT.md:33-34.
- Due `type` sullo stesso doc `game_events`: `treasure_hunt` (Concept A, AR capture geolocalizzata) e `photo_quiz` (Concept B, host rotativo). Config type-specific in `treasureHuntConfig` / `photoQuizConfig`. Fonte: CLAUDE.md (Il Campo dei Giochi); useGameEvents.ts:10, 21-32.
- I due Concept condividono il 100% dell'infrastruttura eventi; collezione root `game_events`. Fonte: GAMING_SYSTEM_IT.md:102.
- Differenziazione visiva: Concept A Caccia = verde foresta + ambra; Concept B Quiz = blu indaco + oro. Fonte: GAMING_SYSTEM_IT.md:543-544.

#### Concept A — La Caccia ai Ricordi (treasure_hunt / AR)

- "Il Pokémon GO marziese: un treasure hunt geolocalizzato dove i giocatori girano fisicamente per le strade di Marzio col telefono in mano, e la fotocamera si attiva al raggiungimento dell'oggetto." Fonte: GAMING_SYSTEM_IT.md:161.
- 4 modalità di spawn nel wizard `GameCreator`: Auto-spawn per raggio; Spawn manuale (Piazzamento Tattico); Spawn ibrido; Spawn da archivio (Post Legacy). Fonte: GAMING_SYSTEM_IT.md §4.1 (righe 165-186).
- 5 preset di temi: 🍺 Birra di Ferragosto (10pt birre comuni, 5pt boccali, 1pt sottobicchieri); 🍄 Foraggiamento Autunnale (10pt porcini, 5pt finferli, 1pt foglie); 🎃 Halloween in Paese; 🏔️ Trekking del Monarca (punteggi alti); 🍁 Modalità Amsterdam. Fonte: GAMING_SYSTEM_IT.md §4.2 (righe 192-196).
- Loop di caccia: `watchPosition` con `enableHighAccuracy: true, timeout: 15000, maximumAge: 2000`; Haversine giocatore↔items a ogni update; throttle se movimento < 2m; se distanza < `captureRadius` (default 15m) → stato `capturable` (pulsa, `navigator.vibrate(60)`, pulsante "📸 Cattura!"). Fonte: GAMING_SYSTEM_IT.md §4.3 (righe 206-215).
- Hot/Cold radar e Compass arrow (via `webkitCompassHeading` o `alpha`). Fonte: GAMING_SYSTEM_IT.md:217-219.
- End-game naturale (tutti items collected) o manuale (admin/root); snapshot leaderboard salvato come `finalLeaderboard` embedded immutabile. Fonte: GAMING_SYSTEM_IT.md:221.

#### Concept B — Il Quiz del Bivacco (photo_quiz / host rotativo)

- "Photo-trivia multiplayer real-time. Si gioca seduti... anche a distanza. Estende `Indovina Chi/Indovina l'Anno` (single-player nel Cinematografo) al multiplayer sincrono." Fonte: GAMING_SYSTEM_IT.md:245.
- 5 tipi di domanda: Indovina Chi (`post.taggedPeople[]`/`post.authorName`); Indovina l'Anno (`post.decade` ±5); Indovina il Luogo (`post.location` reverse-geocoded); Indovina la Didascalia (`post.caption` + 3 fake); Cronologia (mix di `post.decade`). Fonte: GAMING_SYSTEM_IT.md §5.1 (righe 250-254).
- Tipi runtime QuizRound: `'guess_who' | 'guess_year' | 'guess_place' | 'guess_caption' | 'chronology'`. Fonte: usePhotoQuiz.ts:11.
- Config quiz: N rounds (default 10, max 50); mix tipologie; filtro post; tempo per risposta (default 20s, range 5-60s); modalità punteggio `fixed`/`decay`; Rotate Host true/false. Fonte: GAMING_SYSTEM_IT.md §5.2 (righe 262-267).
- Quiz a distanza: "Il Quiz non richiede co-presenza fisica — è la differenza principale rispetto alla Caccia." Fonte: GAMING_SYSTEM_IT.md:344.

### Ruolo dinamico Host (rotazione + validazione)

- L'Host esiste solo durante eventi `photo_quiz`, identificato da `game_events.photoQuizConfig.currentHostId`. Fonte: GAMING_SYSTEM_IT.md:146.
- "L'Host vede la risposta corretta prima degli altri (è inevitabile e accettato come parte del meta-gioco; non avere Cloud Function lo richiede)." Fonte: GAMING_SYSTEM_IT.md:148.
- Rotazione automatica (`rotateHost: true`) o fissa; la rotazione ordina i partecipanti `joined` per `userId` (immutabile, deterministico) e usa wrap-around. Fonte: GAMING_SYSTEM_IT.md:149-150.
- "Solo l'host uscente, l'organizer o il Root possono scrivere il nuovo `currentHostId` (rule via `diff().affectedKeys()`)." Fonte: GAMING_SYSTEM_IT.md:151.
- "Il nuovo `currentHostId` deve essere un partecipante con `status == 'joined'`, validato in rule via `exists()` + `get()` sulla sub-collection participants. Questo chiude il vettore 'Self-Crowning by alien-uid' (vedi §7.1, vettore #16)." Fonte: GAMING_SYSTEM_IT.md:152.
- L'Organizer e il Root possono intervenire come "Host di emergenza" se l'attuale si disconnette. Fonte: GAMING_SYSTEM_IT.md:153.
- UI: chi è host vede banner rosso "L'Host visualizza la risposta corretta prima del reveal", gli altri vedono "Host: [displayName]". Fonte: GAMING_SYSTEM_IT.md:155.
- Implementazione rotazione in `advanceQuizRound`: se `newHostId` passato, scrive `gameUpdate['photoQuizConfig.currentHostId'] = newHostId`. Fonte: usePhotoQuiz.ts:137.
- Tipi photoQuizConfig: `currentHostId?: string`, `rotateHost?: boolean`. Fonte: useGameEvents.ts:30-31.

### Scoring (fixed / decay, floor)

- Modalità: `fixed` (10pt corretta, 0pt sbagliata) oppure `decay` (corretta veloce vale più di corretta lenta). Fonte: GAMING_SYSTEM_IT.md:266.
- Formula spec in `utils/scoring.ts`: `points = max(0, round(maxPoints × (1 - timeMs/maxTimeMs)))` "con floor a 1pt minimo se corretto entro il tempo". Fonte: GAMING_SYSTEM_IT.md §5.5 (righe 303-305).
- Implementazione effettiva `calculateQuizPoints(scoringMode, isCorrect, timeMs, maxTimeMs, maxPoints = 10)`:
  - `if (!isCorrect) return 0;` Fonte: scoring.ts:8.
  - `if (scoringMode === 'fixed') return maxPoints;` Fonte: scoring.ts:9.
  - `if (timeMs <= 0) return maxPoints;` Fonte: scoring.ts:11.
  - `if (timeMs >= maxTimeMs) return Math.max(1, Math.floor(maxPoints * 0.1));` Fonte: scoring.ts:12.
  - decay lineare: `const decay = 1 - (timeMs / maxTimeMs); return Math.max(1, Math.floor(maxPoints * decay));` Fonte: scoring.ts:20-21.
- Nota nel codice: il floor 1pt è universale per ogni risposta corretta in finestra; "the previous code dropped to 0 for very-late-but-valid answers (e.g. 9999/10000) because floor(10 * 0.0001) = 0." Fonte: scoring.ts:14-19. Confermato in CLAUDE.md (B7 punto 7.2): "`scoring.ts`: floor 1pt universale (era 0pt nel decay extreme via `Math.floor(0.49) = 0`)."
- "Il calcolo avviene lato client al momento del reveal, ma la rule Firestore valida il risultato: `pointsAwarded ∈ [0, maxPointsPerRound]` e, se `pointsAwarded > 0`, `selectedIndex == correctIndex`." Fonte: GAMING_SYSTEM_IT.md:307.
- Calcolo punti nel claim owner-side (`claimMyAnswerPoints`): `elapsedMs = ansTimeMs - startedAtMs`; `windowMs = Math.max(1, endsAtMs - startedAtMs)`; `pts = calculateQuizPoints(scoringMode, true, elapsedMs, windowMs, maxPointsPerRound)`; poi `pts = Math.max(0, Math.round(pts * eventMultiplier))`. Fonte: usePhotoQuiz.ts:220-223.

### Moltiplicatore evento

- Ogni `game_event` ha `pointsMultiplier` configurabile in range 0.5–5.0 (default 1.0). Si applica al guadagno prima che confluisca nei Punti Altitudine globali. Fonte: GAMING_SYSTEM_IT.md §2.2 (righe 56-57).
- Esempio: caccia Ferragosto moltiplicatore 2.0; cattura birra da 50pt → leaderboard evento +50pt, `users/{mario}.points` +100pt. Fonte: GAMING_SYSTEM_IT.md:59.
- "Regola d'oro: il moltiplicatore si applica solo al guadagno, mai a sottrazione. Non esistono 'giochi negativi'... l'Altitudine è una scala monotona crescente, non un saldo bancario." Fonte: GAMING_SYSTEM_IT.md:63.
- In cattura item: `pointsToAdd = itemData.points * eventMultiplier`; leaderboard evento riceve `increment(pointsToAdd)`; `users/{userId}.points` riceve `increment(pointsToAdd)`. Fonte: useGameEvents.ts:343-358. [IRRISOLTO] Discrepanza con la spec §2.2: la spec dice leaderboard evento +50 (senza moltiplicatore) e `users.points` ×2, ma il codice attuale applica `pointsToAdd` (già moltiplicato) a entrambi i target.

### Spawning (disk picking, min-sep)

- Algoritmo distribuzione: "disk point picking uniforme con jitter check di `min_separation` (default 8m, degradato automaticamente se troppo aggressivo)". Fonte: GAMING_SYSTEM_IT.md:173.
- Formule spec: `r = R × √(random())`; `θ = 2π × random()`; `lat_offset = r × cos(θ) / 111320`; `lng_offset = r × sin(θ) / (111320 × cos(centro_lat))`. Fonte: GAMING_SYSTEM_IT.md:176-180.
- Implementazione `generateUniformPointsInRadius(centerLat, centerLng, radiusMeters, count, minSeparationMeters = 8)`:
  - `maxAttempts = count * 50`. Fonte: spawning.ts:12.
  - `r = radiusMeters * Math.sqrt(Math.random())`; `θ = 2 * Math.PI * Math.random()`. Fonte: spawning.ts:16-17.
  - `latOffset = (r * Math.cos(θ)) / 111_320`. Fonte: spawning.ts:18.
  - `lngOffset = (r * Math.sin(θ)) / (111_320 * Math.cos((centerLat * Math.PI) / 180))`. Fonte: spawning.ts:19.
  - rejection sampling: `tooClose = result.some(p => haversineDistance(p, candidate) < minSeparationMeters)`; se non troppo vicino, push. Fonte: spawning.ts:22-25.
- Early return `[]` per `count<=0 || radiusMeters<=0`; clamp `cos(centerLat) >= 0.01` per i poli. Fonte: GAMING_SYSTEM_IT.md:775 (nota; helper documentato come `geoUtils.generateUniformPointsInRadius`). [IRRISOLTO] Il file letto `src/utils/spawning.ts` NON contiene early-return né clamp poli; la nota cita `geoUtils.generateUniformPointsInRadius` (in `src/lib/geoUtils.ts`, file non assegnato) — possibili due implementazioni distinte.
- Range guards lato `GameCreator`: `radius` clampato `[10, 5000]m`, `autoCount` clampato `[1, 100]`. Fonte: GAMING_SYSTEM_IT.md:743.
- Haversine usato dallo spawning (`src/utils/geo.ts`): `EARTH_RADIUS_M = 6_371_000`; ritorna `2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))`. Fonte: geo.ts:1,15. Funzione `bearing(from, to)` ritorna gradi 0-360. Fonte: geo.ts:18-33.
- Kickoff: animazione spawn fade-in scaglionato (`stagger: 0.05s`). Fonte: GAMING_SYSTEM_IT.md:204.

### Anti-cheat — transazione atomica di cattura (un solo vincitore)

- Transazione `runTransaction` (§7.2): legge `itemRef`, `if (itemSnap.data().status !== 'spawned') throw`; aggiorna item a `collected` con `collectedBy`, `collectedAt: serverTimestamp()`, `collectedAtLat/Lng`; set leaderboard con `points: increment(itemPoints)`, `captures: increment(1)`; update `users/{uid}.points: increment(itemPoints * eventMultiplier)`. Fonte: GAMING_SYSTEM_IT.md §7.2 (righe 475-502).
- "Quando due giocatori sono entrambi nel raggio, Firestore fa replay automatico delle transazioni concorrenti: la prima vince, la seconda vede `status === 'collected'` e fallisce... Niente double-spend." Fonte: GAMING_SYSTEM_IT.md:504.
- Implementazione `captureItemTransaction` (useGameEvents.ts):
  - guardia stato: `if (itemData.status !== 'spawned') throw new Error("Oggetto già catturato da qualcun altro!")`. Fonte: useGameEvents.ts:302.
  - update item: `status: 'collected'`, `collectedBy: userId`, `collectedAtLat: playerLat || null`, `collectedAtLng: playerLng || null`, `collectedAt: serverTimestamp()`. Fonte: useGameEvents.ts:335-341.
  - `pointsToAdd = itemData.points * eventMultiplier`; set leaderboard `merge: true` con increment points/captures; update `users/{userId}` con `points: increment(pointsToAdd)`. Fonte: useGameEvents.ts:343-358.
- Sporca #19 "The Ghost Capture" — cattura di item già collected. Risolto dalla `runTransaction`. Fonte: GAMING_SYSTEM_IT.md:468.

### Anti-cheat — validateCaptureDistance (Haversine server-side)

- Sporca #14 "The Teleporter": cattura senza essere nel raggio. *Limitazione MVP*: la rule Firestore non può fare Haversine; mitigazione audit log `collectedAtLat/Lng` + Cloud Function in Fase 2. Fonte: GAMING_SYSTEM_IT.md:463.
- §7.5: "✅ chiuso Fase 2 — CF `validateCaptureDistance` (Haversine server-side)". Fonte: GAMING_SYSTEM_IT.md:525. CF deployata su `europe-west1`, Maggio 2026 (Roadmap §10.1 Fase 2, riga 638; CLAUDE.md "Cloud Functions deployate").
- Wiring client: se `playerLat`/`playerLng` sono numeri, chiama `httpsCallable(functions, 'validateCaptureDistance')({eventId, itemId, playerLat, playerLng})`. Fonte: useGameEvents.ts:276-282.
- Gestione errori: se `e?.code === 'functions/out-of-range'` → `throw new Error(... 'Sei troppo distante per catturare questo oggetto.')`; qualsiasi altro errore (CF non deployata, network) → fallback legacy fast-path silenzioso con `console.warn`. Fonte: useGameEvents.ts:283-293.
- "Le coordinate `collectedAtLat/Lng` permettono in Fase 2 a una Cloud Function di validare server-side la distanza Haversine `< captureRadius`." Fonte: GAMING_SYSTEM_IT.md:504.
- Pre-check kickoff lato client (R1, commit `248b316`): `captureItemTransaction` legge `scheduledKickoff`; se `Date.now() < scheduledKickoff` lancia `Error("L'evento non è ancora ufficialmente iniziato. Aspetta il kickoff alle HH:mm.")`. Fonte: GAMING_SYSTEM_IT.md:813; useGameEvents.ts:321-328.
- Organizer auto-join (R1): `createGameEvent` chiama `setRSVP(eventId, organizerId, 'joined', identity)` dopo il `setDoc`, perché la rule `items.update` richiede `isEventParticipant(eventId)`. Fonte: GAMING_SYSTEM_IT.md:797-799; useGameEvents.ts:186-200.

### Anti-cheat — Host validato (exists() + get()) e cassaforte correctIndex

- Sporca #15 "The Phantom Host" — non-host che scrive sul `secret/correctness`. Bloccato. Fonte: GAMING_SYSTEM_IT.md:464.
- Sporca #16 "The Self-Crowning" — partecipante che si auto-promuove host O scrive un `currentHostId` "alieno". "Bloccato: rule isola le `affectedKeys()` e verifica con `exists()` + `get()` che il successore sia un participant joined." Fonte: GAMING_SYSTEM_IT.md:465.
- §7.3 La Cassaforte del Quiz: "Il `correctIndex` di un round non è MAI scritto direttamente nel doc parent prima del reveal. È salvato in una sotto-sotto-collezione `quizRounds/{roundId}/secret/correctness` accessibile solo a host triade (currentHost, organizer, Root). Al reveal, il valore viene copiato nel parent dove le rule lo rendono leggibile a tutti." Fonte: GAMING_SYSTEM_IT.md:508.
- Compromesso accettato: l'host vede la risposta corretta prima degli altri; inevitabile senza Cloud Function; banner rosso "L'Host visualizza la risposta corretta". Fonte: GAMING_SYSTEM_IT.md:510, 527.
- `revealRound(eventId, roundId)`: legge `secret/correctness`, `correctIndex = secretSnap.data()?.correctIndex ?? -1`, poi `updateDoc` del round con `status: 'revealed'`, `revealedAt: serverTimestamp()`, `correctIndex`. Non esegue scoring. Fonte: usePhotoQuiz.ts:154-163.
- 2 ruoli dinamici validati con `exists()+get()` lato rule: `currentHostId` (Quiz), `djId` (audio). Fonte: CLAUDE.md (Auth, ruoli, zero-trust).

### Anti-cheat — Score Forger e validazione pointsAwarded (post-B7)

- Sporca #17 "The Score Forger" — `pointsAwarded: 9999`. "Bloccato dalla rule, ulteriormente indurito in B7 con triplo cap difensivo (configurazione round, +1000/transaction su `users.points`, monotonicità)." Fonte: GAMING_SYSTEM_IT.md:466.
- §7.4 rule `answers.update` blinda `pointsAwarded` su due path:
  - Path self-claim (preferito): `answerUserId == request.auth.uid && isEventParticipant(eventId)`. Path host-triade (override Root recovery): `currentHostId | organizer | Root`. Fonte: GAMING_SYSTEM_IT.md:515.
  - Comune: `revealedAt != null`, `affectedKeys().hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap allineato alla config effettiva, non più solo `pointsMultiplier × 100` come pre-B7), e `selectedIndex == correctIndex` quando `pointsAwarded > 0`. Fonte: GAMING_SYSTEM_IT.md:516.
  - Triplo cap difensivo: rule `answers.update` (cap config round) + rule `users.update` (≤+1000/transaction) + increment monotono di `users.points`. Fonte: GAMING_SYSTEM_IT.md:517.
- "Un cheat che bypassa il client e scrive `pointsAwarded: 1000000` è respinto a livello DB su qualsiasi dei tre cap." Fonte: GAMING_SYSTEM_IT.md:519.
- Tipo `maxPointsPerRound?` con commento: "the rule caps the actual `pointsAwarded` at maxPointsPerRound × pointsMultiplier." Fonte: useGameEvents.ts:26-29.
- Sporca #18 "The Late Submitter" — risposta dopo `endsAt`. Bloccata dalla rule. Fonte: GAMING_SYSTEM_IT.md:467.
- Sporca #20 "The Speed Demon" — GPS spoofing da DevTools. Tollerato (community-level trust); rule respinge accuracy >100m. Fonte: GAMING_SYSTEM_IT.md:469, 526.
- Sporca #13 "The Phantom Item" — partecipante che cerca di spawnare nuovi items. Bloccato. Fonte: GAMING_SYSTEM_IT.md:462.

### Claim owner-side dei punti quiz

- §5.4 architettura real-time post-B7: "Pattern host-driven per la condivisione, owner-side per lo scoring." Fonte: GAMING_SYSTEM_IT.md:282.
- Flusso (passi salienti): Host crea `quizRounds/{roundId}` con `startedAt: serverTimestamp()`, `endsAt: startedAt + answerTime`, `sourcePostId`; `correctIndex` scritto esclusivamente in `quizRounds/{roundId}/secret/correctness`; client ascoltano con `onSnapshot`; ogni player crea `answers/{userId}` (solo prima di `endsAt`, una sola volta) con `pointsAwarded: 0` placeholder; Host preme "Rivela" → `revealRound`. Fonte: GAMING_SYSTEM_IT.md §5.4 (righe 284-291).
- "Owner-side claim: ogni client, via `useEffect` su `round.status === 'revealed'`, esegue `claimMyAnswerPoints` — una `runTransaction` locale che ricalcola `pointsAwarded` da `correctIndex + scoringMode + elapsedMs + maxPointsPerRound × eventMultiplier`, aggiorna `answers/{me}.pointsAwarded`, e se > 0 fa `increment` su `leaderboard/{me}` e `users/{me}.points`. Idempotenza via `localStorage[marzio1777:quiz-claimed:{roundId}:{uid}]`." Fonte: GAMING_SYSTEM_IT.md:292.
- Razionale split (B7): la versione precedente faceva l'host `tx.update(users/{otherUid})`, respinto perché la rule consente increment owner-side soltanto. "Lo split ribalta la pipeline: host pubblica la verità (correctIndex pubblico), ogni client la verifica e si auto-accredita. Niente bottleneck host, niente race su sessioni concorrenti, anti-cheat invariato." Fonte: GAMING_SYSTEM_IT.md:296; usePhotoQuiz.ts:148-153.
- Implementazione `claimMyAnswerPoints` (usePhotoQuiz.ts):
  - guard idempotenza: `if (hasClaimedRound(roundId, userId)) return 0;`. Fonte: usePhotoQuiz.ts:191.
  - in transazione: se round non rivelato (`round.revealedAt == null`) throw; se answer non esiste `return 0` (utente non ha risposto); se `ans.pointsAwarded > 0` già claimato in altra tab → `return 0`. Fonte: usePhotoQuiz.ts:198-210.
  - `isCorrect = ans.selectedIndex === correctIndex && correctIndex >= 0`. Fonte: usePhotoQuiz.ts:213.
  - se corretto: `tx.update(ansRef, { pointsAwarded: pts })`, set leaderboard `points: increment(pts)`, `tx.update(userRef, { points: increment(pts), 'metrics.quizStreak': increment(1) })`. Fonte: usePhotoQuiz.ts:226-244.
  - se errato/nessun punto: reset streak `tx.update(userRef, { 'metrics.quizStreak': 0 })`. Fonte: usePhotoQuiz.ts:245-251.
  - chiave idempotenza: `marzio1777:quiz-claimed:${roundId}:${userId}` settata a `'1'` post-claim. Fonte: usePhotoQuiz.ts:174, 256.
- `submitQuizAnswer` scrive `answers/{userId}` con `pointsAwarded: 0` "Will be evaluated when revealed by host". Fonte: usePhotoQuiz.ts:87-96.
- Codice morto rimosso in B7: `evaluateRoundAnswers`, `setRoundStatus`, `configureQuizRound` cancellati da `usePhotoQuiz.ts`. Fonte: CLAUDE.md (B7 punto 2).

### Gagliardetti / badge

- "I gagliardetti sono descrittivi, non punitivi: non si possono perdere, si conquistano e basta." Fonte: GAMING_SYSTEM_IT.md:86.
- Gagliardetti del Campo dei Giochi (§2.3, righe 70-76):
  - Il Cacciatore di Ricordi — completa 10 cacce con almeno una cattura.
  - Il Cacciatore Esperto — 1000 punti cumulativi da cacce.
  - Il Veggente — 50 risposte corrette consecutive nel Quiz.
  - La Memoria di Ferro — 100 risposte corrette totali nel Quiz.
  - Il Sindaco del Quiz — vincitore di 5 eventi Quiz.
  - Il Pellegrino delle Polaroid — completa 3 cacce in modalità Post Legacy.
  - L'Ospite Perfetto — 10 sessioni come Host del Quiz senza disconnessioni.
- Gagliardetti pesati letti dalla storia: "Sindaco del Quiz" da storia classifiche finali; "Il Maestro del Coro" da `finalStats.totalDurationMs ≥ 1800000`. Fonte: GAMING_SYSTEM_IT.md:95.
- Metriche tracking Fase 2.5 (commit `aba445a`): `users.{uid}.metrics.{quizStreak, consecutiveSkipped, huntsLegacyCompleted}`. Fonte: CLAUDE.md (Fase 2.5). Confermato nel codice: `metrics.quizStreak` (usePhotoQuiz.ts:243,249), `metrics.huntsLegacyCompleted` (useGameEvents.ts:356).
- Pellegrino delle Polaroid in codice: in `captureItemTransaction`, se `isLegacyHunt` (`type === 'treasure_hunt' && treasureHuntConfig.spawnMode === 'legacy_posts'`) e `isFirstCapture` (`!lbSnap.exists() || captures === 0`), bump `metrics.huntsLegacyCompleted` una volta. Fonte: useGameEvents.ts:304-332, 355-357.
- L'Ospite Perfetto rinviato a Fase 3 (richiede heartbeat host CF). Fonte: CLAUDE.md (Fase 2.5, ⏳).

### Snapshot storici / finalLeaderboard immutabile

- A fine evento, campo immutabile embedded sul doc evento: per `game_events` array `finalLeaderboard` direttamente sul parent (non più sub-collection). Fonte: GAMING_SYSTEM_IT.md §2.4 (riga 90).
- Immutabilità via rule: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))`. Mai modificati, neanche dal Root. Fonte: GAMING_SYSTEM_IT.md:92.
- Sporca #22 "The Resurrectionist" — write su `finalLeaderboard` post-completed. Bloccato dalla clausola di immutabilità. Fonte: GAMING_SYSTEM_IT.md:471.
- Race fix B7 (#5): `advanceGameEventStatus` per `active → completed` wrappa in `runTransaction` con re-check `status === 'completed'` (se già finalizzato: `return`, no-op). Lettura leaderboard fuori transazione (Firestore tx non legge query). Fonte: GAMING_SYSTEM_IT.md (storico); useGameEvents.ts:208-237.
- `tx.update(eventRef, { status: 'completed', ..., finalLeaderboard })` con `finalLeaderboard` ordinato `b.points - a.points`. Fonte: useGameEvents.ts:217-235.
- Tipo: `finalLeaderboard?: LeaderboardEntry[]` su `GameEvent`. Fonte: useGameEvents.ts:34.

### Sistema inviti / RSVP / partecipanti

- Default: tutti gli `Admin` e `Root` auto-invitati; estendibile a `Guest` approvati. RSVP a 3 stati: `invited | joined | declined`. Fonte: GAMING_SYSTEM_IT.md §3.2 (righe 124-126). [IRRISOLTO] Il tipo `Participant.status` in codice ha 4 valori: `'invited' | 'joined' | 'declined' | 'kicked'` (useGameEvents.ts:41), il quarto (`kicked`) non è nella spec §3.2.
- `setRSVP(eventId, userId, status, identity?)`: ramo update limitato dalla rule a `['status', 'respondedAt', 'shareLocationDuringEvent', 'leftAt']`; identity solo nel ramo create. Fonte: useGameEvents.ts:140-172.
- Visibilità tra giocatori: `visibilityOfOthers: boolean` (default ON) overridable per utente con `participants.shareLocationDuringEvent`; posizioni live in collezione `user_locations` (PII isolato). Fonte: GAMING_SYSTEM_IT.md §3.4 (riga 142).
- Cross-leaderboard / cross-participant fix B7 (#4): leaderboard.write ownership-stretto `userId == auth.uid || isEventOrganizer || isRoot`; participants.delete `userId == auth.uid || isEventOrganizer || isRoot`. Fonte: CLAUDE.md (B7 punto 4).

### Quiz generators (auto-generazione domande)

- Fase 2 chiusa al 4/5, poi 5/5 con Fase 2.5: 5 generators in `/src/utils/quizGenerators.ts`: `guess_who` (3 authorName distinti), `guess_year` (3 decadi + fallback ±10y/±20y), `guess_place` (Fase 2.5, reverse-geocoding Nominatim + cache Firestore), `guess_caption` (3 caption altri post), `chronology` (4 permutazioni decadi, una ordinata). Fonte: GAMING_SYSTEM_IT.md §5.6 (righe 311-329).
- Determinismo: seeded RNG `mulberry32(hashString(post.id))`; stesso `(post, pool)` → stesso output. Fonte: GAMING_SYSTEM_IT.md:336.
- `guess_place` Fase 2.5: Nominatim free tier (rate-limit 1 req/s per IP), cache `places_cache/{geoKey}` (geoKey lat/lng troncati a 4 decimali, ~11m). Tutti i 5 generator ora signature `Promise<...>`. Fonte: GAMING_SYSTEM_IT.md:340.
- Schema invariato: `sourcePostId` su `quizRounds/{roundId}` già pronto da B7; zero migration, zero cambio rule/indici. Fonte: GAMING_SYSTEM_IT.md:338.
- [IRRISOLTO] CLAUDE.md (sez. Il Campo dei Giochi) afferma "Quiz generators (`src/utils/quizGenerators.ts`): registry pluggable, in MVP tutti ritornano `null`" mentre GAMING_SYSTEM_IT.md §5.6 e §10.1 Fase 4 dichiarano i generators implementati (Maggio 2026); contraddizione di stato tra i due doc (CLAUDE.md non aggiornato sulla Fase 2 chiusa).

### Layer AR (Concept A) — sintesi

- Scelta: HTML5 Camera Overlay leggero (~0KB), NON WebXR / AR.js / MindAR. Motivo principale: iOS Safari 2026 non supporta WebXR `immersive-ar`. Fonte: GAMING_SYSTEM_IT.md §6.1 (righe 352-364).
- Stack: `<video>` da `getUserMedia` (`facingMode: 'environment'`) + `<motion.div>` overlay emoji (Framer Motion) + HUD. Fonte: GAMING_SYSTEM_IT.md §6.2 (righe 370-390).
- Cleanup obbligatorio: `stream.getTracks().forEach(t => t.stop())` su unmount/route change/`visibilitychange`; LED spento in < 500ms. Fonte: GAMING_SYSTEM_IT.md:392.
- Parallasse via DeviceOrientation (iOS `requestPermission`), `event.gamma`/`event.beta` → traslazione emoji (-20px..+20px); "È un'illusione, non vero AR." Fonte: GAMING_SYSTEM_IT.md:410-420.
- Protocollo cattura: tap → animazione → stop fotocamera → `runTransaction` (§7.2) → snackbar "+10pt" → ritorno mappa, item scompare via `onSnapshot`. Fonte: GAMING_SYSTEM_IT.md §6.3 (righe 424-430).

### useNearestItem (Hot/Cold)

- `useNearestItem(position, items)` salta item `collected`, calcola `calculateDistance` per ognuno, ritorna `{ nearestItem, distance }`. Fonte: useNearestItem.ts:16-50.
- Tipo `GameItem`: `{ id, lat, lng, points, status: 'spawned'|'collected', collectedBy, templateId, emoji?, label? }`. Fonte: useNearestItem.ts:4-14.
- `getHotColdStatus(distance)`: ≤15m "BOLLENTE! È qui vicino" (pulse, capture radius); ≤50m "Fuochino..."; ≤150m "Tiepido"; oltre "Acqua..."; null "In attesa del GPS...". Fonte: useNearestItem.ts:52-59.

### Roadmap & Cloud Functions (gaming)

- 5 fasi: Fase 0 Foundation ✅; Fase 1 Concept A MVP ✅; Fase 2 Concept A Polish (AR Layer, Compass, spawning auto/ibrido/legacy, wake lock, CF anti-cheat distanza) ✅; Fase 3 Concept B ✅; Fase 4 Concept B Espansione (generators auto, host rotativo con validazione successore ✅, decay scoring ✅); Fase 5 Polish trasversale & CF. Fonte: GAMING_SYSTEM_IT.md §10.1 (righe 634-644).
- CF gaming live (`europe-west1`, nodejs22): `validateCaptureDistance` (callable, Haversine, chiude #14), `notifyKickoff` (cron 5 min, FCM 30-min pre-kickoff + lobby), `cleanupStuckEvents` (cron daily 04:00 Rome). Fonte: CLAUDE.md (Cloud Functions deployate).
- Architettura `game_events` agnostica: nuovo `type` non richiede migrazioni. Concept futuri C (Gimkana), D (Foto-Reportage), E (Karaoke, parziale in L'Ainulindalë). Fonte: GAMING_SYSTEM_IT.md §10.2 (righe 648-652).

### Note metodologiche

- Tutti i file assegnati letti integralmente: GAMING_SYSTEM_IT.md (835 righe, lette in 2 pagine), eventState.ts (10), spawning.ts (28), scoring.ts (22), geo.ts (33), useGameEvents.ts (387), usePhotoQuiz.ts (262), useNearestItem.ts (59).
- File citati nei doc ma NON nel set assegnato (fonti secondarie, non lette qui): `src/lib/geoUtils.ts`, `src/utils/quizGenerators.ts`, `src/pages/PhotoQuizPlay.tsx`, `firestore.rules`, `functions/src/index.ts`, `src/hooks/useHighAccuracyPosition.ts` (da cui `useNearestItem` importa `calculateDistance`/`Position`).

---

## Tema: architettura-dati

### Overview architetturale & tech stack

- SPA React 19 (Functional Components, Hooks, `use()` API), build con Vite (HMR + build ottimizzate). [TECHNICAL_DOCS_IT.md:10]
- Linguaggio TypeScript, type-checking rigoroso su payload esterni e riferimenti DOM. [TECHNICAL_DOCS_IT.md:11]
- BaaS Firebase: Firestore (stato NoSQL + relazioni), Firebase Auth (OAuth Google), Firebase Storage (solo asset immagine compressi, **NON** audio). [TECHNICAL_DOCS_IT.md:12-15]
- Persistenza offline Firestore via `persistentLocalCache` (API Firebase v12+, sostituisce `enableIndexedDbPersistence` deprecata). [TECHNICAL_DOCS_IT.md:13]
- Gestione stato: React Context API (`AuthContext`) per stati globali, + `useState`/`useRef`/`useEffect` su `onSnapshot` per reattività real-time, senza Redux. [TECHNICAL_DOCS_IT.md:16]
- Storage locale audio: IndexedDB nativo (no Dexie, no idb). DB `marzio1777_audio` v1, store `tracks` + `playlists`. [TECHNICAL_DOCS_IT.md:23,460]
- P2P transfer: WebRTC nativo con signaling via Firestore (no PeerJS/simple-peer/signaling server dedicato). [TECHNICAL_DOCS_IT.md:25]
- "Tutto lo stato persistente è in Firebase (Firestore + Auth) tranne i file audio della Biblioteca personale, che vivono solo in IndexedDB locale e si trasferiscono P2P via WebRTC." [CLAUDE.md, §Architettura ad alto livello]
- Struttura DB: "struttura NoSQL basata su documenti con documenti globali normalizzati e sottocollezioni annidate per funzionalità relazionali." [TECHNICAL_DOCS_IT.md:49]
- Cloud Functions client: `getFunctions(app, 'europe-west1')`; region deve combaciare con `functions/src/index.ts`. [firebase.ts:35]
- Conteggio entità: il task e CLAUDE.md parlano di "22 entità"; **il blueprint ne definisce 20** sotto `entities` (vedi elenco sotto). [IRRISOLTO — discrepanza 20 vs 22; firebase-blueprint.json:3-404; CLAUDE.md §Documenti di riferimento]

### Config Firestore (inizializzazione)

Da `src/lib/firebase.ts:20-35` (verbatim parziale):
```
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');
```
- `firebaseConfig` letto da `import.meta.env.VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). [firebase.ts:11-18]
- `loginWithGoogle()` = thin wrapper su `signInWithPopup` (provider `GoogleAuthProvider`); NON crea il profilo utente (commento: la creazione è di `AuthContext.onAuthStateChanged`). [firebase.ts:37-43]
- `logout()` = `signOut(auth)`. [firebase.ts:45]

### Le entità Firestore — campi e tipi (firebase-blueprint.json)

**1. User** [`/users/{userId}`, blueprint:3-36, path:407-410] — "User private profiles (PII)"
- `uid` string, `displayName` string, `email` string, `photoURL` string
- `role` string enum `["Root","Admin","Guest"]`
- `accountStatus` string enum `["pending","approved"]`
- `points` number, `bio` string, `shareLiveLocation` boolean, `apiKey` string
- `animIcon` string ("'none' for plain heart"), `animSpeed` number, `animDistance` number (px), `animColor` string (tint)
- `fcmTokens` array<string> ("rule cap 20"; arrayUnion opt-in / arrayRemove opt-out + prune token invalidi da CF notifyKickoff)
- `metrics` object (Phase 2.5 gagliardetti, owner-written isolato): `quizStreak` number, `consecutiveSkipped` number, `huntsLegacyCompleted` number
- `createdAt` object (Firestore Timestamp), `updatedAt` object (Timestamp)
- required: `["uid","email","role","accountStatus"]`
- (TECHNICAL_DOCS_IT.md:51-63 elenca campi analoghi; aggiunge che `points` è incrementato via `increment()` atomico anche da Concept A/B e L'Ainulindalë)

**2. UserLocation** [`/user_locations/{userId}`, blueprint:37-56] — "Public volatile location data (split-collection PII isolation)"
- `userId` string, `displayName` string, `photoURL` string, `shareLiveLocation` boolean
- `liveLocation` object `{lat: number, lng: number, updatedAt: object}`
- required: `["userId"]`
- Pattern: "Isolata da `users` per prevenire leakage PII" (*Split Collection Pattern*). [TECHNICAL_DOCS_IT.md:65-66]

**3. Post** [`/posts/{postId}`, blueprint:57-85] — "A memory photo post or text post"
- `authorId` string, `authorName` string
- `authorPhotoURL` string ("Snapshot of the author photoURL at create time; nullable. Legacy posts omit it... added May 2026")
- `imageUrl` string, `caption` string
- `location` object `{lat: number, lng: number}` ("Optional geotag; type widened from string to object in May 2026")
- `decade` string, `timestamp` object, `likesCount` number, `likedBy` array<string>, `commentsCount` number
- `visibilityStatus` string enum `["public","private","scheduled"]`, `visibilityTime` number, `showInCinematografo` boolean
- required: `["authorId","authorName","timestamp","likesCount","commentsCount","visibilityStatus"]`
- (TECHNICAL_DOCS_IT.md:73-86 elenca `imageUrl` come "Base64 o CDN URL")

**4. Comment** [`/posts/{postId}/comments/{commentId}`, blueprint:86-98]
- `postId` string, `authorId` string, `authorName` string, `text` string, `timestamp` object
- required: `["postId","authorId","authorName","text","timestamp"]`

**5. Event** [`/events/{eventId}`, blueprint:99-113] — "Community event in Il Bivacco"
- `authorId`, `authorName`, `name`, `date` (string), `location` (string), `description`, `timestamp` (object)
- required: `["authorId","authorName","name","date","timestamp"]`

**6. EventItem** [`/events/{eventId}/items/{itemId}`, blueprint:114-125] — "Checklist item"
- `text` string, `assignedTo` string, `assignedName` string, `checked` boolean; required `["text"]`

**7. EventExpense** [`/events/{eventId}/expenses/{expenseId}`, blueprint:126-137] — "Expense item"
- `description` string, `amount` number, `paidBy` string, `paidByName` string; required `["description","amount","paidBy","paidByName"]`

**8. ChatChannel** [`/chats/{channelId}`, blueprint:138-149] — "A chat channel in L Alberone"
- `name` string, `description` string, `createdBy` string, `createdAt` object; required `["name","createdBy"]`

**9. ChatMessage** [`/chats/{channelId}/messages/{messageId}`, blueprint:150-161]
- `authorId`, `authorName`, `text`, `timestamp` (object); required `["authorId","authorName","text","timestamp"]`

**10. GameEvent** [`/game_events/{eventId}`, blueprint:162-201] — "treasure_hunt or photo_quiz"
- `type` string enum `["treasure_hunt","photo_quiz"]` ("Immutable after create")
- `status` string enum `["draft","scheduled","lobby","active","completed","aborted"]`
- `title` string maxLength 100, `description` string maxLength 500
- `organizerId` string ("users.uid; immutable after create")
- `createdAt`, `startTime` ("Lobby opening"), `scheduledKickoff` ("active transition"), `endTime`, `completedAt` (object)
- `pointsMultiplier` number minimum 0.5 maximum 5.0
- `visibilityOfOthers` boolean, `invitedUserIds` array<string> maxItems 100
- `treasureHuntConfig` object (solo se type=='treasure_hunt')
- `photoQuizConfig` object (solo se type=='photo_quiz'): `currentHostId` string, `rotateHost` boolean
- `currentParticipantsCount`, `totalItemsCount`, `itemsCollectedCount` number
- `currentRound` number ("1-indexed for photo_quiz"), `roundsPlayed` number
- `finalLeaderboard` array<object> ("Embedded immutable snapshot populated at active→completed")
- required: `["type","status","title","organizerId","createdAt"]`
- Campi aggiuntivi citati in doc/CLAUDE ma non nel blueprint: `photoQuizConfig.maxPointsPerRound` (default 100, backward-compat), `notifications.{kickoff30Notified,lobbyNotified}` (flag CF). [TECHNICAL_DOCS_IT.md:708; CLAUDE.md §CF deployate]

**11. GameItem** [`/game_events/{eventId}/items/{itemId}`, blueprint:202-223] — "only when type=='treasure_hunt'"
- `templateId` string, `emoji` string, `label` string, `points` number, `captureRadius` number (metri)
- `lat` number ("Immutable after create"), `lng` number ("Immutable after create")
- `status` string enum `["spawned","collected","expired"]`
- `spawnedAt` object, `collectedBy` string, `collectedAt` object
- `collectedAtLat`/`collectedAtLng` number ("Audit log: player-claimed coordinates at capture time")
- `legacyPostId` string ("Optional, for Post-Legacy hunt mode")
- required: `["status","lat","lng","points"]`

**12. GameParticipant** [`/game_events/{eventId}/participants/{userId}`, blueprint:224-240]
- `userId`, `displayName`, `photoURL` string
- `status` string enum `["invited","joined","declined","kicked"]`
- `invitedAt`, `respondedAt`, `joinedAt`, `leftAt` object, `shareLocationDuringEvent` boolean
- required: `["userId","status"]`

**13. QuizRound** [`/game_events/{eventId}/quizRounds/{roundId}`, blueprint:241-258] — "only when type=='photo_quiz'"
- `roundNumber` number, `sourcePostId` string ("Post used to derive the question; manual selection in MVP")
- `questionType` string enum `["guess_who","guess_year","guess_place","guess_caption","chronology"]`
- `questionText` string, `options` array<string> minItems 4 maxItems 4
- `correctIndex` number ("Filled at reveal-time only; pre-reveal lives in /secret/correctness")
- `startedAt`, `endsAt`, `revealedAt` object, `hostId` string
- required: `["roundNumber","startedAt","endsAt","hostId"]`

**14. QuizSecret** [`/game_events/{eventId}/quizRounds/{roundId}/secret/correctness`, blueprint:259-267] — "Pre-reveal vault... readable only by host triad (currentHostId, organizer, Root)"
- `correctIndex` number minimum 0 maximum 3; required `["correctIndex"]`

**15. QuizAnswer** [`/game_events/{eventId}/quizRounds/{roundId}/answers/{userId}`, blueprint:268-279] — "One answer per participant per round"
- `userId` string, `selectedIndex` number min 0 max 3, `submittedAt` object
- `pointsAwarded` number ("in [0, maxPointsPerRound]; >0 only if selectedIndex == correctIndex")
- required: `["userId","selectedIndex","submittedAt"]`

**16. GameLeaderboardEntry** [`/game_events/{eventId}/leaderboard/{userId}`, blueprint:280-295] — "Real-time leaderboard during active event; final snapshot embedded as finalLeaderboard"
- `userId`, `displayName`, `photoURL`, `points` number, `captures` number
- `correctAnswers`, `totalAnswers`, `averageResponseMs` number
- required: `["userId","points"]`

**17. AudioSession** [`/audio_sessions/{sessionId}`, blueprint:296-343] — "L'Ainulindalë DJ session"
- `type` enum `["audio_session"]`, `djId` string ("users.uid (Admin/Root); immutable after create"), `djName`, `djPhotoURL`
- `title`, `description` string
- `status` enum `["open","closed"]` ("Mono-directional; closed is terminal")
- `mode` enum `["auto","manual"]`, `createdAt` ("Immutable"), `closedAt`
- `currentQueueItemId`, `currentTrackTitle`, `currentTrackArtist` string, `currentTrackDurationMs` number, `currentTrackStartedAt` object ("Server-stamped via serverTimestamp()")
- `rules` object: `maxQueuedPerUser` number, `bonusPerHundredPoints` number, `allowDuplicates` boolean, `autoSkipOfflineProposers` boolean
- `participantCount`, `queuedCount`, `playedCount` number
- `linkedGameEventId` string ("Optional link to game_event; immutable. Inherits pointsMultiplier")
- `djBonusAwarded` boolean ("One-way flag false→true exactly once at close if totalDurationMs>30min")
- `finalStats` object (popolato atomicamente a open→closed, immutable): `totalDurationMs`, `totalTracksPlayed`, `participantsCount` number, `topProposers` array<object>, `closedAt` object
- required: `["djId","title","status","mode","rules","createdAt"]`
- (TECHNICAL_DOCS_IT.md:160-207 dà interface TS con default: `rules.maxQueuedPerUser` default 2, `bonusPerHundredPoints` default 1, `allowDuplicates` default false; `topProposers` = `Array<{userId, displayName, tracksPlayed}>`)

**18. QueueItem** [`/audio_sessions/{sessionId}/queue/{itemId}`, blueprint:344-372] — "Theme proposed by a user"
- `proposedBy` string ("immutable"), `proposedByName`, `proposedByPhotoURL`, `proposedAt`
- `trackTitle` ("immutable"), `trackArtist` ("immutable"), `trackAlbum`, `trackYear` number, `trackDurationMs` number ("immutable"), `trackCoverDataUrl` string ("base64, ≤ 50KB")
- `localTrackId` string ("IndexedDB id on proposer device; immutable")
- `status` enum `["queued","transferring","ready","playing","played","skipped","failed"]`
- `position` number ("FIFO order, riordinabile dal DJ")
- `transferStartedAt`/`transferCompletedAt` object ("Server-stamped"), `transferFailureReason` string
- `pointsAwarded` number ("Math.round(2 × eventMultiplier) at played")
- `effectiveMaxAtCreate` number ("Snapshot of bonus formula at create-time, validated by rule against effectiveMaxQueued(sessionId). Closes 90% of Sporca #24 Queue Stuffer; document-count enforcement deferred to Phase 2 CF enforceQueuePerUserLimit")
- required: `["proposedBy","trackTitle","trackDurationMs","status","localTrackId","position","effectiveMaxAtCreate"]`

**19. SessionParticipant** [`/audio_sessions/{sessionId}/participants/{userId}`, blueprint:373-389]
- `userId`, `displayName`, `photoURL`
- `status` enum `["joined","left","kicked"]`, `joinedAt`, `leftAt`, `lastSeenAt` ("Auto-heartbeat every 15s")
- `tracksProposed` number, `tracksPlayed` number; required `["userId","status"]`

**20. SignalingDoc** [`/audio_sessions/{sessionId}/signaling/{userId}`, blueprint:390-404] — "WebRTC signaling channel between proposer and DJ"
- `userId` string ("Doc ID = proposer's userId"), `sessionId` string ("Implicit in path; immutable")
- `djOffer` object, `proposerAnswer` object, `djCandidates` array<object>, `proposerCandidates` array<object>
- `expireAt` object ("~60s from creation; orphans cleaned by Phase 2 CF")
- required: `["userId","sessionId"]`
- Path note: "May 2026 — was previously a top-level collection... Read/write restricted to proposer (userId == auth.uid) or session DJ." [blueprint:483-486]

### Sub-Sub-collection / casi particolari di path

- `game_events/{eventId}/quizRounds/{roundId}/secret/correctness` — "Cassaforte separata per la risposta corretta": `correctIndex` non leggibile dai partecipanti standard, solo da `currentHostId`/Organizer/Root; al reveal viene copiato nel doc parent. [TECHNICAL_DOCS_IT.md:151-153]
- La sub-collection `game_events/{eventId}/leaderboard/{userId}` resta solo per update real-time durante `status:'active'`; **non esiste più** un documento `leaderboard/final` — lo snapshot finale è array embedded `finalLeaderboard` sul doc padre. [TECHNICAL_DOCS_IT.md:136-137]

### Indici composti (assunti / consigliati)

"Indexes consigliati" da TECHNICAL_DOCS_IT.md:263-275 (verbatim):
```
game_events:                  (status ASC, scheduledKickoff DESC)
game_events:                  (organizerId ASC, status ASC)
game_events/.../items:        (status ASC, spawnedAt ASC)
game_events/.../leaderboard:  (points DESC)
game_events/.../participants: (status ASC)
audio_sessions:               (status ASC, createdAt DESC)
audio_sessions:               (djId ASC, status ASC)
audio_sessions/.../queue:     (status ASC, position ASC)
audio_sessions/.../queue:     (proposedBy ASC, status ASC)
```
- Le rule "assumono indici composti specifici": `posts(visibilityStatus,timestamp)`, `game_events(status,scheduledKickoff)`, `queue(status,position)`, ecc. [CLAUDE.md §Auth, ruoli, zero-trust]
- Commit storico: `837f7f3` "fix(indexes): add game_events ASC composite + signaling COLLECTION_GROUP fieldOverride" (chiude FAILED_PRECONDITION sui cron). [CLAUDE.md §Storia recente]
- Reverse-geocoding `guess_place` usa cache Firestore `places_cache/{geoKey}` (collezione non nel blueprint). [TECHNICAL_DOCS_IT.md:398; CLAUDE.md §Fase 2.5]

### Routing (route table src/App.tsx)

- `BrowserRouter basename={import.meta.env.BASE_URL}`; tutte le pagine `lazy()`-imported; `<Suspense>` con `LoadingFallback`; `<ErrorBoundary>` tra `BrowserRouter` e `Suspense`. [App.tsx:41-43,38-70]
- `ProtectedRoute`: `if (loading) return null; if (!user) return <Navigate to="/" />`. [App.tsx:25-30]
- `BASE_URL` hardcoded a `/marzio1777/` in `vite.config.ts:10` per GitHub Pages. [CLAUDE.md §Comandi]

Route table (App.tsx:44-65):
- `/` → `Landing` (pubblica)
- `/dashboard` → `<ProtectedRoute><Layout /></ProtectedRoute>` (parent protetto), con:
  - index → `Navigate to="piazza" replace`
  - `piazza` → `LaPiazza`; `bivacco` → `IlBivacco`; `baule` → `IlBaule`; `mappa` → `LaMappa`; `cinematografo` → `IlCinematografo`
  - `giochi` → `IlCampoDeiGiochi`; `giochi/nuovo` → `GameCreator`; `giochi/:eventId/lobby` → `GameLobby`; `giochi/:eventId/play` → `GamePlayRouter`; `giochi/:eventId/results` → `GameResults`
  - `alberone` → `LAlberone`
  - `ainulindale/*` → `IlAinulindale` (router nidificato)
  - `profilo` → `ProfiloPersonale`; `admin` → `AdminPanel`; `istruzioni` → `Istruzioni`
- `GamePlayRouter` "smista A/B su event.type". [TECHNICAL_DOCS_IT.md:613; App.tsx:22]
- Router nidificato `ainulindale/*` (in `IlAinulindale.tsx`) — figli: `biblioteca`/default (`PersonalLibrary`), `sessioni` (`AudioSessionsList`), `sessioni/nuova` (`AudioSessionCreate`, Admin/Root only), `sessioni/:id` (`AudioSessionWrapper`, smista DJ vs Listener su `session.djId === user.uid`), `sessioni/:id/dj` (`AudioSessionDJ`). [TECHNICAL_DOCS_IT.md:616-623; CLAUDE.md §Routing & shell]
- Route audio rinominate da `/ainulindale/live/*` a `/ainulindale/sessioni/*` (commit `1226f25`, B5). [CLAUDE.md §Risolti / §Storia]

### Auth, ruoli, RBAC (src/contexts/AuthContext.tsx)

- `AuthContext` = sola fonte per `user` (Firebase `User`) e `profile` (`UserProfile | null`). [AuthContext.tsx:7-13; CLAUDE.md]
- `ROOT_EMAIL = 'nicolainformatica@gmail.com'`. [AuthContext.tsx:15]
- `LEGACY_CUTOFF = Timestamp.fromDate(new Date('2024-01-01T00:00:00Z'))`. [AuthContext.tsx:19]
- Flusso `onAuthStateChanged`: solo se `firebaseUser && firebaseUser.emailVerified`. [AuthContext.tsx:43]
- `isRoot = firebaseUser.email === ROOT_EMAIL`. [AuthContext.tsx:45]
- Creazione doc nuovo utente (`!userDoc.exists()`): `role: isRoot ? 'Root' : 'Guest'`, `accountStatus: isRoot ? 'approved' : 'pending'`, `displayName: firebaseUser.displayName || 'Nuovo Utente'`, `photoURL || ''`, `createdAt: serverTimestamp()`, `points: 0`, `shareLiveLocation: false`. [AuthContext.tsx:50-61]
- Migrazione doc esistente: se `isRoot && role != 'Root'` → `role='Root'`; se `isRoot && accountStatus != 'approved'` → `'approved'`; se `!accountStatus`: legacy (`createdAt instanceof Timestamp && createdAt < LEGACY_CUTOFF`) → `'approved'`, altrimenti `'pending'` + `console.warn`. [AuthContext.tsx:63-78]
- Profile listener: `onSnapshot(doc(db,'users',uid))` → `setProfile(...)`; unsubscribe tenuto in `profileUnsubRef` (useRef) per detach garantito su transizione auth (fix leak B7). [AuthContext.tsx:84-89,29-37,95-98]
- Live location: secondo `useEffect` attivo solo se `user && profile?.shareLiveLocation && navigator.geolocation`; fa `setDoc(user_locations/{uid}, {userId, displayName, photoURL, shareLiveLocation:true}, {merge:true})` poi `watchPosition` → `updateDoc` `liveLocation:{lat,lng,updatedAt:serverTimestamp()}`; opzioni `{enableHighAccuracy:true, timeout:10000, maximumAge:0}`. [AuthContext.tsx:101-130]
- Ruoli: `Root | Admin | Guest`; stati: `pending | approved`. [CLAUDE.md §Auth; blueprint:12-13]
- Gerarchia (3 livelli + 2 dinamici): **Root** (`isRoot()`, bypassa ogni limite); **Admin** (approva utenti in coda, promuove Guest→Admin, crea game events e Sessioni del Coro); **Guest/Pending** (read-only ristretto, non vedono `game_events`/`audio_sessions`); **Round Host** (dinamico, solo Quiz, via `photoQuizConfig.currentHostId`, helper `isCurrentHost(eventId)`); **Session Conductor** (dinamico, L'Ainulindalë, `djId`, helper `isSessionDJ(sessionId)`). [TECHNICAL_DOCS_IT.md:287-292]
- Regola Root-by-email duplicata in `firestore.rules` `isRoot()` su `request.auth.token.email`. [CLAUDE.md §Auth]
- 2 ruoli dinamici validati lato rule con `exists()+get()`: `currentHostId` (quiz) e `djId` (audio). [CLAUDE.md §Auth]
- Cap increment `users.points`: +1000/transaction (era +50 pre-B7). [TECHNICAL_DOCS_IT.md:302; CLAUDE.md §B7]

### Tipi TypeScript (collegamento schema → codice)

- `src/types.ts` (root): `UserProfile`, `UserRole`, `AccountStatus`, `Post` (con `location: PostLocation | null` = `{lat,lng}`, non più stringa), `PostLocation`, `QuizQuestion`, re-export di `QuestionType`/`GeneratedQuestion` da `quizGenerators`. [CLAUDE.md §Convenzioni di codice]
- `src/types/audio.ts`: tipi Ainulindalë (include `effectiveMaxAtCreate` su `QueueItem`, `djBonusAwarded` su `AudioSession`). [CLAUDE.md]
- **Nessun `types/games.ts`**: `GameEvent`, `GameItem`, `QuizRound`, `Answer` inline nei rispettivi hook (`useGameEvents`, `useNearestItem`, `usePhotoQuiz`). [CLAUDE.md]
- Gap tipo noto: `fcmTokens` usato da `useFCM.ts` + rule ma **non dichiarato in `UserProfile`** (`src/types.ts`). [IRRISOLTO non bloccante; CLAUDE.md §Fix permessi 2026-05-23]

### Note di provenienza / metodo

- File letti integralmente: `firebase-blueprint.json` (488 righe), `src/App.tsx` (72 righe), `src/contexts/AuthContext.tsx` (148 righe), `src/lib/firebase.ts` (46 righe), `public/docs/TECHNICAL_DOCS_IT.md` (866 righe, lette in 2 pagine, integrale).
- [INFERENZA] Gli "indexes consigliati" in TECHNICAL_DOCS §2 sono dichiarati come consigliati/assunti, non necessariamente coincidenti con `firestore.indexes.json` reale (file non incluso tra le fonti assegnate); la verifica del file indici resta fuori scope.
- [IRRISOLTO] Conteggio "22 entità" (task + CLAUDE.md) vs 20 entità effettivamente definite in `firebase-blueprint.json` (`entities`).

---

## Tema: performance-pwa

### Strategia PWA — configurazione `vite-plugin-pwa`

- Plugin PWA: `VitePWA` importato da `vite-plugin-pwa` e registrato in `plugins`. — `vite.config.ts:5,14`
- `registerType: 'autoUpdate'`. — `vite.config.ts:15`
- `includeAssets: ['icon.svg', 'docs/*.md']`. Commento nel file: "Bundles the icon into the precache so first-install works offline (the previous DiceBear CDN reference required network on first run)." — `vite.config.ts:16-18`
- `workbox.globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,md}']`. Commento: "Default Workbox globPatterns excludes .md — add it so the SW precaches the Istruzioni documents for offline-first reading." — `vite.config.ts:19-23`
- `base: env.VITE_BASE_PATH || '/marzio1777/'` (base path per-istanza, override via `VITE_BASE_PATH`, default istanza Marzio). — `vite.config.ts:10`
- App "auto configurata in PWA via webmanifest a compilation avvenuta". — `TECHNICAL_DOCS_IT.md:677`
- Auto-update: "silent quando tab nascosto + pill manuale + toast verde post-reload (commit `e50724f` + `cf4353c`)". — `STATO_PROGETTO.md:1571-1572`
- Auto-update PWA "di solito copre il caso ma può richiedere un primo hard reload per scaricare il nuovo bundle". — `STATO_PROGETTO.md:728-730`

### Manifest (theme / icone)

- `manifest.name: 'marzio1777'`, `short_name: 'marzio1777'`, `description: 'La Macchina del Tempo Digitale per i Ricordi di Montagna'`. — `vite.config.ts:24-27`
- `theme_color: '#2D5A27'`, `background_color: '#F7F5F0'`, `display: 'standalone'`, `orientation: 'portrait'`. — `vite.config.ts:28-31`
- Icone: due entry, entrambe `src: 'icon.svg'`, `type: 'image/svg+xml'`, `purpose: 'any maskable'`, dichiarate `sizes: '192x192'` e `sizes: '512x512'` (stesso file SVG per entrambe). — `vite.config.ts:32-45`
- PWA icons offline-safe: sostituite le SVG remote DiceBear con `public/icon.svg` inline (~400 byte). "PWA installabile offline al primo run." — `STATO_PROGETTO.md:715`; "(~400 byte M1777 monogram, `#2D5A27` su `#F5F0E1`). PWA ora offline-safe." — CLAUDE.md (B7 vite.config.ts)
- [IRRISOLTO] Discrepanza colore sfondo: manifest dichiara `background_color: '#F7F5F0'` (`vite.config.ts:29`), ma la nota icona cita `#F5F0E1` come sfondo dell'SVG. Due valori diversi nelle fonti.

### Precache offline dei documenti

- Doc lunghi serviti in-app, non nel bundle: dal commit `2e02795` vivono in `public/docs/*.md` e `Istruzioni.tsx` li carica a runtime con `fetch(\`${import.meta.env.BASE_URL}docs/${file}\`)` + render `react-markdown`. — CLAUDE.md (§PWA/Istruzioni); MIGRATION/CLAUDE storia commit `2e02795`
- Doc spostati sotto `public/docs/`: `README_*`, `TECHNICAL_DOCS_*`, `security_spec_*`, `GAMING_SYSTEM_*`, `STATO_PROGETTO`. — CLAUDE.md (commit `2e02795`)
- Precache offline dei doc abilitato perché `vite.config.ts` ha `includeAssets: ['icon.svg', 'docs/*.md']` e `workbox.globPatterns` esteso con `.md` (Workbox di default esclude `.md`). "Così le Istruzioni sono leggibili offline." — `vite.config.ts:18,22`; CLAUDE.md
- Leaflet markers offline-safe: sostituiti i `new L.Icon({ iconUrl: 'https://...' })` (da `raw.githubusercontent.com`, `cdnjs`, `unpkg`) con `L.divIcon` SVG inline via `src/lib/leafletIcons.ts` (`createMarkerIcon('blue'|'gold'|'green'|'crimson')`). "PWA offline ora ha i marker; nessun nuovo asset binario in `public/`; bundle delta trascurabile (~600 byte per marker SVG inline)." — `TECHNICAL_DOCS_IT.md:726`; `STATO_PROGETTO.md:130-134`

### Lazy-loading (pagine, emoji-picker, doc)

- Pagine: "Tutte le pagine `lazy()`-imported" in `src/App.tsx`. `<Suspense>` wrappato dentro `<ErrorBoundary>` in `App.tsx`. — CLAUDE.md (§Routing); `STATO_PROGETTO.md:329-330`
- `<Suspense>` "cattura solo le promise di chunk-fetch lazy, non i runtime error". — `STATO_PROGETTO.md:336-337`
- `emoji-picker-react` reso `lazy()` in `LAlberone.tsx` (commit `2e02795`) — "pesa, serve solo all'apertura del picker"; pattern da replicare per dep pesanti usate in un solo punto on-demand. — CLAUDE.md (§PWA, §storia `2e02795`)
- Doc lunghi caricati a runtime via `fetch` + `react-markdown` (fuori dal bundle JS). — CLAUDE.md (commit `2e02795`)
- Lentezza percepita al primo accesso al gioco: "chunk lazy-loaded del routing → primo paint richiede fetch di `GamePlayRouter` + `useGameEvents` + chunk Leaflet (~150 KB combinato)". Non aggiunto prefetch aggressivo dei chunk gioco in quel round. — `STATO_PROGETTO.md:721-723,731`

### Dimensioni bundle dichiarate

- Build delta complessivo Campo dei Giochi + L'Ainulindalë: "**~70KB minified+gzipped**". — `TECHNICAL_DOCS_IT.md:28`
- Tabella build delta: Il Campo dei Giochi `~30KB minified+gzip`; L'Ainulindalë (Biblioteca + Sessioni + WebRTC) `~40KB minified+gzip`; **Totale post-MVP ~70KB**. "Nessuna dipendenza npm aggiunta — il delta è puro codice React + utility TypeScript locali." — `TECHNICAL_DOCS_IT.md:679-686`
- MVP + Campo dei Giochi (~30KB) + L'Ainulindalë (~40KB) costruiti senza nuove dep rispetto al core. — CLAUDE.md (Convenzione 1)
- Snapshot bundle size (snapshot 2026-05-05): "**~862 KB gz 226 KB per main bundle**, lazy chunks da **~17 KB (GameCreator)** a **~440 KB (Istruzioni — markdown rendering)**". — `STATO_PROGETTO.md:1567-1568`
- AR — tabella confronto approcci (colonna Bundle): "HTML5 Camera Overlay (scelto) ~0KB"; "WebXR `immersive-ar` ~50KB polyfill (❌ non supportato iOS Safari)". — `TECHNICAL_DOCS_IT.md:404-407`
- Cover art audio: base64 ≤ 50KB (`trackCoverDataUrl`). — `TECHNICAL_DOCS_IT.md:226`
- WebRTC: chunk 16KB ordered; max file size 50MB (3200 chunk a 16KB max). — `TECHNICAL_DOCS_IT.md:584,591-592`; `STATO_PROGETTO.md:78`
- Tempi build registrati nei round UX: `npm run build` ~11s / ~11.7s / ~12s, "bundle pulito" (vari round 2026-05-07). — `STATO_PROGETTO.md:1143,1231,1278,1348,1463`
- [IRRISOLTO] La frase "~862 KB gz 226 KB per main bundle" (`STATO_PROGETTO.md:1567`) è ambigua nella punteggiatura: plausibilmente ~862 KB raw / 226 KB gzip per il main bundle. Non esplicitato nel testo.
- [INFERENZA] I "~70KB" (delta moduli) e i "226 KB gz" (main bundle totale) misurano cose diverse (delta incrementale dei due moduli vs peso gzip del bundle principale): non sono in contraddizione ma vanno letti come metriche distinte.

### Cloud Functions deployate (7 + 2 skeleton)

- "7 CF live su `marzio1777`" / "7 attive su `marzio1777`/`europe-west1`/`nodejs22`", Firebase **Blaze plan** attivo. — CLAUDE.md (§Cloud Functions deployate); `STATO_PROGETTO.md:23`; `MIGRATION.md:53-56`
- Snapshot live: "7 + 2 skeleton su `marzio1777`/`europe-west1`/`nodejs22`". — `STATO_PROGETTO.md:1564-1565,265`
- Le 7 live + 2 skeleton (codice in `functions/src/index.ts`): — `STATO_PROGETTO.md:264-282`; `MIGRATION.md:53-65`; CLAUDE.md
  1. `validateCaptureDistance` (callable) — Haversine server-side, chiude Sporca #14 "The Teleporter"; wired in `useGameEvents.captureItemTransaction` con fallback graceful "CF non deployata → legacy fast-path".
  2. `enforceQueuePerUserLimit` (callable) — count effettivo doc attivi del proposer (`status in [queued|transferring|ready|playing]`), chiude residuo Sporca #24; respinge con `resource-exhausted`; wired in `useAudioQueue.proposeTrack` e `proposeTrackToSession`.
  3. `notifyKickoff` (cron 5 min) — FCM Web Push 30 min pre-kickoff + lobby open; idempotency via flag `game_events.{id}.notifications.{kickoff30Notified, lobbyNotified}`; prune token invalidi via `arrayRemove`.
  4. `cleanupOrphanSignaling` (cron 5 min) — `signaling.expireAt < now()`.
  5. `cleanupStuckEvents` (cron daily 04:00 Rome).
  6. `cleanupOrphanSessions` (cron daily 04:15 Rome).
  7. `auditMassSkip` (Firestore onUpdate, **skeleton — TODO Fase 3**).
  8. (+) `validateP2PTransferIntegrity` (callable **skeleton — Fase 3**, ritorna `unimplemented`/`unimplemented`; richiede campo `blobSha256` su `QueueItem`).
- Deploy: `firebase deploy --only functions,firestore:rules,firestore:indexes` (project alias `marzio` → `marzio1777` in `.firebaserc`). — CLAUDE.md; `MIGRATION.md:55`
- Nuove collection introdotte: `audit_log/{}` (Root read, CF-only write) e `places_cache/{}` (cache reverse-geocoding pubblica). — `MIGRATION.md:71-72`
- Indici `COLLECTION_GROUP` aggiunti a `firestore.indexes.json` per `participants`, `queue`, `audio_sessions`, `answers`. — `MIGRATION.md:91-92`
- Pre-Fase 2 nessuna CF: "tutto consolidato senza Cloud Functions, perché il piano Spark gratuito non le permette". — `STATO_PROGETTO.md:85-86`

### FCM (Web Push)

- `notifyKickoff` CF cron 5 min su `europe-west1`, due window (kickoff-30min, lobby-open ±5min), idempotency via flag su `game_events.{id}.notifications`, prune token invalidi via `arrayRemove`. — `TECHNICAL_DOCS_IT.md:694`; `STATO_PROGETTO.md:273-276`
- VAPID **public** key **hardcoded** in `src/hooks/useFCM.ts` (commit `df45f3f`), non più via secret CI; la private key resta sui server FCM. — `TECHNICAL_DOCS_IT.md:694`; `STATO_PROGETTO.md:289-290`; `MIGRATION.md:76`
- Incidente VAPID: 3 deploy consecutivi avevano lasciato il bundle byte-identico nonostante il secret `VITE_FIREBASE_VAPID_KEY` settato. Causa: trailing newline non visibile nel valore secret → heredoc `cat > .env.production <<EOF` scriveva la chiave su 2 righe → Vite parser leggeva empty string. Workaround: hardcode. — `STATO_PROGETTO.md:291-296`; CLAUDE.md (§FCM)
- Service Worker dedicato `public/firebase-messaging-sw.js` (caricato dal CDN gstatic). — `TECHNICAL_DOCS_IT.md:694`; `STATO_PROGETTO.md:286`; CLAUDE.md
- Hook `useFCM` (`src/hooks/useFCM.ts`): permission + getToken + persistenza su `users.{uid}.fcmTokens[]` (**cap 20**). UI opt-in/opt-out in `ProfiloPersonale` (toggle Bell/BellOff). — `STATO_PROGETTO.md:286-288`; CLAUDE.md
- Workflow `.github/workflows/deploy.yml` scrive `.env.production` esplicitamente (6 `VITE_FIREBASE_*` da secrets; VAPID non più, è hardcoded). — CLAUDE.md (§FCM); `STATO_PROGETTO.md:284`
- Gap di tipo noto (non fixato): `fcmTokens` usato da `useFCM.ts` + rule ma **non dichiarato in `UserProfile`** (`src/types.ts`). — CLAUDE.md (fix permessi 2026-05-23)

### MIGRATION.md — fatto vs pianificato (stato Fasi)

Marcato ✅ FATTO (`MIGRATION.md:21-102`):
- MVP: Campo dei Giochi (Concept A Caccia + Concept B Quiz), L'Ainulindalë Fase 1 (Biblioteca + Walkman) e Fase 2 (Sessioni del Coro + WebRTC P2P). — `MIGRATION.md:22-24`
- Correzioni post-audit B1–B6 + Batch B7 hardening (cap users.points 50→1000, quiz scoring split owner-side, Sporche #25/#26 "Theme Hijacker" al 100%, `validQueueStatusTransition` stretta, ownership stretto leaderboard/participants, race-safety `advanceGameEventStatus`, AuthContext listener cleanup, WebRTC Timestamp, PWA icon inline). — `MIGRATION.md:25-52`
- Cloud Functions hardening + FCM Fase 2: 7 CF attive su `europe-west1`, runtime `nodejs22`, richiede Blaze plan (attivo). — `MIGRATION.md:53-74`
- Quiz auto-generators 5/5 chiusi (`guess_who`, `guess_year`, `guess_caption`, `chronology` con seeded RNG mulberry32; `guess_place` via reverse-geocoding Nominatim + cache `places_cache/{geoKey}`). Schema dati invariato, nessuna migration. — `MIGRATION.md:75,197-241`
- FCM notifiche pre-evento chiuse Fase 2. — `MIGRATION.md:76`
- Gagliardetti pesati da snapshot: catalogo 16 gagliardetti in `src/lib/gagliardetti.ts` — Fase 2 (13: 4 historical + 4 giochi + 5 audio) + Fase 2.5 (3: Veggente del Bivacco, Pellegrino delle Polaroid, Discordante). Counter su `users.{uid}.metrics`. — `MIGRATION.md:77-95`
- Per-user count proposte queue attive chiuso Fase 2 con `enforceQueuePerUserLimit`. — `MIGRATION.md:96-102`

Marcato ⏳ / Fase 3 APERTI (`MIGRATION.md:16-19,88-89,312-314,330-374`):
- **L'Ospite Perfetto** (10 sessioni Host senza disconnessioni / 4° gagliardetto continuous-tracking): resta Fase 3, richiede heartbeat host CF dedicata. — `MIGRATION.md:17,88-89,312-314`
- **Concept C/D/E nuovi giochi**: Concept C — La Gimkana, Concept D — Il Foto-Reportage, Concept E — Il Karaoke del Bivacco (parz. assorbito da L'Ainulindalë). — `MIGRATION.md:18,343-346`
- **Estensioni L'Ainulindalë**: Karaoke synced (`lyricsLrc`), Video chat embedded (Daily.co/Jitsi iframe), Smart playlist (`suggestNextTrack` CF + `genre`/`bpm`), Cross-session contribution (violerebbe "no audio nel cloud", da valutare). — `MIGRATION.md:19,350-373`
- **`validateP2PTransferIntegrity`** (callable skeleton): ritorna `unimplemented` finché manca il campo `blobSha256` su `QueueItem` (`src/types/audio.ts`); migration di schema opt-in backward-compatible (`blobSha256: string | null`, hex 64 char, calcolato dal proposer pre-send, verificato dal DJ post-receive). — `MIGRATION.md:64-65,269-292`
- **`auditMassSkip`**: trigger su `queue/{X}.status → 'skipped'`; skeleton, mitigazione parziale Sporca #29 "The Mass Skipper". — `MIGRATION.md:63,275-279`
- Fase 2.5 dichiarata **chiusa al 75%** (3 di 4 gagliardetti continuous-tracking). — `MIGRATION.md:6-7`

### Filosofia dipendenze / bundle (vincolo di performance)

- Regola ammorbidita 2026-05-08: da "zero nuove dipendenze" (vincolo rigido) a "preferire native, valutare il costo caso per caso"; filtro "costo runtime su mobile entry-level". — `MIGRATION.md:14`; `TECHNICAL_DOCS_IT.md:28`; CLAUDE.md (Convenzione 1)
- Motivazione bundle: "ogni nuova dep costa bundle, parse-time, RAM, profondità di astrazione"; app deve restare leggera/fluida anche su cellulari vecchi. — `TECHNICAL_DOCS_IT.md:28`; CLAUDE.md
- AR/geo/WebRTC/IndexedDB/ID3/Web Audio/Media Session tutti via API native browser (nessuna dep). — `TECHNICAL_DOCS_IT.md:28`
- [IRRISOLTO] `STATO_PROGETTO.md` (datato 2026-05-05) riporta ancora la versione rigida "zero nuove dipendenze npm senza discussione" (`STATO_PROGETTO.md:25,1583`), mentre `MIGRATION.md:14` e `TECHNICAL_DOCS_IT.md:28` (2026-05-08) riportano la versione ammorbidita. Drift di data tra i doc.

---

## Tema: frontend-ux

Dati raw sorgentati. Fonti lette integralmente: `src/index.css` (161 righe), `src/components/ui/index.tsx` (276 righe), `src/components/Layout.tsx` (350 righe); sezioni UX di `public/docs/STATO_PROGETTO.md` (1590 righe, campionata sulle sezioni UX/round/B-batch) e `public/docs/TECHNICAL_DOCS_IT.md` (865 righe, sezione §6 + round UX). Cross-check con `grep` sul codice sorgente reale.

### Design system — palette

- Palette custom "marzio" definita in `@theme` (Tailwind v4 inline, niente `tailwind.config.js`): `--color-marzio-seppia: #F7F5F0`; `--color-marzio-verde: #2D5A27`; `--color-marzio-oro: #F5A623`; `--color-marzio-azzurro: #4A90E2`; `--color-marzio-grigio: #8C928D`. — `src/index.css:7-12`
- Token semantici shadcn-style mappati sulla palette Ainulindalë dark-flame (consumati da `ui/*` e dalle 4 pagine `AudioSession*`): `--color-background:#0A0A0F`, `--color-foreground:#F5F0E1`, `--color-card:#16161D`, `--color-card-foreground:#F5F0E1`, `--color-popover:#16161D`, `--color-popover-foreground:#F5F0E1`, `--color-primary:#FFA000`, `--color-primary-foreground:#0A0A0F`, `--color-secondary:#24352B`, `--color-secondary-foreground:#F5F0E1`, `--color-accent:#C2410C`, `--color-accent-foreground:#F5F0E1`, `--color-muted:#1A1A24`, `--color-muted-foreground:#879B8F`, `--color-destructive:#DC2626`, `--color-destructive-foreground:#F5F0E1`, `--color-border:#24352B`, `--color-input:#24352B`, `--color-ring:#FFA000`. — `src/index.css:19-37`
- Commento di codice load-bearing: senza questi token "Tailwind v4 silently drops `.bg-primary`, `.bg-card`, `.text-muted-foreground` etc. — bug 'pagina nera' on `apri sessione`". I caller attuali forzano dark-flame via parent `bg-[#0A0A0F]`. — `src/index.css:14-18`
- Conteggio reale token colore in `@theme`: **24** entry `--color-*` (5 marzio + 19 semantici). Il doc B8 dichiara "18 token shadcn-style aggiunti al `@theme`… (causavano 'pagina nera apri sessione')". [IRRISOLTO] discrepanza minore di conteggio (18 dichiarati vs 19 semantici effettivi). — fonte: `grep -cE "^\s*--color-" src/index.css` = 24; `public/docs/STATO_PROGETTO.md:230-231`
- Due superfici applicate al `body`: light = `background-color: var(--color-marzio-seppia)` (#F7F5F0); dark = `.dark body { background-color: #0d1310 }` (verde notte, non il #0A0A0F dei token). — `src/index.css:105-112`
- Estetica de L'Ainulindalë (dark-flame), enumerata nel doc: sfondo principale `#0A0A0F` (nero ardesia), sfondo secondario `#16161D`, testo primario `#F5F0E1` (avorio caldo/pergamena), accento ambra `#FFA000`, accento crimson `#C2410C`, accento oro `#D4A856` (Gagliardetti audio), glow `rgba(255,160,0,0.4)`. — `public/docs/TECHNICAL_DOCS_IT.md:648-657`
- L'Ainulindalë è "dark-first": anche con tema light dell'app, il modulo audio forza dark per immersione musicale. — `public/docs/TECHNICAL_DOCS_IT.md:659`
- Differenziazione semantica del Campo dei Giochi: Concept A (treasure hunt) = verde foresta + ambra; Concept B (photo quiz) = blu indaco + oro. — `public/docs/TECHNICAL_DOCS_IT.md:644-646`
- Colori dark hardcodati ricorrenti nella shell (non token): `#0d1310` (root bg dark), `#151e18` (card/sidebar dark), `#24352b` (border dark), `#1a261f` (hover dark), `#111814` (avatar pill bg), `#42a83a` (verde acceso dark, testo attivo), `#1a2e16`/`#e2e8f0` (testo light/dark). — `src/components/Layout.tsx:116,173,...`
- Leaflet markers: palette `blue|gold|green|crimson`, `L.divIcon` SVG inline ~600 byte/marker via `src/lib/leafletIcons.ts` (sostituiti i CDN esterni). — `public/docs/STATO_PROGETTO.md:130-131`; `public/docs/TECHNICAL_DOCS_IT.md:726`

### Tipografia

- Due famiglie da Google Fonts importate: `Inter` (pesi 400;500;600) e `Playfair Display` (italico+roman 400/600/700). — `src/index.css:1`
- Token font: `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif`; `--font-serif: "Playfair Display", ui-serif, Georgia, serif`. — `src/index.css:39-40`
- `body { font-family: var(--font-sans) }` → Inter è il default globale. — `src/index.css:106`
- Uso reale: `font-serif` (Playfair) sui titoli brand/heading (`marzio1777`, "Accesso in Attesa", H2 overlay); `font-sans` su label/metriche. Esempi: `Layout.tsx:180` (`h1 font-serif`), `:256`, `:274`. Plugin `@tailwindcss/typography` attivo (`@plugin` riga 3) per il rendering markdown dei doc in `Istruzioni.tsx`.

### Primitive UI scritte a mano (`src/components/ui/index.tsx`)

- Filosofia: componenti locali, no shadcn, no Radix, no class-variance-authority. Composizione classi via `cn = twMerge(clsx(...))` (clsx + tailwind-merge, già in deps). — `index.tsx:5-9`
- **Avatar** — offline-safe: rende `photoURL` con `referrerPolicy="no-referrer"` + `loading="lazy"`; `onError` degrada al fallback iniziale-su-bg-`bg-marzio-verde`. Sostituisce i fallback DiceBear/picsum.photos che davano 404 in PWA offline. Taglie `xs|sm|md|lg|xl` (`w-5 h-5` → `w-24 h-24`), `role="img"`+`aria-label` sul fallback. — `index.tsx:11-68`
- **Button** — `React.forwardRef`, `type='button'` di default. Varianti `default|secondary|ghost|destructive|outline|link`; taglie `sm|default|lg|icon`. Base: `inline-flex items-center justify-center gap-2 rounded-md font-medium … focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none`. Taglie: `sm h-9 px-3`, `default h-10 px-4 py-2`, `lg h-11 px-8`, `icon h-10 w-10`. — `index.tsx:70-106`
- **Input / Textarea / Label** — `FIELD_BASE` condiviso con `focus-visible:ring-2 ring-ring ring-offset-2`, `placeholder:text-muted-foreground`, `disabled:cursor-not-allowed disabled:opacity-50`; Input `h-10`, Textarea `min-h-[80px]`, Label con `peer-disabled:*`. — `index.tsx:108-131`
- **Switch** — ARIA switch reale: `<button role="switch" aria-checked={checked} type="button">`, implementato come button perché la navigazione tastiera funzioni senza Radix; commento: "The checkbox markup of the previous version did not announce as a switch to assistive tech". Dimensioni `h-6 w-11`, thumb `h-5 w-5` con `translate-x-5/-0`, `bg-primary` se checked altrimenti `bg-input`, focus ring + `disabled:*`. — `index.tsx:133-175`
- **Card** (+ `CardHeader/Title/Description/Content/Footer`) — `rounded-lg border bg-card text-card-foreground shadow-sm`; Header `flex flex-col space-y-1.5 p-6`, Title `text-xl font-semibold tracking-tight`, Description `text-sm text-muted-foreground`. — `index.tsx:177-200`
- **ScrollArea** — wrapper minimale `overflow-y-auto`, `forwardRef`. — `index.tsx:202-211`
- **Dialog** — portal-based (`createPortal` su `document.body`). Chiusura su Escape + click-outside (`onClick` overlay con `stopPropagation` sul contenuto); body-scroll-lock (`document.body.style.overflow='hidden'` con ripristino del valore precedente). `role="dialog" aria-modal="true"`, overlay `fixed inset-0 z-50 … bg-black/80 p-4 animate-in fade-in`. Commento esplicito: "No focus trap (deliberately minimal … Radix is out of scope)". — `index.tsx:213-253`
- **DialogContent** — `relative max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg max-h-[min(90vh,90dvh)] overflow-y-auto`. Commento di razionale: `dvh` preferito a `vh` su mobile perché la URL bar di Safari restringe il viewport a runtime; `min(90vh,90dvh)` fa fallback su vh dove dvh non è supportato; `overflow-y-auto` fa scrollare il body lungo dentro al modale. — `index.tsx:255-264`
- DialogFooter responsivo: `mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2` (bottoni impilati al contrario su mobile, in riga su sm+). — `index.tsx:274-276`
- Export completi (da CLAUDE.md): `Button`, `Input`, `Textarea`, `Label`, `Switch`, `Card`+sotto, `ScrollArea`, `Dialog`+sotto, `Avatar`. "Riusa queste primitive prima di introdurne nuove". — `index.tsx` (file)

### Shell di Layout (`src/components/Layout.tsx`) — struttura responsive

- Root: `h-[100dvh] … flex flex-col md:flex-row md:p-6 md:gap-6 overflow-hidden font-sans relative transition-colors duration-300`. Mobile = colonna, desktop = riga con padding/gap. — `Layout.tsx:116`
- Sidebar desktop: `hidden md:flex flex-col w-64 … rounded-2xl` (visibile solo da `md`). — `Layout.tsx:173`
- Main content: `flex-1 min-h-0 min-w-0 relative flex flex-col … md:rounded-2xl overflow-hidden pt-16 md:pt-0 pb-16 md:pb-0`. Il `pt-16/pb-16` compensa header/bottom-nav mobile, azzerati su desktop. — `Layout.tsx:252`
- Header mobile: `md:hidden absolute top-0 … h-16 … z-10` (resta visivamente fisso perché lo scroll avviene nel div figlio). — `Layout.tsx:253`
- Wrapper Outlet (la zona che scrolla): `flex-1 overflow-y-auto p-0 md:p-6 scrollbar-hide relative min-h-0`. — `Layout.tsx:290`
- Bottom-nav mobile: `md:hidden fixed bottom-0 … h-16 pb-safe z-40 shadow-[0_-5px_15px_…]`. — `Layout.tsx:296`
- Z-index stack della shell: update-pill/toast `z-[60]`, overlay pending/guest `z-30`, bottom-nav `z-40`, header mobile `z-10`, background decor `-z-10`. — `Layout.tsx:130,159,270,296,253,170`
- Badge nav: pill rosso con cap visivo `badge > 9 ? '9+' : badge` (sia NavItem desktop sia MobileNavItem); su mobile è un dot `w-4 h-4` posizionato `absolute top-1.5 right-1.5` con `ring-2 ring-white dark:ring-[#151e18]`. — `Layout.tsx:324-327,341-345`
- Tema light/dark gestito a mano: stato `isDark` da `localStorage.getItem('theme')`, `useEffect` toggla `document.documentElement.classList` `.dark` e persiste `localStorage 'theme'`; toggle con icone `Sun`/`Moon`. — `Layout.tsx:17-30,185-187,259-261`
- Custom-variant Tailwind v4 per il dark: `@custom-variant dark (&:where(.dark, .dark *))`. — `src/index.css:5`
- Overlay "pending/guest": `absolute inset-0 … backdrop-blur-md z-30 flex flex-col items-center justify-center` (vede la shell ma niente dati comunità). — `Layout.tsx:269-288`
- Toast/pill aggiornamento PWA: `motion.div` con `role="status" aria-live="polite"`, ancorato `fixed top-3 left-1/2 -translate-x-1/2 z-[60]`, `max-w-[calc(100vw-1rem)]` per non sforare; spring `damping:22 stiffness:250`; entrata/uscita `y:-60 opacity:0`. — `Layout.tsx:121-167`

### Pattern responsive / adaptive — safe-area, dvh, mobile scroll

- **`.pb-nav-safe`** utility (creata round R2, 2026-05-07): `padding-bottom: calc(4rem + env(safe-area-inset-bottom))`. Per pagine che scrollano sotto la bottom-nav (`h-16`=4rem) e devono liberare la home-indicator iOS. Commento: senza, "the last item ends up under the nav on iPhone X and later". — `src/index.css:59-67`
- Uso reale `.pb-nav-safe` (10 occorrenze, 9 file): `AudioSessionListener`, `AudioSessionsList`, `PersonalLibrary`, `AudioSessionCreate`, `ProfiloPersonale`, `AudioSessionDJ`, `LaPiazza`, `GameCreator`, `IlBivacco`. — `grep -rln pb-nav-safe src`
- Pattern standard pagina-con-bottom-nav: `pb-nav-safe md:pb-8` (mobile safe-area, desktop 32px). Default consolidato in R5. — `public/docs/STATO_PROGETTO.md:1453-1454`
- `dvh` (dynamic viewport height) preferito a `vh` su mobile per la URL-bar Safari che si restringe a runtime: usato in `min(Nvh, Ndvh)`. Occorrenze reali: root Layout `h-[100dvh]`; IlBaule cropper `h-[min(40vh,40dvh)] min-h-[300px]` e preview `max-h-[min(60vh,60dvh)]`; IlBivacco modale `max-h-[min(90vh,90dvh)]`; EventDetailModal `max-h-[min(95vh,95dvh)] sm:max-h-[min(85vh,85dvh)]`; DialogContent `max-h-[min(90vh,90dvh)]`. — `grep -rn dvh src`; `index.tsx:263`; `IlBaule.tsx:445,509`; `IlBivacco.tsx:240`; `EventDetailModal.tsx:59`
- Regola Flexbox load-bearing documentata: un flex item con `min-height:auto` rompe l'overflow del parent → wizard `h-full flex flex-col` devono avere `min-h-0`. Pattern wizard standardizzato: `h-full min-h-0 flex flex-col overflow-y-auto pb-nav-safe md:pb-6` (GameCreator step 0/1/2). — `public/docs/STATO_PROGETTO.md:1163-1165,1224-1225`
- Regola child-scroll: quando un parent ha `overflow-hidden` (es. container Routes di `IlAinulindale.tsx:73` = `flex-1 min-h-0 overflow-hidden`), la child PAGE deve avere `h-full overflow-y-auto`, altrimenti non scrolla. — `public/docs/STATO_PROGETTO.md:1388-1392,1450-1452`
- Fix mobile-scroll pagine audio (R5): `AudioSessionsList/Create/DJ/Listener` mancavano tutte di `h-full overflow-y-auto`; wrap esterno `<div className="h-full overflow-y-auto">` + inner `pb-nav-safe md:pb-8`; rimossi `pt-20`/`pt-24` orfani (compensavano un header globale che dentro IlAinulindale non esiste). DJ usa `min-h-full` (parent vincola l'altezza). — `public/docs/STATO_PROGETTO.md:1388-1436`; `public/docs/TECHNICAL_DOCS_IT.md:834`
- `pb-safe` e `pt-safe` usati su bottom-nav (`Layout.tsx:296`) e FullScreenPlayer (`pt-safe px-4 pb-safe`, `FullScreenPlayer.tsx:53`). [IRRISOLTO] queste due classi NON sono definite in `src/index.css` (è definita solo `.pb-nav-safe`) né sono utility native Tailwind v4 standard — possibile no-op / dipendenza da un plugin non presente. — `grep -rn pb-safe`
- Default centro mappa Marzio `[45.9238, 8.8655]` (era Roma `[41.9028, 12.4964]`) per tutte le mappe interactive prima dell'arrivo del GPS. — `public/docs/STATO_PROGETTO.md:767`; `public/docs/TECHNICAL_DOCS_IT.md:759`
- Z-index policy mappa (R3): filtro `LaMappa` portato `z-[400] → z-[1100]` per stare sopra i pane Leaflet (`tilePane=200`, `markerPane=600`, `popupPane=700`, control container 1000); aggiunto `max-w-[calc(100%-3rem)]` per non sforare a destra su <600px. — `public/docs/STATO_PROGETTO.md:1258-1264`; `public/docs/TECHNICAL_DOCS_IT.md:839`
- Strategia viewport dichiarata: "Blocco custom delle overflow a livello flex parent CSS e gestione reattanza mobile/tablet standard Tailwind ma mirata a simulare PWA pura chiusa a 'sandbox'". — `public/docs/TECHNICAL_DOCS_IT.md:639-640`

### Scrollbar

- `.scrollbar-hide` (usata in 8-9 file): `scrollbar-width: none` (Firefox) + `::-webkit-scrollbar { display: none }`. Era classe morta/orfana fino al 2026-05-06 (usata ma mai definita; nessun plugin `tailwind-scrollbar-hide`). — `src/index.css:48-57`; `public/docs/STATO_PROGETTO.md:446-463`
- File reali che usano `.scrollbar-hide`: `LAlberone`, `IlCampoDeiGiochi`, `ProfiloPersonale`, `IlBivacco`, `LaPiazza`, `IlBaule`, `AdminPanel`, `Layout`. — `grep -rln scrollbar-hide src`
- Scrollbar globale slim 6px (per i container che la mostrano: form lunghi, Istruzioni, cropper desktop): `scrollbar-width: thin`, thumb chiaro `rgba(140,146,141,0.4)` (grigio marzio); dark `rgba(66,168,58,0.35)` (verde acceso); webkit `width/height: 6px`, track `transparent`, `border-radius:3px`, hover più saturo (`rgba(45,90,39,0.6)` light / `rgba(66,168,58,0.6)` dark). Effetto pratico desktop-only (mobile onora debolmente `scrollbar-width`). — `src/index.css:70-102`

### Accessibilità (a11y)

- `focus-visible:ring-2 ring-ring ring-offset-2` su Button, Input/Textarea, Switch (focus management uniforme nelle primitive, introdotto in B6). — `index.tsx:80,110,159`; `public/docs/STATO_PROGETTO.md:160-161`
- Switch ARIA-compliant: `role="switch"` + `aria-checked` (B6). — `index.tsx:153-155`
- Dialog: `role="dialog" aria-modal="true"`; nessun focus-trap (scelta minimalista esplicita). — `index.tsx:244-245,217`
- `aria-live="polite"` + `role="status"` su pill/toast aggiornamento PWA. — `Layout.tsx:128-129,157-158`
- Programma a11y dichiarato (sistematico su tutti i moduli): `prefers-reduced-motion` rispettato via `useReducedMotion()` di Framer Motion in TUTTE le animazioni; `aria-live="polite"` su leaderboard, cambio round, "Risposta Registrata", queue updates, validation errors; `aria-label` dinamici su pulsanti opzione quiz, cattura AR, controlli player; **tap-target ≥ 56px su mobile**; contrasto AAA su HUD Concept A e player full-screen (testo bianco con text-shadow nero); screen reader: timer quiz annunciato ogni 5s, timer player ogni 30s. — `public/docs/TECHNICAL_DOCS_IT.md:661`
- a11y form datetime (R4): `htmlFor="kickoff-input"` + `id` + `aria-describedby="kickoff-hint"` con hint "Formato: AAAA-MM-GG HH:mm (ora locale). Almeno 30 secondi nel futuro." (Firefox non mostra il picker datetime-local). — `public/docs/STATO_PROGETTO.md:1337-1342`; `public/docs/TECHNICAL_DOCS_IT.md:848`
- aria-label + tooltip su pulsanti mappa GameCreator: "Centra su di me" / "GPS non ancora disponibile" (icona `LocateFixed`, `disabled` se `userPosition===null`); "Imposta centro mappa" (tap-to-place) idem. Terzo stato pill "Recupero posizione GPS…" con spinner. — `public/docs/STATO_PROGETTO.md:684-697`
- Touch target minimo Material `min-h-[48px]` su CTA "Torna al Paese" (empty state guest IlBaule). — `public/docs/STATO_PROGETTO.md:1318`
- Scopribilità feature (commit `9d54e1a`): controlli EQ/Background del FullScreenPlayer (prima icone 18px slate-500 senza label) sostituiti con pill-chip etichettati ("EQ", "Sfondo") con border attiva, header sezione ("Spettro"/"Equalizzatore (±12 dB)"), `title=` e `aria-label=` ovunque. — `public/docs/STATO_PROGETTO.md:427-435`
- Conteggio grezzo occorrenze a11y/responsive nel codice (`focus-visible|aria-|role="|prefers-reduced|useReducedMotion|tap-target|min-h-[48px|56px]`): **76** match su src. — `grep` aggregato
- Parking-lot a11y consapevole (R4): "A11y profonda (focus management, screen reader full pass, contrast WCAG)" non coperta; toast system globale rinviato (resta `alert()`). — `public/docs/STATO_PROGETTO.md:1357-1364`

### Animazioni / micro-interazioni

- Animazioni CSS custom in `@layer utilities` / keyframes: `.spin-slow` (spin 6s lineare infinito); `.polaroid-frame` (cornice bianca/scura con shadow e transizione); `.polaroid-loading::after` con keyframe `develop` (4s, da `height:100% backdrop-blur(10px)` a `height:0% blur(0)`); keyframe `dropIn` per i marker Leaflet (`translateY(-20px) rotate(-45deg)` → 0, cubic-bezier overshoot `0.175,0.885,0.32,1.275`, 0.4s). — `src/index.css:43-46,114-161`
- Polaroid dark variant: `.dark .polaroid-frame { background:#111814; box-shadow:0 4px 25px rgba(0,0,0,0.4); border:1px solid #24352b }`. — `src/index.css:122-126`
- Micro-interazione "Mi Piace": feedback multi-step `scale: [1, 1.15, 1]` + particelle "🍃" in LaPiazza; opzione "none" disattiva le particelle lasciando solo lo scale del battito. Variabili fisiche (icona, tint colore, gravità/distanza Y, velocità/durata) persistite nel payload Firestore utente. — `public/docs/TECHNICAL_DOCS_IT.md:36,642`
- Count-up profilo: `mode="popLayout"` con `spring` physics per le transizioni numeriche delle statistiche. — `public/docs/TECHNICAL_DOCS_IT.md:37`
- Effetti Ainulindalë: vinyl spinning sul cover full-screen, ember particles dalle copertine durante playback (riusa `canvas-confetti` con config dedicata), waveform glow ambra pulsante. — `public/docs/TECHNICAL_DOCS_IT.md:659`
- AR wobble fix (R1+R5): `ARCaptureLayer` usa `useStaticPlacement = !sensorAvailable || prefersReducedMotion` → quando vero `xOffset/yOffset=0` e niente rotate. R5 ha **rimosso del tutto** il keyframed `rotate: [0,5,-5,0]` (decorativo, indipendente dal gyro, faceva "traballare" l'icona anche su mobile con sensore); resta solo `scale: [1, 1.05/1.1, 1]` come pulse. — `public/docs/STATO_PROGETTO.md:1378-1421`; `public/docs/TECHNICAL_DOCS_IT.md:820`
- `transition-colors duration-300` applicata su root/sidebar/main/nav per lo switch tema fluido. — `Layout.tsx:116,173,252,296`

### Round UX — cronologia fix (R1-R5 + round precedenti)

- **Round 2026-05-06 (post user-test desktop, 5 commit `c98bb30→c48ea8e`)**: definita `.scrollbar-hide` + restyle scrollbar globale; `Post.authorPhotoURL?` per avatar autore reali in Piazza; GPS hook `useHighAccuracyPosition(active, highAccuracy)` con one-shot+watch (fix in 1-2s), timeout 10s→30s, `GeoError {code,message}`; TreasureHuntPlay grace 20s su transient / immediato su PERMISSION_DENIED, CTA "Continua senza GPS", badge accuracy `±Nm` colorato (verde≤20/ambra≤50/rosso>50); GameCreator wizard hardening (Avanti disabled+hint ambra, kickoff default now+10min, ricerca città Nominatim, "Centra su di me"/`LocateFixed`, `hasUserCentered` flag); surface `err.message` in 7 catch; `increment(5)` race-safe in IlBivacco. — `public/docs/STATO_PROGETTO.md:439-512`; `public/docs/TECHNICAL_DOCS_IT.md:740-807`
- **Round "crash UX" (live, 15 commit ~3h)**: ErrorBoundary globale class-component (`getDerivedStateFromError`+`componentDidCatch`, CTA "Torna alla Piazza"/"Ricarica l'app") wrappa `<Suspense>` in App.tsx (lo schermo nero era una tree smontata da throw in render); fix React #310 in AudioSessionDJ (useMemo `activeQueue` issato sopra gli early-return); X dismissable su MiniPlayer/FullScreenPlayer; split batch creazione coro; `dist/404.html` per deep-link SPA su Pages. — `public/docs/STATO_PROGETTO.md:320-435`
- **R1 `248b316`** — organizer auto-join (`createGameEvent` upserta `participants/{org}.status='joined'`); `useDeviceOrientation.available:boolean` (true solo dopo evento entro 5s); ARCaptureLayer fallback statico; GameLobby non skippa PermissionsGate per organizer treasure_hunt; kickoff guard pre-cattura; 3 rule test regression. — `public/docs/TECHNICAL_DOCS_IT.md:815-855`
- **R2 `12131cf`** — nasce `.pb-nav-safe`; `DialogContent max-h-[min(90vh,90dvh)] overflow-y-auto`; modali e cropper migrati a `min(vh,dvh)`; wizard GameCreator standardizzati; `IlAinulindale` Routes container `flex-1 min-h-0 overflow-hidden`. — `public/docs/STATO_PROGETTO.md:1157-1244`
- **R3 `b7126cd`** — z-index filtro LaMappa `z-[400]→z-[1100]`; `limit(50)` sulla query posts di QuizHostCreateRound (memory bomb cover base64 ≤50KB/post ad ogni apertura wizard). — `public/docs/STATO_PROGETTO.md:1248-1293`
- **R4 `f659c6b`** — pre-flight `visibilityStatus==='scheduled' && !visibilityTime`; CTA guest "Torna al Paese" (`min-h-[48px]`); messaggi user-friendly in QuizHostCreateRound/PhotoQuizPlay; a11y kickoff-input. — `public/docs/STATO_PROGETTO.md:1297-1364`
- **R5 `f5c1cab`** — rimozione wobble AR; wrap `h-full overflow-y-auto` sulle 4 pagine audio; sweep `pb-nav-safe md:pb-8` su LaPiazza:145 + ProfiloPersonale:110. È il post-mortem di R1-R4 (i sub-agent Explore avevano dato falsi positivi su Layout già conforme e mancato 4 pagine audio). — `public/docs/STATO_PROGETTO.md:1368-1457`; `public/docs/TECHNICAL_DOCS_IT.md:811-861`
- Lezione di processo codificata (Convenzione 5 CLAUDE.md): per pattern ricorrenti (`pb-X`, `pt-NX`, `max-h-[Nvh]`, `overflow-hidden` parent senza child scrollabile) fare `grep -rn` esaustivo e leggere ogni occorrenza prima di chiudere il round. Tutti i round UX dichiarati retrocompatibili, zero deps nuove, niente schema/rule change (tranne 3 rule test regression in R1). — `public/docs/STATO_PROGETTO.md:1443-1457`; `public/docs/TECHNICAL_DOCS_IT.md:813,861`
- Falso positivo confermato (R2/R3): `Layout.tsx` era già conforme — `h-[100dvh]` root, wrapper Outlet `overflow-y-auto … min-h-0`, header mobile `absolute top-0`; HUD TreasureHuntPlay già responsive. — `public/docs/STATO_PROGETTO.md:1169-1173,1280-1287`

### Note / irrisolti

- [IRRISOLTO] `pb-safe`/`pt-safe` usati in `Layout.tsx:296` e `FullScreenPlayer.tsx:53` non risultano definiti in `src/index.css` né sono utility Tailwind v4 native standard (solo `.pb-nav-safe` è custom-definita). — `grep -rn pb-safe`
- [IRRISOLTO] discrepanza conteggio token: `@theme` ha 19 token semantici (24 `--color-*` totali con i 5 marzio) ma il doc B8 dichiara "18 token shadcn-style aggiunti". — `src/index.css:19-37` vs `public/docs/STATO_PROGETTO.md:230`
- [INFERENZA] Le due "superfici" reali in dark divergono: il `body` dark è `#0d1310` (verde notte) mentre i token semantici `--color-background` sono `#0A0A0F` (nero ardesia dark-flame); coesistono perché solo le pagine audio forzano la superficie dark-flame via parent `bg-[#0A0A0F]`, il resto dell'app dark usa la palette verde-notte hardcodata (`#151e18`, `#24352b`, `#42a83a`). — sintesi da `src/index.css:110-112,19` + `Layout.tsx:116,173`
- File sorgente confermato come single source: `src/index.css` (copie identiche in `dist/`/`public/docs` solo per i .md serviti in-app).

---

## Tema: storico-decisioni

> **Campionamento dichiarato.** Letti INTEGRALMENTE: `cronache-di-marzio.html` (930 righe, IT+EN — cito solo il ramo IT) e `CLAUDE.md` (cache di sola-doc, fornito per intero nel contesto di sessione). Transcript `2026-05-30-…-scrivimi-su-telegram.txt` (3000 righe): campionato via `grep` su `decis|scelt|vincol|niente|mai|regola|requisit` + lettura dei blocchi 1663-1700, 1894-2010, 2141-2185 (il grosso del file è infrastruttura MCP/Telegram/gateway, fuori-tema). Transcript `2026-05-23-150224-…init.txt` (piccolo, letto integralmente). Sigle fonte: `[CR]`=cronache-di-marzio.html, `[CM]`=CLAUDE.md, `[T30]`=transcript 05-30, `[T23]`=transcript 05-23.

---

### Vincoli e filosofia di lavoro posti da Neo (regole vincolanti)

- **Zero nuove dipendenze npm senza discussione** — l'app deve restare leggera anche su cellulari vecchi. `[CR]:258`
- La regola dep è stata **rivisitata il 2026-05-08 da una versione più rigida** a «preferire native, valutare il costo, decidere caso per caso»; eccezioni ammesse in 6 casi nominati (parser PDF, lib crypto, `zod` per payload esterni, SDK ufficiali, estensioni di dep già in uso, a11y/perf oltre il pragmatico). `[CM]` §"Convenzioni di lavoro" punto 1.
- **Procedura obbligata prima di `npm install`**: nome+versione+bundle size (min+gzip da bundlephobia), stima costo runtime su mobile entry-level, alternative valutate (Web API native? primitive `ui/*`? snippet 30 righe?), motivo concreto, discussione, OK, install. `[CM]` punto 1.
- **Anti-pattern di default** (eccezioni con grossa giustificazione): wrapper opachi su API native già nostre (`Dexie`/`idb`, `simple-peer`/`PeerJS` — «il signaling Firestore-as-signaling è un asset, non overhead»); audio engine completi (`Tone.js`, `Howler.js`, `ffmpeg.wasm`); CSS-in-JS heavy; state managers globali (`redux`/`mobx`/`zustand` — «context+hooks è dimensionato per ~10 utenti concorrenti»). `[CM]` punto 1.
- **Backward compatibility prioritaria** sugli schemi Firestore: campi nuovi `field?: T | null`, niente breaking change, feature-flag preferito a script di migration. `[CR]:258`, `[CM]` punto 2.
- **Ogni rule change accompagnata da un test** in `firestore.rules.test.ts` (giochi/comunità) o `firestore.rules.audio.test.ts` (audio). `[CR]:258`, `[CM]` punto 3.
- **«Chiedi prima di scrivere codice»** — Neo preferisce ricevere domande di chiarimento; non assumere. `[CM]` punto 4.
- **Niente `git push` automatici** — i commit si revisionano insieme, il push lo fa l'utente o lo chiede esplicitamente. Commit message in **inglese**, conventional commits. `[CM]` §"Stato del repository".
- **Sweep esaustivo prima di dichiarare "fix sistemico"** (lezione R5 del 2026-05-07): per fix su pattern ricorrente fare `grep -rn` esaustivo e leggere ogni occorrenza; «la pigrizia "lo sub-agente l'ha già visto" costa un round di rimedio». `[CM]` punto 5.
- **Vincolo privacy (segreti)**: «i segreti **non escono** da questa macchina; a fine test si ripulisce». Valori credenziali NON inviati su Telegram, NON su NotebookLM, NON committati, mai in chiaro nei log — sempre mascherati `<SET>`. `[T30]:2154, 2169, 2180`
- Riferimento di te-stessa al **femminile** ("è una sua preferenza esplicita"); lingua di lavoro italiana. `[CM]` intestazione.

### Scelte di design strutturali prese

- **Fase 0 deliberata**: «rendere l'app internamente coerente prima di introdurre i pezzi grossi» (caccia AR, audio P2P). Shell con 11 stanze sotto `/dashboard/*` + auth Google + modello a ruoli zero-trust. `[CR]:294`
- **Modello porta-della-città**: primo login → `pending` (non entra). 3 ruoli (Root·Admin·Guest) × 2 stati (pending·approved). Guest approvato vede la shell ma nessun dato comunità — non velo client, le rule rifiutano comunque. Un solo Root by-email (`nicolainformatica@gmail.com`), riconosciuto sia da `AuthContext` sia, autoritativamente, dalle rule. `[CR]:305`, `[CM]` §Auth.
- **Due giochi, una macchina a stati** su `game_events`: `treasure_hunt` + `photo_quiz` sullo stesso doc. Stati `draft→scheduled→lobby→active→completed/aborted`, **codificati sia nel client sia nelle rule** («replicare le transizioni in entrambi i posti è la regola, non l'eccezione»). `[CR]:344-356`
- **Invarianti load-bearing non lato client**: cattura item atomica via `runTransaction` (un solo vincitore su tap simultaneo); `finalLeaderboard` array embedded immutabile, scrivibile solo nella transizione `active→completed` («la storia non si riscrive»); `currentHostId`/`djId` ruoli dinamici validati con `exists()+get()`. `[CR]:356, 451`, `[CM]` §Campo dei Giochi.
- **Regola d'oro rule**: quando aggiungi una write path, «estendere sempre un validatore esistente e gating-are il match con le primitive, mai check ad-hoc inline». Struttura a strati: deny top-level → primitive → validatori `isValid*` → match per collezione. `[CR]:450`
- **Rule e indici si muovono insieme**: `firestore.indexes.json` assume composti specifici (`posts(visibilityStatus,timestamp)`, `game_events(status,scheduledKickoff)`, `queue(status,position)`). `[CR]:460`
- **L'Ainulindalë — tre regole non negoziabili**: (1) mai file audio nel cloud (byte in IndexedDB, su Firestore solo metadati — «Firestore non deve proteggere file audio perché non ne esistono»); (2) Firestore è solo signaling (offer/answer SDP + ICE in sub-collection effimera proposer-or-DJ); (3) `AudioEngine` è un singleton (un solo grafo Web Audio costruito una volta sola). `[CR]:399-401`, `[CM]` §Ainulindalë.
- **Grafo audio canonico**: `source → gain → eqLow(lowshelf 320Hz) → eqMid(peaking 1kHz Q=0.5) → eqHigh(highshelf 3.2kHz) → analyser(fftSize 128) → destination`. `[CM]` §Ainulindalë.
- **Dimensionamento esplicito**: ~10 utenti concorrenti; 11 stanze; 3 ruoli · 2 stati. `[CR]:259-262`

### Il Patto a 3 — invariante dichiarata load-bearing (utile al piano)

- Il cap di Temi proposti per utente **non è fisso**: cresce coi Punti Altitudine. Formula canonica: `maxQueuedPerUser + floor(points/100) * bonusPerHundredPoints` (default `2 + floor(pts/100) * 1`). `[CR]:404, 409`, `[CM]` §"Patto a 3".
- Calcolata in **tre punti distinti che devono restituire lo stesso intero**: client `getMaxQueuedFor()` (`src/hooks/useAudioQueue.ts:11`), Cloud Function `enforceQueuePerUserLimit` (`functions/src/index.ts:164`, l'unico posto che può *contare* documenti), rule `effectiveMaxQueued(sessionId)` (`firestore.rules:516-520`, `==` stretto sullo snapshot riga 542-543). `[CR]:404, 411`, `[CM]` §"Patto a 3".
- **Trappola dichiarata**: cambiare la formula o un campo `rules.*` in *un solo* sito → la rule respinge la `queue.create` con `Missing or insufficient permissions` (silenziosa per l'utente, criptica nei log). «Cambiarla significa toccare tre file in coro». Il fallback graceful client (CF down → bypass) maschera ulteriormente. `[CR]:414`, `[CM]` §"Patto a 3".

### War-stories tecniche

- **Incidente VAPID**: tre deploy consecutivi lasciarono il bundle **byte-identico** nonostante il secret `VITE_FIREBASE_VAPID_KEY` fosse settato. Causa diagnosticata: **trailing newline invisibile** nel valore del secret → l'heredoc `cat > .env.production <<EOF` scriveva la chiave su due righe → parser Vite leggeva stringa vuota. **Workaround**: hardcode della VAPID *public* key in `src/hooks/useFCM.ts` (commit `df45f3f`) — «viene servita comunque a ogni client nel bundle, non c'era motivo di tenerla in un secret»; la private key resta sui server FCM. Morale dichiarata: «a volte la soluzione elegante è quella che smette di combattere il tooling». `[CR]:723`, `[CM]` §"FCM Web Push setup".
- **React #310, ordine degli hook**: cliccare una sessione esistente → «Qualcosa è andato storto». Vera causa (non il primo fix `mode.toUpperCase`): un `useMemo` piazzato **dopo tre early-return condizionali** → render `loading=true` conta N hook, `loading=false` N+1 → errore #310. Lezione: «gli hook si issano sopra le guard, sempre». `[CR]:761`
- **Self-signaling DJ (handshake con sé stesso)**: il DJ propone una propria traccia, la suona, l'item resta bloccato in `transferring` per sempre. Causa: WebRTC tentava handshake del DJ con sé stesso (stesso uid scrive e legge il signaling, listener mai montato) — né successo né errore. Fix: se `proposedBy === djId`, salta il P2P e leggi il blob direttamente da IndexedDB locale in <100ms. `[CR]:765`
- **Snapshot pre-batch ("Apri il Coro" inerte)**: `Missing or insufficient permissions` sull'add-to-coda. La rule `queue.create` richiede il proposer già participant, ma il `writeBatch` scriveva sessione+participant insieme e *dentro* il batch il `get()` della rule valuta lo snapshot **pre-batch** (sessione inesistente). Fix: due `setDoc` sequenziali invece di un batch atomico. `[CR]:769`; pattern correlato commit `c48ea8e`, `[CM]` §"Round UX 2026-05-06".
- **«Tutta la coda diventa played»**: premuto play, l'intera coda si marcava `played` in 5-10s. `DJEngine` si affidava solo al polling per il fine-traccia; durante lo swap di `src` l'`HTMLAudioElement` riportava `duration` stantia → falso «brano finito» a cascata. L'evento `'ended'` esisteva ma «nessuno lo ascoltava». Fix: l'evento diventa fonte di verità, il polling fallback con triplo guard. `[CR]:773`
- **Scoring quiz host-side respinto in produzione** (B7): l'host eseguiva `tx.update(users/{otherUid}.points, increment(...))` ma la rule consente l'increment solo all'owner del doc → flusso effettivamente respinto. Fix: split owner-side `revealRound` + `claimMyAnswerPoints` (ogni client si auto-accredita), con idempotency via `localStorage`. `[CR]:627`, `[CM]` §B7 punto 2.

### Storia degli audit / batch (waves di chiusura)

- Audit comprensivo Maggio 2026 → **24 discrepanze fra spec, doc e codice**, chiuse in batch **B1-B6** (commit `f4c14e4` → `c521360`). `[CR]:587`, `[CM]` §Tech-debt.
- Secondo audit → **B7** (commit `bd7cf36`): 7 categorie nuove (cap points sottodimensionato +50→+1000/tx; scoring quiz split owner-side; Sporche #25/#26 chiuse via `affectedKeys().hasOnly`; ownership stretto su leaderboard.write e participants.delete; race `finalLeaderboard` avvolta in `runTransaction`; listener leak `AuthContext` tappato). `[CR]:627`, `[CM]` §B7.
- **B8** (commit `8147d4d`): Avatar offline-safe (CDN DiceBear fallivano in PWA), cap su `items.points`, nuova Sporca #31 "Like Forger", 18 token Tailwind v4 mancanti che causavano la «pagina nera apri sessione». `[CR]:633`, `[CM]`.
- **Filo rosso dichiarato**: quasi ogni batch nasce da una difesa *documentata* ma non *applicata*, o applicata in un solo strato — «spec e codice divergono in silenzio, e solo il test che accompagna ogni rule change li tiene allineati». `[CR]:638`

### Trade-off tollerati *by-design* (vincoli/scelte di Neo)

- **Sporca #20 "Speed Demon" (GPS spoofing) tollerata**: «una comunità chiusa whitelisted non ha bisogno di blindare il GPS — se Mario gioca da casa fingendo di essere fuori, lo si scopre alla pizzata successiva». `[CR]:510, 528`
- **#29 "Mass Skipper" tollerata** per autorità DJ; **#9 "Denial of Wallet"** by-design (collezioni). Ogni limitazione tollerata ha un audit log per indagine ex-post. `[CR]:520, 498, 528`
- **MVP pre-Blaze era «anti-cheat al 70%»**: le difese vere (Haversine server-side, conteggio doc) arrivarono solo con le Cloud Functions, perché il DSL Firestore non può calcolare Haversine né contare documenti. `[CR]:706, 853`
- **Nota onesta**: «marzio1777 è solido per ciò che è — app di paese per ~10 persone di fiducia — ma non è una fortezza». GPS falsabile, Host quiz vede la risposta prima. Restano **due test rule su like/unlike rotti da prima**, parcheggiati. Lezione metodologica scomoda: «mi sono fidata degli audit di un sub-agente invece di leggere il codice file per file, e ho pagato un round di rimedio». `[CR]:841`

### Decisioni storiche orientate al *piano* (migrazione / generalizzazione)

- **Pattern "brief-per-ultraplan" consolidato**: esiste già `FLUTTER_MIGRATION_BRIEF.md` in radice del repo, autosufficiente §1-§9, committato e pushato (commit `0aa0333`) perché ultraplan clona lo stato pushato. È il «template d'oro» del metodo. `[T23]` (file init), `[T30]:1907, 1937`
- Contenuto del brief Flutter già preso come scelte: §6 stack target **Flutter + Flame + Dart**, backend **Supabase-leaning (semplice/free)**, **web-first** di default (mobile lasciato come punto aperto); §8 mappatura web→Flutter come *candidati da valutare, non imposizioni* (Firestore→Supabase/RLS, IndexedDB→Drift/Isar, WebRTC→flutter_webrtc, Web Audio→just_audio, Leaflet→flutter_map). `[T23]`
- **Decisione "generalizzazione" (presa dall'agente, autorizzata da Neo «procedi pure, fai tu le scelte e vai»)**: «Generalizzazione = **multi-tenant/white-label + estrazione del core, in fasi**» (lettura: `metadata.json` dice "app privata per la comunità di Marzio" → generalizzare = renderla istanziabile per qualsiasi comunità). Ruoli: agora1777 allestisce lo staging (skill autoplan1777 + notebook + file riunione); il piano vero lo produce autoplan1777 via ultraplan dal repo. `[T30]:1956, 1958`
- **Stato git rilevato al momento dell'allestimento**: repo 2 commit avanti rispetto a origin; file untracked che sporcherebbero un branch (`.claude/`, `verify_hubs.py`, ecc.). `[T30]:1937`
- **Scelta test ambiente piano**: **emulatori Firebase** (DB clean locale, zero rischio), porte custom 8099/9099 per non confliggere col gateway :8080; **niente push, si testa in locale**. `[T30]:2143, 2405, 2551`
- `[INFERENZA]` Il transcript 05-30 documenta soprattutto l'*infrastruttura* attorno al piano (MCP NotebookLM, Telegram, gateway, autonomia systemd/Docker, tunnel Cloudflare) più che decisioni di design dell'app — rilevante al piano solo come contesto operativo, non come scelte architetturali di marzio1777.

### Dati di stato / numeri storici (snapshot Maggio 2026)

- 7 Cloud Functions live + 2 skeleton (Fase 3) su `europe-west1`, runtime `nodejs22`, Blaze plan. `[CR]:807`, `[CM]` §"Cloud Functions deployate".
- 63 test unità · 52 test rule · 31 Sporche catalogate · ~226 KB bundle gz · **0 dipendenze nuove oltre il core**. `[CR]:808-813`
- Ultimo SHA locale 2026-05-08: `f5c1cab`. `[CM]` §"Stato del repository".
- **Resta per Fase 3**: crossfade + playlist locali audio; «L'Ospite Perfetto» (heartbeat CF); attivazione `auditMassSkip` + `validateP2PTransferIntegrity` (servono field di tracking inesistenti, es. `blobSha256`); Concept C/D/E giochi; toast system globale al posto di `alert()`. `[CR]:815`, `[CM]`.

### Note di provenienza / irrisolti

- `[IRRISOLTO]` `CLAUDE.md` è **gitignored**: descrive il codice ma vive solo in locale; possibile drift con lo stato reale del repo. La cartella documentata è una **cache di sola-doc** (niente `src/`, `firestore.rules`, `package.json` qui) — i path citati descrivono il repo del codice, non file presenti. `[CM]` §Orientamento.
- `[IRRISOLTO]` Footer cronache firmato «Co-Authored-By: Claude Opus 4.7» in `[CM]`, mentre il brief in `[T30]` è advised con «Opus 4.8» — segnala evoluzione temporale del tooling fra i documenti, non una decisione.
