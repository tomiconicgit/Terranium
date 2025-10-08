import * as THREE from 'three';

/**
 * Creates a procedural “moon-white” desert terrain over a 50×50 area.
 * Based on your Perlin-driven dunes code, with cactus/building logic removed.
 */

// --- Perlin implementation (as provided) ---
class PerlinNoise {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.perm = new Array(512);
    this.gradP = new Array(512);

    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = Math.floor(seed * 10000 + i) % 256;

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gradP[i] = this.gradients[this.perm[i] % 12];
    }
  }
  gradients = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];
  fade(t){ return t*t*t*(t*(t*6-15)+10); }
  lerp(a,b,t){ return (1-t)*a + t*b; }
  grad(hash,x,y,z){ const g=this.gradP[hash]; return g[0]*x + g[1]*y + g[2]*z; }
  noise(x,y,z=0){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
    x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
    const u=this.fade(x), v=this.fade(y), w=this.fade(z);
    const A=this.perm[X]+Y, AA=this.perm[A]+Z, AB=this.perm[A+1]+Z;
    const B=this.perm[X+1]+Y, BA=this.perm[B]+Z, BB=this.perm[B+1]+Z;
    return this.lerp(
      this.lerp(
        this.lerp(this.grad(this.perm[AA],x,y,z), this.grad(this.perm[BA],x-1,y,z), u),
        this.lerp(this.grad(this.perm[AB],x,y-1,z), this.grad(this.perm[BB],x-1,y-1,z), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad(this.perm[AA+1],x,y,z-1), this.grad(this.perm[BA+1],x-1,y,z-1), u),
        this.lerp(this.grad(this.perm[AB+1],x,y-1,z-1), this.grad(this.perm[BB+1],x-1,y-1,z-1), u),
        v
      ),
      w
    );
  }
}

export class DesertTerrain {
  constructor(scene, townDimensions) {
    this.scene = scene;

    // Force a 50×50 landscape as requested
    const desertSize = 50;

    // “Moon-white” palette (cool grays)
    const moonWhite = [
      new THREE.Color(0xDADFE6), // base
      new THREE.Color(0xB8C0CA), // darker/shadow
      new THREE.Color(0xEEF2F6), // lighter
      new THREE.Color(0x99A1AD), // deeper shadow
      new THREE.Color(0xFFFFFF)  // highlight
    ];

    this.config = {
      size: desertSize,
      resolution: 200, // dense enough for 50×50
      noiseScale: {
        base: 0.15,          // scaled up for small world
        dunes: 0.35,
        secondaryDunes: 0.6,
        ridges: 1.2,
        detail: 2.0,
        flat: 0.15,
        microRipples: 8.0,
        sandGrains: 60.0
      },
      heightScale: {
        base: 0.6,
        dunes: 1.8,
        secondaryDunes: 0.9,
        ridges: 0.5,
        detail: 0.35,
        microRipples: 0.08,
        sandGrains: 0.02
      },
      duneDirection: Math.PI * 0.25,
      sandColors: moonWhite,
      distanceBlur: {
        enabled: true,
        startDistance: desertSize * 0.35,
        endDistance: desertSize * 0.5,
        skyboxColor: new THREE.Color(0x0a0f16),
        atmosphericHaze: true,
        hazeStartDistance: desertSize * 0.15,
        hazeFactor: 0.6
      },
      dunes: { smoothing: true, smoothingFactor: 0.7, ridgeSharpness: 0.4 },
      // No “town” — make the whole area desert
      townBuffer: 0
    };

    // Noise generators
    this.baseNoise = new PerlinNoise(Math.random());
    this.duneNoise = new PerlinNoise(Math.random() + 100);
    this.secondaryDuneNoise = new PerlinNoise(Math.random() + 150);
    this.ridgeNoise = new PerlinNoise(Math.random() + 175);
    this.detailNoise = new PerlinNoise(Math.random() + 200);
    this.colorNoise = new PerlinNoise(Math.random() + 300);
    this.microRipplesNoise = new PerlinNoise(Math.random() + 400);
    this.sandGrainsNoise = new PerlinNoise(Math.random() + 500);
  }

