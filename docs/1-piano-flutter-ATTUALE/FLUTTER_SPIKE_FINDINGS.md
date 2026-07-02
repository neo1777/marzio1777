# FINDINGS — SPIKE Flutter marzio1777 (web + mobile + desktop)

> Spike esplorativo, NON codice di produzione. Obiettivo: validare che **un solo
> codebase Flutter/Dart** possa puntare a web + mobile + desktop gestendo i 3
> moduli "duri" di marzio1777 con il pattern **"via di fuga"** (interfaccia Dart
> unica + conditional import per-piattaforma). **Backend: resta Firestore.**
>
> Onestà brutale: lo scopo è far emergere i problemi. Ciò che ho **VERIFICATO**
> (compila/analizza/builda) è marcato come tale; il resto è **INFERENZA**.

## Ambiente verificato
- Flutter **3.38.9** (stable), Dart **3.10.8**. Engine in `/home/neo1777/development/flutter/bin`.
- Progetto creato con piattaforme `web, linux, android, ios`.
- Pacchetti risolti (`flutter pub get` OK): `web 1.1.1`, `flutter_soloud 3.5.4`,
  `flutter_webrtc 1.5.2`, `sensors_plus 7.1.0`, `camera 0.12.0+1`,
  `cloud_firestore 6.6.0`, `firebase_core 4.11.0`.

