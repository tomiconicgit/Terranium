// src/assets/Catalog.js
// Realistic, fully procedural NASA-style pad kit: beams, trusses, stairs, rails,
// ribbed walls, concrete slabs, flanged pipes, light masts, blast deflector.
// No textures used — everything is geometry + standard materials.
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- Master Asset Catalog ---------- */
// Keep base sizes aligned to your 4u tile system.
// Walls/doors/beams snap using existing Builder rules (edges of floors).
export function makeCatalog() {
  const tile = { x: 4, y: 4, z: 4 };

  return [
    // --- Tools ---
    { id: "tool_pit_digger", name: "Pit Digger", category: "Tools", baseType: "tool", size: { x: 4, y: 4, z: 4 }, preview: "#ff6b6b" },

    // --- Concrete / Floors ---
    { id: "floor_concrete_01", name: "Concrete Slab", category: "Floors", baseType: "floor", subType: "concrete", size: { x: 4, y: 0.3, z: 4 }, preview: "#9aa2ab" },
    { id: "floor_grate_01",    name: "Industrial Grate", category: "Floors", baseType: "floor", subType: "grate_01", size: { x: 4, y: 0.25, z: 4 }, preview: "#66707a" },
    { id: "floor_plate_01",    name: "Steel Plate", category: "Floors", baseType: "floor", subType: "plate_01", size: { x: 4, y: 0.25, z: 4 }, preview: "#7f8a95" },

    // --- Walls / Barriers ---
    { id: "wall_ribbed_01",    name: "Ribbed Wall", category: "Walls", baseType: "wall", subType: "ribbed", size: {...tile}, preview: "#6c7681" },
    { id: "wall_concrete_jersey", name: "Concrete Barrier", category: "Walls", baseType: "wall", subType: "jersey", size: { x: 4, y: 2, z: 0.8 }, preview: "#9aa2ab" },

    // --- Beams & Trusses (snap like walls) ---
    { id: "beam_I_01",         name: "I-Beam", category: "Beams & Trusses", baseType: "wall", subType: "ibeam", size: { x: 0.6, y: 4, z: 0.6 }, preview: "#8d96a1" },
    { id: "truss_frame_01",    name: "Truss Frame", category: "Beams & Trusses", baseType: "wall", subType: "truss", size: { x: 4, y: 4, z: 0.5 }, preview: "#a7b3c0" },

    // --- Stairs / Access (use ramp placement along floor edge) ---
    { id: "stair_4u",          name: "Stair (4u rise)", category: "Stairs & Access", baseType: "ramp", subType: "stair", size: { x: 2, y: 4, z: 4 }, preview: "#8e99a4" },
    { id: "ladder_4u",         name: "Ladder (4u)", category: "Stairs & Access", baseType: "railing", subType: "ladder", size: { x: 0.4, y: 4, z: 0.3 }, preview: "#b1bdca" },
    { id: "handrail_4u",       name: "Handrail", category: "Stairs & Access", baseType: "railing", subType: "handrail", size: { x: 4, y: 1.1, z: 0.25 }, preview: "#b1bdca" },

    // --- Pipes (with flanges) ---
    { id: "pipe_straight_01",  name: "Pipe Straight", category: "Pipes", baseType: "pipe", subType: "straight_flanged", size: { x: 0.6, y: 0.6, z: 4 }, preview: "#8f9aa5" },
    { id: "pipe_elbow_01",     name: "Pipe Elbow", category: "Pipes", baseType: "pipe", subType: "elbow_flanged", size: { x: 0.6, y: 0.6, z: 2 }, preview: "#8f9aa5" },
    { id: "cable_tray_01",     name: "Cable Tray", category: "Pipes", baseType: "pipe", subType: "tray", size: { x: 4, y: 0.25, z: 0.6 }, preview: "#aab4bf" },

    // --- Lights / Masts ---
    { id: "light_mast_01",     name: "Light Mast", category: "Lights", baseType: "light", subType: "mast", size: { x: 0.6, y: 6, z: 0.6 }, preview: "#e8f0ff" },

    // --- Blast ---
    { id: "blast_deflector_01", name: "Blast Deflector", category: "Misc", baseType: "ramp", subType: "blast_deflector", size: { x: 4, y: 2.5, z: 6 }, preview: "#6b747e" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const createStd = (hex, { rough=0.7, metal=0.0 } = {}) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex || options.primaryColor || '#9EAAB9'),
    roughness: ('roughness' in options) ? options.roughness : rough,
    metalness: ('metalness' in options) ? options.metalness : metal,
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  let partObject;
  switch (def.baseType) {
    case 'floor':   partObject = buildFloor(def, createStd); break;
    case 'wall':    partObject = buildWallLike(def, createStd); break;
    case 'ramp':    partObject = buildRampLike(def, createStd); break;
    case 'railing': partObject = buildRailingLike(def, createStd); break;
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

// Floors
function buildFloor(def, M) {
  const g = new THREE.Group();
  if (def.subType === 'concrete') {
    // beveled slab + saw-cut joints (procedural grooves)
    const slab = new THREE.Mesh(new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 2, 0.06), M('#9aa2ab', { rough: 0.85 }));
    g.add(slab);

    // grooves (very thin boxes)
    const grooveMat = M('#2a2e33', { rough: 1.0 });
    const w = def.size.x, d = def.size.z, h = def.size.y;
    const grooveW = 0.05;
    const gy = h * 0.51;
    const gx = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, grooveW), grooveMat);
    gx.position.y = gy;
    const gz = new THREE.Mesh(new THREE.BoxGeometry(grooveW, 0.02, d), grooveMat);
    gz.position.y = gy;
    g.add(gx, gz);
    return g;
  }

  if (def.subType === 'grate_01') {
    // perimeter frame + parallel bars
    const frame = new THREE.Mesh(new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 2, 0.05), M('#6d7781', { rough: 0.5, metal: 0.4 }));
    g.add(frame);
    const barMat = M('#8a949f', { rough: 0.4, metal: 0.6 });
    const count = Math.floor(def.size.x / 0.25);
    for (let i = 0; i < count; i++) {
      const x = -def.size.x/2 + (i+0.5) * (def.size.x / count);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, def.size.y*0.6, def.size.z*0.9), barMat);
      bar.position.set(x, def.size.y*0.2, 0);
      g.add(bar);
    }
    return g;
  }

  if (def.subType === 'plate_01') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    // bolt corners
    addCornerBolts(g, def.size.x, def.size.z, def.size.y, M('#5a626b', { rough: 0.4, metal: 0.7 }));
    return g;
  }

  // fallback
  return new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z), M());
}

