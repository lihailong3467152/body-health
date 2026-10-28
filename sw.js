const CACHE = 'body-awareness-v3.0.0';
const FILES = ['./', './index.html', './styles.css', './app.js', './config.js', './assets/icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('body-awareness-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(fetch(event.request).then(response => {if(response.ok){const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));} return response;}).catch(() => caches.match(event.request)));});
