import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.7; // Head height

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const manager = new THREE.LoadingManager();
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
    document.getElementById('loading').innerText = `Loading: ${progress}%`;
};
manager.onLoad = () => {
    document.getElementById('loading').style.display = 'none';
    animate();
};

const terrain = createTerrain(manager);
scene.add(terrain);

createSky(scene);

const controls = new Controls(camera, renderer.domElement, terrain);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});