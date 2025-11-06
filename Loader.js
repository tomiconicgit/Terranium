// Loader.js – robust version that pinpoints failing modules

import { Debugger } from './Debugger.js';

class Loader {
  constructor() {
    this.debugger = new Debugger();
    this.mainModule = null;    // will hold the dynamically imported module
    this.mainClass  = null;    // reference to exported Main class

    // DOM
    this.progressBar         = document.getElementById('progress-bar');
    this.percentageText      = document.getElementById('progress-percentage-text');
    this.statusText          = document.getElementById('loader-status-text');
    this.enterButton         = document.getElementById('enter-button');
    this.reloadButton        = document.getElementById('reload-button');
    this.loaderContainer     = document.getElementById('loader-container');
    this.debuggerMessageArea = document.getElementById('debugger-message-area');

    this.debuggerMessageArea.style.display = 'none';
    this.enterButton.disabled = true;
    this.reloadButton.onclick = () => window.location.reload();

    // start
    this.boot();
  }

  async boot() {
    try {
      this.updateStatus('Preparing systems…');

      // 1) Import Main.js dynamically
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

      // 2) Probe critical submodules
      const probes = [
        './src/scene/Terrain.js',
        './src/scene/SkyDome.js',
        './src/scene/Lighting.js',
        './src/scene/Camera.js',
        './src/controls/TouchPad.js',
        './src/ModelLoading.js'
      ];
      await this._probeModules(probes);

      // 3) Drive visible progress
      // ... (Removed manifest logic for brevity, it's unchanged) ...
      const totalItems = probes.length;
      for (let i = 0; i < totalItems; i++) {
        await this._sleep(120);
        this.updateProgress(((i + 1) / totalItems) * 100);
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
    return `${msg}\nTips: Check path & filename case. Hard reload.`;
  }

  updateProgress(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    this.progressBar.style.width = `${p}%`;
    this.percentageText.textContent = `${p}%`;
  }

  updateStatus(text) { this.statusText.textContent = text; }

  loadingSuccessful() {
    this.updateStatus('Installation complete. Click Enter to begin!');
    this.enterButton.disabled = false;
    this.enterButton.textContent = 'ENTER';
    this.enterButton.onclick = () => this.startGame();
  }

  loadingFailed(error) {
    // ... (This function is unchanged) ...
    console.error(error);
    this.debuggerMessageArea.style.display = 'block';
    const safe = (error?.message || 'Unknown error').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    this.debuggerMessageArea.innerHTML = `<h4>Error Detected:</h4><p style="white-space:pre-wrap">${safe}</p>`;
    this.progressBar.style.backgroundColor = '#d43b3b';
    this.updateStatus('A critical error occurred during installation.');
    this.debugger.handleError(error, 'Loader');
  }

  async startGame() {
    // Fade out loader
    this.loaderContainer.style.opacity = '0';
    setTimeout(() => { this.loaderContainer.style.display = 'none'; }, 500);

    try {
      // *** MODIFIED: Pass the viewport container to Main ***
      const viewportContainer = document.getElementById('viewport-container');
      const main = new this.mainClass(this.debugger, viewportContainer);
      // main.start() is called in Main's constructor
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
