// NASA pad kit — round 4 (edge snap, stadium lights, elbow/full pipes, slab bevels, wall set)
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeCatalog() {
  const tile = 4;

  return [
    // Tools
    { id:"tool_pit_digger", name:"Pit Digger", category:"Tools", baseType:"tool", size:{x:tile,y:tile,z:tile}, preview:"#ff6b6b" },

    // Floors
    { id:"floor_concrete_01", name:"Concrete Slab", category:"Floors", baseType:"floor", subType:"concrete_slab", size:{x:tile, y:0.3, z:tile}, preview:"#9aa2ab" },
    { id:"floor_plate_01",    name:"Steel Plate",   category:"Floors", baseType:"floor", subType:"plate_01",      size:{x:tile, y:0.25, z:tile}, preview:"#7f8a95" },

    // Walls (only the 3 you want)
    { id:"wall_flat_smooth",  name:"Wall • Smooth (4h)", category:"Walls", baseType:"wall", subType:"flat_smooth", size:{x:tile,y:4,z:0.35}, preview:"#6c7681" },
    { id:"wall_glass_half",   name:"Wall • Glass (2h)",  category:"Walls", baseType:"wall", subType:"glass_half",  size:{x:tile,y:2,z:0.35}, preview:"#8fb4d6" },
    { id:"wall_smooth_top2",  name:"Wall • Smooth Top (2h)", category:"Walls", baseType:"wall", subType:"smooth_top2", size:{x:tile,y:2,z:0.35}, preview:"#6c7681" },

    // Columns / Truss / Railings
    { id:"column_round_01", name:"Column (1×4)", category:"Beams & Columns", baseType:"wall", subType:"column_round_flatcaps", size:{x:1,y:4,z:1}, preview:"#a7b3c0" },
    { id:"truss_frame_01",  name:"Truss Frame",  category:"Beams & Columns", baseType:"wall", subType:"truss", size:{x:tile,y:4,z:0.5}, preview:"#a7b3c0" },
    { id:"railing_guard_01", name:"Guard Railing", category:"Ramps & Railings", baseType:"railing", subType:"guard", size:{x:tile,y:1.1,z:0.22}, preview:"#b1bdca" },

    // Pipes (no loose covers; full snaps to elbow)
    { id:"pipe_elbow_01", name:"Pipe • Elbow", category:"Pipes", baseType:"pipe", subType:"elbow", size:{x:0.6,y:0.6,z:2}, preview:"#8f9aa5" },
    { id:"pipe_full_01",  name:"Pipe • Full",  category:"Pipes", baseType:"pipe", subType:"full",  size:{x:0.6,y:0.6,z:4}, preview:"#8f9aa5" },

    // Lights — stadium cluster
    { id:"light_stadium_down", name:"Stadium Flood (Down)", category:"Lights", baseType:"light", subType:"stadium_down", size:{x:1.6, y:6.5, z:1.6}, preview:"#e8f0ff" },
    { id:"light_stadium_up",   name:"Stadium Flood (Up)",   category:"Lights", baseType:"light", subType:"stadium_up",   size:{x:1.6, y:6.5, z:1.6}, preview:"#e8f0ff" },
  ];
}

