import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class MobileControls {
    constructor(player, camera) {
        this.player = player;
        this.camera = camera;
        this.sensitivity = 0.001;
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
        this.moveData = { force: 0, angle: 0 };
        this.moveJoystick.on('move', (evt, data) => {
            this.moveData.force = data.force;
            this.moveData.angle = data.angle.radian;
        });
        this.moveJoystick.on('end', () => {
            this.moveData.force = 0;
        });
        this.touchIdentifier = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            for (let touch of e.changedTouches) {
                if (!this.isTouchInMoveZone(touch)) {
                    this.touchIdentifier = touch.identifier;
                    this.touchStartX = touch.clientX;
                    this.touchStartY = touch.clientY;
                    break;
                }
            }
        });
        document.addEventListener('touchmove', (e) => {
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.touchIdentifier) {
                    // Prevent the screen from scrolling
                    e.preventDefault(); 
                    
                    const deltaX = touch.clientX - this.touchStartX;
                    const deltaY = touch.clientY - this.touchStartY;
                    this.player.rotation -= deltaX * this.sensitivity;
                    this.camera.pitch -= deltaY * this.sensitivity;
                    this.camera.pitch = THREE.MathUtils.clamp(this.camera.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
                    this.touchStartX = touch.clientX;
                    this.touchStartY = touch.clientY;
                    break;
                }
            }
        }, { passive: false }); // Add { passive: false } to make preventDefault() work
        document.addEventListener('touchend', (e) => {
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.touchIdentifier) {
                    this.touchIdentifier = null;
                    break;
                }
            }
        });
    }
    isTouchInMoveZone(touch) {
        const rect = this.moveZone.getBoundingClientRect();
        return touch.clientX >= rect.left && touch.clientX <= rect.right &&
               touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    }
    update() {
        if (this.moveData.force > 0) {
            // Correctly map joystick angle to game movement
            // cos(angle) for X (strafe), sin(angle) for Z (forward)
            const side = this.moveData.force * Math.cos(this.moveData.angle);
            // In Three.js, moving "forward" into the screen is along the negative Z axis.
            // Joystick "up" (sin(angle) = 1) should map to negative Z.
            const forward = -this.moveData.force * Math.sin(this.moveData.angle); 
            
            this.player.direction.set(side, 0, forward).normalize();
            this.player.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation);
            this.player.velocity.add(this.player.direction.clone().multiplyScalar(this.player.moveSpeed));
        }
    }
}
