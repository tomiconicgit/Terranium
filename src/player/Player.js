import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        // Use a simple Object3D as the player's body, since it's invisible
        this.mesh = new THREE.Object3D();

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;
        this.moveSpeed = 0.05;
    }
    update() {
        this.mesh.position.add(this.velocity);
        this.mesh.rotation.y = this.rotation;
        this.velocity.multiplyScalar(0.92);
    }
}
