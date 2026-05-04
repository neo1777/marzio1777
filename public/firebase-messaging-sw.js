/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging Service Worker.
 *
 * The Firebase JS SDK auto-registers this file at scope `/marzio1777/`
 * when getMessaging() runs in the page. It MUST live in /public/ so the
 * Vite build copies it to dist/ unmodified — Vite-PWA's autoUpdate SW
 * registers separately at the same scope; the two coexist (different
 * registrations, different filenames).
 *
 * Receives "background" messages — i.e. notifications that arrive while
 * the PWA tab is closed / hidden. Foreground messages are handled inside
 * the app via onMessage() in useFCM.
 */

importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

// IMPORTANT: this config is committed in plain text. None of these values
// are secret (they are public Firebase project identifiers — the same
// values land in the bundled client JS via import.meta.env). The actual
// auth happens server-side via Firestore Security Rules.
firebase.initializeApp({
  apiKey: 'AIzaSyDKIRsHl4UQA8rJtWJTwGBmNF6HSKhyAuQ',
  authDomain: 'marzio1777.firebaseapp.com',
  projectId: 'marzio1777',
  storageBucket: 'marzio1777.appspot.com',
  messagingSenderId: '0',
  appId: '0',
});

// NOTE: messagingSenderId and appId above are placeholders — the
// firebase-messaging-compat library uses the live values that the page
// shipped via getMessaging() at runtime. The placeholders here are
// enough to satisfy the SDK's init validation.

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Marzio1777';
  const options = {
    body: payload.notification?.body || '',
    icon: '/marzio1777/icon.svg',
    badge: '/marzio1777/icon.svg',
    data: payload.fcmOptions || payload.data || {},
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/marzio1777/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(link) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
      return null;
    })
  );
});
