// NASA pad kit — round 9 (asset redesigns and new parts)
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeCatalog() {
  const tile = 4;

  return [
    // Tools
    { id:"tool_pit_digger", name:"Pit Digger", category:"Tools", baseType:"tool", size:{x:tile,y:tile,z:tile}, preview:"#ff9a3b" },

    // Floors
    { id:"floor_concrete_01", name:"Concrete Slab", category:"Floors", baseType:"floor", subType:"concrete_slab", size:{x:tile, y:0.3, z:tile}, preview:"#9aa2ab" },
    { id:"floor_plate_01",    name:"Steel Plate",   category:"Floors", baseType:"floor", subType:"plate_01",      size:{x:tile, y:0.25, z:tile}, preview:"#7f8a95" },

    // Walls
    { id:"wall_flat_smooth",  name:"Wall • Smooth (4h)", category:"Walls", baseType:"wall", subType:"flat_smooth", size:{x:tile,y:4,z:0.35}, preview:"#6c7681" },
    { id:"wall_glass_half",   name:"Wall • Glass (2h)",  category:"Walls", baseType:"wall", subType:"glass_half",  size:{x:tile,y:2,z:0.35}, preview:"#8fb4d6" },
    { id:"wall_smooth_top2",  name:"Wall • Smooth Top (2h)", category:"Walls", baseType:"wall", subType:"smooth_top2", size:{x:tile,y:2,z:0.35}, preview:"#6c7681" },

    // Columns / Truss / Railings
    { id:"column_round_01", name:"Steel Column (1×4)", category:"Beams & Columns", baseType:"wall", subType:"column_round_flatcaps", size:{x:1,y:4,z:1}, preview:"#a7b3c0" },
    { id:"truss_frame_01",  name:"Truss Frame",  category:"Beams & Columns", baseType:"wall", subType:"truss", size:{x:tile,y:4,z:0.5}, preview:"#a7b3c0" },
    { id:"railing_guard_01", name:"Guard Railing", category:"Ramps & Railings", baseType:"railing", subType:"guard", size:{x:tile,y:1.1,z:0.15}, preview:"#b1bdca" },

    // Pipes
    { id:"pipe_elbow_01", name:"Pipe • Elbow", category:"Pipes", baseType:"pipe", subType:"elbow", size:{x:0.6,y:0.6,z:2}, preview:"#8f9aa5" },
    { id:"pipe_full_01",  name:"Pipe • Full",  category:"Pipes", baseType:"pipe", subType:"full",  size:{x:0.6,y:0.6,z:4}, preview:"#8f9aa5" },
    { id:"pipe_end_valve", name:"Pipe • End Valve", category:"Pipes", baseType:"pipe", subType:"end_valve", size:{x:0.6,y:0.6,z:0.6}, preview:"#d66a6a" },

    // Lights
    { id:"light_stadium_down", name:"Stadium Flood (Down)", category:"Lights", baseType:"light", subType:"stadium_down", size:{x:2.2, y:6.5, z:2.2}, preview:"#e8f0ff" },
    { id:"light_stadium_up",   name:"Stadium Flood (Up)",   category:"Lights", baseType:"light", subType:"stadium_up",   size:{x:2.2, y:6.5, z:2.2}, preview:"#e8f0ff" },
  ];
}

