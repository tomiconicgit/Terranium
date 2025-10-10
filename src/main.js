import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { Scene } from './scene/Scene.js';
import { Player } from './player/Player.js';
import { Camera } from './camera/Camera.js';
import { DesktopControls } from './controls/DesktopControls.js';
import { MobileControls } from './controls/MobileControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const player = new Player();
scene.add(player.mesh);
const camera = new Camera(player);

const isMobile = 'ontouchstart' in window;
let controls;
if (isMobile) {
    controls = new MobileControls(player, camera);
} else {
    controls = new DesktopControls(player, camera);
}

const landscape = scene.getObjectByName('landscape');
const clock = new THREE.Clock(); // Clock for time-based movement

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); // Get time since last frame

    controls.update(); // Controls will set the player's desired movement
    player.update(landscape, delta); // Player updates its position based on delta
    camera.update(delta); // Camera updates head-bob based on delta
    
    renderer.render(scene, camera);
}
animate();

// --- Prevent Double Tap Zoom ---
let lastTap = 0;
document.body.addEventListener('touchend', (event) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault();
    }
    lastTap = currentTime;
});
