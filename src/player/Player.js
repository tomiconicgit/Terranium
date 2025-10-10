import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
    constructor() {
        this.mesh = new THREE.Object3D();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;

        // Walk tuning: 2 steps per 1 tile -> ~0.9 tiles/sec at ~1.8 steps/sec
        this.walkSpeed = 0.9;   // tiles/sec (tile = 1 unit)
        this.desiredVelocity = new THREE.Vector3();

        this.accel = 12.0;
        this.friction = 10.0;

        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
    }

    update(landscape, dt) {
        // accelerate toward desired
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, this.desiredVelocity.x, this.accel, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, this.desiredVelocity.z, this.accel, dt);

        // friction when no input
        if (this.desiredVelocity.lengthSq() < 1e-6) {
            this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, this.friction, dt);
            this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, this.friction, dt);
        }

        // integrate horizontal
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.z += this.velocity.z * dt;

        this.mesh.rotation.y = this.rotation;

        // follow ground height
        if (landscape) {
            const rayOrigin = new THREE.Vector3(this.mesh.position.x, 30, this.mesh.position.z);
            this.raycaster.set(rayOrigin, this.down);
            const hit = this.raycaster.intersectObject(landscape, false);
            if (hit.length) this.mesh.position.y = hit[0].point.y;
        }
    }
}