import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module under test is imported lazily inside each test, so the singleton
// is freshly built against the mocked AudioContext/Audio per spec.
async function importEngine() {
   const mod = await import('../../utils/audioEngine');
   return mod.getAudioEngine();
}

if (typeof global.window === 'undefined') {
  (global as any).window = {};
}

let lastCtx: any;
let lastAudio: any;

beforeEach(async () => {
   // Reset the singleton each run so the AudioEngine constructor reruns and
   // re-binds to the freshly-mocked AudioContext/Audio.
   const mod = await import('../../utils/audioEngine');
   try { mod.getAudioEngine().destroy(); } catch { /* not yet built */ }

   class MockNode {
      _connected: any[] = [];
      gain = { value: 1 };
      type = '';
      frequency = { value: 0 };
      Q = { value: 0 };
      fftSize = 0;
      connect = vi.fn(function (this: any, target: any) { this._connected.push(target); return target; });
   }

   class MockAudioContext {
      state = 'running';
      destination = new MockNode();
      lastBiquad: any = null;
      lastGain: any = null;
      lastAnalyser: any = null;
      createMediaElementSource = vi.fn(() => new MockNode());
      createGain = vi.fn(() => { this.lastGain = new MockNode(); return this.lastGain; });
      createBiquadFilter = vi.fn(() => { this.lastBiquad = new MockNode(); return this.lastBiquad; });
      createAnalyser = vi.fn(() => { this.lastAnalyser = new MockNode(); return this.lastAnalyser; });
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn();
      constructor() { lastCtx = this; }
   }

   class MockAudio {
      crossOrigin = '';
      src = '';
      currentTime = 0;
      duration = 120;
      paused = true;
      _listeners: Record<string, Array<() => void>> = {};
      play = vi.fn().mockImplementation(() => { this.paused = false; return Promise.resolve(); });
      pause = vi.fn().mockImplementation(() => { this.paused = true; });
      load = vi.fn();
      remove = vi.fn();
      addEventListener = vi.fn((evt: string, cb: () => void) => {
         (this._listeners[evt] ||= []).push(cb);
      });
      removeEventListener = vi.fn();
      dispatch(evt: string) { (this._listeners[evt] || []).forEach(c => c()); }
      constructor() { lastAudio = this; }
   }

   (global as any).window.AudioContext = MockAudioContext;
   (global as any).AudioContext = MockAudioContext;
   (global as any).Audio = MockAudio;

   // Always override: Node has its own URL.createObjectURL that emits
   // `blob:nodedata:<uuid>`. We force the mock for deterministic assertions.
   URL.createObjectURL = vi.fn(() => 'blob:mock') as any;
   URL.revokeObjectURL = vi.fn() as any;
});

describe('AudioEngine', () => {
   it('builds the documented graph: source → gain → eqLow → eqMid → eqHigh → analyser → destination', async () => {
      await importEngine();
      // The engine constructor calls createMediaElementSource, createGain,
      // 3× createBiquadFilter, createAnalyser exactly once.
      expect(lastCtx.createMediaElementSource).toHaveBeenCalledTimes(1);
      expect(lastCtx.createGain).toHaveBeenCalledTimes(1);
      expect(lastCtx.createBiquadFilter).toHaveBeenCalledTimes(3);
      expect(lastCtx.createAnalyser).toHaveBeenCalledTimes(1);
      // FFT size matches the 32-bar visualizer contract (TECHNICAL_DOCS_IT §4.13).
      expect(lastCtx.lastAnalyser.fftSize).toBe(128);
   });

   it('load() with a Blob sets a blob: URL on the audio element', async () => {
      const engine = await importEngine();
      const blob = new Blob(['x'], { type: 'audio/mpeg' });
      await engine.load(blob);
      expect(lastAudio.src).toBe('blob:mock');
      expect(lastAudio.load).toHaveBeenCalled();
   });

   it('play() resumes a suspended context before starting', async () => {
      const engine = await importEngine();
      lastCtx.state = 'suspended';
      await engine.play();
      expect(lastCtx.resume).toHaveBeenCalled();
      expect(lastAudio.play).toHaveBeenCalled();
   });

   it('setVolume clamps to [0, 1]', async () => {
      const engine = await importEngine();
      engine.setVolume(2);
      expect(lastCtx.lastGain.gain.value).toBe(1);
      engine.setVolume(-0.5);
      expect(lastCtx.lastGain.gain.value).toBe(0);
      engine.setVolume(0.7);
      expect(lastCtx.lastGain.gain.value).toBeCloseTo(0.7);
   });

   it('setEQ clamps each band to [-12, +12] dB', async () => {
      const engine = await importEngine();
      engine.setEQ(99, -99, 6);
      // The three biquads were the last three created (low, mid, high).
      // Track the constructor-time order via createBiquadFilter calls.
      const calls = lastCtx.createBiquadFilter.mock.results;
      expect(calls.length).toBe(3);
      expect(calls[0].value.gain.value).toBe(12);   // low clamped from 99
      expect(calls[1].value.gain.value).toBe(-12);  // mid clamped from -99
      expect(calls[2].value.gain.value).toBe(6);    // high in-range
   });

   it('seek clamps to the duration window', async () => {
      const engine = await importEngine();
      lastAudio.duration = 60;
      engine.seek(120);
      expect(lastAudio.currentTime).toBe(60);
      engine.seek(-5);
      expect(lastAudio.currentTime).toBe(0);
      engine.seek(30);
      expect(lastAudio.currentTime).toBe(30);
   });

   it('emits "ended" on the underlying audio "ended" event', async () => {
      const engine = await importEngine();
      const cb = vi.fn();
      engine.on('ended', cb);
      lastAudio.dispatch('ended');
      expect(cb).toHaveBeenCalled();
   });

   it('off() detaches a previously-registered listener', async () => {
      const engine = await importEngine();
      const cb = vi.fn();
      engine.on('ended', cb);
      engine.off('ended', cb);
      lastAudio.dispatch('ended');
      expect(cb).not.toHaveBeenCalled();
   });
});
