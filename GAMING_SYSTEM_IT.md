# 🎯 Il Campo dei Giochi — Sistema Gioco, Punti & Entertainment di Marzio1777

*Documento dedicato al modulo gaming dell'app. Mix tra il tono narrativo del README, il rigore tecnico della Documentazione Sviluppatori, e la postura paranoica delle Specifiche di Sicurezza. Ultima revisione: Maggio 2026.*

---

## Sommario

1. [Filosofia & Visione](#1-filosofia--visione)
2. [L'Ecosistema dei Punti Altitudine](#2-lecosistema-dei-punti-altitudine)
3. [Architettura Comune degli Eventi](#3-architettura-comune-degli-eventi)
4. [Concept A — La Caccia ai Ricordi](#4-concept-a--la-caccia-ai-ricordi)
5. [Concept B — Il Quiz del Bivacco](#5-concept-b--il-quiz-del-bivacco)
6. [Il Layer di Realtà Aumentata](#6-il-layer-di-realtà-aumentata)
7. [Sicurezza, Anti-Cheat & Le Sporche del Gioco](#7-sicurezza-anti-cheat--le-sporche-del-gioco)
8. [UX & Accessibilità](#8-ux--accessibilità)
9. [Performance & Batteria](#9-performance--batteria)
10. [Roadmap & Concept Futuri](#10-roadmap--concept-futuri)
11. [Integrazione con L'Ainulindalë](#11-integrazione-con-lainulindale)

---

## 1. Filosofia & Visione

Marzio1777 nasce come Piazza Comunale digitale. Il Campo dei Giochi è il suo cortile: lo spazio dove la comunità si dà appuntamento per giocare insieme, fisicamente o virtualmente, sfruttando l'archivio di ricordi che già esiste e trasformandolo in carburante per nuove esperienze condivise.

I principi sono tre, e ad essi ci atteniamo religiosamente quando scegliamo cosa includere e cosa lasciare fuori:

**Principio 1 — Riuso, non Reinvenzione.** Tutto ciò che è già nell'app (archivio post, sistema punti, eventi del Bivacco, mappa, RSVP, ruoli RBAC, particelle dei like) viene riusato come carburante per il modulo giochi. Non costruiamo economie parallele, non duplichiamo flussi RSVP, non introduciamo nuove librerie pesanti. La filosofia "Zero-Dipendenze-Nuove" è un vincolo di design esplicito: il modulo gaming aggiunge ~30KB al bundle finale, tutto codice React + utility TypeScript pure. Lo stesso vincolo è stato mantenuto rigorosamente anche con l'arrivo di L'Ainulindalë (modulo audio): zero dipendenze npm aggiunte, +40KB di bundle. Totale post-MVP: ~70KB.

**Principio 2 — Marzio prima di tutto.** Questo non è un MMO. Non è un gioco competitivo per gamer professionisti. È un'app di paese, privata, whitelisted, dove i marziesi e i villeggianti si divertono insieme. Le scelte tecniche riflettono questa scala: tolleranza alta verso il cheating non automatizzato (se Mario gioca dal divano fingendo di essere fuori, lo si scopre alla pizzata successiva), filtri tematici inesistenti (l'admin può chiamare la caccia "Modalità Amsterdam" e popolarla di emoji 🍁 senza problemi), enfasi sull'esperienza sociale piuttosto che sulla precisione chirurgica.

**Principio 3 — A è Outdoor, B è Indoor; entrambi sono Marzio.** I due Concept sono complementari, non ridondanti. La Caccia (A) ti fa uscire fisicamente per le strade del paese, ti fa correre, ti fa interagire col territorio. Il Quiz (B) ti fa giocare seduti, dal divano, in pizzeria, anche a distanza. Stessi utenti, stesso archivio, stessa Altitudine, due esperienze distinte. Un giocatore può eccellere in uno solo dei due e raggiungere comunque il Sindaco di Marzio.

---

## 2. L'Ecosistema dei Punti Altitudine

I Punti Altitudine erano già il motore di gamification dell'app prima del Campo dei Giochi: si guadagnavano caricando foto, commentando, vincendo a Indovina Chi/Indovina l'Anno nel Cinematografo. Con il modulo giochi questa economia si arricchisce ma **non si frammenta**. Con l'arrivo di L'Ainulindalë, lo stesso principio viene applicato all'audio: nessuna economia musicale parallela, ogni Tema suonato in una Sessione del Coro alimenta la stessa scala di Altitudine.

### 2.1 Le sorgenti dei Punti

| Azione | Range Punti | Frequenza | Note |
|---|---|---|---|
| Caricare un post (Il Baule) | +5 a +20 | Per upload | Bonus se include geotag |
| Commentare un post | +1 | Per commento | Cap giornaliero soft |
| Indovinare a Indovina Chi (Cinematografo) | +5 / -2 | Per round | Single-player invariato |
| Indovinare a Indovina l'Anno (Cinematografo) | +5 / -2 | Per round | Single-player invariato |
| **Catturare un item (Concept A)** | +1 a +1000 | Per cattura | × moltiplicatore evento |
| **Risposta corretta nel Quiz (Concept B)** | +1 a +20 | Per round | × moltiplicatore evento, modalità decay |
| **Bonus di completamento evento** | +50 | Una tantum | Per chi finisce in classifica |
| **Tema suonato in Sessione del Coro (L'Ainulindalë)** | +2 | Per Tema played | × moltiplicatore se sessione linked a game_event |
| **Bonus DJ per sessione completata (≥30 min)** | +10 | Una tantum | Solo per il Conduttore |

### 2.2 Il Moltiplicatore Evento

Ogni `game_event` ha un campo `pointsMultiplier` configurabile dall'organizzatore in range 0.5–5.0 (default 1.0). Si applica al guadagno dei punti del singolo evento prima che questi confluiscano nei Punti Altitudine globali dell'utente.

Esempio: caccia di Ferragosto con moltiplicatore 2.0. Mario cattura una birra rara da 50pt. Il leaderboard dell'evento riceve +50pt (per mostrare la dinamica del round), ma il `users/{mario}.points` riceve +100pt (50 × 2.0).

**Estensione audio:** una `audio_sessions` può essere linked a un `game_event` attivo (campo `linkedGameEventId`). In quel caso, ogni Tema suonato eredita il moltiplicatore: durante un evento Ferragosto 2x, il proposer di un Tema played riceve +4 invece di +2. Una Sessione del Coro standalone (senza link) usa il moltiplicatore 1.0 di default.

**Regola d'oro:** il moltiplicatore si applica solo al guadagno, mai a sottrazione. Non esistono "giochi negativi" che sottraggono Altitudine. Questa è una scelta di policy esplicita: l'Altitudine è una scala monotona crescente, non un saldo bancario.

### 2.3 I Gagliardetti & i Titoli

I Punti Altitudine sbloccano i Gagliardetti del Profilo. La lista esistente (Il Villeggiante, Il Turista Esperto, Il Sindaco di Marzio) è estesa con titoli "tematici" sbloccabili dalle attività di gioco e di canto:

**Gagliardetti del Campo dei Giochi:**
- **Il Cacciatore di Ricordi** — completa 10 cacce con almeno una cattura
- **Il Cacciatore Esperto** — totalizza 1000 punti cumulativi da cacce
- **Il Veggente** — 50 risposte corrette consecutive nel Quiz
- **La Memoria di Ferro** — 100 risposte corrette totali nel Quiz
- **Il Sindaco del Quiz** — vincitore di 5 eventi Quiz
- **Il Pellegrino delle Polaroid** — completa 3 cacce in modalità Post Legacy
- **L'Ospite Perfetto** — 10 sessioni come Host del Quiz senza disconnessioni

**Gagliardetti de L'Ainulindalë:**
- **Il Cantore** — 50 Temi proposti totali
- **Il Sub-Creatore** — 25 Temi proposti effettivamente played dal DJ
- **Il Conduttore** — 5 sessioni aperte come DJ
- **Il Maestro del Coro** — 20 sessioni come DJ portate a termine (≥30 min)
- **Le Voci di Ilúvatar** — 10 sessioni partecipate come listener
- **Il Discordante** — 5 Temi skippati consecutivi (gagliardetto goliardico, "ti voglio bene lo stesso")

I gagliardetti sono **descrittivi, non punitivi**: non si possono perdere, si conquistano e basta. Coerente con la filosofia di un'Altitudine che cresce.

### 2.4 Snapshot Storici

A fine evento, viene scritto un campo immutabile **embedded** sul documento evento — non più una sub-collection separata come nel piano iniziale. Per i `game_events`: array `finalLeaderboard` direttamente sul doc parent. Per le `audio_sessions`: oggetto `finalStats` direttamente sul doc parent (totalDurationMs, totalTracksPlayed, participantsCount, topProposers).

Questi campi non sono mai più modificati, neanche dal Root. La rule garantisce immutabilità con la clausola: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))` per i giochi (analoga per status `'closed'` e `finalStats` per le sessioni audio). Diventano la base storica per:

- L'Archivio del Campo dei Giochi e delle Sessioni del Coro (consultabile a vita)
- I gagliardetti pesati (es. "Sindaco del Quiz" si aggiorna leggendo la storia delle classifiche finali; "Il Maestro del Coro" leggendo `finalStats.totalDurationMs ≥ 1800000`)
- Le statistiche aggregate sul profilo utente (es. "Hai vinto 3 cacce nel 2026", "Hai condotto 12 cori nel 2026")

---

## 3. Architettura Comune degli Eventi

I due Concept di gioco condividono il 100% dell'infrastruttura eventi. La collezione root è `game_events`, e cambia solo la configurazione type-specific al suo interno. L'Ainulindalë usa una collezione parallela `audio_sessions` con architettura analoga (vedi §11).

### 3.1 Ciclo di vita

```
[draft] → [scheduled] → [lobby] → [active] → [completed]
                                      ↓
                                  [aborted]
```

- **draft** — l'admin sta configurando, evento invisibile
- **scheduled** — pubblicato, inviti partiti, conto alla rovescia attivo
- **lobby** — 5 minuti pre-kickoff, sala d'attesa aperta, partecipanti si connettono, permessi richiesti
- **active** — gioco in corso, fotocamera/quiz attivi, leaderboard live
- **completed** — terminato, snapshot finale, archivio
- **aborted** — annullato (es. maltempo), nessun punto assegnato

Le transizioni sono codificate in una rule helper `validStatusTransition(old, new)` e validate server-side. Ogni cambio di stato non lecito è respinto.

### 3.2 Il sistema inviti

- **Default**: tutti gli `Admin` e `Root` sono auto-invitati (consistente col Bivacco)
- **Estendibile**: l'organizzatore può invitare anche `Guest` approvati con un tap
- **RSVP a 3 stati**: `invited` | `joined` | `declined`
- **Notifiche**: previste FCM in Fase 2 (push 30 minuti pre-kickoff e all'apertura della lobby)

### 3.3 Permessi sull'evento — Riepilogo

| Azione | Guest pending | Guest approvato | Admin | Root | Organizzatore |
|---|---|---|---|---|---|
| Vedere lista eventi | ❌ | ✅ | ✅ | ✅ | ✅ |
| Creare evento | ❌ | ❌ | ✅ | ✅ | — |
| Modificare evento | ❌ | ❌ | ❌ (solo proprio) | ✅ | ✅ |
| Cancellare evento | ❌ | ❌ | ❌ | ✅ | ✅ se `status != active` |
| Partecipare (RSVP) | ❌ | ✅ se invitato | ✅ | ✅ | ✅ |
| Forzare `start`/`end` | ❌ | ❌ | ❌ | ✅ | ✅ |
| Vedere leaderboard live | ❌ | solo se partecipante | ✅ | ✅ | ✅ |

### 3.4 Visibilità tra giocatori

Configurabile a livello evento (`visibilityOfOthers: boolean`) e overridable per singolo utente (`participants.shareLocationDuringEvent`). Default ON a livello evento; il singolo utente che vuole nascondersi ha sempre l'ultima parola. Le posizioni live sono scritte nella collezione `user_locations` esistente (split collection, PII isolato), non in `game_events`. Riusiamo il pattern già in produzione su La Mappa.

### 3.5 Il ruolo dinamico dell'Host

Esiste solo durante eventi `photo_quiz`. È l'utente che attivamente conduce il round corrente, identificato da `game_events.photoQuizConfig.currentHostId`. Per design:

- L'Host vede la risposta corretta prima degli altri (è inevitabile e accettato come parte del meta-gioco; non avere Cloud Function lo richiede)
- L'Host può ruotare automaticamente di domanda in domanda (`rotateHost: true`) o restare fisso
- La rotazione ordina i partecipanti `joined` per `userId` (immutabile, deterministico) e usa wrap-around
- Solo l'host uscente, l'organizer o il Root possono scrivere il nuovo `currentHostId` (rule via `diff().affectedKeys()`)
- **Inoltre, il nuovo `currentHostId` deve essere un partecipante con `status == 'joined'`**, validato in rule via `exists()` + `get()` sulla sub-collection participants. Questo chiude il vettore "Self-Crowning by alien-uid" (vedi §7.1, vettore #16)
- L'Organizer e il Root possono sempre intervenire come "Host di emergenza" se quello attuale si disconnette

L'UI mostra esplicitamente lo status: chi è host vede un banner rosso "L'Host visualizza la risposta corretta prima del reveal", gli altri vedono "Host: [displayName]". Trasparenza totale sul meta-gioco.

---

## 4. Concept A — La Caccia ai Ricordi

> Il Pokémon GO marziese: un treasure hunt geolocalizzato dove i giocatori girano fisicamente per le strade di Marzio col telefono in mano, e la fotocamera si attiva al raggiungimento dell'oggetto per "catturarlo" con un tocco di realtà aumentata leggera.

### 4.1 Setup di una caccia (admin)

Wizard `GameCreator` che permette 4 modalità di spawn:

**Auto-spawn per raggio.** L'admin specifica:
- Centro (lat/lng) — di default il centroide dei post pubblici, modificabile con tap sulla mappa
- Raggio in metri (es. 500m, 1km, 5km)
- Numero di oggetti da generare
- Tipologia degli oggetti

L'algoritmo di distribuzione usa **disk point picking uniforme** con jitter check di `min_separation` (default 8m, degradato automaticamente se troppo aggressivo):

```
r = R × √(random())
θ = 2π × random()
lat_offset = r × cos(θ) / 111320
lng_offset = r × sin(θ) / (111320 × cos(centro_lat))
```

**Spawn manuale (Piazzamento Tattico).** Mappa fullscreen, l'admin tap sui punti dove vuole piazzare ciascun oggetto. Per ogni tap, popover con scelta tipologia e punteggio. Drag-to-move per riallineare. Tap-and-hold per cancellare.

**Spawn ibrido.** Auto-genera N oggetti, poi entra in modalità edit per spostare/cancellare/aggiungere. Modalità consigliata di default: l'auto-generation crea la base, l'edit dà il tocco creativo.

**Spawn da archivio (Post Legacy).** Modalità narrativa: il sistema attinge dai post pubblici esistenti con `location` valorizzata, filtrabili per decennio/autore. Ogni post diventa un oggetto da "ritrovare" sulla mappa nelle sue coordinate originali. Alla cattura, il giocatore vede in AR la polaroid del ricordo con autore e didascalia. La caccia diventa così un viaggio nei luoghi della memoria del paese.

### 4.2 I 5 preset di temi

Per ridurre il time-to-event a < 30 secondi, il `GameCreator` propone 5 preset clonabili e modificabili:

- **🍺 Birra di Ferragosto** — 10pt birre comuni, 5pt boccali, 1pt sottobicchieri
- **🍄 Foraggiamento Autunnale** — 10pt porcini, 5pt finferli, 1pt foglie
- **🎃 Halloween in Paese** — zucche, fantasmi, caramelle
- **🏔️ Trekking del Monarca** — vette, sentieri, baite (punteggi alti)
- **🍁 Modalità Amsterdam** — preset goliardico per il caso d'uso "vacanza fuori porta"

I preset sono solo punti di partenza. L'admin può clonarli, rinominarli, modificare emoji/punteggi/rarità, e salvarli come template custom riutilizzabili. Filosofia "no censura aggressiva": l'app è privata, la responsabilità tematica è dell'admin organizzatore.

### 4.3 Il flusso di una caccia

**Lobby (5 min pre-kickoff).** Apertura della sala d'attesa. Mappa centrata sull'area di gioco con cerchio overlay del raggio. Conto alla rovescia animato. Lista partecipanti che si connettono in real-time. Pulsanti per concedere i permessi (geolocalizzazione, fotocamera, DeviceOrientation per iOS) — **richiesti qui** per non bloccare al kickoff. Pulsanti admin per "Anticipa l'Inizio" / "Annulla Evento".

**Kickoff.** Suono breve. Animazione "spawn" degli oggetti sulla mappa: fade-in scaglionato (`stagger: 0.05s`) per dare l'effetto "appaiono uno alla volta". Posizione del giocatore visibile come puntino pulsante. Wake lock attivato per impedire al telefono di andare in standby.

**Caccia.** Loop principale:

1. `watchPosition` con `enableHighAccuracy: true, timeout: 15000, maximumAge: 2000`
2. A ogni update GPS, calcola Haversine giocatore↔items
3. Throttle intelligente: se il movimento è < 2m, non triggerare ricalcolo (riduce drain batteria quando fermo)
4. Se distanza < `captureRadius` (default 15m), oggetto entra in stato `capturable`:
   - Pulsa sulla mappa
   - Vibrazione tattile breve `navigator.vibrate(60)` su Android
   - Pulsante flottante "📸 Cattura!" appare
5. Tap → apertura `ARCaptureLayer` (vedi §6)

**Distance feedback (Hot/Cold radar).** Barra in basso che diventa più intensa man mano che ci si avvicina all'oggetto più vicino. UX-pattern noto e amato (geocaching).

**Compass arrow.** Se il device fornisce `webkitCompassHeading` o `alpha`, freccia CSS rotate punta verso l'oggetto più vicino. Aiuta moltissimo in zone con GPS impreciso.

**End-game.** Naturale (tutti gli items collected) o manuale (admin/root preme "Termina"). Animazione finale con totale punti, rank, confetti proporzionati. Snapshot leaderboard salvato come `finalLeaderboard` embedded sul doc evento, immutabile.

### 4.4 Pattern di Rendering della Mappa

Pattern container Leaflet stabile, replicato anche da LaMappa esistente:

```jsx
<div className="flex-1 w-full relative min-h-[300px]">
  <div className="absolute inset-0">
    <MapContainer center={[lat, lng]} zoom={18} className="w-full h-full">
      <TileLayer url="..." />
      <MapController lat={lat} lng={lng} itemsCount={N} arOpen={bool} status={evtStatus} />
      {/* markers... */}
    </MapContainer>
  </div>
</div>
```

`MapController` esegue `map.invalidateSize()` con debounce 200ms su tutte le dependencies che possono modificare il layout (cambio numero items, apertura AR Layer, transizione di status dell'evento). Senza questo, Leaflet renderizza tile a quadrati e pezzi mancanti — pattern già scoperto e documentato durante l'audit di MVP.

---

## 5. Concept B — Il Quiz del Bivacco

> Photo-trivia multiplayer real-time. Si gioca seduti, dal divano, in pizzeria, durante una cena, anche a distanza. Riusa l'archivio dei post come base di domande. Estende `Indovina Chi/Indovina l'Anno` (single-player nel Cinematografo) al multiplayer sincrono.

### 5.1 I 5 tipi di domanda

| Tipo | Domanda | Origine dato |
|---|---|---|
| **Indovina Chi** | "Chi compare in questa foto?" | `post.taggedPeople[]` o `post.authorName` |
| **Indovina l'Anno** | "Di che anno è questa foto?" | `post.decade` con range ±5 anni |
| **Indovina il Luogo** | "Dove è scattata?" | `post.location` reverse-geocoded |
| **Indovina la Didascalia** | 4 didascalie possibili, qual è quella reale? | `post.caption` + 3 fake |
| **Cronologia** | 4 foto, mettile in ordine temporale | mix di `post.decade` |

Ogni tipo ha un generatore dedicato che produce `{questionText, options[4], correctIndex}` partendo da un `Post`.

### 5.2 Configurazione di un quiz (admin)

L'admin compone:
- **N rounds** (default 10, max 50)
- **Mix di tipologie** (può limitarsi a uno solo o mixare)
- **Filtro post**: tutti / solo pubblici / solo di un autore / solo di un decennio
- **Tempo per risposta** (default 20s, range 5-60s)
- **Modalità punteggio**: `fixed` (10pt corretta, 0pt sbagliata) o `decay` (corretta veloce vale più di corretta lenta)
- **Rotate Host**: true/false

### 5.3 Composizione delle domande — Wizard 4-step

In MVP, la composizione di ogni round avviene in modalità **guidata-manuale** tramite un wizard sequenziale `QuizHostCreateRound.tsx` a 4 step:

- **Step 1 — Scelta del post sorgente:** griglia dei `posts` pubblici filtrabili per decennio/autore + search box. Tap su un post lo seleziona come `sourcePostId` per il round.
- **Step 2 — Scelta tipo domanda:** 5 card una per tipo (Indovina Chi, Anno, Luogo, Didascalia, Cronologia). Ogni card mostra in MVP un badge "Manuale" — l'auto-generation è prevista in Fase 2 (vedi §5.6).
- **Step 3 — Composizione:** form testuale per la domanda + 4 opzioni + selezione della corretta via radio button. Suggerimenti contestuali in base al tipo di domanda scelto.
- **Step 4 — Recap & Lancio:** preview dei dati immessi + slider per il tempo di risposta del round (override del default evento) + pulsante prominente "🚀 Lancia Round!" che esegue la transazione di create.

Auto-save della bozza in `localStorage` con chiave `marzio1777:quiz-draft:{eventId}` per resilienza al refresh accidentale durante la composizione.

### 5.4 Architettura real-time

Pattern **host-driven** con sincronizzazione via Firestore subcollection.

1. Host preme "Lancia Round!" al termine del wizard
2. Crea `quizRounds/{roundId}` con `startedAt: serverTimestamp()`, `endsAt: startedAt + answerTime`, `sourcePostId` valorizzato
3. `correctIndex` scritto **esclusivamente** in `quizRounds/{roundId}/secret/correctness` (cassaforte)
4. Tutti i client ascoltano `quizRounds` con `onSnapshot` → renderano simultaneamente la domanda
5. Ogni player crea `answers/{userId}` (rule: solo prima di `endsAt`, una sola volta)
6. Allo scadere del timer (o quando tutti hanno risposto), Host preme "Rivela"
7. Copia di `correctIndex` dal `secret/` al doc parent + setta `revealedAt`
8. Le rule sbloccano lettura di `correctIndex` e di tutte le `answers/*`
9. Animazione: barre di distribuzione delle risposte, confetti sulla corretta, leaderboard si aggiorna
10. Loop al passo 1 finché `roundsPlayed === totalRounds` o l'host ferma

### 5.5 Decay Scoring

Formula in `utils/scoring.ts`:

```typescript
points = max(0, round(maxPoints × (1 - timeMs/maxTimeMs)))
// con floor a 1pt minimo se corretto entro il tempo
```

Il calcolo avviene lato client al momento del reveal, ma la **rule Firestore valida il risultato**: `pointsAwarded ∈ [0, maxPointsPerRound]` e, se `pointsAwarded > 0`, `selectedIndex == correctIndex`. Un cheat che cerca di assegnarsi 9999pt su risposta sbagliata viene respinto a livello DB.

### 5.6 Architettura Pluggable per i Generators Automatici

L'MVP forza la composizione manuale. Ma l'architettura è già predisposta per i generators automatici di Fase 2, senza alcuna migration di schema:

```typescript
// /src/utils/quizGenerators.ts
export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who: (post, pool) => null,      // TODO Fase 2
  guess_year: (post, pool) => null,     // TODO Fase 2
  guess_place: (post, pool) => null,    // TODO Fase 2
  guess_caption: (post, pool) => null,  // TODO Fase 2
  chronology: (post, pool) => null,     // TODO Fase 2
};

export function isAutoGenerationAvailable(type: QuestionType): boolean {
  return questionGenerators[type](null, []) !== null;
}
```

In Fase 2, sostituendo il body di ognuno con la logica di generazione automatica dal pool dei posts:
- Il wizard `QuizHostCreateRound` nello Step 2 mostra automaticamente il pulsante "🪄 Genera" per i tipi disponibili
- L'admin può scegliere "Genera" o "Componi manualmente" per ogni round
- Il campo `sourcePostId` su `quizRounds/{roundId}` è già pronto a ricevere sia la selezione manuale sia l'output automatico
- Nessuna modifica alle rule Firestore, nessun cambio di indici

### 5.7 Modalità "Quiz a distanza"

Caso d'uso esplicito: famiglia divisa, alcuni a Marzio, alcuni a casa, vogliono giocare insieme la sera della Pasqua. Il Quiz **non richiede co-presenza fisica** — è la differenza principale rispetto alla Caccia. Si suppone che i giocatori usino WhatsApp/FaceTime in parallelo per la voce, come si fa già con i giochi da tavolo a distanza. Integrazione video chat embedded (es. Daily.co) prevista come slot UI per Fase futura, non in MVP.

---

## 6. Il Layer di Realtà Aumentata

### 6.1 Decisione architetturale

Per la cattura di Concept A, abbiamo scelto un **HTML5 Camera Overlay leggero**, NON WebXR né AR.js né MindAR.

Tabella di confronto:

| Approccio | Bundle | iOS Safari (2026) | Android Chrome | Adatto al use-case? |
|---|---|---|---|---|
| **HTML5 Camera Overlay (scelto)** | ~0KB | ✅ supportato | ✅ supportato | ✅ |
| WebXR `immersive-ar` | ~50KB polyfill | ❌ non supportato | ✅ ARCore | ❌ — escluderebbe metà degli utenti iPhone |
| AR.js + AFRAME | ~3MB | ⚠️ parziale | ✅ | ⚠️ overkill per il flow "conferma cattura" |
| MindAR | ~10MB+ | ✅ | ✅ | ❌ — solo image/face tracking, non geo |

**Motivazioni:**
- iOS Safari nel 2026 non supporta WebXR `immersive-ar` (verificato), e in Italia la quota iOS dei nostri utenti è significativa
- AR.js richiede AFRAME (~700KB) + ARToolkit (~2MB) per un flow che è essenzialmente "conferma di essere arrivato sul punto"
- Il nostro AR è più "decorativo" che "tracker": non abbiamo bisogno di posizionare un oggetto 3D ancorato a coordinate reali, basta sovrapporre un emoji animato sul video stream e farlo pulsare/galleggiare

### 6.2 Stack di implementazione

```
┌─────────────────────────────────────┐
│  <video> stream da getUserMedia     │  ← layer 1 (background)
│  ┌─────────────────────────────┐    │
│  │   <motion.div>              │    │  ← layer 2 (overlay animato)
│  │       🍺                    │    │     Framer Motion + parallasse
│  └─────────────────────────────┘    │
│                                     │
│   [HUD: distanza 4m, "Tappalo!"]    │  ← layer 3 (UI)
│   [Pulsante "Annulla"]              │
└─────────────────────────────────────┘
```

**Camera stream:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
});
videoRef.current.srcObject = stream;
```

Fallback a frontale se posteriore non disponibile. Cleanup obbligatorio: `stream.getTracks().forEach(t => t.stop())` su ogni unmount, route change e `visibilitychange`. Senza questo, il LED della fotocamera resta acceso. Audit: verifica nei DevTools che dopo la chiusura del layer AR il LED si spenga in < 500ms.

**Animazione dell'oggetto:**
```typescript
<motion.div
  className="absolute text-7xl"
  animate={{
    x: [0, 30, -20, 10, 0],
    y: [0, -40, -10, -50, 0],
    rotate: [0, 15, -10, 5, 0],
  }}
  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
  onTap={onCatch}
>
  🍺
</motion.div>
```

**Parallasse via DeviceOrientation (iOS-aware):**
```typescript
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
  const state = await DeviceOrientationEvent.requestPermission();
  if (state === 'granted') {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}
```

`handleOrientation` legge `event.gamma` e `event.beta` e applica una traslazione sull'emoji (-20px..+20px). È un'illusione, non vero AR — ma per il gameplay funziona benissimo.

### 6.3 Protocollo di cattura

Al tap sull'emoji:

1. Animazione "catturato" (scale up + fade + particelle)
2. `stream.getTracks().forEach(t => t.stop())` — fotocamera spenta
3. `runTransaction` Firestore atomica (vedi §7.2)
4. Snackbar "+10pt 🍺" con count-up
5. Ritorno alla mappa, item scompare via `onSnapshot`

### 6.4 Wake Lock

Durante l'evento attivo:

```typescript
const canRequestWakeLock = 
  'wakeLock' in navigator &&
  (typeof document.featurePolicy === 'undefined' ||
   document.featurePolicy.allowsFeature('screen-wake-lock'));

if (canRequestWakeLock) {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* graceful ignore */ }
}
return () => wakeLock?.release();
```

Senza wake lock, lo schermo si spegne dopo 30s di inattività e il GPS rallenta. Critico per la Caccia. Release garantito anche su `visibilitychange` (tab in background). Il check su `featurePolicy` evita warning console in iframe (es. AI Studio preview, Stackblitz embed).

---

## 7. Sicurezza, Anti-Cheat & Le Sporche del Gioco

Filosofia: **trust but verify lite**. App di paese, comunità chiusa whitelisted. Il sistema previene gli abusi automatizzati ma non investiga sui casi umani con paranoia da banking.

### 7.1 Le 10 Sporche del Campo dei Giochi

(Per il dettaglio completo, vedi `security_spec_IT.md` §2.2. Riepilogo qui.)

13. **The Phantom Item** — partecipante che cerca di spawnare nuovi items. Bloccato.
14. **The Teleporter** — cattura senza essere nel raggio. *Limitazione MVP*: rule Firestore non può fare Haversine, audit log `collectedAtLat/Lng` + Cloud Function in Fase 2.
15. **The Phantom Host** — non-host che scrive sul `secret/correctness`. Bloccato.
16. **The Self-Crowning** — partecipante che si auto-promuove host O scrive un `currentHostId` "alieno". Bloccato: rule isola le `affectedKeys()` e verifica con `exists()` + `get()` che il successore sia un participant joined.
17. **The Score Forger** — `pointsAwarded: 9999`. Bloccato dalla rule.
18. **The Late Submitter** — risposta dopo `endsAt`. Bloccata dalla rule.
19. **The Ghost Capture** — cattura di item già collected. Risolto dalla `runTransaction`.
20. **The Speed Demon** — GPS spoofing da DevTools. Tollerato (community-level trust).
21. **The Time Bandit** — salto di stato `draft → completed`. Bloccato.
22. **The Resurrectionist** — write su `finalLeaderboard` post-completed. Bloccato dalla clausola di immutabilità sul campo embedded.

### 7.2 La Transazione Atomica di Cattura — il pezzo critico

```typescript
await runTransaction(db, async (tx) => {
  const itemRef = doc(db, `game_events/${eventId}/items/${itemId}`);
  const itemSnap = await tx.get(itemRef);
  if (!itemSnap.exists()) throw new Error('Item not found');
  if (itemSnap.data().status !== 'spawned') throw new Error('Already collected');

  tx.update(itemRef, {
    status: 'collected',
    collectedBy: currentUser.uid,
    collectedAt: serverTimestamp(),
    collectedAtLat: position.coords.latitude,
    collectedAtLng: position.coords.longitude,
  });

  const leaderboardRef = doc(db, `game_events/${eventId}/leaderboard/${currentUser.uid}`);
  tx.set(leaderboardRef, {
    userId: currentUser.uid, displayName, photoURL,
    points: increment(itemPoints),
    captures: increment(1),
  }, { merge: true });

  const userRef = doc(db, `users/${currentUser.uid}`);
  tx.update(userRef, {
    points: increment(itemPoints * eventMultiplier),
  });
});
```

Quando due giocatori sono entrambi nel raggio, Firestore fa replay automatico delle transazioni concorrenti: la prima vince, la seconda vede `status === 'collected'` e fallisce. Il giocatore "perdente" vede un errore gestito gracefully ("Troppo lento! Qualcun altro l'ha preso"). Niente double-spend. Le coordinate `collectedAtLat/Lng` permettono in Fase 2 a una Cloud Function di validare server-side la distanza Haversine `< captureRadius` chiudendo definitivamente "The Teleporter".

### 7.3 La Cassaforte del Quiz

Il `correctIndex` di un round non è MAI scritto direttamente nel doc parent prima del reveal. È salvato in una sotto-sotto-collezione `quizRounds/{roundId}/secret/correctness` accessibile solo a host triade (currentHost, organizer, Root). Al reveal, il valore viene copiato nel parent dove le rule lo rendono leggibile a tutti.

Compromesso accettato: l'host vede la risposta corretta prima degli altri. È inevitabile senza Cloud Function. Trasparenza UX: banner rosso "L'Host visualizza la risposta corretta".

### 7.4 Validazione del punteggio

La rule su `answers.update` blinda `pointsAwarded`:
- Range valido: `[0, maxPointsPerRound]`
- Se `pointsAwarded > 0`, allora `selectedIndex == correctIndex` (verificabile post-reveal perché `correctIndex` è ormai pubblico)
- Solo host triade può scriverlo

Un cheat che bypassa il client e scrive `pointsAwarded: 1000000` è respinto a livello DB.

### 7.5 Limitazioni note (e accettate)

| Limitazione | Vettore | Mitigazione attuale | Mitigazione completa |
|---|---|---|---|
| Cattura senza essere nel raggio | The Teleporter | Audit log `collectedAtLat/Lng` | Cloud Function Fase 2 |
| GPS spoofing browser desktop | The Speed Demon | Rule respinge accuracy >100m | — (community-level trust) |
| Host vede correctIndex pre-reveal | inerente al design | UX trasparente | Cloud Function Fase 2 |
| FCM notifiche pre-evento | non implementate | nessuna | Fase 2 |
| Quiz auto-generation | non implementata in MVP | composizione guidata-manuale via wizard | Fase 2 (architettura pluggable già pronta) |

Tutte le limitazioni hanno un piano di chiusura in Fase 2 (Cloud Functions + sostituzione body dei generators). Non sono buchi, sono trade-off espliciti per chiudere l'MVP.

---

## 8. UX & Accessibilità

### 8.1 Estetica integrata

Il Campo dei Giochi è una nuova "tab" che si affianca a Piazza/Bivacco/Cinematografo/Mappa/Alberone/Baule. Naming: **Il Campo dei Giochi** 🎯, icona Lucide `Gamepad2`. Con l'arrivo di L'Ainulindalë, il modulo audio si affianca come ottava tab con identità visiva propria (dark-flame, vedi `AINULINDALE_TECHNICAL_SPEC.md`).

Differenziazione visiva tra i due Concept di gioco:
- **Concept A — Caccia**: verde foresta + ambra (terra, natura, caccia)
- **Concept B — Quiz**: blu indaco + oro (notte, salotto, intelletto)

### 8.2 Riuso di pattern esistenti

| Pattern | Riuso da | Adattamento |
|---|---|---|
| Particelle alla cattura | sistema like (LaPiazza) | Stesse particelle scaglionate dall'emoji catturato |
| Count-up dei punti | Profilo Personale | Identico, `popLayout` + spring |
| Conto alla rovescia | RSVP Bivacco | Identico |
| Slideshow background | Cinematografo | Identico per Concept B |
| Card metadata reveal | Cinematografo | Identico per quiz reveal |
| Avatar stack | RSVP Bivacco | Identico per partecipanti |
| Container Leaflet stabile | LaMappa | Identico per TreasureHuntMap |

Filosofia: **zero estetica nuova senza giustificazione**. Ogni elemento deve sembrare nato con l'app, non incollato.

### 8.3 Accessibilità

- Tap target ≥56px su mobile, ≥44px su desktop (HIG/Material 3)
- Keyboard navigation completa per Concept B (Concept A è inerentemente touch/mobile)
- `aria-live="polite"` su leaderboard updates e cambi round
- `aria-label` sui pulsanti opzione quiz e di cattura
- Contrasto AAA su HUD del Concept A (testo bianco con text-shadow nero)
- Reduced motion: `prefers-reduced-motion` rispettato via `useReducedMotion()` di Framer Motion in TUTTE le animazioni del modulo
- Screen reader: il timer del quiz announce ogni 5 secondi rimanenti
- Color: nessuna informazione veicolata SOLO dal colore (es. corretta/sbagliata: anche icona ✓/✗)

### 8.4 Resilienza

- **Refresh durante una partita**: routing memorizza `eventId` nell'URL, subscriptions Firestore si ricreano automaticamente
- **Connettività intermittente**: Firestore offline persistence attiva (via `persistentLocalCache` API moderna v12+), mutate ottimistiche
- **Permessi negati**: 5 scenari coperti con UX dedicata (geolocation, camera, deviceorientation, notifiche, tutti negati)
- **Stato evento corrotto**: Root ha sempre il pulsante "Forza Fine Evento". Cloud Function `cleanupStuckEvents` in Fase 2

---

## 9. Performance & Batteria

### 9.1 Geolocation best practices 2026

```typescript
const watchOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 2000,
};
```

Throttling intelligente: se la posizione cambia di < 2m, niente ricalcolo. Cleanup obbligatorio (`clearWatch`) su unmount, route change e `visibilitychange`.

### 9.2 Camera stream lifecycle

`stream.getTracks().forEach(t => t.stop())` su ogni cleanup. Senza questo, il LED della fotocamera resta acceso. Verifica con DevTools: < 500ms al spegnimento dopo chiusura del layer.

### 9.3 Firestore listener strategy

- `onSnapshot` con `includeMetadataChanges: false`
- Detach esplicito (`unsubscribe()`) in cleanup
- Per `items` durante caccia: 1 listener sull'intera sub-collection con filtro `status == 'spawned'`, non N listener individuali
- Per `quizRounds`: query `where('roundNumber', '==', event.currentRound)`, target cambia al round successivo

### 9.4 Wake Lock

Critico per la Caccia. Senza, lo schermo si spegne dopo 30s e il GPS rallenta. Release garantito su unmount e `visibilitychange`. Wrappato in feature-policy check per evitare warning in iframe (vedi §6.4).

### 9.5 Animation throttling

Durante l'AR Layer attivo, framerate delle animazioni di sfondo ridotto. Fotocamera + animazioni fluide possono scaldare il device. `prefers-reduced-motion` sempre rispettato.

### 9.6 Bundle delta

| Aggiunta | Bundle delta |
|---|---|
| Componenti React nuovi (giochi) | ~25KB minified+gzip |
| Logica Firestore + transazioni (giochi) | ~3KB |
| Helpers Haversine, ecc. | ~1KB |
| Quiz wizard + scoring + generators (Fase 2-ready) | ~1KB extra |
| **Totale Campo dei Giochi** | **~30KB** |

L'Ainulindalë (modulo audio) aggiunge ulteriori ~40KB, portando il totale post-MVP di tutte le estensioni a **~70KB**. Importazione di librerie esterne: **zero** in nessuno dei due moduli. Decisione architetturale chiave.

### 9.7 Battery budget

Target: ≤8% drain in 15 minuti di Caccia attiva su mobile mid-range. Va verificato in field a Marzio prima del rilascio.

---

## 10. Roadmap & Concept Futuri

### 10.1 Roadmap di sviluppo (5 fasi)

**Fase 0 — Foundation.** Setup `game_events` + rule base. Hub `Il Campo dei Giochi`. RSVP flow. PermissionsGate. ✅

**Fase 1 — Concept A MVP.** Caccia base con tap su mappa (no AR Layer ancora), Hot/Cold, leaderboard live, schermata risultati. ✅

**Fase 2 — Concept A Polish.** AR Layer completo, Compass arrow, spawning automatico/ibrido/legacy_posts, wake lock, Cloud Function anti-cheat distanza. ✅ (Cloud Function rimandata a Fase 2 generale)

**Fase 3 — Concept B.** GameCreator per photo_quiz, round system, wizard manuale per composizione domande. ✅

**Fase 4 — Concept B Espansione.** Sostituzione del body dei generators automatici (architettura già predisposta), host rotativo con validazione successore (✅ rule pronta), decay scoring (✅).

**Fase 5 — Polish trasversale & Cloud Functions.** FCM notifiche, gagliardetti pesati, modalità spettatore, replay mode, Cloud Function Haversine server-side, cleanup events stuck.

### 10.2 Concept C/D futuri (idee aperte)

L'architettura `game_events` è agnostica: aggiungere un nuovo `type` non richiede migrazioni. Idee in attesa di valutazione:

- **Concept C — La Gimkana** — sequenza di tappe geolocalizzate da fare in ordine, con foto richieste o sfide ad ogni tappa. Ibrido tra Caccia (outdoor) e Quiz (sfide cognitive)
- **Concept D — Il Foto-Reportage** — evento dove ogni partecipante deve scattare e caricare entro X tempo una foto su un tema dato, gli altri votano la migliore. Estende La Piazza con dinamica competitiva
- **Concept E — Il Karaoke del Bivacco** — *Parzialmente realizzato come parte di L'Ainulindalë.* Le Sessioni del Coro permettono già di condividere musica in modalità DJ; un'estensione "karaoke" con synced lyrics e scoring vocale rimane idea aperta, dipende da feedback comunità

### 10.3 Future-proofing

- Quando iOS Safari supporterà WebXR `immersive-ar` (forse iOS 28+? indeterminato), il sistema attuale può essere **affiancato** da una modalità "AR vera" come opt-in. Solo l'`ARCaptureLayer` cambierebbe; il flow dati Firestore resta identico.
- Cloud Functions in Fase 2 chiudono le limitazioni note (Haversine server-side, notifiche, cleanup, signaling cleanup, hash check P2P). Non sono blocker per l'MVP.
- I quiz generators automatici sono già scaffoldati (registry pluggable in `quizGenerators.ts`): l'attivazione in Fase 2 non richiede migrazione schema né cambio di rule.
- Il sistema Punti Altitudine resta unico per l'app: nessun rischio di "economie parallele" che divergono nel tempo. L'Ainulindalë alimenta la stessa scala.

---

## 11. Integrazione con L'Ainulindalë

L'Ainulindalë è il modulo audio di Marzio1777, parallelo al Campo dei Giochi ma con identità propria (vedi `AINULINDALE_TECHNICAL_SPEC.md` per la specifica completa). Vale la pena documentare i punti di **integrazione** tra i due moduli, perché toccano l'economia dei punti e l'esperienza utente complessiva.

### 11.1 Linkability tra Sessioni del Coro e Game Events

Una `audio_sessions` può essere linked a un `game_events` attivo tramite il campo opzionale `linkedGameEventId`. Use case tipico: durante una caccia di Ferragosto, l'admin apre in parallelo un Coro come "soundtrack" dell'evento. Le proposte musicali eseguite durante quella sessione ereditano il moltiplicatore dell'evento di gioco (es. 2x → +4 invece di +2 al proposer).

Il link è:
- **Opzionale**: una sessione può essere standalone senza link (moltiplicatore default 1.0)
- **Immutabile dopo create**: non si cambia il link a sessione aperta
- **Read-only**: l'audio session e il game event hanno cicli di vita indipendenti — chiudere uno non chiude l'altro

### 11.2 Punti Altitudine Cumulativi

Tutti i guadagni convergono su `users.points` via `increment()` atomico:
- +N catture × moltiplicatore (Concept A)
- +N quiz corretti × moltiplicatore (Concept B)
- +2 per ogni Tema played × moltiplicatore (L'Ainulindalë, se sessione linked)
- +10 bonus DJ una tantum per sessione completata ≥30 min

Un giocatore-cantore può eccellere in tutti e tre i moduli e accumulare Altitudine più velocemente; oppure può specializzarsi solo in uno e raggiungere comunque il Sindaco di Marzio. Nessun nerf, nessun cap artificiale.

### 11.3 Gagliardetti Trasversali

I gagliardetti del Campo dei Giochi e quelli de L'Ainulindalë coesistono nel Profilo dell'utente come collezione unica. Un utente può accumulare:
- *Il Sindaco del Quiz* (5 vittorie quiz) + *Il Maestro del Coro* (20 sessioni DJ ≥30min)
- *Il Cacciatore Esperto* (1000pt da cacce) + *Il Cantore* (50 Temi proposti)
- Tutti insieme se attivissimo

L'UI del Profilo li raggruppa in due righe: "Gagliardetti del Campo" (giochi) e "Gagliardetti del Coro" (audio), per facilità di lettura.

### 11.4 UX Coerente

L'Ainulindalë segue i pattern UX del Campo dei Giochi:
- Wizard di creazione sessione (admin) analogo al GameCreator
- Lobby per le sessioni con avatar dei partecipanti che si connettono in real-time
- Permission gate identico (richiesta permessi audio in lobby, non a kickoff)
- Snapshot finale immutabile (`finalStats` su audio_sessions, come `finalLeaderboard` su game_events)
- RSVP non applicabile (le sessioni sono drop-in/drop-out), ma il pattern di partecipazione è simile

### 11.5 Differenze Strutturali

Per chiarezza, ecco cosa distingue i due moduli:

| Aspetto | Campo dei Giochi | L'Ainulindalë |
|---|---|---|
| Collezione root | `game_events` | `audio_sessions` |
| Stati | 6 (draft → completed/aborted) | 2 (open / closed) |
| Ruolo dinamico chiave | Host del Quiz (rotativo) | DJ / Conduttore (fisso) |
| Storage binario | nessuno | IndexedDB locale (Biblioteca) |
| Trasferimento P2P | no | sì (WebRTC per Temi) |
| Snapshot finale | `finalLeaderboard` array | `finalStats` object |
| Ciclo di vita evento | bounded (kickoff → end) | unbounded (open finché DJ chiude) |

I due moduli sono **complementari**, non sovrapposti. Una serata di Marzio potrebbe vedere: caccia al pomeriggio (Concept A), pizzata con quiz (Concept B), Coro come sottofondo del quiz (L'Ainulindalë linked). Tre esperienze, una sola app, un solo ecosistema di Altitudine.

---

## Riepilogo per il Lettore Frettoloso

- **Il Campo dei Giochi** è la settima destinazione di Marzio1777, con due modalità complementari di gioco: **Caccia ai Ricordi** (outdoor, AR leggero, treasure hunt) e **Quiz del Bivacco** (indoor, photo-trivia multiplayer).
- **Stack riusato al 100%**: niente nuove librerie npm. Tutto con React + Firebase + Tailwind + Framer Motion + react-leaflet + API native browser.
- **Punti Altitudine unificati**: catture, quiz e (con L'Ainulindalë) Temi musicali alimentano la stessa Altitudine globale, con moltiplicatore configurabile per evento. Le Sessioni del Coro possono essere linked a un `game_event` attivo per ereditare il moltiplicatore.
- **Sicurezza Zero-Trust estesa**: 10 nuove "Sporche" specifiche del modulo giochi (+ 7 "Sporche di Sauron" specifiche dell'audio in `security_spec_IT.md`), validazione transazionale delle catture con audit log `collectedAtLat/Lng`, cassaforte separata per `correctIndex`, ruolo dinamico Host con guardia stretta su `currentHostId` (rule + check `exists()` su nuovo successore), `finalLeaderboard` come embedded immutabile.
- **Estetica integrata**: nessun pattern visivo nuovo non giustificato, riuso massiccio dei componenti esistenti, accessibilità sistematica (reduced motion, ARIA-live, AAA contrast).
- **MVP onesto**: Cloud Functions in Fase 2 per chiudere le limitazioni note (validazione Haversine server-side, FCM notifiche, cleanup signaling, hash check P2P, generators automatici dei quiz). Le limitazioni sono documentate, non nascoste.
- **L'Ainulindalë come modulo parallelo**: stessa filosofia (zero deps, riuso pattern, Punti Altitudine unificati), specifica dedicata in `AINULINDALE_TECHNICAL_SPEC.md`, integrazione documentata in §11.

*"È un'app di paese. Il divertimento prima di tutto. Ma fatto bene."*

---

*Documento parte della tetralogia di documentazione di Marzio1777, accompagnato da `README_IT.md` (overview narrativo), `TECHNICAL_DOCS_IT.md` (architettura tecnica), `security_spec_IT.md` (matrice difensiva) e `AINULINDALE_TECHNICAL_SPEC.md` (specifica del modulo audio). Per la versione inglese vedi `GAMING_SYSTEM_EN.md`.*
