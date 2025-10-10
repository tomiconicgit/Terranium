import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;
        this.moveSpeed = 0.05;

        // Raycaster for terrain following
        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
    }

    update(landscape) {
        this.mesh.position.add(this.velocity);
        this.mesh.rotation.y = this.rotation;
        this.velocity.multiplyScalar(0.92);

        // Terrain following logic
        if (landscape) {
            // Set raycaster origin to be high above the player's current X,Z position
            this.raycaster.set(this.mesh.position, this.down);
            this.raycaster.ray.origin.y = 20; // A safe height above the terrain

            const intersects = this.raycaster.intersectObject(landscape);

            if (intersects.length > 0) {
                // Set the player's Y position to the terrain height
                this.mesh.position.y = intersects[0].point.y;
            }
        }
    }
}
