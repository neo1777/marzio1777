# marzio1777 — Generalizzare o migrare prima? (memo decisionale, 2026-06-29)

> Analisi comparata dei due cantieri (generalizzazione multi-comunità su React+Firebase **vs** migrazione a Flutter), basata sul codice reale del repo e sui due brief. Scopo: decidere **l'ordine**. L'output è una raccomandazione, non un piano esecutivo (quello lo produce `/ultraplan`).

## Il fatto centrale: un solo artefatto condiviso, ed è il più pericoloso

Entrambi i cantieri ruotano attorno **allo stesso oggetto load-bearing: il modello dei permessi**.
- `firestore.rules` = **616 righe**, 24 match block, 80 `allow`, 12 validatori; `isRoot()` è **inchiodato a un'email** (`firestore.rules:15` e `AuthContext.tsx:15`).
- **Zero `tenantId`** oggi: nel codice, nelle rules, nelle 7 Cloud Functions. Il multi-tenant significa filare la dimensione tenant attraverso *tutto*.
- Il modello è **già fragile**: il footgun `isValidX(incoming())` come AND globale ha rotto 3 volte gli update cross-user (approvazione/like/RSVP). E l'app è in **produzione con dati reali** (Marzio = istanza zero, non deve regredire).

Il `FLUTTER_MIGRATION_BRIEF` §8 mappa `firestore.rules → Postgres RLS` come "porting fedele", e il `GENERALIZATION_BRIEF` nota che "RLS Postgres ≈ regole per-tenant". **Tradotto: la stessa logica di isolamento, se fatta ingenuamente, la scrivi DUE volte** — una in DSL Firestore tenant-aware, una in RLS. È il lavoro più caro e più rischioso del progetto, ed è quello che il doppio rewrite raddoppia.

## Cosa costa cosa (dal codice reale)

**Generalizzazione** — hardcode diffuso: 56 occorrenze di "marzio" in 26 file + config. Effort per area:

| Area | Effort | Note |
|---|---|---|
| Centro mappa per-tenant | **S** | `[45.9238, 8.8655]` in 4 file → config |
| Config/branding (palette, metadata, nomi) | **M** | meccanico ma ampio |
| Base path / deploy multi-istanza | **L** | tocca routing/PWA/SW/404, app live |
| 7 Cloud Functions tenant-aware | **L** | cron globali da scopare per tenant |
| FCM per-tenant | **M** | token/VAPID/sw.js mono-progetto |
| Auth/ruoli per-tenant | **L** | membership (uid,tenantId,role,status) |
| **Modello dati `tenantId`** | **XL** | ~20 collezioni + backfill dati Marzio live |
| **Rules tenant-aware** | **XL** | il footgun moltiplicato; isolamento da provare |
| i18n + contenuti per-tenant | **XL** | nessuna infrastruttura, ~86 file |
| Provisioning 2ª istanza | **L** | oggi zero IaC |

⚠️ I ~98 rule-test esistenti coprono la **parità**, ma **nessuno** prova l'isolamento cross-tenant: quella matrice è tutta da scrivere.

**Migrazione Flutter** — ~15.400 LOC in `src/` (23 pagine), il rischio è concentrato nei pezzi browser-native senza equivalente 1:1:

| Modulo | Effort | Rischio |
|---|---|---|
| AudioEngine Web Audio (EQ 3 bande + analyser FFT) | **XL** | alto — nessun package Flutter cross-platform equivalente |
| L'Ainulindalë (IndexedDB, WebRTC P2P) | **XL** | alto — DSP/storage blob/web vs mobile |
| Campo dei Giochi su Flame (AR/GPS, anti-cheat) | **XL** | alto — sensori, transazioni a parità |
| 23 pagine UI Tailwind → widget | **XL** | medio — volume, parità visiva |
| AR / device orientation | **M** | medio-alto — `alpha/beta/gamma` non in sensors_plus |
| Mappe Leaflet → flutter_map | **M** | basso-medio |
| **Backend: restare Firestore (FlutterFire)** | **S** | **basso — rules/CF non si toccano: de-risca tutto** |
| **Backend: → Supabase RLS + Edge Functions** | **XL** | **alto — la voce che domina rischio ed effort** |

👉 La **decisione che precede tutto** è il backend: *restare su Firestore* rende rules+CF un non-evento; *Supabase* trasforma il modello permessi nella voce XL dominante.

## I 4 scenari

| Scenario | Effort | "Fai due volte" | Quando conviene |
|---|---|---|---|
| **1. Generalizzare-prima** (multi-tenant su Firebase) poi migrare | XL | **Alto** — riscrivi rules tenant-aware, poi le butti per RLS | 2ª comunità serve **presto** e Flutter è "someday/maybe" |
| **2. Migrare-prima** (Flutter) poi generalizzare | XL | **Medio** — tocchi RLS due volte ma nella stessa lingua (estensione, non riscrittura) | Flutter/mobile è l'obiettivo **vero** e nessuna urgenza di 2ª comunità |
| **3. Solo OSS/config** (licenza, CI, hardcode→config) | **S** | **Zero** — si riusa ovunque | **SEMPRE**, come prima mossa; basta una 2ª comunità via fork-and-configure |
| **4. Ibrido** (progetta il multi-tenant ORA in forma RLS-friendly) | L | **Basso** sul design | Entrambi i cantieri sono committati |

## Raccomandazione — a stadi, non secca

