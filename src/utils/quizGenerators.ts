import type { Post, QuizQuestion } from '../types';

export type QuestionType = 
  | 'guess_who' 
  | 'guess_year' 
  | 'guess_place' 
  | 'guess_caption' 
  | 'chronology';

export interface GeneratedQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  postId: string; // sempre presente, per binding
}

/**
 * REGISTRY DEI QUESTION GENERATORS PER IL QUIZ DEL BIVACCO.
 * 
 * Stato attuale (MVP): tutti i generators ritornano null.
 * L'host crea la domanda manualmente nel QuizHostCreateRound UI.
 * 
 * Per implementare un generator automatico in Fase 2:
 * 1. Sostituisci il body del generator (es. guess_who) con la logica
 *    che estrae la domanda dal post e i 3 distrattori da poolPosts.
 * 2. Aggiorna isAutoGenerationAvailable() per ritornare true se il
 *    type ha un generator implementato.
 * 3. La UI in QuizHostCreateRound mostrerà automaticamente il
 *    pulsante "Genera automaticamente" quando il generator è
 *    disponibile.
 * 
 * Nessuna altra modifica richiesta. Schema dati invariato.
 */
export type QuestionGenerator = (
  post: Post,
  poolPosts: Post[]  // per estrarre distrattori
) => GeneratedQuestion | null;

export const questionGenerators: Record<QuestionType, QuestionGenerator> = {
  guess_who: (post, pool) => null,      // TODO Fase 2
  guess_year: (post, pool) => null,     // TODO Fase 2
  guess_place: (post, pool) => null,    // TODO Fase 2
  guess_caption: (post, pool) => null,  // TODO Fase 2
  chronology: (post, pool) => null,     // TODO Fase 2
};

export function isAutoGenerationAvailable(type: QuestionType): boolean {
  // Dummy probe: chiama il generator con un post fake e vedi se ritorna null
  // (in produzione sarà più sofisticato, ora basta ritornare false sempre)
  return false;
}
