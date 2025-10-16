// src/effects/EngineFX.js
// --- CORRECTED VERSION ---
// Renders a SINGLE, high-quality rocket plume using crossed billboards.
// The shader is enhanced for a proper teardrop shape and better colors.

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

    // Base flame dimensions
    this.emitYBase       = this.bottomY;
    this.flameWidthBase  = 3.5;  // A good starting width for a large engine
    this.flameHeightBase = 40.0; // A long, powerful-looking flame

    // --- REVISED: Parameters tuned for a much better default look ---
    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0,
      flameHeightFactor: 1.0,
      flameYOffset:      0.0,

      intensity:   1.2,    // A bit brighter
      taper:       0.4,    // Slightly wider base
      bulge:       0.1,    // Subtle mid-flame bulge
      tear:        0.85,   // STRONG teardrop effect is now default
      turbulence:  0.2,    // Less chaotic, more focused
      noiseSpeed:  1.8,
      diamondsStrength: 0.4, // More prominent Mach diamonds
      diamondsFreq:     12.0,

      rimStrength: 0.3,
      rimSpeed:    2.8,

      // Renamed for clarity, tuned for a better look
      colorCyan:   1.0,
      colorOrange: 1.0,
      colorWhite:  1.2,

      groupOffsetX: 0.0,
      groupOffsetY: 0.0,
      groupOffsetZ: 0.0
    };

    // This single group holds all the planes for our one flame
    this.group = new THREE.Group();
    rocketRoot.add(this.group);

    const sharedMaterial = this._makeFlameMaterial();

    // Build 3 crossed planes (0°, 60°, 120°) to create a volumetric effect
    this.planes = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const m   = new THREE.Mesh(geo, sharedMaterial);
      m.frustumCulled = false;
      m.rotation.y = i * Math.PI / 3; // Rotates planes to intersect
      this.group.add(m);
      this.planes.push(m);
    }

    // Y-axis billboarding: the whole group swivels to face the camera,
    // ensuring the crossed planes always look 3D and not flat.
    this.group.onBeforeRender = () => {
      const worldPos = new THREE.Vector3(); this.group.getWorldPosition(worldPos);
      const camPos = this.camera.position;
      const yaw = Math.atan2(camPos.x - worldPos.x, camPos.z - worldPos.z);
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
    return { ...this.params };
  }

  update(_, t){
    const mat = this.planes[0]?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;
  }

  // ----- Internals -----
  _applyVisibility(){
    this.group.visible = !!this.params.enginesOn;
  }

  _applyTransforms(){
    // Move the whole FX block based on panel offsets
    this.group.position.set(
      this.params.groupOffsetX,
      this.params.groupOffsetY,
      this.params.groupOffsetZ
    );

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    // Scale and position each plane identically within the group
    for (const p of this.planes) {
      p.scale.set(w, h, 1);
      // Position planes so their base is at the flame's origin point
      p.position.y = this.emitYBase + this.params.flameYOffset + (h / 2);
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

    u.uCyanMul.value   = this.params.colorCyan;
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
        uIntensity: { value: 1.2 }, uTaper: { value: 0.4 },
        uBulge: { value: 0.1 }, uTear: { value: 0.85 },
        uTurb: { value: 0.2 }, uNoiseSpeed:{ value: 1.8 },
        uDiamondsStrength: { value: 0.4 }, uDiamondsFreq: { value: 12.0 },
        uRimStrength: { value: 0.3 }, uRimSpeed: { value: 2.8 },
        uCyanMul:   { value: 1.0 }, uOrangeMul: { value: 1.0 }, uWhiteMul:  { value: 1.2 },
        uCyan:   { value: new THREE.Color(0x80fbfd) },
        uWhite:  { value: new THREE.Color(0xffffff) },
        uOrange: { value: new THREE.Color(0xffac57) }
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
        uniform float uCyanMul, uOrangeMul, uWhiteMul;
        uniform vec3  uCyan, uWhite, uOrange;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        // --- REVISED: Stronger teardrop shape ---
        float radiusProfile(float y){
          float r = mix(0.50, 0.28, clamp(uTaper,0.0,1.0)); // Taper
          r += uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y-0.175)) * 0.35; // Bulge
          r = mix(r, 0.10, smoothstep(0.60, 0.90, y)); // Narrow tail
          // Sharper, more powerful pinch for the teardrop effect
          float pinch = pow(smoothstep(0.75, 1.0, y), mix(4.0, 15.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch);
          return r;
        }

        void main(){
          float y = vUv.y;
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          float x = abs(vUv.x - 0.5 + wob);

          float r = radiusProfile(y);
          float body = smoothstep(r, r-0.14, x);
          body *= smoothstep(0.00, 0.06, y) * (1.0 - smoothstep(0.96, 1.00, y));

          float bands = 0.5 + 0.5*sin(y*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, uDiamondsStrength);
          body *= mix(diamonds, 1.0, smoothstep(0.70, 1.0, y));

          // --- REVISED: More vibrant color ramp ---
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.3, 0.85, y));

          float rim = smoothstep(r+0.05, r, x) * (fbm(vec2((x-r)*24.0, uTime*uRimSpeed))*0.5+0.5);
          float halo = rim * uRimStrength;

          float alpha = (body + halo) * uIntensity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}
