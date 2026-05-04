import { describe, it, expect } from 'vitest';
import { haversineDistance, bearing } from '../../utils/geo';
import { generateUniformPointsInRadius } from '../../utils/spawning';
import { calculateQuizPoints } from '../../utils/scoring';
import { validStatusTransition } from '../../utils/eventState';
import { questionGenerators, isAutoGenerationAvailable } from '../../utils/quizGenerators';
import type { Post } from '../../types';

function fakePost(over: Partial<Post>): Post {
  return {
    id: over.id || 'p_default',
    authorName: 'Default Author',
    decade: '1970',
    caption: 'Default caption goes here',
    ...over,
  } as Post;
}

describe('Geo Utils', () => {
  it('haversineDistance calculates correctly', () => {
    const rome = { lat: 41.9028, lng: 12.4964 };
    const milan = { lat: 45.4642, lng: 9.1900 };
    // Distance between Rome and Milan is ~477km
    const dist = haversineDistance(rome, milan);
    expect(dist).toBeGreaterThan(470000);
    expect(dist).toBeLessThan(485000);
  });

  it('haversineDistance is 0 for same point', () => {
    const pt = { lat: 10, lng: 10 };
    const dist = haversineDistance(pt, pt);
    expect(dist).toBe(0);
  });
  
  it('bearing calculates correctly', () => {
     const start = { lat: 0, lng: 0 };
     const north = { lat: 10, lng: 0 };
     const east = { lat: 0, lng: 10 };
     
     expect(bearing(start, north)).toBeCloseTo(0);
     expect(bearing(start, east)).toBeCloseTo(90);
  });
});

describe('Spawning Utils', () => {
  it('generateUniformPointsInRadius creates requested number of points', () => {
    const pts = generateUniformPointsInRadius(45.886, 8.853, 1000, 10, 8);
    expect(pts.length).toBe(10);
  });

  it('generateUniformPointsInRadius points are within radius', () => {
    const center = { lat: 45.886, lng: 8.853 };
    const pts = generateUniformPointsInRadius(center.lat, center.lng, 500, 20, 8);
    pts.forEach(p => {
      expect(haversineDistance(center, p)).toBeLessThanOrEqual(500);
    });
  });

  it('generateUniformPointsInRadius respects min separation', () => {
    const center = { lat: 45.886, lng: 8.853 };
    const pts = generateUniformPointsInRadius(center.lat, center.lng, 50, 5, 8);
    for (let i = 0; i < pts.length; i++) {
       for (let j = i + 1; j < pts.length; j++) {
          expect(haversineDistance(pts[i], pts[j])).toBeGreaterThanOrEqual(8);
       }
    }
  });

  it('generateUniformPointsInRadius stops infinite loop when impossible', () => {
    const center = { lat: 45.886, lng: 8.853 };
    // Try to spawn 1000 items in 1m radius with 8m separation
    const pts = generateUniformPointsInRadius(center.lat, center.lng, 1, 1000, 8);
    expect(pts.length).toBeLessThan(1000);
  });
});

describe('Scoring Utils', () => {
  it('calculateQuizPoints handles wrong answer', () => {
    expect(calculateQuizPoints('fixed', false, 1000, 10000)).toBe(0);
    expect(calculateQuizPoints('decay', false, 1000, 10000)).toBe(0);
  });

  it('calculateQuizPoints fixed mode', () => {
    expect(calculateQuizPoints('fixed', true, 1000, 10000)).toBe(10);
    expect(calculateQuizPoints('fixed', true, 9999, 10000)).toBe(10);
  });

  it('calculateQuizPoints decay mode', () => {
    expect(calculateQuizPoints('decay', true, 0, 10000)).toBe(10); // instant
    expect(calculateQuizPoints('decay', true, 5000, 10000)).toBe(5); // 50%
    expect(calculateQuizPoints('decay', true, 10000, 10000)).toBe(1); // max time = 10%
    expect(calculateQuizPoints('decay', true, 15000, 10000)).toBe(1); // overtime = 10%
  });
});

describe('Event State Utils', () => {
  it('validStatusTransition behaves according to spec', () => {
     expect(validStatusTransition('draft', 'scheduled')).toBe(true);
     expect(validStatusTransition('draft', 'aborted')).toBe(true);
     expect(validStatusTransition('draft', 'active')).toBe(false);

     expect(validStatusTransition('scheduled', 'lobby')).toBe(true);
     expect(validStatusTransition('scheduled', 'active')).toBe(true);
     expect(validStatusTransition('scheduled', 'completed')).toBe(false);

     expect(validStatusTransition('lobby', 'active')).toBe(true);
     expect(validStatusTransition('lobby', 'draft')).toBe(false);

     expect(validStatusTransition('active', 'completed')).toBe(true);
     expect(validStatusTransition('active', 'scheduled')).toBe(false);

     // Stay in same state is allowed
     expect(validStatusTransition('active', 'active')).toBe(true);
  });

  it('terminal states cannot move', () => {
     // 'completed' and 'aborted' are sinks (besides identity)
     expect(validStatusTransition('completed', 'active')).toBe(false);
     expect(validStatusTransition('completed', 'aborted')).toBe(false);
     expect(validStatusTransition('completed', 'completed')).toBe(true);
     expect(validStatusTransition('aborted', 'draft')).toBe(false);
     expect(validStatusTransition('aborted', 'aborted')).toBe(true);
  });

  it('time bandit attempts are blocked', () => {
     // "Sporca #21 The Time Bandit" — skipping straight from draft to completed
     expect(validStatusTransition('draft', 'completed')).toBe(false);
     expect(validStatusTransition('scheduled', 'completed')).toBe(false);
     expect(validStatusTransition('lobby', 'completed')).toBe(false);
  });
});

