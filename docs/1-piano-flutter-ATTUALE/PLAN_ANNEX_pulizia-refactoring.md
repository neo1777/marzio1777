> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

### Verifica del piano attuale (gap trovati)

Ho ricontrollato alla fonte i claim del piano che toccano pulizia/debito (`grep` sul codice reale + `src/index.css`, `package.json`, `types.ts`, `IlBaule.tsx`, `ProfiloPersonale.tsx`, `AdminPanel.tsx`, `Layout.tsx`, `LaMappa.tsx`, `LAlberone.tsx`). Cosa regge e cosa no:

- **Deriva palette sottostimata di un ordine di grandezza.** Il piano (§2.4, §3) parla di "70+ hex inline" e "~9 usi dei token `marzio-*`". I tre conteggi puntuali sono esatti (`bg-[#2D5A27]`=72, `bg-[#111814]`=62, `bg-[#1a261f]`=51), ma il totale reale è **1029 occorrenze** di utility-colore con hex inline (`(bg|text|border|from|to|via|ring|fill|stroke|shadow)-[#...]`), distribuite su **34 dei 45 file `.tsx`**, con **~30 valori hex distinti**. I token di brand come classi utility sono usati **1 volta** (`bg-marzio-verde`, fallback Avatar in `ui/index.tsx`), non ~9. Conseguenza che il piano non trae: non è una find-replace da un pomeriggio, e ci sono **cluster di quasi-duplicati** che vanno *decisi*, non mappati 1:1 — verdi: `#2D5A27 / #24352b / #1a2e16 / #1a261f / #151e18 / #23471f / #346b2d / #20401b`; quasi-neri: `#111814 / #0d1310 / #0A0A0F / #080d0a / #16161D`. Questo è esso stesso debito (nessuna fonte unica → i colori sono già migrati a qualche hex di distanza l'uno dall'altro). Va dimensionato come lavoro incrementale per-feature in M2, non come sweep big-bang.

- **`MutationObserver`: 2 pagine, non 3.** §2.4 dice "osservata via `MutationObserver` da `LaMappa`/`IlBaule`/`LAlberone`" e "gli osservatori in 3 pagine spariscono". Reale: `MutationObserver` vero solo in `IlBaule.tsx:76` e `LaMappa.tsx:84`. `LAlberone.tsx:198` fa solo una **lettura a render-time** (`document.documentElement.classList.contains('dark')`) per passare il `theme` all'emoji-picker — nessun observer. La vittoria di pulizia resta (ThemeMode reattivo li estingue tutti e tre i workaround), ma il conteggio è "2 observer + 1 lettura imperativa".

- **Il disallineamento Gemini è più profondo di "banale".** Il piano (§3 scoperta 3, §3.7) dice "Gemini legge `localStorage`, non `profile.apiKey`… sanare nel porting (banale)". La realtà verificata: `profile.apiKey` è un **campo morto** — dichiarato in `types.ts:16`, documentato (CLAUDE.md, dossier §E) come "settato dal pannello Admin/Root", ma **`AdminPanel.tsx` non lo scrive mai** e **nessuno lo legge**. Il flusso vero è interamente localStorage: `ProfiloPersonale.tsx:26,63` legge/scrive `localStorage['gemini_api_key']`, `IlBaule.tsx:250` lo rilegge. Quindi non è "fix della lettura": è una **decisione** (A: rendere reale il path Firestore — `Profilo` scrive `profile.apiKey`, `IlBaule` lo legge, sfruttando che `apiKey` è già nel ramo self-update owner-writable delle rules, dossier §E `rules:123`; oppure B: tenerlo client-local, e in Flutter NON esiste `localStorage` nativo → `flutter_secure_storage`/`shared_preferences`) **+** correzione della doc **+** rimozione del campo morto o del path doppio. Il porting 1:1 ingenuo replicherebbe il campo morto.

