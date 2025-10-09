import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

// ----- scene / camera / renderer -----
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 500);

const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 10, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;     // harmless with our custom shaders
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// if a shader fails to compile, three will now log it loudly
renderer.debug.checkShaderErrors = true;

// hide loading label (no async assets here)
const loadingEl = document.getElementById('loading');
if (loadingEl) loadingEl.style.display = 'none';

// graceful handling if WebGL context ever drops
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.error('WebGL context lost');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  console.warn('WebGL context restored');
});

// ----- sky (stars + haze) -----
const skyAPI = createSky(scene);

// ----- terrain (procedural) -----
const terrainAPI = createTerrain();
scene.add(terrainAPI.mesh);

// ----- controls -----
const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

// ----- loop -----
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  skyAPI.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

/* --------------------------
   TUNE PANEL (closed by default)
   -------------------------- */
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Space / Terrain</h3></header>

  <div class="section">Stars</div>
  <div class="grid" id="starGrid"></div>

  <div class="section">Horizon Haze</div>
  <div class="grid" id="hazeGrid"></div>

  <div class="section">Terrain</div>
  <div class="grid" id="terrainGrid"></div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

// helper: build slider+number or color or checkbox
function addRow(gridId, label, id, min, max, step, value, onChange, type='range') {
  const grid = document.getElementById(gridId);
  const rowLabel = document.createElement('div');
  rowLabel.className = 'row';
  rowLabel.innerHTML = `<label for="${id}">${label}</label>`;

  const rowInput = document.createElement('div');
  rowInput.className = 'row';

  if (type === 'color') {
    rowInput.innerHTML = `
      <div class="pair">
        <input id="${id}" type="color" value="${value}">
      </div>
    `;
  } else if (type === 'checkbox') {
    rowInput.innerHTML = `
      <div class="pair">
        <input id="${id}" type="checkbox" ${value ? 'checked' : ''}>
      </div>
    `;
  } else {
    rowInput.innerHTML = `
      <div class="pair">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        <input id="${id}Num" type="number" step="any" value="${value}">
      </div>
    `;
  }

  grid.appendChild(rowLabel);
  grid.appendChild(rowInput);

  if (type === 'color') {
    const c = document.getElementById(id);
    const fire = () => onChange(c.value);
    c.addEventListener('input', fire, { passive: true });
    c.addEventListener('change', fire, { passive: true });
  } else if (type === 'checkbox') {
    const ch = document.getElementById(id);
    const fire = () => onChange(ch.checked);
    ch.addEventListener('change', fire);
  } else {
    const r = document.getElementById(id);
    const n = document.getElementById(id + 'Num');
    const sync = (v) => {
      r.value = String(v);
      n.value = String(v);
      onChange(Number(v));
    };
    r.addEventListener('input', () => sync(r.value), { passive: true });
    n.addEventListener('input', () => sync(n.value));
    n.addEventListener('change', () => sync(n.value));
  }
}

