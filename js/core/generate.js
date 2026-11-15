// Génère une grille dans un worker ; si les workers « module » ne sont pas
// disponibles, calcule sur le fil principal après avoir laissé l'écran se peindre.

import { runGenerator } from './generators.js';

let worker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function onMainThread(game, level, seed) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(runGenerator(game, level, seed)); } catch (e) { reject(e); }
    }, 40);
  });
}

function ensureWorker() {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.error) onMainThread(job.game, job.level, job.seed).then(job.resolve, job.reject);
      else job.resolve(e.data.data);
    };
    worker.onerror = () => {
      // Worker inutilisable : on bascule tout ce qui attend sur le fil principal.
      workerBroken = true;
      worker = null;
      for (const job of pending.values()) onMainThread(job.game, job.level, job.seed).then(job.resolve, job.reject);
      pending.clear();
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

export function generate(game, level, seed = null) {
  const w = ensureWorker();
  if (!w) return onMainThread(game, level, seed);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { game, level, seed, resolve, reject });
    w.postMessage({ id, game, level, seed });
    // Garde-fou : un worker muet ne doit jamais bloquer la partie.
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      onMainThread(game, level, seed).then(resolve, reject);
    }, 9000);
  });
}
