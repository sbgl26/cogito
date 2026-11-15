// Point d'entrée : routeur par ancre (#sudoku, #defi, #stats…), thème, service worker.

import { applyAppearance, daily } from './core/store.js';
import { closeAllSheets } from './core/ui.js';
import { byId, dailyPick, DEFAULT_COLOR } from './games/registry.js';
import { mountGame } from './screens/game.js';
import { home, statsScreen, settingsScreen } from './screens/hub.js';

const app = document.getElementById('app');
let current = null;

function render() {
  const name = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (current && current.destroy) current.destroy();
  current = null;
  closeAllSheets();
  app.replaceChildren();
  window.scrollTo(0, 0);

  const pick = name === 'defi' ? dailyPick(daily.today()) : null;
  const def = pick ? pick.def : byId(name);
  // Chaque jeu teinte l'interface de sa couleur de surligneur.
  document.body.style.setProperty('--tint', def ? def.color : DEFAULT_COLOR);
  if (def) current = mountGame(app, def, pick ? { daily: pick } : {});
  else if (name === 'stats') statsScreen(app);
  else if (name === 'reglages') settingsScreen(app);
  else home(app);
  document.title = def ? def.title + ' – Cogito' : 'Cogito';
}

applyAppearance();
if (window.matchMedia) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
}
window.addEventListener('hashchange', render);
render();

// Hors-ligne : le service worker met toute l'app en cache à la première visite.
// Quand une nouvelle version prend la main, on recharge pour l'afficher tout de suite.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload();
  });
  window.addEventListener('load', () => {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* contexte sans service worker */ }
  });
}
