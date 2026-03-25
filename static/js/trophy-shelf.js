import * as THREE from 'three';

// ──────────────────────────────────────────
// SECTION 1: Constants & State
// ──────────────────────────────────────────
const CATEGORY_ORDER = ['reward', 'paper', 'mobility', 'project'];
const CATEGORY_LABELS = { reward: 'Rewards', paper: 'Papers', mobility: 'Mobilities', project: 'Projects' };
const CATEGORY_DEFAULTS = { project: 0x879094, mobility: 0x5b8a72, paper: 0x8a7b5b, reward: 0xc4a44a };
const SHELF_WIDTH = 12;
const MAX_PER_ROW = 5;
const SHELF_SPACING_Y = 2.0;
const IDLE_ROTATION_SPEED = 0.003;
const HOVER_LIFT = 0.15;
const HOVER_ROTATION_SPEED = 0.01;

let scene, camera, renderer, raycaster, mouse;
let itemGroups = [];
let shelfMeshes = [];
let labelSprites = [];
let nameTagSprites = [];
let yearBandSprites = [];
let hoveredItem = null;
let lastTouchedItem = null;
let animationFrameId = null;
let isDarkMode = false;
let mouseNorm = { x: 0, y: 0 };
let baseCameraY = 0;
let lookAtTarget = new THREE.Vector3();
let container = null;
let currentViewMode = 'all';
let allItems = [];
let targetCameraY = 0;
let targetCameraZ = 10;
let targetLookAtY = 0;
let pendingRebuild = false;

// ──────────────────────────────────────────
// SECTION 2: Shape Factory Functions
// ──────────────────────────────────────────
function createTrophyCup(accentColor) {
  const group = new THREE.Group();

  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.15, 0.0),
    new THREE.Vector2(0.12, 0.1),
    new THREE.Vector2(0.08, 0.3),
    new THREE.Vector2(0.08, 0.5),
    new THREE.Vector2(0.2, 0.6),
    new THREE.Vector2(0.35, 0.9),
    new THREE.Vector2(0.38, 1.0),
    new THREE.Vector2(0.35, 1.0),
  ];
  const cupGeom = new THREE.LatheGeometry(points, 32);
  const cupMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.3,
    metalness: 0.6,
  });
  const cup = new THREE.Mesh(cupGeom, cupMat);
  cup.castShadow = true;
  cup.userData.partRole = 'accent';
  group.add(cup);

  const baseGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.8,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.03;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  const plaqueGeom = new THREE.PlaneGeometry(0.2, 0.2);
  const plaqueMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const plaque = new THREE.Mesh(plaqueGeom, plaqueMat);
  plaque.position.set(0, 0.15, 0.26);
  plaque.userData.partRole = 'plaque';
  group.add(plaque);

  group.userData.shapeHeight = 1.1;
  return group;
}

function createGlobe(accentColor) {
  const group = new THREE.Group();

  const sphereGeom = new THREE.SphereGeometry(0.35, 32, 32);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.4,
    metalness: 0.3,
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.y = 0.7;
  sphere.castShadow = true;
  sphere.userData.partRole = 'accent';
  group.add(sphere);

  const ringMat = new THREE.MeshBasicMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    opacity: 0.4,
    transparent: true,
  });

  const ringRotations = [
    { x: 0, y: 0, z: 0 },
    { x: Math.PI / 2, y: 0, z: 0 },
    { x: 0, y: 0, z: (23.5 * Math.PI) / 180 },
  ];

  ringRotations.forEach((rot) => {
    const ringGeom = new THREE.TorusGeometry(0.36, 0.008, 8, 64);
    const ring = new THREE.Mesh(ringGeom, ringMat.clone());
    ring.rotation.set(rot.x, rot.y, rot.z);
    ring.position.y = 0.7;
    ring.userData.partRole = 'structural';
    group.add(ring);
  });

  const poleGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.5,
    metalness: 0.3,
  });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 0.175;
  pole.castShadow = true;
  pole.userData.partRole = 'structural';
  group.add(pole);

  const baseGeom = new THREE.CylinderGeometry(0.2, 0.25, 0.06, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.8,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.03;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  group.userData.shapeHeight = 1.1;
  return group;
}

