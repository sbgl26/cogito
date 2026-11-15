// Moteur « Sommes » : une grille de chiffres, un total par ligne et par colonne.
// Il faut garder les bons chiffres pour que chaque total tombe juste. Solution unique.

import { rand } from '../../core/rng.js';

export const SUMS_LEVELS = {
  facile: { label: '5 × 5', size: 5 },
  moyen: { label: '6 × 6', size: 6 },
  difficile: { label: '7 × 7', size: 7 },
  expert: { label: '8 × 8', size: 8 },
};

// Compte les façons de choisir les chiffres (jusqu'à « limit »). -1 si trop long.
export function countSolutions(nums, n, rowT, colT, limit = 2, nodeLimit = 400000) {
  // Pour chaque ligne : les sous-ensembles (masques) dont la somme vaut le total.
  const options = [];
  for (let r = 0; r < n; r++) {
    const list = [];
    for (let m = 0; m < 1 << n; m++) {
      let s = 0;
      for (let c = 0; c < n; c++) if (m & (1 << c)) s += nums[r * n + c];
      if (s === rowT[r]) list.push(m);
    }
    if (!list.length) return 0;
    options.push(list);
  }
  // Ce que les lignes restantes peuvent encore apporter à chaque colonne.
  const reach = Array.from({ length: n + 1 }, () => new Array(n).fill(0));
  for (let r = n - 1; r >= 0; r--) for (let c = 0; c < n; c++) reach[r][c] = reach[r + 1][c] + nums[r * n + c];
  const sum = new Array(n).fill(0);
  let count = 0, nodes = 0, aborted = false;
  (function rec(r) {
    if (++nodes > nodeLimit) { aborted = true; return; }
    if (r === n) { count++; return; }
    for (const m of options[r]) {
      let ok = true;
      for (let c = 0; c < n; c++) {
        const v = sum[c] + (m & (1 << c) ? nums[r * n + c] : 0);
        if (v > colT[c] || v + reach[r + 1][c] < colT[c]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let c = 0; c < n; c++) if (m & (1 << c)) sum[c] += nums[r * n + c];
      rec(r + 1);
      for (let c = 0; c < n; c++) if (m & (1 << c)) sum[c] -= nums[r * n + c];
      if (count >= limit || aborted) return;
    }
  })(0);
  return aborted ? -1 : count;
}

export function generateSums(level) {
  const n = (SUMS_LEVELS[level] || SUMS_LEVELS.moyen).size;
  let last = null;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const nums = Array.from({ length: n * n }, () => 1 + ((rand() * 9) | 0));
    const keep = nums.map(() => (rand() < 0.48 ? 1 : 0));
    const rowT = [], colT = [];
    let fine = true;
    for (let i = 0; i < n && fine; i++) {
      let rs = 0, cs = 0, rk = 0, ck = 0;
      for (let j = 0; j < n; j++) {
        if (keep[i * n + j]) { rs += nums[i * n + j]; rk++; }
        if (keep[j * n + i]) { cs += nums[j * n + i]; ck++; }
      }
      // Chaque ligne et chaque colonne garde au moins un chiffre et en perd au moins un.
      if (!rk || !ck || rk === n || ck === n) fine = false;
      rowT.push(rs); colT.push(cs);
    }
    if (!fine) continue;
    last = { size: n, nums, keep, rowT, colT };
    if (countSolutions(nums, n, rowT, colT, 2) === 1) return last;
  }
  return last;
}
