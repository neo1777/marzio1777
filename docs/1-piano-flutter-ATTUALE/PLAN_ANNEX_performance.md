> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

### Verifica del piano attuale (gap trovati)

Ho verificato la parte "performance" del piano (`/home/neo1777/Scrivania/marzio1777-main/FLUTTER_MIGRATION_PLAN.md`, soprattutto §7 tabella trade-off, §1 criteri "Fatto"/milestone, §3.7 PWA) contro il dossier e contro i due build reali sul disco: il `dist/` React di produzione e il `build/web` dello spike (`/home/neo1777/Scrivania/marzio1777-flutter-spike/build/web`).

- **§7, riga "CanvasKit/Skwasm vs HTML renderer" — claim datato.** Il piano tratta l'HTML renderer come opzione viva ("più leggero ma… in dismissione"). Falso sulla toolchain pinnata: Flutter **3.38.9 / Dart 3.10.8** (verificato: `flutter --version`) **non ha più l'HTML renderer** — è stato rimosso in Flutter 3.29 (inizio 2025). Su questa versione `--web-renderer` accetta **solo `canvaskit` e `skwasm`**. Il vero trade-off è CanvasKit vs Skwasm, non CanvasKit vs HTML. Va riscritto.
- **§7, "CanvasKit ≈ +2MB e TTI più lento (lo spike: main.dart.js 2.1MB)" — due numeri sommati spacciati per uno.** Misurati nel build dello spike (canvaskit, dart2js, demo quasi vuota): `main.dart.js` = 2062 KB raw / **606 KB gz**, e in **aggiunta** `canvaskit.wasm` = 6917 KB raw / **2794 KB gz** (variante full) oppure 5575 KB / **2118 KB gz** (variante chromium). Il "+2MB" è grosso modo il gz del CanvasKit; il "2.1MB" è il raw di main.dart.js. **Si sommano**: il primo paint a cache fredda della demo vuota pesa ~3,4 MB gz, non ~2 MB. Il piano sottostima.
- **§7, "baseline Flutter web molto più pesante della PWA React (core MVP ~30KB + audio ~40KB)" — confronto mela/arancia.** I "~30KB/~40KB" sono **delta incrementali di modulo** (dossier `performance-pwa`), non il first-load React. Il first-load reale misurato è il main bundle `dist/assets/index-*.js` = 842 KB raw / **220 KB gz**. Il confronto onesto è **220 KB gz (React, primo paint) vs ~2,7–3,4 MB gz (Flutter, primo paint a freddo della demo vuota)**, ~12–15×, e crescerà col main.dart.js dell'app reale. Citare i numeri giusti rende la tensione credibile invece che retorica.
- **Nessun budget numerico, nessun gate misurabile, nessuno strumento.** §1 "Fase 0 → Fatto" dice "build web e mobile verdi": build verde, zero numeri. Le milestone M0–M5 non hanno un criterio di performance. La regola "leggero e fluido su cellulari vecchi" vive come valore (Convenzione 1, §7) ma non è mai un **gate di accettazione** con soglia e metodo di misura. È il buco principale.
- **Omissioni azionabili.** Il piano non nomina: `--no-web-resources-cdn` (CanvasKit locale per l'offline-first — lo stesso problema del CDN DiceBear già rimosso), il trap di `--tree-shake-icons` (icone costruite da codepoint dinamici ⇒ font intero da ~1,6 MB), font come asset vs `google_fonts` a runtime, il blocco **COOP/COEP** di GitHub Pages che rende Skwasm/dart2wasm non attivabili sull'host attuale, gli **import differiti** Dart come leva principale sul first-load web, e la distinzione **cold (cache fredda) vs SW-cached (visita ripetuta)**.
- **§7, "sul mobile preferire l'app nativa (bundle non riscaricato)" — corretto e ben fondato.** Va però promosso da nota a **decisione di indirizzo** con il meccanismo esplicito (vedi sotto), perché è la mitigazione decisiva del vincolo cardine, non un dettaglio.

---

## N. Performance — budget, gate di accettazione, renderer web e dove vince il nativo

**Perché questa sezione esiste.** Il vincolo cardine del progetto è scritto in `CLAUDE.md` Convenzione 1: *"l'app deve restare leggera, professionale, fluida anche su cellulari vecchi"*. Tutta la disciplina zero-dep (main bundle React tenuto a 220 KB gz, delta di modulo ~30–40 KB, doc fuori dal bundle, Leaflet/DiceBear de-CDN-izzati per l'offline) serve quell'obiettivo. Flutter web parte da un pavimento strutturalmente molto più alto. Questa è la frizione numero uno della migrazione, e va governata con budget e gate, non con buoni propositi. Il backend non c'entra (Firestore resta): la performance si gioca tutta sul client e sul renderer.

### N.1 Il punto di partenza, misurato

Tutti i numeri sotto sono **misurati oggi** sul disco, non stimati.

| Superficie | Artefatto | raw | gz | Note |
|---|---|---|---|---|
| **React (prod, `dist/`)** | `index-*.js` (main, first paint) | 842 KB | **220 KB** | shell + auth + router + theme |
| React lazy | `IlBaule` | 333 KB | 69 KB | cropper + genai + storage |
| React lazy | `emoji-picker-react` | 302 KB | 73 KB | `lazy()` on-demand |
| React lazy | `TileLayer` (Leaflet) | 150 KB | 43 KB | mappa |
| React lazy | `Istruzioni` (markdown) | 122 KB | 37 KB | doc render |
| React lazy | `IlAinulindale` | 91 KB | 24 KB | audio |
| **Flutter web spike** (canvaskit, dart2js, **demo quasi vuota**) | `main.dart.js` | 2062 KB | **606 KB** | crescerà con l'app reale |
| Flutter | `flutter.js`+`flutter_bootstrap.js` | ~18 KB | ~6 KB | loader |
| Flutter | `canvaskit/canvaskit.wasm` (full) | 6917 KB | **2794 KB** | renderer, default |
| Flutter | `canvaskit/chromium/canvaskit.wasm` | 5575 KB | **2118 KB** | solo Chromium |
| Flutter | `skwasm.wasm` (single-thread) | 3468 KB | 1482 KB | richiede COOP/COEP |
| Flutter | `assets/fonts/MaterialIcons-Regular.otf` | 8 KB | — | **tree-shaken** da ~1,6 MB ✅ |

**Lettura netta.** Primo paint a cache fredda: React **220 KB gz**; Flutter (demo vuota, CanvasKit full) **bootstrap ~6 + main.dart.js 606 + canvaskit 2794 ≈ 3,4 MB gz**; con variante chromium ≈ 2,73 MB gz. [INFERENZA, da verificare buildando] l'app marzio completa (Flame + FlutterFire + plugin audio/webrtc/mappa) porterà `main.dart.js` plausibilmente a 1,2–2,0 MB gz, quindi cold first paint web reale ≈ **3,3–4,5 MB gz**. Dopo l'installazione del service worker tutto è in cache → le visite ripetute sono veloci; **il dolore è la prima visita e ogni visita post-aggiornamento** — esattamente lo scenario "cellulare vecchio in piazza con 4G lento".

### N.2 Renderer web: CanvasKit vs Skwasm (l'HTML renderer non esiste più)

**Perché.** Flame (i due giochi) e la fedeltà pixel del tema dark-flame chiedono un canvas vero; questo orienta verso CanvasKit/Skwasm. Ma su GitHub Pages c'è un vincolo duro.

Verificato nel bootstrap dello spike: `"renderer":"canvaskit"` (default) e CanvasKit caricato da `https://www.gstatic.com/flutter-canvaskit` **a meno di** `useLocalCanvasKit`.

| Renderer | gz scaricato | Dove gira | Vincolo host |
|---|---|---|---|
| **CanvasKit full** | 2794 KB | ovunque | nessuno → **default su GitHub Pages** |
| CanvasKit chromium | 2118 KB (−676 KB) | solo Chrome/Edge/Android WebView | nessuno; il bootstrap la sceglie da sé sui browser Chromium |
| **Skwasm** (single/heavy) | 1482 / 2190 KB | tutti, ma multithread solo con isolamento | **richiede COOP/COEP**, non settabili su GitHub Pages |

**Cross-origin isolation (isolamento cross-origine):** Skwasm multithread e il target `flutter build web --wasm` (dart2wasm) richiedono gli header HTTP `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. **GitHub Pages non permette header di risposta custom.** Esiste l'hack `coi-serviceworker`, ma aggiunge un terzo service worker a un'app dove ne convivono già due (Flutter SW + `firebase-messaging-sw.js`, §4.5 del piano) — fragile, lo sconsiglio in fase 1.

**Posizione.** Web su GitHub Pages → **CanvasKit** (default), lasciando che il bootstrap serva la variante chromium ai browser Chromium (la maggioranza mobile). **Exit path**: se/quando l'host web passa a **Firebase Hosting** (può settare COOP/COEP via `firebase.json` headers — e il progetto è già su Firebase Blaze), si valuta **Skwasm + `--wasm`**, che taglia il renderer a ~1,5 MB gz e velocizza parse/exec. Da non fare in fase 1: cambierebbe la pipeline di deploy (oggi `actions/deploy-pages`) e il modello di rollback "ripuntare a `dist/` React" del §6.1.

### N.3 Budget di performance per la destinazione

Budget come tetti da ratificare alla prima build dell'app reale (i valori marcati [INFERENZA] sono target onesti, non misure). La regola: **ottimizzare ciò che si controlla** (main.dart.js, icone, font, offline) perché il pavimento del renderer è fisso.

1. **main.dart.js iniziale ≤ ~1,0 MB gz** [INFERENZA, target]. Leva: **import differiti** Dart (`deferred`). In `lib/`, i tre domini grossi e le pagine pesanti vanno dietro `import '...' deferred as x;` + `await x.loadLibrary()`, esattamente come oggi ogni pagina è `lazy()` in `src/App.tsx`. Candidati primari (rispecchiano i lazy chunk React misurati in N.1): **giochi/Flame**, **Ainulindalë/audio**, **IlBaule** (cropper+AI+storage), **Istruzioni** (markdown). In go_router questo si cabla nel `builder` della route che `await`-a il `loadLibrary()` prima di costruire la view. Verifica: `flutter build web --release` e conta i `main.dart.js_*.part.js` prodotti + misura il gz del chunk iniziale.
2. **Font icona ≤ 20 KB.** `--tree-shake-icons` è **ON di default** (verificato: MaterialIcons ridotto a 8 KB nello spike). Le 104 icone lucide statiche del React si portano come `const IconData` (Material/Cupertino o un icon-font), riferite **staticamente**. Trap da evitare: costruire `IconData(codepointDinamico)` forza `--no-tree-shake-icons` e rispedisce il font intero (~1,6 MB). Regola: nessuna icona costruita a runtime da interi.
3. **Font testo bundlati come asset, non `google_fonts` a runtime.** Il React importa Inter + Playfair Display via CSS @import. In Flutter: mettere i `.ttf`/`.otf` in `assets/fonts/` e dichiararli nel `pubspec.yaml`, **non** usare il package `google_fonts` (che li scarica da `fonts.gstatic` al primo run). Motivo: coerenza con l'offline-first faticosamente conquistato — il progetto ha già rimosso il CDN DiceBear e i marker Leaflet da CDN *proprio* per non dipendere dalla rete al primo avvio (dossier `performance-pwa`). Stesso principio, stessa scelta.
4. **CanvasKit locale: `--no-web-resources-cdn`.** Di default il bootstrap carica CanvasKit da gstatic CDN (verificato). Al primo run, prima che il SW installi, è una **dipendenza di rete sul primo paint** — la stessa classe del bug DiceBear. Buildare con `flutter build web --release --no-web-resources-cdn` forza il `canvaskit/` locale (già presente in `build/web`, già precache-ato dal SW). Trade-off: l'artefatto pesa di più ma è offline-safe e non dipende da gstatic.
5. **Peso di precache del SW sotto controllo.** Il `flutter_service_worker.js` dello spike precache-a **36 risorse**, incluse **entrambe** le varianti CanvasKit (full + chromium) + `main.dart.js` → ~5 MB raw scaricati all'install. Su cellulare vecchio/metered è tanto. Azione: tagliare la variante non usata dal precache (o spostare il renderer a una strategia di cache runtime) e riprodurre il precache dei `docs/*.md` per le Istruzioni offline (oggi fatto da Workbox in `vite.config.ts`; con Flutter SW va replicato dichiarando i doc come asset).
6. **Budget nativo (install-once).** APK `arm64` ≤ ~30 MB, AAB consegnato ≤ quanto serve [INFERENZA, target]. Verifica reale: `flutter build apk --target-platform android-arm64 --analyze-size` e `flutter build appbundle --analyze-size`. Il nativo non ha main.dart.js né canvaskit.wasm da scaricare (vedi N.5), quindi qui il budget è il peso del binario, non del primo paint.

### N.4 La regola "leggero e fluido su cellulari vecchi" come GATE per fase

**Perché.** Un valore che non è un gate verificabile non difende nulla. Lo trasformo in **due gate misurabili** — uno per il web (peso/TTI a cache fredda) e uno per il nativo (fluidità a 60fps) — e li attacco ai criteri "Fatto" delle fasi del §1.

- **Gate WEB (cold).** Profilo di misura: Lighthouse preset *mobile* (CPU 4× throttle, Slow-4G) **a cache fredda**, su Chrome. Soglie [INFERENZA, da ratificare al primo build reale]: chunk iniziale `main.dart.js` ≤ 1,0 MB gz; **TTI ≤ 5,0 s cold / ≤ 2,5 s warm** su profilo low-end; font icona ≤ 20 KB; zero dipendenze di rete da CDN al primo paint (CanvasKit + font locali). Strumento: `flutter build web --release …` poi misura gz dei file in `build/web/` + Lighthouse.
- **Gate NATIVO (jank).** Profilo: dispositivo Android entry-level reale o emulato, **`flutter run --profile`** + DevTools Performance timeline. Soglia: **niente frame > 16,6 ms (60fps)** nei percorsi caldi — scroll del feed La Piazza, pan della mappa, overlay AR sopra camera, visualizer audio 32-bar (`fftSize 128`), cattura Flame con `runTransaction`. Impeller (default su Android) precompila gli shader → niente jank al primo frame; verificare con `--trace-skia`/timeline che non rientri jank di shader.

Mappatura sui milestone esistenti (estende, non sostituisce, i criteri "Fatto" del §1):

| Milestone | Gate di performance da aggiungere |
|---|---|
| **M0** (loop end-to-end) | misura baseline: gz reali di `main.dart.js` + canvaskit a freddo, TTI low-end registrata come riferimento (non ancora soglia) |
| **M1** (moduli duri) | visualizer audio 32-bar e overlay AR **a 60fps** in profile su low-end; echo WebRTC a runtime senza stallo del main-thread (backpressure su `bufferedAmount`, dossier `coda-p2p-audio` §B) |
| **M2** (volume comunità) | scroll feed/mappa a 60fps; chunk delle pagine pesanti **differiti** (non nel main.dart.js iniziale) |
| **M3** (integrazione dura) | sessione DJ + trasferimento P2P brano reale senza frame drop; Flame capture a 60fps |
| **M4** (cutover web) | **gate WEB cold passa** sul profilo low-end **prima** dello swap dell'artefatto; altrimenti il cutover non parte (Marzio React resta live, §6.1) |
| **M5** (desktop/OSS) | budget nativo APK/AAB ratificato via `--analyze-size` |

Il punto duro: **M4 è bloccante**. Se il gate WEB non passa su cellulare vecchio, non si fa lo swap — il rollback è gratis perché il backend è invariato (§6.1). Questo rende la regola cardine un cancello, non un auspicio.

### N.5 Dove il mobile nativo aiuta (il bundle non si riscarica)

**Perché è la mitigazione decisiva.** Gli utenti reali di marzio sono "la comunità di paese" su telefoni mobili, spesso modesti. Su **web** pagano il pavimento di N.1 a ogni cache fredda. Sul **nativo** quel costo **non esiste**:

- Niente `main.dart.js`: il codice Dart è **AOT** (ahead-of-time, compilato in anticipo a codice macchina ARM) dentro l'APK/IPA.
- Niente `canvaskit.wasm` da scaricare: il renderer (Skia/Impeller) è **dentro il binario dell'engine**, nessun WASM da scaricare né compilare, nessun parse di dart2js.
- Il pacchetto si scarica **una volta sola** all'installazione dallo store; gli aggiornamenti sono **delta** via Play/App Store, non un re-download del bundle a ogni release (al contrario del web, dove ogni aggiornamento del SW rifà scaricare il main.dart.js cambiato).
- **Impeller** (default su Android nelle versioni recenti, e su iOS) precompila gli shader → elimina il jank-al-primo-frame.

**Decisione di indirizzo (da promuovere nel §7).** Indirizzare gli utenti della comunità all'**app nativa** (la superficie dove "leggero e fluido su cellulari vecchi" si tiene per costruzione); trattare il **web** come superficie desktop + fallback + landing, dove si applicano i mitiganti di N.3 ma si accetta un pavimento più alto. Questo è coerente con §1 ("mobile net-new sugli store, web cutover reversibile") e con il fatto che mobile è in scope dalla fase 1. **Exit path**: se in futuro l'host web passa a Firebase Hosting, Skwasm+`--wasm` (N.2) recupera parte del divario web senza toccare il nativo.

### N.6 Trade-off CanvasKit vs Skwasm, con i dati

| | CanvasKit (full) | CanvasKit (chromium) | Skwasm (single) | dart2wasm + Skwasm |
|---|---|---|---|---|
| Peso renderer (gz) | 2794 KB | 2118 KB | 1482 KB | 1482 KB + app in WASM |
| Compatibilità | tutti i browser | solo Chromium | tutti | tutti |
| Header COOP/COEP | no | no | **sì (multithread)** | **sì (obbligatori)** |
| GitHub Pages | ✅ | ✅ (auto su Chromium) | ⚠️ solo single-thread | ❌ |
| Firebase Hosting | ✅ | ✅ | ✅ | ✅ |
| Flame / canvas | ottimo | ottimo | ottimo | ottimo |

**Orientamento:** CanvasKit in fase 1 (host GitHub Pages). Skwasm/`--wasm` come exit path legato al cambio di host. L'HTML renderer **non è un'opzione** su 3.38.9 (rimosso): toglierlo dalla tabella §7 del piano.

### N.7 Azioni concrete, in ordine

1. **Riscrivere la riga renderer di §7** del piano: "CanvasKit vs Skwasm" (non HTML), con i gz misurati di N.1 e il blocco COOP/COEP di GitHub Pages.
2. **Correggere i numeri di §7**: separare main.dart.js (606 KB gz spike) e canvaskit (2794/2118 KB gz) come addendi; usare 220 KB gz come baseline React reale, non "30+40 KB".
3. **Aggiungere il gate di performance** ai criteri "Fatto" del §1 e ai milestone M0–M5 (tabella N.4), con M4 bloccante.
4. **Standardizzare i flag di build web**: `flutter build web --release --no-web-resources-cdn` (CanvasKit locale offline-safe); tree-shake-icons resta ON; font bundlati come asset nel `pubspec.yaml`.
5. **Pianificare gli import differiti** dei domini pesanti (giochi/Flame, Ainulindalë, IlBaule, Istruzioni) già in fase 0/2, cablati nei `builder` go_router.
6. **Verifiche misurabili** (comandi reali): `flutter build web --release --no-web-resources-cdn` poi `gzip -c build/web/main.dart.js | wc -c` e ispezione `build/web/canvaskit/`; Lighthouse mobile a cache fredda; `flutter run --profile` + DevTools per il gate jank; `flutter build apk/appbundle --analyze-size` per il budget install-once.

**File di riferimento (assoluti):** baseline React misurata in `/home/neo1777/Scrivania/marzio1777-main/dist/assets/`; build Flutter misurato in `/home/neo1777/Scrivania/marzio1777-flutter-spike/build/web/` (renderer in `.../build/web/canvaskit/`, bootstrap in `.../flutter_bootstrap.js`); toolchain `Flutter 3.38.9 / Dart 3.10.8` (`/home/neo1777/development/flutter`); vincolo cardine in `/home/neo1777/Scrivania/marzio1777-main/CLAUDE.md` (Convenzione 1); config PWA attuale da replicare in `/home/neo1777/Scrivania/marzio1777-main/vite.config.ts`.
