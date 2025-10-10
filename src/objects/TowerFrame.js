// TowerFrame.js
// Procedural tower: bright white frame, alternating window bands & open decks,
// proper base on pad, piping, lights, and an antenna at the top.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createTowerFrame(opts = {}) {
  const {
    // world placement (these should match your LaunchPad layout)
    baseX = -20,          // center X of tower
    baseZ = 4,            // center Z of tower
    height = 46,          // tower height
    outerW = 12,          // outer width (X)
    outerL = 12,          // outer length (Z)
    frameSize = 0.9,      // column size
    deckEvery = 8,        // open deck spacing (meters)
    windowBandH = 1.2,    // window strip height (between decks)
    brightSteel = 0xf0f2f5,
    cladColor = 0x8d97a3,
    glassColor = 0x7fa0c4,
  } = opts;

  /* ---------------- Materials (brighter) ---------------- */
  const steelWhite = new THREE.MeshStandardMaterial({ color: brightSteel, roughness: 0.48, metalness: 0.95 });
  const clad   = new THREE.MeshStandardMaterial({ color: cladColor, roughness: 0.72, metalness: 0.6 });
  const glass  = new THREE.MeshStandardMaterial({
    color: glassColor, roughness: 0.25, metalness: 0.05, emissive: 0x2a4058, emissiveIntensity: 0.35
  });
  const glow   = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.1, roughness: 0.7 });

  // lightweight brushed feel (no risk of black screen)
  steelWhite.onBeforeCompile = (shader)=>{
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = worldPosition.xyz;'
    );
    shader.fragmentShader = `
      varying vec3 vWPos;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n2(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec3 tint = diffuse.rgb;
      float broad = n2(vWPos.xz*0.15)*0.015;
      float fine  = n2(vWPos.xz*3.0)*0.010;
      tint *= (0.985 + broad) * (0.99 + fine);
      vec4 diffuseColor = vec4(tint, opacity);
      `
    );
  };

  /* ---------------- Root ---------------- */
  const tower = new THREE.Group();
  tower.name = 'tower';
  tower.position.set(baseX, 0, baseZ);

  /* ---------------- Base footing on pad ---------------- */
  // A slightly raised ring/footing so the columns look anchored to the pad surface.
  const baseFoot = new THREE.Mesh(
    new THREE.BoxGeometry(outerW + 1.2, 0.35, outerL + 1.2),
    steelWhite
  );
  baseFoot.position.set(0, 0.175, 0);
  tower.add(baseFoot);

  /* ---------------- Frame columns + rings ---------------- */
  const halfW = outerW * 0.5;
  const halfL = outerL * 0.5;

  // columns
  const colGeom = new THREE.BoxGeometry(frameSize, height, frameSize);
  const colPos = [
    [-halfW, -halfL], [ halfW, -halfL],
    [-halfW,  halfL], [ halfW,  halfL],
  ];
  for (const [cx, cz] of colPos) {
    const c = new THREE.Mesh(colGeom, steelWhite);
    c.position.set(cx, height/2, cz);
    tower.add(c);
  }

  // horizontal rings every 3m for structure
  for (let h = 3; h < height; h += 3) {
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(outerW + frameSize, frameSize*0.4, outerL + frameSize),
      steelWhite
    );
    ring.position.set(0, h, 0);
    tower.add(ring);
  }

  /* ---------------- Open decks + window bands ---------------- */
  const inset = 0.35;
  const panelT = 0.12;

  function addPanel(side, yMid, h, mat){
    if (side==='N' || side==='S'){
      const w = outerW - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, panelT), mat);
      p.position.set(0, yMid, (side==='N'? +halfL - panelT*0.5 : -halfL + panelT*0.5));
      tower.add(p);
    } else {
      const w = outerL - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT, h, w), mat);
      p.position.set((side==='E'? +halfW - panelT*0.5 : -halfW + panelT*0.5), yMid, 0);
      tower.add(p);
    }
  }
  function addWindowStrip(side, yMid, h){
    if (side==='N' || side==='S'){
      const w = outerW - inset*2 - 0.1;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, panelT*0.55), glass);
      p.position.set(0, yMid, (side==='N'? +halfL - panelT*0.55 : -halfL + panelT*0.55));
      tower.add(p);
    } else {
      const w = outerL - inset*2 - 0.1;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT*0.55, h, w), glass);
      p.position.set((side==='E'? +halfW - panelT*0.55 : -halfW + panelT*0.55), yMid, 0);
      tower.add(p);
    }
  }

  const deckGeom = new THREE.BoxGeometry(outerW - 1.6, 0.24, outerL - 1.6);

  for (let y = deckEvery; y < height - 2; y += deckEvery) {
    // open deck slab
    const deck = new THREE.Mesh(deckGeom, steelWhite);
    deck.position.set(0, y, 0);
    tower.add(deck);

    // deck edge strips (lights)
    const makeStrip = (len, alongX, sign) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), glow);
      s.scale.set(alongX? len : 1, 1, alongX? 1 : len);
      const px = (alongX? 0 : sign*(halfW - 0.2));
      const pz = (alongX? sign*(halfL - 0.2) : 0);
      s.position.set(px, y + 0.12, pz);
      tower.add(s);
    };
    makeStrip(outerW - 1.8, true,  +1);
    makeStrip(outerW - 1.8, true,  -1);
    makeStrip(outerL - 1.8, false, +1);
    makeStrip(outerL - 1.8, false, -1);

    // small point lights
    for (const [dx, dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]) {
      const L = new THREE.PointLight(0xffffff, 0.55, 16, 2.2);
      L.position.set(dx*(halfW - 0.25), y+0.6, dz*(halfL - 0.25));
      tower.add(L);
    }

    // between this deck and the next → cladding + window band
    const mid = y + deckEvery/2;
    const capH = (deckEvery - 0.24 - windowBandH) * 0.5;

    for (const side of ['N','S','E','W']){
      addPanel(side, mid + (windowBandH*0.5 + capH*0.5), capH, clad);
      addPanel(side, mid - (windowBandH*0.5 + capH*0.5), capH, clad);
      addWindowStrip(side, mid, windowBandH);
    }
  }

  /* ---------------- Vertical piping (yellow-grey) ---------------- */
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xc8c59e, roughness: 0.9, metalness: 0.2 });
  const pipeR = 0.11;
  const vPipeGeom = new THREE.CylinderGeometry(pipeR, pipeR, height-1.0, 10);
  const pA = new THREE.Mesh(vPipeGeom, pipeMat);
  pA.position.set( halfW - 0.6, (height-1.0)/2, +1.8);
  const pB = pA.clone(); pB.position.z = -1.8;
  const pC = pA.clone(); pC.position.x = -halfW + 0.6;
  const pD = pC.clone(); pD.position.z = -1.8;
  tower.add(pA, pB, pC, pD);

  /* ---------------- Antenna / top detail ---------------- */
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,5,12), steelWhite);
  mast.position.set(0, height + 2.5, 0);
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,6,8), steelWhite);
  whip.position.set(0, height + 6 + 2.5, 0);
  tower.add(mast, whip);

  /* ---------------- API: deck Y for lift bridge alignment ---------------- */
  // Expose a useful deck height (e.g., “launch deck”) for other modules.
  tower.userData.launchDeckY = Math.round((31 / deckEvery)) * deckEvery; // snap near 31
  return tower;
}