function createScroll(accentColor) {
  const group = new THREE.Group();

  const bodyGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.7,
    metalness: 0.05,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.55;
  body.castShadow = true;
  body.userData.partRole = 'accent';
  group.add(body);

  const capMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.5,
    metalness: 0.2,
  });

  [-0.37, 0.37].forEach((x) => {
    const capGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 32);
    const cap = new THREE.Mesh(capGeom, capMat.clone());
    cap.rotation.z = Math.PI / 2;
    cap.position.set(x, 0.55, 0);
    cap.castShadow = true;
    cap.userData.partRole = 'structural';
    group.add(cap);
  });

  const ribbonGeom = new THREE.TorusGeometry(0.13, 0.015, 8, 32);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: darkenColor(accentColor, 0.2),
    roughness: 0.6,
    metalness: 0.1,
  });
  const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.y = 0.55;
  ribbon.userData.partRole = 'accent';
  group.add(ribbon);

  const cradleMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.8,
    metalness: 0.1,
  });

  [
    { x: -0.12, zRot: (15 * Math.PI) / 180 },
    { x: 0.12, zRot: (-15 * Math.PI) / 180 },
  ].forEach((cfg) => {
    const armGeom = new THREE.BoxGeometry(0.03, 0.4, 0.03);
    const arm = new THREE.Mesh(armGeom, cradleMat.clone());
    arm.rotation.z = cfg.zRot;
    arm.position.set(cfg.x, 0.2, 0);
    arm.castShadow = true;
    arm.userData.partRole = 'structural';
    group.add(arm);
  });

  const baseGeom = new THREE.BoxGeometry(0.5, 0.06, 0.3);
  const baseMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.8,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.03;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  group.userData.shapeHeight = 1.0;
  return group;
}

function createStar(accentColor) {
  const group = new THREE.Group();

  const starShape = new THREE.Shape();
  const outerR = 0.3;
  const innerR = 0.12;
  const numPoints = 5;

  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const starGeom = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  const starMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.2,
    metalness: 0.7,
  });
  const star = new THREE.Mesh(starGeom, starMat);
  star.position.set(0, 0.85, -0.04);
  star.castShadow = true;
  star.userData.partRole = 'accent';
  group.add(star);

  const poleGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.5,
    metalness: 0.3,
  });
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 0.275;
  pole.castShadow = true;
  pole.userData.partRole = 'structural';
  group.add(pole);

  const baseGeom = new THREE.CylinderGeometry(0.2, 0.25, 0.06, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0xfefefe : 0x353d49,
    roughness: 0.8,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.03;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  group.userData.shapeHeight = 1.2;
  return group;
}

function createShape(itemType, accentColor) {
  switch (itemType) {
    case 'project':
      return createTrophyCup(accentColor);
    case 'mobility':
      return createGlobe(accentColor);
    case 'paper':
      return createScroll(accentColor);
    case 'reward':
      return createStar(accentColor);
    default:
      return createTrophyCup(accentColor);
  }
}

function darkenColor(color, amount) {
  const c = new THREE.Color(color);
  c.r = Math.max(0, c.r - amount);
  c.g = Math.max(0, c.g - amount);
  c.b = Math.max(0, c.b - amount);
  return c;
}

function computeRowCount(items, mode) {
  if (mode === 'all') {
    return Math.max(1, Math.ceil(items.length / MAX_PER_ROW));
  }
  const grouped = {};
  items.forEach((item) => {
    if (!grouped[item.itemType]) grouped[item.itemType] = [];
    grouped[item.itemType].push(item);
  });
  let rows = 0;
  CATEGORY_ORDER.forEach((cat) => {
    if (grouped[cat] && grouped[cat].length > 0) {
      rows += Math.ceil(grouped[cat].length / MAX_PER_ROW);
    }
  });
  return Math.max(1, rows);
}

// ──────────────────────────────────────────
// SECTION 3: Shelf & Label Creation
// ──────────────────────────────────────────
function createShelfMesh(yPosition) {
  const geom = new THREE.BoxGeometry(SHELF_WIDTH, 0.08, 1.5);
  const mat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0x3a3b3d : 0xe8e8e8,
    roughness: 0.9,
    metalness: 0.0,
  });
  const shelf = new THREE.Mesh(geom, mat);
  shelf.position.y = yPosition;
  shelf.receiveShadow = true;
  shelf.userData.partRole = 'structural';
  shelfMeshes.push(shelf);
  return shelf;
}

function createShelfLabel(text, yPosition) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '48px OpenSauceOne, sans-serif';
  ctx.fillStyle = isDarkMode ? '#fefefe' : '#353d49';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(-SHELF_WIDTH / 2 - 0.3, yPosition + 0.6, 0);
  sprite.scale.set(1.5, 0.4, 1);
  sprite.userData.labelText = text;
  labelSprites.push(sprite);
  return sprite;
}

function createNameTag(text, x, y, z) {
  const fontSize = 32;
  const font = fontSize + 'px OpenSauceOne, sans-serif';
  const padding = 16;

  // Measure text width with a temp canvas
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textWidth = measure.measureText(text).width;

  // Size canvas to fit text exactly
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(fontSize * 1.5);
  const ctx = canvas.getContext('2d');

  // Transparent background, white text
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 999;
  sprite.position.set(x, y, z);

  // Scale: fixed height, width proportional to text length
  const spriteHeight = 0.16;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);

  sprite.userData.labelText = text;
  sprite.userData.isNameTag = true;
  nameTagSprites.push(sprite);
  return sprite;
}

