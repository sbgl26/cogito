// « Scierie » : des bûcherons coupent les arbres et rapportent les troncs à la scierie.
// Jeu de gestion sans fin : chaque tronc livré rapporte des pièces à réinvestir.

import { h } from '../../core/ui.js';
import { createStage, box, cyl, ball, tree, person, group, at } from '../../idle/kit.js';
import { createIdle } from '../../idle/hud.js';

const WALK = 2.9, CHOP = 1.5, REGROW = 9; // unités/s, secondes, secondes
const MILL = { x: 0, z: -6.6 };           // point de livraison, devant la porte
const COLORS = ['#FF6B6B', '#FFD43B', '#4DABF7', '#F783AC', '#63E6BE', '#FFA94D', '#B197FC'];

const workers = (s) => 1 + s.lv.workers;
const speed = (s) => 1 + 0.15 * s.lv.speed;
const worth = (s) => Math.round(5 * Math.pow(1.4, s.lv.value));
const trees = (s) => 6 + 2 * s.lv.forest;

const UPGRADES = [
  { key: 'workers', label: 'Bûcheron', icon: '🪓', base: 15, growth: 1.75, max: 11, hint: (s) => `${workers(s)} au travail` },
  { key: 'speed', label: 'Vitesse', icon: '⚡', base: 25, growth: 1.6, max: 20, hint: (s) => `× ${speed(s).toFixed(2).replace('.', ',')}` },
  { key: 'value', label: 'Scie', icon: '🪚', base: 60, growth: 1.8, max: 40, hint: (s) => `${worth(s)} par tronc` },
  { key: 'forest', label: 'Forêt', icon: '🌲', base: 40, growth: 1.7, max: 11, hint: (s) => `${trees(s)} arbres` },
];

// Revenu moyen par seconde : limité par les bras ou par la repousse des arbres.
function income(s) {
  const cycle = (2 * 6) / (WALK * speed(s)) + CHOP / speed(s);
  return Math.min(workers(s) / cycle, trees(s) / (REGROW + CHOP)) * worth(s);
}

// Emplacements d'arbres, fixes d'une partie à l'autre (pseudo-hasard par index) :
// des rangées en quinconce qui s'éloignent de la scierie.
const noise = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
const SLOTS = Array.from({ length: 30 }, (_, i) => {
  const col = i % 5, row = (i / 5) | 0;
  return { x: -5.4 + col * 2.7 + (row % 2 ? 0.9 : -0.3) + (noise(i, 1) - 0.5) * 0.8, z: -3.4 + row * 2.3 + (noise(i, 2) - 0.5) * 0.7 };
});
// Arbres de décor, hors de portée, pour habiller les bords.
const DECOR = [[-7.6, -12.5], [-5.2, -14], [5.6, -13.6], [7.8, -11.8], [-8.2, -8.4], [8.3, -7.6], [-8.6, -2.5], [8.7, -1.2], [-8.8, 3.4], [8.9, 4.6], [-8.5, 9.2], [8.6, 10], [2.2, -14.6], [-1.8, -15.2]];

function init() {
  return { cash: 0, total: 0, lv: { workers: 0, speed: 0, value: 0, forest: 0 }, seen: Date.now() };
}

