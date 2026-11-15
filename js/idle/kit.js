// Atelier 3D des jeux de gestion : un monde « jouet » aux formes arrondies, vu de trois
// quarts avec une légère perspective, lumière chaude et ombres douces.
// Three.js n'est chargé qu'à l'ouverture d'un de ces jeux (fichier embarqué : hors-ligne).

let THREE = null;
const mats = new Map();
const TAU = Math.PI * 2;

export async function loadThree() {
  if (!THREE) THREE = await import('../../vendor/three.module.min.js');
  return THREE;
}

// Pseudo-hasard stable : le décor est identique d'une ouverture à l'autre.
export const noise = (i, k = 0) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

export function mat(color, { flat = false, rough = 0.8, metal = 0, map = null } = {}) {
  const key = `${color}|${flat}|${rough}|${metal}|${map ? map.uuid : ''}`;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: flat, roughness: rough, metalness: metal, map }));
  }
  return mats.get(key);
}

export function mesh(geometry, color, options) {
  const m = new THREE.Mesh(geometry, mat(color, options));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };
export const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };
export const turn = (obj, x = 0, y = 0, z = 0) => { obj.rotation.set(x, y, z); return obj; };

export const cyl = (rTop, rBottom, h, color, seg = 24, o) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, o);
export const ball = (r, color, o) => mesh(new THREE.SphereGeometry(r, 24, 16), color, o);
export const capsule = (r, len, color, o) => mesh(new THREE.CapsuleGeometry(r, len, 6, 16), color, o);
export const dome = (r, color, o) => mesh(new THREE.SphereGeometry(r, 24, 10, 0, TAU, 0, Math.PI / 2), color, o);

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

// Boîte dont toutes les arêtes sont adoucies : c'est ce qui donne l'aspect « jouet ».
export function rbox(w, h, d, color, r = 0.1, o) {
  r = Math.max(0.01, Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005));
  const b = r / 2;
  const g = new THREE.ExtrudeGeometry(roundedRect(w / 2 - b, h / 2 - b, r - b), {
    depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5,
  });
  g.center();
  return mesh(g, color, o);
}

// Forme plane quelconque épaissie (tapis roulant, comptoir…), posée à plat : y vers le haut.
export function slab(shape, thickness, color, bevel = 0.04, o) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20,
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

// Tache plate au sol (ellipse) : chemin, flaque, ombre de massif.
export const disc = (rx, rz, color, y = 0.012, o) => {
  const m = mesh(new THREE.CircleGeometry(1, 40), color, o);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.y = y;
  m.castShadow = false;
  return m;
};

// Masse à facettes légèrement irrégulière : feuillages, rochers, buissons.
export function blob(r, color, seed = 1, wobble = 0.3) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (noise(Math.round((x * 7.1 + y * 13.7 + z * 5.3) * 100), seed) - 0.5) * wobble;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return mesh(g, color, { flat: true, rough: 0.9 });
}

// Feuillu : tronc, et une couronne de quatre masses qui peut repousser (userData.crown).
export function tree(seed = 1) {
  const greens = ['#2F9E44', '#37B24D', '#51CF66', '#2B8A3E'];
  const crown = group(
    at(blob(1.0, greens[seed % 4], seed), 0, 1.55, 0),
    at(blob(0.72, greens[(seed + 1) % 4], seed + 3), 0.5, 2.25, 0.15),
    at(blob(0.62, greens[(seed + 2) % 4], seed + 5), -0.5, 2.15, -0.2),
    at(blob(0.5, greens[(seed + 1) % 4], seed + 7), 0.05, 2.75, 0.05));
  const g = group(
    at(cyl(0.2, 0.32, 1.1, '#8D5A3B', 10), 0, 0.55, 0),
    at(cyl(0.21, 0.21, 0.04, '#E9C89B', 10), 0, 1.11, 0),
    crown);
  g.userData.crown = crown;
  return g;
}

// Sapin : trois étages de cônes.
export function pine(seed = 1) {
  const cone = (r, h, y, c) => at(mesh(new THREE.ConeGeometry(r, h, 9), c, { flat: true, rough: 0.9 }), 0, y, 0);
  return turn(group(
    at(cyl(0.16, 0.24, 0.8, '#7A4B2E', 8), 0, 0.4, 0),
    cone(1.05, 1.5, 1.35, '#2B8A3E'), cone(0.82, 1.3, 2.2, '#2F9E44'), cone(0.55, 1.1, 3.0, '#37B24D')), 0, seed * 1.3, 0);
}

export const rock = (r, seed = 1) => { const m = blob(r, seed % 2 ? '#ADB5BD' : '#9AA3AE', seed, 0.35); m.scale.y = 0.62; return m; };

export function flower(color) {
  return group(at(cyl(0.025, 0.025, 0.26, '#2F9E44', 5), 0, 0.13, 0),
    at(ball(0.09, color), 0, 0.3, 0), at(ball(0.045, '#FFD43B'), 0, 0.36, 0));
}

