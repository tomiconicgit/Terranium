// bootstrap.js — mobile-centered loader + explicit error details + staged progress

// Crash overlay
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
  // Ensure #loading exists and nuke any inline styles from the old template
  const loadingRoot = document.getElementById('loading') || (() => {
    const d = document.createElement('div'); d.id = 'loading'; document.body.appendChild(d); return d;
  })();
  loadingRoot.removeAttribute('style'); // kill inline CSS from index.html if any

  // Inline, highest-priority centering to beat any leftover CSS
  loadingRoot.style.cssText =
    'position:fixed;' +
    'inset:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
    'min-height:100svh; height:100dvh; width:100%;' + // svh/dvh for iOS; harmless elsewhere
    'display:grid; place-items:center; background:#000; color:#eaeaea;' +
    'z-index:2147483646; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial';

  // Card HTML
  loadingRoot.innerHTML = `
    <div class="ld-card" role="status" aria-live="polite">
      <div class="ld-title" style="text-align:center;font-weight:600;font-size:16px;color:#fff;margin-bottom:10px">
        Terranium — loading…
      </div>
      <div class="ld-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
        <div id="ld-status" class="ld-status" style="font-size:12px;color:#b9c2cf;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          Starting…
        </div>
        <div id="ld-pct" class="ld-pct" style="font-variant-numeric:tabular-nums;font-size:12px;color:#dfe7f3;width:3.5em;text-align:right">
          0%
        </div>
      </div>
      <div class="ld-bar" style="width:100%;height:10px;border-radius:999px;background:#161a20;overflow:hidden;border:1px solid rgba(255,255,255,.07);position:relative">
        <div id="ld-fill" class="ld-fill" style="position:absolute;inset:0;width:0%;border-radius:inherit;transform-origin:left center;background:linear-gradient(90deg,#1e90ff,#42ffd2)"></div>
      </div>
      <div id="ld-hint" class="ld-hint" style="margin-top:8px;font-size:11px;color:#8aa0b8;min-height:1em"></div>
      <details id="ld-details" class="ld-details" style="display:none;margin-top:8px">
        <summary style="cursor:pointer;font-size:11px;color:#cdd7e3">Show error details</summary>
        <pre id="ld-pre" class="ld-pre" style="margin-top:6px;max-height:35vh;overflow:auto;background:#0b0b0c;color:#eaeaea;padding:8px;border-radius:8px"></pre>
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
  (function raf(){ currentPct += (targetPct - currentPct) * tweenSpeed;
    const shown = Math.min(99.0, currentPct);
    elFill.style.width = shown.toFixed(1) + '%';
    elPct.textContent = Math.round(shown) + '%';
    requestAnimationFrame(raf);
  })();

  function setProgress(p, label){ targetPct = Math.max(targetPct, Math.min(100, p)); lastBump = performance.now(); if (label) elStat.textContent = label; }
  function bump(by, label){ setProgress(targetPct + by, label); }
  function showError(title, msg){
    elStat.textContent = title || 'Load failed';
    elHint.textContent = 'Tap to expand details below.'; elHint.className = 'ld-hint ld-err';
    elDet.style.display = ''; elPre.textContent = msg || 'Unknown error';
  }

  // Watchdog
  setInterval(() => {
    if (targetPct >= 100) return;
    if (performance.now() - lastBump > 8000) {
      elHint.textContent = 'Still working… (slow network or blocked file). If it stays here, refresh.';
      elHint.className = 'ld-hint ld-warn';
    }
  }, 2000);

  // Allow app-side progress bumps
  document.addEventListener('bootstrap-progress', (e) => {
    const v = Number(e?.detail?.value); const label = e?.detail?.label;
    if (!Number.isNaN(v)) setProgress(v, label);
  });

  // Script loader
  function add(src, { type, defer } = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; if (type) s.type = type; if (defer) s.defer = true;
      s.onload = resolve; s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(s);
    });
  }

  // Stages
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
      try { await add(st.url); bump(st.pct, `Loaded ${st.name}`); }
      catch (err) { console.error(err); showError('Load failed', `${err.message}\n\nCheck network/CORS and the URL.`); throw err; }
    }

    // App module
    setProgress(targetPct + 15, 'Starting app…'); // ~85%
    try {
      await add('src/main.js', { type: 'module' });
      setProgress(100, 'Ready');
      setTimeout(() => { loadingRoot.style.display = 'none'; }, 250);
    } catch (err) {
      console.error(err);
      const extra =
        '\nCommon causes:\n' +
        '• Bad import path (relative vs absolute)\n' +
        '• Missing file under src/*\n' +
        '• Syntax error in a module\n' +
        '• CORS blocking a resource';
      showError('App start failed', String(err.message || err) + extra);
    }
  })();
});