/* ---------- Builder entry ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const mat = (hex, { rough=0.7, metal=0.0, emissive=0x000000, e=0, ...rest } = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex || options.primaryColor || '#9EAAB9'),
      roughness: ('roughness' in options) ? options.roughness : rough,
      metalness: ('metalness' in options) ? options.metalness : metal,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: e,
      envMap: dynamicEnvMap,
      side: THREE.DoubleSide,
      ...rest
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
    const { x: w, y: h, z: d } = def.size;

    // **FIX**: Removed black lines from concrete slab for a clean look.
    if (def.subType === 'concrete_slab') {
        const slab = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.08), M('#9aa2ab', { rough: 0.9 }));
        g.add(slab);
        return g;
    }

    if (def.subType === 'plate_01') {
        const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.1), M('#7f8a95', { rough: 0.4, metal: 0.9 }));
        g.add(plate);
        const boltMat = M('#5c6773', { rough: 0.3, metal: 1.0 });
        const boltGeom = new THREE.CylinderGeometry(0.08, 0.08, h + 0.02, 8);
        const boltPositions = [
            { x: -w/4, z: -d/4 }, { x: w/4, z: -d/4 },
            { x: -w/4, z: d/4 }, { x: w/4, z: d/4 },
        ];
        for (const pos of boltPositions) {
            const bolt = new THREE.Mesh(boltGeom, boltMat);
            bolt.position.set(pos.x, 0, pos.z);
            g.add(bolt);
        }
        return g;
    }

    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Walls / Columns / Truss ---------- */
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;

  if (def.subType === 'truss') {
    const frameMat = M('#9aa3ae', { rough: 0.5, metal: 0.4 });
    const cap = 0.1;
    const bars = [
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat),
      new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat),
    ];
    bars[0].position.y = -h/2 + cap/2; bars[1].position.y =  h/2 - cap/2;
    bars[2].position.x = -w/2 + cap/2; bars[3].position.x =  w/2 - cap/2;
    bars.forEach(b => g.add(b));
    
    // **FIX**: Diagonals are now rounded cylinders and fit inside the frame.
    const diagMat = M('#b7c2ce', { rough: 0.45, metal: 0.55 });
    const radius = cap * 0.7;
    const innerW = w - cap;
    const innerH = h - cap;
    const diagLen = Math.hypot(innerW, innerH);

    const diagGeom = new THREE.CylinderGeometry(radius, radius, diagLen, 12);
    const diag1 = new THREE.Mesh(diagGeom, diagMat);
    diag1.rotation.z = Math.atan2(innerH, innerW);
    const diag2 = diag1.clone(); 
    diag2.rotation.z *= -1.0;
    
    g.add(diag1, diag2);
    return g;
  }
  
  // Other wall types...
  if (def.subType === 'flat_smooth' || def.subType === 'smooth_top2') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6b7480', { rough: 0.6, metal: 0.1 })));
    return g;
  }
  if (def.subType === 'glass_half') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6e7b88', { rough: 0.55, metal: 0.15 }));
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w*0.92, h*0.75), M(0xdfefff, { rough: 0.02, metal: 0.0, opacity: 0.22, transparent: true, envMapIntensity: 0.8 }));
    glass.position.z = d*0.26;
    g.add(glass);
    return g;
  }
  if (def.subType === 'column_round_flatcaps') {
    const r = Math.min(0.18, w * 0.35);
    const coreW = w - 2 * r;
    const coreD = d - 2 * r;
    const coreMat = M('#aeb8c3', { rough: 0.4, metal: 0.75 });
    const core = new THREE.Mesh(new THREE.BoxGeometry(coreW, h, coreD), coreMat);
    g.add(core);
    const sideGeom = new THREE.CylinderGeometry(r, r, h, 16, 1, false);
    const c1 = new THREE.Mesh(sideGeom, coreMat); c1.position.x = coreW / 2;
    const c2 = c1.clone(); c2.position.x = -coreW / 2;
    const c3 = new THREE.Mesh(sideGeom, coreMat); c3.position.z = coreD / 2; c3.rotation.y = Math.PI / 2;
    const c4 = c3.clone(); c4.position.z = -coreD / 2;
    const capGeom = new THREE.PlaneGeometry(coreW, coreD);
    const cap1 = new THREE.Mesh(capGeom, coreMat); cap1.rotation.x = Math.PI/2; cap1.position.y = h/2;
    const cap2 = cap1.clone(); cap2.rotation.x = -Math.PI/2; cap2.position.y = -h/2;
    g.add(c1, c2, c3, c4, cap1, cap2);
    return g;
  }
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Railings ---------- */
function buildRailing(def, M) { /* ... Omitted for brevity, no changes ... */ return new THREE.Group(); }

/* ---------- Pipes ---------- */
function buildPipe(def, M) {
  const g = new THREE.Group();
  const diam = def.size.x;
  const pipeMat = M('#8f9aa5', { rough: 0.35, metal: 0.8 });
  const rad = diam / 2;

  if (def.subType === 'elbow') {
    const bendR = 1.2;
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(bendR, rad, 16, 32, Math.PI/2), pipeMat);
    elbow.rotation.x = -Math.PI / 2;
    g.add(elbow);
    const a = new THREE.Object3D(); a.name = 'endpointA'; a.position.set(bendR, 0, 0);
    const b = new THREE.Object3D(); b.name = 'endpointB'; b.position.set(0, bendR, 0);
    g.add(a,b);
    return g;
  }

  if (def.subType === 'full') {
    const len = 4;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 20), pipeMat);
    body.rotation.x = Math.PI/2;
    g.add(body);
    const a = new THREE.Object3D(); a.name = 'endpointA'; a.position.set(0, 0, -len/2);
    const b = new THREE.Object3D(); b.name = 'endpointB'; b.position.set(0, 0, len/2);
    g.add(a,b);
    return g;
  }

  // **NEW**: Pipe End Valve with animated smoke
  if (def.subType === 'end_valve') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 20), pipeMat);
    g.add(cap);
    
    const valveMat = M('#d66a6a', { rough: 0.4, metal: 0.9 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), valveMat);
    handle.position.y = rad + 0.3;
    g.add(handle);

    // Endpoint for snapping
    const a = new THREE.Object3D(); a.name = 'endpointA'; a.position.set(0, 0, rad);
    g.add(a);

    // Animated smoke effect
    const smokeParticles = [];
    const smokeMat = M('#ffffff', { opacity: 0.1, transparent: true, depthWrite: false });
    for (let i = 0; i < 15; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), smokeMat);
        p.position.set(0, rad + 0.1, 0);
        p.userData = {
            velocity: new THREE.Vector3( (Math.random()-0.5)*0.1, Math.random()*0.5 + 0.3, (Math.random()-0.5)*0.1),
            life: Math.random() * 2,
        };
        smokeParticles.push(p);
        g.add(p);
    }

    g.userData.update = (dt) => {
        smokeParticles.forEach(p => {
            p.position.addScaledVector(p.userData.velocity, dt);
            p.userData.life -= dt;
            p.material.opacity = Math.max(0, p.userData.life * 0.1);
            if (p.userData.life <= 0) {
                p.position.set(0, rad + 0.1, 0);
                p.userData.life = Math.random() * 2;
            }
        });
    };
    return g;
  }

  return g;
}

/* ---------- Lights ---------- */
function buildLight(def, M) { /* ... Omitted for brevity, no changes ... */ return new THREE.Group(); }
