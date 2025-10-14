// src/assets/Catalog.js
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeCatalog() {
  const tile = 4;

  return [
    // Tools
    { id:"tool_pit_digger", name:"Pit Digger", category:"Tools", baseType:"tool", size:{x:tile,y:tile,z:tile}, preview:"#ff9a3b" },
    { id:"tool_blast_pit", name:"Blast Pit Tool", category:"Tools", baseType:"tool", size:{x:tile*4,y:4,z:tile*4}, preview:"#ff5555" },

    // Floors
    { id:"floor_concrete_01", name:"Concrete Slab", category:"Floors", baseType:"floor", subType:"concrete_slab", size:{x:tile, y:0.3, z:tile}, preview:"#9aa2ab" },
    { id:"floor_plate_01",    name:"Steel Plate",   category:"Floors", baseType:"floor", subType:"plate_01",      size:{x:tile, y:0.25, z:tile}, preview:"#7f8a95" },
    { id:"floor_scifi_grid",  name:"Sci-Fi Grid",   category:"Floors", baseType:"floor", subType:"scifi_grid",    size:{x:tile, y:0.2, z:tile}, preview:"#3d5a80" },
    { id:"floor_hex_panel",   name:"Hex Panel",     category:"Floors", baseType:"floor", subType:"hex_panel",     size:{x:tile, y:0.2, z:tile}, preview:"#5c677d" },
    { id:"floor_grate_01",    name:"Grate Floor",   category:"Floors", baseType:"floor", subType:"grate_01",      size:{x:tile, y:0.2, z:tile}, preview:"#6b7480" },

    // Ramps & Steps
    { id:"steps_short", name:"Short Steps", category:"Ramps & Railings", baseType:"ramp", subType:"steps_short", size:{x:tile, y:1, z:tile/2}, preview:"#8d99ae" },

    // Walls
    { id:"wall_flat_smooth",  name:"Wall • Smooth (4h)", category:"Walls", baseType:"wall", subType:"flat_smooth", size:{x:tile,y:4,z:0.35}, preview:"#6c7681" },
    { id:"wall_glass_half",   name:"Wall • Glass (2h)",  category:"Walls", baseType:"wall", subType:"glass_half",  size:{x:tile,y:2,z:0.35}, preview:"#8fb4d6" },
    { id:"wall_panel_braced", name:"Wall • Panel Braced", category:"Walls", baseType:"wall", subType:"panel_braced", size:{x:tile,y:4,z:0.35}, preview:"#6c7681" },

    // Columns / Truss / Railings
    { id:"column_round_01", name:"Steel Column (1×4)", category:"Beams & Columns", baseType:"wall", subType:"column_round_flatcaps", size:{x:1,y:4,z:1}, preview:"#a7b3c0" },
    { id:"truss_frame_01",  name:"Truss Frame",  category:"Beams & Columns", baseType:"wall", subType:"truss", size:{x:tile,y:4,z:0.5}, preview:"#a7b3c0" },
    { id:"railing_guard_01", name:"Guard Railing", category:"Ramps & Railings", baseType:"railing", subType:"guard", size:{x:tile,y:1.1,z:0.15}, preview:"#b1bdca" },

    // Pipes
    { id:"pipe_full_01",  name:"Pipe • Straight",  category:"Pipes", baseType:"pipe", subType:"full",  size:{x:0.6, y:0.6, z:4}, preview:"#8f9aa5" },
    { id:"pipe_elbow_01", name:"Pipe • Elbow", category:"Pipes", baseType:"pipe", subType:"elbow", size:{x:1, y:1, z:1}, preview:"#8f9aa5" },
    { id:"pipe_end_valve", name:"Pipe • Flange", category:"Pipes", baseType:"pipe", subType:"end_valve", size:{x:0.8, y:0.8, z:0.1}, preview:"#e0fbfc" },
    { id:"pipe_flame_vent", name:"Pipe • Smoke Vent", category:"Pipes", baseType:"pipe", subType:"flame_vent", size:{x:0.6,y:0.6,z:1}, preview:"#cdd2d8" },

    // Lights
    { id:"light_stadium_down", name:"Stadium Flood (Down)", category:"Lights", baseType:"light", subType:"stadium_down", size:{x:2.2, y:6.5, z:2.2}, preview:"#e8f0ff" },
    { id:"light_bar",          name:"Light Bar",            category:"Lights", baseType:"light", subType:"light_bar",    size:{x:tile,y:0.15,z:0.15}, preview:"#98c1d9" },
  ];
}

