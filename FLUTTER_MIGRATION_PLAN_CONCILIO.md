# Piano migrazione marzio1777→Flutter — Parte II: approfondimento dal concilio (Fase C)

> **Cos'è.** L'esito del flusso di verifica profonda (palantir1777 → setaccio → spiegazione-tecnica → agora1777, 2026-06-30) sul piano di Parte I (`FLUTTER_MIGRATION_PLAN.md`). La Parte I resta valida nell'impianto; questa Parte II aggiunge ciò che la verifica alla fonte e il concilio di completezza hanno fatto emergere e che la Parte I **non vedeva**: precondizioni bloccanti, revisioni alle fasi, trasversali dimenticati, tensioni fra dimensioni da risolvere.
> **Fonti:** dossier sorgentato (le 30 Sporche, coda+P2P, ecc.) e arricchimenti per dimensione → annessi (§F). Ogni voce è fondata su codice/doc reali, fatti distinti dalle inferenze.

---

## A. Precondizioni bloccanti (da chiudere PRIMA, o il piano poggia sul vuoto)

Quattro fatti che invalidano premesse della Parte I se non risolti per primi.

### A1. Una sola `firestore.rules` canonica, SHA pinnato 🔴
Esistono **tre copie potenzialmente diverse** delle rule: working-tree, HEAD (`5dbb5b6`), e quella **deployata in PROD**. Il fix critico `96353ca` (approvazione/like/RSVP) era *dopo HEAD e non committato* (poi pushato+deployato il 2026-06-29 in questa sessione — **da riverificare** che PROD = repo). Conseguenza: l'intera storia "parallel-backend" (React e Flutter sotto *la stessa* rule) e "74 test verdi" poggiano su un artefatto le cui istanze non sono allineate; un clone fresco (come fa `/ultraplan`) prenderebbe rule senza il fix. **Azione:** confermare che working-tree == HEAD == PROD, committare/pushare/deployare un'unica rule, **pinnare lo SHA** nel piano. Finché non è fatto, Flutter non specchi una sola shape.

### A2. Isolamento dati durante la costruzione 🔴 (il buco più grave)
La Parte I dice che Flutter gira su "staging" ma "scrive sul Firestore **live**". **Non esiste un backend di staging**: esiste un *frontend* di staging contro **dati di produzione**. Il client Flutter *in costruzione* (quindi con bug) scriverebbe nello stesso Firestore che l'app React-live legge e mostra → **Marzio può regredire PRIMA di qualsiasi cutover**, via stato condiviso mutabile. La rule giudica la *forma*, non protegge dalla *pollution* semantica. **Azione:** per i WRITE di sviluppo/test usare **un progetto Firebase separato** o **solo emulatori** (porta firestore **8099**, auth 9099 — non 8080: drift di doc da sanare); contro il live solo **read-parity**. Decisione cardine, non rinviabile.

### A3. `storage.rules` versionate + testate 🔴 (punto cieco totale)
`firebase.json` configura **solo** Firestore (rules+indexes+emulator). `IlBaule.tsx` carica foto su **Firebase Storage** (`uploadString(..., 'data_url')`). Quindi le foto — potenziale PII — sono governate da rule che vivono **solo nella console Firebase**: fuori dal repo, fuori dai 74 test. "Backend invariato + 74 test = sicurezza provata" copre Firestore al 100% e **Storage allo 0%**. **Azione:** estrarre `storage.rules` dalla console → versionarle → aggiungerle a `firebase.json` → scrivere rule-test Storage. Più: **strip EXIF** esplicito prima dell'upload (oggi mitigato *per accidente* dal re-encode canvas di `react-easy-crop`; il cropper Flutter può **preservare** il GPS EXIF → regressione privacy introdotta dalla migrazione).

