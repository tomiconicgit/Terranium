// src/effects/EngineFX.js
// Scales automatically to the rocket's size (fits SuperHeavy bells)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  /**
   * @param {THREE.Object3D} rocketRoot
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{rings?: '33'|'basic'}} [opts]  rings='33' uses 3/10/20 layout
   */
  constructor(rocketRoot, scene, camera, opts = {}) {
    this.rocket = rocketRoot;
    this.scene = scene;
    this.camera = camera;
    this.opts = { rings: '33', ...opts };

    // --- Measure the model ---
    const box = new THREE.Box3().setFromObject(rocketRoot);
    const size = new THREE.Vector3(); box.getSize(size);
    const bottomY = box.min.y;

    // Half diameter in XZ (use larger axis to be safe)
    const halfDia = 0.5 * Math.max(size.x, size.z);

    // --- Fit ring radii to rocket footprint ---
    // Outer ring ~ just inside the bell circle; middle & inner relative to that.
    const R_outer = halfDia * 0.88;   // near rim
    const R_middle = R_outer * 0.70;  // mid ring
    const R_inner  = R_outer * 0.35;  // core

    // Vertical emit height (just inside/under bells)
    const emitY = bottomY + Math.max(0.02 * size.y, 0.1);

    // Flame scale relative to rocket
    const flameWidth  = R_outer * 0.20;   // wide column
    const flameHeight = R_outer * 1.80;   // long jet

    // Smoke parameters scale with area
    const smokeBaseCount = Math.floor(400 + (R_outer * R_outer) * 80);
    const smokeSize = Math.max(28, R_outer * 5.5);  // pixel size per point

    // ---- Build engine emitter points ----
    const rings = (this.opts.rings === '33')
      ? [
          { r: R_inner,  n: 3   },  // center triangle (approx)
          { r: R_middle, n: 10  },
          { r: R_outer,  n: 20  }
        ]
      : [
          { r: R_inner,  n: 9   },
          { r: R_outer,  n: 24  }
        ];

    this.enginePoints = [];
    for (const { r, n } of rings) {
      this.enginePoints.push(...this._ring(r, n).map(p => new THREE.Vector3(p.x, emitY, p.y)));
    }

    // ---- FLAMES (instanced quads) ----
    const flameGeo = new THREE.PlaneGeometry(1, 4);
    const flameMat = this._makeFlameMaterial();
    this.flames = new THREE.InstancedMesh(flameGeo, flameMat, this.enginePoints.length);
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tmp = new THREE.Object3D();
    for (let i = 0; i < this.enginePoints.length; i++) {
      tmp.position.copy(this.enginePoints[i]);
      tmp.scale.set(flameWidth, flameHeight, 1.0);
      tmp.updateMatrix();
      this.flames.setMatrixAt(i, tmp.matrix);
      this.flames.setColorAt(i, new THREE.Color(Math.random(), 0, 0)); // seed in .r
    }
    this.flames.frustumCulled = false;

    // Y-axis billboard so quads always face the camera
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

    // ---- GROUND SMOKE (points) ----
    const smokeCount = smokeBaseCount;
    const smokeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(smokeCount * 3);
    const ages = new Float32Array(smokeCount);
    const seeds = new Float32Array(smokeCount);

    // Emit over a donut between middle & outer ring
    const minR = R_middle * 0.9;
    const maxR = R_outer  * 1.05;

    for (let i = 0; i < smokeCount; i++) {
      const r = THREE.MathUtils.lerp(minR, maxR, Math.random());
      const a = Math.random() * Math.PI * 2;
      positions[i*3+0] = Math.cos(a) * r;
      positions[i*3+2] = Math.sin(a) * r;
      positions[i*3+1] = bottomY + 0.02 * size.y; // ground near bottom
      ages[i]  = Math.random();
      seeds[i] = Math.random() * 1000.0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
    smokeGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.smoke = new THREE.Points(smokeGeo, this._makeSmokeMaterial(smokeSize));
    this.smoke.frustumCulled = false;

    // Attach under rocket so FX follow later if you animate
    this.group = new THREE.Group();
    rocketRoot.add(this.group);
    this.group.add(this.flames);
    this.group.add(this.smoke);

    this.time = 0;
    this.engineOn = false;
    this._applyVisibility();
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
        uColor1: { value: new THREE.Color(0xfff0c0) }, // hot core
        uColor2: { value: new THREE.Color(0xff7a00) }, // mid
        uColor3: { value: new THREE.Color(0x6d3a00) }, // outer
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
        uRise:  { value: 3.6 },   // faster plume rise for scale
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

  update(dt, time) {
    if (this.flames?.material?.uniforms) {
      this.flames.material.uniforms.uTime.value = time;
    }
    if (this.smoke?.material?.uniforms) {
      this.smoke.material.uniforms.uTime.value = time;
    }
  }

  setEngines(on) {
    this.engineOn = !!on;
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this.flames) this.flames.visible = this.engineOn;
    if (this.smoke)  this.smoke.visible  = this.engineOn;
  }
}