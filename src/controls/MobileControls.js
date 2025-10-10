import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class MobileControls {
    constructor(player, camera) {
        this.player = player;
        this.camera = camera;
        this.sensitivity = 0.004;

        this.moveZone = document.createElement('div');
        this.moveZone.style.position = 'absolute';
        this.moveZone.style.left = '20px';
        this.moveZone.style.bottom = '20px';
        this.moveZone.style.width = '200px';
        this.moveZone.style.height = '200px';
        document.body.appendChild(this.moveZone);

        this.moveJoystick = nipplejs.create({
            zone: this.moveZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'blue'
        });

        this.moveVec = new THREE.Vector2(0, 0);
        this.moveJoystick.on('move', (evt, data) => {
            // Direction only; ignore magnitude for speed (fixed walk)
            const angle = data.angle?.radian ?? 0;
            this.moveVec.set(Math.cos(angle), -Math.sin(angle)); // x = right, y = forward
        });
        this.moveJoystick.on('end', () => this.moveVec.set(0, 0));

        this.touchIdentifier = null;
        this.touchStartX = 0;
        this.touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            for (let t of e.changedTouches) {
                if (!this.isTouchInMoveZone(t)) {
                    this.touchIdentifier = t.identifier;
                    this.touchStartX = t.clientX;
                    this.touchStartY = t.clientY;
                    break;
                }
            }
        });
        document.addEventListener('touchmove', (e) => {
            for (let t of e.changedTouches) {
                if (t.identifier === this.touchIdentifier) {
                    e.preventDefault();
                    const dx = t.clientX - this.touchStartX;
                    const dy = t.clientY - this.touchStartY;
                    this.player.rotation -= dx * this.sensitivity;
                    this.camera.pitch += dy * this.sensitivity;
                    this.camera.pitch = THREE.MathUtils.clamp(this.camera.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
                    this.touchStartX = t.clientX;
                    this.touchStartY = t.clientY;
                    break;
                }
            }
        }, { passive: false });
        document.addEventListener('touchend', (e) => {
            for (let t of e.changedTouches) {
                if (t.identifier === this.touchIdentifier) { this.touchIdentifier = null; break; }
            }
        });
    }

    isTouchInMoveZone(t) {
        const r = this.moveZone.getBoundingClientRect();
        return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom;
    }

    update() {
        if (this.moveVec.lengthSq() > 0.0001) {
            // Fixed-magnitude walk (no running)
            const dir = new THREE.Vector3(this.moveVec.x, 0, this.moveVec.y).normalize();
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation);
            this.player.desiredVelocity.copy(dir).multiplyScalar(this.player.walkSpeed);
        } else {
            this.player.desiredVelocity.set(0, 0, 0);
        }
    }
}