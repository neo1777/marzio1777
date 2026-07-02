> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

## 8. Sicurezza & Privacy — riproduzione fedele in FlutterFire

> **Perché questa sezione.** La decisione §0.1 (backend invariato) sposta *tutto* il rischio di sicurezza sul confine di scrittura: `firestore.rules` (616 righe), le 7 CF e i 74 rule-test restano byte per byte, ma diventano il **giudice** di ogni write del client Dart. La rule non sa né le importa se chi scrive è React o Flutter — controlla la *forma* del documento. Quindi il pericolo non è "perdere una mitigazione" (le mitigazioni sono server-side e non si toccano): è che il client Dart scriva una **shape sbagliata** e venga respinto in modo silenzioso (`Missing or insufficient permissions`), o — peggio — che porti male un fallback e **riapra un buco** che la rule da sola non chiude. Questa sezione enumera, Sporca per Sporca, quale forma Dart è load-bearing.

### Verifica del piano attuale (gap trovati)

Il piano è corretto e ben fondato nell'impianto: §4.6 ("perché rules e 74 rule-test restano validi"), §5.3/§5.4 (rule-test restano in TS come gate), §6 (parallel-backend, cutover reversibile) reggono alla verifica contro `firestore.rules` e i sorgenti. I gap sono di *profondità* e di *precisione operativa*, non di direzione:

1. **Manca la matrice per-Sporca (il deliverable di questa dimensione).** Il piano afferma a livello alto "stesse shape ⇒ rule verdi" (§4.6, §5.3) ma non enumera mai *quali* shape Dart sono vincolanti per ciascuno dei 30 vettori + #31. Senza la matrice, "stesse shape" è un'intenzione, non un'istruzione.

2. **`is int` è sotto-specificato per Dart.** Il piano parla di "`Math.floor` al boundary" (§4.6) e cita il patto-a-3 (§3.6, §5.1), ma in JS `int` e `float` sono lo stesso tipo: il `Math.floor` è cosmetico. In **Dart** la distinzione `int`/`double` è di linguaggio e FlutterFire la serializza come tipi Firestore distinti su cui la rule fa `is int`. Inoltre il piano non nota l'**incoerenza reale nel codice**: `proposeTrack` (`src/hooks/useAudioQueue.ts:121`) **non** applica il floor, mentre `proposeTrackToSession` (`useAudioQueue.ts:236`) sì. In JS sono equivalenti; in Dart vanno portati **entrambi** a produrre un `int` (con `~/`), o uno dei due rami respinge `queue.create`.

3. **Gli update di campo annidato (dotted path) non sono mai citati.** Scritture security-relevant usano chiavi-stringa con punto: `'photoQuizConfig.currentHostId'` (`usePhotoQuiz.ts:137`), `'metrics.quizStreak'` (`usePhotoQuiz.ts:243,249`), `'metrics.consecutiveSkipped'` (`useAudioQueue.ts:61,63`), `'metrics.huntsLegacyCompleted'` (`useGameEvents.ts:356`). Le rule che le accettano controllano `affectedKeys().hasOnly(['metrics', …])` o, per il Self-Crowning, `photoQuizConfig.diff(...).affectedKeys().hasOnly(['currentHostId'])` (`firestore.rules:319-320`). Se il porting Dart scrive un campo top-level **letteralmente chiamato** `"metrics.quizStreak"` invece di un update annidato, `affectedKeys` diventa `['metrics.quizStreak']`, non matcha `'metrics'`, e la write è **respinta**. È il modo n.1 con cui un porting "fedele a vista" si rompe.

