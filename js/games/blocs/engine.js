// Moteur « Blocs » : on pose des pièces sur une grille 9 × 9 ; une ligne, une colonne
// ou un carré 3 × 3 complet disparaît. La partie s'arrête quand plus rien ne rentre.

import { pick } from '../../core/rng.js';

export const N = 9;

const BASE = [
  '#', '##', '###', '####', '#####',
  '##/##', '#./##', '#../###', '..#/###', '.#./###', '##./.##', '.##/##.',
  '#../#../###', '#./.#', '#../.#./..#', '#.#/###', '.#./###/.#.', '###/###/###',
];
const WEIGHT = [2, 3, 4, 3, 2, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 2, 1, 1];

const parse = (s) => {
  const cells = [];
  s.split('/').forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return cells;
};
const normalize = (cells) => {
  const r0 = Math.min(...cells.map((x) => x[0])), c0 = Math.min(...cells.map((x) => x[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const rotate = (cells) => normalize(cells.map(([r, c]) => [c, -r]));

// Toutes les orientations distinctes de chaque forme de base.
const SHAPES = BASE.map((s) => {
  const seen = new Map();
  let cur = normalize(parse(s));
  for (let k = 0; k < 4; k++) {
    seen.set(JSON.stringify(cur), cur);
    cur = rotate(cur);
  }
  return [...seen.values()];
});
const BAG = WEIGHT.flatMap((w, i) => new Array(w).fill(i));

export const randomPiece = () => pick(SHAPES[pick(BAG)]);

export function fits(board, piece, r, c) {
  for (const [dr, dc] of piece) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr * N + cc]) return false;
  }
  return true;
}

export function anyFit(board, piece) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(board, piece, r, c)) return true;
  return false;
}

// Trois nouvelles pièces dont au moins une rentre sur le plateau actuel.
export function dealPieces(board) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const set = [randomPiece(), randomPiece(), randomPiece()];
    if (set.some((p) => anyFit(board, p))) return set;
  }
  return [SHAPES[0][0], SHAPES[0][0], SHAPES[0][0]];
}

// Unités complètes après une pose : listes d'index de cases (lignes, colonnes, carrés).
export function fullUnits(board) {
  const units = [];
  for (let k = 0; k < N; k++) {
    const row = [], col = [], box = [];
    for (let j = 0; j < N; j++) {
      row.push(k * N + j);
      col.push(j * N + k);
      box.push((((k / 3) | 0) * 3 + ((j / 3) | 0)) * N + (k % 3) * 3 + (j % 3));
    }
    for (const u of [row, col, box]) if (u.every((i) => board[i])) units.push(u);
  }
  return units;
}

// Points d'une pose : les cases posées, plus un bonus qui grimpe avec le nombre
// d'unités effacées d'un coup et avec la série de poses « payantes » consécutives.
export function scoreFor(cells, cleared, streak) {
  return cells + (cleared ? 18 * cleared + 10 * cleared * (cleared - 1) + 9 * streak : 0);
}
