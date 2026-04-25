# 🛠️ marzio1777 - Technical Architecture & Developer Documentation

This document provides a highly detailed, professional overview of the architectural decisions, data models, algorithms, and technical flows powering the `marzio1777` application. It serves as the single source of truth for developers and contributors.

## 1. 🏗️ Architecture & Tech Stack

`marzio1777` is built as a highly reactive Single Page Application (SPA).
- **Frontend Framework:** React 18 (Functional Components, Hooks), bootstrapped via Vite for HMR and optimized builds.
- **Language:** TypeScript explicitly for strict type-checking on external payloads and DOM refs.
- **Backend as a Service (BaaS):** Firebase ecosystem:
  - **Firestore:** NoSQL state management and relations.
  - **Firebase Auth:** Google OAuth provider identity verification.
  - **Firebase Storage:** Binary blob storage for compressed image assets (if needed, or directly mapped as base64 in initial prototyping).
- **State Management:** React Context API (`AuthContext`) for global states, augmented by local `useState`, `useRef`, and `useEffect` hooks relying on Firebase `onSnapshot` for real-time reactivity without state-management overlays like Redux.
- **Styling Engine:** Tailwind CSS handles utility-first composition. Complex pseudo-states are mapped to standard CSS in `index.css`.
- **Animation:** Framer Motion (`AnimatePresence` for route/component transitions).
- **Icons:** Lucide React.
- **AI Integration:** Google Gemini API (via `@google/genai` or manual fetch depending on implementation) used for `Magic Scan` image caption generation.

---

## 2. 💾 Firestore Data Schema

The database uses a NoSQL document-based structure with normalized global documents and nested subcollections for specific relational features.

### 1. `users` (Collection)
Stores the user private profile, credentials, and RBAC configurations.
- `uid` (Document ID)
- `email` (String) - PII (Protected)
- `apiKey` (String) - Secrets (Protected)
- `displayName` (String)
- `photoURL` (String)
- `role` (String) -> `"Guest" | "Admin" | "Root"`
- `points` (Number) -> Determines gamification levels (Altitude)
- `bio` (String)
- `shareLiveLocation` (Boolean) -> Toggles geolocation tracking
- `createdAt` (Timestamp)

### 2. `user_locations` (Collection) - *Split Collection Pattern*
Stores strictly public geographical presence. Isolated from `users` to prevent PII leakage when sharing locations.
- `userId` (Document ID)
- `displayName` (String)
- `photoURL` (String)
- `shareLiveLocation` (Boolean)
- `liveLocation` (Object) -> `{lat: Number, lng: Number, updatedAt: Timestamp}` used for map presence

### 3. `posts` (Collection)
The core content feed for `LaPiazza` and `IlCinematografo`. Mixes photos and text updates.
- `imageUrl` (String - Base64 or CDN URL)
- `caption` (String)
- `decade` (String) -> "Anni 70", "Anni 80", etc.
- `location` (Object) -> `{lat: Number, lng: Number}`
- `authorId` (String - maps to `users.uid`)
- `authorName` (String)
- `timestamp` (Firestore Server Timestamp)
- `likesCount` (Number)
- `commentsCount` (Number)
- `visibilityStatus` (String) -> `"public" | "private" | "scheduled"` determines rendering engine bypass
- `visibilityTime` (Number) -> Timestamp used when `scheduled` is activated
- `showInCinematografo` (Boolean) -> Granular toggle for the projection room

*(Subcollection)* `posts/{id}/comments`
- `postId` (String)
- `text` (String)
- `authorId` (String)
- `authorName` (String)
- `timestamp` (Timestamp)

### 4. `events` (Collection)
Powers the `IlBivacco` functionality.
- `name`, `description`, `location`, `date` (Strings)
- `authorId`, `authorName`, `timestamp` (Strings/Timestamps)

*(Subcollections of Events)*
- `/items/{itemId}`: `text`, `assignedTo`, `assignedName`, `checked`
- `/expenses/{expenseId}`: `description`, `amount`, `paidBy` (userId), `paidByName`

### 5. `chats` (Collection)
Powers `L'Alberone` (Realtime chat).
- `channelId` (e.g., `"alberone_principale"`)
- `name`, `description`, `createdBy`, `createdAt`

