import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.pitch = 0;
        this.eyeHeight = 1.6;

        // Head bobbing properties
        this.bobTimer = 0;
        this.bobSpeed = 0.15;
        this.bobAmount = 0.04;

        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 0);
    }

    update() {
        // Look up/down
        this.rotation.order = 'YXZ';
        this.rotation.x = -this.pitch;
        this.rotation.z = 0;

        // Head bobbing logic
        const velocityLength = this.player.velocity.length();
        if (velocityLength > 0.01) { // Player is moving
            this.bobTimer += this.bobSpeed;
            const bobOffset = Math.sin(this.bobTimer) * this.bobAmount;
            this.position.y = this.eyeHeight + bobOffset;
        } else { // Player is standing still
            // Smoothly return to the default eye height
            this.position.y = THREE.MathUtils.lerp(this.position.y, this.eyeHeight, 0.1);
        }
    }
}
