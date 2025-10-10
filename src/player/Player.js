import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;

        // --- Physics Properties (Earth-like) ---
        this.walkSpeed = 3.0;              // faster on flat ground
        this.desiredVelocity = new THREE.Vector3();
        this.isGrounded = false;

        this.gravity = 9.81;               // Earth gravity
        this.hopVelocity = 3.0;            // small step/hop while moving

        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
    }

    update(landscape, delta) {
        // --- Horizontal Movement (lerped towards desired) ---
        const acceleration = 12.0;
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, this.desiredVelocity.x, acceleration * delta);
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, this.desiredVelocity.z, acceleration * delta);

        // --- Vertical Movement (Gravity) ---
        this.velocity.y -= this.gravity * delta;

        // --- Integrate ---
        this.mesh.position.addScaledVector(this.velocity, delta);
        this.mesh.rotation.y = this.rotation;

        // --- Grounding against 'landscape' ---
        this.isGrounded = false;
        if (landscape) {
            const rayOrigin = new THREE.Vector3(this.mesh.position.x, 20, this.mesh.position.z);
            this.raycaster.set(rayOrigin, this.down);
            const intersects = this.raycaster.intersectObject(landscape, false);

            if (intersects.length > 0) {
                const groundY = intersects[0].point.y;
                if (this.mesh.position.y <= groundY) {
                    this.isGrounded = true;
                    this.mesh.position.y = groundY;
                    this.velocity.y = 0;

                    // tiny hop to animate steps while moving
                    if (this.desiredVelocity.length() > 0.1) {
                        this.velocity.y = this.hopVelocity;
                        this.isGrounded = false;
                    }
                }
            }
        }
    }
}