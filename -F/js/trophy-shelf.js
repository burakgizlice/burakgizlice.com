import * as THREE from 'three';

// ──────────────────────────────────────────
// SECTION 1: Constants & State
// ──────────────────────────────────────────
const CATEGORY_ORDER = ['milestone', 'community', 'paper', 'mobility', 'project'];
const CATEGORY_LABELS = {
  milestone: 'Milestones',
  community: 'Community',
  paper: 'Papers',
  mobility: 'Mobilities',
  project: 'Projects',
};
const CATEGORY_DEFAULTS = {
  project: 0x879094,
  mobility: 0x5b8a72,
  paper: 0x8a7b5b,
  milestone: 0xc4a44a,
  community: 0x4a7a96,
};
const SHELF_WIDTH = 9;
const MAX_PER_ROW = 5;
const SHELF_SPACING_Y = 1.7;
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
function createPackage(accentColor) {
  const group = new THREE.Group();
  const structColor = isDarkMode ? 0xfefefe : 0x353d49;
  const cardboardColor = 0xb8895e;
  const cardboardSeam = 0x8f6538;
  const tapeColor = 0x7a5535;

  const baseGeom = new THREE.CylinderGeometry(0.22, 0.25, 0.05, 28);
  const baseMat = new THREE.MeshStandardMaterial({
    color: structColor, roughness: 0.8, metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.025;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  // Cardboard body
  const W = 0.38, H = 0.34, D = 0.32;
  const boxGeom = new THREE.BoxGeometry(W, H, D);
  const boxMat = new THREE.MeshStandardMaterial({
    color: cardboardColor, roughness: 0.95, metalness: 0.0,
  });
  const box = new THREE.Mesh(boxGeom, boxMat);
  box.position.y = H / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  box.userData.partRole = 'cardboard';
  group.add(box);

  // Darker seam across the top flap line
  const seamMat = new THREE.MeshStandardMaterial({
    color: cardboardSeam, roughness: 0.95, metalness: 0.0,
  });
  const topSeamGeom = new THREE.BoxGeometry(W + 0.002, 0.0015, 0.003);
  const topSeam = new THREE.Mesh(topSeamGeom, seamMat.clone());
  topSeam.position.set(0, H + 0.001, 0);
  topSeam.userData.partRole = 'seam';
  group.add(topSeam);

  // Vertical flap seams on the two short sides
  const sideSeamGeom = new THREE.BoxGeometry(0.003, H - 0.002, 0.0015);
  [-1, 1].forEach((dx) => {
    const s = new THREE.Mesh(sideSeamGeom, seamMat.clone());
    s.position.set(dx * (W / 2 + 0.001), H / 2, 0);
    s.userData.partRole = 'seam';
    group.add(s);
  });

  // Brown packing tape across seam and down both short sides
  const tapeMat = new THREE.MeshStandardMaterial({
    color: tapeColor, roughness: 0.45, metalness: 0.0,
  });
  const tapeTopGeom = new THREE.BoxGeometry(W + 0.008, 0.002, 0.07);
  const tapeTop = new THREE.Mesh(tapeTopGeom, tapeMat.clone());
  tapeTop.position.set(0, H + 0.002, 0);
  tapeTop.userData.partRole = 'tape';
  group.add(tapeTop);

  const tapeSideGeom = new THREE.BoxGeometry(0.006, H + 0.004, 0.07);
  [-1, 1].forEach((dx) => {
    const tapeSide = new THREE.Mesh(tapeSideGeom, tapeMat.clone());
    tapeSide.position.set(dx * (W / 2 + 0.002), H / 2, 0);
    tapeSide.userData.partRole = 'tape';
    group.add(tapeSide);
  });

  // Shipping label on the front face
  const labelGeom = new THREE.PlaneGeometry(0.18, 0.11);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xfafaf0, roughness: 0.9, metalness: 0,
  });
  const label = new THREE.Mesh(labelGeom, labelMat);
  label.position.set(-0.04, H * 0.58, D / 2 + 0.002);
  label.userData.partRole = 'label';
  group.add(label);

  // Accent-colored header stripe on the label
  const stripeGeom = new THREE.PlaneGeometry(0.18, 0.022);
  const stripeMat = new THREE.MeshStandardMaterial({
    color: accentColor, roughness: 0.5, metalness: 0.2,
  });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.position.set(-0.04, H * 0.58 + 0.044, D / 2 + 0.003);
  stripe.userData.partRole = 'accent';
  group.add(stripe);

  // Text rows below the stripe
  const labelLineMat = new THREE.MeshBasicMaterial({
    color: 0x555555, transparent: true, opacity: 0.85,
  });
  const labelLines = [
    { w: 0.14, y: 0.015 },
    { w: 0.1, y: -0.005 },
    { w: 0.12, y: -0.025 },
    { w: 0.08, y: -0.045 },
  ];
  labelLines.forEach((def) => {
    const lineGeom = new THREE.PlaneGeometry(def.w, 0.005);
    const line = new THREE.Mesh(lineGeom, labelLineMat.clone());
    line.position.set(-0.04 - (0.18 - def.w) / 2 + 0.02, H * 0.58 + def.y, D / 2 + 0.003);
    line.userData.partRole = 'labelline';
    group.add(line);
  });

  group.userData.shapeHeight = 0.42;
  return group;
}

