// Atelier 3D des jeux de gestion : un rendu de « maquette photographiée ».
// Matériaux physiques (bois veiné, céramique vernie, métal, tissu), ciel qui se reflète,
// soleil chaud à ombres douces, occlusion ambiante, halo des hautes lumières et
// profondeur de champ. Three.js et ses effets sont embarqués (vendor/) : hors-ligne.

import { settings } from '../core/store.js';

let THREE = null;
const mats = new Map();
const textures = {};
const TAU = Math.PI * 2;

export async function loadThree() {
  if (!THREE) THREE = await import('../../vendor/three.module.min.js');
  return THREE;
}

// Pseudo-hasard stable : le décor est identique d'une ouverture à l'autre.
export const noise = (i, k = 0) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

// ---------- Textures dessinées à la volée (aucun fichier image) ----------

function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Stries plus ou moins sombres sur fond clair : veines du bois, écorce, rangs de tuiles.
function streaks(ctx, size, { count, vertical = false, dark = 0.28, width = 3, wave = 6 }) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const p = noise(i, 21) * size, a = 0.05 + noise(i, 22) * dark, w = 0.6 + noise(i, 23) * width;
    ctx.strokeStyle = `rgba(60, 35, 15, ${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let s = 0; s <= size; s += 16) {
      const o = p + Math.sin(s * 0.03 + i) * wave * noise(i, 24);
      if (vertical) ctx.lineTo(o, s); else ctx.lineTo(s, o);
    }
    ctx.stroke();
  }
}

function texture(name) {
  if (textures[name]) return textures[name];
  const make = {
    bois: () => canvasTexture(256, (ctx, s) => streaks(ctx, s, { count: 46 }), 0.55),
    ecorce: () => canvasTexture(256, (ctx, s) => streaks(ctx, s, { count: 70, vertical: true, dark: 0.5, width: 5, wave: 3 }), 1),
    tuiles: () => canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, s, s);
      for (let r = 0; r < 8; r++) {
        const g = ctx.createLinearGradient(0, r * 32, 0, r * 32 + 32);
        g.addColorStop(0, 'rgba(90,20,10,0.42)'); g.addColorStop(0.25, 'rgba(90,20,10,0)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
        ctx.fillStyle = g; ctx.fillRect(0, r * 32, s, 32);
        for (let k = 0; k < 8; k++) { ctx.fillStyle = 'rgba(90,20,10,0.22)'; ctx.fillRect(k * 32 + (r % 2 ? 16 : 0), r * 32, 1.5, 32); }
      }
    }, 0.6),
    grain: () => canvasTexture(256, (ctx, s) => {
      const img = ctx.createImageData(s, s);
      for (let i = 0; i < s * s; i++) { const v = 150 + noise(i, 31) * 105; img.data.set([v, v, v, 255], i * 4); }
      ctx.putImageData(img, 0, 0);
    }, 3),
  };
  textures[name] = make[name]();
  if (name !== 'grain') textures[name].colorSpace = THREE.SRGBColorSpace;
  return textures[name];
}

// ---------- Matériaux ----------

// Aspect par défaut de chaque couleur de la palette : c'est ici qu'on dit « ce brun
// est du bois veiné », « ce gris est de la pierre »… Les options passées à mat() priment.
const WOOD = { tex: 'bois', rough: 0.72 }, BARK = { tex: 'ecorce', rough: 0.95, bump: 0.05 }, STONE = { tex: 'grain', rough: 0.95, bump: 0.02 };
const CLOTH = { tex: 'grain', rough: 0.95, bump: 0.012 }, SKIN = { rough: 0.55 };
const LOOKS = {
  '#F4C27A': WOOD, '#DDA45C': WOOD, '#FFE9BC': WOOD, '#E0A060': WOOD, '#C98B4A': WOOD, '#D9965A': WOOD, '#EBCB9E': { tex: 'grain', rough: 0.8, bump: 0.01 },
  '#F5DBA9': { tex: 'bois', rough: 0.3, coat: 0.7 },
  '#8D5A3B': BARK, '#7A4B2E': BARK,
  '#F2553D': { tex: 'tuiles', rough: 0.62, bump: 0.05 }, '#C9402B': { rough: 0.6 },
  '#C9CED6': STONE, '#C9583F': STONE, '#93402D': STONE, '#ADB5BD': STONE, '#9AA3AE': STONE, '#D9663F': STONE, '#B94F2E': STONE,
  '#17695F': CLOTH, '#218A7D': CLOTH, '#2E343C': { tex: 'grain', rough: 0.85, bump: 0.008 }, '#1E2227': { rough: 0.45, metal: 0.4 }, '#3A4048': { rough: 0.5, metal: 0.3 },
  '#8E5A2E': WOOD, '#D9A86A': { tex: 'bois', rough: 0.28, coat: 0.8 },
  '#FFD9B8': SKIN, '#F2C29B': SKIN, '#D9A27A': SKIN, '#A8714F': SKIN, '#2F3A5F': CLOTH,
  '#FF6B6B': CLOTH, '#4DABF7': CLOTH, '#FFA94D': CLOTH, '#F783AC': CLOTH, '#63E6BE': CLOTH, '#B197FC': CLOTH, '#FFD43B': CLOTH, '#FFFFFF': { rough: 0.7 },
  '#E03131': { rough: 0.38, coat: 0.4 },
};

export function mat(color, options = {}) {
  const o = { flat: false, rough: 0.8, metal: 0, coat: 0, tex: null, bump: 0.03, glow: 0, env: 0.75, ...(LOOKS[color] || {}), ...options };
  const key = `${color}|${o.flat}|${o.rough}|${o.metal}|${o.coat}|${o.tex}|${o.bump}|${o.glow}|${o.env}`;
  if (!mats.has(key)) {
    const Kind = o.coat > 0 ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Kind({ color, flatShading: o.flat, roughness: o.rough, metalness: o.metal, envMapIntensity: o.env });
    if (o.coat > 0) { m.clearcoat = o.coat; m.clearcoatRoughness = 0.12; }
    if (o.tex) {
      const t = texture(o.tex);
      if (o.tex !== 'grain') m.map = t;
      m.bumpMap = t;
      m.bumpScale = o.bump;
    }
    if (o.glow > 0) { m.emissive = new THREE.Color(color); m.emissiveIntensity = o.glow; }
    mats.set(key, m);
  }
  return mats.get(key);
}

export function mesh(geometry, color, options) {
  const m = new THREE.Mesh(geometry, mat(color, options));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Formes ----------

export const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };
export const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };
export const turn = (obj, x = 0, y = 0, z = 0) => { obj.rotation.set(x, y, z); return obj; };

export const cyl = (rTop, rBottom, h, color, seg = 32, o) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, o);
export const ball = (r, color, o) => mesh(new THREE.SphereGeometry(r, 32, 20), color, o);
export const capsule = (r, len, color, o) => mesh(new THREE.CapsuleGeometry(r, len, 8, 20), color, o);
export const dome = (r, color, o) => mesh(new THREE.SphereGeometry(r, 32, 12, 0, TAU, 0, Math.PI / 2), color, o);

// Contour d'un rectangle aux coins arrondis, centré.
function roundedRect(hx, hy, cr) {
  const s = new THREE.Shape();
  s.moveTo(-hx + cr, -hy);
  s.lineTo(hx - cr, -hy); s.absarc(hx - cr, -hy + cr, cr, -Math.PI / 2, 0);
  s.lineTo(hx, hy - cr); s.absarc(hx - cr, hy - cr, cr, 0, Math.PI / 2);
  s.lineTo(-hx + cr, hy); s.absarc(-hx + cr, hy - cr, cr, Math.PI / 2, Math.PI);
  s.lineTo(-hx, -hy + cr); s.absarc(-hx + cr, -hy + cr, cr, Math.PI, Math.PI * 1.5);
  return s;
}

// Boîte dont toutes les arêtes sont adoucies : aucune arête vive, comme un objet réel.
export function rbox(w, h, d, color, r = 0.1, o) {
  r = Math.max(0.01, Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005));
  const b = r / 2;
  const g = new THREE.ExtrudeGeometry(roundedRect(w / 2 - b, h / 2 - b, r - b), {
    depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 6,
  });
  g.center();
  return mesh(g, color, o);
}

// Forme plane quelconque épaissie (tapis roulant, comptoir…), posée à plat : y vers le haut.
export function slab(shape, thickness, color, bevel = 0.04, o) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 28,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return mesh(g, color, o);
}

// Stade (deux droites, deux demi-cercles), allongé selon z une fois posé à plat.
export function stadium(length, radius, hole = 0) {
  const draw = (path, r) => {
    path.moveTo(r, -length / 2);
    path.lineTo(r, length / 2); path.absarc(0, length / 2, r, 0, Math.PI);
    path.lineTo(-r, -length / 2); path.absarc(0, -length / 2, r, Math.PI, TAU);
    return path;
  };
  const s = draw(new THREE.Shape(), radius);
  if (hole > 0) s.holes.push(draw(new THREE.Path(), hole));
  return s;
}

// Tache plate au sol (ellipse) : chemin, flaque, berge.
export const disc = (rx, rz, color, y = 0.012, o) => {
  const m = mesh(new THREE.CircleGeometry(1, 48), color, o);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.y = y;
  m.castShadow = false;
  return m;
};

// Masse organique lissée, légèrement irrégulière et granuleuse : feuillage floqué, rocher.
export function blob(r, color, seed = 1, wobble = 0.3, o = { tex: 'grain', rough: 0.95, bump: 0.05, env: 0.5 }) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position, n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Bosses larges, identiques pour les sommets confondus : la surface reste fermée.
    const k = 1 + (Math.sin(v.x * 4.1 / r + seed) * Math.cos(v.y * 3.7 / r + seed * 2) + Math.sin(v.z * 4.6 / r + seed * 3) * 0.7) * wobble * 0.28;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
    v.normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return mesh(g, color, o);
}

// Feuillu : tronc à écorce et couronne de quatre masses, qui peut repousser (userData.crown).
export function tree(seed = 1) {
  const greens = ['#2F8F3E', '#3A9D45', '#4CAF50', '#2A7F38'];
  const crown = group(
    at(blob(1.0, greens[seed % 4], seed), 0, 1.55, 0),
    at(blob(0.72, greens[(seed + 1) % 4], seed + 3), 0.5, 2.25, 0.15),
    at(blob(0.62, greens[(seed + 2) % 4], seed + 5), -0.5, 2.15, -0.2),
    at(blob(0.5, greens[(seed + 1) % 4], seed + 7), 0.05, 2.75, 0.05));
  const g = group(
    at(cyl(0.2, 0.32, 1.1, '#8D5A3B', 14), 0, 0.55, 0),
    at(cyl(0.21, 0.21, 0.04, '#EBCB9E', 14), 0, 1.11, 0),
    crown);
  g.userData.crown = crown;
  return g;
}

// Sapin : trois étages de cônes floqués.
export function pine(seed = 1) {
  const look = { tex: 'grain', rough: 0.95, bump: 0.06, env: 0.5 };
  const cone = (r, h, y, c) => at(mesh(new THREE.ConeGeometry(r, h, 20), c, look), 0, y, 0);
  return turn(group(
    at(cyl(0.16, 0.24, 0.8, '#7A4B2E', 12), 0, 0.4, 0),
    cone(1.05, 1.5, 1.35, '#256F33'), cone(0.82, 1.3, 2.2, '#2A7F38'), cone(0.55, 1.1, 3.0, '#2F8F3E')), 0, seed * 1.3, 0);
}

export const rock = (r, seed = 1) => {
  const m = blob(r, seed % 2 ? '#ADB5BD' : '#9AA3AE', seed, 0.5, { tex: 'grain', rough: 0.9, bump: 0.04 });
  m.scale.y = 0.62;
  return m;
};

export function flower(color) {
  return group(at(cyl(0.025, 0.025, 0.26, '#3A9D45', 6), 0, 0.13, 0),
    at(ball(0.09, color, { rough: 0.6 }), 0, 0.3, 0), at(ball(0.045, '#F5C211', { rough: 0.6 }), 0, 0.36, 0));
}

const SKINS = ['#FFD9B8', '#F2C29B', '#D9A27A', '#A8714F'];

// Figurine articulée : jambes, buste, tête, bras qui pivotent à l'épaule.
// hat : 'casque' (bûcheron), 'toque' (chef) ou rien. Le visage regarde vers +z.
export function person({ color = '#FF6B6B', seed = 0, hat = null, size = 1.2, legs = true } = {}) {
  const skin = SKINS[seed % SKINS.length];
  const arm = (side) => at(group(at(capsule(0.09, 0.28, color), 0, -0.2, 0), at(ball(0.105, skin), 0, -0.43, 0)), side * 0.39, 1.0, 0);
  const armL = arm(-1), armR = arm(1);
  const legL = legs ? at(capsule(0.115, 0.2, '#2F3A5F'), -0.14, 0.22, 0) : null;
  const legR = legs ? at(capsule(0.115, 0.2, '#2F3A5F'), 0.14, 0.22, 0) : null;
  const eye = { rough: 0.2, coat: 1 };
  const head = group(ball(0.29, skin),
    at(ball(0.036, '#1B2440', eye), -0.1, 0.03, 0.262), at(ball(0.036, '#1B2440', eye), 0.1, 0.03, 0.262));
  if (hat === 'casque') {
    const shell = { rough: 0.25, coat: 0.9, tex: null };
    head.add(at(dome(0.305, '#F5C211', shell), 0, 0.04, 0), at(cyl(0.36, 0.36, 0.04, '#E6B00F', 32, shell), 0, 0.06, 0.05));
  }
  if (hat === 'toque') {
    const puff = at(ball(0.3, '#FFFFFF', CLOTH), 0, 0.52, 0);
    puff.scale.y = 0.62;
    head.add(at(cyl(0.25, 0.22, 0.26, '#FFFFFF', 24, CLOTH), 0, 0.32, 0), puff);
  }
  const g = group(legL, legR, at(capsule(0.31, 0.36, color, CLOTH), 0, 0.76, 0), at(head, 0, 1.44, 0), armL, armR);
  g.scale.setScalar(size);
  g.userData = { armL, armR, legL, legR, head };
  return g;
}

// Herbe : des milliers de brins dessinés en une seule passe (instances).
// keep(x, z) dit si un brin peut pousser à cet endroit.
export function grass({ count = 9000, x0 = -11, x1 = 11, z0 = -17, z1 = 12, keep = () => true, tones = ['#5A9E2A', '#6DB030', '#4B8C24', '#80BF38'] } = {}) {
  const blade = new THREE.ConeGeometry(0.05, 0.34, 3);
  blade.translate(0, 0.17, 0);
  const field = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 0.85, envMapIntensity: 0.35 }), count);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 2 && n < count; i++) {
    const x = x0 + noise(i, 41) * (x1 - x0), z = z0 + noise(i, 42) * (z1 - z0);
    if (!keep(x, z)) continue;
    o.position.set(x, 0, z);
    o.rotation.set((noise(i, 43) - 0.5) * 0.7, noise(i, 44) * TAU, (noise(i, 45) - 0.5) * 0.7);
    o.scale.setScalar(0.55 + noise(i, 46) * 0.9);
    o.updateMatrix();
    field.setMatrixAt(n, o.matrix);
    field.setColorAt(n, c.set(tones[i % tones.length]).multiplyScalar(0.8 + noise(i, 47) * 0.35));
    n++;
  }
  field.count = n;
  field.receiveShadow = true;
  return field;
}

// Texture de sol : une couleur de base et de grandes taches douces, plus claires ou plus sombres.
export function patchyTexture(base, tones, { size = 1024, count = 110, seed = 7 } = {}) {
  const t = canvasTexture(size, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      // Les taches restent à l'intérieur de la tuile : aucun raccord visible quand elle se répète.
      const r = 30 + noise(i, seed + 2) * 150;
      const x = r + noise(i, seed) * (size - 2 * r), y = r + noise(i, seed + 1) * (size - 2 * r);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = tones[i % tones.length];
      g.addColorStop(0, tone);
      g.addColorStop(1, tone.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Texture de parquet : lames de teintes légèrement différentes, joints sombres.
export function plankTexture(shades, joint, { size = 512, rows = 8 } = {}) {
  const t = canvasTexture(size, (ctx) => {
    const hgt = size / rows;
    for (let r = 0; r < rows; r++) {
      let x = -noise(r, 3) * size * 0.4, k = 0;
      while (x < size) {
        const w = size * (0.28 + noise(r * 13 + k, 5) * 0.3);
        ctx.fillStyle = shades[Math.floor(noise(r * 7 + k, 9) * shades.length)];
        ctx.fillRect(x, r * hgt, w, hgt);
        for (let v = 0; v < 5; v++) { ctx.fillStyle = 'rgba(110, 70, 25, 0.07)'; ctx.fillRect(x, r * hgt + noise(r * 31 + k * 7 + v, 2) * hgt, w, 1.5); }
        ctx.fillStyle = joint;
        ctx.fillRect(x + w - 2, r * hgt, 2, hgt);
        x += w; k++;
      }
      ctx.fillStyle = joint;
      ctx.fillRect(0, r * hgt, size, 2);
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ciel de studio pour les reflets et la lumière d'ambiance : dégradé bleu, horizon chaud,
// soleil très lumineux. Converti une fois pour toutes en carte d'environnement.
function skyEnvironment(T, renderer) {
  const env = new T.Scene();
  env.add(new T.Mesh(new T.SphereGeometry(60, 32, 16), new T.ShaderMaterial({
    side: T.BackSide,
    vertexShader: 'varying vec3 p; void main() { p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 p; void main() { float h = normalize(p).y;
      vec3 c = h > 0.0 ? mix(vec3(1.0, 0.94, 0.84), vec3(0.34, 0.6, 1.0), pow(h, 0.5)) : mix(vec3(1.0, 0.94, 0.84), vec3(0.42, 0.46, 0.3), pow(-h, 0.4));
      gl_FragColor = vec4(c * 1.15, 1.0); }`,
  })));
  const sunDisc = new T.Mesh(new T.SphereGeometry(5, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(40, 35, 27) }));
  sunDisc.position.set(-24, 44, 26);
  env.add(sunDisc);
  const pmrem = new T.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return texture;
}

