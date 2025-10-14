// src/assets/Catalog.js — realistic procedural pad kit (texture-free)
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- Catalog ---------- */
export function makeCatalog() {
  const tile = { x: 4, y: 4, z: 4 };

  return [
    // --- Tools ---
    { id: "tool_pit_digger", name: "Pit Digger", category: "Tools", baseType: "tool", size: { x: 4, y: 4, z: 4 }, preview: "#ff6b6b" },

    // --- Floors (kept plate, removed grate; added decals & holes) ---
    { id: "floor_plate_01",      name: "Steel Plate",   category: "Floors", baseType: "floor", subType: "plate_01",      size: { x:4, y:0.25, z:4 }, preview: "#7f8a95" },
    { id: "floor_plate_stripe",  name: "Plate • Stripe",category: "Floors", baseType: "floor", subType: "plate_stripe",  size: { x:4, y:0.25, z:4 }, preview: "#a6b1bc" },
    { id: "floor_pad_mark",      name: "Pad Mark",      category: "Floors", baseType: "floor", subType: "pad_mark",      size: { x:4, y:0.25, z:4 }, preview: "#98a3ae" },
    { id: "floor_hole_concrete", name: "Concrete Hole", category: "Floors", baseType: "floor", subType: "hole_concrete", size: { x:4, y:0.25, z:4 }, preview: "#8f98a1" },
    { id: "floor_hole_metal",    name: "Metal Hole",    category: "Floors", baseType: "floor", subType: "hole_metal",    size: { x:4, y:0.25, z:4 }, preview: "#8f98a1" },

    // --- Walls / Barriers ---
    { id: "wall_flat_smooth",   name: "Wall • Smooth",  category: "Walls", baseType: "wall", subType: "flat_smooth", size: { ...tile, z: 0.35 }, preview: "#6c7681" },
    { id: "wall_flat_panel",    name: "Wall • Sci-Panel",category: "Walls", baseType: "wall", subType: "flat_panel",  size: { ...tile, z: 0.4 },  preview: "#7b8591" },
    { id: "wall_flat_window",   name: "Wall • Window",  category: "Walls", baseType: "wall", subType: "flat_window", size: { ...tile, z: 0.45 }, preview: "#8a95a0" },
    { id: "wall_concrete_jersey", name: "Concrete Barrier", category: "Walls", baseType: "wall", subType: "jersey", size: { x:4, y:2, z:0.8 }, preview: "#9aa2ab" },

    // --- Column (replaces I-beam) ---
    { id: "column_round_01",    name: "Column (1×4)",   category: "Beams & Columns", baseType: "wall", subType: "column_round", size: { x:1, y:4, z:1 }, preview: "#a7b3c0" },

    // --- Truss (unchanged) ---
    { id: "truss_frame_01",     name: "Truss Frame",    category: "Beams & Columns", baseType: "wall", subType: "truss", size: { x:4, y:4, z:0.5 }, preview: "#a7b3c0" },

    // --- Tunnel (walkable 4×4) ---
    { id: "tunnel_4x4",         name: "Tunnel 4×4",     category: "Modules", baseType: "wall", subType: "tunnel_4x4", size: { x:4, y:4, z:4 }, preview: "#9eb1c4" },

    // --- Pipes (now snap & preview) ---
    { id: "pipe_straight_01",   name: "Pipe Straight",  category: "Pipes", baseType: "pipe", subType: "straight_flanged", size: { x:0.6, y:0.6, z:4 }, preview: "#8f9aa5" },
    { id: "pipe_elbow_01",      name: "Pipe Elbow",     category: "Pipes", baseType: "pipe", subType: "elbow_flanged",    size: { x:0.6, y:0.6, z:2 }, preview: "#8f9aa5" },
    { id: "cable_tray_01",      name: "Cable Tray",     category: "Pipes", baseType: "pipe", subType: "tray",             size: { x:4, y:0.25, z:0.6 }, preview: "#aab4bf" },

    // --- Lights (fixed placement) ---
    { id: "light_mast_01",      name: "Light Mast",     category: "Lights", baseType: "light", subType: "mast", size: { x:0.6, y:6, z:0.6 }, preview: "#e8f0ff" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const createStd = (hex, { rough=0.7, metal=0.0, emissive=0x000000, eInt=0 } = {}) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex || options.primaryColor || '#9EAAB9'),
    roughness: ('roughness' in options) ? options.roughness : rough,
    metalness: ('metalness' in options) ? options.metalness : metal,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: eInt,
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  let partObject;
  switch (def.baseType) {
    case 'floor':   partObject = buildFloor(def, createStd); break;
    case 'wall':    partObject = buildWallLike(def, createStd); break;
    case 'ramp':    partObject = new THREE.Group(); break; // stairs removed
    case 'railing': partObject = new THREE.Group(); break;
    case 'pipe':    partObject = buildPipeLike(def, createStd); break;
    case 'light':   partObject = buildLightLike(def, createStd); break;
    default:
      partObject = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z), createStd('#9EAAB9'));
  }

  partObject.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
  partObject.userData.part = def;
  return partObject;
}

