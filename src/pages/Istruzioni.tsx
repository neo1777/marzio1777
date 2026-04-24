import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Code, FileText } from 'lucide-react';
import readmeContent from '../../README.md?raw';
import techDocsContent from '../../TECHNICAL_DOCS.md?raw';

export default function Istruzioni() {
  const [activeTab, setActiveTab] = useState<'readme' | 'tech'>('readme');

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 p-4 md:p-0 pb-20 md:pb-0">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-white/80 dark:bg-[#151e18]/80 backdrop-blur-md z-10 py-4 border-b border-slate-100 dark:border-[#24352b]">
         <div>
            <h2 className="font-serif text-3xl font-bold text-[#1a2e16] dark:text-[#e2e8f0] flex items-center gap-3">
               <BookOpen className="text-red-500" size={28}/> Documentazione
            </h2>
            <p className="text-sm font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Conoscenza e Manualistica</p>
         </div>

         <div className="flex gap-2">
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
               <Code size={16} /> Specs Tecniche
            </button>
         </div>
      </div>

      <div className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-2xl p-6 md:p-10 shadow-sm prose dark:prose-invert prose-emerald max-w-none">
        {activeTab === 'readme' ? (
           <ReactMarkdown>{readmeContent}</ReactMarkdown>
        ) : (
           <ReactMarkdown>{techDocsContent}</ReactMarkdown>
        )}
      </div>

    </div>
  );
}
