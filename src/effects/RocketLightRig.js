// src/effects/RocketLightRig.js
import * as THREE from 'three';

/**
 * RocketLightRig
 *  - One shadow-casting SpotLight with a colored cookie (hot white core → orange → cyan)
 *  - One PointLight for near-field glow (no shadows for perf)
 *  - Follows the plume "anchor" computed from your instance offsets + flameYOffset
 *  - Intensity and reach scale with flame params and (optionally) number of engines
 *
 * Usage:
 *   const rig = new RocketLightRig({
 *     parent: rocketRoot.parent || rocketRoot,
 *     rocketRoot,           // used only for transforms if needed in future
 *     offsets: bakedFlameOffsets,
 *     getParams: () => instanced.params
 *   });
 *   scene.add(rig.group);
 *   effects.push(rig); // so .update(dt,t) runs
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

    // --- Lights ---
    this.spot = new THREE.SpotLight(0xffffff, 0.0, 260, THREE.MathUtils.degToRad(30), 0.35, 1.8);
    this.spot.name = 'PlumeSpot';
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(2048, 2048);
    this.spot.shadow.camera.near = 1.0;
    this.spot.shadow.camera.far  = 400;
    this.spot.shadow.bias = -0.00015;

    // cookie (projected texture) for color/shape
    this.spot.map = makePlumeCookieTexture(256);
    this.spot.color.set(0xffffff); // cookie handles color distribution

    // target
    this.spotTarget = new THREE.Object3D();
    this.spot.target = this.spotTarget;
    this.group.add(this.spot);
    this.group.add(this.spotTarget);

    // Near-field omni glow (no shadows)
    this.point = new THREE.PointLight(0xffcfa3, 0.0, 120, 1.6);
    this.point.name = 'PlumePoint';
    this.point.castShadow = false;
    this.group.add(this.point);

    // Internal dynamics
    this.currentIntensity = 0.0; // smooth ramp
    this.maxSpotIntensity = 22.0;  // overall cap; will be scaled by params
    this.maxPointIntensity = 6.0;
    this.dir = new THREE.Vector3(0, -1, 0); // plume direction (down)
    this.anchor = new THREE.Vector3();

    // Cache centroid for offsets (local space)
    this.localCentroid = computeLocalCentroid(this.offsets);
  }

  // Compute a plausible anchor from offsets + flameYOffset
  _computeAnchor() {
    const p = this.getParams();
    const upY = 10.0 + (p.flameYOffset ?? 7.6);
    this.anchor.set(this.localCentroid.x, upY + this.localCentroid.y, this.localCentroid.z);
    // Because we parented to the same node as instances (rocketRoot.parent or rocketRoot),
    // local space == instanced local; no extra transform needed here.
  }

  // Desired brightness derived from params (enginesOn + intensity + engine count)
  _desiredIntensities() {
    const p = this.getParams();
    const on = !!p.enginesOn;
    const I  = Math.max(0, Number(p.intensity ?? 1.0));
    const N  = Math.max(1, this.offsets.length || 1);

    // Sublinear growth with engine count to avoid blowing out
    const engineBoost = Math.pow(N, 0.55);

    // Base scalars give a good starting look; tweak to taste
    const spot = on ? Math.min(this.maxSpotIntensity, 8.0 * I * engineBoost) : 0.0;
    const point = on ? Math.min(this.maxPointIntensity, 2.2 * I * Math.pow(N, 0.4)) : 0.0;

    return { spot, point };
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

    // Point at the anchor
    this.point.position.copy(this.anchor);

    // 2) Intensity ramping
    const { spot: targetSpot, point: targetPoint } = this._desiredIntensities();

    // smooth ramp (critically damped-ish)
    const lerp = 1.0 - Math.exp(-dt * 10.0); // ~150–200ms to settle
    this.spot.intensity  = THREE.MathUtils.lerp(this.spot.intensity,  targetSpot,  lerp);
    this.point.intensity = THREE.MathUtils.lerp(this.point.intensity, targetPoint, lerp);

    // 3) Range tweaks with intensity (keeps falloff believable)
    this.spot.distance = 180 + this.spot.intensity * 4.0;
    this.point.distance = 80 + this.point.intensity * 6.0;
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

function makePlumeCookieTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Radial gradient: center white-hot -> orange -> cyan -> transparent
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.00, 'rgba(255, 247, 230, 1.0)'); // hot white
  g.addColorStop(0.28, 'rgba(255, 186, 120, 0.95)'); // warm orange
  g.addColorStop(0.58, 'rgba(128, 251, 253, 0.55)'); // cyan fringe
  g.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');        // fade out

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Very light banding/noise to break up uniformity
  ctx.globalAlpha = 0.08;
  for (let i=0;i<18;i++){
    const r = (size/2) * (0.2 + Math.random()*0.7);
    ctx.beginPath();
    ctx.arc(size/2, size/2, r, 0, Math.PI*2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}