## Esiti globali (VERIFICATI)
| Check | Esito |
|---|---|
| `flutter pub get` | OK (dopo pin di flutter_soloud a 3.5.4 — vedi Modulo 1) |
| `flutter analyze` | **No issues found** (0 warning, 0 error) |
| `flutter test` (smoke) | All tests passed |
| `flutter build web --release` | **OK** (main.dart.js 2.1MB; wasm dry-run anch'esso OK) |
| `flutter build linux --release` | **FALLITO** — unico blocco: header ALSA mancanti per flutter_soloud (vedi sezione Build Linux) |

Il build web verde e' il dato forte: l'INTERO stack (flutter_webrtc web,
camera_web, sensors_plus web, cloud_firestore web, firebase_core web, Web Audio
via package:web) compila in un singolo bundle web da un solo `lib/`.

---

## Architettura "via di fuga" (come e' fatta)
```
lib/
  audio/
    audio_engine.dart          # interfaccia astratta + factory
    audio_engine_web.dart      # dart:js_interop + package:web (Web Audio vero)
    audio_engine_native.dart   # flutter_soloud (FFT reale + EQ stub)
  webrtc/
    signaling.dart             # SignalingChannel (interfaccia) + LoopbackSignaling
    file_transfer.dart         # porting fedele di webrtc.ts (16KB + meta JSON)
    p2p_session.dart           # RTCPeerConnection + echo demo
  ar/
    orientation_service.dart   # sensors_plus + sensor-fusion + fallback no-sensor
    camera_passthrough.dart    # camera, con fallback su piattaforme non supportate
  firebase/
    firestore_check.dart       # prova-di-compilazione FlutterFire (no Firebase vivo)
  main.dart                    # UI demo dei 3 moduli
```
Conditional import (come richiesto):
```dart
import 'audio_engine_web.dart' if (dart.library.io) 'audio_engine_native.dart';
```
Risoluzione a compile-time: nel bundle web `flutter_soloud` non entra mai; nel
build nativo `package:web` non entra. VERIFICATO: entrambe le impl vengono
analizzate insieme da `flutter analyze` e passano.

---

## MODULO 1 — AudioEngine
Replica il grafo di `src/utils/audioEngine.ts`:
`source -> gain -> eqLow(lowshelf 320Hz) -> eqMid(peaking 1kHz Q=0.5) -> eqHigh(highshelf 3.2kHz) -> analyser(fftSize 128) -> destination`.

### (a) Compila? SI (VERIFICATO: analyze pulito, web build OK).

### (b) Cosa funziona davvero vs stub
- **WEB (`audio_engine_web.dart`) — REALE.** Costruisce il VERO grafo Web Audio
  via `dart:js_interop` + `package:web`: `AudioContext`, `GainNode`, 3
  `BiquadFilterNode` (lowshelf 320 / peaking 1k Q=0.5 / highshelf 3.2k),
  `AnalyserNode` con `fftSize=128`. EQ 3 bande funzionante (`.gain.value`),
  lettura byte-frequency funzionante (`getByteFrequencyData` -> 64 bin, riportati
  a Dart `Uint8List` via `JSUint8Array.toDart`). Sorgente: sia
  `MediaElementAudioSourceNode` (fedele a React) sia oscillatore di test. Lato
  production-shaped, non stub.
- **NATIVE (`audio_engine_native.dart`, flutter_soloud) — PARZIALE.**
  - REALE: `init()`, `loadMem()` (WAV sine generato in puro Dart), `play()`, e
    **lettura FFT real-time** via `AudioData(GetSamplesKind.linear)` ->
    `getAudioData()` (512 float: 256 FFT + 256 wave) -> downsample a 64 bin.
    Dimostra l'equivalente nativo dell'AnalyserNode.
  - STUB (con TODO nel codice): `setEq()` (EQ 3 bande), `pause()`, `stop()`,
    `setVolume()` runtime, `loadUrl()`. Stubbati per non inventare API non
    verificate in 3.5.4.

### (c) Il problema concreto (la lacuna)
1. **Version gap reale (VERIFICATO).** `flutter_soloud` 4.x (API AudioData piu'
   pulita) richiede Dart >= 3.11.0, ma Flutter 3.38.9 porta Dart 3.10.8 ->
   `pub get` FALLISCE. Pinnato 3.5.4 (ha comunque AudioData linear).
2. **EQ non mappa 1:1 (INFERENZA da doc).** SoLoud ha `filters` (FiltersGlobal)
   con un equalizer GRAFICO a 8 bande, non le 3 biquad shelf/peaking dell'app
   React. Niente drop-in: o si accetta l'8-band, o si concatenano biquad. -> EQ
   nativo lasciato stub.
3. **`SoLoud.instance` carica EAGERLY la dynamic library nativa nel costruttore
   (VERIFICATO).** Il `flutter test` crashava (`Failed to load dynamic library
   'libflutter_soloud_plugin.so'`) alla SOLA costruzione dell'engine, prima di
   `init()`. Mitigato con riferimento lazy + flag `_everInit`. Lezione: su CI o
   piattaforme senza build nativa, anche solo istanziare l'engine va protetto.

### (d) Pacchetto consigliato + split web-vs-nativo
- **Web**: nessuna dep extra — `package:web` + `dart:js_interop` pilotano il Web
  Audio del browser. Scelta giusta e leggera.
- **Native**: **flutter_soloud** e' il candidato corretto (FFT + filtri reali,
  motore C++). Alternativa `just_audio` = playback ma NIENTE FFT/EQ. Split via
  conditional import gia' implementato.

### (e) Verdetto effort / rischio
- Web: **S / basso** (fatto, reale).
- Native: **M / medio** — FFT funziona, ma EQ 3-bande + pin versione + lifecycle
  FFI sono lavoro vero.

---

## MODULO 2 — WebRTC P2P
Replica `src/utils/webrtc.ts` + `useWebRTCTransfer.ts`.

### (a) Compila? SI (VERIFICATO: analyze pulito; flutter_webrtc nel web build OK).

