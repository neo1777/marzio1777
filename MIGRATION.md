# MIGRATION — Marzio1777

## Fase 2 — Quiz Auto-Generators

**Stato MVP (Maggio 2026):** il Quiz del Bivacco è funzionante con
creazione round manuale. L'host compone domanda + 4 opzioni + corretta
tramite il wizard 4-step in `QuizHostCreateRound.tsx`. Tempo medio
target: < 30 secondi per round.

**Architettura pluggable già in place:**
- `/src/utils/quizGenerators.ts` contiene il `Record<QuestionType, QuestionGenerator>`
  con tutti e 5 i type registrati (`guess_who`, `guess_year`, `guess_place`,
  `guess_caption`, `chronology`). Tutti ritornano `null` per ora.
- Il documento `quizRounds/{roundId}` ha già il campo `sourcePostId: string | null`
  pronto a ricevere sia la selezione manuale dell'host (MVP) sia l'output
  automatico del generator (Fase 2).
- `isAutoGenerationAvailable(type)` ritorna sempre `false` in MVP.

**Steps per implementare la Fase 2 (zero migration richiesta):**

1. Sostituire il body di ogni generator in `quizGenerators.ts`:
   - `guess_who`: estrai `taggedPeople[]` o `authorName` dal post sorgente,
     pesca 3 distrattori da `poolPosts` filtrando per persone diverse.
   - `guess_year`: usa `decade` dal post, distrattori sono altri 3 decenni
     con range ±20 anni.
   - `guess_place`: reverse-geocode `location` (richiede API esterna o
     cache lato Firestore); distrattori sono località vicine ma diverse.
   - `guess_caption`: usa `caption` reale, distrattori sono caption di
     altri 3 post + leggera permutazione semantica.
   - `chronology`: pesca 4 post da decadi diverse, output è la sequenza
     ordinata corretta.

2. Aggiornare `isAutoGenerationAvailable()` per leggere quali generators
   sono effettivamente implementati (es. set di type abilitati o probe
   con post di test).

3. Verificare che `QuizHostCreateRound.tsx` mostri il badge verde
   "Auto disponibile" + pulsante "Genera" sui type che ritornano true.
   La UI è già pronta per riceverlo, NON va modificata.

4. (Opzionale) Cloud Function `validateQuizScore` per chiudere la
   limitazione corrente sul decay scoring server-side.

**Schema dati:** invariato. Nessun campo aggiunto, nessuna migration
Firestore necessaria. La transizione avviene live, on the fly, senza
downtime e senza touch dei round già giocati.

## Fase 2 — Cloud Functions correlate

- `validateCaptureDistance(eventId, itemId, playerLat, playerLng)`
  → chiude la "Sporca #14: The Teleporter" tramite Haversine server-side.
  I campi `collectedAtLat/Lng` sono già scritti dal client.
- `cleanupStuckEvents()` → cron giornaliero che transita gli eventi
  `active` da > 24h a `aborted`.
- `notifyKickoff(eventId)` → FCM 30 minuti pre-kickoff e all'apertura
  della lobby.

## Fase 3 — Estensione Concept

Architettura `game_events` agnostica per `type`. Per aggiungere un
Concept C/D/E:
1. Estendi il type union in `types.ts`.
2. Aggiungi una sub-config (es. `gymkanaConfig: GymkanaConfig | null`).
3. Crea il componente di play dedicato e routa via `GamePlayRouter`.
4. Estendi le rule Firestore con il match block del nuovo type.

Nessuna modifica al sistema RBAC, ai punti, al leaderboard o agli
inviti. Riusi tutto.
