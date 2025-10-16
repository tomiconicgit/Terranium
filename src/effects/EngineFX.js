// src/effects/EngineFX.js
// --- MODIFIED ---
// Manages a CLUSTER of rocket plumes. Each plume is a crossed-billboard (3 quads)
// with an improved shader for a better teardrop shape and more realistic coloring.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    // --- NEW: Define a plausible engine layout for a SuperHeavy-style booster ---
    this.enginePositions = this._getEngineLayout();

    const box = new THREE.Box3().setFromObject(rocketRoot);
    this.size = new THREE.Vector3(); box.getSize(this.size);
    this.bottomY = box.min.y;

    // --- ADJUSTED: Base sizes are now for a SINGLE, smaller flame ---
    this.emitYBase       = this.bottomY + (0.01 * this.size.y);
    this.flameWidthBase  = 1.15; // Scaled for an individual engine nozzle
    this.flameHeightBase = 16.0; // A longer, leaner default flame shape

    // --- REVISED: Parameters tuned for a much better default look ---
    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0,
      flameHeightFactor: 1.0,
      flameYOffset:      0.0,

      intensity:   1.2,    // A bit brighter
      taper:       0.4,    // Slightly wider base
      bulge:       0.1,    // Subtle mid-flame bulge
      tear:        0.85,   // Much stronger teardrop effect
      turbulence:  0.2,    // Less chaotic, more focused
      noiseSpeed:  1.8,
      diamondsStrength: 0.4, // More prominent Mach diamonds
      diamondsFreq:     12.0,

      rimStrength: 0.3,
      rimSpeed:    2.8,

      colorCyan:   1.0,    // Multiplier for the cyan part of the flame
      colorOrange: 1.0,
      colorWhite:  1.2,    // A brighter, more intense core

      groupOffsetX: 0.0,
      groupOffsetY: 0.0,
      groupOffsetZ: 0.0
    };

    // This master group holds the entire cluster and is attached to the rocket
    this.masterGroup = new THREE.Group();
    rocketRoot.add(this.masterGroup);
    
    // Store all individual flame groups
    this.flameGroups = [];

    const sharedMaterial = this._makeFlameMaterial();

    // --- NEW: Loop to create each engine flame in the cluster ---
    this.enginePositions.forEach(pos => {
      // Each flame gets its own group for positioning
      const flameGroup = new THREE.Group();
      flameGroup.position.set(pos.x, 0, pos.z);

      // Create the 3 crossed planes for volumetric effect
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.PlaneGeometry(1, 1);
        const m   = new THREE.Mesh(geo, sharedMaterial);
        m.frustumCulled = false;
        m.rotation.y = i * Math.PI / 3; // 0°, 60°, 120°
        flameGroup.add(m);
      }
      
      // Billboard each individual flame group. This makes the cluster look
      // volumetric as the camera moves around it.
      flameGroup.onBeforeRender = () => {
        const worldPos = new THREE.Vector3();
        flameGroup.getWorldPosition(worldPos);
        const camPos = this.camera.position;
        const yaw = Math.atan2(camPos.x - worldPos.x, camPos.z - worldPos.z);
        flameGroup.rotation.set(0, yaw, 0);
      };

      this.masterGroup.add(flameGroup);
      this.flameGroups.push(flameGroup);
    });

    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // --- NEW: Helper method to generate engine positions in a pattern ---
  _getEngineLayout() {
    const positions = [];
    // A simplified but plausible 19-engine layout
    const r1 = 1.3, c1 = 6;  // Inner ring
    const r2 = 2.6, c2 = 12; // Outer ring
    
    positions.push({x:0, z:0}); // Central engine

    for (let i = 0; i < c1; i++) {
      const angle = (i / c1) * Math.PI * 2;
      positions.push({ x: Math.cos(angle) * r1, z: Math.sin(angle) * r1 });
    }
    for (let i = 0; i < c2; i++) {
      const angle = (i / c2) * Math.PI * 2;
      positions.push({ x: Math.cos(angle) * r2, z: Math.sin(angle) * r2 });
    }
    return positions;
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
    // All flames share one material, so we only need to update its time uniform once
    const mat = this.flameGroups[0]?.children[0]?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;
  }

  // ----- Internals -----
  _applyVisibility(){
    this.masterGroup.visible = !!this.params.enginesOn;
  }

  _applyTransforms(){
    // Apply global offsets to the entire cluster
    this.masterGroup.position.set(
      this.params.groupOffsetX,
      this.params.groupOffsetY,
      this.params.groupOffsetZ
    );

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    // Scale and position the planes within each individual flame group
    for (const group of this.flameGroups) {
      for (const plane of group.children) {
        if (plane.isMesh) {
          plane.scale.set(w, h, 1);
          // Position the plane so its bottom edge (uv.y=0) is at the nozzle point
          plane.position.y = this.emitYBase + this.params.flameYOffset + (h / 2);
        }
      }
    }
  }

  _applyUniforms(){
    const mat = this.flameGroups[0]?.children[0]?.material;
    if (!mat?.uniforms) return;
    const u = mat.uniforms;

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

        // shaping
        uIntensity: { value: 1.0 },
        uTaper:     { value: 0.4 },
        uBulge:     { value: 0.1 },
        uTear:      { value: 0.85 },
        uTurb:      { value: 0.2 },
        uNoiseSpeed:{ value: 1.8 },
        uDiamondsStrength: { value: 0.4 },
        uDiamondsFreq:     { value: 12.0 },

        // halo
        uRimStrength: { value: 0.3 },
        uRimSpeed:    { value: 2.8 },

        // colors
        uCyanMul:   { value: 1.0 },
        uOrangeMul: { value: 1.0 },
        uWhiteMul:  { value: 1.2 },
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

        // cheap hash/fbm for noise
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }

        // --- REVISED: Stronger teardrop shape ---
        float radiusProfile(float y){
          float baseR = mix(0.50, 0.28, clamp(uTaper,0.0,1.0));
          float bulge = uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y-0.175)) * 0.35;
          float r = baseR + bulge;
          r = mix(r, 0.10, smoothstep(0.60, 0.90, y));
          // Sharper, more powerful pinch for the teardrop effect
          float pinch = pow(smoothstep(0.75, 1.0, y), mix(4.0, 15.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch);
          return r;
        }

        void main(){
          float y = clamp(vUv.y, 0.0, 1.0); // y=0 is base (nozzle), y=1 is tail

          // Lateral wobble for turbulence
          float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          float x = abs(vUv.x - 0.5 + wob);

          // Main cylindrical flame body
          float r = radiusProfile(y);
          float body = smoothstep(r, r-0.14, x);

          // Soft fade-in at base and tail
          body *= smoothstep(0.00, 0.06, y) * (1.0 - smoothstep(0.96, 1.00, y));

          // Mach diamonds
          float bands = 0.5 + 0.5*sin(y*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y));
          body *= diamonds;

          // --- REVISED: More vibrant color ramp ---
          // Transitions from a white/cyan core to a fiery orange tail
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.3, 0.85, y));

          // Noisy halo around the flame edge
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
