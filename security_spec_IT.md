# Specifiche di Sicurezza: Memorie Marziesi

*Revisione di Maggio 2026 — estensione del modello a Il Campo dei Giochi (game_events, items, leaderboard, quiz rounds, host dinamico) e a L'Ainulindalë (audio_sessions, queue, conduttore di sessione, signaling WebRTC, libreria locale).*

*Revisione B7 di Maggio 2026 — hardening post-audit: chiusura definitiva delle Sporche #25/#26 "Theme Hijacker", split owner-side dello scoring quiz (Sporca #17 indurita), ownership stretta su `leaderboard.write` e `participants.delete`, cap `users.points` increment alzato a +1000/transaction per coerenza con il range moltiplicatori, `validQueueStatusTransition` allineata al flow spec'd.*

## 1. Invarianti dei Dati

### 1.1 Invarianti Storici (Memorie & Comunità)

- **Identità Utente:** Un profilo utente (`users/{userId}`) può essere modificato solo dal suo proprietario. I campi `role` e `accountStatus` sono rigorosamente immutabili da parte degli utenti standard; possono essere modificati solo da un Admin o Root entro le transizioni codificate (vedi §2). **Estensione 2026:** `points` è ora incrementato dalle transazioni owner-side di Concept A (cattura), Concept B (self-claim post-reveal — vedi §1.2), e da L'Ainulindalë (Tema played, +5/+10 DJ bonus). Tutti gli incrementi passano per `increment()` atomico Firestore. Il moltiplicatore evento è sempre ≥ 0; sottrazioni di punti via gioco o via audio sono **vietate** (no penalty system per design). **Cap owner-side (B7, Maggio 2026):** la rule `users.update` ammette `incoming().points - existing().points ≤ 1000` per transazione (era 50 pre-B7, sottodimensionato rispetto al range `pointsMultiplier ∈ [0.5, 5.0]`). Anti-cheat reale rimane nelle rule dell'azione che assegna i punti (`items.update`, `answers.update`, `queue.update`); il cap `users.points` blocca solo il forging catastrofico (`points: 9999999`).
- **La Coda "Pending" e Gerarchia Ruoli:**
  - Gli utenti standard si registrano forzatamente come `accountStatus: 'pending'` e `role: 'Guest'`.
  - Root si registra organicamente aggirando questo con (`accountStatus: 'approved'`).
  - Gli Admin possono modificare in `/users` lo stato `accountStatus` e portarlo ad `approved` abbinando `role: 'Guest'`.
  - Admin possono elevare da Guest approvato a `Admin`.
  - Solo Root forza un downgrade o promuove un pending direttamente ad `Admin` o manipola altri Admin.
- **Proprietà del Post:** Una memoria (`posts/{postId}`) non può esistere senza un `authorId` valido che coincida con l'utente creatore del doc. `authorId` è immutabile.
- **Integrità Relazionale Commenti:** Un commento (`posts/{postId}/comments/{commentId}`) appartiene al Post madre. Se il Post è oscurato o privato, previene i fetch su autorizzazioni commentare.
- **Updates Mappati:** Azioni specifiche. Un utente agisce solo ed esclusivamente e singolarmente su `caption`, `visibilityStatus`, `visibilityTime`, `showInCinematografo`, o `location`. L'aggiornamento dei "Mi Piace" (cuori) incorpora una doppia validazione con tracking tramite array (`likedBy`) legando matematicamente l'update all'accoppiata di logiche su `likesCount`, prevenendo loop, falsificazioni dei conteggi ed upvotes infiniti per singolo post.
- **Isolamento PII:** `users` possiede `email`. Non consultabile in array o collection read ad utenze normali.

### 1.2 Invarianti dei Giochi (Il Campo dei Giochi)

