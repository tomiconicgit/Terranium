import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;

        // --- Physics Properties ---
        this.walkSpeed = 1.4; // Horizontal speed during a hop
        this.desiredVelocity = new THREE.Vector3();
        this.isGrounded = false;
        
        // --- Moon Physics Constants ---
        this.gravity = 1.62; // Moon's gravity (m/s^2)
        this.hopVelocity = 2.0; // Initial upward velocity of a hop

        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
    }

    update(landscape, delta) {
        // --- Horizontal Movement ---
        // Lerp the X and Z components of velocity towards the desired velocity
        const acceleration = 10.0;
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, this.desiredVelocity.x, acceleration * delta);
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, this.desiredVelocity.z, acceleration * delta);

        // --- Vertical Movement (Gravity) ---
        this.velocity.y -= this.gravity * delta;
        
        // --- Update Position ---
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.mesh.rotation.y = this.rotation;

        // --- Ground Collision & Hopping ---
        this.isGrounded = false; // Assume we are in the air until proven otherwise
        if (landscape) {
            this.raycaster.set(this.mesh.position, this.down);
            const intersects = this.raycaster.intersectObject(landscape);

            if (intersects.length > 0) {
                const groundHeight = intersects[0].point.y;
                // Check if the player is at or below the ground
                if (this.mesh.position.y <= groundHeight) {
                    this.isGrounded = true;
                    this.velocity.y = 0;
                    this.mesh.position.y = groundHeight;

                    // --- Initiate a hop if grounded and trying to move ---
                    if (this.desiredVelocity.length() > 0.1) {
                        this.velocity.y = this.hopVelocity;
                        this.isGrounded = false;
                    }
                }
            }
        }
    }
}
