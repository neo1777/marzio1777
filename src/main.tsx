import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Broadcast when a new Service Worker has taken control. The Layout
// component listens to this and shows a manual "Aggiorna" pill for users
// who stay in foreground long enough that the visibility-gated auto-reload
// below never fires. Exported as a named string so the listener side
// doesn't need to magic-string-match.
export const SW_UPDATE_EVENT = 'sw:update-ready';

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // The default browser cadence for SW update checks is too lazy for
      // a "push to main → live in ~50s" deploy. Force a check every 30 min.
      // Frequent enough to catch deploys without spamming the GitHub Pages CDN.
      if (registration) {
        setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
      }
    },
  });

  // Auto-reload policy: silent reload only when the tab is hidden, so we
  // don't yank the floor mid-DJ-session / mid-capture / mid-quiz-round.
  // For users who stay in foreground continuously, the controllerchange
  // event also dispatches `SW_UPDATE_EVENT`, which the Layout uses to
  // show a manual update pill — explicit opt-in, no surprises.
  let updateReady = false;
  const tryAutoReload = () => {
    if (updateReady && document.visibilityState === 'hidden') {
      window.location.reload();
    }
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    updateReady = true;
    window.dispatchEvent(new Event(SW_UPDATE_EVENT));
    tryAutoReload();
  });
  document.addEventListener('visibilitychange', tryAutoReload);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
