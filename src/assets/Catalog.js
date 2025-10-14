// Procedural NASA pad kit (texture-free) — Round 3
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeCatalog() {
  const tile = { x: 4, y: 4, z: 4 };

  return [
    // --- Tool ---
    { id: "tool_pit_digger", name: "Pit Digger", category: "Tools", baseType: "tool", size: { x: 4, y: 4, z: 4 }, preview: "#ff6b6b" },

    // --- Floors ---
    { id: "floor_concrete_01", name: "Concrete Slab", category: "Floors", baseType: "floor", subType: "concrete_slab", size: { x:4, y:0.3, z:4 }, preview: "#9aa2ab" },
    { id: "floor_plate_01",    name: "Steel Plate",   category: "Floors", baseType: "floor", subType: "plate_01",      size: { x:4, y:0.25, z:4 }, preview: "#7f8a95" },

    // --- Walls / Edge-snapping, stackable ---
    { id: "wall_flat_smooth", name: "Wall • Smooth",  category: "Walls", baseType: "wall", subType: "flat_smooth", size: { ...tile, z: 0.35 }, preview: "#6c7681" },
    { id: "wall_flat_panel",  name: "Wall • Sci-Panel", category: "Walls", baseType: "wall", subType: "flat_panel", size: { ...tile, z: 0.45 }, preview: "#7b8591" },
    { id: "wall_flat_window", name: "Wall • Window",  category: "Walls", baseType: "wall", subType: "flat_window", size: { ...tile, z: 0.45 }, preview: "#8a95a0" },
    { id: "wall_concrete_jersey", name: "Concrete Barrier", category: "Walls", baseType: "wall", subType: "jersey", size: { x:4, y:2, z:0.8 }, preview: "#9aa2ab" },

    // --- Columns / Truss (edge snap + stacking) ---
    { id: "column_round_01", name: "Column (1×4)", category: "Beams & Columns", baseType: "wall", subType: "column_round_flatcaps", size: { x:1, y:4, z:1 }, preview: "#a7b3c0" },
    { id: "truss_frame_01",  name: "Truss Frame", category: "Beams & Columns", baseType: "wall", subType: "truss", size: { x:4, y:4, z:0.5 }, preview: "#a7b3c0" },

    // --- Railings (edge snap) ---
    { id: "railing_guard_01", name: "Guard Railing", category: "Ramps & Railings", baseType: "railing", subType: "guard", size: { x:4, y:1.1, z:0.25 }, preview: "#b1bdca" },

    // --- Pipes (tile snap) ---
    { id: "pipe_elbow_01",   name: "Pipe Elbow", category: "Pipes", baseType: "pipe", subType: "elbow_flanged", size: { x:0.6, y:0.6, z:2 }, preview: "#8f9aa5" },
    { id: "pipe_full_01",    name: "Pipe Full",  category: "Pipes", baseType: "pipe", subType: "full_flanged",  size: { x:0.6, y:0.6, z:4 }, preview: "#8f9aa5" },
    // (straight pipe removed by request)

    // --- Lights ---
    { id: "light_flood_down", name: "Flood • Down", category: "Lights", baseType: "light", subType: "flood_down", size: { x:1.2, y:3.8, z:0.6 }, preview: "#e8f0ff" },
    { id: "light_flood_up",   name: "Flood • Up",   category: "Lights", baseType: "light", subType: "flood_up",   size: { x:1.2, y:3.8, z:0.6 }, preview: "#e8f0ff" },
  ];
}

