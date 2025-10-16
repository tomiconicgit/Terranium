// src/effects/EngineFX.js
// Jet-like single plume, no smoke. Lightweight and scalable for giant rockets.
// Adds mid-plume bulge and color mixing (blue/orange/white) uniforms.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  /**
   * @param {THREE.Object3D} rocketRoot
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene = scene;
    this.camera = camera;

    // --- Measure rocket to derive sensible baselines ---
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;

    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    // Baselines (you will scale these via sliders)
    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameWidthBase  = clusterRadius * 1.4;   // meters of billboard width
    this.flameHeightBase = clusterRadius * 7.0;   // meters of billboard height

    // Public, UI-tweakable params
    this.params = {
      enginesOn: false,

      flameWidthFactor:  1.0,
      flameHeightFactor: 1.0,
      flameYOffset:      0.0,

      intensity:         1.0,
      taper:             0.55,
      turbulence:        0.35,
      noiseSpeed:        1.6,

      diamondsStrength:  0.35,
      diamondsFreq:      14.0,

      bulge:             0.0,   // NEW: mid-plume bulge amount (0..2)

      colorBlue:         1.0,   // NEW: color mix weights
      colorOrange:       1.0,
      colorWhite:        1.0,

      groupOffsetX: 0.0,
      groupOffsetY: 0.0,
      groupOffsetZ: 0.0
    };

    // Group parented to rocket
    this.group = new THREE.Group();
    rocketRoot.add(this.group);

    // Flame billboard (single quad)
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const mat = this._makeFlameMaterial();
    this.flame = new THREE.Mesh(geo, mat);
    this.flame.frustumCulled = false;
    this.group.add(this.flame);

    // Face camera around Y (cheap billboard)
    this.flame.onBeforeRender = () => {
      const p = new THREE.Vector3(); this.group.getWorldPosition(p);
      const c = this.camera.position;
      const yaw = Math.atan2(c.x - p.x, c.z - p.z);
      this.flame.rotation.set(0, yaw, 0);
    };

    // Initial states
    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // === Public API used by EnginePanel ===
  setIgnition(on) { this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition()   { return this.params.enginesOn; }

  setParams(patch) {
    Object.assign(this.params, patch);
    this._applyTransforms();
    this._applyUniforms();
  }

  getParams() {
    return {
      ...this.params,
      absolute: {
        flameWidth:  this.flameWidthBase  * this.params.flameWidthFactor,
        flameHeight: this.flameHeightBase * this.params.flameHeightFactor,
        flameY:      this.emitYBase + this.params.flameYOffset + this.params.groupOffsetY
      }
    };
  }

  update(dt, t) {
    const u = this.flame.material.uniforms;
    u.uTime.value = t;
  }

  // === Internals ===
  _applyVisibility() {
    if (this.flame) this.flame.visible = !!this.params.enginesOn;
  }

  _applyTransforms() {
    this.group.position.set(this.params.groupOffsetX, this.params.groupOffsetY, this.params.groupOffsetZ);

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;
    this.flame.scale.set(w, h, 1);
    this.flame.position.set(0, this.emitYBase + this.params.flameYOffset + h * 0.02, 0);
  }

  _applyUniforms() {
    const u = this.flame.material.uniforms;
    u.uIntensity.value  = this.params.intensity;
    u.uTaper.value      = this.params.taper;
    u.uTurbulence.value = this.params.turbulence;
    u.uNoiseSpeed.value = this.params.noiseSpeed;
    u.uDiamondsStrength.value = this.params.diamondsStrength;
    u.uDiamondsFreq.value     = this.params.diamondsFreq;

    u.uBulge.value = this.params.bulge;

    u.uMixBlue.value   = this.params.colorBlue;
    u.uMixOrange.value = this.params.colorOrange;
    u.uMixWhite.value  = this.params.colorWhite;
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime:   { value: 0 },
        uIntensity: { value: 1.0 },
        uTaper:     { value: 0.55 },
        uTurbulence:{ value: 0.35 },
        uNoiseSpeed:{ value: 1.6 },
        uDiamondsStrength: { value: 0.35 },
        uDiamondsFreq:     { value: 14.0 },

        uBulge: { value: 0.0 },        // NEW

        uMixBlue:   { value: 1.0 },    // NEW
        uMixOrange: { value: 1.0 },
        uMixWhite:  { value: 1.0 },

        // base swatches for mix
        uBlueColor:   { value: new THREE.Color(0x66aaff) },
        uOrangeColor: { value: new THREE.Color(0xffa53a) },
        uWhiteColor:  { value: new THREE.Color(0xfff9e6) }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv; // x across, y along plume (0 at base, 1 at tip)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;
        varying vec2 vUv;

        uniform float uTime;
        uniform float uIntensity;
        uniform float uTaper;
        uniform float uTurbulence;
        uniform float uNoiseSpeed;
        uniform float uDiamondsStrength;
        uniform float uDiamondsFreq;

        uniform float uBulge;

        uniform float uMixBlue;
        uniform float uMixOrange;
        uniform float uMixWhite;
        uniform vec3  uBlueColor;
        uniform vec3  uOrangeColor;
        uniform vec3  uWhiteColor;

        // ultra-cheap pseudo noise (no texture)
        float n2(vec2 p){
          return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
        }
        float fbm(vec2 p){
          float a = 0.0;
          float w = 0.5;
          for(int i=0;i<4;i++){
            a += w * n2(p);
            p = p*2.03 + 1.7;
            w *= 0.5;
          }
          return a;
        }

        void main() {
          float y = clamp(vUv.y, 0.0, 1.0);

          // Width profile: base taper...
          float width = mix(0.48, 0.08, clamp(uTaper, 0.0, 1.0));
          width = mix(width, 0.12, smoothstep(0.6, 1.0, y));

          // ...plus optional mid-plume bulge (gaussian around y≈0.3)
          float bulge = uBulge * 0.25 * exp(-pow((y - 0.30) / 0.18, 2.0));
          width += bulge;

          // Lateral wobble (turbulence)
          float wob = (fbm(vec2(vUv.y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.25*uTurbulence);
          float x = abs(vUv.x - 0.5 + wob);

          // Mask
          float body = smoothstep(width, width - 0.12, x);
          float head = smoothstep(0.0, 0.10, y);
          float tail = 1.0 - smoothstep(0.88, 1.0, y);

          // Mach diamonds: bands that fade out near the tip
          float bands = sin(y * uDiamondsFreq * 6.283) * 0.5 + 0.5;
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.65, 1.0, y));

          // Color mix (normalize weights)
          float wSum = max(uMixBlue + uMixOrange + uMixWhite, 0.0001);
          vec3 mixCol = (uBlueColor*uMixBlue + uOrangeColor*uMixOrange + uWhiteColor*uMixWhite) / wSum;

          // Subtle gradient along plume to keep physical feel
          vec3 col = mix(mixCol * 0.8, mixCol, smoothstep(0.0, 0.25, y));

          float alpha = body * head * tail * diamonds * clamp(uIntensity, 0.0, 5.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}