- **Proprietà dell'Evento:** Un `game_events/{eventId}` non può esistere senza un `organizerId` valido. Il campo è **immutabile dopo create**. Allo stesso modo `type` e `createdAt` sono fissi. La cancellazione è permessa solo a Root e solo se `status != 'active'`.
- **Transizioni di Stato Controllate:** La macchina a stati `draft → scheduled → lobby → active → completed` è codificata in una rule helper `validStatusTransition(old, new)`. Ogni cambio di stato è verificato server-side; transizioni "all'indietro" o salti illegali (es. `draft → completed`) sono respinti. `aborted` è l'unica uscita laterale ammessa, da qualsiasi stato pre-completed.
- **Immutabilità degli Items Spawnati:** Una volta creato in stato `spawned`, un `items/{itemId}` ha `lat`, `lng`, `points`, `templateId`, `captureRadius` rigorosamente immutabili. Solo lo `status` può transitare a `collected`, e solo via update controllato (vedi sotto).
- **Cattura Atomica:** L'`update` di un `items/{itemId}` da `spawned` a `collected` deve:
  1. Avvenire durante `status == 'active'` dell'evento padre
  2. Essere effettuato da un `request.auth.uid` che è `participants.status == 'joined'`
  3. Settare `collectedBy == request.auth.uid` (no spoofing)
  4. Avvenire dentro una `runTransaction` di Firestore che verifica `resource.data.status == 'spawned'`
  5. Mantenere invariati TUTTI gli altri campi (lat, lng, points, ecc.)
  6. Includere `collectedAtLat` e `collectedAtLng` come audit log per investigazione ex-post di "The Teleporter"
- **finalLeaderboard come Embedded Immutabile:** A differenza del piano iniziale (sub-collection `leaderboard/final`), l'implementazione effettiva usa un **array embedded `finalLeaderboard`** sul documento `game_events/{eventId}`. La rule garantisce immutabilità con la clausola: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))`. Permette la write nella sola transizione `active → completed` (perché in quel momento `resource.data.status == 'active'`); dopo `completed`, qualsiasi tentativo di modificare `finalLeaderboard` viene respinto, anche da Root. La storia non si riscrive.
- **Segreto del Quiz:** L'`index` della risposta corretta di un round (`correctIndex`) è scritto **esclusivamente** in una sotto-sotto-collezione `quizRounds/{roundId}/secret/correctness`. La rule di lettura è ristretta a `currentHostId`, `organizerId` e Root. Solo al momento del reveal (write su `quizRounds/{roundId}.revealedAt` da uno della triade host), il valore viene copiato nel doc parent, dove diventa leggibile a tutti.
- **Punteggio Quiz Validato (B7 — Maggio 2026):** L'`update` di `pointsAwarded` su `answers/{userId}` ha due path autorizzati: (1) **self-claim owner-side** (`answerUserId == request.auth.uid && isEventParticipant(eventId)`), preferito dal client `claimMyAnswerPoints`; (2) **override host-triade** (`currentHostId | organizerId | Root`) per Root recovery. In entrambi i casi la rule re-deriva la verità dal `correctIndex` pubblico post-reveal e impone: `revealedAt != null`, `affectedKeys().hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap allineato alla configurazione effettiva del round, non più al solo `pointsMultiplier × 100`), e `selectedIndex == correctIndex` quando `pointsAwarded > 0`. **Razionale dello split:** la versione precedente faceva l'host scrivere `users/{altroUid}.points` per ogni partecipante, ma la rule `users.update` consente l'increment solo all'owner; il flusso era effettivamente respinto in produzione. Il self-claim ribalta la pipeline mantenendo invariati gli anti-cheat. Il client garantisce la singolarità del claim via `localStorage[marzio1777:quiz-claimed:{roundId}:{uid}]`; un retry malevolo con `pointsAwarded > 0` su risposta sbagliata viene comunque respinto dalla rule.
- **Host come Ruolo Effimero — Validazione del Successore:** Il `currentHostId` di un evento può essere cambiato solo dall'host uscente, dall'organizer o dal Root. La rule isola il diff con `affectedKeys()` per garantire che l'host non possa modificare ALTRI campi dell'evento (status, multiplier, configurazioni). **Inoltre, il nuovo `currentHostId` deve essere un partecipante con `status == 'joined'`**, validato in rule via `exists()` + `get()` sulla sub-collection `participants/{newHostId}`. Un host malizioso non può scrivere `currentHostId = "alieno-uid"` per congelare il quiz, né può promuovere se stesso a organizer.
- **One Vote, One Round:** Un partecipante può creare un solo `answers/{userId}` per `quizRounds/{roundId}`. Update successivi sono respinti. La risposta deve essere submittata `< endsAt` (no late submissions).
- **PII delle Live Locations:** Anche durante un evento `treasure_hunt`, la posizione live di un giocatore è scritta solo in `user_locations` (split collection), e solo se `participants.shareLocationDuringEvent == true` (override per-utente). L'opt-in dell'evento (`game_events.visibilityOfOthers`) è un permesso dell'organizzatore di consentire la visibilità; il consenso del singolo utente prevale sempre.
- **Leaderboard Ownership-Stretto (B7 — Maggio 2026):** la rule `game_events/{}/leaderboard.{userId}.write` ammette ora soltanto: (a) self-write (`userId == request.auth.uid`), che è il path caldo della transazione di cattura e del self-claim quiz; (b) `isEventOrganizer(eventId)`; (c) `isRoot()`. Pre-B7 qualsiasi `isEventParticipant || isAdminOrRoot` poteva sovrascrivere il leaderboard di chiunque, consentendo a un partecipante malicioso di azzerare il punteggio di un avversario.
- **Participants Delete Ownership-Stretto (B7 — Maggio 2026):** la rule `game_events/{}/participants/{userId}.delete` ammette soltanto self-leave (`userId == request.auth.uid`), `isEventOrganizer(eventId)` (kick legittimo), e `isRoot()`. Pre-B7 l'allow `isApprovedUser` permetteva a chiunque di rimuovere altri partecipanti.

