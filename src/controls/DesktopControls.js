import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class DesktopControls {
    constructor(player) {
        this.player = player;
        this.keys = {};
        document.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        document.addEventListener('keyup',   (e) => this.keys[e.key.toLowerCase()] = false);

        this.mouseDown = false;
        this.lastMouseX = 0;

        document.addEventListener('mousedown', (e) => { this.mouseDown = true; this.lastMouseX = e.clientX; });
        document.addEventListener('mouseup',   ()  => { this.mouseDown = false; });
        document.addEventListener('mousemove', (e) => {
            if (!this.mouseDown) return;
            const dx = e.clientX - this.lastMouseX;
            this.player.rotation -= dx * 0.002;
            this.lastMouseX = e.clientX;
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
            // Fixed-magnitude walk (no running)
            this.player.desiredVelocity.copy(this.player.direction).multiplyScalar(this.player.walkSpeed);
        } else {
            this.player.desiredVelocity.set(0, 0, 0);
        }
    }
}