# 🌲 Marzio1777
**The Digital Time Machine for Mountain Memories**

Welcome to **marzio1777**, the project that takes nostalgic memories (cool summers, uphill bends, the smell of polenta, faded photos from the '80s) and aggressively throws them into Web 3.0 (or almost).

This is not a simple "photo site". It is a **digital Town Square**, a memory binder where vacationers and true "marziesi" can preserve the town's history, organize events, and gather to chat. And because we didn't want it to be boring, we threw in points, badges, and party games!

---

## 🗺️ What's inside? (The Attractions)

### 📸 1. The Square (The Social Feed)
The virtual hangout spot. No toxic algorithms, just square polaroids from the past and updates on our gatherings.
- **Time Filters:** Time travel by viewing only photos from the "70s", "80s", etc.
- **Micro-interactions:** Like a photo and enjoy a rich particle explosion. From your Profile, you can completely customize this reaction, choosing your favorite icon (🌿, ❄️, 🔥), solid vector colors, and tuning the animation duration and distance to match your vibe. Prefer something subtle? Choose the clean and iconic "Heartbeat" with no particles! Additionally, there are no infinite likes: you can leave a single reaction and retract it whenever you want (toggle).
- **Comments and Discussions:** Chat, comment, and earn "Altitude Points".

### 🏕️ 2. The Bivouac (Events and Barbecues)
The official bulletin board where gatherings and events are planned!
- **New Meeting:** Set a meeting point, choose the date, invite whoever you want.
- **Who we are and how many:** Interactive RSVP. Indicate how many will attend, so no one buys too much polenta.
- **The Extreme Shopping List:** Who brings what? "Assign to me" an item, or enter it for someone else. A checkbox will tell you if everything is ready.
- **The "Account Book" Wallet:** Did we split the bill at the pizzeria or for the barbecue? Everyone jots down the expenses they incurred and the system does the math to split the bill and tell you who owes money to whom!

### 🎞 3. The Cinematograph (The Projection Room)
Our Cinema room! A full-screen photo gallery created specifically for nights out together to be projected on TV.
- **Exhibition & Autoplay:** Let it run lazily or browse our lives with the keyboard. The overlay "card" reports the credits and you can hide it like a curtain to make room for the photo.
- **Speed Filters:** Browse the collection focusing solely on who uploaded it or choose the registry (e.g. View all 90s photos you've never seen uploaded by Mario Rossi).
- **"Images Only" Mode:** Activate this mode to completely hide metadata, credits, and interfaces, enjoying a fully immersive full-screen visual experience.
- **Group Games ("Gamification"):** Test yourself with "Guess Who!" and "Guess the year!". Choose among the 4 options on screen to reveal photo details: a correct guess will earn you +5 Altitude Points, but a mistake will cost you -2!

### 🧳 4. The Trunk (Upload Center)
Not a simple upload form, but a real artisan workshop.
- **Without borders:** Drag many photos at once from your PC: the automated development queue.
- **The "AI Memory" 🤖:** Use the "Magic Scan Spark"! Can't explain in words what that farmhouse is? The AI will do the composite sketch describing it in pure "mountain/dialect" vocabulary and will fill it out for you!
- **Advanced Map Pin:** Hook the GPS tag by browsing the digital map!

### 🧭 5. The Map (Cartography of Memories)
All memories don't fly in the wind but land pinned on the local map!
- Search for the kiosk or the street where you loaded the photos and the map will group them showing the classic interactive numeric pointers. Click on the stickers and dive straight into the starting post!
- **Real-Time Sharing:** Turn on the check in your profile and your friends will be able to see your "live" location on the map when you are exploring the town.
- **Overlay Filter Panel:** Explore the map by actively filtering in real time by Author and Decade (e.g., "I only want to see map pins from the '50s").

### 🌳 6. The Big Tree (Live Bulletin Board)
The bench under the tree. It's an authentic little room with a synchronized real-time chat ("On the benches under the tree") to write four super quick jokes telegram-style at a glance without having to open your phone!

### 🪪 7. The Profile and Archive Management (Privacy and Gamification)
- **Archive Management:** Not everything must end up in the Square right away! Hide your embarrassing photos, decide if to show them temporarily (timed), hide them from the Cinematograph or apply mass permissions to all your past adventures.
- **Altitude and Experience:** A real-life video game. Altitude Points accumulated by interacting, commenting or uploading photos! If you climb high enough you will conquer fantastic Badges to show around like: *The Vacationer, The Expert Tourist, The Mayor of Marzio*.

---

## 🔒 Security, Roles & Zero-Trust Architecture
We must protect the historical heritage and personal data of our small community. The system uses a complex Role-Based Access Control logic (RBAC) and real-time request validation:

- **The City Gate (Account Pending):** When a user logs in for the first time, they don't get in right away! They get a *Pending* status. To avoid bots or snoops, the app immediately shows them a closed gate. In the "Management Panel", admins will see a red notification badge with the new "immigrants" waiting and can evaluate whether to let them into the town.
- **Permissions Rhyme (In-App Roles):**
  - **Guest (Passing Tourist):** Once approved as Guests, users enter the App but see only... the app itself. Code-wise, a Guest is strictly precluded from accessing and reading any data generated by the community (posts, chats, users, events, maps). They can navigate pages but these will result completely "blank". Furthermore, the interface fades everything with an explicit overlay telling them that, until an admin deems fit to promote them, there's nothing to do.
  - **Admin (The Mayor/Sheriff):** Use the App in its entirety. Interact, comment, post. They have a "Management Panel" to evaluate Pendings. They can promote known faces from Guest to Admin, and can approve the entry of new "Pending" arrivals naming them "Guest". They can't do worse damage (no downgrades from Admins downwards).
  - **Root (The Enlightened Monarch):** There is only one creator (nicolainformatica). Root doesn't sit on the bench, they supervise. Can do everything an Admin does but adds divine powers: approve a Pending making them an Admin directly, bring a bad Admin back to the fold demoting them to Guest. Only Root is at the top of the App's food chain. No one ousts them.

- **Impassable Firestore Rules:** This filter is not visual, it's armored at the "Zero-Trust Database" levels (native backend RBAC). Anyone trying to act beyond their state is rejected.
- **Split Collection (PII Privacy):** Sensitive data (like your email or keys) are stored in separate, unreadable safes; only your public presence for "The Map" is transmitted.

---

## 📱 How to Add the App to your Phone (PWA)

You can easily install us without clogging the Store!

- **iOS / iPhone (on Safari):** Open the app in Safari > Middle button (Square with arrow ⬆️) > **"Add to Home Screen"**.
- **Android (on Chrome):** Open the app > The 3 Dots on top ⠇ > **"Add to Home screen / Install App"**.
- Our icon will appear on your smartphone and you will enter completely skipping the browser windows!

---

## 🛠️ How to Start the App "Offline" or for Development (Instructions for the Town Hacker)

1. **Make sure you use Node.js.**
2. **Download Packages:**
   ```bash
   npm install
   ```
3. **Place your special file (DB keys etc)** `.env.local`
4. **Turn everything on:**
   ```bash
   npm run dev
   ```
5. You are now connected on `http://localhost:3000`.

*Pro-Tip:* The AI bot (to describe photos) requires you to enter the secret Gemini API key in the Root Management menu (visible to Admins/Root). Without it, it doesn't breathe!

---

*Conceived in Marzio, written with code, sweat and loved by Neo1777.*