4. **La precisione del fallback CF è persa in §4.4.** Il piano riassume il fallback come "catch `not-found`/`unavailable` → legacy fast-path". Il codice reale fa l'opposto su un caso: `captureItemTransaction` su `functions/out-of-range` **rilancia** (blocca la cattura: il giocatore è troppo lontano) e va in fallback solo sugli *altri* errori (`useGameEvents.ts:286-293`); `enforceQueuePerUserLimit` su `functions/resource-exhausted` **rilancia** e va in fallback solo sugli altri (`useAudioQueue.ts:103-117`). Portare il fallback come dice il piano (catch-all → fast-path) **riaprirebbe #14 Teleporter e #24 Queue Stuffer** sul ramo CF-validato. In più, in FlutterFire i codici **non hanno il prefisso `functions/`**: `FirebaseFunctionsException.code == 'out-of-range'` / `'resource-exhausted'`. Trap di porting concreta.

5. **`serverTimestamp()` non è elevato a invariante.** Il piano lo elenca una volta (§4.6) ma non dice *dove* è load-bearing. La cattura item ha `request.resource.data.collectedAt == request.time` (`firestore.rules:376`): un `Timestamp.now()` lato client **non** è uguale a `request.time` server → respinta. Idem `revealedAt`, `transferStartedAt/CompletedAt`, `currentTrackStartedAt` (CLAUDE.md: "mai `Date.now()`"). In Dart: sempre `FieldValue.serverTimestamp()`.

6. **Live location: il piano coglie il filtro di *lettura* ma non il gate di *scrittura*.** "Il client deve filtrare `shareLiveLocation == true`" è giusto per `list` (`firestore.rules:177`, strict: senza il `where` la query è respinta *interamente*, non filtrata). Ma il piano non nota che `user_locations` **create/update richiedono `isAdminOrRoot()`** (`firestore.rules:178-179`): la scrittura della posizione è di fatto admin-only e il porting di `AuthContext` (`AuthContext.tsx:103-130`) deve riprodurre la write condizionata **e tollerare il permission-denied** per i non-admin (come fa oggi il `.catch(console.error)`).

7. **Il combinare due write in un solo `update` è un trap non segnalato.** I rami owner-side di `users.update` sono **mutuamente esclusivi** per `affectedKeys`: `['points','updatedAt','metrics']` (rules:140), oppure `['metrics','updatedAt']` (rules:152), oppure `['fcmTokens','updatedAt']` (rules:160), oppure il ramo profilo (rules:123). Nessun ramo ammette, p.es., `points` + `fcmTokens` insieme. Un serializzatore Dart che impacchetta più cambi in un solo `update()` → **respinto**. Il piano non avverte.

8. **Gli [IRRISOLTO] del dossier non sono portati come rischi di migrazione.** Manca su tutto: (a) il **drift di deploy** — il fix permessi `96353ca` risulta "locale, non pushato né deployato" (dossier §H): se le rule deployate in PROD ≠ `firestore.rules` del repo, la premessa parallel-backend (React e Flutter sotto *la stessa* rule) **è nulla** e approvazione/like/RSVP restano rotte in PROD; (b) Timewarp #8 (timestamp commento non validato), accuracy>100m #20 (mitigazione *assente* dalle rule, non solo "tollerata"), #28 `isSessionOpen` drift, conteggio "8 vs 7 CF".

---

### (a) Matrice delle 30 Sporche (+#31) per la migrazione

**Legenda delle forme Dart load-bearing** (la rule non cambia; queste sono le regole di scrittura del client):

- **[VALID]** — `set()` con tutti i campi richiesti da `keys().hasAll([...])` del validatore, tipi esatti, identità pinnata, cap rispettati.
- **[DIFF]** — `update()` parziale il cui `affectedKeys` cade **esattamente** in un ramo `hasOnly([...])`: **nessun campo di troppo** (in particolare niente `updatedAt`/`createdAt`/timestamp auto-aggiunti da un converter/ORM se quel ramo non li elenca), e mai un `set()` pieno dove la rule attende un diff.
- **[PIN]** — identità pinnata: il valore Dart di `<campo>` deve uguagliare `<docId>` o `auth.uid`.
- **[INT]** — serializzare come **`int` Dart** (calcolo con `~/`, mai `/`, mai `.toDouble()`); le costanti rule lette da Firestore vanno deserializzate come `int`.
- **[TS]** — `FieldValue.serverTimestamp()`, mai `Timestamp.now()`/`DateTime.now()`.
- **[NEST]** — update di campo annidato via `FieldPath(['a','b'])` (o forma annidata equivalente), **non** chiave-stringa `'a.b'` finché non è verificato che il plugin la splitta (vedi §nota porting).
- **[FSM]** — solo le transizioni di stato ammesse dalla macchina (`validStatusTransition` / `validQueueStatusTransition`).
- **[CAP]** — rispettare i tetti (`likedBy≤5000`, `fcmTokens≤20`, `points` +≤1000/tx, `pointsAwarded` quiz/audio, `points` item [1,200]); usare `arrayUnion/arrayRemove`, mai riscrivere l'array intero.
- **[ONEWAY]** — flag immutabile-a-true (`false→true` una sola volta).
- **[CF]** — riprodurre il fallback CF **distinguendo** il codice "blocca" da "fallback".

