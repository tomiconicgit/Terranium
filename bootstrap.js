// bootstrap.js — mobile-centered loader + explicit error details + staged progress

// Fullscreen crash overlay (for early/runtime errors)
(function attachErrorOverlay(){
  const show = (title, msg) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.94);color:#fff;' +
      'font:12px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:16px;white-space:pre-wrap;overflow:auto';
    el.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${title}</div><div>${msg}</div>`;
    document.body.appendChild(el);
  };
  window.addEventListener('error', e => show('Unhandled error', e.message + (e.error?.stack? '\n\n'+e.error.stack:'')));
  window.addEventListener('unhandledrejection', e => show('Unhandled rejection', String(e.reason)));
})();

document.addEventListener('DOMContentLoaded', () => {
  // Create/ensure #loading
  const loadingRoot = document.getElementById('loading') || (() => {
    const d = document.createElement('div'); d.id = 'loading'; document.body.appendChild(d); return d;
  })();

  // Style (mobile-safe centering + safe area)
  const style = document.createElement('style');
  style.textContent = `
    #loading {
      position: fixed; /* fixed so it's not affected by address bar collapse */
      inset: env(safe-area-inset-top) env(safe-area-inset-right)
             env(safe-area-inset-bottom) env(safe-area-inset-left);
      min-height: 100dvh; /* true viewport height on iOS */
      width: 100%;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: #eaeaea; background:#000;
      z-index: 2147483646; /* above everything */
    }
    .ld-card {
      width: min(420px, 88vw); padding: 16px 16px 12px; border-radius: 12px;
      background: rgba(18,20,24,0.7); backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    .ld-title { font-weight: 600; font-size: 16px; letter-spacing: .2px; margin-bottom: 10px; color:#fff; text-align:center; }
    .ld-row { display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; gap: 12px; }
    .ld-status { font-size: 12px; color:#b9c2cf; min-height: 1em; flex: 1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ld-pct { font-variant-numeric: tabular-nums; font-size: 12px; color:#dfe7f3; width: 3.5em; text-align:right; }
    .ld-bar { width: 100%; height: 10px; border-radius: 999px; background: #161a20; overflow: hidden; position: relative;
      border: 1px solid rgba(255,255,255,0.07); }
    .ld-fill { position:absolute; inset:0; width:0%; border-radius: inherit; transform-origin: left center;
      background: linear-gradient(90deg, #1e90ff, #42ffd2); }
    .ld-hint { margin-top:8px; font-size:11px; color:#8aa0b8; min-height:1em; }
    .ld-warn { color:#ffb86b; }
    .ld-err  { color:#ff6666; }
    .ld-details { margin-top:8px; }
    .ld-details summary { cursor: pointer; font-size: 11px; color:#cdd7e3; }
    .ld-pre { margin-top:6px; max-height: 35vh; overflow:auto; background:#0b0b0c; color:#eaeaea; padding:8px; border-radius:8px; }
  `;
  document.head.appendChild(style);

  loadingRoot.innerHTML = `
    <div class="ld-card">
      <div class="ld-title">Terranium — loading…</div>
      <div class="ld-row">
        <div class="ld-status" id="ld-status">Starting…</div>
        <div class="ld-pct" id="ld-pct">0%</div>
      </div>
      <div class="ld-bar"><div class="ld-fill" id="ld-fill"></div></div>
      <div class="ld-hint" id="ld-hint"></div>
      <details class="ld-details" id="ld-details" style="display:none">
        <summary>Show error details</summary>
        <pre class="ld-pre" id="ld-pre"></pre>
      </details>
    </div>
  `;

  const elFill = document.getElementById('ld-fill');
  const elPct  = document.getElementById('ld-pct');
  const elStat = document.getElementById('ld-status');
  const elHint = document.getElementById('ld-hint');
  const elDet  = document.getElementById('ld-details');
  const elPre  = document.getElementById('ld-pre');

  // Progress engine
  let targetPct = 0, currentPct = 0, lastBump = performance.now();
  const tweenSpeed = 0.18;
  function raf() {
    currentPct += (targetPct - currentPct) * tweenSpeed;
    const shown = Math.min(99.0, currentPct);
    elFill.style.width = shown.toFixed(1) + '%';
    elPct.textContent = Math.round(shown) + '%';
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function setProgress(p, label) {
    targetPct = Math.max(targetPct, Math.min(100, p));
    lastBump = performance.now();
    if (label) elStat.textContent = label;
  }
  function bump(by, label) { setProgress(targetPct + by, label); }
  function showError(title, msg){
    elStat.textContent = title || 'Load failed';
    elHint.textContent = 'Tap to expand details below.';
    elHint.classList.remove('ld-warn'); elHint.classList.add('ld-err');
    elDet.style.display = '';
    elPre.textContent = msg || 'Unknown error';
  }

  // Watchdog
  const STALL_MS = 8000;
  setInterval(() => {
    if (targetPct >= 100) return;
    const idle = performance.now() - lastBump;
    if (idle > STALL_MS) {
      elHint.textContent = 'Still working… (slow network or blocked file). If it stays here, refresh.';
      elHint.classList.add('ld-warn');
    }
  }, 2000);

  // Optional external progress from app
  document.addEventListener('bootstrap-progress', (e) => {
    const v = Number(e?.detail?.value);
    const label = e?.detail?.label;
    if (!Number.isNaN(v)) setProgress(v, label);
  });

  // Script loader with explicit file name in errors
  function add(src, { type, defer } = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      if (type) s.type = type;
      if (defer) s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(s);
    });
  }

  // Stages (sum ~70). We’ll bump +15 “Starting app” to ~85, then app can push to 100.
  const stages = [
    { name: 'Core',       pct: 25, url: 'https://unpkg.com/three@0.128.0/build/three.min.js' },
    { name: 'RGBELoader', pct: 20, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/RGBELoader.js' },
    { name: 'fflate',     pct: 10, url: 'https://unpkg.com/three@0.128.0/examples/js/libs/fflate.min.js' },
    { name: 'EXRLoader',  pct: 15, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/EXRLoader.js' },
  ];

  (async () => {
    setProgress(2, 'Starting…');

    for (const st of stages) {
      elHint.textContent = '';
      try {
        await add(st.url);
        bump(st.pct, `Loaded ${st.name}`);
      } catch (err) {
        console.error(err);
        showError('Load failed', `${err.message}\n\nCheck network/CORS and the URL.`);
        throw err;
      }
    }

    // App module (this is probably your 85% stall point)
    setProgress(targetPct + 15, 'Starting app…'); // ~85%
    try {
      await add('src/main.js', { type: 'module' });
      setProgress(100, 'Ready');
      setTimeout(() => { if (loadingRoot) loadingRoot.style.display = 'none'; }, 250);
    } catch (err) {
      console.error(err);
      // Include a hint for the common causes
      const extra =
        '\nCommon causes:\n' +
        '• Bad import path (relative vs absolute)\n' +
        '• Missing file under src/*\n' +
        '• Syntax error in a module (see stack above)\n' +
        '• CORS on textures/HDR if you switched domains';
      showError('App start failed', String(err.message || err) + extra);
      // keep overlay visible
    }
  })().catch((err) => {
    console.error(err);
    showError('Bootstrap crashed', err?.message || String(err));
  });

  // External hook
  window.tcSetProgress = (value, label) => setProgress(value, label);
});