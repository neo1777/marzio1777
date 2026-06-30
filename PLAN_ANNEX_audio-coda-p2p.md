> Annesso al piano di migrazione marzio1777→Flutter (Fase B, 2026-06-30). Fondato su codice/doc reali; disciplina spiegazione-tecnica (verifica alla fonte, perché prima del come). Apre con i gap trovati nella Parte I, poi la sezione production-ready.

### Verifica del piano attuale (gap trovati)

Verificato §1 (Fase 1 rischi), §2.5 (vie di fuga), §3.4/§3.5/§3.6 (mappa moduli audio/duri/puri), §3.8 (decisioni EQ + storage), §4.4 (CF), §5.1/§5.5 (test) contro dossier + codice reale. Il piano è corretto nell'impianto (Opzione B SoLoud + interfaccia pronta a Rust+FFI, `flutter_webrtc` unica impl con split solo nel signaling, interfaccia Dart unica + conditional import per audio e storage). I gap sono di **precisione** e di **omissione di invarianti load-bearing**, non di direzione.

1. **Numeri di riga del "patto a 3" stantii (ereditati da CLAUDE.md).** Il piano (§3.6 e il blocco "Patto a 3") cita `effectiveMaxAtCreate` salvato a `useAudioQueue.ts:220` e la rule `effectiveMaxQueued` a `firestore.rules:516-520` con il confronto a `542-543`. Reale: rule `effectiveMaxQueued` a **firestore.rules:538-542**, confronto stretto a **firestore.rules:564-565**; il salvataggio con `Math.floor` è a **useAudioQueue.ts:236** (variante standalone). La CF è definita a **functions/src/index.ts:143** (il `const limit` a :164). `getMaxQueuedFor` a `useAudioQueue.ts:11` è l'unico riferimento corretto.

2. **Il piano tratta il client come UN sito; sono DUE, e disallineati fra loro.** `proposeTrack` in-hook scrive `effectiveMaxAtCreate = getMaxQueuedFor(...)` **senza** `Math.floor` (useAudioQueue.ts:121); `proposeTrackToSession` standalone scrive `Math.floor(getMaxQueuedFor(...))` (useAudioQueue.ts:236). Sono due percorsi di scrittura con trattamento diverso del cast a intero. Il piano §3.6 ("stessa formula esatta") appiattisce questa asimmetria, che è esattamente dove nasce il rischio nel porting Dart (vedi punto 3).

3. **Manca il landmine Dart-specifico numero uno: `is int` vs `double`.** In JS ogni numero è float e il Firestore Web SDK serializza i float interi (`5.0`) come interi, quindi la rule `incoming().effectiveMaxAtCreate is int` passa "gratis". In Dart il sistema di tipi distingue `int` da `double` e `cloud_firestore` serializza un `double` come double → la rule `is int` **respinge** con `Missing or insufficient permissions` silenzioso. Se `maxQueuedPerUser`/`bonusPerHundredPoints` arrivano da Firestore come `num` e finiscono in una moltiplicazione/divisione che produce un `double`, il 4° sito Dart fallisce dove React funzionava. Il piano nomina il quarto sito ma non questo meccanismo, che è la causa-radice concreta del fallimento silenzioso.

4. **Il piano non prescrive il MECCANISMO di allineamento, solo che "serve".** §5.1 dice "il patto a 3 è il test critico" e che `getMaxQueuedFor` Dart deve restituire lo stesso intero — giusto ma insufficiente: non propone (a) la singola-fonte-della-formula in Dart né (b) un test che confronti col **valore effettivamente calcolato dalla rule** (non con una seconda copia della formula scritta a mano nel test, che drifterebbe insieme). Lo fornisco sotto.

5. **`==` stretto non documentato come invariante da preservare.** La rule confronta con `==`, non `>=` (firestore.rules:565). Lo snapshot `effectiveMaxAtCreate` scritto dal client deve essere **esattamente uguale** a ciò che la rule ricalcola live leggendo `users/{uid}.points`. Se i punti cambiano tra lettura-snapshot e write, mismatch e deny. È un edge raro già presente in produzione: il porting deve **preservarlo identico**, non "ripararlo" con un `>=`.

6. **Set di status "attivi" — il doc spec è stantio, il codice no.** Il dossier segnala l'IRRISOLTO: lo spec §7 elenca `['queued','transferring','ready']`. Verificato: il pre-flight client (useAudioQueue.ts:74) **e** la CF (functions/src/index.ts) contano entrambi `['queued','transferring','ready','playing']` (4 status). Concordano. Per il porting l'autorità è il codice (4 status); lo spec è drift.

