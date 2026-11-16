// « Scierie » : des bûcherons coupent les arbres et rapportent les troncs à la scierie.
// Jeu de gestion sans fin : chaque tronc livré rapporte des pièces à réinvestir.

import { h } from '../../core/ui.js';
import { createStage, patchyTexture, noise, group, at, turn, mesh, cyl, ball, rbox, disc, blob, tree, pine, rock, flower, person, grass } from '../../idle/kit.js';
import { createIdle } from '../../idle/hud.js';
import { ICONS } from '../../idle/icons.js';

const WALK = 2.9, CHOP = 1.5, REGROW = 9; // unités/s, secondes, secondes
const MILL = { x: 0, z: -6.4 };           // point de livraison, devant la porte
const SHIRTS = ['#FF6B6B', '#4DABF7', '#FFA94D', '#F783AC', '#63E6BE', '#B197FC', '#FFD43B'];

const workers = (s) => 1 + s.lv.workers;
const speed = (s) => 1 + 0.15 * s.lv.speed;
const worth = (s) => Math.round(5 * Math.pow(1.4, s.lv.value));
const trees = (s) => 6 + 2 * s.lv.forest;

const UPGRADES = [
  { key: 'workers', label: 'Bûcheron', icon: ICONS.hache, base: 15, growth: 1.75, max: 11, hint: (s) => `${workers(s)} au travail` },
  { key: 'speed', label: 'Vitesse', icon: ICONS.eclair, base: 25, growth: 1.6, max: 20, hint: (s) => `× ${speed(s).toFixed(2).replace('.', ',')}` },
  { key: 'value', label: 'Scie', icon: ICONS.scie, base: 60, growth: 1.8, max: 40, hint: (s) => `${worth(s)} par tronc` },
  { key: 'forest', label: 'Forêt', icon: ICONS.arbre, base: 40, growth: 1.7, max: 11, hint: (s) => `${trees(s)} arbres` },
];

// Revenu moyen par seconde : limité par les bras ou par la repousse des arbres.
function income(s) {
  const cycle = (2 * 6) / (WALK * speed(s)) + CHOP / speed(s);
  return Math.min(workers(s) / cycle, trees(s) / (REGROW + CHOP)) * worth(s);
}

// Emplacements d'arbres : des rangées en quinconce qui s'éloignent de la scierie.
const SLOTS = Array.from({ length: 30 }, (_, i) => {
  const col = i % 5, row = (i / 5) | 0;
  return { x: -5.2 + col * 2.6 + (row % 2 ? 0.9 : -0.3) + (noise(i, 1) - 0.5) * 0.8, z: -2.9 + row * 2.25 + (noise(i, 2) - 0.5) * 0.7 };
});
// Ordre de plantation : la forêt s'étoffe sur toute la clairière, en commençant près de la scierie.
const ORDER = [...SLOTS.keys()].sort((a, b) => noise(a, 11) - noise(b, 11));
ORDER.unshift(...ORDER.splice(ORDER.indexOf(2), 1), ...ORDER.splice(ORDER.indexOf(6), 1));
// Arbres de décor, hors de portée, pour habiller les bords ([x, z, sapin ?]).
const DECOR = [[-7.4, -12.6, 1], [-4.6, -14.2, 0], [4.9, -13.8, 1], [7.6, -12, 0], [-9.6, -9.4, 0], [9.3, -8.6, 1], [-8.4, -4.2, 1], [8.5, -3.1, 0],
  [-8.3, 1.6, 0], [8.4, 2.8, 1], [-8.1, 7.4, 1], [8.2, 8.2, 0], [1.6, -15.4, 0], [-1.9, -16, 1], [11.4, -13.2, 0], [-11.6, -13.6, 1], [-11, -5, 0], [11, -4.4, 1]];

function init() {
  return { cash: 0, total: 0, lv: { workers: 0, speed: 0, value: 0, forest: 0 }, seen: Date.now() };
}