*(Subcollection)* `chats/{id}/messages`
- `text`, `authorId`, `authorName`, `timestamp`

---

## 3. 🔐 Security Architecture (Zero-Trust Firestore Rules)

The platform utilizes a strictly enforced Zero-Trust Architecture implemented natively via Firestore Security Rules.

1. **Explicit Identity & Schema Validation**
   - Every `create` and `update` operation passes through mandatory `isValid*()` helpers to enforce schema integrity and string boundaries (preventing payload poisoning).
2. **Action-Based Granular Updates**
   - Documents are isolated utilizing `affectedKeys().hasOnly([...])`. E.g., users can increment `likesCount` via `update` but are strictly gated from arbitrarily editing `authorId` or escalating their own `role`.
3. **PII Strict Isolation**
   - The `users` collection specifically blocks blanket `allow list:` operations. Profile interactions must use explicit `get()` lookups. Public components querying for users (like Maps) utilize the standalone `user_locations` collection which strips sensitive data (`email`, `apiKey`).
4. **Enforced Query Delegation**
   - Client queries are forced to mirror relational or conditional bounds. Features querying `posts` must explicitly supply `or(where('visibilityStatus', 'in', ['public', 'scheduled']), where('authorId', '==', user.uid))` matching the Firestore rule constraints. Blanket unbounded reads are mathematically denied.
5. **Role-Based Access Control (RBAC)**
   - Roles (`Root`, `Admin`, `Guest`) exist in `/users`. Admin functions look directly at this trusted document (`get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role`). State manipulation of this field is exclusively restricted to Admins.

---

## 4. 🧩 Core Modules & Algorithmic Flows

### 4.1 "Il Baule" Upload & Processing Engine
The upload pipeline is one of the most complex state machines in the app.
- **Batch Processing:** When users drop multiple files (`FileList`), the 0th index is loaded immediately into a `FileReader`. Indices `1` to `N` are sliced and stored into the `fileQueue` array.
- **Recursive Unloading:** Upon successful save or skip, the component shifts the `fileQueue` array, autonomously loading the next `File`.
- **Rotation & Scaling Mathematics:** `rotateSize` calculates the minimum bounding box needed to encompass a rotated image using sine/cosine trigonometry.
- **The "Alpha-Channel Blackout" Fix:** SVGs and transparent PNGs natively resolve as `RGB: 0,0,0` (Black) when parsed into a `image/jpeg` canvas payload. The algorithm fixes this by explicitly invoking `ctx.fillRect(0, 0, finalWidth, finalHeight)` with `#ffffff` (White) *before* drawing the image blob on top.
- **Magic Scan Matrix:** Applies a static CSS canvas filter matrix (`contrast(1.4) saturate(0.8) brightness(1.1)`) simulating a hardware scanner cleanup.

### 4.2 L'AI Integration (Gemini Vision)
To maintain low server overhead and absolute privacy:
- The app utilizes `@google/genai` completely on the client side.
- Configuration API keys are isolated directly in Browser `localStorage` (`gemini_api_key`), managed safely via the `AdminPanel`.
- **Execution Payload:** The processed base64 JPEG from the canvas engine is attached via `inlineData` alongside an Italian-crafted prompt engineered to return a localized, nostalgic tone.

### 4.3 "Il Cinematografo" (Slideshow & Gamification)
A complex presentation layer built to project images in fullscreen.
- **State Management:** Uses React's `useRef` to maintain a stable reference to `filteredPosts` to prevent stale closure bugs inside the `setInterval` used for Autoplay.
- **Animation Constraints:** `mode="wait"` in `<AnimatePresence>` ensures smooth transitions between slides and metadata cards without DOM collisions.
- **Gamification Mechanics:** Metadata overlays are conditionally obscured based on the `mode` state (`indovina_chi`, `indovina_anno`), withholding author or chronological data until a `revealed` flag is tripped.

### 4.4 "Il Bivacco" (Event Logistics Engine)
- **The Wallet System:** Reads the `expenses` subcollection dynamically. A mathematical split function (`(total/partecipanti) - speso`) calculates net debts/credits iteratively via `onSnapshot` listeners to render real-time accounting inside the specific event.

