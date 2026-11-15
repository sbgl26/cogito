// Moteur « Paires » (type Number Match) : on retire deux chiffres identiques ou dont
// la somme fait 10, s'ils se « voient » : voisins en ligne, colonne ou diagonale sans
// chiffre entre eux, ou consécutifs dans le sens de lecture (fin de ligne → ligne suivante).
// Une case vaut d (chiffre actif), -d (chiffre déjà retiré) .

import { rand, shuffle } from '../../core/rng.js';

export const W = 9;

export const matches = (x, y) => x > 0 && y > 0 && (x === y || x + y === 10);

export function generateMatch() {
  // 18 paires compatibles, puis mélange : le total de départ est toujours « appariable ».
  const cells = [];
  for (let p = 0; p < 18; p++) {
    const d = 1 + ((rand() * 9) | 0);
    cells.push(d, rand() < 0.5 ? d : 10 - d);
  }
  return { cells: shuffle(cells) };
}

// Prochain chiffre actif à partir de i dans une direction (pas en index, garde de colonne).
function next(cells, i, step, dc) {
  let j = i + step, col = (i % W) + dc;
  while (j < cells.length && j >= 0) {
    if (dc !== 0 && (col < 0 || col >= W)) return -1;
    if (cells[j] > 0) return j;
    j += step; col += dc;
  }
  return -1;
}

// Les quatre « regards » vers l'avant : lecture, bas, diagonale droite, diagonale gauche.
const LOOKS = [[1, 0], [W, 0], [W + 1, 1], [W - 1, -1]];

export function linked(cells, a, b) {
  if (a === b) return false;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return LOOKS.some(([step, dc]) => next(cells, lo, step, dc) === hi);
}

export function findPair(cells) {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] <= 0) continue;
    for (const [step, dc] of LOOKS) {
      const j = next(cells, i, step, dc);
      if (j >= 0 && matches(cells[i], cells[j])) return [i, j];
    }
  }
  return null;
}

// Recopie à la suite tous les chiffres encore actifs.
export function addRows(cells) {
  return cells.concat(cells.filter((v) => v > 0));
}

// Retire les lignes entièrement vidées. Renvoie le nouveau tableau.
export function dropEmptyRows(cells) {
  const out = [];
  for (let r = 0; r * W < cells.length; r++) {
    const row = cells.slice(r * W, r * W + W);
    if (row.some((v) => v > 0)) out.push(...row);
  }
  return out;
}

export const remaining = (cells) => cells.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
