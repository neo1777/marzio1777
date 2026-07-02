> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

### Verifica del piano attuale (gap trovati)

**G1 — ERRORE di correttezza in §4.2: la query di esempio è `and(...)`, il codice reale è `or(...)`.** Il piano scrive la query di `LaPiazza` come `query(collection, and(where('visibilityStatus','in',[…]), where('authorId','==',uid)), orderBy('timestamp','desc'), limit(50))`. Il codice reale (`src/pages/LaPiazza.tsx:50-58`) usa **`or(...)`**, non `and(...)`. Lo stesso identico pattern `or(visibilityStatus in [...], authorId == uid)` compare in `src/pages/IlCinematografo.tsx:62-69` (con `orderBy` senza `limit`) e `src/pages/LaMappa.tsx:105-110` (senza `orderBy`). Non è una sfumatura: `or` ↔ `and` cambiano (a) il **risultato** (unione vs intersezione: il feed mostra "i post pubblici/programmati **oppure** i miei", non "i miei **e** pubblici") e (b) il **fabbisogno di indici**. La conclusione del piano "stesse query, stessi indici" è giusta, ma **per la ragione opposta** a quella implicata: i due indici `posts(visibilityStatus,timestamp)` e `posts(authorId,timestamp)` (`firestore.indexes.json:4-30`) esistono perché Firestore **scompone la disgiunzione** in due query, ciascuna con il proprio `orderBy('timestamp')`. Un porter che copiasse l'esempio in Dart come `Filter.and(...)` otterrebbe risultati sbagliati **e** un `FAILED_PRECONDITION` (servirebbe un indice `(visibilityStatus, authorId, timestamp)` inesistente). Va corretto in `Filter.or(...)`.

**G2 — §2.1/§4.3 modellano `AuthContext` come `StreamProvider`: è una semplificazione che perde due invarianti.** `src/contexts/AuthContext.tsx` **non** è un wrapper sottile su uno stream. Su ogni `onAuthStateChanged` esegue, in sequenza imperativa **prima** di attaccare lo snapshot: `getDoc` → (se assente) `setDoc` con i default zero-trust → (se presente) `updateDoc` con le migrazioni Root-by-email e legacy-cutoff (`AuthContext.tsx:48-79`), e **solo dopo** `onSnapshot(users/{uid})` (`:84-89`). Inoltre il fix anti-leak B7 tiene l'unsubscribe in `profileUnsubRef` e fa `detachProfile()` esplicito a ogni transizione (`:29-37, 95-98`) perché restituire l'unsub da una callback `async` non si propaga al cleanup. Un `StreamProvider` puro non cattura né la sequenza scrittura-poi-ascolto né la gestione esplicita della subscription. Va modellato come `AsyncNotifier`/`Notifier` (vedi corpo).

**G3 — §2.3 dà i gruppi giochi e audio come simmetrici; non lo sono.** Verificato su `src/App.tsx:54-63`: le 5 rotte `giochi/*` sono **sorelle piatte** sotto `/dashboard`, **senza** un elemento-rotta padre né una shell condivisa. L'unico router davvero **annidato con shell propria** è `ainulindale/*`, che ha un secondo `<Routes>` dentro `IlAinulindale.tsx:74-80` con una tab-bar persistente (`:65-70`). Questa asimmetria conta per go_router: solo `ainulindale` mappa su una `ShellRoute` figlia; `giochi` resta un gruppo di rotte piatte (annidarle è facoltativo, non un requisito).

**G4 — §2.3 raccomanda `StatefulShellRoute.indexedStack` senza il caveat del ciclo di vita.** `indexedStack` tiene **vivi tutti i branch contemporaneamente** per preservarne lo stato. Ma il Layout reale (`src/components/Layout.tsx:291` `<Outlet/>`) include rami con risorse costose e a ciclo di vita stretto: `LaMappa` (Leaflet), l'AR camera di `TreasureHuntPlay` (lo stream deve fermarsi in <500ms all'uscita), e l'`AudioEngine` singleton. Tenerli sempre montati confligge col vincolo "leggero su cellulari vecchi" e con i cleanup obbligatori. Il piano va corretto: `indexedStack` **sì** per le pagine comunità leggere, **no** per mappa/AR/audio (vedi corpo).

