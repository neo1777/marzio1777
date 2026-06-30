# PALANTIR_FLUSSO — Verifica & approfondimento piano migrazione marzio1777→Flutter

> Stato del flusso (il "filo lungo" di palantir1777). Lavoro lungo, multi-passaggio.
> Avviato 2026-06-30. Obiettivo: verificare e arricchire `FLUTTER_MIGRATION_PLAN.md` in OGNI
> dettaglio (profondità, sicurezza/privacy, architettura, performance, frontend, test
> anti-regressione, pulizia/refactoring), leggendo alla fonte TUTTA la doc originale, e
> sincronizzare su NotebookLM.

## Mandato (da Neo, verbatim sintetizzato)
1. Leggere DAVVERO tutta la doc tecnica originale (non i digest).
2. Preservare con eleganza coda dinamica ("patto a 3") + P2P WebRTC + IndexedDB della musica.
3. Riprodurre nel prodotto finale tutta la sicurezza/privacy della doc (30 "Sporche", zero-trust, validatori).
4. Spawnare agenti che controllino ogni dettaglio: profondità, cura tecnica, privacy, sicurezza, architettura, performance.
5. Test dettagliati funzionali + anti-regressione incrementali ad ogni step.
6. Step di pulizia/refactoring/semplificazione dopo ogni milestone, con test che tengano salda l'app.
7. Frontend: design base-default neutro (cartella in arrivo), adaptive/responsive, proporzioni, visualizzazioni, usabilità, ogni dettaglio.
8. Sincronizzare su NotebookLM.

## Il flusso (skill in ordine)
- [x] **A — setaccio** ✓ (2026-06-30): dossier 156KB, 7 temi sorgentati → `scratchpad/SETACCIO_DOSSIER.md`.
- [x] **B — spiegazione-tecnica + verifica multi-agente** ✓ (2026-06-30): 7 dimensioni, 164KB di gap+sezioni → `scratchpad/FASE_B_ARRICCHIMENTI.md`. Sicurezza ha trovato 8 gap reali (int/double, FieldPath vs 'a.b', fallback CF block-vs-fallback, serverTimestamp, drift deploy).
- [ ] **C — agora1777**: concilio di completezza.
- [ ] **D — integrazione** nel piano.
- [ ] **E — sync NotebookLM** (notebook dedicato).

## Stato corrente
- Fase: **C (concilio di completezza)** in avvio.
- Repo: `~/Scrivania/marzio1777-main`, branch `autoplan/flutter-migration`.
- Piano base già committato: `FLUTTER_MIGRATION_PLAN.md` (`56758c2`) — da arricchire.

## Artefatti prodotti
- (in aggiornamento)

## Bivi aperti
- **Cartella design**: Neo la passerà → innesto in B/D. Per ora: base-default neutro.
- NB: notebook dedicato nuovo vs esistente "Ultraplan"/"Flutter Flame" → da decidere in E.

## Provenienza
- Marca ogni fatto: [doc]/[codice]/[transcript]/[inferenza]. Niente castelli su riferimenti non risolti.
