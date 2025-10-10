import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.pitch = 0;
        this.eyeHeight = 1.6;
        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 0);
    }
    update() {
        this.rotation.order = 'YXZ';
        // The Y rotation is inherited from the parent (player.mesh), so it's not set here
        this.rotation.x = -this.pitch; // Negative for looking up
        this.rotation.z = 0;
    }
}
