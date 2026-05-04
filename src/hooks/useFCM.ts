import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook FCM Web Push per le notifiche di kickoff/lobby.
 *
 * Tre stati esposti:
 *  - `supported: boolean | null` — null durante check (async), poi true/false.
 *    `isSupported()` di firebase/messaging valida il browser (Service
 *    Worker, PushManager, Notification, IndexedDB). Su iOS Safari
 *    funziona dalla 16.4+ in PWA installata.
 *  - `permission: NotificationPermission` — granted/denied/default.
 *  - `enabled: boolean` — `supported && permission === 'granted' && tokenSaved`.
 *
 * Tre azioni:
 *  - `enable()` — chiede permesso (se default), ottiene il token, lo
 *    aggiunge a `users/{uid}.fcmTokens[]`. Idempotente.
 *  - `disable()` — rimuove i token correnti dell'utente da Firestore
 *    (best-effort: il browser locale può tenere il token registrato,
 *    ma senza il doc Firestore la CF notifyKickoff non lo trova).
 *  - `refresh()` — re-fetch del token (utile se ruota dopo lungo periodo).
 *
 * Tutti i path catch-and-warn per non rompere la UI in caso di
 * private mode, browser senza FCM, VAPID key non configurata, ecc.
 */

// VAPID public key for FCM Web Push. Generated in Firebase Console →
// Project Settings → Cloud Messaging → Web Push certificates. This is a
// PUBLIC key (it gets served to every browser inside the bundle anyway —
// the security model relies on the corresponding private key staying on
// FCM's servers, not on this constant being secret). Hardcoding keeps
// the build deterministic; previous attempts to inject via
// import.meta.env from a GitHub Secret produced byte-identical bundles
// (the secret value carried a stray newline that broke the .env parse).
const VAPID_KEY = 'BHyT0BSVgOAC2Fk1OrYr-lCBtLOr2hO7cH-3gR4vlB0-JJ7rwOnFJkWNt1RrkFpVP_L_BRlmXhOKugTEHm80Mjs';
const SW_PATH = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;

export interface FCMState {
   supported: boolean | null;
   permission: NotificationPermission;
   enabled: boolean;
   token: string | null;
   error: string | null;
   busy: boolean;
   enable: () => Promise<void>;
   disable: () => Promise<void>;
   refresh: () => Promise<void>;
}

export function useFCM(): FCMState {
   const { user } = useAuth();
   const [supported, setSupported] = useState<boolean | null>(null);
   const [permission, setPermission] = useState<NotificationPermission>(
      typeof Notification !== 'undefined' ? Notification.permission : 'default'
   );
   const [token, setToken] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   useEffect(() => {
      let cancelled = false;
      isSupported()
         .then(ok => { if (!cancelled) setSupported(ok); })
         .catch(() => { if (!cancelled) setSupported(false); });
      return () => { cancelled = true; };
   }, []);

   const getMessagingInstance = useCallback((): Messaging | null => {
      try {
         return getMessaging();
      } catch (e) {
         console.warn('FCM getMessaging failed', e);
         return null;
      }
   }, []);

   // Foreground message handler. When the PWA is in front, the browser
   // doesn't surface the notification automatically — we need to show
   // a toast or rely on the OS notification fallback.
   useEffect(() => {
      if (supported !== true) return;
      const messaging = getMessagingInstance();
      if (!messaging) return;
      const unsub = onMessage(messaging, (payload) => {
         // Native Notification API as a foreground fallback. The browser
         // already shows the OS notification only when the PWA is in
         // background; in foreground we re-render via the notification
         // API for parity. Best-effort.
         if (Notification.permission === 'granted' && payload.notification) {
            try {
               new Notification(payload.notification.title || 'Marzio1777', {
                  body: payload.notification.body || '',
                  icon: `${import.meta.env.BASE_URL}icon.svg`,
                  data: payload.data,
               });
            } catch { /* ignore */ }
         }
      });
      return () => unsub();
   }, [supported, getMessagingInstance]);

   const enable = useCallback(async () => {
      if (busy || !user) return;
      if (!VAPID_KEY) {
         setError('VAPID key non configurata: impostare VITE_FIREBASE_VAPID_KEY in .env.local.');
         return;
      }
      setBusy(true);
      setError(null);
      try {
         if (supported === false) throw new Error('Notifiche non supportate su questo browser/dispositivo.');
         if (typeof Notification === 'undefined') throw new Error('Notifiche non disponibili.');

         let p = Notification.permission;
         if (p === 'default') {
            p = await Notification.requestPermission();
            setPermission(p);
         }
         if (p !== 'granted') throw new Error('Permesso notifiche negato.');

         // Register the dedicated FCM SW manually so we control the scope.
         // (firebase/messaging auto-registers if we don't, but auto-
         // registration uses scope '/' which conflicts with the
         // BASE_URL-scoped Vite-PWA service worker on GitHub Pages.)
         const reg = await navigator.serviceWorker.register(SW_PATH);
         const messaging = getMessagingInstance();
         if (!messaging) throw new Error('FCM non inizializzabile.');

         const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
         if (!t) throw new Error('Impossibile ottenere il token FCM.');
         setToken(t);

         // Persist the token on the user doc. arrayUnion is idempotent.
         await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(t) });
      } catch (e: any) {
         console.warn('FCM enable failed', e);
         setError(e?.message || 'Errore nell\'attivazione delle notifiche.');
      } finally {
         setBusy(false);
      }
   }, [busy, user, supported, getMessagingInstance]);

   const disable = useCallback(async () => {
      if (busy || !user) return;
      setBusy(true);
      setError(null);
      try {
         if (token) {
            await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(token) });
         }
         setToken(null);
      } catch (e: any) {
         console.warn('FCM disable failed', e);
         setError(e?.message || 'Errore nella disattivazione.');
      } finally {
         setBusy(false);
      }
   }, [busy, user, token]);

   const refresh = useCallback(async () => {
      if (!user || supported !== true || !VAPID_KEY) return;
      try {
         const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
         if (!reg) return;
         const messaging = getMessagingInstance();
         if (!messaging) return;
         const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
         if (t && t !== token) {
            setToken(t);
            await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(t) });
         }
      } catch (e) {
         console.warn('FCM refresh failed', e);
      }
   }, [user, supported, token, getMessagingInstance]);

   const enabled = supported === true && permission === 'granted' && token !== null;

   return { supported, permission, enabled, token, error, busy, enable, disable, refresh };
}