**G5 — Conteggio entità "22" non verificato (dossier lo segna [IRRISOLTO]).** Il blueprint definisce **20** entità (`firebase-blueprint.json`, confermato dossier:619, 848). La riconciliazione probabile del "22": 20 entità + le 2 collection-infra `places_cache/{geoKey}` (usata davvero, `src/lib/reverseGeocode.ts:44`) e `audit_log` (rule-only, CF-write). Il modello dati Dart deve coprire **20 entità tipizzate + 2 collection-infra**, non "22 entità".

**G6 — §4.4 dice "due sole CF chiamate dal client": vero per le realtime, ma esiste un terzo consumer one-shot.** `enforceQueuePerUserLimit` e `validateCaptureDistance` sono le uniche chiamate dai flussi realtime, corretto. Ma `useUserGagliardetti.ts:67-121` esegue 8 query `collectionGroup` one-shot (`getCountFromServer`/`getDocs`) che dipendono dagli indici COLLECTION_GROUP `participants(userId,status)`, `queue(proposedBy,status)`, `audio_sessions(djId,status)`, `answers(userId,pointsAwarded)`. Non sono `onSnapshot` (giustamente fuori dal conteggio 53), ma sono **superficie dati da portare** e il piano non li nomina mai. Vanno mappati su `cloud_firestore` `.count()` / `.get()` mantenendo gli stessi indici.

Il resto delle decisioni architetturali del piano (Riverpod come scelta, feature-first, go_router, theming `ThemeData`+`ThemeExtension`, tassonomia vie-di-fuga a 3 livelli) regge alla verifica: i 53 `onSnapshot` sono confermati esatti, e gli indici composti reali coincidono con le query reali. Sotto, le linee guida azionabili che rendono specifico ciò che il piano lascia generico.

---

## Architettura — linee guida azionabili (corpo)

### A. Modello dati: 20 entità tipizzate, oggi sparse, da consolidare

**Perché.** La parità di scrittura (§4) si gioca sulle *shape*: la rule giudica i campi, non l'app. Oggi i tipi sono **frammentati** in tre regimi diversi (`src/types.ts` per User/Post, `src/types/audio.ts` per l'Ainulindalë, e — punto critico — `GameEvent`/`GameItem`/`QuizRound`/`Answer` definiti **inline dentro gli hook** `useGameEvents`/`useNearestItem`/`usePhotoQuiz`, dossier:841). In Dart questa dispersione diventa un rischio: un campo dimenticato = rule che respinge. La migrazione è il momento per consolidare.

**Cosa fare, in ordine.**
1. `lib/src/common/models/` con una classe Dart immutabile per ognuna delle 20 entità del blueprint, con `fromFirestore`/`toFirestore` espliciti. Fonte di verità dei campi: `firebase-blueprint.json` (non i tipi TS, che hanno gap noti — es. `fcmTokens` manca in `UserProfile`, dossier:842).
2. Sanare i gap nel porting, non dopo: `User.fcmTokens: List<String>` (cap 20), `User.metrics` (`quizStreak`/`consecutiveSkipped`/`huntsLegacyCompleted`), `Post.authorPhotoURL: String?`, `Post.location: ({double lat, double lng})?`.
3. Due collection-infra senza modello ricco: `places_cache` (cache reverse-geocoding) e `audit_log` (sola lettura Root). Bastano DTO minimali.
4. **Invarianti load-bearing come codice, non come commento.** I campi che la rule controlla come `is int` (`effectiveMaxAtCreate`, `pointsAwarded`) vanno emessi con `.toInt()`/`floor` al confine di scrittura — è l'equivalente Dart del "Math.floor al boundary" (dossier:188, CLAUDE.md). Metti questi `toFirestore` sotto test (§ "patto a 3", §5.1 del piano).

**Come verificare.** Un test di round-trip `fromFirestore(toFirestore(x)) == x` per entità + gli integration test §5.3 contro l'emulator: se una shape è sbagliata, è la rule a respingerla (i 74 rule-test restano il gate).

### B. Layering feature-first: l'albero concreto (il piano lo dà a parole)

Il piano raccomanda "feature-first, 3 strati sottili" ma non fissa l'albero. Fissalo, perché è ciò che evita la deriva durante il volume di Fase 2. La mappa diretta dal codice reale:

