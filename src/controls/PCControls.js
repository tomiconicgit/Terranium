// src/controls/PCControls.js — WASD + Mouse look layered onto an existing rig
import * as THREE from "three";

export class PCControls {
  /**
   * @param {THREE.Object3D} rig The rig that holds the camera (use your GamepadFPV instance)
   * @param {HTMLElement} domElement The canvas/element to lock pointer on and receive mouse events
   */
  constructor(rig, domElement = document.body) {
    this.rig = rig;
    this.dom = domElement;

    // Movement/look
    this.speed = 8;                 // m/s
    this.lookSpeed = 0.0022;        // radians per px
    this.keys = new Set();

    // Maintain yaw/pitch, seeded from rig (or GamepadFPV's internals if present)
    this.yaw = typeof rig._yaw === "number" ? rig._yaw : rig.rotation.y;
    this.pitch = typeof rig._pitch === "number" ? rig._pitch : rig.rotation.x;

    this.pointerLocked = false;

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Mouse look
    this.onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.yaw   -= e.movementX * this.lookSpeed;
      this.pitch -= e.movementY * this.lookSpeed;
      const maxPitch = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      this.applyRotationToRig();
    };
    document.addEventListener("mousemove", this.onMouseMove);

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      this.dom.style.cursor = this.pointerLocked ? "none" : "default";
    });
  }

  requestPointerLock() { this.dom.requestPointerLock?.(); }

  applyRotationToRig() {
    // Update rig transform
    this.rig.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    // Keep GamepadFPV internals in sync so it won't overwrite mouse look on next update
    if ("_yaw" in this.rig)  this.rig._yaw = this.yaw;
    if ("_pitch" in this.rig) this.rig._pitch = this.pitch;
  }

  update(dt) {
    // Movement (WASD / Arrows)
    const forward = (this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("ArrowUp") ? 1 : 0);
    const back    = (this.keys.has("KeyS") ? 1 : 0) + (this.keys.has("ArrowDown") ? 1 : 0);
    const left    = (this.keys.has("KeyA") ? 1 : 0) + (this.keys.has("ArrowLeft") ? 1 : 0);
    const right   = (this.keys.has("KeyD") ? 1 : 0) + (this.keys.has("ArrowRight") ? 1 : 0);

    const moveZ = (back ? 1 : 0) - (forward ? 1 : 0);
    const moveX = (right ? 1 : 0) - (left ? 1 : 0);

    const dirF = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.quaternion);
    const dirR = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rig.quaternion);
    dirF.y = 0; dirR.y = 0; dirF.normalize(); dirR.normalize();

    const vel = new THREE.Vector3();
    vel.addScaledVector(dirR, moveX * this.speed);
    vel.addScaledVector(dirF, -moveZ * this.speed);

    this.rig.position.addScaledVector(vel, dt);
  }

  dispose() {
    document.removeEventListener("mousemove", this.onMouseMove);
  }
}
