// Interface du Nonogram, noir et blanc ou en couleurs : remplissage au doigt (glissé),
// croix, annulation, indice.
// États d'une case : 0 vide, 1..K couleur, X croix, WRONG croix « erreur » (posée par la correction).

import { h, icon, buzz } from '../../core/ui.js';
import { settings } from '../../core/store.js';
import { NONO_LEVELS, COLOR_LEVELS, cluesOf } from './engine.js';

const X = 9, WRONG = 10;

function init(data) {
  return {
    size: data.size,
    colors: data.colors || 1,
    solution: data.solution,
    rows: data.rows,
    cols: data.cols,
    cells: new Array(data.size * data.size).fill(0),
    history: [],
    mode: 1,
  };
}

function reset(state) {
  state.cells = new Array(state.size * state.size).fill(0);
  state.history = [];
  state.mode = 1;
}

function mount(host, state, api) {
  const n = state.size, K = state.colors || 1;
  const multi = K > 1;
  let stroke = null;
  const ink = (v) => (v >= 1 && v <= K ? v : 0);

  // ----- Grille et indices -----
  const clueEl = (list) => h('div', { class: 'clue' },
    (list.length ? list : [[0, 0]]).map(([len, col]) => h('span', { class: multi && col ? 'chip c' + col : null }, len)));
  const topEls = state.cols.map(clueEl);
  const leftEls = state.rows.map(clueEl);
  const cellEls = [];
  const grid = h('div', { class: 'nono-grid', role: 'grid', 'aria-label': 'Grille de Nonogram' });
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n;
    let cls = 'ncell';
    if ((c + 1) % 5 === 0 && c < n - 1) cls += ' br';
    if ((r + 1) % 5 === 0 && r < n - 1) cls += ' bb';
    const el = h('div', { class: cls, style: `--d:${r + c}` });
    el.dataset.base = cls;
    cellEls.push(el);
    grid.append(el);
  }
  const wrap = h('div', { class: 'nono' + (multi ? ' nono--color' : ''), style: `--n:${n}` },
    h('div', { class: 'nono-corner' }),
    h('div', { class: 'nono-top' }, topEls),
    h('div', { class: 'nono-left' }, leftEls),
    grid);

  // ----- Outils : une pastille par couleur, puis la croix -----
  const modeBtn = (mode, content, label) => h('button', {
    type: 'button', class: 'seg-btn', 'data-mode': mode, 'aria-label': label,
    onclick: () => { state.mode = mode; api.persist(); renderTools(); },
  }, content);
  const modes = [];
  for (let c = 1; c <= K; c++) {
    modes.push(multi
      ? modeBtn(c, h('i', { class: 'swatch c' + c }), 'Couleur ' + c)
      : modeBtn(c, [icon('fill'), h('span', null, 'Remplir')], 'Remplir'));
  }
  modes.push(modeBtn(X, multi ? icon('cross') : [icon('cross'), h('span', null, 'Croix')], 'Croix'));
  const seg = h('div', { class: 'seg seg--mode', role: 'group', 'aria-label': 'Outil' }, modes);
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const hintBtn = tool('bulb', 'Indice', () => hint());

  const stage = h('div', { class: 'stage' }, wrap);
  host.append(h('div', { class: 'play' }, stage,
    h('div', { class: 'controls controls--row' }, seg, h('div', { class: 'tools tools--pair' }, undoBtn, hintBtn))));

  // ----- Mise à l'échelle : la grille prend toute la place disponible -----
  const per = multi ? 0.86 : 0.66;
  const unitsLeft = Math.max(...state.rows.map((r) => r.reduce((s, v) => s + (v[0] >= 10 ? per + 0.4 : per), 0))) + 0.45;
  const unitsTop = Math.max(...state.cols.map((c) => Math.max(c.length, 1))) * (multi ? 0.86 : 0.76) + 0.35;
  function layout() {
    const w = Math.min(stage.clientWidth, 540);
    const hgt = Math.max(stage.clientHeight, 220);
    let cell = Math.floor(Math.min((w - 10) / (n + unitsLeft), (hgt - 10) / (n + unitsTop), 58));
    cell = Math.max(cell, 13);
    wrap.style.setProperty('--cell', cell + 'px');
    wrap.style.setProperty('--cw', Math.ceil(unitsLeft * cell) + 'px');
    wrap.style.setProperty('--ch', Math.ceil(unitsTop * cell) + 'px');
    wrap.style.setProperty('--cf', Math.max(9, Math.min(17, cell * 0.58)).toFixed(1) + 'px');
  }
  const resize = new ResizeObserver(layout);
  resize.observe(stage);
  layout();

  // ----- Logique -----
  const line = (kind, k) => Array.from({ length: n }, (_, x) => (kind === 'row' ? k * n + x : x * n + k));
  const sameClues = (a, b) => a.length === b.length && a.every((v, k) => v[0] === b[k][0] && v[1] === b[k][1]);
  const lineDone = (kind, k) => sameClues(
    cluesOf(line(kind, k).map((i) => ink(state.cells[i]))),
    kind === 'row' ? state.rows[k] : state.cols[k]);

  function paint(i) {
    const v = state.cells[i];
    cellEls[i].className = cellEls[i].dataset.base +
      (ink(v) ? ' f c' + v : v === X ? ' x' : v === WRONG ? ' x w' : '');
  }

  function set(i, v, changes) {
    if (state.cells[i] === v) return;
    changes.push([i, state.cells[i]]);
    state.cells[i] = v;
    paint(i);
  }

  // Ligne terminée : on grise ses indices et, si l'option est active, on barre le reste.
  function settle(changes) {
    for (let k = 0; k < n; k++) {
      for (const kind of ['row', 'col']) {
        const done = lineDone(kind, k);
        (kind === 'row' ? leftEls : topEls)[k].classList.toggle('is-done', done);
        if (done && changes && settings.get('autoCross')) {
          for (const i of line(kind, k)) if (state.cells[i] === 0) set(i, X, changes);
        }
      }
    }
  }

  function commit(changes) {
    if (!changes.length) return;
    settle(changes);
    state.history.push(changes);
    if (state.history.length > 200) state.history.shift();
    finish();
  }

  function finish() {
    api.persist();
    renderTools();
    if (state.cells.every((v, i) => ink(v) === state.solution[i])) api.win(grid);
  }

  function apply(i, first) {
    if (stroke.dead || stroke.seen.has(i)) return;
    stroke.seen.add(i);
    const cur = state.cells[i];
    if (stroke.op === 0) {
      if (cur === stroke.target) set(i, 0, stroke.changes);
      return;
    }
    if (cur !== 0 && !first) return; // on ne repasse pas sur une case déjà marquée
    if (settings.get('checkErrors')) {
      const want = state.solution[i] || X;
      if (stroke.op !== want) {
        set(i, want === X ? WRONG : want, stroke.changes);
        cellEls[i].classList.add('oops');
        api.error();
        stroke.dead = true;
        return;
      }
    }
    set(i, stroke.op, stroke.changes);
    buzz(5, first ? 'tap' : null);
  }

  function locate(e) {
    const rect = grid.getBoundingClientRect();
    const size = rect.width / n;
    const c = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - rect.left) / size)));
    const r = Math.max(0, Math.min(n - 1, Math.floor((e.clientY - rect.top) / size)));
    return { r, c };
  }

  function spotlight(r, c) {
    leftEls.forEach((el, k) => el.classList.toggle('is-active', k === r));
    topEls.forEach((el, k) => el.classList.toggle('is-active', k === c));
  }

  grid.addEventListener('pointerdown', (e) => {
    if (state.done || stroke) return;
    e.preventDefault();
    const { r, c } = locate(e);
    const i = r * n + c;
    const cur = state.cells[i];
    const target = state.mode;
    // Avec la correction active, une case juste ou une croix rouge sont définitives.
    if (settings.get('checkErrors') && (ink(cur) || cur === WRONG)) return;
    if (cur === WRONG) { const changes = []; set(i, 0, changes); commit(changes); return; }
    try { grid.setPointerCapture(e.pointerId); } catch { /* sans capture, le glissé reste limité à la grille */ }
    stroke = { r0: r, c0: c, axis: null, op: cur === target ? 0 : target, target, changes: [], seen: new Set(), dead: false };
    apply(i, true);
    spotlight(r, c);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    let { r, c } = locate(e);
    if (!stroke.axis) {
      if (r === stroke.r0 && c === stroke.c0) return;
      stroke.axis = Math.abs(c - stroke.c0) >= Math.abs(r - stroke.r0) ? 'row' : 'col';
    }
    // Le trait reste sur la ligne ou la colonne de départ : plus précis au doigt.
    if (stroke.axis === 'row') {
      r = stroke.r0;
      const step = c >= stroke.c0 ? 1 : -1;
      for (let x = stroke.c0; x !== c + step; x += step) apply(r * n + x, false);
    } else {
      c = stroke.c0;
      const step = r >= stroke.r0 ? 1 : -1;
      for (let y = stroke.r0; y !== r + step; y += step) apply(y * n + c, false);
    }
    spotlight(r, c);
  });

  const endStroke = () => {
    if (!stroke) return;
    const changes = stroke.changes;
    stroke = null;
    spotlight(-1, -1);
    commit(changes);
  };
  grid.addEventListener('pointerup', endStroke);
  grid.addEventListener('pointercancel', endStroke);
  grid.addEventListener('lostpointercapture', endStroke);

  function undo() {
    if (state.done) return;
    const changes = state.history.pop();
    if (!changes) return;
    for (let k = changes.length - 1; k >= 0; k--) {
      state.cells[changes[k][0]] = changes[k][1];
      paint(changes[k][0]);
    }
    settle(null);
    api.persist();
    renderTools();
  }

  function hint() {
    if (state.done) return;
    const wrong = [], missing = [];
    state.cells.forEach((v, i) => {
      if (ink(v) && ink(v) !== state.solution[i]) wrong.push(i);
      else if (state.solution[i] && !ink(v)) missing.push(i);
    });
    const pool = wrong.length ? wrong : missing;
    if (!pool.length) return;
    const i = pool[(Math.random() * pool.length) | 0];
    const changes = [];
    set(i, state.solution[i] || X, changes);
    state.hints++;
    settle(changes);
    state.history = []; // un indice ne s'annule pas
    finish();
  }

  function renderTools() {
    seg.querySelectorAll('.seg-btn').forEach((b) => {
      const on = Number(b.dataset.mode) === state.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    undoBtn.disabled = state.history.length === 0;
  }

  for (let i = 0; i < n * n; i++) paint(i);
  settle(null);
  renderTools();

  return {
    destroy() { resize.disconnect(); },
  };
}

const labels = (levels) => Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.label]));

