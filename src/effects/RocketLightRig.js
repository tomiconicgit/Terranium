// src/effects/RocketLightRig.js
import * as THREE from 'three';

/**
 * RocketLightRig v2
 * - Key shadowed SpotLight (wide cone) to light the ground.
 * - 6 helper Spots (no shadows) around the plume to spread to ~50×50.
 * - Bounce Spot (no shadows) pointing up to light the rocket underside.
 * - Warm PointLight for near-field glow.
 * - Follows instanced flame centroid; brightness scales with engines/intensity.
 * - Runtime controls via setParams()/getParams() (used by Environment panel).
 */
export class RocketLightRig {
  constructor({ parent, rocketRoot, offsets = [], getParams }) {
    this.parent = parent;
    this.rocketRoot = rocketRoot;
    this.offsets = offsets;
    this.getParams = typeof getParams === 'function' ? getParams : () => ({ enginesOn:false, intensity:1 });

    this.group = new THREE.Group();
    this.group.name = 'RocketLightRig';
    (this.parent || this.rocketRoot).add(this.group);

    // ------- Runtime controls -------
    this.runtime = {
      spotAngleDeg: 60,              // wider for big pool
      spotPenumbra: 0.45,
      spotDistance: 160,             // reach ~50×50 on the deck
      spotIntensityScale: 1.0,
      pointIntensityScale: 1.0,
      cookieCore:   '#fff7e6',
      cookieOrange: '#ffba78',
      cookieCyan:   '#80fbfd',
    };

    // Derived sizes from engine layout
    this.localCentroid = computeLocalCentroid(this.offsets);
    this.clusterRadius = computeClusterRadius(this.offsets, this.localCentroid) || 3.0;

    // ------- Lights -------
    // Key spot (shadows on)
    this.key = new THREE.SpotLight(0xffffff, 0.0, this.runtime.spotDistance,
      THREE.MathUtils.degToRad(this.runtime.spotAngleDeg), this.runtime.spotPenumbra, 1.6);
    this.key.name = 'PlumeKeySpot';
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(4096, 4096);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far  = 450;
    this.key.shadow.bias = -0.00015;
    this.key.shadow.normalBias = 0.02;
    this.key.map = makePlumeCookieTexture(256, this.runtime.cookieCore, this.runtime.cookieOrange, this.runtime.cookieCyan);
    this.key.color.set(0xffffff);
    this.keyTarget = new THREE.Object3D();
    this.key.target = this.keyTarget;
    this.group.add(this.key, this.keyTarget);

    // Ring helper spots (spread pool, no shadows)
    this.ring = [];
    for (let k=0;k<6;k++){
      const s = new THREE.SpotLight(0xffe0b8, 0.0, this.runtime.spotDistance*1.1,
        THREE.MathUtils.degToRad(55), 0.5, 1.4);
      s.castShadow = false;
      this.group.add(s);
      const t = new THREE.Object3D();
      s.target = t; this.group.add(t);
      this.ring.push({ s, t });
    }

    // Bounce/up-light (no shadows) – lights the rocket underside
    this.bounce = new THREE.SpotLight(0xffc188, 0.0, 120, THREE.MathUtils.degToRad(65), 0.7, 1.3);
    this.bounce.castShadow = false;
    this.bounceTarget = new THREE.Object3D();
    this.bounce.target = this.bounceTarget;
    this.group.add(this.bounce, this.bounceTarget);

    // Near-field glow
    this.point = new THREE.PointLight(0xffcfa3, 0.0, 150, 1.5);
    this.point.castShadow = false;
    this.group.add(this.point);

    // Intensity caps
    this.maxKeyIntensity   = 60.0;
    this.maxRingIntensity  = 10.0;
    this.maxBounceIntensity= 18.0;
    this.maxPointIntensity = 10.0;

    this.anchor = new THREE.Vector3();
    this.dirDown = new THREE.Vector3(0, -1, 0);
  }

  /* ---------- UI Runtime Controls ---------- */
  setParams(patch = {}) {
    Object.assign(this.runtime, patch);
    if ('spotAngleDeg' in patch)   this.key.angle = THREE.MathUtils.degToRad(this.runtime.spotAngleDeg);
    if ('spotPenumbra' in patch)   this.key.penumbra = this.runtime.spotPenumbra;
    if ('spotDistance' in patch) {
      this.key.distance = this.runtime.spotDistance;
      for (const r of this.ring) r.s.distance = this.runtime.spotDistance * 1.1;
    }
    if ('cookieCore' in patch || 'cookieOrange' in patch || 'cookieCyan' in patch) {
      this.key.map?.dispose?.();
      this.key.map = makePlumeCookieTexture(256, this.runtime.cookieCore, this.runtime.cookieOrange, this.runtime.cookieCyan);
      this.key.needsUpdate = true;
    }
  }
  getParams(){ return { ...this.runtime }; }

  /* ---------- internals ---------- */
  _computeAnchor() {
    const p = this._flameParams();
    const upY = 10.0 + (p.flameYOffset ?? 7.6);
    this.anchor.set(this.localCentroid.x, upY + this.localCentroid.y, this.localCentroid.z);
  }
  _flameParams(){ return this.getParams(); }

