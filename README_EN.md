# 🌲 Marzio1777
**The Digital Time Machine for Mountain Memories**

Welcome to **marzio1777**, the project that takes nostalgic memories (cool summer evenings, hairpin turns up the mountain, the smell of polenta, faded photos from the '80s) and slams them headfirst into Web 3.0 (or close to it).

This isn't just a "photo site." It's a **digital Town Square**, a memory vault where holiday-makers and full-blood "marziesi" can preserve the village's history, organize events, and gather around to chat. And since we didn't want anything boring, we've stuffed in points, banners, parlor games, actual treasure hunts through the streets of the village, and — newest arrival — also our shared Great Music!

---

## 🗺️ What's Inside? (The Attractions)

### 📸 1. The Square (The Social Feed)
The virtual gathering spot. No toxic algorithms, just square Polaroids of the past and updates on our get-togethers.
- **Time Filters:** Travel through time by viewing only photos from the "70s," "80s," and so on.
- **Magic Micro-interactions:** Like a photo and enjoy particle explosions. Through your Profile, you can customize these particles by replacing the shape (🌿, ❄️, 🔥), the vector colors, and even tuning the reactivity. Prefer something subtle? Pick the pure, iconic "Heartbeat" with no particles! Also, no infinite likes: you can leave a single reaction and take it back any time (toggle).
- **Comments and Discussions:** Chat, comment, and earn "Altitude Points."

### 🏕️ 2. The Bivouac (Events and Grills)
The official board for scheduling get-togethers and events!
- **New Appointment:** Pin a meetup spot, pick a date, invite whoever you want.
- **Who's Coming and How Many:** Interactive RSVP. Tell us how many are joining, so we don't buy too much polenta.
- **The Extreme Shopping List:** Who's bringing what? "Assign to me" an item, or assign one to someone else. A checkbox tells you if everything's set.
- **The "Tab Notebook" Wallet:** Did we split the bill at the pizzeria or for the grill? Everyone enters their expenses and the system runs the math to split the bill and tell you who owes whom!

### 🎞 3. The Cinema (The Projection Hall)
Our movie theater! A full-screen photo gallery built specifically for evenings together to be projected on TV.
- **Display & Autoplay:** Let it cycle lazily or keyboard-flip through our lives. The overlay "card" shows credits and you can hide it like a curtain to make room for the photo.
- **Fast Filters:** Browse the collection focused on a single uploader, or pick by era (e.g. "All 90s photos uploaded by Mario Rossi I've never seen").
- **"Images Only" Mode:** Activate this to fully hide metadata, credits, and UI for a completely immersive full-screen visual experience.
- **Group Games ("Gamification"):** Test yourself with "Guess Who!" and "Guess the Year!". Pick from 4 on-screen options to reveal the photo's details: a correct answer earns you +5 Altitude Points, a wrong one costs you -2!

### 🧳 4. The Trunk (Upload Center)
Not just a simple upload form, but an actual artisan workshop.
- **No Limits:** Drag tons of photos at once from your PC: the automated processing queue takes care of it.
- **The "AI Memory" 🤖:** Use the "Magic Scan Spark" scanner! Can't put words to that mountain hut? The AI will write it up in pure "mountain/dialect" vocabulary and fill the form for you!
- **Advanced Map Pin:** Attach the GPS tag by browsing the digital map!

### 🧭 5. The Map (Cartography of Memories)
None of the memories drift on the wind — they all land pinned on the local map!
- Search the kiosk or the street where you uploaded photos and the map will cluster them with the classic interactive numeric pointers. Click the bubbles and dive straight into the original post!
- **Real-Time Sharing:** Toggle this on in your profile and your friends will see your "live" position on the map when you're out exploring the village.
- **Floating Filter Panel:** Explore the map by actively filtering in real time by Author and by Decade (e.g., "I only want pins from the 50s").

### 🌳 6. The Big Tree (Live Bulletin Board)
The bench under the tree. It's a proper little real-time chat room ("On the Benches Under the Tree") for typing four quick silly things at a glance Telegram-style without even unlocking your phone!

### 🎯 7. The Game Field (Village Challenges)
The Square turns into an arena. **The Game Field** is our event-based gamification hub: Admins schedule game sessions with time, invites and rules, users accept, and at the "X" hour the starting bell rings.

There are two ways to play, complementary like cheese and polenta on the same plate:

- **🍺 The Memory Hunt (Concept A):** Our marziese Pokémon GO! The organizer scatters customizable "virtual objects" across the village map (beers for the August Festival, mushrooms for the autumn forage, Halloween pumpkins, peaks for the Monarch's hike, and any goofy theme you can dream up). Players walk physically around Marzio with phone in hand: when close enough to an object, the camera kicks in with a lightweight augmented-reality overlay. Tap, capture, +N Altitude Points. Whoever collects the most wins. "Legacy Posts" mode turns the hunt into a journey through the village's memory: it pulls real public posts from the archive, and each "treasure" is an old photo to be "rediscovered" where it was actually taken.

- **🎬 The Bivouac Quiz (Concept B):** Evening, after dinner, from the couch, at the pizzeria, even remotely! Real-time multiplayer photo-trivia drawing from our archive: recognize who's in the photo, guess the decade, the location, the original caption, or sort a series of shots in chronological order. Decay scoring: those who answer correctly and quickly score more. The host composes questions through a 4-step sequential wizard (in MVP composition is guided-manual; future releases will draw automatically from the archive). One participant at a time plays the **Host**: keeps the timer, reveals the answer, leads the round; can rotate from question to question or stay fixed, at the organizer's discretion.

For both games:
- **Invite System:** All Admins/Roots are auto-invited by default (consistent with the Bivouac philosophy). The organizer can extend invites to approved Guests with one tap.
- **Lobby:** 5 minutes before kickoff the waiting room opens — you see participants' avatars connecting in real time, and you're prompted to grant permissions (GPS, camera, motion sensors for iOS) calmly, not at the starting whistle.
- **Player Visibility:** opt-in per event (organizer chooses), opt-out per user (each participant can always hide).
- **Altitude Points + Event Multiplier:** every event can have a multiplier (e.g. August Festival: 2x). The game points are multiplied before flowing into your global Altitude, carved into the Firestore marble with atomic increments.
- **Final Leaderboard Snapshot:** when an event ends, the leaderboard is "engraved" in an immutable field of the event document, browsable forever in the games archive.

### 🎵 8. L'Ainulindalë (The Great Music of the Bivouac) — *Newest arrival*

> *"Then Ilúvatar said to them: 'I will now bid you make in harmony together a Great Music.'"*
> — The Silmarillion

L'Ainulindalë is our shared music corner. A name inspired by the song that, according to Tolkien, created the world. A village app couldn't lack a soundtrack — and this is ours. For serious people: metal, hard rock, prog, hip hop, niche artists, Vai and Satriani, the real stuff. No Bieber.

It has three things inside:

- **🎧 The Personal Library (the Walkman):** Upload your tracks (MP3, M4A, OGG, FLAC) directly to your device, stored in local IndexedDB. No cloud, no costs, no copyright headaches. It's your personal walkman: list, search, playlists, 3-band equalizer, waveform visualizer, spinning vinyl in the full-screen player, lock screen integration on iOS/Android via Media Session API. Works even with phone in pocket, screen off, in PWA installed mode.

- **🎼 The Choir Sessions (the DJ):** An Admin/Root opens a **Choir Session**, other marziesi connect. Everyone proposes *Themes* (tracks from their Library) to the **Common Queue**. The *Conductor* (DJ) plays them one after another. Default mode is **automatic**: the queue runs on its own, FIFO, no clicks needed. Whoever really wants to "play DJ" gets a mini-panel with skip, reorder, kick, manual mode, session-blacklist.

- **🌐 P2P Transfer (the magic):** When the DJ is about to play your track, the file is transferred **directly from your phone to theirs, peer-to-peer via WebRTC**. No file uploaded to servers. No bandwidth costs. No music data flying through the cloud beyond what's necessary. Only metadata (title, artist, duration) is visible in the shared queue.

Gamification rules: each user can propose **N Themes** in the queue at a time (default 2), with **bonus** based on the Altitude Points accumulated in app lifetime (250pt = +2 extra Themes, 500pt = +5, etc — veterans have more voice). When your Theme actually gets played, you earn +2 Points. A DJ who completes a session of at least half an hour pockets +10 bonus. Themed banners: *The Singer*, *The Sub-Creator*, *The Conductor*, *The Choir Master*, *The Voices of Ilúvatar*, and — for jokers — *The Discordant*.

Aesthetic: dark-flame (slate black, amber, crimson). Full-screen player with rotating vinyl, reactive visualizer, amber particles floating from covers. When a session is on, the app transforms. It's beautiful to watch and beautiful to hear.

### 🪪 9. The Profile and Archive Management (Privacy and Gamification)
- **Archive Management:** Not everything has to land on the Square right away! Hide your embarrassing photos, decide whether to show them temporarily (timed), hide them from the Cinema, or apply mass permissions to all your past adventures.
- **Altitude and Experience:** A real-life video game. Altitude Points stacked by interacting, commenting, uploading photos, winning hunts and quizzes, proposing Themes to Choir Sessions. Climb high enough and you'll earn fantastic Banners to show off, like: *The Holiday-Maker, The Expert Tourist, The Mayor of Marzio, The Memory Hunter, Iron Memory, The Singer, The Choir Master*.

---

## 🔒 Security, Roles & Zero-Trust Architecture

We have to protect the historical heritage and personal data of our small community. The system uses complex role-based logic (RBAC) and real-time request validation:

- **The City Gate (Pending Account):** When a user logs in for the first time, they don't get in immediately! They become a *Pending* state. To prevent bots or snoopers, the app shows them a closed gate. In the "Management Panel," admins see a red notification badge with new "immigrants" waiting and can decide whether to let them into the village.
- **Permission Nursery Rhyme (App Roles):**
  - **Guest (Passing-Through Tourist):** Once approved as a Guest, users get into the App but only see... the App itself. At the code level, a Guest is strictly forbidden from accessing or reading any community-generated data (posts, chats, users, events, maps, games, audio sessions). They can navigate the pages but they'll appear completely "blank." The interface also blurs everything with an explicit overlay telling them that until an admin sees fit to promote them, there's nothing here.
  - **Admin (The Mayor/Sheriff):** They use the App in full. They interact, comment, post, organize events and hunts, open Choir Sessions as DJ. They have a "Management Panel" to vet the Pending. They can promote known faces from Guest to Admin, and they can approve "Pending" newcomers as "Guest." They can't do worse damage (no demoting Admins).
  - **Root (The Enlightened Monarch):** There's only one creator (nicolainformatica). Root doesn't sit on the bench, they oversee. They can do everything an Admin does plus divine powers: approve a Pending straight to Admin, return a misbehaving Admin to Guest, cancel events even mid-game, step in as "emergency Host" during a Quiz or a Choir.
- **Round Host (dynamic role — Quiz only):** Exists only during a Quiz-type event. It's the user actively running the current round: keeps the timer, reveals the answer, awards points after reveal. By design, the Host sees the correct answer before others (it's unavoidable and accepted as part of the meta-game). They can pass the scepter to the next (automatic or manual rotation). The event's Organizer and Root can always step in as "emergency Host" if the current one disconnects.
- **Session Conductor (dynamic role — L'Ainulindalë only):** An Admin/Root who opened a Choir Session. Only they can write the session's "now playing", reorder the queue, skip, kick, switch auto/manual mode. The session closes with `status: 'closed'` and is immutable forever.
- **Unbreakable Firestore Rules:** This filter isn't visual, it's locked in at the "Zero-Trust Database" levels (native backend RBAC). Anyone trying to act beyond their state is rejected. The `game_events` and `audio_sessions` collections follow the exact same model: every write goes through state validations, controlled state transitions, and the capture of objects during a hunt uses an **atomic transaction** ensuring that even if two players reach the same treasure within the same millisecond, **only one wins**. Same pattern for music proposals in the queue: rules validate per-user limits, immutability of created proposals, anti-cheat on assigned scores.
- **Split Collection (PII Privacy):** Sensitive data (like your email or keys) is stored in separate, unreadable vaults; only your public presence for "The Map" and "The Game Field" is broadcast, and only if you've given explicit consent. **No music files on Firebase Storage**: Themes live on your device, and when transferred during a Choir Session they go peer-to-peer device-to-device, never through the servers.

---

## 📱 How to Install the App on Your Phone (PWA)

You can install us easily without clogging the App Store!

- **iOS / iPhone (in Safari):** Open the app in Safari > center button (square with arrow ⬆️) > **"Add to Home Screen"**.
- **Android (in Chrome):** Open the app > 3 dots up top ⠇ > **"Add to Home Screen / Install App"**.
- Our icon will appear on your smartphone and you'll skip the browser windows entirely!

> **Note for The Game Field:** The Memory Hunt runs best in installed PWA mode. The capture camera, high-precision GPS, screen wake lock and motion sensors work much more stably outside the browser. If you're an Admin organizing a hunt, explicitly recommend PWA installation to invitees before kickoff.

> **Note for L'Ainulindalë:** The Walkman and Choir Sessions work best in installed PWA mode. Background playback with screen off, lock screen integration with metadata and controls, expanded IndexedDB storage, stable WebRTC connections — everything improves outside the browser. If you really want to use the app as a daily walkman, install it. We only ask you to upload music you have rights to — no Spotify rips, no stuff downloaded from sketchy places. Golden rule: "if you wouldn't put it on a USB stick to lend a friend, don't put it here."

---

## 🛠️ How to Run the App "Offline" or for Development (Instructions for the Village Hacker)

1. **Make sure you're using Node.js.**
2. **Pull the packages:**
   ```bash
   npm install
   ```
3. **Drop your special file (DB keys etc)** `.env.local`
4. **Fire it all up:**
   ```bash
   npm run dev
   ```
5. You're now connected at `http://localhost:3000`.

*Pro-Tip:* The AI bot (for photo descriptions) requires that in the Root Management menu (visible to Admins/Roots) you enter the secret Gemini API key. Without it, it doesn't breathe!

*Pro-Tip 2 (for The Game Field):* To test The Memory Hunt locally, the camera and geolocation **require HTTPS** or magical `localhost`. Vite's dev server handles the latter automatically. To test on mobile over your local network you'll need an HTTPS gallery via `mkcert` or a tunnel like `ngrok` to avoid getting blocked by browser permissions.

*Pro-Tip 3 (for L'Ainulindalë):* The local Walkman runs on `http://localhost` too, but multi-user Choir Sessions require all participants to be on an HTTPS-served page (WebRTC limitation). Use `mkcert` or `ngrok` when testing across multiple tabs/devices. The default STUN tunnel (`stun.l.google.com:19302`) handles most home Italian NATs; for severe NAT scenarios (some mobile networks) the P2P transfer may fail and the session degrades to "Pure Curation" (DJ plays only from their library) — gracefully handled.

---

*Conceived in Marzio, written with code, sweat and love by Neo1777.*
*Latest README revision: May 2026, with the arrival of The Game Field and L'Ainulindalë.*
