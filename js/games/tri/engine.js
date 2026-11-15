// Moteur « Tri de couleurs » : des éprouvettes de 4 doses à trier par couleur.
// Un tube est une liste, du fond vers le haut.

import { shuffle } from '../../core/rng.js';

export const CAP = 4;

export const TRI_LEVELS = {
  facile: { label: '5 couleurs', colors: 5 },
  moyen: { label: '7 couleurs', colors: 7 },
  difficile: { label: '9 couleurs', colors: 9 },
  expert: { label: '12 couleurs', colors: 12 },
};

// Nombre de doses qui passeraient de a vers b (0 = versement impossible).
export function canPour(tubes, a, b) {
  if (a === b) return 0;
  const A = tubes[a], B = tubes[b];
  if (!A.length || B.length >= CAP) return 0;
  const col = A[A.length - 1];
  if (B.length && B[B.length - 1] !== col) return 0;
  let run = 1;
  while (run < A.length && A[A.length - 1 - run] === col) run++;
  return Math.min(run, CAP - B.length);
}

export function pour(tubes, a, b) {
  const k = canPour(tubes, a, b);
  for (let i = 0; i < k; i++) tubes[b].push(tubes[a].pop());
  return k;
}

const uniform = (t) => t.every((c) => c === t[0]);
export const isSorted = (tubes) => tubes.every((t) => !t.length || (t.length === CAP && uniform(t)));

// Recherche en profondeur avec mémoire des positions déjà vues.
// true = soluble, false = insoluble, null = recherche abandonnée (trop longue).
export function solvable(start, nodeLimit = 40000) {
  const seen = new Set();
  let nodes = 0;
  const key = (tubes) => tubes.map((t) => t.join(',')).sort().join('|');
  const rec = (tubes) => {
    if (isSorted(tubes)) return true;
    if (++nodes > nodeLimit) return null;
    const k = key(tubes);
    if (seen.has(k)) return false;
    seen.add(k);
    const moves = [];
    for (let a = 0; a < tubes.length; a++) {
      const A = tubes[a];
      if (!A.length || (A.length === CAP && uniform(A))) continue;
      let toEmpty = false; // deux tubes vides se valent : on n'en essaie qu'un
      for (let b = 0; b < tubes.length; b++) {
        const n = canPour(tubes, a, b);
        if (!n) continue;
        const B = tubes[b];
        if (!B.length) {
          if (uniform(A) || toEmpty) continue; // déplacer un tube uni vers un vide ne sert à rien
          toEmpty = true;
          moves.push([a, b, 0]);
        } else moves.push([a, b, B.length + n === CAP ? 3 : 1 + (n > 1 ? 1 : 0)]);
      }
    }
    moves.sort((x, y) => y[2] - x[2]);
    let unsure = false;
    for (const [a, b] of moves) {
      const next = tubes.map((t) => t.slice());
      pour(next, a, b);
      const res = rec(next);
      if (res === true) return true;
      if (res === null) unsure = true;
      if (nodes > nodeLimit) return null;
    }
    return unsure ? null : false;
  };
  return rec(start.map((t) => t.slice()));
}

export function generateTri(level) {
  const colors = (TRI_LEVELS[level] || TRI_LEVELS.moyen).colors;
  let tubes = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const doses = [];
    for (let c = 1; c <= colors; c++) for (let k = 0; k < CAP; k++) doses.push(c);
    shuffle(doses);
    tubes = [];
    for (let t = 0; t < colors; t++) tubes.push(doses.slice(t * CAP, t * CAP + CAP));
    tubes.push([], []);
    // On évite les départs trop faciles (tube déjà uni) et on garantit une solution.
    if (tubes.some((t) => t.length && uniform(t))) continue;
    if (solvable(tubes) === true) break;
  }
  return { colors, tubes };
}