// Walls / Beams / Trusses (snap on floor edges)
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const w = def.size.x, h = def.size.y, d = def.size.z;

  if (def.subType === 'ribbed') {
    // outer frame + vertical ribs + top/bottom caps
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.08, d*0.2)), M('#6b7480', { rough: 0.55, metal: 0.2 }));
    g.add(frame);
    const ribMat = M('#8a95a0', { rough: 0.5, metal: 0.25 });
    const ribs = Math.max(3, Math.floor(w / 0.5));
    for (let i = 0; i < ribs; i++) {
      const x = -w/2 + (i+0.5) * (w / ribs);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, h*0.9, d*1.02), ribMat);
      rib.position.set(x, 0, 0);
      g.add(rib);
    }
    return g;
  }

  if (def.subType === 'jersey') {
    // simple jersey barrier profile using boxes
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.35, d), M('#9aa2ab', { rough: 0.9 }));
    base.position.y = -h*0.325;
    const mid = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.45, d*0.9), M('#9aa2ab', { rough: 0.9 }));
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.2, d*0.75), M('#9aa2ab', { rough: 0.9 }));
    top.position.y = h*0.35;
    g.add(base, mid, top);
    chamferSides(g, w, h, d);
    return g;
  }

  if (def.subType === 'ibeam') {
    // proper I-Beam via extruded shape
    const flangeT = Math.max(0.08, d*0.18);
    const webT = Math.max(0.06, d*0.12);
    const shape = new THREE.Shape();
    shape.moveTo(-w/2, -h/2);
    shape.lineTo(w/2, -h/2);
    shape.lineTo(w/2, -h/2 + flangeT);
    shape.lineTo(webT/2, -h/2 + flangeT);
    shape.lineTo(webT/2, h/2 - flangeT);
    shape.lineTo(w/2, h/2 - flangeT);
    shape.lineTo(w/2, h/2);
    shape.lineTo(-w/2, h/2);
    shape.lineTo(-w/2, h/2 - flangeT);
    shape.lineTo(-webT/2, h/2 - flangeT);
    shape.lineTo(-webT/2, -h/2 + flangeT);
    shape.lineTo(-w/2, -h/2 + flangeT);
    shape.lineTo(-w/2, -h/2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.center();
    const ibeam = new THREE.Mesh(geo, M('#aeb8c3', { rough: 0.45, metal: 0.65 }));
    g.add(ibeam);
    addEndPlates(g, w, h, d, M('#6b747e', { rough: 0.6, metal: 0.3 }));
    addBoltRing(g, d, M('#525861', { rough: 0.4, metal: 0.8 }));
    return g;
  }

  if (def.subType === 'truss') {
    // rectangular frame with diagonal bracing
    const mat = M('#a7b3c0', { rough: 0.5, metal: 0.5 });
    const tube = (lx, ly, lz, px, py, pz, rx=0, ry=0, rz=0, r=0.06) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
      m.scale.set(lx, Math.sqrt(lx*lx + ly*ly + lz*lz), lz); // we’ll just stretch later via matrix
      m.position.set(px, py, pz);
      m.rotation.set(rx, ry, rz);
      return m;
    };

    // Outer frame (four tubes modeled as boxes for simplicity & precision)
    const frameMat = M('#9aa3ae', { rough: 0.5, metal: 0.4 });
    const cap = 0.1;
    const bars = [
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat), // bottom
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat), // top
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat), // left
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat), // right
    ];
    bars[0].position.y = -h/2; bars[1].position.y =  h/2;
    bars[2].position.x = -w/2; bars[3].position.x =  w/2;
    bars.forEach(b => g.add(b));

    // Diagonals (flat bars)
    const diagMat = M('#b7c2ce', { rough: 0.45, metal: 0.55 });
    const diag1 = new THREE.Mesh(new THREE.BoxGeometry(cap, Math.hypot(w, h), d*0.6), diagMat);
    diag1.rotation.z = Math.atan2(h, w);
    const diag2 = diag1.clone(); diag2.rotation.z *= -1.0;
    g.add(diag1, diag2);
    return g;
  }

  // fallback
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

