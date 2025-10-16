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
    this._build();
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
    panel.classList.add('hidden'); // reuse same hidden animation as transform panel
    panel.innerHTML = `
      <h4>Engine Controls</h4>

      <div class="button-row" style="display:flex; gap:10px; margin-bottom:10px;">
        <button id="ignite-btn">Ignite</button>
        <button id="cutoff-btn">Cutoff</button>
      </div>

      <div class="slider-group">
        <label>Flame Width × <span id="fw-val">1.00</span></label>
        <input type="range" id="fw" min="0.1" max="4.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Flame Height × <span id="fh-val">1.00</span></label>
        <input type="range" id="fh" min="0.1" max="4.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Flame Y Offset (m): <span id="fy-val">0.00</span></label>
        <input type="range" id="fy" min="-5" max="5" step="0.01" value="0">
      </div>

      <div class="slider-group">
        <label>Smoke Size × <span id="ss-val">1.00</span></label>
        <input type="range" id="ss" min="0.1" max="4.0" step="0.01" value="1.0">
      </div>
      <div class="slider-group">
        <label>Smoke Y Offset (m): <span id="sy-val">0.00</span></label>
        <input type="range" id="sy" min="-3" max="6" step="0.01" value="0">
      </div>

      <button id="copy-engine-config">Copy Config</button>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Hook up controls
    panel.querySelector('#ignite-btn').onclick = () => {
      this.api.setIgnition(true);
      this._refreshButtons();
    };
    panel.querySelector('#cutoff-btn').onclick = () => {
      this.api.setIgnition(false);
      this._refreshButtons();
    };

    const fw = panel.querySelector('#fw');
    const fh = panel.querySelector('#fh');
    const fy = panel.querySelector('#fy');
    const ss = panel.querySelector('#ss');
    const sy = panel.querySelector('#sy');

    fw.oninput = fh.oninput = fy.oninput = ss.oninput = sy.oninput = () => {
      this.api.set({
        flameWidthFactor:  parseFloat(fw.value),
        flameHeightFactor: parseFloat(fh.value),
        flameYOffset:      parseFloat(fy.value),
        smokeSizeFactor:   parseFloat(ss.value),
        smokeYOffset:      parseFloat(sy.value),
      });
      this._updateLabels();
    };

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
    ignite.disabled = on;
    cutoff.disabled = !on;
  }

  _updateLabels() {
    const cfg = this.api.get();
    this.panel.querySelector('#fw-val').textContent = cfg.flameWidthFactor.toFixed(2);
    this.panel.querySelector('#fh-val').textContent = cfg.flameHeightFactor.toFixed(2);
    this.panel.querySelector('#fy-val').textContent = cfg.flameYOffset.toFixed(2);
    this.panel.querySelector('#ss-val').textContent = cfg.smokeSizeFactor.toFixed(2);
    this.panel.querySelector('#sy-val').textContent = cfg.smokeYOffset.toFixed(2);
  }
}