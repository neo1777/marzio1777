# 🛠️ marzio1777 — Technical Architecture & Developer Documentation

This document provides a professional, highly detailed overview of the architectural decisions, data models, algorithms and technical flows powering the `marzio1777` application. It serves as a single source of truth for developers and contributors.

*Last revised: May 2026 — integration of The Game Field module (Concept A — Memory Hunt, Concept B — Bivouac Quiz) and L'Ainulindalë module (personal audio Library, Choir Sessions, P2P transfer via WebRTC).*

## 1. 🏗️ Architecture & Tech Stack

`marzio1777` is built as a highly reactive Single Page Application (SPA).
- **Frontend Framework:** React 18 (Functional Components, Hooks), developed via Vite for HMR and optimized builds.
- **Language:** TypeScript explicitly used for rigorous type-checking on external payloads and DOM references.
- **Backend as a Service (BaaS):** Firebase ecosystem:
  - **Firestore:** NoSQL state and relations management. Offline persistence via `persistentLocalCache` (modern Firebase v12+ API, replacing the deprecated `enableIndexedDbPersistence`).
  - **Firebase Auth:** Identity verification via Google OAuth provider.
  - **Firebase Storage:** Binary archival for compressed image assets. **NOT used for audio files** — L'Ainulindalë Themes live exclusively in user-side local IndexedDB, see §4.12.
- **State Management:** React Context API (`AuthContext`) for global state, augmented by local hooks `useState`, `useRef`, and `useEffect` relying on Firebase's `onSnapshot` for real-time reactivity, without external libraries like Redux.
- **Styling Engine:** Tailwind CSS handles utility-first composition. Complex states are mapped to standard CSS in `index.css`.
- **Animations:** Framer Motion (`AnimatePresence` for transitions between routes and components).
- **Icons:** Lucide React.
- **Maps:** react-leaflet 5.x on Leaflet 1.9.x.
- **AI Integration:** Google Gemini API for the `Magic Scan` image description generation.
- **Confetti & Particles:** `canvas-confetti` (reused for like feedback, Concept A captures, quiz reveals, Walkman capture particles).
- **Local Storage:** **Native IndexedDB** (no Dexie, no idb library) for the Personal Audio Library.
- **Audio:** Native **Web Audio API** for playback, EQ, visualizer.
- **P2P Transfer:** Native **WebRTC** with Firestore-based signaling (no PeerJS, no simple-peer, no dedicated signaling server).
- **Lock Screen & Background Audio:** Native **Media Session API** + **Wake Lock API**.

> **"Zero-New-Dependencies" philosophy:** the introduction of all post-core modules (Game Field, L'Ainulindalë) **adds zero npm dependencies**. The AR layer is built from native browser APIs (`navigator.mediaDevices.getUserMedia`, `DeviceOrientationEvent`, `navigator.wakeLock`, `navigator.vibrate`). Geolocation via `Geolocation.watchPosition`. Geo math (Haversine, disk point picking) as internal pure utilities. WebRTC P2P, IndexedDB, ID3 parsing, Web Audio Engine, Media Session — all on native APIs, zero npm. Decisions documented in §4.7-§4.14 with full technical rationale. Total bundle delta (Game Field + L'Ainulindalë): **~70KB minified+gzipped**.

---

## 1.5 🎨 Animations and UI/UX (Framer Motion)