function mount(host, state, api) {
  let stage = null, hud = null, dead = false;
  const wrap = h('div', { class: 'idle' });
  host.append(wrap);

  (async () => {
    stage = await createStage(wrap, {
      ground: '#6FAE31', span: 15, lookZ: 0.7, repeat: 4,
      floor: () => patchyTexture('#6FAE31', ['rgba(255,255,255,0.10)', 'rgba(30,100,15,0.20)', 'rgba(190,220,70,0.14)', 'rgba(50,120,25,0.16)']),
    });
    if (dead) { if (stage) stage.dispose(); return; }
    if (!stage) { wrap.append(h('p', { class: 'idle-fail' }, 'Ce jeu a besoin de la 3D, indisponible sur cet appareil.')); return; }
    const { scene, T } = stage;
    const add = (obj, x, y, z) => { scene.add(at(obj, x, y, z)); return obj; };

    // ----- La scierie : dalle, murs en bois, toit à deux pans, porte face à la forêt -----
    // Le pignon fait face à la caméra : on lit tout de suite une maison.
    const prism = (half, height, depth, bevel) => {
      const s = new T.Shape();
      s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, height); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    const lying = (m) => turn(m, Math.PI / 2, 0, 0);
    add(group(
      at(rbox(5.9, 0.4, 4.0, '#C9CED6', 0.14), 0, 0.2, 0),
      at(rbox(4.9, 2.3, 3.1, '#F4C27A', 0.14), 0, 1.55, 0),
      at(rbox(4.94, 0.07, 0.06, '#DDA45C', 0.02), 0, 1.0, 1.55), at(rbox(4.94, 0.07, 0.06, '#DDA45C', 0.02), 0, 1.6, 1.55), at(rbox(4.94, 0.07, 0.06, '#DDA45C', 0.02), 0, 2.2, 1.55),
      at(mesh(prism(2.95, 2.0, 3.5, 0.1), '#F2553D', { rough: 0.7 }), 0, 2.62, 0),
      at(mesh(prism(2.3, 1.56, 3.76, 0.02), '#F4C27A'), 0, 2.66, 0),
      at(rbox(0.3, 0.3, 3.9, '#C9402B', 0.1), 0, 4.62, 0),
      at(lying(cyl(0.3, 0.3, 0.1, '#FFE9BC', 20)), 0, 3.35, 1.9),
      at(rbox(1.6, 1.95, 0.12, '#FFE9BC', 0.08), 0, 1.38, 1.52),
      at(rbox(1.25, 1.7, 0.16, '#8D5A3B', 0.08), 0, 1.28, 1.56),
      at(ball(0.08, '#FFD43B', { rough: 0.4 }), 0.38, 1.25, 1.66),
      at(lying(cyl(0.55, 0.55, 0.1, '#DDA45C', 28)), 1.65, 1.85, 1.53),
      at(lying(cyl(0.42, 0.42, 0.12, '#FFF3BF', 28, { rough: 0.3 })), 1.65, 1.85, 1.55),
      at(rbox(0.7, 1.7, 0.7, '#C9583F', 0.08), 1.75, 3.7, -0.8),
      at(rbox(0.9, 0.22, 0.9, '#93402D', 0.06), 1.75, 4.6, -0.8)), MILL.x, 0, MILL.z - 2.2);

    // Établi de sciage : une grande lame qui tourne.
    const blade = cyl(0.78, 0.78, 0.07, '#DDE2E8', 14, { flat: true, metal: 1, rough: 0.22, env: 1.3 });
    blade.rotation.z = Math.PI / 2;
    const spin = group(blade, turn(cyl(0.18, 0.18, 0.12, '#495057', 12), 0, 0, Math.PI / 2));
    add(group(at(rbox(2.0, 0.8, 1.35, '#E0A060', 0.1), 0, 0.4, 0), at(rbox(2.1, 0.12, 1.45, '#C98B4A', 0.05), 0, 0.84, 0), at(spin, 0, 1.0, 0)), -4.1, 0, MILL.z - 1.3);

    // Tas de troncs, avec leurs bouts clairs.
    const logMesh = (len, r = 0.27) => turn(group(cyl(r, r, len, '#8D5A3B', 12), cyl(r * 0.76, r * 0.76, len + 0.02, '#EBCB9E', 12)), 0, 0, Math.PI / 2);
    [[0, 0], [0.56, 0], [1.12, 0], [0.28, 0.47], [0.84, 0.47], [0.56, 0.94]].forEach(([dz, dy], k) => {
      add(logMesh(1.9 - (k % 2) * 0.15), 4.2, 0.27 + dy, MILL.z - 2.2 + dz);
    });

    // Chemin, mare, rochers, buissons, fleurs, arbres de bordure.
    add(disc(1.25, 2.3, '#E3CE96'), MILL.x, 0.014, MILL.z + 1.1);
    add(disc(0.8, 0.6, '#E3CE96'), MILL.x + 0.5, 0.014, MILL.z + 3.3);
    add(disc(2.3, 1.55, '#D9E7A8'), -6.3, 0.014, -10.2);
    // Eau : surface lisse et vernie, qui reflète le ciel.
    add(disc(2.0, 1.3, '#2F7FD6', 0.02, { rough: 0.03, coat: 1, env: 1.7, tex: null }), -6.3, 0.016, -10.2);
    add(disc(1.2, 0.75, '#3F93E6', 0.03, { rough: 0.03, coat: 1, env: 1.7, tex: null }), -6.5, 0.02, -10.35);
    add(rock(0.5, 2), -4.4, 0.2, -9.4); add(rock(0.34, 3), -7.9, 0.14, -8.9); add(rock(0.45, 5), 6.6, 0.18, -5.6); add(rock(0.3, 7), -6.6, 0.12, 4.4);
    for (let k = 0; k < 9; k++) {
      const bush = group(at(blob(0.42, '#40C057', k), 0, 0.3, 0), at(blob(0.3, '#51CF66', k + 2), 0.34, 0.24, 0.1));
      add(bush, (k % 2 ? 1 : -1) * (6.6 + noise(k, 4) * 0.9), 0, -7 + k * 1.9);
    }
    const petals = ['#FFFFFF', '#FF8FA3', '#FFE066', '#D0BFFF'];
    for (let k = 0; k < 26; k++) add(flower(petals[k % 4]), -6.4 + noise(k, 3) * 12.8, 0, -9.5 + noise(k, 5) * 19);
    DECOR.forEach(([x, z, isPine], k) => {
      const g = isPine ? pine(k) : tree(k);
      g.scale.setScalar(1.05 + noise(k, 8) * 0.45);
      g.rotation.y = k * 2.1;
      add(g, x, 0, z);
    });

    // Herbe : des milliers de brins, sauf sous les bâtiments, la mare et le chemin.
    const inEllipse = (x, z, cx, cz, rx, rz) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1;
    scene.add(grass({
      keep: (x, z) => !(Math.abs(x) < 3.3 && z > MILL.z - 4.5 && z < MILL.z + 0.1)
        && !(Math.abs(x + 4.1) < 1.3 && Math.abs(z - (MILL.z - 1.3)) < 1.0)
        && !(Math.abs(x - 4.2) < 1.2 && z > MILL.z - 2.7 && z < MILL.z - 0.4)
        && !inEllipse(x, z, -6.3, -10.2, 2.5, 1.75) && !inEllipse(x, z, MILL.x, MILL.z + 1.1, 1.35, 2.4),
    }));

    // ----- Arbres à couper -----
    const forest = [];
    function syncTrees() {
      while (forest.length < Math.min(trees(state), SLOTS.length)) {
        const p = SLOTS[ORDER[forest.length]];
        const g = tree(forest.length + 2);
        g.rotation.y = forest.length * 1.7;
        add(g, p.x, 0, p.z);
        forest.push({ g, x: p.x, z: p.z, grow: 1, shown: 1, taken: false });
      }
    }

    // ----- Bûcherons : casque, hache à la main, tronc sur l'épaule au retour -----
    const crew = [];
    function syncCrew() {
      while (crew.length < workers(state)) {
        const k = crew.length;
        const body = person({ color: SHIRTS[k % SHIRTS.length], seed: k, hat: 'casque' });
        const axe = group(at(cyl(0.035, 0.035, 0.62, '#D9965A', 8), 0, 0, 0), at(rbox(0.26, 0.2, 0.07, '#CED4DA', 0.03, { metal: 1, rough: 0.3 }), 0.1, 0.24, 0));
        body.userData.armR.add(at(turn(axe, Math.PI / 2, 0, 0), 0, -0.45, 0.12));
        const log = logMesh(1.0, 0.16);
        log.visible = false;
        body.add(at(log, 0, 1.3, 0.06));
        add(body, MILL.x + (k % 4 - 1.5) * 0.85, 0, MILL.z + 0.7);
        crew.push({ g: body, log, axe, mode: 'seek', target: null, t: 0, phase: k * 1.7 });
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
        t.shown += (t.grow - t.shown) * Math.min(1, dt * 9);
        const s = 0.02 + 0.98 * t.shown;
        const crown = t.g.userData.crown;
        crown.scale.setScalar(s);
        crown.position.y = (1 - s) * 1.1;
      }
      for (const w of crew) {
        const u = w.g.userData;
        const moving = w.mode === 'go' || w.mode === 'back';
        const swing = moving ? Math.sin(now * 11 + w.phase) : 0;
        w.g.position.y = moving ? Math.abs(swing) * 0.07 : 0;
        u.legL.rotation.x = -swing * 0.6;
        u.legR.rotation.x = swing * 0.6;
        u.armL.rotation.x = w.mode === 'back' ? -2.7 : swing * 0.7;
        u.armR.rotation.x = -swing * 0.7;
        if (w.mode === 'seek' || w.mode === 'wait') {
          let best = null, bestD = Infinity;
          for (const t of forest) {
            if (t.taken || t.grow < 1) continue;
            const d = Math.hypot(t.x - w.g.position.x, t.z - w.g.position.z);
            if (d < bestD) { best = t; bestD = d; }
          }
          if (best) { best.taken = true; w.target = best; w.mode = 'go'; } else { w.mode = 'wait'; w.g.rotation.y = 0; }
        } else if (w.mode === 'go') {
          if (walk(w, w.target.x + 0.95, w.target.z + 0.4, dt)) { w.mode = 'chop'; w.t = 0; }
        } else if (w.mode === 'chop') {
          w.t += dt * speed(state);
          w.g.rotation.y = -Math.PI / 2;
          u.armR.rotation.x = -1.5 + Math.sin(w.t * 13) * 0.95;
          w.target.g.rotation.z = Math.max(0, Math.sin(w.t * 13)) * 0.05;
          if (w.t >= CHOP) {
            w.target.g.rotation.z = 0;
            w.target.grow = 0;
            w.target.taken = false;
            w.target = null;
            w.log.visible = true;
            w.axe.visible = false;
            w.mode = 'back';
          }
        } else if (w.mode === 'back') {
          if (walk(w, MILL.x + ((w.phase * 3) % 3 - 1) * 0.5, MILL.z + 0.2, dt)) {
            w.log.visible = false;
            w.axe.visible = true;
            w.mode = 'seek';
            hud.earn(worth(state), stage.project(MILL.x, 3.2, MILL.z));
          }
        }
      }
      spin.rotation.x += dt * 9;
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
