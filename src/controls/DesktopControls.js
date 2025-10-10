import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class DesktopControls {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;
    this.keys = {};
    document.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup',   (e) => this.keys[e.key.toLowerCase()] = false);

    this.mouseDown = false;
    this.lastX = 0;
    this.lastY = 0;

    document.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.lastX = e.clientX; this.lastY = e.clientY;
    });
    document.addEventListener('mouseup',   () => this.mouseDown = false);
    document.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.player.rotation -= dx * 0.0025;
      this.camera.pitch    += dy * 0.0020; // vertical look
      this.camera.pitch = THREE.MathUtils.clamp(this.camera.pitch, -Math.PI/2 + 0.01, Math.PI/2 - 0.01);
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
  }

  update() {
    const forward = (this.keys['w'] || this.keys['arrowup']) ? 1 : 0;
    const backward = (this.keys['s'] || this.keys['arrowdown']) ? 1 : 0;
    const left = (this.keys['a'] || this.keys['arrowleft']) ? 1 : 0;
    const right = (this.keys['d'] || this.keys['arrowright']) ? 1 : 0;

    const z = (forward - backward);
    const x = (right - left);

    if (x !== 0 || z !== 0) {
      this.player.direction.set(x, 0, -z).normalize();
      this.player.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation);
      // Fixed walk speed (no running)
      this.player.desiredVelocity.copy(this.player.direction).multiplyScalar(this.player.walkSpeed);
    } else {
      this.player.desiredVelocity.set(0, 0, 0);
    }
  }
}