/* ---------- Builder entry ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const M = (hex, { rough=0.7, metal=0.0, emissive=0x000000, eInt=0 } = {}) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex || options.primaryColor || '#9EAAB9'),
    roughness: ('roughness' in options) ? options.roughness : rough,
    metalness: ('metalness' in options) ? options.metalness : metal,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: eInt,
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  let obj;
  switch (def.baseType) {
    case 'floor':   obj = buildFloor(def, M); break;
    case 'wall':    obj = buildWallLike(def, M); break;
    case 'railing': obj = buildRailing(def, M); break;
    case 'pipe':    obj = buildPipe(def, M); break;
    case 'light':   obj = buildLight(def, M); break;
    default:
      obj = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z), M('#9EAAB9'));
  }
  obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
  obj.userData.part = def;
  return obj;
}

/* ---------- Floors ---------- */
function buildFloor(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'concrete_slab') {
    // Flat tile, no painted lines, no bevel gap
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#9aa2ab', { rough: 0.88 }));
    g.add(slab);
    return g;
  }

  if (def.subType === 'plate_01') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    addCornerBolts(g, w, d, h, M('#5a626b', { rough: 0.4, metal: 0.7 }));
    return g;
  }

  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Walls / Columns / Truss ---------- */
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'flat_smooth') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6b7480', { rough: 0.6, metal: 0.1 })));
    return g;
  }

  if (def.subType === 'flat_panel') {
    // visible paneling + light strips
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#73808d', { rough: 0.55, metal: 0.15 }));
    g.add(base);
    const insetMat = M('#91a0af', { rough: 0.5, metal: 0.2 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w*0.9, h*0.82, d*0.5), insetMat);
    g.add(panel);
    const lightMat = M('#eaf3ff', { rough: 0.2, emissive: 0xdde9ff, eInt: 2.5 });
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(w*0.84, 0.035, 0.02), lightMat); l1.position.set(0,  h*0.28, d*0.26);
    const l2 = l1.clone(); l2.position.y = -h*0.28;
    g.add(l1, l2);
    return g;
  }

  if (def.subType === 'flat_window') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6e7b88', { rough: 0.55, metal: 0.15 }));
    g.add(frame);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(w*0.66, h*0.52, d*0.2), M('#96a5b4', { rough: 0.45 }));
    g.add(opening);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.05, metalness: 0.0, opacity: 0.38, transparent: true, envMapIntensity: 0.6 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w*0.62, h*0.48), glassMat);
    glass.position.z = d*0.26;
    g.add(glass);
    return g;
  }

  if (def.subType === 'jersey') {
    // small cleanup + no z-fight
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.35, d), M('#9aa2ab', { rough: 0.9 }));
    base.position.y = -h*0.325;
    const mid  = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.45, d*0.9), M('#9aa2ab', { rough: 0.9 }));
    const top  = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.2, d*0.75), M('#9aa2ab', { rough: 0.9 }));
    top.position.y = h*0.35;
    g.add(base, mid, top);
    return g;
  }

  if (def.subType === 'column_round_flatcaps') {
    // Flat ends + rounded long edges: rounded box with small radius keeps faces flat
    const col = new THREE.Mesh(new RoundedBoxGeometry(w, h, w, 2, Math.min(0.18, w*0.35)), M('#aeb8c3', { rough: 0.5, metal: 0.45 }));
    g.add(col);
    return g;
  }

  if (def.subType === 'truss') {
    const frameMat = M('#9aa3ae', { rough: 0.5, metal: 0.4 });
    const cap = 0.1;
    const bars = [
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat),
    ];
    bars[0].position.y = -h/2; bars[1].position.y =  h/2;
    bars[2].position.x = -w/2; bars[3].position.x =  w/2;
    bars.forEach(b => g.add(b));
    const diagMat = M('#b7c2ce', { rough: 0.45, metal: 0.55 });
    const diag1 = new THREE.Mesh(new THREE.BoxGeometry(cap, Math.hypot(w, h), d*0.6), diagMat);
    diag1.rotation.z = Math.atan2(h, w);
    const diag2 = diag1.clone(); diag2.rotation.z *= -1.0;
    g.add(diag1, diag2);
    return g;
  }

  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Railings ---------- */
function buildRailing(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'guard') {
    const postMat = M('#b1bdca', { rough: 0.4, metal: 0.6 });
    const railMat = M('#ced7e2', { rough: 0.35, metal: 0.7 });
    const posts = 3;
    for (let i=0;i<posts;i++){
      const x = -w/2 + i*(w/(posts-1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,h,12), postMat);
      post.position.set(x, 0, 0); g.add(post);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,w-0.12,12), railMat);
    top.rotation.z = Math.PI/2; top.position.y = h/2 - 0.1; g.add(top);
    const mid = top.clone(); mid.position.y = h/3; g.add(mid);
    return g;
  }

  return g;
}

