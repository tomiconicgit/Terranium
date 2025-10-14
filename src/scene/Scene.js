// Scene.js — uneven sand + mountain ring + shadowed lights + terrain API
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor(renderer) {
    super();

    this.background = new THREE.Color(0x87CEEB);

    /* ---------- Lights ---------- */
    this.add(new THREE.AmbientLight(0xffffff, 0.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(120, 180, -90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 600;
    const s = 180;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    this.add(sun);
    this.add(new THREE.DirectionalLight(0xffffff, 0.25).position.set(-80, 120, 80));
    this.add(new THREE.HemisphereLight(0xdfeaff, 0x9a7c55, 0.5).position.set(0, 120, 0));

    /* ---------- Terrain ---------- */
    this.halfSize = 140; this.segments = 192;
    this.cell = (this.halfSize * 2) / this.segments;

    const geo = new THREE.PlaneGeometry(this.halfSize * 2, this.halfSize * 2, this.segments, this.segments);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
      const ramp = smoothstep(70.0, 100.0, r);
      const amp = THREE.MathUtils.lerp(0.9, 12.0, ramp);
      const h = fbm2(x*0.06, y*0.06, 4)*amp + fbm2(x*0.18, y*0.18, 2)*(amp*0.15);
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();

    const mat = createSandMaterial();
    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.name = 'terrainPlane';
    terrain.receiveShadow = true;
    this.terrain = terrain;
    this.add(terrain);

    this._v3a = new THREE.Vector3();
  }

  update() {}

  getTerrainHeightAt(wx, wz) {
    const mesh = this.terrain, geo = mesh.geometry, pos = geo.attributes.position;
    const pLocal = this._v3a.set(wx, 0, wz); mesh.worldToLocal(pLocal);
    const x = pLocal.x, y = pLocal.y;
    const half = this.halfSize;
    if (x < -half || x > half || y < -half || y > half) return 0;
    const sx = (x + half) / this.cell, sy = (y + half) / this.cell;
    const i0 = Math.floor(sx), j0 = Math.floor(sy);
    const i1 = Math.min(i0 + 1, this.segments), j1 = Math.min(j0 + 1, this.segments);
    const tx = sx - i0, ty = sy - j0;
    const idx = (ii, jj) => jj * (this.segments + 1) + ii;
    const z00 = pos.getZ(idx(i0,j0)), z10 = pos.getZ(idx(i1,j0));
    const z01 = pos.getZ(idx(i0,j1)), z11 = pos.getZ(idx(i1,j1));
    const z0 = THREE.MathUtils.lerp(z00, z10, tx);
    const z1 = THREE.MathUtils.lerp(z01, z11, tx);
    return THREE.MathUtils.lerp(z0, z1, ty);
  }

  pressSand(centerWorld, bottomY, innerR, outerR, extraPress = 0.06) {
    const mesh = this.terrain, geo = mesh.geometry, pos = geo.attributes.position;
    const c = this._v3a.copy(centerWorld); c.y = 0; mesh.worldToLocal(c);
    const targetZ = bottomY - extraPress;
    for (let j = 0; j <= this.segments; j++) {
      for (let i = 0; i <= this.segments; i++) {
        const idx = j * (this.segments + 1) + i;
        const vx = pos.getX(idx), vy = pos.getY(idx), vz = pos.getZ(idx);
        const r = Math.hypot(vx - c.x, vy - c.y);
        if (r > outerR) continue;
        let newZ = vz;
        if (r <= innerR) { newZ = Math.min(vz, targetZ); }
        else {
          const w = 1.0 - smoothstep(0, 1, (r - innerR) / (outerR - innerR));
          newZ = lerp(vz, Math.min(vz, targetZ), w);
        }
        pos.setZ(idx, newZ);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.boundingSphere = null;
  }
}

function createSandMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xead3a3, roughness: 0.9, metalness: 0.0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vWorldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWorldPosition = worldPosition.xyz;'
    );
    shader.fragmentShader = `
      varying vec3 vWorldPosition;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(37.4, 66.8))) * 43758.5); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float n = noise(vWorldPosition.xz * 0.2);
      vec3 sand_dark = vec3(0.9, 0.8, 0.6);
      vec3 sand_light = vec3(1.0, 0.95, 0.8);
      diffuseColor.rgb *= mix(sand_dark, sand_light, n);`
    );
  };
  return mat;
}

function fbm2(x,y,o){let a=0.5,f=1,s=0;for(let i=0;i<o;i++){s+=a*valueNoise2(x*f,y*f);f*=2;a*=0.5}return s}function valueNoise2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const s=hash2(xi,yi),t=hash2(xi+1,yi),u=hash2(xi,yi+1),v=hash2(xi+1,yi+1),sx=fade(xf),sy=fade(yf);const a=lerp(s,t,sx),b=lerp(u,v,sx);return lerp(a,b,sy)*2-1}function hash2(x,y){let n=x*374761393+y*668265263;n=(n^(n>>13))*1274126177;return((n^(n>>16))>>>0)/4294967295}const lerp=(a,b,t)=>a+(b-a)*t;const fade=t=>t*t*(3-2*t);function smoothstep(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)}
