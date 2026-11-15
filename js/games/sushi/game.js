// « Sushi express » : les chefs posent des assiettes sur un tapis roulant, les clients
// assis autour se servent au passage. Jeu de gestion sans fin.

import { h } from '../../core/ui.js';
import { createStage, box, cyl, ball, person, group, at } from '../../idle/kit.js';
import { createIdle } from '../../idle/hud.js';

const L = 9, R = 2.9;                     // longueur des lignes droites, rayon des virages
const LOOP = 2 * L + 2 * Math.PI * R;     // longueur du tapis
const EAT = 2.6, ARRIVE = 2.2;            // secondes
const PLATES = ['#FF8787', '#FFD43B', '#74C0FC', '#8CE99A', '#E599F7'];
const GUESTS = ['#FF6B6B', '#FFD43B', '#4DABF7', '#F783AC', '#63E6BE', '#FFA94D', '#B197FC'];

const rate = (s) => 0.45 * (1 + 0.3 * s.lv.chefs);      // assiettes par seconde
const belt = (s) => 1.7 * (1 + 0.12 * s.lv.belt);        // unités par seconde
const worth = (s) => Math.round(4 * Math.pow(1.4, s.lv.menu));
const seats = (s) => 4 + 2 * s.lv.seats;

const UPGRADES = [
  { key: 'chefs', label: 'Chef', icon: '🍣', base: 15, growth: 1.7, max: 14, hint: (s) => `${rate(s).toFixed(1).replace('.', ',')} assiette/s` },
  { key: 'belt', label: 'Tapis', icon: '⚡', base: 25, growth: 1.6, max: 15, hint: (s) => `× ${(1 + 0.12 * s.lv.belt).toFixed(2).replace('.', ',')}` },
  { key: 'menu', label: 'Carte', icon: '⭐', base: 60, growth: 1.8, max: 40, hint: (s) => `${worth(s)} par assiette` },
  { key: 'seats', label: 'Tabouret', icon: '🪑', base: 35, growth: 1.75, max: 8, hint: (s) => `${seats(s)} places` },
];

const income = (s) => Math.min(rate(s), seats(s) / (EAT + ARRIVE + 1.5)) * worth(s);

// Position et direction sur le tapis à la distance d (piste en forme de stade).
function track(d) {
  d = ((d % LOOP) + LOOP) % LOOP;
  if (d < L) return { x: R, z: L / 2 - d, nx: 1, nz: 0 };
  d -= L;
  if (d < Math.PI * R) { const a = d / R; return { x: R * Math.cos(a), z: -L / 2 - R * Math.sin(a), nx: Math.cos(a), nz: -Math.sin(a) }; }
  d -= Math.PI * R;
  if (d < L) return { x: -R, z: -L / 2 + d, nx: -1, nz: 0 };
  d -= L;
  const a = d / R;
  return { x: -R * Math.cos(a), z: L / 2 + R * Math.sin(a), nx: -Math.cos(a), nz: Math.sin(a) };
}

function init() {
  return { cash: 0, total: 0, lv: { chefs: 0, belt: 0, menu: 0, seats: 0 }, seen: Date.now() };
}