// Ramps / Blast / Stairs
function buildRampLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'stair') {
    const treads = 6;
    const treadH = h / treads;
    const treadD = d / treads;
    const stepMat = M('#8e99a4', { rough: 0.45, metal: 0.15 });
    for (let i = 0; i < treads; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, treadH*0.95, treadD*0.98), stepMat);
      step.position.set(0, -h/2 + (i+0.5)*treadH, -d/2 + (i+0.5)*treadD);
      g.add(step);
    }
    // side stringers
    const sMat = M('#6f7984', { rough: 0.55, metal: 0.2 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), sMat);
    const s2 = s1.clone();
    s1.position.x = -w/2 + 0.05; s2.position.x = w/2 - 0.05;
    g.add(s1, s2);
    return g;
  }

  if (def.subType === 'blast_deflector') {
    // triangular prism deflector
    const geo = new THREE.BufferGeometry();
    const hw = w/2, hh = h, hd = d/2;
    const verts = new Float32Array([
      // base rectangle (lying flat)
      -hw, 0, -hd,  hw, 0, -hd,  hw, 0,  hd,
      -hw, 0, -hd,  hw, 0,  hd, -hw, 0,  hd,
      // back wall (upright)
      -hw, 0, -hd,  hw, 0, -hd,  0,  hh, -hd,
      // sloped face
       hw, 0, -hd,  hw, 0,  hd,  0,  hh, -hd,
      -hw, 0,  hd, -hw, 0, -hd,  0,  hh, -hd,
      // small top cap
       0,  hh, -hd,  hw, 0,  hd, -hw, 0,  hd
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const defMat = M('#6b747e', { rough: 0.7, metal: 0.15 });
    const prism = new THREE.Mesh(geo, defMat);
    g.add(prism);
    return g;
  }

  // fallback ramp: tilt a box
  const box = new THREE.BoxGeometry(w, h, d);
  const p = box.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0 && p.getY(i) > 0) p.setY(i, -h/2); // simple wedge
  }
  box.computeVertexNormals();
  return new THREE.Mesh(box, M('#7a848f', { rough: 0.6, metal: 0.1 }));
}

