# 🌲 marzio1777
**La Macchina del Tempo Digitale per i Ricordi di Montagna**

Benvenuto in **marzio1777**, il progetto che prende i ricordi nostalgici (le estati al fresco, i tornanti in salita, l'odore di polenta, le foto sbiadite degli anni '80) e li sbatte prepotentemente nel Web 3.0 (o quasi). 

Questo non è un semplice social network. È una **Piazza Comunale digitale**, un raccoglitore di memorie dove i villeggianti e i veri "marziesi" possono conservare la storia del paese prima che le tarme mangino i vecchi album fotografici.

---

## 🗺️ Cosa c'è dentro? (Le Attrazioni)

### 📸 1. La Piazza (Il Feed)
Il luogo di ritrovo virtuale. Niente algoritmi tossici o influencer che vendono tisane dimagranti, solo polaroid quadrate dei decenni passati.
- **Filtri Temporali:** Viaggia nel tempo istantaneamente schiacciando "Anni 70", "Anni 80", o "Anni 90".
- **Esplosione di Cuori:** Metti mi piace a una foto e goditi un'esplosione di coriandoli a forma di foglie e fiocchi di neve (perché a Marzio o nevica o ci sono le foglie secche).
- **Chiacchiere di Paese:** Commenta gli aneddoti per guadagnare Punti Altitudine.

### 🧳 2. Il Baule (Centro di Caricamento)
Non un semplice modulo di upload, ma un vero e proprio laboratorio di sviluppo fotografico.
- **Buttaci dentro tutto:** Trascina 10 foto dal tuo PC, la coda intelligente te le farà scorrere una ad una senza farti venire il tunnel carpale.
- **Ritaglio Libero:** Polaroid? Panorama? Adatta la geometria o lascia la foto "Così com'è".
- **Il "Ricordo AI" 🤖:** Hai scansionato una foto ma sei troppo pigro per scriverci una descrizione strappalacrime? Clicca sulla scintilla e la nostra *Intelligenza Artificiale Nostalgica* capirà cosa c'è nella foto e scriverà la didascalia perfetta in dialetto/stile locale.
- **Puntina Mappa Avanzata:** Aggancia il GPS, cerca "Via Roma" o piazza il pin a mano sfogliando la topografia.

### 🧭 3. La Mappa (Cartografia Storica)
Tutti i ricordi piazzati fisicamente su una mappa navigabile di Marzio. Abbiamo integrato un selettore di strati (Layers) assurdo:
- **Esploratore:** Satellite iper-dettagliato per spiare il tetto del vicino.
- **Sentieri:** Mappe open-source perfette per vedere dove finiva la passeggiata fungaiola nel '92.
- **Visione Notturna:** Per guardare le foto alle 3 di notte fingendo di dormire.

### 🌳 4. L'Alberone (Gamification)
Più foto carichi e commenti, più punti accumuli. L'albero cresce con te. È letteralmente un Tamagotchi arboreo alimentato a nostalgia.

---

## 📱 Come Installare l'App (PWA - iPhone, Android, PC)

Questa non è solo una pagina web. Abbiamo infuso la magia delle **Progressive Web App (PWA)**, il che significa che puoi trasformarla in un'App nativa sul tuo dispositivo in 10 secondi netti:

- **Su iPhone (Safari):** Apri il sito web, tocca l'icona "Condividi" (il quadrato con la freccetta in su) e scegli **"Aggiungi alla schermata Home"**. Fatto.
- **Su Android (Chrome):** Appena apri il sito, il browser dovrebbe chiederti con un popup "Installa App". Se non lo fa, premi i 3 puntini in alto a destra e fai pappa su **"Installa app"**.
- **Su PC/Mac:** Sulla barra degli indirizzi di Chrome o Edge apparirà una piccola icona col simbolo di un monitor e una freccetta. Schiacciala e il sito diventerà un programma Desktop indipendente!

---

## 🛠️ Come avviare la baracca (Istruzioni per Sviluppatori)

Vuoi mettere le mani sotto il cofano di questa gloriosa Fiat Panda 4x4 del codice?

1. **Assicurati di avere Node.js installato.**
2. **Installa i pacchetti (metti benzina):**
   ```bash
   npm install
   ```
3. **Crea il tuo file `.env.local`** (opzionale, ma utile se vuoi gestire le chiavi backend in dev). 
4. **Accendi il motore:**
   ```bash
   npm run dev
   ```
5. Apri `http://localhost:3000` e respira l'aria pura di montagna.

### 🤖 Auto-Deploy Globale (GitHub Actions)
Il progetto è già cablato col filo spinato a GitHub Pages. 
Dietro le quinte c'è un maggiordomo instancabile (un file chiamato `.github/workflows/deploy.yml`) che aspetta solo una cosa: ogni *Push* che fai sul branch `main` scatenerà i server di GitHub per compilare e lanciare online la tua ultima versione all'istante all'interno della piattaforma *GitHub Pages*. Niente abbonamenti server, si vive di rendita open-source.

*Tip per gli Admin:* Per far funzionare lo scrittore AI, vai nel **Pannello Root** (icona ingranaggio in basso a sinistra) e incolla la tua API Key di Gemini. Senza di quella, il robot è muto come un pesce siluro.

---

## 🎩 Easter Eggs & Fun Facts
- **Il Bug degli SVG Neri:** Gli SVG trasparenti diventavano inquietanti quadrati neri. Il motore Canvas (sotto il cofano de *Il Baule*) ora stende un intonaco bianco digitale su ogni immagine priva di sfondo prima di appenderla.
- **Il tema scuro:** Non è grigio, è foresta. I colori dark mode si ispirano al buio tra i pini (`#111814` e `#080d0a`).

*Sviluppato con amore, TypeScript e parecchia polenta da Neo1777 (e il suo fido assistente AI).*
