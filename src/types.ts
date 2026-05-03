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
}

export interface Post {
   id: string;
   imageUrl?: string;
   caption?: string;
   authorName?: string;
   authorId?: string;
   decade?: string;
   timestamp?: any;
   location?: string;
   [key: string]: any;
}

export type { QuestionType, GeneratedQuestion };

export interface QuizQuestion {
   questionText: string;
   options: string[];
   correctIndex: number;
}
