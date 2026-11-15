// Moteur Nonogram (noir et blanc ou en couleurs) : génération d'images résolubles
// par pure logique, sans deviner. Aucune dépendance au DOM : testable sous Node.
// Une case vaut 0 (vide) ou 1..K (couleur). Un indice est un couple [longueur, couleur].

import { rand } from '../../core/rng.js';

export const NONO_LEVELS = {
  petit: { label: '5 × 5', size: 5 },
  moyen: { label: '10 × 10', size: 10 },
  grand: { label: '15 × 15', size: 15 },
};

export const COLOR_LEVELS = {
  petit: { label: '5 × 5, deux couleurs', size: 5, colors: 2 },
  moyen: { label: '10 × 10, trois couleurs', size: 10, colors: 3 },
  grand: { label: '15 × 15, quatre couleurs', size: 15, colors: 4 },
};

// Indices d'une ligne : blocs de cases consécutives de même couleur.
export function cluesOf(line) {
  const out = [];
  let run = 0, col = 0;
  for (const v of line) {
    if (v && v === col) { run++; continue; }
    if (run) out.push([run, col]);
    run = v ? 1 : 0;
    col = v;
  }
  if (run) out.push([run, col]);
  return out;
}

export const rowOf = (grid, n, r) => Array.from({ length: n }, (_, c) => grid[r * n + c]);
export const colOf = (grid, n, c) => Array.from({ length: n }, (_, r) => grid[r * n + c]);

export function allClues(solution, n) {
  const rows = [], cols = [];
  for (let i = 0; i < n; i++) {
    rows.push(cluesOf(rowOf(solution, n, i)));
    cols.push(cluesOf(colOf(solution, n, i)));
  }
  return { rows, cols };
}

// Réduit les possibilités d'une ligne. masks[i] est un masque de bits : bit 0 = vide,
// bit c = couleur c. Deux blocs voisins de même couleur exigent une case vide entre eux ;
// de couleurs différentes, ils peuvent se toucher. Renvoie false si contradiction.
function solveLine(masks, clues) {
  const n = masks.length, k = clues.length;
  const can = new Uint16Array(n);
  const memo = new Int8Array((n + 1) * (k + 1)).fill(-1);
  const rec = (pos, ci) => {
    if (pos >= n) return ci === k ? 1 : 0;
    const key = pos * (k + 1) + ci;
    if (memo[key] >= 0) return memo[key];
    let ok = 0;
    if ((masks[pos] & 1) && rec(pos + 1, ci)) { can[pos] |= 1; ok = 1; }
    if (ci < k) {
      const len = clues[ci][0], bit = 1 << clues[ci][1], end = pos + len;
      if (end <= n) {
        let fits = true;
        for (let x = pos; x < end; x++) if (!(masks[x] & bit)) { fits = false; break; }
        if (fits) {
          const needGap = ci + 1 < k && clues[ci + 1][1] === clues[ci][1];
          let done = 0;
          if (needGap) {
            if (end < n && (masks[end] & 1) && rec(end + 1, ci + 1)) { can[end] |= 1; done = 1; }
          } else if (rec(end, ci + 1)) done = 1;
          if (done) {
            for (let x = pos; x < end; x++) can[x] |= bit;
            ok = 1;
          }
        }
      }
    }
    memo[key] = ok;
    return ok;
  };
  if (!rec(0, 0)) return false;
  for (let i = 0; i < n; i++) masks[i] &= can[i];
  return true;
}

const single = (m) => (m & (m - 1)) === 0;

// Propagation ligne à ligne. Renvoie le nombre de cases restées indécises
// (0 = entièrement résoluble par logique, donc solution unique), -1 si incohérent.
export function lineSolve(rows, cols, n, colors = 1) {
  const g = new Uint16Array(n * n).fill((1 << (colors + 1)) - 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) {
      const line = Uint16Array.from({ length: n }, (_, c) => g[r * n + c]);
      if (!solveLine(line, rows[r])) return -1;
      for (let c = 0; c < n; c++) if (g[r * n + c] !== line[c]) { g[r * n + c] = line[c]; changed = true; }
    }
    for (let c = 0; c < n; c++) {
      const line = Uint16Array.from({ length: n }, (_, r) => g[r * n + c]);
      if (!solveLine(line, cols[c])) return -1;
      for (let r = 0; r < n; r++) if (g[r * n + c] !== line[r]) { g[r * n + c] = line[r]; changed = true; }
    }
  }
  let unknown = 0;
  for (let i = 0; i < n * n; i++) if (!single(g[i])) unknown++;
  return unknown;
}

// Image aléatoire « organique » : bruit + lissage, une fois sur deux symétrique.
// En couleurs, la teinte suit une carte grossière : on obtient des aplats.
function randomPicture(n, colors) {
  const density = (colors > 1 ? 0.52 : 0.44) + rand() * 0.14;
  const mirror = rand() < 0.5;
  let g = new Array(n * n).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (mirror && c >= Math.ceil(n / 2)) g[r * n + c] = g[r * n + (n - 1 - c)];
      else g[r * n + c] = rand() < density ? 1 : 0;
    }
  }
  if (n > 5) {
    const next = g.slice();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let around = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < n && cc >= 0 && cc < n) around += g[rr * n + cc];
          }
        }
        if (around >= 6) next[r * n + c] = 1;
        else if (around <= 1) next[r * n + c] = 0;
      }
    }
    g = next;
  }
  if (colors > 1) {
    const block = Math.ceil(n / 3);
    const coarse = Array.from({ length: 9 }, () => 1 + ((rand() * colors) | 0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!g[r * n + c]) continue;
        const cc = mirror && c >= Math.ceil(n / 2) ? n - 1 - c : c;
        g[r * n + c] = coarse[((r / block) | 0) * 3 + ((cc / block) | 0)];
      }
    }
  }
  return g;
}

export function generateNonogram(level, table = NONO_LEVELS) {
  const spec = table[level] || table.moyen;
  const n = spec.size, colors = spec.colors || 1;
  const maxFill = colors > 1 ? 0.78 : 0.68;
  let best = null;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const solution = randomPicture(n, colors);
    const filled = solution.reduce((a, b) => a + (b ? 1 : 0), 0);
    if (filled < n * n * 0.36 || filled > n * n * maxFill) continue;
    if (colors > 1 && new Set(solution.filter(Boolean)).size < colors) continue;
    const { rows, cols } = allClues(solution, n);
    // Pas de ligne ni de colonne vide : visuellement plus intéressant.
    if (rows.some((r) => !r.length) || cols.some((c) => !c.length)) continue;
    const unknown = lineSolve(rows, cols, n, colors);
    if (unknown === 0) return { size: n, colors, solution, rows, cols };
    if (!best || unknown < best.unknown) best = { solution, unknown };
  }
  // Filet de sécurité : on « répare » la meilleure candidate en remplissant
  // des cases jusqu'à ce que la logique suffise.
  const solution = best ? best.solution : new Array(n * n).fill(1);
  for (let guard = 0; guard < n * n; guard++) {
    const { rows, cols } = allClues(solution, n);
    if (lineSolve(rows, cols, n, colors) === 0) return { size: n, colors, solution, rows, cols };
    const empties = solution.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!empties.length) break;
    solution[empties[(rand() * empties.length) | 0]] = 1;
  }
  const { rows, cols } = allClues(solution, n);
  return { size: n, colors, solution, rows, cols };
}