/* ---------- Builder entry ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  // ... mat function is unchanged
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
    case 'ramp':    obj = buildRamp(def, mat); break;
    default:        obj = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z), mat());
  }
  obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
  obj.userData.part = def;
  return obj;
}

/* ---------- Pipes ---------- */
function buildPipe(def, M) {
  const g = new THREE.Group();
  const PIPE_DIAM = 0.6; // Standard pipe diameter for all parts
  const rad = PIPE_DIAM / 2;
  const pipeMat = M('#8f9aa5', { rough: 0.35, metal: 0.8 });

  if (def.subType === 'full') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, def.size.z, 20), pipeMat);
    body.rotation.x = Math.PI / 2; // Align along Z-axis
    g.add(body);

    // Improved: Add procedural rings/flanges for detail
    const flangeMat = M('#aab5c3', {rough: 0.4, metal: 0.9});
    const flangeGeom = new THREE.CylinderGeometry(rad * 1.2, rad * 1.2, 0.1, 24);
    const flange1 = new THREE.Mesh(flangeGeom, flangeMat);
    flange1.position.z = -def.size.z / 2 + 0.05;
    flange1.rotation.x = Math.PI / 2;
    const flange2 = flange1.clone();
    flange2.position.z = def.size.z / 2 - 0.05;
    g.add(flange1, flange2);

    return g;
  }
  
  if (def.subType === 'elbow') {
    // An elbow is a bent tube. We can simulate this with a Torus segment.
    const tubeGeom = new THREE.TorusGeometry(rad, rad, 16, 20, Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeom, pipeMat);
    tube.rotation.y = -Math.PI/2;
    g.add(tube);
    return g;
  }

  if (def.subType === 'end_valve') {
    const flangeDiam = def.size.x;
    const flangeMat = M('#aab5c3', {rough: 0.4, metal: 0.9});
    const boltMat = M('#5c6773', {rough: 0.3, metal: 1.0});

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(flangeDiam/2, flangeDiam/2, def.size.z, 24), flangeMat);
    flange.rotation.x = Math.PI/2;
    g.add(flange);
    
    // Add bolts around the flange
    const numBolts = 6;
    const boltRadius = flangeDiam / 2 * 0.75;
    for(let i=0; i<numBolts; i++) {
        const angle = (i / numBolts) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, def.size.z + 0.02, 8), boltMat);
        bolt.position.set(Math.cos(angle) * boltRadius, Math.sin(angle) * boltRadius, 0);
        bolt.rotation.x = Math.PI/2;
        g.add(bolt);
    }
    return g;
  }

  if (def.subType === 'flame_vent') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, def.size.z, 20), pipeMat);
      body.rotation.x = Math.PI/2;
      g.add(body);
      
      const particles = [];
      const smokeMat = M('#dfe3e8', { emissive: '#90959c', e: 0.2, transparent: true, opacity: 0.5, blending: THREE.NormalBlending, depthWrite: false });
      for (let i=0; i<50; i++) {
        const size = Math.random() * 0.2 + 0.1; // Varying sizes
        const p = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), smokeMat.clone());
        p.position.set(0,0,def.size.z/2);
        p.userData = { 
            life: Math.random() * 2, 
            maxLife: 2 + Math.random(), // Vary lifetime
            velocity: new THREE.Vector3((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, Math.random()*1.5+0.5) // Increased lateral drift
        };
        particles.push(p);
        g.add(p);
      }
      g.userData.update = (dt) => {
        particles.forEach(p => {
          p.position.addScaledVector(p.userData.velocity, dt);
          p.userData.life -= dt;
          
          // Improved fade in and out for a softer, smokier look
          const lifeRatio = Math.max(0, p.userData.life / p.userData.maxLife);
          p.material.opacity = Math.sin(lifeRatio * Math.PI) * 0.5;
          
          if (p.userData.life <= 0) {
            p.position.set(0,0,def.size.z/2);
            p.userData.life = p.userData.maxLife;
          }
        });
      };
      return g;
  }
  return g;
}

