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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    player.update();
    camera.update();
    renderer.render(scene, camera);
}
animate();