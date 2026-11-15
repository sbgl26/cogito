// Interface du Sudoku classique et du Killer Sudoku (même grille, cages en plus).

import { h, icon, buzz, toast } from '../../core/ui.js';
import { settings } from '../../core/store.js';
import { PEERS, SUDOKU_LEVELS, KILLER_LEVELS } from './engine.js';

function init(data) {
  return {
    puzzle: data.puzzle,
    solution: data.solution,
    values: data.puzzle.slice(),
    notes: new Array(81).fill(0),
    cages: data.cages || null,
    sums: data.sums || null,
    history: [],
    sel: -1,
  };
}

function reset(state) {
  state.values = state.puzzle.slice();
  state.notes = new Array(81).fill(0);
  state.history = [];
  state.sel = -1;
}

function mount(host, state, api) {
  const killer = !!state.cages;
  let notesMode = false;
  const cells = [];

  let cageOf = null;
  if (killer) {
    cageOf = new Array(81);
    state.cages.forEach((cage, k) => cage.forEach((i) => { cageOf[i] = k; }));
  }

  // ----- Grille -----
  const board = h('div', { class: 'sudoku' + (killer ? ' sudoku--killer' : ''), role: 'grid', 'aria-label': 'Grille de Sudoku' });
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9;
    const val = h('span', { class: 'val' });
    const notes = h('span', { class: 'notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('span', null, d)));
    const cell = h('button', {
      type: 'button', class: 'cell', 'data-i': i, style: `--d:${r + c}`,
      'aria-label': `Ligne ${r + 1}, colonne ${c + 1}`,
    }, val, notes);
    if (killer) {
      const k = cageOf[i];
      const edges = ['cage'];
      if (r === 0 || cageOf[i - 9] !== k) edges.push('ct');
      if (c === 8 || cageOf[i + 1] !== k) edges.push('cr');
      if (r === 8 || cageOf[i + 9] !== k) edges.push('cb');
      if (c === 0 || cageOf[i - 1] !== k) edges.push('cl');
      cell.append(h('i', { class: edges.join(' ') }));
      // Angles rentrants (cages en L, en T…) : petit raccord pour que le contour soit continu.
      const inCage = (rr, cc) => rr >= 0 && rr < 9 && cc >= 0 && cc < 9 && cageOf[rr * 9 + cc] === k;
      for (const [name, dr, dc] of [['tl', -1, -1], ['tr', -1, 1], ['bl', 1, -1], ['br', 1, 1]]) {
        if (inCage(r + dr, c) && inCage(r, c + dc) && !inCage(r + dr, c + dc)) cell.append(h('i', { class: 'knee ' + name }));
      }
      if (state.cages[k][0] === i) cell.append(h('span', { class: 'sum' }, state.sums[k]));
    }
    cells.push({ cell, val, notes, sig: '' });
    board.append(cell);
  }
  board.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.cell');
    if (b) select(Number(b.dataset.i));
  });

  // ----- Outils et pavé numérique -----
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const eraseBtn = tool('eraser', 'Effacer', () => erase());
  const notesBtn = tool('pencil', 'Notes', () => { notesMode = !notesMode; render(); });
  notesBtn.setAttribute('aria-pressed', 'false');
  const hintBtn = tool('bulb', 'Indice', () => hint());
  const tools = h('div', { class: 'tools' }, undoBtn, eraseBtn, notesBtn, hintBtn);

  const keys = [];
  const pad = h('div', { class: 'pad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
    const left = h('span', { class: 'key-left' });
    const key = h('button', { type: 'button', class: 'key', 'aria-label': `Chiffre ${d}`, onclick: () => input(d) },
      h('span', { class: 'key-digit' }, d), left);
    keys.push({ key, left });
    return key;
  }));

  host.append(h('div', { class: 'play' }, board, h('div', { class: 'controls' }, tools, pad)));

  const resize = new ResizeObserver(() => {
    board.style.setProperty('--cell', board.clientWidth / 9 + 'px');
  });
  resize.observe(board);

  // ----- Logique de jeu -----
  const locked = (i) => state.puzzle[i] !== 0 ||
    (settings.get('checkErrors') && state.values[i] !== 0 && state.values[i] === state.solution[i]);

  function select(i) {
    if (state.done) return;
    state.sel = i;
    render();
  }

  function remember(entry) {
    state.history.push(entry);
    if (state.history.length > 300) state.history.shift();
  }

  function clearPeerNotes(i, d, entry) {
    const bit = 1 << d;
    for (const p of PEERS[i]) {
      if (state.notes[p] & bit) {
        if (entry) entry.p.push([p, state.notes[p]]);
        state.notes[p] &= ~bit;
      }
    }
  }

  function input(d) {
    const i = state.sel;
    if (state.done) return;
    if (i < 0) { toast('Touchez d’abord une case.'); return; }
    if (locked(i)) return;
    if (notesMode) {
      if (state.values[i]) return;
      remember({ i, v: 0, n: state.notes[i], p: [] });
      state.notes[i] ^= 1 << d;
      buzz(5);
    } else {
      const prev = state.values[i];
      const next = prev === d ? 0 : d;
      const entry = { i, v: prev, n: state.notes[i], p: [] };
      state.values[i] = next;
      if (next) {
        state.notes[i] = 0;
        const wrong = settings.get('checkErrors') && next !== state.solution[i];
        if (wrong) api.error();
        else {
          buzz(8);
          if (settings.get('autoNotes')) clearPeerNotes(i, next, entry);
        }
      }
      remember(entry);
    }
    after();
  }

  function erase() {
    const i = state.sel;
    if (state.done || i < 0 || locked(i)) return;
    if (!state.values[i] && !state.notes[i]) return;
    remember({ i, v: state.values[i], n: state.notes[i], p: [] });
    state.values[i] = 0;
    state.notes[i] = 0;
    after();
  }

  function undo() {
    if (state.done) return;
    const entry = state.history.pop();
    if (!entry) return;
    state.values[entry.i] = entry.v;
    state.notes[entry.i] = entry.n;
    for (const [p, n] of entry.p) state.notes[p] = n;
    state.sel = entry.i;
    after();
  }

  function hint() {
    if (state.done) return;
    let i = state.sel;
    if (i < 0 || state.values[i] === state.solution[i]) {
      const open = [];
      for (let k = 0; k < 81; k++) if (state.values[k] !== state.solution[k]) open.push(k);
      if (!open.length) return;
      i = open[(Math.random() * open.length) | 0];
    }
    state.values[i] = state.solution[i];
    state.notes[i] = 0;
    clearPeerNotes(i, state.solution[i], null);
    state.sel = i;
    state.hints++;
    state.history = []; // un indice ne s'annule pas
    after();
  }

  function after() {
    api.persist();
    render();
    if (state.values.every((v) => v !== 0)) {
      if (state.values.every((v, k) => v === state.solution[k])) {
        state.sel = -1;
        render();
        api.win(board);
      } else if (!settings.get('checkErrors')) {
        toast('La grille est pleine, mais il reste des erreurs.');
      }
    }
  }

  function render() {
    const sel = state.sel;
    const selVal = sel >= 0 ? state.values[sel] : 0;
    const peers = sel >= 0 ? PEERS[sel] : null;
    const check = settings.get('checkErrors');
    const count = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = state.values[i];
      const given = state.puzzle[i] !== 0;
      const wrong = v && check && v !== state.solution[i];
      if (v && !wrong) count[v]++;
      let cls = 'cell';
      if (given) cls += ' is-given'; else if (v) cls += ' is-user';
      if (wrong) cls += ' is-wrong';
      if (i === sel) cls += ' is-sel';
      else if (selVal && v === selVal) cls += ' is-same';
      else if (peers && peers.includes(i)) cls += ' is-peer';
      const n = v ? 0 : state.notes[i];
      const sig = `${cls}|${v}|${n}|${n ? selVal : 0}`;
      const o = cells[i];
      if (o.sig === sig) continue;
      o.sig = sig;
      o.cell.className = cls;
      o.val.textContent = v || '';
      for (let d = 1; d <= 9; d++) {
        o.notes.children[d - 1].className = n & (1 << d) ? (d === selVal ? 'on hot' : 'on') : '';
      }
    }
    keys.forEach(({ key, left }, k) => {
      const remaining = 9 - count[k + 1];
      left.textContent = remaining > 0 ? remaining : '';
      key.classList.toggle('is-done', remaining <= 0);
    });
    notesBtn.classList.toggle('is-on', notesMode);
    notesBtn.setAttribute('aria-pressed', String(notesMode));
    pad.classList.toggle('is-notes', notesMode);
    undoBtn.disabled = state.history.length === 0;
  }

  function onKey(e) {
    if (state.done || e.altKey) return;
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      return;
    }
    if (/^[1-9]$/.test(e.key)) input(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
    else if (e.key.toLowerCase() === 'n') { notesMode = !notesMode; render(); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let i = state.sel < 0 ? 40 : state.sel;
      const r = (i / 9) | 0, c = i % 9;
      if (e.key === 'ArrowUp' && r > 0) i -= 9;
      if (e.key === 'ArrowDown' && r < 8) i += 9;
      if (e.key === 'ArrowLeft' && c > 0) i -= 1;
      if (e.key === 'ArrowRight' && c < 8) i += 1;
      select(i);
    }
  }
  document.addEventListener('keydown', onKey);

  render();
  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      resize.disconnect();
    },
  };
}

