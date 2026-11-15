// Worker de génération : les grilles se calculent hors du fil d'affichage.

import { runGenerator } from './generators.js';

self.onmessage = (e) => {
  const { id, game, level, seed } = e.data;
  try {
    self.postMessage({ id, data: runGenerator(game, level, seed) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