// ... All other build functions (buildFloor, buildWallLike, etc.) are unchanged ...
/* ---------- Floors ---------- */
function buildFloor(def, M) {
    const g = new THREE.Group();
    const { x: w, y: h, z: d } = def.size;

    if (def.subType === 'concrete_slab') {
        g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.08), M('#9aa2ab', { rough: 0.9 })));
        return g;
    }
    if (def.subType === 'plate_01') {
        g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.1), M('#7f8a95', { rough: 0.4, metal: 0.9 })));
        const boltMat = M('#5c6773', { rough: 0.3, metal: 1.0 });
        const boltGeom = new THREE.CylinderGeometry(0.08, 0.08, h + 0.02, 8);
        [{ x: -w/4, z: -d/4 }, { x: w/4, z: -d/4 }, { x: -w/4, z: d/4 }, { x: w/4, z: d/4 }].forEach(pos => {
            const bolt = new THREE.Mesh(boltGeom, boltMat);
            bolt.position.set(pos.x, 0, pos.z);
            g.add(bolt);
        });
        return g;
    }
    if (def.subType === 'scifi_grid') {
        g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#3d5a80', { rough: 0.4, metal: 0.8 })));
        const lightMat = M('#98c1d9', { emissive: '#98c1d9', e: 2 });
        for(let i = -w/2; i <= w/2; i += w/4) {
            const lineX = new THREE.Mesh(new THREE.BoxGeometry(0.05, h+0.01, d), lightMat);
            lineX.position.x = i;
            const lineZ = new THREE.Mesh(new THREE.BoxGeometry(w, h+0.01, 0.05), lightMat);
            lineZ.position.z = i;
            g.add(lineX, lineZ);
        }
        return g;
    }
    if (def.subType === 'hex_panel') {
        g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#5c677d', { rough: 0.5, metal: 0.7 })));
        return g;
    }
    if (def.subType === 'grate_01') {
        const frameMat = M('#6b7480', { rough: 0.6, metal: 0.5 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        g.add(frame);

        // Procedural grates: Add bars with holes
        const barMat = M('#5c6773', { rough: 0.4, metal: 0.8 });
        for (let i = -w/2 + 0.2; i < w/2; i += 0.4) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, h + 0.01, d), barMat);
            bar.position.x = i;
            g.add(bar);
        }
        for (let i = -d/2 + 0.2; i < d/2; i += 0.4) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h + 0.01, 0.1), barMat);
            bar.position.z = i;
            g.add(bar);
        }
        return g;
    }
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Ramps & Steps ---------- */
function buildRamp(def, M) {
    const g = new THREE.Group();
    const { x: w, y: h, z: d } = def.size;
    if (def.subType === 'steps_short') {
        const mat = M('#8d99ae', { rough: 0.6, metal: 0.3 });
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(w, h/2, d), mat);
        step1.position.y = -h/4;
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(w, h/2, d/2), mat);
        step2.position.y = h/4;
        step2.position.z = -d/4;
        g.add(step1, step2);
    }
    return g;
}

