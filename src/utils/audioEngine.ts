export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext;
  private audioEl: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode;
  
  private gainNode: GainNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private analyser: AnalyserNode;
  
  private listeners: Record<string, (() => void)[]> = {};

  private constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';

    this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);

    this.gainNode = this.ctx.createGain();
    
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 320;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.5;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3200;

    this.analyser = this.ctx.createAnalyser();
    // 128 → 64 frequency bins, fed to the 32-bar visualizer. Lighter than 256
    // and aligned with TECHNICAL_DOCS_IT §4.13 / AINULINDALE_TECHNICAL_SPEC §9.
    this.analyser.fftSize = 128;

    // Graph connect
    this.sourceNode
      .connect(this.gainNode)
      .connect(this.eqLow)
      .connect(this.eqMid)
      .connect(this.eqHigh)
      .connect(this.analyser)
      .connect(this.ctx.destination);

    this.audioEl.addEventListener('ended', () => this.emit('ended'));
    this.audioEl.addEventListener('play', () => {
      // Must resume context on mobile if not already
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.emit('play');
    });
    this.audioEl.addEventListener('pause', () => this.emit('pause'));
    this.audioEl.addEventListener('timeupdate', () => this.emit('timeupdate'));
    this.audioEl.addEventListener('error', () => this.emit('error'));
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async load(blob: Blob | string): Promise<void> {
    if (!blob) throw new Error('AudioEngine.load: blob/url is null or undefined');
    if (typeof blob === 'string') {
      this.audioEl.src = blob;
    } else {
      if (this.audioEl.src && this.audioEl.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioEl.src);
      }
      this.audioEl.src = URL.createObjectURL(blob);
    }
    this.audioEl.load();
    if(this.ctx.state === 'suspended') {
       await this.ctx.resume();
    }
  }

  public async play(): Promise<void> {
     if(this.ctx.state === 'suspended') await this.ctx.resume();
     await this.audioEl.play();
  }

  public pause(): void {
    this.audioEl.pause();
  }

  public seek(seconds: number): void {
     if (seconds < 0) seconds = 0;
     if (seconds > this.audioEl.duration) seconds = this.audioEl.duration || 0;
    this.audioEl.currentTime = seconds;
  }

  public setVolume(v: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  public setEQ(low: number, mid: number, high: number): void {
    this.eqLow.gain.value = Math.max(-12, Math.min(12, low));
    this.eqMid.gain.value = Math.max(-12, Math.min(12, mid));
    this.eqHigh.gain.value = Math.max(-12, Math.min(12, high));
  }

  public getCurrentTime(): number {
    return this.audioEl.currentTime;
  }

  public getDuration(): number {
    return this.audioEl.duration || 0;
  }

  public isPlaying(): boolean {
    return !this.audioEl.paused;
  }

  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  public on(event: 'ended' | 'play' | 'pause' | 'timeupdate' | 'error', cb: () => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  
  public off(event: string, cb: () => void) {
     if(!this.listeners[event]) return;
     this.listeners[event] = this.listeners[event].filter(f => f !== cb);
  }

  private emit(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb());
    }
  }

  public destroy(): void {
    this.pause();
    this.audioEl.remove();
    this.ctx.close();
    AudioEngine.instance = null;
  }
}

export function getAudioEngine(): AudioEngine {
  return AudioEngine.getInstance();
}
