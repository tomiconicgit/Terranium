import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.offset = new THREE.Vector3(0, 0.5, -2);
        this.lookOffset = new THREE.Vector3(0, 1, 5);
    }
    update() {
        const rotatedOffset = this.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.mesh.rotation.y);
        this.position.copy(this.player.mesh.position.clone().add(rotatedOffset));
        const lookAtPos = this.player.mesh.position.clone().add(this.lookOffset);
        this.lookAt(lookAtPos);
    }
}