function getDigitShape(digit) {
  const s = new THREE.Shape();
  const w = 0.18; // digit width
  const h = 0.32; // digit height
  const t = 0.04; // stroke thickness
  const r = 0.02; // corner radius

  switch (digit) {
    case 0:
      // Outer rounded rect
      s.moveTo(r, 0);
      s.lineTo(w - r, 0);
      s.quadraticCurveTo(w, 0, w, r);
      s.lineTo(w, h - r);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(r, h);
      s.quadraticCurveTo(0, h, 0, h - r);
      s.lineTo(0, r);
      s.quadraticCurveTo(0, 0, r, 0);
      // Inner hole
      const hole0 = new THREE.Path();
      hole0.moveTo(t + r, t);
      hole0.lineTo(w - t - r, t);
      hole0.quadraticCurveTo(w - t, t, w - t, t + r);
      hole0.lineTo(w - t, h - t - r);
      hole0.quadraticCurveTo(w - t, h - t, w - t - r, h - t);
      hole0.lineTo(t + r, h - t);
      hole0.quadraticCurveTo(t, h - t, t, h - t - r);
      hole0.lineTo(t, t + r);
      hole0.quadraticCurveTo(t, t, t + r, t);
      s.holes.push(hole0);
      break;

    case 1:
      // Simple vertical bar, slightly offset right
      const x1 = w * 0.35;
      s.moveTo(x1, 0);
      s.lineTo(x1 + t * 1.2, 0);
      s.lineTo(x1 + t * 1.2, h);
      s.lineTo(x1, h);
      s.lineTo(x1, 0);
      // Small foot
      s.moveTo(x1 - t * 0.5, 0);
      s.lineTo(x1 + t * 1.7, 0);
      s.lineTo(x1 + t * 1.7, t * 0.6);
      s.lineTo(x1 - t * 0.5, t * 0.6);
      s.lineTo(x1 - t * 0.5, 0);
      break;

    case 2:
      // Top arc + diagonal + bottom bar
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, t);
      s.lineTo(t * 1.5, t);
      s.lineTo(w, h - t * 2.5);
      s.lineTo(w, h - t);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(r, h);
      s.quadraticCurveTo(0, h, 0, h - r);
      s.lineTo(0, h - t * 2.5);
      s.lineTo(0, h - t * 2.5);
      s.quadraticCurveTo(0, h - t, t, h - t);
      s.lineTo(w - t * 1.5, h - t);
      s.lineTo(0, t * 1.5);
      s.lineTo(0, 0);
      break;

    case 3:
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, r);
      s.lineTo(w, h / 2 - t / 2);
      s.lineTo(w * 0.5, h / 2 - t / 2);
      s.lineTo(w * 0.5, h / 2 + t / 2);
      s.lineTo(w, h / 2 + t / 2);
      s.lineTo(w, h - r);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(0, h);
      s.lineTo(0, h - t);
      s.lineTo(w - t, h - t);
      s.lineTo(w - t, h / 2 + t / 2);
      s.lineTo(w * 0.35, h / 2 + t / 2);
      s.lineTo(w * 0.35, h / 2 - t / 2);
      s.lineTo(w - t, h / 2 - t / 2);
      s.lineTo(w - t, t);
      s.lineTo(0, t);
      s.lineTo(0, 0);
      break;

    case 4:
      // Inverted L + vertical bar
      const vx = w * 0.6;
      s.moveTo(vx, 0);
      s.lineTo(vx + t, 0);
      s.lineTo(vx + t, h * 0.4 - t);
      s.lineTo(w, h * 0.4 - t);
      s.lineTo(w, h * 0.4);
      s.lineTo(vx + t, h * 0.4);
      s.lineTo(vx + t, h);
      s.lineTo(vx, h);
      s.lineTo(vx, h * 0.4);
      s.lineTo(0, h * 0.4);
      s.lineTo(0, h * 0.4 - t);
      s.lineTo(vx, h * 0.4 - t);
      s.lineTo(vx, 0);
      break;

    case 5:
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, h / 2);
      s.lineTo(t, h / 2);
      s.lineTo(t, h - t);
      s.lineTo(w, h - t);
      s.lineTo(w, h);
      s.lineTo(0, h);
      s.lineTo(0, h / 2 - t);
      s.lineTo(w - t, h / 2 - t);
      s.lineTo(w - t, t);
      s.lineTo(0, t);
      s.lineTo(0, 0);
      break;

    case 6:
      // Outer shape
      s.moveTo(r, 0);
      s.lineTo(w - r, 0);
      s.quadraticCurveTo(w, 0, w, r);
      s.lineTo(w, h / 2);
      s.lineTo(t, h / 2);
      s.lineTo(t, t);
      s.lineTo(w - r, t);
      s.lineTo(w - t, r + t);
      s.lineTo(w - t, h / 2 - t);
      s.lineTo(t, h / 2 - t);
      s.lineTo(t, h - t - r);
      s.quadraticCurveTo(t, h - t, t + r, h - t);
      s.lineTo(w, h - t);
      s.lineTo(w, h);
      s.lineTo(r, h);
      s.quadraticCurveTo(0, h, 0, h - r);
      s.lineTo(0, r);
      s.quadraticCurveTo(0, 0, r, 0);
      break;

    case 7:
      s.moveTo(0, h);
      s.lineTo(w, h);
      s.lineTo(w * 0.35, 0);
      s.lineTo(w * 0.35 - t, 0);
      s.lineTo(w - t * 0.5, h - t);
      s.lineTo(0, h - t);
      s.lineTo(0, h);
      break;

    case 8:
      // Outer rounded rect
      s.moveTo(r, 0);
      s.lineTo(w - r, 0);
      s.quadraticCurveTo(w, 0, w, r);
      s.lineTo(w, h - r);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(r, h);
      s.quadraticCurveTo(0, h, 0, h - r);
      s.lineTo(0, r);
      s.quadraticCurveTo(0, 0, r, 0);
      // Bottom hole
      const hole8b = new THREE.Path();
      hole8b.moveTo(t, t);
      hole8b.lineTo(w - t, t);
      hole8b.lineTo(w - t, h / 2 - t / 2);
      hole8b.lineTo(t, h / 2 - t / 2);
      hole8b.lineTo(t, t);
      s.holes.push(hole8b);
      // Top hole
      const hole8t = new THREE.Path();
      hole8t.moveTo(t, h / 2 + t / 2);
      hole8t.lineTo(w - t, h / 2 + t / 2);
      hole8t.lineTo(w - t, h - t);
      hole8t.lineTo(t, h - t);
      hole8t.lineTo(t, h / 2 + t / 2);
      s.holes.push(hole8t);
      break;

    case 9:
      // Outer shape
      s.moveTo(r, h);
      s.lineTo(w - r, h);
      s.quadraticCurveTo(w, h, w, h - r);
      s.lineTo(w, r);
      s.quadraticCurveTo(w, 0, w - r, 0);
      s.lineTo(0, 0);
      s.lineTo(0, t);
      s.lineTo(w - t, t);
      s.lineTo(w - t, h / 2 + t);
      s.lineTo(t, h / 2 + t);
      s.lineTo(t, h - t);
      s.lineTo(w - t, h - t);
      s.lineTo(w - t, h / 2);
      s.lineTo(0, h / 2);
      s.lineTo(0, h - r);
      s.quadraticCurveTo(0, h, r, h);
      break;

    default:
      // Fallback: simple rectangle
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, h);
      s.lineTo(0, h);
      s.lineTo(0, 0);
  }
  return s;
}

