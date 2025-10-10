import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Massive NASA-style pad:
 * - Concrete platform framing a central flame trench
 * - Trench walls + dark pit
 * - Lattice tower + service arms
 * - NEW: Procedural safety fence around the trench
 * - NEW: Procedural concrete/metal micro-variation (roughness/metalness/color)
 */
export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  // ---------- sizes ----------
  const platformH = 0.6;
  const platformSize = 40;   // full square footprint
  const trenchW = 10;
  const trenchL = 22;

  // ---------- materials with procedural micro-variation ----------
  const conc = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.95, metalness: 0.05 });
  patchConcreteMaterial(conc);

  const darkConc = new THREE.MeshStandardMaterial({ color: 0x72777d, roughness: 1.0, metalness: 0.0 });
  patchConcreteMaterial(darkConc, /*darker=*/true);

  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.55, metalness: 0.8 });
  patchSteelMaterial(steel);

  // helper to add a slab
  const slab = (w,l,h, x,z, mat=conc) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, h/2, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m); return m;
  };

  // frame around the trench (split platform so opening remains)
  const frameW = (platformSize - trenchW) / 2;
  slab(frameW, platformSize, platformH, - (trenchW/2 + frameW/2), 0, conc);
  slab(frameW, platformSize, platformH,   (trenchW/2 + frameW/2), 0, conc);
  const capL = (platformSize - trenchL) / 2;
  slab(trenchW, capL, platformH, 0, - (trenchL/2 + capL/2), conc);
  slab(trenchW, capL, platformH, 0,   (trenchL/2 + capL/2), conc);

  // trench walls & pit
  const wallT = 0.6;
  const wallH = 6.0;

  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, trenchL), darkConc);
  wall1.position.set(-trenchW/2 - wallT/2, -wallH/2, 0);
  const wall2 = wall1.clone(); wall2.position.x = trenchW/2 + wallT/2;

  const endH = 3.5;
  const end1 = new THREE.Mesh(new THREE.BoxGeometry(trenchW + wallT*2, endH, wallT), darkConc);
  end1.position.set(0, -endH/2, -trenchL/2 - wallT/2);
  const end2 = end1.clone(); end2.position.z = trenchL/2 + wallT/2;

  const pit = new THREE.Mesh(new THREE.BoxGeometry(trenchW, wallT, trenchL), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 1.0 }));
  patchConcreteMaterial(pit.material, /*darker=*/true);
  pit.position.set(0, -wallH - wallT/2, 0);

  g.add(wall1, wall2, end1, end2, pit);

  // ---------- tower (lattice) ----------
  const tower = new THREE.Group(); tower.name = 'tower';
  const towerH = 30;
  const towerX = -(platformSize/2) + 6;
  const towerZ = 6;

  // vertical columns (4 corners)
  const baseW = 6, baseL = 6;
  tower.add(makeColumn(towerX - baseW/2, towerZ - baseL/2, towerH, steel));
  tower.add(makeColumn(towerX + baseW/2, towerZ - baseL/2, towerH, steel));
  tower.add(makeColumn(towerX - baseW/2, towerZ + baseL/2, towerH, steel));
  tower.add(makeColumn(towerX + baseW/2, towerZ + baseL/2, towerH, steel));

  // horizontal braces
  for (let h = 3; h < towerH; h += 3) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(baseW+0.6, 0.35, baseL+0.6), steel);
    ring.position.set(towerX, h, towerZ);
    tower.add(ring);
  }

  // diagonals (front + right faces for depth)
  for (let h = 0; h < towerH-3; h += 6) {
    tower.add(makeDiagonal(towerX - baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ - baseL/2, h, h+3, steel));
    tower.add(makeDiagonal(towerX + baseW/2, towerZ - baseL/2, towerX - baseW/2, towerZ - baseL/2, h+3, h+6, steel));
    tower.add(makeDiagonal(towerX + baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ + baseL/2, h, h+3, steel));
    tower.add(makeDiagonal(towerX + baseW/2, towerZ + baseL/2, towerX + baseW/2, towerZ - baseL/2, h+3, h+6, steel));
  }

  // service arms
  const armLen = trenchW/2 + 4;
  tower.add(makeArm(towerX, towerZ, baseW, 8,  armLen, steel));
  tower.add(makeArm(towerX, towerZ, baseW, 14, armLen, steel));
  tower.add(makeArm(towerX, towerZ, baseW, 20, armLen, steel));

  g.add(tower);

  // ---------- railings around platform perimeter (simple) ----------
  g.add(makePerimeterRails(platformSize, platformH + 0.15, steel));

  // ---------- NEW: procedural safety fence around trench opening ----------
  g.add(makeTrenchFence({ trenchW, trenchL, platformH, postEvery: 1.5, height: 1.2, steel }));

  return g;
}

/* ================= helpers ================= */

function makeColumn(x,z, h, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), mat);
  m.position.set(x, h/2, z);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

function makeDiagonal(x1,z1,x2,z2, y1,y2, mat) {
  const dx = x2-x1, dz = z2-z1, dy = y2-y1;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), mat);
  m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
  m.lookAt(x2, y2, z2);
  m.rotateX(Math.PI/2);
  return m;
}

function makeArm(towerX, towerZ, baseW, h, length, mat) {
  const a = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, 0.6), mat);
  a.position.set(towerX + baseW/2 + length/2, h, towerZ);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.6,10), mat);
  tip.position.set(a.position.x + length/2 - 0.3, h + 0.8, towerZ);
  const g = new THREE.Group();
  g.add(a, tip);
  return g;
}

