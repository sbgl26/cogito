// Interface « Blocs » : on fait glisser les pièces du bas vers la grille 9 × 9.

import { h, buzz } from '../../core/ui.js';
import { N, fits, anyFit, dealPieces, fullUnits, scoreFor } from './engine.js';

function init() {
  const board = new Array(N * N).fill(0);
  return { board, pieces: dealPieces(board), score: 0, streak: 0 };
}

function mount(host, state, api) {
  const cellEls = [];
  const board = h('div', { class: 'blocs' });
  for (let i = 0; i < N * N; i++) {
    const r = (i / N) | 0, c = i % N;
    const shade = (((r / 3) | 0) + ((c / 3) | 0)) % 2 ? ' alt' : '';
    const el = h('div', { class: 'bcell' + shade });
    el.dataset.base = 'bcell' + shade;
    cellEls.push(el);
    board.append(el);
  }
  const tray = h('div', { class: 'tray' });
  const gain = h('div', { class: 'gain', 'aria-hidden': 'true' });
  host.append(h('div', { class: 'play' }, h('div', { class: 'stage' }, board, gain), h('div', { class: 'controls' }, tray)));

  let drag = null;

  const pieceEl = (piece, cell) => {
    const rows = Math.max(...piece.map((p) => p[0])) + 1, cols = Math.max(...piece.map((p) => p[1])) + 1;
    const el = h('div', { class: 'piece', style: `width:${cols * cell}px;height:${rows * cell}px` });
    for (const [r, c] of piece) {
      el.append(h('i', { style: `left:${c * cell}px;top:${r * cell}px;width:${cell}px;height:${cell}px` }));
    }
    return el;
  };

  function paintBoard(preview) {
    for (let i = 0; i < N * N; i++) {
      let cls = cellEls[i].dataset.base + (state.board[i] ? ' on' : '');
      if (preview) {
        if (preview.ghost.has(i)) cls += ' ghost';
        if (preview.will.has(i)) cls += ' will';
      }
      if (cellEls[i].className !== cls) cellEls[i].className = cls;
    }
  }

  function renderTray() {
    tray.replaceChildren(...state.pieces.map((piece, k) => {
      const slot = h('div', { class: 'slot' });
      if (!piece) return slot;
      if (!anyFit(state.board, piece)) slot.classList.add('is-stuck');
      slot.append(pieceEl(piece, 19));
      slot.addEventListener('pointerdown', (e) => startDrag(e, k, slot));
      return slot;
    }));
  }

  // Case du plateau visée par le coin haut-gauche de la pièce en cours de glissé.
  function target() {
    const rect = board.getBoundingClientRect();
    const cell = rect.width / N;
    const c = Math.round((drag.x - rect.left) / cell), r = Math.round((drag.y - rect.top) / cell);
    return fits(state.board, drag.piece, r, c) ? { r, c } : null;
  }

  function startDrag(e, k, slot) {
    if (state.done || drag) return;
    e.preventDefault();
    const piece = state.pieces[k];
    const cell = board.getBoundingClientRect().width / N;
    const el = pieceEl(piece, cell);
    el.classList.add('piece--drag');
    document.body.append(el);
    const rows = Math.max(...piece.map((p) => p[0])) + 1, cols = Math.max(...piece.map((p) => p[1])) + 1;
    drag = { k, piece, el, slot, cell, w: cols * cell, h: rows * cell, x: 0, y: 0, spot: null };
    slot.classList.add('is-lifted');
    try { slot.setPointerCapture(e.pointerId); } catch { /* le glissé fonctionne aussi sans capture */ }
    slot.addEventListener('pointermove', moveDrag);
    slot.addEventListener('pointerup', endDrag);
    slot.addEventListener('pointercancel', endDrag);
    moveDrag(e);
    buzz(5, 'tap');
  }

  function moveDrag(e) {
    if (!drag) return;
    // La pièce flotte au-dessus du doigt pour rester visible.
    drag.x = e.clientX - drag.w / 2;
    drag.y = e.clientY - drag.h - 46;
    drag.el.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    const spot = target();
    drag.spot = spot;
    if (!spot) { paintBoard(null); return; }
    const ghost = new Set(drag.piece.map(([dr, dc]) => (spot.r + dr) * N + spot.c + dc));
    const after = state.board.slice();
    ghost.forEach((i) => { after[i] = 1; });
    paintBoard({ ghost, will: new Set(fullUnits(after).flat()) });
  }

  function endDrag() {
    if (!drag) return;
    const { k, piece, el, slot, spot } = drag;
    slot.removeEventListener('pointermove', moveDrag);
    slot.removeEventListener('pointerup', endDrag);
    slot.removeEventListener('pointercancel', endDrag);
    el.remove();
    drag = null;
    if (spot) place(k, piece, spot);
    else { slot.classList.remove('is-lifted'); paintBoard(null); }
  }

  function place(k, piece, { r, c }) {
    for (const [dr, dc] of piece) state.board[(r + dr) * N + c + dc] = 1;
    const units = fullUnits(state.board);
    const cleared = new Set(units.flat());
    state.streak = units.length ? state.streak + 1 : 0;
    const points = scoreFor(piece.length, units.length, Math.max(0, state.streak - 1));
    state.score += points;
    cleared.forEach((i) => { state.board[i] = 0; });
    state.pieces[k] = null;
    if (state.pieces.every((p) => !p)) state.pieces = dealPieces(state.board);
    buzz(units.length ? [12, 30, 12] : 8, units.length ? 'clear' : 'place');
    paintBoard(null);
    cleared.forEach((i) => {
      cellEls[i].classList.add('pop');
      setTimeout(() => cellEls[i].classList.remove('pop'), 420);
    });
    if (units.length) {
      gain.textContent = '+' + points;
      gain.classList.remove('show');
      void gain.offsetWidth;
      gain.classList.add('show');
    }
    renderTray();
    api.persist();
    if (!state.pieces.some((p) => p && anyFit(state.board, p))) api.over(board);
  }

  paintBoard(null);
  renderTray();
  return {
    destroy() { if (drag) { drag.el.remove(); drag = null; } },
  };
}

export const blocsDef = {
  id: 'blocs',
  title: 'Blocs',
  tagline: 'Complétez lignes et carrés',
  levels: null,
  mode: 'score',
  rules: [
    'Faites glisser les pièces sur la grille 9 × 9. Une ligne, une colonne ou un carré 3 × 3 entièrement rempli s’efface et rapporte des points.',
    'Effacer plusieurs zones d’un seul coup, ou plusieurs coups de suite, multiplie le gain. Les trois pièces doivent être posées avant d’en recevoir trois nouvelles.',
    'La partie s’arrête quand aucune des pièces restantes ne peut plus être posée.',
  ],
  init, mount,
};
