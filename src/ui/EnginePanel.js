// src/ui/EnginePanel.js
// Floating panel: ignite/cutoff + single-plume controls with huge ranges.
// Now scrollable on mobile, with Bulge and Color Mix (Blue/Orange/White) sliders.

export class EnginePanelUI {
  /**
   * @param {{get:()=>any,set:(patch:any)=>void,setIgnition:(on:boolean)=>void,getIgnition:()=>boolean}} api
   * @param {Debugger} dbg
   */
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this._build();
  }

  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
    this._syncLabels();
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
    openBtn.onclick = () => {
      const p = this.panel;
      p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    };
    container.appendChild(openBtn);

    // Panel — make it scrollable and allow vertical panning on touch
    const panel = document.createElement('div');
    panel.id = 'engine-panel';
    panel.style.cssText = `
      position:fixed; top:80px; left:20px; z-index:10;
      background:rgba(30,30,36,0.9); backdrop-filter:blur(8px);
      border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:340px; max-height:86vh; overflow:auto; padding:16px; display:none;
      box-shadow:0 5px 15px rgba(0,0,0,0.35); color:#fff;
      touch-action: pan-y; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
    `;

    panel.innerHTML = `
      <h4 style="margin:0 0 12px;">Engine Controls (Jet)</h4>

      <div style="display:flex; gap:10px; margin-bottom:12px;">
        <button id="ignite-btn">Ignite</button>
        <button id="cutoff-btn">Cutoff</button>
      </div>

      <div class="slider-group"><label>Flame Width × <span id="fw-val">1.00</span></label>
        <input type="range" id="fw" min="0.01" max="80" step="0.01" value="1.0"></div>

      <div class="slider-group"><label>Flame Height × <span id="fh-val">1.00</span></label>
        <input type="range" id="fh" min="0.01" max="120" step="0.01" value="1.0"></div>

      <div class="slider-group"><label>Flame Y Offset (m): <span id="fy-val">0.00</span></label>
        <input type="range" id="fy" min="-300" max="600" step="0.1" value="0"></div>

      <div class="slider-group"><label>Intensity × <span id="in-val">1.00</span></label>
        <input type="range" id="in" min="0.0" max="5.0" step="0.01" value="1.0"></div>

      <div class="slider-group"><label>Taper (0=wide,1=thin): <span id="tp-val">0.55</span></label>
        <input type="range" id="tp" min="0.0" max="1.0" step="0.01" value="0.55"></div>

      <div class="slider-group"><label>Turbulence: <span id="tb-val">0.35</span></label>
        <input type="range" id="tb" min="0.0" max="1.0" step="0.01" value="0.35"></div>

      <div class="slider-group"><label>Noise Speed: <span id="ns-val">1.60</span></label>
        <input type="range" id="ns" min="0.0" max="5.0" step="0.01" value="1.6"></div>

      <div class="slider-group"><label>Mach Diamonds Strength: <span id="ds-val">0.35</span></label>
        <input type="range" id="ds" min="0.0" max="2.0" step="0.01" value="0.35"></div>

      <div class="slider-group"><label>Mach Diamonds Frequency: <span id="df-val">14.0</span></label>
        <input type="range" id="df" min="2.0" max="40.0" step="0.1" value="14.0"></div>

      <div class="slider-group"><label>Bulge (mid-plume): <span id="bg-val">0.00</span></label>
        <input type="range" id="bg" min="0.0" max="2.0" step="0.01" value="0.0"></div>

      <hr style="border-color: rgba(255,255,255,0.1); margin:12px 0;">

      <div class="slider-group"><label>Blue Mix: <span id="cb-val">1.00</span></label>
        <input type="range" id="cb" min="0.0" max="3.0" step="0.01" value="1.0"></div>
      <div class="slider-group"><label>Orange Mix: <span id="co-val">1.00</span></label>
        <input type="range" id="co" min="0.0" max="3.0" step="0.01" value="1.0"></div>
      <div class="slider-group"><label>White Mix: <span id="cw-val">1.00</span></label>
        <input type="range" id="cw" min="0.0" max="3.0" step="0.01" value="1.0"></div>

      <hr style="border-color: rgba(255,255,255,0.1); margin:12px 0;">
      <div class="slider-group"><label>FX Offset X (m): <span id="gx-val">0.00</span></label>
        <input type="range" id="gx" min="-80" max="80" step="0.1" value="0"></div>
      <div class="slider-group"><label>FX Offset Y (m): <span id="gy-val">0.00</span></label>
        <input type="range" id="gy" min="-300" max="600" step="0.1" value="0"></div>
      <div class="slider-group"><label>FX Offset Z (m): <span id="gz-val">0.00</span></label>
        <input type="range" id="gz" min="-80" max="80" step="0.1" value="0"></div>

      <button id="copy-engine-config" style="margin-top:10px; width:100%;">Copy Config</button>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    // Buttons
    const ignite = panel.querySelector('#ignite-btn');
    const cutoff = panel.querySelector('#cutoff-btn');
    ignite.onclick = () => { if (!this.isReady) return this._notReady(); this.api.setIgnition(true);  this._refreshButtons(); };
    cutoff.onclick = () => { if (!this.isReady) return this._notReady(); this.api.setIgnition(false); this._refreshButtons(); };

    // Sliders
    const ids = ['fw','fh','fy','in','tp','tb','ns','ds','df','bg','cb','co','cw','gx','gy','gz'];
    const apply = () => {
      if (!this.isReady) return;
      this.api.set({
        flameWidthFactor:  parseFloat(panel.querySelector('#fw').value),
        flameHeightFactor: parseFloat(panel.querySelector('#fh').value),
        flameYOffset:      parseFloat(panel.querySelector('#fy').value),

        intensity:         parseFloat(panel.querySelector('#in').value),
        taper:             parseFloat(panel.querySelector('#tp').value),
        turbulence:        parseFloat(panel.querySelector('#tb').value),
        noiseSpeed:        parseFloat(panel.querySelector('#ns').value),
        diamondsStrength:  parseFloat(panel.querySelector('#ds').value),
        diamondsFreq:      parseFloat(panel.querySelector('#df').value),

        bulge:             parseFloat(panel.querySelector('#bg').value),

        colorBlue:         parseFloat(panel.querySelector('#cb').value),
        colorOrange:       parseFloat(panel.querySelector('#co').value),
        colorWhite:        parseFloat(panel.querySelector('#cw').value),

        groupOffsetX:      parseFloat(panel.querySelector('#gx').value),
        groupOffsetY:      parseFloat(panel.querySelector('#gy').value),
        groupOffsetZ:      parseFloat(panel.querySelector('#gz').value),
      });
      this._syncLabels();
    };
    ids.forEach(id => panel.querySelector('#'+id).oninput = apply);

    panel.querySelector('#copy-engine-config').onclick = () => {
      const cfg = this.api.get();
      navigator.clipboard.writeText(JSON.stringify(cfg, null, 2))
        .then(() => this.debugger?.log('Engine config copied to clipboard.'))
        .catch(err => this.debugger?.handleError(err, 'Clipboard'));
    };

    // Initial UI state
    this._refreshButtons();
    this._syncLabels();
  }

  _notReady(){ this.debugger?.warn('Engines not ready yet (model still loading).','Engines'); }

  _refreshButtons() {
    const on = this.api.getIgnition();
    const ig = this.panel.querySelector('#ignite-btn');
    const co = this.panel.querySelector('#cutoff-btn');
    ig.disabled = !this.isReady || on;
    co.disabled = !this.isReady || !on;
  }

  _syncLabels() {
    const c = this.api.get();
    const set = (id, v) => { const el = this.panel.querySelector(id); if (el) el.textContent = v; };

    set('#fw-val', (c.flameWidthFactor ?? 1).toFixed(2));
    set('#fh-val', (c.flameHeightFactor ?? 1).toFixed(2));
    set('#fy-val', (c.flameYOffset ?? 0).toFixed(2));

    set('#in-val', (c.intensity ?? 1).toFixed(2));
    set('#tp-val', (c.taper ?? 0.55).toFixed(2));
    set('#tb-val', (c.turbulence ?? 0.35).toFixed(2));
    set('#ns-val', (c.noiseSpeed ?? 1.6).toFixed(2));
    set('#ds-val', (c.diamondsStrength ?? 0).toFixed(2));
    set('#df-val', (c.diamondsFreq ?? 14).toFixed(1));

    set('#bg-val', (c.bulge ?? 0).toFixed(2));

    set('#cb-val', (c.colorBlue ?? 1).toFixed(2));
    set('#co-val', (c.colorOrange ?? 1).toFixed(2));
    set('#cw-val', (c.colorWhite ?? 1).toFixed(2));

    set('#gx-val', (c.groupOffsetX ?? 0).toFixed(2));
    set('#gy-val', (c.groupOffsetY ?? 0).toFixed(2));
    set('#gz-val', (c.groupOffsetZ ?? 0).toFixed(2));
  }
}