  // Wind-aligned dunes
  getDirectionalDuneHeight(x, z) {
    const d = this.config.duneDirection;
    const rx = x * Math.cos(d) + z * Math.sin(d);
    const rz = -x * Math.sin(d) + z * Math.cos(d);

    const dune = this.duneNoise.noise(rx * this.config.noiseScale.dunes, rz * this.config.noiseScale.dunes * 0.5) * this.config.heightScale.dunes;
    const sec  = this.secondaryDuneNoise.noise(rx * this.config.noiseScale.secondaryDunes, rz * this.config.noiseScale.secondaryDunes) * this.config.heightScale.secondaryDunes;

    const r = this.ridgeNoise.noise(rx * this.config.noiseScale.ridges, rz * this.config.noiseScale.ridges);
    let ridge;
    if (this.config.dunes.smoothing) {
      const s = Math.abs(r * 2 - 1);
      const pow = 1.0 + this.config.dunes.smoothingFactor * 2.0;
      ridge = Math.pow(s, pow) * this.config.heightScale.ridges * this.config.dunes.ridgeSharpness;
    } else {
      ridge = Math.abs(r * 2 - 1) * this.config.heightScale.ridges;
    }
    return dune + sec + ridge;
  }

  // No train tracks in this scene — always false
  isNearTrainTrack() { return false; }

  // No town — full desert
  getTownBlendFactor() { return 1.0; }

  generateTerrain() {
    // Procedural normal & roughness
    const normalMapTexture = this.createSandNormalMap();
    const roughnessTexture = this.createSandRoughnessMap();

    const g = new THREE.PlaneGeometry(this.config.size, this.config.size, this.config.resolution, this.config.resolution);
    g.rotateX(-Math.PI / 2);

    const v = g.attributes.position.array;
    const colors = new Float32Array(v.length);

    const edgeFadeStart = this.config.size * 0.4;
    const edgeFadeEnd   = this.config.size * 0.5;
    const heightAtEdge  = this.config.size * 0.015;

    for (let i = 0; i < v.length; i += 3) {
      const x = v[i], z = v[i + 2];
      const dist = Math.hypot(x, z);

      // Base + dunes
      let h = this.baseNoise.noise(x * this.config.noiseScale.base, z * this.config.noiseScale.base) * this.config.heightScale.base;
      let duneH = this.getDirectionalDuneHeight(x, z);

      if (this.config.dunes.smoothing) {
        const sNoise = this.baseNoise.noise(x * this.config.noiseScale.dunes * 2, z * this.config.noiseScale.dunes * 2);
        duneH *= (0.85 + sNoise * 0.3);
      }
      h += duneH;

      // Details & micro ripples (wind-aligned)
      const d = this.config.duneDirection;
      const ax = x * Math.cos(d) + z * Math.sin(d);
      const az = -x * Math.sin(d) + z * Math.cos(d);

      const detail = this.detailNoise.noise(x * this.config.noiseScale.detail, z * this.config.noiseScale.detail) * this.config.heightScale.detail;
      const ripples = this.microRipplesNoise.noise(ax * this.config.noiseScale.microRipples, az * this.config.noiseScale.microRipples * 5) * this.config.heightScale.microRipples;
      const ripples2= this.microRipplesNoise.noise(ax * this.config.noiseScale.microRipples * 2, az * this.config.noiseScale.microRipples * 7) * this.config.heightScale.microRipples * 0.4;
      const grains  = this.sandGrainsNoise.noise(x * this.config.noiseScale.sandGrains, z * this.config.noiseScale.sandGrains) * this.config.heightScale.sandGrains;

      h += detail + ripples + ripples2 + grains;

      // Occasional flat pans (subtle on moon)
      const flat = this.baseNoise.noise(x * this.config.noiseScale.flat + 500, z * this.config.noiseScale.flat + 500);
      if (flat > 0.7) h *= 0.7;

      // Edge blend
      if (dist > edgeFadeStart) {
        const t = 1 - Math.min(1, (dist - edgeFadeStart) / (edgeFadeEnd - edgeFadeStart));
        h *= t;
      }

      v[i + 1] = h;

      // --- Vertex color (moon-white palette) ---
      const cNoise = this.colorNoise.noise(x * this.config.noiseScale.base * 2, z * this.config.noiseScale.base * 2);
      const hf = Math.max(0, Math.min(1, (h + 1.5) / 6.0));

      let col = this.config.sandColors[0].clone(); // base
      if (hf < 0.5) col.lerp(this.config.sandColors[1], 0.5 - hf);        // valley shadows
      if (hf > 0.5) col.lerp(this.config.sandColors[2], (hf - 0.5) * 2);  // peaks
      if (cNoise > 0) col.lerp(this.config.sandColors[4], cNoise * 0.25);
      else            col.lerp(this.config.sandColors[3], -cNoise * 0.25);

      // Haze
      if (this.config.distanceBlur.atmosphericHaze && dist > this.config.distanceBlur.hazeStartDistance) {
        const df = Math.min(1, (dist - this.config.distanceBlur.hazeStartDistance) /
                                (this.config.distanceBlur.endDistance - this.config.distanceBlur.hazeStartDistance));
        const hf2 = Math.min(1, h / (this.config.heightScale.dunes * 0.9));
        const haze = df * hf2 * this.config.distanceBlur.hazeFactor;
        col.lerp(this.config.distanceBlur.skyboxColor, haze);
      }
      if (this.config.distanceBlur.enabled && dist > this.config.distanceBlur.startDistance) {
        const blur = Math.min(1, (dist - this.config.distanceBlur.startDistance) /
                                 (this.config.distanceBlur.endDistance - this.config.distanceBlur.startDistance));
        col.lerp(this.config.distanceBlur.skyboxColor, blur);
        v[i + 1] += heightAtEdge * (blur * blur);
      }

      colors[i] = col.r; colors[i + 1] = col.g; colors[i + 2] = col.b;
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 0,
      specular: new THREE.Color(0x000000),
      normalMap: normalMapTexture,
      normalScale: new THREE.Vector2(0.8, 0.8),
      // If you want to use the generated roughness as an Ao/roughness hint, swap to a StandardMaterial.
      // Here we keep Phong + vertex colors for speed.
      fog: true
    });
    mat.envMap = null;

    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.position.set(0, -0.05, 0);

