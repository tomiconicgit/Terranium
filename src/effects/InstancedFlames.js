// src/effects/InstancedFlames.js
// GPU-friendly multi-flame renderer using InstancedMesh.
// Shares a single animated geometry & shader across N instances.
// Each instance is positioned from baked offsets (X/Z + Y and flameYOffset).

import * as THREE from 'three';

// tiny utils (match EngineFX.js)
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function mix(a, b, t) { return a * (1.0 - t) + b * t; }
function smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// noise helpers (CPU side for vertex wobble)
function fract(x) { return x - Math.floor(x); }
function n2(v) {
  // v: THREE.Vector2
  return fract(Math.sin(v.dot(new THREE.Vector2(127.1, 311.7))) * 43758.5453);
}
function fbm(v) {
  const p = v.clone();
  let a = 0.0, w = 0.5;
  for (let i = 0; i < 4; i++) {
    a += w * n2(p);
    p.multiplyScalar(2.03).add(new THREE.Vector2(1.7, 1.7));
    w *= 0.5;
  }
  return a;
}

export class InstancedFlames {
  /**
   * @param {THREE.Group} rocketRoot - parent to attach under (the rocket)
   * @param {THREE.Scene} scene      - (not strictly needed; kept for parity)
   * @param {THREE.Camera} camera    - (not used; parity with EngineFX)
   * @param {Array<{groupOffsetX:number,groupOffsetY:number,groupOffsetZ:number}>} offsets
   * @param {object} paramsBaseline  - defaults to EngineFX defaults (subset used)
   */
  constructor(rocketRoot, scene, camera, offsets = [], paramsBaseline = {}) {
    this.rocketRoot = rocketRoot;
    this.scene = scene;
    this.camera = camera;

    // match core EngineFX tunables (only the ones the shader/geo uses)
    this.params = Object.assign({
      enginesOn: false,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,
      taper: 0.0,
      bulge: 1.0,
      tear: 1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2,
      diamondsStrength: 0.9,
      diamondsFreq: 2.8,
      rimStrength: 0.0,
      rimSpeed: 4.1,
      colorCyan: 0.5,
      colorOrange: 3.0,
      colorWhite: 0.9,
      tailFadeStart: 0.3,
      tailFeather: 4.0,
      tailNoise: 0.2,
      bottomFadeDepth: 0.12,
      bottomFadeFeather: 0.80,
      orangeShift: -0.2,
      lightIntensity: 50.0,
      lightDistance: 800.0,
    }, paramsBaseline || {});

    this.flameWidthBase = 3.5;
    this.flameHeightBase = 40.0;
    this.segments = 32;

    // ignition timing (no audio here; the editable single flame handles audio)
    this.ignitionDelayMs = 2800;
    this.ignitionTimer = null;
    this.ignitionPending = false;

    // build shared geometry/material
    this.geometry = new THREE.CylinderGeometry(0.001, 0.001, this.flameHeightBase, this.segments, 20, true);
    this.geometry.translate(0, -this.flameHeightBase / 2, 0);

    this.material = this._makeFlameMaterial();
    const count = Math.max(0, offsets.length | 0);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'InstancedFlames';

    // Cache original vertices for CPU animation
    this.initialVertices = [];
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    }

    // attach under rocket so it inherits rocket transforms
    this.rocketRoot.add(this.mesh);

    // place instances
    this._applyInstanceMatrices(offsets);