#### 2.1 Dodici Sporche storiche (Memorie & Comunità)

| # | Vettore | Mitigazione attuale (rule) | Cosa DEVE scrivere il client Dart |
|---|---|---|---|
| 1 | **Shadow Update** — campi-fantasma non validati | `isValid*` con `keys().hasAll([...])` (rules:50,68,77,84…) | **[VALID]** modello tipizzato con `toMap()` che non emette campi spuri; in lettura ignora i campi ignoti (model typed) così un campo iniettato non viene mai consumato. |
| 2 | **ID Poisoner** — id enorme | `isValidId` → `size()≤128` + `^[a-zA-Z0-9_\-]+$` (rules:13) | id da `collection().doc().id` (auto-id, conforme); per id custom (`round_${n}`, `correctness`) restare dentro pattern e lunghezza. |
| 3 | **Privilege Escalator** — self-promotion a Admin | self-branch esclude `role`/`accountStatus`/`points` dal diff (rules:122-127) | **[DIFF]** self-update tocca solo `displayName,photoURL,bio,apiKey,shareLiveLocation,anim*`; **non includere** `role`/`accountStatus`/`points` nel patch. |
| 4 | **Admin Demotion** — destituire un Root tra pari | ramo admin: `existing().role!='Root' && incoming().role!='Root'` (rules:164) | l'azione admin scrive solo via il ramo dedicato (`accountStatus`/`role`); nessuna scrittura su utenti Root. |
| 5 | **Value Poisoner** — tipo sbagliato | `is string/number/int/bool` nei validatori | **[INT]** rispettare i tipi Dart esatti; attenzione `int` vs `double` (un `double` dove la rule attende `is int` viene respinto). |
| 6 | **Email Spoofing** — `email_verified:false` | `isSignedIn()` esige `token.email_verified==true` (rules:10) | nessuna shape: replicare il gate di `AuthContext` (entra solo se `user.emailVerified`); gestire l'utente non verificato senza tentare write. |
| 7 | **PII Blanket** — scrape `users.list` | `users.list` solo `isAdminOrRoot()` (rules:119) | non eseguire `list` su `users` se non admin; le query lato Dart devono essere gated come oggi, e gestire `permission-denied`. |
| 8 | **Timewarp** — commento datato 2088 | **[IRRISOLTO]** nessun check su `timestamp` in `isValidComment` (rules:76-81; dossier:32) | **[TS]** scrivere sempre `serverTimestamp()` per `timestamp`: la rule non protegge, ma il client non deve *introdurre* il problema. Residuo da non riaprire (rules invariate). |
| 9 | **Denial of Wallet** — array enormi | cap `likedBy≤5000` (rules:72,217), `fcmTokens≤20` (rules:162) | **[CAP]** usare `arrayUnion/arrayRemove`; non riscrivere l'intera lista; non superare i cap. |
| 10 | **Outcome Override** — alterare eventi conclusi | `finalLeaderboard` immutabile post-`completed` (rules:329) | **[DIFF]** non scrivere `finalLeaderboard` dopo `completed`; replicare il `runTransaction` con re-check `status=='active'` (`useGameEvents.ts:221-236`). |
| 11 | **Unauthorized Relational Grab** — commenti da post privati | `comments.read` controlla il post madre (rules:242) | query gated; non assumere accesso ai commenti di post non pubblici/non propri. |
| 12 | **Orphanizer** — delete orfani | delete con check autore (rules:239,245) | cancellare solo da autore/admin; nessun delete cross-user. |