function makePerimeterRails(size, y, mat) {
  const group = new THREE.Group();
  const rail = (x,z, len, dir='x') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dir==='x'?len:0.12, 0.25, dir==='x'?0.12:len), mat);
    m.position.set(x, y, z);
    group.add(m);
  };
  rail(0, -(size/2)+1.2, size-2, 'x');
  rail(0,  (size/2)-1.2, size-2, 'x');
  rail(-(size/2)+1.2, 0, size-2, 'z');
  rail( (size/2)-1.2, 0, size-2, 'z');
  return group;
}

/* -------- NEW: procedural trench fence (posts + 2 rails) -------- */
function makeTrenchFence({ trenchW, trenchL, platformH, postEvery=1.5, height=1.2, steel }) {
  const group = new THREE.Group();
  const y = platformH + height/2;

  // Posts as InstancedMesh
  const postGeom = new THREE.CylinderGeometry(0.07, 0.07, height, 6);
  const postMat = steel;
  const positions = [];

  // Rectangle path inset slightly from trench edge
  const inset = 0.8;
  const hw = trenchW/2 + inset;
  const hl = trenchL/2 + inset;

  // generate posts along rectangle
  const perims = [
    { ax:'x', z: -hl, from:-hw, to: hw },
    { ax:'x', z:  hl, from:-hw, to: hw },
    { ax:'z', x: -hw, from:-hl, to: hl },
    { ax:'z', x:  hw, from:-hl, to: hl },
  ];
  for (const p of perims) {
    const length = p.to - p.from;
    const steps = Math.max(2, Math.round(Math.abs(length) / postEvery));
    for (let i=0;i<=steps;i++){
      const t = i/steps;
      const pos = p.from + t*length;
      if (p.ax==='x') positions.push([pos, y, p.z]);
      else positions.push([p.x, y, pos]);
    }
  }

  const posts = new THREE.InstancedMesh(postGeom, postMat, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.set(0,0,0);
    dummy.scale.set(1,1,1);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  // Two horizontal rails (thin cylinders) built as LineSegments -> cylinders for thickness
  const railHeightOffsets = [0.35, 0.85];
  for (const off of railHeightOffsets) {
    const railY = platformH + off;
    // four rails forming a rectangle
    group.add(makeRail(-hw, -hl,  hw, -hl, railY, steel));
    group.add(makeRail( hw, -hl,  hw,  hl, railY, steel));
    group.add(makeRail( hw,  hl, -hw,  hl, railY, steel));
    group.add(makeRail(-hw,  hl, -hw, -hl, railY, steel));
  }

  return group;
}

function makeRail(x1,z1,x2,z2,y, mat) {
  const dx = x2-x1, dz = z2-z1;
  const len = Math.hypot(dx,dz);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len,8), mat);
  m.position.set((x1+x2)/2, y, (z1+z2)/2);
  m.rotation.z = Math.PI/2;
  const ang = Math.atan2(dz, dx);
  m.rotation.y = -ang;
  return m;
}

/* -------- Procedural material patches (no textures) -------- */

function patchConcreteMaterial(mat, darker=false){
  mat.onBeforeCompile = (shader) => {
    // pass world
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <worldpos_vertex>','#include <worldpos_vertex>\n vWPos = worldPosition.xyz;'
    );
    shader.fragmentShader = `
      varying vec3 vWPos;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec3 diffuseVar = diffuse.rgb;
      // large scale variation (staining), small speckle (aggregate)
      float large = vnoise(vWPos.xz * 0.05);
      float small = vnoise(vWPos.xz * 1.5);
      float tone  = (large*0.25 + small*0.05);
      ${darker ? 'diffuseVar *= 0.92 - tone*0.12;' : 'diffuseVar *= 0.98 - tone*0.08;'}
      vec4 diffuseColor = vec4( diffuseVar, opacity );
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // roughness micro-variation: concrete pores
      float rVar = vnoise(vWPos.xz * 2.0)*0.06 + vnoise(vWPos.xz * 0.2)*0.04;
      roughnessFactor = clamp(roughnessFactor + rVar, 0.0, 1.0);
      `
    ).replace(
      '#include <metalnessmap_fragment>',
      `
      #include <metalnessmap_fragment>
      // concrete stays non-metal; slightly vary to avoid perfect flat
      metalnessFactor = clamp(metalnessFactor * (0.95 + vnoise(vWPos.xz*1.3)*0.06), 0.0, 0.2);
      `
    );
  };
}

function patchSteelMaterial(mat){
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
      float broad = vnoise(vWPos.xz * 0.08);
      float fine  = vnoise(vWPos.xz * 3.0);
      tint *= 0.98 + broad*0.02;
      tint *= 0.98 + fine*0.01;
      vec4 diffuseColor = vec4(tint, opacity);
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // brushed steel feel: slightly lower roughness along one axis
      float aniso = 0.08 * (0.5 + 0.5 * sin(vWPos.x * 4.0));
      roughnessFactor = clamp(roughnessFactor - aniso + vnoise(vWPos.xz*2.5)*0.04, 0.02, 0.8);
      `
    ).replace(
      '#include <metalnessmap_fragment>',
      `
      #include <metalnessmap_fragment>
      // tiny oxidation variation
      metalnessFactor = clamp(metalnessFactor * (0.95 + vnoise(vWPos.xz*0.7)*0.1), 0.6, 1.0);
      `
    );
  };
}