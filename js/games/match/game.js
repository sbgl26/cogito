// Interface « Paires » : toucher deux chiffres identiques ou qui font 10.

import { h, icon, buzz } from '../../core/ui.js';
import { W, matches, linked, findPair, addRows, dropEmptyRows, remaining } from './engine.js';

const ADDS = 4, HINTS = 5;

function init(data) {
  return { cells: data.cells, initial: data.cells.slice(), adds: ADDS, tips: HINTS, history: [], pairs: 0 };
}

function reset(state) {
  Object.assign(state, { cells: state.initial.slice(), adds: ADDS, tips: HINTS, history: [], pairs: 0 });
}

function mount(host, state, api) {
  let sel = -1, hinted = [];
  const grid = h('div', { class: 'match', style: `--w:${W}` });
  const scroller = h('div', { class: 'match-scroll' }, grid);
  const tool = (name, label, onclick) => {
    const count = h('b', { class: 'tool-count' });
    const btn = h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label, count));
    btn.count = count;
    return btn;
  };
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const addBtn = tool('plus', 'Ajouter', () => add());
  const hintBtn = tool('bulb', 'Indice', () => hint());
  host.append(h('div', { class: 'play' }, scroller,
    h('div', { class: 'controls' }, h('div', { class: 'tools tools--three' }, undoBtn, addBtn, hintBtn))));

  const snapshot = () => {
    state.history.push({ cells: state.cells.slice(), adds: state.adds });
    if (state.history.length > 60) state.history.shift();
  };

  function tap(i) {
    if (state.done || state.cells[i] <= 0) return;
    hinted = [];
    if (sel < 0) { sel = i; buzz(5, 'tap'); }
    else if (sel === i) sel = -1;
    else if (matches(state.cells[sel], state.cells[i]) && linked(state.cells, sel, i)) {
      snapshot();
      const before = state.cells.length;
      state.cells[sel] *= -1;
      state.cells[i] *= -1;
      state.cells = dropEmptyRows(state.cells);
      state.pairs++;
      sel = -1;
      buzz(8, state.cells.length < before ? 'clear' : 'place');
      after();
      return;
    } else { sel = i; buzz(5, 'tap'); }
    render();
  }

  function after() {
    api.persist();
    render();
    if (remaining(state.cells) === 0) { api.win(grid); return; }
    if (!findPair(state.cells)) {
      if (state.adds > 0) api.toast('Plus de paire visible : touchez Ajouter.');
      else api.fail('Il ne reste aucune paire et plus aucun ajout.');
    }
  }

  function add() {
    if (state.done || state.adds <= 0) return;
    snapshot();
    state.cells = addRows(state.cells);
    state.adds--;
    sel = -1;
    buzz(8, 'place');
    after();
    scroller.scrollTop = scroller.scrollHeight;
  }

  function undo() {
    const last = state.history.pop();
    if (!last || state.done) return;
    state.cells = last.cells;
    state.adds = last.adds;
    sel = -1; hinted = [];
    api.persist();
    render();
  }

  function hint() {
    if (state.done) return;
    const pair = findPair(state.cells);
    if (!pair) { api.toast(state.adds > 0 ? 'Aucune paire : touchez Ajouter.' : 'Aucune paire possible.'); return; }
    if (state.tips <= 0) { api.toast('Plus d’indice pour cette partie.'); return; }
    state.tips--;
    state.hints++;
    hinted = pair;
    sel = -1;
    api.persist();
    render();
    const el = grid.children[pair[0]];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function render() {
    grid.replaceChildren(...state.cells.map((v, i) => h('button', {
      type: 'button', disabled: v <= 0,
      class: 'mcell' + (v <= 0 ? ' is-gone' : '') + (i === sel ? ' is-sel' : '') + (hinted.includes(i) ? ' is-hint' : ''),
      style: `--d:${((i / W) | 0) + (i % W)}`,
      onclick: () => tap(i),
    }, Math.abs(v))));
    undoBtn.disabled = state.history.length === 0;
    addBtn.disabled = state.adds <= 0;
    addBtn.count.textContent = ' ' + state.adds;
    hintBtn.count.textContent = ' ' + state.tips;
  }

  render();
  return { destroy() {} };
}

export const matchDef = {
  id: 'match',
  title: 'Paires',
  tagline: 'Identiques ou qui font 10',
  levels: null,
  daily: 'std',
  status: (s) => `${remaining(s.cells)} chiffres`,
  rules: [
    'Videz la grille en retirant les chiffres deux par deux : deux chiffres identiques (6 et 6) ou dont la somme fait 10 (3 et 7).',
    'Les deux chiffres doivent se voir : côte à côte, l’un sous l’autre ou en diagonale, sans chiffre entre eux. Les cases déjà vidées ne gênent pas. La fin d’une ligne est voisine du début de la suivante.',
    'Bloqué ? « Ajouter » recopie tous les chiffres restants à la suite de la grille, quatre fois par partie.',
  ],
  init, reset, mount,
};
