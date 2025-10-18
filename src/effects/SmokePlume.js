// src/effects/SmokePlume.js
import * as THREE from 'three';

export class SmokePlume {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} opts
   * @param {Function} opts.getAnchor   -> THREE.Vector3 (flame centroid in world/local of same parent)
   * @param {number}   [opts.count=1800]
   */
  constructor(scene, { getAnchor, count = 1800 } = {}) {
    this.scene = scene;
    this.getAnchor = typeof getAnchor === 'function' ? getAnchor : (() => new THREE.Vector3());
    this.count = count;

    // CPU state (kept lightweight)
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.lif = new Float32Array(this.count);
    this.age = new Float32Array(this.count);
    this.alive = new Uint8Array(this.count); // 0/1

    // Geometry (unit quad)
    const plane = new THREE.PlaneGeometry(1, 1);
    // Custom shader for camera-facing billboard + lifetime fade
    this.material = this._makeMaterial();

    // Instanced geometry so we can supply per-instance attributes to shader
    const ig = new THREE.InstancedBufferGeometry().copy(plane);
    // Per-instance attributes
    ig.instanceCount = this.count;
    ig.setAttribute('iOffset',    new THREE.InstancedBufferAttribute(new Float32Array(this.count * 3), 3));
    ig.setAttribute('iScaleLife', new THREE.InstancedBufferAttribute(new Float32Array(this.count * 2), 2));
    ig.setAttribute('iSeed',      new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1));

    this.mesh = new THREE.Mesh(ig, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'SmokePlume';
    scene.add(this.mesh);

    // Emission control
    this.emitting = false;
    this.emissionRate = 1200; // particles per second (approximate)
    this._emitAccumulator = 0;

    // Scratch
    this._tmpV = new THREE.Vector3();
  }

  ignite() { this.emitting = true; }
  stop()   { this.emitting = false; }

  dispose(){
    this.mesh.geometry.dispose();
    this.material.uniforms.uTex.value?.dispose?.();
    this.material.dispose?.();
    this.mesh.removeFromParent?.();
  }

  /** Update each frame. Call from your animate loop.
   * @param {number} dt    seconds
   * @param {number} t     seconds
   * @param {THREE.Camera} camera
   */
  update(dt, t, camera){
    if (!dt) return;

    // Update camera right/up for billboarding
    if (camera) {
      const m = camera.matrixWorld;
      // columns: X=0..2, Y=4..6, Z=8..10
      this.material.uniforms.uCamRight.value.set(m.elements[0], m.elements[1], m.elements[2]);
      this.material.uniforms.uCamUp.value.set   (m.elements[4], m.elements[5], m.elements[6]);
    }
    this.material.uniforms.uTime.value = t;

    // Spawn
    if (this.emitting) {
      this._emitAccumulator += dt * this.emissionRate;
      let toEmit = Math.floor(this._emitAccumulator);
      this._emitAccumulator -= toEmit;
      while (toEmit-- > 0) this._spawnOne();
    }

    // Sim + write instance attributes
    const offs   = this.mesh.geometry.getAttribute('iOffset');
    const sclife = this.mesh.geometry.getAttribute('iScaleLife');

    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;

      // Forces: buoyancy + mild lateral dispersion + tiny gravity counter
      this.vel[i*3+1] += dt * 0.35;                            // buoyancy
      this.vel[i*3+0] += dt * 0.10 * Math.sin(this.age[i]*1.7 + i*0.13);
      this.vel[i*3+2] += dt * 0.10 * Math.cos(this.age[i]*1.4 + i*0.19);

      // Integrate
      this.pos[i*3+0] += this.vel[i*3+0] * dt;
      this.pos[i*3+1] += this.vel[i*3+1] * dt;
      this.pos[i*3+2] += this.vel[i*3+2] * dt;

      this.age[i] += dt;
      if (this.age[i] >= this.lif[i]) {
        this.alive[i] = 0;
        // collapse the instance (scale 0)
        offs.setXYZ(i, 0, -9999, 0);
        sclife.setXY(i, 0, 0);
        continue;
      }

      // Scale grows with age; larger survivor puffs
      const life01 = this.age[i] / this.lif[i];
      const scale = this._mix(2.2, 14.0, Math.pow(life01, 0.8)); // 2.2m → 14m
      offs.setXYZ(i, this.pos[i*3+0], this.pos[i*3+1], this.pos[i*3+2]);
      sclife.setXY(i, scale, life01);
    }

    offs.needsUpdate = true;
    sclife.needsUpdate = true;
  }

  /* ---------------- internals ---------------- */

  _spawnOne(){
    // Find a dead slot
    let idx = -1;
    for (let i = 0; i < this.count; i++) { if (!this.alive[i]) { idx = i; break; } }
    if (idx < 0) return;

    const anchor = this.getAnchor(); // world/local of same parent
    // Spread across pit mouth (wide cone)
    const r = 5 + Math.random()*6; // meters radius
    const a = Math.random() * Math.PI * 2;
    const ox = Math.cos(a) * r;
    const oz = Math.sin(a) * r;

    this.pos[idx*3+0] = anchor.x + ox;
    this.pos[idx*3+1] = anchor.y + 0.8 + Math.random()*0.6; // slightly above floor
    this.pos[idx*3+2] = anchor.z + oz;

    // Initial kick mostly horizontal, then buoyancy lifts it
    this.vel[idx*3+0] = (Math.random()-0.5) * 2.2;
    this.vel[idx*3+1] = 0.5 + Math.random()*0.6;
    this.vel[idx*3+2] = (Math.random()-0.5) * 2.2;

    this.lif[idx] = 5.5 + Math.random()*4.0;
    this.age[idx] = 0;
    this.alive[idx] = 1;

    // Seed attribute (used for slight per-instance noise in shader)
    const seed = this.mesh.geometry.getAttribute('iSeed');
    seed.setX(idx, Math.random());
    seed.needsUpdate = true;
  }

  _makeMaterial(){
    const tex = makeSmokeTexture(256);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // softer, more “smoke” than additive
      uniforms: {
        uTex: { value: tex },
        uTime: { value: 0 },
        uCamRight: { value: new THREE.Vector3(1,0,0) },
        uCamUp:    { value: new THREE.Vector3(0,1,0) },
      },
      vertexShader: /* glsl */`
        attribute vec3 iOffset;
        attribute vec2 iScaleLife; // x = scale, y = life01
        attribute float iSeed;
        uniform vec3 uCamRight;
        uniform vec3 uCamUp;
        varying float vLife;
        varying float vSeed;
        void main(){
          vLife = iScaleLife.y;
          vSeed = iSeed;

          // Quad corners in camera billboard space
          vec3 right = normalize(uCamRight);
          vec3 up    = normalize(uCamUp);

          vec3 center = iOffset;

          // Slight "curl" wobble (vertex-level) for softness
          float wob  = sin((vSeed*37.0 + vLife*6.0) + position.x*2.0 + position.y*2.0) * 0.15;
          float s = iScaleLife.x * (1.0 + wob*0.06);

          // position.xy are the unit quad corners (-0.5..0.5)
          vec3 worldPos = center + (right * position.x + up * position.y) * s;

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying float vLife;
        varying float vSeed;
        void main(){
          vec2 uv = gl_PointCoord; // not used; we use plane uv
          // Our geometry already carries uv from PlaneGeometry
          vec2 tuv = vec2(uv.x, uv.y); // placeholder
          // Use built-in varying 'uv' from geometry
          #ifdef GL_OES_standard_derivatives
          #extension GL_OES_standard_derivatives : enable
          #endif
          vec4 tex = texture2D(uTex, vec2(gl_FrontFacing ? uv.x : 1.0-uv.x, uv.y));

          // Lifetime fade in/out (soft)
          float a = smoothstep(0.02, 0.15, vLife) * (1.0 - smoothstep(0.65, 1.0, vLife));

          // Slight greying over life
          vec3 col = mix(vec3(1.0), vec3(0.82,0.84,0.86), clamp(vLife*1.1, 0.0, 1.0));

          gl_FragColor = vec4(col, tex.a * 0.55 * a);
          if (gl_FragColor.a < 0.02) discard;
        }
      `
    });
  }

  _mix(a,b,t){ return a*(1.0-t)+b*t; }
}

/* -------- helpers --------- */
function makeSmokeTexture(size=256){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // soft round puff
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.60, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,size,size);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}