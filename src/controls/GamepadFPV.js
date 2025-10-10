// GamepadFPV.js — controller-only movement + look
// Left stick: strafe (x) + forward/back (y) in camera space
// Right stick: look yaw/pitch
// A (0): fly up, X (2): fly down
// R2 (7): place, L2 (6): destroy
// R1 (5)/L1 (4): hotbar next/prev (handled in Builder)

import * as THREE from 'three';

export class GamepadFPV extends THREE.Object3D {
  constructor(camera) {
    super();
    this.camera = camera;
    this.add(this.camera);

    // FPV placement: put camera at "head" on this object
    this.camera.position.set(0, 1.6, 0);
    this.rotation.order = 'YXZ';

    // movement params
    this.speed = 6.0;     // m/s
    this.flySpeed = 4.0;
    this.lookSpeed = 1.8; // rad/s for full-stick

    // internal
    this._yaw = 0;
    this._pitch = 0;

    // last button states for edge detection (R1/L1 in Builder will read via public method)
    this._lastButtons = [];
  }

  getGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  wasPressed(btnIndex) {
    const gp = this.getGamepad();
    if (!gp) return false;
    const now = !!gp.buttons[btnIndex]?.pressed;
    const before = !!this._lastButtons[btnIndex];
    this._lastButtons[btnIndex] = now;
    return now && !before;
  }

  isDown(btnIndex) {
    const gp = this.getGamepad();
    return gp ? !!gp.buttons[btnIndex]?.pressed : false;
  }

  update(dt) {
    const gp = this.getGamepad();
    const ax = gp ? gp.axes : [0,0,0,0];

    // sticks
    const lx = dead(ax[0]);
    const ly = dead(ax[1]);
    const rx = dead(ax[2]);
    const ry = dead(ax[3]);

    // look
    this._yaw   -= rx * this.lookSpeed * dt;
    this._pitch -= ry * this.lookSpeed * dt;
    this._pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this._pitch));
    this.rotation.set(this._pitch, this._yaw, 0, 'YXZ');

    // move in camera (object) space: strafe + forward
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(this.quaternion);
    fwd.y = 0; right.y = 0; fwd.normalize(); right.normalize();

    const vel = new THREE.Vector3();
    vel.addScaledVector(right, lx * this.speed);
    vel.addScaledVector(fwd,  -ly * this.speed); // -ly: up is negative axis

    // fly up/down: A (0) up, X (2) down
    if (this.isDown(0)) vel.y += this.flySpeed; // A
    if (this.isDown(2)) vel.y -= this.flySpeed; // X

    this.position.addScaledVector(vel, dt);
  }
}

function dead(v, dz=0.12) {
  return Math.abs(v) < dz ? 0 : v;
}