// Register the offline service worker (./sw.js — strategy documented there).
// Standalone browser/PWA only: the plugin and extension WebViews load this same
// UI but have no network to lose and often no Service Worker API at all, and
// registration must never race the host bridge, so both are excluded up front.
import { log, inEmbeddedHost } from '../ui/ui.js';

export function initOffline() {
  if (!('serviceWorker' in navigator)) return;          // http:, file://, old WebViews
  if (typeof IPlugSendMsg === 'function') return;       // inside the native plugin
  if (inEmbeddedHost()) return;                         // inside a DAW extension WebView
  // After load, so seeding ~20 MB of engine binaries never competes with boot.
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // First install only (an already-controlling worker means this ran
      // before): say so once the seed finishes, since from that moment the
      // app genuinely works with the network gone.
      if (navigator.serviceWorker.controller) return;
      navigator.serviceWorker.ready.then(() => log('offline support ready — this app now works without a network connection'));
    }).catch(() => { /* registration is a progressive enhancement — never fatal */ });
  });
}