/* ---------- Pipes ---------- */
function buildPipe(def, M) {
  const g = new THREE.Group();
  const diam = def.size.x;

  const pipeMat = M('#8f9aa5', { rough: 0.35, metal: 0.8 });
  const flangeMat = M('#5c646d', { rough: 0.4, metal: 0.8 });
  const boltMat = M('#3f444a', { rough: 0.4, metal: 0.9 });

  if (def.subType === 'elbow_flanged') {
    // 90° elbow; fixed stray ring (none added)
    const rad = diam/2;
    const bendR = Math.max(1.2, rad * 3.0);
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(bendR, rad, 16, 32, Math.PI/2), pipeMat);
    elbow.rotation.z = Math.PI/2;
    g.add(elbow);
    const flangeR = rad*1.35, flangeT = 0.12;
    const fA = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, flangeT, 24), flangeMat);
    const fB = fA.clone();
    fA.position.set(-bendR, 0, 0);
    fB.position.set(0, 0, bendR);
    g.add(fA, fB);
    addBoltCircle(g, fA.position.clone(), flangeR*0.8, 8, boltMat);
    addBoltCircle(g, fB.position.clone(), flangeR*0.8, 8, boltMat);
    return g;
  }

  if (def.subType === 'full_flanged') {
    // straight section with flanged ends — “shoulders” like elbow ends
    const rad = diam/2;
    const len = 4; // matches tile length
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 20), pipeMat);
    body.rotation.x = Math.PI/2;
    g.add(body);
    const flangeR = rad*1.35, flangeT = 0.12;
    const f1 = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, flangeT, 24), flangeMat);
    const f2 = f1.clone();
    f1.position.z = -len/2; f2.position.z = len/2;
    g.add(f1, f2);
    addBoltCircle(g, f1.position.clone(), flangeR*0.8, 8, boltMat);
    addBoltCircle(g, f2.position.clone(), flangeR*0.8, 8, boltMat);
    return g;
  }

  return g;
}

/* ---------- Lights ---------- */
function buildLight(def, M) {
  const g = new THREE.Group();

  const makeHead = (down = true) => {
    // housing
    const head = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.5, 0.9, 3, 0.08), M('#64707a', { rough: 0.5, metal: 0.4 }));
    // emissive board (wide angle)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.45), M('#eaf3ff', { rough: 0.2, metal: 0.0, emissive: 0xdde9ff, eInt: 3.2 }));
    board.position.z = 0.46;
    head.add(board);
    // tilt
    head.rotation.x = down ? -Math.PI/4 : Math.PI/4;
    return head;
  };

  if (def.subType === 'flood_down' || def.subType === 'flood_up') {
    const down = def.subType === 'flood_down';
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, def.size.y, 16), M('#9aa6b2', { rough: 0.5, metal: 0.6 }));
    pole.position.y = 0;
    g.add(pole);
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.6), M('#7a858f', { rough: 0.5, metal: 0.4 }));
    yoke.position.y = def.size.y/2 - 0.25;
    g.add(yoke);
    const head = makeHead(down);
    head.position.set(0, def.size.y/2, 0);
    g.add(head);
    return g;
  }

  return g;
}

/* ---------- Helpers ---------- */
function addCornerBolts(group, w, d, y, mat) {
  const r = 0.05, h = y*0.6;
  const off = 0.35 * Math.min(w, d);
  const pos = [
    [-w/2+off, d/2-off], [w/2-off, d/2-off],
    [-w/2+off, -d/2+off], [w/2-off, -d/2+off],
  ];
  for (const [x,z] of pos) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
    bolt.position.set(x, y*0.35, z);
    group.add(bolt);
  }
}

function addBoltCircle(group, center, radius, count, mat) {
  for (let i=0; i<count; i++) {
    const a = (i / count) * Math.PI*2;
    const x = center.x + Math.cos(a) * radius;
    const z = center.z + Math.sin(a) * radius;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.12,10), mat);
    bolt.position.set(x, center.y, z);
    group.add(bolt);
  }
}