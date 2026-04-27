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

## 1.5 🎨 UI/UX & Animations (Framer Motion)

The application integrates fluid, enterprise-grade animations using **Framer Motion**:
- **Page Transitions (`Layout.tsx`)**: Leveraging `<AnimatePresence mode="wait">` across routes to achieve smooth cross-fades and 'slide up' staging.
- **Micro-interaction Feedback**: The "Like" button heart employs a multi-step keyframe feedback loop (`scale: [1, 1.15, 1]`) for immediate tactile response, combined with contextual particle effects (e.g. "🍃").
- **Gamification and Count-Ups**: Inside the Personal Profile, progression stats utilize `mode="popLayout"` for numerical transitions fueled by `spring` physics and momentary color shifts to draw attention to value updates seamlessly.
- **Asynchronous Feedback (The Trunk)**: During 'Magic Scan' AI operations, a repeating loading animation (`rotate: 360`, *infinite linear loop*) mitigates wait-time frustration by replacing frozen states with lively, relevant visual feedback.

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
- `accountStatus` (String) -> `"pending" | "approved"`
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

### 4. `events`, `chats` (Collections)
Powers `IlBivacco` (Events) and `L'Alberone` (Real-time chats). Uses similar strict data ownership models.

---

## 3. 🔐 Security Architecture, PBAC & RBAC (Zero-Trust Firestore Rules)

The platform utilizes a strictly enforced Zero-Trust Architecture implemented natively via Firestore Security Rules, centered around a complex Role and Account Status Based Access Control pipeline.

1. **User Onboarding Flow (Anti-Bot & Approval Mechanism):**
   - New registrations are forcefully clamped to `accountStatus: "pending"` and `role: "Guest"` during the initial OAuth mapping in `AuthContext`, unless the user's email strictly equals the hardcoded Root email (`nicolainformatica@gmail.com`).
   - The Root user is immediately constructed as `accountStatus: "approved"` and `role: "Root"`.
   - "Pending" users are blocked at the Firestore Database level. The React frontend mirrors this by halting data reads and presenting an explicitly styled "Accesso in Attesa" overlay in `Layout.tsx`.

2. **The Three Roles Hierarchy:**
   - **Root (`nicolainformatica@gmail.com`):** Absolute highest tier. Handled by explicit rules `isRoot()`. Only Root can perform demotions (`Admin` -> `Guest`) and only Root can approve a pending user directly into an `Admin`.
   - **Admin:** Has the ability to view the internal `users` collection to operate the `AdminPanel`. Can approve a `pending` user into a `Guest`. Can promote an existing `Guest` into an `Admin`. Cannot demote other Admins.
   - **Guest (`Guest` / Pending):** Confined to read-only views on the React frontend, yet specifically blocked from loading main collections (`events`, `chats`, `posts`) due to explicit client-side guards and database rules checking for `accountStatus == 'approved' && role != 'Guest'`.

3. **Explicit Identity & Schema Validation:**
   - Every `create` and `update` operation passes through mandatory `isValid*()` helpers to enforce schema integrity and string boundaries (preventing payload poisoning).

4. **Action-Based Granular Updates:**
   - Documents are isolated utilizing `affectedKeys().hasOnly([...])`. E.g., users can increment `likesCount` via `update` but are strictly gated from arbitrarily editing `authorId` or escalating their own `role` or `accountStatus`. Only Admin/Root users can manipulate these two fields via strictly crafted rules (`isAdminOrRoot()` combined with key-checking logic).

5. **PII Strict Isolation & Blanket Guarding:**
   - The `users` collection specifically blocks blanket `allow list:` operations except for Admins (`allow list: if isSignedIn() && isAdminOrRoot()`), acting as the primary PII and RBAC shield. Public components querying for users (like Maps) utilize the standalone `user_locations` collection which strips sensitive data (`email`, `apiKey`).

6. **Notification/Queue Filters:**
   - Admins receive UI badging on the navigation bar (e.g., `Gestione (2)`) indicating pending user registrations relying on a precise Firestore `where("accountStatus", "==", "pending")` snapshot listener.

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
- **Gamification & Viewing Modes:** Metadata overlays are conditionally obscured based on the `mode` state (including `solo_immagini` for zero-UI immersion, `indovina_chi`, `indovina_anno`). For games, the app dynamically generates multi-choice buttons, prompting users to guess information, automatically calling the backend (`users` collection) to allocate +5 points on success or deduct 2 points on failure inside `IlCinematografo.tsx`.

### 4.4 "Il Bivacco" (Event Logistics Engine)
- **The Wallet System:** Reads the `expenses` subcollection dynamically. A mathematical split function (`(total/partecipanti) - speso`) calculates net debts/credits iteratively via `onSnapshot` listeners to render real-time accounting inside the specific event.

### 4.5 Geocoding & The Mapping System (`LaMappa`)
The geographic data relies on dual implementations of Leaflet.
- **Component:** `react-leaflet` acts as the mapping bridge, defaulting to `Sentieri e Strade (OpenStreetMap)`.
- **Dark Mode Context Injection:** Reacts to the global DOM `classList` for `dark`. When active, it switches the Leaflet tile layer to `CartoDB dark_all`.
- **Location Modal (`IlBaule`):** Taps `navigator.geolocation` async API, uses OpenStreetMap's Nominatim Reverse Geocoding (`search?format=json&q=Query`), and employs manual pinning via `useMapEvents`.
- **Live User Tracking:** Leverages `navigator.geolocation.watchPosition` inside `AuthContext` to broadcast user coordinates to Firestore if `shareLiveLocation` is enabled. `LaMappa` renders these as custom animated pulsing avatars. Stale user locations (older than 15 minutes) are hidden to maintain accuracy.
- **Dynamic Filtering Engine:** An absolute positioned overlay panel processes arrays of active documents to construct unique Decades and Authors sets (`Array.from(new Set(...))`). Array `filter` logic selectively masks Map Markers while persisting `react-leaflet` instances, ensuring minimal redraw overhead.


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
- **Customizable Micro-interactions:** Reaction animations (likes) are completely modular. Parameters like Icon (`❄️`, `🍃`, or `none` for a simple heartbeat scale animation), Color interpolation schemas (`rgba`), distance vectors (`y`), and velocity (`duration`) are bound directly to user profile payload inside `Firestore`. The Like mechanic itself enforces a single-like limit via toggling (`arrayUnion` and `arrayRemove` on the `likedBy` array in Firestore), preventing infinite upvoting spam and ensuring deterministic transaction accuracy using `increment(1)`/`increment(-1)` combined with proper RBAC zero-trust validation.

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
