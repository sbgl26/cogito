// Hasard « à graine » : sans graine, Math.random ; avec une graine, une suite
// reproductible (mulberry32). Sert au défi du jour : même date, même grille pour tous.

let state = null;

export function seed(n) {
  state = n == null ? null : (n >>> 0) || 1;
}

export function rand() {
  if (state === null) return Math.random();
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const pick = (list) => list[(rand() * list.length) | 0];

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Graine stable à partir d'un texte (date + jeu).
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
