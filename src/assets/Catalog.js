// src/assets/Catalog.js
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- Master Asset Catalog ---------- */
export function makeCatalog() {
  const size = { x: 4, y: 4, z: 4 }; // Standard 4x4x4 unit size
  return [
    // --- Tools ---
    { id: "tool_pit_digger", name: "Pit Digger", category: "Tools", baseType: "tool", size: { x: 4, y: 4, z: 4 }, preview: "#ff6b6b" },
    
    // --- Floors ---
    { id: "floor_plates_01", name: "Tech Plates", category: "Floors", baseType: "floor", subType: "plates_01", size: { ...size, y: 0.2 }, preview: "#6c7a89" },
    { id: "floor_grate_01", name: "Industrial Grate", category: "Floors", baseType: "floor", subType: "grate_01", size: { ...size, y: 0.2 }, preview: "#56616c" },
    { id: "floor_solid_01", name: "Solid Panel", category: "Floors", baseType: "floor", subType: "solid_01", size: { ...size, y: 0.2 }, preview: "#8a96a2" },
    { id: "floor_vents_01", name: "Vented Floor", category: "Floors", baseType: "floor", subType: "vents_01", size: { ...size, y: 0.2 }, preview: "#76828e" },
    { id: "floor_pipes_01", name: "Piped Floor", category: "Floors", baseType: "floor", subType: "pipes_01", size: { ...size, y: 0.3 }, preview: "#6e7b88" },
    
    // --- Walls ---
    { id: "wall_solid_01", name: "Solid Wall", category: "Walls", baseType: "wall", subType: "solid_01", size, preview: "#6c7a89" },
    { id: "wall_panel_01", name: "Inset Panel", category: "Walls", baseType: "wall", subType: "panel_01", size, preview: "#56616c" },
    { id: "wall_vent_01", name: "Vented Wall", category: "Walls", baseType: "wall", subType: "vent_01", size, preview: "#76828e" },
    { id: "wall_pipes_01", name: "Piped Wall", category: "Walls", baseType: "wall", subType: "pipes_01", size, preview: "#6e7b88" },
    { id: "wall_strut_01", name: "Support Strut", category: "Walls", baseType: "wall", subType: "strut_01", size, preview: "#8a96a2" },

    // --- Doors ---
    { id: "door_blast_01", name: "Blast Door", category: "Doors", baseType: "door", size, preview: "#a0aab8" },
    { id: "door_hangar_01", name: "Hangar Door", category: "Doors", baseType: "door", size: {...size, x: 8}, preview: "#8a96a2" },

    // --- Ramps & Railings ---
    { id: "ramp_solid_01", name: "Solid Ramp", category: "Ramps & Railings", baseType: "ramp", size: { ...size, z: 8 }, preview: "#6c7a89" },
    { id: "railing_bars_01", name: "Bar Railing", category: "Ramps & Railings", baseType: "railing", size: { ...size, y: 2 }, preview: "#8a96a2" },

    // --- Pipes ---
    { id: "pipe_straight_01", name: "Straight Pipe", category: "Pipes", baseType: "pipe", subType: "straight", size: { x: 1, y: 1, z: 4 }, preview: "#56616c" },
    { id: "pipe_elbow_01", name: "Elbow Pipe", category: "Pipes", baseType: "pipe", subType: "elbow", size: { x: 2, y: 1, z: 2 }, preview: "#56616c" },

    // --- Lights ---
    { id: "light_wall_01", name: "Wall Light", category: "Lights", baseType: "light", subType: "wall_light", size: { x: 0.5, y: 1, z: 0.3 }, preview: "#f0f0a0" },
    { id: "light_post_01", name: "Lamp Post", category: "Lights", baseType: "light", subType: "lamp_post", size: { x: 0.5, y: 5, z: 0.5 }, preview: "#c0c090" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const createMaterial = (colorOverride) => new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap, side: THREE.DoubleSide,
    color: colorOverride || options.primaryColor,
    roughness: options.roughness, metalness: options.metalness,
  });

  let partObject;
  switch (def.baseType) {
    case 'floor': partObject = buildFloor(def, createMaterial); break;
    case 'wall': partObject = buildWall(def, createMaterial); break;
    case 'railing': partObject = buildRailing(def, createMaterial); break;
    case 'ramp': partObject = buildRamp(def, createMaterial); break;
    case 'light': partObject = buildLight(def, createMaterial); break;
    case 'pipe': partObject = buildPipe(def, createMaterial); break;
    case 'door': partObject = buildDoor(def, createMaterial); break;
    default:
      const material = createMaterial();
      const geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z);
      partObject = new THREE.Mesh(geometry, material);
  }
  
  partObject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  partObject.userData.part = def;
  return partObject;
}

// --- Specific Builders ---