7. **Fast-path DJ-locale assente dalle istruzioni di porting.** Il piano elenca `DJEngine` come PURO con DI, ma non isola il corto-circuito `getLocalTrackBlob` quando `item.proposedBy === session.djId` (djEngine.ts:193-201). È un invariante di **correttezza**, non un'ottimizzazione: trasferire a sé stessi incastra la sessione (UID condiviso, doc signaling che collide, status bloccato su `transferring` per sempre). Va preservato esplicitamente.

8. **Dettagli P2P load-bearing non mappati su `flutter_webrtc`:** soglia backpressure `bufferedAmount > CHUNK_SIZE*64` (1 MB) + retry 50 ms; il `FileReader` (assente in Dart); meta `mimeType` che in React viene da `Blob.type` ma in Dart deve venire da `LocalTrack.mimeType` (un `Uint8List` non ha tipo); l'accoppiamento `50MB cap upload` ↔ `MAX_TOTAL_CHUNKS=3200` (51.2MB); il TTL signaling 60s + lettura `createdAt` sia `Timestamp` sia legacy epoch. Il piano dice "portato fedelmente" (vero, lo spike l'ha fatto) ma non fissa questi punti come contratto.

9. **Interfaccia `AudioEngine` dello sketch §2.5 incompleta per i consumatori reali.** Espone `init/setEq/getFrequencyData`, ma `DJEngine` e `useAudioPlayer` richiedono `load/play/pause/stop/seek/setVolume/getCurrentTime/getDuration/isPlaying` + lo stream eventi `ended|play|pause|timeupdate|error`. Senza questi il porting di `DJEngine` (che dipende da `playBlob/stopAudio/getAudioProgress/engine.on('ended')`) non si chiude. Contratto completo sotto.

10. **Parità visualizer non affrontata.** Il `Visualizer` reale (Visualizer.tsx:44-46) usa solo i **32 bin bassi** dei 64, campionati log: `index = floor(pow(i/32,2) * (64*0.5))`. La FFT SoLoud nativa (256 bin → 64, dallo spike) ha layout e scala diversi da `getByteFrequencyData` (dB-mappata 0-255). Se l'interfaccia non vincola la semantica di `getFrequencyData()`, le barre saranno diverse web vs nativo. Gap di parità non citato.

11. **Indici IndexedDB: il piano teme una semantica che il codice non usa.** §3.8(b) dice che "il punto delicato è mantenere identica la semantica di `searchTracks`/sort su due backend". Verificato: gli indici `[artist,album,year,lastPlayedAt,isFavorite]` sono **dichiarati ma non usati** dall'API di lettura — `getAllTracks` fa `getAll` + sort JS in memoria, `searchTracks` fa filter JS in memoria (indexedDB.ts:80-100). Quindi il porting drift deve riprodurre solo il **comportamento osservabile** (DESC per `uploadedAt`, substring lowercase su title/artist/album), non la struttura degli indici. È una semplificazione reale che il piano non coglie.

12. **`getStorageQuota` senza equivalente nativo, non segnalato.** Usa `navigator.storage.estimate()` (indexedDB.ts:126); sul nativo non esiste — va dietro l'interfaccia con impl diversa (disco libero + somma `sizeBytes`).

13. **`durationMs` ha una via-di-fuga nascosta dentro un modulo marcato PURO.** Il piano (e il dossier §G) classificano `id3.ts` come PURO. Il **parsing dei tag** è puro byte-work, ma `parseAudioFile` calcola `durationMs` via `AudioContext.decodeAudioData` (id3.ts:169-195) — una chiamata Web Audio senza equivalente nativo gratuito. Sul nativo la durata va presa altrove (SoLoud dopo `load`, o un package di metadata). Da scorporare.

Nessuno di questi tocca il backend: rules/CF/74-rule-test restano invariati. Tutti i gap vivono nel client Dart e nelle quattro vie di fuga — esattamente dove il piano stesso concentra il rischio.

---

## Dimensione coda-p2p-audio: migrazione che PRESERVA l'eleganza