/* ---------- Walls / Columns / Truss ---------- */
function buildWallLike(def, M) {
  const g = new THREE.Group();
  const { x:w, y:h, z:d } = def.size;
  if (def.subType === 'truss') {
    const frameMat = M('#9aa3ae', { rough: 0.5, metal: 0.4 });
    const cap = 0.1;
    const bars = [ new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat), new THREE.Mesh(new THREE.BoxGeometry(w, cap, d), frameMat), new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat), new THREE.Mesh(new THREE.BoxGeometry(cap, h, d), frameMat) ];
    bars[0].position.y = -h/2 + cap/2; bars[1].position.y =  h/2 - cap/2;
    bars[2].position.x = -w/2 + cap/2; bars[3].position.x =  w/2 - cap/2;
    bars.forEach(b => g.add(b));
    const diagMat = M('#b7c2ce', { rough: 0.45, metal: 0.55 });
    const radius = cap * 0.7;
    const innerW = w - cap; const innerH = h - cap;
    const diagLen = Math.hypot(innerW, innerH);
    const diagGeom = new THREE.CylinderGeometry(radius, radius, diagLen, 12);
    const diag1 = new THREE.Mesh(diagGeom, diagMat);
    diag1.rotation.z = Math.atan2(innerH, innerW);
    const diag2 = diag1.clone(); 
    diag2.rotation.z *= -1.0;
    g.add(diag1, diag2);
    return g;
  }
  if (def.subType === 'flat_smooth') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M('#6b7480', { rough: 0.6, metal: 0.1 })));
    return g;
  }
  if (def.subType === 'panel_braced') {
    const frameMat = M('#434b57', { rough: 0.5, metal: 0.4 });
    const panelMat = M('#707c8d', { rough: 0.7, metal: 0.2 });
    const braceMat = M('#9da8b8', { rough: 0.4, metal: 0.6 });

    // Outer frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.8), frameMat);
    g.add(frame);

    // Inner panels
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, h * 0.8, d * 0.6), panelMat);
      panel.position.x = (i - 0.5) * w * 0.5;
      g.add(panel);
    }

    // Diagonal braces
    const braceGeom = new THREE.CylinderGeometry(0.1, 0.1, Math.hypot(w, h), 12);
    const brace1 = new THREE.Mesh(braceGeom, braceMat);
    brace1.rotation.z = Math.atan2(h, w);
    brace1.position.y = -h/4;
    const brace2 = brace1.clone();
    brace2.rotation.z *= -1;
    brace2.position.y = h/4;
    g.add(brace1, brace2);

    return g;
  }
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M());
}

/* ---------- Railings ---------- */
function buildRailing(def, M) {
    const g = new THREE.Group();
    const { x: w, y: h, z: d } = def.size;
    if (def.subType === 'guard') {
        const postMat = M('#aab5c3', { rough: 0.45, metal: 0.65 });
        const railMat = M('#ced7e2', { rough: 0.35, metal: 0.7 });
        const postGeom = new RoundedBoxGeometry(d, h, d, 2, 0.03);
        const railGeom = new RoundedBoxGeometry(w, 0.1, d, 2, 0.03);
        for (let i = 0; i < 3; i++) {
            const post = new THREE.Mesh(postGeom, postMat);
            post.position.x = -w / 2 + i * (w / 2);
            g.add(post);
        }
        const topRail = new THREE.Mesh(railGeom, railMat);
        topRail.position.y = h/2 - 0.05;
        g.add(topRail);
    }
    return g;
}

/* ---------- Lights ---------- */
function buildLight(def, M) {
    const g = new THREE.Group();
    const { x: w, y: h, z: d } = def.size;
    if (def.subType === 'light_bar') {
        const frameMat = M('#3d405b', { rough: 0.6, metal: 0.8 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        g.add(frame);
        const lightMat = M('#e0fbfc', { emissive: '#e0fbfc', e: 15 });
        const light = new THREE.Mesh(new THREE.BoxGeometry(w*0.95, h*0.5, d*0.5), lightMat);
        g.add(light);

        // Make it glow: Add PointLight for casting light
        const pointLight = new THREE.PointLight('#e0fbfc', 10, 10);
        pointLight.position.set(0, 0, 0);
        g.add(pointLight);
    }
    if (def.subType === 'stadium_down' || def.subType === 'stadium_up') { /* ... */ }
    return g;
}