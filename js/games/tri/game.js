// Interface « Tri de couleurs » : toucher une éprouvette, puis celle où verser.

import { h, icon, buzz } from '../../core/ui.js';
import { TRI_LEVELS, CAP, canPour, pour, isSorted } from './engine.js';

const copy = (tubes) => tubes.map((t) => t.slice());

function init(data) {
  return { colors: data.colors, tubes: data.tubes, initial: copy(data.tubes), history: [], moves: 0, extra: false };
}

function reset(state) {
  state.tubes = copy(state.initial);
  state.history = [];
  state.moves = 0;
  state.extra = false;
}

function mount(host, state, api) {
  let sel = -1;
  const rack = h('div', { class: 'rack' });
  const tool = (name, label, onclick) => h('button', { type: 'button', class: 'tool', onclick }, icon(name), h('span', null, label));
  const undoBtn = tool('undo', 'Annuler', () => undo());
  const extraBtn = tool('tube', 'Tube en plus', () => addTube());
  host.append(h('div', { class: 'play' }, h('div', { class: 'stage' }, rack),
    h('div', { class: 'controls' }, h('div', { class: 'tools tools--two' }, undoBtn, extraBtn))));

  function tap(i) {
    if (state.done) return;
    if (sel < 0) {
      if (state.tubes[i].length) { sel = i; buzz(5, 'tap'); }
    } else if (sel === i) sel = -1;
    else if (canPour(state.tubes, sel, i)) {
      const k = pour(state.tubes, sel, i);
      state.history.push([sel, i, k]);
      if (state.history.length > 400) state.history.shift();
      state.moves++;
      sel = -1;
      const t = state.tubes[i];
      buzz(8, t.length === CAP && t.every((c) => c === t[0]) ? 'clear' : 'place');
      api.persist();
      if (isSorted(state.tubes)) { render(); api.win(rack); return; }
    } else if (state.tubes[i].length) { sel = i; buzz(5, 'tap'); } // on change de tube de départ
    else sel = -1;
    render();
  }

  function undo() {
    const last = state.history.pop();
    if (!last || state.done) return;
    const [a, b, k] = last;
    for (let x = 0; x < k; x++) state.tubes[a].push(state.tubes[b].pop());
    state.moves++;
    sel = -1;
    api.persist();
    render();
  }

  function addTube() {
    if (state.extra || state.done) return;
    state.extra = true;
    state.tubes.push([]);
    state.hints++;
    api.persist();
    render();
  }

  function render() {
    rack.style.setProperty('--per', Math.ceil(state.tubes.length / 2));
    rack.replaceChildren(...state.tubes.map((t, i) => {
      const full = t.length === CAP && t.every((c) => c === t[0]);
      return h('button', {
        type: 'button', class: 'tube' + (i === sel ? ' is-sel' : '') + (full ? ' is-full' : ''),
        'aria-label': `Tube ${i + 1}, ${t.length} dose${t.length > 1 ? 's' : ''}`,
        style: `--d:${i}`, onclick: () => tap(i),
      }, t.map((c) => h('i', { class: 'dose d' + c })));
    }));
    undoBtn.disabled = state.history.length === 0;
    extraBtn.disabled = state.extra;
  }

  render();
  return { destroy() {} };
}

export const triDef = {
  id: 'tri',
  title: 'Tri de couleurs',
  tagline: 'Une couleur par éprouvette',
  levels: Object.fromEntries(Object.entries(TRI_LEVELS).map(([k, v]) => [k, v.label])),
  daily: 'moyen',
  status: (s) => `${s.moves} coup${s.moves > 1 ? 's' : ''}`,
  rules: [
    'Rangez les couleurs : à la fin, chaque éprouvette ne contient qu’une seule couleur. Touchez une éprouvette, puis celle où verser.',
    'On ne verse que sur la même couleur ou dans une éprouvette vide, et seulement s’il reste de la place. Les doses identiques du dessus partent ensemble.',
    'Chaque départ a une solution. En cas de blocage, « Tube en plus » ajoute une éprouvette vide, une seule fois par partie.',
  ],
  init, reset, mount,
};
