import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.pitch = 0;
        this.eyeHeight = 1.6;

        this.bobTimer = 0;
        this.bobAmount = 0.04;

        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 0);
    }

    update(delta) {
        this.rotation.order = 'YXZ';
        this.rotation.x = -this.pitch;
        this.rotation.z = 0;

        const velocityLength = this.player.velocity.length();

        if (velocityLength > 0.1) {
            // Bob frequency is proportional to player speed. 2 * PI makes one full cycle.
            const bobFrequency = 2.5; // Cycles per second
            this.bobTimer += bobFrequency * Math.PI * 2 * delta;
            
            const bobOffset = Math.sin(this.bobTimer) * this.bobAmount;
            this.position.y = this.eyeHeight + bobOffset;
        } else {
            this.bobTimer = 0; // Reset timer when still
            this.position.y = THREE.MathUtils.lerp(this.position.y, this.eyeHeight, 0.1);
        }
    }
}
