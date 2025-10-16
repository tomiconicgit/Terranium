// src/effects/EngineFX.js
// Auto-scales to rocket size and exposes wide-range controls for flames & smoke.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  /**
   * @param {THREE.Object3D} rocketRoot
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{rings?: '33'|'basic'}} [opts]
   */
  constructor(rocketRoot, scene, camera, opts = {}) {
    this.rocket = rocketRoot;
    this.scene = scene;
    this.camera = camera;
    this.opts = { rings: '33', ...opts };

    // Measure model
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.center = new THREE.Vector3(); box.getCenter(this.center);
    this.bottomY = box.min.y;

    // If model is ~15x15 on your terrain, this keeps proportions sane
    const halfDia = 0.5 * Math.max(this.size.x, this.size.z);

    // Engine ring radii
    this.R_outer = halfDia * 0.90;
    this.R_middle = this.R_outer * 0.70;
    this.R_inner  = this.R_outer * 0.35;

    // Base positions/sizes (these are multiplied by user factors)
    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameWidthBase  = this.R_outer * 0.40;   // wider base than before
    this.flameHeightBase = this.R_outer * 5.00;   // MUCH longer flames baseline
    this.smokeSizeBase   = Math.max(20, this.R_outer * 18.0); // bigger baseline puff size

    // User-tweakable params (very wide ranges supported in UI)
    this.params = {
      enginesOn: false,

      // Scales
      flameWidthFactor:  1.0,   // 0.01 … 50 in UI
      flameHeightFactor: 1.0,   // 0.01 … 80 in UI
      smokeSizeFactor:   1.0,   // 0.1  … 50 in UI

      // Local Y micro offsets
      flameYOffset: 0.0,        // -200 … 200 in UI
      smokeYOffset: 0.0,        // -200 … 400 in UI

      // Whole FX group offsets (to align under rocket)
      groupOffsetX: 0.0,        // -50 … 50 in UI
      groupOffsetY: 0.0,        // -200 … 400 in UI
      groupOffsetZ: 0.0         // -50 … 50 in UI
    };

    // ---- Build engine emitters (positions) ----
    const rings = (this.opts.rings === '33')
      ? [
          { r: this.R_inner,  n: 3  },
          { r: this.R_middle, n: 10 },
          { r: this.R_outer,  n: 20 }
        ]
      : [
          { r: this.R_inner,  n: 9  },
          { r: this.R_outer,  n: 24 }
        ];

    this.enginePoints = [];
    for (const { r, n } of rings) {
      this.enginePoints.push(...this._ring(r, n).map(p => new THREE.Vector3(p.x, this.emitYBase, p.y)));
    }

    // ---- Flames (instanced quads + shader) ----
    const flameGeo = new THREE.PlaneGeometry(1, 4);
    const flameMat = this._makeFlameMaterial();
    this.flames = new THREE.InstancedMesh(flameGeo, flameMat, this.enginePoints.length);
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const seedColor = new THREE.Color();
    const tmp = new THREE.Object3D();
    for (let i = 0; i < this.enginePoints.length; i++) {
      tmp.position.copy(this.enginePoints[i]);
      tmp.scale.set(this.flameWidthBase, this.flameHeightBase, 1.0);
      tmp.updateMatrix();
      this.flames.setMatrixAt(i, tmp.matrix);
      // store random seed in instance color r channel
      seedColor.setRGB(Math.random(), 0, 0);
      this.flames.setColorAt(i, seedColor);
    }
    this.flames.frustumCulled = false;

    // Billboard around Y each frame (faces camera yaw)
    this.flames.onBeforeRender = () => {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const look = new THREE.Vector3();
      const obj = new THREE.Object3D();
      for (let i = 0; i < this.enginePoints.length; i++) {
        this.flames.getMatrixAt(i, m);
        m.decompose(obj.position, obj.quaternion, obj.scale);
        look.copy(this.camera.position).sub(obj.position);
        const yaw = Math.atan2(look.x, look.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        obj.quaternion.copy(q);
        obj.updateMatrix();
        this.flames.setMatrixAt(i, obj.matrix);
      }
      this.flames.instanceMatrix.needsUpdate = true;
    };

    // ---- Ground smoke (points + shader) ----
    const smokeCount = Math.floor(1000 + (this.R_outer * this.R_outer) * 140); // more density
    const smokeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(smokeCount * 3);
    const ages = new Float32Array(smokeCount);
    const seeds = new Float32Array(smokeCount);
    const minR = this.R_middle * 0.9;
    const maxR = this.R_outer  * 1.1;

    for (let i = 0; i < smokeCount; i++) {
      const r = THREE.MathUtils.lerp(minR, maxR, Math.random());
      const a = Math.random() * Math.PI * 2;
      positions[i*3+0] = Math.cos(a) * r;
      positions[i*3+2] = Math.sin(a) * r;
      positions[i*3+1] = this.bottomY + 0.02 * this.size.y;
      ages[i]  = Math.random();
      seeds[i] = Math.random() * 1000.0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
    smokeGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.smoke = new THREE.Points(smokeGeo, this._makeSmokeMaterial(this.smokeSizeBase));
    this.smoke.frustumCulled = false;

    // Group under rocket so FX follow later; we can offset this group
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);
    rocketRoot.add(this.group);
    this.group.add(this.flames);
    this.group.add(this.smoke);

    this._applyVisibility();
    this._applyTransforms(); // apply initial factors
  }

  // === Public API for UI ===
  setIgnition(on) { this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition()   { return this.params.enginesOn; }

  setParams(patch) {
    Object.assign(this.params, patch);
    this._applyTransforms();
  }

  getParams() {
    return {
      enginesOn: this.params.enginesOn,
      flameWidthFactor:  this.params.flameWidthFactor,
      flameHeightFactor: this.params.flameHeightFactor,
      flameYOffset:      this.params.flameYOffset,
      smokeSizeFactor:   this.params.smokeSizeFactor,
      smokeYOffset:      this.params.smokeYOffset,
      groupOffsetX:      this.params.groupOffsetX,
      groupOffsetY:      this.params.groupOffsetY,
      groupOffsetZ:      this.params.groupOffsetZ,
      // Derived (absolute) values for copy/paste
      absolute: {
        flameWidth:  this.flameWidthBase  * this.params.flameWidthFactor,
        flameHeight: this.flameHeightBase * this.params.flameHeightFactor,
        flameY:      this.emitYBase + this.params.flameYOffset + this.params.groupOffsetY,
        smokeSize:   this.smokeSizeBase * this.params.smokeSizeFactor,
        smokeY:      (this.bottomY + 0.02 * this.size.y) + this.params.smokeYOffset + this.params.groupOffsetY,
        groupOffset: { x: this.params.groupOffsetX, y: this.params.groupOffsetY, z: this.params.groupOffsetZ }
      }
    };
  }

  update(dt, time) {
    if (this.flames?.material?.uniforms) {
      this.flames.material.uniforms.uTime.value = time;
    }
    if (this.smoke?.material?.uniforms) {
      this.smoke.material.uniforms.uTime.value = time;
    }
  }

  // === Internals ===
  _applyVisibility() {
    const vis = !!this.params.enginesOn;
    if (this.flames) this.flames.visible = vis;
    if (this.smoke)  this.smoke.visible  = vis;
  }

  _applyTransforms() {
    // Move entire FX block
    if (this.group) {
      this.group.position.set(this.params.groupOffsetX, this.params.groupOffsetY, this.params.groupOffsetZ);
    }

    // Update flames instance transforms (scale & local Y offset)
    if (this.flames) {
      const m = new THREE.Matrix4();
      const obj = new THREE.Object3D();
      const w = this.flameWidthBase  * this.params.flameWidthFactor;
      const h = this.flameHeightBase * this.params.flameHeightFactor;
      const y = this.emitYBase + this.params.flameYOffset;

      for (let i = 0; i < this.enginePoints.length; i++) {
        const p = this.enginePoints[i];
        obj.position.set(p.x, y, p.z);
        obj.scale.set(w, h, 1.0);
        obj.rotation.set(0, 0, 0);
        obj.updateMatrix();
        this.flames.setMatrixAt(i, obj.matrix);
      }
      this.flames.instanceMatrix.needsUpdate = true;
    }

    // Smoke size + local Y offset (group Y already applied above)
    if (this.smoke) {
      this.smoke.material.uniforms.uSize.value = this.smokeSizeBase * this.params.smokeSizeFactor;
      this.smoke.position.y = this.params.smokeYOffset; // local (within group)
    }
  }

  _ring(radius, count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      pts.push({ x: Math.cos(t) * radius, y: Math.sin(t) * radius });
    }
    return pts;
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xfff0c0) },
        uColor2: { value: new THREE.Color(0xff7a00) },
        uColor3: { value: new THREE.Color(0x6d3a00) },
        uNoiseAmp: { value: 0.7 },
        uFlicker:  { value: 3.0 },
      },
      vertexShader: /* glsl */`
        attribute vec3 color;   // instanceColor.r as seed
        varying float vSeed;
        varying vec2 vUv2;
        void main() {
          vSeed = color.r;
          vUv2 = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying float vSeed;
        varying vec2 vUv2;
        uniform float uTime;
        uniform vec3 uColor1, uColor2, uColor3;
        uniform float uNoiseAmp, uFlicker;

        float hash(vec2 p){ p=50.0*fract(p*0.3183099); return fract(p.x*p.y*(p.x+p.y)); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p);
          float a=hash(i), b=hash(i+vec2(1.0,0.0));
          float c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }

        void main(){
          float t = uTime * (1.6 + vSeed*0.6);
          float n = noise(vec2(vUv2.x*3.0 + vSeed*10.0, vUv2.y*7.0 - t)) * uNoiseAmp;

          float center = abs(vUv2.x - 0.5) * (1.0 + n*0.6);
          float width  = mix(0.35, 0.10, vUv2.y);
          float mask   = smoothstep(width, width-0.05, center);

          float flick = 0.75 + 0.25 * sin(t * uFlicker + vSeed*6.283);
          float fade  = smoothstep(0.0, 0.15, vUv2.y) * (1.0 - smoothstep(0.75, 1.0, vUv2.y));
          float alpha = mask * fade * flick;

          vec3 col = mix(uColor2, uColor1, smoothstep(0.0, 0.25, vUv2.y));
          col = mix(uColor3, col, smoothstep(0.25, 0.9, vUv2.y));

          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  _makeSmokeMaterial(pixelSize) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x808080) },
        uRise:  { value: 3.6 },
        uLife:  { value: 3.2 },
        uSize:  { value: pixelSize },
        uSoft:  { value: 0.8 }
      },
      vertexShader: /* glsl */`
        precision highp float;
        uniform float uTime, uRise, uLife, uSize;
        attribute float aAge, aSeed;
        varying float vAlpha;

        void main(){
          float t = fract(aAge + uTime / uLife);

          vec3 pos = position;
          float wob = sin(aSeed + t*6.283)*0.45;
          float ang = aSeed * 0.01 + t * 6.283 * 0.18;
          pos.x += wob * 0.9 * sin(ang);
          pos.z += wob * 0.9 * cos(ang);
          pos.y += t * uRise + (sin(aSeed*3.1 + t*12.0) * 0.25);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (uSize * (0.8 + t*1.4)) / -mv.z;

          vAlpha = smoothstep(0.02, 0.25, t) * (1.0 - smoothstep(0.65, 1.0, t));
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColor;
        uniform float uSoft;
        varying float vAlpha;

        void main(){
          vec2 uv = gl_PointCoord;
          float a = smoothstep(1.0, 0.0, length(uv*2.0-1.0));
          a = pow(a, 1.0 + uSoft*1.2);
          gl_FragColor = vec4(uColor, a * vAlpha);
        }
      `
    });
  }
}