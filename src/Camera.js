// src/Camera.js

import * as THREE from 'three';

export class CameraRig extends THREE.Object3D {
  constructor() {
    super();
    this.rotation.order = 'YXZ'; // Yaw-Pitch-Roll order
    this._pitch = 0;
    this._yaw = 0;

    // Increased far plane to 3000 to see the larger skydome
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 1.6, 0); // Eye-level height
    this.add(this.camera);

    this.position.set(0, 20, 50); // Initial rig position in the world
  }

  updateAspectRatio(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // Methods to be called by the controller
  rotate(lookX, lookY) {
    this._yaw -= lookX;
    this._pitch -= lookY;
    
    // Clamp pitch to prevent camera flipping
    const maxPitch = Math.PI / 2 - 0.01;
    this._pitch = Math.max(-maxPitch, Math.min(maxPitch, this._pitch));
    
    this.rotation.set(this._pitch, this._yaw, 0);
  }

  move(moveX, moveZ, flyY, deltaTime, speed) {
      const moveDirection = new THREE.Vector3(moveX, 0, moveZ).normalize();
      const worldDirection = this.localToWorld(moveDirection).sub(this.position);
      worldDirection.y = 0; // Don't allow looking up/down to affect speed
      worldDirection.normalize();

      const velocity = worldDirection.multiplyScalar(speed * deltaTime);
      velocity.y = flyY * speed * deltaTime;

      this.position.add(velocity);
  }
}
