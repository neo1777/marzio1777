# 🌲 Marzio1777
**La Macchina del Tempo Digitale per i Ricordi di Montagna**

Benvenuto in **marzio1777**, il progetto che prende i ricordi nostalgici (le estati al fresco, i tornanti in salita, l'odore di polenta, le foto sbiadite degli anni '80) e li sbatte prepotentemente nel Web 3.0 (o quasi). 

Questo non è un semplice "sito di foto". È una **Piazza Comunale digitale**, un raccoglitore di memorie dove i villeggianti e i "marziesi" doc possono conservare la storia del paese, organizzare eventi e ritrovarsi a fare salotto. E siccome non volevamo una cosa noiosa, ci abbiamo infilato punti, gagliardetti e giochi di società!

---

## 🗺️ Cosa c'è dentro? (Le Attrazioni)

### 📸 1. La Piazza (Il Feed Social)
Il luogo di ritrovo virtuale. Niente algoritmi tossici, solo polaroid quadrate del passato e aggiornamenti sui nostri ritrovi.
- **Filtri Temporali:** Viaggia nel tempo visualizzando solo foto degli "Anni 70", "Anni 80" ecc.
- **Esplosione di Cuori:** Metti mi piace a una foto e goditi un'esplosione di coriandoli a forma di foglie e fiocchi di neve (perché a Marzio o nevica o ci sono le foglie secche).
- **Commenti e Discussioni:** Chiacchiera, commenta, e guadagna "Punti Altitudine".

### 🏕️ 2. Il Bivacco (Eventi e Grigliate)
La bacheca ufficiale in cui si programmano i ritrovi e gli eventi!
- **Nuovo Appuntamento:** Fissa un punto di ritrovo, scegli la data, invita chi vuoi.
- **Chi siamo e quanti siamo:** RSVP interattivo. Indichi in quanti partecipate, così non si compra troppa polenta.
- **La Lista della Spesa Estrema:** Chi porta cosa? "Assegna a me" un elemento, o inseriscilo per qualcun altro. Una checkbox ti dirà se è tutto pronto.
- **Il Wallet "Taccuino dei Conti":** Abbiamo diviso il conto in pizzeria o per la grigliata? Ognuno butta giù le spese che ha sostenuto e il sistema ti tira una riga matematica per dividere il conto e dirti chi deve dare i soldi a chi! 

### 🎞 3. Il Cinematografo (La Sala Proiezioni)
La nostra sala Cinema! Una galleria fotografica a schermo intero creata appositamente per le sere tra noi da essere proiettata su TV.
- **Esposizione & Autoplay:** Lascialo girare pigramente o sfoglia con la tastiera la nostra vita. La "card" in in sovrapposizione riporta i crediti e puoi nasconderla come se fosse un sipario per far spazio alla foto.
- **Filtri Rapidità:** Sfoglia la collezione unicamente focalizzata su chi l'ha caricata o scegli l'anagrafe (es. Guarda tutte le foto Anni 90 che non hai mai visto caricate da Mario Rossi).
- **Modalità "Solo Immagini":** Attiva questa modalità per nascondere integralmente metadati, crediti ed interfacce, godendoti un'esperienza visiva completamente immersiva in full-screen.
- **Giochi di Gruppo ("Gamification"):** Mettiti alla prova con "Indovina Chi!" e "Indovina l'anno!". Scegli tra le 4 opzioni a schermo per svelare i dettagli della foto: una risposta corretta ti farà guadagnare +5 Punti Altitudine, ma un errore te ne farà perdere -2!

### 🧳 4. Il Baule (Centro di Caricamento)
Non un semplice modulo di upload, ma un vero e proprio laboratorio artigianale.
- **Senza confini:** Trascina tantissime foto alla volta dal tuo PC: la coda di sviluppo automatizzata.
- **Il "Ricordo AI" 🤖:** Usa lo scanner "Scintilla Magic Scan"! Non riesci a spiegare a parole cos'è quel casale? L'AI farà l'identikit descrivendolo in puro vocabolario "montanaro/dialettale" e lo compilerà per te!
- **Puntina Mappa Avanzata:** Aggancia il tag GPS sfogliando la mappa digitale!

### 🧭 5. La Mappa (Cartografia dei Ricordi)
Tutte le memorie non volano nel vento ma atterrano spidate su mappa locale!
- Cerca il chiosco o la via dove hai caricato le foto e la mappa le raggrupperà mostrando i classici pointer numerici interattivi. Clicca sui bollini e tuffati dritti nel post di partenza!
- **Condivisione in Tempo Reale:** Accendi la spunta nel tuo profilo e i tuoi amici potranno vedere la tua posizione "live" sulla mappa quando sei in giro per il paese ad esplorare.

