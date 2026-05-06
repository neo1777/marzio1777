import { QueueItem, AudioSession } from '../types/audio';

export type DJEngineState = 'idle' | 'playing' | 'transferring' | 'paused';

const BASE_TRACK_POINTS = 2;

export class DJEngine {
  private queue: QueueItem[] = [];
  private session: AudioSession | null = null;
  private state: DJEngineState = 'idle';
  private currentItemId: string | null = null;
  private eventMultiplier = 1;

  private pendingBlobs = new Map<string, Blob>();
  private failedItems = new Set<string>();

  // Wall-clock timestamp set in playItem(). Used by the polling fallback in
  // tick() to ignore the first ~2s of playback — the HTMLAudioElement can
  // briefly report stale duration/currentTime during a `src` swap, which
  // before this guard caused the engine to misread "track just started" as
  // "track just finished" and mark every queued item 'played' in rapid
  // succession.
  private playStartedAt: number | null = null;
  // Re-entrancy guard for the end-of-track handler. The 'ended' event from
  // the AudioEngine and the polling fallback in tick() can both fire near
  // each other; without this, markCurrentPlayed could be invoked twice on
  // the same item before the Firestore write lands (no-op in practice but
  // produces noisy logs and a transient extra setState).
  private isHandlingEnd = false;

  private onStateChange: (state: DJEngineState) => void;
  private initiateTransfer: (itemId: string, proposerId: string, onReady: (blob: Blob) => void, onFail: (err: string) => void) => void;
  private updateSession: (patch: Partial<AudioSession>) => void;
  private setItemStatus: (itemId: string, status: QueueItem['status'], data?: any) => void;
  private playBlob: (blob: Blob) => void;
  private stopAudio: () => void;
  private getServerTimestamp: () => unknown;
  // Optional: read a track blob from the DJ's own IndexedDB. When provided,
  // proposals authored by the DJ themself short-circuit the WebRTC handshake
  // (the file is already on this device, transferring to ourselves would
  // wedge — both peers share an UID, the signaling sub-collection collides,
  // and the listener never produces an answer → status stuck at
  // 'transferring' forever). See AudioSessionDJ wiring.
  private getLocalTrackBlob: ((localTrackId: string) => Promise<Blob | null>) | null = null;

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private getAudioProgress: () => { currentTime: number, duration: number } | null;

  constructor(deps: {
     onStateChange: (state: DJEngineState) => void;
     initiateTransfer: (itemId: string, proposerId: string, onReady: (blob: Blob) => void, onFail: (err: string) => void) => void;
     updateSession: (patch: Partial<AudioSession>) => void;
     setItemStatus: (itemId: string, status: QueueItem['status'], data?: any) => void;
     playBlob: (blob: Blob) => void;
     stopAudio: () => void;
     getAudioProgress: () => { currentTime: number, duration: number } | null;
     // Returns a Firestore serverTimestamp() sentinel — injected to keep this
     // class free of firebase imports (DI for testability).
     getServerTimestamp: () => unknown;
     // Optional fast-path lookup against the DJ's local IndexedDB.
     getLocalTrackBlob?: (localTrackId: string) => Promise<Blob | null>;
  }) {
     this.onStateChange = deps.onStateChange;
     this.initiateTransfer = deps.initiateTransfer;
     this.updateSession = deps.updateSession;
     this.setItemStatus = deps.setItemStatus;
     this.playBlob = deps.playBlob;
     this.stopAudio = deps.stopAudio;
     this.getAudioProgress = deps.getAudioProgress;
     this.getServerTimestamp = deps.getServerTimestamp;
     this.getLocalTrackBlob = deps.getLocalTrackBlob ?? null;
  }

  public updateState(queue: QueueItem[], session: AudioSession, eventMultiplier = 1) {
     this.queue = queue;
     this.session = session;
     this.eventMultiplier = eventMultiplier;
     // DJ Engine loop will react on interval
  }

  public startLoop() {
     if (this.checkInterval) clearInterval(this.checkInterval);
     this.checkInterval = setInterval(() => this.tick(), 1000);
  }