### 1.3 Invarianti de L'Ainulindalë (Modulo Audio)

- **Proprietà della Sessione:** Una `audio_sessions/{sessionId}` non può esistere senza un `djId` valido che coincida con `request.auth.uid` al momento della create. `djId` è **immutabile dopo create**. Allo stesso modo `createdAt` è fisso. La create è limitata a `role in ['Admin', 'Root']` (Guest non possono aprire sessioni).
- **Transizione di Stato Mono-direzionale:** Il `status` di una sessione può solo passare da `'open'` a `'closed'`. Mai il contrario. Una volta chiusa, la sessione è **archiviata permanentemente**: nessuna scrittura sulla sessione, sulla coda o sui partecipanti è più ammessa, neanche da Root. Le `finalStats` sono popolate atomicamente nella stessa transition `open → closed` e immediatamente immutabili.
- **`djBonusAwarded` come Flag One-Way:** Bool opzionale su `audio_sessions/{sessionId}`. La rule consente la transizione `false → true` (o doc senza il campo `→ true`) **una sola volta**, durante il batch di chiusura della sessione, se `totalDurationMs > 30 min`. Qualsiasi tentativo di rimettere `false`, di re-incrementare `users.points` con un secondo bonus, o di toccare il campo dopo `status == 'closed'` viene respinto. Anti double-spend del +10 long-session.
- **Immutabilità delle Proposte (B7 — Maggio 2026):** Una `queue/{itemId}` ha `proposedBy`, `localTrackId`, `proposedAt` e tutti i metadati traccia (`trackTitle`, `trackArtist`, `trackDurationMs`, ecc.) **immutabili dopo create**, ora enforced via `affectedKeys().hasOnly(['status', 'position', 'transferStartedAt', 'transferCompletedAt', 'transferFailureReason', 'pointsAwarded'])` con check ridondante esplicito su ciascun campo metadata (`incoming().proposedBy == existing().proposedBy`, ecc.) come defense-in-depth. Pre-B7 la rule controllava solo lo status; il DJ poteva tecnicamente riscrivere `trackTitle`/`proposedBy`/`localTrackId` chiudendo solo "Sporca #25" al ~70%. Vedi §2.3 punto #25/#26.
- **Conduttore di Sessione (DJ) come Ruolo Esclusivo:** Solo il `djId` (e il Root come fallback amministrativo) può:
  - Modificare `currentQueueItemId`, `currentTrackTitle`, `currentTrackArtist`, `currentTrackDurationMs`, `currentTrackStartedAt` (cioè scrivere il "now playing")
  - Riordinare la coda (modificare `queue/{X}.position`)
  - Skippare una traccia (`queue/{X}.status = 'skipped'`)
  - Switchare `mode` tra `'auto'` e `'manual'`
  - Chiudere la sessione (`status = 'closed'` + popolamento `finalStats`)
  - Kickare un partecipante (`participants/{X}.status = 'kicked'`)
  - Assegnare `pointsAwarded` al momento della transizione `playing → played`
  
  Helper rule dedicato `isSessionDJ(sessionId)`. Un partecipante non-DJ che tenta una qualunque di queste mutazioni viene respinto.
