# docs/ — Indice e stato di lettura (marzio1777)

> Mappa dei documenti del repo, ordinati per tema e **attualità**. Serve a sapere *cosa leggere*
> e *cosa è ancora valido*. Aggiornato: **2026-06-30**.
>
> **Legenda attualità:**
> 🟢 **ATTUALE / autoritativo** — è lo stato corrente, leggi questo.
> 🟡 **RIFERIMENTO da verificare** — vero all'origine, ma con drift possibili → conferma sul codice.
> ⚪ **STORICO / supporto** — superato o materiale di appoggio, non fonte di decisioni.

---

## 🟢 1-piano-flutter-ATTUALE/ — il piano di migrazione a Flutter (29–30 giu)

È il risultato della verifica profonda (flusso palantir1777→setaccio→spiegazione-tecnica→agora1777).
**Tutto qui è attuale.** Ordine di lettura consigliato:

| # | File | Cos'è | Priorità |
|---|---|---|---|
| 1 | `DECISIONE_ordine_generalizzare_vs_migrare.md` | *Perché* migrare prima (restando su Firestore) invece di generalizzare | leggi 1° (contesto) |
| 2 | `FLUTTER_MIGRATION_PLAN_CONCILIO.md` | **Parte II** — precondizioni bloccanti, revisioni fasi, trasversali, tensioni | **leggi 2° (il più importante)** |
| 3 | `FLUTTER_MIGRATION_PLAN.md` | **Parte I** — fasi §1-§7, mappatura moduli, backend/test/deploy | leggi 3° |
| 4 | `PLAN_ANNEX_sicurezza.md` | Matrice delle 30 "Sporche" → shape Dart da rispettare | annesso (sicurezza) |
| 5 | `PLAN_ANNEX_audio-coda-p2p.md` | Preservazione coda "patto a 3" + P2P + IndexedDB | annesso (audio) |
| 6 | `PLAN_ANNEX_{architettura,performance,frontend-design,test-antiregressione,pulizia-refactoring}.md` | Approfondimenti per dimensione | annessi |
| 7 | `FLUTTER_SPIKE_FINDINGS.md` | Esiti dello spike di fattibilità (web+mobile ok, desktop) | riferimento |
| 8 | `PLAN_DOSSIER_corpus.md` | Dossier sorgentato: i fatti estratti dalle spec originali | fonte grezza |

> Nota: i file di questa cartella si citano a vicenda per nome semplice → i link fra loro
> restano validi perché sono nella stessa cartella.

🎨 **`design-system-N1777/`** — il **design di Neo** (N1777 Design System) integrato nel piano (30 giu): `00-INTEGRAZIONE.md` (autoritativo: token→Flutter, tipografia Fraunces/Archivo/JetBrains, componenti, decisione identità Marzio) + `tokens/colors_and_type.css` (fonte di verità) + `flutter-ref/` (Dart di riferimento da allineare) + `previews/` (PNG). 🟢 attuale.

## 2-processo/
- `PALANTIR_FLUSSO_migrazione-deep.md` — stato del flusso di verifica (a che punto è, cosa è fatto). Utile per riprendere il lavoro.

## 🟡 3-spec-originali/ — le spec tecniche originali (mag) — *verifica vs codice*
- `AINULINDALE_TECHNICAL_SPEC.md` — blueprint del modulo audio. Ancora **il riferimento** per coda/P2P/engine, ma i suoi fatti sono già stati estratti e verificati nel dossier + `PLAN_ANNEX_audio-coda-p2p.md`. Leggi l'annesso prima; questo per i dettagli.
- `MIGRATION.md` — doc di transizione interna Fase 1→2/2.5 dell'app React. Parzialmente **storico**: dichiara Fase 2 fatta; usalo per capire *cosa era pianificato*, non come stato attuale.
- `firebase-blueprint.json` — schema completo delle 22 entità Firestore + i path. 🟡 riferimento del **modello dati** (non importato dal codice; spostato qui dalla radice).

## ⚪ 4-ricerca/ — supporto concettuale generico
- `ricerca_migrazione_raw.md` e `Mappatura Porting Codice Dart_Flutter vs JS.md` — report generato (Gemini) sulle tecniche di porting React/Vue→Flutter (signals, Flame, Rust/WASM). **Non specifico di marzio, in parte enfatico/impreciso** (il concilio l'ha marcato): repertorio di idee, non fonte di decisioni.

## ⚪ 5-storico/
- `AUDIT_REPORT.md` — audit interno di maggio. **Superato** dai batch B1–B8 e dallo stato corrente; tenuto come storico.

## 6-trascrizioni/
- `2026-06-30-...txt` — export della sessione di lavoro (Claude Code). Materiale grezzo.

---

## Restati in radice (di proposito)

**File software / config** (non doc): `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`, `eslint.config.js`, `index.html`, `metadata.json`, `.env*`, `.gitignore`,
`firebase.json`, `.firebaserc`, `firestore.rules` (+ i 2 `*.test.ts`), `firestore.indexes.json`,
`firebase-blueprint.json` (schema dati, sta coi file firebase), `firestore-debug.log` (log rigenerabile).

**Convenzione** (devono stare in radice): `README.md` (entry-point GitHub), `LICENSE`,
`CLAUDE.md` (guida operativa letta da Claude Code dalla radice).

## Altrove nel repo (non toccati)
- `public/docs/` — le spec **servite in-app** dell'app React attuale (TECHNICAL_DOCS, GAMING_SYSTEM,
  security_spec, README, STATO_PROGETTO, in IT/EN). Sono la fonte da cui il dossier ha estratto i fatti;
  restano lì perché caricate a runtime dall'app. 🟡 riferimento da verificare vs codice.

## Nota sui link interni
Alcuni doc *fuori* dalla cartella 1 (es. il brief §3, spostato ma non riscritto) possono citare
percorsi della vecchia radice: i file esistono, sono solo in `docs/…` ora. La mappa autoritativa
di *dove sta cosa* è **questo indice**.