### 4.5 Geocoding & The Mapping System (`LaMappa`)
The geographic data relies on dual implementations of Leaflet.
- **Component:** `react-leaflet` acts as the mapping bridge, defaulting to `Sentieri e Strade (OpenStreetMap)`.
- **Dark Mode Context Injection:** Reacts to the global DOM `classList` for `dark`. When active, it switches the Leaflet tile layer to `CartoDB dark_all`.
- **Location Modal (`IlBaule`):** Taps `navigator.geolocation` async API, uses OpenStreetMap's Nominatim Reverse Geocoding (`search?format=json&q=Query`), and employs manual pinning via `useMapEvents`.
- **Live User Tracking:** Leverages `navigator.geolocation.watchPosition` inside `AuthContext` to broadcast user coordinates to Firestore if `shareLiveLocation` is enabled. `LaMappa` renders these as custom animated pulsing avatars. Stale user locations (older than 15 minutes) are hidden to maintain accuracy.

### 4.6 Privacy, Post Visibility & Gestione Archivio
`marzio1777` features a granular privacy engine running natively across component lists.
- **Global Rendering Condition:** The `<LaPiazza>` and `<IlCinematografo>` engines iterate through docs verifying `visibilityStatus` (`public`, `private`, or `scheduled`) against `visibilityTime` (timestamp diff matching). The user can forcefully bypass validation constraints dynamically on their own content (`if (post.authorId === user.uid)`).
- **Scheduled Releases:** Time-based filtering restricts visibility of queued updates.
- **Gestione Archivio Engine:** Within `ProfiloPersonale.tsx`, users can invoke bulk transactions updating `showInCinematografo` or visibility constraints via `Promise.all` across queried documents simultaneously, along with complete atomic deletion triggers.

---

## 5. 🎨 Theming, UI, & Viewport Strategy

- **Viewport Locking:** The `Layout.tsx` operates on dynamic viewport constraints (`h-[100dvh]`, `min-h-0`). This ensures the `Outlet` correctly establishes its own scrollable context without distending the parent Flexbox container, effectively locking the Sidebar and native viewport for a professional "app-like" feel.
- **Polaroid Aesthetic:** Box shadows and margins form the primary visual identity. In Dark Mode, polaroid variables transition dynamically (e.g., `bg-white` -> `bg-[#111814]`, borders invert to `border-[#24352b]`).
- **Dark Mode Paradigm:** Modifies the global `<html>` class. Tailwind utilizes the `dark:` prefix. The application leverages a curated palette (`#151e18`, `#1a261f`, `#2D5A27`) to evoke a forest aesthetic rather than generic grays.
- **Micro-interactions:** Canvas-based Confetti (`canvas-confetti`) is mathematically spanned over a custom `requestAnimationFrame` loop on interactions like Liking to ensure 60fps performance without locking React's main thread.

---

## 6. 🚀 Gamification, Points & Altitude

Gamification logic ("L'Alberone" and profile badges) leverages Firestore atomic operations.
- `increment(N)` from `firebase/firestore` is explicitly used for adding a Post (+10 pts, +5 bonus for Geolocation) or leaving a Comment (+2 pts). 
- This bypasses concurrency/race-condition issues that would occur if the frontend fetched previous points and patched them.
- Altitude = Base Marzio Altitude (728) + Accumulated Points. Badges natively derived from point thresholds (10, 50, 150).

---

## 7. 🛠️ Build Pipeline, CI/CD & Operational Guidelines

- **Environment Variables:** Must establish `VITE_FIREBASE_*` constraints for deployment. 
- **PWA Configuration:** Provided implicitly by `vite-plugin-pwa`. It generates `manifest.webmanifest` defining `standalone` display modes, enabling Chromium and WebKit mobile browsers to prompt "Install App" to the users' home screens.
- **GitHub Actions (CI/CD Automated Deployments):**
  - **Workflow (`.github/workflows/deploy.yml`):** Implements a declarative CI/CD pipeline triggered by a `push` to `main`.
  - **Node Matrix:** Spins up an `ubuntu-latest` runner executing immutable package installations (`npm ci`), and running Vite build systems.
  - **GitHub Pages Delivery:** Uses the `actions/deploy-pages@v4` action to serve the artifact statically, completely decoupling the hosting infrastructure from the BaaS features.

---
*Maintained by the Neo1777 team. May your code compile on the first try.*
