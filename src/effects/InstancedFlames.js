// src/effects/InstancedFlames.js
// One instanced mesh for all baked flames; shader does the shape & wobble.
// Ignition obeys the same 2800ms sound delay (sound is handled by editable flame).

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mix(a, b, t) { return a * (1.0 - t) + b * t; }

export class InstancedFlames {
  constructor(rocketRoot, scene, bakedList) {
    this.scene = scene;
    this.rocket = rocketRoot;

    // parameters should mirror EngineFX defaults where relevant
    this.params = {
      // visual (shared across all instances)
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,
      intensity: 1.5,
      taper: 0.0,
      bulge: 1.0,
      tear: 1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2,
      diamondsStrength: 0.9,
      diamondsFreq: 2.8,
      rimStrength: 0.0,
      rimSpeed: 4.1,
      colorCyan: 0.5,
      colorOrange: 3.0,
      colorWhite: 0.9,
      tailFadeStart: 0.3,
      tailFeather: 4.0,
      tailNoise: 0.2,
      bottomFadeDepth: 0.12,
      bottomFadeFeather: 0.80,
      orangeShift: -0.2
    };

    this.ignitionDelayMs = 2800;
    this._enginesOn = false;
    this._pendingTimer = null;

    // geometry/material (shared)
    const h = 40.0;
    const segments = 32;
    const g = new THREE.CylinderGeometry(0.001, 0.001, h, segments, 20, true);
    g.translate(0, -h / 2, 0);

    // build material that matches EngineFX shading (GPU version)
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime:              { value: 0.0 },
        uIntensity:         { value: this.params.intensity },
        uDiamondsStrength:  { value: this.params.diamondsStrength },
        uDiamondsFreq:      { value: this.params.diamondsFreq },
        uRimStrength:       { value: this.params.rimStrength },
        uRimSpeed:          { value: this.params.rimSpeed },
        uCyanMul:           { value: this.params.colorCyan },
        uOrangeMul:         { value: this.params.colorOrange },
        uWhiteMul:          { value: this.params.colorWhite },
        uCyan:              { value: new THREE.Color(0x80fbfd) },
        uWhite:             { value: new THREE.Color(0xffffff) },
        uOrange:            { value: new THREE.Color(0xffac57) },
        uTailStart:         { value: this.params.tailFadeStart },
        uTailFeather:       { value: this.params.tailFeather },
        uTailNoise:         { value: this.params.tailNoise },
        uBottomDepth:       { value: this.params.bottomFadeDepth },
        uBottomFeather:     { value: this.params.bottomFadeFeather },
        uOrangeShift:       { value: this.params.orangeShift },
        uWidthMul:          { value: this.params.flameWidthFactor },
        uHeightMul:         { value: this.params.flameHeightFactor },
        uYOffset:           { value: this.params.flameYOffset },
        uTaper:             { value: this.params.taper },
        uBulge:             { value: this.params.bulge },
        uTear:              { value: this.params.tear },
        uTurbulence:        { value: this.params.turbulence },
        uNoiseSpeed:        { value: this.params.noiseSpeed },
        uEnginesOn:         { value: 0.0 } // 0/1
      },
      vertexShader: `
        attribute float aSeed;
        varying float vYNorm;
        varying vec3 vNormalW;

        uniform float uTime;
        uniform float uWidthMul, uHeightMul, uYOffset;
        uniform float uTaper, uBulge, uTear, uTurbulence, uNoiseSpeed;

        // cheap hash & fbm
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

        float clampf(float x, float a, float b){ return max(a, min(b, x)); }
        float smoothstepf(float e0,float e1,float x){ x = clampf((x-e0)/(e1-e0),0.0,1.0); return x*x*(3.0-2.0*x); }
        float mixf(float a,float b,float t){ return a*(1.0-t)+b*t; }

        void main() {
          // cylinder base: height 40, translated -20, so y in [-40..0], with 0 at nozzle
          vec3 p = position;

          // normalised along height (0 at nozzle, 1 at tip)
          float y_norm = p.y / -40.0;
          vYNorm = y_norm;

          // base radius profile (moved from JS)
          float r = mixf(0.50, 0.28, clampf(uTaper,0.0,1.0));
          r += uBulge * smoothstepf(0.0, 0.35, 0.35 - abs(y_norm - 0.175)) * 0.35;
          r = mixf(r, 0.10, smoothstepf(0.60, 0.90, y_norm));
          float pinch = pow(smoothstepf(0.75, 1.0, y_norm), mixf(4.0, 15.0, clampf(uTear,0.0,1.0)));
          r = mixf(r, 0.0, pinch);

          // radial wobble/turbulence
          float angle = atan(p.z, p.x);
          float wob = (fbm(vec2(y_norm*6.0 + aSeed, uTime*uNoiseSpeed + aSeed)) - 0.5) * (0.35*uTurbulence*uWidthMul);
          float ro = r * uWidthMul + wob;

          // apply deformed radius
          p.x = cos(angle)*ro;
          p.z = sin(angle)*ro;

          // apply height scale + y offset (nozzle to camera)
          p.y = p.y * uHeightMul + uYOffset;

          // instance transform (+ rocket transform via scene graph)
          vec4 wp = instanceMatrix * vec4(p, 1.0);
          vec4 mv = modelViewMatrix * wp;
          gl_Position = projectionMatrix * mv;

          // normal in world-ish space for fragment tricks (rim)
          vec3 n = normalMatrix * normal;
          vNormalW = normalize(n);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying float vYNorm;
        varying vec3 vNormalW;

        uniform float uTime, uIntensity, uDiamondsStrength, uDiamondsFreq, uRimStrength, uRimSpeed;
        uniform float uCyanMul, uOrangeMul, uWhiteMul;
        uniform vec3  uCyan, uWhite, uOrange;
        uniform float uTailStart, uTailFeather, uTailNoise;
        uniform float uBottomDepth, uBottomFeather;
        uniform float uOrangeShift;
        uniform float uEnginesOn;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }
        float clampf(float x, float a, float b){ return max(a, min(b, x)); }

        void main() {
          if (uEnginesOn < 0.5) discard;

          float bands = 0.5 + 0.5 * sin(vYNorm * uDiamondsFreq * 6.2831853);
          float diamonds = mix(1.0, bands, clampf(uDiamondsStrength, 0.0, 2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, vYNorm));

          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, vYNorm));
          float o0 = 0.30 + uOrangeShift;
          float o1 = 0.85 + uOrangeShift;
          col = mix(col, uOrange*uOrangeMul, smoothstep(o0, o1, vYNorm));
          col *= diamonds;

          float tail = 1.0 - smoothstep(uTailStart, 1.0, vYNorm);
          tail = pow(max(tail, 0.0), max(uTailFeather, 0.0001));
          float tailJitter = (fbm(vec2(vYNorm*18.0, uTime*1.3)) - 0.5) * uTailNoise;
          float alphaTail  = clampf(tail + tailJitter, 0.0, 1.0);

          float bottom = smoothstep(0.0, max(uBottomDepth, 1e-5), vYNorm);
          bottom = pow(bottom, max(uBottomFeather, 0.0001));

          float rim = fbm(vec2(vYNorm*10.0, uTime*uRimSpeed)) * uRimStrength;

          float alpha = (alphaTail * bottom + rim) * uIntensity;
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });

    const count = Math.max(0, bakedList?.length || 0);
    this.mesh = new THREE.InstancedMesh(g, this.mat, count);
    this.mesh.name = 'InstancedFlames';
    this.mesh.frustumCulled = false;
    // allow Main to recognize this as draggable/pickable
    this.mesh.userData.__engineFX = this;

    // per-instance random seeds (so noise isn’t identical)
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random() * 100.0;
    this.mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

    // set transforms for each baked instance
    this._mat = new THREE.Matrix4();
    bakedList.forEach((b, i) => {
      const x = b.groupOffsetX || 0;
      const y = (b.groupOffsetY || 0) + 10.0;  // match EngineFX group Y basis
      const z = b.groupOffsetZ || 0;
      this._mat.identity().makeTranslation(x, y, z);
      this.mesh.setMatrixAt(i, this._mat);
    });
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);
  }

  /* ---------- API used by Main ---------- */

  getRaycastTargets() { return [this.mesh]; }

  // Move one instance in X/Z (and Y if provided)
  setInstanceOffset(index, { groupOffsetX, groupOffsetY, groupOffsetZ }) {
    if (!this.mesh || index == null) return;
    this.mesh.getMatrixAt(index, this._mat);
    const x = (groupOffsetX != null) ? groupOffsetX : this._mat.elements[12];
    const y = (groupOffsetY != null) ? groupOffsetY + 10.0 : this._mat.elements[13];
    const z = (groupOffsetZ != null) ? groupOffsetZ : this._mat.elements[14];
    this._mat.identity().makeTranslation(x, y, z);
    this.mesh.setMatrixAt(index, this._mat);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // for uniform updates from EnginePanel (shared params)
  setParams(patch) {
    Object.assign(this.params, patch);
    const u = this.mat.uniforms;
    if (!u) return;
    u.uIntensity.value        = this.params.intensity;
    u.uDiamondsStrength.value = this.params.diamondsStrength;
    u.uDiamondsFreq.value     = this.params.diamondsFreq;
    u.uRimStrength.value      = this.params.rimStrength;
    u.uRimSpeed.value         = this.params.rimSpeed;
    u.uCyanMul.value          = this.params.colorCyan;
    u.uOrangeMul.value        = this.params.colorOrange;
    u.uWhiteMul.value         = this.params.colorWhite;
    u.uTailStart.value        = this.params.tailFadeStart;
    u.uTailFeather.value      = this.params.tailFeather;
    u.uTailNoise.value        = this.params.tailNoise;
    u.uBottomDepth.value      = this.params.bottomFadeDepth;
    u.uBottomFeather.value    = this.params.bottomFadeFeather;
    u.uOrangeShift.value      = this.params.orangeShift;

    u.uWidthMul.value         = this.params.flameWidthFactor;
    u.uHeightMul.value        = this.params.flameHeightFactor;
    u.uYOffset.value          = this.params.flameYOffset;
    u.uTaper.value            = this.params.taper;
    u.uBulge.value            = this.params.bulge;
    u.uTear.value             = this.params.tear;
    u.uTurbulence.value       = this.params.turbulence;
    u.uNoiseSpeed.value       = this.params.noiseSpeed;
  }

  update(dt, t) {
    if (!this.mesh) return;
    this.mat.uniforms.uTime.value = t;
  }

  setIgnition(on) {
    if (on) {
      if (this._enginesOn) return;
      clearTimeout(this._pendingTimer);
      this._pendingTimer = setTimeout(() => {
        this._enginesOn = true;
        this.mat.uniforms.uEnginesOn.value = 1.0;
      }, this.ignitionDelayMs);
    } else {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
      this._enginesOn = false;
      this.mat.uniforms.uEnginesOn.value = 0.0;
    }
  }

  getIgnition() { return !!this._enginesOn; }
}