describe('Geo Utils — edge cases', () => {
  it('haversineDistance handles antimeridian crossings reasonably', () => {
     const east = { lat: 0, lng: 179.5 };
     const west = { lat: 0, lng: -179.5 };
     // Same parallel, ~111 km between (1° at the equator ≈ 111 km)
     const dist = haversineDistance(east, west);
     expect(dist).toBeGreaterThan(105_000);
     expect(dist).toBeLessThan(115_000);
  });

  it('haversineDistance is symmetric', () => {
     const a = { lat: 45.886, lng: 8.853 };
     const b = { lat: 46.0, lng: 9.0 };
     expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a));
  });
});

describe('Scoring Utils — edge cases', () => {
  it('decay floors to 1pt at the maxTimeMs boundary', () => {
     expect(calculateQuizPoints('decay', true, 10000, 10000)).toBe(1);
  });

  it('decay floors to 1pt for any correct answer within the window', () => {
     // Spec contract: a correct in-window answer is *never* worth 0,
     // even when the player just barely makes it. Pre-B7 the code
     // returned 0 for 9999/10000 because floor(10 * 0.0001) = 0.
     expect(calculateQuizPoints('decay', true, 9999, 10000)).toBe(1);
     expect(calculateQuizPoints('decay', true, 9000, 10000)).toBe(1);
  });

  it('decay overtime stays at the 1pt floor', () => {
     expect(calculateQuizPoints('decay', true, 12000, 10000)).toBe(1);
  });

  it('decay still rewards speed in the meaty middle', () => {
     // Floor doesn't squash the gradient: at half the window we still
     // get half the points (modulo flooring).
     expect(calculateQuizPoints('decay', true, 5000, 10000)).toBe(5);
     expect(calculateQuizPoints('decay', true, 1000, 10000)).toBe(9);
  });
});

describe('Spawning Utils — edge cases', () => {
  it('count = 0 returns an empty array', () => {
     const pts = generateUniformPointsInRadius(45.886, 8.853, 1000, 0, 8);
     expect(pts).toEqual([]);
  });

  it('radius = 0 collapses to (at most) the center', () => {
     const pts = generateUniformPointsInRadius(45.886, 8.853, 0, 5, 8);
     // With zero radius the algorithm degrades; we just want the call to
     // return without exploding and to not exceed the requested count.
     expect(pts.length).toBeLessThanOrEqual(5);
  });
});

