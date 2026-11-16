// « Sushi express » : les chefs posent des assiettes sur un tapis roulant, les clients
// assis autour se servent au passage. Jeu de gestion sans fin.

import { h } from '../../core/ui.js';
import { createStage, plankTexture, group, at, turn, cyl, ball, dome, rbox, slab, stadium, blob, person } from '../../idle/kit.js';
import { createIdle } from '../../idle/hud.js';
import { ICONS } from '../../idle/icons.js';

const L = 9, R = 2.9;                     // longueur des lignes droites, rayon des virages
const LOOP = 2 * L + 2 * Math.PI * R;     // longueur du tapis
const EAT = 2.6, ARRIVE = 2.2;            // secondes
const TOP = 0.56;                         // hauteur de la surface du tapis
const RIMS = ['#FF8787', '#FFD43B', '#74C0FC', '#8CE99A', '#E599F7'];
const SHIRTS = ['#FF6B6B', '#4DABF7', '#FFA94D', '#F783AC', '#63E6BE', '#B197FC', '#FFD43B'];

const rate = (s) => 0.45 * (1 + 0.3 * s.lv.chefs);      // assiettes par seconde
const belt = (s) => 1.7 * (1 + 0.12 * s.lv.belt);        // unités par seconde
const worth = (s) => Math.round(4 * Math.pow(1.4, s.lv.menu));
const seats = (s) => 4 + 2 * s.lv.seats;

const UPGRADES = [
  { key: 'chefs', label: 'Chef', icon: ICONS.toque, base: 15, growth: 1.7, max: 14, hint: (s) => `${rate(s).toFixed(1).replace('.', ',')} assiette/s` },
  { key: 'belt', label: 'Tapis', icon: ICONS.tapis, base: 25, growth: 1.6, max: 15, hint: (s) => `× ${(1 + 0.12 * s.lv.belt).toFixed(2).replace('.', ',')}` },
  { key: 'menu', label: 'Carte', icon: ICONS.etoile, base: 60, growth: 1.8, max: 40, hint: (s) => `${worth(s)} par assiette` },
  { key: 'seats', label: 'Tabouret', icon: ICONS.tabouret, base: 35, growth: 1.75, max: 8, hint: (s) => `${seats(s)} places` },
];

const income = (s) => Math.min(rate(s), seats(s) / (EAT + ARRIVE + 1.5)) * worth(s);

