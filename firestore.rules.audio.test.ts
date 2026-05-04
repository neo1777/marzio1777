import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { before, after, beforeEach as nodeBeforeEach, describe, it } from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'marzio-audio-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

nodeBeforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Helpers ────────────────────────────────────────────────────────────────
//
// Provision a few approved users and (optionally) an open audio_sessions doc
// using the rules-bypass admin client. Tests then operate as a real user
// through testEnv.authenticatedContext() and assert what the rule allows or
// rejects.

const ADMIN_UID = 'adminA';
const ADMIN_EMAIL = 'admin@marzio.local';
const GUEST_UID = 'guestB';
const GUEST_EMAIL = 'guest@marzio.local';
const PROPOSER_UID = 'proposerC';
const PROPOSER_EMAIL = 'proposer@marzio.local';
const ROOT_EMAIL = 'nicolainformatica@gmail.com';

async function seedUsers(opts: { proposerPoints?: number } = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('users').doc(ADMIN_UID).set({
      uid: ADMIN_UID, email: ADMIN_EMAIL, role: 'Admin', accountStatus: 'approved', points: 0,
    });
    await db.collection('users').doc(GUEST_UID).set({
      uid: GUEST_UID, email: GUEST_EMAIL, role: 'Guest', accountStatus: 'approved', points: 0,
    });
    await db.collection('users').doc(PROPOSER_UID).set({
      uid: PROPOSER_UID, email: PROPOSER_EMAIL, role: 'Guest', accountStatus: 'approved',
      points: opts.proposerPoints ?? 0,
    });
  });
}

async function seedOpenSession(sessionId: string, opts: { rules?: any; closed?: boolean } = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('audio_sessions').doc(sessionId).set({
      djId: ADMIN_UID,
      djName: 'Admin',
      djPhotoURL: '',
      title: 'Test Session',
      status: opts.closed ? 'closed' : 'open',
      mode: 'auto',
      createdAt: new Date(),
      closedAt: opts.closed ? new Date() : null,
      currentQueueItemId: null,
      currentTrackTitle: null,
      currentTrackArtist: null,
      currentTrackDurationMs: null,
      currentTrackStartedAt: null,
      participantCount: 0,
      queuedCount: 0,
      playedCount: 0,
      rules: opts.rules ?? {
        maxQueuedPerUser: 2,
        bonusPerHundredPoints: 1,
        allowDuplicates: false,
        autoSkipOfflineProposers: true,
      },
    });
    await db.collection('audio_sessions').doc(sessionId).collection('participants').doc(PROPOSER_UID).set({
      userId: PROPOSER_UID,
      displayName: 'Proposer',
      photoURL: '',
      status: 'joined',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      tracksProposed: 0,
      tracksPlayed: 0,
    });
  });
}