  _desired() {
    const p = this._flameParams();
    const on = !!p.enginesOn;
    const I  = Math.max(0, Number(p.intensity ?? 1.0));
    const N  = Math.max(1, this.offsets.length || 1);
    const boost = Math.pow(N, 0.55);

    const baseKey   = on ? Math.min(this.maxKeyIntensity,    22.0 * I * boost) : 0.0;
    const baseRing  = on ? Math.min(this.maxRingIntensity,    4.0 * I * Math.pow(N,0.4)) : 0.0;
    const baseBounce= on ? Math.min(this.maxBounceIntensity,  7.0 * I) : 0.0;
    const basePoint = on ? Math.min(this.maxPointIntensity,   4.0 * I) : 0.0;

    return {
      key:    baseKey   * (this.runtime.spotIntensityScale  ?? 1.0),
      ring:   baseRing  * (this.runtime.spotIntensityScale  ?? 1.0),
      bounce: baseBounce* (this.runtime.spotIntensityScale  ?? 1.0),
      point:  basePoint * (this.runtime.pointIntensityScale ?? 1.0),
    };
  }

  update(dt/*, t */) {
    // Anchor near the flame exits
    this._computeAnchor();

    // --- Position/orient the key spot ---
    // Hover slightly below the engine plane, offset back a bit, point down
    const height = 6.0;                   // controls footprint; > height => bigger pool
    const back   = 3.0;
    const keyPos = tmp3.copy(this.anchor).addScaledVector(this.dirDown, -back).add(0, height, 0);
    this.key.position.copy(keyPos);
    this.keyTarget.position.copy(tmp3.copy(this.anchor).addScaledVector(this.dirDown, 12.0));

    // --- Ring helpers arranged around the cluster radius to broaden pool ---
    const R = Math.max(6.0, this.clusterRadius + 4.0);
    for (let i=0;i<this.ring.length;i++){
      const a = (i / this.ring.length) * Math.PI * 2.0;
      const rx = Math.cos(a)*R, rz = Math.sin(a)*R;
      const rpos = tmp3.set(this.anchor.x + rx, this.anchor.y + 4.0, this.anchor.z + rz);
      this.ring[i].s.position.copy(rpos);
      this.ring[i].t.position.set(this.anchor.x, this.anchor.y - 1.0, this.anchor.z);
    }

    // --- Bounce up-light from pit floor towards rocket ---
    const bouncePos = tmp3.set(this.anchor.x, -14.0, this.anchor.z); // near floor of pit
    this.bounce.position.copy(bouncePos);
    this.bounceTarget.position.copy(tmp3.set(this.anchor.x, this.anchor.y - 2.0, this.anchor.z));

    // --- Point glow at the anchor ---
    this.point.position.copy(this.anchor);

    // --- Intensities with smooth ramp ---
    const target = this._desired();
    const lerp = 1.0 - Math.exp(-dt * 10.0);
    this.key.intensity     = THREE.MathUtils.lerp(this.key.intensity,     target.key,    lerp);
    for (const r of this.ring) r.s.intensity = THREE.MathUtils.lerp(r.s.intensity, target.ring, lerp);
    this.bounce.intensity  = THREE.MathUtils.lerp(this.bounce.intensity,  target.bounce, lerp);
    this.point.intensity   = THREE.MathUtils.lerp(this.point.intensity,   target.point,  lerp);

    // Distances (keep helpers consistent)
    this.key.distance = this.runtime.spotDistance;
    for (const r of this.ring) r.s.distance = this.runtime.spotDistance * 1.1;

    // Make sure targets are updated
    this.key.updateMatrixWorld();
    for (const r of this.ring) r.s.updateMatrixWorld();
    this.bounce.updateMatrixWorld();
  }

  dispose() {
    this.key.map?.dispose?.();
    this.key.dispose?.();
    for (const r of this.ring) r.s.dispose?.();
    this.bounce.dispose?.();
    this.point.dispose?.();
    this.group.removeFromParent?.();
  }
}

const tmp3 = new THREE.Vector3();

function computeLocalCentroid(offsets) {
  if (!offsets?.length) return new THREE.Vector3(0,0,0);
  const c = new THREE.Vector3();
  for (const o of offsets) c.add(new THREE.Vector3(o.groupOffsetX||0, (o.groupOffsetY||0), o.groupOffsetZ||0));
  c.multiplyScalar(1 / offsets.length);
  return c;
}
function computeClusterRadius(offsets, centroid) {
  if (!offsets?.length) return 0;
  let r = 0;
  for (const o of offsets) {
    const dx=(o.groupOffsetX||0)-centroid.x, dz=(o.groupOffsetZ||0)-centroid.z;
    r = Math.max(r, Math.hypot(dx, dz));
  }
  return r;
}

function makePlumeCookieTexture(size = 256, core = '#fff7e6', orange = '#ffba78', cyan = '#80fbfd') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.00, hexToRgba(core,   1.00));
  g.addColorStop(0.28, hexToRgba(orange, 0.95));
  g.addColorStop(0.58, hexToRgba(cyan,   0.55));
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.08;
  for (let i=0;i<18;i++){
    const r = (size/2) * (0.2 + Math.random()*0.7);
    ctx.beginPath(); ctx.arc(size/2, size/2, r, 0, Math.PI*2);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}
function hexToRgba(hex, a=1) {
  try { const c = new THREE.Color(hex); return `rgba(${(c.r*255)|0},${(c.g*255)|0},${(c.b*255)|0},${a})`; }
  catch { return `rgba(255,255,255,${a})`; }
}