// Position et normale extérieure sur le tapis à la distance d (piste en forme de stade).
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
    stage = await createStage(wrap, {
      ground: '#B98549', span: 14.6, lookZ: 0.5, repeat: 13, floorLook: { roughness: 0.38, envMapIntensity: 0.75 }, // parquet verni
      floor: () => plankTexture(['#BE8A4C', '#B07C40', '#C99658', '#A47038'], 'rgba(60, 35, 12, 0.5)'),
    });
    if (dead) { if (stage) stage.dispose(); return; }
    if (!stage) { wrap.append(h('p', { class: 'idle-fail' }, 'Ce jeu a besoin de la 3D, indisponible sur cet appareil.')); return; }
    const { scene } = stage;
    const add = (obj, x, y, z) => { scene.add(at(obj, x, y, z)); return obj; };
    const steel = { metal: 1, rough: 0.2, env: 1.3 };
    const ceramic = { rough: 0.12, coat: 1, env: 1.2 };   // porcelaine vernie
    const glazed = { rough: 0.3, coat: 0.6 };              // poisson luisant

    // ----- Décor : tapis de sol, tapis roulant avec ses rails, comptoir en anneau -----
    add(slab(stadium(L, R + 2.75), 0.05, '#17695F', 0.015), 0, 0, 0);
    add(slab(stadium(L, R + 2.5), 0.05, '#218A7D', 0.015), 0, 0.02, 0);
    add(slab(stadium(L, R + 0.7, R - 0.7), TOP - 0.04, '#1E2227', 0.05), 0, 0, 0);
    add(slab(stadium(L, R + 0.56, R - 0.56), 0.04, '#2E343C', 0), 0, TOP - 0.04, 0);
    add(slab(stadium(L, R + 0.78, R + 0.62), TOP + 0.1, '#D9DEE4', 0.03, steel), 0, 0, 0);
    add(slab(stadium(L, R - 0.62, R - 0.78), TOP + 0.1, '#D9DEE4', 0.03, steel), 0, 0, 0);
    add(slab(stadium(L, R - 0.78, R - 1.7), 0.98, '#8E5A2E', 0.06), 0, 0, 0);
    add(slab(stadium(L, R - 0.84, R - 1.64), 0.08, '#D9A86A', 0.02), 0, 0.98, 0);
    for (const z of [-3.2, -0.6, 2.0]) add(rbox(0.5, 0.06, 0.7, '#EBCB9E', 0.03), 1.62, 1.09, z);
    for (const z of [-1.9, 0.7, 3.3]) add(group(cyl(0.2, 0.14, 0.16, '#FFFFFF', 24, ceramic), at(dome(0.17, '#FFFDF5'), 0, 0.06, 0)), -1.62, 1.14, z);

    // Repères clairs qui défilent : on voit le tapis avancer.
    const marks = Array.from({ length: 30 }, (_, k) => ({ d: (k / 30) * LOOP, mesh: add(rbox(0.5, 0.02, 0.12, '#59626D', 0.01), 0, TOP + 0.005, 0) }));

    // Plantes en pot et lanternes aux quatre coins.
    const plant = (seed) => group(at(cyl(0.5, 0.38, 0.7, '#D9663F', 16), 0, 0.35, 0), at(cyl(0.54, 0.54, 0.1, '#B94F2E', 16), 0, 0.7, 0),
      at(blob(0.62, '#37B24D', seed), 0, 1.25, 0), at(blob(0.44, '#51CF66', seed + 2), 0.36, 1.75, 0.1), at(blob(0.38, '#2F9E44', seed + 4), -0.34, 1.6, -0.1));
    const lantern = () => group(at(cyl(0.3, 0.36, 0.14, '#3A4048', 12), 0, 0.07, 0), at(cyl(0.05, 0.05, 2.0, '#3A4048', 8), 0, 1.0, 0),
      at(ball(0.42, '#F03E3E', { rough: 0.5, glow: 1.1 }), 0, 2.3, 0), at(cyl(0.2, 0.2, 0.1, '#FFD43B', 12), 0, 2.72, 0), at(cyl(0.2, 0.2, 0.1, '#FFD43B', 12), 0, 1.88, 0));
    add(plant(1), -6.4, 0, -9.9); add(plant(4), 6.4, 0, -9.9); add(plant(7), -6.3, 0, 9.6); add(plant(9), 6.3, 0, 9.6);
    add(lantern(), -6.5, 0, -4.6); add(lantern(), 6.5, 0, -4.6); add(lantern(), -6.5, 0, 4.6); add(lantern(), 6.5, 0, 4.6);
    add(rbox(3.0, 0.06, 1.3, '#E03131', 0.03), 0, 0.01, 10.6);

    // ----- Chefs, debout dans l'allée centrale -----
    const chefs = [];
    function syncChefs() {
      const want = Math.min(4, 1 + Math.floor(state.lv.chefs / 3));
      while (chefs.length < want) {
        const k = chefs.length;
        const g = person({ color: '#FFFFFF', seed: k + 1, hat: 'toque', size: 1.15 });
        g.rotation.y = k % 2 ? -Math.PI / 2 : Math.PI / 2;
        add(g, 0, 0.05, 3.1 - k * 2.3);
        chefs.push(g);
      }
    }

    // ----- Places assises autour du tapis -----
    const places = [];
    function syncSeats() {
      while (places.length < seats(state)) {
        const k = places.length;
        const d = ((k * 0.61803) % 1) * LOOP;   // nombre d'or : la salle se remplit harmonieusement
        const p = track(d);
        const x = p.x + p.nx * 1.62, z = p.z + p.nz * 1.62;
        add(group(at(cyl(0.3, 0.32, 0.05, '#868E96', 16, steel), 0, 0.025, 0), at(cyl(0.06, 0.06, 0.6, '#ADB5BD', 10, steel), 0, 0.33, 0),
          at(cyl(0.36, 0.33, 0.16, '#E03131', 20), 0, 0.68, 0), at(cyl(0.34, 0.36, 0.04, '#FF6B6B', 20), 0, 0.78, 0)), x, 0, z);
        const guest = person({ color: SHIRTS[k % SHIRTS.length], seed: k + 2, size: 1.1, legs: false });
        guest.rotation.y = Math.atan2(-p.nx, -p.nz);
        guest.scale.setScalar(0.001);
        add(guest, x, 0.42, z);
        const dish = group(cyl(0.3, 0.25, 0.06, '#FFFFFF', 24, ceramic), at(rbox(0.26, 0.1, 0.16, '#FFFDF5', 0.04), 0, 0.08, 0));
        dish.visible = false;
        add(dish, p.x + p.nx * 0.92, TOP + 0.13, p.z + p.nz * 0.92);
        places.push({ d, x, z, guest, dish, mode: 'empty', t: Math.random() * ARRIVE, size: 0 });
      }
    }

    // ----- Assiettes : nigiri ou makis sur une assiette au bord coloré -----
    const plates = [];
    let sinceSpawn = 0;
    function spawn() {
      const rim = RIMS[(Math.random() * RIMS.length) | 0];
      const g = group(cyl(0.45, 0.36, 0.08, rim, 32, ceramic), at(cyl(0.38, 0.38, 0.03, '#FFFFFF', 32, ceramic), 0, 0.045, 0));
      if (Math.random() < 0.55) {
        g.add(at(rbox(0.42, 0.16, 0.22, '#FFFDF5', 0.07), 0, 0.14, 0), at(rbox(0.46, 0.1, 0.25, ['#FF8A5B', '#F03E3E', '#FFD43B'][(Math.random() * 3) | 0], 0.045, glazed), 0, 0.24, 0));
      } else {
        // Trois makis en triangle, garnis de saumon, de concombre ou d'omelette.
        [[0, -0.14], [-0.14, 0.1], [0.14, 0.1]].forEach(([sx, sz], k) => {
          g.add(at(cyl(0.115, 0.115, 0.16, '#26323D', 14), sx, 0.13, sz), at(cyl(0.085, 0.085, 0.17, '#FFFDF5', 14), sx, 0.13, sz),
            at(cyl(0.05, 0.05, 0.18, ['#FF8A5B', '#69DB7C', '#FFD43B'][k], 10), sx, 0.13, sz));
        });
      }
      scene.add(g);
      plates.push({ g, d: 0 });
    }

    function update(dt, now) {
      const move = belt(state) * dt;
      for (const m of marks) {
        m.d += move;
        const p = track(m.d);
        m.mesh.position.set(p.x, TOP + 0.005, p.z);
        m.mesh.rotation.y = Math.atan2(p.nx, p.nz) + Math.PI / 2;
      }
      // Les chefs déposent une assiette en début de tapis s'il y a la place.
      sinceSpawn += dt;
      if (sinceSpawn >= 1 / rate(state) && plates.length < 46 && !plates.some((p) => p.d < 0.95)) {
        sinceSpawn = 0;
        spawn();
      }
      for (let i = plates.length - 1; i >= 0; i--) {
        const pl = plates[i];
        const before = pl.d % LOOP;
        pl.d += move;
        const p = track(pl.d);
        pl.g.position.set(p.x, TOP + 0.02, p.z);
        // Un client qui a faim prend l'assiette qui passe devant lui.
        const taker = places.find((s) => s.mode === 'hungry' && before <= s.d && before + move > s.d);
        if (taker) {
          scene.remove(pl.g);
          plates.splice(i, 1);
          taker.mode = 'eating';
          taker.t = EAT;
          taker.dish.visible = true;
          hud.earn(worth(state), stage.project(taker.x, 2.2, taker.z));
        }
      }
      for (const s of places) {
        const u = s.guest.userData;
        if (s.mode === 'empty') {
          s.t -= dt;
          s.size = Math.max(0, s.size - dt * 5);
          if (s.t <= 0) s.mode = 'arriving';
        } else if (s.mode === 'arriving') {
          s.size = Math.min(1, s.size + dt * 4);
          if (s.size >= 1) s.mode = 'hungry';
        } else if (s.mode === 'eating') {
          s.t -= dt;
          if (s.t <= 0) { s.mode = 'empty'; s.t = ARRIVE * (0.6 + Math.random() * 0.8); s.dish.visible = false; }
        }
        const eating = s.mode === 'eating';
        u.armR.rotation.x = eating ? -1.5 + Math.sin(now * 11) * 0.45 : -0.5;
        u.armL.rotation.x = eating ? -0.9 : -0.5;
        s.guest.scale.setScalar(Math.max(0.001, s.size * 1.1));
        s.guest.position.y = 0.42 + (s.mode === 'hungry' ? Math.abs(Math.sin(now * 4 + s.d)) * 0.05 : 0);
      }
      chefs.forEach((c, k) => {
        c.userData.armR.rotation.x = -1.2 + Math.sin(now * 9 + k) * 0.5;
        c.userData.armL.rotation.x = -1.2 + Math.cos(now * 9 + k) * 0.5;
      });
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
