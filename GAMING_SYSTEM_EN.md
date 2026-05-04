# 🎯 The Game Field — Gaming System, Points & Entertainment in Marzio1777

*Document dedicated to the gaming module of the app. A blend of the README's narrative tone, the Developer Documentation's technical rigor, and the Security Specification's paranoid posture. Last revised: May 2026.*

---

## Table of Contents

1. [Philosophy & Vision](#1-philosophy--vision)
2. [The Altitude Points Ecosystem](#2-the-altitude-points-ecosystem)
3. [Common Event Architecture](#3-common-event-architecture)
4. [Concept A — The Memory Hunt](#4-concept-a--the-memory-hunt)
5. [Concept B — The Bivouac Quiz](#5-concept-b--the-bivouac-quiz)
6. [The Augmented Reality Layer](#6-the-augmented-reality-layer)
7. [Security, Anti-Cheat & The Game Dirty](#7-security-anti-cheat--the-game-dirty)
8. [UX & Accessibility](#8-ux--accessibility)
9. [Performance & Battery](#9-performance--battery)
10. [Roadmap & Future Concepts](#10-roadmap--future-concepts)
11. [Integration with L'Ainulindalë](#11-integration-with-lainulindale)

---

## 1. Philosophy & Vision

Marzio1777 was born as a digital Town Square. The Game Field is its courtyard: the space where the community comes together to play, physically or virtually, leveraging the archive of memories that already exists and turning it into fuel for new shared experiences.

The principles are three, and we religiously stick to them when choosing what to include and what to leave out:

**Principle 1 — Reuse, not Reinvention.** Everything already in the app (post archive, points system, Bivouac events, map, RSVP, RBAC roles, like particles) is reused as fuel for the games module. We don't build parallel economies, we don't duplicate RSVP flows, we don't introduce new heavy libraries. The "Zero-New-Dependencies" philosophy is an explicit design constraint: the gaming module adds ~30KB to the final bundle, all React + pure TypeScript utility code. The same constraint has been rigorously maintained with the arrival of L'Ainulindalë (audio module): zero npm dependencies added, +40KB bundle. Total post-MVP: ~70KB.

**Principle 2 — Marzio first.** This isn't an MMO. It's not a competitive game for professional gamers. It's a village app, private, whitelisted, where Marziesi and holiday-makers have fun together. Technical choices reflect this scale: high tolerance for non-automated cheating (if Mario plays from the couch pretending to be out, it gets discovered at the next pizza night), no thematic filters (the admin can name the hunt "Amsterdam Mode" and populate it with 🍁 emojis without issues), emphasis on social experience rather than surgical precision.

**Principle 3 — A is Outdoor, B is Indoor; both are Marzio.** The two Concepts are complementary, not redundant. The Hunt (A) gets you physically outside in the village streets, makes you run, makes you interact with the territory. The Quiz (B) lets you play seated, from the couch, at the pizzeria, even remotely. Same users, same archive, same Altitude, two distinct experiences. A player can excel in only one of the two and still reach Mayor of Marzio status.

---

## 2. The Altitude Points Ecosystem

Altitude Points were already the gamification engine of the app before The Game Field: earned by uploading photos, commenting, winning Guess Who/Guess the Year in the Cinema. With the games module this economy is enriched but **not fragmented**. With L'Ainulindalë's arrival, the same principle applies to audio: no parallel music economy, every Theme played in a Choir Session feeds the same Altitude scale.

### 2.1 The Point Sources

| Action | Point Range | Frequency | Notes |
|---|---|---|---|
| Upload a post (The Trunk) | +5 to +20 | Per upload | Bonus if includes geotag |
| Comment on a post | +1 | Per comment | Soft daily cap |
| Correct in Guess Who (Cinema) | +5 / -2 | Per round | Single-player unchanged |
| Correct in Guess the Year (Cinema) | +5 / -2 | Per round | Single-player unchanged |
| **Capture an item (Concept A)** | +1 to +1000 | Per capture | × event multiplier |
| **Correct quiz answer (Concept B)** | +1 to +20 | Per round | × event multiplier, decay mode |
| **Event completion bonus** | +50 | One-shot | For those who finish in leaderboard |
| **Theme played in Choir Session (L'Ainulindalë)** | +2 | Per Theme played | × multiplier if session linked to game_event |
| **DJ bonus per completed session (≥30 min)** | +10 | One-shot | Conductor only |

### 2.2 The Event Multiplier

Each `game_event` has a `pointsMultiplier` field configurable by the organizer in 0.5–5.0 range (default 1.0). It applies to single-event point gains before they flow into the user's global Altitude Points.

Example: August Festival hunt with 2.0 multiplier. Mario captures a rare beer worth 50pt. The event leaderboard receives +50pt (to show round dynamics), but `users/{mario}.points` receives +100pt (50 × 2.0).

**Audio extension:** an `audio_sessions` can be linked to an active `game_event` (`linkedGameEventId` field). In that case, every Theme played inherits the multiplier: during a 2x August Festival event, the proposer of a played Theme receives +4 instead of +2. A standalone Choir Session (without link) uses the default 1.0 multiplier.

**Golden rule:** the multiplier applies only to gain, never to subtraction. There are no "negative games" that subtract Altitude. This is an explicit policy choice: Altitude is a monotonically increasing scale, not a bank balance.

### 2.3 Banners & Titles

Altitude Points unlock Profile Banners. The existing list (The Holiday-Maker, The Expert Tourist, The Mayor of Marzio) is extended with "themed" titles unlockable from gaming and singing activities:

**Game Field Banners:**
- **The Memory Hunter** — complete 10 hunts with at least one capture
- **The Expert Hunter** — accumulate 1000 points from hunts
- **The Seer** — 50 consecutive correct quiz answers
- **Iron Memory** — 100 total correct quiz answers
- **The Mayor of the Quiz** — winner of 5 Quiz events
- **The Polaroid Pilgrim** — complete 3 hunts in Legacy Posts mode
- **The Perfect Host** — 10 sessions as Quiz Host without disconnections

**L'Ainulindalë Banners:**
- **The Singer** — 50 total Themes proposed
- **The Sub-Creator** — 25 proposed Themes actually played by the DJ
- **The Conductor** — 5 sessions opened as DJ
- **The Choir Master** — 20 sessions as DJ run to completion (≥30 min)
- **The Voices of Ilúvatar** — 10 sessions attended as listener
- **The Discordant** — 5 consecutive skipped proposals (humorous banner, "I love you anyway")

Banners are **descriptive, not punitive**: they cannot be lost, only earned. Consistent with the philosophy of an Altitude that grows.

### 2.4 Historical Snapshots

At event end, an immutable **embedded** field is written on the event document — no longer a separate sub-collection as in the initial plan. For `game_events`: array `finalLeaderboard` directly on the parent doc. For `audio_sessions`: object `finalStats` directly on the parent doc (totalDurationMs, totalTracksPlayed, participantsCount, topProposers).

These fields are never modified again, not even by Root. The rule guarantees immutability via clause: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))` for games (analogous for `'closed'` status and `finalStats` for audio sessions). They become the historical basis for:

- The Game Field and Choir Sessions Archive (browsable forever)
- Weighted banners (e.g., "Mayor of the Quiz" updates by reading the history of final leaderboards; "The Choir Master" by reading `finalStats.totalDurationMs ≥ 1800000`)
- Aggregate user profile statistics (e.g., "You won 3 hunts in 2026", "You conducted 12 choirs in 2026")

---

## 3. Common Event Architecture

The two gaming Concepts share 100% of the event infrastructure. The root collection is `game_events`, and only the type-specific configuration changes within. L'Ainulindalë uses a parallel `audio_sessions` collection with analogous architecture (see §11).

### 3.1 Lifecycle

```
[draft] → [scheduled] → [lobby] → [active] → [completed]
                                      ↓
                                  [aborted]
```

- **draft** — admin is configuring, event invisible
- **scheduled** — published, invites sent, countdown active
- **lobby** — 5 minutes pre-kickoff, waiting room open, participants connecting, permissions requested
- **active** — game in progress, camera/quiz active, live leaderboard
- **completed** — ended, final snapshot, archive
- **aborted** — cancelled (e.g. bad weather), no points awarded

Transitions are codified in a rule helper `validStatusTransition(old, new)` and validated server-side. Any illegal state change is rejected.

### 3.2 The Invite System

- **Default**: all `Admins` and `Roots` are auto-invited (consistent with the Bivouac)
- **Extensible**: the organizer can also invite approved `Guests` with a tap
- **3-state RSVP**: `invited` | `joined` | `declined`
- **Notifications**: planned FCM in Phase 2 (push 30 minutes pre-kickoff and on lobby opening)

### 3.3 Event Permissions — Recap

| Action | Pending Guest | Approved Guest | Admin | Root | Organizer |
|---|---|---|---|---|---|
| See event list | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create event | ❌ | ❌ | ✅ | ✅ | — |
| Modify event | ❌ | ❌ | ❌ (only own) | ✅ | ✅ |
| Cancel event | ❌ | ❌ | ❌ | ✅ | ✅ if `status != active` |
| Participate (RSVP) | ❌ | ✅ if invited | ✅ | ✅ | ✅ |
| Force `start`/`end` | ❌ | ❌ | ❌ | ✅ | ✅ |
| See live leaderboard | ❌ | only if participant | ✅ | ✅ | ✅ |

### 3.4 Visibility Among Players

Configurable at event level (`visibilityOfOthers: boolean`) and overridable per individual user (`participants.shareLocationDuringEvent`). Default ON at event level; the individual user wishing to hide always has the last word. Live positions are written to the existing `user_locations` collection (split collection, isolated PII), not in `game_events`. We reuse the pattern already in production on The Map.

### 3.5 The Dynamic Host Role

Exists only during `photo_quiz` events. It's the user actively running the current round, identified by `game_events.photoQuizConfig.currentHostId`. By design:

- The Host sees the correct answer before others (it's unavoidable and accepted as part of the meta-game; not having Cloud Functions requires it)
- The Host can rotate automatically question by question (`rotateHost: true`) or remain fixed
- Rotation orders `joined` participants by `userId` (immutable, deterministic) and uses wrap-around
- Only the outgoing host, organizer, or Root can write the new `currentHostId` (rule via `diff().affectedKeys()`)
- **Additionally, the new `currentHostId` must be a participant with `status == 'joined'`**, validated in rule via `exists()` + `get()` on the participants sub-collection. This closes the "Self-Crowning by alien-uid" vector (see §7.1, vector #16)
- The Organizer and Root can always step in as "emergency Host" if the current one disconnects

The UI explicitly shows status: whoever is host sees a red banner "The Host views the correct answer before reveal", others see "Host: [displayName]". Total transparency on the meta-game.

---

## 4. Concept A — The Memory Hunt

> The Marziese Pokémon GO: a geo-located treasure hunt where players walk physically around Marzio with phone in hand, and the camera kicks in upon reaching the object to "capture" it with a touch of light augmented reality.

### 4.1 Hunt Setup (admin)

`GameCreator` wizard supporting 4 spawn modes:

**Auto-spawn by radius.** The admin specifies:
- Center (lat/lng) — defaults to public posts centroid, modifiable via map tap
- Radius in meters (e.g. 500m, 1km, 5km)
- Number of objects to generate
- Object types

The distribution algorithm uses **uniform disk point picking** with `min_separation` jitter check (default 8m, automatically degraded if too aggressive):

```
r = R × √(random())
θ = 2π × random()
lat_offset = r × cos(θ) / 111320
lng_offset = r × sin(θ) / (111320 × cos(centro_lat))
```

**Manual Spawn (Tactical Placement).** Fullscreen map, the admin taps points where they want to place each object. For each tap, popover with type and score selection. Drag-to-move to realign. Tap-and-hold to delete.

**Hybrid Spawn.** Auto-generates N objects, then enters edit mode to move/delete/add. Recommended default mode: auto-generation creates the base, edit adds the creative touch.

**Archive Spawn (Legacy Posts).** Narrative mode: the system draws from existing public posts with valid `location`, filterable by decade/author. Each post becomes an object to "rediscover" on the map at its original coordinates. On capture, the player sees the memory's polaroid in AR with author and caption. The hunt thus becomes a journey through the village's memory locations.

### 4.2 The 5 Theme Presets

To reduce time-to-event to < 30 seconds, `GameCreator` proposes 5 cloneable and modifiable presets:

- **🍺 August Festival Beer** — 10pt common beers, 5pt mugs, 1pt coasters
- **🍄 Autumn Foraging** — 10pt porcini, 5pt chanterelles, 1pt leaves
- **🎃 Village Halloween** — pumpkins, ghosts, candies
- **🏔️ Monarch's Trek** — peaks, trails, huts (high scores)
- **🍁 Amsterdam Mode** — humorous preset for the "out-of-town vacation" use case

Presets are only starting points. The admin can clone, rename, modify emoji/scores/rarity, and save them as reusable custom templates. "No aggressive censorship" philosophy: the app is private, thematic responsibility belongs to the organizing admin.

### 4.3 The Hunt Flow

**Lobby (5 min pre-kickoff).** Waiting room opens. Map centered on play area with radius overlay circle. Animated countdown. Real-time list of connecting participants. Buttons to grant permissions (geolocation, camera, DeviceOrientation for iOS) — **requested here** to avoid blocking at kickoff. Admin buttons for "Start Early" / "Cancel Event".

**Kickoff.** Brief sound. "Spawn" animation of objects on map: staggered fade-in (`stagger: 0.05s`) for the "appear one at a time" effect. Player position visible as pulsating dot. Wake lock activated to prevent phone from going to standby.

**Hunt.** Main loop:

1. `watchPosition` with `enableHighAccuracy: true, timeout: 15000, maximumAge: 2000`
2. On every GPS update, calculate Haversine player↔items
3. Smart throttling: if movement < 2m, no recalculation (reduces battery drain when stationary)
4. If distance < `captureRadius` (default 15m), object enters `capturable` state:
   - Pulses on map
   - Brief haptic vibration `navigator.vibrate(60)` on Android
   - Floating "📸 Capture!" button appears
5. Tap → opens `ARCaptureLayer` (see §6)

**Distance feedback (Hot/Cold radar).** Bottom bar that intensifies as you approach the nearest object. Known and loved UX pattern (geocaching).

**Compass arrow.** If the device provides `webkitCompassHeading` or `alpha`, CSS rotate arrow points to nearest object. Helps enormously in low-GPS-precision zones.

**End-game.** Natural (all items collected) or manual (admin/root presses "End"). Final animation with total points, rank, proportional confetti. Leaderboard snapshot saved as `finalLeaderboard` embedded on the event doc, immutable.

### 4.4 Map Rendering Pattern

Stable Leaflet container pattern, also replicated by the existing TheMap:

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

`MapController` runs `map.invalidateSize()` with 200ms debounce on all dependencies that may modify the layout (item count change, AR Layer opening, event status transition). Without this, Leaflet renders square tiles and missing pieces — pattern already discovered and documented during MVP audit.

---

## 5. Concept B — The Bivouac Quiz

> Real-time multiplayer photo-trivia. Played seated, from the couch, at the pizzeria, during a dinner, even remotely. Reuses the post archive as question base. Extends `Guess Who/Guess the Year` (single-player in the Cinema) to synchronous multiplayer.

### 5.1 The 5 Question Types

| Type | Question | Data origin |
|---|---|---|
| **Guess Who** | "Who appears in this photo?" | `post.taggedPeople[]` or `post.authorName` |
| **Guess the Year** | "What year is this photo from?" | `post.decade` with ±5 year range |
| **Guess the Place** | "Where was it taken?" | `post.location` reverse-geocoded |
| **Guess the Caption** | 4 possible captions, which is the real one? | `post.caption` + 3 fakes |
| **Chronology** | 4 photos, put them in temporal order | mix of `post.decade` |

Each type has a dedicated generator producing `{questionText, options[4], correctIndex}` from a `Post`.

### 5.2 Quiz Configuration (admin)

The admin composes:
- **N rounds** (default 10, max 50)
- **Type mix** (can limit to one or mix)
- **Post filter**: all / public only / single author / single decade
- **Answer time** (default 20s, range 5-60s)
- **Scoring mode**: `fixed` (10pt correct, 0pt wrong) or `decay` (fast correct worth more than slow correct)
- **Rotate Host**: true/false

### 5.3 Question Composition — 4-step Wizard

In MVP, each round's composition happens in **guided-manual** mode through a sequential `QuizHostCreateRound.tsx` wizard with 4 steps:

- **Step 1 — Source post selection:** grid of public `posts` filterable by decade/author + search box. Tap on a post selects it as `sourcePostId` for the round.
- **Step 2 — Question type selection:** 5 cards one per type (Guess Who, Year, Place, Caption, Chronology). Each card shows in MVP a "Manual" badge — auto-generation is planned for Phase 2 (see §5.6).
- **Step 3 — Composition:** text form for question + 4 options + correct selection via radio button. Contextual suggestions based on chosen question type.
- **Step 4 — Recap & Launch:** preview of entered data + slider for round answer time (override of event default) + prominent "🚀 Launch Round!" button executing the create transaction.

Auto-save draft in `localStorage` with key `marzio1777:quiz-draft:{eventId}` for resilience to accidental refresh during composition.

### 5.4 Real-time Architecture (post-B7, May 2026)

**Host-driven for sharing, owner-side for scoring** pattern, with sync via Firestore subcollection.

1. Host presses "Launch Round!" at wizard end
2. Creates `quizRounds/{roundId}` with `startedAt: serverTimestamp()`, `endsAt: startedAt + answerTime`, `sourcePostId` populated
3. `correctIndex` written **exclusively** in `quizRounds/{roundId}/secret/correctness` (vault)
4. All clients listen to `quizRounds` with `onSnapshot` → simultaneously render the question
5. Each player creates `answers/{userId}` (rule: only before `endsAt`, only once) with `pointsAwarded: 0` placeholder
6. Upon timer expiration (or when all have answered), Host presses "Reveal"
7. `revealRound(eventId, roundId)`: reads `correctIndex` from `secret/`, performs a single update on the parent doc (`status: 'revealed'`, `revealedAt: serverTimestamp()`, `correctIndex`)
8. Rules unblock reading of `correctIndex` and all `answers/*`
9. **Owner-side claim**: each client, via `useEffect` on `round.status === 'revealed'`, runs `claimMyAnswerPoints` — a local `runTransaction` that recomputes `pointsAwarded` from `correctIndex + scoringMode + elapsedMs + maxPointsPerRound × eventMultiplier`, updates `answers/{me}.pointsAwarded`, and if > 0 calls `increment` on `leaderboard/{me}` and `users/{me}.points`. Idempotency via `localStorage[marzio1777:quiz-claimed:{roundId}:{uid}]`.
10. Animation: response distribution bars, confetti on correct, leaderboard updates in real-time as clients claim
11. Loop to step 1 until `roundsPlayed === totalRounds` or host stops

**Split rationale** (B7, May 2026): the previous version had the host running `tx.update(users/{otherUid}, ...)` for every participant with a correct answer. The `users.update` rule legitimately allows owner-side increment only, so that flow was rejected. The split flips the pipeline: host publishes the truth (public correctIndex), each client verifies it and self-credits. No host bottleneck, no race on concurrent sessions, anti-cheat unchanged (the `answers.update` rule re-derives correctness from the public correctIndex and caps `pointsAwarded`).

### 5.5 Decay Scoring

Formula in `utils/scoring.ts`:

```typescript
points = max(0, round(maxPoints × (1 - timeMs/maxTimeMs)))
// with 1pt minimum floor if correct within time
```

Calculation happens client-side at reveal moment, but the **Firestore rule validates the result**: `pointsAwarded ∈ [0, maxPointsPerRound]` and, if `pointsAwarded > 0`, `selectedIndex == correctIndex`. A cheat attempting to award 9999pt on a wrong answer is rejected at DB level.

### 5.6 Pluggable Architecture for Auto-Generators

The MVP forces manual composition. But the architecture is already prepared for Phase 2 auto-generators, with no schema migration:

```typescript
// /src/utils/quizGenerators.ts
export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who: (post, pool) => null,      // TODO Phase 2
  guess_year: (post, pool) => null,     // TODO Phase 2
  guess_place: (post, pool) => null,    // TODO Phase 2
  guess_caption: (post, pool) => null,  // TODO Phase 2
  chronology: (post, pool) => null,     // TODO Phase 2
};

export function isAutoGenerationAvailable(type: QuestionType): boolean {
  return questionGenerators[type](null, []) !== null;
}
```

In Phase 2, replacing each body with auto-generation logic from the post pool:
- The `QuizHostCreateRound` wizard in Step 2 automatically shows the "🪄 Generate" button for available types
- The admin can choose "Generate" or "Compose manually" for each round
- The `sourcePostId` field on `quizRounds/{roundId}` is already ready to receive both manual selection and automatic output
- No Firestore rule changes, no index changes

### 5.7 "Remote Quiz" Mode

Explicit use case: divided family, some in Marzio, some at home, want to play together on Easter evening. The Quiz **does not require physical co-presence** — it's the main difference from the Hunt. It is assumed that players use WhatsApp/FaceTime in parallel for voice, as already done with remote board games. Embedded video chat integration (e.g. Daily.co) planned as future-phase UI slot, not in MVP.

---

## 6. The Augmented Reality Layer

### 6.1 Architectural Decision

For Concept A capture, we chose a **lightweight HTML5 Camera Overlay**, NOT WebXR nor AR.js nor MindAR.

Comparison table:

| Approach | Bundle | iOS Safari (2026) | Android Chrome | Fits the use-case? |
|---|---|---|---|---|
| **HTML5 Camera Overlay (chosen)** | ~0KB | ✅ supported | ✅ supported | ✅ |
| WebXR `immersive-ar` | ~50KB polyfill | ❌ not supported | ✅ ARCore | ❌ — would exclude half of iPhone users |
| AR.js + AFRAME | ~3MB | ⚠️ partial | ✅ | ⚠️ overkill for "confirm capture" flow |
| MindAR | ~10MB+ | ✅ | ✅ | ❌ — only image/face tracking, no geo |

**Rationale:**
- iOS Safari in 2026 doesn't support WebXR `immersive-ar` (verified), and in Italy the iOS share of our users is significant
- AR.js requires AFRAME (~700KB) + ARToolkit (~2MB) for a flow that's essentially "confirm arrival on point"
- Our AR is more "decorative" than "tracker": we don't need to position a 3D object anchored to real coordinates, just overlay an animated emoji on the video stream and have it pulse/float

### 6.2 Implementation Stack

```
┌─────────────────────────────────────┐
│  <video> stream from getUserMedia   │  ← layer 1 (background)
│  ┌─────────────────────────────┐    │
│  │   <motion.div>              │    │  ← layer 2 (animated overlay)
│  │       🍺                    │    │     Framer Motion + parallax
│  └─────────────────────────────┘    │
│                                     │
│   [HUD: distance 4m, "Tap it!"]     │  ← layer 3 (UI)
│   [Cancel button]                   │
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

Front camera fallback if rear unavailable. Mandatory cleanup: `stream.getTracks().forEach(t => t.stop())` on every unmount, route change and `visibilitychange`. Without this, the camera LED stays on. Audit: verify in DevTools that after closing the AR layer the LED turns off in < 500ms.

**Object animation:**
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

**Parallax via DeviceOrientation (iOS-aware):**
```typescript
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
  const state = await DeviceOrientationEvent.requestPermission();
  if (state === 'granted') {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}
```

`handleOrientation` reads `event.gamma` and `event.beta` and applies a translation on the emoji (-20px..+20px). It's an illusion, not real AR — but for gameplay it works great.

### 6.3 Capture Protocol

On emoji tap:

1. "Captured" animation (scale up + fade + particles)
2. `stream.getTracks().forEach(t => t.stop())` — camera off
3. Atomic Firestore `runTransaction` (see §7.2)
4. "+10pt 🍺" snackbar with count-up
5. Return to map, item disappears via `onSnapshot`

### 6.4 Wake Lock

During active event:

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

Without wake lock, the screen turns off after 30s of inactivity and GPS slows down. Critical for the Hunt. Release also guaranteed on `visibilitychange` (tab in background). The `featurePolicy` check avoids console warnings in iframes (e.g. AI Studio preview, Stackblitz embed).

---

## 7. Security, Anti-Cheat & The Game Dirty

Philosophy: **trust but verify lite**. Village app, closed whitelisted community. The system prevents automated abuses but doesn't investigate human cases with banking-grade paranoia.

### 7.1 The 10 Game Field Dirty

(For full details, see `security_spec_EN.md` §2.2. Recap here.)

13. **The Phantom Item** — participant trying to spawn new items. Blocked.
14. **The Teleporter** — capture without being in radius. *MVP limitation*: Firestore rule cannot do Haversine, audit log `collectedAtLat/Lng` + Cloud Function in Phase 2.
15. **The Phantom Host** — non-host writing to `secret/correctness`. Blocked.
16. **The Self-Crowning** — participant self-promoting to host OR writing an "alien" `currentHostId`. Blocked: rule isolates `affectedKeys()` and verifies via `exists()` + `get()` that the successor is a joined participant.
17. **The Score Forger** — `pointsAwarded: 9999`. Blocked by rule, **further hardened in B7** with triple defensive cap (round configuration, +1000/transaction on `users.points`, monotonicity).
18. **The Late Submitter** — answer after `endsAt`. Blocked by rule.
19. **The Ghost Capture** — capture of already-collected item. Resolved by `runTransaction`.
20. **The Speed Demon** — DevTools GPS spoofing. Tolerated (community-level trust).
21. **The Time Bandit** — state jump `draft → completed`. Blocked.
22. **The Resurrectionist** — write on `finalLeaderboard` post-completed. Blocked by the immutability clause on the embedded field.

### 7.2 The Atomic Capture Transaction — the critical piece

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

When two players are both in radius, Firestore automatically replays concurrent transactions: the first wins, the second sees `status === 'collected'` and fails. The "losing" player sees a gracefully handled error ("Too slow! Someone else got it"). No double-spend. The `collectedAtLat/Lng` coordinates allow a Phase 2 Cloud Function to validate Haversine distance `< captureRadius` server-side, definitively closing "The Teleporter".

### 7.3 The Quiz Vault

A round's `correctIndex` is NEVER written directly to the parent doc before reveal. It's saved in a sub-sub-collection `quizRounds/{roundId}/secret/correctness` accessible only by host triad (currentHost, organizer, Root). At reveal, the value is copied to the parent where rules make it readable by all.

Accepted compromise: the host sees the correct answer before others. Unavoidable without Cloud Functions. Transparent UX: red banner "The Host views the correct answer".

### 7.4 Score Validation (post-B7, May 2026)

The rule on `answers.update` locks down `pointsAwarded` on both authorized paths:
- **Self-claim path** (preferred): `answerUserId == request.auth.uid && isEventParticipant(eventId)`. **Host-triade override** path (Root recovery): `currentHostId | organizer | Root`.
- Common to both: `revealedAt != null`, `affectedKeys().hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap aligned to actual round configuration, no longer just `pointsMultiplier × 100` as pre-B7), and `selectedIndex == correctIndex` when `pointsAwarded > 0`.
- Triple defensive cap: `answers.update` rule (round configuration cap), `users.update` rule (≤+1000/transaction), and `users.points` monotonic increment.

A cheat bypassing the client and writing `pointsAwarded: 1000000` is rejected at DB level on any of the three caps. Same outcome for someone trying to write another participant's `pointsAwarded` (rule blocks via `answerUserId == request.auth.uid`).

### 7.5 Known Limitations (and Accepted)

| Limitation | Vector | Current mitigation | Full mitigation |
|---|---|---|---|
| Capture without being in radius | The Teleporter | `collectedAtLat/Lng` audit log | Phase 2 Cloud Function |
| Desktop browser GPS spoofing | The Speed Demon | Rule rejects accuracy >100m | — (community-level trust) |
| Host sees correctIndex pre-reveal | inherent in design | Transparent UX | Phase 2 Cloud Function |
| Pre-event FCM notifications | not implemented | none | Phase 2 |
| Quiz auto-generation | not implemented in MVP | guided-manual composition via wizard | Phase 2 (pluggable architecture already ready) |

All limitations have a closing plan in Phase 2 (Cloud Functions + generator body replacement). They're not holes, they're explicit trade-offs to close the MVP.

---

## 8. UX & Accessibility

### 8.1 Integrated Aesthetics

The Game Field is a new "tab" alongside Square/Bivouac/Cinema/Map/BigTree/Trunk. Naming: **The Game Field** 🎯, Lucide `Gamepad2` icon. With L'Ainulindalë's arrival, the audio module sits as eighth tab with its own visual identity (dark-flame, see `AINULINDALE_TECHNICAL_SPEC.md`).

Visual differentiation between the two gaming Concepts:
- **Concept A — Hunt**: forest green + amber (earth, nature, hunt)
- **Concept B — Quiz**: indigo blue + gold (night, parlor, intellect)

### 8.2 Reuse of Existing Patterns

| Pattern | Reused from | Adaptation |
|---|---|---|
| Capture particles | like system (TheSquare) | Same particles staggered from captured emoji |
| Points count-up | Personal Profile | Identical, `popLayout` + spring |
| Countdown | Bivouac RSVP | Identical |
| Slideshow background | Cinema | Identical for Concept B |
| Card metadata reveal | Cinema | Identical for quiz reveal |
| Avatar stack | Bivouac RSVP | Identical for participants |
| Stable Leaflet container | TheMap | Identical for TreasureHuntMap |

Philosophy: **zero new aesthetics without justification**. Every element must look born with the app, not glued on.

### 8.3 Accessibility

- Tap target ≥56px on mobile, ≥44px on desktop (HIG/Material 3)
- Full keyboard navigation for Concept B (Concept A is inherently touch/mobile)
- `aria-live="polite"` on leaderboard updates and round changes
- `aria-label` on quiz option and capture buttons
- AAA contrast on Concept A HUD (white text with black text-shadow)
- Reduced motion: `prefers-reduced-motion` respected via `useReducedMotion()` from Framer Motion in ALL module animations
- Screen reader: quiz timer announces every 5 seconds remaining
- Color: no information conveyed BY color ALONE (e.g., correct/wrong: also ✓/✗ icon)

### 8.4 Resilience

- **Refresh during a game**: routing memorizes `eventId` in URL, Firestore subscriptions auto-recreate
- **Intermittent connectivity**: Firestore offline persistence active (via modern `persistentLocalCache` v12+ API), optimistic mutations
- **Permissions denied**: 5 scenarios covered with dedicated UX (geolocation, camera, deviceorientation, notifications, all denied)
- **Corrupted event state**: Root always has the "Force End Event" button. `cleanupStuckEvents` Cloud Function in Phase 2

---

## 9. Performance & Battery

### 9.1 Geolocation Best Practices 2026

```typescript
const watchOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 2000,
};
```

Smart throttling: if position changes by < 2m, no recalculation. Mandatory cleanup (`clearWatch`) on unmount, route change and `visibilitychange`.

### 9.2 Camera Stream Lifecycle

`stream.getTracks().forEach(t => t.stop())` on every cleanup. Without this, the camera LED stays on. Verify with DevTools: < 500ms shutdown after layer closure.

### 9.3 Firestore Listener Strategy

- `onSnapshot` with `includeMetadataChanges: false`
- Explicit detach (`unsubscribe()`) in cleanup
- For `items` during hunt: 1 listener on the entire sub-collection with `status == 'spawned'` filter, not N individual listeners
- For `quizRounds`: query `where('roundNumber', '==', event.currentRound)`, target changes at next round

### 9.4 Wake Lock

Critical for the Hunt. Without, the screen turns off after 30s and GPS slows down. Release guaranteed on unmount and `visibilitychange`. Wrapped in feature-policy check to avoid iframe warnings (see §6.4).

### 9.5 Animation Throttling

During active AR Layer, background animation framerate reduced. Camera + fluid animations can heat the device. `prefers-reduced-motion` always respected.

### 9.6 Bundle Delta

| Addition | Bundle delta |
|---|---|
| New React components (games) | ~25KB minified+gzip |
| Firestore + transaction logic (games) | ~3KB |
| Haversine helpers, etc. | ~1KB |
| Quiz wizard + scoring + generators (Phase 2-ready) | ~1KB extra |
| **Game Field total** | **~30KB** |

L'Ainulindalë (audio module) adds another ~40KB, bringing the total post-MVP of all extensions to **~70KB**. External library imports: **zero** in either module. Key architectural decision.

### 9.7 Battery Budget

Target: ≤8% drain in 15 minutes of active Hunt on mid-range mobile. To be field-verified in Marzio before release.

---

## 10. Roadmap & Future Concepts

### 10.1 Development Roadmap (5 phases)

**Phase 0 — Foundation.** `game_events` setup + base rule. `The Game Field` hub. RSVP flow. PermissionsGate. ✅

**Phase 1 — Concept A MVP.** Basic hunt with map tap (no AR Layer yet), Hot/Cold, live leaderboard, results screen. ✅

**Phase 2 — Concept A Polish.** Full AR Layer, Compass arrow, automatic/hybrid/legacy_posts spawning, wake lock, Cloud Function anti-cheat distance. ✅ (Cloud Function deferred to general Phase 2)

**Phase 3 — Concept B.** GameCreator for photo_quiz, round system, manual wizard for question composition. ✅

**Phase 4 — Concept B Expansion.** Replace body of automatic generators (architecture already prepared), rotating host with successor validation (✅ rule ready), decay scoring (✅).

**Phase 5 — Cross-cutting Polish & Cloud Functions.** FCM notifications, weighted banners, spectator mode, replay mode, server-side Haversine Cloud Function, stuck events cleanup.

### 10.2 Future Concepts C/D (open ideas)

`game_events` architecture is agnostic: adding a new `type` requires no migrations. Ideas pending evaluation:

- **Concept C — The Gymkana** — sequence of geo-located stages to do in order, with required photos or challenges at each stage. Hybrid of Hunt (outdoor) and Quiz (cognitive challenges)
- **Concept D — The Photo Reportage** — event where each participant must take and upload within X time a photo on a given theme, others vote for the best. Extends The Square with competitive dynamic
- **Concept E — The Bivouac Karaoke** — *Partially realized as part of L'Ainulindalë.* Choir Sessions already allow sharing music in DJ mode; a "karaoke" extension with synced lyrics and vocal scoring remains an open idea, depends on community feedback

### 10.3 Future-proofing

- When iOS Safari supports WebXR `immersive-ar` (maybe iOS 28+? indeterminate), the current system can be **paired** with a "real AR" mode as opt-in. Only `ARCaptureLayer` would change; the Firestore data flow stays identical.
- Phase 2 Cloud Functions close known limitations (server-side Haversine, notifications, cleanup, signaling cleanup, P2P hash check). They're not blockers for MVP.
- Automatic quiz generators are already scaffolded (pluggable registry in `quizGenerators.ts`): activation in Phase 2 requires no schema migration nor rule change.
- The Altitude Points system remains unique for the app: no risk of "parallel economies" diverging over time. L'Ainulindalë feeds the same scale.

---

## 11. Integration with L'Ainulindalë

L'Ainulindalë is Marzio1777's audio module, parallel to The Game Field but with its own identity (see `AINULINDALE_TECHNICAL_SPEC.md` for the full specification). The points of **integration** between the two modules are worth documenting, because they touch the points economy and the overall user experience.

### 11.1 Linkability between Choir Sessions and Game Events

An `audio_sessions` can be linked to an active `game_events` via the optional `linkedGameEventId` field. Typical use case: during an August Festival hunt, the admin opens a Choir in parallel as the event's "soundtrack". The musical proposals played during that session inherit the game event multiplier (e.g. 2x → +4 instead of +2 for the proposer).

The link is:
- **Optional**: a session can be standalone with no link (default 1.0 multiplier)
- **Immutable after create**: you don't change the link with session open
- **Read-only**: audio session and game event have independent lifecycles — closing one doesn't close the other

### 11.2 Cumulative Altitude Points

All earnings converge on `users.points` via atomic `increment()`:
- +N captures × multiplier (Concept A)
- +N quiz correct × multiplier (Concept B)
- +2 for each played Theme × multiplier (L'Ainulindalë, if session linked)
- +10 one-shot DJ bonus per session completed ≥30 min

A player-singer can excel in all three modules and accumulate Altitude faster; or specialize in only one and still reach Mayor of Marzio. No nerf, no artificial cap.

### 11.3 Cross-cutting Banners

The Game Field banners and L'Ainulindalë ones coexist in the user's Profile as a single collection. A user can accumulate:
- *The Mayor of the Quiz* (5 quiz wins) + *The Choir Master* (20 DJ sessions ≥30min)
- *The Expert Hunter* (1000pt from hunts) + *The Singer* (50 Themes proposed)
- All together if hyper-active

The Profile UI groups them in two rows: "Game Field Banners" (games) and "Choir Banners" (audio), for easy reading.

### 11.4 Coherent UX

L'Ainulindalë follows The Game Field UX patterns:
- Session creation wizard (admin) analogous to GameCreator
- Lobby for sessions with avatars of participants connecting in real-time
- Identical permission gate (audio permissions request in lobby, not at kickoff)
- Immutable final snapshot (`finalStats` on audio_sessions, like `finalLeaderboard` on game_events)
- RSVP not applicable (sessions are drop-in/drop-out), but the participation pattern is similar

### 11.5 Structural Differences

For clarity, here's what distinguishes the two modules:

| Aspect | The Game Field | L'Ainulindalë |
|---|---|---|
| Root collection | `game_events` | `audio_sessions` |
| States | 6 (draft → completed/aborted) | 2 (open / closed) |
| Key dynamic role | Quiz Host (rotating) | DJ / Conductor (fixed) |
| Binary storage | none | local IndexedDB (Library) |
| P2P transfer | no | yes (WebRTC for Themes) |
| Final snapshot | `finalLeaderboard` array | `finalStats` object |
| Event lifecycle | bounded (kickoff → end) | unbounded (open until DJ closes) |

The two modules are **complementary**, not overlapping. A Marzio evening might see: hunt in the afternoon (Concept A), pizza with quiz (Concept B), Choir as quiz background (linked L'Ainulindalë). Three experiences, one app, one Altitude ecosystem.

---

## Recap for the Hurried Reader

- **The Game Field** is the seventh destination of Marzio1777, with two complementary play modes: **Memory Hunt** (outdoor, light AR, treasure hunt) and **Bivouac Quiz** (indoor, multiplayer photo-trivia).
- **100% reused stack**: no new npm libraries. All with React + Firebase + Tailwind + Framer Motion + react-leaflet + native browser APIs.
- **Unified Altitude Points**: captures, quizzes and (with L'Ainulindalë) musical Themes feed the same global Altitude, with multiplier configurable per event. Choir Sessions can be linked to an active `game_event` to inherit the multiplier.
- **Extended Zero-Trust security**: 10 new "Dirty" specific to the games module (+ 7 "Sauron Dirty" specific to audio in `security_spec_EN.md`), transactional capture validation with `collectedAtLat/Lng` audit log, separate vault for `correctIndex`, dynamic Host role with strict guard on `currentHostId` (rule + `exists()` check on new successor), `finalLeaderboard` as immutable embedded.
- **Integrated aesthetics**: no unjustified new visual patterns, massive reuse of existing components, systematic accessibility (reduced motion, ARIA-live, AAA contrast).
- **Honest MVP**: Phase 2 Cloud Functions to close known limitations (server-side Haversine validation, FCM notifications, signaling cleanup, P2P hash check, automatic quiz generators). Limitations are documented, not hidden.
- **L'Ainulindalë as parallel module**: same philosophy (zero deps, pattern reuse, unified Altitude Points), dedicated specification in `AINULINDALE_TECHNICAL_SPEC.md`, integration documented in §11.

*"It's a village app. Fun first. But done right."*

---

*Document part of the Marzio1777 documentation tetralogy, accompanied by `README_EN.md` (narrative overview), `TECHNICAL_DOCS_EN.md` (technical architecture), `security_spec_EN.md` (defensive matrix) and `AINULINDALE_TECHNICAL_SPEC.md` (audio module specification). For the Italian version see `GAMING_SYSTEM_IT.md`.*