**Perché questa parte è la più delicata della migrazione.** Il resto dell'app è CRUD su Firestore: si porta cambiando solo lo strato reattivo. Qui invece convivono quattro cose che il browser fa nativamente e che Flutter nativo non fa da solo — un grafo Web Audio, un trasferimento WebRTC peer-to-peer, un database locale di blob audio, e una formula di sicurezza replicata su più runtime. Marzio è in produzione e questo modulo è la sua firma: l'audio non lascia mai il device, viaggia P2P, e la coda si auto-regola sui punti. Il rischio non è "non compila" (lo spike ha già dimostrato che compila e gira su web+mobile): è **regredire un dettaglio invisibile** — un cast a intero, una soglia di backpressure, un set di status — e scoprirlo a runtime come un permesso negato silenzioso o un trasferimento che si incastra.

**Perché l'attuale è elegante (e cosa significa "non perderlo").** L'eleganza non è estetica: è che ogni invariante difficile è stato spinto nel punto più economico che lo regge. Il signaling è *Firestore-as-signaling* (zero infrastruttura WebRTC dedicata, riuso del realtime già presente). Il conteggio della coda che il DSL Firestore non sa esprimere è stato spaccato in tre: la formula sta in rule, il *count* sta in CF, il client tiene uno snapshot che la rule verifica con `==`. L'audio non è mai su cloud perché *non esiste una path audio nelle rule* — l'invariante è garantito dall'assenza, non da un controllo. Il `DJEngine` è già una classe con dependency injection, agnostica da Firebase, testabile fuori da React. Preservare questo significa **mantenere la stessa topologia di responsabilità**: portare i confini dove sono, non spostarli "perché in Dart si fa così".

---

### A. Il patto a 3 → patto a 4 (la formula come singola fonte + test contro il valore-rule)

**Perché esiste.** La Sporca #24 "Queue Stuffer": un utente con molti punti salta il check client e infila N+1 brani. Il DSL Firestore non può contare documenti, quindi la difesa è stratificata: la **rule** valida che lo snapshot `effectiveMaxAtCreate` scritto dal client coincida con la formula ricalcolata server-side (chiude il 90% — il "livello formula"); la **CF** `enforceQueuePerUserLimit` conta i doc attivi reali (chiude il residuo); il **client** fa pre-flight per UX e calcola lo snapshot. La formula canonica è una sola:

```
maxQueuedPerUser + floor(points / 100) * bonusPerHundredPoints     // default 2 + floor(pts/100)*1
```

I tre siti odierni, verificati alla fonte:
- Client — `getMaxQueuedFor(points, rules)` (`src/hooks/useAudioQueue.ts:11`), con fallback `?? 2`/`?? 1` per sessioni legacy senza `rules`.
- CF — `enforceQueuePerUserLimit` (`functions/src/index.ts:143`, formula a :164), `Math.floor`.
- Rule — `effectiveMaxQueued(sessionId)` (`firestore.rules:538`), con `int()` al posto di `Math.floor`; confronto `==` stretto a `firestore.rules:565`.

**Cosa cambia in Flutter, e perché è il punto più pericoloso.** CF e rule **non si toccano** (restano JS/DSL deployati). Ma il client si sdoppia: il 4° sito è la funzione Dart che (a) fa pre-flight e (b) produce lo snapshot `effectiveMaxAtCreate`. Se diverge anche di una unità — o, peggio, se scrive un `double` invece di un `int` — la rule respinge `queue.create` con `Missing or insufficient permissions`, l'utente non capisce, i log sono criptici, e il fallback graceful della CF (CF down → si procede comunque al `setDoc`) **maschera** il problema lasciando che sia la rule a fallire dopo. È lo stesso fallimento silenzioso del "footgun isValidX AND globale" descritto in CLAUDE.md: invisibile finché un utente non lo segnala in produzione.

**Come preservarlo (azionabile).**

1. **Singola fonte della formula in Dart.** File nuovo `lib/src/features/ainulindale/domain/queue_cap.dart`, funzione pura usata da **tutti** i punti client (pre-flight e snapshot). Non duplicarla nel widget né nel test.

   ```dart
   /// Specchio esatto di getMaxQueuedFor() (src/hooks/useAudioQueue.ts:11) e
   /// dell'helper rule effectiveMaxQueued() (firestore.rules:538).
   /// Ritorna int per costruzione: la rule asserisce `effectiveMaxAtCreate is int`.
   int maxQueuedFor(int points, SessionRules? rules) {
     final max = rules?.maxQueuedPerUser ?? 2;          // fallback come il client React
     final bonus = rules?.bonusPerHundredPoints ?? 1;
     // `points ~/ 100` = divisione intera con troncamento verso zero, specchio di
     // int(userPoints/100) della rule. points è un contatore monotòno >= 0
     // (GAMING_SYSTEM: "scala monotona crescente"), quindi ~/ ≡ floor qui.
     return max + (points ~/ 100) * bonus;
   }
   ```

   - **`int` ovunque, mai `double`.** `maxQueuedPerUser`/`bonusPerHundredPoints` devono essere modellati come `int` nel tipo `SessionRules` Dart e parsati da Firestore con `(v as num).toInt()` al confine di deserializzazione, così il prodotto resta `int` e `cloud_firestore` lo serializza come intero → la rule `is int` passa. **Questo è il fix del gap #3 della verifica.** Non scrivere mai il risultato di una `/` (doppia) in `effectiveMaxAtCreate`.
   - Il `Math.floor` esterno della variante standalone (useAudioQueue.ts:236) diventa superfluo in Dart **se** il tipo è `int` per costruzione; tienilo come asserzione difensiva (`assert(value is int)`) ma non come `.floor()` su un double.