describe('Quiz Generators — Phase 2', () => {
  describe('isAutoGenerationAvailable', () => {
    it('flags 4 generators as auto-available, leaves guess_place manual', () => {
      expect(isAutoGenerationAvailable('guess_who')).toBe(true);
      expect(isAutoGenerationAvailable('guess_year')).toBe(true);
      expect(isAutoGenerationAvailable('guess_caption')).toBe(true);
      expect(isAutoGenerationAvailable('chronology')).toBe(true);
      // Reverse-geocoding deferred to Phase 2.5
      expect(isAutoGenerationAvailable('guess_place')).toBe(false);
    });
  });

  describe('guess_who', () => {
    it('returns null if the source post has no author', () => {
      const r = questionGenerators.guess_who(fakePost({ id: 's', authorName: '' }), []);
      expect(r).toBeNull();
    });

    it('returns null if the pool has < 3 distinct other authors', () => {
      const source = fakePost({ id: 's', authorName: 'Mario' });
      const pool = [fakePost({ id: 'a', authorName: 'Mario' }), fakePost({ id: 'b', authorName: 'Luigi' })];
      expect(questionGenerators.guess_who(source, pool)).toBeNull();
    });

    it('produces a valid 4-option question with the source author as correct', () => {
      const source = fakePost({ id: 's', authorName: 'Mario' });
      const pool = [
        fakePost({ id: 'a', authorName: 'Luigi' }),
        fakePost({ id: 'b', authorName: 'Anna' }),
        fakePost({ id: 'c', authorName: 'Giovanna' }),
        fakePost({ id: 'd', authorName: 'Carlo' }),
      ];
      const r = questionGenerators.guess_who(source, pool);
      expect(r).not.toBeNull();
      expect(r!.options).toHaveLength(4);
      expect(r!.options[r!.correctIndex]).toBe('Mario');
      expect(r!.postId).toBe('s');
      // Distractors must all be from the pool, none equal to 'Mario'
      r!.options.forEach((opt, i) => {
        if (i !== r!.correctIndex) expect(opt).not.toBe('Mario');
      });
    });

    it('is deterministic by post.id', () => {
      const source = fakePost({ id: 'stable_id', authorName: 'Mario' });
      const pool = [
        fakePost({ id: 'a', authorName: 'Luigi' }),
        fakePost({ id: 'b', authorName: 'Anna' }),
        fakePost({ id: 'c', authorName: 'Giovanna' }),
        fakePost({ id: 'd', authorName: 'Carlo' }),
      ];
      const r1 = questionGenerators.guess_who(source, pool);
      const r2 = questionGenerators.guess_who(source, pool);
      expect(r1).toEqual(r2);
    });
  });

  describe('guess_year', () => {
    it('returns null if the source has no parsable decade', () => {
      const r = questionGenerators.guess_year(fakePost({ id: 's', decade: 'foo' }), []);
      expect(r).toBeNull();
    });

    it('produces 4 unique decade strings with the source decade as correct', () => {
      const source = fakePost({ id: 's', decade: '1970' });
      const pool = [
        fakePost({ id: 'a', decade: '1960' }),
        fakePost({ id: 'b', decade: '1980' }),
        fakePost({ id: 'c', decade: '1990' }),
      ];
      const r = questionGenerators.guess_year(source, pool);
      expect(r).not.toBeNull();
      expect(r!.options).toHaveLength(4);
      expect(new Set(r!.options).size).toBe(4); // all distinct
      expect(r!.options[r!.correctIndex]).toBe('Anni 70');
    });

    it('falls back to synthetic ±20y candidates when the pool is thin', () => {
      const source = fakePost({ id: 's', decade: '1970' });
      const r = questionGenerators.guess_year(source, []);
      // Even with empty pool, synthetic offsets [-20,-10,+10,+20] give us 4 candidates.
      expect(r).not.toBeNull();
      expect(r!.options).toHaveLength(4);
      expect(r!.options[r!.correctIndex]).toBe('Anni 70');
    });

    it('handles 2-digit decade format', () => {
      const source = fakePost({ id: 's', decade: '70' });
      const r = questionGenerators.guess_year(source, []);
      expect(r).not.toBeNull();
      expect(r!.options[r!.correctIndex]).toBe('Anni 70');
    });
  });

  describe('guess_place', () => {
    it('returns null in MVP (reverse-geocoding deferred to Phase 2.5)', () => {
      const r = questionGenerators.guess_place(fakePost({ id: 's' }), [fakePost({ id: 'a' })]);
      expect(r).toBeNull();
    });
  });

  describe('guess_caption', () => {
    it('returns null on too-short captions', () => {
      const r = questionGenerators.guess_caption(fakePost({ id: 's', caption: 'hi' }), []);
      expect(r).toBeNull();
    });

    it('produces 4 captions, source as correct, others from pool', () => {
      const source = fakePost({ id: 's', caption: 'La pizza più buona del paese' });
      const pool = [
        fakePost({ id: 'a', caption: 'Tramonto sulla diga' }),
        fakePost({ id: 'b', caption: 'Carnevale del 1985' }),
        fakePost({ id: 'c', caption: 'Festa patronale Ferragosto' }),
      ];
      const r = questionGenerators.guess_caption(source, pool);
      expect(r).not.toBeNull();
      expect(r!.options).toHaveLength(4);
      expect(r!.options[r!.correctIndex]).toBe('La pizza più buona del paese');
    });
  });

  describe('chronology', () => {
    it('returns null if pool has < 4 distinct decades', () => {
      const source = fakePost({ id: 's', decade: '1970' });
      const pool = [fakePost({ id: 'a', decade: '1980' }), fakePost({ id: 'b', decade: '1980' })];
      expect(questionGenerators.chronology(source, pool)).toBeNull();
    });

    it('produces 4 distinct permutations, one is the chronological order', () => {
      const source = fakePost({ id: 's', decade: '1970' });
      const pool = [
        fakePost({ id: 'a', decade: '1960' }),
        fakePost({ id: 'b', decade: '1980' }),
        fakePost({ id: 'c', decade: '1990' }),
        fakePost({ id: 'd', decade: '2000' }),
      ];
      const r = questionGenerators.chronology(source, pool);
      expect(r).not.toBeNull();
      expect(r!.options).toHaveLength(4);
      expect(new Set(r!.options).size).toBe(4); // all distinct permutations
      // The correct option must contain ascending decades joined by ' → '
      const correct = r!.options[r!.correctIndex];
      const decades = correct.split(' → ').map(s => parseInt(s.match(/\d+/)![0], 10));
      const sorted = [...decades].sort((a, b) => a - b);
      expect(decades).toEqual(sorted);
    });
  });
});
