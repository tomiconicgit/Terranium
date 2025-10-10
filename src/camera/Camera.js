import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;

        this.eyeHeight = 1.78; // ~5ft10
        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 3.0);

        this.pitch = 0;
        this.rotation.order = 'YXZ';

        // Head-bob tuned for 2 steps per tile:
        this.stepLength = 0.5;      // tiles per step (2 steps/tile)
        this.bobAmount = 0.03;      // vertical amplitude
        this.bobSway = 0.015;       // lateral sway
        this._bobPhase = 0;
        this._lastXZ = new THREE.Vector2(player.mesh.position.x, player.mesh.position.z);

        // Lean from lateral velocity
        this.lean = 0;
    }

    update(dt, player = this.player) {
        // distance traveled in XZ this frame
        const curXZ = new THREE.Vector2(player.mesh.position.x, player.mesh.position.z);
        const dist = curXZ.distanceTo(this._lastXZ);
        this._lastXZ.copy(curXZ);

        // steps/sec = speed / stepLength => advance phase accordingly
        if (dist > 0) this._bobPhase += (dist / this.stepLength) * Math.PI * 2;

        const bobY = Math.sin(this._bobPhase) * this.bobAmount;
        const swayX = Math.sin(this._bobPhase * 2.0) * this.bobSway;

        // lean with strafe component (approx from velocity x)
        const desiredLean = THREE.MathUtils.clamp(-player.velocity.x * 0.05, -0.12, 0.12);
        this.lean = THREE.MathUtils.damp(this.lean, desiredLean, 8, dt);

        // apply
        this.position.y = this.eyeHeight + bobY;
        this.position.x = swayX;

        // fixed FOV (no sprint)
        this.updateProjectionMatrix();

        this.rotation.x = -this.pitch;
        this.rotation.z = this.lean;

        // look slightly ahead
        const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation);
        const target = player.mesh.position.clone().addScaledVector(fwd, 5).setY(player.mesh.position.y + this.eyeHeight * 0.4);
        this.lookAt(target);
    }
}