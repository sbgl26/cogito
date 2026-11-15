// Les trois pages « carnet » : accueil, statistiques, réglages.

import { h, icon, fmtTime, sheet, toast } from '../core/ui.js';
import { saves, stats, settings, daily } from '../core/store.js';
import { GAMES, dailyPick } from '../games/registry.js';
import { fmt } from '../idle/hud.js';

export const APP_VERSION = '0.3.1';

function tabbar(active) {
  const tab = (name, href, icn, label) => h('a', {
    class: 'tab' + (active === name ? ' is-on' : ''), href,
    'aria-current': active === name ? 'page' : null,
  }, icon(icn), h('span', null, label));
  return h('nav', { class: 'tabbar', 'aria-label': 'Navigation' },
    tab('jeux', '#', 'games', 'Jeux'),
    tab('stats', '#stats', 'stats', 'Statistiques'),
    tab('reglages', '#reglages', 'gear', 'Réglages'));
}

const levelName = (g, key) => (g.levels ? g.levels[key] || '' : '');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// ---------- Accueil ----------

export function home(root) {
  const today = daily.today();
  const pick = dailyPick(today);
  const done = daily.log()[today];
  const running = saves.load('daily');
  const live = running && running.date === today && !running.done;
  const streak = daily.streak();
  const banner = h('a', { class: 'daily' + (done ? ' is-done' : ''), href: '#defi', style: `--c:${pick.def.color}` },
    h('span', { class: 'daily-text' },
      h('span', { class: 'daily-label' }, 'Défi du jour'),
      h('span', { class: 'daily-game' }, pick.def.title),
      h('span', { class: 'daily-note' }, done ? `Réussi en ${fmtTime(done.seconds)}` : live ? `En cours, ${fmtTime(running.elapsed)}` : 'La même grille pour toute la famille')),
    h('span', { class: 'daily-side' },
      h('span', { class: 'daily-streak' }, streak),
      h('span', { class: 'daily-unit' }, streak > 1 ? 'jours de suite' : 'jour de suite')));

  const tile = (g) => {
    const save = saves.load(g.id);
    const playing = save && !save.done && save.v === 2;
    const status = !playing ? g.tagline
      : g.mode === 'idle' ? `${fmt(save.cash)} pièces en caisse`
      : g.mode === 'score' ? `Reprendre, ${plural(save.score || 0, 'point')}`
        : ['Reprendre', levelName(g, save.level).split(',')[0], fmtTime(save.elapsed)].filter(Boolean).join(', ');
    return h('a', { class: 'tile', href: '#' + g.id, style: `--c:${g.color}` },
      h('span', { class: 'tile-art', html: g.motif }),
      h('span', { class: 'tile-body' },
        h('span', { class: 'tile-name' }, g.title),
        h('span', { class: 'tile-status' + (playing ? ' is-live' : '') }, status)));
  };
  const logic = GAMES.filter((g) => g.mode !== 'idle'), tycoons = GAMES.filter((g) => g.mode === 'idle');

  root.append(h('div', { class: 'page page--cahier page--hub' },
    h('header', { class: 'masthead' },
      h('h1', null, h('span', { class: 'marker' }, 'Cogito')),
      h('p', null, `${GAMES.length} jeux, même sans réseau`)),
    banner,
    h('nav', { class: 'tiles', 'aria-label': 'Jeux de logique' }, logic.map(tile)),
    h('h2', { class: 'section-title' }, h('span', { class: 'marker' }, 'Gestion')),
    h('p', { class: 'section-note' }, 'Ça tourne tout seul, même app fermée.'),
    h('nav', { class: 'tiles', 'aria-label': 'Jeux de gestion' }, tycoons.map(tile)),
    tabbar('jeux')));
}

// ---------- Statistiques ----------

