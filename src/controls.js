import * as THREE from 'three';

export class Controls {
  constructor(camera, domElement, terrain) {
    this.camera = camera;
    this.domElement = domElement;
    this.terrain = terrain;

    this.lookSpeed = 0.005;
    this.moveSpeed = 0.12;

    this.pitch = 0;
    this.yaw = 0;

    this.moveDirection = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    this.touchLookId = null;
    this.touchLookStart = new THREE.Vector2();

    this.touchMoveId = null;
    this.touchMoveStart = new THREE.Vector2();
    this.touchMoveCurrent = new THREE.Vector2();

    // --- Visual Joystick UI ---
    this.joy = {
      base: document.createElement('div'),
      knob: document.createElement('div'),
      radius: 70, // px radius for input clamp (half of base size)
      active: false
    };
    this.joy.base.className = 'joy-base';
    this.joy.knob.className = 'joy-knob';
    document.body.appendChild(this.joy.base);
    document.body.appendChild(this.joy.knob);

    // Default park position (bottom-left with a little safe-area offset)
    this.parkJoystick();

    // Touch listeners
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.domElement.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  parkJoystick() {
    const safeLeft = getComputedStyle(document.documentElement).getPropertyValue('--safe-left') || '0px';
    const safeBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '0px';
    const left = 20 + parseInt(safeLeft) || 20;
    const bottom = 20 + parseInt(safeBottom) || 20;
    const baseSize = 140;

    this.joy.base.style.left = `${left}px`;
    this.joy.base.style.top = `calc(100vh - ${bottom + baseSize}px)`;
    this.joy.knob.style.left = `${left + baseSize / 2}px`;
    this.joy.knob.style.top = `calc(100vh - ${bottom + baseSize / 2}px)`;

    this.joy.base.classList.remove('joy-active');
    this.joy.knob.classList.remove('joy-active');
  }

  onTouchStart(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      const halfWidth = window.innerWidth / 2;
      const halfHeight = window.innerHeight / 2;

      if (touch.clientX < halfWidth && touch.clientY > halfHeight) {
        // Bottom-left quadrant -> movement joystick
        if (this.touchMoveId === null) {
          this.touchMoveId = touch.identifier;
          this.touchMoveStart.set(touch.clientX, touch.clientY);
          this.touchMoveCurrent.copy(this.touchMoveStart);

          // Place joystick at touch start and show
          this.joy.base.style.left = `${touch.clientX - 70}px`;
          this.joy.base.style.top = `${touch.clientY - 70}px`;
          this.joy.knob.style.left = `${touch.clientX}px`;
          this.joy.knob.style.top = `${touch.clientY}px`;
          this.joy.base.classList.add('joy-active');
          this.joy.knob.classList.add('joy-active');
          this.joy.active = true;
        }
      } else {
        // Elsewhere -> look
        if (this.touchLookId === null) {
          this.touchLookId = touch.identifier;
          this.touchLookStart.set(touch.clientX, touch.clientY);
        }
      }
    }
  }

  onTouchMove(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchLookId) {
        const dx = touch.clientX - this.touchLookStart.x;
        const dy = touch.clientY - this.touchLookStart.y;
        this.yaw -= dx * this.lookSpeed;
        this.pitch -= dy * this.lookSpeed;
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        this.touchLookStart.set(touch.clientX, touch.clientY);
      } else if (touch.identifier === this.touchMoveId) {
        this.touchMoveCurrent.set(touch.clientX, touch.clientY);

        // Visual knob movement within radius
        const delta = new THREE.Vector2().subVectors(this.touchMoveCurrent, this.touchMoveStart);
        const len = delta.length();
        const clamped = delta.clone();
        const r = this.joy.radius;
        if (len > r) clamped.multiplyScalar(r / len);

        const baseCenter = new THREE.Vector2(
          parseFloat(this.joy.base.style.left) + r,
          parseFloat(this.joy.base.style.top) + r
        );
        this.joy.knob.style.left = `${baseCenter.x + clamped.x}px`;
        this.joy.knob.style.top = `${baseCenter.y + clamped.y}px`;
      }
    }
  }

  onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchLookId) {
        this.touchLookId = null;
      } else if (touch.identifier === this.touchMoveId) {
        this.touchMoveId = null;
        this.moveDirection.set(0, 0, 0);

        // Hide and park joystick
        this.joy.active = false;
        this.joy.base.classList.remove('joy-active');
        this.joy.knob.classList.remove('joy-active');
        // Small delay before parking so fade-out looks clean
        setTimeout(() => this.parkJoystick(), 120);
      }
    }
  }

  update() {
    // Apply rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Movement vector from joystick
    if (this.touchMoveId !== null) {
      const delta = this.touchMoveCurrent.clone().sub(this.touchMoveStart);
      const len = delta.length();
      const threshold = 12; // dead zone
      if (len > threshold) {
        const r = this.joy.radius;
        const strength = Math.min(1, (len - threshold) / (r - threshold));
        delta.normalize();
        // Screen up = forward (-y in screen space)
        this.moveDirection.set(delta.x, 0, -delta.y).multiplyScalar(strength);
      } else {
        this.moveDirection.set(0, 0, 0);
      }
    }

    if (this.moveDirection.lengthSq() > 0) {
      const move = this.moveDirection.clone().applyQuaternion(this.camera.quaternion);
      move.y = 0;
      move.normalize().multiplyScalar(this.moveSpeed);
      this.camera.position.add(move);
    }

    // Snap camera to terrain height
    const origin = this.camera.position.clone();
    origin.y += 10;
    this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    const hits = this.raycaster.intersectObject(this.terrain, true);
    if (hits.length > 0) {
      this.camera.position.y = hits[0].point.y + 1.7;
    }
  }
}