import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 0.9;
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