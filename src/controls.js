import * as THREE from 'three';

export class Controls {
    constructor(camera, domElement, terrain) {
        this.camera = camera;
        this.domElement = domElement;
        this.terrain = terrain;
        this.lookSpeed = 0.005;
        this.moveSpeed = 0.1;
        this.pitch = 0;
        this.yaw = 0;
        this.moveDirection = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.touchLookId = null;
        this.touchLookStart = new THREE.Vector2();
        this.touchMoveId = null;
        this.touchMoveStart = new THREE.Vector2();
        this.touchMoveCurrent = new THREE.Vector2();

        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    }

    onTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const halfWidth = window.innerWidth / 2;
            const halfHeight = window.innerHeight / 2;
            if (touch.clientX < halfWidth && touch.clientY > halfHeight) {
                // Bottom left for joystick move
                if (this.touchMoveId === null) {
                    this.touchMoveId = touch.identifier;
                    this.touchMoveStart.set(touch.clientX, touch.clientY);
                    this.touchMoveCurrent.copy(this.touchMoveStart);
                }
            } else {
                // Elsewhere for look
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
                const deltaX = touch.clientX - this.touchLookStart.x;
                const deltaY = touch.clientY - this.touchLookStart.y;
                this.yaw -= deltaX * this.lookSpeed;
                this.pitch -= deltaY * this.lookSpeed;
                this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
                this.touchLookStart.set(touch.clientX, touch.clientY);
            } else if (touch.identifier === this.touchMoveId) {
                this.touchMoveCurrent.set(touch.clientX, touch.clientY);
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
            }
        }
    }

    update() {
        // Update rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;

        // Update movement
        if (this.touchMoveId !== null) {
            const delta = this.touchMoveCurrent.clone().sub(this.touchMoveStart);
            const length = delta.length();
            if (length > 20) { // Threshold for input
                delta.normalize();
                this.moveDirection.x = delta.x; // Strafe right positive
                this.moveDirection.z = -delta.y; // Forward negative y (up on screen)
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

        // Snap to terrain height
        const origin = this.camera.position.clone();
        origin.y += 10;
        this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
        const intersects = this.raycaster.intersectObject(this.terrain);
        if (intersects.length > 0) {
            this.camera.position.y = intersects[0].point.y + 1.7;
        }
    }
}