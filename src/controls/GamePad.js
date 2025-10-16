// src/controls/GamePad.js

import * as THREE from 'three';

export class GamepadController {
  constructor(cameraRig) {
    this.cameraRig = cameraRig;
    this.speed = 8;
    this.lookSpeed = 2.0;

    // Touch state
    this.moveVector = new THREE.Vector2();
    this.lookVector = new THREE.Vector2();
    this.isLooking = false;
    this.touchLookId = null;
  }

  connect() {
    this.setupTouchControls();
  }

  setupTouchControls() {
    // Touch devices only
    if (!('ontouchstart' in window)) return;

    // Use global nipplejs provided by the UMD script
    const nip = window.nipplejs;
    if (!nip) {
      console.warn('[GamepadController] nipplejs global not found — joystick disabled.');
    } else {
      const joystickZone = document.getElementById('joystick-container');
      const options = {
        zone: joystickZone,
        mode: 'static',
        position: { left: '60px', bottom: '60px' },
        color: 'rgba(255,255,255,0.5)',
        size: 100
      };
      const manager = nip.create(options);

      manager.on('move', (evt, data) => {
        if (data.vector) this.moveVector.set(data.vector.x, data.vector.y);
      });
      manager.on('end', () => this.moveVector.set(0, 0));
    }

    // Touch drag to look
    const canvas = document.querySelector('#app canvas');
    if (!canvas) return;

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), false);
    canvas.addEventListener('touchmove',  (e) => this.onTouchMove(e),  false);
    canvas.addEventListener('touchend',   (e) => this.onTouchEnd(e),   false);
  }

  onTouchStart(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (touch.target.closest('#joystick-container')) continue;
      if (this.touchLookId === null) {
        this.touchLookId = touch.identifier;
        this.isLooking = true;
        this.lookVector.set(touch.clientX, touch.clientY);
        break;
      }
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (touch.identifier === this.touchLookId) {
        const dx = (touch.clientX - this.lookVector.x) * 0.005;
        const dy = (touch.clientY - this.lookVector.y) * 0.005;
        this.cameraRig.rotate(dx, dy);
        this.lookVector.set(touch.clientX, touch.clientY);
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
    for (const gp of gamepads) if (gp && gp.connected) return gp;
    return null;
  }

  deadzone(value, threshold = 0.15) {
    return Math.abs(value) < threshold ? 0 : value;
  }

  update(deltaTime) {
    const gamepad = this.getGamepad();

    // Defaults from touch joystick
    let moveX = this.moveVector.x;
    let moveZ = -this.moveVector.y; // invert to make up = forward
    let lookX = 0, lookY = 0, flyY = 0;

    // If a gamepad is active, override
    if (gamepad) {
      const gpMoveX = this.deadzone(gamepad.axes[0]);
      const gpMoveZ = this.deadzone(gamepad.axes[1]);
      if (gpMoveX !== 0 || gpMoveZ !== 0) {
        moveX = gpMoveX;
        moveZ = gpMoveZ; // already negative when pushing forward
      }

      lookX = this.deadzone(gamepad.axes[2]) * this.lookSpeed * deltaTime;
      lookY = this.deadzone(gamepad.axes[3]) * this.lookSpeed * deltaTime;

      const flyUp = gamepad.buttons[7]?.value || (gamepad.buttons[5]?.pressed ? 1 : 0);
      const flyDown = gamepad.buttons[6]?.value || (gamepad.buttons[4]?.pressed ? 1 : 0);
      flyY = flyUp - flyDown;
    }

    if (lookX || lookY) this.cameraRig.rotate(lookX, lookY);
    this.cameraRig.move(moveX, moveZ, flyY, deltaTime, this.speed);
  }
}