export function statsScreen(root) {
  const all = stats.all();
  const any = Object.keys(all).length > 0;
  const head = (...cols) => h('thead', null, h('tr', null, cols.map((c) => h('th', { scope: 'col' }, c))));
  let finished = 0;
  const sections = GAMES.filter((g) => all[g.id] && g.mode !== 'idle').map((g) => {
    const levels = g.levels || { std: 'Partie' };
    const lines = Object.entries(levels).map(([key, label]) => {
      const s = stats.of(g.id, key);
      finished += s.won;
      const short = String(label).split(',')[0];
      return g.mode === 'score'
        ? h('tr', null, h('th', { scope: 'row' }, short), h('td', null, s.played), h('td', null, s.best ?? '–'), h('td', null, s.won ? Math.round(s.total / s.won) : '–'))
        : h('tr', null, h('th', { scope: 'row' }, short), h('td', null, s.played), h('td', null, s.won),
          h('td', null, s.best != null ? fmtTime(s.best) : '–'), h('td', null, s.won ? fmtTime(s.total / s.won) : '–'));
    });
    return h('section', { class: 'stat-block', style: `--c:${g.color}` },
      h('h2', null, h('span', { class: 'marker' }, g.title)),
      h('table', { class: 'stat-table' },
        g.mode === 'score' ? head('', 'Parties', 'Record', 'Moyenne') : head('Niveau', 'Jouées', 'Finies', 'Record', 'Moyenne'),
        h('tbody', null, lines)));
  });
  root.append(h('div', { class: 'page page--cahier page--hub' },
    h('header', { class: 'masthead masthead--small' }, h('h1', null, h('span', { class: 'marker' }, 'Statistiques'))),
    any
      ? h('p', { class: 'summary' }, `${plural(finished, 'grille')} terminée${finished > 1 ? 's' : ''}, ${plural(Object.keys(daily.log()).length, 'défi')} du jour réussi${Object.keys(daily.log()).length > 1 ? 's' : ''}.`)
      : h('p', { class: 'empty' }, 'Aucune partie pour l’instant. Terminez une grille pour voir vos temps ici.'),
    sections,
    any && h('button', {
      type: 'button', class: 'linkbtn linkbtn--danger',
      onclick: () => sheet({
        title: 'Effacer les statistiques ?',
        content: h('p', { class: 'sheet-note' }, 'Les records et les compteurs de tous les jeux seront remis à zéro. Les parties en cours sont conservées.'),
        actions: [
          { label: 'Effacer les statistiques', kind: 'danger', onClick: () => { stats.reset(); toast('Statistiques effacées'); root.replaceChildren(); statsScreen(root); } },
          { label: 'Annuler', kind: 'quiet' },
        ],
      }),
    }, 'Effacer les statistiques'),
    tabbar('stats')));
}

// ---------- Réglages ----------

export function settingsScreen(root) {
  const toggle = (key, label, note) => {
    const input = h('input', { type: 'checkbox', class: 'switch', id: 'opt-' + key, onchange: (e) => settings.set(key, e.target.checked) });
    input.checked = !!settings.get(key);
    return h('label', { class: 'option', for: 'opt-' + key },
      h('span', { class: 'option-text' }, h('span', { class: 'option-name' }, label), note && h('span', { class: 'option-note' }, note)),
      input);
  };
  const themes = [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']];
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Thème' }, themes.map(([value, label]) => h('button', {
    type: 'button', class: 'seg-btn' + (settings.get('theme') === value ? ' is-on' : ''),
    'aria-pressed': String(settings.get('theme') === value),
    onclick: (e) => {
      settings.set('theme', value);
      seg.querySelectorAll('.seg-btn').forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); });
      e.currentTarget.classList.add('is-on');
      e.currentTarget.setAttribute('aria-pressed', 'true');
    },
  }, label)));

  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;

  root.append(h('div', { class: 'page page--cahier page--hub' },
    h('header', { class: 'masthead masthead--small' }, h('h1', null, h('span', { class: 'marker' }, 'Réglages'))),
    h('section', { class: 'options' },
      h('div', { class: 'option' }, h('span', { class: 'option-text' }, h('span', { class: 'option-name' }, 'Thème')), seg),
      toggle('sound', 'Sons', 'Pose, erreur, victoire'),
      'vibrate' in navigator && toggle('haptics', 'Vibrations'),
      toggle('hand', 'Chiffres manuscrits', 'Vos chiffres au stylo bleu, ceux de la grille imprimés'),
      toggle('checkErrors', 'Signaler les erreurs', 'Une saisie fausse s’affiche en rouge tout de suite'),
      toggle('timer', 'Afficher le chronomètre'),
      toggle('autoNotes', 'Nettoyer les notes', 'Sudoku : retire les candidats devenus impossibles'),
      toggle('autoCross', 'Finir les lignes', 'Nonogram et Sommes : marque le reste d’une ligne terminée')),
    !standalone && h('p', { class: 'install' },
      'Pour installer l’app sur iPhone : ouvrez cette page dans Safari, touchez Partager, puis « Sur l’écran d’accueil ». Elle fonctionne ensuite sans réseau.'),
    h('p', { class: 'version' }, 'Cogito ' + APP_VERSION),
    tabbar('reglages')));
}
