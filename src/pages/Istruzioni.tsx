import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Code, FileText, Shield, Globe, Gamepad2, Mic2 } from 'lucide-react';
import readmeContentIT from '../../README_IT.md?raw';
import readmeContentEN from '../../README_EN.md?raw';
import techDocsContentEN from '../../TECHNICAL_DOCS_EN.md?raw';
import techDocsContentIT from '../../TECHNICAL_DOCS_IT.md?raw';
import securityDocsContentEN from '../../security_spec_EN.md?raw';
import securityDocsContentIT from '../../security_spec_IT.md?raw';
import gamingSystemContentEN from '../../GAMING_SYSTEM_EN.md?raw';
import gamingSystemContentIT from '../../GAMING_SYSTEM_IT.md?raw';

export default function Istruzioni() {
  const [activeTab, setActiveTab] = useState<'readme' | 'tech' | 'security' | 'gaming'>('readme');
  const [lang, setLang] = useState<'it' | 'en'>('it');

  const contentMap = {
     readme: { it: readmeContentIT, en: readmeContentEN },
     tech: { it: techDocsContentIT, en: techDocsContentEN },
     security: { it: securityDocsContentIT, en: securityDocsContentEN },
     gaming: { it: gamingSystemContentIT, en: gamingSystemContentEN }
  };

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
                  onClick={() => setActiveTab('readme')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'game' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <Gamepad2 size={16} /> Game Design
               </button>
               <button 
                  onClick={() => setActiveTab('gaming')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all focus:outline-none ${activeTab === 'gaming' ? 'bg-[#2D5A27] text-white shadow-md' : 'bg-slate-100 dark:bg-[#24352b] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2c4033]'}`}
               >
                  <Mic2 size={16} /> Gaming System
               </button>
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-[#111814] border border-slate-200 dark:border-[#24352b] rounded-2xl p-6 md:p-10 shadow-sm prose dark:prose-invert prose-emerald max-w-none">
         <ReactMarkdown>{contentMap[activeTab][lang]}</ReactMarkdown>
      </div>

    </div>
  );
}