// Scène prête à animer. Renvoie null si le WebGL est indisponible.
// floor() peut renvoyer une texture ; span = largeur de monde visible à l'écran.
export async function createStage(host, { ground = '#8CC63F', floor = null, repeat = 1, span = 15, tilt = 0.9, lookZ = 0, floorLook = {} } = {}) {
  const T = await loadThree();
  const canvas = document.createElement('canvas');
  canvas.className = 'idle-canvas';
  host.append(canvas);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;   // rendu « pellicule » : hautes lumières douces
  renderer.toneMappingExposure = 0.86;

  const scene = new T.Scene();
  scene.background = new T.Color(ground);
  scene.environment = skyEnvironment(T, renderer);
  const FOV = 24;
  const camera = new T.PerspectiveCamera(FOV, 1, 10, 200);

  // Le ciel fournit la lumière d'ambiance ; le soleil, chaud et rasant, sculpte les volumes.
  scene.add(new T.HemisphereLight(0xffffff, 0xb8c79a, 0.22));
  const sun = new T.DirectionalLight(0xffe6c2, 3.0);
  sun.position.set(-12, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;
  scene.add(sun);

  const map = floor ? floor() : null;
  if (map) { map.repeat.set(repeat, repeat); map.anisotropy = 8; }
  const plane = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({
    color: map ? '#FFFFFF' : ground, map, roughness: 0.95, envMapIntensity: 0.4, ...floorLook,
  }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // ----- Effets : occlusion ambiante, halo, profondeur de champ, sortie tonale -----
  // quality 2 = tous les effets ; 1 = rendu direct ; 0 = rendu direct allégé.
  const locked = !!window.COGITO_GFX_LOCK; // les tests figent la qualité maximale
  let quality = settings.get('fancy3d') ? 2 : 1;
  let composer = null, bokeh = null, gtao = null;
  function buildComposer() {
    try {
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      composer = new T.EffectComposer(renderer, new T.WebGLRenderTarget(size.x, size.y, { type: T.HalfFloatType, samples: 4 }));
      composer.addPass(new T.RenderPass(scene, camera));
      gtao = new T.GTAOPass(scene, camera, size.x, size.y);
      gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
      gtao.blendIntensity = 0.9;
      composer.addPass(gtao);
      composer.addPass(new T.UnrealBloomPass(new T.Vector2(size.x, size.y), 0.16, 0.6, 0.9));
      bokeh = new T.BokehPass(scene, camera, { focus: 60, aperture: 0.00009, maxblur: 0.007 });
      composer.addPass(bokeh);
      composer.addPass(new T.OutputPass());
    } catch {
      composer = null; quality = 1;
    }
  }
  if (quality === 2) buildComposer();

  let width = 1, height = 1;
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Distance réglée pour que « span » unités tiennent dans la largeur de l'écran.
    const dist = span / (2 * Math.tan((FOV * Math.PI) / 360) * camera.aspect);
    camera.position.set(0, dist * Math.sin(tilt), lookZ + dist * Math.cos(tilt));
    camera.lookAt(0, 0, lookZ);
    camera.near = dist * 0.45; camera.far = dist * 2.1;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
      bokeh.uniforms.focus.value = dist;      // la netteté tombe sur le centre de la scène
      bokeh.uniforms.aspect.value = camera.aspect;
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // Appareil à la peine (moins de 28 images/s sur deux secondes) : on retire d'abord
  // les effets, puis on baisse la finesse. Le jeu, lui, ne change pas.
  function lighten() {
    quality--;
    canvas.dataset.quality = quality;
    if (quality === 1) { if (composer) composer.dispose(); composer = null; }
    if (quality === 0) {
      renderer.setPixelRatio(1);
      sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    resize();
  }

  let running = true, raf = 0, last = 0, frames = 0, spent = 0, steady = 0, skip = true;
  const stage = {
    T, scene, camera,
    onFrame: () => {},
    // Position à l'écran (pixels dans « host ») d'un point de la scène.
    project(x, y, z) {
      const v = new T.Vector3(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      if (map) map.dispose();
      if (composer) composer.dispose();
      scene.environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  const frame = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const real = (time - last) / 1000 || 0;   // durée vraie de l'image, pour mesurer la fluidité
    const dt = Math.min(0.1, real);
    last = time;
    if (document.hidden) { skip = true; return; }   // au retour, la première image ne compte pas
    stage.onFrame(dt, time / 1000);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    // On mesure jusqu'à trois fenêtres fluides d'affilée, puis on n'y touche plus.
    if (!locked && quality > 0 && steady < 3 && real > 0 && !skip) {
      frames++; spent += real;
      if (spent >= 2) {
        if (frames / spent < 28) { lighten(); steady = 0; } else steady++;
        frames = 0; spent = 0;
      }
    }
    skip = false;
  };
  raf = requestAnimationFrame(frame);
  return stage;
}
