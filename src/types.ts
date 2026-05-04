import type { Timestamp } from 'firebase/firestore';
import type { QuestionType, GeneratedQuestion } from './utils/quizGenerators';

export type UserRole = 'Root' | 'Admin' | 'Guest';
export type AccountStatus = 'pending' | 'approved';

export interface UserProfile {
   uid: string;
   email: string;
   displayName?: string;
   photoURL?: string;
   role: UserRole;
   accountStatus: AccountStatus;
   points: number;
   bio?: string;
   apiKey?: string;
   shareLiveLocation?: boolean;
   createdAt?: Timestamp | null;
   updatedAt?: Timestamp | null;

   // Like-particle customization (LaPiazza). All optional, fall back to defaults.
   animIcon?: string;     // emoji/symbol used as particle ('none' = pure heart)
   animSpeed?: number;    // duration in seconds
   animDistance?: number; // vertical distance in pixels
   animColor?: string;    // hex/rgb tint

   // Phase 2.5: continuous-tracking gagliardetti (Veggente, Discordante,
   // Pellegrino). Maintained by client-side increment/reset in the
   // existing transactions (claimMyAnswerPoints, useAudioQueue queue
   // listener, captureItemTransaction). See `src/lib/gagliardetti.ts`.
   metrics?: {
      // Quiz Bivacco — current streak of consecutive correct answers.
      // Increment on every correct claim, reset to 0 on a wrong claim.
      quizStreak?: number;
      // L'Ainulindalë — current streak of own tracks skipped without a
      // played in between. Increment when a own queue item transitions
      // queued|transferring|ready → skipped, reset on playing → played.
      consecutiveSkipped?: number;
      // Campo dei Giochi — count of treasure_hunt events in legacy_posts
      // mode where the user collected ≥1 item. Incremented on the first
      // capture inside a legacy_posts hunt (idempotent — see captureItemTransaction).
      huntsLegacyCompleted?: number;
   };
}

export interface PostLocation {
   lat: number;
   lng: number;
}

export interface Post {
   id: string;
   imageUrl?: string;
   caption?: string;
   authorName?: string;
   authorId?: string;
   decade?: string;
   timestamp?: any;
   // Optional geotag in {lat, lng} form. The legacy schema described it as a
   // string but the actual runtime (LaMappa, LaPiazza) treats it as an object.
   location?: PostLocation | null;
}

export type { QuestionType, GeneratedQuestion };

export interface QuizQuestion {
   questionText: string;
   options: string[];
   correctIndex: number;
}
