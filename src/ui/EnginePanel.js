// src/ui/EnginePanel.js
// Sliders + number boxes. Now includes orange band shift and light controls.

export class EnginePanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this.inputs = {};   // {id: {slider, box, min, max}}
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

    // helper to add slider+box rows
    const addRow = (id, label, min, max, value, stepBox = 0.1) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-group';
      wrap.style.marginBottom = '12px';
      wrap.innerHTML = `
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <span>${label}</span>
          <input type="number" id="${id}-box" step="${stepBox}" min="${min}" max="${max}" value="${value}"
                 style="width:110px;padding:4px 6px;background:#1f1f28;border:1px solid #444;color:#fff;border-radius:4px;">
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${Math.round(value)}"
               style="width:100%;accent-color:#4f8ff7;">
      `;
      panel.appendChild(wrap);

      const slider = wrap.querySelector(`#${id}`);
      const box    = wrap.querySelector(`#${id}-box`);
      this.inputs[id] = { slider, box, min, max };

      slider.oninput = () => {
        const iv = clampInt(parseFloat(slider.value), min, max);
        slider.value = String(iv);
        if (Math.abs(parseFloat(box.value) - iv) > 0.49) box.value = iv.toFixed(1);
        this._applyFromSliders();
      };
      box.onchange = () => {
        let v = parseFloat(box.value);
        if (isNaN(v)) v = parseFloat(slider.value);
        v = clampFloat(v, min, max);
        v = round1(v);
        box.value = v.toFixed(1);
        const iv = clampInt(Math.round(v), min, max);
        slider.value = String(iv);
        this._applyFromBoxes();
      };
    };

    const c = this.api.get?.() ?? {};
    const make = (id, label, min, max, key, stepBox = 0.1) =>
      addRow(id, label, min, max, (c[key] ?? 0), stepBox);

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

    // NEW: Orange band shift
    make('os','Orange Band Shift',        -0.50,    0.50, 'orangeShift', 0.01);

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

    this._hr(panel);

    // Tail fade controls
    make('tfs','Tail Fade Start (0–1)',   0.00,     1.00, 'tailFadeStart');
    make('tff','Tail Feather (softness)', 0.10,     6.00, 'tailFeather');
    make('tfn','Tail Noise',              0.00,     0.40, 'tailNoise');

    const hint = document.createElement('p');
    hint.style.cssText = 'margin:6px 0 0; color:#9aa; font-size:.85em;';
    hint.textContent = 'Tip: Use Orange Band Shift to push orange higher into the blue area.';
    panel.appendChild(hint);

    this._hr(panel);

    // ---------- NEW: Light controls ----------
    const lightWrap = document.createElement('div');
    lightWrap.style.cssText = 'margin:8px 0 12px;';
    lightWrap.innerHTML = `
      <h