function adminDb() {
  return testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL, email_verified: true }).firestore();
}
function guestDb() {
  return testEnv.authenticatedContext(GUEST_UID, { email: GUEST_EMAIL, email_verified: true }).firestore();
}
function proposerDb() {
  return testEnv.authenticatedContext(PROPOSER_UID, { email: PROPOSER_EMAIL, email_verified: true }).firestore();
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Ainulindale Rules', () => {
  describe('audio_sessions.create — DJ authority', () => {
    it('Admin can create a session with djId == auth.uid', async () => {
      await seedUsers();
      const db = adminDb();
      await assertSucceeds(db.collection('audio_sessions').doc('s1').set({
        djId: ADMIN_UID, djName: 'A', djPhotoURL: '', title: 'My Session',
        status: 'open', mode: 'auto',
        rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1, allowDuplicates: false, autoSkipOfflineProposers: true },
      }));
    });

    it('Admin cannot spoof djId to a different user (Sporca #23 Phantom DJ)', async () => {
      await seedUsers();
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1').set({
        djId: 'someOtherUid', djName: 'A', djPhotoURL: '', title: 'My Session',
        status: 'open', mode: 'auto',
        rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1, allowDuplicates: false, autoSkipOfflineProposers: true },
      }));
    });

    it('Guest cannot create a session', async () => {
      await seedUsers();
      const db = guestDb();
      await assertFails(db.collection('audio_sessions').doc('s1').set({
        djId: GUEST_UID, djName: 'G', djPhotoURL: '', title: 'My Session',
        status: 'open', mode: 'auto',
        rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1, allowDuplicates: false, autoSkipOfflineProposers: true },
      }));
    });
  });

  describe('queue.create — bonus formula (Sporca #24 Queue Stuffer)', () => {
    it('accepts effectiveMaxAtCreate matching the formula at points=0', async () => {
      await seedUsers({ proposerPoints: 0 });
      await seedOpenSession('s1');
      const db = proposerDb();
      // Formula: 2 + floor(0/100) * 1 = 2
      await assertSucceeds(db.collection('audio_sessions').doc('s1').collection('queue').doc('q1').set({
        proposedBy: PROPOSER_UID, proposedByName: 'P', proposedByPhotoURL: '',
        proposedAt: new Date(),
        trackTitle: 'T', trackArtist: 'A', trackDurationMs: 200000,
        localTrackId: 'lt1',
        status: 'queued', position: 1,
        effectiveMaxAtCreate: 2,
      }));
    });

    it('accepts effectiveMaxAtCreate matching the formula at points=250', async () => {
      await seedUsers({ proposerPoints: 250 });
      await seedOpenSession('s1');
      const db = proposerDb();
      // Formula: 2 + floor(250/100) * 1 = 2 + 2 = 4
      await assertSucceeds(db.collection('audio_sessions').doc('s1').collection('queue').doc('q1').set({
        proposedBy: PROPOSER_UID, proposedByName: 'P', proposedByPhotoURL: '',
        proposedAt: new Date(),
        trackTitle: 'T', trackArtist: 'A', trackDurationMs: 200000,
        localTrackId: 'lt1',
        status: 'queued', position: 1,
        effectiveMaxAtCreate: 4,
      }));
    });

    it('rejects a forged effectiveMaxAtCreate value', async () => {
      await seedUsers({ proposerPoints: 0 });
      await seedOpenSession('s1');
      const db = proposerDb();
      // Forged: claiming bonus the user didn't actually earn
      await assertFails(db.collection('audio_sessions').doc('s1').collection('queue').doc('q1').set({
        proposedBy: PROPOSER_UID, proposedByName: 'P', proposedByPhotoURL: '',
        proposedAt: new Date(),
        trackTitle: 'T', trackArtist: 'A', trackDurationMs: 200000,
        localTrackId: 'lt1',
        status: 'queued', position: 1,
        effectiveMaxAtCreate: 9999,
      }));
    });

    it('rejects a missing effectiveMaxAtCreate', async () => {
      await seedUsers({ proposerPoints: 0 });
      await seedOpenSession('s1');
      const db = proposerDb();
      await assertFails(db.collection('audio_sessions').doc('s1').collection('queue').doc('q1').set({
        proposedBy: PROPOSER_UID, proposedByName: 'P', proposedByPhotoURL: '',
        proposedAt: new Date(),
        trackTitle: 'T', trackArtist: 'A', trackDurationMs: 200000,
        localTrackId: 'lt1',
        status: 'queued', position: 1,
        // effectiveMaxAtCreate intentionally absent
      }));
    });
  });

  describe('signaling — ownership (Sporca #30 Signaling Spammer)', () => {
    it('proposer can create their own signaling doc', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      const db = proposerDb();
      await assertSucceeds(db.collection('audio_sessions').doc('s1').collection('signaling').doc(PROPOSER_UID).set({
        userId: PROPOSER_UID,
        sessionId: 's1',
        proposerCandidates: [],
      }));
    });

    it('a third-party participant cannot create signaling on behalf of someone else', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      const db = guestDb();
      await assertFails(db.collection('audio_sessions').doc('s1').collection('signaling').doc(PROPOSER_UID).set({
        userId: PROPOSER_UID,
        sessionId: 's1',
        proposerCandidates: [],
      }));
    });

    it('the DJ can create signaling for any proposer in the session', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      const db = adminDb();
      await assertSucceeds(db.collection('audio_sessions').doc('s1').collection('signaling').doc(PROPOSER_UID).set({
        userId: PROPOSER_UID,
        sessionId: 's1',
        djCandidates: [],
        djOffer: { sdp: 'x', type: 'offer', queueItemId: 'q1', createdAt: new Date() },
      }));
    });
  });

  describe('audio_sessions.update post-close (Sporca #28 Resurrectionist audio)', () => {
    it('rejects writes to a session whose status is closed', async () => {
      await seedUsers();
      await seedOpenSession('s1', { closed: true });
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1').update({ mode: 'manual' }));
    });
  });

  describe('queue.update — Theme Hijacker (Sporca #25/#26)', () => {
    async function seedQueueItem(sessionId: string, itemId: string, status = 'queued') {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore()
          .collection('audio_sessions').doc(sessionId)
          .collection('queue').doc(itemId)
          .set({
            proposedBy: PROPOSER_UID, proposedByName: 'P', proposedByPhotoURL: '',
            proposedAt: new Date(),
            trackTitle: 'T', trackArtist: 'A', trackDurationMs: 200000,
            localTrackId: 'lt1',
            status, position: 1,
            effectiveMaxAtCreate: 2,
          });
      });
    }

    it('DJ can transition queued → transferring', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = adminDb();
      await assertSucceeds(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ status: 'transferring', transferStartedAt: new Date() }));
    });

    it('DJ cannot skip directly from queued to ready (transferring step is mandatory)', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ status: 'ready' }));
    });

    it('DJ cannot rewrite immutable metadata (proposedBy)', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ proposedBy: 'someone-else' }));
    });

    it('DJ cannot rewrite trackTitle', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ trackTitle: 'Forged Title' }));
    });

    it('DJ cannot rewrite localTrackId', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ localTrackId: 'attacker-track' }));
    });

    it('DJ cannot award more than 50 points', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'playing');
      const db = adminDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ status: 'played', pointsAwarded: 9999 }));
    });

    it('DJ can award a reasonable points value with the played transition', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'playing');
      const db = adminDb();
      await assertSucceeds(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ status: 'played', pointsAwarded: 10 }));
    });

    it('listener cannot update a queue item', async () => {
      await seedUsers();
      await seedOpenSession('s1');
      await seedQueueItem('s1', 'q1', 'queued');
      const db = guestDb();
      await assertFails(db.collection('audio_sessions').doc('s1')
        .collection('queue').doc('q1')
        .update({ status: 'transferring' }));
    });
  });
});
