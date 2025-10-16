// src/effects/EngineFX.js
// --- CORRECTED VERSION 2 ---
// The flame is now DETACHED from the rocket and placed at a fixed
// world position of (0, 10, 0) for debugging and guaranteed visibility.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene; // We need the scene to add the flame directly to it
    this.camera = camera;

    // Base flame dimensions
    this.flameWidthBase  = 3.5;
    this.flameHeightBase = 40.0;

    // Default parameters for a good look
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
    // --- MODIFICATION ---
    // Attach the flame group directly to the main scene, not the rocket.
    // This ignores the rocket's position entirely.
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
    // --- MODIFICATION ---
    // Set the group's position to a fixed point in the world (0, 10, 0).
    // The panel sliders will now offset the flame from this new base position.
    this.group.position.set(
      0.0 + this.params.groupOffsetX,
      10.0 + this.params.groupOffsetY,
      0.0 + this.params.groupOffsetZ
    );

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    for (const p of this.planes) {
      p.scale.set(w, h, 1);
      // Position planes so their base starts at the group's origin.
      // The panel's Y-Offset will move it up/down from here.
      p.position.y = (h / 2) + this.params.flameYOffset;
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
    // This function remains unchanged as the shader logic is correct.
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms:{
        uTime: { value: 0.0 }, uIntensity: { value: 1.2 }, uTaper: { value: 0.4 },
        uBulge: { value: 0.1 }, uTear: { value: 0.85 }, uTurb: { value: 0.2 },
        uNoiseSpeed:{ value: 1.8 }, uDiamondsStrength: { value: 0.4 }, uDiamondsFreq: { value: 12.0 },
        uRimStrength: { value: 0.3 }, uRimSpeed: { value: 2.8 }, uCyanMul: { value: 1.0 },
        uOrangeMul: { value: 1.0 }, uWhiteMul: { value: 1.2 }, uCyan: { value: new THREE.Color(0x80fbfd) },
        uWhite: { value: new THREE.Color(0xffffff) }, uOrange: { value: new THREE.Color(0xffac57) }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        precision mediump float; varying vec2 vUv; uniform float uTime;
        uniform float uIntensity, uTaper, uBulge, uTear, uTurb, uNoiseSpeed;
        uniform float uDiamondsStrength, uDiamondsFreq; uniform float uRimStrength, uRimSpeed;
        uniform float uCyanMul, uOrangeMul, uWhiteMul; uniform vec3 uCyan, uWhite, uOrange;
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0, w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }
        float radiusProfile(float y){
          float r = mix(0.50, 0.28, clamp(uTaper,0.0,1.0));
          r += uBulge * smoothstep(0.0, 0.35, 0.35 - abs(y-0.175)) * 0.35;
          r = mix(r, 0.10, smoothstep(0.60, 0.90, y));
          float pinch = pow(smoothstep(0.75, 1.0, y), mix(4.0, 15.0, clamp(uTear,0.0,1.0)));
          r = mix(r, 0.0, pinch); return r;
        }
        void main(){
          float y = vUv.y; float wob = (fbm(vec2(y*6.0, uTime*uNoiseSpeed)) - 0.5) * (0.35*uTurb);
          float x = abs(vUv.x - 0.5 + wob); float r = radiusProfile(y);
          float body = smoothstep(r, r-0.14, x);
          body *= smoothstep(0.00, 0.06, y) * (1.0 - smoothstep(0.96, 1.00, y));
          float bands = 0.5 + 0.5*sin(y*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, uDiamondsStrength);
          body *= mix(diamonds, 1.0, smoothstep(0.70, 1.0, y));
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.3, 0.85, y));
          float rim = smoothstep(r+0.05, r, x) * (fbm(vec2((x-r)*24.0, uTime*uRimSpeed))*0.5+0.5);
          float halo = rim * uRimStrength; float alpha = (body + halo) * uIntensity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }`
    });
  }
}
