# Security Specification: Marziese Memories

*May 2026 revision — model extension to The Game Field (game_events, items, leaderboard, quiz rounds, dynamic host) and to L'Ainulindalë (audio_sessions, queue, session conductor, WebRTC signaling, local library).*

*B7 revision May 2026 — post-audit hardening: definitive closure of Sporche #25/#26 "Theme Hijacker", owner-side split of quiz scoring (Sporca #17 hardened), tight ownership on `leaderboard.write` and `participants.delete`, `users.points` increment cap raised to +1000/transaction for coherence with the multiplier range, `validQueueStatusTransition` aligned to the spec'd flow.*

## 1. Data Invariants

### 1.1 Historical Invariants (Memories & Community)

- **User Identity:** A user profile (`users/{userId}`) can only be modified by its owner. The `role` and `accountStatus` fields are strictly immutable for standard users; they can only be modified by an Admin or Root within the codified transitions (see §2). **2026 extension:** `points` is now incremented by owner-side transactions of Concept A (capture), Concept B (self-claim post-reveal — see §1.2) and L'Ainulindalë (Theme played, +5/+10 DJ bonus). All increments go through Firestore atomic `increment()`. The event multiplier is always ≥ 0; point subtractions via game or via audio are **forbidden** (no penalty system by design). **Owner-side cap (B7, May 2026):** the `users.update` rule allows `incoming().points - existing().points ≤ 1000` per transaction (was 50 pre-B7, undersized for `pointsMultiplier ∈ [0.5, 5.0]`). Real anti-cheat lives in the rules of the action that earned the points (`items.update`, `answers.update`, `queue.update`); the `users.points` cap only blocks catastrophic forging (`points: 9999999`).
- **The "Pending" Queue and Role Hierarchy:**
  - Standard users register forcefully as `accountStatus: 'pending'` and `role: 'Guest'`.
  - Root registers organically bypassing this with (`accountStatus: 'approved'`).
  - Admins can modify in `/users` the `accountStatus` and bring it to `approved` paired with `role: 'Guest'`.
  - Admins can elevate from approved Guest to `Admin`.
  - Only Root forces a downgrade or promotes a pending directly to `Admin` or manipulates other Admins.
- **Post Ownership:** A memory (`posts/{postId}`) cannot exist without a valid `authorId` matching the doc's creator user. `authorId` is immutable.
- **Comment Relational Integrity:** A comment (`posts/{postId}/comments/{commentId}`) belongs to its parent Post. If the Post is hidden or private, fetches on commenting authorizations are prevented.
- **Mapped Updates:** Specific actions. A user acts only and exclusively and individually on `caption`, `visibilityStatus`, `visibilityTime`, `showInCinematografo`, or `location`. The Like (heart) update incorporates double validation with array tracking (`likedBy`) mathematically tying the update to paired logics on `likesCount`, preventing loops, count falsifications and infinite upvotes per single post.
- **PII Isolation:** `users` owns `email`. Not queryable in arrays or collection reads by normal users.

### 1.2 Game Invariants (The Game Field)

- **Event Ownership:** A `game_events/{eventId}` cannot exist without a valid `organizerId`. The field is **immutable after create**. Likewise `type` and `createdAt` are fixed. Deletion is only allowed to Root and only if `status != 'active'`.
- **Controlled State Transitions:** The state machine `draft → scheduled → lobby → active → completed` is codified in a rule helper `validStatusTransition(old, new)`. Each state change is server-validated; "backward" transitions or illegal jumps (e.g. `draft → completed`) are rejected. `aborted` is the only allowed lateral exit, from any pre-completed state.
- **Spawned Items Immutability:** Once created in `spawned` state, an `items/{itemId}` has `lat`, `lng`, `points`, `templateId`, `captureRadius` strictly immutable. Only the `status` can transition to `collected`, and only via controlled update (see below).
- **Atomic Capture:** The `update` of an `items/{itemId}` from `spawned` to `collected` must:
  1. Occur during `status == 'active'` of the parent event
  2. Be performed by a `request.auth.uid` that is `participants.status == 'joined'`
  3. Set `collectedBy == request.auth.uid` (no spoofing)
  4. Occur within a Firestore `runTransaction` verifying `resource.data.status == 'spawned'`
  5. Keep ALL other fields invariant (lat, lng, points, etc.)
  6. Include `collectedAtLat` and `collectedAtLng` as audit log for ex-post investigation of "The Teleporter"
