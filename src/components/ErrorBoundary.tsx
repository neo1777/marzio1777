import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Top-level safety net. Without this, any render-time throw inside a route
// chunk (e.g. an undefined deref in an HUD, a malformed audio track passed
// to the player) propagates up to the React root and unmounts the entire
// tree — the user sees a black screen and the app appears to "disappear".
// We catch here, surface a recoverable error UI, and keep the BrowserRouter
// alive so the user can navigate elsewhere or reload.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = `${import.meta.env.BASE_URL}dashboard/piazza`;
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isDev = import.meta.env.DEV;
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0] dark:bg-[#0d1310] text-[#1a2e16] dark:text-[#e2e8f0] p-6">
        <div className="max-w-lg w-full bg-white dark:bg-[#151e18] border border-slate-200 dark:border-[#24352b] rounded-2xl shadow-xl p-8">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-2xl flex items-center justify-center mb-5">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-2xl font-serif font-bold mb-2">Qualcosa è andato storto</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            Questa schermata ha incontrato un errore inatteso. Puoi tornare alla Piazza
            o ricaricare l'app — i tuoi dati sono al sicuro su Firebase.
          </p>

          {isDev && (
            <pre className="text-[11px] font-mono bg-slate-100 dark:bg-[#0d1310] border border-slate-200 dark:border-[#24352b] rounded-lg p-3 mb-6 overflow-auto max-h-48 whitespace-pre-wrap break-words text-red-600 dark:text-red-400">
              {this.state.error.message}
              {this.state.error.stack && '\n\n' + this.state.error.stack}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={this.handleHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-md shadow-[#2D5A27]/20 transition-colors"
            >
              <Home size={16} />
              Torna alla Piazza
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#24352b] dark:hover:bg-[#2d4233] text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors"
            >
              <RefreshCw size={16} />
              Ricarica l'app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
