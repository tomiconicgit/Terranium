// src/ui/EnginePanel.js
// Sliders: step = 1
// Number boxes: step = 0.10
// Large ranges preserved. Two-way bound (box keeps 0.1 precision).

export class EnginePanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this.inputs = {};   // map: {id: {slider, box, min, max}}
    this._build();
  }

  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
    this._syncValuesFromAPI();
  }

  _build() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for EnginePanel.'), 'Init');
      return;
    }

    const openBtn = document.createElement('button');
    openBtn.id = 'engine-panel-btn';
    openBtn.textContent = 'Engines';
    openBtn.title = 'Open engine controls';
    openBtn.onclick = () => {
      this.panel.style.display = (this.panel.style.display === 'block') ? 'none' : 'block';
    };
    container.appendChild(openBtn);

    const panel = document.createElement('div');
    panel.id = 'engine-panel';
    panel.classList.add('no-look');
    panel.style.cssText = `
      position:fixed; top:80px; left:20px; z-index:10; background:rgba(30,30,36,0.90);
      color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:360px; max-height:76vh; overflow:auto; padding:16px; display:none;
      box-shadow:0 5px 15px rgba(0,0,0,0.35); backdrop-filter:blur(8px);
      -webkit-overflow-scrolling: touch; touch-action: pan-y;`;

    const header = document.createElement('h4');
    header.textContent = 'Engine Controls';
    header.style.cssText = 'margin:0 0 12px;border-bottom:1px solid #444;padding-bottom:8px;';
    panel.appendChild(header);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:10px; margin-bottom:14px;';
    btnRow.innerHTML = `
      <button id="ignite-btn" style="flex:1;">Ignite</button>
      <button id="cutoff-btn" style="flex:1;">Cutoff</button>`;
    panel.appendChild(btnRow);

    // helper to add a slider+box row
    const addRow = (id, label, min, max, value) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-group';
      wrap.style.marginBottom = '12px';
      wrap.innerHTML = `
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <span>${label}</span>
          <input type="number" id="${id}-box" step="0.1" min="${min}" max="${max}" value="${value}"
                 style="width:110px;padding:4px 6px;background:#1f1f28;border:1px solid #444;color:#fff;border-radius:4px;">
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${Math.round(value)}"
               style="width:100%;accent-color:#4f8ff7;">
      `;
      panel.appendChild(wrap);

      const slider = wrap.querySelector(`#${id}`);
      const box    = wrap.querySelector(`#${id}-box`);
      this.inputs[id] = { slider, box, min, max };

      // slider -> integer steps
      slider.oninput = () => {
        const iv = clampInt(parseFloat(slider.value), min, max);
        slider.value = String(iv);
        // keep box showing user's last precise value if close; otherwise reflect integer
        if (Math.abs(parseFloat(box.value) - iv) > 0.49) box.value = iv.toFixed(1);
        this._applyFromSliders();
      };

      // box -> 0.1 precision
      box.onchange = () => {
        let v = parseFloat(box.value);
        if (isNaN(v)) v = parseFloat(slider.value);
        v = clampFloat(v, min, max);
        v = round1(v); // 0.1 precision
        box.value = v.toFixed(1);
        // slider shows nearest integer position within range
        const iv = clampInt(Math.round(v), min, max);
        slider.value = String(iv);
        this._applyFromBoxes();
      };
    };

    // current values to seed UI
    const c = this.api.get?.() ?? {};

    const make = (id, label, min, max, key) => addRow(id, label, min, max, (c[key] ?? 0));

    // layout
    make('fw','Flame Width ×',            0.01,   80.0,  'flameWidthFactor');
    make('fh','Flame Height ×',           0.01,  120.0,  'flameHeightFactor');
    make('fy','Flame Y Offset (m)',    -1200.0, 2400.0,  'flameYOffset');

    this._hr(panel);

    make('in','Intensity ×',               0.0,     5.0, 'intensity');
    make('tp','Taper (0=wide,1=thin)',     0.0,     1.0, 'taper');
    make('bg','Bulge (mid-body)',          0.0,     1.0, 'bulge');
    make('td','TearDrop (pinch)',          0.0,     1.0, 'tear');
    make('tb','Turbulence',                0.0,     1.0, 'turbulence');
    make('ns','Noise Speed',               0.0,     5.0, 'noiseSpeed');
    make('ds','Mach Diamonds Strength',    0.0,     2.0, 'diamondsStrength');
    make('df','Mach Diamonds Freq.',       0.0,    40.0, 'diamondsFreq');

    this._hr(panel);

    make('rs','Rim Strength (halo)',       0.0,     1.0, 'rimStrength');
    make('rp','Rim Speed',                 0.0,     6.0, 'rimSpeed');

    this._hr(panel);

    make('cb','Color: Cyan',               0.0,     3.0, 'colorCyan');
    make('co','Color: Orange',             0.0,     3.0, 'colorOrange');
    make('cw','Color: White Core',         0.0,     3.0, 'colorWhite');

    this._hr(panel);

    make('gx','FX Offset X (m)',         -800.0,   800.0, 'groupOffsetX');
    make('gy','FX Offset Y (m)',        -2400.0,  2400.0, 'groupOffsetY');
    make('gz','FX Offset Z (m)',         -800.0,   800.0, 'groupOffsetZ');

    const copyBtn = document.createElement('button');
    copyBtn.id = 'copy-engine-config';
    copyBtn.textContent = 'Copy Current Config';
    copyBtn.style.cssText = 'margin-top:8px;width:100%;';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(this.api.get(), null, 2))
        .then(() => this.debugger?.log('Engine config copied.'))
        .catch(err => this.debugger?.handleError(err, 'Clipboard'));
    };
    panel.appendChild(copyBtn);

    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector('#ignite-btn').onclick = () => { this.api.setIgnition(true);  this._refreshButtons(); };
    panel.querySelector('#cutoff-btn').onclick = () => { this.api.setIgnition(false); this._refreshButtons(); };

    // seed from API defaults and set button states
    this._syncValuesFromAPI();
    this._refreshButtons();
  }

  _hr(panel){
    const hr = document.createElement('hr');
    hr.style.cssText = 'border-color:#444;margin:10px 0;';
    panel.appendChild(hr);
  }

  // apply values using sliders (integers)
  _applyFromSliders() {
    if (!this.isReady) return;
    const vI = (id) => clampFloat(parseFloat(this.inputs[id].slider.value), this.inputs[id].min, this.inputs[id].max);
    this.api.set({
      flameWidthFactor:  vI('fw'),
      flameHeightFactor: vI('fh'),
      flameYOffset:      vI('fy'),
      intensity:         vI('in'),
      taper:             vI('tp'),
      bulge:             vI('bg'),
      tear:              vI('td'),
      turbulence:        vI('tb'),
      noiseSpeed:        vI('ns'),
      diamondsStrength:  vI('ds'),
      diamondsFreq:      vI('df'),
      rimStrength:       vI('rs'),
      rimSpeed:          vI('rp'),
      colorCyan:         vI('cb'),
      colorOrange:       vI('co'),
      colorWhite:        vI('cw'),
      groupOffsetX:      vI('gx'),
      groupOffsetY:      vI('gy'),
      groupOffsetZ:      vI('gz'),
    });
  }

  // apply values using boxes (0.1 precision)
  _applyFromBoxes() {
    if (!this.isReady) return;
    const vF = (id) => {
      const { box, min, max } = this.inputs[id];
      let v = parseFloat(box.value);
      if (isNaN(v)) v = parseFloat(this.inputs[id].slider.value);
      return clampFloat(round1(v), min, max);
    };
    this.api.set({
      flameWidthFactor:  vF('fw'),
      flameHeightFactor: vF('fh'),
      flameYOffset:      vF('fy'),
      intensity:         vF('in'),
      taper:             vF('tp'),
      bulge:             vF('bg'),
      tear:              vF('td'),
      turbulence:        vF('tb'),
      noiseSpeed:        vF('ns'),
      diamondsStrength:  vF('ds'),
      diamondsFreq:      vF('df'),
      rimStrength:       vF('rs'),
      rimSpeed:          vF('rp'),
      colorCyan:         vF('cb'),
      colorOrange:       vF('co'),
      colorWhite:        vF('cw'),
      groupOffsetX:      vF('gx'),
      groupOffsetY:      vF('gy'),
      groupOffsetZ:      vF('gz'),
    });
  }

  _refreshButtons() {
    const on = this.api.getIgnition();
    this.panel.querySelector('#ignite-btn').disabled = !this.isReady || on;
    this.panel.querySelector('#cutoff-btn').disabled = !this.isReady || !on;
  }

  _syncValuesFromAPI() {
    const c = this.api.get?.() ?? {};
    const set = (id, val) => {
      if (!this.inputs[id]) return;
      const { slider, box, min, max } = this.inputs[id];
      let v = parseFloat(val);
      if (isNaN(v)) return;
      v = clampFloat(v, min, max);
      box.value = round1(v).toFixed(1);              // keep precise in box
      slider.value = String(clampInt(Math.round(v), min, max)); // nearest int for slider
    };

    set('fw', c.flameWidthFactor);
    set('fh', c.flameHeightFactor);
    set('fy', c.flameYOffset);

    set('in', c.intensity);
    set('tp', c.taper);
    set('bg', c.bulge);
    set('td', c.tear);
    set('tb', c.turbulence);
    set('ns', c.noiseSpeed);
    set('ds', c.diamondsStrength);
    set('df', c.diamondsFreq);

    set('rs', c.rimStrength);
    set('rp', c.rimSpeed);

    set('cb', c.colorCyan);
    set('co', c.colorOrange);
    set('cw', c.colorWhite);

    set('gx', c.groupOffsetX);
    set('gy', c.groupOffsetY);
    set('gz', c.groupOffsetZ);
  }
}

/* ---------- helpers ---------- */
function clampFloat(v, min, max){ return Math.max(min, Math.min(max, v)); }
function clampInt(v, min, max){ return Math.max(Math.ceil(min), Math.min(Math.floor(max), Math.round(v))); }
function round1(v){ return Math.round(v * 10) / 10; }