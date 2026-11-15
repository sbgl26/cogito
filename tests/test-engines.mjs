import {
  generateSudoku, countSolutions, logicLevel, SUDOKU_LEVELS,
  generateKiller, killerCount, KILLER_LEVELS,
} from '../js/games/sudoku/engine.js';
import { generateNonogram, lineSolve, allClues, NONO_LEVELS } from '../js/games/nonogram/engine.js';

const N = Number(process.argv[2] || 15);
let fail = 0;
const check = (cond, msg) => { if (!cond) { fail++; console.log('  ÉCHEC', msg); } };
const validSolution = (s) => {
  for (let u = 0; u < 9; u++) {
    const row = new Set(), col = new Set(), box = new Set();
    for (let k = 0; k < 9; k++) {
      row.add(s[u * 9 + k]); col.add(s[k * 9 + u]);
      box.add(s[(((u / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (u % 3) * 3 + (k % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
};

console.log('— Sudoku');
for (const level of Object.keys(SUDOKU_LEVELS)) {
  let tMax = 0, tSum = 0, clues = [], lv = {};
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const { puzzle, solution } = generateSudoku(level);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    check(validSolution(solution), 'solution invalide');
    check(countSolutions(puzzle, 2) === 1, `${level}: solution non unique`);
    check(puzzle.every((v, k) => v === 0 || v === solution[k]), 'indice ≠ solution');
    clues.push(puzzle.filter(Boolean).length);
    const l = logicLevel(puzzle, 2); lv[l] = (lv[l] || 0) + 1;
  }
  console.log(`  ${level.padEnd(10)} indices ${Math.min(...clues)}–${Math.max(...clues)}  logique ${JSON.stringify(lv)}  moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

console.log('— Killer');
for (const level of Object.keys(KILLER_LEVELS)) {
  let tMax = 0, tSum = 0, singles = [], sizes = [], ncages = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const { solution, cages, sums } = generateKiller(level);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    check(validSolution(solution), 'solution invalide');
    check(killerCount(cages, sums, 2, null, 5e6) === 1, `${level}: solution non unique`);
    const seen = new Set(cages.flat());
    check(seen.size === 81 && cages.flat().length === 81, 'cages ne couvrent pas 81 cases');
    check(cages.every((c) => new Set(c.map((x) => solution[x])).size === c.length), 'chiffre répété dans une cage');
    check(cages.every((c, k) => c.reduce((s, x) => s + solution[x], 0) === sums[k]), 'somme fausse');
    // connexité
    check(cages.every((c) => {
      const seen = new Set([c[0]]), st = [c[0]];
      while (st.length) { const x = st.pop(); for (const y of c) if (!seen.has(y) && ((Math.abs(x - y) === 1 && ((x / 9) | 0) === ((y / 9) | 0)) || Math.abs(x - y) === 9)) { seen.add(y); st.push(y); } }
      return seen.size === c.length;
    }), 'cage non connexe');
    singles.push(cages.filter((c) => c.length === 1).length);
    sizes.push(Math.max(...cages.map((c) => c.length)));
    ncages.push(cages.length);
  }
  console.log(`  ${level.padEnd(10)} cages ${Math.min(...ncages)}–${Math.max(...ncages)}  isolées ${Math.min(...singles)}–${Math.max(...singles)}  moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

console.log('— Nonogram');
for (const level of Object.keys(NONO_LEVELS)) {
  let tMax = 0, tSum = 0, fill = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const p = generateNonogram(level);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    const { rows, cols } = allClues(p.solution, p.size);
    check(JSON.stringify(rows) === JSON.stringify(p.rows) && JSON.stringify(cols) === JSON.stringify(p.cols), 'indices incohérents');
    check(lineSolve(p.rows, p.cols, p.size) === 0, `${level}: non résoluble par logique`);
    fill.push(Math.round((p.solution.reduce((a, b) => a + b, 0) / p.solution.length) * 100));
  }
  console.log(`  ${level.padEnd(10)} remplissage ${Math.min(...fill)}–${Math.max(...fill)} %  moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

// ---------- Lot 2 ----------
const { COLOR_LEVELS } = await import('../js/games/nonogram/engine.js');
const { generateSums, countSolutions: sumsCount, SUMS_LEVELS } = await import('../js/games/sums/engine.js');
const { generateTri, solvable, isSorted, TRI_LEVELS, CAP } = await import('../js/games/tri/engine.js');
const M = await import('../js/games/match/engine.js');
const B = await import('../js/games/blocs/engine.js');
const S = await import('../js/games/solitaire/engine.js');
const { runGenerator } = await import('../js/core/generators.js');

console.log('— Nonogram couleur');
for (const level of Object.keys(COLOR_LEVELS)) {
  let tMax = 0, tSum = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const p = generateNonogram(level, COLOR_LEVELS);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    check(lineSolve(p.rows, p.cols, p.size, p.colors) === 0, `${level}: non résoluble par logique`);
    check(new Set(p.solution.filter(Boolean)).size === p.colors, `${level}: couleurs manquantes`);
  }
  console.log(`  ${level.padEnd(10)} moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

console.log('— Sommes');
for (const level of Object.keys(SUMS_LEVELS)) {
  let tMax = 0, tSum = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const p = generateSums(level);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    check(sumsCount(p.nums, p.size, p.rowT, p.colT, 2, 5e6) === 1, `${level}: solution non unique`);
    const n = p.size;
    check(p.rowT.every((t, r) => t === p.nums.slice(r * n, r * n + n).reduce((s, v, c) => s + (p.keep[r * n + c] ? v : 0), 0)), 'total de ligne faux');
  }
  console.log(`  ${level.padEnd(10)} moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

console.log('— Tri de couleurs');
for (const level of Object.keys(TRI_LEVELS)) {
  let tMax = 0, tSum = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const p = generateTri(level);
    const dt = performance.now() - t; tMax = Math.max(tMax, dt); tSum += dt;
    check(p.tubes.length === p.colors + 2 && p.tubes.flat().length === p.colors * CAP, 'tubes incohérents');
    check(solvable(p.tubes, 400000) === true, `${level}: départ sans solution trouvée`);
    check(!isSorted(p.tubes), 'déjà trié');
  }
  console.log(`  ${level.padEnd(10)} moy ${(tSum / N).toFixed(0)} ms  max ${tMax.toFixed(0)} ms`);
}

console.log('— Paires');
{
  let cleared = 0, games = 40;
  for (let i = 0; i < games; i++) {
    let { cells } = M.generateMatch();
    check(cells.length === 36 && cells.every((v) => v >= 1 && v <= 9), 'plateau invalide');
    let adds = 4;
    for (let guard = 0; guard < 3000; guard++) {
      const pair = M.findPair(cells);
      if (pair) {
        check(M.linked(cells, pair[0], pair[1]) && M.matches(cells[pair[0]], cells[pair[1]]), 'paire proposée invalide');
        cells[pair[0]] *= -1; cells[pair[1]] *= -1; cells = M.dropEmptyRows(cells);
      } else if (adds-- > 0 && M.remaining(cells)) cells = M.addRows(cells);
      else break;
    }
    if (M.remaining(cells) === 0) cleared++;
  }
  // règles : 7 et 3 voisins, bout de ligne → ligne suivante, diagonale, obstacle
  const g = [7, 3, 1, 1, 1, 1, 1, 1, 4, 6, 2, 2, 2, 2, 2, 2, 2, 2, 5, 9, 8, 8, 8, 8, 8, 8, 8];
  check(M.linked(g, 0, 1) && M.linked(g, 8, 9) && M.linked(g, 0, 10) && !M.linked(g, 0, 20) && !M.linked(g, 0, 2) && M.linked(g, 1, 9), 'règles de voisinage');
  const g2 = g.slice(); g2[10] = -2; check(M.linked(g2, 0, 20), 'diagonale à travers une case vidée');
  console.log(`  joueur glouton : ${cleared}/${games} plateaux vidés`);
}

console.log('— Blocs');
{
  const board = new Array(81).fill(0);
  check(B.dealPieces(board).length === 3, 'distribution');
  for (let c = 0; c < 9; c++) board[c] = 1;
  check(B.fullUnits(board).length === 1, 'ligne complète détectée');
  for (let i = 0; i < 81; i++) board[i] = 1;
  check(B.fullUnits(board).length === 27 && !B.anyFit(board, [[0, 0]]), 'plateau plein');
  check(B.scoreFor(4, 0, 0) === 4 && B.scoreFor(3, 2, 1) === 3 + 36 + 20 + 9, 'barème');
  let cells = new Set(); for (let i = 0; i < 3000; i++) cells.add(B.randomPiece().length);
  check([...cells].every((n) => n >= 1 && n <= 9), 'tailles de pièces');
}

console.log('— Solitaire');
{
  const s = S.deal('trois');
  const all = [...s.stock, ...s.tableau.flat().map((c) => c[0])];
  check(new Set(all).size === 52 && s.stock.length === 24 && s.draw === 3, 'donne de 52 cartes');
  check(s.tableau.every((col, k) => col.length === k + 1 && col[k][1] === 1 && col.slice(0, k).every((c) => c[1] === 0)), 'colonnes 1 à 7, dernière carte visible');
  check(S.canFoundation(13, []) && !S.canFoundation(14, []) && S.canFoundation(14, [13]) && !S.canFoundation(1, [13]), 'fondations');
  check(S.canTableau(12, []) && !S.canTableau(11, []) && S.canTableau(11 + 13, [[12, 1]]) && !S.canTableau(11, [[12, 1]]) && !S.canTableau(11 + 13, [[12, 0]]), 'colonnes');
}

console.log('— Défi du jour (graine)');
for (const [game, level] of [['sudoku', 'moyen'], ['killer', 'moyen'], ['nonogram', 'moyen'], ['nonocolor', 'moyen'], ['sums', 'moyen'], ['tri', 'moyen'], ['match', null], ['solitaire', 'un']]) {
  const a = JSON.stringify(runGenerator(game, level, 12345)), b = JSON.stringify(runGenerator(game, level, 12345)), c = JSON.stringify(runGenerator(game, level, 999));
  check(a === b && a !== c, `${game}: même graine ⇒ même grille`);
}

console.log(fail ? `\n${fail} ÉCHEC(S)` : '\nTout est OK');
process.exit(fail ? 1 : 0);