### A4. Pipeline di cancellazione account + erasure (rompe "backend invariato") 🔴
**Non esiste oggi** (`grep`: zero `deleteUser`/erasure/export). Ma: **App Store 5.1.1(v)** e la **data-deletion policy di Google Play** richiedono cancellazione account *in-app* per pubblicare → la submission mobile **viene rifiutata** senza; e per una comunità UE valgono **GDPR art.17 (oblio) + art.20 (portabilità)**. Cancellare un utente è un cascade su `users/posts/comments/user_locations/fcmTokens/foto-Storage/metadati-audio/participants/leaderboard` = **una nuova Cloud Function (#8) + nuove rule `delete` + nuovi test**. **Conseguenza:** "backend invariato" è **falso per il ramo mobile** → va riscritto in *"backend invariato **tranne** l'aggiunta isolata della pipeline di erasure"*, da chiudere **prima della submission store** (Fase 1), non a Fase 4. Più: privacy-policy URL + App-Privacy labels (obbligatori store); dichiarare il data-sharing verso **Google Gemini** (le foto vanno a Gemini per la caption).

---

## B. Revisioni alle fasi (Parte I §1)

1. **Fase 0 è una mega-fase onesta, non "La Piazza funziona".** Il vero M0 è *"l'impalcatura write-shape + read-resilience + token/tema + emulator-harness + observability + CI funziona, **provata su** La Piazza"* — non una singola fetta. Le lenti caricano legittimamente la Fase 0 di lavoro orizzontale (20 modelli + 2 infra, sistema token completo, AsyncNotifier auth, harness shape-contract, precondizioni A1-A3). Riscrivere la stima incrementale di conseguenza.
2. **Resilienza in LETTURA come requisito (non stile).** I modelli Dart leggeranno documenti scritti da React **per oltre un anno**: utenti legacy `createdAt<2024`, post senza `authorPhotoURL`, sessioni senza `rules`, signaling `createdAt` in doppio formato (Timestamp vs epoch), `metrics`/`fcmTokens` assenti. **Deserializzazione difensiva obbligatoria** (default, null-coalescing, mai `as int` nudo). ⚠️ Tensione con i "modelli immutabili strict + round-trip equality" dell'architettura → vince la difensività (§D).
3. **Regime multi-versione permanente dal lancio store.** Il web è sempre-ultima-versione; il mobile **no**: N versioni Flutter vecchie restano sui telefoni per mesi, **tutte che scrivono lo stesso Firestore**. "rules invariate" diventa *"rules forward/backward-compatible con la build più vecchia in circolazione"* — vincolo **permanente**. **Azione (Fase 0, gate Fase 4):** `minSupportedBuild` su un doc Firestore + **force-update gate**; elevare "backward compatibility" da schema a **rules** come regola perenne; rollback **per piattaforma** (web = ri-punta artefatto; mobile = solo hotfix-forward, NON si ritira dallo store).
4. **Coesistenza = N client, non "stessa shape della rule".** React-web + Flutter-web + Flutter-mobile scrivono insieme: dove la rule **pinna esatto** (es. `affectedKeys.hasOnly`) sono al sicuro; dove è **permissiva** divergono in silenzio su doc condivisi. Il P2P *reale* è `RTCPeerConnection` (React) ↔ `flutter_webrtc` (Dart): **mai testato** (lo spike era Flutter↔Flutter via `LoopbackSignaling`). **Azione:** test P2P cross-client reale; `CHUNK_SIZE=16384`/header-meta/soglia backpressure Dart **identici** a `webrtc.ts` (una divergenza di un'unità fa fallire i transfer cross-client mentre i same-client passano). Idempotenza claim quiz oggi in `localStorage` (per-device) → con due client per utente arma un **double-spend**: spostare il guard server-side (`answers/{uid}.claimedAt` one-way nella rule).
5. **Observability + CI sono Fase 0, non Fase 4/5.** Vedi §C.1 e §C.6: senza, "rollback reversibile" non ha trigger e le regressioni post-cutover sono cieche.
6. **Cutover web: idempotenza SW + trigger.** Il rollback "ripunta a `dist/`" è idempotente per lo statico, **non per il service worker** (il SW Flutter resta registrato; coabita con `firebase-messaging-sw.js`). E il web fa **swap atomico** (tutti gli utenti, nessun canary) mentre il mobile ha rollout staged. **Azione:** definire il **trigger** di rollback (soglia errori da observability), valutare un canary/finestra parallela %, e testare il ciclo SW attraverso lo swap.

---

## C. Trasversali da aggiungere (nessuna lente singola li copriva)

1. **Observability 🔴** — assente da piano e Fase B (solo un `ErrorBoundary`). È *la metà mancante* di "rollback reversibile": un rollback senza **trigger** è morto. Installare `firebase_crashlytics` (FlutterFire-nativo → passa il filtro zero-dep) + logging strutturato + un **sensore sui write rifiutati in PROD**, su **entrambi** i client: React **ora** (baseline/gruppo di controllo del tasso d'errore *prima* della migrazione) e Flutter da M0. Init **deferred/lazy** + sampling (vs gate perf); **scrub PII** (mai loggare `apiKey`/`fcmTokens`/posizione/metadati audio — vs sicurezza).
2. **Error handling uniforme** — portare "surface `err.message`" come pattern Dart unico (helper SnackBar/Dialog), MA distinguere "errore azionabile dall'utente" da "`permission-denied` = bug nostro": **mai** mostrare "Missing or insufficient permissions" a un utente di paese.
3. **Contratto loading/vuoto/errore per pagina** — `AsyncValue.when(data/loading/error)` è una superficie a 3 stati nuova: definirla **una volta** in Fase 0 (skeleton vs spinner, copy empty-state, error+retry) o le 13 pagine di Fase 2 la reinventano.
4. **i18n come hook ORA** — è il gemello *esatto* dell'argomento che la Parte I ha fatto per i colori (tokenizzare alla migrazione = costo marginale; retrofit dopo = sweep): estrarre le stringhe IT in `l10n`/ARB adesso, anche solo IT. Omissione più netta *secondo la logica del piano stesso*.
5. **Onboarding / primo avvio (mobile net-new)** — OS-permission priming (cam/GPS/mic/notifiche), schermata Guest `pending` (oggi "shell vuota" = app rotta su un telefono appena installato), **deep-link notifica→lobby** (Universal/App Links, config di piattaforma), **back hardware Android** sui router annidati e modali (`PopScope` o l'app si chiude).
6. **CI/CD 🔴** — oggi il workflow GitHub Actions **non ha step di test** (nemmeno per React). I "Fatto" del piano ("build verdi, 74 test verdi") richiedono una pipeline (emulator+JDK21+Flutter+chromedriver+android-emulator) **mai budgetata**; un gate manuale è esso stesso rischio (umano dimentica / HEAD sbagliato). Più: superficie-segreti mobile (`google-services.json`/`plist`, SHA-1/256, **APNs .p8**, **Android upload keystore** — perderlo = impossibile aggiornare l'app). CI è load-bearing da M0.
7. **A11y parità** — HTML dà la semantica gratis; Flutter no (`GestureDetector` ≠ bottone senza `Semantics`). Le primitive `ui/*` hanno ARIA oggi (`role="switch"`, `aria-describedby`, focus-ring) → i loro equivalenti Flutter **regrediscono** l'accessibilità senza wrapper `Semantics`. + screen-reader mobile, text-scaling, contrasto del dark-flame.
8. **Memoria del progetto** — `CLAUDE.md` (gitignored) + `public/docs/*` descrivono l'app **React**: il codice Flutter ha bisogno del proprio `CLAUDE.md` vivo (la matrice Sporche-Dart ne è il seme) e le `Istruzioni` in-app vanno **revisionate nel contenuto**, non solo nel rendering.
9. **Performance — gate con owner + per-PR + device floor** — i gate della Parte I sono manuali e ancorati a M4 (fine): su 23 pagine parallele il budget driffa a pagina 14. Servono budget **per-PR automatico** (fail-build se il chunk iniziale supera soglia gz), un **owner**, e una **decisione sulla fascia di device minima** (vedi §D: il valore "leggero su cellulari vecchi" è *invertito* dalla migrazione). + gate **batteria/termico** per sessioni AR/GPS sostenute; visualizer in pausa in background (`RepaintBoundary`); **cap risoluzione immagini** all'upload + thumbnail + `cacheWidth` (CanvasKit = texture GPU → OOM su telefoni vecchi).
10. **Segreti chiave Gemini** — `users/{uid}.apiKey` è leggibile da `isAdminOrRoot()` (chiave a pagamento in chiaro per gli admin); su mobile niente `localStorage` → `flutter_secure_storage` (Keychain/Keystore) + decisione (resta su Firestore o solo locale?).
11. **FCM token duplicati** durante il parallel-backend (SW web + nativo si accumulano in `fcmTokens[]`) → notifiche duplicate; pruning solo su send-failure; token web stale dopo il cutover.
12. **FCM e Storage fuori dalla rete di test** — il gate gira `--only firestore,auth,functions` (**manca storage**); il push FCM end-to-end **non è emulabile** → checklist device **manuale** dichiarata come copertura non-automatica.
13. **Staleness del write-shape fixture** — React resta hot-fixabile durante la migrazione: il contratto catturato "una volta" driffa → **freeze documentato** delle write-shape React, o re-capture.

---

## D. Tensioni fra dimensioni — risolte

| Tensione | Risoluzione |
|---|---|
| Modelli immutabili strict (arch) ↔ resilienza in lettura su dati storici (integratore) | **Deserializzazione difensiva obbligatoria** (default/null-coalescing/mai `as int` nudo); l'immutabilità resta, la strictness in lettura no. |
| `StatefulShellRoute.indexedStack` preserva stato (arch §2.3) ↔ 11 branch vivi = RAM/OOM su low-end (perf) | `indexedStack` **solo per i 2-3 branch dove lo stato conta**; lazy/dispose per gli altri. |
| Observability (qa) ↔ peso bundle + no-tracking/privacy (perf+sicurezza) | `firebase_crashlytics` **deferred/lazy** + sampling; **scrub PII** come invariante; crash-only con **decisione di consenso** esplicita (non aggiunta silenziosa). |
| Hot-path server-validato (sicurezza: CF→await→transaction) ↔ "fluido" su 4G | Accettato e **dichiarato**: l'happy-path è più lento del legacy ma corretto; il fallback resta. |
| Vie di fuga in layer `escape/` (arch §B) ↔ dentro-feature (audio/coda Fase B) | **Layer condiviso** per le vie di fuga **cross-consumatore** (audio, storage, signaling); **dentro-feature** per quelle mono-consumatore (orientation). Criterio: numero di consumatori, non stile. |
| "Backend invariato" (piano) ↔ cancellazione account richiede CF+rule nuove (GDPR/store) | Riscritto: *"invariato **tranne** la pipeline di erasure isolata"* (§A4), prima della submission mobile. |
| Provenienza "chi ha scritto il doc" ↔ ogni campo extra rompe `affectedKeys.hasOnly` | **Buco accettato e dichiarato**: non si aggiunge `writtenBy` senza toccare le rule; si gestisce con freeze shape + observability. |

---

## E. Priorità

1. **Precondizioni A1-A4** (rules canoniche, isolamento dati, storage rules, pipeline erasure) — sbloccano tutto il resto.
2. **Observability su entrambi i client + CI** — da M0 (baseline prima della migrazione).
3. **Trasversali a costo-marginale-zero-alla-migrazione** in Fase 0: i18n hook, contratto errori/loading, `Semantics` nelle primitive, deserializzazione difensiva, token/tema. (Fatti dopo = sweep.)
4. **Decisione fascia device minima** + force-update/min-version gate prima della submission store.
5. Il resto (analytics, polish onboarding) è **additivo**, per fase.

---

## F. Annessi di approfondimento (Fase B, per dimensione)

Il dettaglio production-ready di ogni dimensione vive negli annessi (fondati su codice/doc reali):

- `PLAN_ANNEX_sicurezza.md` — **Matrice delle 30 Sporche (+#31) per la migrazione**: per ogni vettore, la shape Dart load-bearing perché la mitigazione regga (forme [VALID]/[DIFF]/[PIN]/[INT]/[NEST]/[TS]/[CAP]/[ONEWAY]/[CF]).
- `PLAN_ANNEX_audio-coda-p2p.md` — preservazione elegante di coda dinamica ("patto a 3" → 4° sito Dart), P2P WebRTC, IndexedDB, AudioEngine.
- `PLAN_ANNEX_architettura.md` · `PLAN_ANNEX_performance.md` · `PLAN_ANNEX_frontend-design.md` (incl. base-default neutro pronto per la cartella design) · `PLAN_ANNEX_test-antiregressione.md` · `PLAN_ANNEX_pulizia-refactoring.md`.
- Dossier sorgentato completo: `PLAN_DOSSIER_corpus.md`.

> **Cartella design**: ancora attesa da Neo → si innesta in `PLAN_ANNEX_frontend-design.md` (predisposto come base-default parametrizzabile su `TenantConfig`).