### (b) Cosa funziona davvero vs stub
- **REALE (portato fedelmente, compila):** `FileTransfer` con `CHUNK_SIZE=16384`,
  header JSON `{type:'meta', totalChunks, mimeType}`, `MAX_TOTAL_CHUNKS=3200`,
  validazione difensiva MIME `audio/*` + range chunk, riassemblaggio, e
  backpressure su `bufferedAmount` (verificato che `RTCDataChannel.bufferedAmount`
  esiste come `int?`). `P2PSession` cabla offer/answer/ICE su
  `createPeerConnection` (STUN `stun.l.google.com:19302`, identico all'originale).
- **`runDataChannelEchoDemo`**: 2 peer in-process via `LoopbackSignaling`,
  l'initiator invia il payload in chunk, il responder riassembla e rispedisce
  (echo), l'initiator verifica il round-trip. **Compila e analizza pulito.**
  L'esecuzione runtime e' INFERENZA (gira su web/mobile); NON ancora eseguita
  end-to-end.
- **Signaling**: lasciato come INTERFACCIA `SignalingChannel` (come richiesto).
  In produzione e' Firestore; le ref dei path sono in `firebase/firestore_check.dart`.

### (c) Il problema concreto (la lacuna)
- **Desktop Linux**: `flutter_webrtc` supporta Linux ma richiede libwebrtc
  nativa. Nel build Linux NON ha prodotto errori fatali prima del fallimento di
  soloud, ma il build si e' interrotto su soloud -> il link finale di
  flutter_webrtc NON e' stato confermato (vedi Build Linux).
- L'echo demo non e' ancora stata eseguita a runtime: dimostrata a compilazione
  + porting fedele, non a run.

### (d) Pacchetto consigliato + split web-vs-nativo
- **flutter_webrtc** e' di fatto l'unica opzione cross-platform seria, e lo
  STESSO codice vale web + mobile (+ desktop se la toolchain regge). Nessuno
  split nel codice Dart; lo split e' solo nel signaling (interfaccia -> impl
  Firestore in prod).

### (e) Verdetto effort / rischio
- Web + mobile: **S-M / basso-medio** (porting fatto, API stabile).
- Desktop: **M-L / medio** — dipende dal build di libwebrtc nativa.

---

## MODULO 3 — AR / orientamento
Replica `useDeviceOrientation.ts` + `useCameraStream.ts` + `ARCaptureLayer.tsx`.

### (a) Compila? SI (VERIFICATO: analyze pulito; sensors_plus + camera nel web build OK).

### (b) Cosa funziona davvero vs stub
- **REALE:** `OrientationService` consuma `accelerometerEventStream()` +
  `magnetometerEventStream()`, calcola pitch/roll dalla gravita' e un heading via
  bussola tilt-compensata (sensor fusion a mano). Espone heading/tilt.
  **Fallback no-sensor**: grace di 5s identica nello spirito a
  `useDeviceOrientation` (`available`); l'overlay AR in `main.dart` pinna l'emoji
  al centro quando i sensori mancano (come `useStaticPlacement` di ARCaptureLayer).
- **Camera passthrough** (`CameraPassthrough`): camera posteriore con fallback
  graceful se non disponibile.

### (c) Il problema concreto (LA LACUNA, come da brief)
- Il browser da' `DeviceOrientationEvent.{alpha,beta,gamma}` GIA' fusi dall'OS +
  `webkitCompassHeading` (heading magnetico CALIBRATO da iOS). **`sensors_plus`
  NON ha equivalente diretto**: solo flussi grezzi. Per heading/tilt usabili
  servono:
  - sensor fusion a mano (quella scritta: approssimata, NON calibrata, soggetta
    a drift, senza correzione hard/soft-iron del magnetometro), OPPURE
  - un pacchetto dedicato come **flutter_compass** (heading) o un filtro di
    Madgwick/complementare.
- **`camera` non supporta il desktop Linux** (INFERENZA da matrice di supporto):
  `availableCameras()` -> `MissingPluginException` -> passthrough non disponibile,
  resta il fallback.
- Su desktop i sensori spesso NON esistono -> il fallback no-sensor e' il caso
  normale, non il caso limite.