    this.terrainMesh = mesh;
    this.scene.add(mesh);
    return mesh;
  }

  // Procedural normal map (moon ripples)
  createSandNormalMap() {
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    const strength = 28;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size, ny = y / size;
        const d = this.config.duneDirection;
        const ax = nx * Math.cos(d) + ny * Math.sin(d);
        const ay = -nx * Math.sin(d) + ny * Math.cos(d);

        const rip = this.microRipplesNoise.noise(ax * 25, ay * 8) * 1.3;
        const fine = this.sandGrainsNoise.noise(nx * 180, ny * 180) * 0.2;
        const med  = this.detailNoise.noise(nx * 30, ny * 30) * 0.35;

        const h = rip * 0.8 + fine * 0.3 + med * 0.2;

        // finite differences
        const hL = this.microRipplesNoise.noise((ax - 1/size) * 25, ay * 8) * 1.3;
        const hR = this.microRipplesNoise.noise((ax + 1/size) * 25, ay * 8) * 1.3;
        const hU = this.microRipplesNoise.noise(ax * 25, (ay - 1/size) * 8) * 1.3;
        const hD = this.microRipplesNoise.noise(ax * 25, (ay + 1/size) * 8) * 1.3;

        const idx = (y * size + x) * 4;
        data[idx]     = Math.min(255, Math.max(0, 128 + strength * (hR - hL)));
        data[idx + 1] = Math.min(255, Math.max(0, 128 + strength * (hD - hU)));
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.needsUpdate = true;
    return tex;
  }

  // Procedural roughness map (high roughness, subtle variation)
  createSandRoughnessMap() {
    const size = 256;
    const data = new Uint8Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size, ny = y / size;
        const d = this.config.duneDirection;
        const ax = nx * Math.cos(d) + ny * Math.sin(d);
        const ay = -nx * Math.sin(d) + ny * Math.cos(d);

        const wind = this.microRipplesNoise.noise(ax * 20, ay * 6);
        const grains = this.sandGrainsNoise.noise(nx * 250, ny * 250) * 5;
        const value = Math.min(255, Math.max(230, 242 + (wind < 0 ? 8 : -4) + grains));
        data[y * size + x] = value;
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.needsUpdate = true;
    return tex;
  }
}