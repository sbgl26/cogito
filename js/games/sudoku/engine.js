// Moteur Sudoku + Killer Sudoku : génération, résolution, classement par difficulté.
// Aucune dépendance au DOM : testable sous Node.

import { rand, shuffle } from '../../core/rng.js';

const ALL = 0x3fe; // bits 1..9
const ROW = new Uint8Array(81), COL = new Uint8Array(81), BOX = new Uint8Array(81);
for (let i = 0; i < 81; i++) {
  ROW[i] = (i / 9) | 0;
  COL[i] = i % 9;
  BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0);
}

// Les 20 cases qui « voient » chaque case (ligne, colonne, bloc).
export const PEERS = [];
for (let i = 0; i < 81; i++) {
  const p = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) p.push(j);
  }
  PEERS.push(p);
}

// Les 27 unités : 9 lignes, 9 colonnes, 9 blocs.
const UNITS = [];
for (let u = 0; u < 9; u++) {
  UNITS.push([...Array(81).keys()].filter((i) => ROW[i] === u));
  UNITS.push([...Array(81).keys()].filter((i) => COL[i] === u));
  UNITS.push([...Array(81).keys()].filter((i) => BOX[i] === u));
}

const POP = new Uint8Array(1024);
for (let m = 1; m < 1024; m++) POP[m] = POP[m >> 1] + (m & 1);


// ---------- Solveur par retour arrière (masques de bits + case la plus contrainte) ----------

function bruteSolve(puzzle, limit, randomize, out) {
  const g = Array.from(puzzle);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    if (g[i]) {
      const b = 1 << g[i];
      rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
    }
  }
  let count = 0;
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  (function rec() {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & ALL;
      const n = POP[m];
      if (n === 0) return;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 1) break; }
    }
    if (best < 0) { count++; if (out) out.push(g.slice()); return; }
    const order = randomize ? shuffle(digits.slice()) : digits;
    for (const d of order) {
      const b = 1 << d;
      if (!(bestMask & b)) continue;
      g[best] = d; rows[ROW[best]] |= b; cols[COL[best]] |= b; boxes[BOX[best]] |= b;
      rec();
      g[best] = 0; rows[ROW[best]] &= ~b; cols[COL[best]] &= ~b; boxes[BOX[best]] &= ~b;
      if (count >= limit) return;
    }
  })();
  return count;
}

export function countSolutions(puzzle, limit = 2) {
  return bruteSolve(puzzle, limit, false, null);
}

export function randomSolution() {
  const out = [];
  bruteSolve(new Array(81).fill(0), 1, true, out);
  return out[0];
}

// ---------- Solveur logique (sert à classer la difficulté) ----------
// Niveau 1 : candidats uniques (nus et cachés).
// Niveau 2 : + candidats verrouillés (pointage / réclamation) et paires nues.
// Renvoie le niveau maximal utilisé, ou 0 si la grille résiste à ces techniques.