### (d) Pacchetto consigliato + split web-vs-nativo
- **sensors_plus** per i flussi grezzi (web+mobile) + **flutter_compass** per
  l'heading calibrato (o filtro di fusione). **camera** per mobile/web; sul
  desktop accettare l'assenza di camera. Fallback no-sensor OBBLIGATORIO ovunque.

### (e) Verdetto effort / rischio
- Mobile: **M / medio** (la fusione/heading e' il costo).
- Web: **M / medio** — heading non calibrato come `webkitCompassHeading`.
- Desktop: **L / alto** — niente camera, sensori spesso assenti: l'AR vera non
  esiste, solo un degradato.

---

## Backend Firestore (decisione fissa: si RESTA su Firestore)
- `firebase_core` + `cloud_firestore` RISOLVONO e COMPILANO (VERIFICATO: entrano
  nel web build release senza errori). `firebase/firestore_check.dart`
  referenzia API reali (`FirebaseFirestore`, `CollectionReference`,
  `DocumentReference`, `Firebase.initializeApp`) e replica i path reali
  (`audio_sessions/{id}/signaling/{userId}`, `.../queue`, `game_events/{id}/items`).
- NON e' stato aperto alcun Firebase vivo (come da brief): prova di
  compilazione/risoluzione. Il modello dati esistente si mappa 1:1 su
  cloud_firestore. Nessun motivo tecnico per lasciare Firestore.

---

## Build Linux (VERIFICATO)
- Toolchain di sistema PRESENTE: clang, cmake, ninja, pkg-config, gtk+-3.0 tutti
  ok. La compilazione e' arrivata lontano (centinaia di file C++ di soloud
  compilati).
- **UNICO blocco**: `fatal error: 'alsa/asoundlib.h' file not found` nel backend
  ALSA di flutter_soloud -> manca il pacchetto di sistema **`libasound2-dev`**
  (confermato: NON installato). Build process failed, nessun bundle prodotto.
- Come da istruzioni: **NON installo pacchetti di sistema, niente sudo**. Si
  RIPORTA il blocco. Fix lato dev: `sudo apt install libasound2-dev` (lo fa
  l'utente). flutter_webrtc NON ha prodotto errori fatali prima del fallimento
  di soloud, ma il build si e' interrotto -> il suo link nativo su Linux NON e'
  stato confermato.
- Implicazione architetturale: il desktop Linux NON e' bloccato dalla toolchain
  Flutter di base, ma dalle dipendenze native dei plugin (ALSA per soloud; da
  verificare libwebrtc). Web e mobile non hanno questo problema.

---

## Verdetto architetturale
Il pattern "Flutter core + vie di fuga" **regge per web + mobile** (un solo
`lib/`, conditional import, analyze + web build + test verdi). Il **desktop
(Linux)** e' la gamba debole: non per Flutter in se', ma per le dipendenze
native dei plugin (soloud richiede ALSA dev; camera non supporta Linux; webrtc
da confermare). Restando su **Firestore** non emerge alcun ostacolo: FlutterFire
risolve e compila. Spike POSITIVO con riserva esplicita sul desktop.

---

## Aggiornamento 2026-06-29 (post-spike) — desktop Linux sbloccato

Dopo `sudo apt install libasound2-dev`, `flutter build linux --release` **PASSA** (✓ bundle in `build/linux/x64/release/bundle/`). Conseguenze:
- **flutter_soloud** compila con backend ALSA abilitato (soli warning innocui in `soloud_fftfilter.cpp`).
- **flutter_webrtc** linka su Linux desktop senza errori → il rischio "link nativo da confermare" è **risolto** (builda).
- Resta il solo gap di feature desktop: **`camera` assente su Linux** (AR passthrough) → coperto dal fallback no-sensor.

Verdetto desktop rivisto: il build NON è più un blocco; il punto aperto su desktop si riduce alla camera (Linux) e al completamento dell'EQ nativo dell'audio. Esecuzione runtime (echo WebRTC, audio web nel browser) ancora da fare.