    // visibility by ignition
    this._applyVisibility();
  }

  setOffsets(offsets = []) {
    const n = Math.max(0, offsets.length | 0);
    if (n !== this.mesh.count) {
      // recreate InstancedMesh with new count
      const old = this.mesh;
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
      this.mesh.frustumCulled = false;
      this.mesh.name = 'InstancedFlames';
      // attach in same place
      this.rocketRoot.remove(old);
      this.rocketRoot.add(this.mesh);
      old.dispose?.(); // frees only instance buffers; geo/mat reused
    }
    this._applyInstanceMatrices(offsets);
  }

  setIgnition(on) {
    if (on) {
      if (this.params.enginesOn || this.ignitionPending) return;
      this.ignitionPending = true;
      clearTimeout(this.ignitionTimer);
      this.ignitionTimer = setTimeout(() => {
        this.params.enginesOn = true;
        this.ignitionPending = false;
        this._applyVisibility();
      }, this.ignitionDelayMs);
    } else {
      clearTimeout(this.ignitionTimer);
      this.ignitionPending = false;
      this.params.enginesOn = false;
      this._applyVisibility();
    }
  }
  getIgnition() { return this.params.enginesOn; }

  setParams(patch) {
    Object.assign(this.params, patch || {});
    // uniforms depend on params, so push changes
    this._applyUniforms();
    // instance matrices depend on y offset
    // (call setOffsets again from Main if you change the baked list)
  }

  update(delta, t) {
    // animate shared geometry once; all instances share it
    if (this.params.enginesOn) {
      const g = this.geometry;
      const pos = g.attributes.position;

      const w = this.flameWidthBase * this.params.flameWidthFactor;
      const h = this.flameHeightBase * this.params.flameHeightFactor;

      const radiusProfile = (y_norm) => {
        let r = mix(0.50, 0.28, clamp(this.params.taper, 0.0, 1.0));
        r += this.params.bulge * smoothstep(0.0, 0.35, 0.35 - Math.abs(y_norm - 0.175)) * 0.35;
        r = mix(r, 0.10, smoothstep(0.60, 0.90, y_norm));
        const pinch = Math.pow(smoothstep(0.75, 1.0, y_norm), mix(4.0, 15.0, clamp(this.params.tear, 0.0, 1.0)));
        r = mix(r, 0.0, pinch);
        return r * w;
      };

      const tmp = new THREE.Vector2();
      for (let i = 0; i < pos.count; i++) {
        const ov = this.initialVertices[i];
        const y0 = ov.y;
        const y_norm = (y0 / -h);
        const curR = radiusProfile(y_norm);

        tmp.set(ov.x, ov.z);
        const ang = Math.atan2(tmp.y, tmp.x);

        tmp.set(y_norm * 6.0, t * this.params.noiseSpeed);
        const wob = (fbm(tmp.clone()) - 0.5) * (0.35 * this.params.turbulence * w);

        const ro = curR + wob;
        pos.setX(i, Math.cos(ang) * ro);
        pos.setZ(i, Math.sin(ang) * ro);
        pos.setY(i, y0 * this.params.flameHeightFactor);

        if (y_norm < 0.05) {
          const f = smoothstep(0.05, 0.0, y_norm);
          pos.setX(i, pos.getX(i) * f);
          pos.setZ(i, pos.getZ(i) * f);
        }
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();

      if (this.material?.uniforms?.uTime) {
        this.material.uniforms.uTime.value = t;
      }
    }
  }

  /* ---------- internals ---------- */

  _applyInstanceMatrices(offsets) {
    const count = this.mesh.count;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const o = offsets[i] || { groupOffsetX: 0, groupOffsetY: 0, groupOffsetZ: 0 };
      // include base height (~10 like EngineFX) + flameYOffset
      dummy.position.set(
        o.groupOffsetX,
        10.0 + this.params.flameYOffset + o.groupOffsetY,
        o.groupOffsetZ
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    // IMPORTANT: the instanced mesh itself must NOT be moved afterwards,
    // or all instances will shift together.
    this.mesh.position.set(0, 0, 0);
  }

  _applyVisibility() {
    this.mesh.visible = !!this.params.enginesOn;
  }

  _applyUniforms() {
    const u = this.material?.uniforms;
    if (!u) return;

    u.uIntensity.value = 1.0; // overall alpha scaling comes from EngineFX params; keep simple here
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
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0.0 },
        uIntensity: { value: 1.5 },
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
      },
      vertexShader: `
        varying float y_norm;
        void main() {
          // flame height base is ~40, mesh is translated so y in [-h, 0]
          y_norm = position.y / -40.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying float y_norm;

        uniform float uTime, uIntensity, uDiamondsStrength, uDiamondsFreq;
        uniform float uRimStrength, uRimSpeed;
        uniform float uCyanMul, uOrangeMul, uWhiteMul;
        uniform vec3  uCyan, uWhite, uOrange;
        uniform float uTailStart, uTailFeather, uTailNoise;
        uniform float uBottomDepth, uBottomFeather;
        uniform float uOrangeShift;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

        void main() {
          float bands = 0.5 + 0.5 * sin(y_norm * uDiamondsFreq * 6.2831853);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength, 0.0, 2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_norm));

          vec3 col = mix(uWhite * uWhiteMul, uCyan * uCyanMul, smoothstep(0.0, 0.25, y_norm));
          float o0 = 0.30 + uOrangeShift;
          float o1 = 0.85 + uOrangeShift;
          col = mix(col, uOrange * uOrangeMul, smoothstep(o0, o1, y_norm));
          col *= diamonds;

          float tail = 1.0 - smoothstep(uTailStart, 1.0, y_norm);
          tail = pow(max(tail, 0.0), max(uTailFeather, 0.0001));
          float tailJitter = (fbm(vec2(y_norm * 18.0, uTime * 1.3)) - 0.5) * uTailNoise;
          float alphaTail  = clamp(tail + tailJitter, 0.0, 1.0);

          float bottom = smoothstep(0.0, max(uBottomDepth, 1e-5), y_norm);
          bottom = pow(bottom, max(uBottomFeather, 0.0001));

          float rim = fbm(vec2(y_norm * 10.0, uTime * uRimSpeed)) * uRimStrength;
          float alpha = (alphaTail * bottom + rim) * uIntensity;

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}