export const nonogramDef = {
  id: 'nonogram',
  title: 'Nonogram',
  tagline: 'Une image à noircir',
  levels: labels(NONO_LEVELS),
  daily: 'moyen',
  errors: true,
  rules: [
    'Les nombres en marge donnent, dans l’ordre, la longueur des blocs de cases pleines de chaque ligne et de chaque colonne. Deux blocs sont séparés par au moins une case vide.',
    'Remplissez en touchant ou en glissant le doigt. L’outil Croix marque les cases que vous savez vides.',
    'Chaque grille se résout par pure logique, sans jamais deviner.',
  ],
  init, reset, mount,
};

export const nonocolorDef = {
  id: 'nonocolor',
  title: 'Nonogram couleur',
  tagline: 'La même logique, aux feutres',
  levels: labels(COLOR_LEVELS),
  daily: 'moyen',
  errors: true,
  rules: [
    'Chaque nombre en marge est un bloc de cases de sa couleur, dans l’ordre. Deux blocs de la même couleur sont séparés par au moins une case vide ; deux blocs de couleurs différentes peuvent se toucher.',
    'Choisissez un feutre puis touchez ou glissez. La croix marque les cases que vous savez vides.',
    'Chaque grille se résout par pure logique, sans jamais deviner.',
  ],
  init, reset, mount,
};
