/**
 * Terranium Service Worker
 * This file is intentionally minimal. It performs NO CACHING.
 * Its sole purpose is to exist, which makes the web app meet the criteria
 * for being an installable Progressive Web App (PWA).
 */

self.addEventListener('install', (event) => {
  // This event fires when the service worker is first installed.
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
  // This event fires when the service worker becomes active.
  console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
  // This event fires for every network request.
  // We do not intercept the request and simply let the browser
  // handle it as it normally would.
  return;
});
