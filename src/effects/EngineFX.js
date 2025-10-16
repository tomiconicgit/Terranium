// src/effects/EngineFX.js
// Jet-like single plume (cylindrical illusion) with tail teardrop + white/blue base → orange tail.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    // Measure rocket
    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;

    const clusterRadius = 0.5 * Math.max(this.size.x, this.size.z) * 0.9;

    // Baselines (scaled by sliders)
    this.emitYBase       = this.bottomY + Math.max(0.02 * this.size.y, 0.1);
    this.flameWidthBase  = clusterRadius * 1.4;
    this.flameHeightBase = clusterRadius * 7.0;

    // Parameters (wide ranges)
    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0,   // 0.01–80
      flameHeightFactor: 1.0,   // 0.01–120
      flameYOffset:      0.0,   // -1200–2400

      intensity:   1.0,  // alpha/brightness
      taper:       0.55, // 0=wide, 1=thin (overall)
      bulge:       0.15, // mid-body bulge near base
      tear:        0.65, // tail teardrop pinch (higher = sharper tip)
      turbulence:  0.35,
      noiseSpeed:  1.6,
      diamondsStrength: 0.25,
      diamondsFreq:     14.0,

      rimStrength: 0.25, // noisy halo
      rimSpeed:    2.5,

      colorBlue:   1.0,  // mix multipliers
      colorOrange: 1.0,
      colorWhite:  1.0,

      groupOffsetX: 0.0,
      groupOffsetY: 0.0,
      groupOffsetZ: 0.0
    };

    // FX group (follows rocket)
    this.group = new THREE.Group();
    rocketRoot.add(this.group);

    // Plume quad
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = this._makeFlameMaterial();
    this.flame = new THREE.Mesh(geo, mat);
    this.flame.frustumCulled = false;
    this.group.add(this.flame);

    // Billboard around Y
    this.flame.onBeforeRender = () => {
      const p = new THREE.Vector3(); this.group.getWorldPosition(p);
      const c = this.camera.position;
      const yaw = Math.atan2(c.x - p.x, c.z - p.z);
      this.flame.rotation.set(0, yaw, 0);
    };

    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // Public API (used by EnginePanel)
  setIgnition(on) { this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition()   { return this.params.enginesOn; }

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

  update(dt, t){ this.flame.material.uniforms.uTime.value = t; }

  // Internals
  _applyVisibility(){ this.flame.visible = !!this.params.enginesOn; }

  _applyTransforms(){
    // whole group offset (huge ranges ok)
    this.group.position.set(this.params.groupOffsetX, this.params.groupOffsetY, this.params.groupOffsetZ);

    // scale & place the plume quad
    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;
    this.flame.scale.set(w, h, 1);
    // base at y=0 of the quad; shift slightly up so base sits at emit height
    this.flame.position.set(0, this.emitYBase + this.params.flameYOffset + h * 0.02, 0);
  }

  _applyUniforms(){
    const u = this.flame.material.uniforms;
    u.uIntensity.value = this.params.intensity;
    u.uTaper.value     = this.params.taper;
    u.uBulge.value     = this.params.bulge;
    u.uTear.value      = this.params.tear;
    u.uTurb.value      = this.params.turbulence;
    u.uNoiseSpeed.value= this.params.noiseSpeed;
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

        // colors (base white/blue → mid blue → orange tail)
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
          vUv = uv;               // y=0 at base (near nozzle), y=1 at tail
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;

        varying vec2 vUv;
        uniform float uTime;

        uniform float uIntensity;
        uniform float uTaper;
        uniform float uBulge;
        uniform float uTear;
        uniform float uTurb;
        uniform float uNoiseSpeed;
        uniform float uDiamondsStrength;
        uniform float uDiamondsFreq;

        uniform float uRimStrength;
        uniform float uRimSpeed;

        uniform float uBlueMul, uOrangeMul, uWhiteMul;
        uniform vec3  uBlue, uWhite, uOrange;

        // super cheap hash/fbm
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        // Radius profile (cylindrical illusion)
        // y=0 base, y=1 tail.
        // - taper narrows towards tail
        // - bulge fattens near base (mid-body)
        // - tear makes a rounded teardrop tip by pinching the very end
        float radiusProfile(float y){
          float baseR = mix(0.50, 0.28, clamp(uTaper,0.0,1.0));   // overall width
          // bulge concentrated in first ~35% of length
          float bulge = uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y-0.175)) * 0.35;
          float r = baseR + bulge; // wider near base
          // taper to tail
          r = mix(r, 0.06, smoothstep(0.55, 1.0, y));
          // teardrop pinch at tail
          float pinch = pow(smoothstep(0.82, 1.0, y), mix(2.0, 8.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch); // collapse to point at very end
          return r;
        }

        void main(){
          float y = clamp(vUv.y, 0.0, 1.0);

          // lateral wobble
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          float x = abs(vUv.x - 0.5 + wob);

          // cylindrical mask
          float r = radiusProfile(y);
          float body = smoothstep(r, r-0.14, x);

          // head/tail gating to avoid hard caps
          float baseGate = smoothstep(0.00, 0.06, y);     // fade-in from the base
          float tailGate = 1.0 - smoothstep(0.96, 1.00, y); // fade-out at tip
          body *= baseGate * tailGate;

          // Mach diamonds modulate middle band; fade at tail
          float bands = 0.5 + 0.5*sin(y*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y));
          body *= diamonds;

          // --- Color ramp (base white-blue → gas blue → orange tail) ---
          // Core is white/blue near base (y≈0), then blue mid, then orange towards y→1
          vec3 baseCol = mix(uWhite*uWhiteMul, uBlue*uBlueMul, smoothstep(0.05, 0.30, y));
          vec3 midCol  = mix(baseCol, uBlue*uBlueMul, smoothstep(0.20, 0.55, y));
          vec3 tailCol = mix(midCol,  uOrange*uOrangeMul, smoothstep(0.55, 0.95, y));
          vec3 col = tailCol;

          // Rim/halo just outside flame edge for “fast” noisy outline
          float rim = smoothstep(r+0.05, r, x);     // edge region
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