/* ---------- Builder entry ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const mat = (hex, { rough=0.7, metal=0.0, emissive=0x000000, e=0 } = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex || options.primaryColor || '#9EAAB9'),
      roughness: ('roughness' in options) ? options.roughness : rough,
      metalness: ('metalness' in options) ? options.metalness : metal,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: e,
      envMap: dynamicEnvMap,
      side: THREE.DoubleSide
    });

  let obj;
  switch (def.baseType) {
    case 'floor':   obj = buildFloor(def, mat); break;
    case 'wall':    obj = buildWallLike(def, mat); break;
    case 'railing': obj = buildRailing(def, mat); break;
    case 'pipe':    obj = buildPipe(def, mat); break;
    case 'light':   obj = buildLight(def, mat); break;
    default:        obj = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z), mat());
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
    // subtle perimeter bevel so adjacent tiles read as separate slabs
    const slab = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.08), M('#9aa2ab', { rough: 0.9 }));
    g.add(slab);
    return g;
  }

  if (def.subType === 'plate_01') {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), M('#7e8994', { rough: 0.6, metal: 0.2 }));
    g.add(plate);
    addCornerBolts(g, w, d, h, M('#5a626b', { rough: 0.45, metal: 0.7 }));
    return g;
  }

  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Walls / Columns / Truss ---------- */
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'flat_smooth' || def.subType === 'smooth_top2') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6b7480', { rough: 0.6, metal: 0.1 })));
    return g;
  }

  if (def.subType === 'glass_half') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6e7b88', { rough: 0.55, metal: 0.15 }));
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w*0.92, h*0.75), new THREE.MeshStandardMaterial({
      color: 0xdfefff, roughness: 0.05, metalness: 0.0, opacity: 0.35, transparent: true, envMapIntensity: 0.6
    }));
    glass.position.z = d*0.26;
    g.add(glass);
    return g;
  }

  if (def.subType === 'column_round_flatcaps') {
    // flat ends, rounded long sides: box core + 4 half-cylinders
    const r = Math.min(0.18, def.size.x*0.35);
    const core = new THREE.Mesh(new THREE.BoxGeometry(def.size.x - 2*r, h, def.size.z - 2*r), M('#aeb8c3', { rough: 0.5, metal: 0.45 }));
    g.add(core);
    const side = new THREE.CylinderGeometry(r, r, h, 18, 1, true);
    const m = M('#aeb8c3', { rough: 0.5, metal: 0.45 });
    const c1 = new THREE.Mesh(side, m); c1.rotation.z = Math.PI/2; c1.position.set( (def.size.x/2 - r), 0, 0);
    const c2 = c1.clone(); c2.position.x = -c1.position.x;
    const c3 = new THREE.Mesh(side, m); c3.rotation.x = Math.PI/2; c3.position.set(0, 0, (def.size.z/2 - r));
    const c4 = c3.clone(); c4.position.z = -c3.position.z;
    g.add(c1,c2,c3,c4);
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
  const { x:w, y:h } = def.size;
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
  }
  return g;
}

/* ---------- Pipes (no loose covers; elbow exposes endpoints for snapping) ---------- */
function buildPipe(def, M) {
  const g = new THREE.Group();
  const diam = def.size.x;
  const pipeMat = M('#8f9aa5', { rough: 0.35, metal: 0.8 });

  if (def.subType === 'elbow') {
    const rad = diam/2;
    const bendR = Math.max(1.2, rad * 3.0);
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(bendR, rad, 16, 32, Math.PI/2), pipeMat);
    elbow.rotation.z = Math.PI/2;
    g.add(elbow);
    // Endpoints for snapping
    const a = new THREE.Object3D(); a.name = 'endpointA'; a.position.set(-bendR, 0, 0);
    const b = new THREE.Object3D(); b.name = 'endpointB'; b.position.set(0, 0, bendR);
    g.add(a,b);
    return g;
  }

  if (def.subType === 'full') {
    const rad = diam/2, len = 4;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 20), pipeMat);
    body.rotation.x = Math.PI/2;
    g.add(body);
    // endpoints for future chaining
    const a = new THREE.Object3D(); a.name = 'endpointA'; a.position.set(0, 0, -len/2);
    const b = new THREE.Object3D(); b.name = 'endpointB'; b.position.set(0, 0,  len/2);
    g.add(a,b);
    return g;
  }

  return g;
}

/* ---------- Lights (stadium style) ---------- */
function buildLight(def, M) {
  const g = new THREE.Group();
  const up = (def.subType === 'stadium_up');

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, def.size.y, 18), M('#9aa6b2', { rough: 0.5, metal: 0.6 }));
  g.add(pole);

  // head: circular plate with ring of spot pods
  const headY = def.size.y/2;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.08,24), M('#65727d',{rough:0.5,metal:0.4}));
  plate.position.y = headY;
  g.add(plate);

  const podMat = M('#eaf3ff',{rough:0.2,metal:0.0,emissive:0xdde9ff,e:3.4});
  const pods = 12, r = 0.75;
  for (let i=0;i<pods;i++){
    const a = (i/pods)*Math.PI*2;
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    const pod = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.22,14), podMat);
    pod.position.set(x, headY+0.12, z);
    pod.lookAt(new THREE.Vector3(0, up ? headY+5 : 0, 0)); // up or down focus
    g.add(pod);
  }

  return g;
}

/* ---------- helpers ---------- */
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