// src/controls/GamePad.js

import * as THREE from 'three';

export class GamepadController {
  constructor(cameraRig) {
    this.cameraRig = cameraRig;
    this.speed = 8;
    this.lookSpeed = 2.0;
  }

  connect() {
    // We can add touch/keyboard listeners here in the future
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
    if (!gamepad) return;

    // Movement axes (Left stick)
    const moveX = this.deadzone(gamepad.axes[0]);
    const moveZ = this.deadzone(gamepad.axes[1]);
    
    // Look axes (Right stick)
    const lookX = this.deadzone(gamepad.axes[2]) * this.lookSpeed * deltaTime;
    const lookY = this.deadzone(gamepad.axes[3]) * this.lookSpeed * deltaTime;
    
    // Fly controls (Triggers or buttons)
    const flyUp = gamepad.buttons[7]?.pressed ? 1 : 0;
    const flyDown = gamepad.buttons[6]?.pressed ? -1 : 0;
    const flyY = flyUp + flyDown;

    this.cameraRig.rotate(lookX, lookY);
    this.cameraRig.move(moveX, -moveZ, flyY, deltaTime, this.speed);
  }
}
