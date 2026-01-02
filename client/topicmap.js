/* client/topicmap.js — inline-only Topicmap (no cold-boot) */
(function () {
  if (!window.plugins) window.plugins = {};
  const CURRENT_SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';

  // ---------- Utils ----------------------------------------------------------

  function parseBool(val, def = false) {
    const v = String(val ?? '').trim().toLowerCase();
    if (['1','true','yes','on','debug'].includes(v))  return true;
    if (['0','false','no','off','prod','optimize','release'].includes(v)) return false;
    return def;
  }

  function getParentOrigin() {
    const ref = document.referrer;
    if (ref) {
      try {
        return new URL(ref).origin;
      } catch (_) {
        // fall through to same-origin default
      }
    }
    return window.location.origin;
  }

  // Parse KEY VALUE lines from item.text
  function parseOptions(text) {
    const opts = {
      height: 420,
      theme: 'auto',              // light | dark | auto
      debug: false,               // choose debug/prod Elm bundle
      inline: true,               // inline always preferred (no iframe path)
      ambient: false,             // optional ambient input mode
      ambientExcludes: [],        // extra selectors to ignore in ambient mode
      elmBundle: '/assets/dm6-elm/app.js',      // production/optimized bundle
      elmBundleDebug: '',                          // optional debug bundle
      elmModule: 'AppEmbed'        // window.Elm.AppEmbed
    };
    (text || '').split(/\n+/).forEach(line => {
      const clean = line.replace(/\s*#.*$/, ''); // allow trailing comments
      const m = clean.match(/^\s*([A-Z_]+)\s+(.*)\s*$/);
      if (!m) return;
      const [, key, raw] = m;
      const val = raw.trim();

      if (key === 'HEIGHT')            opts.height         = parseInt(val, 10) || opts.height;
      if (key === 'THEME')             opts.theme          = /^(dark|light|auto)$/i.test(val) ? val.toLowerCase() : opts.theme;
      if (key === 'DEBUG')             opts.debug          = parseBool(val, opts.debug);
      if (key === 'INLINE')            opts.inline         = parseBool(val, true); // still inline-only; honored for UX text
      if (key === 'AMBIENT')           opts.ambient        = parseBool(val, opts.ambient);
      if (key === 'AMBIENT_EXCLUDES')  opts.ambientExcludes = val.split(',').map(s => s.trim()).filter(Boolean);
      if (key === 'ELM_BUNDLE')        opts.elmBundle      = val;
      if (key === 'ELM_BUNDLE_DEBUG')  opts.elmBundleDebug = val;
      if (key === 'ELM_MODULE')        opts.elmModule      = val;
      // Legacy keys like COLD_BOOT are ignored.
    });
    return opts;
  }

  function gatherLineup() {
    return Array.from(document.querySelectorAll('.page')).map(p => ({
      slug: p.getAttribute('data-slug') || (p.id || '').replace(/^page_/, ''),
      site: p.getAttribute('data-site') || location.host,
      title: (p.querySelector('h1')?.textContent || '').trim()
    }));
  }

  function pickElmBundleSrc(opts, viewport) {
    if (opts.debug && viewport && (!viewport.isConnected || !viewport.parentNode)) {
      if (!viewport.__topicmapDebugWarned && console?.warn) {
        console.warn('[topicmap] debug bundle disabled: viewport not connected');
        viewport.__topicmapDebugWarned = true;
      }
      return opts.elmBundle;
    }
    if (!opts.debug) return opts.elmBundle;
    if (opts.elmBundleDebug) return opts.elmBundleDebug;
    // auto-derive foo.debug.js from foo.js
    const m = opts.elmBundle.match(/^(.*)\.js(\?.*)?$/);
    return m ? `${m[1]}.debug.js${m[2] || ''}` : opts.elmBundle;
  }

  const scriptLoaders = new Map();
  const inputControllerLoaders = new Map();

  function normalizeSrc(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch (_) {
      return src;
    }
  }

  function findExistingScript(src) {
    const key = normalizeSrc(src);
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      if (normalizeSrc(script.src) === key) return script;
    }
    return null;
  }

  function loadScriptOnce(src) {
    const key = normalizeSrc(src);
    if (scriptLoaders.has(key)) return scriptLoaders.get(key);

    const existing = findExistingScript(src);
    if (existing) {
      if (existing.dataset.inlineElmStatus === 'error') {
        return Promise.reject(new Error(`Elm bundle failed to load: ${src}`));
      }
      if (existing.dataset.inlineElmStatus === 'loading') {
        const promise = new Promise((res, rej) => {
          existing.addEventListener('load', () => {
            existing.dataset.inlineElmStatus = 'loaded';
            res();
          }, { once: true });
          existing.addEventListener('error', () => {
            existing.dataset.inlineElmStatus = 'error';
            scriptLoaders.delete(key);
            rej(new Error(`Elm bundle failed to load: ${src}`));
          }, { once: true });
        });
        scriptLoaders.set(key, promise);
        return promise;
      }
      return Promise.resolve();
    }

    const promise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.dataset.inlineElm = key;
      s.dataset.inlineElmStatus = 'loading';
      s.onload = () => {
        s.dataset.inlineElmStatus = 'loaded';
        res();
      };
      s.onerror = () => {
        s.dataset.inlineElmStatus = 'error';
        scriptLoaders.delete(key);
        rej(new Error(`Elm bundle failed to load: ${src}`));
      };
      document.head.appendChild(s);
    });
    scriptLoaders.set(key, promise);
    return promise;
  }

  function getInputControllerUrl() {
    if (CURRENT_SCRIPT_SRC) {
      try {
        return new URL('./topicmap-input-modes.js', CURRENT_SCRIPT_SRC).href;
      } catch (_) {
        return './topicmap-input-modes.js';
      }
    }
    return './topicmap-input-modes.js';
  }

  function loadInputControllerModule() {
    const url = getInputControllerUrl();
    if (inputControllerLoaders.has(url)) return inputControllerLoaders.get(url);
    const promise = import(url).catch(err => {
      inputControllerLoaders.delete(url);
      throw err;
    });
    inputControllerLoaders.set(url, promise);
    return promise;
  }

  // Normalize the viewport so the main SVG lives in normal flow; HUDs are local overlays
  function normalizeViewport(viewport) {
    viewport.style.position = 'relative';
    viewport.style.overflow = 'hidden';

    // choose the largest SVG as the main canvas and force it into flow
    let targetSvg = null, maxArea = 0;
    viewport.querySelectorAll('svg').forEach(svg => {
      const w = svg.clientWidth  || parseFloat(svg.getAttribute('width'))  || 0;
      const h = svg.clientHeight || parseFloat(svg.getAttribute('height')) || 0;
      const area = w * h;
      if (area >= maxArea) { maxArea = area; targetSvg = svg; }
    });
    if (targetSvg) {
      Object.assign(targetSvg.style, {
        position: 'relative',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%',
        display: 'block'
      });
    }

    // Demote any window-fixed HUD to viewport-absolute
    viewport.querySelectorAll(':scope > div[style*="position: fixed"]').forEach(el => {
      el.style.position = 'absolute';
      el.style.right = '2em';
      el.style.bottom = '2em';
      el.style.zIndex = '2';
    });

    // Normalize a common absolute wrapper if present
    const absWrap = viewport.querySelector(':scope > div[style*="position: absolute"]');
    if (absWrap) {
      Object.assign(absWrap.style, {
        position: 'relative',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%'
      });
    }
  }

  function waitForViewportConnected(viewport, maxFrames = 10) {
    return new Promise(resolve => {
      let remaining = maxFrames;
      const check = () => {
        if (viewport && viewport.isConnected && viewport.parentNode) {
          resolve(true);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          resolve(false);
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  async function bootElmInline(viewport, opts) {
    const bootId = viewport.__topicmapBootId;
    viewport.classList.add('is-inline');
    viewport.setAttribute('data-mode', 'inline');
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild); // Elm owns this node

    const ns = (window.Elm && window.Elm[opts.elmModule]) || null;
    if (!ns || typeof ns.init !== 'function') {
      throw new Error(`Elm module not found: Elm.${opts.elmModule}`);
    }

    // AppEmbed expects { slug : String, stored : String }
    const pageEl = viewport.closest('.page');
    const slug =
      (pageEl && pageEl.getAttribute('data-slug')) ||
      ((pageEl && pageEl.id) ? pageEl.id.replace(/^page_/, '') : '') ||
      location.pathname.split('/').filter(Boolean).pop() ||
      'empty';

    let pageData = null;
    try {
      pageData = (typeof wiki !== 'undefined' && typeof wiki.getData === 'function')
        ? wiki.getData()
        : null;
    } catch (_) {
      pageData = null;
    }

    // Prefer "{}" over "null" to match AppEmbed fallback and avoid downstream decode surprises
    const stored = (pageData == null) ? '{}' : JSON.stringify(pageData);

    const flags = { slug: String(slug), stored: String(stored) };

    const connected = await waitForViewportConnected(viewport, 10);
    if (!connected) {
      console.warn('[topicmap] viewport not connected; aborting boot');
      return null;
    }

    console.debug('[topicmap] bootElmInline', {
      connected: viewport?.isConnected,
      hasParent: !!viewport?.parentNode
    });

    const app = ns.init({ node: viewport, flags });
    viewport.__topicmapElmApp = app;

    // Normalize after first paint and on subsequent DOM mutations
    queueMicrotask(() => {
      if (viewport.__topicmapBootId !== bootId) return;
      normalizeViewport(viewport);
    });
    const rafId = requestAnimationFrame(() => {
      if (viewport.__topicmapBootId !== bootId) return;
      normalizeViewport(viewport);
    });
    if (!viewport.__topicmapTimers) viewport.__topicmapTimers = { rafIds: [] };
    viewport.__topicmapTimers.rafIds.push(rafId);
    const mo = new MutationObserver(() => normalizeViewport(viewport));
    mo.observe(viewport, { childList: true, subtree: false });
    viewport._tmObserver = mo;

    // Optional bridge: Elm -> host publish
    if (app.ports?.publishSourceData) {
      app.ports.publishSourceData.subscribe(msg => {
        const targetOrigin = getParentOrigin();
        window.parent.postMessage({ action: 'publishSourceData', ...msg }, targetOrigin);
      });
    }

    if (opts.debug && console?.debug) {
      const count = (viewport.__topicmapInitCount || 0) + 1;
      viewport.__topicmapInitCount = count;
      console.debug('[topicmap] Elm inline booted', { flags, count });
    }
    return app;
  }

  function setupInputController(viewport, opts) {
    if (viewport.__topicmapInputController) {
      return Promise.resolve(viewport.__topicmapInputController);
    }
    if (viewport.__topicmapInputControllerPromise) {
      return viewport.__topicmapInputControllerPromise;
    }
    const promise = loadInputControllerModule().then(mod => {
      const create = mod && mod.createInputController;
      if (typeof create !== 'function') {
        throw new Error('Input controller module missing createInputController');
      }
      const ctrl = create({
        viewport,
        send: (kind, payload) => {
          if (console?.debug) console.debug('[topicmap] input', kind, payload);
        },
        excludes: opts.ambientExcludes
      });
      if (opts.ambient) ctrl.setMode('ambient');
      viewport.__topicmapInputController = ctrl;
      viewport.__topicmapInputControllerPromise = null;
      return ctrl;
    }).catch(err => {
      viewport.__topicmapInputControllerPromise = null;
      throw err;
    });
    viewport.__topicmapInputControllerPromise = promise;
    return promise;
  }

  function cleanupViewport(viewport) {
    if (!viewport) return;
    if (viewport.__topicmapInputController?.destroy) {
      try { viewport.__topicmapInputController.destroy(); } catch (_) { /* no-op */ }
    }
    if (viewport._tmObserver?.disconnect) {
      try { viewport._tmObserver.disconnect(); } catch (_) { /* no-op */ }
    }
    if (viewport.__topicmapTimers?.rafIds?.length) {
      viewport.__topicmapTimers.rafIds.forEach(id => cancelAnimationFrame(id));
    }
    viewport.__topicmapInputController = null;
    viewport.__topicmapInputControllerPromise = null;
    viewport.__topicmapElmApp = null;
    viewport._tmObserver = null;
    viewport.__topicmapTimers = null;
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild);
  }

  function renderInlineError(viewport, message) {
    viewport.innerHTML = `<div style="padding:8px;color:#c00">Elm failed: ${message}</div>`;
  }

  // ---------- Plugin ---------------------------------------------------------

  function emit($item, item) {
    const opts = parseOptions(item.text);

    $item
      .addClass('topicmap')
      .addClass('theme-' + (opts.theme || 'auto')) // theme-light|theme-dark|theme-auto
      .css('--tm-height', `${opts.height}px`)
      .empty()
      .append(`
        <div class="topicmap-toolbar" role="group" aria-label="Topicmap controls" style="display:flex;gap:.5rem;align-items:center;">
          <button class="tm-reload" aria-label="Reload topic map">Reload</button>
          <small style="opacity:.8">Inline Elm · Height: ${opts.height}${opts.debug ? ' · Debug' : ''}</small>
        </div>
        <div class="topicmap-viewport" role="region" aria-label="Topicmap canvas"></div>
      `);

    $item.data('topicmap-opts', opts);
  }

  function bind($item, item) {
    const opts     = $item.data('topicmap-opts') || parseOptions(item.text);
    const viewport = $item.find('.topicmap-viewport')[0];
    const bootId = (viewport.__topicmapBootId || 0) + 1;
    viewport.__topicmapBootId = bootId;

    // clear previous handlers for this item
    $item.off('.topicmap');

    // Always run inline (no iframe path)
    (async () => {
      try {
        const bundleSrc = pickElmBundleSrc(opts, viewport);
        await loadScriptOnce(bundleSrc);
        if (viewport.__topicmapBootId !== bootId) return;
        cleanupViewport(viewport);
        const app = await bootElmInline(viewport, opts);
        if (!app) return;
        await setupInputController(viewport, opts);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        renderInlineError(viewport, msg);
        console.error(e);
      }
    })();

    // Manual reload button
    $item.on('click.topicmap', '.tm-reload', async evt => {
      const button = evt.currentTarget;
      if (button && button.disabled) return;
      if (button) button.disabled = true;
      try {
        const reloadId = (viewport.__topicmapBootId || 0) + 1;
        viewport.__topicmapBootId = reloadId;
        const bundleSrc = pickElmBundleSrc(opts, viewport);
        await loadScriptOnce(bundleSrc);
        if (viewport.__topicmapBootId !== reloadId) return;
        cleanupViewport(viewport);
        const app = await bootElmInline(viewport, opts);
        if (!app) return;
        await setupInputController(viewport, opts);
      } catch (e) {
        console.error('reload failed', e);
      } finally {
        if (button) button.disabled = false;
      }
    });

    // Keep default double-click editor
    $item.on('dblclick.topicmap', () => wiki.textEditor($item, item));
  }

  window.plugins.topicmap = { emit, bind };
}());
