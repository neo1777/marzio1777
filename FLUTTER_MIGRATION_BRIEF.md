# Migrazione marzio1777 → Flutter/Flame/Dart — Brief per il Piano

> **Scopo del file.** Documento autoconclusivo che dà il contesto completo e i vincoli per
> **pianificare** (non implementare) la migrazione di marzio1777 dallo stack web attuale a
> Flutter/Flame/Dart. Pensato per essere letto da una sessione **ultraplan** (cloud) e per
> servire da prompt di lancio.
>
> **Come lanciarlo:** dalla CLI esegui `/ultraplan` e incolla la sezione **§1–§9** (o digita:
> *"Leggi e segui FLUTTER_MIGRATION_BRIEF.md e tutta la documentazione del repo; produci il
> piano richiesto in §9"*). La sessione cloud clona lo stato pushato del repo, quindi questo
> file e i due doc di ricerca devono essere committati (lo sono).

---

## 1. Obiettivo

Produrre un **piano completo e production-ready** per migrare marzio1777 dallo stack attuale
(React 19 + Vite + TypeScript + Tailwind v4 + Firebase, distribuito come PWA) a
**Flutter + Flame + Dart**, preservando funzionalità, UX e backend. **L'output è un piano**,
non codice.

L'app attuale **è in produzione e funziona** (https://neo1777.github.io/marzio1777/): la
destinazione deve raggiungere la stessa completezza.

---

## 2. Stato attuale (sorgente della migrazione)

SPA React 19 + Vite + TS + Tailwind v4, PWA. Stato persistente su Firebase, **tranne** i file
audio della Biblioteca personale (solo in IndexedDB locale, trasferiti P2P via WebRTC).

**Moduli/feature principali:**
- **Comunità**: La Piazza (social/post + like/commenti), Il Bivacco (eventi + RSVP + spese),
  Il Baule (upload con cropper), La Mappa (Leaflet + live location), Il Cinematografo,
  L'Alberone, Profilo, Pannello Admin/Root, Istruzioni (doc in-app).
- **Il Campo dei Giochi** (`game_events`): `treasure_hunt` (cattura AR geolocalizzata) e
  `photo_quiz` (host rotativo); macchina a stati `draft→scheduled→lobby→active→completed`.
- **L'Ainulindalë** (audio): engine Web Audio singleton (EQ 3 bande + analyser), sessioni DJ,
  coda con cap dinamico, libreria locale IndexedDB, trasferimento P2P WebRTC (Firestore =
  solo signaling).

**Backend (Firebase):** Firestore + Auth + 7 Cloud Functions (region `europe-west1`,
`nodejs22`) + FCM Web Push. Auth/ruoli zero-trust: `Root | Admin | Guest`, stati
`pending | approved`, regole `firestore.rules` con validatori per entità e transazioni
atomiche. **Nota sicurezza**: il modello di permessi è ricco e load-bearing (vedi
`firestore.rules` + i test) — la sua **parità** è un requisito critico della migrazione.

**Deploy:** GitHub Pages via GitHub Actions, base path `/marzio1777/`.

**Documentazione di riferimento nel repo** (da leggere): `public/docs/TECHNICAL_DOCS_IT.md`,
`public/docs/security_spec_IT.md`, `public/docs/GAMING_SYSTEM_IT.md`,
`AINULINDALE_TECHNICAL_SPEC.md`, `MIGRATION.md`, `firebase-blueprint.json`,
`firestore.rules` (+ `firestore.rules.test.ts`).

---

## 3. Cosa leggere prima di pianificare

- Tutta la documentazione del repo elencata in §2.
- I due documenti di ricerca sulla migrazione (tecniche di porting JS↔Flutter, signals,
  Flame/ECS, Rust/WASM, MCP/Claude Code): `ricerca_migrazione_raw.md` e
  `Mappatura Porting Codice Dart_Flutter vs JS.md`.

---

## 4. Requisiti del risultato

- **UI/UX virtualmente identica** (o quantomeno pienamente funzionante); **parità completa**
  di tutte le funzionalità e del backend.
- **Production-ready**: niente mock, TODO o demo; tutto **live e realtime**.
- **Nessuna retrocompatibilità**: solo migliorie, aggiornamenti e adattamenti. Qualità da
  **senior developer**.
- **Test adatti alla destinazione**: unit / widget / integration Flutter; equivalenti dei
  test attuali, **incluse le regole di sicurezza** del backend.

---

## 5. Vincoli (paletti)

- Il più possibile **vanilla** (poche dipendenze, native quando sensato).
- Massima **sicurezza e privacy**; approccio **LLM privacy-first e user-first**.
- **Performance** spinte ma con giudizio; **animazioni ed effetti** con giudizio.
- Il più possibile **cross-platform, adattivo e responsive**.

---

## 6. Scelte già prese (da rispettare nel piano)

- **Stack**: Flutter + **Flame** (modulo giochi) + Dart. Per il resto, scegli/riusa il meglio.
- **Backend/DB**: **privilegia la migrazione verso Supabase** se fattibile, ma all'inizio
  **mantieni semplice e gratuito** (free tier). Valuta comunque **esplicitamente** le
  alternative (incluso restare su Firebase via FlutterFire) e **raccomanda con motivazioni**,
  includendo il percorso di migrazione: Firestore→Postgres, Auth, realtime, storage,
  **regole→RLS**, Cloud Functions→Edge Functions, FCM→push.
- **Piattaforme**: **raccomanda** la strategia. Default suggerito: **web-first** per sostituire
  la PWA con continuità di deploy; **valuta l'aggiunta di mobile** (iOS/Android) per le feature
  GPS/fotocamera/AR del Campo dei Giochi. *(Da confermare con l'autore se mobile è in scope
  fin da subito.)*
- **Deploy**: pianifica il deploy della destinazione (web e, se previsto, mobile/store)
  sostituendo l'attuale GitHub Pages.

---

## 7. Tracce parallele (piano nel piano, da decidere)

1. **Prodotto open-source.** marzio1777 è già in produzione e va spinto come **OSS**: includi
   licenza, igiene del repo, CI/CD, modello di contribuzione, documentazione.
2. **Graphify.** Valutane l'integrazione: sia come **strumento per analizzare marzio** durante
   e dopo la migrazione, sia eventuali **integrazioni/upgrade di prodotto**. *(Contesto: su
   graphify sono già state aperte issue e PR — stesso livello di serietà.)*

---

## 8. Aree che richiedono riprogettazione (candidati da valutare, non imposizioni)

Il web attuale usa tecnologie browser-native senza equivalente diretto: il piano deve
progettarne la transizione. Candidati indicativi da valutare con giudizio:

| Area attuale (web) | Candidato Flutter/Dart da valutare |
| --- | --- |
| Firestore (DB + realtime) | Supabase Postgres + Realtime *(o FlutterFire)* |
| Firebase Auth | Supabase Auth *(o FlutterFire Auth)* |
| `firestore.rules` (zero-trust) | **Postgres RLS** — porting fedele del modello di permessi |
| Cloud Functions (`europe-west1`) | Supabase Edge Functions (Deno) *(o mantenere CF)* |
| FCM Web Push | push cross-platform (FCM resta valido / alternativa) |
| IndexedDB (audio locale) | Drift / Isar / sqflite (store locale) |
| WebRTC P2P (trasferimento audio) | `flutter_webrtc` (signaling invariato lato DB) |
| Web Audio API (engine, EQ, analyser) | `just_audio` + DSP / soluzione audio Flutter |
| Leaflet / react-leaflet | `flutter_map` |
| AR HTML5 + device orientation | `sensors_plus` + camera *(AR con giudizio)* |
| React Router | `go_router` / Navigator 2.0 |
| Tailwind v4 (theme inline) | ThemeData + design tokens |
| `@google/genai` (Gemini per-utente) | `google_generative_ai` (Dart SDK) |
| react-markdown / emoji-picker / cropper | `flutter_markdown` / `emoji_picker_flutter` / cropper |
| canvas-confetti | particelle Flame / package confetti |
| PWA / service worker | Flutter Web PWA *(o install nativo)* |

---

## 9. Output atteso del piano

Un piano strutturato che contenga almeno:

1. **Fasi** con dipendenze e rischi (ordine di migrazione consigliato, milestone).
2. **Decisioni-chiave** con alternative valutate e **raccomandazione motivata** — *perché prima
   del come*. In particolare: backend (Supabase vs FlutterFire) e piattaforme.
3. **Mappatura feature-by-feature** dall'attuale al target (con parità UI/UX e funzionale).
4. **Strategia di test** (unit/widget/integration + parità delle regole di sicurezza).
5. **Strategia di deploy + migrazione dati** (incl. percorso dati e cutover senza downtime
   ragionato).
6. Le **due tracce parallele** (§7): OSS-readiness e integrazione graphify.
7. Per ogni scelta delicata, i **trade-off** espliciti.

> Principio guida trasversale: **perché prima del come**, qualità senior, niente
> retrocompatibilità, niente mock/TODO/demo, tutto live.
