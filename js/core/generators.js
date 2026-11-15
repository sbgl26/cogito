// Table des générateurs, partagée entre le worker et le repli sur le fil principal.
// Avec une graine (défi du jour), la même demande produit la même grille partout.

import { seed } from './rng.js';
import { generateSudoku, generateKiller } from '../games/sudoku/engine.js';
import { generateNonogram, COLOR_LEVELS } from '../games/nonogram/engine.js';
import { generateSums } from '../games/sums/engine.js';
import { generateTri } from '../games/tri/engine.js';
import { generateMatch } from '../games/match/engine.js';
import { deal, dealSpider } from '../games/solitaire/engine.js';

const TABLE = {
  sudoku: generateSudoku,
  killer: generateKiller,
  nonogram: generateNonogram,
  nonocolor: (level) => generateNonogram(level, COLOR_LEVELS),
  sums: generateSums,
  tri: generateTri,
  match: generateMatch,
  solitaire: deal,
  spider: dealSpider,
  blocs: () => ({}),
  g2048: () => ({}),
  mines: () => ({}),
  scierie: () => ({}),
  sushi: () => ({}),
};

export function runGenerator(game, level, seedValue = null) {
  if (!TABLE[game]) throw new Error('Jeu inconnu : ' + game);
  seed(seedValue);
  try { return TABLE[game](level); } finally { seed(null); }
}
