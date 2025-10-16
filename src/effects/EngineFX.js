// src/effects/EngineFX.js
// Round, cone-like jet using CylinderGeometry (open ended).
// Plume A = baked (locked). Plume B = editable via EnginePanel.
// Cheap additive shader; alpha shaped by cylindrical UV and height.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    // Measure rocket to derive baselines
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;
    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    // Baselines
    this.emitYBase        = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameRadiusBase  = clusterRadius * 0.7;   // base radius of plume
    this.flameHeightBase  = clusterRadius * 7.0;   // plume length

    // ---- BAKED (LOCKED) plume params (your JSON) ----
    this.paramsLocked = {
      enginesOn: true,
      flameWidthFactor:  4.06,   // radius multiplier
      flameHeightFactor: 10.64,  // height multiplier
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

    // ---- Editable plume default params ----
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

    // Shared geometry: open-ended cylinder (frustum) along +Y
    // (top radius smaller than bottom; we’ll still apply taper in shader)
    // 24 radial segments gives a smooth circle at very low cost.
    const geo = new THREE.CylinderGeometry(0.5, 1.0, 1.0, 24, 1, true);
    geo.rotateZ(0); // keep default orientation (Y up)

    // Two distinct materials so uniforms can differ
    this.matLocked = this._makeFlameMaterial();
    this.matEdit   = this._makeFlameMaterial();

    // Two meshes
    this.flameLocked = new THREE.Mesh(geo, this.matLocked);
    this.flameEdit   = new THREE.Mesh(geo, this.matEdit);

    // IMPORTANT: flip so plume points DOWNWARD (−Y)
    this.flameLocked.rotation.x = Math.PI;
    this.flameEdit.rotation.x   = Math.PI;

    this.flameLocked.frustumCulled = false;
    this.flameEdit.frustumCulled   = false;

    // Parent groups (so you can offset each plume)
    this.groupLocked = new THREE.Group();
    this.groupEdit   = new THREE.Group();
    rocketRoot.add(this.groupLocked, this.groupEdit);
    this.groupLocked.add(this.flameLocked);
    this.groupEdit.add(this.flameEdit);

    // Initial state
    this._applyTransformsLocked();
    this._applyUniformsLocked();
    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ======= Public API (controls ONLY the editable plume) =======
  setIgnition(on) {
    const v = !!on;
    this.params.enginesOn = v;
    this.paramsLocked.enginesOn = v; // both appear together on ignite
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
        flameWidth:  this.flameRadiusBase  * this.params.flameWidthFactor * 2.0, // diameter
        flameHeight: this.flameHeightBase  * this.params.flameHeightFactor,
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
    const show = !!this.params.enginesOn;
    this.flameLocked.visible = show;
    this.flameEdit.visible   = show;
  }

  _applyTransformsLocked() {
    const P = this.paramsLocked;
    this.groupLocked.position.set(P.groupOffsetX, P.groupOffsetY, P.groupOffsetZ);

    const r = this.flameRadiusBase * P.flameWidthFactor; // radius
    const h = this.flameHeightBase * P.flameHeightFactor;

    this.flameLocked.scale.set(r, h, r); // XZ = radius, Y = height
    this.flameLocked.position.set(0, this.emitYBase + P.flameYOffset, 0);
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

    const r = this.flameRadiusBase * P.flameWidthFactor; // radius
    const h = this.flameHeightBase * P.flameHeightFactor;

    this.flameEdit.scale.set(r, h, r);
    this.flameEdit.position.set(0, this.emitYBase + P.flameYOffset, 0);
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
      side: THREE.DoubleSide, // see-through from any angle
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
        varying vec2 vUv;     // cylinder UV: x is angle [0..1], y is height [0..1]
        varying vec3 vPos;    // object-space position (after scale in MV)
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vPos;

        uniform float uTime, uIntensity, uTaper, uTurbulence, uNoiseSpeed;
        uniform float uDiamondsStrength, uDiamondsFreq, uBulge;
        uniform float uMixBlue, uMixOrange, uMixWhite;
        uniform vec3  uBlueColor, uOrangeColor, uWhiteColor;

        // super-cheap noise
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a += w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        void main(){
          // Height along plume (0 = base near nozzle, 1 = tip)
          float y = clamp(vUv.y, 0.0, 1.0);

          // "Angular" distance from edge using cylinder UV (0/1 edges, 0.5 opposite edge)
          float edgeCoord = min(vUv.x, 1.0 - vUv.x); // 0 at seam/edge, 0.5 at opposite side
          // widen/narrow allowed thickness across the circumference
          float width = mix(0.48, 0.10, clamp(uTaper, 0.0, 1.0));
          // fade thinner toward the tip
          width = mix(width, 0.14, smoothstep(0.6, 1.0, y));
          // mid-plume bulge
          width += uBulge * 0.25 * exp(-pow((y - 0.30)/0.18, 2.0));

          // Turbulent wobble makes rim noisy over time
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.25*uTurbulence);
          edgeCoord += wob;

          // Body mask from the cylindrical edge
          float body = smoothstep(width, width - 0.12, edgeCoord);

          // Base fade-in and tip fade-out
          float head = smoothstep(0.0, 0.10, y);
          float tail = 1.0 - smoothstep(0.88, 1.0, y);

          // Mach diamonds bands along height (fade near tip)
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