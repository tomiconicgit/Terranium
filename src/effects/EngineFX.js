// Round cone jet with teardrop base, color ramp & cheap animated rim.
// Plume A = baked (locked). Plume B = editable via EnginePanel.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;

    // --- size baselines from model ---
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;
    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameRadiusBase = clusterRadius * 0.7;   // radius baseline
    this.flameHeightBase = clusterRadius * 7.0;   // height baseline

    // ---- baked (locked) plume ----
    this.paramsLocked = {
      enginesOn: true,
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
      tear:              0.9,    // strong teardrop at base
      rimStrength:       0.35,
      rimSpeed:          3.0,
      colorBlue:         1.65,
      colorOrange:       1.65,
      colorWhite:        1.12,
      groupOffsetX:      80.0,
      groupOffsetY:     -300.0,
      groupOffsetZ:      41.5
    };

    // ---- editable plume defaults ----
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
      tear:              0.5,    // 0..1 base pinch → blossom
      rimStrength:       0.25,   // 0..1
      rimSpeed:          2.5,    // 0..6
      colorBlue:         1.0,
      colorOrange:       1.0,
      colorWhite:        1.0,
      groupOffsetX:      0.0,
      groupOffsetY:      0.0,
      groupOffsetZ:      0.0
    };

    // shared open cylinder (axis = +Y)
    const geo = new THREE.CylinderGeometry(0.5, 1.0, 1.0, 24, 1, true);

    this.matLocked = this._makeFlameMaterial();
    this.matEdit   = this._makeFlameMaterial();

    this.flameLocked = new THREE.Mesh(geo, this.matLocked);
    this.flameEdit   = new THREE.Mesh(geo, this.matEdit);
    // Flip so plume points downward
    this.flameLocked.rotation.x = Math.PI;
    this.flameEdit.rotation.x   = Math.PI;
    this.flameLocked.frustumCulled = this.flameEdit.frustumCulled = false;

    this.groupLocked = new THREE.Group();
    this.groupEdit   = new THREE.Group();
    rocketRoot.add(this.groupLocked, this.groupEdit);
    this.groupLocked.add(this.flameLocked);
    this.groupEdit.add(this.flameEdit);

    // init
    this._applyTransformsLocked();
    this._applyUniformsLocked();
    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ===== public API (controls the editable plume) =====
  setIgnition(on) {
    const v = !!on;
    this.params.enginesOn = v;
    this.paramsLocked.enginesOn = v; // show both together
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
        flameWidth:  this.flameRadiusBase * this.params.flameWidthFactor * 2.0,
        flameHeight: this.flameHeightBase * this.params.flameHeightFactor,
        flameY:      this.emitYBase + this.params.flameYOffset + this.params.groupOffsetY
      }
    };
  }

  update(dt, t) {
    this.matLocked.uniforms.uTime.value = t;
    this.matEdit.uniforms.uTime.value   = t;
  }

  // ===== internals =====
  _applyVisibility() {
    const show = !!this.params.enginesOn;
    this.flameLocked.visible = show;
    this.flameEdit.visible   = show;
  }

  _applyTransformsLocked() {
    const P = this.paramsLocked;
    this.groupLocked.position.set(P.groupOffsetX, P.groupOffsetY, P.groupOffsetZ);
    const r = this.flameRadiusBase * P.flameWidthFactor;
    const h = this.flameHeightBase * P.flameHeightFactor;
    this.flameLocked.scale.set(r, h, r);
    this.flameLocked.position.set(0, this.emitYBase + P.flameYOffset, 0);
  }
  _applyTransforms() {
    const P = this.params;
    this.groupEdit.position.set(P.groupOffsetX, P.groupOffsetY, P.groupOffsetZ);
    const r = this.flameRadiusBase * P.flameWidthFactor;
    const h = this.flameHeightBase * P.flameHeightFactor;
    this.flameEdit.scale.set(r, h, r);
    this.flameEdit.position.set(0, this.emitYBase + P.flameYOffset, 0);
  }

  _applyUniformsLocked() { this._fillUniforms(this.matLocked.uniforms, this.paramsLocked); }
  _applyUniforms()       { this._fillUniforms(this.matEdit.uniforms,   this.params); }

  _fillUniforms(u, P){
    u.uIntensity.value        = P.intensity;
    u.uTaper.value            = P.taper;
    u.uTurbulence.value       = P.turbulence;
    u.uNoiseSpeed.value       = P.noiseSpeed;
    u.uDiamondsStrength.value = P.diamondsStrength;
    u.uDiamondsFreq.value     = P.diamondsFreq;
    u.uBulge.value            = P.bulge;
    u.uTear.value             = P.tear;
    u.uRimStrength.value      = P.rimStrength;
    u.uRimSpeed.value         = P.rimSpeed;
    u.uMixBlue.value          = P.colorBlue;
    u.uMixOrange.value        = P.colorOrange;
    u.uMixWhite.value         = P.colorWhite;
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },

        // shaping
        uIntensity: { value: 1.0 },
        uTaper:     { value: 0.55 },
        uBulge:     { value: 0.0 },
        uTear:      { value: 0.5 },

        // dynamics
        uTurbulence:{ value: 0.35 },
        uNoiseSpeed:{ value: 1.6 },
        uDiamondsStrength: { value: 0.35 },
        uDiamondsFreq:     { value: 14.0 },

        // rim/halo
        uRimStrength: { value: 0.25 },
        uRimSpeed:    { value: 2.5 },

        // colors
        uMixBlue:   { value: 1.0 },
        uMixOrange: { value: 1.0 },
        uMixWhite:  { value: 1.0 },
        uBlueColor:   { value: new THREE.Color(0x66aaff) },
        uOrangeColor: { value: new THREE.Color(0xffa53a) },
        uWhiteColor:  { value: new THREE.Color(0xfff9e6) }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv; // x=angle(0..1), y=height(0..1)
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;
        varying vec2 vUv;

        uniform float uTime, uIntensity;
        uniform float uTaper, uBulge, uTear;
        uniform float uTurbulence, uNoiseSpeed;
        uniform float uDiamondsStrength, uDiamondsFreq;
        uniform float uRimStrength, uRimSpeed;
        uniform float uMixBlue, uMixOrange, uMixWhite;
        uniform vec3  uBlueColor, uOrangeColor, uWhiteColor;

        // ultra-cheap value noise
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        // width profile with teardrop at base:
        //  - start pinched (y~0), rapidly expand, then taper
        float widthProfile(float y){
          // base width (global taper)
          float w = mix(0.48, 0.10, clamp(uTaper,0.0,1.0));
          w = mix(w, 0.14, smoothstep(0.6, 1.0, y));   // thinner near tip

          // teardrop: pinch at y=0 then blossom by y~0.15
          float pinch  = mix(1.0, 0.35, clamp(uTear,0.0,1.0));
          float bloom  = smoothstep(0.02, 0.18, y);
          w *= mix(pinch, 1.0, bloom);

          // optional mid bulge
          w += uBulge * 0.25 * exp(-pow((y - 0.30)/0.18, 2.0));
          return w;
        }

        void main(){
          float y = clamp(vUv.y, 0.0, 1.0);

          // Use cylinder UV to measure "edge distance"
          float edge = min(vUv.x, 1.0 - vUv.x);

          // add wobble
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.25*uTurbulence);

          float w = widthProfile(y);
          float body = smoothstep(w, w - 0.12, edge + wob);

          // base/ tip fade
          float head = smoothstep(0.0, 0.10, y);
          float tail = 1.0 - smoothstep(0.88, 1.0, y);

          // diamonds
          float bands = sin(y * uDiamondsFreq * 6.283) * 0.5 + 0.5;
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.65, 1.0, y));

          // ---- Color ramp (top white/blue -> mid blue -> bottom blue→orange) ----
          float tTop = smoothstep(0.60, 0.92, y);
          float tMid = smoothstep(0.25, 0.60, y) * (1.0 - tTop);
          float tBot = 1.0 - tTop - tMid;

          vec3 topCol = normalize(vec3(uMixWhite, uMixBlue, 0.0)) * (uWhiteColor*0.9 + uBlueColor*0.4);
          vec3 midCol = uBlueColor;
          vec3 botCol = mix(uBlueColor, uOrangeColor, smoothstep(0.0, 0.30, y));

          vec3 col = normalize(
            topCol * tTop +
            midCol * tMid +
            botCol * tBot
          );

          float alphaBody = body * head * tail * diamonds * clamp(uIntensity,0.0,5.0);

          // ---- Rim/halo: thin animated “licks” outside edge ----
          // sample distance outside edge
          float outside = smoothstep(w + 0.02, w - 0.08, edge + wob);
          float lick = smoothstep(0.5, 1.0, sin((y - uTime*0.8*uRimSpeed)*42.0 + vUv.x*12.0));
          float rim = (1.0 - body) * outside * lick * uRimStrength;

          float alpha = alphaBody + rim * 0.6;
          vec3  outCol = mix(col, uWhiteColor, 0.3) * rim;

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alphaBody + outCol, alpha);
        }
      `
    });
  }
}