- **finalLeaderboard as Immutable Embedded:** Unlike the initial plan (`leaderboard/final` sub-collection), the actual implementation uses an **embedded array `finalLeaderboard`** on the `game_events/{eventId}` document. The rule guarantees immutability via clause: `(resource.data.status != 'completed' || !affectedKeys().hasAny(['finalLeaderboard']))`. Allows the write only in the `active → completed` transition (because in that moment `resource.data.status == 'active'`); after `completed`, any attempt to modify `finalLeaderboard` is rejected, even by Root. History isn't rewritten.
- **Quiz Secret:** The `index` of the correct answer for a round (`correctIndex`) is written **exclusively** in a sub-sub-collection `quizRounds/{roundId}/secret/correctness`. The read rule is restricted to `currentHostId`, `organizerId` and Root. Only at the reveal moment (write on `quizRounds/{roundId}.revealedAt` from one of the host triad), the value is copied into the parent doc, where it becomes readable by all.
- **Validated Quiz Score (B7 — May 2026):** The `update` of `pointsAwarded` on `answers/{userId}` has two authorized paths: (1) **owner-side self-claim** (`answerUserId == request.auth.uid && isEventParticipant(eventId)`), preferred by the client `claimMyAnswerPoints`; (2) **host-triade override** (`currentHostId | organizerId | Root`) for Root recovery. In both cases the rule re-derives the truth from the public `correctIndex` post-reveal and enforces: `revealedAt != null`, `affectedKeys().hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap aligned to the actual round configuration, no longer just `pointsMultiplier × 100`), and `selectedIndex == correctIndex` when `pointsAwarded > 0`. **Split rationale:** the previous version had the host writing `users/{otherUid}.points` for every participant, but the `users.update` rule only allows the owner to increment; the flow was actually rejected in production. Self-claim flips the pipeline keeping anti-cheats unchanged. The client guarantees claim singularity via `localStorage[marzio1777:quiz-claimed:{roundId}:{uid}]`; a malicious retry with `pointsAwarded > 0` on a wrong answer is still rejected by the rule.
- **Host as Ephemeral Role — Successor Validation:** The `currentHostId` of an event can be changed only by the outgoing host, the organizer or the Root. The rule isolates the diff with `affectedKeys()` to ensure the host cannot modify OTHER fields of the event (status, multiplier, configurations). **Additionally, the new `currentHostId` must be a participant with `status == 'joined'`**, validated via rule `exists()` + `get()` on the `participants/{newHostId}` sub-collection. A malicious host cannot write `currentHostId = "alien-uid"` to freeze the quiz, nor can they promote themselves to organizer.
- **One Vote, One Round:** A participant can create only one `answers/{userId}` per `quizRounds/{roundId}`. Subsequent updates are rejected. The answer must be submitted `< endsAt` (no late submissions).
- **Live Locations PII:** Even during a `treasure_hunt` event, a player's live position is written only into `user_locations` (split collection), and only if `participants.shareLocationDuringEvent == true` (per-user override). The event opt-in (`game_events.visibilityOfOthers`) is the organizer's permission to enable visibility; the individual user's consent always prevails.
- **Tight Leaderboard Ownership (B7 — May 2026):** the rule `game_events/{}/leaderboard.{userId}.write` now allows only: (a) self-write (`userId == request.auth.uid`), the hot path of capture transactions and quiz self-claim; (b) `isEventOrganizer(eventId)`; (c) `isRoot()`. Pre-B7 any `isEventParticipant || isAdminOrRoot` could overwrite anyone's leaderboard, allowing a malicious participant to zero out a rival's score.
- **Tight Participants Delete Ownership (B7 — May 2026):** the rule `game_events/{}/participants/{userId}.delete` allows only self-leave (`userId == request.auth.uid`), `isEventOrganizer(eventId)` (legitimate kick), and `isRoot()`. Pre-B7 the `isApprovedUser` allow let anyone remove other participants.

### 1.3 L'Ainulindalë Invariants (Audio Module)

- **Session Ownership:** An `audio_sessions/{sessionId}` cannot exist without a valid `djId` matching `request.auth.uid` at create time. `djId` is **immutable after create**. Likewise `createdAt` is fixed. Create is restricted to `role in ['Admin', 'Root']` (Guests cannot open sessions).
- **Mono-directional State Transition:** A session's `status` can only go from `'open'` to `'closed'`. Never the reverse. Once closed, the session is **permanently archived**: no writes on the session, queue, or participants are allowed any more, not even by Root. The `finalStats` are atomically populated in the same `open → closed` transition and immediately immutable.
- **`djBonusAwarded` as One-Way Flag:** Optional bool on `audio_sessions/{sessionId}`. The rule allows the `false → true` transition (or undefined `→ true`) **exactly once**, during the session-close batch, if `totalDurationMs > 30 min`. Any attempt to set it back to `false`, to re-credit `users.points` with a second bonus, or to touch the field after `status == 'closed'` is rejected. Anti double-spend for the +10 long-session bonus.
- **Proposal Immutability (B7 — May 2026):** A `queue/{itemId}` has `proposedBy`, `localTrackId`, `proposedAt` and all track metadata (`trackTitle`, `trackArtist`, `trackDurationMs`, etc.) **immutable after create**, now enforced via `affectedKeys().hasOnly(['status', 'position', 'transferStartedAt', 'transferCompletedAt', 'transferFailureReason', 'pointsAwarded'])` plus an explicit redundant check on each metadata field (`incoming().proposedBy == existing().proposedBy`, etc.) as defense-in-depth. Pre-B7 the rule only checked the status; the DJ could technically rewrite `trackTitle`/`proposedBy`/`localTrackId` closing "Sporca #25" only ~70%. See §2.3 items #25/#26.
- **Session Conductor (DJ) as Exclusive Role:** Only the `djId` (and Root as administrative fallback) can:
  - Modify `currentQueueItemId`, `currentTrackTitle`, `currentTrackArtist`, `currentTrackDurationMs`, `currentTrackStartedAt` (i.e. write the "now playing")
  - Reorder the queue (modify `queue/{X}.position`)
  - Skip a track (`queue/{X}.status = 'skipped'`)
  - Switch `mode` between `'auto'` and `'manual'`
  - Close the session (`status = 'closed'` + populate `finalStats`)
  - Kick a participant (`participants/{X}.status = 'kicked'`)
  - Award `pointsAwarded` at the `playing → played` transition
  
  Dedicated rule helper `isSessionDJ(sessionId)`. A non-DJ participant attempting any of these mutations is rejected.
- **Queue Create Constraints:** The create of a `queue/{itemId}` is allowed only if:
  - `request.auth.uid` is participant (`participants/{auth.uid}.status == 'joined'`)
  - `proposedBy == request.auth.uid` (no proxy)
  - `status == 'queued'` at create time (no skip to 'ready' state)
  - Number of own queue items with `status in ['queued', 'transferring', 'ready']` is ≤ effective_maxQueuedPerUser, where `effective = rules.maxQueuedPerUser + floor(user.points / 100) * rules.bonusPerHundredPoints`
  - If `rules.allowDuplicates == false`, no existing queue items by same user with same `localTrackId` in active state
  - `trackDurationMs` ≤ 600_000 (10 minutes, sanity cap)
  - `trackCoverDataUrl`, if present, ≤ 70_000 base64 characters (~50KB image cap)
- **Audio Score Validation:** The `update` of `pointsAwarded` on `queue/{itemId}` is allowed only by the DJ (or Root), with cap `pointsAwarded ∈ [0, 50]` enforced directly in rule (B7 — pre-fix the cap existed only as "≥ 0" without an explicit upper bound). Coherent with `BASE_TRACK_POINTS × max_eventMultiplier = 2 × 5 = 10` plus margin.
- **Ephemeral & Confidential Signaling:** Documents `audio_sessions/{sessionId}/signaling/{userId}` are readable **only** by the session's `djId` and the doc-owning `userId`. No other participant can read them. Create is restricted to `request.auth.uid == userId` (proposer) or `request.auth.uid == djId` (DJ initiating transfer). Documents have an `expireAt` marking expiration for periodic cleanup (Phase 2 Cloud Function). No personal data or binary file is ever written here — only SDP offer/answer and ICE candidates.
- **No Audio Files in the Cloud:** **By design, no audio bytes are ever written to Firestore or Firebase Storage.** Music files live exclusively in the proposer's local IndexedDB (`marzio1777_audio` DB), and during a session they are transferred peer-to-peer device-to-device via WebRTC. The Firestore rule doesn't need to protect audio files because none exist. Only metadata (title, artist, duration, optional cover ≤50KB) travels on collections.
- **Participant Heartbeat:** A `participants/{userId}.lastSeenAt` is writable only by the `userId` itself (auto-heartbeat every 15s client-side). Marks live presence and enables the `autoSkipOfflineProposers` flag: if a proposer is offline (>60s from last heartbeat) and their turn comes up in queue, the DJ Engine can auto-skip without penalties.
- **Linkability with Game Events:** The optional `linkedGameEventId` field on `audio_sessions/{sessionId}` is immutable after create. When linked to an active `game_events/{eventId}`, played proposals inherit the event multiplier for the proposer's bonus points (e.g. August Festival 2x event → +4 instead of +2). The link is a read-only reference: the audio session and game event remain independent in lifecycle.

## 2. The "Dirty" — Attack Vector Catalog

### 2.1 The Historical Dirty Dozen (Memories & Community)

1. **The Shadow Update:** Trying to insert non-validated bogus fields to have them read.
2. **The ID Poisoner:** Gigabyte-sized string IDs. Cut at the root.
3. **The Privilege Escalator (RBAC Bypass):** User attempts internal mutations to "Admin," hard-stopped.
4. **The Admin Demotion (Admin Bypass):** Peer attempt to demote an Admin, denied.
5. **The Value Poisoner:** String payload sent expecting a specific Type. Blocked.
6. **The Email Spoofing Test:** Bypass with unverified fake email (email_verified flag fail).
7. **The PII Blanket Test:** Query scraping of app info to read arrays, voided.
8. **The Timewarp:** Comment creation in 2088 blocked.
9. **The Denial of Wallet (Arrays):** No entity contains excessive lists in static arrays. Listed in collection.
10. **The Outcome Override:** Alterations of concluded events rejected.
11. **The Unauthorized Relational Grab:** Comment retrieval in private queries will reject access immediately.
12. **The Orphanizer:** Prevents mass destructions but orphans of the main creator by maintaining the author check.

### 2.2 The Ten Game Field Dirty (2026 Extension)

13. **The Phantom Item:** Creation of a new `items/{itemId}` by a non-organizer participant during an active event (auto-spawn cheat). Blocked: rule limits item creation to `draft|scheduled` phases and to `organizerId`/Admin/Root.
14. **The Teleporter:** Attempt to capture an item while the player is beyond `captureRadius`. **Known MVP limitation:** the Firestore rule cannot perform Haversine calculations (limited DSL). Current mitigation: `collectedAtLat/Lng` saved for audit log; full mitigation delegated to Phase 2 Cloud Function.
15. **The Phantom Host:** Attempt by a participant to write to `quizRounds/{roundId}/secret/correctness` or to reveal the answer without being `currentHostId`. Stopped by the rule via helper `isCurrentHost(eventId)` with organizer/host/Root triad.
16. **The Self-Crowning:** Attempt by a participant to rewrite `currentHostId` nominating themselves as new host. Blocked: the update rule on `game_events` isolates the field via `diff().affectedKeys().hasOnly(['currentHostId', ...])` and permits the write only to outgoing `currentHostId`, organizer or Root, **and verifies via `exists()` + `get()` that the new host is a participant with `status == 'joined'`**.
17. **The Score Forger:** Optimistic write of `pointsAwarded: 9999` on one's own `answers/{userId}` post-reveal with a wrong answer. **Hardened (B7, May 2026):** the `answers.update` rule now allows owner-side self-claim (`answerUserId == request.auth.uid && isEventParticipant`) but simultaneously enforces: `revealedAt != null`, `affectedKeys.hasOnly(['pointsAwarded'])`, `pointsAwarded ∈ [0, photoQuizConfig.maxPointsPerRound × pointsMultiplier]` (cap aligned to actual round configuration), and `selectedIndex == correctIndex` as precondition for `pointsAwarded > 0`. The client transaction `claimMyAnswerPoints` also credits `users/{me}.points` with an `increment(pts)` capped at +1000/transaction. Triple cap (rule answers, rule users, round configuration) — a cheat would have to bypass all three.
18. **The Late Submitter:** Submit of an `answers/{userId}` after the round's `endsAt`. Blocked: rule check `request.time < endsAt` on create.
19. **The Ghost Capture:** Attempt to "capture" an item already `collected`. Naturally resolved by the `runTransaction`: the replay detects the changed status and fails the transaction. The player sees a handled error, no double-spend.
20. **The Speed Demon (false GPS):** GPS spoofing from DevTools (desktop browser). **Tolerated by design:** village app, closed whitelisted community. The rule rejects only blatantly absurd accuracy (>100m); the rest is delegated to audit log and the human eye. The philosophy: if Mario plays from home pretending to be out, it gets discovered at the next pizza night.
21. **The Time Bandit:** Attempt to force an event from `draft` directly to `completed` to skip the game and lock the leaderboard. Blocked by the `validStatusTransition` rule which only allows chained transitions.
22. **The Resurrectionist:** Attempt to write on `finalLeaderboard` after `status == 'completed'`. Blocked: the rule rejects any update modifying `finalLeaderboard` when `resource.data.status == 'completed'`. The `active → completed` transition is the only moment when `finalLeaderboard` is writable.

### 2.3 The Seven Sauron Dirty (L'Ainulindalë Extension 2026)

23. **The Phantom DJ:** Attempt by a Guest (or even generic Admin) to open an `audio_sessions` as `djId == auth.uid` to acquire Conductor authority. Blocked: create rule restricts to `role in ['Admin', 'Root']`. Similarly, a Guest cannot write `currentQueueItemId` on a session they don't DJ — blocked by rule via `isSessionDJ(sessionId)`.
24. **The Queue Stuffer:** Attempt by a proposer to write 50 active queue items ignoring the per-user limit. **Formula mitigation (May 2026):** the `queue.create` rule requires the derived field `incoming().effectiveMaxAtCreate` (a number) and validates it against the helper `effectiveMaxQueued(sessionId)`, which rebuilds in DSL the formula `rules.maxQueuedPerUser + int(getUserDoc().points / 100) * rules.bonusPerHundredPoints`. Forging the value (e.g. writing `effectiveMaxAtCreate: 9999`) → rejected with `PERMISSION_DENIED`. **Known DSL limitation:** the actual count of active proposer documents is not expressible in Firestore DSL (no document counting). Final count enforcement is deferred to Phase 2 CF (`enforceQueuePerUserLimit`, see `MIGRATION.md`); the current mitigation closes the forge but not the pure count.
25. **The Theme Hijacker:** Attempt to modify `proposedBy`, `localTrackId`, or track metadata of a queue item after create. **100% closed (B7, May 2026):** `audio_sessions/{}/queue.update` now requires `affectedKeys().hasOnly(['status', 'position', 'transferStartedAt', 'transferCompletedAt', 'transferFailureReason', 'pointsAwarded'])` + redundant explicit check (`incoming().proposedBy == existing().proposedBy`, etc.) as defense-in-depth. A malicious proposer cannot retroactively change `proposedBy` to blame others for their own license error, nor change `localTrackId` to "swap" the track. Pre-B7 the rule rejected only invalid status transitions; technically the DJ could still rewrite metadata. Tests: `firestore.rules.audio.test.ts` cases "DJ cannot rewrite proposedBy/trackTitle/localTrackId".
26. **The Theme Hijacker (DJ variant):** Attempt by the DJ to modify metadata of someone else's proposal (e.g. change `trackTitle` to shift blame to a proposer). **100% closed (B7, May 2026):** the same `affectedKeys.hasOnly` + explicit checks mechanism applies to anyone, DJ included. Metadata is immutable for the DJ as much as for the proposer. The DJ can only skip/play/mark 'failed' and award `pointsAwarded` (capped at 50), not rewrite what the proposer wrote.
27. **The Player Ghost:** Attempt by a listener to write `currentTrackStartedAt` or `currentQueueItemId` to "spoof" the now playing seen by others (e.g. make others think their proposal is playing when it isn't). Blocked: only the DJ (`isSessionDJ`) can modify now playing fields. The rule helper isolates these fields and rejects non-DJ updates.
28. **The Resurrectionist (audio variant):** Attempt to write to a session (any sub-collection: queue, participants, signaling, parent doc) after `status == 'closed'`. Blocked: the `match /audio_sessions/{sessionId}` rule has a top-level clause `allow write: if resource.data.status != 'closed'` that propagates to all sub-collections via `isSessionOpen(sessionId)` helper. Once closed, the session is engraved.
29. **The Mass Skipper:** Attempt by a DJ to mark 'skipped' hundreds of proposals in rapid burst to "obstruct" a specific proposer. **Tolerated by design:** the DJ has authority over their session, it's a conscious choice having entrusted it to a trusted Admin/Root. The `participants/{X}.status = 'kicked'` is the remedy for genuinely abusive cases (Root can always intervene). Skip audit log not implemented in MVP — Phase 2.
30. **The Signaling Spammer:** Attempt by a participant to write hundreds of documents in `audio_sessions/{X}/signaling/` to saturate the DJ's onSnapshot queue. **Blocked (May 2026):** the sub-collection rule `match /audio_sessions/{sessionId}/signaling/{userId}` allows `read/create/update/delete` ONLY to the proposer (`userId == request.auth.uid`) or the session DJ (`isSessionDJ(sessionId)`). A third party cannot create `signaling/{otherUid}` nor read someone else's. `sessionId` is now implicit in the path (was top-level before the fix), eliminating the inverse-lookup need. IP/UID rate limiting is still delegated to Firebase project quotas. Periodic cleanup Cloud Function in Phase 2 to handle orphans (`cleanupOrphanSignaling`). Rule tests: `firestore.rules.audio.test.ts` cases "third-party rejected" + "DJ allowed" + "proposer self".

### 2.4 Known Limitations (and Accepted) — Recap

| Limitation | Vector | Module | Current mitigation | Full mitigation |
|---|---|---|---|---|
| Capture without being in radius | The Teleporter (#14) | Games | ✅ closed Phase 2 (May 2026) — CF `validateCaptureDistance` server-side Haversine + `serverValidatedAt` ≤30s on `items.update` | — |
| Desktop browser GPS spoofing | The Speed Demon (#20) | Games | Rule rejects accuracy >100m | — (community-level trust) |
| Host sees correctIndex pre-reveal | inherent in design | Games | Transparent UX (banner "Host sees") | Phase 3 (would need a quiz CF orchestrator) |
| Pre-event FCM notifications | ✅ closed Phase 2 (May 2026) — `notifyKickoff` CF on `europe-west1`, `users.{uid}.fcmTokens[]` capped at 20, dedicated Service Worker, opt-in UI in ProfiloPersonale | Cross-cutting | — | — |
| DJ skip burst | The Mass Skipper (#29) | Audio | Root can intervene + skeleton CF `auditMassSkip` deployed (no-op TODO) | Phase 3 (rolling-window counter on `audit_state/{sessionId}`) |
| Orphan signaling | The Signaling Spammer (#30) | Audio | ✅ closed Phase 2 (May 2026) — CF `cleanupOrphanSignaling` cron 5 min on `europe-west1` with collectionGroup query + chunked batch delete | — |
| Queue stuffer count | The Queue Stuffer (#24) | Audio | ✅ closed Phase 2 (May 2026) — CF `enforceQueuePerUserLimit` callable counts proposer's active docs; rule `effectiveMaxAtCreate` snapshot remains as a safety net | — |
| Tampered transferred files | hash check absent | Audio | skeleton CF `validateP2PTransferIntegrity` deployed (returns `unimplemented`) | Phase 3 (needs `blobSha256` field on `QueueItem`) |
| Track copyright license | trust model | Audio | UI warning "golden rule" | — (community-level trust) |
| Theme Hijacker DJ-side | The Theme Hijacker (#25/#26) | Audio | **100% closed (B7)** via `affectedKeys.hasOnly` + explicit metadata checks | — (vector closed) |
| Score Forger post-reveal | The Score Forger (#17) | Games | **Hardened (B7)** with triple cap: rule answers cap (`maxPointsPerRound × pointsMultiplier`), rule users cap (+1000/tx), monotonic users.points increment | — (vector mitigated at rule level) |
| Cross-leaderboard rewrite | new vector identified in B7 audit | Games | **Closed (B7)** via `userId == auth.uid` on `leaderboard.write` | — (vector closed) |
| Cross-participant kick | new vector identified in B7 audit | Games | **Closed (B7)** via `userId == auth.uid \|\| isEventOrganizer \|\| isRoot` on `participants.delete` | — (vector closed) |

**May 2026 update:** Phase 2 closed at 100% for hardening CF (8 CF live on `europe-west1` / `nodejs22`). The remaining items in the table are either real Phase 3 limitations (skeleton callables already deployed, awaiting tracking fields that don't exist yet) or by-design trade-offs (Speed Demon, Host sees correctIndex).

## 3. Test Runner

Verify exact schema for proper, tested and isolated handling that always includes the points above, making Firestore an effective shield and not just a virtual one limited to UI logic.

**2026 Extension — Game Field Test Suite:**

Firestore rule tests (with `@firebase/rules-unit-testing` on emulator) cover at least the following critical scenarios:

- `items.update` concurrency: two simultaneous clients on the same item → only one commits, the other fails
- `correctIndex` not readable by non-host participant pre-reveal
- `correctIndex` readable by all post-reveal
- `currentHost` ≠ `organizer` can create round, write `secret/correctness`, perform reveal
- Random participant CANNOT modify `currentHostId` (PERMISSION_DENIED)
- Outgoing `currentHost` CAN write the new `currentHostId` IF successor is joined participant
- Outgoing `currentHost` CANNOT write `currentHostId = "alien-uid"` (new check via exists+get)
- `currentHost` CANNOT modify OTHER event fields (status, multiplier, etc.)
- `answers.create` after `endsAt` rejected
- `answers.update` with `pointsAwarded > 0` but `selectedIndex != correctIndex` rejected
- `answers.update` with `pointsAwarded > maxPointsPerRound` rejected
- Invalid state transition (e.g. `draft → completed`) rejected
- Update of `finalLeaderboard` when `status == 'completed'` rejected (even by Root)
- Pending Guest sees no `game_events/*`
- Approved Guest not invited does not see the specific event

**2026 Extension — L'Ainulindalë Test Suite:**

Audio rule tests (`firestore.rules.audio.test.ts`) cover:

- Guest cannot create `audio_sessions` (PERMISSION_DENIED)
- Admin can create session with `djId == auth.uid`
- Admin cannot create session with `djId == otherUid` (no spoofing)
- Modify of `djId` post-create rejected (immutable field)
- Only DJ can write `currentQueueItemId` / `currentTrackStartedAt` / `mode`
- Listener tries to write now playing → PERMISSION_DENIED
- Queue.create with per-user limit respected (test with bonus formula on user.points = 0, 250, 500)
- Queue.create exceeding limit → PERMISSION_DENIED
- Queue.update of `proposedBy` post-create → PERMISSION_DENIED
- Queue.update of `pointsAwarded` from listener → PERMISSION_DENIED
- Queue.update of `pointsAwarded > 50` from DJ → PERMISSION_DENIED
- Signaling read by third participant → PERMISSION_DENIED
- Signaling read by DJ session-owner → ALLOWED
- Signaling read by userId doc-owner → ALLOWED
- Write on session `status == 'closed'` → PERMISSION_DENIED (test on queue, participants, signaling, parent doc)
- `finalStats` write post-closed → PERMISSION_DENIED

Each test uses a `firestore.rules.test.ts` (games) and `firestore.rules.audio.test.ts` (audio) with isolated suites and full emulator teardown. Real test output preserved in CI.

**General philosophy:** reduce the attack surface to what is effectively possible and verifiable via rule (Firestore DSL), explicitly accept known limitations (server-side Haversine, P2P hash check), and delegate to Cloud Function (Phase 2) anything the DSL cannot express. Every tolerated limitation is documented and has a corresponding audit log for ex-post investigation. The audio module adds a new dimension to the defensive matrix: the **distributed trust** on musical content (user copyright responsibility) and the **ephemeral surface** of WebRTC signaling (very short lifetime, content limited to SDP/ICE, no sensitive data ever written).

**B7 extension (May 2026):** post-audit hardening, added rule tests for:
- `users.points` cap +1000/transaction (5 cases: within cap, at cap, above cap, decrement, cross-user)
- `answers.update` self-claim post-reveal (5 cases: correct success, wrong with pts>0 fail, wrong with pts=0 success, cross-user fail, over-cap fail)
- `leaderboard.write` ownership-tight (2 cases: self success, cross fail)
- `participants.delete` ownership-tight (3 cases: self-leave success, cross-participant fail, organizer success)
- `finalLeaderboard` immutability post-completed (1 case)
- `audio_sessions/{}/queue.update` Theme Hijacker (8 cases: transition valid, shortcut blocked, metadata immutability, pointsAwarded cap, listener forbidden)

Total: ~24 new rule tests on top of the pre-existing ones.
