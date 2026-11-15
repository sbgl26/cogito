// Interface « Solitaire » (Klondike) : on touche une carte, elle va au meilleur endroit permis.

import { h, icon, buzz } from '../../core/ui.js';
import { SOLITAIRE_LEVELS, suit, rank, isRed, canFoundation, canTableau, isWon, canAutoFinish } from './engine.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
const SUITS = ['♠', '♥', '♦', '♣'];
const PILES = ['stock', 'waste', 'foundations', 'tableau'];
const snap = (s) => JSON.stringify(PILES.map((k) => s[k]));
const restore = (s, text) => JSON.parse(text).forEach((v, k) => { s[PILES[k]] = v; });

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
  let hinted = -1, finishing = null;
  const table = h('div', { class: 'sol' });
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const hintBtn = tool('bulb', 'Indice', () => hint());
  const endBtn = tool('check', 'Terminer', () => autoFinish());
  host.append(h('div', { class: 'play' }, h('div', { class: 'stage stage--top' }, table),
    h('div', { class: 'controls' }, h('div', { class: 'tools tools--three' }, undoBtn, hintBtn, endBtn))));

  let lastWidth = 0;
  const resize = new ResizeObserver(() => { if (table.clientWidth !== lastWidth) render(); });
  resize.observe(table);

  const card = (id, onclick, extra = '') => h('button', {
    type: 'button', class: `card ${isRed(id) ? 'red' : 'black'}${id === hinted ? ' is-hint' : ''}${extra}`,
    'aria-label': `${RANKS[rank(id)]} ${SUITS[suit(id)]}`, onclick,
  }, h('span', { class: 'card-corner' }, RANKS[rank(id)], h('i', null, SUITS[suit(id)])), h('span', { class: 'card-pip' }, SUITS[suit(id)]));
  const back = () => h('div', { class: 'card back' });
  const slot = (cls, ...kids) => h('div', { class: 'pile ' + cls }, kids);

  function commit(before, sound = 'place') {
    state.history.push(before);
    if (state.history.length > 80) state.history.shift();
    state.moves++;
    hinted = -1;
    for (const col of state.tableau) if (col.length) col[col.length - 1][1] = 1; // retourne la carte découverte
    buzz(7, sound);
    api.persist();
    render();
    if (isWon(state)) api.win(table);
  }

  const toFoundation = (id) => state.foundations.findIndex((f) => canFoundation(id, f));

  // Meilleure destination d'une suite de cartes : une colonne non vide d'abord, puis une vide
  // (seulement si cela libère quelque chose).
  function tableauTarget(id, from, frees) {
    let empty = -1;
    for (let t = 0; t < 7; t++) {
      if (t === from || !canTableau(id, state.tableau[t])) continue;
      if (state.tableau[t].length) return t;
      if (empty < 0 && frees) empty = t;
    }
    return empty;
  }

  function drawStock() {
    if (state.done || finishing) return;
    if (!state.stock.length && !state.waste.length) return;
    const before = snap(state);
    if (state.stock.length) {
      for (let k = 0; k < state.draw && state.stock.length; k++) state.waste.push(state.stock.pop());
    } else {
      state.stock = state.waste.reverse();
      state.waste = [];
    }
    commit(before, 'tap');
  }

  function playWaste() {
    if (state.done || finishing || !state.waste.length) return;
    const id = state.waste[state.waste.length - 1];
    const before = snap(state);
    const f = toFoundation(id);
    if (f >= 0) { state.foundations[f].push(state.waste.pop()); commit(before, 'clear'); return; }
    const t = tableauTarget(id, -1, true);
    if (t >= 0) { state.tableau[t].push([state.waste.pop(), 1]); commit(before); return; }
    nope();
  }

  function playTableau(c, i) {
    if (state.done || finishing) return;
    const col = state.tableau[c];
    const id = col[i][0];
    const before = snap(state);
    if (i === col.length - 1) {
      const f = toFoundation(id);
      if (f >= 0) { col.pop(); state.foundations[f].push(id); commit(before, 'clear'); return; }
    }
    const t = tableauTarget(id, c, i > 0);
    if (t >= 0) { state.tableau[t].push(...col.splice(i)); commit(before); return; }
    nope();
  }

  function playFoundation(f) {
    if (state.done || finishing || !state.foundations[f].length) return;
    const pile = state.foundations[f];
    const id = pile[pile.length - 1];
    const t = tableauTarget(id, -1, false);
    if (t < 0) { nope(); return; }
    const before = snap(state);
    state.tableau[t].push([pile.pop(), 1]);
    commit(before);
  }

  function nope() {
    buzz([20, 30, 20], 'error');
    table.classList.remove('nope');
    void table.offsetWidth;
    table.classList.add('nope');
  }

  function undo() {
    const last = state.history.pop();
    if (!last || state.done || finishing) return;
    restore(state, last);
    state.moves++;
    hinted = -1;
    api.persist();
    render();
  }

  // Premier coup utile trouvé : renvoie l'id de la carte à jouer, -2 pour « piochez », -1 sinon.
  function findMove() {
    for (const col of state.tableau) {
      if (col.length && toFoundation(col[col.length - 1][0]) >= 0) return col[col.length - 1][0];
    }
    if (state.waste.length && toFoundation(state.waste[state.waste.length - 1]) >= 0) return state.waste[state.waste.length - 1];
    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      const i = col.findIndex((x) => x[1]);
      if (i < 0) continue;
      // Déplacer toute la partie visible n'est utile que si cela découvre une carte ou vide une colonne.
      const t = tableauTarget(col[i][0], c, i > 0);
      if (t >= 0 && (i > 0 || state.tableau[t].length)) return col[i][0];
    }
    if (state.waste.length && tableauTarget(state.waste[state.waste.length - 1], -1, true) >= 0) return state.waste[state.waste.length - 1];
    return state.stock.length || state.waste.length > 1 ? -2 : -1;
  }

  function hint() {
    if (state.done || finishing) return;
    const move = findMove();
    if (move === -2) api.toast('Rien à jouer sur la table : piochez.');
    else if (move === -1) api.toast('Aucun coup trouvé. Annulez ou recommencez.');
    else { hinted = move; state.hints++; render(); }
  }

  // Tout est visible : on monte les cartes une à une.
  function autoFinish() {
    if (state.done || finishing || !canAutoFinish(state)) return;
    finishing = setInterval(() => {
      for (const col of state.tableau) {
        if (!col.length) continue;
        const id = col[col.length - 1][0];
        const f = toFoundation(id);
        if (f < 0) continue;
        col.pop();
        state.foundations[f].push(id);
        state.moves++;
        buzz(4, 'tap');
        render();
        if (isWon(state)) { clearInterval(finishing); finishing = null; api.persist(); api.win(table); }
        return;
      }
      clearInterval(finishing);
      finishing = null;
    }, 70);
  }

  function render() {
    const width = table.clientWidth || 340;
    lastWidth = table.clientWidth;
    const gap = Math.max(3, Math.round(width * 0.012));
    const cw = (width - gap * 6) / 7, ch = cw * 1.42;
    table.style.setProperty('--cw', cw + 'px');
    table.style.setProperty('--ch', ch + 'px');
    table.style.setProperty('--gap', gap + 'px');

    const top = h('div', { class: 'sol-top' },
      state.foundations.map((f, k) => slot('found', h('span', { class: 'ghost-suit' }, 'A'),
        f.length ? card(f[f.length - 1], () => playFoundation(k)) : null)),
      h('div', { class: 'pile gap' }),
      slot('waste', state.waste.slice(-(state.draw === 3 ? 3 : 1)).map((id, k, list) =>
        (k === list.length - 1 ? card(id, playWaste, ` fan${list.length - 1 - k}`) : h('div', { class: `card ${isRed(id) ? 'red' : 'black'} fan${list.length - 1 - k}` },
          h('span', { class: 'card-corner' }, RANKS[rank(id)], h('i', null, SUITS[suit(id)])))))),
      h('button', { type: 'button', class: 'pile stock', 'aria-label': state.stock.length ? `Pioche, ${state.stock.length} cartes` : 'Retourner la défausse', onclick: drawStock },
        state.stock.length ? [back(), h('b', { class: 'stock-count' }, state.stock.length)] : h('span', { class: 'recycle' }, state.waste.length ? '↻' : '')));

    // Les colonnes se resserrent si elles dépassent la hauteur disponible.
    const room = Math.max(ch * 2, (table.parentElement.clientHeight || 500) - ch - gap * 4);
    const cols = h('div', { class: 'sol-cols' }, state.tableau.map((col, c) => {
      const downs = col.filter((x) => !x[1]).length, ups = col.length - downs;
      let stepDown = ch * 0.16, stepUp = ch * 0.34;
      const need = downs * stepDown + Math.max(0, ups - 1) * stepUp + ch;
      if (need > room) { const f = (room - ch) / (need - ch); stepDown *= f; stepUp *= f; }
      let y = 0;
      const kids = col.map(([id, up], i) => {
        const el = up ? card(id, () => playTableau(c, i)) : back();
        el.style.top = y + 'px';
        y += up ? stepUp : stepDown;
        return el;
      });
      return h('div', { class: 'col', style: `height:${Math.max(ch, y - (col.length ? (col[col.length - 1][1] ? stepUp : stepDown) : 0) + ch)}px` }, kids);
    }));

    table.replaceChildren(top, cols);
    undoBtn.disabled = state.history.length === 0;
    endBtn.disabled = !canAutoFinish(state);
    endBtn.classList.toggle('is-ready', canAutoFinish(state) && !state.done);
  }

  render();
  return {
    destroy() { resize.disconnect(); if (finishing) clearInterval(finishing); },
  };
}

export const solitaireDef = {
  id: 'solitaire',
  title: 'Solitaire',
  tagline: 'Le Klondike, au toucher',
  levels: Object.fromEntries(Object.entries(SOLITAIRE_LEVELS).map(([k, v]) => [k, v.label])),
  status: (s) => `${s.moves} coup${s.moves > 1 ? 's' : ''}`,
  rules: [
    'Montez les quatre couleurs sur les fondations, de l’as au roi. Sur la table, les cartes se posent en ordre décroissant en alternant rouge et noir ; seul un roi peut occuper une colonne vide.',
    'Touchez une carte : elle part d’elle-même vers la meilleure place permise, avec les cartes posées dessus. Touchez la pioche pour tirer.',
    'Comme avec un vrai jeu de cartes, toutes les donnes ne sont pas gagnables. Quand tout est visible, « Terminer » range les cartes pour vous.',
  ],
  init, reset, mount,
};
