import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Code, FileText, Shield, Gamepad2, ClipboardList, Loader2, AlertTriangle } from 'lucide-react';

type Tab = 'readme' | 'tech' | 'security' | 'gaming' | 'stato';
type Lang = 'it' | 'en';

// STATO_PROGETTO.md is authored only in Italian (project working language).
// English readers see an inline note + the IT body so the content is at
// least scannable rather than being hidden behind an empty tab.
const STATO_EN_NOTICE = '> _The project status log is maintained in Italian only. Original content follows below._\n\n';

const FILE_MAP: Record<Tab, Record<Lang, string>> = {
  readme:   { it: 'README_IT.md',         en: 'README_EN.md' },
  tech:     { it: 'TECHNICAL_DOCS_IT.md', en: 'TECHNICAL_DOCS_EN.md' },
  security: { it: 'security_spec_IT.md',  en: 'security_spec_EN.md' },
  gaming:   { it: 'GAMING_SYSTEM_IT.md',  en: 'GAMING_SYSTEM_EN.md' },
  stato:    { it: 'STATO_PROGETTO.md',    en: 'STATO_PROGETTO.md' },
};

export default function Istruzioni() {
  const [activeTab, setActiveTab] = useState<Tab>('readme');
  const [lang, setLang] = useState<Lang>('it');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // In-memory cache so re-visiting a tab/lang is instant and avoids the SW round-trip.
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const file = FILE_MAP[activeTab][lang];
    const cacheKey = `${activeTab}:${lang}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached !== undefined) {
      setContent(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${import.meta.env.BASE_URL}docs/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const finalText = activeTab === 'stato' && lang === 'en' ? STATO_EN_NOTICE + text : text;
        cacheRef.current.set(cacheKey, finalText);
        setContent(finalText);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'errore sconosciuto');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, lang]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 p-4 md:p-0 pb-20 md:pb-0">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-white/80 dark:bg-[#151e18]/80 backdrop-blur-md z-10 py-4 border-b border-slate-100 dark:border-[#24352b]">
         <div className="flex items-center gap-4">
            <div>
               <h2 className="font-serif text-3xl font-bold text-[#1a2e16] dark:text-[#e2e8f0] flex items-center gap-3">
                  <BookOpen className="text-red-500" size={28}/> {lang === 'it' ? 'Documentazione' : 'Documentation'}
               </h2>
               <p className="text-sm font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                 {lang === 'it' ? 'Conoscenza e Manualistica' : 'Knowledge & Manuals'}
               </p>
            </div>
         </div>

         <div className="flex flex-col gap-3 md:items-end">
            {/* Language Switch */}
            <div className="flex bg-slate-100 dark:bg-[#24352b] rounded-full p-1 self-start md:self-auto shadow-inner border border-slate-200 dark:border-slate-700">
               <button
                  onClick={() => setLang('it')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'it' ? 'bg-white dark:bg-[#151e18] text-[#2D5A27] dark:text-[#42a83a] shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
               >
                  <span>🇮🇹</span> IT
               </button>
               <button
                  onClick={() => setLang('en')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-white dark:bg-[#151e18] text-[#2D5A27] dark:text-[#42a83a] shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
               >
                  <span>🇬🇧</span> EN
               </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
               <button
                  onClick={() => setActiveTab('readme')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'readme' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <FileText size={16} /> Readme
               </button>
               <button
                  onClick={() => setActiveTab('tech')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'tech' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <Code size={16} /> Tech Specs
               </button>
               <button
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'security' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <Shield size={16} /> Security
               </button>
               <button
                  onClick={() => setActiveTab('gaming')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'gaming' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <Gamepad2 size={16} /> {lang === 'it' ? 'Sistema Giochi' : 'Gaming System'}
               </button>
               <button
                  onClick={() => setActiveTab('stato')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'stato' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <ClipboardList size={16} /> {lang === 'it' ? 'Stato Progetto' : 'Project Status'}
               </button>
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-2xl p-6 md:p-10 shadow-sm prose dark:prose-invert prose-emerald max-w-none min-h-[240px]">
         {loading && (
           <div className="not-prose flex items-center justify-center gap-3 py-10 text-slate-500 dark:text-slate-400">
              <Loader2 className="animate-spin text-[#2D5A27]" size={20} />
              <span className="text-sm font-medium">{lang === 'it' ? 'Carico il documento…' : 'Loading document…'}</span>
           </div>
         )}
         {error && !loading && (
           <div className="not-prose flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div>
                 <p className="font-semibold">
                    {lang === 'it' ? 'Non sono riuscita a caricare il documento.' : 'Failed to load the document.'}
                 </p>
                 <p className="text-sm opacity-80 mt-1 font-mono">{error}</p>
                 <p className="text-xs opacity-70 mt-2">
                    {lang === 'it'
                      ? 'Se sei offline, riapri questa pagina dopo aver navigato online almeno una volta — il service worker la metterà in cache.'
                      : 'If you are offline, reopen this page after browsing online at least once — the service worker will cache it.'}
                 </p>
              </div>
           </div>
         )}
         {!loading && !error && <ReactMarkdown>{content}</ReactMarkdown>}
      </div>

    </div>
  );
}
