// GamepadFPV.js — controller-only movement + look
// Left stick: strafe (x) + forward/back (y) in camera space
// Right stick: look yaw/pitch
// A (0): fly up, X (2): fly down
// R2 (7): place, L2 (6): destroy (handled in Builder)
// R1 (5)/L1 (4): hotbar next/prev (handled in Builder)
import * as THREE from 'three';

export class GamepadFPV extends THREE.Object3D {
  constructor(camera) {
    super();
    this.camera = camera;
    this.add(this.camera);
    this.camera.position.set(0, 1.6, 0);
    this.rotation.order = 'YXZ';

    this.speed = 6.0;
    this.flySpeed = 4.0;
    this.lookSpeed = 1.8;

    this._yaw = 0;
    this._pitch = 0;
    this._lastButtons = [];
  }

  getGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  isDown(btn) {
    const gp = this.getGamepad();
    return gp ? !!gp.buttons[btn]?.pressed : false;
  }

  update(dt) {
    const gp = this.getGamepad();
    const ax = gp ? gp.axes : [0,0,0,0];
    const lx = dz(ax[0]);
    const ly = dz(ax[1]);
    const rx = dz(ax[2]);
    const ry = dz(ax[3]);

    // look
    this._yaw   -= rx * this.lookSpeed * dt;
    this._pitch -= ry * this.lookSpeed * dt;
    this._pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this._pitch));
    this.rotation.set(this._pitch, this._yaw, 0, 'YXZ');

    // movement (strafe + forward) in camera space
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(this.quaternion);
    fwd.y = 0; right.y = 0; fwd.normalize(); right.normalize();

    const vel = new THREE.Vector3();
    vel.addScaledVector(right, lx * this.speed);
    vel.addScaledVector(fwd,  -ly * this.speed); // -ly: stick up is negative

    if (this.isDown(0)) vel.y += this.flySpeed; // A up
    if (this.isDown(2)) vel.y -= this.flySpeed; // X down

    this.position.addScaledVector(vel, dt);
  }
}
function dz(v, d=0.12){ return Math.abs(v) < d ? 0 : v; }