const SKINS = ['#FFD9B8', '#F2C29B', '#D9A27A', '#A8714F'];

// Bonhomme articulé : jambes, buste, tête, bras qui pivotent à l'épaule.
// hat : 'casque' (bûcheron), 'toque' (chef) ou rien. Le visage regarde vers +z.
export function person({ color = '#FF6B6B', seed = 0, hat = null, size = 1.2, legs = true } = {}) {
  const skin = SKINS[seed % SKINS.length];
  const arm = (side) => at(group(at(capsule(0.09, 0.28, color), 0, -0.2, 0), at(ball(0.105, skin), 0, -0.43, 0)), side * 0.39, 1.0, 0);
  const armL = arm(-1), armR = arm(1);
  const legL = legs ? at(capsule(0.115, 0.2, '#2F3A5F'), -0.14, 0.22, 0) : null;
  const legR = legs ? at(capsule(0.115, 0.2, '#2F3A5F'), 0.14, 0.22, 0) : null;
  const head = group(ball(0.29, skin),
    at(ball(0.036, '#1B2440'), -0.1, 0.03, 0.262), at(ball(0.036, '#1B2440'), 0.1, 0.03, 0.262));
  if (hat === 'casque') {
    head.add(at(dome(0.305, '#FFD43B', { rough: 0.45 }), 0, 0.04, 0), at(cyl(0.36, 0.36, 0.04, '#FAB005', 24, { rough: 0.45 }), 0, 0.06, 0.05));
  }
  if (hat === 'toque') {
    const puff = at(ball(0.3, '#FFFFFF'), 0, 0.52, 0);
    puff.scale.y = 0.62;
    head.add(at(cyl(0.25, 0.22, 0.26, '#FFFFFF', 20), 0, 0.32, 0), puff);
  }
  const g = group(legL, legR, at(capsule(0.31, 0.36, color), 0, 0.76, 0), at(head, 0, 1.44, 0), armL, armR);
  g.scale.setScalar(size);
  g.userData = { armL, armR, legL, legR, head };
  return g;
}

// Texture de sol : une couleur de base et de grandes taches douces, plus claires ou plus sombres.
export function patchyTexture(base, tones, { size = 1024, count = 110, seed = 7 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Texture de parquet : lames de teintes légèrement différentes.
export function plankTexture(shades, joint, { size = 512, rows = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const hgt = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -noise(r, 3) * size * 0.4, k = 0;
    while (x < size) {
      const w = size * (0.28 + noise(r * 13 + k, 5) * 0.3);
      ctx.fillStyle = shades[Math.floor(noise(r * 7 + k, 9) * shades.length)];
      ctx.fillRect(x, r * hgt, w, hgt);
      ctx.fillStyle = joint;
      ctx.fillRect(x + w - 2, r * hgt, 2, hgt);
      x += w; k++;
    }
    ctx.fillStyle = joint;
    ctx.fillRect(0, r * hgt, size, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Scène prête à animer. Renvoie null si le WebGL est indisponible.
// floor() peut renvoyer une texture ; span = largeur de monde visible à l'écran.
export async function createStage(host, { ground = '#8CC63F', floor = null, repeat = 1, span = 15, tilt = 0.9, lookZ = 0 } = {}) {
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

  const scene = new T.Scene();
  scene.background = new T.Color(ground);
  const FOV = 24;
  const camera = new T.PerspectiveCamera(FOV, 1, 1, 400);

  // Ciel clair + soleil chaud venant de l'avant-gauche + léger contre-jour : le sol
  // éclairé garde sa couleur, les ombres restent douces.
  scene.add(new T.HemisphereLight(0xffffff, 0xcfd8b0, 1.95));
  const sun = new T.DirectionalLight(0xfff1dc, 1.75);
  sun.position.set(-11, 24, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const back = new T.DirectionalLight(0xdfeaff, 0.45);
  back.position.set(10, 12, -14);
  scene.add(back);

  const map = floor ? floor() : null;
  if (map) { map.repeat.set(repeat, repeat); map.anisotropy = 4; }
  const plane = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({ color: map ? '#FFFFFF' : ground, map, roughness: 0.95 }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

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
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let running = true, raf = 0, last = 0, frames = 0, spent = 0;
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
      renderer.dispose();
      canvas.remove();
    },
  };
  const frame = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (time - last) / 1000 || 0);
    last = time;
    if (document.hidden) return;
    stage.onFrame(dt, time / 1000);
    renderer.render(scene, camera);
    // Appareil à la peine (moins de 30 images/s sur les deux premières secondes) :
    // on allège le rendu une fois pour toutes, sans toucher au jeu.
    if (frames >= 0 && dt > 0) {
      frames++; spent += dt;
      if (spent >= 2) {
        if (frames / spent < 30) {
          renderer.setPixelRatio(1);
          sun.shadow.mapSize.set(1024, 1024);
          if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
          resize();
        }
        frames = -1;
      }
    }
  };
  raf = requestAnimationFrame(frame);
  return stage;
}