/* ---------- Builders ---------- */

// Floors (plate, stripe, pad mark, holes)
function buildFloor(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'plate_01') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    addCornerBolts(g, w, d, h, M('#5a626b', { rough: 0.4, metal: 0.7 }));
    return g;
  }

  if (def.subType === 'plate_stripe') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    // diagonal paint stripe overlay
    const paint = new THREE.Mesh(new THREE.BoxGeometry(w*0.12, 0.02, d*1.1), M(0xffd24d, { rough: 0.4, metal: 0.0 }));
    paint.rotation.y = Math.PI/8;
    paint.position.y = h*0.52;
    g.add(paint);
    return g;
  }

  if (def.subType === 'pad_mark') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    // “H” style pad mark (centered lines)
    const lineMat = M(0xffffff, { rough: 0.3 });
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(w*0.08, 0.02, d*0.9), lineMat);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(w*0.9, 0.02, d*0.08), lineMat);
    l1.position.y = l2.position.y = h*0.52;
    g.add(l1, l2);
    return g;
  }

  if (def.subType === 'hole_concrete' || def.subType === 'hole_metal') {
    // Thin ring/lip + inner darker ring; Builder will call scene.digPit
    const lipColor = def.subType === 'hole_concrete' ? '#9aa2ab' : '#8a949f';
    const innerColor = def.subType === 'hole_concrete' ? '#6d747b' : '#5b626a';
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(w*0.42, w*0.42, h, 24), M(lipColor, { rough: 0.85 }));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(w*0.32, w*0.32, h*0.8, 24), M(innerColor, { rough: 0.7, metal: def.subType === 'hole_metal' ? 0.4 : 0.0 }));
    outer.rotation.x = Math.PI/2; inner.rotation.x = Math.PI/2;
    g.add(outer, inner);
    g.userData.isHole = true;
    g.userData.holeDepth = def.subType === 'hole_metal' ? 2.5 : 2.0;
    return g;
  }

  // fallback
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

// Walls / Barrier / Column / Truss / Tunnel
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'flat_smooth') {
    const wall = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.08, d*0.3)), M('#6b7480', { rough: 0.6, metal: 0.1 }));
    g.add(wall);
    return g;
  }

  if (def.subType === 'flat_panel') {
    const wall = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.08, d*0.25)), M('#73808d', { rough: 0.55, metal: 0.15 }));
    g.add(wall);
    // inset sci-fi panels
    const insetMat = M('#91a0af', { rough: 0.5, metal: 0.2 });
    const inset = new THREE.Mesh(new THREE.BoxGeometry(w*0.86, h*0.82, d*0.6), insetMat);
    g.add(inset);
    // slim light strips
    const lightMat = M('#eaf3ff', { rough: 0.2, metal: 0.0, emissive: 0xdde9ff, eInt: 2.5 });
    const ls1 = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 0.03, 0.02), lightMat);
    const ls2 = ls1.clone();
    ls1.position.y = h*0.3; ls2.position.y = -h*0.3;
    ls1.position.z = d*0.31; ls2.position.z = d*0.31;
    g.add(ls1, ls2);
    return g;
  }

  if (def.subType === 'flat_window') {
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.08, d*0.25)), M('#6e7b88', { rough: 0.55, metal: 0.15 }));
    g.add(frame);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(w*0.65, h*0.5, d*0.2), M('#98a6b5', { rough: 0.4, metal: 0.1 }));
    g.add(opening);
    // glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w*0.62, h*0.46), new THREE.MeshStandardMaterial({
      color: 0xdfefff, roughness: 0.05, metalness: 0.0, opacity: 0.5, transparent: true, envMapIntensity: 0.6
    }));
    glass.position.z = d*0.26;
    g.add(glass);
    return g;
  }

  if (def.subType === 'jersey') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.35, d), M('#9aa2ab', { rough: 0.9 }));
    base.position.y = -h*0.325;
    const mid  = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.45, d*0.9), M('#9aa2ab', { rough: 0.9 }));
    const top  = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.2, d*0.75), M('#9aa2ab', { rough: 0.9 }));
    top.position.y = h*0.35;
    g.add(base, mid, top);
    return g;
  }

  if (def.subType === 'column_round') {
    const r = Math.min(w, d) * 0.35;
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(r, h - 2*r, 8, 16), M('#aeb8c3', { rough: 0.5, metal: 0.45 }));
    g.add(core);
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

  if (def.subType === 'tunnel_4x4') {
    // Outer shell
    const shell = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.15), M('#73808d', { rough: 0.5, metal: 0.2 }));
    g.add(shell);
    // Inner cavity (four inner panels forming a corridor)
    const t = 0.08; // panel thickness
    const iw = w*0.8, ih = h*0.8;
    const innerMat = M('#8b98a6', { rough: 0.45, metal: 0.2 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(iw, t, d*0.9), innerMat); ceil.position.y = ih/2 - t/2;
    const floor= new THREE.Mesh(new THREE.BoxGeometry(iw, t, d*0.9), innerMat); floor.position.y = -ih/2 + t/2;
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, ih, d*0.9), innerMat); left.position.x = -iw/2 + t/2;
    const right= new THREE.Mesh(new THREE.BoxGeometry(t, ih, d*0.9), innerMat); right.position.x =  iw/2 - t/2;
    g.add(ceil, floor, left, right);
    // Windows (both sides)
    const winMat = new THREE.MeshStandardMaterial({ color: 0xeef6ff, roughness: 0.05, metalness: 0.0, opacity: 0.35, transparent: true });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(d*0.7, h*0.35), winMat);
    win.rotation.y = Math.PI/2;
    win.position.set(iw/2 - t, 0, 0);
    const win2 = win.clone(); win2.position.x = -iw/2 + t; win2.rotation.y = -Math.PI/2;
    g.add(win, win2);
    // Light strips inside
    const stripMat = M('#eaf3ff', { rough: 0.2, emissive: 0xdde9ff, eInt: 3.0 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(iw*0.8, 0.03, 0.02), stripMat); s1.position.set(0, ih/2 - 0.12, d*0.35);
    const s2 = s1.clone(); s2.position.z = -d*0.35;
    g.add(s1, s2);
    // Cable bundle along ceiling
    const cableMat = M('#41464d', { rough: 0.6, metal: 0.1 });
    for (let i=0;i<3;i++){
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03 + i*0.008, 0.03 + i*0.008, d*0.85, 10), cableMat);
      c.rotation.z = Math.PI/2;
      c.position.set(-iw*0.25 + i*0.25, ih/2 - 0.2, 0);
      g.add(c);
    }
    return g;
  }

  // fallback
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