const levelLabels = (levels) => Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.label]));

export const sudokuDef = {
  id: 'sudoku',
  title: 'Sudoku',
  daily: 'moyen',
  errors: true,
  tagline: 'Le classique 9 × 9',
  levels: levelLabels(SUDOKU_LEVELS),
  rules: [
    'Remplissez la grille pour que chaque ligne, chaque colonne et chaque bloc 3 × 3 contienne les chiffres de 1 à 9, une seule fois chacun.',
    'Touchez une case puis un chiffre. Le mode Notes sert à crayonner les candidats possibles.',
    'Chaque grille a une solution unique.',
  ],
  init, reset, mount,
};

export const killerDef = {
  id: 'killer',
  title: 'Killer Sudoku',
  daily: 'moyen',
  errors: true,
  tagline: 'Des cages et des sommes',
  levels: levelLabels(KILLER_LEVELS),
  rules: [
    'Les règles du Sudoku s’appliquent : chaque ligne, colonne et bloc 3 × 3 contient les chiffres de 1 à 9.',
    'En plus, les chiffres d’une cage en pointillés doivent totaliser le nombre inscrit dans son coin, sans se répéter dans la cage.',
    'Astuce : une ligne, une colonne ou un bloc complet vaut toujours 45.',
  ],
  init, reset, mount,
};
