import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class TouchPad {
    constructor() {
        this.createJoystick();

        // Public vectors that Main.js will read
        this.moveVector = new THREE.Vector2(); // For joystick movement
        this.lookVector = new THREE.Vector2(); // For camera look movement

        this.activeLookId = null; // Touch identifier for camera look
        this.lookStart = new THREE.Vector2();

        this.addEventListeners();
    }

    createJoystick() {
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.className = 'touch-controls';

        this.joystickBase = document.createElement('div');
        this.joystickBase.id = 'joystick-base';

        this.joystickNub = document.createElement('div');
        this.joystickNub.id = 'joystick-nub';

        this.joystickContainer.appendChild(this.joystickBase);
        this.joystickContainer.appendChild(this.joystickNub);
        document.body.appendChild(this.joystickContainer);

        this.joystickRadius = this.joystickBase.clientWidth / 2;
    }

    addEventListeners() {
        this.joystickContainer.addEventListener('touchstart', (e) => this.onJoystickMove(e), false);
        this.joystickContainer.addEventListener('touchmove', (e) => this.onJoystickMove(e), false);
        this.joystickContainer.addEventListener('touchend', () => this.onJoystickEnd(), false);

        window.addEventListener('touchstart', (e) => this.onLookStart(e), false);
        window.addEventListener('touchmove', (e) => this.onLookMove(e), false);
        window.addEventListener('touchend', (e) => this.onLookEnd(e), false);
    }
    
    // --- Joystick Logic ---
    onJoystickMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.joystickBase.getBoundingClientRect();
        
        const x = touch.clientX - rect.left - this.joystickRadius;
        const y = touch.clientY - rect.top - this.joystickRadius;
        const distance = Math.min(this.joystickRadius, Math.sqrt(x*x + y*y));
        const angle = Math.atan2(y, x);
        
        // Update nub position
        this.joystickNub.style.transform = `translate(${distance * Math.cos(angle)}px, ${distance * Math.sin(angle)}px)`;
        
        // Update public move vector (normalized)
        this.moveVector.set(
            (distance / this.joystickRadius) * Math.cos(angle),
            (distance / this.joystickRadius) * Math.sin(angle)
        );
    }

    onJoystickEnd() {
        this.joystickNub.style.transform = 'translate(0, 0)';
        this.moveVector.set(0, 0);
    }
    
    // --- Camera Look Logic ---
    onLookStart(event) {
        // Find a touch that is NOT on the joystick
        for(let touch of event.changedTouches) {
            if (touch.target !== this.joystickBase) {
                this.activeLookId = touch.identifier;
                this.lookStart.set(touch.clientX, touch.clientY);
                break;
            }
        }
    }
    
    onLookMove(event) {
        if (this.activeLookId === null) return;
        
        for(let touch of event.changedTouches) {
            if (touch.identifier === this.activeLookId) {
                const currentPos = new THREE.Vector2(touch.clientX, touch.clientY);
                this.lookVector.copy(currentPos).sub(this.lookStart);
                this.lookStart.copy(currentPos); // Update start for next frame
                break;
            }
        }
    }
    
    onLookEnd(event) {
        for(let touch of event.changedTouches) {
            if (touch.identifier === this.activeLookId) {
                this.activeLookId = null;
                this.lookVector.set(0,0);
                break;
            }
        }
    }
}
