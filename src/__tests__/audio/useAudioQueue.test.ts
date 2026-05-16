import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks (hoisted by vitest before any import) ──────────────
// proposeTrackToSession is the standalone variant used by the Library /
// FullScreenPlayer "Add to session" flow. It pre-flights the CF
// enforceQueuePerUserLimit; if the CF is down we want a structured warn
// + the proposal to still land on Firestore (rule effectiveMaxAtCreate
// covers the security-relevant invariant).

vi.mock('../../lib/firebase', () => ({
  db: { __mock: 'db' },
  functions: { __mock: 'functions' },
  app: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((..._args: any[]) => ({ id: 'generated-id' })),
  collection: vi.fn((..._args: any[]) => ({})),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  deleteDoc: vi.fn(),
  increment: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: any) => children,
}));

import { proposeTrackToSession } from '../../hooks/useAudioQueue';
import { httpsCallable } from 'firebase/functions';
import { setDoc, getDoc, getDocs } from 'firebase/firestore';

describe('proposeTrackToSession — CF fallback graceful', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Participant doc already joined → skip the participant upsert branch
    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'joined' }),
    });
    // Queue empty → maxPos = 0
    (getDocs as any).mockResolvedValue({ docs: [] });
    (setDoc as any).mockResolvedValue(undefined);
  });

  it('logs structured warn and still writes the queue item when CF rejects', async () => {
    const enforceLimit = vi
      .fn()
      .mockRejectedValue({ code: 'unavailable', message: 'CF not deployed' });
    (httpsCallable as any).mockReturnValue(enforceLimit);

    const track: any = {
      id: 'track-1',
      title: 'Foo',
      artist: 'Bar',
      album: '',
      durationMs: 180_000,
    };
    const session: any = {
      id: 'sess-abc',
      rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1 },
    };
    const user: any = { uid: 'uid-123', displayName: 'Tester', photoURL: '' };
    const userData: any = { points: 250 };

    // 1. Must NOT throw — graceful degradation, not failure
    await expect(
      proposeTrackToSession(track, session, user, userData)
    ).resolves.toBeUndefined();

    // 2. CF was actually invoked (sanity)
    expect(enforceLimit).toHaveBeenCalledWith({ sessionId: 'sess-abc' });

    // 3. console.warn called with the structured payload (least at the 3 required keys)
    expect(warnSpy).toHaveBeenCalledWith(
      '[marzio1777] CF fallback active',
      expect.objectContaining({
        event: 'cf_fallback_active',
        cf: 'enforceQueuePerUserLimit',
        reason: 'unavailable',
      })
    );
    // Bonus assertions on the same call: proposerId + sessionId + timestamp shape
    const payload = warnSpy.mock.calls.find(
      (c) => c[0] === '[marzio1777] CF fallback active'
    )?.[1] as any;
    expect(payload.proposerId).toBe('uid-123');
    expect(payload.sessionId).toBe('sess-abc');
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 4. The proposal still landed on Firestore: a setDoc call writes the
    //    queue item with this track's metadata + the effectiveMaxAtCreate
    //    snapshot that the rule will validate.
    const queueWriteCall = (setDoc as any).mock.calls.find(
      (call: any[]) => call[1] && call[1].trackTitle === 'Foo' && call[1].proposedBy === 'uid-123'
    );
    expect(queueWriteCall).toBeDefined();
    expect(queueWriteCall[1]).toMatchObject({
      proposedBy: 'uid-123',
      trackTitle: 'Foo',
      trackArtist: 'Bar',
      trackDurationMs: 180_000,
      status: 'queued',
      position: 1,
      // 2 + floor(250/100) * 1 = 4 — same formula as CF + rule
      effectiveMaxAtCreate: 4,
    });
  });

  it('falls back when error has no .code (e.g. network failure)', async () => {
    const enforceLimit = vi.fn().mockRejectedValue(new Error('Network request failed'));
    (httpsCallable as any).mockReturnValue(enforceLimit);

    const track: any = { id: 't', title: 'X', artist: 'Y', album: '', durationMs: 1000 };
    const session: any = { id: 's', rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1 } };
    const user: any = { uid: 'u', displayName: 'U', photoURL: '' };
    const userData: any = { points: 0 };

    await expect(proposeTrackToSession(track, session, user, userData)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[marzio1777] CF fallback active',
      expect.objectContaining({ reason: 'Network request failed' })
    );
  });

  it('still throws (does NOT swallow) when CF rejects with resource-exhausted', async () => {
    const enforceLimit = vi.fn().mockRejectedValue({
      code: 'functions/resource-exhausted',
      message: 'Limit reached',
    });
    (httpsCallable as any).mockReturnValue(enforceLimit);

    const track: any = { id: 't', title: 'X', artist: 'Y', album: '', durationMs: 1000 };
    const session: any = { id: 's', rules: { maxQueuedPerUser: 2, bonusPerHundredPoints: 1 } };
    const user: any = { uid: 'u', displayName: 'U', photoURL: '' };
    const userData: any = { points: 0 };

    await expect(proposeTrackToSession(track, session, user, userData)).rejects.toThrow(
      'Limit reached'
    );
    // No structured warn in this branch — it's a legitimate denial, not a fallback
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[marzio1777] CF fallback active',
      expect.anything()
    );
    // Queue write NOT attempted
    const queueWriteCall = (setDoc as any).mock.calls.find(
      (call: any[]) => call[1] && call[1].status === 'queued'
    );
    expect(queueWriteCall).toBeUndefined();
  });
});