function buildFloor(def, createMaterial) {
    const w = def.size.x, d = def.size.z, h = def.size.y;
    const group = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(w, h, d);
    const base = new THREE.Mesh(baseGeo, createMaterial('#444'));
    group.add(base);

    if (def.subType === 'plates_01') {
        const plateGeo = new THREE.BoxGeometry(w*0.4, h*0.6, d*0.4);
        for(let i=-1; i<=1; i+=2) {
            for (let j=-1; j<=1; j+=2) {
                const plate = new THREE.Mesh(plateGeo, createMaterial('#888'));
                plate.position.set(i*w*0.25, h*0.5, j*d*0.25);
                group.add(plate);
            }
        }
    } else if (def.subType === 'grate_01') {
        const shape = new THREE.Shape();
        const hw=w/2, hd=d/2;
        shape.moveTo(-hw, -hd); shape.lineTo(hw, -hd); shape.lineTo(hw, hd); shape.lineTo(-hw, hd);
        const holeSize = 0.2, barSize = 0.05, step = holeSize+barSize;
        for(let i=0; i < w/step; i++) {
            for (let j=0; j < d/step; j++) {
                const hole = new THREE.Path();
                const x = -hw + i*step + barSize, z = -hd + j*step + barSize;
                hole.rect(x, z, holeSize, holeSize);
                shape.holes.push(hole);
            }
        }
        const geo = new THREE.ExtrudeGeometry(shape, {depth:h, bevelEnabled:false});
        geo.rotateX(Math.PI/2).translate(0, h/2, 0);
        const grate = new THREE.Mesh(geo, createMaterial('#666'));
        group.add(grate);
    }
    return group;
}

function buildWall(def, createMaterial) {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const group = new THREE.Group();
    const frameGeo = new RoundedBoxGeometry(w, h, d, 2, d * 0.2);
    const frame = new THREE.Mesh(frameGeo, createMaterial('#555'));
    group.add(frame);

    if (def.subType === 'panel_01') {
        const panelGeo = new THREE.BoxGeometry(w*0.8, h*0.8, d*1.1);
        const panel = new THREE.Mesh(panelGeo, createMaterial('#777'));
        group.add(panel);
    } else if (def.subType === 'vent_01') {
        const ventGeo = new THREE.BoxGeometry(w*0.7, h*0.4, d*1.1);
        const vent = new THREE.Mesh(ventGeo, createMaterial('#333'));
        group.add(vent);
    }
    return group;
}

function buildRailing(def, createMaterial) {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const group = new THREE.Group();
    const material = createMaterial('#999');
    
    const postGeo = new RoundedBoxGeometry(d * 1.5, h, d * 1.5, 4, d * 0.7);
    const post1 = new THREE.Mesh(postGeo, material);
    post1.position.x = -w/2 + (d*0.75);
    const post2 = new THREE.Mesh(postGeo, material);
    post2.position.x = w/2 - (d*0.75);
    group.add(post1, post2);

    const railGeo = new RoundedBoxGeometry(w, d*1.5, d*1.5, 4, d*0.7);
    const rail = new THREE.Mesh(railGeo, material);
    rail.position.y = h/2 - d*0.75;
    group.add(rail);

    return group;
}

function buildRamp(def, createMaterial) {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const geo = new THREE.BoxGeometry(w,h,d);
    const pos = geo.attributes.position;
    for (let i=0; i<pos.count; i++) {
        if(pos.getZ(i) < 0) { // Back vertices
            if(pos.getY(i) > 0) { // Top-back vertices
                pos.setY(i, -h/2);
            }
        }
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, createMaterial('#777'));
}

function buildLight(def, createMaterial) {
    const group = new THREE.Group();
    if (def.subType === 'wall_light') {
        const caseGeo = new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 2, 0.05);
        const caseMesh = new THREE.Mesh(caseGeo, createMaterial('#555'));
        group.add(caseMesh);
        const lightMat = createMaterial('#ffffee');
        lightMat.emissive = new THREE.Color('#ffffdd');
        lightMat.emissiveIntensity = 3;
        const lightGeo = new THREE.SphereGeometry(def.size.x * 0.3, 16, 8);
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.z = def.size.z * 0.4;
        group.add(light);
    } else if (def.subType === 'lamp_post') {
        const postGeo = new THREE.CylinderGeometry(0.1, 0.15, def.size.y, 12);
        const post = new THREE.Mesh(postGeo, createMaterial('#666'));
        group.add(post);
        const headGeo = new RoundedBoxGeometry(def.size.x, 0.4, def.size.z, 2, 0.1);
        const head = new THREE.Mesh(headGeo, createMaterial('#555'));
        head.position.y = def.size.y/2;
        group.add(head);
    }
    return group;
}

function buildPipe(def, createMaterial) {
    const material = createMaterial('#777');
    if (def.subType === 'straight') {
        const geo = new THREE.CylinderGeometry(def.size.x/2, def.size.x/2, def.size.z, 16);
        geo.rotateX(Math.PI/2);
        return new THREE.Mesh(geo, material);
    } else if (def.subType === 'elbow') {
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-def.size.x/2, 0, 0),
            new THREE.Vector3(-def.size.x/2, 0, def.size.z/2),
            new THREE.Vector3(0, 0, def.size.z/2)
        );
        const geo = new THREE.TubeGeometry(curve, 20, def.size.y/2, 12, false);
        return new THREE.Mesh(geo, material);
    }
    return new THREE.Group();
}

function buildDoor(def, createMaterial) {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const group = new THREE.Group();
    const frameGeo = new RoundedBoxGeometry(w, h, d, 2, d*0.2);
    const frame = new THREE.Mesh(frameGeo, createMaterial('#333'));
    group.add(frame);
    const doorGeo = new THREE.BoxGeometry(w*0.8, h*0.9, d*1.5);
    const door = new THREE.Mesh(doorGeo, createMaterial('#999'));
    group.add(door);
    return group;
}

