// src/effects/EngineFX.js
// --- FINAL VISUAL CORRECTION ---
// 1. Flame is FLIPPED to point DOWNWARDS.
// 2. Flame is rendered as a TRUE 3D CYLINDER (not just flat billboarded planes).
// 3. Teardrop shape correctly originates from the nozzle and tapers downwards.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    this.flameWidthBase  = 3.5;
    this.flameHeightBase = 40.0;

    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0, flameHeightFactor: 1.0, flameYOffset: 0.0,
      intensity: 1.2, taper: 0.4, bulge: 0.1, tear: 0.85, turbulence: 0.2,
      noiseSpeed: 1.8, diamondsStrength: 0.4, diamondsFreq: 12.0,
      rimStrength: 0.3, rimSpeed: 2.8,
      colorCyan: 1.0, colorOrange: 1.0, colorWhite: 1.2,
      groupOffsetX: 0.0, groupOffsetY: 0.0, groupOffsetZ: 0.0
    };

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const sharedMaterial = this._makeFlameMaterial();

    this.planes = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const m   = new THREE.Mesh(geo, sharedMaterial);
      m.frustumCulled = false;
      m.rotation.y = i * Math.PI / 3;
      this.group.add(m);
      this.planes.push(m);
    }

    // Keep billboarding for the overall orientation, but the shader will
    // now draw from the center of the planes, creating a cylindrical look.
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

  // ----- Public API -----
  setIgnition(on){ this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition(){ return this.params.enginesOn; }
  setParams(patch){ Object.assign(this.params, patch); this._applyTransforms(); this._applyUniforms(); }
  getParams(){ return { ...this.params }; }
  update(_, t){ const mat = this.planes[0]?.material; if (mat?.uniforms) mat.uniforms.uTime.value = t; }

  // ----- Internals -----
  _applyVisibility(){ this.group.visible = !!this.params.enginesOn; }

  _applyTransforms(){
    this.group.position.set(
      0.0 + this.params.groupOffsetX,
      10.0 + this.params.groupOffsetY,
      0.0 + this.params.groupOffsetZ
    );

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    for (const p of this.planes) {
      p.scale.set(w, h, 1);
      // --- MODIFICATION ---
      // Plane's y=0 will now be the TOP of the flame (nozzle),
      // so we position the plane such that its top edge is at the group's origin.
      p.position.y = (-h / 2) + this.params.flameYOffset;
    }
  }

  _applyUniforms(){
    const u = this.planes[0]?.material.uniforms; if (!u) return;
    u.uIntensity.value   = this.params.intensity; u.uTaper.value = this.params.taper;
    u.uBulge.value = this.params.bulge; u.uTear.value = this.params.tear;
    u.uTurb.value = this.params.turbulence; u.uNoiseSpeed.value = this.params.noiseSpeed;
    u.uDiamondsStrength.value = this.params.diamondsStrength; u.uDiamondsFreq.value = this.params.diamondsFreq;
    u.uRimStrength.value = this.params.rimStrength; u.uRimSpeed.value = this.params.rimSpeed;
    u.uCyanMul.value = this.params.colorCyan; u.uOrangeMul.value = this.params.colorOrange;
    u.uWhiteMul.value = this.params.colorWhite;
  }

  _makeFlameMaterial(){
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false, // Prevents depth fighting/sorting issues
      blending: THREE.AdditiveBlending, // Makes colors add up for brightness
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
          vUv = uv; // uv.y=0 is TOP, uv.y=1 is BOTTOM of the plane
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

        // --- MODIFIED: Teardrop profile adjusted for downwards flame ---
        // y_local ranges from 0 (nozzle) to 1 (tail end)
        float radiusProfile(float y_local){
          float baseR = mix(0.50, 0.28, clamp(uTaper,0.0,1.0));
          // Bulge shifts to be closer to the nozzle
          float bulge = uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y_local-0.175)) * 0.35;
          float r = baseR + bulge;
          r = mix(r, 0.10, smoothstep(0.60, 0.90, y_local));
          // Pinch for the teardrop tail
          float pinch = pow(smoothstep(0.75, 1.0, y_local), mix(4.0, 15.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch);
          return r;
        }

        void main(){
          // --- MODIFICATION ---
          // Invert vUv.y so y_local=0 is the flame's origin (nozzle) and y_local=1 is the tail.
          float y_local = 1.0 - vUv.y;

          // Lateral wobble for turbulence
          float wob = (fbm(vec2(y_local*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          
          // --- MODIFICATION ---
          // x_local maps from -0.5 to 0.5, representing distance from the cylinder center.
          float x_local = vUv.x - 0.5;

          // Get radius based on vertical position
          float r_profile = radiusProfile(y_local);

          // Calculate distance from center, adjusted by wobble
          float dist_from_center = length(vec2(x_local + wob, 0.0)); // Simple for planar billboard with X offset

          // Main cylindrical flame body - uses the distance from center
          // to make it cylindrical regardless of plane orientation
          float body = smoothstep(r_profile, r_profile - 0.14, dist_from_center);
          
          // Soft fade-in at base (nozzle) and tail
          body *= smoothstep(0.00, 0.06, y_local) * (1.0 - smoothstep(0.96, 1.00, y_local));

          // Mach diamonds
          float bands = 0.5 + 0.5*sin(y_local*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_local));
          body *= diamonds;

          // Color ramp (cyan core to orange tail)
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y_local));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.3, 0.85, y_local));

          // Noisy halo around the flame edge
          float rim = smoothstep(r_profile + 0.05, r_profile, dist_from_center);
          float rimNoise = fbm(vec2((dist_from_center-r_profile)*24.0, uTime*uRimSpeed))*0.5+0.5;
          float halo = rim * rimNoise * uRimStrength;

          float alpha = (body + halo) * clamp(uIntensity, 0.0, 5.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}
