// Interface « Spider » : on touche une carte, sa suite part vers la meilleure colonne.

import { h, icon, buzz } from '../../core/ui.js';
import { SPIDER_LEVELS, rank, spiderSuit, isRun } from '../solitaire/engine.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
const KEYS = ['stock', 'tableau', 'done8'];
const snap = (s) => JSON.stringify(KEYS.map((k) => s[k]));
const restore = (s, text) => JSON.parse(text).forEach((v, k) => { s[KEYS[k]] = v; });

function init(data) {
  const state = { ...data, moves: 0, history: [] };
  state.initial = snap(state);
  return state;
}

function reset(state) {
  restore(state, state.initial);
  state.moves = 0;
  state.history = [];
}

function mount(host, state, api) {
  const S = state.suits;
  let hinted = -1, lastWidth = 0;
  const table = h('div', { class: 'sol sol--spider', style: '--cols:10' });
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const hintBtn = tool('bulb', 'Indice', () => hint());
  const dealBtn = tool('cards', 'Distribuer', () => dealRow());
  host.append(h('div', { class: 'play' }, h('div', { class: 'stage stage--top' }, table),
    h('div', { class: 'controls' }, h('div', { class: 'tools tools--three' }, undoBtn, hintBtn, dealBtn))));
  const resize = new ResizeObserver(() => { if (table.clientWidth !== lastWidth) render(); });
  resize.observe(table);

  const top = (col) => (col.length ? col[col.length - 1][0] : -1);

  // Meilleure colonne pour une suite commençant par « id » : même couleur d'abord,
  // puis n'importe quelle carte du rang au-dessus, puis une colonne vide.
  function target(id, from, whole) {
    let any = -1, empty = -1;
    for (let t = 0; t < 10; t++) {
      if (t === from) continue;
      const col = state.tableau[t];
      if (!col.length) { if (empty < 0 && !whole) empty = t; continue; }
      if (rank(top(col)) !== rank(id) + 1) continue;
      if (spiderSuit(top(col), S) === spiderSuit(id, S)) return t;
      if (any < 0) any = t;
    }
    return any >= 0 ? any : empty;
  }

  function commit(before, sound = 'place') {
    state.history.push(before);
    if (state.history.length > 60) state.history.shift();
    state.moves++;
    hinted = -1;
    // Une suite complète du roi à l'as, de même couleur, quitte la table.
    for (const col of state.tableau) {
      if (col.length >= 13 && rank(top(col)) === 0 && rank(col[col.length - 13][0]) === 12 && isRun(col, col.length - 13, S)) {
        col.splice(col.length - 13);
        state.done8++;
        sound = 'clear';
      }
      if (col.length) col[col.length - 1][1] = 1;
    }
    buzz(7, sound);
    api.persist();
    render();
    if (state.done8 === 8) api.win(table);
  }

  function play(c, i) {
    if (state.done) return;
    const col = state.tableau[c];
    if (!isRun(col, i, S)) { nope(); return; }
    const t = target(col[i][0], c, i === 0);
    if (t < 0) { nope(); return; }
    const before = snap(state);
    state.tableau[t].push(...col.splice(i));
    commit(before);
  }

  function dealRow() {
    if (state.done || !state.stock.length) return;
    const before = snap(state);
    for (const col of state.tableau) if (state.stock.length) col.push([state.stock.pop(), 1]);
    commit(before, 'tap');
  }

  function nope() {
    buzz([20, 30, 20], 'error');
    table.classList.remove('nope');
    void table.offsetWidth;
    table.classList.add('nope');
  }

  function undo() {
    const last = state.history.pop();
    if (!last || state.done) return;
    restore(state, last);
    state.moves++;
    hinted = -1;
    api.persist();
    render();
  }

  // Cherche un coup utile : d'abord ceux qui prolongent une suite de même couleur.
  function hint() {
    if (state.done) return;
    let fallback = -1;
    for (let c = 0; c < 10; c++) {
      const col = state.tableau[c];
      let i = col.length - 1;
      while (i > 0 && isRun(col, i - 1, S)) i--;
      if (i < 0) continue;
      const id = col[i][0];
      const t = target(id, c, i === 0);
      if (t < 0 || !state.tableau[t].length) continue;
      if (spiderSuit(top(state.tableau[t]), S) === spiderSuit(id, S)) { fallback = id; break; }
      // Sans gain de couleur, le coup ne vaut que s'il découvre une carte ou vide une colonne.
      if (fallback < 0 && (i === 0 || !col[i - 1][1] || rank(col[i - 1][0]) !== rank(id) + 1)) fallback = id;
    }
    if (fallback >= 0) { hinted = fallback; state.hints++; render(); }
    else api.toast(state.stock.length ? 'Rien de mieux sur la table : distribuez.' : 'Aucun coup trouvé. Annulez ou recommencez.');
  }

  function render() {
    const width = table.clientWidth || 340;
    lastWidth = table.clientWidth;
    const gap = 3;
    const cw = (width - gap * 9) / 10, ch = cw * 1.42;
    table.style.setProperty('--cw', cw + 'px');
    table.style.setProperty('--ch', ch + 'px');
    table.style.setProperty('--gap', gap + 'px');
    const info = h('div', { class: 'spider-info' },
      h('span', { class: 'spider-done' }, Array.from({ length: 8 }, (_, k) => h('i', { class: k < state.done8 ? 'on' : '' }))),
      h('span', { class: 'spider-left' }, `${state.stock.length / 10} distribution${state.stock.length > 10 ? 's' : ''} en réserve`));
    const room = Math.max(ch * 2.500, (table.parentElement.clientHeight || 500) - 34);
    const cols = h('div', { class: 'sol-cols' }, state.tableau.map((col, c) => {
      const downs = col.filter((x) => !x[1]).length, ups = col.length - downs;
      let stepDown = ch * 0.16, stepUp = ch * 0.42;
      const need = downs * stepDown + Math.max(0, ups - 1) * stepUp + ch;
      if (need > room) { const f = (room - ch) / (need - ch); stepDown *= f; stepUp *= f; }
      let y = 0;
      const kids = col.map(([id, up], i) => {
        const red = spiderSuit(id, S) === 1;
        const el = up
          ? h('button', { type: 'button', class: `card ${red ? 'red' : 'black'}${id === hinted ? ' is-hint' : ''}`, 'aria-label': `${RANKS[rank(id)]} ${red ? '♥' : '♠'}`, onclick: () => play(c, i) },
            h('span', { class: 'card-corner' }, RANKS[rank(id)], h('i', null, red ? '♥' : '♠')), h('span', { class: 'card-pip' }, red ? '♥' : '♠'))
          : h('div', { class: 'card back' });
        el.style.top = y + 'px';
        y += up ? stepUp : stepDown;
        return el;
      });
      return h('div', { class: 'col' + (col.length ? '' : ' is-empty'), style: `height:${ch}px` }, kids);
    }));
    table.replaceChildren(info, cols);
    undoBtn.disabled = state.history.length === 0;
    dealBtn.disabled = state.stock.length === 0;
  }

  render();
  return { destroy() { resize.disconnect(); } };
}

export const spiderDef = {
  id: 'spider',
  title: 'Spider',
  tagline: 'Huit suites du roi à l’as',
  levels: Object.fromEntries(Object.entries(SPIDER_LEVELS).map(([k, v]) => [k, v.label])),
  status: (s) => `${s.done8}/8 suites`,
  rules: [
    'Formez huit suites complètes du roi à l’as dans une même couleur : chaque suite terminée quitte la table. Une carte se pose sur n’importe quelle carte du rang juste au-dessus.',
    'Seule une suite descendante de même couleur se déplace en bloc. Touchez une carte : sa suite part vers la meilleure colonne, de préférence sur la même couleur.',
    '« Distribuer » ajoute une carte sur chaque colonne, cinq fois par partie. Toutes les donnes ne sont pas gagnables.',
  ],
  init, reset, mount,
};
