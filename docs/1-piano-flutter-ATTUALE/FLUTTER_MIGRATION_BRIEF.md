# Migrazione marzio1777 → Flutter/Flame/Dart — Brief per il Piano

> **Scopo del file.** Documento autoconclusivo che dà il contesto completo e i vincoli per
> **pianificare** (non implementare) la migrazione di marzio1777 dallo stack web attuale a
> Flutter/Flame/Dart. Pensato per essere letto da una sessione **ultraplan** (cloud) e per
> servire da prompt di lancio.
>
> **Come lanciarlo:** dalla CLI esegui `/ultraplan` e incolla la sezione **§1–§9** (o digita:
> *"Leggi e segui FLUTTER_MIGRATION_BRIEF.md e tutta la documentazione del repo; produci il
> piano richiesto in §9"*). La sessione cloud clona lo **stato pushato** del repo, quindi questo
> file e i doc citati in §3 devono essere committati **e pushati**.
>
> **Revisione 2026-06-29.** Questo brief è stato aggiornato dopo una sessione di analisi e uno
> **spike di fattibilità** (vedi §0 e §3). Rispetto alla v1, due cose sono cambiate da
> "candidato da valutare" a **scelta presa**: (a) il backend **resta Firestore/FlutterFire**
> (non Supabase); (b) l'architettura è **"Flutter core + vie di fuga"**, validata da spike. Le
> ragioni sono in §0 e in `DECISIONE_ordine_generalizzare_vs_migrare.md`.

---

## 0. Decisioni di questa sessione (2026-06-29) — vincolanti per il piano

Prese con Neo dopo l'analisi comparata e lo spike. Sono **paletti**, non aperture:

1. **Backend: si RESTA su Firestore via FlutterFire. NIENTE Supabase (per ora).**
   Motivo: la migrazione di stack (React→Flutter) e la futura generalizzazione multi-comunità
   condividono **un solo artefatto caro e pericoloso, il modello di permessi**
   (`firestore.rules`, 616 righe, footgun già scattato 3 volte). Andare su Supabase
   significherebbe riscrivere quelle regole in **Postgres RLS** *adesso* e poi di nuovo per il
   multi-tenant: doppio rewrite del pezzo a più alto rischio sicurezza, su un'app in produzione.
   Restando su Firestore, le **rules + le 7 Cloud Functions + i 74 rule-test restano intatti**
   (porting client ~zero) e la generalizzazione futura aggiungerà `tenantId` a *quelle stesse*
   regole **una volta sola**. Supabase resta una decisione separata, futura, **opzionale**.
2. **Architettura: "Flutter core + vie di fuga".** ~90% in Flutter/Dart (UI, routing, stato,
   business-logic, giochi su Flame); per i moduli browser-native senza equivalente 1:1, una
   **singola interfaccia Dart** con **conditional import** per piattaforma
   (`import 'x_web.dart' if (dart.library.io) 'x_native.dart'`). Candidato esplicito per il DSP
   audio cross-platform: **Rust + FFI (nativo) / WASM (web)**. Pattern **validato da spike** (§0bis).
3. **Piattaforme: web + mobile per primi; desktop come stretch goal.** Il mobile è in scope dal
   principio (GPS/fotocamera/AR del Campo dei Giochi + obiettivo multi-OS di Neo). Il desktop
   builda già (vedi spike) ma ha lacune di plugin (camera assente su Linux): pianificarlo come
   traguardo successivo, non come requisito di fase 1.
4. **Generalizzazione multi-comunità: DOPO la migrazione, non durante.** È un piano separato
   (`GENERALIZATION_BRIEF.md`): `tenantId` sulle rules Firestore, una volta sola, a migrazione
   conclusa. **Vincolo per QUESTO piano:** non precludere quella strada — tenere il modello dati
   e le regole **parametrizzabili** (la de-hardcodifica di dominio è già iniziata, §2).

### 0bis. Spike di fattibilità — esiti verificati (2026-06-29)

Spike reale (progetto Flutter separato; sintesi completa in `FLUTTER_SPIKE_FINDINGS.md`, copiato
nel repo). Verificato: `flutter analyze` pulito, `flutter test` verde, **`build web` e
`build linux` entrambi verdi**, 0 errori in console, app desktop nativa avviata senza crash.
Validazione **a runtime** dei 3 moduli "duri":

| Modulo | Esito runtime | Verdetto |
| --- | --- | --- |
| **Audio** (EQ 3 bande + analyser) | **Web**: grafo Web Audio **reale** via `dart:js_interop`+`package:web`, EQ + analyser FFT funzionanti (spettro live). **Nativo**: `flutter_soloud` fa init/play/FFT, ma EQ/controlli sono **stub** | Web S/basso; nativo M/medio — l'EQ nativo è il vero "altro dove serve" (candidato Rust+FFI) |
| **WebRTC P2P** | Echo round-trip verificato: 40000→40000 byte, **identici**, 3 chunk da 16KB + header meta JSON; porting fedele di `webrtc.ts` | web+mobile S-M; desktop linka |
| **AR / orientamento** | `sensors_plus` + **sensor-fusion manuale** + fallback no-sensor; camera passthrough con fallback | mobile/web M; desktop L (camera assente su Linux) |
| **Firestore** (FlutterFire) | `firebase_core`+`cloud_firestore` risolvono e compilano (entrano nel build web) | **nessun attrito** — conferma la scelta §0.1 |

**Conclusione spike:** l'architettura "Flutter core + vie di fuga" **regge per web+mobile**;
il desktop è la gamba debole (dipendenze native dei plugin); il punto tecnico più ostico è
l'**EQ audio nativo**. Restare su Firestore non introduce attrito.

---

## 1. Obiettivo

Produrre un **piano completo e production-ready** per migrare marzio1777 dallo stack attuale
(React 19 + Vite + TypeScript + Tailwind v4 + Firebase, distribuito come PWA) a
**Flutter + Flame + Dart**, **mantenendo Firebase/Firestore come backend**, e preservando
funzionalità, UX e backend. **L'output è un piano**, non codice.

L'app attuale **è in produzione e funziona** (https://neo1777.github.io/marzio1777/): la
destinazione deve raggiungere la stessa completezza, **senza far regredire l'istanza di Marzio**.

---

## 2. Stato attuale (sorgente della migrazione)

SPA React 19 + Vite + TS + Tailwind v4, PWA. Stato persistente su Firebase, **tranne** i file
audio della Biblioteca personale (solo in IndexedDB locale, trasferiti P2P via WebRTC).
Codebase: ~15.400 LOC in `src/` (23 pagine), `functions/src` ~492 LOC, `firestore.rules` 616 LOC.

**Moduli/feature principali:**
- **Comunità**: La Piazza (social/post + like/commenti), Il Bivacco (eventi + RSVP + spese),
  Il Baule (upload con cropper), La Mappa (Leaflet + live location), Il Cinematografo,
  L'Alberone, Profilo, Pannello Admin/Root, Istruzioni (doc in-app).
- **Il Campo dei Giochi** (`game_events`): `treasure_hunt` (cattura AR geolocalizzata) e
  `photo_quiz` (host rotativo); macchina a stati `draft→scheduled→lobby→active→completed`.
- **L'Ainulindalë** (audio): engine Web Audio singleton (EQ 3 bande + analyser fftSize 128),
  sessioni DJ, coda con cap dinamico ("patto a 3"), libreria locale IndexedDB, trasferimento
  P2P WebRTC (Firestore = solo signaling).

**Backend (Firebase) — DA PRESERVARE, non migrare:** Firestore + Auth + 7 Cloud Functions
(region `europe-west1`, `nodejs22`) + FCM Web Push. Auth/ruoli zero-trust:
`Root | Admin | Guest`, stati `pending | approved`, regole `firestore.rules` con validatori per
entità e transazioni atomiche. **Il modello di permessi è ricco e load-bearing**: con FlutterFire
**non si tocca** (le rules e i 74 rule-test restano validi) — è il fulcro della scelta §0.1.

**De-hardcodifica di dominio già avviata (Fase 0):** i valori specifici di Marzio (centro mappa,
altitudine, `communityId`, prefisso storage) sono stati centralizzati in
[`src/config/tenant.ts`](src/config/tenant.ts); il base path è override-abile via `VITE_BASE_PATH`.
È il seme della futura generalizzazione (§0.4) e va **preservato e portato** anche nel target Flutter.

**Deploy:** GitHub Pages via GitHub Actions, base path `/marzio1777/`.

**Documentazione di riferimento nel repo** (da leggere): `public/docs/TECHNICAL_DOCS_IT.md`,
`public/docs/security_spec_IT.md`, `public/docs/GAMING_SYSTEM_IT.md`,
`docs/3-spec-originali/AINULINDALE_TECHNICAL_SPEC.md`, `docs/3-spec-originali/MIGRATION.md`, `docs/3-spec-originali/firebase-blueprint.json`,
`firestore.rules` (+ `firestore.rules.test.ts`, `firestore.rules.audio.test.ts`).
> Nota: `CLAUDE.md` è **gitignored** → in cloud potrebbe non esserci. I contenuti chiave sono
> richiamati qui.

---

## 3. Cosa leggere prima di pianificare

- Tutta la documentazione del repo elencata in §2.
- **`DECISIONE_ordine_generalizzare_vs_migrare.md`** — il razionale completo delle decisioni §0
  (migrare-vs-generalizzare, resta-Firestore, scope, esiti spike).
- **`FLUTTER_SPIKE_FINDINGS.md`** — esiti dettagliati dello spike per-modulo (cosa compila, cosa
  è stub, pacchetti consigliati, split web/nativo).
- **`GENERALIZATION_BRIEF.md`** — il piano *successivo* (multi-tenant): da non eseguire ora, ma da
  **non precludere** (vincolo §0.4).
- I due documenti di ricerca sulle tecniche di porting (signals, Flame/ECS, Rust/WASM,
  MCP/Claude Code): `docs/4-ricerca/ricerca_migrazione_raw.md` e `docs/4-ricerca/Mappatura Porting Codice Dart_Flutter vs JS.md`.
  *(Sono riferimenti generici, non specifici di marzio: usali come repertorio, non come fasi.)*

---

## 4. Requisiti del risultato

- **UI/UX virtualmente identica** (o quantomeno pienamente funzionante); **parità completa**
  di tutte le funzionalità e del backend.
- **Production-ready**: niente mock, TODO o demo; tutto **live e realtime**.
- **Nessuna retrocompatibilità**: solo migliorie, aggiornamenti e adattamenti. Qualità da
  **senior developer**.
- **Test adatti alla destinazione**: unit / widget / integration Flutter; equivalenti dei
  test attuali. **Le regole di sicurezza Firestore restano** (non si riscrivono): i 74 rule-test
  vanno mantenuti verdi sul backend invariato.
- **Marzio non deve regredire**: il sito live resta in piedi durante e dopo la migrazione.

---

## 5. Vincoli (paletti)

- Il più possibile **vanilla** (poche dipendenze, native quando sensato).
- Massima **sicurezza e privacy**; approccio **LLM privacy-first e user-first**.
- **Performance** spinte ma con giudizio; **animazioni ed effetti** con giudizio.
- Il più possibile **cross-platform, adattivo e responsive** (web + mobile; desktop a seguire).
- **Backend invariato**: Firestore/Auth/CF/FCM restano; non introdurre un secondo backend.

---

## 6. Scelte già prese (da rispettare nel piano)

- **Stack**: Flutter + **Flame** (modulo giochi) + Dart. Per il resto, scegli/riusa il meglio.
- **Backend/DB**: **resta Firebase via FlutterFire** (`firebase_core`, `cloud_firestore`,
  `firebase_auth`, `firebase_messaging`, `cloud_functions`). Le `firestore.rules`, le 7 Cloud
  Functions e gli indici **non si migrano**: si riusano. Realtime `onSnapshot` → `snapshots()`
  stream Dart (1:1). *(Supabase/RLS: fuori scope — vedi §0.1.)*
- **Architettura**: **"Flutter core + vie di fuga"** (§0.2): interfaccia Dart unica + conditional
  import web/native per i moduli browser-native; **Rust+FFI/WASM** candidato per il DSP audio
  cross-platform. Il piano deve dare la **mappa modulo-per-modulo** di quali pezzi sono puro
  Flutter e quali richiedono una via di fuga (e quale).
- **Piattaforme**: **web + mobile (iOS/Android) in fase 1; desktop come stretch goal** (§0.3).
- **Deploy**: pianifica il deploy della destinazione (web a sostituire GitHub Pages; mobile/store
  se in scope) **senza interrompere il sito Marzio live**.
- **Preservare la de-hardcodifica** già fatta (`src/config/tenant.ts`): portarla in Dart come
  config di istanza (seme multi-tenant per il piano §0.4 successivo).

---

## 7. Tracce parallele (piano nel piano, da decidere)

1. **Prodotto open-source.** Già avviato: `LICENSE` (MIT) e `README` pubblico aggiunti in Fase 0.
   Il piano completi l'OSS-readiness della destinazione Flutter: CI/CD, modello di contribuzione,
   igiene repo, documentazione.
2. **Generalizzazione multi-comunità (piano successivo).** Vedi `GENERALIZATION_BRIEF.md`: NON in
   scope ora, ma il piano di migrazione deve **lasciare la porta aperta** — modello dati e regole
   parametrizzabili, così che `tenantId` si aggiunga una volta sola dopo (§0.4).
3. **Graphify.** Valutane l'integrazione: sia come **strumento per analizzare marzio** durante e
   dopo la migrazione, sia eventuali integrazioni/upgrade di prodotto.

---

## 8. Aree che richiedono riprogettazione (candidati da valutare, non imposizioni)

Il backend **non** è più in questa tabella (DECISO: resta Firestore via FlutterFire — porting
client ~zero). I candidati da valutare sono i **moduli client browser-native**; per ciascuno lo
spike ha già dato un'indicazione (§0bis, dettaglio in `FLUTTER_SPIKE_FINDINGS.md`):

| Area attuale (web) | Candidato Flutter/Dart da valutare | Nota spike |
| --- | --- | --- |
| Firestore / Auth / rules / CF / FCM | **FlutterFire** (resta) — porting client | nessun attrito ✅ |
| Web Audio API (engine, EQ 3 bande, analyser) | **web**: JS interop sul vero Web Audio; **nativo**: `flutter_soloud`/`just_audio` + **DSP (Rust+FFI?)** | web reale ✅; EQ nativo da fare ⚠️ |
| WebRTC P2P (trasferimento audio) | `flutter_webrtc` (signaling Firestore invariato) | echo verificato ✅ |
| IndexedDB (audio locale) | **nativo**: `drift`/`isar`/`sqflite` + file; **web**: IndexedDB/OPFS | split web/nativo da progettare |
| AR HTML5 + device orientation | `sensors_plus` + sensor-fusion / `flutter_compass`; camera | lacuna heading calibrato ⚠️ |
| Leaflet / react-leaflet | `flutter_map` (+ `geolocator`) | equivalente solido |
| React Router | `go_router` / Navigator 2.0 | |
| Tailwind v4 (theme inline) | `ThemeData` + design tokens | |
| State (Context + 18 hook) | Riverpod/Provider/Signals (la logica pura porta ~1:1) | `DJEngine` già DI ✅ |
| `@google/genai` (Gemini per-utente) | `google_generative_ai` (Dart SDK) | |
| react-markdown / emoji-picker / cropper | `flutter_markdown` / `emoji_picker_flutter` / cropper | volume, non difficoltà |
| canvas-confetti | particelle Flame / package confetti | |
| PWA / service worker / FCM web | Flutter Web PWA + `firebase_messaging` (SW dedicato su web) | meno controllo della PWA Vite ⚠️ |

---

## 9. Output atteso del piano

Un piano strutturato che contenga almeno:

1. **Fasi** con dipendenze e rischi (ordine di migrazione consigliato, milestone). Tener conto
   che i moduli a più alto rischio (audio, AR, giochi Flame) vanno de-rischiati presto e che
   **web+mobile precedono il desktop**.
2. **Decisioni-chiave** con alternative valutate e **raccomandazione motivata** — *perché prima
   del come*. Backend e Supabase NON sono più una decisione aperta (§0.1): il piano la **recepisce**
   e semmai documenta *come* sfruttare FlutterFire al meglio. Decisione-chiave residua più calda:
   **come realizzare l'EQ audio nativo** (Rust+FFI condiviso vs per-piattaforma) e lo **split
   storage** web/nativo.
3. **Mappatura feature-by-feature** dall'attuale al target, con, per ogni modulo, *se è puro
   Flutter o richiede una via di fuga* (e quale: JS interop / FFI / platform channel / plugin).
4. **Strategia di test** (unit/widget/integration). Le **rule Firestore restano**: mantenere
   verdi i 74 rule-test sul backend invariato.
5. **Strategia di deploy + cutover senza downtime** per non interrompere Marzio live (web prima,
   poi mobile/store; desktop dopo). **Niente migrazione dati** (il DB resta Firestore).
6. Le **tracce parallele** (§7): OSS-readiness (completare), **non-preclusione del multi-tenant**
   (§0.4), graphify.
7. Per ogni scelta delicata, i **trade-off** espliciti (specie sul confine Flutter↔via-di-fuga e
   sul desktop).

> Principio guida trasversale: **perché prima del come**, qualità senior, niente
> retrocompatibilità, niente mock/TODO/demo, tutto live. E: **il backend Firestore non si tocca**
> — la parità si gioca sul client e sulle vie di fuga, non sulle regole di sicurezza.