function createDigitMesh(digit, color) {
  const shape = getDigitShape(digit);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.5,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.userData.partRole = 'yearDigit';
  return mesh;
}

function createYearObject(year) {
  const group = new THREE.Group();
  const digits = String(year).split('');
  const digitWidth = 0.22;
  const digitGap = 0.04;
  const totalWidth = digits.length * digitWidth + (digits.length - 1) * digitGap;
  const digitColor = 0xffffff;
  const tapeColor = 0xffffff;

  // Tape base — slightly wider than digits
  const baseWidth = totalWidth + 0.12;
  const baseGeom = new THREE.BoxGeometry(baseWidth, 0.03, 0.2);
  const baseMat = new THREE.MeshStandardMaterial({
    color: tapeColor,
    metalness: 0.1,
    roughness: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.set(0, 0.015, 0);
  base.castShadow = true;
  base.userData.partRole = 'yearTapeBase';
  group.add(base);

  // Place each digit on the base
  digits.forEach((d, i) => {
    const mesh = createDigitMesh(parseInt(d), digitColor);
    const x = -totalWidth / 2 + i * (digitWidth + digitGap);
    mesh.position.set(x, 0.03, -0.03);
    group.add(mesh);
  });

  group.rotation.y = Math.PI / 4;
  group.userData.isYearObject = true;
  group.userData.shapeHeight = 0.38;
  return group;
}

function createYearBand(year, x, shelfY) {
  const yearObj = createYearObject(year);
  yearObj.position.set(x, shelfY + 0.15, 0);
  yearObj.userData.year = year;
  yearBandSprites.push(yearObj);
  return yearObj;
}

function buildShelves(items, mode) {
  const shelfMap = {};
  let rowIndex = 0;

  if (mode === 'all') {
    const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalRows = Math.max(1, Math.ceil(sorted.length / MAX_PER_ROW));
    shelfMap['all'] = [];
    for (let r = 0; r < totalRows; r++) {
      const y = (totalRows - 1 - r) * SHELF_SPACING_Y;
      const shelfMesh = createShelfMesh(y);
      scene.add(shelfMesh);
      shelfMap['all'].push({
        y,
        startIndex: r * MAX_PER_ROW,
        endIndex: Math.min((r + 1) * MAX_PER_ROW, sorted.length),
      });
    }
  } else {
    // Grouped by category
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.itemType]) grouped[item.itemType] = [];
      grouped[item.itemType].push(item);
    });

    CATEGORY_ORDER.forEach((cat) => {
      const catItems = grouped[cat];
      if (!catItems || catItems.length === 0) return;

      const numRows = Math.ceil(catItems.length / MAX_PER_ROW);
      shelfMap[cat] = [];

      for (let r = 0; r < numRows; r++) {
        const y = rowIndex * SHELF_SPACING_Y;
        const shelfMesh = createShelfMesh(y);
        scene.add(shelfMesh);

        if (r === 0) {
          const label = createShelfLabel(CATEGORY_LABELS[cat], y);
          scene.add(label);
        }

        const startIdx = r * MAX_PER_ROW;
        const endIdx = Math.min(startIdx + MAX_PER_ROW, catItems.length);
        shelfMap[cat].push({ y, startIndex: startIdx, endIndex: endIdx });
        rowIndex++;
      }
    });
  }

  return shelfMap;
}

