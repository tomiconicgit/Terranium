import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.pitch = 0;
        this.eyeHeight = 1.6;

        player.mesh.add(this);
        // Set a fixed position relative to the player object
        this.position.set(0, this.eyeHeight, 0);
    }

    update(delta) {
        // Only handle looking up and down
        this.rotation.order = 'YXZ';
        this.rotation.x = -this.pitch;
        this.rotation.z = 0;
    }
}
