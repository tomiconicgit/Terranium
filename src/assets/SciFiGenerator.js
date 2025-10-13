// src/assets/SciFiGenerator.js
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMetalPanelMaterial } from '../materials/ProcPanel.js';

// --- Material Cache ---
// Cache materials to avoid recreating them for every single part
const sciFiMaterials = {};
const emissiveMaterials = {};

function getSciFiMaterial(params) {
    const key = `sci-fi-${params.baseColor}-${params.roughness}-${params.metalness}`;
    if (!sciFiMaterials[key]) {
        sciFiMaterials[key] = createMetalPanelMaterial({
            baseColor: params.baseColor,
            roughness: params.roughness,
            metalness: params.metalness,
            panelSize: 1.5,
            seamWidth: 0.02,
            seamDark: 0.7,
            bolts: false, // Turn off default bolts; we'll add geometric ones
            mode: 'wall'
        });
    }
    return sciFiMaterials[key];
}

function getEmissiveMaterial(color) {
    const key = `emissive-${color}`;
    if (!emissiveMaterials[key]) {
        emissiveMaterials[key] = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2,
            toneMapped: false // Important for bloom to work correctly
        });
    }
    return emissiveMaterials[key];
}


// --- Main Generator Function ---
export function buildSciFiPart(def) {
    const group = new THREE.Group();
    const params = def.genParams;

    const mainGeos = [];
    const lightGeos = [];

    // Dispatch to the correct generator based on style
    switch (params.style) {
        case 'industrial_wall':
            generateIndustrialWall(def, params, mainGeos, lightGeos, group);
            break;
        case 'grate_floor':
            generateGrateFloor(def, params, mainGeos);
            break;
        case 'support_beam':
            generateSupportBeam(def, params, mainGeos, lightGeos, group);
            break;
    }

    // --- Finalize and Merge ---
    if (mainGeos.length > 0) {
        // *** FIXED LINE ***
        const mergedMainGeo = BufferGeometryUtils.mergeGeometries(mainGeos);
        mergedMainGeo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(
            mergedMainGeo,
            getSciFiMaterial({
                baseColor: params.baseColor,
                roughness: params.roughness || 0.4,
                metalness: params.metalness || 0.95
            })
        );
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        group.add(mainMesh);
    }

    if (lightGeos.length > 0) {
        // *** FIXED LINE ***
        const mergedLightGeo = BufferGeometryUtils.mergeGeometries(lightGeos);
        const lightMesh = new THREE.Mesh(mergedLightGeo, getEmissiveMaterial(params.lightColor));
        group.add(lightMesh);
    }

    return group;
}


// --- Specific Asset Generators ---

function generateIndustrialWall(def, params, mainGeos, lightGeos, group) {
    const { x: w, y: h, z: d } = def.size;

    // Base Panel
    const baseGeo = new THREE.BoxGeometry(w, h, d * 0.5);
    baseGeo.translate(0, 0, -d * 0.25); // Push back
    mainGeos.push(baseGeo);

    // Frame
    const frameW = 0.15;
    const topFrame = new THREE.BoxGeometry(w, frameW, d);
    topFrame.translate(0, h / 2 - frameW / 2, 0);
    const bottomFrame = new THREE.BoxGeometry(w, frameW, d);
    bottomFrame.translate(0, -h / 2 + frameW / 2, 0);
    const leftFrame = new THREE.BoxGeometry(frameW, h - frameW * 2, d);
    leftFrame.translate(-w / 2 + frameW / 2, 0, 0);
    const rightFrame = new THREE.BoxGeometry(frameW, h - frameW * 2, d);
    rightFrame.translate(w / 2 - frameW / 2, 0, 0);
    mainGeos.push(topFrame, bottomFrame, leftFrame, rightFrame);

    // X-Braces
    const braceW = 0.25;
    const braceL = Math.sqrt(w * w + h * h) * 0.8;
    const brace1 = new THREE.BoxGeometry(braceL, braceW, d * 0.6);
    brace1.rotateZ(Math.atan2(h, w));
    const brace2 = new THREE.BoxGeometry(braceL, braceW, d * 0.6);
    brace2.rotateZ(-Math.atan2(h, w));
    mainGeos.push(brace1, brace2);

    // Lights
    if (params.hasLights) {
        const lightStrip = new THREE.BoxGeometry(w * 0.6, 0.08, 0.08);
        lightStrip.translate(0, 0, d / 2);
        lightGeos.push(lightStrip);

        const light = new THREE.PointLight(params.lightColor, 8.0, 5.0, 1.5); // color, intensity, distance, decay
        light.position.set(0, 0, d / 2 + 0.2);
        group.add(light);
    }
}