#### 2.2 Dieci Sporche del Campo dei Giochi (#13–22)

| # | Vettore | Mitigazione attuale (rule) | Cosa DEVE scrivere il client Dart |
|---|---|---|---|
| 13 | **Phantom Item** — partecipante crea item | `items.create` solo organizer/admin in fase `draft|scheduled` (rules:348-349) | **[VALID]** creare item solo da organizer; `points` **[INT]** ∈[1,200], `status=='spawned'`, `collectedBy==null` (`createGameItem`, `useGameEvents.ts:258-264`). |
| 14 | **Teleporter** — cattura oltre raggio | CF `validateCaptureDistance` + `serverValidatedAt`≤30s (rules:380-381) | **[CF]** chiamare la CF; su `out-of-range` **rilanciare** (blocca), su altri errori fallback. In Dart: `FirebaseFunctionsException.code=='out-of-range'` (**no** prefisso `functions/`). **[TS]** `collectedAt: serverTimestamp()` (== `request.time`). **[PIN]** `collectedBy==auth.uid`; non toccare `lat/lng/points/templateId`. |
| 15 | **Phantom Host** — scrive secret/reveal senza essere host | `isCurrentHost` triade (rules:431,437-438) | solo l'host scrive `quizRounds`/`secret`; **[DIFF]** il reveal tocca solo `['revealedAt','correctIndex','status','winnerId']` (`revealRound`, `usePhotoQuiz.ts:157-161`) + **[TS]** `revealedAt`. |
| 16 | **Self-Crowning** — riscrive `currentHostId` | `affectedKeys.hasOnly(['photoQuizConfig'])` + nested `hasOnly(['currentHostId'])` + nuovo host participant `joined` (rules:318-322) | **[NEST]** aggiornare `photoQuizConfig.currentHostId` come campo annidato; il diff annidato deve toccare **solo** `currentHostId`; il nuovo host deve già essere participant `joined`. |
| 17 | **Score Forger** — `pointsAwarded:9999` | triplo cap su `answers.update` (rules:461-472) + cap `users.points` +1000/tx (rules:143) | **[DIFF]** `answers.update` tocca **solo** `['pointsAwarded']`; valore ∈[0, `maxPointsPerRound×pointsMultiplier`]; `>0` solo se `selectedIndex==correctIndex`. `users.update` ramo points: `hasOnly(['points','updatedAt','metrics'])`, `increment` ≤1000 (`claimMyAnswerPoints`, `usePhotoQuiz.ts:226-251`). |
| 18 | **Late Submitter** — answer dopo `endsAt` | `request.time < endsAt` su create (rules:448) | `answers.create` entro la finestra; non ritentare dopo `endsAt` (errore atteso). |
| 19 | **Ghost Capture** — catturare item già `collected` | `runTransaction` + `resource.data.status=='spawned'` (rules:367) | replicare il `runTransaction` con re-read di `status` (`useGameEvents.ts:298-302`); su `status!='spawned'` errore utente, non retry. |
| 20 | **Speed Demon** — GPS spoof | **[IRRISOLTO]** check `accuracy>100m` **non presente** nelle rule lette (dossier:48); tollerato (community trust) | se il client React filtra `accuracy` lato client, replicarlo in Dart; **non assumere** una mitigazione rule che non esiste. Residuo accettato. |
| 21 | **Time Bandit** — forzare `draft→completed` | `validStatusTransition` (rules:333-339) | **[FSM]** scrivere solo transizioni in catena; replicare `advanceGameEventStatus` (`useGameEvents.ts:205-249`), ripinnando `organizerId/type/createdAt` immutabili. |
| 22 | **Resurrectionist** — write `finalLeaderboard` post-`completed` | rules:329 | come #10. |

