import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * A convincing NASA-style launch complex built from simple meshes:
 * - Huge concrete platform with a central flame trench opening
 * - Trench walls + dark interior pit
 * - Tower (lattice of beams) with service arms
 * - Cable trays / railings as thin boxes
 *
 * Sizes chosen to fit in 100x100 area but feel massive.
 */
export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  // ---- Platform (split into four slabs to "frame" the trench opening) ----
  const platformH = 0.6;
  const platformSize = 40;      // full square
  const trenchW = 10;           // width of opening
  const trenchL = 22;           // length of opening

  const conc = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.95, metalness: 0.05 });
  const darkConc = new THREE.MeshStandardMaterial({ color: 0x72777d, roughness: 1.0, metalness: 0.0 });

  // Helper to build a slab
  const slab = (w,l,h, x,z, mat=conc) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, h/2, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m); return m;
  };

  // Frame around the rectangular trench
  const frameW = (platformSize - trenchW) / 2;
  const frameL = platformSize;

  // Left & right long slabs
  slab(frameW, frameL, platformH, - (trenchW/2 + frameW/2), 0);
  slab(frameW, frameL, platformH,   (trenchW/2 + frameW/2), 0);

  // Top & bottom short slabs
  const capL = (platformSize - trenchL) / 2;
  slab(trenchW, capL, platformH, 0, -(trenchL/2 + capL/2)); // bottom
  slab(trenchW, capL, platformH, 0,   (trenchL/2 + capL/2)); // top

  // --- Trench walls & pit ---
  const wallT = 0.6;
  const wallH = 6.0;
  const innerW = trenchW;
  const innerL = trenchL;

  // Long side walls
  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, innerL), darkConc);
  wall1.position.set(-innerW/2 - wallT/2, -wallH/2, 0);
  const wall2 = wall1.clone(); wall2.position.x = innerW/2 + wallT/2;
  // Short end walls (low, to imply exhaust deflection channel)
  const endH = 3.5;
  const end1 = new THREE.Mesh(new THREE.BoxGeometry(innerW + wallT*2, endH, wallT), darkConc);
  end1.position.set(0, -endH/2, -innerL/2 - wallT/2);
  const end2 = end1.clone(); end2.position.z = innerL/2 + wallT/2;

  // Pit floor (dark)
  const pit = new THREE.Mesh(new THREE.BoxGeometry(innerW, wallT, innerL), new THREE.MeshStandardMaterial({ color: 0x42464b, roughness: 1.0 }));
  pit.position.set(0, -wallH - wallT/2, 0);

  g.add(wall1, wall2, end1, end2, pit);

  // --- Support tower (lattice) ---
  const tower = new THREE.Group(); tower.name = 'tower';
  const towerH = 30;
  const towerX = -(platformSize/2) + 6;   // left side of trench
  const towerZ = 6;

  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.6, metalness: 0.6 });

  // vertical columns (4 corners)
  const col = (x,z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, towerH, 0.7), steel);
    m.position.set(x, towerH/2, z);
    tower.add(m);
  };
  const baseW = 6, baseL = 6;
  col(towerX - baseW/2, towerZ - baseL/2);
  col(towerX + baseW/2, towerZ - baseL/2);
  col(towerX - baseW/2, towerZ + baseL/2);
  col(towerX + baseW/2, towerZ + baseL/2);

  // horizontal braces every few meters
  for (let h = 3; h < towerH; h += 3) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(baseW+0.6, 0.35, baseL+0.6), steel);
    ring.position.set(towerX, h, towerZ);
    tower.add(ring);
  }

  // diagonal cross-braces on two sides
  const diag = (x1,z1,x2,z2, y1,y2) => {
    const dx = x2-x1, dz = z2-z1, dy = y2-y1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), steel);
    m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
    // orientation
    m.lookAt(x2, y2, z2);
    m.rotateX(Math.PI/2);
    tower.add(m);
  };
  for (let h = 0; h < towerH-3; h += 6) {
    // front face
    diag(towerX - baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ - baseL/2, h, h+3);
    diag(towerX + baseW/2, towerZ - baseL/2, towerX - baseW/2, towerZ - baseL/2, h+3, h+6);
    // right face
    diag(towerX + baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ + baseL/2, h, h+3);
    diag(towerX + baseW/2, towerZ + baseL/2, towerX + baseW/2, towerZ - baseL/2, h+3, h+6);
  }

  // service arms extending over trench
  const armLen = innerW/2 + 4;
  const arm = (h, length=armLen) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, 0.6), steel);
    a.position.set(towerX + baseW/2 + length/2, h, towerZ);
    tower.add(a);
    // small vertical pipe at tip
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.6,10), steel);
    tip.position.set(a.position.x + length/2 - 0.3, h + 0.8, towerZ);
    tower.add(tip);
  };
  arm(8); arm(14); arm(20);

  g.add(tower);

  // Cable trays/railings (thin long boxes)
  const rail = (x,z, len, dir='x') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dir==='x'?len:0.15, 0.25, dir==='x'?0.15:len), steel);
    m.position.set(x, platformH + 0.15, z);
    g.add(m);
  };
  rail(0, -(platformSize/2)+1.2, platformSize-2, 'x');
  rail(0,  (platformSize/2)-1.2, platformSize-2, 'x');
  rail(-(platformSize/2)+1.2, 0, platformSize-2, 'z');
  rail( (platformSize/2)-1.2, 0, platformSize-2, 'z');

  return g;
}