export function logicLevel(puzzle, maxLevel = 2) {
  const g = Array.from(puzzle);
  const cand = new Uint16Array(81);
  for (let i = 0; i < 81; i++) cand[i] = g[i] ? 0 : ALL;
  let left = 0;
  const place = (i, d) => {
    g[i] = d; cand[i] = 0; left--;
    const b = ~(1 << d);
    for (const p of PEERS[i]) cand[p] &= b;
  };
  for (let i = 0; i < 81; i++) if (!g[i]) left++;
  for (let i = 0; i < 81; i++) {
    if (g[i]) { const b = ~(1 << g[i]); for (const p of PEERS[i]) cand[p] &= b; }
  }
  let used = 1;

  const singles = () => {
    let progress = false;
    for (let i = 0; i < 81; i++) {
      if (!g[i] && POP[cand[i]] === 1) { place(i, 31 - Math.clz32(cand[i])); progress = true; }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d;
        let where = -1, n = 0;
        for (const i of unit) if (cand[i] & b) { where = i; if (++n > 1) break; }
        if (n === 1) { place(where, d); progress = true; }
      }
    }
    return progress;
  };

  const locked = () => {
    let progress = false;
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d;
        const cells = unit.filter((i) => cand[i] & b);
        if (cells.length < 2 || cells.length > 3) continue;
        const sameBox = cells.every((i) => BOX[i] === BOX[cells[0]]);
        const sameRow = cells.every((i) => ROW[i] === ROW[cells[0]]);
        const sameCol = cells.every((i) => COL[i] === COL[cells[0]]);
        const sweep = (test) => {
          for (let j = 0; j < 81; j++) {
            if (test(j) && !cells.includes(j) && (cand[j] & b)) { cand[j] &= ~b; progress = true; }
          }
        };
        if (sameBox) sweep((j) => BOX[j] === BOX[cells[0]]);
        if (sameRow) sweep((j) => ROW[j] === ROW[cells[0]]);
        if (sameCol) sweep((j) => COL[j] === COL[cells[0]]);
      }
    }
    return progress;
  };

  const nakedPairs = () => {
    let progress = false;
    for (const unit of UNITS) {
      for (let a = 0; a < 9; a++) {
        const ia = unit[a];
        if (POP[cand[ia]] !== 2) continue;
        for (let c = a + 1; c < 9; c++) {
          const ic = unit[c];
          if (cand[ic] !== cand[ia]) continue;
          for (const j of unit) {
            if (j !== ia && j !== ic && (cand[j] & cand[ia])) { cand[j] &= ~cand[ia]; progress = true; }
          }
        }
      }
    }
    return progress;
  };

  while (left > 0) {
    for (let i = 0; i < 81; i++) if (!g[i] && cand[i] === 0) return 0;
    if (singles()) continue;
    if (maxLevel >= 2 && (locked() || nakedPairs())) { used = 2; continue; }
    return 0;
  }
  return used;
}

// ---------- Génération d'un Sudoku classique ----------

export const SUDOKU_LEVELS = {
  facile:    { label: 'Facile',    clues: 40, logic: 1 },
  moyen:     { label: 'Moyen',     clues: 33, logic: 1 },
  difficile: { label: 'Difficile', clues: 28, logic: 2 },
  expert:    { label: 'Expert',    clues: 24, logic: 0 },
};

function dig(solution, spec) {
  const puzzle = solution.slice();
  let clues = 81;
  // Retrait par paires symétriques (rotation 180°) : grilles plus élégantes.
  const order = shuffle([...Array(41).keys()]);
  for (const i of order) {
    if (clues <= spec.clues) break;
    const j = 80 - i;
    const a = puzzle[i], b = puzzle[j];
    puzzle[i] = 0; puzzle[j] = 0;
    const ok = spec.logic > 0
      ? logicLevel(puzzle, spec.logic) > 0
      : countSolutions(puzzle, 2) === 1;
    if (ok) clues -= i === j ? 1 : 2;
    else { puzzle[i] = a; puzzle[j] = b; }
  }
  return { puzzle, clues };
}

export function generateSudoku(level) {
  const spec = SUDOKU_LEVELS[level] || SUDOKU_LEVELS.moyen;
  let best = null;
  // « Difficile » exige une grille qui résiste aux candidats uniques : environ une
  // tentative sur douze convient, d'où un nombre d'essais plus large (≈ 2 ms l'essai).
  const tries = level === 'difficile' ? 250 : 30;
  for (let attempt = 0; attempt < tries; attempt++) {
    const solution = randomSolution();
    const { puzzle, clues } = dig(solution, spec);
    const lvl = logicLevel(puzzle, 2);
    // Écart par rapport à la cible : nombre d'indices + bonne famille de techniques.
    let miss = Math.max(0, clues - spec.clues);
    if (level === 'difficile' && lvl !== 2) miss += 6;
    if (level === 'expert' && lvl !== 0) miss += 6;
    if (!best || miss < best.miss) best = { puzzle, solution, miss };
    if (miss <= 1) break;
  }
  return { puzzle: best.puzzle, solution: best.solution };
}

// ---------- Killer Sudoku ----------