function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Ocean
  ctx.fillStyle = '#2a6cab';
  ctx.fillRect(0, 0, 1024, 512);

  // Continents — overlapping green blobs
  ctx.fillStyle = '#4f9a42';
  const blob = (circles) => {
    circles.forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // North America
  blob([
    [180, 170, 70], [130, 140, 55], [225, 140, 50],
    [150, 215, 42], [210, 225, 38], [100, 180, 30],
  ]);
  // Central America + Caribbean
  blob([[230, 255, 22], [255, 270, 18]]);
  // South America
  blob([
    [275, 300, 48], [290, 360, 40], [295, 410, 26],
    [270, 260, 28],
  ]);
  // Europe
  blob([[505, 155, 42], [540, 175, 38], [475, 170, 28]]);
  // Africa
  blob([
    [525, 250, 55], [555, 315, 58], [540, 375, 48], [555, 420, 32],
  ]);
  // Middle East / Asia
  blob([
    [600, 200, 45], [660, 160, 70], [740, 155, 65], [810, 175, 55],
    [625, 105, 35], [705, 100, 40], [780, 115, 35],
    [720, 220, 38], [785, 235, 40], [690, 260, 28],
  ]);
  // Southeast Asia / Indonesia
  blob([
    [820, 280, 20], [855, 285, 16], [880, 270, 13], [800, 265, 12],
  ]);
  // Australia
  blob([[895, 350, 42], [925, 355, 32], [870, 345, 22]]);

  // Antarctica — thin ice strip
  ctx.fillStyle = '#eaf1ee';
  ctx.fillRect(0, 472, 1024, 40);

  const texture = new THREE.CanvasTexture(canvas);
  if ('SRGBColorSpace' in THREE) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createGlobe(accentColor) {
  const group = new THREE.Group();
  const structColor = isDarkMode ? 0xfefefe : 0x353d49;

  const baseGeom = new THREE.CylinderGeometry(0.2, 0.24, 0.05, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: structColor, roughness: 0.8, metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.025;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  // Tilted axle through the globe
  const axleGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.86, 10);
  const axleMat = new THREE.MeshStandardMaterial({
    color: structColor, roughness: 0.5, metalness: 0.4,
  });
  const axle = new THREE.Mesh(axleGeom, axleMat);
  axle.rotation.z = (23.5 * Math.PI) / 180;
  axle.position.y = 0.42;
  axle.userData.partRole = 'structural';
  group.add(axle);

  // Globe subgroup so sphere + ring tilt together
  const globeGroup = new THREE.Group();
  globeGroup.rotation.z = (23.5 * Math.PI) / 180;
  globeGroup.position.y = 0.48;
  group.add(globeGroup);

  // Earth sphere (blue ocean + green continents via canvas texture)
  const R = 0.3;
  const sphereGeom = new THREE.SphereGeometry(R, 48, 32);
  const earthTex = createEarthTexture();
  const sphereMat = new THREE.MeshStandardMaterial({
    map: earthTex, roughness: 0.75, metalness: 0.05,
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.castShadow = true;
  sphere.userData.partRole = 'earth';
  globeGroup.add(sphere);

  // Brass equator ring
  const ringGeom = new THREE.TorusGeometry(R + 0.014, 0.006, 6, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd4b863, roughness: 0.3, metalness: 0.75,
  });
  const equator = new THREE.Mesh(ringGeom, ringMat);
  equator.rotation.x = Math.PI / 2;
  equator.userData.partRole = 'meridian';
  globeGroup.add(equator);

  group.userData.shapeHeight = 0.9;
  return group;
}

function createPaper(accentColor) {
  const group = new THREE.Group();
  const paperColor = 0xf8f6ed;

  // Paper is built lying flat in the subgroup's local frame, then rotated
  // 90° so the printed face points at the camera (+z).
  const paperGroup = new THREE.Group();
  paperGroup.rotation.x = Math.PI / 2;
  paperGroup.position.y = 0.3;
  group.add(paperGroup);

  // Sheet
  const sheetGeom = new THREE.BoxGeometry(0.42, 0.01, 0.58);
  const sheetMat = new THREE.MeshStandardMaterial({
    color: paperColor, roughness: 0.9, metalness: 0.0,
  });
  const sheet = new THREE.Mesh(sheetGeom, sheetMat);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  sheet.userData.partRole = 'paper';
  paperGroup.add(sheet);

  // Title band near the top edge (negative z in local = top after rotation)
  const titleGeom = new THREE.BoxGeometry(0.34, 0.005, 0.055);
  const titleMat = new THREE.MeshStandardMaterial({
    color: accentColor, roughness: 0.5, metalness: 0.25,
  });
  const title = new THREE.Mesh(titleGeom, titleMat);
  title.position.set(0, 0.007, -0.22);
  title.userData.partRole = 'accent';
  paperGroup.add(title);

  // Body text rows printed on the front face
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x555555, roughness: 0.9, metalness: 0,
  });
  const lineDefs = [
    { w: 0.32, z: -0.15 },
    { w: 0.3, z: -0.11 },
    { w: 0.32, z: -0.07 },
    { w: 0.28, z: -0.03 },
    { w: 0.3, z: 0.01 },
    { w: 0.32, z: 0.05 },
    { w: 0.26, z: 0.09 },
    { w: 0.3, z: 0.13 },
    { w: 0.28, z: 0.17 },
    { w: 0.22, z: 0.21 },
  ];
  lineDefs.forEach((def) => {
    const lineGeom = new THREE.BoxGeometry(def.w, 0.002, 0.008);
    const line = new THREE.Mesh(lineGeom, bodyMat.clone());
    line.position.set(-0.02, 0.006, def.z);
    line.userData.partRole = 'textline';
    paperGroup.add(line);
  });

  group.userData.shapeHeight = 0.62;
  return group;
}

