// src/effects/EngineFX.js
// Two-plume system:
//  • Plume A = baked/locked using your config (not editable)
//  • Plume B = editable via EnginePanel
// Both are GPU-cheap single billboards, flipped so the jet points downward.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene = scene;
    this.camera = camera;

    // Measure rocket to derive baselines
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;
    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    // Baselines
    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameWidthBase  = clusterRadius * 1.4;
    this.flameHeightBase = clusterRadius * 7.0;

    // ---- BAKED (LOCKED) PLUME: your config ----
    this.paramsLocked = {
      enginesOn: true, // visible when ignition on
      flameWidthFactor:  4.06,
      flameHeightFactor: 10.64,
      flameYOffset:      278.2,
      intensity:         1.61,
      taper:             0.01,
      turbulence:        0.65,
      noiseSpeed:        1.57,
      diamondsStrength:  0.0,
      diamondsFreq:      14.0,
      bulge:             0.19,
      colorBlue:         1.65,
      colorOrange:       1.65,
      colorWhite:        1.12,
      groupOffsetX:      80.0,
      groupOffsetY:     -300.0,
      groupOffsetZ:      41.5
    };

    // ---- EDITABLE plume defaults (fresh one you can tweak) ----
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
      bulge:             0.0,
      colorBlue:         1.0,
      colorOrange:       1.0,
      colorWhite:        1.0,
      groupOffsetX:      0.0,
      groupOffsetY:      0.0,
      groupOffsetZ:      0.0
    };

    // Groups parented to rocket (separate transforms)
    this.groupLocked = new THREE.Group();
    this.groupEdit   = new THREE.Group();
    rocketRoot.add(this.groupLocked);
    rocketRoot.add(this.groupEdit);

    // Shared geometry; two materials (so colors/params are independent)
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.matLocked = this._makeFlameMaterial();
    this.matEdit   = this._makeFlameMaterial();

    // Two meshes
    this.flameLocked = new THREE.Mesh(geo, this.matLocked);
    this.flameEdit   = new THREE.Mesh(geo, this.matEdit);

    // IMPORTANT: flip vertically so plume points DOWN
    // We still face camera around Y each frame.
    this.flameLocked.rotation.x = Math.PI;
    this.flameEdit.rotation.x   = Math.PI;

    this.flameLocked.frustumCulled = false;
    this.flameEdit.frustumCulled   = false;
    this.groupLocked.add(this.flameLocked);
    this.groupEdit.add(this.flameEdit);

    // Face camera around Y (for each plume)
    const faceCam = (mesh, group) => {
      mesh.onBeforeRender = () => {
        const p = new THREE.Vector3(); group.getWorldPosition(p);
        const c = this.camera.position;
        const yaw = Math.atan2(c.x - p.x, c.z - p.z);
        // keep X=PI (flipped), update yaw every frame
        mesh.rotation.set(Math.PI, yaw, 0);
      };
    };
    faceCam(this.flameLocked, this.groupLocked);
    faceCam(this.flameEdit,   this.groupEdit);

    // Apply initial transforms & uniforms
    this._applyTransformsLocked();
    this._applyUniformsLocked();
    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ======= Public API for UI (controls only the EDITABLE plume) =======
  setIgnition(on) {
    const v = !!on;
    // “Ignite” shows BOTH: the baked + your editable
    this.params.enginesOn = v;
    this.paramsLocked.enginesOn = v;
    this._applyVisibility();
  }
  getIgnition() { return !!this.params.enginesOn; }

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
    this.matLocked.uniforms.uTime.value = t;
    this.matEdit.uniforms.uTime.value   = t;
  }

  // ======= Internals =======
  _applyVisibility() {
    const show = !!this.params.enginesOn; // both obey same ignition
    if (this.flameLocked) this.flameLocked.visible = show;
    if (this.flameEdit)   this.flameEdit.visible   = show;
  }

  _applyTransformsLocked() {
    const P = this.paramsLocked;
    this.groupLocked.position.set(P.groupOffsetX, P.groupOffsetY, P.groupOffsetZ);

    const w = this.flameWidthBase  * P.flameWidthFactor;
    const h = this.flameHeightBase * P.flameHeightFactor;

    this.flameLocked.scale.set(w, h, 1);
    // place relative to rocket base + offset
    this.flameLocked.position.set(0, this.emitYBase + P.flameYOffset + h * 0.02, 0);
  }

  _applyUniformsLocked() {
    const P = this.paramsLocked;
    const u = this.matLocked.uniforms;
    u.uIntensity.value        = P.intensity;
    u.uTaper.value            = P.taper;
    u.uTurbulence.value       = P.turbulence;
    u.uNoiseSpeed.value       = P.noiseSpeed;
    u.uDiamondsStrength.value = P.diamondsStrength;
    u.uDiamondsFreq.value     = P.diamondsFreq;
    u.uBulge.value            = P.bulge;
    u.uMixBlue.value          = P.colorBlue;
    u.uMixOrange.value        = P.colorOrange;
    u.uMixWhite.value         = P.colorWhite;
  }

  _applyTransforms() {
    const P = this.params;
    this.groupEdit.position.set(P.groupOffsetX, P.groupOffsetY, P.groupOffsetZ);
    const w = this.flameWidthBase  * P.flameWidthFactor;
    const h = this.flameHeightBase * P.flameHeightFactor;
    this.flameEdit.scale.set(w, h, 1);
    this.flameEdit.position.set(0, this.emitYBase + P.flameYOffset + h * 0.02, 0);
  }

  _applyUniforms() {
    const P = this.params;
    const u = this.matEdit.uniforms;
    u.uIntensity.value        = P.intensity;
    u.uTaper.value            = P.taper;
    u.uTurbulence.value       = P.turbulence;
    u.uNoiseSpeed.value       = P.noiseSpeed;
    u.uDiamondsStrength.value = P.diamondsStrength;
    u.uDiamondsFreq.value     = P.diamondsFreq;

    u.uBulge.value            = P.bulge;

    u.uMixBlue.value          = P.colorBlue;
    u.uMixOrange.value        = P.colorOrange;
    u.uMixWhite.value         = P.colorWhite;
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
        uBulge: { value: 0.0 },
        uMixBlue:   { value: 1.0 },
        uMixOrange: { value: 1.0 },
        uMixWhite:  { value: 1.0 },
        uBlueColor:   { value: new THREE.Color(0x66aaff) },
        uOrangeColor: { value: new THREE.Color(0xffa53a) },
        uWhiteColor:  { value: new THREE.Color(0xfff9e6) }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;
        varying vec2 vUv;

        uniform float uTime, uIntensity, uTaper, uTurbulence, uNoiseSpeed;
        uniform float uDiamondsStrength, uDiamondsFreq, uBulge;
        uniform float uMixBlue, uMixOrange, uMixWhite;
        uniform vec3  uBlueColor, uOrangeColor, uWhiteColor;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a += w * n2(p); p = p*2.03 + 1.7; w *= 0.5; }
          return a;
        }

        void main() {
          // y goes 0..1 from base to tip (we flipped mesh in world, not UV)
          float y = clamp(vUv.y, 0.0, 1.0);

          // Base taper + mid-plume bulge
          float width = mix(0.48, 0.08, clamp(uTaper, 0.0, 1.0));
          width = mix(width, 0.12, smoothstep(0.6, 1.0, y));
          float bulge = uBulge * 0.25 * exp(-pow((y - 0.30) / 0.18, 2.0));
          width += bulge;

          // Lateral wobble
          float wob = (fbm(vec2(vUv.y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.25*uTurbulence);
          float x = abs(vUv.x - 0.5 + wob);

          // Mask
          float body = smoothstep(width, width - 0.12, x);
          float head = smoothstep(0.0, 0.10, y);
          float tail = 1.0 - smoothstep(0.88, 1.0, y);

          // Mach diamonds
          float bands = sin(y * uDiamondsFreq * 6.283) * 0.5 + 0.5;
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.65, 1.0, y));

          // Color mixing
          float wSum = max(uMixBlue + uMixOrange + uMixWhite, 0.0001);
          vec3 mixCol = (uBlueColor*uMixBlue + uOrangeColor*uMixOrange + uWhiteColor*uMixWhite) / wSum;
          vec3 col = mix(mixCol * 0.8, mixCol, smoothstep(0.0, 0.25, y));

          float alpha = body * head * tail * diamonds * clamp(uIntensity, 0.0, 5.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}