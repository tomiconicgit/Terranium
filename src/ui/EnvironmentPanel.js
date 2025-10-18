// src/ui/EnvironmentPanel.js
// Environment switch (Day/Dusk) + Plume light controls.
// The button auto-positions NEXT TO the Highlighter button if present.

export class EnvironmentPanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.panel = null;
    this.ctrl = {};
    this.openBtn = null;
    this._build();
  }

  _build() {
    const container = document.getElementById('ui-container') || document.body;

    // Toggle button
    const openBtn = document.createElement('button');
    openBtn.id = 'environment-panel-btn';
    openBtn.textContent = 'Environment';
    openBtn.title = 'Open environment & plume lighting controls';
    openBtn.style.cssText = baseBtnStyle();
    container.appendChild(openBtn);
    this.openBtn = openBtn;

    // Position next to the Highlighter button if available
    this._placeBtn = () => {
      const hi =
        document.getElementById('highlighter-btn') ||
        document.querySelector('[data-role="highlighter-btn"]') ||
        document.querySelector('button[id*="highlight"],button[id*="Highlighter"]');
      if (hi) {
        const r = hi.getBoundingClientRect();
        openBtn.style.left = `${Math.round(r.right + 10)}px`;
        openBtn.style.top  = `${Math.round(r.top)}px`;
      } else {
        openBtn.style.left = '20px';
        openBtn.style.top  = '20px';
      }
    };
    this._placeBtn();
    window.addEventListener('resize', this._placeBtn);
    const mo = new MutationObserver(() => this._placeBtn());
    mo.observe(document.body, { childList: true, subtree: true });

    // Panel
    const panel = document.createElement('div');
    panel.id = 'environment-panel';
    panel.style.cssText = panelStyle();
    (document.getElementById('ui-container') || document.body).appendChild(panel);
    this.panel = panel;

    const h = document.createElement('h4');
    h.textContent = 'Environment & Plume Lighting';
    h.style.cssText = 'margin:0 0 10px; border-bottom:1px solid #3f3f45; padding-bottom:8px;';
    panel.appendChild(h);

    // Day / Dusk row
    const rowDay = document.createElement('div');
    rowDay.style.cssText = 'display:flex; gap:10px; margin-bottom:14px;';
    const dayBtn = document.createElement('button');
    dayBtn.textContent = 'Day';
    dayBtn.style.cssText = blueBtn();
    dayBtn.onclick = () => { try { this.api.setDay?.(); } catch(e){ this.debugger?.handleError(e,'EnvPanel.Day'); } };
    const duskBtn = document.createElement('button');
    duskBtn.textContent = 'Dusk';
    duskBtn.style.cssText = orangeBtn();
    duskBtn.onclick = () => { try { this.api.setDusk?.(); } catch(e){ this.debugger?.handleError(e,'EnvPanel.Dusk'); } };
    rowDay.appendChild(dayBtn); rowDay.appendChild(duskBtn);
    panel.appendChild(rowDay);

    // Subheader
    const sub = document.createElement('h5');
    sub.textContent = 'Rocket Flame Lighting';
    sub.style.cssText = 'margin:8px 0 8px;';
    panel.appendChild(sub);

    const form = document.createElement('div');
    form.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    panel.appendChild(form);

    // helpers
    const mkSlider = (label, id, min, max, step, suffix, tooltip) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <label style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span title="${tooltip||''}">${label}</span>
          <span><input type="number" id="${id}-num" style="width:90px; background:#1c1c22; color:#fff; border:1px solid #3a3a3f; border-radius:4px; padding:3px;" step="${step}" min="${min}" max="${max}"> ${suffix||''}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" style="width:100%; accent-color:#4f8ff7;">
      `;
      form.appendChild(wrap);
      const s = wrap.querySelector('#'+id);
      const n = wrap.querySelector('#'+id+'-num');
      return { s, n, min, max, step };
    };
    const mkColor = (label, id, def) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <label style="display:flex; justify-content:space-between; align-items:center;">
          <span>${label}</span>
          <input type="color" id="${id}" value="${def}" style="width:42px; height:28px; padding:0; border:none; background:transparent;">
        </label>
      `;
      form.appendChild(wrap);
      return wrap.querySelector('#'+id);
    };

    // Controls
    this.ctrl = {
      auto:   (() => {
        const el = document.createElement('label');
        el.style.cssText = 'display:flex; align-items:center; gap:8px;';
        el.innerHTML = `<input type="checkbox" id="pl_autofit"> <span>Auto-fit cone to coverage</span>`;
        form.appendChild(el);
        return el.querySelector('#pl_autofit');
      })(),
      cover:  mkSlider('Coverage Width',     'pl_cover',   10, 120, 1, 'm', 'Target lit width on floor (y=-15)'),
      angle:  mkSlider('Spot Angle (manual)','pl_angle',   10, 80, 1, 'deg', 'Half-angle. Only used when Auto-fit is OFF'),
      pen:    mkSlider('Spot Penumbra',      'pl_pen',      0, 60, 1, '%',   'Edge softness'),
      sScale: mkSlider('Spot Intensity x',   'pl_sscale',   0, 300, 1, '%',  'Multiplier (100% = default)'),
      pScale: mkSlider('Point Intensity x',  'pl_pscale',   0, 300, 1, '%',  'Multiplier (100% = default)'),
      dist:   mkSlider('Spot Distance',      'pl_dist',    50, 800, 1, 'm',  'Max range before falloff'),
      core:   mkColor('Cookie: Core',   'pl_core',  '#fff7e6'),
      orange: mkColor('Cookie: Orange', 'pl_oran',  '#ffba78'),
      cyan:   mkColor('Cookie: Cyan',   'pl_cyan',  '#80fbfd'),
    };

    // Defaults for new controls
    this.ctrl.auto.checked = true;
    this.ctrl.cover.s.value = '50'; this.ctrl.cover.n.value = '50';

    // Reset
    const resetRow = document.createElement('div');
    resetRow.style.cssText = 'display:flex; gap:10px; margin-top:4px;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Plume Light';
    resetBtn.style.cssText = neutralBtn();
    resetBtn.onclick = () => this._apply({
      autoFitAngle: true,
      coverageMeters: 50,
      spotAngleDeg: 35,
      spotPenumbra: 0.40,
      spotDistance: 420,
      spotIntensityScale: 1.5,
      pointIntensityScale: 1.6,
      cookieCore: '#fff7e6', cookieOrange: '#ffba78', cookieCyan: '#80fbfd'
    });
    resetRow.appendChild(resetBtn);
    form.appendChild(resetRow);

    // Bind sliders ↔ numbers ↔ apply
    const link = (c, key, mapFromUI, mapToUI) => {
      const apply = () => this._apply({ [key]: mapFromUI() });
      c.s.oninput = () => { c.n.value = mapToUI(c.s.value); apply(); };
      c.n.onchange = () => {
        let v = parseFloat(c.n.value); if (!Number.isFinite(v)) v = parseFloat(c.s.value);
        v = Math.max(c.min, Math.min(c.max, v));
        c.n.value = mapToUI(v); c.s.value = v; apply();
      };
    };
    // Coverage
    link(this.ctrl.cover, 'coverageMeters', ()=>+this.ctrl.cover.s.value,  v=>String(+v));
    // Manual angle: only applied if auto-fit is OFF (we still send it; rig respects autoFitAngle)
    link(this.ctrl.angle, 'spotAngleDeg',   ()=>+this.ctrl.angle.s.value, v=>String(+v));
    // Others
    link(this.ctrl.pen,    'spotPenumbra',       ()=>+this.ctrl.pen.s.value/100,         v=>String(+v));
    link(this.ctrl.sScale, 'spotIntensityScale', ()=>+this.ctrl.sScale.s.value/100,      v=>String(+v));
    link(this.ctrl.pScale, 'pointIntensityScale',()=>+this.ctrl.pScale.s.value/100,      v=>String(+v));
    link(this.ctrl.dist,   'spotDistance',       ()=>+this.ctrl.dist.s.value,            v=>String(+v));

    // Auto-fit checkbox
    this.ctrl.auto.onchange = () => this._apply({ autoFitAngle: !!this.ctrl.auto.checked });

    // Colors
    const applyColors = () => this._apply({
      cookieCore:   this.ctrl.core.value,
      cookieOrange: this.ctrl.orange.value,
      cookieCyan:   this.ctrl.cyan.value
    });
    this.ctrl.core.oninput = applyColors;
    this.ctrl.orange.oninput = applyColors;
    this.ctrl.cyan.oninput = applyColors;

    // Toggle panel visibility
    this.openBtn.onclick = () => {
      this.panel.style.display = (this.panel.style.display === 'block') ? 'none' : 'block';
      if (this.panel.style.display === 'block') this._syncFromRig();
    };

    this._syncFromRig();
  }

  _syncFromRig() {
    const p = this.api.getPlume?.();
    if (!p) return;
    const deg  = p.spotAngleDeg ?? 35;
    const pen  = (p.spotPenumbra ?? 0.40) * 100;
    const ss   = (p.spotIntensityScale ?? 1.5) * 100;
    const ps   = (p.pointIntensityScale ?? 1.6) * 100;
    const dist = p.spotDistance ?? 420;
    const cov  = p.coverageMeters ?? 50;

    this.ctrl.auto.checked = !!p.autoFitAngle;

    this.ctrl.cover.s.value = String(cov);  this.ctrl.cover.n.value = String(cov);
    this.ctrl.angle.s.value = String(deg);  this.ctrl.angle.n.value = String(deg);
    this.ctrl.pen.s.value   = String(pen);  this.ctrl.pen.n.value   = String(pen);
    this.ctrl.sScale.s.value = String(ss);  this.ctrl.sScale.n.value = String(ss);
    this.ctrl.pScale.s.value = String(ps);  this.ctrl.pScale.n.value = String(ps);
    this.ctrl.dist.s.value   = String(dist);this.ctrl.dist.n.value   = String(dist);

    if (p.cookieCore)   this.ctrl.core.value   = toHex(p.cookieCore);
    if (p.cookieOrange) this.ctrl.orange.value = toHex(p.cookieOrange);
    if (p.cookieCyan)   this.ctrl.cyan.value   = toHex(p.cookieCyan);
  }

  _apply(patch) {
    try { this.api.setPlume?.(patch); }
    catch (e) { this.debugger?.handleError(e, 'EnvPanel.Apply'); }
  }
}