// ──────────────────────────────────────────
// SECTION 4: Scene Setup
// ──────────────────────────────────────────
function initScene(containerId, items) {
  container = document.getElementById(containerId);
  if (!container) return;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.insertBefore(renderer.domElement, container.firstChild);

  // Scene
  scene = new THREE.Scene();

  // Store items for rebuilds
  allItems = items;

  // Camera — always ABOVE all shelves so every shelf is viewed from above
  const totalRows = computeRowCount(items, 'all');
  const totalShelfHeight = (totalRows - 1) * SHELF_SPACING_Y;
  baseCameraY = totalShelfHeight + 1.5;
  targetCameraY = baseCameraY;
  targetCameraZ = 10 + (totalRows - 1) * 2.0;
  targetLookAtY = totalShelfHeight / 2;

  // Set canvas size BEFORE creating camera so aspect ratio is correct
  const canvasHeight = Math.min(Math.max(totalRows * 250 + 100, 350), 900);
  renderer.setSize(container.clientWidth, canvasHeight);

  camera = new THREE.PerspectiveCamera(35, container.clientWidth / canvasHeight, 0.1, 100);
  camera.position.set(0, baseCameraY, targetCameraZ);
  lookAtTarget.set(0, targetLookAtY, 0);
  camera.lookAt(lookAtTarget);

  // Lighting
  setupLighting();

  // Build shelves and place items (default: all mode)
  const shelfMap = buildShelves(items, 'all');
  placeItems(items, shelfMap, 'all');

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Event listeners
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('touchstart', onTouch, { passive: false });
  window.addEventListener('resize', debouncedOnResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', disposeScene);

  const toggleBtn = document.getElementById('shelf-view-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', onToggleClick);

  // Dark mode
  setupDarkModeListener();

  // Start animation
  animate();
}

function setupLighting() {
  const ambientLight = new THREE.AmbientLight(
    isDarkMode ? 0x9fb1b6 : 0xffffff,
    isDarkMode ? 0.4 : 0.6
  );
  ambientLight.userData.lightType = 'ambient';
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.userData.lightType = 'directional';
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(
    isDarkMode ? 0x9fb1b6 : 0xffffff,
    isDarkMode ? 0x252627 : 0x353d49,
    0.3
  );
  hemiLight.userData.lightType = 'hemisphere';
  scene.add(hemiLight);
}

// ──────────────────────────────────────────
// SECTION 5: Texture Helpers
// ──────────────────────────────────────────
function createLetterTexture(letter, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = typeof bgColor === 'string' ? bgColor : '#' + new THREE.Color(bgColor).getHexString();
  ctx.fillRect(0, 0, 128, 128);
  ctx.font = 'bold 64px OpenSauceOne, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter.toUpperCase(), 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function applyPlaque(group, item) {
  group.traverse((child) => {
    if (child.userData.partRole === 'plaque') {
      const color = item.accentColor || CATEGORY_DEFAULTS[item.itemType] || 0x879094;
      const texture = createLetterTexture(item.title.charAt(0), color);
      child.material.map = texture;
      child.material.opacity = 1;
      child.material.needsUpdate = true;
    }
  });
}

// ──────────────────────────────────────────
// SECTION 6: Animation
// ──────────────────────────────────────────
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function updateEntranceAnimations() {
  const now = performance.now();

  // Handle exit animations
  if (pendingRebuild) {
    let allExited = true;
    itemGroups.forEach((group) => {
      if (!group.userData.exiting) return;
      const elapsed = now - group.userData.exitStartTime;
      if (elapsed >= 300) {
        group.scale.set(0, 0, 0);
      } else {
        const t = 1 - elapsed / 300;
        group.scale.set(t, t, t);
        allExited = false;
      }
    });
    if (allExited) {
      pendingRebuild = false;
      rebuildAfterExit();
    }
    return;
  }

  // Entrance animations
  itemGroups.forEach((group) => {
    if (group.userData.entranceComplete) return;
    const elapsed = now - group.userData.entranceStartTime;
    if (elapsed < 0) return;
    if (elapsed >= 600) {
      group.scale.set(1, 1, 1);
      group.userData.entranceComplete = true;
      return;
    }
    const t = elapsed / 600;
    const s = easeOutBack(t);
    group.scale.set(s, s, s);
  });
}

function updateIdleRotations() {
  itemGroups.forEach((group) => {
    if (group.userData.exiting) return;
    if (group === hoveredItem) {
      group.rotation.y += HOVER_ROTATION_SPEED;
    } else {
      group.rotation.y += IDLE_ROTATION_SPEED;
    }
  });
}

function updateHoverAnimation() {
  itemGroups.forEach((group) => {
    if (group.userData.exiting) return;
    const targetY = group === hoveredItem
      ? group.userData.originalY + HOVER_LIFT
      : group.userData.originalY;
    group.position.y += (targetY - group.position.y) * 0.1;
  });
}

function updateTooltipPosition() {
  if (!hoveredItem) return;
  const tooltipEl = document.getElementById('trophy-tooltip');
  if (!tooltipEl || !tooltipEl.classList.contains('visible')) return;

  const tempVec = new THREE.Vector3();
  hoveredItem.getWorldPosition(tempVec);
  tempVec.y += (hoveredItem.userData.shapeHeight || 1.1) + 0.3;
  tempVec.project(camera);

  const rect = renderer.domElement.getBoundingClientRect();
  const x = (tempVec.x * 0.5 + 0.5) * rect.width;
  const y = (-tempVec.y * 0.5 + 0.5) * rect.height;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
}

function updateParallax() {
  // Smooth camera transition on mode switch
  baseCameraY += (targetCameraY - baseCameraY) * 0.05;
  const currentTargetZ = camera.position.z + (targetCameraZ - camera.position.z) * 0.05;
  lookAtTarget.y += (targetLookAtY - lookAtTarget.y) * 0.05;

  camera.position.x += (mouseNorm.x * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (baseCameraY + mouseNorm.y * 0.15 - camera.position.y) * 0.05;
  camera.position.z = currentTargetZ;
  camera.lookAt(lookAtTarget);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  updateEntranceAnimations();
  updateIdleRotations();
  updateHoverAnimation();
  updateTooltipPosition();
  updateParallax();
  renderer.render(scene, camera);
}

// ──────────────────────────────────────────
// SECTION 7: Interaction
// ──────────────────────────────────────────
function findParentItemGroup(object) {
  let obj = object;
  while (obj) {
    if (itemGroups.includes(obj)) return obj;
    obj = obj.parent;
  }
  return null;
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  mouseNorm.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseNorm.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  let found = null;
  for (const hit of intersects) {
    const group = findParentItemGroup(hit.object);
    if (group && !group.userData.exiting) {
      found = group;
      break;
    }
  }

  if (found !== hoveredItem) {
    hoveredItem = found;
    if (hoveredItem) {
      renderer.domElement.style.cursor = 'pointer';
      showTooltip(hoveredItem);
    } else {
      renderer.domElement.style.cursor = 'default';
      hideTooltip();
    }
  }
}

function onClick() {
  if (hoveredItem && hoveredItem.userData.link) {
    window.open(hoveredItem.userData.link, '_blank');
  }
}

function onTouch(event) {
  event.preventDefault();
  const touch = event.touches[0];
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  let found = null;
  for (const hit of intersects) {
    const group = findParentItemGroup(hit.object);
    if (group && !group.userData.exiting) {
      found = group;
      break;
    }
  }

  if (found) {
    if (found === lastTouchedItem && found.userData.link) {
      window.open(found.userData.link, '_blank');
      lastTouchedItem = null;
    } else {
      lastTouchedItem = found;
      hoveredItem = found;
      showTooltip(found);
    }
  } else {
    lastTouchedItem = null;
    hoveredItem = null;
    hideTooltip();
  }
}

function showTooltip(group) {
  const tooltipEl = document.getElementById('trophy-tooltip');
  if (!tooltipEl) return;

  const data = group.userData;
  tooltipEl.querySelector('.tooltip-title').textContent = data.title || '';
  tooltipEl.querySelector('.tooltip-category').textContent = data.itemType || '';
  tooltipEl.querySelector('.tooltip-desc').textContent = data.description || '';

  const tagsContainer = tooltipEl.querySelector('.tooltip-tags');
  tagsContainer.innerHTML = '';
  if (data.tags && data.tags.length) {
    data.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.textContent = tag;
      tagsContainer.appendChild(span);
    });
  }

  const tempVec = new THREE.Vector3();
  group.getWorldPosition(tempVec);
  tempVec.y += (data.shapeHeight || 1.1) + 0.3;
  tempVec.project(camera);

  const rect = renderer.domElement.getBoundingClientRect();
  const x = (tempVec.x * 0.5 + 0.5) * rect.width;
  const y = (-tempVec.y * 0.5 + 0.5) * rect.height;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';

  tooltipEl.classList.add('visible');
}