// Pipes / Cable trays
function buildPipeLike(def, M) {
  const g = new THREE.Group();
  const { x:diam, z:len } = def.size;

  const pipeMat = M('#8f9aa5', { rough: 0.35, metal: 0.8 });
  const flangeMat = M('#5c646d', { rough: 0.4, metal: 0.8 });
  const boltMat = M('#3f444a', { rough: 0.4, metal: 0.9 });

  if (def.subType === 'straight_flanged') {
    const rad = diam/2;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 20), pipeMat);
    cyl.rotation.x = Math.PI/2;
    g.add(cyl);

    const flangeR = rad * 1.35, flangeT = 0.12;
    const f1 = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, flangeT, 24), flangeMat);
    const f2 = f1.clone();
    f1.position.z = -len/2; f2.position.z =  len/2;
    g.add(f1, f2);

    addBoltCircle(g, f1.position.clone(), flangeR*0.8, 8, boltMat);
    addBoltCircle(g, f2.position.clone(), flangeR*0.8, 8, boltMat);
    return g;
  }

  if (def.subType === 'elbow_flanged') {
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

  if (def.subType === 'tray') {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#aab4bf', { rough: 0.55, metal: 0.3 }));
    g.add(tray);
    const lipMat = M('#b8c2cd', { rough: 0.5, metal: 0.4 });
    const lipH = h*2.5;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(w, lipH, 0.05), lipMat);
    const l2 = l1.clone();
    l1.position.z =  d/2 - 0.03; l2.position.z = -d/2 + 0.03;
    l1.position.y = lipH/2 - h/2; l2.position.y = lipH/2 - h/2;
    g.add(l1,l2);
    return g;
  }

  return g;
}

// Lights / Masts
function buildLightLike(def, M) {
  const g = new THREE.Group();
  if (def.subType === 'mast') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, def.size.y, 16), M('#9aa6b2', { rough: 0.5, metal: 0.6 }));
    g.add(post);
    const head = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.4, 0.4, 2, 0.08), M('#64707a', { rough: 0.5, metal: 0.4 }));
    head.position.y = def.size.y/2;
    g.add(head);

    const lightMat = M('#eaf3ff', { rough: 0.2, metal: 0.0, emissive: 0xdde9ff, eInt: 3.0 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), lightMat);
    panel.position.set(0, def.size.y/2, 0.26);
    g.add(panel);
    const panelBack = panel.clone(); panelBack.rotation.y = Math.PI; panelBack.position.z = -0.26; g.add(panelBack);
    return g;
  }
  return g;
}

/* ---------- Small detail helpers ---------- */

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