/* ---- Stars ---- */
let starState = {
  starCount: 8000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9
};
addRow('starGrid', 'Star Count',       'starCount',        0, 15000, 100, starState.starCount,       v => { starState.starCount = v; skyAPI.setStarCount(v); });
addRow('starGrid', 'Star Size (px)',   'starSize',       0.2,     6, 0.1, starState.starSize,        v => { starState.starSize = v; skyAPI.setStarSize(v); });
addRow('starGrid', 'Twinkle Speed',    'starTwinkle',      0,     4, 0.01, starState.starTwinkleSpeed, v => { starState.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

/* ---- Haze ---- */
let hazeState = {
  hazeColor: '#223366',
  hazeHeight: 40,
  hazeRadius: 220,
  hazeAlpha: 0.6
};
addRow('hazeGrid', 'Color',   'hazeColor', 0,0,0, hazeState.hazeColor, v => { hazeState.hazeColor = v; skyAPI.setHazeColor(v); }, 'color');
addRow('hazeGrid', 'Height',  'hazeHeight',  2, 400, 1, hazeState.hazeHeight, v => { hazeState.hazeHeight = v; skyAPI.setHazeHeight(v); });
addRow('hazeGrid', 'Radius',  'hazeRadius', 20, 800, 1, hazeState.hazeRadius, v => { hazeState.hazeRadius = v; skyAPI.setHazeRadius(v); });
addRow('hazeGrid', 'Opacity', 'hazeAlpha',   0,   1, 0.01, hazeState.hazeAlpha, v => { hazeState.hazeAlpha = v; skyAPI.setHazeAlpha(v); });

/* ---- Terrain ---- */
let tState = {
  size: 50,
  segments: 128,
  height: 6,
  scale: 0.04,
  octaves: 4,
  lacunarity: 2.0,
  persistence: 0.5,
  colorLow: '#dfe5ee',
  colorMid: '#bfc7d3',
  colorHigh: '#9aa3b1',
  midPoint: 0.45,
  wireframe: false
};

addRow('terrainGrid', 'Size',        'tSize',       5, 2000, 1,    tState.size,       v => { tState.size = v; terrainAPI.setSize(v); });
addRow('terrainGrid', 'Segments',    'tSegs',      16, 1024, 1,    tState.segments,   v => { tState.segments = v; terrainAPI.setSegments(v); controls.terrain = terrainAPI.mesh; });
addRow('terrainGrid', 'Max Height',  'tHeight',      0, 200, 0.1,  tState.height,     v => { tState.height = v; terrainAPI.setHeight(v); });
addRow('terrainGrid', 'Noise Scale', 'tScale',   0.0005, 0.2, 0.0001, tState.scale,    v => { tState.scale = v; terrainAPI.setScale(v); });
addRow('terrainGrid', 'Octaves',     'tOct',         1, 12, 1,     tState.octaves,    v => { tState.octaves = v; terrainAPI.setOctaves(v); });
addRow('terrainGrid', 'Lacunarity',  'tLac',       0.5, 4.0, 0.01, tState.lacunarity, v => { tState.lacunarity = v; terrainAPI.setLacunarity(v); });
addRow('terrainGrid', 'Persistence', 'tPer',        0.1, 0.99, 0.01, tState.persistence, v => { tState.persistence = v; terrainAPI.setPersistence(v); });

addRow('terrainGrid', 'Low Color',   'tLow',   0,0,0, tState.colorLow,  v => { tState.colorLow = v; terrainAPI.setColors(tState.colorLow, tState.colorMid, tState.colorHigh); }, 'color');
addRow('terrainGrid', 'Mid Color',   'tMid',   0,0,0, tState.colorMid,  v => { tState.colorMid = v; terrainAPI.setColors(tState.colorLow, tState.colorMid, tState.colorHigh); }, 'color');
addRow('terrainGrid', 'High Color',  'tHigh',  0,0,0, tState.colorHigh, v => { tState.colorHigh = v; terrainAPI.setColors(tState.colorLow, tState.colorMid, tState.colorHigh); }, 'color');
addRow('terrainGrid', 'Midpoint',    'tMidPt',  0.01, 0.99, 0.01, tState.midPoint, v => { tState.midPoint = v; terrainAPI.setMidPoint(v); });
addRow('terrainGrid', 'Wireframe',   'tWire',   0,0,0, tState.wireframe, v => { tState.wireframe = v; terrainAPI.setWireframe(v); }, 'checkbox');

// copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    stars: { ...starState },
    haze: { ...hazeState },
    terrain: terrainAPI._getParams()
  };
  const text = JSON.stringify(snapshot, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('Parameters copied.');
  } catch {
    prompt('Copy parameters:', text);
  }
});

// toast
function toast(msg) {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `
    position:fixed;left:50%;transform:translateX(-50%);
    bottom:calc(80px + env(safe-area-inset-bottom, 0px));z-index:200;
    background:rgba(20,22,26,.9);color:#fff;border:1px solid rgba(255,255,255,.2);
    padding:10px 12px;border-radius:12px;font-weight:600;
    box-shadow:0 10px 24px rgba(0,0,0,.4)
  `;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1500);
}

// toggle panel (stays closed until you press TUNE)
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});