function hideTooltip() {
  const tooltipEl = document.getElementById('trophy-tooltip');
  if (tooltipEl) tooltipEl.classList.remove('visible');
}

// ──────────────────────────────────────────
// SECTION 8: Dark Mode
// ──────────────────────────────────────────
function setupDarkModeListener() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(mq.matches);
  mq.addEventListener('change', (e) => applyTheme(e.matches));
}

function applyTheme(dark) {
  isDarkMode = dark;
  updateLighting(dark);
  updateMaterials(dark);
  updateShelfLabels(dark);
}

function updateLighting(dark) {
  scene.traverse((obj) => {
    if (obj.userData.lightType === 'ambient') {
      obj.color.set(dark ? 0x9fb1b6 : 0xffffff);
      obj.intensity = dark ? 0.4 : 0.6;
    }
    if (obj.userData.lightType === 'hemisphere') {
      obj.color.set(dark ? 0x9fb1b6 : 0xffffff);
      obj.groundColor.set(dark ? 0x252627 : 0x353d49);
    }
  });
}

function updateMaterials(dark) {
  const structColor = dark ? 0xfefefe : 0x353d49;
  const shelfColor = dark ? 0x3a3b3d : 0xe8e8e8;

  shelfMeshes.forEach((mesh) => {
    mesh.material.color.set(shelfColor);
  });

  itemGroups.forEach((group) => {
    group.traverse((child) => {
      if (child.isMesh && child.userData.partRole === 'structural' && child.material) {
        child.material.color.set(structColor);
      }
    });
  });
}