```
lib/src/
  common/            # ex src/components/ui, src/lib, theming, router, models
    models/          # le 20 entità (A)
    theme/           # ThemeData + MarzioColors (ThemeExtension)
    router/          # go_router (D)
    widgets/         # primitive: Button/Switch/Dialog (da src/components/ui/index.tsx)
  config/
    tenant.dart      # TenantConfig (da src/config/tenant.ts, 1:1)
  features/
    auth/            # AuthContext + useRBAC  → data/auth_repository, presentation/auth_providers
    comunita/        # piazza, bivacco, baule, mappa, cinematografo, alberone, profilo
    giochi/          # campo, creator, lobby, play(treasure/quiz), results + utils puri
    ainulindale/     # biblioteca, sessioni, dj, listener + engine/webrtc/indexeddb
    admin/
  escape/            # le vie di fuga: audio_engine, local_library, signaling, orientation
```

Regola di confine (dal codice attuale): **i `src/utils/*` puri** (`eventState`, `scoring`, `spawning`, `geo`, `id3`, `quizGenerators`, `djEngine`) sono `domain` e si portano 1:1 senza dipendenze Flutter/Firebase — sono già Dart-ready (dossier §3.6). **I 6 hook realtime** sono il `data` layer (repository + provider). **Le pagine** sono `presentation`. Non introdurre strati oltre questi tre.

### C. Riverpod: tassonomia provider mappata 1:1 sul codice reale

Il piano dice "StreamProvider 1:1 coi 6 hook" ma non distingue i casi. La verità del codice impone **tre forme diverse** di provider:

| Sorgente reale | Forma Riverpod | Perché questa e non `StreamProvider` |
|---|---|---|
| `AuthContext` (`onAuthStateChanged` + migrazioni imperative + `profileUnsubRef`) | `AsyncNotifier` (auth) + `StreamProvider` derivato per il profilo | **G2**: deve fare `getDoc→setDoc/updateDoc` *prima* di ascoltare, e gestire l'unsub esplicito. Un `StreamProvider` puro non lo esprime |
| `useRBAC` (flag derivati da profile) | provider sincrono derivato (`Provider`) che `watch` l'auth | è già pura derivazione (`useRBAC.ts:18-23`): `isRoot/isAdminOrRoot/isApproved`. Nessuno stream proprio |
| `useGameEvents` lista (`where status != draft`) | `StreamProvider.autoDispose` | stream singolo, parametri zero |
| `useGameEvent(id)`, `useAudioSession(id)`, `useAudioQueue(id)`, `useSessionParticipants(id)`, `usePhotoQuiz(eventId)`, `useWebRTCTransfer(...)` | `StreamProvider.family.autoDispose` | il `.family` copre il parametro (`id`), `autoDispose` replica il cleanup degli hook |
| `useUserGagliardetti` (8 collectionGroup one-shot) | `FutureProvider.family.autoDispose` | **G6**: non sono realtime; `.count()`/`.get()` una volta |
| `DJEngine` (classe con DI, `setInterval(1000)`) | `Notifier` che possiede l'istanza `DJEngine` + `Timer.periodic` | è già DI per costruttore (`djEngine.ts:49-72`): `ref` sostituisce le callback iniettate senza riscrivere la classe |

