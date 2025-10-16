// src/effects/EngineFX.js
// Crossed-billboard rocket plume (3 quads) with flipped color ramp and tail teardrop.
// Stays GPU-cheap, works with your existing Engine Panel sliders.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    // Measure rocket to set sensible baselines
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;

    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameWidthBase  = clusterRadius * 1.4;
    this.flameHeightBase = clusterRadius * 7.0;

    // Wide-range, panel-controlled params
    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0,    // 0.01–80
      flameHeightFactor: 1.0,    // 0.01–120
      flameYOffset:      0.0,    // -1200–2400

      intensity:   1.0,
      taper:       0.55,         // 0=wide, 1=thin
      bulge:       0.15,         // bulge near base
      tear:        0.65,         // tail teardrop pinch
      turbulence:  0.35,
      noiseSpeed:  1.6,
      diamondsStrength: 0.25,
      diamondsFreq:     14.0,

      rimStrength: 0.25,
      rimSpeed:    2.5,

      colorBlue:   1.0,          // multipliers
      colorOrange: 1.0,
      colorWhite:  1.0,

      groupOffsetX: 0.0,
      groupOffsetY: 0.0,
      groupOffsetZ: 0.0
    };

    // Group that follows the rocket
    this.group = new THREE.Group();
    rocketRoot.add(this.group);

    // Shared material for all crossed billboards
    const mat = this._makeFlameMaterial();

    // Build 3 crossed planes (0°, 60°, 120°)
    this.planes = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const m   = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.rotation.y = i * Math.PI / 3; // 0, 60°, 120°
      this.group.add(m);
      this.planes.push(m);
    }

    // Y-billboard the whole cluster so it swivels with the camera horizontally,
    // while crossed quads give volumetric feel from any angle.
    this.group.onBeforeRender = () => {
      const p = new THREE.Vector3(); this.group.getWorldPosition(p);
      const c = this.camera.position;
      const yaw = Math.atan2(c.x - p.x, c.z - p.z);
      this.group.rotation.set(0, yaw, 0);
    };

    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ----- Public API for the Engine Panel -----
  setIgnition(on){ this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition(){ return this.params.enginesOn; }

  setParams(patch){
    Object.assign(this.params, patch);
    this._applyTransforms();
    this._applyUniforms();
  }

  getParams(){
    return {
      ...this.params,
      absolute:{
        flameWidth:  this.flameWidthBase  * this.params.flameWidthFactor,
        flameHeight: this.flameHeightBase * this.params.flameHeightFactor,
        flameY:      this.emitYBase + this.params.flameYOffset + this.params.groupOffsetY
      }
    };
  }

  update(_, t){
    // Single shared material across planes
    const mat = this.planes[0]?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;
  }

  // ----- Internals -----
  _applyVisibility(){
    this.planes.forEach(p => p.visible = !!this.params.enginesOn);
  }

  _applyTransforms(){
    // Move the whole FX block
    this.group.position.set(
      this.params.groupOffsetX,
      this.params.groupOffsetY,
      this.params.groupOffsetZ
    );

    // Scale & place each plane identically
    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;
    for (const p of this.planes) {
      p.scale.set(w, h, 1);
      p.position.set(0, this.emitYBase + this.params.flameYOffset + h * 0.02, 0);
    }
  }

  _applyUniforms(){
    const u = this.planes[0]?.material.uniforms; if (!u) return;
    u.uIntensity.value   = this.params.intensity;
    u.uTaper.value       = this.params.taper;
    u.uBulge.value       = this.params.bulge;
    u.uTear.value        = this.params.tear;
    u.uTurb.value        = this.params.turbulence;
    u.uNoiseSpeed.value  = this.params.noiseSpeed;
    u.uDiamondsStrength.value = this.params.diamondsStrength;
    u.uDiamondsFreq.value     = this.params.diamondsFreq;
    u.uRimStrength.value = this.params.rimStrength;
    u.uRimSpeed.value    = this.params.rimSpeed;

    u.uBlueMul.value   = this.params.colorBlue;
    u.uOrangeMul.value = this.params.colorOrange;
    u.uWhiteMul.value  = this.params.colorWhite;
  }

  _makeFlameMaterial(){
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms:{
        uTime: { value: 0.0 },

        // shaping
        uIntensity: { value: 1.0 },
        uTaper:     { value: 0.55 },
        uBulge:     { value: 0.15 },
        uTear:      { value: 0.65 },
        uTurb:      { value: 0.35 },
        uNoiseSpeed:{ value: 1.6 },
        uDiamondsStrength: { value: 0.25 },
        uDiamondsFreq:     { value: 14.0 },

        // halo
        uRimStrength: { value: 0.25 },
        uRimSpeed:    { value: 2.5 },

        // colors (base WHITE/BLUE @ nozzle → BLUE mid → ORANGE tail)
        uBlueMul:   { value: 1.0 },
        uOrangeMul: { value: 1.0 },
        uWhiteMul:  { value: 1.0 },
        uBlue:   { value: new THREE.Color(0x51B9FF) },
        uWhite:  { value: new THREE.Color(0xFFFFFF) },
        uOrange: { value: new THREE.Color(0xFF7A00) }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){
          vUv = uv; // y=0 at BASE (nozzle), y=1 at TAIL
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;

        varying vec2 vUv;
        uniform float uTime;

        uniform float uIntensity, uTaper, uBulge, uTear, uTurb, uNoiseSpeed;
        uniform float uDiamondsStrength, uDiamondsFreq;
        uniform float uRimStrength, uRimSpeed;

        uniform float uBlueMul, uOrangeMul, uWhiteMul;
        uniform vec3  uBlue, uWhite, uOrange;

        // cheap hash/fbm
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        // radius along plume; base (y=0) is widest, tail pinches (teardrop)
        float radiusProfile(float y){
          float baseR = mix(0.50, 0.28, clamp(uTaper,0.0,1.0));   // overall width
          float bulge = uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y-0.175)) * 0.35; // near base
          float r = baseR + bulge;
          r = mix(r, 0.10, smoothstep(0.60, 0.90, y));            // narrow to tail
          float pinch = pow(smoothstep(0.82, 1.0, y), mix(2.0, 8.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch);                                  // teardrop point
          return r;
        }

        void main(){
          // NOTE: y=0 is base (nozzle), y=1 is tail — this fixes “upside down”.
          float y = clamp(vUv.y, 0.0, 1.0);

          // lateral wobble
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          float x = abs(vUv.x - 0.5 + wob);

          // cylindrical mask
          float r = radiusProfile(y);
          float body = smoothstep(r, r-0.14, x);

          // soft base + tail gates
          float baseGate = smoothstep(0.00, 0.06, y);     // fade-in at the base
          float tailGate = 1.0 - smoothstep(0.96, 1.00, y);
          body *= baseGate * tailGate;

          // Mach diamonds in the middle, fade near tail
          float bands = 0.5 + 0.5*sin(y*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y));
          body *= diamonds;

          // Color ramp (correct orientation):
          // BASE: white → blue, MID: blue, TAIL: blue → orange
          vec3 baseCol = mix(uWhite*uWhiteMul, uBlue*uBlueMul, smoothstep(0.05, 0.30, y));
          vec3 midCol  = mix(baseCol, uBlue*uBlueMul, smoothstep(0.20, 0.55, y));
          vec3 tailCol = mix(midCol,  uOrange*uOrangeMul, smoothstep(0.55, 0.95, y));
          vec3 col = tailCol;

          // Fast noisy halo outside edge
          float rim = smoothstep(r+0.05, r, x);
          float rimNoise = fbm(vec2((x-r)*24.0, uTime*uRimSpeed))*0.5+0.5;
          float halo = rim * rimNoise * uRimStrength;

          float alpha = (body + halo) * clamp(uIntensity, 0.0, 5.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}