// Railings / Ladder / Handrail
function buildRailingLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'handrail') {
    const postMat = M('#b1bdca', { rough: 0.4, metal: 0.6 });
    const railMat = M('#ced7e2', { rough: 0.35, metal: 0.7 });
    const posts = 3;
    for (let i=0; i<posts; i++) {
      const x = -w/2 + i*(w/(posts-1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 12), postMat);
      post.position.set(x, 0, 0);
      g.add(post);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, w-0.12, 12), railMat);
    top.rotation.z = Math.PI/2;
    top.position.y = h/2 - 0.1;
    g.add(top);

    const mid = top.clone();
    mid.position.y = h/3;
    g.add(mid);
    return g;
  }

  if (def.subType === 'ladder') {
    const sideMat = M('#b1bdca', { rough: 0.5, metal: 0.5 });
    const rungMat = M('#d0d9e5', { rough: 0.4, metal: 0.6 });
    const sideL = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,h,12), sideMat);
    const sideR = sideL.clone();
    sideL.position.x = -w/2 + 0.06; sideR.position.x = w/2 - 0.06;
    g.add(sideL, sideR);
    const rungs = Math.max(5, Math.floor(h / 0.35));
    for (let i=0; i<rungs; i++) {
      const y = -h/2 + 0.25 + (i * (h-0.5) / (rungs-1));
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,w-0.18,10), rungMat);
      rung.rotation.z = Math.PI/2;
      rung.position.y = y;
      g.add(rung);
    }
    return g;
  }

  // fallback simple guard
  const postGeo = new RoundedBoxGeometry(d*1.5, h, d*1.5, 3, d*0.6);
  const postMat = M('#9aa6b2', { rough: 0.5, metal: 0.4 });
  const p1 = new THREE.Mesh(postGeo, postMat); p1.position.x = -w/2 + d*0.75;
  const p2 = new THREE.Mesh(postGeo, postMat); p2.position.x =  w/2 - d*0.75;
  const rail = new THREE.Mesh(new RoundedBoxGeometry(w, d*1.2, d*1.2, 3, d*0.5), postMat);
  rail.position.y = h/2 - d*0.6;
  g.add(p1, p2, rail);
  return g;
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

    // flanges
    const flangeR = rad * 1.35, flangeT = 0.12;
    const f1 = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, flangeT, 24), flangeMat);
    const f2 = f1.clone();
    f1.position.z = -len/2; f2.position.z = len/2;
    g.add(f1, f2);

    // bolt ring
    addBoltCircle(g, f1.position.clone(), flangeR*0.8, 8, boltMat);
    addBoltCircle(g, f2.position.clone(), flangeR*0.8, 8, boltMat);
    return g;
  }

  if (def.subType === 'elbow_flanged') {
    // 90° elbow via torus section
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
    // U-channel cable tray with perforations
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#aab4bf', { rough: 0.55, metal: 0.3 }));
    g.add(tray);
    // side lips
    const lipMat = M('#b8c2cd', { rough: 0.5, metal: 0.4 });
    const lipH = h*2.5;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(w, lipH, 0.05), lipMat);
    const l2 = l1.clone();
    l1.position.z =  d/2 - 0.03; l2.position.z = -d/2 + 0.03;
    l1.position.y = lipH/2 - h/2; l2.position.y = lipH/2 - h/2;
    g.add(l1,l2);
    // perforations (slots)
    const slotMat = M('#8f9aa5', { rough: 0.6, metal: 0.2 });
    const slots = Math.floor(w / 0.6);
    for (let i=0;i<slots;i++){
      const x = -w/2 + (i+0.5)*(w/slots);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, h*0.4, d*0.6), slotMat);
      slot.position.set(x, 0, 0);
      g.add(slot);
    }
    return g;
  }

  // fallback
  return new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,def.size.z,16), pipeMat);
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

    // emissive panels
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xeef6ff,
      emissive: new THREE.Color(0xdde9ff),
      emissiveIntensity: 3.0,
      roughness: 0.2,
      metalness: 0.0
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), lightMat);
    panel.position.set(0, def.size.y/2, 0.26);
    g.add(panel);
    const panelBack = panel.clone(); panelBack.rotation.y = Math.PI; panelBack.position.z = -0.26; g.add(panelBack);
    return g;
  }
  return new THREE.Group();
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

function addEndPlates(group, w, h, d, mat) {
  const plateT = 0.12;
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, h*0.8, plateT), mat);
  const p2 = p1.clone();
  p1.position.z = -d/2 - plateT/2; p2.position.z = d/2 + plateT/2;
  group.add(p1, p2);
}

function addBoltRing(group, d, mat) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(d*0.42, 0.04, 8, 16), mat);
  ring.rotation.x = Math.PI/2;
  group.add(ring);
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

function chamferSides(group, w, h, d) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8f98a1, roughness: 0.9 });
  const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d*1.02), mat);
  c.position.y = -h/2 + 0.02;
  group.add(c);
}