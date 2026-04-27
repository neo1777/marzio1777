# Security Specification: Marzio Memories

## 1. Data Invariants
- **User Identity:** A user profile (`users/{userId}`) can only be modified by its owner. The `role` and `points` fields are strictly immutable to users; they can only be changed by an Admin or Root.
- **The "Pending" Queue & Role Tiers:** 
  - Standard users forcefully register as `accountStatus: 'pending'` and `role: 'Guest'`. 
  - Root registers organically bypassing it (`accountStatus: 'approved'`).
  - Admins can edit `/users` to flip `accountStatus` strictly to `approved` matching `role: 'Guest'`.
  - Admins can also flip an `approved` `Guest` to `Admin`.
  - Only Root forces downgrade or promotes pending directly to `Admin` or manipulates other Admins.
- **Post Ownership:** A memory (`posts/{postId}`) cannot exist without a valid `authorId` that matches the user creating the document. The `authorId` is immutable.
- **Relational Integrity for Comments:** A comment (`posts/{postId}/comments/{commentId}`) belongs to a Post. If the Post is hidden, unauthorized users cannot fetch its comments.
- **Granular Updates (Tiered Actions):** Updates to posts are split into actions. A standard user can update `caption`, `visibilityStatus`, `visibilityTime`, `showInCinematografo`, and `location`. They cannot fraudulently alter `commentsCount` via raw update. Additionally, updating `likesCount` is strictly paired with a toggle constraint over a `likedBy` array. Utilizing array tracking explicitly blocks infinite/fractional likes while tying database state mathematically to user interactions.
- **PII Isolation (Split Collection):** The `users` collection contains `email` and `apiKey`, which is sensitive. Therefore, non-owners cannot read `users` array. Data required for map sharing must reside in `user_locations/{userId}`, which is fully public.

## 2. The "Dirty Dozen" Payloads
1. **The Shadow Update:** Attempt to create a Post containing an extra spoofed field (e.g., `isVerified: true`).
2. **The ID Poisoner:** Attempt to create a Chat Channel with an ID that is 3MB of characters.
3. **The Privilege Escalator (RBAC Bypass):** Attempt to update your own `role` in `/users/{userId}` to `Admin`, or mutate `accountStatus` off `pending` without Root/Admin permissions.
4. **The Admin Demotion (Admin Bypass):** Attempt, as an Admin, to retro-grade an existing Admin to Guest. Denied because only Root can alter another Admin's state downwards.
5. **The Value Poisoner:** Attempt to update `posts/{postId}` by changing `likesCount` (number) to a massive String payload.
6. **The Email Spoofing Test:** Bypass email validation by omitting `email_verified` during signup/document creation.
7. **The PII Blanket Test:** Send a `list` query to `/users` to scrape all emails in the system. Rejected for everyone except Root and Admin interacting with the Pending queue.
8. **The Timewarp:** Create a comment with `timestamp` set 5 years in the future to keep it at the top of a feed.
9. **The Denial of Wallet (Arrays):** Create an entity with an array field initialized with 10,000 sub-objects.
10. **The Outcome Override:** Alter the `status` of a closed chat/ticket/post (if applicable) bypassing the action gates.
11. **The Unauthorized Relational Grab:** Query `comments` on a `private` post owned by someone else.
12. **The Orphanizer:** Delete a user but leave all their auth credentials or modify auth state without proper cleanup tools (handled by functions typically, but prevented by strictly isolating data).

## 3. Test Runner
We will ensure `firebase-blueprint.json` explicitly and accurately describes the full data constraints which the rules enforce, matching the specific Root, Admin, Guest constraints and pending flags mapped above.