function mount(host, state, api) {
  let stage = null, hud = null, dead = false;
  const wrap = h('div', { class: 'idle' });
  host.append(wrap);

  (async () => {
    stage = await createStage(wrap, { ground: '#F2D9A6', span: 14.5, lookZ: 0.2 });
    if (dead) { if (stage) stage.dispose(); return; }
    if (!stage) { wrap.append(h('p', { class: 'idle-fail' }, 'Ce jeu a besoin de la 3D, indisponible sur cet appareil.')); return; }
    const { scene } = stage;

    // ----- Décor : sol en damier, tapis, comptoir central -----
    for (let i = -4; i <= 4; i++) {
      for (let j = -9; j <= 9; j++) {
        if ((i + j) % 2) scene.add(at(box(2, 0.02, 2, '#E6C88E'), i * 2, 0.01, j * 2));
      }
    }
    const SEG = 72;
    for (let k = 0; k < SEG; k++) {
      const p = track((k / SEG) * LOOP);
      const slab = box(1.25, 0.5, LOOP / SEG + 0.06, k % 2 ? '#495057' : '#555D66');
      slab.rotation.y = Math.atan2(p.nx, p.nz) + Math.PI / 2;
      scene.add(at(slab, p.x, 0.25, p.z));
    }
    scene.add(at(box(2 * R - 1.5, 0.9, L, '#D9A066'), 0, 0.45, 0));
    scene.add(at(cyl(R - 0.75, R - 0.75, 0.9, '#D9A066', 20), 0, 0.45, -L / 2));
    scene.add(at(cyl(R - 0.75, R - 0.75, 0.9, '#D9A066', 20), 0, 0.45, L / 2));
    scene.add(at(box(2 * R - 2.1, 0.08, L, '#F1C27D'), 0, 0.94, 0));
    for (const [x, z] of [[-7, -10.5], [7, -10.5], [-7.2, 10.3], [7.2, 10.3]]) {
      scene.add(at(group(at(cyl(0.5, 0.4, 0.7, '#C2410C', 8), 0, 0.35, 0), at(ball(0.75, '#40C057', 0), 0, 1.25, 0), at(ball(0.5, '#2F9E44', 0), 0.3, 1.9, 0.1)), x, 0, z));
    }

    // ----- Chefs (au centre) -----
    const chefs = [];
    function syncChefs() {
      const want = Math.min(4, 1 + Math.floor(state.lv.chefs / 3));
      while (chefs.length < want) {
        const g = person('#FFFFFF', '#FFD8A8');
        g.add(at(cyl(0.2, 0.22, 0.3, '#FFFFFF', 8), 0, 1.45, 0));
        scene.add(at(g, 0.55, 0.98, L / 2 - 1.2 - chefs.length * 2.2));
        chefs.push(g);
      }
    }

    // ----- Places assises autour du tapis -----
    const places = [];
    function syncSeats() {
      const want = seats(state);
      while (places.length < want) {
        // On répartit en alternant les côtés pour que la salle se remplisse harmonieusement.
        const k = places.length;
        const d = ((k * 0.61803) % 1) * LOOP;
        const p = track(d);
        const x = p.x + p.nx * 1.55, z = p.z + p.nz * 1.55;
        scene.add(at(cyl(0.34, 0.26, 0.5, '#E03131', 10), x, 0.25, z));
        const guest = person(GUESTS[k % GUESTS.length]);
        guest.scale.setScalar(0.001);
        scene.add(at(guest, x, 0.45, z));
        const dish = cyl(0.3, 0.3, 0.06, '#FFFFFF', 12);
        dish.visible = false;
        scene.add(at(dish, p.x + p.nx * 0.95, 0.62, p.z + p.nz * 0.95));
        places.push({ d, x, z, guest, dish, mode: 'empty', t: Math.random() * ARRIVE, size: 0 });
      }
    }

    // ----- Assiettes -----
    const plates = [];
    let sinceSpawn = 0;
    function spawn() {
      const color = PLATES[(Math.random() * PLATES.length) | 0];
      const g = group(cyl(0.44, 0.4, 0.07, color, 14), at(cyl(0.36, 0.36, 0.04, '#FFFFFF', 14), 0, 0.05, 0),
        at(box(0.34, 0.14, 0.2, '#FFFFFF'), 0, 0.14, 0), at(box(0.36, 0.07, 0.22, Math.random() < 0.5 ? '#FF922B' : '#FA5252'), 0, 0.24, 0));
      scene.add(g);
      plates.push({ g, d: 0 });
    }

    function update(dt, now) {
      // Les chefs déposent une assiette en début de tapis s'il y a la place.
      sinceSpawn += dt;
      if (sinceSpawn >= 1 / rate(state) && plates.length < 46 && !plates.some((p) => p.d < 0.95)) {
        sinceSpawn = 0;
        spawn();
      }
      const move = belt(state) * dt;
      for (let i = plates.length - 1; i >= 0; i--) {
        const pl = plates[i];
        const before = pl.d;
        pl.d += move;
        const p = track(pl.d);
        pl.g.position.set(p.x, 0.54, p.z);
        // Un client qui a faim prend l'assiette qui passe devant lui.
        const taker = places.find((s) => s.mode === 'hungry' && before % LOOP <= s.d && (before % LOOP) + move > s.d);
        if (taker) {
          scene.remove(pl.g);
          plates.splice(i, 1);
          taker.mode = 'eating';
          taker.t = EAT;
          taker.dish.visible = true;
          hud.earn(worth(state), stage.project(taker.x, 1.9, taker.z));
        }
      }
      for (const s of places) {
        if (s.mode === 'empty') {
          s.t -= dt;
          s.size = Math.max(0, s.size - dt * 5);
          if (s.t <= 0) s.mode = 'arriving';
        } else if (s.mode === 'arriving') {
          s.size = Math.min(1, s.size + dt * 4);
          if (s.size >= 1) s.mode = 'hungry';
        } else if (s.mode === 'eating') {
          s.t -= dt;
          s.guest.rotation.z = Math.sin(now * 12) * 0.12;
          if (s.t <= 0) { s.mode = 'empty'; s.t = ARRIVE * (0.6 + Math.random() * 0.8); s.dish.visible = false; s.guest.rotation.z = 0; }
        }
        s.guest.scale.setScalar(Math.max(0.001, s.size * 1.25));
        s.guest.position.y = 0.45 + (s.mode === 'hungry' ? Math.abs(Math.sin(now * 5 + s.d)) * 0.06 : 0);
      }
      chefs.forEach((c, k) => { c.rotation.y = Math.sin(now * 3 + k) * 0.5; });
      hud.refresh();
    }

    hud = createIdle({
      host: wrap, state, api, upgrades: UPGRADES, income: () => income(state),
      onBuy: () => { syncChefs(); syncSeats(); },
    });
    syncChefs();
    syncSeats();
    stage.onFrame = update;
  })();

  return {
    destroy() { dead = true; if (hud) hud.destroy(); if (stage) stage.dispose(); },
  };
}

export const sushiDef = {
  id: 'sushi',
  title: 'Sushi express',
  tagline: 'Un tapis roulant qui rapporte',
  levels: null,
  mode: 'idle',
  income,
  rules: [
    'Vos chefs posent des assiettes sur le tapis roulant. Chaque client assis autour prend la première qui passe devant lui et paie.',
    'Réinvestissez : plus de chefs (plus d’assiettes), un tapis plus rapide, une meilleure carte (chaque assiette vaut plus) et davantage de tabourets.',
    'Le restaurant continue de tourner quand l’app est fermée, à mi-régime et pendant quatre heures au plus.',
  ],
  init, mount,
};