/* ------- styles ------- */
function baseBtnStyle() {
  return `
    position:fixed; z-index:11;
    padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.25);
    background:rgba(30,30,36,0.9); color:#fff; cursor:pointer;
  `;
}
function panelStyle() {
  return `
    position:fixed; top:60px; left:20px; z-index:10; width:340px; max-height:76vh;
    overflow:auto; padding:14px; display:none; border-radius:10px;
    background:rgba(24,24,28,0.95); color:#fff; border:1px solid rgba(255,255,255,0.18);
    box-shadow:0 10px 20px rgba(0,0,0,0.35); backdrop-filter:blur(8px);
    -webkit-overflow-scrolling: touch;
  `;
}
function blueBtn(){ return 'flex:1; padding:8px; background:#2c7ef2; color:#fff; border:none; border-radius:6px; cursor:pointer;'; }
function orangeBtn(){ return 'flex:1; padding:8px; background:#f28c2c; color:#fff; border:none; border-radius:6px; cursor:pointer;'; }
function neutralBtn(){ return 'flex:1; padding:8px; background:#2b2f3a; color:#fff; border:none; border-radius:6px; cursor:pointer;'; }

function toHex(c) {
  try { return (typeof c === 'string') ? c : '#ffffff'; }
  catch { return '#ffffff'; }
}