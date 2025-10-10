import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Player {
  constructor() {
    this.mesh = new THREE.Object3D();
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.rotation = 0;

    // Walk: 1 step per tile. We'll set cadence in Camera; here we set speed to feel right.
    // Tiles are 1 unit; 1.4 tiles/sec feels natural at fixed walk.
    this.walkSpeed = 1.4;                 // tiles/sec
    this.desiredVelocity = new THREE.Vector3();

    this.accel = 14.0;
    this.friction = 12.0;

    this.raycaster = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
  }

  update(landscape, dt) {
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, this.desiredVelocity.x, this.accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, this.desiredVelocity.z, this.accel, dt);

    if (this.desiredVelocity.lengthSq() < 1e-6) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, this.friction, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, this.friction, dt);
    }

    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.mesh.rotation.y = this.rotation;

    if (landscape) {
      const rayOrigin = new THREE.Vector3(this.mesh.position.x, 30, this.mesh.position.z);
      this.raycaster.set(rayOrigin, this.down);
      const hit = this.raycaster.intersectObject(landscape, false);
      if (hit.length) this.mesh.position.y = hit[0].point.y;
    }
  }
}