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

  describe('B7 — Owner-side points cap (1000/transaction)', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().collection('users').doc('userA').set({
           uid: 'userA', email: 'a@test.com', role: 'Guest', accountStatus: 'approved', points: 100,
        });
      });
    });

    it('accepts an increment within the cap', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('users').doc('userA').update({ points: 600 })); // +500
    });

    it('accepts an increment up to the cap', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('users').doc('userA').update({ points: 1100 })); // +1000 exact
    });

    it('rejects an increment above the cap', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('users').doc('userA').update({ points: 9999999 }));
    });

    it('rejects a decrement (monotonic)', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('users').doc('userA').update({ points: 50 }));
    });

    it('rejects writing another user points field', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().collection('users').doc('userB').set({
           uid: 'userB', email: 'b@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
      });
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('users').doc('userB').update({ points: 50 }));
    });
  });

  describe('B7 — answers.update self-claim post-reveal', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('userA').set({
          uid: 'userA', email: 'a@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        await db.collection('users').doc('userB').set({
          uid: 'userB', email: 'b@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        const ev = db.collection('game_events').doc('ev1');
        await ev.set({
          organizerId: 'orgX', status: 'active', type: 'photo_quiz',
          createdAt: new Date(),
          pointsMultiplier: 1,
          photoQuizConfig: { currentHostId: 'orgX', maxPointsPerRound: 10 },
        });
        await ev.collection('participants').doc('userA').set({ status: 'joined', userId: 'userA' });
        await ev.collection('participants').doc('userB').set({ status: 'joined', userId: 'userB' });
        const round = ev.collection('quizRounds').doc('r1');
        await round.set({
          revealedAt: new Date(),
          correctIndex: 2,
          startedAt: new Date(Date.now() - 5000),
          endsAt: new Date(Date.now() + 60_000),
        });
        await round.collection('answers').doc('userA').set({
          userId: 'userA', selectedIndex: 2, displayName: 'A',
          timestamp: new Date(Date.now() - 4000),
          pointsAwarded: 0,
        });
        await round.collection('answers').doc('userB').set({
          userId: 'userB', selectedIndex: 1, displayName: 'B',
          timestamp: new Date(Date.now() - 3000),
          pointsAwarded: 0,
        });
      });
    });

    it('participant can claim points on their own correct answer', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('quizRounds').doc('r1')
        .collection('answers').doc('userA')
        .update({ pointsAwarded: 10 }));
    });

    it('participant cannot claim positive points on a wrong answer', async () => {
      const db = testEnv.authenticatedContext('userB', { email: 'b@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('quizRounds').doc('r1')
        .collection('answers').doc('userB')
        .update({ pointsAwarded: 10 }));
    });

    it('participant can write a 0 points outcome on a wrong answer', async () => {
      const db = testEnv.authenticatedContext('userB', { email: 'b@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('quizRounds').doc('r1')
        .collection('answers').doc('userB')
        .update({ pointsAwarded: 0 }));
    });

    it('participant cannot write someone else answer', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('quizRounds').doc('r1')
        .collection('answers').doc('userB')
        .update({ pointsAwarded: 0 }));
    });

    it('participant cannot exceed the per-round cap (multiplier × maxPointsPerRound)', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('quizRounds').doc('r1')
        .collection('answers').doc('userA')
        .update({ pointsAwarded: 999 }));
    });
  });

  describe('B7 — leaderboard ownership-stretto', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('userA').set({
           uid: 'userA', email: 'a@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        await db.collection('users').doc('userB').set({
           uid: 'userB', email: 'b@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        const ev = db.collection('game_events').doc('ev1');
        await ev.set({ organizerId: 'orgX', status: 'active', type: 'treasure_hunt', createdAt: new Date() });
        await ev.collection('participants').doc('userA').set({ status: 'joined', userId: 'userA' });
        await ev.collection('participants').doc('userB').set({ status: 'joined', userId: 'userB' });
      });
    });

    it('participant can write their own leaderboard row', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('leaderboard').doc('userA')
        .set({ userId: 'userA', displayName: 'A', points: 5 }));
    });

    it('participant cannot write someone else leaderboard row (B7 fix)', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('leaderboard').doc('userB')
        .set({ userId: 'userB', displayName: 'B', points: 0 }));
    });
  });

  describe('B7 — participants.delete ownership-stretto', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('userA').set({
           uid: 'userA', email: 'a@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        await db.collection('users').doc('userB').set({
           uid: 'userB', email: 'b@test.com', role: 'Guest', accountStatus: 'approved', points: 0,
        });
        await db.collection('users').doc('orgX').set({
           uid: 'orgX', email: 'o@test.com', role: 'Admin', accountStatus: 'approved', points: 0,
        });
        const ev = db.collection('game_events').doc('ev1');
        await ev.set({ organizerId: 'orgX', status: 'active', type: 'treasure_hunt', createdAt: new Date() });
        await ev.collection('participants').doc('userA').set({ status: 'joined', userId: 'userA' });
        await ev.collection('participants').doc('userB').set({ status: 'joined', userId: 'userB' });
      });
    });

    it('user can delete their own participant doc (self-leave)', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('participants').doc('userA').delete());
    });

    it('an unrelated participant cannot kick another participant (B7 fix)', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('participants').doc('userB').delete());
    });

    it('the organizer can kick any participant', async () => {
      const db = testEnv.authenticatedContext('orgX', { email: 'o@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('participants').doc('userB').delete());
    });
  });

  describe('Sporca #31 — Like Forger (posts.update likedBy diff)', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('userA').set({
           uid: 'userA', email: 'a@test.com', role: 'Admin', accountStatus: 'approved', points: 0,
        });
        await db.collection('users').doc('userB').set({
           uid: 'userB', email: 'b@test.com', role: 'Admin', accountStatus: 'approved', points: 0,
        });
        await db.collection('posts').doc('p1').set({
           authorId: 'userA', authorName: 'A', timestamp: 1234,
           likesCount: 0, commentsCount: 0, visibilityStatus: 'public',
           likedBy: [],
        });
      });
    });

    it('owner self-likes their own post (size+1, diff = [auth.uid])', async () => {
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('posts').doc('p1').update({
         likesCount: 1, likedBy: ['userA'],
         // isValidPost requires the rest of the keys to remain intact.
         authorId: 'userA', authorName: 'A', timestamp: 1234, commentsCount: 0, visibilityStatus: 'public',
      }));
    });

    it('rejects forging another user uid into likedBy (Sporca #31)', async () => {
      const db = testEnv.authenticatedContext('userB', { email: 'b@test.com', email_verified: true }).firestore();
      // userB tries to "like" the post but injects userA's uid in likedBy.
      // size+1 and likesCount+1 match, but the diff is not {userB}.
      await assertFails(db.collection('posts').doc('p1').update({
         likesCount: 1, likedBy: ['userA'],
         authorId: 'userA', authorName: 'A', timestamp: 1234, commentsCount: 0, visibilityStatus: 'public',
      }));
    });

    it('rejects double-like (caller already in likedBy)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().collection('posts').doc('p1').update({ likesCount: 1, likedBy: ['userA'] });
      });
      const db = testEnv.authenticatedContext('userA', { email: 'a@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('posts').doc('p1').update({
         likesCount: 2, likedBy: ['userA', 'userA'],
         authorId: 'userA', authorName: 'A', timestamp: 1234, commentsCount: 0, visibilityStatus: 'public',
      }));
    });

    it('accepts a legitimate unlike (caller was in the set)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().collection('posts').doc('p1').update({ likesCount: 2, likedBy: ['userA', 'userB'] });
      });
      const db = testEnv.authenticatedContext('userB', { email: 'b@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('posts').doc('p1').update({
         likesCount: 1, likedBy: ['userA'],
         authorId: 'userA', authorName: 'A', timestamp: 1234, commentsCount: 0, visibilityStatus: 'public',
      }));
    });

    it('rejects an unlike that strips someone else (caller not in set)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().collection('posts').doc('p1').update({ likesCount: 1, likedBy: ['userA'] });
      });
      const db = testEnv.authenticatedContext('userB', { email: 'b@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('posts').doc('p1').update({
         likesCount: 0, likedBy: [],
         authorId: 'userA', authorName: 'A', timestamp: 1234, commentsCount: 0, visibilityStatus: 'public',
      }));
    });
  });

  describe('items.create — points bound [1, 200]', () => {
    nodeBeforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('orgX').set({
           uid: 'orgX', email: 'o@test.com', role: 'Admin', accountStatus: 'approved', points: 0,
        });
        const future = new Date(Date.now() + 60 * 60 * 1000);
        await db.collection('game_events').doc('ev1').set({
           organizerId: 'orgX', status: 'draft', type: 'treasure_hunt',
           createdAt: new Date(), scheduledKickoff: future,
        });
      });
    });

    it('accepts a sane points value within the band', async () => {
      const db = testEnv.authenticatedContext('orgX', { email: 'o@test.com', email_verified: true }).firestore();
      await assertSucceeds(db.collection('game_events').doc('ev1')
        .collection('items').doc('it1')
        .set({ status: 'spawned', collectedBy: null, lat: 0, lng: 0, points: 50, templateId: 't' }));
    });

    it('rejects points = 0', async () => {
      const db = testEnv.authenticatedContext('orgX', { email: 'o@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('items').doc('it2')
        .set({ status: 'spawned', collectedBy: null, lat: 0, lng: 0, points: 0, templateId: 't' }));
    });

    it('rejects points > 200 (would break users.points +1000 cap at 5x multiplier)', async () => {
      const db = testEnv.authenticatedContext('orgX', { email: 'o@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .collection('items').doc('it3')
        .set({ status: 'spawned', collectedBy: null, lat: 0, lng: 0, points: 250, templateId: 't' }));
    });
  });

  describe('B7 — finalLeaderboard immutability (Sporca #22 The Resurrectionist)', () => {
    it('rejects rewriting finalLeaderboard once the event is completed', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.collection('users').doc('orgX').set({
           uid: 'orgX', email: 'o@test.com', role: 'Admin', accountStatus: 'approved', points: 0,
        });
        await db.collection('game_events').doc('ev1').set({
          organizerId: 'orgX', status: 'completed', type: 'treasure_hunt',
          createdAt: new Date(),
          finalLeaderboard: [{ userId: 'orgX', points: 100 }],
        });
      });
      const db = testEnv.authenticatedContext('orgX', { email: 'o@test.com', email_verified: true }).firestore();
      await assertFails(db.collection('game_events').doc('ev1')
        .update({ finalLeaderboard: [{ userId: 'orgX', points: 999_999 }] }));
    });
  });
});