// COMBO[(pris >> 1) * 460 + k * 46 + somme] : chiffres pouvant encore figurer dans une cage
// dont « pris » sont déjà posés, s'il reste k cases à remplir pour un total de « somme ».
const COMBO = new Uint16Array(512 * 460);
for (let set = 0; set < 512; set++) {
  let k = 0, sum = 0;
  for (let d = 1; d <= 9; d++) if (set & (1 << (d - 1))) { k++; sum += d; }
  const free = ~set & 511;
  // Tous les masques « pris » disjoints de cet ensemble.
  for (let taken = free; ; taken = (taken - 1) & free) {
    COMBO[taken * 460 + k * 46 + sum] |= set << 1;
    if (taken === 0) break;
  }
}

// Compte les solutions d'un Killer (cages = listes de cases, sums = sommes).
// Renvoie -1 si la limite de nœuds est atteinte.
export function killerCount(cages, sums, limit = 2, out = null, nodeLimit = 150000) {
  const g = new Uint8Array(81);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const cageOf = new Uint8Array(81);
  const rem = new Int16Array(cages.length), leftIn = new Uint8Array(cages.length);
  const used = new Uint16Array(cages.length);
  cages.forEach((cells, c) => {
    rem[c] = sums[c]; leftIn[c] = cells.length;
    for (const i of cells) cageOf[i] = c;
  });
  let count = 0, nodes = 0, aborted = false;

  const candidates = (i) => {
    const c = cageOf[i];
    if (rem[c] < 0 || rem[c] > 45) return 0;
    return ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) &
      COMBO[(used[c] >> 1) * 460 + leftIn[c] * 46 + rem[c]];
  };

  (function rec() {
    if (++nodes > nodeLimit) { aborted = true; return; }
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(i);
      const n = POP[m];
      if (n === 0) return;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 1) break; }
    }
    if (best < 0) { count++; if (out) out.push(Array.from(g)); return; }
    const c = cageOf[best];
    for (let d = 1; d <= 9; d++) {
      const b = 1 << d;
      if (!(bestMask & b)) continue;
      g[best] = d; rows[ROW[best]] |= b; cols[COL[best]] |= b; boxes[BOX[best]] |= b;
      used[c] |= b; rem[c] -= d; leftIn[c]--;
      rec();
      g[best] = 0; rows[ROW[best]] &= ~b; cols[COL[best]] &= ~b; boxes[BOX[best]] &= ~b;
      used[c] &= ~b; rem[c] += d; leftIn[c]++;
      if (count >= limit || aborted) return;
    }
  })();
  return aborted ? -1 : count;
}

export const KILLER_LEVELS = {
  facile:    { label: 'Facile',    sizes: [1, 2, 2, 2, 3, 3],    maxSingles: 12 },
  moyen:     { label: 'Moyen',     sizes: [2, 2, 3, 3, 3, 4],    maxSingles: 6 },
  difficile: { label: 'Difficile', sizes: [2, 3, 3, 3, 4, 4],    maxSingles: 3 },
  expert:    { label: 'Expert',    sizes: [2, 3, 3, 4, 4, 5],    maxSingles: 2 },
};

function neighbours(i) {
  const n = [];
  if (ROW[i] > 0) n.push(i - 9);
  if (ROW[i] < 8) n.push(i + 9);
  if (COL[i] > 0) n.push(i - 1);
  if (COL[i] < 8) n.push(i + 1);
  return n;
}

