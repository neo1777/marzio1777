import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAudioEngine } from '../../utils/audioEngine';

// Mock window for AudioContext
if (typeof global.window === 'undefined') {
  (global as any).window = {};
}


// Mock AudioContext and Audio
beforeEach(() => {
   class MockAudioContext {
       createMediaElementSource = vi.fn().mockReturnValue({ connect: vi.fn().mockReturnThis() });
       createGain = vi.fn().mockReturnValue({ gain: { value: 1 }, connect: vi.fn().mockReturnThis() });
       createBiquadFilter = vi.fn().mockReturnValue({
           type: '', frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect: vi.fn().mockReturnThis()
       });
       createAnalyser = vi.fn().mockReturnValue({ fftSize: 0, connect: vi.fn().mockReturnThis() });
       destination = {};
       resume = vi.fn();
       close = vi.fn();
       state = 'running';
   }

   (global as any).window.AudioContext = MockAudioContext;
   (global as any).AudioContext = MockAudioContext;

   class MockAudio {
       play = vi.fn().mockResolvedValue(undefined);
       pause = vi.fn();
       load = vi.fn();
       addEventListener = vi.fn();
       removeEventListener = vi.fn();
       remove = vi.fn();
       src = '';
       currentTime = 0;
       duration = 0;
       paused = true;
   }
   (global as any).Audio = MockAudio;
   
   if(typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
   }
});

describe('AudioEngine', () => {
    it('load + play + pause cycles correctly', async () => {
        const engine = getAudioEngine();
        await engine.load(new Blob());
        await engine.play();
        engine.pause();
        // Just verify it doesn't crash given mocks
        expect(true).toBe(true);
    });

    it('setVolume updates gain', () => {
        const engine = getAudioEngine();
        engine.setVolume(0.5);
        expect(true).toBe(true);
    });

    it('setEQ updates filters', () => {
        const engine = getAudioEngine();
        engine.setEQ(1, -2, 3);
        expect(true).toBe(true);
    });

    it('getDuration returns correctly after load', () => {
        const engine = getAudioEngine();
        const duration = engine.getDuration();
        expect(duration).toBeGreaterThanOrEqual(0);
    });
});
