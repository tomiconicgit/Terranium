import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class Camera extends THREE.PerspectiveCamera {
    constructor(player) {
        super(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.player = player;

        // base placement (3rd-person trailing)
        this.eyeHeight = 1.7;
        player.mesh.add(this);
        this.position.set(0, this.eyeHeight, 3.1);

        // look controls
        this.pitch = 0;
        this.rotation.order = 'YXZ';

        // effects
        this.bobTime = 0;
        this.bobAmount = 0.04;     // vertical bob amplitude
        this.bobSway = 0.02;       // lateral sway amplitude
        this.baseFov = 75;
        this.maxKick = 4;          // additional FOV at sprint-like speed
        this.lean = 0;             // roll on turns
    }

    update(dt /*, player passed too if needed*/, player = this.player) {
        // speed magnitude
        const speed = Math.hypot(player.velocity.x, player.velocity.z);
        const speedNorm = THREE.MathUtils.clamp(speed / 4.0, 0, 1);

        // advance bob only when moving
        const stepHz = 2.2; // steps per second at 1x speed
        this.bobTime += stepHz * (0.3 + 0.7 * speedNorm) * dt;

        // head bob (vertical) and sway (side)
        const bobY = Math.sin(this.bobTime * Math.PI * 2) * this.bobAmount * speedNorm;
        const swayX = Math.sin(this.bobTime * Math.PI * 4) * this.bobSway * speedNorm;

        // lean with turning velocity (derive yaw change from player.rotation rate via velocity direction)
        const desiredLean = THREE.MathUtils.clamp(-player.velocity.x * 0.02, -0.15, 0.15);
        this.lean = THREE.MathUtils.damp(this.lean, desiredLean, 8, dt);

        // apply offsets
        this.position.y = this.eyeHeight + bobY;
        this.position.x = swayX;

        // FOV kick with speed
        const targetFov = this.baseFov + this.maxKick * speedNorm;
        this.fov = THREE.MathUtils.damp(this.fov, targetFov, 6, dt);
        this.updateProjectionMatrix();

        // pitch (look up/down) + roll (lean)
        this.rotation.x = -this.pitch;
        this.rotation.z = this.lean;

        // keep looking a bit ahead of player
        const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation);
        const target = player.mesh.position.clone().addScaledVector(fwd, 5).setY(player.mesh.position.y + this.eyeHeight * 0.5);
        this.lookAt(target);
    }
}