// « Démineur » : découvrir toutes les cases sans mine. Le premier coup est toujours sûr.
// open[i] : 0 cachée, 1 découverte, 2 drapeau.

import { h, icon, buzz } from '../../core/ui.js';

export const MINES_LEVELS = {
  facile: { label: 'Facile, 10 mines', w: 8, h: 10, mines: 10 },
  moyen: { label: 'Moyen, 20 mines', w: 9, h: 12, mines: 20 },
  difficile: { label: 'Difficile, 32 mines', w: 10, h: 14, mines: 32 },
};

function init(data, level) {
  const spec = MINES_LEVELS[level] || MINES_LEVELS.facile;
  return { w: spec.w, h: spec.h, count: spec.mines, mines: null, open: new Array(spec.w * spec.h).fill(0), mode: 1, boom: -1 };
}

function reset(state) {
  Object.assign(state, { mines: null, open: new Array(state.w * state.h).fill(0), mode: 1, boom: -1 });
}

function mount(host, state, api) {
  const { w, h: rows } = state;
  const around = (i) => {
    const r = (i / w) | 0, c = i % w, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < rows && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
    return out;
  };
  const near = (i) => around(i).reduce((n, j) => n + state.mines[j], 0);

  const cells = [];
  const board = h('div', { class: 'mines', style: `--w:${w};--h:${rows}` });
  for (let i = 0; i < w * rows; i++) {
    const el = h('button', { type: 'button', class: 'mcase', style: `--d:${((i / w) | 0) + (i % w)}` });
    let timer = null, held = false;
    el.addEventListener('pointerdown', () => { held = false; timer = setTimeout(() => { held = true; flag(i); }, 380); });
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', () => { cancel(); if (!held) tap(i); });
    cells.push(el);
    board.append(el);
  }
  const modeBtn = (mode, label, glyph) => h('button', {
    type: 'button', class: 'seg-btn', 'data-mode': mode,
    onclick: () => { state.mode = mode; api.persist(); render(); },
  }, h('b', { class: 'glyph' }, glyph), h('span', null, label));
  const seg = h('div', { class: 'seg seg--mode', role: 'group', 'aria-label': 'Outil' }, modeBtn(1, 'Creuser', '⛏'), modeBtn(2, 'Drapeau', '⚑'));
  const stage = h('div', { class: 'stage' }, board);
  host.append(h('div', { class: 'play' }, stage, h('div', { class: 'controls controls--center' }, seg)));

  const resize = new ResizeObserver(() => {
    const cell = Math.floor(Math.min((stage.clientWidth - 8) / w, (stage.clientHeight - 8) / rows, 46));
    board.style.setProperty('--cell', Math.max(20, cell) + 'px');
  });
  resize.observe(stage);

  function lay(safe) {
    const banned = new Set([safe, ...around(safe)]);
    const spots = [...Array(w * rows).keys()].filter((i) => !banned.has(i));
    state.mines = new Array(w * rows).fill(0);
    for (let k = 0; k < state.count && spots.length; k++) {
      state.mines[spots.splice((Math.random() * spots.length) | 0, 1)[0]] = 1;
    }
  }

  function dig(i) {
    const queue = [i];
    while (queue.length) {
      const j = queue.pop();
      if (state.open[j] !== 0) continue;
      state.open[j] = 1;
      if (near(j) === 0) queue.push(...around(j).filter((k) => state.open[k] === 0));
    }
  }

  function explode(i) {
    state.boom = i;
    render();
    board.classList.add('is-lost');
    api.fail('Une mine était cachée ici. Le premier coup est toujours sûr, pas les suivants.', 'Boum');
  }

  function tap(i) {
    if (state.done) return;
    if (state.mode === 2 && state.open[i] !== 1) { flag(i); return; }
    if (state.open[i] === 2) return;
    if (!state.mines) lay(i);
    if (state.open[i] === 1) {
      // Chiffre déjà découvert et bon nombre de drapeaux autour : on ouvre les voisines.
      const n = around(i);
      if (near(i) === 0 || n.filter((j) => state.open[j] === 2).length !== near(i)) return;
      const hit = n.find((j) => state.open[j] === 0 && state.mines[j]);
      if (hit !== undefined) { explode(hit); return; }
      n.forEach((j) => dig(j));
    } else {
      if (state.mines[i]) { explode(i); return; }
      dig(i);
    }
    buzz(6, 'tap');
    after();
  }

  function flag(i) {
    if (state.done || state.open[i] === 1) return;
    state.open[i] = state.open[i] === 2 ? 0 : 2;
    buzz(10, 'place');
    after();
  }

  function after() {
    api.persist();
    render();
    if (state.mines && state.open.every((o, i) => (o === 1) !== !!state.mines[i])) api.win(board);
  }

  function render() {
    for (let i = 0; i < w * rows; i++) {
      const o = state.open[i];
      let cls = 'mcase', text = '';
      if (state.boom >= 0 && state.mines[i] && o !== 2) { cls += i === state.boom ? ' is-boom' : ' is-mine'; text = '✹'; }
      else if (o === 1) { const n = near(i); cls += ' is-open n' + n; text = n || ''; }
      else if (o === 2) { cls += ' is-flag'; text = '⚑'; }
      if (cells[i].className !== cls) cells[i].className = cls;
      if (cells[i].textContent !== String(text)) cells[i].textContent = text;
    }
    seg.querySelectorAll('.seg-btn').forEach((b) => {
      const on = Number(b.dataset.mode) === state.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  render();
  return { destroy() { resize.disconnect(); } };
}

export const minesDef = {
  id: 'mines',
  title: 'Démineur',
  tagline: 'Des chiffres et des drapeaux',
  levels: Object.fromEntries(Object.entries(MINES_LEVELS).map(([k, v]) => [k, v.label])),
  status: (s) => `${Math.max(0, s.count - s.open.filter((o) => o === 2).length)} mines`,
  rules: [
    'Découvrez toutes les cases sans mine. Un chiffre indique combien de mines touchent sa case, diagonales comprises.',
    'L’outil Drapeau (ou un appui long) marque une case que vous pensez minée. Touchez un chiffre entouré du bon nombre de drapeaux pour ouvrir d’un coup ses voisines.',
    'Le premier coup est toujours sûr. Ensuite, comme dans le jeu d’origine, il arrive qu’il faille tenter sa chance.',
  ],
  init, reset, mount,
};