function generateGrateFloor(def, params, mainGeos) {
    const { x: w, z: h, y: d } = def.size; // Note: for floors, y is depth
    const grateSize = 0.2;
    const barSize = 0.05;

    // Frame
    const frameW = 0.1;
    const topFrame = new THREE.BoxGeometry(w, d, frameW);
    topFrame.translate(0, 0, -h/2 + frameW/2);
    const btmFrame = new THREE.BoxGeometry(w, d, frameW);
    btmFrame.translate(0, 0, h/2 - frameW/2);
    const lftFrame = new THREE.BoxGeometry(frameW, d, h - frameW*2);
    lftFrame.translate(-w/2 + frameW/2, 0, 0);
    const rgtFrame = new THREE.BoxGeometry(frameW, d, h - frameW*2);
    rgtFrame.translate(w/2 - frameW/2, 0, 0);
    mainGeos.push(topFrame, btmFrame, lftFrame, rgtFrame);

    // Grate bars
    const numBarsX = Math.floor((w - frameW*2) / grateSize);
    for (let i = 0; i <= numBarsX; i++) {
        const x = -w/2 + frameW + i * grateSize;
        const bar = new THREE.BoxGeometry(barSize, d, h - frameW*2);
        bar.translate(x, 0, 0);
        mainGeos.push(bar);
    }
    const numBarsZ = Math.floor((h - frameW*2) / grateSize);
    for (let i = 0; i <= numBarsZ; i++) {
        const z = -h/2 + frameW + i * grateSize;
        const bar = new THREE.BoxGeometry(w - frameW*2, d, barSize);
        bar.translate(0, 0, z);
        mainGeos.push(bar);
    }
}

function generateSupportBeam(def, params, mainGeos, lightGeos, group) {
    const { x: w, y: h, z: d } = def.size;

    // Main vertical I-beam shape
    const verticalPlate = new THREE.BoxGeometry(w * 0.2, h, d * 0.2);
    const topPlate = new THREE.BoxGeometry(w, h * 0.05, d);
    topPlate.translate(0, h/2 - h*0.025, 0);
    const bottomPlate = new THREE.BoxGeometry(w, h * 0.05, d);
    bottomPlate.translate(0, -h/2 + h*0.025, 0);
    mainGeos.push(verticalPlate, topPlate, bottomPlate);

    // Lights
    if (params.hasLights) {
        const lightSize = 0.15;
        const lightGeo1 = new THREE.BoxGeometry(w * 1.02, lightSize, lightSize);
        lightGeo1.translate(0, h * 0.3, d/2 - lightSize/2);
        const lightGeo2 = new THREE.BoxGeometry(w * 1.02, lightSize, lightSize);
        lightGeo2.translate(0, -h * 0.3, d/2 - lightSize/2);
        lightGeos.push(lightGeo1, lightGeo2);

        const light1 = new THREE.PointLight(params.lightColor, 5.0, 4.0, 1.5);
        light1.position.set(0, h * 0.3, d/2);
        const light2 = light1.clone();
        light2.position.set(0, -h * 0.3, d/2);
        group.add(light1, light2);
    }
}
