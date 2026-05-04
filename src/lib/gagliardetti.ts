/**
 * Catalogo dei Gagliardetti di Marzio1777.
 *
 * Ogni gagliardetto è una struttura dichiarativa: nome, descrizione,
 * categoria, soglia, e una `compute()` che decide se è guadagnato dato
 * uno snapshot delle metriche dell'utente.
 *
 * Le metriche provengono da `useUserGagliardetti`, che esegue una manciata
 * di collection-group queries Firestore al mount + cache localStorage 1h.
 * I gagliardetti che richiedono tracking continuo non derivabile dai
 * snapshot (es. "5 risposte consecutive", "sessioni Host senza
 * disconnessioni") sono dichiarati ma marcati `phase: '2.5'` e non
 * mostrano progresso fino all'introduzione dei field di tracking.
 */

export type GagliardettoCategory = 'historical' | 'games' | 'audio';
export type GagliardettoPhase = '2' | '2.5';

export interface UserMetrics {
   /** users.{uid}.points cumulativi */
   points: number;
   /** Numero di game_events dove l'utente è participant joined */
   gamesJoined: number;
   /** Somma di leaderboard.{uid}.points per eventi treasure_hunt */
   huntPoints: number;
   /** Numero di game_events dove la finalLeaderboard ha l'utente come primo (vincitore) */
   gameWinsTotal: number;
   /** Numero di game_events photo_quiz con vittoria */
   quizWins: number;
   /** Numero di answers di quiz con pointsAwarded > 0 (risposte corrette) */
   quizCorrectTotal: number;
   /** Numero di queue items proposti dall'utente, qualsiasi status */
   tracksProposed: number;
   /** Numero di queue items con proposedBy=uid e status='played' */
   tracksPlayed: number;
   /** Numero di audio_sessions dove l'utente è djId */
   djSessionsTotal: number;
   /** Sessioni DJ chiuse con totalDurationMs > 30 min */
   djSessionsLong: number;
   /** Numero di audio_sessions partecipate (joined) come listener — esclude le proprie da DJ */
   listenerSessions: number;
}

export const ZERO_METRICS: UserMetrics = {
   points: 0,
   gamesJoined: 0,
   huntPoints: 0,
   gameWinsTotal: 0,
   quizWins: 0,
   quizCorrectTotal: 0,
   tracksProposed: 0,
   tracksPlayed: 0,
   djSessionsTotal: 0,
   djSessionsLong: 0,
   listenerSessions: 0,
};

export interface GagliardettoDef {
   id: string;
   name: string;
   emoji: string;
   description: string;
   category: GagliardettoCategory;
   phase: GagliardettoPhase;
   /** target value for the progress bar; null when the gagliardetto has no numeric target */
   target: number | null;
   /** read the relevant scalar from the metrics snapshot */
   metric: (m: UserMetrics) => number;
}

export const GAGLIARDETTI: GagliardettoDef[] = [
   // ─── Historical (points-based) ─────────────────────────────────────────
   {
      id: 'villeggiante',
      name: 'Il Villeggiante',
      emoji: '🎒',
      description: 'Almeno 10 punti Altitudine',
      category: 'historical',
      phase: '2',
      target: 10,
      metric: m => m.points,
   },
   {
      id: 'custode_baule',
      name: 'Custode del Baule',
      emoji: '📷',
      description: 'Almeno 50 punti Altitudine',
      category: 'historical',
      phase: '2',
      target: 50,
      metric: m => m.points,
   },
   {
      id: 'sindaco_marzio',
      name: 'Sindaco di Marzio',
      emoji: '🏛️',
      description: 'Almeno 150 punti Altitudine',
      category: 'historical',
      phase: '2',
      target: 150,
      metric: m => m.points,
   },
   {
      id: 'memoria_ferro',
      name: 'La Memoria di Ferro',
      emoji: '🧠',
      description: 'Almeno 500 punti Altitudine',
      category: 'historical',
      phase: '2',
      target: 500,
      metric: m => m.points,
   },

   // ─── Campo dei Giochi ──────────────────────────────────────────────────
   {
      id: 'cacciatore_ricordi',
      name: 'Il Cacciatore di Ricordi',
      emoji: '🏃',
      description: 'Partecipato ad almeno 10 cacce',
      category: 'games',
      phase: '2',
      target: 10,
      metric: m => m.gamesJoined,
   },
   {
      id: 'cacciatore_esperto',
      name: 'Il Cacciatore Esperto',
      emoji: '🎯',
      description: '1000 punti cumulativi da cacce',
      category: 'games',
      phase: '2',
      target: 1000,
      metric: m => m.huntPoints,
   },
   {
      id: 'sindaco_quiz',
      name: 'Il Sindaco del Quiz',
      emoji: '👑',
      description: 'Vinto almeno 5 eventi Quiz',
      category: 'games',
      phase: '2',
      target: 5,
      metric: m => m.quizWins,
   },
   {
      id: 'memoria_quiz',
      name: 'Il Veggente del Bivacco',
      emoji: '🔮',
      description: '100 risposte corrette totali nel Quiz',
      category: 'games',
      phase: '2',
      target: 100,
      metric: m => m.quizCorrectTotal,
   },

   // ─── L'Ainulindalë ─────────────────────────────────────────────────────
   {
      id: 'cantore',
      name: 'Il Cantore',
      emoji: '🎵',
      description: '50 Temi proposti totali',
      category: 'audio',
      phase: '2',
      target: 50,
      metric: m => m.tracksProposed,
   },
   {
      id: 'sub_creatore',
      name: 'Il Sub-Creatore',
      emoji: '🎼',
      description: '25 Temi proposti effettivamente suonati',
      category: 'audio',
      phase: '2',
      target: 25,
      metric: m => m.tracksPlayed,
   },
   {
      id: 'conduttore',
      name: 'Il Conduttore',
      emoji: '🎙️',
      description: 'Aperto 5 Sessioni del Coro come DJ',
      category: 'audio',
      phase: '2',
      target: 5,
      metric: m => m.djSessionsTotal,
   },
   {
      id: 'maestro_coro',
      name: 'Il Maestro del Coro',
      emoji: '🌟',
      description: '20 Sessioni come DJ ≥ 30 minuti',
      category: 'audio',
      phase: '2',
      target: 20,
      metric: m => m.djSessionsLong,
   },
   {
      id: 'voci_iluvatar',
      name: 'Le Voci di Ilúvatar',
      emoji: '👥',
      description: '10 Sessioni partecipate come listener',
      category: 'audio',
      phase: '2',
      target: 10,
      metric: m => m.listenerSessions,
   },
];

/**
 * Stato calcolato per un gagliardetto rispetto a uno snapshot di metriche.
 */
export interface GagliardettoState {
   def: GagliardettoDef;
   current: number;
   earned: boolean;
   /** Float [0, 1] per progress bar UI. Saturato a 1 quando earned. */
   progress: number;
}

export function computeGagliardetti(metrics: UserMetrics): GagliardettoState[] {
   return GAGLIARDETTI.map(def => {
      const current = def.metric(metrics);
      const target = def.target ?? Infinity;
      const earned = current >= target;
      const progress = target > 0 ? Math.min(1, current / target) : 0;
      return { def, current, earned, progress };
   });
}