- **Vincoli su Queue Create:** L'create di una `queue/{itemId}` è ammessa solo se:
  - `request.auth.uid` è participant (`participants/{auth.uid}.status == 'joined'`)
  - `proposedBy == request.auth.uid` (no proxy)
  - `status == 'queued'` al momento della create (no skip allo stato 'ready')
  - Numero di propri queue items con `status in ['queued', 'transferring', 'ready']` è ≤ effective_maxQueuedPerUser, dove `effective = rules.maxQueuedPerUser + floor(user.points / 100) * rules.bonusPerHundredPoints`
  - Se `rules.allowDuplicates == false`, non esistono già queue items dello stesso utente con stesso `localTrackId` in stato attivo
  - `trackDurationMs` ≤ 600_000 (10 minuti, taglio sanity)
  - `trackCoverDataUrl`, se presente, ≤ 70_000 caratteri base64 (cap ~50KB di immagine)
- **Validazione del Punteggio Audio:** L'`update` di `pointsAwarded` su `queue/{itemId}` è permesso solo al DJ (o Root), con cap `pointsAwarded ∈ [0, 50]` enforced direttamente in rule (B7 — pre-fix il cap esisteva solo come "≥ 0" + assenza di upper bound esplicita). Coerente con `BASE_TRACK_POINTS × max_eventMultiplier = 2 × 5 = 10` con margine.
- **Signaling Effimero & Confidenziale:** I documenti `audio_sessions/{sessionId}/signaling/{userId}` sono leggibili **solo** dal `djId` della sessione e dal `userId` proprietario del doc. Nessun altro participant può leggerli. La create è limitata a `request.auth.uid == userId` (proposer) o `request.auth.uid == djId` (DJ che inizia il transfer). I documenti hanno un `expireAt` che ne marca la scadenza per cleanup periodico (Cloud Function Fase 2). Nessun dato personale o file binario è mai scritto qui — solo SDP offer/answer e ICE candidates.
- **Niente File Audio nel Cloud:** **Per design, nessun byte audio è mai scritto su Firestore o Firebase Storage.** I file musicali vivono esclusivamente nell'IndexedDB locale del proposer (`marzio1777_audio` DB), e durante una sessione vengono trasferiti peer-to-peer device-to-device via WebRTC. La rule Firestore non ha bisogno di proteggere file audio perché non ne esistono. Solo i metadati (titolo, artista, durata, eventuale cover ≤50KB) viaggiano sulle collection.
- **Heartbeat dei Partecipanti:** Un `participants/{userId}.lastSeenAt` è scrivibile solo dal `userId` stesso (auto-heartbeat ogni 15s lato client). Marca la presenza viva e abilita il flag `autoSkipOfflineProposers`: se un proposer è offline (>60s da ultimo heartbeat) e arriva il suo turno in coda, il DJ Engine può skippare automaticamente senza penalizzazioni.
- **Linkability con i Game Events:** Il campo opzionale `linkedGameEventId` su `audio_sessions/{sessionId}` è immutabile dopo create. Quando linked a un `game_events/{eventId}` con stato attivo, le proposte eseguite ereditano il moltiplicatore evento per il bonus punti al proposer (es. evento Ferragosto 2x → +4 invece di +2). Il link è un riferimento read-only: la sessione audio e l'evento di gioco restano indipendenti come ciclo di vita.

## 2. Le "Sporche" — Catalogo dei Vettori d'Attacco

### 2.1 Le Dodici Sporche Storiche (Memorie & Comunità)

1. **The Shadow Update:** Tentare di inserire campi fasulli non validati per farli leggere.
2. **The ID Poisoner:** ID stringa di GigaByte di dimensioni. Tagliato alla base.
3. **The Privilege Escalator (RBAC Bypass):** L'utente tenta mutazioni interne ad App ad "Admin", stoppato duramente.
4. **The Admin Demotion (Admin Bypass):** Tentativo tra pari per destituire Admin, negato.
5. **The Value Poisoner:** String payload mandato in attesa di Type specific. Bloccato.
6. **The Email Spoofing Test:** Bypass con finta email non garantita (email_verified flag fail).
7. **The PII Blanket Test:** Query scraping delle info app per leggere array, annullato.
8. **The Timewarp:** Creazione di commento al 2088 bloccato.
9. **The Denial of Wallet (Arrays):** Nessuna entità contiene liste eccessive in array statico. Listate in collection.
10. **The Outcome Override:** Alterazioni eventi conclusi respinte.
11. **The Unauthorized Relational Grab:** Prelevamento commenti in query private respingerà accesso di colpo.
12. **The Orphanizer:** Previene distruzioni massive ma orfane del creatore principale mantenendo il check su autore.

