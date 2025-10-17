// src/effects/InstancedFlames.js
// GPU-friendly batch of identical flames using InstancedMesh.
// Matches the EngineFX look/controls as closely as possible and obeys the 2800ms ignition delay.

import * as THREE from 'three';

export class InstancedFlames {
  /**
   * @param {THREE.Object3D} rocketRoot - parent so instances move with the rocket
   * @param {THREE.Scene} scene
   * @param {Array<{index:number, groupOffsetX:number, groupOffsetY:number, groupOffsetZ:number}>} bakedList
   */
  constructor(rocketRoot, scene, bakedList = []) {
    this.rocket = rocketRoot;
    this.scene = scene;

    // keep params aligned with EngineFX defaults (no light/audio in the batch)
    this.params = {
      flameWidthFactor: 0.7, flameHeightFactor: 0.8, flameYOffset: 7.6,
      intensity: 1.5, taper: 0.0, bulge: 1.0, tear: 1.0, turbulence: 0.5, noiseSpeed: 2.2,
      diamondsStrength: 0.9, diamondsFreq: 2.8, rimStrength: 0.0, rimSpeed: 4.1,
      colorCyan: 0.5, colorOrange: 3.0, colorWhite: 0.9,
      tailFadeStart: 0.3, tailFeather: 4.0, tailNoise: 0.2,
      bottomFadeDepth: 0.12, bottomFadeFeather: 0.80,
      orangeShift: -0.2
    };

    this._enginesOn = false;
    this._pendingTimer = null;
    this.ignitionDelayMs = 2800;

    // Geometry: keep same base as EngineFX (40m tall cylinder, origin at nozzle)
    const flameHeightBase = 40.0;
    const segments = 32;
    const geometry = new THREE.CylinderGeometry(0.001, 0.001, flameHeightBase, segments, 20, true);
    geometry.translate(0, -flameHeightBase / 2, 0); // origin at nozzle (bottom)

    // Material: same uniforms + an on/off toggle
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0.0 },
        uIntensity: { value: this.params.intensity },
        uDiamondsStrength: { value: this.params.diamondsStrength },
        uDiamondsFreq: { value: this.params.diamondsFreq },
        uRimStrength: { value: this.params.rimStrength },
        uRimSpeed: { value: this.params.rimSpeed },

        uCyanMul: { value: this.params.colorCyan },
        uOrangeMul: { value: this.params.colorOrange },
        uWhiteMul: { value: this.params.colorWhite },
        uCyan: { value: new THREE.Color(0x80fbfd) },
        uWhite: { value: new THREE.Color(0xffffff) },
        uOrange: { value: new THREE.Color(0xffac57) },

        uTailStart: { value: this.params.tailFadeStart },
        uTailFeather: { value: this.params.tailFeather },
        uTailNoise: { value: this.params.tailNoise },

        uBottomDepth: { value: this.params.bottomFadeDepth },
        uBottomFeather: { value: this.params.bottomFadeFeather },

        uOrangeShift: { value: this.params.orangeShift },

        uWidth:  { value: this.params.flameWidthFactor * 3.5 },   // 3.5 = EngineFX base width
        uHeight: { value: this.params.flameHeightFactor * 40.0 }, // 40  = EngineFX base height
        uNoiseSpeed: { value: this.params.noiseSpeed },
        uTaper: { value: this.params.taper },
        uBulge: { value: this.params.bulge },
        uTear:  { value: this.params.tear },
        uTurbulence: { value: this.params.turbulence },