  public stopLoop() {
     if (this.checkInterval) clearInterval(this.checkInterval);
     this.stopAudio();
     this.pendingBlobs.clear();
  }

  private setState(state: DJEngineState) {
     this.state = state;
     this.onStateChange(state);
  }

  private getNextItem(): QueueItem | undefined {
     return this.queue.find(q => q.status === 'queued' && !this.failedItems.has(q.id));
  }

  private getTransferringItem(): QueueItem | undefined {
     return this.queue.find(q => q.status === 'transferring');
  }

  private async tick() {
     if (!this.session) return;
     const mode = this.session.mode;

     // 1. If currently playing, check for end or near end
     if (this.state === 'playing' && this.currentItemId) {
        const prog = this.getAudioProgress();
        if (prog && prog.duration > 0) {
           const timeRemainingMs = (prog.duration - prog.currentTime) * 1000;
           const sinceStart = this.playStartedAt !== null ? Date.now() - this.playStartedAt : 0;

           // End-of-track polling fallback. Source-of-truth is the AudioEngine
           // 'ended' event (wired via handleTrackEnded() from AudioSessionDJ);
           // this branch only catches the cases where 'ended' didn't fire
           // (stalled buffer on Safari iOS, network-served sources, etc.).
           // Triple-guarded against the spurious "track just ended" reading
           // that produced the all-played-instantly bug:
           //   - currentTime > 0  → the AudioElement is actually inside this
           //     track, not still reporting the previous one's tail
           //   - sinceStart >= 2000 → 2s of wall-clock time have passed since
           //     playItem() ran; metadata has had time to settle
           //   - timeRemainingMs <= 250 → genuinely close to the end (was 0,
           //     but stale duration during a src swap could land at exactly
           //     0 even on a fresh track)
           if (prog.currentTime > 0 && sinceStart >= 2000 && timeRemainingMs <= 250) {
              this.handleEndOfTrack();
              return;
           }

           if (mode === 'auto' && timeRemainingMs <= 30000 && timeRemainingMs > 0) {
              // Pre-fetch next track 30s before end
              const nextItem = this.getNextItem();
              if (nextItem && !this.getTransferringItem() && !this.pendingBlobs.has(nextItem.id)) {
                 this.startTransfer(nextItem);
              }
           }
        }
     }

     // 2. If idle, and we have an auto mode, try to fetch or play
     if (this.state === 'idle' && mode === 'auto') {
        const readyItem = this.queue.find(q => q.status === 'ready');
        if (readyItem && this.pendingBlobs.has(readyItem.id)) {
           this.playItem(readyItem);
           return;
        }
        
        // No ready items, need to transfer
        const tItem = this.getTransferringItem();
        if (!tItem) {
           const nextItem = this.getNextItem();
           if (nextItem && !this.failedItems.has(nextItem.id)) {
              this.startTransfer(nextItem);
           }
        }
     }
  }

  private startTransfer(item: QueueItem) {
     this.setItemStatus(item.id, 'transferring', { transferStartedAt: this.getServerTimestamp() });
     if (this.state !== 'playing') {
        this.setState('transferring');
     }

     const onReady = (blob: Blob) => {
        this.pendingBlobs.set(item.id, blob);
        this.setItemStatus(item.id, 'ready', { transferCompletedAt: this.getServerTimestamp() });

        // Auto-play if not already playing and mode is auto
        if (this.state === 'transferring' || (this.state === 'idle' && this.session?.mode === 'auto')) {
            const upItem = this.queue.find(q => q.id === item.id);
            if (upItem) this.playItem(upItem);
        }
     };
     const onFail = (err: string) => {
        this.failedItems.add(item.id);
        this.setItemStatus(item.id, 'failed', { transferFailureReason: err });
        if (this.state === 'transferring') {
           this.setState('idle');
        }
     };

     // Fast-path: the proposer is the DJ themself. The track blob is already
     // in this device's IndexedDB — read it directly instead of negotiating a
     // WebRTC connection to ourselves (which would wedge: both peers share
     // an UID, the signaling sub-collection has a single doc address, and
     // the listener never produces an answer → status stuck at 'transferring'
     // forever).
     if (this.getLocalTrackBlob && this.session && item.proposedBy === this.session.djId) {
        this.getLocalTrackBlob(item.localTrackId)
           .then((blob) => {
              if (blob) onReady(blob);
              else onFail('Brano non trovato nella biblioteca locale del DJ.');
           })
           .catch((e) => onFail(e?.message ?? 'Errore lettura biblioteca locale.'));
        return;
     }

     this.initiateTransfer(item.id, item.proposedBy, onReady, onFail);
  }

