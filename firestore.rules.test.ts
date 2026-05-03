import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { before, after, beforeEach as nodeBeforeEach, describe, it } from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testEnv: any;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'marzio-memories-test',
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

describe('Marzio Memories Framework Rules', () => {
  describe('1. The Shadow Update', () => {
    it('denies creating a Post with an unlisted ghost field', async () => {
      const db = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      await assertFails(db.collection('posts').doc('post1').set({
         authorId: 'userA', authorName: 'A', timestamp: 1234, 
         likesCount: 0, commentsCount: 0, visibilityStatus: 'public',
         isVerified: true // Ghost field
      }));
    });
  });

  describe('3. The Privilege Escalator', () => {
    it('denies user updating their own role', async () => {
      // Auth context must carry an email matching the doc, otherwise
      // isValidUser() fails on the user.create path.
      const db = testEnv.authenticatedContext('userA', {
        email: 'test@test.com', email_verified: true,
      }).firestore();
      // Initial profile must satisfy isValidUser(): uid+email+role+accountStatus
      // are all required by the rule (firestore.rules:119).
      await assertSucceeds(db.collection('users').doc('userA').set({
        uid: 'userA', email: 'test@test.com', role: 'Guest', accountStatus: 'pending',
      }));
      // The actual privilege-escalation attempt: a non-root owner cannot
      // promote themselves. The own-update branch only allows displayName,
      // photoURL, bio, apiKey, shareLiveLocation, anim* — role isn't there.
      await assertFails(db.collection('users').doc('userA').update({
        role: 'Admin',
      }));
    });
  });

  describe('4. The Ghost Writer', () => {
    it('denies creating a post on behalf of another user UID', async () => {
      const db = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      await assertFails(db.collection('posts').doc('post1').set({
         authorId: 'userB', authorName: 'B', timestamp: 1234,
         likesCount: 0, commentsCount: 0, visibilityStatus: 'public'
      }));
    });
  });

  describe('6. Email Spoofing', () => {
    it('denies writes if email_verified is false', async () => {
      const db = testEnv.authenticatedContext('userA', { email_verified: false }).firestore();
      await assertFails(db.collection('users').doc('userA').set({
         uid: 'userA', email: 'test@test.com', role: 'Guest'
      }));
    });
  });

  describe('7. PII Blanket Test', () => {
    it('denies list operation on users collection', async () => {
      const db = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      await assertFails(db.collection('users').get());
    });
  });

  describe('11. The Unauthorized Relational Grab', () => {
    it('denies fetching comments from a private post not owned by the user', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('posts').doc('privatePost').set({
            visibilityStatus: 'private', authorId: 'userB'
         });
      });
      const db = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      await assertFails(db.collection('posts').doc('privatePost').collection('comments').get());
    });
  });

  describe('12. Game Events Security', () => {
    it('allows an approved user to create a draft game event', async () => {
       await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('users').doc('userAdmin').set({
            uid: 'userAdmin', email: 'test@test.com', role: 'Admin', accountStatus: 'approved'
         });
      });
      const db = testEnv.authenticatedContext('userAdmin', { email_verified: true }).firestore();
      
      const now = new Date();
      now.setHours(now.getHours() + 2); // future kickoff

      await assertSucceeds(db.collection('game_events').doc('event1').set({
         organizerId: 'userAdmin',
         status: 'draft',
         type: 'treasure_hunt',
         title: 'My Game',
         description: 'desc',
         pointsMultiplier: 1.0,
         invitedUserIds: ['user123'],
         scheduledKickoff: now,
         createdAt: now
      }));
    });

    it('denies creating a game event if not an admin or root', async () => {
       await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('users').doc('userGuest').set({
            uid: 'userGuest', email: 'test@test.com', role: 'Guest', accountStatus: 'approved'
         });
      });
      const db = testEnv.authenticatedContext('userGuest', { email_verified: true }).firestore();
      
      const now = new Date();
      now.setHours(now.getHours() + 2);

      await assertFails(db.collection('game_events').doc('event2').set({
         organizerId: 'userGuest',
         status: 'draft',
         type: 'treasure_hunt',
         title: 'My Game',
         description: 'desc',
         pointsMultiplier: 1.0,
         invitedUserIds: [],
         scheduledKickoff: now
      }));
    });

    it('correctIndex not readable pre-reveal', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('game_events').doc('event1').set({ organizerId: 'userAdmin', status: 'active', invitedUserIds: ['userGuest'] });
         await context.firestore().collection('game_events').doc('event1').collection('participants').doc('userGuest').set({ status: 'joined' });
         await context.firestore().collection('game_events').doc('event1').collection('quizRounds').doc('round1').set({ revealedAt: null, correctIndex: 2 });
         await context.firestore().collection('game_events').doc('event1').collection('quizRounds').doc('round1').collection('secret').doc('correctness').set({ correctIndex: 2 });
      });

      const db = testEnv.authenticatedContext('userGuest', { email_verified: true }).firestore();
      
      await assertFails(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').collection('secret').doc('correctness').get());
    });

    it('items.update concurrent: only one winner', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('game_events').doc('event1').set({ organizerId: 'userAdmin', scheduledKickoff: new Date(Date.now() - 1000), endTime: new Date(Date.now() + 100000), status: 'active', invitedUserIds: ['userA', 'userB'] });
         await context.firestore().collection('game_events').doc('event1').collection('participants').doc('userA').set({ status: 'joined' });
         await context.firestore().collection('game_events').doc('event1').collection('participants').doc('userB').set({ status: 'joined' });
         await context.firestore().collection('game_events').doc('event1').collection('items').doc('item1').set({ status: 'spawned', lat: 10, lng: 10, points: 10, templateId: 't1' });
      });

      const dbA = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      const dbB = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();

      // Rule requires collectedAt == request.time; serverTimestamp() satisfies that.
      // lat/lng/points/templateId must equal the existing values (immutability).
      await assertSucceeds(dbA.collection('game_events').doc('event1').collection('items').doc('item1').update({
        status: 'collected', collectedBy: 'userA', collectedAt: serverTimestamp(),
        lat: 10, lng: 10, points: 10, templateId: 't1',
      }));

      // Second client races on the same item; it now finds status='collected'
      // and the rule blocks the transition (resource.data.status == 'spawned' fails).
      await assertFails(dbB.collection('game_events').doc('event1').collection('items').doc('item1').update({
        status: 'collected', collectedBy: 'userB', collectedAt: serverTimestamp(),
        lat: 10, lng: 10, points: 10, templateId: 't1',
      }));
    });

    it('invalid status transitions blocked', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
         await context.firestore().collection('users').doc('userAdmin').set({
            uid: 'userAdmin', email: 'test@test.com', role: 'Admin', accountStatus: 'approved'
         });
         await context.firestore().collection('game_events').doc('event_draft').set({
            organizerId: 'userAdmin', status: 'draft', type: 'treasure_hunt', createdAt: new Date()
         });
      });
      const db = testEnv.authenticatedContext('userAdmin', { email_verified: true }).firestore();
      
      await assertFails(db.collection('game_events').doc('event_draft').update({
         status: 'active'
      }));
      
      await assertSucceeds(db.collection('game_events').doc('event_draft').update({
         status: 'scheduled'
      }));
    });

    describe('Current Host tests', () => {
      nodeBeforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context: any) => {
           let db = context.firestore();
           await db.collection('users').doc('userAdmin').set({ uid: 'userAdmin', email: 'test@test.com', role: 'Admin', accountStatus: 'approved' });
           let now = new Date();
           await db.collection('game_events').doc('event1').set({ 
              organizerId: 'userAdmin', 
              status: 'active', 
              type: 'photo_quiz', 
              createdAt: now,
              photoQuizConfig: { currentHostId: 'hostUser' }
           });
           await db.collection('game_events').doc('event1').collection('participants').doc('hostUser').set({ status: 'joined', userId: 'hostUser' });
           await db.collection('game_events').doc('event1').collection('participants').doc('guestUser').set({ status: 'joined', userId: 'guestUser' });
        });
      });

      it('host can write quizRound + secret + reveal', async () => {
         const db = testEnv.authenticatedContext('hostUser', { email_verified: true }).firestore();
         
         await assertSucceeds(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').set({
            revealedAt: null
         }));
         
         await assertSucceeds(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').collection('secret').doc('correctness').set({
            correctIndex: 1
         }));
         
         await assertSucceeds(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').update({
            revealedAt: new Date()
         }));
      });

      it('organizer can write quizRound + secret', async () => {
         const db = testEnv.authenticatedContext('userAdmin', { email_verified: true }).firestore();
         
         await assertSucceeds(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').set({
            revealedAt: null
         }));
      });

      it('non-host participant cannot write quizRound', async () => {
         const db = testEnv.authenticatedContext('guestUser', { email_verified: true }).firestore();
         
         await assertFails(db.collection('game_events').doc('event1').collection('quizRounds').doc('round1').set({
            revealedAt: null
         }));
      });

      it('non-host participant cannot change currentHostId', async () => {
         const db = testEnv.authenticatedContext('guestUser', { email_verified: true }).firestore();
         
         await assertFails(db.collection('game_events').doc('event1').update({
            photoQuizConfig: { currentHostId: 'guestUser' }
         }));
      });

      it('current host can change currentHostId to next host', async () => {
         const db = testEnv.authenticatedContext('hostUser', { email_verified: true }).firestore();
         
         await assertSucceeds(db.collection('game_events').doc('event1').update({
            photoQuizConfig: { currentHostId: 'guestUser' }
         }));
      });

      it('current host cannot change other fields of the event', async () => {
         const db = testEnv.authenticatedContext('hostUser', { email_verified: true }).firestore();
         
         await assertFails(db.collection('game_events').doc('event1').update({
            status: 'completed',
            photoQuizConfig: { currentHostId: 'guestUser' }
         }));
      });
    });
  });
});

