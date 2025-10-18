// src/effects/InstancedFlames.js
import * as THREE from 'three';
import { FlameFragmentShader } from './FlameShader.js';
import { DEFAULT_FLAME_PARAMS, cloneDefaults, applyParamsToUniforms } from './FlameDefaults.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function mix(a, b, t) { return a * (1.0 - t) + b * t; }
function smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
function fract(x) { return x - Math.floor(x); }
function n2(v) { return fract(Math.sin(v.dot(new THREE.Vector2(127.1, 311.7))) * 43758.5453); }
function fbm(v) {
  const p = v.clone();
  let a = 0.0, w = 0.5;
  for (let i = 0; i < 4; i++) { a += w * n2(p); p.multiplyScalar(2.03).add(new THREE.Vector2(1.7, 1.7)); w *= 0.5; }
  return a;
}

export class InstancedFlames {
  constructor(rocketRoot, offsets = [], paramsBaseline = {}) {
    this.rocketRoot = rocketRoot;
    this.params = Object.assign(cloneDefaults(), paramsBaseline || {});
    this.flameWidthBase = 3.5; this.flameHeightBase = 40.0; this.segments = 32;

    this.ignitionDelayMs = 2800; this.ignitionTimer = null; this.ignitionPending = false;

    this.geometry = new THREE.CylinderGeometry(0.001, 0.001, this.flameHeightBase, this.segments, 20, true);
    this.geometry.translate(0, -this.flameHeightBase / 2, 0);

    this.material = this._makeFlameMaterial();

    const count = Math.max(0, offsets.length | 0);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'InstancedFlames';

    this.initialVertices = [];
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos, i));

    // Attach to scene root (same reference as EngineFX)
    const parent = rocketRoot?.parent || rocketRoot;
    parent.add(this.mesh);

    this._applyInstanceMatrices(offsets);
    this._applyVisibility();
    this._applyUniforms();
  }

  setOffsets(offsets = []) {
    const n = Math.max(0, offsets.length | 0);
    if (n !== this.mesh.count) {
      const old = this.mesh;
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
      this.mesh.frustumCulled = false;
      this.mesh.name = 'InstancedFlames';
      const parent = old.parent || this.rocketRoot?.parent || this.rocketRoot;
      if (parent) parent.add(this.mesh);
      old.removeFromParent?.();
      old.dispose?.();
    }
    this._applyInstanceMatrices(offsets);
  }

  setIgnition(on) {
    if (on) {
      if (this.params.enginesOn || this.ignitionPending) return;
      this.ignitionPending = true; clearTimeout(this.ignitionTimer);
      this.ignitionTimer = setTimeout(() => { this.params.enginesOn = true; this.ignitionPending = false; this._applyVisibility(); }, this.ignitionDelayMs);
    } else {
      clearTimeout(this.ignitionTimer); this.ignitionPending = false; this.params.enginesOn = false; this._applyVisibility();
    }
  }

  setParams(patch) {
    if (!patch) return;
    ['colorWhiteHex','colorCyanHex','colorOrangeHex'].forEach(k=>{
      if (typeof patch[k] === 'string') { try { new THREE.Color(patch[k]); } catch { delete patch[k]; } }
    });
    Object.assign(this.params, patch || {});
    this._applyUniforms();
    // If Y offset changed, re-bake instance matrices so Y matches
    if ('flameYOffset' in patch) this._reapplyMatricesWithSameOffsets();
  }

  update(delta, t) {
    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
      if (this.material?.uniforms?.uTime) this.material.uniforms.uTime.value = t;
    }
  }

  _reapplyMatricesWithSameOffsets() {
    // Read back existing matrices into offsets-like values is expensive; instead,
    // rely on caller to re-send offsets when needed. For safety we no-op here.
    // If you store your offsets externally, just call setOffsets(bakedOffsets) after changing Y offset.
  }

  _updateFlameGeometry(t) {
    const g = this.geometry, pos = g.attributes.position;
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
    const dummy = new THREE.Object3D();
    const upY = 10.0 + this.params.flameYOffset;
    for (let i = 0; i < this.mesh.count; i++) {
      const o = offsets[i] || { groupOffsetX: 0, groupOffsetY: 0, groupOffsetZ: 0 };
      dummy.position.set(o.groupOffsetX, upY + o.groupOffsetY, o.groupOffsetZ);
      dummy.rotation.set(0,0,0);
      dummy.scale.set(1,1,1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.position.set(0,0,0); this.mesh.rotation.set(0,0,0); this.mesh.scale.set(1,1,1);
  }

  _applyVisibility(){ this.mesh.visible = !!this.params.enginesOn; }

  _applyUniforms(){ applyParamsToUniforms(this.material?.uniforms, this.params); }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0.0 },
        uIntensity:        { value: DEFAULT_FLAME_PARAMS.intensity },
        uDiamondsStrength: { value: DEFAULT_FLAME_PARAMS.diamondsStrength },
        uDiamondsFreq:     { value: DEFAULT_FLAME_PARAMS.diamondsFreq },
        uRimStrength:      { value: DEFAULT_FLAME_PARAMS.rimStrength },
        uRimSpeed:         { value: DEFAULT_FLAME_PARAMS.rimSpeed },
        uCyanMul:          { value: DEFAULT_FLAME_PARAMS.colorCyan },
        uOrangeMul:        { value: DEFAULT_FLAME_PARAMS.colorOrange },
        uWhiteMul:         { value: DEFAULT_FLAME_PARAMS.colorWhite },
        uCyan:             { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorCyanHex) },
        uWhite:            { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorWhiteHex) },
        uOrange:           { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorOrangeHex) },
        uTailStart:        { value: DEFAULT_FLAME_PARAMS.tailFadeStart },
        uTailFeather:      { value: DEFAULT_FLAME_PARAMS.tailFeather },
        uTailNoise:        { value: DEFAULT_FLAME_PARAMS.tailNoise },
        uBottomDepth:      { value: DEFAULT_FLAME_PARAMS.bottomFadeDepth },
        uBottomFeather:    { value: DEFAULT_FLAME_PARAMS.bottomFadeFeather },
        uOrangeShift:      { value: DEFAULT_FLAME_PARAMS.orangeShift }
      },
      vertexShader: `
        varying float y_norm;
        void main() {
          y_norm = position.y / -40.0;
          // instanceMatrix is world-space (we attach to scene and bake world matrices)
          gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: FlameFragmentShader
    });
  }
}