function partition(solution, spec) {
  const cageOf = new Int16Array(81).fill(-1);
  const cages = [];
  for (const start of shuffle([...Array(81).keys()])) {
    if (cageOf[start] >= 0) continue;
    const target = spec.sizes[(rand() * spec.sizes.length) | 0];
    const cells = [start];
    let digits = 1 << solution[start];
    cageOf[start] = cages.length;
    while (cells.length < target) {
      const options = [];
      for (const c of cells) {
        for (const n of neighbours(c)) {
          if (cageOf[n] < 0 && !(digits & (1 << solution[n])) && !options.includes(n)) options.push(n);
        }
      }
      if (!options.length) break;
      const pick = options[(rand() * options.length) | 0];
      cells.push(pick); digits |= 1 << solution[pick]; cageOf[pick] = cages.length;
    }
    cages.push(cells);
  }
  // Rattache les cases isolées à une cage voisine quand c'est possible.
  for (let c = 0; c < cages.length; c++) {
    if (cages[c].length !== 1) continue;
    const i = cages[c][0];
    const hosts = shuffle(neighbours(i)).map((n) => cageOf[n]).filter((h) =>
      h !== c && cages[h].length && cages[h].length < 5 &&
      !cages[h].some((x) => solution[x] === solution[i]));
    if (hosts.length) { cages[hosts[0]].push(i); cageOf[i] = hosts[0]; cages[c] = []; }
  }
  return cages.filter((c) => c.length);
}

// Retire une case de sa cage (elle devient une cage d'une case) et recoupe
// le reste en morceaux connexes.
function isolate(cages, cell) {
  const out = [];
  for (const cells of cages) {
    if (!cells.includes(cell)) { out.push(cells); continue; }
    out.push([cell]);
    const rest = cells.filter((x) => x !== cell);
    const seen = new Set();
    for (const s of rest) {
      if (seen.has(s)) continue;
      const comp = [], stack = [s];
      seen.add(s);
      while (stack.length) {
        const x = stack.pop();
        comp.push(x);
        for (const n of neighbours(x)) if (rest.includes(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
      out.push(comp);
    }
  }
  return out;
}

const sumsOf = (cages, solution) => cages.map((c) => c.reduce((s, i) => s + solution[i], 0));
const singlesOf = (cages) => cages.filter((c) => c.length === 1).length;

export function generateKiller(level, budgetMs = 2500) {
  const spec = KILLER_LEVELS[level] || KILLER_LEVELS.moyen;
  let best = null;
  const deadline = Date.now() + budgetMs;
  for (let attempt = 0; attempt < 400; attempt++) {
    if (Date.now() > deadline && (best || attempt > 800)) break;
    const solution = randomSolution();
    let cages = partition(solution, spec);
    let unique = false;
    for (let step = 0; step < 14; step++) {
      const sols = [];
      const n = killerCount(cages, sumsOf(cages, solution), 2, sols, 25000);
      if (n === 1) { unique = true; break; }
      if (n !== 2) break; // limite de nœuds atteinte : on repart d'une autre grille
      const diff = [];
      for (let i = 0; i < 81; i++) if (sols[0][i] !== sols[1][i]) diff.push(i);
      // On isole de préférence une case appartenant à une grande cage.
      diff.sort((a, b) => cages.find((c) => c.includes(b)).length - cages.find((c) => c.includes(a)).length);
      cages = isolate(cages, diff[0]);
      if (best && singlesOf(cages) >= best.singles) break; // ne fera pas mieux
    }
    if (!unique) continue;
    const singles = singlesOf(cages);
    if (!best || singles < best.singles) best = { cages, solution, singles };
    if (singles <= spec.maxSingles) break;
  }
  if (!best) {
    // Filet de sécurité (jamais observé en test) : cages de 1 ou 2 cases en ligne.
    const solution = randomSolution();
    const cages = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c += 2) cages.push(c === 8 ? [r * 9 + 8] : [r * 9 + c, r * 9 + c + 1]);
    }
    let guard = 0;
    while (guard++ < 81) {
      const sols = [];
      if (killerCount(cages, sumsOf(cages, solution), 2, sols) !== 2) break;
      const i = sols[0].findIndex((v, k) => v !== sols[1][k]);
      cages.splice(0, cages.length, ...isolate(cages, i));
    }
    best = { cages, solution };
  }
  // Ordonne les cases de chaque cage (haut-gauche en premier) : sert à placer la somme.
  const cages = best.cages.map((c) => c.slice().sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  return {
    puzzle: new Array(81).fill(0),
    solution: best.solution,
    cages,
    sums: sumsOf(cages, best.solution),
  };
}