#### 2.3 Otto Sporche di Sauron (Ainulindalë, #23–30)

| # | Vettore | Mitigazione attuale (rule) | Cosa DEVE scrivere il client Dart |
|---|---|---|---|
| 23 | **Phantom DJ** — spoof `djId` | `create` `isAdminOrRoot` + `djId==auth.uid` + `status=='open'` (rules:547) | **[VALID][PIN]** `djId==auth.uid`, `status=='open'`, `keys().hasAll(['djId','title','status','mode','rules'])`. |
| 24 | **Queue Stuffer** — N+1 brani | `effectiveMaxAtCreate is int == effectiveMaxQueued(sessionId)` (rules:564-565) + CF `enforceQueuePerUserLimit` | **[INT]** `effectiveMaxAtCreate` = **stesso `int`** della formula `maxQueuedPerUser + (points ~/ 100) * bonusPerHundredPoints` (leggere `rules.*` e `points` come `int`). **[CF]** su `resource-exhausted` **rilanciare**, altri errori fallback. **[PIN]** `proposedBy==auth.uid`, `status=='queued'`, essere `isSessionParticipant`. |
| 25/26 | **Theme Hijacker** (proposer/DJ) — alterare metadati coda | `affectedKeys.hasOnly(['status','position','transferStartedAt','transferCompletedAt','transferFailureReason','pointsAwarded'])` + check espliciti (rules:572-588) | **[DIFF]** `queue.update` tocca **solo** quei campi; metadati (`proposedBy/localTrackId/trackTitle/trackArtist/trackDurationMs`) immutabili. **[TS]** `transferStartedAt/CompletedAt`. **[CAP]** `pointsAwarded`∈[0,50]. **[FSM]** `validQueueStatusTransition`. |
| 27 | **Player Ghost** — spoof now-playing | solo `isSessionDJ` scrive now-playing (rules:548-549) | solo il DJ scrive `currentQueueItemId/currentTrack*/currentTrackStartedAt`; **[DIFF]** dentro l'elenco `audio_sessions.update` (rules:549); **[TS]** `currentTrackStartedAt`. |
| 28 | **Resurrectionist (audio)** — write su sessione `closed` | `update` richiede `existing().status=='open'` (rules:550); **[IRRISOLTO]** drift `isSessionOpen` su tutte le sub-collection (dossier:58) | non scrivere su sessione/sub-collection dopo la chiusura; gestire `permission-denied`. **[ONEWAY]** `djBonusAwarded` `false→true` una sola volta (rules:553-554). |
| 29 | **Mass Skipper** — skip in burst | tollerato + skeleton `auditMassSkip` (no-op) | nessuna shape; comportamento client come oggi. Residuo (Phase 3). |
| 30 | **Signaling Spammer** — flood `signaling/` | `signaling/{userId}` solo proposer/DJ (rules:608-613) | **[PIN]** scrivere solo `signaling/{auth.uid}` (o DJ); `sessionId` implicito nel path; cleanup `deleteDoc` best-effort (CF `cleanupOrphanSignaling` raccoglie il resto). |

#### 2.x Sporca extra

| # | Vettore | Mitigazione attuale (rule) | Cosa DEVE scrivere il client Dart |
|---|---|---|---|
| 31 | **Like Forger** — iniettare uid altrui in `likedBy`, double-like | `affectedKeys.hasOnly(['likesCount','likedBy'])` + set-diff `hasOnly([auth.uid])` + `!(auth.uid in existing)` (rules:215-233) | **[DIFF]** like = `update({'likesCount': FieldValue.increment(1), 'likedBy': FieldValue.arrayUnion([uid])})` — **e nient'altro** (niente `updatedAt`!). Unlike speculare: `increment(-1)` + `arrayRemove([uid])`. Un solo campo extra → nessun ramo matcha → respinto. |

#### Il principio che governa l'intera matrice (footgun §D del dossier)

