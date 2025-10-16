// src/ui/EnginePanel.js
// Floating card with Ignite/Cutoff + sliders to tweak flames/smoke + copy config

export class EnginePanelUI {
  /**
   * @param {{get:()=>any,set:(patch:any)=>void,setIgnition:(on:boolean)=>void,getIgnition:()=>boolean}} api
   * @param {Debugger} dbg
   */
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false; // becomes true when Main creates EngineFX
    this._build();
  }

  // Allow Main to enable the panel once FX exists
  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
  }

  _build() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for EnginePanel.'), 'Init');
      return;
    }

    // Open button
    const openBtn = document.createElement('button');
    openBtn.id = 'engine-panel-btn';
    openBtn.textContent = 'Engines';
    openBtn.title = 'Open engine controls';
    openBtn.onclick = () => this.panel.classList.toggle('hidden');
    container.appendChild(openBtn);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'engine-panel';
    panel.classList.add('floating-panel', 'hidden');
    panel.style.maxHeight = '70vh';
    panel.style.overflow = 'auto';

    panel.innerHTML = `
      <h4>Engine Controls</h4>

      <div class="button-row" style="display:flex; gap:10px; margin-bottom:10px;">
        <button id="ignite-btn">Ignite</button>
        <button id="cutoff-btn">Cutoff</button>
      </div>

      <h5 style="margin:12px 0 6px;">Flames</h5>
      <div class="slider-group">
        <label>Flame Width × <span id="fw-val">1.00</span></label>
        <input type="range" id="fw" min="0.01" max="50.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Flame Height × <span id="fh-val">1.00</span></label>
        <input type="range" id="fh" min="0.01" max="80.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Flame Y Offset (m): <span id="fy-val">0.00</span></label>
        <input type="range" id="fy" min="-200" max="200" step="0.1" value="0">
      </div>

      <h5 style="margin:12px 0 6px;">Smoke</h5>
      <div class="slider-group">
        <label>Smoke Size × <span id="ss-val">1.00</span></label>
        <input type="range" id="ss" min="0.10" max="50.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Smoke Y Offset (m): <span id="sy-val">0.00</span></label>
        <input type="range" id="sy" min="-200" max="400" step="0.1" value="0">
      </div>

      <h5 style="margin:12px 0 6px;">Whole FX Block Offset</h5>
      <div class="slider-group">
        <label>FX Offset X (m): <span id="gx-val">0.00</span></label>
        <input type="range" id="gx" min="-50" max="50" step="0.1" value="0">
      </div>
      <div class="slider-group">
        <label>FX Offset Y (m): <span id="gy-val">0.00</span></label>
        <input type="range" id="gy" min="-200" max="400" step="0.1" value="0">
      </div>
      <div class="slider-group">
        <label>FX Offset Z (m): <span id="gz-val">0.00</span></label>
        <input type="range" id="gz" min="-50" max="50" step="0.1" value="0">
      </div>

      <button id="copy-engine-config">Copy Config</button>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Buttons
    const igniteBtn = panel.querySelector('#ignite-btn');
    const cutoffBtn = panel.querySelector('#cutoff-btn');

    igniteBtn.onclick = () => {
      if (!this.isReady) return this.debugger?.warn('Engines not ready yet (model still loading).', 'Engines');
      this.api.setIgnition(true);
      this._refreshButtons();
    };
    cutoffBtn.onclick = () => {
      if (!this.isReady) return this.debugger?.warn('Engines not ready yet (model still loading).', 'Engines');
      this.api.setIgnition(false);
      this._refreshButtons();
    };

    // Sliders
    const fw = panel.querySelector('#fw');
    const fh = panel.querySelector('#fh');
    const fy = panel.querySelector('#fy');
    const ss = panel.querySelector('#ss');
    const sy = panel.querySelector('#sy');
    const gx = panel.querySelector('#gx');
    const gy = panel.querySelector('#gy');
    const gz = panel.querySelector('#gz');

    const onSlide = () => {
      if (!this.isReady) return; // ignore tweaks until FX is present
      this.api.set({
        flameWidthFactor:  parseFloat(fw.value),
        flameHeightFactor: parseFloat(fh.value),
        flameYOffset:      parseFloat(fy.value),
        smokeSizeFactor:   parseFloat(ss.value),
        smokeYOffset:      parseFloat(sy.value),
        groupOffsetX:      parseFloat(gx.value),
        groupOffsetY:      parseFloat(gy.value),
        groupOffsetZ:      parseFloat(gz.value),
      });
      this._updateLabels();
    };

    fw.oninput = fh.oninput = fy.oninput = ss.oninput = sy.oninput = gx.oninput = gy.oninput = gz.oninput = onSlide;

    // Copy config
    panel.querySelector('#copy-engine-config').onclick = () => {
      const cfg = this.api.get();
      const json = JSON.stringify(cfg, null, 2);
      navigator.clipboard.writeText(json)
        .then(() => this.debugger?.log('Engine config copied to clipboard.'))
        .catch(err => this.debugger?.handleError(err, 'Clipboard'));
    };

    // Initial label sync
    this._updateLabels();
    this._refreshButtons();
  }

  _refreshButtons() {
    const on = this.api.getIgnition();
    const ignite = this.panel.querySelector('#ignite-btn');
    const cutoff = this.panel.querySelector('#cutoff-btn');

    ignite.disabled = !this.isReady || on;
    cutoff.disabled = !this.isReady || !on;
  }

  _updateLabels() {
    const cfg = this.api.get();
    this.panel.querySelector('#fw-val').textContent = cfg.flameWidthFactor.toFixed(2);
    this.panel.querySelector('#fh-val').textContent = cfg.flameHeightFactor.toFixed(2);
    this.panel.querySelector('#fy-val').textContent = cfg.flameYOffset.toFixed(2);
    this.panel.querySelector('#ss-val').textContent = cfg.smokeSizeFactor.toFixed(2);
    this.panel.querySelector('#sy-val').textContent = cfg.smokeYOffset.toFixed(2);

    // If offsets exist in cfg (older builds won't until FX is ready)
    if ('groupOffsetX' in cfg) {
      this.panel.querySelector('#gx-val').textContent = cfg.groupOffsetX.toFixed(2);
      this.panel.querySelector('#gy-val').textContent = cfg.groupOffsetY.toFixed(2);
      this.panel.querySelector('#gz-val').textContent = cfg.groupOffsetZ.toFixed(2);
    }
  }
}