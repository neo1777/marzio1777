/**
 * Marzio1777 Cloud Functions — Phase 2 hardening + housekeeping.
 *
 * What's here (and why):
 *
 *  - validateCaptureDistance       — closes Sporca #14 The Teleporter:
 *    server-side Haversine on item capture (DSL rules can't do this).
 *  - enforceQueuePerUserLimit      — closes the residual gap of Sporca #24
 *    Queue Stuffer: counts active queue docs for a proposer (DSL can't
 *    count documents). The rule already validates effectiveMaxAtCreate
 *    as a snapshot; this CF validates the actual document count.
 *  - cleanupOrphanSignaling        — periodic scan that deletes
 *    audio_sessions/{X}/signaling/{userId} docs whose expireAt is past.
 *  - cleanupStuckEvents            — daily cron: events stuck in 'active'
 *    > 24h get aborted with operator notification.
 *  - cleanupOrphanSessions         — daily cron: open audio_sessions whose
 *    DJ has gone quiet > 2h get auto-closed with reduced finalStats.
 *
 * Skeleton-only (TODO Phase 2.5):
 *  - validateP2PTransferIntegrity  — SHA-256 hash check post-transfer.
 *    Requires a `blobSha256` field on QueueItem (proposer pre-send +
 *    DJ post-receive); the rule on queue.create needs to validate the
 *    field shape.
 *  - auditMassSkip                 — onUpdate trigger that flags a DJ
 *    skipping too many items in a short window. Requires an audit_log
 *    collection with rule.
 *
 * Not here (separate session needed — vedi roadmap):
 *  - notifyKickoff (FCM push 30 min pre-kickoff + lobby open). Needs
 *    VAPID setup + users.fcmTokens[] field + iOS PWA permissions UX +
 *    a dedicated Service Worker (firebase-messaging-sw.js).
 *
 * Deployment requirements:
 *  - Firebase project on **Blaze plan** (Spark doesn't support scheduled
 *    functions or v2 functions).
 *  - `firebase login` from the operator's machine.
 *  - `cd functions && npm install && firebase deploy --only functions`.
 *  - Firestore indexes: ensure firestore.indexes.json is deployed too
 *    (firebase deploy --only firestore:indexes).
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();

// ─── helpers ───────────────────────────────────────────────────────────────

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function requireAuth(request: { auth?: { uid?: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Login richiesto.');
  }
  return request.auth.uid;
}

// ─── validateCaptureDistance ───────────────────────────────────────────────
//
// Called by the client immediately *before* runTransaction on item capture.
// If valid: writes `serverValidatedAt: <now>` on the item and returns ok.
// The rule on `items.update` (capture transition) requires this field to be
// fresh (within 30s) — see firestore.rules § items.update.
//
// We accept a 50% over-radius margin to absorb GPS jitter (the client GPS
// accuracy on mobile is typically 10-20m, the captureRadius is 15m default).

export const validateCaptureDistance = onCall<{
  eventId: string;
  itemId: string;
  playerLat: number;
  playerLng: number;
}>({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const { eventId, itemId, playerLat, playerLng } = request.data;
  if (typeof eventId !== 'string' || typeof itemId !== 'string') {
    throw new HttpsError('invalid-argument', 'eventId/itemId mancanti.');
  }
  if (typeof playerLat !== 'number' || typeof playerLng !== 'number') {
    throw new HttpsError('invalid-argument', 'Coordinate giocatore mancanti.');
  }
  if (Math.abs(playerLat) > 90 || Math.abs(playerLng) > 180) {
    throw new HttpsError('invalid-argument', 'Coordinate fuori range.');
  }

  const itemRef = db.doc(`game_events/${eventId}/items/${itemId}`);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) {
    throw new HttpsError('not-found', 'Item non trovato.');
  }
  const item = itemSnap.data() as { lat: number; lng: number; captureRadius?: number; status: string };
  if (item.status !== 'spawned') {
    throw new HttpsError('failed-precondition', 'Item già catturato.');
  }

  const radius = item.captureRadius ?? 15; // metri, default
  const margin = 1.5; // 50% di margine GPS
  const distance = haversineMeters({ lat: item.lat, lng: item.lng }, { lat: playerLat, lng: playerLng });
  if (distance > radius * margin) {
    // Audit log & reject. The audit_log collection is read-only for clients.
    await db.collection('audit_log').add({
      type: 'capture_too_far',
      eventId,
      itemId,
      uid,
      reportedAt: FieldValue.serverTimestamp(),
      playerLat,
      playerLng,
      itemLat: item.lat,
      itemLng: item.lng,
      distanceMeters: distance,
      allowedMeters: radius * margin,
    });
    throw new HttpsError('out-of-range', `Sei a ${Math.round(distance)}m, troppo distante (max ${Math.round(radius * margin)}m).`);
  }

  await itemRef.update({ serverValidatedAt: FieldValue.serverTimestamp() });
  return { ok: true, distanceMeters: Math.round(distance) };
});

// ─── enforceQueuePerUserLimit ──────────────────────────────────────────────
//
// Called by the client immediately *before* a queue.create. The rule
// already validates that `effectiveMaxAtCreate` matches the formula; this
// CF validates the actual count of active queue documents for the proposer
// (DSL Firestore can't count). Returns ok if under limit, throws otherwise.

export const enforceQueuePerUserLimit = onCall<{
  sessionId: string;
}>({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const { sessionId } = request.data;
  if (typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'sessionId mancante.');
  }

  const sessionRef = db.doc(`audio_sessions/${sessionId}`);
  const [sessionSnap, userSnap] = await Promise.all([
    sessionRef.get(),
    db.doc(`users/${uid}`).get(),
  ]);
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'Sessione non trovata.');
  if (!userSnap.exists) throw new HttpsError('not-found', 'Utente non trovato.');

  const session = sessionSnap.data() as { rules: { maxQueuedPerUser: number; bonusPerHundredPoints: number }; status: string };
  if (session.status !== 'open') throw new HttpsError('failed-precondition', 'Sessione chiusa.');

  const userPoints = (userSnap.data()?.points ?? 0) as number;
  const limit = session.rules.maxQueuedPerUser + Math.floor(userPoints / 100) * session.rules.bonusPerHundredPoints;

  const activeQuery = await db
    .collection(`audio_sessions/${sessionId}/queue`)
    .where('proposedBy', '==', uid)
    .where('status', 'in', ['queued', 'transferring', 'ready', 'playing'])
    .count()
    .get();
  const active = activeQuery.data().count;

  if (active >= limit) {
    throw new HttpsError(
      'resource-exhausted',
      `Hai già ${active} brani in coda (limite ${limit}). Attendi che ne venga suonato uno.`
    );
  }
  return { ok: true, active, limit };
});

// ─── cleanupOrphanSignaling ────────────────────────────────────────────────
//
// Every 5 minutes: scan all `audio_sessions/*/signaling/*` and delete
// docs whose `expireAt < now`. Prevents stale offers from accumulating
// when clients crash mid-transfer. Spec: AINULINDALE_TECHNICAL_SPEC §8 +
// security_spec_IT §2.3.30.

export const cleanupOrphanSignaling = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', timeZone: 'Europe/Rome' },
  async () => {
    const now = Timestamp.now();
    const snap = await db.collectionGroup('signaling').where('expireAt', '<', now).get();
    if (snap.empty) {
      logger.info('cleanupOrphanSignaling: nothing to delete');
      return;
    }
    // Firestore batch limit is 500. Chunk if necessary.
    const docs = snap.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 450)) {
        batch.delete(d.ref);
        deleted++;
      }
      await batch.commit();
    }
    logger.info(`cleanupOrphanSignaling: deleted ${deleted} stale signaling docs`);
  }
);

// ─── cleanupStuckEvents ────────────────────────────────────────────────────
//
// Daily at 04:00 Europe/Rome: events stuck in `status: 'active'` for > 24h
// get auto-aborted. Avoids the leaderboard staying live indefinitely if
// the organiser forgets to terminate.

export const cleanupStuckEvents = onSchedule(
  { schedule: 'every day 04:00', region: 'europe-west1', timeZone: 'Europe/Rome' },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const stuckQuery = await db
      .collection('game_events')
      .where('status', '==', 'active')
      .where('scheduledKickoff', '<', cutoff)
      .get();
    if (stuckQuery.empty) {
      logger.info('cleanupStuckEvents: nothing to abort');
      return;
    }
    let aborted = 0;
    for (const doc of stuckQuery.docs) {
      try {
        await doc.ref.update({
          status: 'aborted',
          completedAt: FieldValue.serverTimestamp(),
          abortedReason: 'auto_cleanup_stuck_24h',
        });
        aborted++;
      } catch (e) {
        logger.warn('cleanupStuckEvents: failed to abort', { id: doc.id, e });
      }
    }
    logger.info(`cleanupStuckEvents: aborted ${aborted} stuck events`);
  }
);

// ─── cleanupOrphanSessions ─────────────────────────────────────────────────
//
// Daily at 04:15 Europe/Rome: audio_sessions stuck in `status: 'open'`
// whose DJ has been quiet for > 2h get auto-closed with reduced
// finalStats and `cleanedUpByCron: true`.

export const cleanupOrphanSessions = onSchedule(
  { schedule: 'every day 04:15', region: 'europe-west1', timeZone: 'Europe/Rome' },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
    // We approximate "DJ quiet" with: session has no queue.update with
    // playing transition in the last 2h. Cheap proxy: createdAt < cutoff
    // && currentTrackStartedAt either null or < cutoff.
    const orphans = await db
      .collection('audio_sessions')
      .where('status', '==', 'open')
      .where('createdAt', '<', cutoff)
      .get();
    if (orphans.empty) {
      logger.info('cleanupOrphanSessions: nothing to close');
      return;
    }
    let closed = 0;
    for (const doc of orphans.docs) {
      const data = doc.data();
      const lastTrack = data.currentTrackStartedAt as Timestamp | null;
      if (lastTrack && lastTrack.toMillis() > cutoff.toMillis()) continue; // recent activity
      try {
        await doc.ref.update({
          status: 'closed',
          closedAt: FieldValue.serverTimestamp(),
          finalStats: {
            totalDurationMs: 0,
            totalTracksPlayed: data.playedCount ?? 0,
            participantsCount: data.participantCount ?? 0,
            topProposers: [],
            closedAt: FieldValue.serverTimestamp(),
            cleanedUpByCron: true,
          },
        });
        closed++;
      } catch (e) {
        logger.warn('cleanupOrphanSessions: failed to close', { id: doc.id, e });
      }
    }
    logger.info(`cleanupOrphanSessions: closed ${closed} orphan sessions`);
  }
);

// ─── notifyKickoff ─────────────────────────────────────────────────────────
//
// Every 5 minutes scan game_events that fall in two windows:
//   - 30-minute pre-kickoff (kickoff in [now+25min, now+35min])
//   - lobby open (kickoff in [now-5min, now+5min])
// Send a multicast FCM push to every invited user that has at least one
// fcmTokens[] entry on their user doc. Idempotency via a flag on the
// event doc itself: once a window has been notified for that event, the
// flag stays set forever and the next cron tick skips it.

async function sendKickoffNotification(opts: {
   eventId: string;
   title: string;
   body: string;
   tokens: string[];
}) {
   const { eventId, title, body, tokens } = opts;
   if (tokens.length === 0) return { successCount: 0, failureCount: 0, invalidTokens: [] as string[] };
   const messaging = getMessaging();
   const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
         fcmOptions: {
            link: `https://neo1777.github.io/marzio1777/dashboard/giochi/${eventId}/lobby`,
         },
         notification: { icon: '/marzio1777/icon.svg', badge: '/marzio1777/icon.svg' },
      },
   });
   // Collect tokens that failed permanently (user uninstalled the PWA,
   // revoked permission, or the token was rotated). The cron ticks
   // following this one will read the same fcmTokens[] from the user
   // doc — so we strip the dead ones at source.
   const invalidTokens: string[] = [];
   res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (
         code === 'messaging/registration-token-not-registered' ||
         code === 'messaging/invalid-registration-token' ||
         code === 'messaging/invalid-argument'
      ) {
         invalidTokens.push(tokens[i]);
      }
   });
   return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens };
}

async function pruneInvalidTokens(invalidTokens: string[]) {
   if (invalidTokens.length === 0) return;
   // Find each user that holds at least one of the bad tokens and strip
   // them via arrayRemove. We can't query "array contains any" on the
   // tokens themselves with `in` over more than 30 values, so chunk.
   for (let i = 0; i < invalidTokens.length; i += 30) {
      const chunk = invalidTokens.slice(i, i + 30);
      const snap = await db.collection('users').where('fcmTokens', 'array-contains-any', chunk).get();
      for (const doc of snap.docs) {
         try {
            await doc.ref.update({ fcmTokens: FieldValue.arrayRemove(...chunk) });
         } catch (e) {
            logger.warn('pruneInvalidTokens: failed to strip', { uid: doc.id, e });
         }
      }
   }
}

export const notifyKickoff = onSchedule(
   { schedule: 'every 5 minutes', region: 'europe-west1', timeZone: 'Europe/Rome' },
   async () => {
      const now = Date.now();
      // Two windows. Picking ±5min around the target instant gives every
      // event roughly 1 cron tick to be matched (tick frequency = 5 min).
      const win30Lo = Timestamp.fromMillis(now + 25 * 60 * 1000);
      const win30Hi = Timestamp.fromMillis(now + 35 * 60 * 1000);
      const winLobbyLo = Timestamp.fromMillis(now - 5 * 60 * 1000);
      const winLobbyHi = Timestamp.fromMillis(now + 5 * 60 * 1000);

      const queries = [
         {
            label: 'kickoff30',
            query: db
               .collection('game_events')
               .where('status', 'in', ['scheduled', 'lobby'])
               .where('scheduledKickoff', '>=', win30Lo)
               .where('scheduledKickoff', '<=', win30Hi),
            flagField: 'notifications.kickoff30Notified',
            title: 'Tra 30 minuti si gioca! 🎯',
            bodyTemplate: (eventTitle: string) => `Pronto per "${eventTitle}"? La lobby apre presto.`,
         },
         {
            label: 'lobby',
            query: db
               .collection('game_events')
               .where('status', 'in', ['scheduled', 'lobby'])
               .where('scheduledKickoff', '>=', winLobbyLo)
               .where('scheduledKickoff', '<=', winLobbyHi),
            flagField: 'notifications.lobbyNotified',
            title: 'Lobby aperta! ⛺',
            bodyTemplate: (eventTitle: string) => `"${eventTitle}" sta per iniziare. Entra nella lobby.`,
         },
      ];

      let totalSent = 0;
      const allInvalid: string[] = [];

      for (const w of queries) {
         const snap = await w.query.get();
         for (const doc of snap.docs) {
            const data = doc.data();
            // Idempotency: skip if already notified for this window.
            const flagPath = w.flagField.split('.');
            const already = flagPath.reduce<any>((acc, k) => (acc ? acc[k] : undefined), data);
            if (already === true) continue;

            const invitedIds: string[] = Array.isArray(data.invitedUserIds) ? data.invitedUserIds : [];
            if (invitedIds.length === 0) continue;

            // Pull tokens for the invited users. Firestore `in` cap is 30,
            // so chunk if there are more.
            const tokens: string[] = [];
            for (let i = 0; i < invitedIds.length; i += 30) {
               const chunk = invitedIds.slice(i, i + 30);
               const usersSnap = await db.collection('users').where('uid', 'in', chunk).get();
               usersSnap.forEach(u => {
                  const arr = u.data().fcmTokens;
                  if (Array.isArray(arr)) tokens.push(...arr.filter(t => typeof t === 'string'));
               });
            }
            const uniqueTokens = Array.from(new Set(tokens));
            if (uniqueTokens.length === 0) {
               // No tokens — still flag so we don't retry on every tick.
               await doc.ref.update({ [w.flagField]: true });
               continue;
            }

            const result = await sendKickoffNotification({
               eventId: doc.id,
               title: w.title,
               body: w.bodyTemplate(typeof data.title === 'string' ? data.title : 'Evento Marzio'),
               tokens: uniqueTokens,
            });
            totalSent += result.successCount;
            allInvalid.push(...result.invalidTokens);
            await doc.ref.update({ [w.flagField]: true });
         }
      }

      if (allInvalid.length > 0) {
         await pruneInvalidTokens(Array.from(new Set(allInvalid)));
      }

      logger.info(`notifyKickoff: sent ${totalSent} pushes; pruned ${allInvalid.length} invalid tokens`);
   }
);

// ─── auditMassSkip — SKELETON ──────────────────────────────────────────────
//
// onUpdate trigger: when queue.{X}.status flips to 'skipped', count
// recent skips by the same DJ (last 60s). If > 10 in window, write to
// audit_log/{auto} with severity='warn'. Phase 2.5 polish; the current
// rule path already disallows mass deletion of queue items by anyone
// other than the DJ, so the threat is limited to a misbehaving DJ that
// the Root can kick.

export const auditMassSkip = onDocumentUpdated(
  { document: 'audio_sessions/{sessionId}/queue/{itemId}', region: 'europe-west1' },
  async (_event) => {
    // TODO Phase 2.5: implement rolling-window counter on
    //   audit_state/{sessionId}.skips[] = [{ at, byUid }, ...]
    // and emit audit_log/{auto} when length > 10 in the last 60s.
    return;
  }
);

// ─── validateP2PTransferIntegrity — SKELETON ───────────────────────────────
//
// Callable invoked by the DJ post-transfer. Compares the SHA-256 hash
// declared by the proposer (queue/{itemId}.blobSha256) with the hash
// recomputed by the DJ over the assembled blob. Phase 2.5: requires
// `blobSha256` field on QueueItem (writable by proposer only at create,
// 64-char hex string).

export const validateP2PTransferIntegrity = onCall<{
  sessionId: string;
  queueItemId: string;
  receivedSha256: string;
}>({ region: 'europe-west1' }, async (request) => {
  requireAuth(request);
  // TODO Phase 2.5: load queue/{itemId}.blobSha256, compare to received,
  // mark queue/{itemId}.integrityCheck = 'pass' | 'fail'. For now report
  // unimplemented so the client can fall back to the existing trust
  // model (no hash check).
  throw new HttpsError('unimplemented', 'validateP2PTransferIntegrity disponibile in Fase 2.5.');
});
