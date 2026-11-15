// Petit atelier 3D des jeux de gestion : scène « jouet » vue de trois quarts,
// formes simples à facettes, ombres douces. Three.js n'est chargé qu'à l'ouverture
// d'un de ces jeux (fichier embarqué : fonctionne hors connexion).

let THREE = null;
const mats = new Map();

export async function loadThree() {
  if (!THREE) THREE = await import('../../vendor/three.module.min.js');
  return THREE;
}

export const mat = (color) => {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(color);
};

export function mesh(geometry, color, cast = true) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
export const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
export const cyl = (rTop, rBottom, h, color, seg = 12) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color);
export const ball = (r, color, detail = 1) => mesh(new THREE.IcosahedronGeometry(r, detail), color);
export const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; };
export const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

// Arbre à boules : tronc + trois touffes. Les touffes sont dans « crown » pour pouvoir les faire repousser.
export function tree() {
  const crown = group(
    at(ball(0.95, '#2F9E44', 0), 0, 1.35, 0),
    at(ball(0.7, '#40C057', 0), 0.38, 2.0, 0.12),
    at(ball(0.58, '#2B8A3E', 0), -0.42, 1.85, -0.2));
  const g = group(at(cyl(0.2, 0.3, 0.9, '#8A5A3C', 7), 0, 0.45, 0), crown);
  g.userData.crown = crown;
  return g;
}

// Petit bonhomme : une gélule et une tête.
export function person(color, skin = color, size = 1.35) {
  const body = at(mesh(new THREE.CapsuleGeometry(0.27, 0.42, 3, 8), color), 0, 0.55, 0);
  const head = at(ball(0.25, skin, 1), 0, 1.14, 0);
  const g = group(body, head);
  g.scale.setScalar(size);
  return g;
}

// Scène prête à animer. Renvoie null si le WebGL est indisponible.
export async function createStage(host, { ground = '#9CCB4A', span = 17, tilt = 0.84, lookZ = 0 } = {}) {
  const T = await loadThree();
  const canvas = document.createElement('canvas');
  canvas.className = 'idle-canvas';
  host.append(canvas);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  scene.background = new T.Color(ground);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 60 * Math.sin(tilt), lookZ + 60 * Math.cos(tilt));
  camera.lookAt(0, 0, lookZ);

  // Intensités réglées pour que le sol éclairé garde sa couleur d'origine.
  scene.add(new T.HemisphereLight(0xffffff, 0x8a9a6a, 1.55));
  const sun = new T.DirectionalLight(0xffffff, 1.85);
  sun.position.set(-9, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 3;
  scene.add(sun);

  const floor = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshLambertMaterial({ color: ground }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let width = 1, height = 1;
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const half = span / 2;
    Object.assign(camera, { left: -half, right: half, top: (half * height) / width, bottom: (-half * height) / width });
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

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
      renderer.dispose();
      canvas.remove();
    },
  };

  let running = true, raf = 0, last = 0;
  const frame = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (time - last) / 1000 || 0);
    last = time;
    if (!document.hidden) { stage.onFrame(dt, time / 1000); renderer.render(scene, camera); }
  };
  raf = requestAnimationFrame(frame);
  return stage;
}
