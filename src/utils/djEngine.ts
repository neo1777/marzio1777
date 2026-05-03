import { QueueItem, AudioSession } from '../types/audio';

export type DJEngineState = 'idle' | 'playing' | 'transferring' | 'paused';

export class DJEngine {
  private queue: QueueItem[] = [];
  private session: AudioSession | null = null;
  private state: DJEngineState = 'idle';
  private currentItemId: string | null = null;
  
  private pendingBlobs = new Map<string, Blob>();
  private failedItems = new Set<string>();
  
  private onStateChange: (state: DJEngineState) => void;
  private initiateTransfer: (itemId: string, proposerId: string, onReady: (blob: Blob) => void, onFail: (err: string) => void) => void;
  private updateSession: (patch: Partial<AudioSession>) => void;
  private setItemStatus: (itemId: string, status: QueueItem['status'], data?: any) => void;
  private playBlob: (blob: Blob) => void;
  private stopAudio: () => void;
  
  private checkInterval: NodeJS.Timeout | null = null;
  private getAudioProgress: () => { currentTime: number, duration: number } | null;

  constructor(deps: {
     onStateChange: (state: DJEngineState) => void;
     initiateTransfer: (itemId: string, proposerId: string, onReady: (blob: Blob) => void, onFail: (err: string) => void) => void;
     updateSession: (patch: Partial<AudioSession>) => void;
     setItemStatus: (itemId: string, status: QueueItem['status'], data?: any) => void;
     playBlob: (blob: Blob) => void;
     stopAudio: () => void;
     getAudioProgress: () => { currentTime: number, duration: number } | null;
  }) {
     this.onStateChange = deps.onStateChange;
     this.initiateTransfer = deps.initiateTransfer;
     this.updateSession = deps.updateSession;
     this.setItemStatus = deps.setItemStatus;
     this.playBlob = deps.playBlob;
     this.stopAudio = deps.stopAudio;
     this.getAudioProgress = deps.getAudioProgress;
  }

  public updateState(queue: QueueItem[], session: AudioSession) {
     this.queue = queue;
     this.session = session;
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
           
           if (timeRemainingMs <= 0) {
              // Track finished
              this.markCurrentPlayed();
              if (mode === 'auto') {
                 this.setState('idle'); // will pick up next immediately
              } else {
                 this.setState('paused');
              }
              return;
           }
           
           if (mode === 'auto' && timeRemainingMs <= 30000) {
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
     this.setItemStatus(item.id, 'transferring', { transferStartedAt: Date.now() });
     if (this.state !== 'playing') {
        this.setState('transferring');
     }
     
     this.initiateTransfer(item.id, item.proposedBy, (blob) => {
        this.pendingBlobs.set(item.id, blob);
        this.setItemStatus(item.id, 'ready', { transferCompletedAt: Date.now() });
        
        // Auto-play if not already playing and mode is auto
        if (this.state === 'transferring' || (this.state === 'idle' && this.session?.mode === 'auto')) {
            const upItem = this.queue.find(q => q.id === item.id);
            if (upItem) this.playItem(upItem);
        }
     }, (err) => {
        this.failedItems.add(item.id);
        this.setItemStatus(item.id, 'failed', { transferFailureReason: err });
        if (this.state === 'transferring') {
           this.setState('idle');
        }
     });
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
     this.setState('playing');
     this.playBlob(blob);
     
     this.setItemStatus(item.id, 'playing', { transferStartedAt: null }); // clear old data to save space if needed, actually keep it.
     
     this.updateSession({
        currentQueueItemId: item.id,
        currentTrackTitle: item.trackTitle,
        currentTrackArtist: item.trackArtist,
        currentTrackDurationMs: item.trackDurationMs,
        currentTrackStartedAt: Date.now()
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
     
     const pts = skipped ? 0 : 2; // For now hardcoded base 2 points
     this.setItemStatus(this.currentItemId, skipped ? 'skipped' : 'played', { pointsAwarded: pts });
     this.pendingBlobs.delete(this.currentItemId);
     this.currentItemId = null;
  }
}
