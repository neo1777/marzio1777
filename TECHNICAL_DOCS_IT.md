# 🛠️ marzio1777 - Architettura Tecnica & Documentazione per Sviluppatori

Questo documento fornisce una panoramica professionale e altamente dettagliata delle decisioni architetturali, dei modelli dati, degli algoritmi e dei flussi tecnici che alimentano l'applicazione `marzio1777`. Serve come singola fonte di verità per sviluppatori e collaboratori.

## 1. 🏗️ Architettura & Tech Stack

`marzio1777` è costruita come una Single Page Application (SPA) altamente reattiva.
- **Frontend Framework:** React 18 (Functional Components, Hooks), sviluppato via Vite per HMR e build ottimizzate.
- **Linguaggio:** TypeScript esplicitamente per un type-checking rigoroso su payload esterni e riferimenti al DOM.
- **Backend as a Service (BaaS):** Ecosistema Firebase:
  - **Firestore:** Gestione di stato NoSQL e relazioni.
  - **Firebase Auth:** Verifica identità via provider OAuth Google.
  - **Firebase Storage:** Archiviazione binaria per gli asset immagine compressi.
- **Gestione dello Stato:** React Context API (`AuthContext`) per gli stati globali, potenziato da hook locali `useState`, `useRef`, e `useEffect` che si affidano ad `onSnapshot` di Firebase per reattività in tempo reale senza dover usare librerie esterne come Redux.
- **Styling Engine:** Tailwind CSS gestisce la composizione utility-first. Stati complessi sono mappati a CSS standard in `index.css`.
- **Animazioni:** Framer Motion (`AnimatePresence` per transizioni tra rotte e componenti).
- **Icone:** Lucide React.
- **Integrazione AI:** Google Gemini API usata per la generazione descrizioni immagini del `Magic Scan`.

---

## 2. 💾 Schema Dati Firestore

Il database usa una struttura NoSQL basata su documenti con documenti globali normalizzati e sottocollezioni annidate per funzionalità relazionali.

### 1. `users` (Collection)
Memorizza profilo privato, credenziali e le configurazioni RBAC.
- `uid` (Document ID)
- `email` (String) - Dati Sensibili (Protetti)
- `apiKey` (String) - Dati Sensibili (Protetti)
- `displayName` (String)
- `photoURL` (String)
- `role` (String) -> `"Guest" | "Admin" | "Root"`
- `accountStatus` (String) -> `"pending" | "approved"`
- `points` (Number) -> Determina i livelli Gamification (Altitudine)
- `bio` (String)
- `shareLiveLocation` (Boolean) -> Attiva/disattiva tracciamento geolocalizzato
- `createdAt` (Timestamp)

### 2. `user_locations` (Collection) - *Split Collection Pattern*
Memorizza rigorosamente la presenza geografica pubblica. Isolata da `users` per prevenire leakage PII.
- `userId` (Document ID)
- `displayName` (String)
- `photoURL` (String)
- `shareLiveLocation` (Boolean)
- `liveLocation` (Object) -> `{lat: Number, lng: Number, updatedAt: Timestamp}`

### 3. `posts` (Collection)
Feed principale per `LaPiazza` e `IlCinematografo`. Mix di foto e update testuali.
- `imageUrl` (String - Base64 o CDN URL)
- `caption` (String)
- `decade` (String)
- `location` (Object) -> `{lat: Number, lng: Number}`
- `authorId` (String - mappato su `users.uid`)
- `authorName` (String)
- `timestamp` (Timestamp)
- `likesCount` (Number)
- `commentsCount` (Number)
- `visibilityStatus` (String) -> `"public" | "private" | "scheduled"`
- `visibilityTime` (Number)
- `showInCinematografo` (Boolean)

*(Subcollection)* `posts/{id}/comments`
- `postId` (String)
- `text` (String)
- `authorId` (String)
- `authorName` (String)
- `timestamp` (Timestamp)

### 4. `events`, `chats` (Collections)
Alimentano `IlBivacco` (Eventi) e `L'Alberone` (Chat real-time). Usano gli stessi modelli di ownership rigorosa.

---

## 3. 🔐 Sicurezza, PBAC & RBAC (Regole Firebase Zero-Trust)

La piattaforma usa una Architettura Zero-Trust applicata nativamente tramite le regole Firestore.

1. **Flusso Registrazione Utente (Anti-Bot & Meccanismo Approvazione):**
   - Nuove registrazioni forzate in `accountStatus: "pending"` e `role: "Guest"` tranne se email equivale al Root (`nicolainformatica@gmail.com`).
   - Root utente viene subito promosso a `approved` e ruolo `Root`.

2. **La Gerarchia a 3 Livelli:**
   - **Root:** Livello più alto (`isRoot()`). Può bypassare ogni limite.
   - **Admin:** Può visualizzare nuovi utenti in coda e approvarli. Promuove Guest in Admin.
   - **Guest (`Guest` / Pending):** Confini ristretti a read-only visivi finché in attesa o vuoti, bloccati e non in grado di vedere le collection vere.

3. **Integrità Esplicita:**
   - Qualsiasi `create`/`update` passa per helpers di validazione forzando la corretta scrittura per campi.

---

## 4. 🧩 Moduli Core e Logiche

### 4.1 "Il Baule" Engine di Upload
Gestione batch per immagini, calcoli geometrici per l'inquadratura box e canvas rendering system ("Alpha-Channel Blackout" fix). Filtro visivo matrice Magic Scan simulato traminte filtri css.

### 4.2 Integrazione L'AI (Gemini Vision)
Chiamate API client-side tramite `@google/genai` con chiave salvata reattivamente dal server e isolata in memory. Prompt apposito e dedicato.

### 4.3 "Il Cinematografo" (Slideshow & Gamification)
Usa `useRef` stabili, animazioni pesate, e gamification mechanics togliendo crediti visivi su richiesta bloccati tramite `mode` (inclusa la modalità 'solo_immagini' per UI immersive hide). Assegnazione interattiva database (`users`) di +5 Punti / -2 Punti.

### 4.4 "Il Bivacco" (Event Logistics Engine)
Il Wallet System calcola bilanci su snapshot read live del conto per stabilire i debiti e crediti per evento.

### 4.5 Geolocalizzazione (`LaMappa`)
Doble implementazione react-leaflet. Passaggio dark/light tile automatizzato su observer di classList e aggiornamenti GPS continui ma filtrati e resi obsoleti lato observer dopo time decay precisi.

### 4.6 Privacy, Post Visibility & Gestione Archivio
I frontend di fetch saltano documenti senza timestamp congrui, privacy toggle o switch cinematografo.

---

## 5. 🎨 Theming, UI, & Strategia Viewport
Blocco custom delle overflow a livello flex parent CSS e gestione reattanza mobile/tablet standard Tailwind ma mirata a simulare PWA pura chiusa a "sandbox".
Canvas rendering di particelle legati fuori scope render loop React nativo (confetti like reaction).

---

## 6. 🚀 Gamification, Punti & Altitudine
Incremento atomico nativo Firestore (`increment(N)`) elimina le query prelevatrici e scongiura code incastrate asincrone. Costruzione del profilo in base al cumulativo (sbarramento tag).

---

## 7. 🛠️ Build Pipeline e CI/CD
Deployment continuo da repository github via node/Vite scripts automatizzati. App auto configurata in PWA via webmanifest a compilation avvenuta.