### 2.2 Le Dieci Sporche del Campo dei Giochi (Estensione 2026)

13. **The Phantom Item:** Creazione di un nuovo `items/{itemId}` da parte di un partecipante non-organizzatore durante l'evento attivo (auto-spawn cheat). Bloccato: rule limita la create degli items a fase `draft|scheduled` e a `organizerId`/Admin/Root.
14. **The Teleporter:** Tentativo di catturare un item mentre il giocatore è oltre il `captureRadius`. **Limitazione nota MVP:** la rule Firestore non può eseguire calcoli Haversine (DSL limitato). Mitigazione attuale: `collectedAtLat/Lng` salvati per audit log; mitigazione completa demandata a Cloud Function in Fase 2.
15. **The Phantom Host:** Tentativo di un partecipante di scrivere su `quizRounds/{roundId}/secret/correctness` o di rivelare la risposta senza essere `currentHostId`. Stoppato dalla rule via helper `isCurrentHost(eventId)` con triade organizer/host/Root.
16. **The Self-Crowning:** Tentativo di un partecipante di riscrivere `currentHostId` indicandosi nominalmente come nuovo host. Bloccato: la rule update su `game_events` isola il field via `diff().affectedKeys().hasOnly(['currentHostId', ...])` e permette la scrittura solo a `currentHostId` uscente, organizer o Root, **e verifica con `exists()` + `get()` che il nuovo host sia un participant con `status == 'joined'`**.
17. **The Score Forger:** Scrittura ottimistica di `pointsAwarded: 9999` su una propria `answers/{userId}` post-reveal con risposta sbagliata. **Indurito (B7, Maggio 2026):** la rule `answers.update` ora ammette il self-claim post-reveal (`answerUserId == request.auth.uid && isEventParticipant`) ma applica simultaneamente: `revealedAt != null`, `affectedKeys.hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap allineato alla configurazione effettiva), e `selectedIndex == correctIndex` come precondizione per `pointsAwarded > 0`. La transazione client `claimMyAnswerPoints` accredita anche `users/{me}.points` con un `increment(pts)` capped a +1000/transaction. Triplo cap (rule answers, rule users, configurazione round) — un cheat dovrebbe bypassare tutti e tre.
18. **The Late Submitter:** Submit di una `answers/{userId}` dopo `endsAt` del round. Bloccato: rule check `request.time < endsAt` su create.
19. **The Ghost Capture:** Tentativo di "catturare" un item già `collected`. Risolto naturalmente dalla `runTransaction`: il replay rileva lo status cambiato e fa fallire la transazione. Il giocatore vede un errore gestito, niente double-spend.
20. **The Speed Demon (false GPS):** GPS spoofing da DevTools (browser desktop). **Tollerato per design:** app di paese, comunità chiusa whitelisted. La rule respinge solo accuracy palesemente insulse (>100m); il resto è demandato all'audit log e all'occhio umano. La filosofia: se Mario gioca da casa fingendo di essere fuori, lo si scopre alla pizzata successiva.
21. **The Time Bandit:** Tentativo di forzare un evento da `draft` direttamente a `completed` per saltare il gioco e bloccare la classifica. Bloccato dalla rule `validStatusTransition` che ammette solo le transizioni in catena.
22. **The Resurrectionist:** Tentativo di scrittura su `finalLeaderboard` dopo che `status == 'completed'`. Bloccato: la rule rifiuta qualsiasi update che modifichi `finalLeaderboard` quando `resource.data.status == 'completed'`. La transizione `active → completed` è l'unico momento in cui `finalLeaderboard` è scrivibile.

### 2.3 Le Sette Sporche di Sauron (Estensione L'Ainulindalë 2026)

23. **The Phantom DJ:** Tentativo di un Guest (o anche Admin generico) di aprire una `audio_sessions` come `djId == auth.uid` per acquisire l'autorità di Conduttore. Bloccato: rule create restringe a `role in ['Admin', 'Root']`. Allo stesso modo, un Guest non può scrivere `currentQueueItemId` su una sessione di cui non è DJ — bloccato dalla rule via `isSessionDJ(sessionId)`.
24. **The Queue Stuffer:** Tentativo di un proposer di scrivere 50 queue items in stato attivo ignorando il limite per-utente. **Mitigazione formula (Maggio 2026):** la rule `queue.create` esige il campo derivato `incoming().effectiveMaxAtCreate` (un numero) e lo valida contro l'helper `effectiveMaxQueued(sessionId)`, che ricostruisce in DSL la formula `rules.maxQueuedPerUser + int(getUserDoc().points / 100) * rules.bonusPerHundredPoints`. Forge del valore (es. scrivere `effectiveMaxAtCreate: 9999`) → respinto con `PERMISSION_DENIED`. **Limitazione DSL nota:** il count effettivo dei doc attivi del proposer non è esprimibile in DSL Firestore (non si possono contare documenti). L'enforcement finale del count resta CF Fase 2 (`enforceQueuePerUserLimit`, vedi `MIGRATION.md`); la mitigazione attuale chiude il forge ma non il count puro.
25. **The Theme Hijacker:** Tentativo di modificare `proposedBy`, `localTrackId`, o i metadati traccia di un queue item dopo la create. **Chiuso al 100% (B7, Maggio 2026):** `audio_sessions/{}/queue.update` ora richiede `affectedKeys().hasOnly(['status', 'position', 'transferStartedAt', 'transferCompletedAt', 'transferFailureReason', 'pointsAwarded'])` + check ridondante esplicito (`incoming().proposedBy == existing().proposedBy`, ecc.) come defense-in-depth. Un proposer maligno non può cambiare retroattivamente il `proposedBy` per addossare ad altri il proprio errore di license, né cambiare il `localTrackId` per "sostituire" la traccia da trasferire. Pre-B7 la rule respingeva solo le transizioni di status invalide; tecnicamente il DJ poteva ancora riscrivere i metadati. Test rule: `firestore.rules.audio.test.ts` casi "DJ cannot rewrite proposedBy/trackTitle/localTrackId".
26. **The Theme Hijacker (variante DJ):** Tentativo del DJ di modificare i metadati di una proposta altrui (es. cambiare `trackTitle` per spostare blame su un proposer). **Chiuso al 100% (B7, Maggio 2026):** lo stesso meccanismo `affectedKeys.hasOnly` + check espliciti vale per chiunque, DJ incluso. I metadati sono immutabili per il DJ tanto quanto per il proposer. Il DJ può solo skippare/playare/marcare 'failed' e assegnare `pointsAwarded` (capped a 50), non riscrivere ciò che il proposer ha scritto.
27. **The Player Ghost:** Tentativo di un listener di scrivere `currentTrackStartedAt` o `currentQueueItemId` per "spoofare" il now playing visto dagli altri (es. far credere che la sua proposta sia in riproduzione quando non lo è). Bloccato: solo il DJ (`isSessionDJ`) può modificare i campi del now playing. L'helper rule isola questi campi e respinge update di non-DJ.
28. **The Resurrectionist (variante audio):** Tentativo di scrivere su una sessione (qualsiasi sub-collection: queue, participants, signaling, doc parent) dopo che `status == 'closed'`. Bloccato: la rule `match /audio_sessions/{sessionId}` ha una clausola top-level `allow write: if resource.data.status != 'closed'` che si propaga a tutte le sub-collections via helper `isSessionOpen(sessionId)`. Una volta chiusa, la sessione è una scolpita.
29. **The Mass Skipper:** Tentativo di un DJ di marcare 'skipped' centinaia di proposte in burst rapido per "ostacolare" un proposer specifico. **Tollerato per design:** il DJ ha autorità sulla sua sessione, è una scelta consapevole averlo affidato a un Admin/Root di fiducia. Il `participants/{X}.status = 'kicked'` è il rimedio per casi davvero abusivi (Root può sempre intervenire). Audit log degli skip non è implementato in MVP — Fase 2.
30. **The Signaling Spammer:** Tentativo di un partecipante di scrivere centinaia di documenti in `audio_sessions/{X}/signaling/` per saturare la coda di onSnapshot del DJ. **Bloccato (Maggio 2026):** la rule sub-collection `match /audio_sessions/{sessionId}/signaling/{userId}` ammette `read/create/update/delete` SOLO al proposer (`userId == request.auth.uid`) o al DJ della sessione (`isSessionDJ(sessionId)`). Un utente terzo non può creare `signaling/{altroUid}` né leggere quelli di altri. Il `sessionId` è ora implicito nel path (era top-level prima del fix), eliminando il bisogno di lookup inverso. Rate-limiting per IP/UID resta demandato a Firebase project quotas. Cloud Function di cleanup periodico in Fase 2 per gestire orfani (`cleanupOrphanSignaling`). Test rule: `firestore.rules.audio.test.ts` casi "third-party rejected" + "DJ allowed" + "proposer self".

### 2.4 Limitazioni Note (e Accettate) — Riepilogo

| Limitazione | Vettore | Modulo | Mitigazione attuale | Mitigazione completa |
|---|---|---|---|---|
| Cattura senza essere nel raggio | The Teleporter (#14) | Giochi | ✅ chiuso Fase 2 (Maggio 2026) — CF `validateCaptureDistance` Haversine server-side + `serverValidatedAt` ≤30s su `items.update` | — |
| GPS spoofing browser desktop | The Speed Demon (#20) | Giochi | Rule respinge accuracy >100m | — (community-level trust) |
| Host vede correctIndex pre-reveal | inerente al design | Giochi | UX trasparente (banner "L'Host vede") | Phase 3 (richiederebbe quiz CF orchestrator) |
| FCM notifiche pre-evento | ✅ chiuso Fase 2 (Maggio 2026) — `notifyKickoff` CF su `europe-west1`, `users.{uid}.fcmTokens[]` cap 20, Service Worker dedicato, opt-in UI in ProfiloPersonale | Trasversale | — | — |
| Skip burst del DJ | The Mass Skipper (#29) | Audio | Root può intervenire + skeleton CF `auditMassSkip` deployato (ritorna no-op TODO) | Phase 3 (rolling-window counter su `audit_state/{sessionId}`) |
| Signaling orfani | The Signaling Spammer (#30) | Audio | ✅ chiuso Fase 2 (Maggio 2026) — CF `cleanupOrphanSignaling` cron 5 min su `europe-west1` con collectionGroup query + chunked batch delete | — |
| Queue stuffer count | The Queue Stuffer (#24) | Audio | ✅ chiuso Fase 2 (Maggio 2026) — CF `enforceQueuePerUserLimit` callable conta doc attivi del proposer; rule `effectiveMaxAtCreate` snapshot resta come safety net | — |
| File trasferiti tampered | hash check assente | Audio | skeleton CF `validateP2PTransferIntegrity` deployato (ritorna `unimplemented`) | Phase 3 (richiede campo `blobSha256` su `QueueItem`) |
| License copyright tracce | trust model | Audio | UI warning "regola dell'oro" | — (community-level trust) |
| Theme Hijacker DJ-side | The Theme Hijacker (#25/#26) | Audio | **Chiuso al 100% (B7)** via `affectedKeys.hasOnly` + check espliciti su metadati | — (vettore chiuso) |
| Score Forger post-reveal | The Score Forger (#17) | Giochi | **Indurito (B7)** con triplo cap: cap rule answers (`maxPointsPerRound × pointsMultiplier`), cap rule users (+1000/tx), cap user.points incremento monotono | — (vettore mitigato a livello rule) |
| Cross-leaderboard rewrite | nuovo vettore identificato in audit B7 | Giochi | **Chiuso (B7)** via `userId == auth.uid` su `leaderboard.write` | — (vettore chiuso) |
| Cross-participant kick | nuovo vettore identificato in audit B7 | Giochi | **Chiuso (B7)** via `userId == auth.uid \|\| isEventOrganizer \|\| isRoot` su `participants.delete` | — (vettore chiuso) |

**Aggiornamento Maggio 2026:** Fase 2 chiusa al 100% per CF di hardening (8 CF live su `europe-west1` / `nodejs22`). Le rimanenze in tabella sono vere limitazioni Phase 3 (skeleton callable già deployati, attendono i field di tracking che non esistono ancora) o trade-off by-design (Speed Demon, Host vede correctIndex).

## 3. Test Runner

Accertare schema esatto per la corretta gestione testata ed isolata che riprenderà sempre i punti soprastanti rendendo Firestore uno scudo effettivo e non solo virtuale limitato a logica per UI.

**Estensione 2026 — Suite di Test del Campo dei Giochi:**

I test delle rule Firestore (con `@firebase/rules-unit-testing` su emulator) coprono almeno i seguenti scenari critici:

- Concorrenza `items.update`: due client simultanei sullo stesso item → solo uno commit, l'altro fallisce
- `correctIndex` non leggibile da partecipante non-host pre-reveal
- `correctIndex` leggibile da tutti post-reveal
- `currentHost` ≠ `organizer` può creare round, scrivere `secret/correctness`, fare reveal
- Partecipante random NON può modificare `currentHostId` (PERMISSION_DENIED)
- `currentHost` uscente PUÒ scrivere il nuovo `currentHostId` SE il successore è participant joined
- `currentHost` uscente NON può scrivere `currentHostId = "alieno-uid"` (nuovo controllo via exists+get)
- `currentHost` NON può modificare ALTRI campi dell'evento (status, multiplier, ecc.)
- `answers.create` dopo `endsAt` respinta
- `answers.update` con `pointsAwarded > 0` ma `selectedIndex != correctIndex` respinta
- `answers.update` con `pointsAwarded > maxPointsPerRound` respinta
- Transizione di stato non valida (es. `draft → completed`) respinta
- Update di `finalLeaderboard` quando `status == 'completed'` respinta (anche da Root)
- Guest pending non vede nessun `game_events/*`
- Guest approvato non invitato non vede l'evento specifico

**Estensione 2026 — Suite di Test de L'Ainulindalë:**

I test rule audio (`firestore.rules.audio.test.ts`) coprono:

- Guest non può creare `audio_sessions` (PERMISSION_DENIED)
- Admin può creare sessione con `djId == auth.uid`
- Admin non può creare sessione con `djId == altroUid` (no spoofing)
- Modifica di `djId` post-create respinta (campo immutabile)
- Solo DJ può scrivere `currentQueueItemId` / `currentTrackStartedAt` / `mode`
- Listener prova a scrivere now playing → PERMISSION_DENIED
- Queue.create con limite per-utente rispettato (test con bonus formula su user.points = 0, 250, 500)
- Queue.create che eccede limite → PERMISSION_DENIED
- Queue.update di `proposedBy` post-create → PERMISSION_DENIED
- Queue.update di `pointsAwarded` da listener → PERMISSION_DENIED
- Queue.update di `pointsAwarded > 50` da DJ → PERMISSION_DENIED
- Signaling read da terzo participant → PERMISSION_DENIED
- Signaling read da DJ proprietario sessione → ALLOWED
- Signaling read da userId proprietario doc → ALLOWED
- Write su sessione `status == 'closed'` → PERMISSION_DENIED (test su queue, participants, signaling, doc parent)
- `finalStats` write post-closed → PERMISSION_DENIED

Ogni test usa un `firestore.rules.test.ts` (giochi) e `firestore.rules.audio.test.ts` (audio) con suite isolate e teardown completo dell'emulator. Output reale dei test conservato in CI.

**Filosofia generale:** ridurre la superficie d'attacco a quanto effettivamente possibile e verificabile via rule (DSL Firestore), accettare esplicitamente le limitazioni note (Haversine server-side, hash check P2P), e demandare a Cloud Function (Fase 2) tutto ciò che il DSL non può esprimere. Ogni limitazione tollerata è documentata e ha un audit log corrispondente per investigazione ex-post. Il modulo audio aggiunge una dimensione nuova alla matrice difensiva: la **fiducia distribuita** sul contenuto musicale (responsabilità copyright dell'utente) e la **superficie effimera** del signaling WebRTC (vita brevissima, contenuto limitato a SDP/ICE, nessun dato sensibile mai scritto).

**Estensione B7 (Maggio 2026):** post-audit hardening, aggiunti test rule per:
- `users.points` cap +1000/transaction (5 casi: within cap, at cap, above cap, decrement, cross-user)
- `answers.update` self-claim post-reveal (5 casi: corretta success, sbagliata con pts>0 fail, sbagliata con pts=0 success, cross-user fail, over-cap fail)
- `leaderboard.write` ownership-stretto (2 casi: self success, cross fail)
- `participants.delete` ownership-stretto (3 casi: self-leave success, cross-participant fail, organizer success)
- `finalLeaderboard` immutability post-completed (1 caso)
- `audio_sessions/{}/queue.update` Theme Hijacker (8 casi: transition valid, shortcut blocked, metadata immutability, pointsAwarded cap, listener forbidden)

Totale: ~24 nuovi test rule oltre i preesistenti.
