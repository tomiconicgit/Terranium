// src/controls/BuilderController.js
import * as THREE from 'three';

// Backbone / standard gamepad polling + bindings for CraftSystem.
export class BuilderController {
  constructor({ camera, craft, moveSpeed = 8, lookSpeed = 2.2 }) {
    this.camera = camera;
    this.craft  = craft;

    // movement / look accumulators
    this.moveSpeed = moveSpeed;
    this.lookSpeed = lookSpeed;

    // fly-up/down rate
    this.flyRate = 6.0;

    // edge-trigger tracking for buttons (to avoid repeats)
    this._prevButtons = [];
  }

  update(dt) {
    const gp = navigator.getGamepads?.()[0];
    if (!gp) return;

    // axes
    const LSx = gp.axes[0] || 0; // left stick X: strafe
    const LSy = gp.axes[1] || 0; // left stick Y: forward/back
    const RSx = gp.axes[2] || 0; // right stick X: look yaw
    const RSy = gp.axes[3] || 0; // right stick Y: look pitch

    // Move (world-relative, based on camera orientation)
    const speed = this.moveSpeed * dt;
    const forward = new THREE.Vector3();
    const right   = new THREE.Vector3();

    this.camera.getWorldDirection(forward); // points -Z in camera space
    forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).negate().normalize();

    this.camera.position.addScaledVector(forward, -LSy * speed);
    this.camera.position.addScaledVector(right,    LSx * speed);

    // Look
    this.camera.rotation.y -= RSx * this.lookSpeed * dt;
    this.camera.rotation.x -= RSy * this.lookSpeed * dt;
    const clamp = Math.PI / 2 - 0.001;
    this.camera.rotation.x = Math.max(-clamp, Math.min(clamp, this.camera.rotation.x));

    // Buttons
    const b = gp.buttons.map(btn => !!btn?.pressed);
    const press = (i) => b[i] && !this._prevButtons[i];

    // Mapping:
    // R2 (7) = place
    if (press(7)) this.craft.place();

    // L2 (6) = remove/dig
    if (press(6)) this.craft.removeOrDig();

    // R1 (5) = next item
    if (press(5)) this.craft.selectNext();

    // L1 (4) = prev item
    if (press(4)) this.craft.selectPrev();

    // Y (3) = spin block yaw +45°
    if (press(3)) this.craft.yawStep();

    // X (2) = spin block pitch +45°
    if (press(2)) this.craft.pitchStep();

    // A (0) = Fly up (hold)
    if (b[0]) this.craft.fly(this.flyRate * dt);

    // B (1) = Fly down (hold)
    if (b[1]) this.craft.fly(-this.flyRate * dt);

    // Save edges
    this._prevButtons = b;
  }
}