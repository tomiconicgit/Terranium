import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;

        // --- New Movement Properties ---
        this.walkSpeed = 1.4; // Units (meters) per second
        this.desiredVelocity = new THREE.Vector3(); // The velocity the controls are requesting
        
        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
    }

    update(landscape, delta) {
        // Smoothly interpolate from current velocity to the desired velocity
        const acceleration = 10.0;
        this.velocity.lerp(this.desiredVelocity, acceleration * delta);

        // Update position based on the current velocity and delta time
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));

        this.mesh.rotation.y = this.rotation;

        // Terrain following logic
        if (landscape) {
            this.raycaster.set(this.mesh.position, this.down);
            this.raycaster.ray.origin.y = 20;

            const intersects = this.raycaster.intersectObject(landscape);

            if (intersects.length > 0) {
                this.mesh.position.y = intersects[0].point.y;
            }
        }
    }
}