function updateShelfLabels(dark) {
  labelSprites.forEach((sprite) => {
    const text = sprite.userData.labelText;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = '48px OpenSauceOne, sans-serif';
    ctx.fillStyle = dark ? '#fefefe' : '#353d49';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10, 64);

    const oldTexture = sprite.material.map;
    sprite.material.map = new THREE.CanvasTexture(canvas);
    sprite.material.map.needsUpdate = true;
    sprite.material.needsUpdate = true;
    if (oldTexture) oldTexture.dispose();
  });

  nameTagSprites.forEach((sprite) => {
    const text = sprite.userData.labelText;
    const fontSize = 32;
    const font = fontSize + 'px OpenSauceOne, sans-serif';
    const padding = 16;

    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const textWidth = measure.measureText(text).width;

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = Math.ceil(fontSize * 1.5);
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(53,61,73,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const oldTexture = sprite.material.map;
    sprite.material.map = new THREE.CanvasTexture(canvas);
    sprite.material.map.needsUpdate = true;
    sprite.material.needsUpdate = true;
    if (oldTexture) oldTexture.dispose();
  });

  // Year band 3D digits use MeshStandardMaterial — no texture updates needed
}

// ──────────────────────────────────────────
// SECTION 9: View Mode Switching
// ──────────────────────────────────────────
function clearScene() {
  hoveredItem = null;
  hideTooltip();

  itemGroups.forEach((g) => {
    scene.remove(g);
    g.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    });
  });
  shelfMeshes.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  labelSprites.forEach((s) => {
    scene.remove(s);
    if (s.material.map) s.material.map.dispose();
    s.material.dispose();
  });

  nameTagSprites.forEach((s) => {
    scene.remove(s);
    if (s.material.map) s.material.map.dispose();
    s.material.dispose();
  });

  yearBandSprites.forEach((g) => {
    scene.remove(g);
    g.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    });
  });

  itemGroups = [];
  shelfMeshes = [];
  labelSprites = [];
  nameTagSprites = [];
  yearBandSprites = [];
}

function switchViewMode(newMode) {
  if (newMode === currentViewMode) return;
  currentViewMode = newMode;

  const btn = document.getElementById('shelf-view-toggle');
  if (btn) btn.disabled = true;

  const now = performance.now();
  pendingRebuild = true;
  itemGroups.forEach((g) => {
    g.userData.exiting = true;
    g.userData.exitStartTime = now;
  });
}

function rebuildAfterExit() {
  clearScene();

  const shelfMap = buildShelves(allItems, currentViewMode);
  placeItems(allItems, shelfMap, currentViewMode);

  // Smooth camera transition targets
  const totalRows = computeRowCount(allItems, currentViewMode);
  const totalShelfHeight = (totalRows - 1) * SHELF_SPACING_Y;
  targetCameraY = totalShelfHeight + 1.5;
  targetCameraZ = 10 + (totalRows - 1) * 2.0;
  targetLookAtY = totalShelfHeight / 2;

  // Update canvas height
  const canvasHeight = Math.min(Math.max(totalRows * 250 + 100, 350), 900);
  renderer.setSize(container.clientWidth, canvasHeight);
  camera.aspect = container.clientWidth / canvasHeight;
  camera.updateProjectionMatrix();

  const btn = document.getElementById('shelf-view-toggle');
  if (btn) {
    btn.textContent = currentViewMode === 'all' ? 'Group by type' : 'Show all';
    btn.disabled = false;
  }
}

function onToggleClick() {
  switchViewMode(currentViewMode === 'all' ? 'grouped' : 'all');
}