function mount(host, state, api) {
  let stage = null, hud = null, dead = false;
  const wrap = h('div', { class: 'idle' });
  host.append(wrap);

  (async () => {
    stage = await createStage(wrap, { ground: '#9CCB4A', span: 15, lookZ: 0.4 });
    if (dead) { if (stage) stage.dispose(); return; }
    if (!stage) { wrap.append(h('p', { class: 'idle-fail' }, 'Ce jeu a besoin de la 3D, indisponible sur cet appareil.')); return; }
    const { scene } = stage;

    // ----- Décor : scierie (porte face à la forêt), tas de troncs, fleurs, arbres de bordure -----
    const blade = cyl(0.8, 0.8, 0.1, '#CED4DA', 14);
    blade.rotation.x = Math.PI / 2;
    // Toit à deux pans : deux planches inclinées qui se rejoignent au faîte.
    const pan = (side) => { const p = box(5.0, 0.28, 2.1, side > 0 ? '#E8590C' : '#C2410C'); p.rotation.x = side * 0.62; return at(p, 0, 2.62, side * 0.82); };
    scene.add(at(group(
      at(box(4.4, 2.0, 2.6, '#F0B36B'), 0, 1.0, 0),
      pan(1), pan(-1),
      at(box(4.4, 0.9, 1.2, '#F0B36B'), 0, 2.3, 0),
      at(box(1.1, 1.4, 0.14, '#7A4A2A'), 0, 0.7, 1.32),
      at(box(1.4, 0.16, 0.2, '#5C3A21'), 0, 1.5, 1.34),
      at(blade, -1.5, 1.2, 1.36),
      at(box(0.7, 0.7, 0.1, '#FFE8A3'), 1.5, 1.25, 1.33),
      at(box(0.55, 1.2, 0.55, '#8A5A3C'), 1.5, 3.3, -0.5)), MILL.x, 0, MILL.z - 1.75));
    for (let k = 0; k < 6; k++) {
      const log = cyl(0.26, 0.26, 1.6, '#A8703F', 8);
      log.rotation.z = Math.PI / 2;
      const layer = k < 3 ? 0 : 1;
      scene.add(at(log, 3.6, 0.26 + layer * 0.46, MILL.z - 1.4 + (k % 3) * 0.54 + layer * 0.27));
    }
    scene.add(at(box(1.7, 0.04, 2.0, '#D8C38A'), MILL.x, 0.02, MILL.z + 0.5));
    for (let k = 0; k < 22; k++) {
      scene.add(at(ball(0.11, k % 2 ? '#FFFFFF' : '#FFE066', 0), -7 + noise(k, 3) * 14, 0.08, -9 + noise(k, 4) * 20));
    }
    for (let k = 0; k < 9; k++) {
      const patch = cyl(1.2 + noise(k, 5), 1.2 + noise(k, 5), 0.02, '#8FC043', 9);
      scene.add(at(patch, -7 + noise(k, 6) * 14, 0.01, -10 + noise(k, 7) * 21));
    }
    DECOR.forEach(([x, z], k) => {
      const g = tree();
      g.scale.setScalar(1.05 + noise(k, 8) * 0.5);
      g.rotation.y = k * 2.1;
      scene.add(at(g, x, 0, z));
    });

    // ----- Arbres -----
    const forest = [];
    function syncTrees() {
      while (forest.length < Math.min(trees(state), SLOTS.length)) {
        const p = SLOTS[forest.length];
        const g = tree();
        g.rotation.y = forest.length * 1.7;
        scene.add(at(g, p.x, 0, p.z));
        forest.push({ g, x: p.x, z: p.z, grow: 1, taken: false });
      }
    }

    // ----- Bûcherons -----
    const crew = [];
    function syncCrew() {
      while (crew.length < workers(state)) {
        const body = person(COLORS[crew.length % COLORS.length]);
        const log = cyl(0.17, 0.17, 0.95, '#A8703F', 7);
        log.rotation.z = Math.PI / 2;
        log.visible = false;
        body.add(at(log, 0, 1.0, 0.1));
        scene.add(at(body, MILL.x + (crew.length % 4 - 1.5) * 0.8, 0, MILL.z + 0.6));
        crew.push({ g: body, log, mode: 'seek', target: null, t: 0, phase: crew.length });
      }
    }

    function walk(w, tx, tz, dt) {
      const dx = tx - w.g.position.x, dz = tz - w.g.position.z;
      const d = Math.hypot(dx, dz);
      const step = WALK * speed(state) * dt;
      if (d <= step) { w.g.position.x = tx; w.g.position.z = tz; return true; }
      w.g.position.x += (dx / d) * step;
      w.g.position.z += (dz / d) * step;
      w.g.rotation.y = Math.atan2(dx, dz);
      return false;
    }

    function update(dt, now) {
      for (const t of forest) {
        if (t.grow < 1) t.grow = Math.min(1, t.grow + dt / REGROW);
        const s = 0.12 + 0.88 * t.grow;
        t.g.userData.crown.scale.setScalar(s);
        t.g.userData.crown.position.y = (1 - s) * 0.6;
      }
      for (const w of crew) {
        w.g.position.y = w.mode === 'wait' ? 0 : Math.abs(Math.sin(now * 9 + w.phase)) * 0.09;
        if (w.mode === 'seek' || w.mode === 'wait') {
          let best = null, bestD = Infinity;
          for (const t of forest) {
            if (t.taken || t.grow < 1) continue;
            const d = Math.hypot(t.x - w.g.position.x, t.z - w.g.position.z);
            if (d < bestD) { best = t; bestD = d; }
          }
          if (best) { best.taken = true; w.target = best; w.mode = 'go'; } else w.mode = 'wait';
        } else if (w.mode === 'go') {
          if (walk(w, w.target.x + 0.8, w.target.z + 0.45, dt)) { w.mode = 'chop'; w.t = 0; }
        } else if (w.mode === 'chop') {
          w.t += dt * speed(state);
          w.g.rotation.y = -Math.PI / 2;
          w.g.rotation.z = Math.sin(w.t * 14) * 0.22;
          w.target.g.rotation.z = Math.sin(w.t * 14) * 0.05;
          if (w.t >= CHOP) {
            w.g.rotation.z = 0;
            w.target.g.rotation.z = 0;
            w.target.grow = 0;
            w.target.taken = false;
            w.target = null;
            w.log.visible = true;
            w.mode = 'back';
          }
        } else if (w.mode === 'back') {
          if (walk(w, MILL.x + (w.phase % 3 - 1) * 0.45, MILL.z + 0.2, dt)) {
            w.log.visible = false;
            w.mode = 'seek';
            hud.earn(worth(state), stage.project(w.g.position.x, 2.2, w.g.position.z));
          }
        }
      }
      blade.rotation.z += dt * 6;
      hud.refresh();
    }

    hud = createIdle({
      host: wrap, state, api, upgrades: UPGRADES, income: () => income(state),
      onBuy: () => { syncTrees(); syncCrew(); },
    });
    syncTrees();
    syncCrew();
    stage.onFrame = update;
  })();

  return {
    destroy() { dead = true; if (hud) hud.destroy(); if (stage) stage.dispose(); },
  };
}

export const scierieDef = {
  id: 'scierie',
  title: 'Scierie',
  tagline: 'Bûcherons, troncs et pièces',
  levels: null,
  mode: 'idle',
  income,
  rules: [
    'Vos bûcherons coupent les arbres et rapportent les troncs à la scierie : chaque tronc livré rapporte des pièces.',
    'Dépensez-les en améliorations : plus de bûcherons, plus de vitesse, une meilleure scie (chaque tronc vaut plus) et une forêt plus grande. Les arbres repoussent tout seuls.',
    'La scierie continue de tourner quand l’app est fermée, à mi-régime et pendant quatre heures au plus.',
  ],
  init, mount,
};
