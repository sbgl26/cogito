// Interface « Sommes » : on entoure les chiffres à garder, on gomme les autres.
// Marque d'une case : 0 indécise, 1 entourée, 2 gommée.

import { h, icon, buzz } from '../../core/ui.js';
import { settings } from '../../core/store.js';
import { SUMS_LEVELS } from './engine.js';

function init(data) {
  return { ...data, marks: new Array(data.size * data.size).fill(0), history: [], mode: 2 };
}

function reset(state) {
  state.marks = new Array(state.size * state.size).fill(0);
  state.history = [];
}

function mount(host, state, api) {
  const n = state.size;
  const cellEls = [], rowEls = [], colEls = [];
  const board = h('div', { class: 'sums', style: `--n:${n}` }, h('div', { class: 'sums-corner' }));
  for (let c = 0; c < n; c++) { colEls.push(h('div', { class: 'total' }, state.colT[c])); board.append(colEls[c]); }
  for (let r = 0; r < n; r++) {
    rowEls.push(h('div', { class: 'total' }, state.rowT[r]));
    board.append(rowEls[r]);
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const el = h('button', { type: 'button', class: 'scell', style: `--d:${r + c}`, onclick: () => tap(i) }, h('span', null, state.nums[i]));
      cellEls.push(el);
      board.append(el);
    }
  }

  const modeBtn = (mode, name, label) => h('button', {
    type: 'button', class: 'seg-btn', 'data-mode': mode,
    onclick: () => { state.mode = mode; api.persist(); render(); },
  }, icon(name), h('span', null, label));
  const seg = h('div', { class: 'seg seg--mode', role: 'group', 'aria-label': 'Outil' },
    modeBtn(2, 'eraser', 'Gommer'), modeBtn(1, 'ring', 'Entourer'));
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const hintBtn = tool('bulb', 'Indice', () => hint());

  const stage = h('div', { class: 'stage' }, board);
  host.append(h('div', { class: 'play' }, stage,
    h('div', { class: 'controls controls--row' }, seg, h('div', { class: 'tools tools--pair' }, undoBtn, hintBtn))));

  const resize = new ResizeObserver(() => {
    const side = Math.max(160, Math.min(stage.clientWidth, stage.clientHeight, 500));
    board.style.width = side + 'px';
    board.style.setProperty('--cell', side / (n + 1) + 'px');
  });
  resize.observe(stage);

  const lineOf = (kind, k) => Array.from({ length: n }, (_, x) => (kind === 'row' ? k * n + x : x * n + k));
  const want = (i) => (state.keep[i] ? 1 : 2);

  function set(i, v, changes) {
    if (state.marks[i] === v) return;
    changes.push([i, state.marks[i]]);
    state.marks[i] = v;
  }

  function tap(i) {
    if (state.done) return;
    const check = settings.get('checkErrors');
    const cur = state.marks[i];
    if (check && cur === want(i)) return; // juste et définitif
    const changes = [];
    let oops = false;
    if (cur === state.mode) set(i, 0, changes);
    else if (check && state.mode !== want(i)) {
      set(i, want(i), changes);
      oops = true;
      api.error();
    } else {
      set(i, state.mode, changes);
      buzz(6, state.mode === 2 ? 'tap' : 'place');
    }
    commit(changes);
    if (oops) cellEls[i].classList.add('oops'); // après le rendu, sinon la classe est écrasée
  }

  // Ligne dont les chiffres entourés atteignent le total : on gomme le reste.
  function settle(changes) {
    if (!settings.get('autoCross')) return;
    for (let k = 0; k < n; k++) {
      for (const kind of ['row', 'col']) {
        const cells = lineOf(kind, k);
        const target = kind === 'row' ? state.rowT[k] : state.colT[k];
        const circled = cells.reduce((s, i) => s + (state.marks[i] === 1 ? state.nums[i] : 0), 0);
        if (circled === target) for (const i of cells) if (state.marks[i] === 0) set(i, 2, changes);
      }
    }
  }

  function commit(changes) {
    if (!changes.length) return;
    settle(changes);
    state.history.push(changes);
    if (state.history.length > 200) state.history.shift();
    after();
  }

  function after() {
    api.persist();
    render();
    if (state.marks.every((m, i) => (m !== 2) === !!state.keep[i])) api.win(board);
  }

  function undo() {
    const changes = state.history.pop();
    if (!changes || state.done) return;
    for (let k = changes.length - 1; k >= 0; k--) state.marks[changes[k][0]] = changes[k][1];
    api.persist();
    render();
  }

  function hint() {
    if (state.done) return;
    const pool = [];
    state.marks.forEach((m, i) => { if (m !== want(i) && !(m === 0 && state.keep[i])) pool.push(i); });
    const open = pool.length ? pool : state.marks.map((m, i) => (m !== want(i) ? i : -1)).filter((i) => i >= 0);
    if (!open.length) return;
    const i = open[(Math.random() * open.length) | 0];
    const changes = [];
    set(i, want(i), changes);
    settle(changes);
    state.hints++;
    state.history = [];
    after();
  }

  function render() {
    state.marks.forEach((m, i) => {
      cellEls[i].className = 'scell' + (m === 1 ? ' is-kept' : m === 2 ? ' is-gone' : '');
    });
    for (let k = 0; k < n; k++) {
      for (const kind of ['row', 'col']) {
        const sum = lineOf(kind, k).reduce((s, i) => s + (state.marks[i] !== 2 ? state.nums[i] : 0), 0);
        const target = kind === 'row' ? state.rowT[k] : state.colT[k];
        (kind === 'row' ? rowEls : colEls)[k].className = 'total' + (sum === target ? ' is-done' : sum < target ? ' is-under' : '');
      }
    }
    seg.querySelectorAll('.seg-btn').forEach((b) => {
      const on = Number(b.dataset.mode) === state.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    undoBtn.disabled = state.history.length === 0;
  }

  render();
  return { destroy() { resize.disconnect(); } };
}

export const sumsDef = {
  id: 'sums',
  title: 'Sommes',
  tagline: 'Gommez les intrus, tombez juste',
  levels: Object.fromEntries(Object.entries(SUMS_LEVELS).map(([k, v]) => [k, v.label])),
  daily: 'moyen',
  errors: true,
  rules: [
    'Chaque ligne et chaque colonne affiche un total. Gommez les chiffres en trop pour que la somme des chiffres restants soit égale à ce total, partout à la fois.',
    'L’outil Entourer sert à marquer les chiffres dont vous êtes sûr. Un total devient surligné quand sa ligne tombe juste.',
    'Chaque grille a une solution unique.',
  ],
  init, reset, mount,
};
