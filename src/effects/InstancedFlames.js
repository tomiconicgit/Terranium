// src/effects/InstancedFlames.js
import * as THREE from 'three';
import { FlameFragmentShader } from './FlameShader.js';

// Tiny utils (match EngineFX.js)
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function mix(a, b, t) { return a * (1.0 - t) + b * t; }
function smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// Noise helpers (CPU side for vertex wobble)
function fract(x) { return x - Math.floor(x); }
function n2(v) {
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
  constructor(rocketRoot, offsets = [], paramsBaseline = {}) {
    this.rocketRoot = rocketRoot;

    // Defaults overridden by paramsBaseline
    this.params = Object.assign({
      enginesOn: false,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,
      intensity: 1.5,
      taper: 0.0,
      bulge: 1.0,                // panel now allows up to 3.0; code supports >1
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

      // NEW: editable base colors (match EngineFX)
      colorWhiteHex:  '#ffffff',
      colorCyanHex:   '#80fbfd',
      colorOrangeHex: '#ffac57',
    }, paramsBaseline || {});

    this.flameWidthBase = 3.5;
    this.flameHeightBase = 40.0;
    this.segments = 32;

    this.ignitionDelayMs = 2800;
    this.ignitionTimer = null;
    this.ignitionPending = false;

    this.geometry = new THREE.CylinderGeometry(0.001, 0.001, this.flameHeightBase, this.segments, 20, true);
    this.geometry.translate(0, -this.flameHeightBase / 2, 0);

    this.material = this._makeFlameMaterial();
    const count = Math.max(0, offsets.length | 0);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'InstancedFlames';

    this.initialVertices = [];
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    }

    // Cache inverse parent scale used to neutralize rocketRoot scaling.
    this._invParentScale = new THREE.Vector3(1, 1, 1);
    this._refreshInverseParentScale();

    this.rocketRoot.add(this.mesh);
    this._applyInstanceMatrices(offsets);
    this._applyVisibility();
    this._applyUniforms();
  }

  // If your rocket model scale changes at runtime, call this and then setOffsets(...)
  _refreshInverseParentScale() {
    const s = new THREE.Vector3(1, 1, 1);
    this.rocketRoot.updateWorldMatrix(true, false);
    this.rocketRoot.getWorldScale(s);
    this._invParentScale.set(
      s.x !== 0 ? 1 / s.x : 1,
      s.y !== 0 ? 1 / s.y : 1,
      s.z !== 0 ? 1 / s.z : 1
    );
  }

  setOffsets(offsets = []) {
    const n = Math.max(0, offsets.length | 0);
    if (n !== this.mesh.count) {
      const old = this.mesh;
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
      this.mesh.frustumCulled = false;
      this.mesh.name = 'InstancedFlames';
      this.rocketRoot.remove(old);
      this.rocketRoot.add(this.mesh);
      old.dispose?.();
    }
    this._refreshInverseParentScale();
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

  setParams(patch) {
    if (!patch) return;

    // Colors: accept hex strings like "#aabbcc"
    ['colorWhiteHex','colorCyanHex','colorOrangeHex'].forEach(k=>{
      if (typeof patch[k] === 'string') {
        try { new THREE.Color(patch[k]); } catch { delete patch[k]; }
      }
    });

    Object.assign(this.params, patch || {});
    this._applyUniforms();
  }

  update(delta, t) {
    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
      if (this.material?.uniforms?.uTime) {
        this.material.uniforms.uTime.value = t;
      }
    }
  }

  _updateFlameGeometry(t) {
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
  }

  _applyInstanceMatrices(offsets) {
    const inv = this._invParentScale;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.mesh.count; i++) {
      const o = offsets[i] || { groupOffsetX: 0, groupOffsetY: 0, groupOffsetZ: 0 };
      const px = o.groupOffsetX * inv.x;
      const py = (10.0 + this.params.flameYOffset + o.groupOffsetY) * inv.y;
      const pz = o.groupOffsetZ * inv.z;

      dummy.position.set(px, py, pz);
      // neutralize parent scale so resulting world scale == editable flame
      dummy.scale.set(inv.x, inv.y, inv.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.scale.set(1, 1, 1);
  }

  _applyVisibility() {
    this.mesh.visible = !!this.params.enginesOn;
  }

  _applyUniforms() {
    const u = this.material?.uniforms;
    if (!u) return;

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
    u.uBottomFeather.value = this.params.bottomFeather;
    u.uOrangeShift.value = this.params.orangeShift;

    // NEW: base color uniforms from hex
    try { u.uWhite.value.set(this.params.colorWhiteHex); } catch {}
    try { u.uCyan.value.set(this.params.colorCyanHex); } catch {}
    try { u.uOrange.value.set(this.params.colorOrangeHex); } catch {}
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
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
        uCyan: { value: new THREE.Color(this.params.colorCyanHex) },
        uWhite: { value: new THREE.Color(this.params.colorWhiteHex) },
        uOrange: { value: new THREE.Color(this.params.colorOrangeHex) },
        uTailStart: { value: this.params.tailFadeStart },
        uTailFeather: { value: this.params.tailFeather },
        uTailNoise: { value: this.params.tailNoise },
        uBottomDepth: { value: this.params.bottomFadeDepth },
        uBottomFeather: { value: this.params.bottomFeather },
        uOrangeShift: { value: this.params.orangeShift },
      },
      vertexShader: `
        varying float y_norm;
        void main() {
          // NOTE: base flame height is 40.0 (same as EngineFX)
          y_norm = position.y / -40.0;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: FlameFragmentShader
    });
  }
}