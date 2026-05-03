import type { QuestionType, GeneratedQuestion } from './utils/quizGenerators';

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