- **`canvas-confetti`: giusto, ma incompleto.** Confermato 0 usi in `src/` (solo nei `public/docs/*.md`). Il piano omette che anche **`@types/canvas-confetti` è morto** e che **entrambi sono in `dependencies`** invece che `devDependencies` (il `@types/*` è una dipendenza di sviluppo). Estinguerlo rimuove due voci, non una.

- **"Doppie dep" come target è stale.** Le mie istruzioni e il piano citano "doppie dep" tra i debiti da estinguere, ma per CLAUDE.md sono **già state estinte in B6** (`motion` accanto a `framer-motion` rimosso; `express`/`@types/express` rimossi; `vite` doppio, `dotenv`, `autoprefixer` puliti). Il `package.json` attuale non ne ha. Non va inventato debito già chiuso: l'unico residuo di igiene-pacchetti è `canvas-confetti`(+`@types`) morto e il misplacement del `@types`.

- **`fcmTokens` type-gap: reale e più pericoloso in Dart.** Confermato (dossier §H): `fcmTokens` usato da `useFCM.ts` + rules (cap 20) ma **non dichiarato in `UserProfile`** (`types.ts:7`, nessun campo). In TS è "non bloccante"; in Dart un modello `fromJson`/`toJson` che lo omette **droppa silenziosamente l'array a ogni write del profilo** → cancella i token push dell'utente. Va elevato da nota a rischio di correttezza del porting.

