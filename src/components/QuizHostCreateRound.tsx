import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Search, Image as ImageIcon, Sparkles, ChevronRight, ChevronLeft, Calendar, MapPin, MessageCircle, Clock, User, CheckCircle2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QuestionType, isAutoGenerationAvailable, questionGenerators } from '../utils/quizGenerators';
import { Post } from '../types';

interface QuizDraft {
  sourcePostId: string | null;
  questionType: QuestionType | null;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3 | null;
  answerTimeSeconds: number;
}

const DEFAULT_DRAFT: QuizDraft = {
  sourcePostId: null,
  questionType: null,
  questionText: '',
  options: ['', '', '', ''],
  correctIndex: null,
  answerTimeSeconds: 20
};

interface Props {
  eventId: string;
  hostId: string;
  roundId: string;
  roundNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuizHostCreateRound({ eventId, hostId, roundId, roundNumber, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<QuizDraft>(DEFAULT_DRAFT);
  
  // Data step 1
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const shouldReduceMotion = useReducedMotion();

  // Load draft & posts
  useEffect(() => {
    const saved = localStorage.getItem(`marzio1777:quiz-draft:${eventId}`);
    if (saved) {
      try {
        setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(saved) });
      } catch(e) {}
    }

    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    });
    return () => unsub();
  }, [eventId]);

  // Save to draft whenever it changes
  useEffect(() => {
    localStorage.setItem(`marzio1777:quiz-draft:${eventId}`, JSON.stringify(draft));
  }, [draft, eventId]);

  const handleUpdateDraft = (updates: Partial<QuizDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const filteredPosts = posts.filter(p => {
    const q = searchQuery.toLowerCase();
    return (p.caption?.toLowerCase().includes(q)) || (p.authorName?.toLowerCase().includes(q));
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const selectedPost = posts.find(p => p.id === draft.sourcePostId);

  const canAutoGenerate = !!selectedPost && !!draft.questionType && isAutoGenerationAvailable(draft.questionType);

  const handleAutoGenerate = () => {
    if (!selectedPost || !draft.questionType) return;
    const generator = questionGenerators[draft.questionType];
    const generated = generator(selectedPost, posts);
    if (!generated) {
      alert(
        'Generatore non disponibile per questo post (pool insufficiente o dati mancanti). ' +
        'Prova con un altro post o compila manualmente.'
      );
      return;
    }
    handleUpdateDraft({
      questionText: generated.questionText,
      options: generated.options,
      correctIndex: generated.correctIndex,
    });
  };

  const handleLaunch = async () => {
    if (draft.correctIndex === null) return;
    
    // Create or update existing round document
    const roundRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}`);
    const correctRef = doc(db, `game_events/${eventId}/quizRounds/${roundId}/secret/correctness`);
    const eventRef = doc(db, `game_events/${eventId}`);

    await setDoc(roundRef, {
      id: roundId,
      roundNumber,
      status: 'active',
      type: draft.questionType || 'guess_who',
      sourcePostId: draft.sourcePostId,
      questionText: draft.questionText || 'Guarda la foto e indovina:',
      mediaUrl: selectedPost?.imageUrl || '',
      questionOptions: draft.options,
      startedAt: serverTimestamp(),
      endsAt: new Date(Date.now() + draft.answerTimeSeconds * 1000), // Note: serverTimestamp might be better but date is roughly ok for fallback
      hostId
    });

    await setDoc(correctRef, {
      correctIndex: draft.correctIndex
    });

    await updateDoc(eventRef, {
      currentRoundId: roundId,
      'photoQuizConfig.answerTimeSeconds': draft.answerTimeSeconds
    });

    // clear draft
    localStorage.removeItem(`marzio1777:quiz-draft:${eventId}`);
    onSuccess();
  };

  // Animation variants
  const variants = {
    initial: { opacity: 0, x: shouldReduceMotion ? 0 : 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: shouldReduceMotion ? 0 : -20 }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col font-sans">
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
        <button 
          onClick={onClose}
          className="min-h-[56px] min-w-[56px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          aria-label="Cancella round e torna"
        >
          <X className="text-slate-500 dark:text-slate-300" size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-lg dark:text-white">Crea Round {roundNumber}</h2>
          <div className="flex gap-1 mt-1">
            {[1,2,3,4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-[#f56a23]' : 'bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {step === 1 && (
            <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit" className="p-4 flex flex-col min-h-full">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Seleziona una foto sorgente</h3>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f56a23]" 
                  placeholder="Cerca autore, didascalia..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {filteredPosts.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { handleUpdateDraft({ sourcePostId: p.id }); nextStep(); }}
                    className={`relative rounded-xl overflow-hidden aspect-square border-4 text-left transition-all min-h-[56px] ${draft.sourcePostId === p.id ? 'border-[#f56a23]' : 'border-transparent'}`}
                    aria-label={`Seleziona foto di ${p.authorName || 'Anonimo'}`}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                         <ImageIcon className="text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                       <p className="text-white text-xs font-bold truncate">{p.authorName || 'Anonimo'}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-4 text-center">
                <button 
                  onClick={() => { handleUpdateDraft({ sourcePostId: null }); nextStep(); }}
                  className="px-6 py-4 rounded-xl text-slate-500 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors min-h-[56px]"
                >
                  Salta e crea senza foto (testo libero)
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit" className="p-4 flex flex-col min-h-full">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Che tipo di domanda?</h3>
              
              <div className="space-y-3">
                {[
                  { id: 'guess_who', emoji: '🧑', icon: User, title: 'Chi è?', desc: 'Riconosci il soggetto' },
                  { id: 'guess_year', emoji: '📅', icon: Calendar, title: 'Quando?', desc: 'Indovina l\'anno o il decennio' },
                  { id: 'guess_place', emoji: '📍', icon: MapPin, title: 'Dove?', desc: 'Identifica il luogo' },
                  { id: 'guess_caption', emoji: '💬', icon: MessageCircle, title: 'Cosa?', desc: 'Trova la didascalia originale' },
                  { id: 'chronology', emoji: '🕰️', icon: Clock, title: 'In ordine', desc: 'Cronologia (richiede 4 post)' },
                ].map(type => {
                  const isAuto = isAutoGenerationAvailable(type.id as QuestionType);
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        handleUpdateDraft({ questionType: type.id as QuestionType });
                        nextStep();
                      }}
                      className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 text-left border-2 border-transparent focus:border-[#f56a23] hover:border-slate-200 dark:hover:border-slate-600 transition-all min-h-[56px]"
                      aria-label={`Tipo di domanda: ${type.title}`}
                    >
                      <div className="text-3xl">{type.emoji}</div>
                      <div className="flex-1">
                        <div className="font-bold dark:text-white">{type.title}</div>
                        <div className="text-sm text-slate-500">{type.desc}</div>
                      </div>
                      <div>
                        {isAuto ? (
                          <span className="text-xs font-bold bg-[#2D5A27] text-white px-2 py-1 rounded-full flex items-center gap-1">
                            <Sparkles size={12} /> Auto
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-full">
                            Manuale
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto pt-6 flex justify-between">
                <button onClick={prevStep} className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold dark:text-white min-h-[56px]">
                  <ChevronLeft size={20} /> Indietro
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit" className="p-4 flex flex-col min-h-full">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Compila la domanda</h3>
              
              {selectedPost && (
                <div className="flex bg-white dark:bg-slate-800 p-3 rounded-xl mb-6 shadow-sm overflow-hidden">
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-200">
                    <img src={selectedPost.imageUrl} className="w-full h-full object-cover" alt="Preview sorgente" />
                  </div>
                  <div className="ml-3 flex flex-col justify-center overflow-hidden">
                    <p className="text-sm font-bold truncate dark:text-white">{selectedPost.authorName}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedPost.caption}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">Domanda</label>
                  <textarea 
                    value={draft.questionText}
                    onChange={e => handleUpdateDraft({ questionText: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f56a23] resize-none"
                    rows={2}
                    placeholder="Es. Chi è la persona in questa foto?"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-500">Opzioni (seleziona la corretta)</label>
                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      disabled={!canAutoGenerate}
                      className={`text-xs font-bold flex items-center gap-1 transition-colors min-h-[44px] px-2 rounded-md ${
                        canAutoGenerate
                          ? 'text-[#2D5A27] hover:bg-[#2D5A27]/10'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                      title={
                        !selectedPost
                          ? 'Seleziona prima una foto sorgente'
                          : !draft.questionType
                          ? 'Seleziona prima un tipo di domanda'
                          : !isAutoGenerationAvailable(draft.questionType)
                          ? 'Tipo di domanda solo manuale (richiede reverse-geocoding)'
                          : 'Compila domanda + opzioni dal post sorgente e dal pool'
                      }
                    >
                      <Sparkles size={12} /> Genera distrattori
                    </button>
                  </div>
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateDraft({ correctIndex: i as 0|1|2|3 })}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] ${draft.correctIndex === i ? 'border-[#2D5A27] bg-[#2D5A27] text-white' : 'border-slate-300 dark:border-slate-600'}`}
                          aria-label={`Marca opzione ${i+1} come corretta`}
                        >
                          {draft.correctIndex === i && <CheckCircle2 size={16} />}
                        </button>
                        <input
                          type="text"
                          value={draft.options[i]}
                          onChange={e => {
                            const newOpts = [...draft.options] as [string, string, string, string];
                            newOpts[i] = e.target.value;
                            handleUpdateDraft({ options: newOpts });
                          }}
                          placeholder={`Opzione ${i + 1}`}
                          className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f56a23]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div aria-live="polite" className="mt-4">
                 {(!draft.questionText || draft.options.some(o => !o) || draft.correctIndex === null) && (
                    <p className="text-sm text-red-500 font-bold">Compila tutti i campi e seleziona una risposta corretta.</p>
                 )}
              </div>

              <div className="mt-auto pt-6 flex justify-between gap-4">
                <button onClick={prevStep} className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold dark:text-white min-h-[56px] shrink-0">
                  <ChevronLeft size={20} /> Indietro
                </button>
                <button 
                  onClick={nextStep} 
                  disabled={!draft.questionText || draft.options.some(o => !o) || draft.correctIndex === null}
                  className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold py-3 min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Avanti
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit" className="p-4 flex flex-col min-h-full">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Conferma e Lancia</h3>
              
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-6 border-2 border-slate-100 dark:border-slate-700">
                <p className="font-bold text-lg mb-4 dark:text-white">{draft.questionText}</p>
                <div className="space-y-2">
                  {draft.options.map((opt, i) => (
                    <div key={i} className={`p-3 border-2 rounded-xl text-sm font-bold ${draft.correctIndex === i ? 'border-[#2D5A27] bg-[#2D5A27]/10 text-[#2D5A27] dark:text-[#5ceb51]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {opt} {draft.correctIndex === i && '✓'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-500 mb-2">Tempo a disposizione: {draft.answerTimeSeconds} secondi</label>
                <input 
                  type="range" 
                  min="5" max="60" step="5"
                  value={draft.answerTimeSeconds}
                  onChange={e => handleUpdateDraft({ answerTimeSeconds: Number(e.target.value) })}
                  className="w-full accent-[#f56a23]"
                />
              </div>

              <div className="mt-auto pt-6 flex justify-between gap-4">
                <button onClick={prevStep} className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold dark:text-white min-h-[56px] shrink-0">
                  <ChevronLeft size={20} /> Indietro
                </button>
                <button 
                  onClick={handleLaunch} 
                  className="flex-1 bg-[#f56a23] text-white rounded-xl font-bold text-lg py-3 flex items-center justify-center gap-2 min-h-[56px] shadow-lg shadow-[#f56a23]/30"
                >
                  🚀 Lancia Round!
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