// ──────────────────────────────────────────
// SECTION 10: Item Placement
// ──────────────────────────────────────────
function placeItems(items, shelfMap, mode) {
  let globalIndex = 0;
  const now = performance.now();

  if (mode === 'all') {
    const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = shelfMap['all'] || [];

    rows.forEach((row) => {
      const rowItems = sorted.slice(row.startIndex, row.endIndex);

      // Build slot list: items first, then year tape after each year group
      // Order: [2026 items] [2026 tape] [2025 items] [2025 tape] ...
      const slots = [];

      rowItems.forEach((item, i) => {
        const curYear = new Date(item.date).getFullYear();
        slots.push({ type: 'item', item });
        // Insert year tape after this item if the next item is a different year or this is the last item in the row
        const nextYear = i < rowItems.length - 1 ? new Date(rowItems[i + 1].date).getFullYear() : null;
        if (nextYear === null || nextYear !== curYear) {
          slots.push({ type: 'year', year: curYear });
        }
      });

      const totalSlots = slots.length;
      const spacing = SHELF_WIDTH / (totalSlots + 1);

      slots.forEach((slot, si) => {
        const x = -SHELF_WIDTH / 2 + spacing * (si + 1);

        if (slot.type === 'year') {
          const band = createYearBand(slot.year, x, row.y);
          scene.add(band);
        } else {
          const item = slot.item;
          const color = item.accentColor
            ? new THREE.Color(item.accentColor)
            : new THREE.Color(CATEGORY_DEFAULTS[item.itemType] || 0x879094);

          const group = createShape(item.itemType, color);
          const y = row.y + 0.15;
          group.position.set(x, y, 0);

          group.userData.title = item.title;
          group.userData.description = item.description;
          group.userData.link = item.url;
          group.userData.tags = item.tags;
          group.userData.itemType = item.itemType;
          group.userData.originalY = y;

          group.rotation.y = Math.random() * Math.PI * 2;
          group.scale.set(0, 0, 0);
          group.userData.entranceStartTime = now + globalIndex * 120;
          group.userData.entranceComplete = false;

          applyPlaque(group, item);
          scene.add(group);
          itemGroups.push(group);

          // Floating name tag below the object
          const tag = createNameTag(item.title, x, row.y - 0.15, 1.0);
          scene.add(tag);

          globalIndex++;
        }
      });
    });
  } else {
    // Grouped mode
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.itemType]) grouped[item.itemType] = [];
      grouped[item.itemType].push(item);
    });

    CATEGORY_ORDER.forEach((cat) => {
      const rows = shelfMap[cat];
      if (!rows) return;

      const catItems = grouped[cat] || [];
      catItems.sort((a, b) => {
        if (a.weight !== undefined && b.weight !== undefined) return a.weight - b.weight;
        if (a.weight !== undefined) return -1;
        if (b.weight !== undefined) return 1;
        return new Date(a.date) - new Date(b.date);
      });

      rows.forEach((row) => {
        const rowItems = catItems.slice(row.startIndex, row.endIndex);
        const numItems = rowItems.length;
        const spacing = SHELF_WIDTH / (numItems + 1);

        rowItems.forEach((item, i) => {
          const color = item.accentColor
            ? new THREE.Color(item.accentColor)
            : new THREE.Color(CATEGORY_DEFAULTS[item.itemType] || 0x879094);

          const group = createShape(item.itemType, color);
          const x = -SHELF_WIDTH / 2 + spacing * (i + 1);
          const y = row.y + 0.15;
          group.position.set(x, y, 0);

          group.userData.title = item.title;
          group.userData.description = item.description;
          group.userData.link = item.url;
          group.userData.tags = item.tags;
          group.userData.itemType = item.itemType;
          group.userData.originalY = y;

          group.rotation.y = Math.random() * Math.PI * 2;
          group.scale.set(0, 0, 0);
          group.userData.entranceStartTime = now + globalIndex * 120;
          group.userData.entranceComplete = false;

          applyPlaque(group, item);
          scene.add(group);
          itemGroups.push(group);

          // Floating name tag below the object
          const tag = createNameTag(item.title, x, row.y - 0.15, 1.0);
          scene.add(tag);

          globalIndex++;
        });
      });
    });
  }
}

// ──────────────────────────────────────────
// SECTION 11: Responsiveness & Cleanup
// ──────────────────────────────────────────
let resizeTimeout = null;
function debouncedOnResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(onResize, 100);
}

function onResize() {
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const totalRows = computeRowCount(allItems, currentViewMode);
  const height = Math.min(Math.max(totalRows * 250 + 100, 350), 900);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onVisibilityChange() {
  if (document.hidden) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  } else {
    if (!animationFrameId) {
      animate();
    }
  }
}

function disposeScene() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  if (renderer && renderer.domElement) {
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('touchstart', onTouch);
  }
  window.removeEventListener('resize', debouncedOnResize);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', disposeScene);
}

// ──────────────────────────────────────────
// SECTION 12: Entry Point
// ──────────────────────────────────────────
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

function showFallback() {
  const fallback = document.querySelector('.trophy-fallback');
  if (fallback) fallback.style.display = 'block';
}

function main() {
  const items = window.__shelfItems || [];
  if (!items.length) {
    showFallback();
    return;
  }
  if (window.innerWidth < 600 || !hasWebGL()) {
    showFallback();
    return;
  }
  try {
    initScene('trophy-shelf-container', items);
  } catch (e) {
    console.error('Trophy shelf init failed:', e);
    showFallback();
  }
}

// Wait for fonts to load so canvas text renders with OpenSauceOne
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(main);
} else {
  main();
}