1. **SUBITO, sempre (Scenario 3):** apertura OSS + estrazione hardcode in config (base path, centro mappa, branding, metadata). Costo-doppio **zero**, rischio **zero** sulle rules, prerequisito di ogni percorso, e rende reale "una seconda istanza da configurazione".
2. **Poi, una volta (design dello Scenario 4):** progettare **una sola volta** il modello di tenancy/permessi *backend-neutral* in forma **RLS-friendly** (membership per-tenant, `tenantId` come predicato di prima classe, isolamento espresso come **casi di test**), **evitando il footgun AND-globale**. Poco costoso, altissima leva: è l'unico artefatto condiviso davvero caro.
3. **Poi si biforca sulla variabile di business:**
   - **(a)** 2ª comunità serve **prima** che Flutter sia pronto → implementa multi-tenant **su Firebase** (Scenario 1) ma **guidato dal design del punto 2**, così le rules portano *pulite* a RLS dopo (traduzione, non ridisegno).
   - **(b)** Flutter/mobile è il **target strategico** e nessuna urgenza → **non** costruire multi-tenant pieno su Firestore: **migra prima** (Scenario 2) introducendo `tenantId`+RLS direttamente su Supabase → il modello permessi è scritto multi-tenant **una volta sola**, sulla sua casa finale.

❌ **Da evitare:** multi-tenant completo su Firestore **subito seguito** da migrazione Flutter+Supabase. È il peggior doppio-lavoro: butti l'artefatto più caro e ri-litighi il footgun in una seconda lingua.

## Le 2 domande che decidono (sono di business, non di codice)

1. **Quanto presto serve una seconda comunità live?** (urgente / mesi / nessun piano concreto)
2. **Flutter + mobile è un obiettivo vero e committato, o un "someday/maybe"?**

> Default in assenza di urgenza sulla 2ª comunità e dato che Flutter+Supabase è la direzione dichiarata: **config/OSS ora → design del modello tenant una volta → generalizzare sul target di migrazione** invece di costruire il multi-tenant due volte.

---

## Aggiornamento 2026-06-29 — risposte di Neo, decisione e spike

**Risposte alle 2 domande:** (1) seconda comunità **tra diversi mesi** (nessuna urgenza); (2) Flutter **committed** — è il linguaggio di Neo (Dart) e l'attrattiva è il **multi-OS (web + mobile + desktop)**, senza rinunciare a funzionalità; domanda chiave posta: *"un'app completa in Flutter, e altro dove serve?"*.

**Decisione che ne deriva → ramo (b): migrare prima, con una svolta de-rischiante.**
- **Si RESTA su Firestore (FlutterFire)** per la migrazione, NON Supabase. Questo **annulla il problema del "rules scritte due volte"**: le 616 righe di rules + 7 CF + 74 rule-test restano intatti; la generalizzazione futura aggiungerà `tenantId` a *quelle stesse* rules **una volta sola**. Supabase resta decisione separata, futura, opzionale.
- **Architettura "Flutter core + vie di fuga"** (interfaccia Dart unica + conditional import web/native) per i moduli browser-native; logica pesante cross-platform candidabile a Rust+FFI/WASM.

**Punto 1 (config extraction) FATTO:** `src/config/tenant.ts` + 8 file ricondotti a `TENANT`, base path env-overridable. Commit `909437a` su branch `feat/tenant-config` (non pushato). Comportamento Marzio invariato.

**Punto 2 (spike Flutter) FATTO** — `~/Scrivania/marzio1777-flutter-spike/` (vedi `FINDINGS.md`). Esiti verificati: `flutter analyze` pulito, `flutter test` verde, **`build web` verde**, **`build linux` fallito** su una dep di sistema (`libasound2-dev` per flutter_soloud). Per modulo:
| Modulo | Web | Mobile | Desktop |
|---|---|---|---|
| Audio (EQ 3 bande + analyser) | ✅ reale (JS interop su Web Audio) | 🟡 FFT reale, EQ/controlli stub | 🟡 builda (ALSA ok), EQ nativo da finire |
| WebRTC P2P | ✅ compila, porting fedele | ✅/🟡 | ✅ linka su Linux (confermato) |
| AR/orientamento | 🟡 fusion manuale | 🟡 fusion manuale (no calibrazione OS) | 🔴 `camera` assente su Linux |
| Firestore (FlutterFire) | ✅ risolve e compila | ✅ | ✅ |

**Verdetto spike:** l'architettura ibrida **regge per web+mobile**; **il desktop è la gamba debole** (dep native dei plugin: ALSA per soloud, `camera` assente su Linux, webrtc nativo da confermare) — non per Flutter in sé. **L'audio è il modulo più duro** (web perfetto, nativo da completare: soloud ha EQ grafico 8-bande, non le 3 biquad shelf/peaking → niente mapping 1:1). **Restare su Firestore non dà alcun attrito.**

**Ordine operativo aggiornato:** config/OSS (in corso) → **migrazione Flutter su Firestore, web+mobile per primi, desktop come stretch** → generalizzazione dopo (`tenantId` sulle rules Firestore, una volta).

**Update post-install (2026-06-29):** dopo `apt install libasound2-dev`, **`flutter build linux --release` passa** (bundle prodotto). `flutter_webrtc` **linka su Linux** (rischio risolto). Il desktop NON è più un blocco di build: resta solo `camera` assente su Linux (AR, già con fallback) + il completamento dell'EQ audio nativo. Validazione runtime (echo WebRTC, audio nel browser) ancora da fare.
</content>
