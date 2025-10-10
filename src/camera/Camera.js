import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;
        this.pitch = 0;
        this.eyeHeight = 1.6;

        // Attach camera to the player and give it a small trailing offset
        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 3); // pull back so we can see ground
    }

    update(/* delta */) {
        // Only handle looking up and down
        this.rotation.order = 'YXZ';
        this.rotation.x = -this.pitch;
        this.rotation.z = 0;

        // Keep camera looking forward from the player
        const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation);
        const target = this.player.mesh.position.clone()
            .add(fwd.multiplyScalar(5))
            .setY(this.player.mesh.position.y + this.eyeHeight * 0.5);
        this.lookAt(target);
    }
}