// src/assets/Catalog.js — Defines all buildable parts and their geometries
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

let _catalog = null;

export function makeCatalog(){
  if(_catalog) return _catalog;

  const catalog = [
    {
      id: "metal_floor",
      name: "Metal Floor",
      size: new THREE.Vector3(10, 0.5, 10),
      color: 0x888888,
      roughness: 0.2,
      metalness: 1.0,
      reflectivity: 1.0,
      build: (settings) => {
        const geom = new THREE.BoxGeometry(10, 0.5, 10);
        const mesh = new THREE.Mesh(geom);
        mesh.name = 'metal_floor';
        return mesh;
      }
    },
    {
      id: "metal_beam",
      name: "Metal Beam",
      size: new THREE.Vector3(1, 10, 1),
      color: 0x666666,
      roughness: 0.3,
      metalness: 1.0,
      reflectivity: 1.0,
      build: (settings) => {
        const geom = new THREE.BoxGeometry(1, 10, 1);
        const mesh = new THREE.Mesh(geom);
        mesh.name = 'metal_beam';
        return mesh;
      }
    },
    {
      id: "steel_beam",
      name: "Steel Beam",
      size: new THREE.Vector3(1.2, 10, 1.2), // Slightly larger than metal_beam
      color: 0x4A4F54, // Darker steel
      roughness: 0.2,
      metalness: 1.0,
      reflectivity: 1.0,
      build: (settings) => {
        // I-beam shape using multiple boxes
        const group = new THREE.Group();

        // Main vertical part
        const verticalGeom = new THREE.BoxGeometry(0.5, 10, 1.2); 
        const verticalMesh = new THREE.Mesh(verticalGeom);
        verticalMesh.position.y = 0; // Centered vertically
        group.add(verticalMesh);

        // Top flange
        const flangeWidth = 1.2;
        const flangeHeight = 0.2;
        const flangeGeom = new THREE.BoxGeometry(flangeWidth, flangeHeight, 1.2);

        const topFlange = new THREE.Mesh(flangeGeom);
        topFlange.position.y = 5 - (flangeHeight / 2); // Position at top
        group.add(topFlange);

        // Bottom flange
        const bottomFlange = new THREE.Mesh(flangeGeom);
        bottomFlange.position.y = -5 + (flangeHeight / 2); // Position at bottom
        group.add(bottomFlange);
        
        group.name = 'steel_beam';
        return group;
      }
    },
    {
      id: "steel_beam_h",
      name: "Steel Beam H",
      size: new THREE.Vector3(10, 1.2, 1.2), // Horizontal version, size swapped
      color: 0x4A4F54, // Darker steel
      roughness: 0.2,
      metalness: 1.0,
      reflectivity: 1.0,
      build: (settings) => {
        // I-beam shape using multiple boxes, oriented horizontally (along X)
        const group = new THREE.Group();

        // Main horizontal part (web)
        const webGeom = new THREE.BoxGeometry(10, 0.5, 1.2); 
        const webMesh = new THREE.Mesh(webGeom);
        webMesh.position.x = 0; // Centered horizontally
        group.add(webMesh);

        // Top flange (relative to beam's local Y)
        const flangeWidth = 10;
        const flangeHeight = 0.2;
        const flangeDepth = 1.2;
        const flangeGeom = new THREE.BoxGeometry(flangeWidth, flangeHeight, flangeDepth);

        const topFlange = new THREE.Mesh(flangeGeom);
        topFlange.position.y = 0.25 + (flangeHeight / 2); // Position at local top
        group.add(topFlange);

        // Bottom flange
        const bottomFlange = new THREE.Mesh(flangeGeom);
        bottomFlange.position.y = -0.25 - (flangeHeight / 2); // Position at local bottom
        group.add(bottomFlange);
        
        group.name = 'steel_beam_h';
        return group;
      }
    },
    // ✅ ADDED: New SciFi Roof asset
    {
      id: "scifi_roof",
      name: "SciFi Roof",
      size: new THREE.Vector3(10, 1.5, 10), // Example size, adjust as needed
      color: 0xC0C5C9, // Light grey, similar to screenshot
      roughness: 0.3,
      metalness: 0.8,
      reflectivity: 1.2,
      build: (settings) => {
        const width = 10;
        const depth = 10;
        const height = 1.5; // Overall height including slanted edges
        const slantedEdgeHeight = 0.5; // How much the edge slants upwards
        const innerHeight = height - slantedEdgeHeight; // Flat part height

        const shape = new THREE.Shape();

        // Outer rectangle
        shape.moveTo(-width / 2, -depth / 2);
        shape.lineTo(-width / 2, depth / 2);
        shape.lineTo(width / 2, depth / 2);
        shape.lineTo(width / 2, -depth / 2);
        shape.lineTo(-width / 2, -depth / 2);

        // Inner rectangle with slanted edges
        const innerWidth = width - (slantedEdgeHeight * 2); // Adjust for slanted thickness
        const innerDepth = depth - (slantedEdgeHeight * 2);

        const holePath = new THREE.Path();
        holePath.moveTo(-innerWidth / 2, -innerDepth / 2);
        holePath.lineTo(-innerWidth / 2, innerDepth / 2);
        holePath.lineTo(innerWidth / 2, innerDepth / 2);
        holePath.lineTo(innerWidth / 2, -innerDepth / 2);
        holePath.lineTo(-innerWidth / 2, -innerDepth / 2);
        shape.holes.push(holePath);

        const extrudeSettings = {
          steps: 1,
          depth: innerHeight, // Depth of the flat part
          bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(Math.PI / 2); // Orient correctly (extrude along Z, then rotate to face up)
        geometry.translate(0, 0, -innerHeight / 2); // Center vertical origin

        // Apply a slight bevel to inner and outer edges for better appearance
        // This is a simplified approach, for true bevels, need more complex geometry.
        // For now, we'll rely on shading to imply the slant.

        const mesh = new THREE.Mesh(geometry);
        mesh.name = 'scifi_roof';
        return mesh;
      }
    }
  ];

  // Set default color/roughness/metalness if not specified
  catalog.forEach(part => {
    part.color = part.color ?? 0x888888;
    part.roughness = part.roughness ?? 0.5;
    part.metalness = part.metalness ?? 0.5;
    part.reflectivity = part.reflectivity ?? 1.0;
  });

  _catalog = catalog;
  return catalog;
}

export function buildPart(def, settings, envMap){
  const obj = def.build(settings);
  obj.userData.part = def;

  obj.traverse(child => {
    if (child.isMesh) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(settings.color),
        roughness: settings.roughness,
        metalness: settings.metalness,
        envMap: envMap,
        envMapIntensity: settings.reflectivity,
        side: THREE.DoubleSide, // Ensure both sides are visible
      });
      child.material = material;
    }
  });
  return obj;
}