- **Debiti che il piano non menziona affatto** (dal codice/dossier, dimensione mia):
  - `pb-safe` / `pt-safe` sono **classi CSS inesistenti** (no-op): usate in `Layout.tsx:296` (bottom-nav) e `FullScreenPlayer.tsx:53`, ma non definite in `index.css` (c'è solo `.pb-nav-safe`) né utility Tailwind v4 standard (dossier §frontend-ux:1019). La safe-area iOS lì è probabilmente non applicata. In Flutter va resa reale via `SafeArea`/`MediaQuery.padding` — occasione per estinguere un no-op silenzioso.
  - `.dark body` usa `#0d1310` hardcoded, **divergente** dal token `--color-background` `#0A0A0F` (`index.css:111` vs `:19`) — un altro quasi-duplicato da collassare in tokenizzazione.
  - `proposeTrack` (in-hook) fa il check duplicati (`!allowDuplicates`, confronto `trackTitle+trackArtist`), ma la variante standalone `proposeTrackToSession` **lo salta** (dossier §F:356) — due path di proposta quasi-duplicati che divergono nel comportamento: da consolidare in uno solo nel porting Dart (entrambi colpiscono la stessa rule).
  - `expenses.update` è un **footgun dormiente** (dossier §D:104): `isValidEventExpense` con `paidBy==auth.uid` come AND globale, mai esercitato perché il client non aggiorna spese. Backend congelato → non si tocca; ma nota anti-regressione: **non introdurre un path "modifica spesa" in Flutter** senza prima ribasare quel validatore, o si inciampa nel footgun.

---

## Pulizia, refactoring e semplificazione durante la migrazione

### Perché la migrazione è il momento giusto per estinguere il debito (e perché non destabilizza)

La regola di Neo — "step di pulizia/refactoring dopo ogni milestone, con test che tengano salda l'app" — qui non è disciplina astratta: è la leva che rende la migrazione *economicamente* sensata. Tre fatti del repo lo impongono.

**Primo: riscrivere un file è il momento a costo marginale-zero per tokenizzarlo.** Portare `LaPiazza.tsx` (27 hex inline) in `lib/.../la_piazza.dart` significa già toccare ogni riga di stile. Sostituire `bg-[#2D5A27]` con `colors.verde` *mentre* lo riscrivi costa quasi nulla; farlo dopo, come refactor a sé, costa un secondo passaggio sullo stesso file. La deriva di 1029 hex non si paga mai in un blocco: si estingue **un file per volta, nel momento in cui quel file viene comunque riaperto** per il porting.

**Secondo: il debito che si porta 1:1 diventa permanente.** Un campo morto (`profile.apiKey`), una classe no-op (`pb-safe`), un path duplicato (`proposeTrackToSession`) portati letteralmente in Dart non sono più "debito noto da CLAUDE.md": diventano codice nuovo, plausibile, senza la memoria storica che dice "questo è morto". La migrazione è l'**ultima finestra** in cui questi item sono ancora etichettati. Estinguerli ora è più sicuro che dopo, perché ora sai *perché* esistono.

**Terzo: marzio è in produzione e non deve regredire — ed è esattamente questo che rende la pulizia sicura, non rischiosa.** Il backend è congelato (Firestore + rules + 7 CF + 74 rule-test invariati, §0.1). Quindi tutta la pulizia di cui parlo vive **solo nel client Dart in costruzione su staging**, mai sull'app React live. L'app React resta accesa come rete fino al cutover (M4). Una semplificazione che rompe qualcosa rompe *staging*, sotto test, prima di qualunque utente. Il rischio di regressione su Marzio-in-produzione da questi refactor è strutturalmente **zero** fino a M4, e a M4 il rollback è "ripuntare all'artefatto React".

Il vincolo "non destabilizzare" si traduce quindi in una sola regola operativa: **la pulizia non precede mai la parità, la segue.** Prima si porta il modulo a verde (parità funzionale + test), *poi*, sulla stessa milestone, si consolida. Mai il contrario.

### (c) Il principio: refactor solo a test verdi — e i test come rete

**Regola.** Nessun refactoring/semplificazione parte se la suite di riferimento del modulo non è verde *prima*. La sequenza per ogni intervento è invariabile: (1) il modulo è a parità e i suoi test passano → (2) commit "parità" → (3) refactor → (4) gli **stessi** test ripassano invariati → (5) commit "cleanup". Se al passo 4 un test cambia *aspettativa*, non è più un refactor: è un cambio di comportamento, e va trattato come tale (con la sua decisione e la sua nota). Refactor = il comportamento osservabile non cambia, lo dimostrano i test che non cambiano.

**Perché.** Un refactor senza test verdi a monte non sa distinguere "ho semplificato" da "ho rotto e semplificato insieme". I test verdi *prima* sono la fotografia del comportamento corretto; gli stessi test verdi *dopo* sono la prova che la fotografia non è cambiata. Senza la prima foto, la seconda non dimostra niente.

**La rete a quattro strati** (chi para cosa, nel mondo Flutter):

| Strato test | Cosa garantisce durante un refactor | Equivalente nel target |
|---|---|---|
| **Rule-test (74/74, INVARIATI)** | Che il client Dart scriva *ancora* la stessa lingua: shape, campi, invarianti che le rules giudicano. Sono **language-agnostic** e restano in TS sull'emulator. | restano `firestore.rules.test.ts` + `.audio.test.ts`, non si toccano |
| **Unit (66/66 → Dart)** | Che la logica pura non cambi semantica quando la riscrivi/semplifichi (`scoring` floor 1pt, `eventState` transizioni, `spawning`, `geo` Haversine, `getMaxQueuedFor`, `djEngine`, `id3`) | `flutter test` su `lib/.../domain` |
| **Widget** | Che la UI di una pagina renda gli stessi stati dopo la tokenizzazione/dedup dei widget | `flutter_test` widget test per pagina |
| **Integration (runtime)** | Che i flussi end-to-end (La Piazza legge/scrive su Firestore live, echo WebRTC, cattura Flame, claim quiz) reggano dopo il consolidamento delle vie di fuga | `integration_test` contro emulator/Firestore live |

Il punto load-bearing: **i 74 rule-test sono la rete cross-linguaggio.** Non cambiano, e proprio per questo diventano il gate di accettazione della migrazione — "il client Dart parla la stessa lingua di scrittura di quello React" è *esattamente* ciò che un rule-test verde dimostra. Ogni volta che un refactor del data-layer Dart li lascia verdi, ha la prova di non aver alterato il contratto col backend congelato.

**Caso speciale — il "patto a 3" che diventa 4.** Il piano (§1 Fase 1, §3.6) nota giustamente che la formula del cap coda acquista un quarto sito Dart (`getMaxQueuedFor`) che deve restituire lo stesso intero di `effectiveMaxQueued` (rule) e `enforceQueuePerUserLimit` (CF), pena `Missing or insufficient permissions` silenzioso. La contromossa di pulizia: **una sola fonte Dart** della formula (una funzione pura in `domain`, non duplicata tra in-hook e standalone come oggi `proposeTrack`/`proposeTrackToSession`), **bloccata da un unit-test** che hardcoda la formula documentata (`max + floor(points/100)*bonus`, default 2/1), **più** un integration-test che fa passare un `effectiveMaxAtCreate` prodotto da Dart attraverso la rule reale sull'emulator. Così il "quarto sito" nasce già con la rete che impedisce il drift silenzioso — non lo si scopre in produzione.

### (a) Cadenza di pulizia agganciata alle milestone

Ogni step parte **solo** quando il criterio "fatto" della milestone (dal piano §1) è raggiunto e i test sono verdi. Lo step è breve, mirato, e chiude con un commit `refactor:`/`chore:` separato dal commit di parità.

**Dopo M0 — Loop end-to-end provato.** Appena `analyze` è pulito, build web+mobile verdi, La Piazza scrive su Firestore live e i 74 rule-test reggono:
- **Fissa i fondamenti del tema, una volta sola.** Crea `ThemeExtension MarzioColors` + i due `ThemeData` (seppia/dark-flame) derivati da `TenantConfig`, e porta dentro i 5 token brand + i 19 semantici di `index.css` (collassando subito i quasi-duplicati: `.dark body #0d1310` vs token `#0A0A0F`, decisione esplicita su quale vince). Questo è il *contenitore* in cui M2 verserà la tokenizzazione per-pagina. Farlo a M0 evita che le prime pagine portate "inventino" hex propri.
- **Estingui `canvas-confetti` + `@types/canvas-confetti`**: non vanno nel `pubspec.dart`. Annota nel diario di migrazione "dipendenza morta non portata" così non riemerge.
- **Decidi e cabla `TenantConfig` come fonte unica** di colori/identità (non precludere §0.4): è il momento, c'è una sola pagina a dipenderne.
- **Verifica:** `flutter analyze` pulito, widget test M0 verdi, rule-test ancora 74/74.

**Dopo M1 — Moduli duri sciolti.** Quando echo WebRTC gira a runtime, audio web+nativo funziona, Flame cattura atomica è verde e le decisioni EQ/storage sono chiuse:
- **Consolida le vie di fuga nella tassonomia a 3 livelli del piano (§2.5)**: una sola `abstract class` per confine (`AudioEngine`, `LocalLibraryStore`, `SignalingChannel`), conditional import *solo* per audio e storage. Qui si paga il debito di forma: se lo spike ha lasciato impl divergenti, ora che funzionano si uniformano dietro l'interfaccia, a test verdi.
- **Unifica i due path di proposta** (`proposeTrack`/`proposeTrackToSession`): in Dart uno solo, col check duplicati coerente (oggi lo standalone lo salta). 
- **Fonte unica della formula cap-coda** + i due test della rete (vedi sopra).
- **Verifica:** integration echo WebRTC + cattura Flame ripassano dopo il consolidamento; `validateCaptureDistance` ancora verde.

**Dopo M2 — Parità comunità.** Mano a mano che le ~13 pagine raggiungono parità (è il grosso del lavoro di tokenizzazione):
- **Tokenizza per-pagina, alla chiusura di ogni pagina** — non in sweep finale. Ogni `bg-[#...]` → `Theme.of(context)`/`colors.*`; obiettivo misurabile: **zero hex inline** nel file appena portato (l'equivalente Dart del `grep` di drift deve dare 0 su quel file). I 34 file con hex si svuotano uno per uno; a fine M2 il `grep` di colori grezzi deve essere vuoto su `lib/`.
- **Estingui gli observer del dark mode**: niente `MutationObserver`/letture `classList` (2 observer + 1 lettura render-time nel sorgente) → `ThemeMode` reattivo, i rebuild lo danno gratis.
- **Estingui le classi no-op** `pb-safe`/`pt-safe` → `SafeArea`/`MediaQuery.viewPadding` reali.
- **Sana il path Gemini** (porti `IlBaule`): qui si chiude la decisione A/B su `profile.apiKey` vs storage-locale, si rimuove il campo morto o si rende reale, si allinea la doc.
- **Aggiungi `fcmTokens` al modello `UserProfile` Dart** (porti il Profilo): obbligatorio, o il `toJson` lo cancella.
- **Verifica:** widget test per pagina verdi; rule-test invariati; `grep` colori grezzi su `lib/` = 0.

**Dopo M3 — Parità dura.** Cablate audio + giochi completi:
- **Rimuovi gli stub di Fase 1** rimasti vivi solo per de-rischiare (skeleton Flame non più usati, impl provvisorie dietro le interfacce).
- **Conferma che nessun campo morto/path duplicato è sopravvissuto** al cablaggio (audit `grep` mirato: `apiKey`, doppie propose, footgun expenses non replicato).
- **Verifica:** integration sessione DJ P2P reale + treasure hunt + photo quiz end-to-end; rule-test invariati.

**Dopo M4 — Cutover web + mobile store.** A parità piena e cutover reversibile:
- **Rimuovi i ponti di compatibilità del periodo parallel-backend** (eventuali letture "sia Timestamp che legacy epoch" che servivano solo a convivere con scritture React, *se e solo se* nessuno scrive più il formato legacy — da verificare, non da assumere).
- **Pulizia pipeline**: rimuovi il workflow/artefatto React solo **dopo** finestra di osservazione stabile (il rollback è ripuntare a React; non bruciarlo prima).
- **Verifica:** la URL canonica serve Flutter a parità; rollback ancora possibile.

**Dopo M5 — Desktop + OSS.** Stretch:
- **Pulizia OSS-readiness della destinazione** (struttura, README, contrib model) — qui la pulizia è "presentabilità", non comportamento.
- **Verifica:** build desktop verde con AR degradato documentato; checklist non-preclusione multi-tenant.

### (b) Registro del debito da estinguere (target concreti, azionabili)

Ordinati per momento di intervento. Ogni voce: *cosa · file · perché · come verificare*.

| # | Debito | File (sorgente) | Perché estinguerlo ora | Quando | Verifica |
|---|---|---|---|---|---|
| D1 | **Deriva palette: 1029 hex inline, ~30 valori, cluster di quasi-duplicati** | 34 `.tsx` (top: `IlBaule` 57, `ProfiloPersonale` 37, `Layout` 33, `EventDetailModal` 32, `IlBivacco` 28, `LaPiazza` 27) | La migrazione riapre comunque ogni file; tokenizzare lì è gratis. I quasi-duplicati (8 verdi, 5 neri) vanno *collassati con decisione umana*, impossibile dopo senza memoria storica | M0 (contenitore) → M2 (per-pagina) | `grep` hex su `lib/` = 0; widget test verdi |
| D2 | **`canvas-confetti` + `@types/canvas-confetti` morti** (e mal collocati in `dependencies`) | `package.json:21,23` | 0 usi in `src/`; non vanno nel `pubspec` | M0 | assenti dal `pubspec`; nota nel diario |
| D3 | **`profile.apiKey` campo morto + path Gemini doppio** | `types.ts:16`, `IlBaule.tsx:250`, `ProfiloPersonale.tsx:26,63`, `AdminPanel.tsx` (non scrive) | Campo dichiarato+documentato ma mai scritto/letto; il flusso vero è localStorage; in Flutter `localStorage` non esiste → serve una decisione (Firestore vs secure-storage), non un porting 1:1 | M2 (porting `IlBaule`/`Profilo`) | un solo path attivo; doc allineata; campo morto rimosso o reso reale |
| D4 | **`fcmTokens` assente da `UserProfile`** | `types.ts:7` (manca), `useFCM.ts`, `rules` cap 20 | In Dart il `toJson` che lo omette cancella i token push a ogni write profilo: da nota a rischio di correttezza | M2 (porting Profilo) | campo nel modello Dart; integration "salva profilo non azzera fcmTokens" |
| D5 | **`pb-safe`/`pt-safe` classi inesistenti (no-op)** | `Layout.tsx:296`, `FullScreenPlayer.tsx:53` | Safe-area iOS probabilmente non applicata; in Flutter si rende reale con `SafeArea` | M2 | `SafeArea` reale; nessuna classe fantasma |
| D6 | **`.dark body #0d1310` divergente dal token `#0A0A0F`** | `index.css:111` vs `:19` | Quasi-duplicato; due "neri di sfondo" senza fonte unica | M0 (in ThemeData) | un solo nero di sfondo, deciso |
| D7 | **Path proposta duplicato e divergente** (`proposeTrack` fa il check duplicati, `proposeTrackToSession` lo salta) | `useAudioQueue.ts:81-89, 169-176` | Due quasi-cloni con comportamento diverso sulla stessa rule; in Dart si unifica in uno | M1/M3 (porting coda audio) | un solo path; unit-test sul check duplicati |
| D8 | **`MutationObserver` + letture `classList` per il dark** | `IlBaule.tsx:76`, `LaMappa.tsx:84` (observer), `LAlberone.tsx:198` (lettura) | `ThemeMode` reattivo li rende inutili; meno stato imperativo | M2 | nessun observer dark in `lib/`; toggle tema ricostruisce reattivamente |
| D9 | **Footgun dormiente `expenses.update`** (NON toccare le rules — congelate) | `firestore.rules:282` (dossier §D) | Anti-regressione: non introdurre un path "modifica spesa" in Flutter (oggi inesistente) o si attiva il footgun | nota permanente | nessun `expenses.update` lato client Dart |
| D10 | **Stub/skeleton di de-rischio (Fase 1) e ponti parallel-backend** | impl dietro le interfacce audio/storage; letture "Timestamp o legacy epoch" (`useWebRTCTransfer.ts`) | Vivono solo per la transizione; vanno tolti quando non più necessari, *verificando* che nessuno scriva più il formato legacy | M3 (stub) / M4 (ponti) | grep stub = 0; integration verdi |

**Non-target (debito già chiuso — non reintrodurre, non "ripulire" ciò che non esiste):** doppie dep (`motion`, `express`) estinte in B6; codice morto quiz (`evaluateRoundAnswers`, `setRoundStatus`, `configureQuizRound`) rimosso in B7; `.scrollbar-hide`/`.pb-nav-safe` ora definite e usate; `enableIndexedDbPersistence` deprecata già sostituita. In Dart questi semplicemente non esistono: vanno ignorati, non "sistemati".

**Filo conduttore.** Ogni voce sopra si estingue *dentro* il porting del file che la contiene, *dopo* che quel file è a parità verde, con un commit `refactor:`/`chore:` separato. Nessuna di queste tocca il backend congelato; tutte vivono su staging fino a M4. È così che "si tiene salda l'app mentre si pulisce": la rete (74 rule-test + unit + widget + integration) resta verde a ogni passo, e Marzio-in-produzione non vede niente finché il cutover reversibile non è provato.

---

**File chiave a supporto** (verifica alla fonte): `/home/neo1777/Scrivania/marzio1777-main/src/index.css` (token e quasi-duplicati), `.../package.json` (dead deps), `.../src/types.ts` (apiKey morto, fcmTokens mancante), `.../src/pages/IlBaule.tsx` + `.../src/pages/ProfiloPersonale.tsx` + `.../src/pages/AdminPanel.tsx` (path Gemini reale), `.../src/components/Layout.tsx` + `.../src/pages/LaMappa.tsx` + `.../src/pages/LAlberone.tsx` (dark mode e no-op safe-area), `.../src/hooks/useAudioQueue.ts` (path proposta duplicato).
