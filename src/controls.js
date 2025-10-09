import * as THREE from 'three';

export class Controls {
  constructor(camera, domElement, terrain) {
    this.camera = camera;
    this.domElement = domElement;
    this.terrain = terrain;

    // Tunables
    this.lookSpeedTouch = 0.005;
    this.lookSpeedMouse = 0.0025;
    this.moveSpeed = 0.12;
    this.sprintMultiplier = 1.8;

    // State
    this.pitch = 0;
    this.yaw = 0;

    this.moveDirection = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    // --- Touch states ---
    this.touchLookId = null;
    this.touchLookStart = new THREE.Vector2();

    this.touchMoveId = null;
    this.touchMoveStart = new THREE.Vector2();
    this.touchMoveCurrent = new THREE.Vector2();

    // --- Mouse states ---
    this.mouseLookActive = false;
    this.mouseLast = new THREE.Vector2();

    // --- Keyboard states ---
    this.keys = {
      w: false, a: false, s: false, d: false,
      shift: false
    };

    // --- Visual Joystick UI ---
    this.joy = {
      base: document.createElement('div'),
      knob: document.createElement('div'),
      radius: 70, // px radius for clamp (half of 140px base)
      active: false
    };
    this.joy.base.className = 'joy-base';
    this.joy.knob.className = 'joy-knob';
    document.body.appendChild(this.joy.base);
    document.body.appendChild(this.joy.knob);
    this.parkJoystick();

    // ---- Listeners ----
    // TOUCH
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.domElement.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // MOUSE
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), { passive: false });
    window.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: false });
    window.addEventListener('mouseup', this.onMouseUp.bind(this), { passive: false });
    // avoid context menu on long press/right click in canvas
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // KEYBOARD
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  // ---------- UI helpers ----------
  parkJoystick() {
    // default parked position (bottom-left) respecting safe area if present
    const cs = getComputedStyle(document.documentElement);
    const safeLeft = parseInt(cs.getPropertyValue('--safe-left') || '0', 10) || 0;
    const safeBottom = parseInt(cs.getPropertyValue('--safe-bottom') || '0', 10) || 0;

    const baseSize = 140;
    const left = 20 + safeLeft;
    const bottom = 20 + safeBottom;

    this.joy.base.style.left = `${left}px`;
    this.joy.base.style.top = `calc(100vh - ${bottom + baseSize}px)`;
    this.joy.knob.style.left = `${left + baseSize / 2}px`;
    this.joy.knob.style.top = `calc(100vh - ${bottom + baseSize / 2}px)`;

    this.joy.base.classList.remove('joy-active');
    this.joy.knob.classList.remove('joy-active');
  }

  // ---------- TOUCH ----------
  onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;

      if (t.clientX < halfW && t.clientY > halfH) {
        // bottom-left quadrant => MOVEMENT
        if (this.touchMoveId === null) {
          this.touchMoveId = t.identifier;
          this.touchMoveStart.set(t.clientX, t.clientY);
          this.touchMoveCurrent.copy(this.touchMoveStart);

          // place joystick at touch position
          this.joy.base.style.left = `${t.clientX - this.joy.radius}px`;
          this.joy.base.style.top = `${t.clientY - this.joy.radius}px`;
          this.joy.knob.style.left = `${t.clientX}px`;
          this.joy.knob.style.top = `${t.clientY}px`;
          this.joy.base.classList.add('joy-active');
          this.joy.knob.classList.add('joy-active');
          this.joy.active = true;
        }
      } else {
        // elsewhere => LOOK
        if (this.touchLookId === null) {
          this.touchLookId = t.identifier;
          this.touchLookStart.set(t.clientX, t.clientY);
        }
      }
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.touchLookId) {
        const dx = t.clientX - this.touchLookStart.x;
        const dy = t.clientY - this.touchLookStart.y;
        this.yaw   -= dx * this.lookSpeedTouch;
        this.pitch -= dy * this.lookSpeedTouch;
        this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));
        this.touchLookStart.set(t.clientX, t.clientY);
      } else if (t.identifier === this.touchMoveId) {
        this.touchMoveCurrent.set(t.clientX, t.clientY);

        // move visual knob within radius
        const delta = new THREE.Vector2().subVectors(this.touchMoveCurrent, this.touchMoveStart);
        const len = delta.length();
        const r = this.joy.radius;
        const clamped = delta.clone();
        if (len > r) clamped.multiplyScalar(r / len);

        const baseCenter = new THREE.Vector2(
          parseFloat(this.joy.base.style.left) + r,
          parseFloat(this.joy.base.style.top) + r
        );
        this.joy.knob.style.left = `${baseCenter.x + clamped.x}px`;
        this.joy.knob.style.top  = `${baseCenter.y + clamped.y}px`;
      }
    }
  }

  onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.touchLookId) {
        this.touchLookId = null;
      } else if (t.identifier === this.touchMoveId) {
        this.touchMoveId = null;
        this.moveDirection.set(0, 0, 0);

        // fade joystick then park it
        this.joy.active = false;
        this.joy.base.classList.remove('joy-active');
        this.joy.knob.classList.remove('joy-active');
        setTimeout(() => this.parkJoystick(), 120);
      }
    }
  }

  // ---------- MOUSE ----------
  onMouseDown(e) {
    // left button: look (drag); middle/right: also allowed
    e.preventDefault();
    this.mouseLookActive = true;
    this.mouseLast.set(e.clientX, e.clientY);
  }

  onMouseMove(e) {
    if (!this.mouseLookActive) return;
    const dx = e.clientX - this.mouseLast.x;
    const dy = e.clientY - this.mouseLast.y;
    this.yaw   -= dx * this.lookSpeedMouse;
    this.pitch -= dy * this.lookSpeedMouse;
    this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));
    this.mouseLast.set(e.clientX, e.clientY);
  }

  onMouseUp() {
    this.mouseLookActive = false;
  }

  // ---------- KEYBOARD ----------
  onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (['w','a','s','d'].includes(k)) e.preventDefault();
    if (k === 'w') this.keys.w = true;
    if (k === 'a') this.keys.a = true;
    if (k === 's') this.keys.s = true;
    if (k === 'd') this.keys.d = true;
    if (k === 'shift') this.keys.shift = true;
  }
  onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'w') this.keys.w = false;
    if (k === 'a') this.keys.a = false;
    if (k === 's') this.keys.s = false;
    if (k === 'd') this.keys.d = false;
    if (k === 'shift') this.keys.shift = false;
  }

  // ---------- UPDATE ----------
  update() {
    // Apply rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // --- Movement from keyboard ---
    const kb = new THREE.Vector3(
      (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0),
      0,
      (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0) // W forward, S back  (forward = -Z)
    );

    // --- Movement from joystick (FIXED forward/back sign) ---
    // Screen coords: up = decreasing Y. We want up to mean FORWARD (-Z),
    // so we map z = (touchDeltaY) (NOT negative), because later we rotate
    // this vector by the camera quaternion (where forward is -Z).
    let joy = new THREE.Vector3();
    if (this.touchMoveId !== null) {
      const delta = this.touchMoveCurrent.clone().sub(this.touchMoveStart);
      const len = delta.length();
      const dead = 12;
      if (len > dead) {
        const r = this.joy.radius;
        const strength = Math.min(1, (len - dead) / (r - dead));
        delta.normalize();
        // x -> strafe;  y -> forward/back (FIXED: forward when pushing UP)
        joy.set(delta.x, 0, delta.y).multiplyScalar(strength);
      }
    }

    // Combine inputs
    const moveLocal = kb.add(joy);
    if (moveLocal.lengthSq() > 0) {
      moveLocal.normalize();
      let speed = this.moveSpeed * (this.keys.shift ? this.sprintMultiplier : 1.0);

      // Convert from camera-local to world
      const moveWorld = moveLocal.applyQuaternion(this.camera.quaternion);
      moveWorld.y = 0;
      this.camera.position.addScaledVector(moveWorld, speed);
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
