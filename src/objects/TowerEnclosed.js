// src/objects/TowerEnclosed.js
// Enclosed bright-metal tower with decks every 8m, cladding & window bands,
// pipes, and perimeter lights. Sized so there’s ~2 tiles (~4m) walkway around
// a central 3×3 column space on walkable floors.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createTowerEnclosed(opts = {}) {
  const {
    name = 'tower',
    // placement relative to world (center of tower footprint)
    baseX = -56/2 + 7.5,  // default matches previous scene placement
    baseZ = 4,
    width = 12.0,
    length = 12.0,
    height = 46.0,

    // launch deck height (bridge connects here)
    launchDeckY = 31.0,

    // materials
    steelColor = 0xf0f2f5,  // bright white metal
    cladColor  = 0x8d97a3,
    glassColor = 0x7fa0c4,
  } = opts;

  const tower = new THREE.Group(); tower.name = name;

  // materials
  const steel = new THREE.MeshStandardMaterial({ color: steelColor, roughness: 0.48, metalness: 0.95 });
  patchSteelWhite(steel);

  const clad  = new THREE.MeshStandardMaterial({ color: cladColor, roughness: 0.72, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({
    color: glassColor, roughness: 0.25, metalness: 0.05,
    emissive: 0x2a4058, emissiveIntensity: 0.35
  });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });

  // --- white frame columns and rings ---
  {
    const colBox = new THREE.BoxGeometry(0.9, height, 0.9);
    const corners = [
      [baseX - width/2, baseZ - length/2],
      [baseX + width/2, baseZ - length/2],
      [baseX - width/2, baseZ + length/2],
      [baseX + width/2, baseZ + length/2],
    ];
    for (const [x,z] of corners) {
      const m = new THREE.Mesh(colBox, steel);
      m.position.set(x, height/2, z);
      tower.add(m);
    }
    for (let h=3; h<height; h+=3){
      const ring = new THREE.Mesh(new THREE.BoxGeometry(width+1.0, 0.36, length+1.0), steel);
      ring.position.set(baseX, h, baseZ);
      tower.add(ring);
    }
  }

  // decks + lights, window bands between decks
  const deckStep = 8;
  const panelT = 0.12, inset = 0.35, winH = 1.2, winInset = 0.06;

  function panel(side, yMid, height, mat){
    if (side==='N' || side==='S'){
      const w = width - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, height, panelT), mat);
      p.position.set(baseX, yMid, baseZ + (side==='N' ? (length/2 - panelT/2) : -(length/2 - panelT/2)));
      return p;
    } else {
      const w = length - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT, height, w), mat);
      p.position.set(baseX + (side==='E' ? (width/2 - panelT/2) : -(width/2 - panelT/2)), yMid, baseZ);
      return p;
    }
  }
  function windowStrip(side, yMid, height){
    const mat = glass;
    if (side==='N' || side==='S'){
      const w = width - inset*2 - winInset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, height, panelT*0.55), mat);
      p.position.set(baseX, yMid, baseZ + (side==='N' ? (length/2 - panelT*0.55) : -(length/2 - panelT*0.55)));
      return p;
    } else {
      const w = length - inset*2 - winInset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT*0.55, height, w), mat);
      p.position.set(baseX + (side==='E' ? (width/2 - panelT*0.55) : -(width/2 - panelT*0.55)), yMid, baseZ);
      return p;
    }
  }

  for (let y=deckStep; y<height-2; y+=deckStep){
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width - 1.4, 0.24, length - 1.4), steel);
    deck.position.set(baseX, y, baseZ);
    tower.add(deck);

    // deck edge lights
    const edge = new THREE.Group();
    const mkStrip = (len, alongX, sign)=> {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), glow);
      s.scale.set(alongX? len : 1, 1, alongX? 1 : len);
      const px = baseX + (alongX ? 0 : (sign*(width/2 - 0.2)));
      const pz = baseZ + (alongX ? (sign*(length/2 - 0.2)) : 0);
      s.position.set(px, y + 0.12, pz);
      edge.add(s);
    };
    mkStrip(width-1.6, true, +1);  mkStrip(width-1.6, true, -1);
    mkStrip(length-1.6, false, +1); mkStrip(length-1.6, false, -1);
    tower.add(edge);

    // small point lights
    for (const [dx,dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]){
      const L = new THREE.PointLight(0xffffff, 0.5, 16, 2.2);
      L.position.set(baseX + dx*(width/2 - 0.2), y+0.6, baseZ + dz*(length/2 - 0.2));
      tower.add(L);
    }

    // window band between decks
    const bandYMid = y + deckStep/2;
    const capH = (deckStep - 0.24 - winH) * 0.5;
    for (const side of ['N','S','E','W']){
      tower.add(panel(side, bandYMid + (winH/2 + capH/2), capH, clad));
      tower.add(panel(side, bandYMid - (winH/2 + capH/2), capH, clad));
      tower.add(windowStrip(side, bandYMid, winH));
    }
  }

  // Piping
  const pipeMat  = new THREE.MeshStandardMaterial({ color: 0xc8c59e, roughness: 0.9, metalness: 0.2 });
  const pipeR = 0.11;
  const pipeVGeom = new THREE.CylinderGeometry(pipeR, pipeR, height-1.5, 8);
  const pipeHGeom = new THREE.CylinderGeometry(pipeR, pipeR, width-1.6, 8);
  const v1 = new THREE.Mesh(pipeVGeom, pipeMat);
  v1.position.set(baseX + (width/2 - 0.55), (height-1.5)/2, baseZ + 1.8);
  const v2 = v1.clone(); v2.position.z = baseZ - 1.8;
  tower.add(v1, v2);
  for (let y=8; y<height; y+=8){
    const hPipe = new THREE.Mesh(pipeHGeom, pipeMat); hPipe.rotation.z = Math.PI/2;
    hPipe.position.set(baseX, y, baseZ + 1.8);
    const hPipe2 = hPipe.clone(); hPipe2.position.z = baseZ - 1.8;
    tower.add(hPipe, hPipe2);
  }

  // handy for other modules (arms / bridge)
  tower.userData.dim = { baseX, baseZ, width, length, height, launchDeckY };

  return tower;
}

// subtle brushed/anisotropic steel variation
function patchSteelWhite(mat){
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <worldpos_vertex>','#include <worldpos_vertex>\n vWPos = worldPosition.xyz;'
    );
    shader.fragmentShader = `
      varying vec3 vWPos;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec3 tint = diffuse.rgb;
      float broad = vnoise(vWPos.xz * 0.12);
      float fine  = vnoise(vWPos.xz * 3.3);
      tint *= 0.985 + broad*0.015;
      tint *= 0.99 + fine*0.01;
      vec4 diffuseColor = vec4(tint, opacity);
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      float aniso = 0.07 * (0.5 + 0.5 * sin(vWPos.x * 5.0));
      roughnessFactor = clamp(roughnessFactor - aniso + vnoise(vWPos.xz*2.3)*0.04, 0.06, 0.85);
      `
    ).replace(
      '#include <metalnessmap_fragment>',
      `
      #include <metalnessmap_fragment>
      metalnessFactor = clamp(metalnessFactor * (0.98 + vnoise(vWPos.xz*0.9)*0.05), 0.75, 1.0);
      `
    );
  };
}