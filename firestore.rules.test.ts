import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: any;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'marzio-memories-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
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
      const db = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
      await assertSucceeds(db.collection('users').doc('userA').set({
        uid: 'userA', email: 'test@test.com', role: 'Guest'
      }));
      await assertFails(db.collection('users').doc('userA').update({
        role: 'Admin'
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
});
