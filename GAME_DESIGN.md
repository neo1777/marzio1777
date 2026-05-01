# Game Design Document: Eventi Interattivi & Caccia al Tesoro (Concept A)

## 1. Architettura di Base: Sistema di Eventi (Condiviso)
Per supportare sia il Concept A (Caccia al tesoro/oggetti su mappa) che il futuro Concept B, il sistema di base deve gestire il ciclo di vita di una "Sessione di Gioco".

**Collezione Firestore: `game_events`**
- `id`: Identificativo univoco
- `type`: Tipo di gioco (es. `treasure_hunt`, `concept_b`)
- `status`: `draft` (bozza) | `scheduled` (programmato) | `active` (in corso) | `completed` (finito)
- `organizerId`: ID dell'Admin creatore
- `startTime`: Data e ora di inizio previsto
- `endTime`: Data e ora di fine spaziale (opzionale/manuale)
- `participants`: Sotto-collezione o tracking degli utenti invitati e il loro stato (`invited`, `joined`, `declined`).

## 2. Configurazione Backend ("Dashboard Admin")
L'organizzatore avrà un pannello dedicato alla creazione dell'evento dove definire:
- **Titolo e Descrizione:** (Es. "La Grande Caccia alla Birra di Ferragosto").
- **Modalità Oggetti:**
  - *Post Legacy:* Spawna vecchie memorie pubbliche estratte casualmente o scelte a mano sulla mappa.
  - *Custom:* Permette di scegliere emoticon, nomi e punteggi (es: 🍺 Birra = 10pt, 🍄 Funghetto = 5pt, 🍃 Foglia = 1pt).
- **Livello / Distanza di Raggio:** Quanti metri di raggio dal centro del paese in cui gli oggetti possono spawnare (se generati automaticamente) oppure piazzamento manuale sulla mappa cliccando col dito (modalità "Piazzamento Tattico").
- **Raggio di Raccolta:** Quanto vicino (in metri) il GPS del giocatore deve essere all'oggetto per poterlo catturare (es. 10m).

## 3. Gameplay: "La Caccia" (Concept A)
1. **Attesa e Ingresso:** I giocatori accettano l'invito. Prima dell'orario di inizio vedono un conto alla rovescia.
2. **Inizio:** L'Admin preme "Inizia Gioco" (oppure scatta l'ora "X").
3. **Mappa Attiva:** Su "La Mappa", i giocatori vedono la propria icona pulsante e le posizioni degli "Oggetti" non ancora raccolti. Non vedono la posizione degli avversari (o la vedono? Da decidere).
4. **La Raccolta (Intervento Fotocamera/AR):** 
   - Quando il giocatore entra nel *Raggio di Raccolta* dell'oggetto, appare un pulsante "Cattura!".
   - Cliccando, si apre un layer (WebAR o semplice overlay videocamera del browser) in cui l'utente deve "visualizzare" e tappare l'oggetto virtuale in sovraimpressione per confermare la cattura.
5. **Classifica in Tempo Reale:** In cima alla mappa c'è una "Leaderboard" (es. Mario 30pt, Luigi 15pt).
6. **Conclusione:** Il gioco finisce quando tutti gli oggetti sono raccolti, oppure quando l'organizzatore decide di terminare la sessione.

## 4. Strutture Dati Aggiuntive (Solo Treasure Hunt)
**Collezione: `game_events/{eventId}/items`**
- `id`: ID oggetto
- `lat` / `lng`: Coordinate precise
- `icon` / `theme`: (es. "🍺")
- `points`: Valore dell'oggetto
- `status`: `spawned` | `collected`
- `collectedBy`: ID utente che lo ha preso
- `collectedAt`: Timestamp della raccolta

## 5. Sicurezza e Regole Firebase
Le collection saranno protette tramite Security Rules in modo che:
- Solo gli `Admin` possano creare `game_events` e inserire `items`.
- I giocatori possano solo leggere gli `items` e lanciare l'evento di update su uno specifico item passando il proprio `uid` per rivendicarlo (tramite zero-trust: "puoi raccogliere l'item solo se `status == spawned`" prevenendo race conditions se due giocatori sono vicini allo stesso momento).
