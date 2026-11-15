// Interface « 2048 » : on glisse le doigt sur le plateau (ou flèches du clavier).

import { h, icon, buzz } from '../../core/ui.js';
import { SIZE, spawn, slide, canMove, syncIds } from './engine.js';

function init() {
  const tiles = [];
  spawn(tiles); spawn(tiles);
  return { tiles, score: 0, history: [], reached: false };
}

function mount(host, state, api) {
  syncIds(state.tiles);
  const els = new Map();
  const board = h('div', { class: 'g2048' });
  for (let i = 0; i < SIZE * SIZE; i++) board.append(h('i', { class: 'g-slot' }));
  const layer = h('div', { class: 'g-layer' });
  board.append(layer);
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  host.append(h('div', { class: 'play' }, h('div', { class: 'stage' }, board),
    h('div', { class: 'controls' }, h('p', { class: 'swipe-tip' }, 'Glissez le doigt sur le plateau'), h('div', { class: 'tools tools--one' }, undoBtn))));

  const place = (el, t) => { el.style.transform = `translate(${t.c * 100}%, ${t.r * 100}%)`; };
  const face = (el, v) => { el.firstChild.textContent = v; el.firstChild.className = 'g-face v' + Math.min(v, 4096) + (v > 999 ? ' small' : ''); };

  function render(fresh = [], merged = []) {
    const alive = new Set(state.tiles.map((t) => t.id));
    for (const [id, el] of els) if (!alive.has(id)) { el.remove(); els.delete(id); }
    for (const t of state.tiles) {
      let el = els.get(t.id);
      if (!el) {
        el = h('div', { class: 'g-tile' }, h('span'));
        els.set(t.id, el);
        layer.append(el);
        if (fresh.includes(t.id)) el.classList.add('is-new');
      }
      place(el, t);
      face(el, t.v);
      if (merged.includes(t.id)) { el.classList.remove('is-merged'); void el.offsetWidth; el.classList.add('is-merged'); }
    }
    undoBtn.disabled = state.history.length === 0;
  }

  function move(dir) {
    if (state.done) return;
    const res = slide(state.tiles.map((t) => ({ ...t })), dir);
    if (!res.moved) return;
    state.history.push({ tiles: state.tiles, score: state.score });
    if (state.history.length > 30) state.history.shift();
    // Les tuiles absorbées glissent jusqu'à leur voisine, puis disparaissent.
    for (const g of res.gone) {
      const el = els.get(g.id);
      if (el) { place(el, g); els.delete(g.id); setTimeout(() => el.remove(), 110); }
    }
    state.tiles = res.tiles;
    state.score += res.gained;
    const born = spawn(state.tiles);
    render(born ? [born.id] : [], res.merged);
    buzz(res.gained ? 9 : 4, res.gained ? 'place' : 'tap');
    if (!state.reached && state.tiles.some((t) => t.v >= 2048)) { state.reached = true; api.toast('2048 atteint ! La partie continue.'); buzz([20, 40, 20], 'win'); }
    api.persist();
    if (!canMove(state.tiles)) api.over(board, 'Plus aucun mouvement possible');
  }

  function undo() {
    const last = state.history.pop();
    if (!last || state.done) return;
    state.tiles = last.tiles;
    state.score = last.score;
    render();
    api.persist();
  }

  // Glissé : on déclenche dès que le doigt a parcouru une courte distance.
  let from = null;
  board.addEventListener('pointerdown', (e) => { from = { x: e.clientX, y: e.clientY }; try { board.setPointerCapture(e.pointerId); } catch { /* sans capture */ } });
  board.addEventListener('pointermove', (e) => {
    if (!from) return;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    from = null;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 0) : (dy > 0 ? 3 : 2));
  });
  const stop = () => { from = null; };
  board.addEventListener('pointerup', stop);
  board.addEventListener('pointercancel', stop);
  const onKey = (e) => {
    const dir = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }[e.key];
    if (dir !== undefined) { e.preventDefault(); move(dir); }
  };
  document.addEventListener('keydown', onKey);

  render();
  return { destroy() { document.removeEventListener('keydown', onKey); } };
}

export const g2048Def = {
  id: 'g2048',
  title: '2048',
  tagline: 'Fusionnez jusqu’à 2048',
  levels: null,
  mode: 'score',
  rules: [
    'Glissez le doigt : toutes les tuiles partent dans cette direction. Deux tuiles de même valeur qui se rencontrent fusionnent et doublent (2 + 2 = 4, 4 + 4 = 8…).',
    'Une nouvelle tuile apparaît après chaque mouvement. Le but est de former la tuile 2048, puis d’aller le plus loin possible.',
    'La partie s’arrête quand la grille est pleine et qu’aucune fusion n’est possible.',
  ],
  init, mount,
};