function createBonsai(accentColor) {
  const group = new THREE.Group();
  const structColor = isDarkMode ? 0xfefefe : 0x353d49;

  // Display base plate
  const baseGeom = new THREE.CylinderGeometry(0.2, 0.23, 0.05, 28);
  const baseMat = new THREE.MeshStandardMaterial({
    color: structColor, roughness: 0.8, metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.025;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  // Ceramic pot (slightly tapered)
  const potColor = 0x6b4937;
  const potMat = new THREE.MeshStandardMaterial({
    color: potColor, roughness: 0.45, metalness: 0.15,
  });
  const potGeom = new THREE.CylinderGeometry(0.16, 0.13, 0.09, 24);
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.y = 0.045;
  pot.castShadow = true;
  pot.receiveShadow = true;
  pot.userData.partRole = 'pot';
  group.add(pot);

  // Pot rim (thicker edge at the top)
  const potRimGeom = new THREE.TorusGeometry(0.16, 0.009, 6, 28);
  const potRim = new THREE.Mesh(potRimGeom, potMat.clone());
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = 0.09;
  potRim.userData.partRole = 'pot';
  group.add(potRim);

  // Soil layer
  const soilGeom = new THREE.CylinderGeometry(0.148, 0.148, 0.016, 24);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x3a2818, roughness: 0.95, metalness: 0,
  });
  const soil = new THREE.Mesh(soilGeom, soilMat);
  soil.position.y = 0.093;
  soil.userData.partRole = 'soil';
  group.add(soil);

  // Gnarled trunk (offset + leaning for bonsai character)
  const trunkColor = 0x5a3a20;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor, roughness: 0.85, metalness: 0,
  });
  const trunkGeom = new THREE.CylinderGeometry(0.022, 0.038, 0.16, 12);
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.set(0.02, 0.18, 0);
  trunk.rotation.z = 0.18;
  trunk.castShadow = true;
  trunk.userData.partRole = 'trunk';
  group.add(trunk);

  // Horizontal side branch (classic bonsai silhouette)
  const branchGeom = new THREE.CylinderGeometry(0.012, 0.02, 0.1, 10);
  const branch = new THREE.Mesh(branchGeom, trunkMat.clone());
  branch.position.set(0.08, 0.22, 0);
  branch.rotation.z = Math.PI / 2 - 0.3;
  branch.castShadow = true;
  branch.userData.partRole = 'trunk';
  group.add(branch);

  // Foliage — low-poly faceted clusters in natural greens
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4f9a42, roughness: 0.7, metalness: 0,
    flatShading: true,
  });
  [
    { x: 0.03, y: 0.35, z: 0, r: 0.11 },
    { x: -0.05, y: 0.31, z: 0.04, r: 0.085 },
    { x: 0.12, y: 0.3, z: -0.03, r: 0.085 },
    { x: 0.09, y: 0.34, z: 0.05, r: 0.065 },
    { x: -0.01, y: 0.4, z: -0.04, r: 0.075 },
    { x: 0.14, y: 0.27, z: 0.02, r: 0.055 },
  ].forEach((cl) => {
    const leafGeom = new THREE.IcosahedronGeometry(cl.r, 0);
    const leaf = new THREE.Mesh(leafGeom, leafMat.clone());
    leaf.position.set(cl.x, cl.y, cl.z);
    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    leaf.castShadow = true;
    leaf.userData.partRole = 'leaves';
    group.add(leaf);
  });

  // Accent-colored blossoms scattered through the canopy
  const blossomMat = new THREE.MeshStandardMaterial({
    color: accentColor, roughness: 0.4, metalness: 0.2,
    emissive: accentColor, emissiveIntensity: 0.2,
  });
  [
    { x: -0.03, y: 0.37, z: 0.09 },
    { x: 0.1, y: 0.33, z: 0.06 },
    { x: 0.15, y: 0.28, z: -0.04 },
    { x: 0.04, y: 0.42, z: 0.02 },
  ].forEach((pos) => {
    const bGeom = new THREE.SphereGeometry(0.015, 10, 10);
    const blossom = new THREE.Mesh(bGeom, blossomMat.clone());
    blossom.position.set(pos.x, pos.y, pos.z);
    blossom.userData.partRole = 'accent';
    group.add(blossom);
  });

  group.userData.shapeHeight = 0.55;
  return group;
}

