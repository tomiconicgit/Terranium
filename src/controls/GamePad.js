// src/controls/GamePad.js

import * as THREE from 'three';
// FIX: Use namespace import for nipplejs, as it has no default export
import * as nipplejs from 'nipplejs';

export class GamepadController {
  constructor(cameraRig) {
    this.cameraRig = cameraRig;
    this.speed = 8;
    this.lookSpeed = 2.0;
    
    // State for touch controls
    this.moveVector = new THREE.Vector2(); // For joystick
    this.lookVector = new THREE.Vector2(); // For screen drag
    this.isLooking = false;
    this.touchLookId = null; // To track the finger used for looking
  }

  connect() {
    this.setupTouchControls();
  }

  setupTouchControls() {
    // Check if it's a touch device
    if ('ontouchstart' in window) {
      // --- Joystick for Movement ---
      const joystickZone = document.getElementById('joystick-container');
      const options = {
        zone: joystickZone,
        mode: 'static',
        position: { left: '60px', bottom: '60px' },
        color: 'rgba(255,255,255,0.5)',
        size: 100
      };
      const manager = nipplejs.create(options);

      manager.on('move', (evt, data) => {
        if (data.vector) {
          this.moveVector.set(data.vector.x, data.vector.y);
        }
      });
      manager.on('end', () => {
        this.moveVector.set(0, 0);
      });
      
      // --- Touch Drag for Looking ---
      const canvas = document.querySelector('#app canvas');
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), false);
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), false);
      canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), false);
    }
  }

  onTouchStart(event) {
    event.preventDefault();
    // Find the first touch that is not on the joystick
    for (const touch of event.changedTouches) {
        if (touch.target.closest('#joystick-container')) continue;
        
        if (this.touchLookId === null) { // Only start looking if we aren't already
            this.touchLookId = touch.identifier;
            this.isLooking = true;
            this.lookVector.set(touch.clientX, touch.clientY);
            break; // Handle one touch for looking
        }
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
        if (touch.identifier === this.touchLookId) {
            const currentX = touch.clientX;
            const currentY = touch.clientY;
            
            const deltaX = (currentX - this.lookVector.x) * 0.005;
            const deltaY = (currentY - this.lookVector.y) * 0.005;

            this.cameraRig.rotate(deltaX, deltaY);
            
            this.lookVector.set(currentX, currentY);
            break;
        }
    }
  }
  
  onTouchEnd(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
        if (touch.identifier === this.touchLookId) {
            this.isLooking = false;
            this.touchLookId = null;
            break;
        }
    }
  }

  getGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (gp && gp.connected) return gp;
    }
    return null;
  }

  deadzone(value, threshold = 0.15) {
    return Math.abs(value) < threshold ? 0 : value;
  }

  update(deltaTime) {
    const gamepad = this.getGamepad();
    
    let moveX = this.moveVector.x;
    // Invert joystick Y because 'up' is positive, but we need negative for forward
    let moveZ = -this.moveVector.y; 
    let lookX = 0;
    let lookY = 0;
    let flyY = 0;

    // Override with gamepad if connected and active
    if (gamepad) {
      const gpMoveX = this.deadzone(gamepad.axes[0]);
      const gpMoveZ = this.deadzone(gamepad.axes[1]);
      if (gpMoveX !== 0 || gpMoveZ !== 0) {
        moveX = gpMoveX;
        moveZ = gpMoveZ; // Gamepad 'up' is already negative
      }

      const gpLookX = this.deadzone(gamepad.axes[2]) * this.lookSpeed * deltaTime;
      const gpLookY = this.deadzone(gamepad.axes[3]) * this.lookSpeed * deltaTime;
      if (gpLookX !== 0 || gpLookY !== 0) {
        lookX = gpLookX;
        lookY = gpLookY;
      }
      
      const flyUp = gamepad.buttons[7]?.value || (gamepad.buttons[5]?.pressed ? 1 : 0);
      const flyDown = gamepad.buttons[6]?.value || (gamepad.buttons[4]?.pressed ? 1 : 0);
      flyY = flyUp - flyDown;
    }
    
    // Apply look rotation from gamepad (touch is handled in its own event)
    if (lookX !== 0 || lookY !== 0) {
       this.cameraRig.rotate(lookX, lookY);
    }
    
    // Apply movement from either touch joystick or gamepad
    this.cameraRig.move(moveX, moveZ, flyY, deltaTime, this.speed);
  }
}
