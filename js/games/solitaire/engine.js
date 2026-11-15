// Moteur « Solitaire » (Klondike). Une carte est un entier 0..51 :
// couleur = id / 13 (0 pique, 1 cœur, 2 carreau, 3 trèfle), rang = id % 13 (0 = as).
// Dans les colonnes, une carte est un couple [id, visible].

import { shuffle } from '../../core/rng.js';

export const SOLITAIRE_LEVELS = {
  un: { label: 'Tirage 1 carte', draw: 1 },
  trois: { label: 'Tirage 3 cartes', draw: 3 },
};

export const suit = (id) => (id / 13) | 0;
export const rank = (id) => id % 13;
export const isRed = (id) => suit(id) === 1 || suit(id) === 2;

export function deal(level) {
  const deck = shuffle([...Array(52).keys()]);
  const tableau = [];
  for (let c = 0; c < 7; c++) {
    const col = [];
    for (let k = 0; k <= c; k++) col.push([deck.pop(), k === c ? 1 : 0]);
    tableau.push(col);
  }
  return {
    draw: (SOLITAIRE_LEVELS[level] || SOLITAIRE_LEVELS.un).draw,
    stock: deck, waste: [], foundations: [[], [], [], []], tableau,
  };
}

// La carte peut-elle monter sur sa fondation (as, puis même couleur en ordre croissant) ?
export function canFoundation(id, pile) {
  if (!pile.length) return rank(id) === 0;
  const top = pile[pile.length - 1];
  return suit(top) === suit(id) && rank(id) === rank(top) + 1;
}

// La carte peut-elle se poser sur une colonne (roi sur vide, sinon couleur alternée, rang - 1) ?
export function canTableau(id, col) {
  if (!col.length) return rank(id) === 12;
  const [top, up] = col[col.length - 1];
  return !!up && isRed(top) !== isRed(id) && rank(id) === rank(top) - 1;
}

export const isWon = (s) => s.foundations.every((f) => f.length === 13);

// Tout est visible et la pioche est vide : la fin est mécanique.
export const canAutoFinish = (s) =>
  !s.stock.length && !s.waste.length && s.tableau.every((col) => col.every((card) => card[1]));

// ---------- Spider ----------
// Deux jeux de cartes (104 cartes), une ou deux couleurs. Une carte = [id, visible] ;
// rang = id % 13, couleur = pique, ou pique / cœur en alternance par paquet de 13.

export const SPIDER_LEVELS = {
  une: { label: '1 couleur', suits: 1 },
  deux: { label: '2 couleurs', suits: 2 },
};

export const spiderSuit = (id, suits) => (suits === 1 ? 0 : ((id / 13) | 0) % 2);

export function dealSpider(level) {
  const suits = (SPIDER_LEVELS[level] || SPIDER_LEVELS.une).suits;
  const deck = shuffle([...Array(104).keys()]);
  const tableau = [];
  for (let c = 0; c < 10; c++) {
    const col = [];
    const n = c < 4 ? 6 : 5;
    for (let k = 0; k < n; k++) col.push([deck.pop(), k === n - 1 ? 1 : 0]);
    tableau.push(col);
  }
  return { suits, stock: deck, tableau, done8: 0 };
}

// Les cartes à partir de l'index i forment-elles une suite descendante de même couleur ?
export function isRun(col, i, suits) {
  for (let k = i; k < col.length; k++) {
    if (!col[k][1]) return false;
    if (k > i && (rank(col[k][0]) !== rank(col[k - 1][0]) - 1 || spiderSuit(col[k][0], suits) !== spiderSuit(col[k - 1][0], suits))) return false;
  }
  return true;
}
