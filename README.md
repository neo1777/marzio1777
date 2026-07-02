# marzio1777

PWA social "di paese" per la comunità di **Marzio**: una piazza digitale dove
conservare i ricordi del paese, organizzare eventi, giocare a cacce al tesoro
geolocalizzate e condividere musica. SPA **React 19 + Vite + TypeScript +
Tailwind v4 + Firebase**, distribuita come Progressive Web App.

🔗 **Live:** https://neo1777.github.io/marzio1777/

> Nata come app per una singola comunità (Marzio = istanza zero, in produzione).
> I valori di dominio sono centralizzati in [`src/config/tenant.ts`](src/config/tenant.ts):
> è il primo passo verso una piattaforma istanziabile per altre comunità.

## Funzionalità

- **La Piazza** — bacheca social con post, like e commenti.
- **Il Bivacco** — eventi con RSVP e spese condivise.
- **Il Baule** — caricamento foto con cropper.
- **La Mappa** — Leaflet con posizione live.
- **Il Cinematografo / L'Alberone / Profilo / Admin / Istruzioni**.
- **Il Campo dei Giochi** — caccia al tesoro AR geolocalizzata + quiz a host rotativo.
- **L'Ainulindalë** — modulo audio: biblioteca locale (IndexedDB), sessioni DJ e
  trasferimento P2P via WebRTC (Firestore solo come signaling).

Sicurezza zero-trust con ruoli `Root | Admin | Guest` e stati `pending | approved`,
applicati lato `firestore.rules` (con suite di test dedicata).

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · Firebase (Firestore + Auth +
Cloud Functions + FCM) · react-leaflet · Framer Motion · Web Audio API · WebRTC.

## Avvio locale

**Prerequisiti:** Node.js.

1. Installa le dipendenze: `npm install`
2. Copia `.env.example` in `.env.local` e imposta le variabili `VITE_FIREBASE_*`
   (e, opzionale, `GEMINI_API_KEY`).
3. Avvia: `npm run dev` (Vite su `:3000`).

Altri comandi: `npm run build` (produzione), `npm run preview`, `npm run lint`
(typecheck), `npm test` (unit, Vitest). I test delle regole Firestore girano
sull'emulatore (richiedono JDK 21+) — vedi `CLAUDE.md`.

> Il base path è `/marzio1777/` (GitHub Pages); per ospitarlo altrove imposta
> `VITE_BASE_PATH` (es. `VITE_BASE_PATH=/ npm run build`).

## Documentazione

Specifiche estese in [`public/docs/`](public/docs/) (TECHNICAL_DOCS, GAMING_SYSTEM,
security_spec, in IT/EN) e `docs/3-spec-originali/AINULINDALE_TECHNICAL_SPEC.md`, `docs/3-spec-originali/MIGRATION.md`.

## Licenza

[MIT](LICENSE) © 2026 neo1777