### 🌳 6. L'Alberone (Bacheca In Diretta)
La banchisa sotto l'albero. Si tratta di un'autentica stanzetta con chat real-time sincronizzata ("Sulle panchine sotto l'albero") per scrivere quattro scemenze super rapide in stile telegram a colpo d'occhio senza dover aprire il cellulare!  

### 🪪 7. Il Profilo e Gestione Archivio (Privacy e Gamification)
- **Gestione Archivio:** Non tutto deve finire subito in Piazza! Nascondi le tue foto imbarazzanti, decidile se mostrarle temporaneamente (a tempo), nascondile dal Cinematografo o applica permessi di massa a tutte le tue avventure passate.
- **Altitudine ed Esperienza:** Un videogioco nella vita reale. Punti Altitudine accumulati interagendo, commentando o caricando foto! Se sali abbastanza conquisterai dei Gagliardetti fantastici da mostrare in giro tipo: *Il Villeggiante, Il Turista Esperto, Il Sindaco di Marzio*. 

---

## 🔒 Sicurezza, Ruoli & Architettura Zero-Trust
Dobbiamo proteggere il patrimonio storico e i dati personali della nostra piccola comunità. Il sistema utilizza una complessa logica basata su ruoli (RBAC) e la convalida delle richieste in tempo reale:

- **La Porta della Città (Account Pending):** Quando un utente fa il login la prima volta, non entra subito! Diventa uno stato *In attesa (Pending)*. Per evitare bot o ficcanaso, l'applicazione gli mostra subito un cancello chiuso. Nel "Pannello Gestione", gli amministratori vedranno un badge rosso di notifica con i nuovi "immigrati" in attesa e potranno valutare se farli entrare in paese.
- **Filastrocca dei Permessi (Ruoli in App):**
  - **Guest (Turista di Passaggio):** Una volta approvati come Guest, gli utenti entrano in App ma vedono solo... l'applicazione stessa. A livello di codice, a un Guest è severamente precluso l'accesso e la lettura di qualsiasi dato generato dalla comunità (post, chat, utenti, eventi, mappe). Può navigare le pagine ma queste risulteranno completamente "vergini". L'interfaccia, inoltre, sfuma tutto con un overlay esplicito dicendogli che, finché un amministratore non ritiene opportuno promuoverlo, non c'è nulla da fare.
  - **Admin (Il Sindaco/Sceriffo):** Usano l'App nella sua interezza. Interagiscono, commentano, postano. Hanno un "Pannello di Gestione" con cui valutano i Pending. Possono promuovere i volti noti da Guest ad Admin, e possono approvare l'ingresso dei nuovi arrivati "Pending" nominandoli "Guest". Non possono fare danni peggiori (nessun downgrade dagli Admin in giù).
  - **Root (Il Monarca Illuminato):** C'è un solo creatore (nicolainformatica). Il Root non va in panchina, supervisiona. Può fare tutto quello che fa un Admin ma aggiunge poteri divini: approvare un Pending rendendolo direttamente Admin, riportare all'ovile un cattivo Admin retrocedendolo a Guest. Solo il Root è in cima alla catena alimentare dell'App. Nessuno lo scalza.

- **Regole Firestore Invalicabili:** Questo filtro non è visivo, è blindato ai livelli di "Database Zero-Trust" (RBAC nativo backend). Chiunque tenti di agire oltre al proprio stato viene rifiutato.
- **Split Collection (Privacy PII):** I dati sensibili (come la tua email o le chiavi) sono archiviati in cassaforti separate e illeggibili; solo la tua presenza pubblica per "La Mappa" viene trasmessa.

---

## 📱 Come Aggiungere l'App al Telefono (PWA)

Puoi installarci facilmente senza intasare lo Store!

- **iOS / iPhone (su Safari):** Apri l'app in Safari > Tasto centrale (Quadrato con freccia ⬆️) > **"Aggiungi alla schermata Home"**.
- **Android (su Chrome):** Apri l'app > I 3 Puntini in alto ⠇ > **"Aggiungi a schermata Home / Installa l'App"**.
- Apparirà la nostra icona sul tuo smartphone ed entrerai saltando del tutto le finestre dei browser!

---

## 🛠️ Come Avviare l'App "Offline" o per Sviluppo (Istruzioni per l'Hacker del Paese)

1. **Assicurati di usare Node.js.**
2. **Scarica i Pacchetti:**
   ```bash
   npm install
   ```
3. **Piazzate il vostro file speciale (chiavi DB etc)** `.env.local`  
4. **Accendiamo tutto:**
   ```bash
   npm run dev
   ```
5. Ora sei collegato su `http://localhost:3000`.

*Pro-Tip:* Il bot dell'AI (per descrivere le foto) richiede che nel menu Gestione Root (visibile agli Admin/Root) inseriate la chiave segreta dell'API Gemini. Senza non respira!

---

*Ideato a Marzio, scritto con codice, sudore ed amato da Neo1777.*