Le rule usano `affectedKeys().hasOnly([...])` su ~13 siti (dossier §C). La disciplina centrale del porting non è "non perdere mitigazioni" — è: **scrivere esattamente il set di campi documentato, né più né meno, e usare `update()` (diff) dove la rule attende un diff, non un `set()` pieno.** Il footgun "`isValidX(incoming())` come AND globale" che ha colpito 3 volte lato rule (users/posts/events, dossier §D) è già chiuso e *non si tocca*; la sua eredità per il client Dart è che like/RSVP/comment-bump/metrics sono **rami distinti** con set di campi distinti, e il client deve cadere nel ramo giusto. Conseguenza pratica vincolante: **disabilitare qualsiasi auto-stamp** (un `withConverter`/freezed/json_serializable che aggiunge `updatedAt` o ripinna l'intero documento romperebbe i rami `hasOnly` che non lo elencano — like #31, RSVP, participants).

#### Nota di porting [INFERENZA, da verificare in Fase 0]

In `cloud_firestore` Dart, `update()` accetta chiavi `String` **o** `FieldPath`. Va **verificato sull'emulator** se una chiave-stringa con punti (`'metrics.quizStreak'`) viene splittata in path annidato (come il SDK JS) o trattata come nome di campo letterale. Finché non verificato, usare `update({FieldPath(['metrics','quizStreak']): FieldValue.increment(1)})`: è l'unica forma che garantisce `affectedKeys == ['metrics']` e fa matchare i rami delle Sporche #16, #17 e i gagliardetti. Test di shape dedicato (vedi (c)).

---

### (b) Privacy

**Live location — opt-in a doppio livello, filtro client obbligatorio.**
- *Lettura/list* (`LaMappa`): la query Dart **deve** includere `where('shareLiveLocation', isEqualTo: true)` perché `user_locations.list` lo esige (`firestore.rules:177`). Senza, la query è **respinta interamente** (non filtrata): è un permission-error, non una lista vuota. Mappa: `query(...where('shareLiveLocation','==',true))` → `.where('shareLiveLocation', isEqualTo: true).snapshots()`.
- *Scrittura* (`AuthContext`): `user_locations` create/update richiedono `isAdminOrRoot()` (`firestore.rules:178-179`) e `userId==auth.uid`. Il porting di `AuthContext.tsx:101-130` avvia il `geolocator` watch **solo se `profile.shareLiveLocation==true`** e scrive `liveLocation` con **[TS]** `updatedAt: serverTimestamp()`; deve **tollerare `permission-denied`** per i non-admin (come il `.catch` odierno). Override per-evento: `participants.shareLocationDuringEvent` (dossier:110) — "il consenso del singolo prevale sempre"; replicarlo nel ramo `participants.update` (`hasOnly([... 'shareLocationDuringEvent' ...])`, rules:401-402).

**Audio mai sul cloud — regola non negoziabile.** Per design nessun byte audio tocca Firestore o Storage (dossier:111; CLAUDE.md). Il porting deve **preservare la disciplina interamente client-side**: i byte vivono nel `LocalLibraryStore` (web IndexedDB/OPFS, nativo `drift`/file — §3.5b del piano), il trasferimento è P2P (`flutter_webrtc`), Firestore è **solo signaling**. Su Firestore viaggiano solo metadati (titolo, artista, durata, `trackCoverDataUrl` ≤~50KB base64 / ≤70000 char, dossier:85). La rule non protegge i file "perché non ne esistono": se il porting introducesse anche un solo upload-to-Storage, aprirebbe una superficie che nessuna rule copre. Vincolo da scrivere nero su bianco nel codice della via di fuga storage.

**Chiavi Gemini per-utente.** La chiave vive su `users/{uid}.apiKey`, scrivibile dall'owner (ramo self-update, rules:123) e leggibile solo da owner/admin (`users.get`, rules:118). **Disallineamento da sanare** (già notato dal piano, §3 scoperta 3): il codice reale legge `localStorage.getItem('gemini_api_key')` in `IlBaule`, **non** `profile.apiKey`. Nel porting: leggere da `profile.apiKey`; non loggare la chiave; non scriverla in chiaro fuori da `users/{uid}`. `GEMINI_API_KEY` non iniettata in produzione (CLAUDE.md).

**FCM token.** Persistenza su `users/{uid}.fcmTokens[]` via **[CAP]** `arrayUnion`/`arrayRemove`, cap 20 (rules:160-162); il ramo ammette `hasOnly(['fcmTokens','updatedAt'])` — il porting di `useFCM.ts:137,152` scrive **solo** `fcmTokens` (`update({'fcmTokens': FieldValue.arrayUnion([t])})`), nient'altro. Privacy: il token è PII leggera (device), protetto da `users.get` owner/admin. Web: VAPID **public** key hardcoded `BHyT0BSV…` riusata (è servita a ogni client comunque) + SW dedicato `web/firebase-messaging-sw.js`; mobile: push nativo, niente VAPID/SW (piano §4.5, corretto).

---

### (c) Test di sicurezza nel mondo Dart + il gate dei 74 rule-test

**Il gate resta in TypeScript e resta il giudice.** I 74 rule-test (`firestore.rules.test.ts` + `firestore.rules.audio.test.ts`) provano il backend, non il client: **non si portano** (piano §5.4, corretto). Si eseguono come oggi —
`firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts firestore.rules.audio.test.ts"` (JDK 21+, emulator porta 8080) — e devono restare **74/74 verdi come gate del cutover**.

**Nuovo livello necessario: "shape-contract" Dart contro l'emulator.** I rule-test TS verificano le rule con shape *JS*; non colgono il drift che nasce **solo** nel porting Dart (int vs double, dotted-path, campo di troppo, `serverTimestamp`). Va aggiunto un `integration_test` Dart che, puntato all'emulator (`useFirestoreEmulator`/`useAuthEmulator`, porte già in `firebase.json`), esegue la write **Dart reale** di ogni riga della matrice e asserisce *accepted/rejected* come atteso. Prioritari (i più rischiosi): **#24** patto-a-3 (`effectiveMaxAtCreate` come `int`), **#17** quiz claim (ramo `users.update` + cap), **#14** capture (`serverTimestamp` + codici CF), **#31** like (nessun campo extra), **#16** `currentHostId` annidato.

**Unit Dart del patto-a-3.** `getMaxQueuedFor(points, rules)` portato deve restituire lo **stesso `int`** di `effectiveMaxQueued` (rule) e di `enforceQueuePerUserLimit` (CF). Test parametrico con `rules` default `{maxQueuedPerUser:2, bonusPerHundredPoints:1}`: `points {0,99,100,250,350,500}` → `{2,2,3,4,5,7}` (l'esempio 350→5 è del dossier:180), **asserendo che il risultato è `int`** (`expect(v, isA<int>())`).

**[IRRISOLTO] da registrare come rischi di migrazione (rules invariate):**
- **Precondizione bloccante di Fase 0 — deploy-state.** Verificare che `firestore.rules` del repo **==** le rule deployate in PROD (`firebase deploy --only firestore:rules` confermato). Il dossier §H segnala il fix `96353ca` come "locale, non deployato": se così, React e Flutter non girano sotto la stessa rule e la parità parallel-backend (§6) è una finzione — approvazione/like/RSVP restano rotte in PROD. Da chiudere prima di qualsiasi cutover.
- **Timewarp #8 / accuracy>100m #20 / `isSessionOpen` #28 / "8 vs 7 CF":** registrarli; il porting non li risolve (rules invariate) ma **non deve introdurli** (disciplina `serverTimestamp` per #8) né **assumere** mitigazioni che le rule non contengono (#20: nessun check accuracy nelle rule lette).

**File su cui è fondata questa sezione:** `/home/neo1777/Scrivania/marzio1777-main/firestore.rules`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useGameEvents.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/usePhotoQuiz.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useAudioQueue.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/contexts/AuthContext.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useFCM.ts`, più il dossier `SETACCIO_DOSSIER.md` (tema sicurezza-privacy, §A-H).
