// Loader.js  — robust version that pinpoints failing modules

import { Debugger } from './Debugger.js';

class Loader {
  constructor() {
    this.debugger = new Debugger();
    this.mainModule = null;
    this.mainClass = null;

    // DOM
    this.progressBar = document.getElementById('progress-bar');
    this.percentageText = document.getElementById('progress-percentage-text');
    this.statusText = document.getElementById('loader-status-text');
    this.enterButton = document.getElementById('enter-button');
    this.reloadButton = document.getElementById('reload-button');
    this.loaderContainer = document.getElementById('loader-container');
    this.debuggerMessageArea = document.getElementById('debugger-message-area');

    this.debuggerMessageArea.style.display = 'none';
    this.enterButton.disabled = true;
    this.reloadButton.onclick = () => window.location.reload();

    this.boot();
  }

  async boot() {
    try {
      this.updateStatus('Preparing systems…');

      const url = new URL('./src/Main.js', window.location.href);
      url.searchParams.set('v', Date.now().toString());

      this.updateStatus('Checking core modules…');
      this.mainModule = await import(/* @vite-ignore */ url.href).catch((e) => {
        throw new Error(`Failed to load src/Main.js. ${this._friendlyModuleHint(e)}`);
      });

      if (!this.mainModule.Main) {
        throw new Error('src/Main.js loaded, but export "Main" was not found.');
      }
      this.mainClass = this.mainModule.Main;

      // Probe key modules (add new FX + UI controls)
      const probes = [
        './src/scene/Terrain.js',
        './src/scene/SkyDome.js',
        './src/scene/Lighting.js',
        './src/scene/Camera.js',
        './src/controls/TouchPad.js',
        './src/world/Mapping.js',
        './src/ui/ImportModel.js',
        './src/ui/ModelSliders.js',
        './src/ui/EngineControls.js',
        './src/ModelLoading.js',
        './src/effects/EngineFX.js'
      ];

      await this._probeModules(probes);

      // Progress bar drive
      let manifest = [];
      try {
        manifest = this.mainClass.getManifest?.() ?? [];
      } catch (e) {
        this.debugger.warn('Main.getManifest() threw; continuing without it.', 'Loader');
      }
      if (!Array.isArray(manifest) || manifest.length === 0) {
        manifest = probes.map(p => ({ name: `Check ${p}`, path: p }));
      }

      const total = manifest.length;
      for (let i = 0; i < total; i++) {
        const item = manifest[i];
        this.updateStatus(`Installing ${item.name}…`);
        await this._sleep(120);
        this.updateProgress(((i + 1) / total) * 100);
      }

      this.loadingSuccessful();
    } catch (err) {
      this.loadingFailed(err);
    }
  }

  async _probeModules(list) {
    const total = list.length;
    for (let i = 0; i < total; i++) {
      const path = list[i];
      this.updateStatus(`Verifying ${path}…`);
      try {
        const u = new URL(path, window.location.href);
        u.searchParams.set('v', Date.now().toString());
        const res = await fetch(u.href, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText})`);
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('javascript') && !ct.includes('text/plain')) {
          this.debugger.warn(`Unusual content-type for ${path}: ${ct}`, 'Loader');
        }
        this.debugger.log(`OK: ${path}`);
      } catch (e) {
        throw new Error(`Module check failed: ${path} → ${e.message}`);
      }
      this.updateProgress(((i + 1) / total) * 30);
      await this._sleep(60);
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _friendlyModuleHint(err) {
    const msg = (err && err.message) ? err.message : String(err);
    return `${msg}
Tips:
• Check path & filename **case** (GitHub Pages is case-sensitive).
• Ensure the file exists at that exact path.
• If you recently renamed/moved files, do a hard reload (or add ?v=…).
• On GitHub Pages, registering the Service Worker at root can cache old files.`;
  }

  updateProgress(pct) {
    this.progressBar.style.width = `${Math.round(pct)}%`;
    this.percentageText.textContent = `${Math.round(pct)}%`;
  }

  updateStatus(text) { this.statusText.textContent = text; }

  loadingSuccessful() {
    this.updateStatus('Installation complete. Click Enter to begin!');
    this.enterButton.disabled = false;
    this.enterButton.textContent = 'ENTER';
    this.enterButton.onclick = () => this.startGame();
  }

  loadingFailed(error) {
    console.error(error);
    this.debuggerMessageArea.style.display = 'block';
    const safe = (error.message || 'Unknown error').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    this.debuggerMessageArea.innerHTML = `
      <h4>🛑 Error Detected:</h4>
      <p style="white-space:pre-wrap">${safe}</p>
      <button onclick="navigator.clipboard.writeText('${safe}')
        .then(()=>alert('Error copied!'))
        .catch(err=>console.error('Failed to copy:', err))">
        Copy Error
      </button>`;
    this.progressBar.style.backgroundColor = '#d43b3b';
    this.updateStatus('A critical error occurred during installation.');
    this.debugger.handleError(error, 'Loader');
  }

  async startGame() {
    this.loaderContainer.style.opacity = '0';
    setTimeout(() => { this.loaderContainer.style.display = 'none'; }, 500);

    try {
      const main = new this.mainClass(this.debugger);
      main.start();
    } catch (e) {
      this.loadingFailed(new Error(`Starting game failed: ${e.message}`));
    }
  }
}

window.onload = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('Service Worker registered:', r.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }
  new Loader();
};