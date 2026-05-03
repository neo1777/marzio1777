export interface LocalTrack {
  id: string; // UUID v4 generato client-side
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  durationMs: number;
  coverDataUrl?: string; // base64
  blob: Blob; // mp3/m4a/ogg/flac
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number; // Date.now()
  lastPlayedAt?: number;
  playCount: number;
  isFavorite: boolean;
  customTags: string[];
}

export interface LocalPlaylist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  coverTrackId?: string;
}

export interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  coverDataUrl?: string;
}

export interface AudioPlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: string[];
  shuffleMode: boolean;
  repeatMode: 'off' | 'one' | 'all';
}

export interface SessionRules {
  maxQueuedPerUser: number;
  bonusPerHundredPoints: number;
  allowDuplicates: boolean;
  autoSkipOfflineProposers: boolean;
}

export interface AudioSession {
  id: string;
  type: 'audio_session';
  djId: string;
  djName: string;
  djPhotoURL: string;
  title: string;
  description?: string;
  status: 'open' | 'closed';
  mode: 'auto' | 'manual';
  createdAt: any; // Timestamp
  closedAt: any | null; // Timestamp
  
  currentQueueItemId: string | null;
  currentTrackTitle: string | null;
  currentTrackArtist: string | null;
  currentTrackDurationMs: number | null;
  currentTrackStartedAt: any | null; // Timestamp
  
  rules: SessionRules;
  
  participantCount: number;
  queuedCount: number;
  playedCount: number;
  
  linkedGameEventId?: string | null;
  finalStats?: {
     totalDurationMs: number;
     totalTracksPlayed: number;
     participantsCount: number;
     topProposers: Array<{ userId: string, displayName: string, tracksPlayed: number }>;
     closedAt: any; // Timestamp
  };
}

export interface QueueItem {
  id: string;
  proposedBy: string;
  proposedByName: string;
  proposedByPhotoURL: string;
  proposedAt: any; // Timestamp
  
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string;
  trackYear?: number;
  trackDurationMs: number;
  trackCoverDataUrl?: string; // base64, optional
  
  localTrackId: string;
  
  status: 'queued' | 'transferring' | 'ready' | 'playing' | 'played' | 'skipped' | 'failed';
  
  position: number;
  
  transferStartedAt?: any; // Timestamp
  transferCompletedAt?: any; // Timestamp
  transferFailureReason?: string;

  pointsAwarded?: number;

  // Snapshot of the bonus formula at create-time, validated by the rule.
  // Closes 90% of "Sporca #24 Queue Stuffer". Final per-user count enforcement
  // is deferred to a Cloud Function in Phase 2 (DSL can't count documents).
  effectiveMaxAtCreate?: number;
}

export interface SessionParticipant {
  userId: string;
  displayName: string;
  photoURL: string;
  joinedAt: any; // Timestamp
  leftAt?: any; // Timestamp
  lastSeenAt: any; // Timestamp
  tracksProposed: number;
  tracksPlayed: number;
  status: 'joined' | 'left';
}

export interface SignalingDoc {
  userId: string;
  sessionId: string;
  djOffer?: {
    sdp: string;
    type: 'offer';
    queueItemId: string;
    createdAt: any; // Timestamp
  };
  proposerAnswer?: {
    sdp: string;
    type: 'answer';
    createdAt: any; // Timestamp
  };
  djCandidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number; addedAt: any }>;
  proposerCandidates: Array<{ candidate: string; sdpMid: string; sdpMLineIndex: number; addedAt: any }>;
  expireAt: any; // Timestamp
}