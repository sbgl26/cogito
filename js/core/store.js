// Stockage local : réglages, statistiques, parties en cours.
// Tout passe par localStorage, avec repli en mémoire si le navigateur le refuse.

const NS = 'cogito:';
const mem = new Map();

function read(key, fallback) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw != null) {
      const value = JSON.parse(raw);
      mem.set(key, value);
      return value;
    }
  } catch { /* stockage indisponible ou donnée illisible */ }
  return fallback;
}

function write(key, value) {
  mem.set(key, value);
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* repli mémoire */ }
}

function drop(key) {
  mem.delete(key);
  try { localStorage.removeItem(NS + key); } catch { /* rien à faire */ }
}

// ---------- Réglages ----------

const DEFAULTS = {
  theme: 'auto',        // auto | clair | sombre
  hand: true,           // chiffres saisis en écriture manuscrite
  checkErrors: true,    // signaler les erreurs immédiatement
  timer: true,          // afficher le chronomètre
  autoNotes: true,      // Sudoku : retirer les notes devenues impossibles
  autoCross: true,      // Nonogram : barrer le reste d'une ligne terminée
  haptics: true,        // vibrations (Android ; iOS ne les expose pas au web)
  sound: true,          // petits sons (pose, erreur, victoire)
};

export const settings = {
  get(key) { return { ...DEFAULTS, ...read('settings', {}) }[key]; },
  set(key, value) {
    write('settings', { ...read('settings', {}), [key]: value });
    applyAppearance();
  },
};

export function applyAppearance() {
  const root = document.documentElement;
  const theme = settings.get('theme');
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  root.dataset.hand = settings.get('hand') ? '1' : '0';
  const dark = theme === 'sombre' ||
    (theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#121829' : '#F6F7FB';
}

// ---------- Statistiques ----------
// stats[jeu][niveau] = { played, won, best, total } (temps en secondes)

export const stats = {
  all() { return read('stats', {}); },
  of(game, level) {
    return (this.all()[game] || {})[level] || { played: 0, won: 0, best: null, total: 0 };
  },
  start(game, level) {
    const all = this.all();
    const s = { ...this.of(game, level) };
    s.played++;
    write('stats', { ...all, [game]: { ...(all[game] || {}), [level]: s } });
  },
  win(game, level, seconds) {
    const all = this.all();
    const s = { ...this.of(game, level) };
    const record = s.best == null || seconds < s.best;
    s.won++;
    s.total += seconds;
    if (record) s.best = seconds;
    write('stats', { ...all, [game]: { ...(all[game] || {}), [level]: s } });
    return { record, best: s.best };
  },
  // Jeux à score (Blocs) : best = meilleur score, total = somme des scores.
  score(game, level, points) {
    const all = this.all();
    const s = { ...this.of(game, level) };
    const record = points > (s.best || 0);
    s.won++;
    s.total += points;
    if (record) s.best = points;
    write('stats', { ...all, [game]: { ...(all[game] || {}), [level]: s } });
    return { record, best: s.best };
  },
  reset() { drop('stats'); },
};

// ---------- Parties en cours (une par jeu) ----------

export const saves = {
  load(game) { return read('save:' + game, null); },
  store(game, state) { write('save:' + game, state); },
  clear(game) { drop('save:' + game); },
};

// ---------- Défi du jour ----------
// Journal { 'AAAA-MM-JJ': { game, seconds } } des défis réussis.

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const daily = {
  today() { return dayKey(new Date()); },
  log() { return read('daily', {}); },
  mark(date, info) { write('daily', { ...this.log(), [date]: info }); },
  // Nombre de jours consécutifs réussis (la série tient tant que la veille est faite).
  streak() {
    const log = this.log();
    const d = new Date();
    if (!log[dayKey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (log[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
};
