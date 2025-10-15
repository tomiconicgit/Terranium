// src/controls/FPVControls.js — unified FPV for keyboard + mouse (+ gamepad fallback)
import * as THREE from "three";

function dz(v, dead = 0.12) { return Math.abs(v) < dead ? 0 : v; }

export class FPVControls extends THREE.Object3D {
  constructor(camera, domElement = document.body) {
    super();
    this.camera = camera;
    this.add(this.camera);
    this.camera.position.set(0, 1.6, 0);
    this.rotation.order = "YXZ";

    // Movement & look params
    this.speed = 8;          // m/s
    this.lookSpeed = 0.0022; // radians per px
    this._yaw = 0;
    this._pitch = 0;

    // Input state
    this.dom = domElement;
    this.keys = new Set();
    this.pointerLocked = false;

    // Gamepad state (fallback if present)
    this._lastButtons = [];

    // --- Keyboard
    window.addEventListener("keydown", (e) => {
      // avoid stealing focus when typing in inputs
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // --- Pointer lock + mouse look
    const onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this._yaw -= e.movementX * this.lookSpeed;
      this._pitch -= e.movementY * this.lookSpeed;
      const maxPitch = Math.PI / 2 - 0.01;
      this._pitch = Math.max(-maxPitch, Math.min(maxPitch, this._pitch));
      this.rotation.set(this._pitch, this._yaw, 0, "YXZ");
    };
    document.addEventListener("mousemove", onMouseMove);

    // Manage lock state
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      // Show default cursor when not locked
      this.dom.style.cursor = this.pointerLocked ? "none" : "default";
    });
  }

  requestPointerLock() { this.dom.requestPointerLock?.(); }

  // Optional gamepad helpers (works alongside keyboard)
  getGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const gp of pads) if (gp && gp.connected) return gp;
    return null;
  }
  isDown(idx) {
    const gp = this.getGamepad();
    return gp ? !!gp.buttons[idx]?.pressed : false;
  }

  update(dt) {
    // --- Keyboard movement in local XZ plane
    const forward = (this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("ArrowUp") ? 1 : 0);
    const back    = (this.keys.has("KeyS") ? 1 : 0) + (this.keys.has("ArrowDown") ? 1 : 0);
    const left    = (this.keys.has("KeyA") ? 1 : 0) + (this.keys.has("ArrowLeft") ? 1 : 0);
    const right   = (this.keys.has("KeyD") ? 1 : 0) + (this.keys.has("ArrowRight") ? 1 : 0);

    const moveZ = (back ? 1 : 0) - (forward ? 1 : 0); // +Z = backward
    const moveX = (right ? 1 : 0) - (left ? 1 : 0);   // +X = right

    const dirF = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    const dirR = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
    dirF.y = 0; dirR.y = 0; dirF.normalize(); dirR.normalize();

    const vel = new THREE.Vector3();
    vel.addScaledVector(dirR, moveX * this.speed);
    vel.addScaledVector(dirF, -moveZ * this.speed);

    // --- Gamepad add-on (left stick move, right stick look)
    const gp = this.getGamepad();
    if (gp) {
      const ax = dz(gp.axes[0] || 0); // left X
      const ay = dz(gp.axes[1] || 0); // left Y
      const rx = dz(gp.axes[2] || 0); // right X
      const ry = dz(gp.axes[3] || 0); // right Y
      vel.addScaledVector(dirR, ax * this.speed);
      vel.addScaledVector(dirF, -ay * this.speed);
      this._yaw  -= rx * (this.lookSpeed * 120); // scale to feel like mouse
      this._pitch -= ry * (this.lookSpeed * 120);
      const maxPitch = Math.PI / 2 - 0.01;
      this._pitch = Math.max(-maxPitch, Math.min(maxPitch, this._pitch));
      this.rotation.set(this._pitch, this._yaw, 0, "YXZ");
    }

    this.position.addScaledVector(vel, dt);
  }
}