2. **Preserva il set di status attivo a 4** nel pre-flight: `['queued','transferring','ready','playing']` (specchio di useAudioQueue.ts:74 e della CF). Ignora lo spec doc che ne elenca 3.

3. **Preserva `==`, non `>=`.** Lo snapshot scritto è quello calcolato sui punti letti al momento del `propose`; la rule lo riconfronta live. Non introdurre tolleranza.

4. **Preserva il fallback graceful della CF** identico (gap #4 / §4.4 del piano è già corretto qui): `try { call('enforceQueuePerUserLimit') } catch` → se `code == 'resource-exhausted'` rilancia il messaggio di limite; ogni altro errore (CF non deployata, network) → `console.warn` strutturato + si prosegue al `setDoc`, perché la rule resta la rete di sicurezza. In Dart: `on FirebaseFunctionsException catch (e)` con `e.code == 'resource-exhausted'`.

5. **Preserva l'auto-join participant prima del `setDoc` queue** (useAudioQueue.ts:192-207): la rule `queue.create` richiede `isSessionParticipant(sessionId)`; chi propone dalla Biblioteca/FullScreenPlayer potrebbe non avere il doc participant. Il porting deve upsertare `participants/{uid}` (status `joined`) prima della write, o regredisce in `PERMISSION_DENIED`.

**Test che confronta col valore-rule (non con una seconda formula).** Due livelli:
- **Unit Dart** (`package:test`): `maxQueuedFor` su matrice `(points ∈ {0,99,100,250,500,9999}, rules ∈ {null,(2,1),(3,2)})`, asserendo i valori attesi a mano + che il ritorno sia `int`. Porta i casi del file esistente `src/__tests__/audio/useAudioQueue.test.ts`.
- **Integration test contro l'emulator** (questo è il pezzo che il piano non ha): fai una `queue.create` reale al **boundary**. Scrivi `effectiveMaxAtCreate = maxQueuedFor(p, rules)` → **accettata**; scrivi `maxQueuedFor(p, rules) - 1` e `+ 1` → **respinte**. Così non testi una copia della formula, testi che la **rule reale** accetta esattamente il valore prodotto dal 4° sito. È il guardiano anti-drift definitivo, e gira sullo stesso emulator dei 74 rule-test (`firebase.json` porta 8080, JDK 21+), senza toccarli.

Ordine: prima `queue_cap.dart` + unit test; poi cabla pre-flight e snapshot su di esso; infine l'integration boundary test prima di considerare chiuso il modulo coda.

---

### B. Il trasferimento P2P WebRTC → `flutter_webrtc` (preservando ogni dettaglio)

**Perché è così com'è.** Il file audio non sta su cloud: quando il DJ riproduce una proposta, i byte viaggiano device-to-device. Firestore fa **solo signaling** (offer/answer/ICE), in una sub-collection `audio_sessions/{sessionId}/signaling/{userId}` con ownership stretta (proposer-or-DJ) che ha chiuso la Sporca #30. Lo spike ha già portato `FileTransfer` fedelmente (costanti, meta, backpressure, riassemblaggio) e verificato il round-trip in-process via `LoopbackSignaling`. Quello che manca è fissare il contratto e mappare le API JS su `flutter_webrtc`, dove alcune cose non hanno corrispondenza 1:1.

**Mappa fedele (`src/utils/webrtc.ts` → `lib/src/features/ainulindale/webrtc/file_transfer.dart`).** Costanti da preservare alla lettera:
- `STUN`: `{'iceServers':[{'urls':'stun:stun.l.google.com:19302'}]}`.
- `CHUNK_SIZE = 16384` (16 KB); `MAX_TOTAL_CHUNKS = 3200` (51.2 MB, appena sopra il cap 50MB/traccia — **accoppiato** al guard upload, vanno cambiati insieme o mai).
- DataChannel `'audio'`, `ordered: true` → `RTCDataChannelInit()..ordered = true`. `binaryType='arraybuffer'` → in `flutter_webrtc` invia `RTCDataChannelMessage.fromBinary(Uint8List)` e leggi `message.isBinary`/`message.binary`.
- Header meta come **stringa** prima dei binari: `RTCDataChannelMessage(jsonEncode({'type':'meta','totalChunks':n,'mimeType':mime}))`, con `totalChunks = (bytes.length / CHUNK_SIZE).ceil()`.
- Validazione difensiva lato DJ alla ricezione (webrtc.ts:228-247): rifiuta `!mime.startsWith('audio/')`; rifiuta `total` non intero o `<=0` o `> MAX_TOTAL_CHUNKS`, **prima** di allocare il buffer. Preserva: è la difesa contro `totalChunks: 99999999` che farebbe esplodere la memoria del DJ.
- Backpressure (webrtc.ts:304-308): `if (dataChannel.bufferedAmount > CHUNK_SIZE * 64) { delay 50ms; retry }`. `flutter_webrtc` espone `dataChannel.bufferedAmount` (lo spike l'ha verificato). **Usa la stessa soglia di polling** (1 MB) con `await Future.delayed(Duration(milliseconds: 50))`, NON l'evento `onBufferedAmountLow`: il sorgente non lo usa, e replicarne il comportamento esatto evita differenze di throughput.
- Timeout 15 s via `Timer`, ri-armato a ogni chunk ricevuto (`resetTimeout`, webrtc.ts:63-72): se non `connected`/`open` → "Timeout connessione"; se DJ e `receivedChunks < expectedChunks` → "Timeout ricezione".
- Connection state: `peer.onConnectionState` → `connected` ⇒ `onConnected`; `failed`/`disconnected` ⇒ errore. `dc.onClose` lato DJ con ricezione incompleta → "Connessione persa prima della fine del file".

**Le tre divergenze JS→Dart da gestire (gap #8):**
1. **Niente `FileReader`.** In React il proposer legge `blob.slice` via `FileReader.readAsArrayBuffer`. In Dart i byte sono già un `Uint8List` (vengono dal local store): chunka con `bytes.sublist(offset, min(offset + CHUNK_SIZE, bytes.length))` in un loop con il check di backpressure. Più semplice e più diretto.
2. **`mimeType` non viene dal blob.** In React `blob.type` porta il MIME; un `Uint8List` Dart no. Il MIME del meta header deve venire da `LocalTrack.mimeType` (il campo del local store). Lato DJ, `assembleBlob` ricostruisce con `receiveMime`: passa `Uint8List` + `receiveMime` all'`AudioEngine.load(bytes, mime)`.
3. **Signaling: estrai l'interfaccia, preserva il comportamento dentro l'impl.** Nel sorgente il signaling è **annidato dentro** la classe `WebRTCTransfer` (chiamate dirette a `setDoc`/`onSnapshot`). Lo spike ha introdotto `SignalingChannel` (interfaccia) — bene, ma il refactor deve portare **dentro l'impl Firestore** ogni dettaglio: path `audio_sessions/{sessionId}/signaling/{proposerId}`; scrittura `djOffer{sdp,type,queueItemId,createdAt:Timestamp.now()}` + `expireAt = Timestamp.fromMillis(now+60_000)` con `merge:true`; ICE via `arrayUnion` su `djCandidates`/`proposerCandidates` con fallback `setDoc(merge:true)` se il doc non esiste; il DJ applica `proposerAnswer` solo se `signalingState != 'stable'`. La rule signaling resta **invariata**.

**Dettagli del flusso che vivono in `useWebRTCTransfer.ts` (gap #8, parte 2):**
- Lettura `createdAt` **doppio formato**: `Timestamp` (post-B7) o legacy epoch ms (useWebRTCTransfer.ts:63-65). In Dart: `final ts = v is Timestamp ? v.millisecondsSinceEpoch : (v is num ? v.toInt() : 0)`.
- Guard offerta stale: `now - offerTsMs > 60_000` → ignora. Stesso 60s del TTL signaling e della CF `cleanupOrphanSignaling` (cron 5 min): **preservare il numero** o la pulizia server-side scollega dal client.
- Proposer: su `onConnected` → `sendBlobBinary` poi `Future.delayed(2s)` prima di resettare `isTransferring`.

**Fast-path DJ-locale — preservare come invariante di correttezza (gap #7).** In `djEngine.ts:193-201`: se `getLocalTrackBlob` è iniettato **e** `item.proposedBy === session.djId`, leggi il blob dal local store del DJ e chiama `onReady(blob)` direttamente, **senza** negoziare WebRTC. Motivo (commento nel sorgente): trasferire a sé stessi si incastra — i due peer condividono lo UID, il doc signaling ha un solo indirizzo, il listener non produce mai l'answer → status bloccato su `transferring` per sempre. In Flutter il `DJEngine` Dart riceve `getLocalTrackBlob` via DI esattamente come oggi (cablato in `AudioSessionDJ` con `getTrack` dal `LocalLibraryStore`). **Non ometterlo**: senza, una sessione dove il DJ propone i propri brani si pianta.

**Test (allinea §5.5):** porta `runDataChannelEchoDemo` dello spike a test **eseguito a runtime** (round-trip, 3 chunk + meta JSON) con `LoopbackSignaling` mock per testare `FileTransfer` senza Firestore vivo; il signaling reale (Firestore) si copre negli integration test. La Fase 1 "Fatto" del piano (echo WebRTC a runtime su web+mobile) resta il gate giusto.

Ordine: `SignalingChannel` (interfaccia) + impl Firestore fedele → `FileTransfer` con costanti e backpressure → echo test loopback → cablaggio in `DJEngine` con fast-path → integration test su signaling reale.

---

### C. Storage audio locale → split web (IndexedDB/OPFS) / nativo (drift) dietro interfaccia unica

**Perché "mai audio su cloud" è un invariante client, non server (gap implicito del piano).** Non esiste alcuna path audio in `firestore.rules`: l'invariante è garantito dall'**assenza** di una superficie di scrittura, non da un controllo. Significa che non c'è rete di sicurezza server-side da ereditare: il porting Dart deve mantenere la disciplina nel codice. `localTrackId` è una **chiave del local store, non un URL** (AINULINDALE_TECHNICAL_SPEC: "id IndexedDB lato proponente, NON un URL — serve solo per il P2P"). Su Firestore vanno **solo** i metadati (titolo, artista, durata, cover ≤50KB base64). L'unica via d'uscita dei byte è il P2P della sezione B.

**Schema da preservare (`src/utils/indexedDB.ts`):** DB `marzio1777_audio` v1; store `tracks` (keyPath `id`); store `playlists` (keyPath `id`). `LocalTrack`: `id, title, artist, album?, year?, genre?, durationMs, coverDataUrl?, blob, mimeType, sizeBytes, uploadedAt, lastPlayedAt?, playCount, isFavorite, customTags[]`.

**La semplificazione che il piano non ha (gap #11).** Gli indici `[artist,album,year,lastPlayedAt,isFavorite]` sono **dichiarati ma non usati** dall'API di lettura: `getAllTracks` fa `getAll` + sort JS (`b.uploadedAt - a.uploadedAt`, DESC), `searchTracks` fa filter JS (substring lowercase su title/artist/album). Quindi il porting drift deve riprodurre solo il **comportamento osservabile**, non la struttura degli indici. Concretamente: tabella `tracks`, lettura full-scan + sort/filter in memoria. Gli indici drift si aggiungono solo se in futuro una query li richiede. Questo abbassa il rischio che il piano stima "medio".

**Interfaccia unica (conditional import, forma canonica dello spike):**

```dart
// lib/src/features/ainulindale/storage/local_library_store.dart
abstract class LocalLibraryStore {
  factory LocalLibraryStore() => createLocalLibraryStore();   // dall'import condizionale
  Future<void> init();
  Future<LocalTrack> addTrack(LocalTrack t);                  // bytes inclusi
  Future<LocalTrack?> getTrack(String id);
  Future<List<LocalTrack>> getAllTracks();                    // sort uploadedAt DESC
  Future<List<LocalTrack>> searchTracks(String q);            // substring lowercase title/artist/album
  Future<void> deleteTrack(String id);
  Future<void> updateTrack(LocalTrack t);
  Future<({int used, int total})> getStorageQuota();
  Future<List<LocalPlaylist>> getPlaylists();
  Future<void> addPlaylist(LocalPlaylist p);
}
// import 'local_library_store_web.dart' if (dart.library.io) 'local_library_store_native.dart';
```

- **Web** (`..._web.dart`): IndexedDB via `package:web`+`dart:js_interop` (riuso schema `marzio1777_audio` v1), oppure OPFS per i byte + IndexedDB per i metadati se i blob grossi pesano sul main thread. `getStorageQuota` → `navigator.storage.estimate()` (1:1 con oggi).
- **Nativo** (`..._native.dart`): `drift` (SQLite) per i metadati; i byte audio come colonna BLOB o, meglio per blob fino a 50MB, file su disco con il path salvato in tabella. `getStorageQuota` (gap #12): nessun equivalente di `estimate()` → `used = somma(sizeBytes)`, `total = spazio libero disco` (via `path_provider` + stat).

**Guard upload da preservare (`useLocalLibrary.ts:35-36`):** scarta `!file.type.startsWith('audio/')` e `file.size > 50*1024*1024` con skip silenzioso. Il 50MB è **accoppiato** a `MAX_TOTAL_CHUNKS=3200` della sezione B: un cambio va fatto in entrambi.

**`durationMs` ha una via-di-fuga nascosta (gap #13):** `parseAudioFile` (id3.ts) calcola la durata con `AudioContext.decodeAudioData` — Web Audio. Il **parsing tag** è puro byte-work (porta 1:1 in Dart), ma la durata sul nativo va presa dopo `load` via SoLoud o un package di metadata. Scorpora: `id3_tags.dart` (puro) + estrazione durata dietro l'interfaccia audio.

Ordine: `LocalLibraryStore` (interfaccia) + impl web (IndexedDB) → unit test sul contratto (sort DESC, substring) → impl drift nativa → test parità sui due backend (gli stessi casi) → guard upload + scorporo durata.

---

### D. AudioEngine (grafo/EQ/analyser) → web JS interop reale / nativo SoLoud, EQ candidato Rust+FFI

**Perché è un singleton e perché il grafo è esattamente quello.** Un solo `AudioContext` per app ("non istanziare `AudioContext` altrove") perché i browser limitano il numero di context e il grafo va costruito una volta. Catena (audioEngine.ts:43-49): `source → gain → eqLow(lowshelf 320Hz) → eqMid(peaking 1kHz, Q=0.5) → eqHigh(highshelf 3.2kHz) → analyser(fftSize 128) → destination`. EQ gain clampato `[-12, +12] dB`; volume clampato `[0, 1]` sul `gainNode` (separato dall'EQ). `analyser.fftSize = 128` → `frequencyBinCount = 64` → alimenta il visualizer a 32 barre.

**Decisione EQ (verifico e confermo il piano).** Opzione B (SoLoud per il nativo, JS interop per il web) in fase 1, interfaccia pronta per Opzione A (Rust+FFI). **Concordo, con la sua exit path.** Motivo: sul web l'EQ a 3 bande è *reale e gratis* via Web Audio (lo spike l'ha provato); il nativo SoLoud dà FFT reale ma il suo EQ è un equalizzatore **grafico a 8 bande**, non le 3 biquad shelf/peaking → niente drop-in. Introdurre una toolchain Rust+FFI *adesso*, su un'app in produzione, per un guadagno (3 bande esatte vs 8 "buone") che l'utente di paese non distingue, è prematuro. Si passa ad A quando l'EQ nativo diventa una lamentela reale o serve parità DSP byte-identica cross-platform. Il punto che rende reversibile la scelta: `setEq(low, mid, high)` è **un solo metodo** dietro l'interfaccia; sostituire SoLoud col crate Rust è cambiare un'impl, non un refactor.

**Contratto completo (gap #9 — lo sketch §2.5 era insufficiente per `DJEngine`/`useAudioPlayer`):**

```dart
// lib/src/features/ainulindale/audio/audio_engine.dart
abstract class AudioEngine {
  factory AudioEngine() => createAudioEngine();
  Future<void> init();                                  // costruisce il grafo una volta (web) / init SoLoud (nativo)
  Future<void> load(Uint8List bytes, String mimeType);  // web: createObjectURL + revoke del precedente blob:; nativo: loadMem
  Future<void> play();                                  // web: ctx.resume() + el.play() (autoplay policy mobile); nativo: play
  void pause();
  void stop();                                          // = pause + seek(0)
  void seek(double seconds);                            // clamp [0, duration]
  void setVolume(double v);                             // clamp [0,1] (gainNode)
  void setEq(double low, double mid, double high);      // clamp [-12,12] per banda
  double getCurrentTime();
  double getDuration();
  bool get isPlaying;
  Uint8List getFrequencyData();                         // 64 byte, semantica getByteFrequencyData (0-255)
  Stream<AudioEngineEvent> get events;                  // ended | play | pause | timeupdate | error
  void dispose();
}
// import 'audio_engine_web.dart' if (dart.library.io) 'audio_engine_native.dart';
```

I consumatori (preserva la DI esistente): `DJEngine.playBlob` → `load + play`; `stopAudio` → `stop`; `getAudioProgress` → `(getCurrentTime, getDuration)`; `engine.on('ended')` → `events.where((e) => e == ended)`. `useAudioPlayer.setEQ` → `setEq` diretto.

**Dettagli web da preservare (impl reale, già provata dallo spike):**
- Costruzione grafo identica con `dart:js_interop` + `package:web`: `AudioContext`, `GainNode`, 3 `BiquadFilterNode` con i tipi/freq/Q esatti, `AnalyserNode` con `fftSize=128`.
- `load(blob)`: revoca l'`objectURL` precedente se `blob:` e crea il nuovo (audioEngine.ts:74-77) — evita leak di memoria.
- Resume del context su `play` se `suspended` (audioEngine.ts:52-54, "Must resume context on mobile"): la policy autoplay del browser richiede il gesto utente. Preserva nella impl web.

**Dettaglio nativo (SoLoud) — il rischio EQ esplicito, non mascherato:**
- FFT reale via `AudioData(GetSamplesKind.linear)` → 256 bin → downsample a 64 (dallo spike).
- `setEq` resta **stub marcato TODO** finché non c'è il DSP nativo (Rust+FFI 3 biquad, o mapping sulle bande SoLoud). Il test deve **documentare il gap**, non nasconderlo (§5.5 del piano è corretto su questo).
- SoLoud carica la dynamic library **eagerly** nel costruttore (`SoLoud.instance`, spike): attenzione al lifecycle/CI e al `dispose`. Su Linux serve `libasound2-dev` (già risolto post-spike).

**Parità visualizer (gap #10 — non affrontato dal piano).** Il `Visualizer` (Visualizer.tsx:44-46) usa **solo i 32 bin bassi** dei 64, con campionamento log: `index = floor(pow(i/32, 2) * (64*0.5))`, `barHeight = dataArray[index]/255`. Perché il **medesimo widget** funzioni identico web e nativo, `getFrequencyData()` deve ritornare **64 byte con la semantica di `getByteFrequencyData`** (mappatura dB→byte 0-255, default `minDecibels/maxDecibels` -100/-30) e con layout lineare dei bin (bin k ≈ k·sampleRate/fftSize). Sul web è gratis (chiamata nativa). Sul nativo la FFT lineare di SoLoud va convertita alla **stessa scala dB→byte** dopo il downsample a 64, altrimenti le barre saranno visivamente diverse. Da testare a vista, non solo a compilazione.

**Singleton in Riverpod.** "Una sola istanza" diventa un `Provider<AudioEngine>` **keepAlive** (non `autoDispose`), creato una volta: è il bridge naturale di `getInstance()`/"non istanziare AudioContext altrove". I due hook avvolgenti restano: `useAudioEngineRaw` (DJ, sottile) → un provider raw; `useAudioPlayer` (Walkman: queue, shuffle, repeat, MediaSession, wake-lock) → un `Notifier`/provider di stato. MediaSession (web) e wake-lock sono vie di fuga a parte (`package:web` MediaSession / `audio_service` nativo; `wakelock_plus`), già nel piano §3.5.

Ordine: `audio_engine.dart` (contratto completo) → impl web JS interop (grafo+EQ+FFT reali) → `Visualizer` Dart che consuma `getFrequencyData()` → impl nativa SoLoud (FFT reale, `setEq` stub marcato) → conversione dB→byte per parità visualizer → cablaggio in `DJEngine`/`useAudioPlayer` provider. La decisione Rust+FFI (Opzione A) si apre solo dopo, dietro lo stesso `setEq`.

---

**File chiave su cui è fondata questa sezione (tutti letti alla fonte):** `/home/neo1777/Scrivania/marzio1777-main/src/utils/webrtc.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/utils/audioEngine.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/utils/indexedDB.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/utils/djEngine.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useAudioQueue.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useWebRTCTransfer.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/hooks/useLocalLibrary.ts`, `/home/neo1777/Scrivania/marzio1777-main/src/components/audio/Visualizer.tsx`, `/home/neo1777/Scrivania/marzio1777-main/firestore.rules` (538-565), `/home/neo1777/Scrivania/marzio1777-main/functions/src/index.ts` (143-184), `/home/neo1777/Scrivania/marzio1777-main/FLUTTER_SPIKE_FINDINGS.md`.
