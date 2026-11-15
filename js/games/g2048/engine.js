// Moteur « 2048 » : on glisse toutes les tuiles dans une direction ; deux tuiles
// identiques qui se touchent fusionnent. Une tuile = { id, v, r, c }.

export const SIZE = 4;

let nextId = 1;
export const freshId = () => nextId++;
export const syncIds = (tiles) => { nextId = Math.max(nextId, ...tiles.map((t) => t.id + 1)); };

export function spawn(tiles) {
  const taken = new Set(tiles.map((t) => t.r * SIZE + t.c));
  const free = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[(Math.random() * free.length) | 0];
  const tile = { id: freshId(), v: Math.random() < 0.9 ? 2 : 4, r: (i / SIZE) | 0, c: i % SIZE };
  tiles.push(tile);
  return tile;
}

// dir : 0 gauche, 1 droite, 2 haut, 3 bas. Renvoie { tiles, gained, moved, merged, gone }.
// « gone » liste les tuiles absorbées, avec la case où elles glissent avant de disparaître.
export function slide(tiles, dir) {
  const out = [], gone = [], merged = [];
  let gained = 0, moved = false;
  for (let line = 0; line < SIZE; line++) {
    const horizontal = dir < 2, reverse = dir === 1 || dir === 3;
    const row = tiles.filter((t) => (horizontal ? t.r : t.c) === line)
      .sort((a, b) => (horizontal ? a.c - b.c : a.r - b.r) * (reverse ? -1 : 1));
    let pos = 0, last = null;
    for (const t of row) {
      if (last && last.v === t.v && !last.fused) {
        gone.push({ ...t, r: last.r, c: last.c });
        last.v *= 2; last.fused = true;
        gained += last.v; merged.push(last.id); moved = true;
        continue;
      }
      const at = reverse ? SIZE - 1 - pos : pos;
      const nt = { id: t.id, v: t.v, r: horizontal ? line : at, c: horizontal ? at : line };
      if (nt.r !== t.r || nt.c !== t.c) moved = true;
      out.push(nt); last = nt; pos++;
    }
  }
  out.forEach((t) => delete t.fused);
  return { tiles: out, gained, moved, merged, gone };
}

export function canMove(tiles) {
  if (tiles.length < SIZE * SIZE) return true;
  return [0, 1, 2, 3].some((d) => slide(tiles.map((t) => ({ ...t })), d).moved);
}
