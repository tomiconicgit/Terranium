// src/effects/RocketLightRig.js
import * as THREE from 'three';

/**
 * RocketLightRig
 *  - Shadow-casting SpotLight with a colored cookie (white → orange → cyan)
 *  - Near-field PointLight for glow
 *  - Auto cone-sizing to cover a target area on the pit floor (y = -15)
 *  - Runtime controls via setParams()/getParams() (incl. coverageMeters)
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

    // Strong defaults so it’s visible in Day
    this.runtime = {
      // desired footprint width on the pit floor
      coverageMeters: 50,        // <— NEW: ensures ~50×50 coverage on y=-15
      spotAngleDeg: 35,          // will be overridden by auto-fit unless you change it via UI
      spotPenumbra: 0.40,
      spotDistance: 420,         // large falloff range so it reaches far
      spotIntensityScale: 1.5,
      pointIntensityScale: 1.6,
      cookieCore:   '#fff7e6',
      cookieOrange: '#ffba78',
      cookieCyan:   '#80fbfd',
      autoFitAngle: true         // <— NEW: auto-compute angle from coverageMeters
    };

    // --- Lights ---
    this.spot = new THREE.SpotLight(
      0xffffff,
      0.0,
      this.runtime.spotDistance,
      THREE.MathUtils.degToRad(this.runtime.spotAngleDeg),
      this.runtime.spotPenumbra,
      1.8 // decay
    );
    this.spot.name = 'PlumeSpot';
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(4096, 4096);     // crisper cookie/shadows at big footprint
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far  = 800;
    this.spot.shadow.bias = -0.00012;

    // Cookie texture (color/shape)
    this.spot.map = makePlumeCookieTexture(512, this.runtime.cookieCore, this.runtime.cookieOrange, this.runtime.cookieCyan);
    this.spot.color.set(0xffffff);

    // target
    this.spotTarget = new THREE.Object3D();
    this.spot.target = this.spotTarget;
    this.group.add(this.spot);
    this.group.add(this.spotTarget);

    // Near-field omni glow (no shadows)
    this.point = new THREE.PointLight(0xffcfa3, 0.0, 160, 1.6);
    this.point.name = 'PlumePoint';
    this.point.castShadow = false;
    this.group.add(this.point);

    // Internal dynamics
    this.maxSpotIntensity  = 36.0; // higher caps so it can punch through daylight
    this.maxPointIntensity = 12.0;
    this.dir = new THREE.Vector3(0, -1, 0); // plume direction (down)
    this.anchor = new THREE.Vector3();

    // Cache centroid for offsets (local space)
    this.localCentroid = computeLocalCentroid(this.offsets);

    // Pit floor reference (where we size the footprint)
    this.floorY = -15; // your pit floor level
  }

  /* ---------- UI Runtime Controls ---------- */
  setParams(patch = {}) {
    Object.assign(this.runtime, patch);

    // Apply directly to light properties when explicitly provided
    if ('spotPenumbra' in patch)   this.spot.penumbra = this.runtime.spotPenumbra;
    if ('spotDistance' in patch)   this.spot.distance = this.runtime.spotDistance;
    if ('spotAngleDeg' in patch && !this.runtime.autoFitAngle) {
      this.spot.angle = THREE.MathUtils.degToRad(this.runtime.spotAngleDeg);
    }
    if ('cookieCore' in patch || 'cookieOrange' in patch || 'cookieCyan' in patch) {
      this.spot.map?.dispose?.();
      this.spot.map = makePlumeCookieTexture(512, this.runtime.cookieCore, this.runtime.cookieOrange, this.runtime.cookieCyan);
      this.spot.needsUpdate = true;
    }
  }
  getParams() {
    return { ...this.runtime };
  }

  // Compute a plausible anchor from offsets + flameYOffset
  _computeAnchor() {
    const p = this._flameParams();
    const upY = 10.0 + (p.flameYOffset ?? 7.6);
    this.anchor.set(this.localCentroid.x, upY + this.localCentroid.y, this.localCentroid.z);
  }

  _flameParams() {
    // (this function name avoids confusion with getParams which is our runtime params)
    return this.getParams();
  }

  // Desired brightness derived from flame params + runtime scale
  _desiredIntensities() {
    const p = this._flameParams();
    const on = !!p.enginesOn;
    const I  = Math.max(0, Number(p.intensity ?? 1.0));
    const N  = Math.max(1, this.offsets.length || 1);

    // Sublinear growth with engine count to avoid blowout
    const engineBoost = Math.pow(N, 0.55);

    // Strong baselines so illumination is obvious in bright daylight
    const baseSpot  = on ? Math.min(this.maxSpotIntensity, 16.0 * I * engineBoost) : 0.0;
    const basePoint = on ? Math.min(this.maxPointIntensity,  4.2 * I * Math.pow(N, 0.4)) : 0.0;

    return {
      spot:  baseSpot  * (this.runtime.spotIntensityScale  ?? 1.0),
      point: basePoint * (this.runtime.pointIntensityScale ?? 1.0)
    };
  }

  // Auto-fit the cone to achieve the requested footprint on y = floorY
  _autoFitConeAngle(spotPosY) {
    if (!this.runtime.autoFitAngle || !Number.isFinite(this.runtime.coverageMeters)) return;

    const halfWidth = Math.max(0.1, this.runtime.coverageMeters * 0.5); // radius to cover
    const vertical = Math.max(0.1, (spotPosY - this.floorY));           // distance down to floor
    // angle is HALF-angle for SpotLight
    const halfAngleRad = Math.atan(halfWidth / vertical) * 1.07;        // 7% pad so edges still lit
    const halfAngleDeg = THREE.MathUtils.radToDeg(halfAngleRad);

    // Clamp to sane range
    const clampedDeg = Math.max(10, Math.min(80, halfAngleDeg));
    this.runtime.spotAngleDeg = clampedDeg;
    this.spot.angle = THREE.MathUtils.degToRad(clampedDeg);
  }

  update(dt/*, t */) {
    // 1) Anchor & direction
    this._computeAnchor();

    // Position the spot a little above/behind the anchor, pointing down
    const back = 4.0;
    const up   = 2.0;
    const spotPos = tmp3.copy(this.anchor).addScaledVector(this.dir, -back).add(0, up, 0);
    this.spot.position.copy(spotPos);
    this.spotTarget.position.copy(tmp3.copy(this.anchor).addScaledVector(this.dir, 10.0));

    // Auto-fit cone angle for requested coverage on the floor plane
    this._autoFitConeAngle(this.spot.position.y);

    // Point at the anchor
    this.point.position.copy(this.anchor);

    // 2) Intensities (and visibility toggle)
    const { spot: targetSpot, point: targetPoint } = this._desiredIntensities();
    const on = (targetSpot > 0.001 || targetPoint > 0.001);
    this.spot.visible  = on;
    this.point.visible = on;

    // smooth ramp (critically damped-ish)
    const lerp = 1.0 - Math.exp(-dt * 10.0); // ≈150–200 ms to settle
    this.spot.intensity  = THREE.MathUtils.lerp(this.spot.intensity,  targetSpot,  lerp);
    this.point.intensity = THREE.MathUtils.lerp(this.point.intensity, targetPoint, lerp);

    // 3) Range tweaks with intensity (keeps falloff believable)
    // Use runtime distance if set; otherwise derive a roomy default
    this.spot.distance  = this.runtime.spotDistance ?? (240 + this.spot.intensity * 6.0);
    this.point.distance = 110 + this.point.intensity * 8.0;
  }

  dispose() {
    this.spot.map?.dispose?.();
    this.spot.dispose?.();
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

function makePlumeCookieTexture(size = 512, core = '#fff7e6', orange = '#ffba78', cyan = '#80fbfd') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.00, hexToRgba(core,   1.00));
  g.addColorStop(0.28, hexToRgba(orange, 0.95));
  g.addColorStop(0.58, hexToRgba(cyan,   0.55));
  g.addColorStop(1.00, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // light ring noise to break up uniformity
  ctx.globalAlpha = 0.08;
  for (let i=0;i<18;i++){
    const r = (size/2) * (0.2 + Math.random()*0.7);
    ctx.beginPath();
    ctx.arc(size/2, size/2, r, 0, Math.PI*2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

function hexToRgba(hex, a=1) {
  try {
    const c = new THREE.Color(hex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    return `rgba(${r},${g},${b},${a})`;
  } catch {
    return `rgba(255,255,255,${a})`;
  }
}