function createMegaphone(accentColor) {
  const group = new THREE.Group();
  const structColor = isDarkMode ? 0xfefefe : 0x353d49;

  const baseGeom = new THREE.CylinderGeometry(0.2, 0.23, 0.05, 28);
  const baseMat = new THREE.MeshStandardMaterial({
    color: structColor, roughness: 0.8, metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -0.025;
  base.castShadow = true;
  base.userData.partRole = 'structural';
  group.add(base);

  // Sleek dark-metal materials
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.3, metalness: 0.9,
  });
  const darkerMetalMat = new THREE.MeshStandardMaterial({
    color: 0x16181c, roughness: 0.35, metalness: 0.9,
  });

  // Megaphone subgroup — horn pointing along +z
  const megGroup = new THREE.Group();
  megGroup.position.y = 0.36;
  group.add(megGroup);

  // Horn (cone, wide opening forward)
  const hornGeom = new THREE.ConeGeometry(0.2, 0.42, 32, 1, true);
  const horn = new THREE.Mesh(hornGeom, darkMetalMat);
  horn.rotation.x = -Math.PI / 2;
  horn.castShadow = true;
  horn.userData.partRole = 'megaphone';
  megGroup.add(horn);

  // Inner cone lining (slightly inset, darker)
  const innerGeom = new THREE.ConeGeometry(0.185, 0.4, 28, 1, true);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x0d0e11, roughness: 0.6, metalness: 0.7,
    side: THREE.BackSide,
  });
  const inner = new THREE.Mesh(innerGeom, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.userData.partRole = 'megaphone';
  megGroup.add(inner);

  // Front rim ring
  const rimGeom = new THREE.TorusGeometry(0.2, 0.014, 10, 32);
  const rim = new THREE.Mesh(rimGeom, darkerMetalMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = 0.21;
  rim.castShadow = true;
  rim.userData.partRole = 'megaphone';
  megGroup.add(rim);

  // Back cap (mouthpiece housing)
  const backGeom = new THREE.SphereGeometry(0.05, 16, 16);
  const back = new THREE.Mesh(backGeom, darkerMetalMat.clone());
  back.position.z = -0.22;
  back.castShadow = true;
  back.userData.partRole = 'megaphone';
  megGroup.add(back);

  // Handle (pistol-grip style, angled slightly backward)
  const handleGeom = new THREE.CylinderGeometry(0.026, 0.028, 0.22, 16);
  const handle = new THREE.Mesh(handleGeom, darkMetalMat.clone());
  handle.position.set(0, -0.17, -0.1);
  handle.rotation.x = 0.18;
  handle.castShadow = true;
  handle.userData.partRole = 'megaphone';
  megGroup.add(handle);

  // Grip end cap
  const gripGeom = new THREE.CylinderGeometry(0.033, 0.03, 0.035, 16);
  const grip = new THREE.Mesh(gripGeom, darkerMetalMat.clone());
  grip.position.set(0, -0.28, -0.07);
  grip.rotation.x = 0.18;
  grip.castShadow = true;
  grip.userData.partRole = 'megaphone';
  megGroup.add(grip);

  // Accent-colored trigger/LED on the handle front face
  const triggerGeom = new THREE.BoxGeometry(0.045, 0.022, 0.018);
  const triggerMat = new THREE.MeshStandardMaterial({
    color: accentColor, roughness: 0.3, metalness: 0.4,
    emissive: accentColor, emissiveIntensity: 0.5,
  });
  const trigger = new THREE.Mesh(triggerGeom, triggerMat);
  trigger.position.set(0, -0.11, -0.065);
  trigger.rotation.x = 0.18;
  trigger.userData.partRole = 'accent';
  megGroup.add(trigger);

  // Top mount strap (small detail on top of horn)
  const strapGeom = new THREE.BoxGeometry(0.04, 0.01, 0.08);
  const strap = new THREE.Mesh(strapGeom, darkerMetalMat.clone());
  strap.position.set(0, 0.1, -0.05);
  strap.userData.partRole = 'megaphone';
  megGroup.add(strap);

  group.userData.shapeHeight = 0.75;
  return group;
}

function createShape(itemType, accentColor) {
  switch (itemType) {
    case 'project':
      return createPackage(accentColor);
    case 'mobility':
      return createGlobe(accentColor);
    case 'paper':
      return createPaper(accentColor);
    case 'milestone':
      return createBonsai(accentColor);
    case 'community':
      return createMegaphone(accentColor);
    default:
      return createBonsai(accentColor);
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
  targetCameraZ = 7 + (totalRows - 1) * 1.7;
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

function navigateToItem(group) {
  if (!group || !group.userData.link) return;
  if (group.userData.externalLink) {
    window.open(group.userData.link, '_blank', 'noopener');
  } else {
    window.location.href = group.userData.link;
  }
}

function onClick() {
  if (hoveredItem) navigateToItem(hoveredItem);
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
      navigateToItem(found);
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
  targetCameraZ = 7 + (totalRows - 1) * 1.7;
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
          group.userData.externalLink = !!item.externalLink;
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
          group.userData.externalLink = !!item.externalLink;
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