The application integrates fluid enterprise-grade animations using **Framer Motion**:
- **Page Transitions (`Layout.tsx`)**: `<AnimatePresence mode="wait">` per-route with crossfade and 'slide up' effects.
- **Feedback Micro-interactions**: The "Like" (heart) button applies a multi-step feedback (`scale: [1, 1.15, 1]`) for instant tactile response, plus specific particle effects ("🍃" in LaPiazza).
- **Gamification and Count-Ups**: In the Personal Profile, statistics use `mode="popLayout"` for numeric transitions supporting CountUp with `spring` physics and short colorization variations to draw attention to progress.
- **Async Management (Il Baule)**: During AI 'Magic Scan', cyclic loading visual feedback (`rotate: 360`, *infinite linear loop*) improves UX during invisible waits, avoiding "frozen screen" frustration.
- **AR Capture Layer (The Game Field):** The virtual object floats over the video stream with a `motion.div` looped animation (random but deterministic-per-round path) and applies parallax via `useDeviceOrientation` when available. Capture concludes with `scale + opacity → 0` paired with a `canvas-confetti` burst proportioned to the object's points value.
- **Quiz Distribution Bars (Concept B):** after the round reveal, the percentage distribution bars for the 4 options animate in with `whileInView` and differentiated `springs` to give the "rising as you watch" sensation, with the correct bar pulsing.
- **Vinyl Spinning (L'Ainulindalë):** the Walkman full-screen player applies a continuous 0→360° rotation in 6s loop on the cover (CSS animation for efficiency, suspended when track is paused). The waveform visualizer reacts to Web Audio's `AnalyserNode` in real-time.
- **Quiz Wizard Steps (Concept B):** step-by-step transitions in `QuizHostCreateRound` with directional fade+slide (forward = slide left, back = slide right).
- **Reduced Motion:** every animation in the games and audio modules respects `useReducedMotion()` from Framer Motion. When active, all infinite loops, parallax and bounce are replaced by static transitions or 0-1 reductions.

---

## 2. 💾 Firestore Data Schema

The database uses a NoSQL document-based structure with normalized global documents and nested subcollections for relational features.

### 1. `users` (Collection)
Stores private profile, credentials, and RBAC config.
- `uid` (Document ID)
- `email` (String) — Sensitive Data (Protected)
- `apiKey` (String) — Sensitive Data (Protected)
- `displayName` (String)
- `photoURL` (String)
- `role` (String) → `"Guest" | "Admin" | "Root"`
- `accountStatus` (String) → `"pending" | "approved"`
- `points` (Number) → Determines Gamification levels (Altitude). Incremented atomically via `increment()` **also** by Concept A captures, Concept B correct answers (with event multiplier applied), and L'Ainulindalë played music proposals.
- `bio` (String)
- `shareLiveLocation` (Boolean) → Toggles geolocation tracking
- `createdAt` (Timestamp)

### 2. `user_locations` (Collection) — *Split Collection Pattern*
Strictly stores public geographic presence. Isolated from `users` to prevent PII leakage.
- `userId` (Document ID)
- `displayName` (String)
- `photoURL` (String)
- `shareLiveLocation` (Boolean)
- `liveLocation` (Object) → `{lat: Number, lng: Number, updatedAt: Timestamp}`

### 3. `posts` (Collection)
Main feed for `LaPiazza` and `IlCinematografo`. Mix of photos and text updates.
- `imageUrl` (String — Base64 or CDN URL)
- `caption` (String)
- `decade` (String)
- `location` (Object) → `{lat: Number, lng: Number}`
- `authorId` (String — mapped to `users.uid`)
- `authorName` (String)
- `timestamp` (Timestamp)
- `likesCount` (Number)
- `commentsCount` (Number)
- `visibilityStatus` (String) → `"public" | "private" | "scheduled"`
- `visibilityTime` (Number)
- `showInCinematografo` (Boolean)

*(Subcollection)* `posts/{id}/comments`
- `postId`, `text`, `authorId`, `authorName`, `timestamp`

### 4. `events`, `chats` (Collections)
Power `IlBivacco` (Events) and `L'Alberone` (Real-time chat). Use the same strict ownership models.

### 5. `game_events` (Collection) — *The Game Field Module*
Game-type-agnostic model: the same schema covers both treasure hunt (Concept A) and quiz (Concept B), with two type-specific config sub-structures. Designed explicitly to be extensible to future concepts.

- `id` (Document ID)
- `type` (String) → `"treasure_hunt" | "photo_quiz"` — *immutable after create*
- `status` (String) → `"draft" | "scheduled" | "lobby" | "active" | "completed" | "aborted"` — transitions controlled by rules
- `title` (String, ≤100 char)
- `description` (String, ≤500 char)
- `organizerId` (String — `users.uid`) — *immutable after create*
- `createdAt` (Timestamp)
- `startTime` (Timestamp) — lobby opening
- `scheduledKickoff` (Timestamp) — transition to `active`
- `endTime` (Timestamp | null) — null = ends on full collection or manually
- `completedAt` (Timestamp | null)
- `pointsMultiplier` (Number, 0.5..5.0)
- `visibilityOfOthers` (Boolean) — per-event opt-in for live positions of other players
- `invitedUserIds` (Array<String>, max 100)
- `treasureHuntConfig` (Object | null) — populated only if `type === 'treasure_hunt'`
- `photoQuizConfig` (Object | null) — populated only if `type === 'photo_quiz'`, contains among others `currentHostId` for the rotation system
- `currentParticipantsCount` (Number) — denormalized
- `totalItemsCount` (Number, optional)
- `itemsCollectedCount` (Number, optional)
- `currentRound` (Number, optional) — current round number (1-indexed). Combines with `roundNumber` on child docs to identify the active round.
- `roundsPlayed` (Number, optional)
- `finalLeaderboard` (Array<LeaderboardEntry>, optional) — **immutable embedded** populated at `active → completed` transition. Ordered by `points DESC`. Once written, rule guarantees it cannot be modified. See §10 for rule details.

*(Subcollection)* `game_events/{eventId}/items` — *treasure_hunt only*
Virtual objects scattered on the map. `lat/lng/points/templateId` immutable after create.
- `id`, `templateId`, `emoji`, `label`, `points`, `captureRadius`
- `lat`, `lng` — *immutable*
- `status` → `"spawned" | "collected" | "expired"`
- `spawnedAt`, `collectedBy`, `collectedAt`
- `collectedAtLat`, `collectedAtLng` — coordinates declared by the player at capture moment, written in atomic transaction for audit log and ex-post investigation of "The Teleporter"
- `legacyPostId` (optional, Legacy Posts mode)

*(Subcollection)* `game_events/{eventId}/participants`
RSVP and individual presence. Auto-populated via cloud function (future) or created from client on accept invite.
- `userId` (Document ID), `displayName`, `photoURL`
- `status` → `"invited" | "joined" | "declined" | "kicked"`
- `invitedAt`, `respondedAt`, `joinedAt`, `leftAt`
- `shareLocationDuringEvent` (Boolean) — per-user override of event setting

*(Subcollection)* `game_events/{eventId}/leaderboard`
Real-time score during the event. One doc per participant. **The final snapshot is written as embedded array `finalLeaderboard` directly on the parent `game_events/{eventId}` document — see above.** The `leaderboard/{userId}` sub-collection remains only for real-time updates during `status: 'active'`; there is no longer a separate `leaderboard/final` document.
- `userId`, `displayName`, `photoURL`
- `points` (Number) — accumulated during the event
- `captures` (Number, treasure_hunt)
- `correctAnswers` / `totalAnswers` / `averageResponseMs` (photo_quiz)

*(Subcollection)* `game_events/{eventId}/quizRounds` — *photo_quiz only*
One doc per quiz round.
- `id`, `roundNumber`, `postId` (legacy/optional), `questionType`, `questionText`
- `sourcePostId` (String | null) — **new field**: id of the post from which the question was derived or inspired. Populated by the `QuizHostCreateRound` wizard (manual composition in MVP). In Phase 2, will be populated by the automatic generators in `quizGenerators.ts` with no schema migration.
- `options` (String[4]) — shuffled
- `startedAt`, `endsAt`, `revealedAt` (null pre-reveal)
- `hostId`

*(Sub-Sub-Collection)* `game_events/{eventId}/quizRounds/{roundId}/secret/correctness`
**Separate vault for the correct answer**: `correctIndex` is not readable by standard participants, only by `currentHostId`/Organizer/Root. At reveal, the value is copied into the parent doc, where rules then make it readable by all.

*(Sub-Sub-Collection)* `game_events/{eventId}/quizRounds/{roundId}/answers`
One answer per participant per round. `submittedAt` must be `< endsAt` (anti-cheat). `pointsAwarded` evaluated post-reveal.

### 6. `audio_sessions` (Collection) — *L'Ainulindalë Module*
DJ session opened by an Admin/Root, during which participants propose musical Themes to the shared queue.

```typescript
interface AudioSession {
  id: string;                        // doc ID
  type: 'audio_session';             // discriminator
  djId: string;                      // users.uid (Admin/Root) — IMMUTABLE
  djName: string;                    // denormalized
  djPhotoURL: string;
  title: string;
  description?: string;
  status: 'open' | 'closed';         // immutable to 'closed'
  mode: 'auto' | 'manual';           // DJ can toggle during 'open'
  createdAt: Timestamp;              // IMMUTABLE
  closedAt: Timestamp | null;
  
  // Now playing (denormalized for listeners)
  currentQueueItemId: string | null;
  currentTrackTitle: string | null;
  currentTrackArtist: string | null;
  currentTrackDurationMs: number | null;
  currentTrackStartedAt: Timestamp | null;
  
  rules: {
    maxQueuedPerUser: number;         // default 2
    bonusPerHundredPoints: number;    // default 1
    allowDuplicates: boolean;         // default false
    autoSkipOfflineProposers: boolean;
  };
  
  participantCount: number;
  queuedCount: number;
  playedCount: number;
  
  linkedGameEventId?: string | null;  // optional link to a game_event
  
  finalStats?: {
    totalDurationMs: number;
    totalTracksPlayed: number;
    participantsCount: number;
    topProposers: Array<{ userId, displayName, tracksPlayed }>;
    closedAt: Timestamp;
  };  // populated at open → closed transition, IMMUTABLE
}
```

*(Subcollection)* `audio_sessions/{sessionId}/queue/{itemId}`
Theme proposed by a user to the shared queue.

```typescript
interface QueueItem {
  id: string;
  proposedBy: string;                // IMMUTABLE
  proposedByName: string;
  proposedByPhotoURL: string;
  proposedAt: Timestamp;
  
  // Track metadata (audio bytes are NOT here, they live in proposer's IndexedDB)
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string;
  trackYear?: number;
  trackDurationMs: number;
  trackCoverDataUrl?: string;        // base64 ≤ 50KB (embedded album art)
  
  // Reference to track in proposer's Library
  localTrackId: string;              // proposer-side IndexedDB id, IMMUTABLE
  
  status:
    | 'queued' | 'transferring' | 'ready' | 'playing'
    | 'played' | 'skipped' | 'failed';
  
  position: number;                  // FIFO order, reorderable by DJ
  
  transferStartedAt?: Timestamp;
  transferCompletedAt?: Timestamp;
  transferFailureReason?: string;
  
  pointsAwarded?: number;            // assigned at 'played'
}
```

*(Subcollection)* `audio_sessions/{sessionId}/participants/{userId}`
Same pattern as `game_events.participants`: presence tracking, `lastSeenAt` heartbeat, `tracksProposed` / `tracksPlayed` counters.

*(Subcollection)* `audio_sessions/{sessionId}/signaling/{userId}`
WebRTC signaling channel for P2P transfer. Very short lifetime (deleted at established connection or after 60s idle). See §4.14.

### Recommended indexes
```
game_events:                         (status ASC, scheduledKickoff DESC)
game_events:                         (organizerId ASC, status ASC)
game_events/.../items:               (status ASC, spawnedAt ASC)
game_events/.../leaderboard:         (points DESC)
game_events/.../participants:        (status ASC)

audio_sessions:                      (status ASC, createdAt DESC)
audio_sessions:                      (djId ASC, status ASC)
audio_sessions/.../queue:            (status ASC, position ASC)
audio_sessions/.../queue:            (proposedBy ASC, status ASC)
```

---

## 3. 🔐 Security, PBAC & RBAC (Zero-Trust Firebase Rules)

The platform uses a Zero-Trust architecture natively applied via Firestore rules.

1. **User Registration Flow (Anti-Bot & Approval Mechanism):**
   - New registrations forced into `accountStatus: "pending"` and `role: "Guest"` unless the email matches Root (`nicolainformatica@gmail.com`).
   - Root user is immediately promoted to `approved` and `Root` role.

2. **The 3-Level Hierarchy + 2 dynamic:**
   - **Root:** Top level (`isRoot()`). Can bypass any limit.
   - **Admin:** Can view queued users and approve them. Promotes Guests to Admins. Creates game events and Choir Sessions.
   - **Guest (`Guest` / Pending):** Read-only visual confines while pending or empty, blocked from real collections (including `game_events` and `audio_sessions`).
   - **Round Host (dynamic, Quiz only):** Determined at runtime via `game_events.photoQuizConfig.currentHostId`. Dedicated rule helper `isCurrentHost(eventId)`. Can create rounds, write/read `secret/correctness`, perform reveal, assign `pointsAwarded`. Scepter passing is restricted to outgoing host, organizer, and Root, **and the new `currentHostId` must be a participant with `status == 'joined'`** (see §4.8 and §10).
   - **Session Conductor (dynamic, L'Ainulindalë only):** The `djId` of an `audio_sessions/{sessionId}`. Dedicated rule helper `isSessionDJ(sessionId)`. Can modify `currentQueueItemId`, `mode`, `status`, reorder queue, set `pointsAwarded` on queue items.

3. **Explicit Integrity:**
   - Any `create`/`update` passes through validation helpers enforcing correct field writes.
   - For `game_events`, a function `validStatusTransition(old, new)` explicitly codifies allowed transitions (draft→scheduled→lobby→active→completed, with aborted as emergency exit from any pre-completed state).
   - For `items.update` (capture): validated that `resource.data.status == 'spawned'`, `request.resource.data.collectedBy == request.auth.uid`, and that `lat/lng/points/templateId` are unchanged. The actual geographic distance check (Haversine) is delegated to a Phase 2 Cloud Function — known limitation, capture audit log includes `collectedAtLat/Lng` for ex-post investigation.
   - For `quizRounds/answers`: rules ensure `selectedIndex ∈ [0..3]`, `userId == request.auth.uid`, `submittedAt < endsAt`, and lock down `pointsAwarded` with valid range `[0, maxPointsPerRound]` and check `selectedIndex == correctIndex` (executable in rules because `correctIndex` is already public post-reveal).
   - For `game_events.update` with `currentHostId` change: the rule isolates the diff with `affectedKeys()`, verifies `request.auth.uid` is one of `oldCurrentHostId | organizerId | Root`, **and verifies via `exists()` + `get()` that the new host is a participant with `status == 'joined'`**. A malicious host cannot write `currentHostId = "alien-uid"` to freeze the quiz.
   - For `game_events.update` when `status == 'completed'`: the `finalLeaderboard` field is declared immutable via clause `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))`. Allows the write only in the `active → completed` transition (because in that moment `resource.data.status == 'active'`).
   - For `audio_sessions` and sub-collections: analogous rules — see `security_spec_EN.md` §1.3 and §2.3 for the full audio invariants and attack vector catalog.

---

## 4. 🧩 Core Modules and Logic

### 4.1 "Il Baule" Upload Engine
Batch image management, geometric calculations for box framing and canvas rendering ("Alpha-Channel Blackout" fix). Magic Scan visual filter matrix simulated via CSS filters.

### 4.2 AI Integration (Gemini Vision)
Client-side API calls via `@google/genai` with key reactively saved from server and isolated in memory. Dedicated tailored prompt.

### 4.3 "Il Cinematografo" (Slideshow & Gamification)
Uses stable `useRef`s, weighted animations, and gamification mechanics removing visual credits on demand via `mode` (including 'solo_immagini' for immersive UI hide). Interactive database (`users`) award of +5 / -2 Points for the single-player Indovina Chi/Anno games (unchanged). Concept B — Bivouac Quiz is its multiplayer extension.

### 4.4 "Il Bivacco" (Event Logistics Engine)
The Wallet System computes balances from live snapshot reads of accounts to establish debits and credits per event.

### 4.5 Geolocation (`LaMappa`) and Container Pattern
Double react-leaflet implementation. Automated dark/light tile switching via classList observer, with continuous but filtered GPS updates and observer-side time-decay obsolescence. A floating panel filters pins live by decade and author.

**Stable Leaflet container pattern** (replicated in `TreasureHuntMap` of Concept A, see §4.7):
```jsx
<div className="flex-1 w-full relative min-h-[300px]">
  <div className="absolute inset-0">
    <MapContainer center={[lat, lng]} zoom={18} className="w-full h-full">
      {/* TileLayer + children */}
      <MapController lat={lat} lng={lng} itemsCount={N} arOpen={bool} status={evtStatus} />
    </MapContainer>
  </div>
</div>
```

`MapController` runs `map.invalidateSize()` with 200ms debounce on all dependencies that may modify the layout (item count change, AR Layer opening, event status transition). Without this, Leaflet renders tile artifacts and missing pieces — already-discovered and documented pattern.

### 4.6 Privacy, Post Visibility & Archive Management
Frontend fetches skip docs without congruent timestamps, privacy toggles, or cinematografo switches.

### 4.7 "The Game Field" — Concept A: Memory Hunt
The geolocated treasure hunt. Full flow:

1. **Configuration (admin):** `GameCreator` wizard supports 4 spawn modes: `auto` (uniform disk point picking via `r = R · √(random()); θ = 2π · random()` formula with `min_separation` 8m jitter check), `manual` (tap on map), `hybrid` (auto + edit) and `legacy_posts` (sampling from public geo-located `posts`).
2. **Lobby (5 min pre-kickoff):** waiting room opens, permissions request (geolocation, camera, DeviceOrientation for iOS) handled via `PermissionsGate`. Wake lock activated.
3. **Kickoff:** state transition `lobby → active`, staggered fade-in of items on map, `useHighAccuracyPosition` active (`enableHighAccuracy: true, timeout: 15000, maximumAge: 2000`).
4. **Hunting:** Haversine distance calculation loop player↔items. When an item enters `captureRadius`, it's shown as `capturable`, paired with haptic feedback (`navigator.vibrate(60)` on Android), `HotColdRadar` (heat bar at the bottom) and `CompassArrow` (directional arrow via `webkitCompassHeading`/`alpha` from `useDeviceOrientation`).
5. **Capture:** opens `ARCaptureLayer`. See §4.9.
6. **End-game:** total collection or manual stop. Snapshot written as `finalLeaderboard` embedded on event doc (see §2). Confetti animation proportional to rank.

**Math utilities** (file `utils/geo.ts` and `utils/spawning.ts`):
- `haversineDistance(a, b)` in meters
- `bearing(from, to)` in degrees
- `generateUniformPointsInRadius(centerLat, centerLng, radiusMeters, count, minSeparation)` with max-attempts and automatic `min_separation` degradation if too aggressive

### 4.8 "The Game Field" — Concept B: Bivouac Quiz
Real-time multiplayer photo-trivia with host-driven sync via Firestore.

**Architecture:**
- The host (default `organizerId`, optionally rotating) creates a new `quizRounds/{roundId}` with `startedAt: serverTimestamp()` and `endsAt: startedAt + answerTimeMs`. `correctIndex` is written **exclusively** in `quizRounds/{roundId}/secret/correctness`, accessible only by the host triad.
- Participants, via `onSnapshot` on `quizRounds`, receive the round in real-time. They render the fullscreen photo + 4 shuffled options (option positions are identical for everyone because seeded by `roundId`).
- Each participant creates their own `answers/{userId}` (rule: only before `endsAt`, only once).
- Upon timer expiration, the host presses "Reveal": copies `correctIndex` from `secret/` to the parent doc and sets `revealedAt`. The rule unblocks reading of `correctIndex` and aggregated reads of `answers/*`.
- Client-side scoring (`utils/scoring.ts`):
  - `fixed mode`: 10pt correct, 0pt wrong
  - `decay mode`: `points = max(0, round(maxPoints × (1 - timeMs/maxTimeMs)))` with floor at 1pt minimum if correct within time
- The rule on `answers.update` validates `pointsAwarded` in `[0, maxPointsPerRound]` range and enforces `selectedIndex == correctIndex` when `pointsAwarded > 0` (anti-cheat on score).
- Atomic transaction for: writing `pointsAwarded` to `answers/{userId}` + `increment(points)` on `leaderboard/{userId}` + `increment(points × pointsMultiplier)` on `users/{userId}.points`.

**Question composition — 4-step UI Wizard** (`QuizHostCreateRound.tsx`):
- Step 1: choose source post from grid of public `posts` (with decade/author filters + search)
- Step 2: choose question type (5 types, "Manual" badge on all in MVP)
- Step 3: textual composition of question + 4 options + correct indication
- Step 4: recap + answer time slider + "🚀 Launch Round!" button
- Auto-save draft in `localStorage` with key `marzio1777:quiz-draft:{eventId}` (refresh resilience)

**Pluggable architecture for automatic generators** (`/src/utils/quizGenerators.ts`):
```typescript
export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who: (post, pool) => null,      // TODO Phase 2
  guess_year: (post, pool) => null,     // TODO Phase 2
  guess_place: (post, pool) => null,    // TODO Phase 2
  guess_caption: (post, pool) => null,  // TODO Phase 2
  chronology: (post, pool) => null,     // TODO Phase 2
};
```
In MVP all return `null` (forced manual composition). In Phase 2, replacing each body with auto-generation logic, the `QuizHostCreateRound` UI automatically shows the "Generate" button (gated by `isAutoGenerationAvailable(type)`). **No schema migration required** — the `sourcePostId` field on `quizRounds/{roundId}` is already ready to receive both the manual selection and the automatic output.

**Host Rotation (rotateHost === true):** each round, the outgoing host computes the next `currentHostId` by sorting `participants.status === 'joined'` by `userId` (immutable, deterministic) and picking the next with wrap-around. Only the outgoing host, organizer, or Root can write the new `currentHostId` (rule via `diff().affectedKeys()` + `exists()` check on the new host as per §3 and §10). Edge case: if `joinedPlayers.length === 0`, automatic fallback to `organizerId`.

**5 Question Types:** `guess_who`, `guess_year`, `guess_place` (reverse-geocoded from `post.location`), `guess_caption` (4 captions including the real one), `chronology` (4 photos to be ordered). Each type has a dedicated generator producing `{questionText, options[4], correctIndex}` from a `Post` — implementation in Phase 2.

### 4.9 AR Capture Layer — Technical Architecture

**Architectural decision:** lightweight HTML5 camera layer, **not** WebXR nor AR.js nor MindAR.

| Approach | Bundle | iOS Safari (2026) | Android Chrome | Fits the use-case? |
|---|---|---|---|---|
| **HTML5 Camera Overlay (chosen)** | ~0KB | ✅ supported | ✅ supported | ✅ |
| WebXR `immersive-ar` | ~50KB polyfill | ❌ unsupported | ✅ ARCore | ❌ — would exclude half of iPhone users |
| AR.js + AFRAME | ~3MB | ⚠️ partial | ✅ | ⚠️ overkill for "confirm capture" flow |
| MindAR | ~10MB+ | ✅ | ✅ | ❌ — only image/face tracking, no geo |

**Implementation stack:**
- `navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}})` for the video stream on the background `<video>`, with guaranteed cleanup (`stream.getTracks().forEach(t => t.stop())`) on unmount, route change and `visibilitychange`.
- Framer Motion `<motion.div>` over the video, with `x/y/rotate` floating animation in infinite loop (reduced to static if `prefers-reduced-motion`).
- `useDeviceOrientation()` hook handling the iOS case (`DeviceOrientationEvent.requestPermission()` on user gesture, granted/denied/unavailable). When granted, `event.gamma` and `event.beta` apply a slight parallax (-20px..+20px) simulating "the object is fixed in space".
- Tap → atomic Firestore transaction (see §4.10).
- Wake lock active during the game session (`navigator.wakeLock.request('screen')`), release on cleanup and `visibilitychange`. Wrapped in feature-policy check to avoid warnings in iframes (e.g. AI Studio preview, Stackblitz embed).

### 4.10 Atomic Capture Transactions (Anti-Race)

When two or more players are both within the `captureRadius` of an item at the same instant, the system must guarantee **only one wins**. Full implementation:

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
    collectedAtLat: position.coords.latitude,    // audit log
    collectedAtLng: position.coords.longitude,   // audit log
  });

  const leaderboardRef = doc(db, `game_events/${eventId}/leaderboard/${currentUser.uid}`);
  tx.set(leaderboardRef, {
    userId: currentUser.uid,
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
    points: increment(itemPoints),
    captures: increment(1),
  }, { merge: true });

  const userRef = doc(db, `users/${currentUser.uid}`);
  tx.update(userRef, {
    points: increment(itemPoints * eventMultiplier),
  });
});
```

Firestore guarantees optimistic isolation: if another transaction modifies `itemRef` before commit, the system replays; on the second replay `status === 'collected'` will fail the check, and the client gets a gracefully handled error ("Too slow! Someone else got it"). The `collectedAtLat/Lng` coordinates allow a Phase 2 Cloud Function to validate Haversine distance `< captureRadius` server-side, definitively closing "The Teleporter".

### 4.11 Unified Altitude Points
Native Firestore atomic increment (`increment(N)`) eliminates retrieval queries and avoids stuck async chains. **The point economy is unique and cumulative**: Concept A points (captures × multiplier), Concept B points (correct answers × multiplier), and L'Ainulindalë points (played music proposals × multiplier if session is linked to a game_event) flow into the same `users.points` that powers the Profile's Banners. No parallel economies: a heavy hunter, quiz champion and music proposer all climb the same Altitude ladder.

### 4.12 L'Ainulindalë — Personal Library (IndexedDB)

Local storage of audio tracks uploaded by the user. Database name: `marzio1777_audio`, version 1. Two object stores: `tracks` and `playlists`.

**Schema `tracks`:**
```typescript
interface LocalTrack {
  id: string;                        // UUID v4
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  durationMs: number;                // computed via Web Audio API
  coverDataUrl?: string;             // extracted from APIC frame
  blob: Blob;                        // original audio file
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  lastPlayedAt?: number;
  playCount: number;
  isFavorite: boolean;
  customTags: string[];
}
```

**Helper `/src/utils/indexedDB.ts`** exposes API: `addTrack`, `getTrack`, `getAllTracks`, `searchTracks`, `deleteTrack`, `updateTrack`, `getStorageQuota`, `exportPlaylist`, `importPlaylist`. All operations in `transaction` with atomic commit. In-memory cache of metadata for the list view.

**Quota:** ~50% of typical device storage (browser-dependent). Per-track limit: **50MB**. UI warning when quota >80%.

**ID3 Parser** (`/src/utils/id3.ts`): custom ~150 lines parser, zero dependencies. Supports ID3v2.3 and v2.4. Extracts: `TIT2` (title), `TPE1` (artist), `TALB` (album), `TYER`/`TDRC` (year), `TCON` (genre), `APIC` (cover). Handles ISO-8859-1, UTF-16 BE/LE, UTF-8 encoding. Fallback to filename `Artist - Title.mp3` if ID3 absent.

**Walkman UI:**
- Page `PersonalLibrary.tsx`: tracks list with search/filter, drag&drop upload zone, storage indicator
- `MiniPlayer.tsx` persistent fixed bottom during playback
- `FullScreenPlayer.tsx` modal with rotating vinyl, visualizer, full controls, 3-band EQ
- `Visualizer.tsx`: 32 vertical bars from `AnalyserNode`, amber→crimson gradient
- `Equalizer.tsx`: 3 vertical sliders low/mid/high (±12dB)
- `MediaSession API`: iOS/Android lock screen integration with metadata + 6 action handlers (play, pause, prev, next, seekto, seekbackward, seekforward)

### 4.13 L'Ainulindalë — Choir Sessions (DJ Engine)

An Admin/Root opens an `audio_sessions/{sessionId}` (see schema §2.6). Listeners connect, propose Themes to the queue, the DJ (= conductor) plays them one after another.

**Hub `/src/pages/IlAinulindale.tsx`**: 3 tabs — **Library** (redirects to PersonalLibrary), **Active Sessions** (list `audio_sessions.status == 'open'`), **Open Session** (Admin/Root only, 3-step wizard).

**DJ Panel** (`AudioSessionDJ.tsx`):
- Now Playing on top
- Drag&drop queue list with per-item menu (Play now / Skip / Kick / Preview)
- Prominent Auto/Manual toggle
- "Open Choir" button (status: open) and "Close Choir"

**Listener View** (`AudioSessionListener.tsx`):
- Synced Now Playing (local timer, computes progress from `currentTrackStartedAt` + `Date.now()`)
- Scrollable queue with own position highlighted
- "Propose a Theme" button → modal `ProposeTrackModal` with own Library

**DJ Engine** (`/src/utils/djEngine.ts`):
Auto-pilot loop in mode 'auto':
```typescript
async function djAutoEngine() {
  while (session.status === 'open' && session.mode === 'auto') {
    const current = await getCurrentItem();
    
    if (!current) {
      const next = await getFirstQueued();
      if (next) {
        await initiateTransfer(next);
        if (next.status === 'ready') await playItem(next);
        else await markSkipped(next, 'transfer_failed');
      } else await sleep(2000);
      continue;
    }
    
    // Pre-fetch 30s before end
    const remainingMs = current.durationMs - audioEngine.currentTimeMs;
    if (remainingMs < 30_000) {
      const next = await getFirstQueued();
      if (next?.status === 'queued') initiateTransfer(next);
    }
    
    if (audioEngine.ended) {
      await markPlayed(current);
      await awardPoints(current);  // +2 to proposer × pointsMultiplier (if linked)
    }
    
    await sleep(1000);
  }
}
```

Mode 'manual': same engine but stop after each track, wait DJ "Play Next" input.

**Constraints on `queue.create` (validated rule-side)**:
- User is participant (`participants/{userId}.status == 'joined'`)
- `proposedBy == request.auth.uid`
- Number of queue items with `proposedBy == auth.uid` AND `status in ['queued', 'transferring', 'ready']` ≤ `effective_maxQueuedPerUser`
- Bonus formula: `effective = rules.maxQueuedPerUser + floor(user.points / 100) * rules.bonusPerHundredPoints`
- If `rules.allowDuplicates == false`, no active duplicates
- Metadata and `localTrackId` immutable after create

### 4.14 L'Ainulindalë — P2P Transfer (WebRTC)

Pattern **Firestore-as-signaling**: no dedicated WebSocket, no additional backend. SDP offer/answer and ICE candidates written as Firestore docs in `audio_sessions/{sessionId}/signaling/{userId}`, listened with `onSnapshot`.

**Flow of DJ initiating transfer**:

1. DJ creates `RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })` — Google free STUN
2. DJ creates `RTCDataChannel('audio', { ordered: true })`
3. DJ calls `pc.createOffer()` → SDP offer
4. DJ writes `signaling/{proposerId}.djOffer = { sdp, type: 'offer', queueItemId }`
5. DJ listens on `signaling/{proposerId}.proposerAnswer` + `.proposerCandidates`
6. Proposer (with `onSnapshot` active) receives the offer
7. Proposer creates `RTCPeerConnection`, `setRemoteDescription(djOffer)`, `createAnswer()`
8. Proposer writes `signaling/{proposerId}.proposerAnswer`
9. Both sides discover ICE candidates via `onicecandidate` event, written in `arrayUnion`
10. RTCDataChannel opens (`onopen` event on both sides)
11. DJ marks `queue/{X}.status = 'transferring'` + `transferStartedAt`
12. Proposer reads file from IndexedDB (`LocalTrack.blob`), chunks into **16KB** pieces
13. Proposer sends: header `{ chunkIndex, totalChunks, mimeType }`, then binary data
14. DJ reassembles, validates total chunks, marks `queue/{X}.status = 'ready'` + `transferCompletedAt`
15. Cleanup: `pc.close()`, `signaling/{proposerId}` deleted
16. DJ play(blob) via `Audio` element + Web Audio API graph

**Constraints & Security:**
- Max file size: **50MB** (3200 chunks at 16KB max)
- MIME validation: first chunk declares `mimeType`, DJ verifies whitelist `audio/*`
- Transfer timeout: **15 seconds**. Beyond → `status: 'failed'`, engine skips to next
- `signaling/*` cleanup after transfer complete or timeout

**Graceful fallback:** if 3 consecutive transfers fail (severe NAT, network issues), session automatically switches to **Pure Curation**: DJ can only play tracks from THEIR library, queue becomes wishlist suggestion. UI banner notifies.

**Audio Engine** (`/src/utils/audioEngine.ts`): wrapper class on Web Audio API. Graph: source → GainNode (volume) → BiquadFilter low (lowshelf) → BiquadFilter mid (peaking) → BiquadFilter high (highshelf) → AnalyserNode → destination. API: `load(blob | url)`, `play()`, `pause()`, `seek(s)`, `setVolume(0-1)`, `setEQ(low, mid, high)`, `getCurrentTime()`, `getDuration()`, `isPlaying()`, `getAnalyser()`, `on(event, cb)`, `destroy()`. Singleton via `getAudioEngine()` for AudioContext reuse.

---

## 5. 🛣️ Routing & Components — Games & L'Ainulindalë Modules

### Added routes
```
# Game Field
/giochi                          → IlCampoDeiGiochi (active/upcoming events hub)
/giochi/dashboard                → GameDashboard (admin only)
/giochi/dashboard/nuovo          → GameCreator (wizard)
/giochi/:eventId/lobby           → GameLobby
/giochi/:eventId/play            → GamePlayRouter (dispatches A/B by type)
/giochi/:eventId/risultati       → GameResults
/giochi/archivio                 → GameArchive

# L'Ainulindalë
/ainulindale                     → IlAinulindale (3-tab hub)
/ainulindale/biblioteca          → PersonalLibrary (Walkman)
/ainulindale/sessioni            → AudioSessionsList
/ainulindale/sessioni/nuova      → AudioSessionCreate (Admin/Root only, wizard)
/ainulindale/sessioni/:sessionId → AudioSessionDJ | AudioSessionListener
                                   (dispatches by djId === currentUser.uid)
```

### Key components
- **Concept A:** `TreasureHuntPlay`, `TreasureHuntMap`, `MapController`, `ItemMarker`, `PlayerLocationMarker`, `OtherPlayersLayer`, `HotColdRadar`, `CompassArrow`, `ARCaptureLayer`, `CaptureSuccess`, `TreasureHuntHUD`
- **Concept B:** `PhotoQuizPlay`, `QuizQuestionScreen`, `QuizOptionButton`, `QuizCircularTimer`, `QuizRevealAnimation`, `QuizDistributionBars`, `QuizLeaderboardTransition`, `QuizHostControls`, `QuizHostCreateRound` (4-step wizard)
- **Shared games:** `GameEventCard`, `ParticipantsAvatarStack`, `GameEventCountdown`, `GameLeaderboardLive`, `GameOverScreen`, `PermissionsGate`
- **L'Ainulindalë — Walkman:** `MiniPlayer`, `FullScreenPlayer`, `Visualizer`, `Equalizer`, `UploadZone`, `TrackCard`, `PlaylistManager`
- **L'Ainulindalë — Sessions:** `AudioSessionCard`, `QueueItemCard`, `ProposeTrackModal`, `TransferProgressIndicator`, `SignalingMonitor` (debug only)

### Custom hooks
- **Games:** `useGameEvent`, `useGameItems`, `useGameParticipants`, `useGameLeaderboard`, `useQuizRound`, `useQuizAnswers`, `useHighAccuracyPosition`, `useDeviceOrientation`, `useCameraStream`, `useHaversineDistance`, `useNearestItem`, `useCaptureItem`, `useSubmitQuizAnswer`, `useAdvanceQuizRound`
- **L'Ainulindalë:** `useLocalLibrary`, `useAudioPlayer`, `useAudioSession`, `useAudioQueue`, `useSessionParticipants`, `useWebRTCTransfer`, `useMediaSession`, `useStorageQuota`

---

## 6. 🎨 Theming, UI, & Viewport Strategy
Custom overflow blocking at flex parent CSS level and standard mobile/tablet Tailwind reactivity but tuned to simulate pure PWA closed to "sandbox".

**Modular Micro-interactions:** Like animations are fully customizable persistence-side. Physical variables (icon — via "none" option a pure cardiac-rhythm `scale` without particles —, color tint, gravity/Y vector distance and speed/duration) are bound to user Firestore payload. At Database level, likes have a Zero-Trust constraint via uid array union/remove on `likedBy` with `arrayUnion` and `arrayRemove`, allowing a single user only one exact like (toggle-style) and preventing compulsive async `increment(1)` updates.

**Visual differentiation of The Game Field:** the new tab adopts an aesthetic coherent with the rest of the app but with two distinct semantic tones:
- Concept A — forest green + amber (earth, nature, hunting)
- Concept B — indigo blue + gold (night, parlor, intellect)

**L'Ainulindalë aesthetic (dark-flame):**
```
main background:    #0A0A0F (slate black)
secondary bg:       #16161D
primary text:       #F5F0E1 (warm ivory, parchment color)
amber accent:       #FFA000
crimson accent:     #C2410C
gold accent:        #D4A856 (audio Banners)
glow effects:       rgba(255, 160, 0, 0.4)
```

L'Ainulindalë is dark-first: even with light app theme, the audio module forces dark for musical immersion. Spinning vinyl on full-screen cover, ember particles from covers during playback (reuses `canvas-confetti` with dedicated config), pulsing amber waveform glow.

**Accessibility (systematic across all modules):** `prefers-reduced-motion` respected via `useReducedMotion()` from Framer Motion in ALL animations (vinyl, particles, parallax, step transitions). `aria-live="polite"` on leaderboard, round change, "Answer Recorded", queue updates, validation errors. Dynamic `aria-label` on quiz option buttons, AR capture, audio player controls. Tap-target ≥ 56px on mobile. AAA contrast on Concept A HUD and full-screen audio player (white text with black text-shadow for legibility on variable backgrounds). Screen reader: quiz timer announces every 5s remaining, audio player timer announces every 30s.

---

## 7. 🚀 Gamification, Points & Altitude
Native Firestore atomic increment (`increment(N)`) eliminates retrieval queries and avoids stuck async chains. Profile build based on cumulative threshold tagging.

With The Game Field and L'Ainulindalë, the economy is enriched with:
- **Event Multiplier:** every `game_event` has a `pointsMultiplier` (range 0.5–5.0). Applied to game point earnings before consolidating onto global Altitude Points. An `audio_sessions` linked to a `game_event` inherits the multiplier: a music proposal played during an August Festival 2x event is worth +4 instead of +2.
- **Leaderboard Snapshot:** `finalLeaderboard` immutable embedded array on the `game_events` doc, browsable in archive. For L'Ainulindalë: `finalStats` immutable embedded on the `audio_sessions` doc (totalDurationMs, totalTracksPlayed, topProposers).
- **Audio banners (future):** *The Singer* (50 proposals), *The Sub-Creator* (25 proposals played), *The Conductor* (5 sessions as DJ), *The Choir Master* (20 sessions > 30min), *The Voices of Ilúvatar* (10 sessions as listener), *The Discordant* (5 consecutive skipped proposals). Computed in Phase 2 from snapshots.
- **Anti-inflation:** captures or answers can never have negative event multiplier; multiplier applies only to gain, never to subtraction.

---

## 8. 🛠️ Build Pipeline and CI/CD
Continuous deployment from github repo via automated node/Vite scripts. App auto-configured as PWA via webmanifest at compile time.

**Total build delta:**
| Module | Delta |
|---|---|
| The Game Field | ~30KB minified+gzip |
| L'Ainulindalë (Library + Sessions + WebRTC) | ~40KB minified+gzip |
| **Total post-MVP** | **~70KB** |

No npm dependency added — the delta is pure React code + local TypeScript utility. CI-verified with `vite build` baseline pre-modules vs post-modules.

**Testing:** Vitest for unit tests on pure helpers (`haversineDistance`, `generateUniformPointsInRadius`, `validStatusTransition`, `calculateQuizPoints`, `parseID3`, `chunkArrayBuffer`, AudioEngine). `@firebase/rules-unit-testing` on Firebase Local Emulator for rule tests (items.update concurrency, `correctIndex` protection, blocked invalid state transitions, new currentHostId validation, finalLeaderboard immutability, queue.create with bonus formula, signaling write authorization, etc.). The audio rule test runner is in `firestore.rules.audio.test.ts`.

**Cloud Functions (Phase 2 — not in MVP):**
- Server-side Haversine distance validation on capture (verifies that `collectedAtLat/Lng` is within `captureRadius` of item `lat/lng`)
- Cleanup of `active` events older than 24h (auto transition to `aborted` with organizer notification)
- Periodic cleanup of orphan `signaling/*` docs (>60s inactive)
- FCM notifications 30 minutes pre-kickoff and on lobby opening
- SHA-256 hash check of P2P transferred files (anti-corruption)

**MIGRATION.md** at the repo root documents the Phase 2 plan for quiz generators, Cloud Functions, and module extension to future Concepts C/D/E.

---

## 9. 🔄 Recent Cleanup & Migrations

**Firebase v12 migration (May 2026):** replacement of deprecated `enableIndexedDbPersistence(db)` with new API `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Transparent replacement, no exposed API changes. Console clean of deprecation warning.

**Wake Lock feature-policy hardening:** `navigator.wakeLock.request()` wrapped in `document.featurePolicy?.allowsFeature?.('screen-wake-lock')` check to avoid warnings in iframes (AI Studio preview, Stackblitz, third-party embed). Runtime behavior unchanged in installed PWA.

**TreasureHuntMap rendering pattern:** identified and fixed Leaflet tile flickering bug during a hunt, due to unstable `flex-1` + missing `invalidateSize()` on layout changes (HUD, AR Layer, dynamic items, status transition). Stable pattern documented in §4.5, applied to future maps as well.

---

*End of document. For player gameplay/design specification see `GAMING_SYSTEM_EN.md`. For the audio module's full blueprint see `AINULINDALE_TECHNICAL_SPEC.md`. For the defensive matrix see `security_spec_EN.md`.*
