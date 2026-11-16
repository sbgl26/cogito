// Service worker : met toute l'app en cache pour qu'elle fonctionne hors connexion.
// À CHAQUE MISE EN LIGNE : changer VERSION, sinon les téléphones gardent l'ancienne.
const VERSION = 'cogito-0.4.0';

const FILES = [
  './',
  'css/app.css',
  'fonts/bricolage.woff2',
  'fonts/patrick-hand.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/app.js',
  'js/core/gen-worker.js',
  'js/core/generate.js',
  'js/core/generators.js',
  'js/core/rng.js',
  'js/core/store.js',
  'js/core/ui.js',
  'js/games/blocs/engine.js',
  'js/games/blocs/game.js',
  'js/games/g2048/engine.js',
  'js/games/g2048/game.js',
  'js/games/match/engine.js',
  'js/games/match/game.js',
  'js/games/mines/game.js',
  'js/games/nonogram/engine.js',
  'js/games/nonogram/game.js',
  'js/games/registry.js',
  'js/games/scierie/game.js',
  'js/games/solitaire/engine.js',
  'js/games/solitaire/game.js',
  'js/games/spider/game.js',
  'js/games/sudoku/engine.js',
  'js/games/sudoku/game.js',
  'js/games/sums/engine.js',
  'js/games/sums/game.js',
  'js/games/sushi/game.js',
  'js/games/tri/engine.js',
  'js/games/tri/game.js',
  'js/idle/hud.js',
  'js/idle/icons.js',
  'js/idle/kit.js',
  'js/screens/game.js',
  'js/screens/hub.js',
  'manifest.webmanifest',
  'vendor/three.module.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache d'abord, réseau en secours. Les navigations retombent sur index.html.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
