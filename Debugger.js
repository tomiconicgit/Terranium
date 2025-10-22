// Debugger.js
export class Debugger {
  constructor() {
    // Public handle so you can call helpers from anywhere
    window.__dbg = this;

    this.notificationContainer = document.getElementById('debugger-notifications') || this._ensureContainer();
    this._recentScriptEntries = [];
    this._perfObserver = null;
    this._entryModule = null;

    // ---- Global error hooks ----
    window.addEventListener('error', (evt) => this._onWindowError(evt), true);
    window.addEventListener('unhandledrejection', (evt) => this._onUnhandledRejection(evt));

    // Also capture classic callback signature
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(String(message)), 'Global');
      return true;
    };

    // Track resource timings of scripts so we can correlate failures
    this._attachPerformanceObserver();

    // Inspect import map for obvious issues
    this._inspectImportMap();

    this.log('Debugger initialized.');
  }

  /* ========================= Public helpers ========================= */

  /**
   * Optionally tell the debugger what your entry module is (e.g. 'src/Main.js').
   * This helps the analyzer resolve relative imports when guessing culprits.
   */
  noteEntry(entryUrl) {
    try {
      // Normalize to absolute
      this._entryModule = new URL(entryUrl, location.href).href;
      this.log(`Entry module noted: ${this._entryModule}`);
    } catch {}
  }

  /**
   * Quick on-demand check of module URLs. Weâ€™ll GET with cache-busting and report non-200s.
   * Usage: window.__dbg.verifyModuleList(['src/Main.js','src/scene/Terrain.js'])
   */
  async verifyModuleList(urls = []) {
    const results = [];
    for (const u of urls) {
      const href = new URL(u, location.href).href + `?v=${Date.now()}`;
      try {
        const res = await fetch(href, { cache: 'no-store', mode: 'same-origin' });
        results.push({ url: href, ok: res.ok, status: res.status, type: res.type });
      } catch (e) {
        results.push({ url: href, ok: false, status: 'FETCH_ERROR', type: 'exception', error: String(e) });
      }
    }
    const ok = results.filter(r => r.ok).length;
    const bad = results.length - ok;
    const lines = results.map(r => `${r.ok ? 'âœ…' : 'â›”ï¸'} ${r.url}  [${r.status}${r.type ? ' '+r.type : ''}]`);
    this.showNotification(
      `[Module Verify] ${ok}/${results.length} reachable.\n` + lines.join('\n'),
      bad ? 'error' : 'warning'
    );
    return results;
  }

  /* ========================= Core logging UI ========================= */

  log(message) {
    console.log(`[DEBUG] ${message}`);
  }

  warn(message, context = 'Warning') {
    console.warn(`[${context} WARNING] ${message}`);
    this.showNotification(`[${context}] ${message}`, 'warning');
  }

  handleError(error, context = 'General') {
    const err = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
    console.error(`[${context} ERROR]`, err);

    const parts = [];
    parts.push(`[${context}] ${err.message || 'An unknown error occurred.'}`);

    // Stack and best-guess source location
    if (err.stack) parts.push(this._formatStack(err.stack));

    // If this looks like an ESM import failure, run our analyzer
    if (this._looksLikeModuleFailure(err)) {
      parts.push(this._analyzeModuleFailure());
    }

    this.showNotification(parts.filter(Boolean).join('\n\n'), 'error');
  }

  showNotification(message, type = 'error') {
    const card = document.createElement('div');
    card.className = `debugger-card ${type}`;
    card.style.cssText = `
      position: relative; margin: 10px; padding: 12px 12px 10px;
      border-radius: 10px; color: #fff; font-family: ui-sans-serif, system-ui, -apple-system;
      background: ${type === 'error' ? 'rgba(170,40,40,0.9)' : 'rgba(120,120,20,0.9)'};
      border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 6px 18px rgba(0,0,0,0.35);
      white-space: pre-wrap; line-height: 1.35;
    `;

    const title = document.createElement('div');
    title.textContent = type === 'error' ? 'Error Detected' : 'System Warning';
    title.style.cssText = 'font-weight: 700; margin-bottom: 6px;';
    const description = document.createElement('div');
    description.textContent = message;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; margin-top:8px; justify-content:flex-end;';

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.cssText = this._btnCss();
    copyButton.onclick = () => {
      navigator.clipboard.writeText(message)
        .then(() => { copyButton.textContent = 'Copied!'; setTimeout(()=>copyButton.textContent='Copy', 1500); })
        .catch(err => console.error('Failed to copy error: ', err));
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Dismiss';
    closeButton.style.cssText = this._btnCss();
    closeButton.onclick = () => card.remove();

    row.appendChild(copyButton);
    row.appendChild(closeButton);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(row);

    this.notificationContainer.appendChild(card);

    // Auto-fade
    setTimeout(() => {
      card.style.transition = 'opacity .35s ease';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 400);
    }, 12000);
  }

  /* ========================= Error hooks ========================= */

  _onWindowError(evt) {
    // 1) Classic network load script failures (including <script type="module" src="...">)
    const t = evt?.target;
    if (t && t.tagName === 'SCRIPT') {
      const src = t.getAttribute('src') || '(inline module)';
      const moduleType = (t.getAttribute('type') || '').includes('module') ? 'module' : 'script';
      this.handleError(
        new Error(`Failed to load ${moduleType} script: ${src}`),
        'ScriptLoad'
      );
      return;
    }

    // 2) General runtime errors
    const { message, filename, lineno, colno, error } = evt;
    if (message && String(message).includes('Importing a module script failed')) {
      // This is the generic ESM load failureâ€”trigger our analyzer with extra context.
      const err = error || new Error(String(message));
      this.handleError(err, 'ESM Import');
      return;
    }

    // Fallback: forward
    this.handleError(error || new Error(String(message || 'Window error')), 'Global');
  }

  _onUnhandledRejection(evt) {
    const reason = evt?.reason || new Error('Unhandled promise rejection');
    this.handleError(reason, 'Promise');
  }

  /* ========================= Module failure analysis ========================= */

  _looksLikeModuleFailure(err) {
    const msg = String(err?.message || '');
    return msg.includes('Importing a module script failed') ||
           msg.includes('Failed to load module script') ||
           msg.includes('mime type') ||
           msg.includes('strict MIME type checking');
  }

  _analyzeModuleFailure() {
    const lines = [];

    // 1) List <script type="module"> srcs present on page
    const moduleScripts = [...document.querySelectorAll('script[type="module"]')];
    if (moduleScripts.length) {
      lines.push('Page module entries:');
      for (const s of moduleScripts) lines.push(` â€¢ ${s.src || '(inline module)'}`);
    }

    // 2) Last resource timing entries for scripts (most likely culprits first)
    const suspects = this._getRecentScriptSuspects();
    if (suspects.length) {
      lines.push('\nRecent script resource attempts (latest first):');
      suspects.forEach((e, i) => {
        lines.push(
          ` #${i+1}  ${e.name}\n` +
          `      initiator:${e.initiatorType}  t:${e.duration.toFixed(1)}ms  transfer:${e.transferSize}B`
        );
      });
    }

    // 3) SW note (common cause on GH Pages)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      lines.push('\nNote: A Service Worker is controlling this page; stale cache may be causing this. Try hard reload or unregister SW.');
    }

    // 4) Import map hints
    const imap = this._readImportMap();
    if (imap) {
      lines.push('\nImport map keys: ' + Object.keys(imap.imports || {}).join(', ') || '(none)');
    }

    // 5) If we know an entry module, suggest a static import sweep
    if (this._entryModule) {
      lines.push(`\nEntry module recorded: ${this._entryModule}\n` +
                 `Tip: __dbg.verifyModuleList([entry, and key imports]) to test reachability with no-cache.`);
    }

    // 6) Usual suspects
    lines.push(
      '\nChecklist:\n' +
      ' â€¢ Path & filename **case** (GitHub Pages is case-sensitive)\n' +
      ' â€¢ Import map key matches your imports (e.g., "three")\n' +
      ' â€¢ All modules use the SAME "three" specifier (no mixed CDN URLs)\n' +
      ' â€¢ Hard reload / version busting (?v=...)\n'
    );

    return lines.join('\n');
  }

  _getRecentScriptSuspects() {
    // Take the last 10 script-like entries, reverse chronological
    const arr = [...this._recentScriptEntries].reverse();
    // Prefer entries with tiny transferSize (0/near 0 indicates 404/CORS/mime failure) or long duration followed by failure
    arr.sort((a, b) => {
      const aBad = (a.transferSize === 0) ? 1 : 0;
      const bBad = (b.transferSize === 0) ? 1 : 0;
      if (aBad !== bBad) return bBad - aBad;
      return b.responseEnd - a.responseEnd;
    });
    return arr.slice(0, 10);
  }

  _attachPerformanceObserver() {
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e || !e.name) continue;
          // Track any JS-like resources
          const isScriptish =
            e.initiatorType === 'script' ||
            /\.m?js(\?|$)/i.test(e.name);
          if (isScriptish) {
            this._recentScriptEntries.push(e);
            if (this._recentScriptEntries.length > 100) {
              this._recentScriptEntries.splice(0, this._recentScriptEntries.length - 100);
            }
          }
        }
      });
      po.observe({ type: 'resource', buffered: true });
      this._perfObserver = po;
    } catch (e) {
      // Not supported? fine.
    }
  }

  _inspectImportMap() {
    const imap = this._readImportMap();
    if (!imap) return;

    const imports = imap.imports || {};
    const keys = Object.keys(imports);
    if (!keys.length) return;

    // Common gotcha: multiple ways of importing THREE
    const threeTargets = keys.filter(k => k.toLowerCase().includes('three'));
    if (threeTargets.length > 1) {
      this.warn(`Multiple import map keys look like THREE: ${threeTargets.join(', ')}`, 'ImportMap');
    }
  }

  _readImportMap() {
    try {
      const el = document.querySelector('script[type="importmap"]');
      if (!el) return null;
      return JSON.parse(el.textContent || '{}');
    } catch (e) {
      this.warn('Failed to parse import map JSON.', 'ImportMap');
      return null;
    }
  }

  _formatStack(stack) {
    // Trim noisy lines; keep top 6 frames
    const lines = String(stack).split('\n').slice(0, 6);
    return 'Stack:\n' + lines.join('\n');
  }

  _btnCss() {
    return `
      appearance:none; border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.08);
      color:#fff; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:600;
    `;
  }

  _ensureContainer() {
    const host = document.createElement('div');
    host.id = 'debugger-notifications';
    host.style.cssText = `
      position: fixed; right: 12px; top: 12px; z-index: 99999;
      display: flex; flex-direction: column; align-items: flex-end; max-width: 520px;
    `;
    document.body.appendChild(host);
    return host;
  }
}
