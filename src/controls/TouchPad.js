import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class TouchPad {
  constructor() {
    this.createJoystick();

    // Public vectors read by Main.js
    this.moveVector = new THREE.Vector2();
    this.lookVector = new THREE.Vector2();

    this.activeLookId = null;
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

  // Treat anything inside these containers as UI (don’t start look there)
  _isUITarget(el) {
    return !!(el && el.closest &&
      el.closest('#engine-panel, #transform-panel, #ui-container, #debugger-notifications, .no-look'));
  }

  addEventListeners() {
    // Joystick (we do preventDefault here so the page doesn’t scroll)
    this.joystickContainer.addEventListener('touchstart', (e) => this.onJoystickMove(e), { passive: false });
    this.joystickContainer.addEventListener('touchmove',  (e) => this.onJoystickMove(e), { passive: false });
    this.joystickContainer.addEventListener('touchend',   () => this.onJoystickEnd(),   { passive: true  });
    this.joystickContainer.addEventListener('touchcancel',() => this.onJoystickEnd(),   { passive: true  });

    // Camera look — **do not** preventDefault on UI touches
    window.addEventListener('touchstart', (e) => this.onLookStart(e), { passive: true  });
    window.addEventListener('touchmove',  (e) => this.onLookMove(e),  { passive: false });
    window.addEventListener('touchend',   (e) => this.onLookEnd(e),   { passive: true  });
    window.addEventListener('touchcancel',(e) => this.onLookEnd(e),   { passive: true  });
  }

  // ── Joystick ────────────────────────────────────────────────────────────────
  onJoystickMove(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.joystickBase.getBoundingClientRect();

    const x = touch.clientX - rect.left - this.joystickRadius;
    const y = touch.clientY - rect.top - this.joystickRadius;
    const distance = Math.min(this.joystickRadius, Math.hypot(x, y));
    const angle = Math.atan2(y, x);

    this.joystickNub.style.transform =
      `translate(${distance * Math.cos(angle)}px, ${distance * Math.sin(angle)}px)`;

    this.moveVector.set(
      (distance / this.joystickRadius) * Math.cos(angle),
      (distance / this.joystickRadius) * Math.sin(angle)
    );
  }

  onJoystickEnd() {
    this.joystickNub.style.transform = 'translate(0, 0)';
    this.moveVector.set(0, 0);
  }

  // ── Camera look ─────────────────────────────────────────────────────────────
  onLookStart(event) {
    // ignore touches that start on UI elements (do NOT preventDefault)
    for (const touch of event.changedTouches) {
      if (this._isUITarget(touch.target) || touch.target === this.joystickBase) continue;
      this.activeLookId = touch.identifier;
      this.lookStart.set(touch.clientX, touch.clientY);
      break;
    }
  }

  onLookMove(event) {
    if (this.activeLookId === null) return;

    for (const touch of event.changedTouches) {
      if (touch.identifier === this.activeLookId) {
        // If this finger moves over UI later, just stop updating (don’t cancel UI)
        if (this._isUITarget(touch.target)) return;

        const currentPos = new THREE.Vector2(touch.clientX, touch.clientY);
        this.lookVector.copy(currentPos).sub(this.lookStart);
        this.lookStart.copy(currentPos);
        event.preventDefault(); // only while we’re actively rotating the camera
        break;
      }
    }
  }

  onLookEnd(event) {
    for (const touch of event.changedTouches) {
      if (touch.identifier === this.activeLookId) {
        this.activeLookId = null;
        this.lookVector.set(0, 0);
        break;
      }
    }
  }
}