  public forcePlayNext() {
     if (this.currentItemId) {
        this.markCurrentPlayed(true);
     }
     
     const readyItem = this.queue.find(q => q.status === 'ready');
     if (readyItem && this.pendingBlobs.has(readyItem.id)) {
        this.playItem(readyItem);
     } else {
        const nextItem = this.getNextItem();
        if (nextItem) {
           this.startTransfer(nextItem);
        } else {
           this.stopAudio();
           this.setState('idle');
           this.updateSession({
              currentQueueItemId: null,
              currentTrackTitle: null,
              currentTrackArtist: null,
              currentTrackDurationMs: null,
              currentTrackStartedAt: null
           });
        }
     }
  }

  private playItem(item: QueueItem) {
     const blob = this.pendingBlobs.get(item.id);
     if (!blob) return;

     this.currentItemId = item.id;
     this.playStartedAt = Date.now();
     this.setState('playing');
     this.playBlob(blob);

     this.setItemStatus(item.id, 'playing', { transferStartedAt: null }); // clear old data to save space if needed, actually keep it.
     
     this.updateSession({
        currentQueueItemId: item.id,
        currentTrackTitle: item.trackTitle,
        currentTrackArtist: item.trackArtist,
        currentTrackDurationMs: item.trackDurationMs,
        currentTrackStartedAt: this.getServerTimestamp() as any,
     });
     
     // Remove old blobs to free memory
     for (const [key] of this.pendingBlobs.entries()) {
        if (key !== item.id) {
           // wait, we might have prefetched the next next item? 
           // Only keep current and ready items
           const keep = this.queue.find(q => q.id === key && ['ready', 'playing'].includes(q.status));
           if (!keep) this.pendingBlobs.delete(key);
        }
     }
  }

  private markCurrentPlayed(skipped = false) {
     if (!this.currentItemId) return;

     // Base 2pt per played track, scaled by the linked game_event multiplier
     // (1.0 if the session is standalone). See AINULINDALE_TECHNICAL_SPEC §11.
     const pts = skipped ? 0 : Math.round(BASE_TRACK_POINTS * this.eventMultiplier);
     this.setItemStatus(this.currentItemId, skipped ? 'skipped' : 'played', { pointsAwarded: pts });
     this.pendingBlobs.delete(this.currentItemId);
     this.currentItemId = null;
     this.playStartedAt = null;
  }

  // Internal: handle "current track has finished playing". Funnels both the
  // AudioEngine 'ended' event and the polling fallback in tick() through a
  // single re-entrancy-guarded path so we never mark the same item 'played'
  // twice in quick succession.
  private handleEndOfTrack() {
     if (this.isHandlingEnd) return;
     if (this.state !== 'playing' || !this.currentItemId) return;
     this.isHandlingEnd = true;
     try {
        this.markCurrentPlayed();
        const mode = this.session?.mode;
        if (mode === 'auto') {
           this.setState('idle'); // tick() will pick the next ready item
        } else {
           this.setState('paused');
        }
     } finally {
        this.isHandlingEnd = false;
     }
  }

  // Public: AudioSessionDJ subscribes to engine.on('ended') and invokes this.
  // Preferred source-of-truth over the polling fallback in tick() because it
  // fires exactly when the audio actually ended, not 0-1s later.
  public handleTrackEnded() {
     this.handleEndOfTrack();
  }
}