**Azione.** Per ogni hook con parametro usa `.family` su un argomento **hashabile** (l'`id` stringa va bene). Non passare oggetti non-`==`-stabili al `.family` (ricreerebbero il provider a ogni build). L'`AudioEngine` singleton (`audioEngine.ts`) **non** va in un provider `autoDispose`: è una risorsa app-level, esponila con un `Provider` senza autoDispose o keep-alive esplicito, coerente con "una sola istanza per app" (CLAUDE.md, regola 3 dell'Ainulindalë).

### D. Routing go_router: tabella rotta-per-rotta dal `src/App.tsx` reale

| URL reale | Oggi (`App.tsx`/`IlAinulindale.tsx`) | go_router |
|---|---|---|
| `/` | `Landing` (pubblica) | `GoRoute('/')` |
| `redirect globale` | `ProtectedRoute` (`!user → /`, `loading → null`) | `redirect:` che legge l'auth provider; replica il branch `loading` (non redirigere mentre `loading`) |
| `/dashboard` (shell) | `<Layout/>` con `<Outlet/>` + sidebar/bottom-nav | `StatefulShellRoute.indexedStack` **solo per le voci leggere** (G4) |
| `piazza·bivacco·baule·mappa·cinematografo·alberone·profilo·admin·istruzioni` | rotte figlie | branch della shell |
| `giochi`, `giochi/nuovo`, `giochi/:eventId/{lobby,play,results}` | **sorelle piatte**, nessuna shell (G3) | rotte normali (non branch della shell, perché vanno a schermo pieno fuori dalla nav) |
| `giochi/:eventId/play` → `GamePlayRouter` (switch su `event.type`) | `GamePlayRouter.tsx:20-24` | `builder` che `watch` `gameEventProvider(id)` e ritorna `TreasureHuntPlay`/`PhotoQuizPlay` |
| `ainulindale/*` (router annidato con tab-shell) | `<Routes>` interno + `AudioSessionWrapper` | **`ShellRoute`** dedicata con la tab-bar; figlie: index→Biblioteca, `sessioni`, `sessioni/nuova`, `sessioni/:id`, `sessioni/:id/dj` |
| `ainulindale/sessioni/:id` → DJ vs Listener (`session.djId===uid`) | `IlAinulindale.tsx:127-138` | `builder` che `watch` `audioSessionProvider(id)` + auth e sceglie la view |

**Decisione su G4 (indexedStack).** `StatefulShellRoute.indexedStack` per le voci-comunità leggere (piazza/bivacco/cinematografo/alberone/profilo): lì preservare lo scroll/stato è un *miglioramento* reale rispetto al `lazy()` attuale che rimonta. Ma `mappa` (Leaflet), il play-AR e `ainulindale` (camera/AudioEngine) **non** devono stare in branch sempre-vivi: o stanno fuori dalla shell (schermo pieno, come già i giochi), o usano un branch che mette in pausa le risorse quando inattivo (stop camera su deactivate, `AudioContext.suspend()`). Verifica: il LED camera si spegne uscendo dal play, e l'audio non continua a girare quando navighi via dall'Ainulindalë.

**Deep-link / base path.** `usePathUrlStrategy()` + `--base-href /marzio1777/` (= `vite.config.ts:10`); conserva il trucco `404.html` (copia dell'`index.html` Flutter) per i refresh su rotte profonde (vincolo "Marzio non regredisce" sui deep-link). Il `basename={import.meta.env.BASE_URL}` (`App.tsx:41`) diventa il base-href, **un solo punto**, parametrizzato dal `TenantConfig`.

### E. Realtime `onSnapshot` → `snapshots()`: la mappa query→indice corretta

Verificato: 53 `onSnapshot` in 20 file sorgente (esatto). La mappa 1:1 (`Query.snapshots()` / `DocumentReference.snapshots()`) regge **a condizione di replicare gli operatori esatti**. Tabella delle query composite reali e dell'indice su cui poggiano:

| Query reale (file) | Operatori Dart | Indice (`firestore.indexes.json`) |
|---|---|---|
| `posts` feed (`LaPiazza.tsx:50`, `IlCinematografo.tsx:62`) | **`Filter.or(`** `whereIn('visibilityStatus',['public','scheduled'])`, `isEqualTo('authorId',uid)` `)` + `orderBy('timestamp',desc)` (+ `limit(50)` solo Piazza) | usa **entrambi** `(visibilityStatus,timestamp)` e `(authorId,timestamp)` (la disgiunzione si scompone) |
| `posts` mappa (`LaMappa.tsx:105`) | stessa `Filter.or`, **senza** orderBy | scompone in due single-field (auto) |
| `user_locations` (`LaMappa.tsx:138`) | `isEqualTo('shareLiveLocation', true)` | single-field; **il client DEVE filtrare** `shareLiveLocation==true` (la rule lo assume, `rules:176`) |
| `game_events` lista (`useGameEvents.ts:56`) | `isNotEqualTo('status','draft')` | single-field; **attenzione**: `!=` esclude i doc *senza* `status` — comportamento da preservare |
| `events` (`IlBivacco.tsx:25`) | `orderBy('date', asc)` (`date` è String) | single-field |
| `audio_sessions` lista (`useAudioSession.ts:130`) | `isEqualTo('status','open')` + `orderBy('createdAt',desc)` | `audio_sessions(status,createdAt)` COLLECTION_GROUP |
| `queue` (`useAudioQueue.ts:32`) | `orderBy('position',asc)` | `queue(status,position)` |
| `participants` (`useSessionParticipants.ts:14`) | `orderBy('lastSeenAt',desc)` | `participants(status,lastSeenAt)` |
| 8× collectionGroup gagliardetti (`useUserGagliardetti.ts:67-121`) | `.count()`/`.get()` con `where userId/proposedBy/djId ==` (+ `status`/`pointsAwarded>0`) | i 4 indici COLLECTION_GROUP esistenti |

**Azione di test specifica.** Aggiungi un integration test (§5.3 del piano) che esegue la `Filter.or` dei post contro l'emulator con gli indici reali deployati: è la prova che la disgiunzione + orderBy non scivola in un `FAILED_PRECONDITION`. **Non toccare `firestore.indexes.json`** — è parte del backend invariato; va solo deployato com'è.

### F. Theming e vie-di-fuga: confermo, con due precisazioni

Le decisioni del piano (§2.4 `ThemeData`+`MarzioColors` ThemeExtension; §2.5 tassonomia a 3 livelli) sono solide. Due precisazioni dal codice:
- La superficie *dark-flame* dell'Ainulindalë è forzata via colori hardcoded sul parent (`IlAinulindale.tsx:50` `bg-[#0A0A0F]`), e il dark-mode globale è una classe su `documentElement` osservata via `MutationObserver` in 3 pagine (CLAUDE.md). In Flutter: dark-mode → `ThemeMode` reattivo (gli observer spariscono, sono rebuild gratis); la superficie Ainulindalë → un `Theme(...)` che avvolge **solo** la `ShellRoute` audio (§D), non un tema globale. Semantica identica al parent-forced di oggi, ma esplicita.
- Conferma sul confine vie-di-fuga: il signaling WebRTC è già DI (`webrtc.ts` scrive su `audio_sessions/{id}/signaling/{userId}`), quindi `SignalingChannel` (interfaccia + impl Firestore) è la forma giusta — **non** conditional import. Conditional import solo per **audio** e **storage locale** (i due punti dove l'API è genuinamente per-piattaforma), come dice il piano.

### G. Ordine di esecuzione e prove di non-regressione

1. **Fase 0**: `common/models` (le 20 entità + 2 infra, A) → `TenantConfig` Dart → auth come `AsyncNotifier` (C, fix G2) → go_router con redirect + shell (D) → theming (F) → **una** slice (La Piazza con la `Filter.or` corretta, G1/E). Prova: La Piazza legge/scrive sul Firestore live in parallelo a React **senza violare le rule**, i 74 rule-test restano verdi, gating ruoli identico.
2. Porta i provider nella tassonomia C **prima** del volume di Fase 2, così il pattern è fissato una volta.
3. Per ogni nuova write Dart: prima il `toFirestore` con gli invarianti (`is int`, identità pinnata, `affectedKeys` impliciti), poi il test integration contro l'emulator. La regressione di Marzio si coglie qui, prima del cutover.

**Verifica trasversale (vincolo marzio1777).** Nessun file in `firestore.rules`/`functions/`/`*.test.ts` cambia: la prova è che la suite `firebase emulators:exec --only firestore "npx tsx --test firestore.rules.test.ts firestore.rules.audio.test.ts"` (74/74) resta verde dall'inizio alla fine, perché il client Dart scrive le stesse shape del client React.

**File di riferimento (tutti verificati alla fonte):** `/home/neo1777/Scrivania/marzio1777-main/src/App.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/components/Layout.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/contexts/AuthContext.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useRBAC.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/config/tenant.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/pages/IlAinulindale.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/pages/GamePlayRouter.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/pages/LaPiazza.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/pages/IlCinematografo.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/pages/LaMappa.tsx`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useGameEvents.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useAudioSession.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useAudioQueue.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useSessionParticipants.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useUserGagliardetti.ts`, `/home/neo1777/Scrivania/marzio1777-main/firestore.indexes.json`, `/home/neo1777/Scrivania/marzio1777-main/firebase-blueprint.json`, `/home/neo1777/Scrivania/marzio1777-main/src/lib/reverseGeocode.ts`.