        uEnginesOn: { value: 0.0 } // 0=off, 1=on
      },
      vertexShader: `
        varying float y_norm;
        varying vec3 vNormal;

        void main(){
          // geometry already sits from y=0 (nozzle) down to -40
          y_norm = position.y / -40.0;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vNormal;
        varying float y_norm;

        uniform float uTime,uIntensity,uDiamondsStrength,uDiamondsFreq,uRimStrength,uRimSpeed;
        uniform float uCyanMul,uOrangeMul,uWhiteMul; uniform vec3 uCyan,uWhite,uOrange;
        uniform float uTailStart,uTailFeather,uTailNoise;
        uniform float uBottomDepth,uBottomFeather; uniform float uOrangeShift;
        uniform float uEnginesOn;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

        void main(){
          if (uEnginesOn < 0.5) discard;

          float bands = 0.5 + 0.5*sin(y_norm*uDiamondsFreq*6.2831853);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_norm));

          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0,0.25,y_norm));
          float o0 = 0.30 + uOrangeShift; float o1 = 0.85 + uOrangeShift;
          col = mix(col, uOrange*uOrangeMul, smoothstep(o0,o1,y_norm));
          col *= diamonds;

          float tail = 1.0 - smoothstep(uTailStart, 1.0, y_norm);
          tail = pow(max(tail,0.0), max(uTailFeather,0.0001));
          float tailJitter = (fbm(vec2(y_norm*18.0, uTime*1.3)) - 0.5) * uTailNoise;
          float alphaTail  = clamp(tail + tailJitter, 0.0, 1.0);

          float bottom = smoothstep(0.0, max(uBottomDepth, 1e-5), y_norm);
          bottom = pow(bottom, max(uBottomFeather, 0.0001));

          float rim = fbm(vec2(y_norm*10.0, uTime*uRimSpeed)) * uRimStrength;

          float alpha = (alphaTail * bottom + rim) * uIntensity;
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });

    // Create instanced mesh and parent it under the rocket so everything moves together
    const count = bakedList.length;
    this.mesh = new THREE.InstancedMesh(geometry, this.mat, count);
    this.mesh.name = 'InstancedFlames';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false; // start hidden (off)
    this.mesh.userData.__engineFX = this; // lets Main's picker treat the batch as a target if needed

    // Put the whole batch at the nozzle Y offset; instances add X/Z + extra Y
    this.mesh.position.y = this.params.flameYOffset;
    this.rocket.add(this.mesh);

    // Fill instance transforms from the baked list (X/Z; Y includes rocket base lift)
    const temp = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const f = bakedList[i];
      const offsetX = f.groupOffsetX || 0;
      const offsetY = (f.groupOffsetY || 0) + 10.0; // match EngineFX _applyTransforms() base Y
      const offsetZ = f.groupOffsetZ || 0;

      temp.position.set(offsetX, offsetY, offsetZ);
      temp.rotation.set(0, 0, 0);
      temp.scale.set(1, 1, 1);
      temp.updateMatrix();
      this.mesh.setMatrixAt(i, temp.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);
  }

  // Keep API aligned with EngineFX where possible
  setParams(patch = {}) {
    Object.assign(this.params, patch);

    // Update uniforms
    const u = this.mat.uniforms;
    u.uIntensity.value = this.params.intensity;
    u.uDiamondsStrength.value = this.params.diamondsStrength;
    u.uDiamondsFreq.value = this.params.diamondsFreq;
    u.uRimStrength.value = this.params.rimStrength;
    u.uRimSpeed.value = this.params.rimSpeed;

    u.uCyanMul.value = this.params.colorCyan;
    u.uOrangeMul.value = this.params.colorOrange;
    u.uWhiteMul.value = this.params.colorWhite;

    u.uTailStart.value = this.params.tailFadeStart;
    u.uTailFeather.value = this.params.tailFeather;
    u.uTailNoise.value = this.params.tailNoise;

    u.uBottomDepth.value = this.params.bottomFadeDepth;
    u.uBottomFeather.value = this.params.bottomFadeFeather;
    u.uOrangeShift.value = this.params.orangeShift;

    // Geometry scale proxies (kept as uniforms; CPU-deformed shape lives in EngineFX only)
    u.uWidth.value  = this.params.flameWidthFactor  * 3.5;
    u.uHeight.value = this.params.flameHeightFactor * 40.0;
    u.uNoiseSpeed.value = this.params.noiseSpeed;

    // Vertical offset (batch)
    this.mesh.position.y = this.params.flameYOffset;
  }

  setIgnition(on) {
    if (on) {
      if (this._enginesOn || this._pendingTimer) return;
      this._pendingTimer = setTimeout(() => {
        this._pendingTimer = null;
        this._enginesOn = true;
        this.mat.uniforms.uEnginesOn.value = 1.0;
        this.mesh.visible = true; // ensure it actually renders
        console.log('[InstancedFlames] Engines ON');
      }, this.ignitionDelayMs);
    } else {
      if (this._pendingTimer) { clearTimeout(this._pendingTimer); this._pendingTimer = null; }
      this._enginesOn = false;
      this.mat.uniforms.uEnginesOn.value = 0.0;
      this.mesh.visible = false; // hide fully
      console.log('[InstancedFlames] Engines OFF');
    }
  }

  getIgnition() { return !!this._enginesOn; }

  update(delta, t) {
    this.mat.uniforms.uTime.value = t;
  }

  // For parity with picker API (not used for dragging this batch)
  getRaycastTargets() { return [this.mesh]; }
}