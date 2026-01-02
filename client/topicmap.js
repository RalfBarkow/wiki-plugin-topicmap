/* client/topicmap.js — inline-only Topicmap (no cold-boot) */
(function () {
  if (!window.plugins) window.plugins = {};

  // ---------- Utils ----------------------------------------------------------

  function parseBool(val, def = false) {
    const v = String(val ?? '').trim().toLowerCase();
    if (['1','true','yes','on','debug'].includes(v))  return true;
    if (['0','false','no','off','prod','optimize','release'].includes(v)) return false;
    return def;
  }

  // Parse KEY VALUE lines from item.text
  function parseOptions(text) {
    const opts = {
      height: 420,
      theme: 'auto',              // light | dark | auto
      debug: false,               // choose debug/prod Elm bundle
      inline: true,               // inline always preferred (no iframe path)
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

  function pickElmBundleSrc(opts) {
    if (!opts.debug) return opts.elmBundle;
    if (opts.elmBundleDebug) return opts.elmBundleDebug;
    // auto-derive foo.debug.js from foo.js
    const m = opts.elmBundle.match(/^(.*)\.js(\?.*)?$/);
    return m ? `${m[1]}.debug.js${m[2] || ''}` : opts.elmBundle;
  }

  async function loadScriptOnce(src) {
    if (document.querySelector(`script[data-inline-elm="${src}"]`)) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.dataset.inlineElm = src;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
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

  function bootElmInline(viewport, opts) {
    viewport.classList.add('is-inline');
    viewport.setAttribute('data-mode', 'inline');
    viewport.innerHTML = ''; // Elm owns this node

    const ns = (window.Elm && window.Elm[opts.elmModule]) || null;
    if (!ns) throw new Error(`Elm module not found: Elm.${opts.elmModule}`);

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
    const app = ns.init({ node: viewport, flags });

    // Normalize after first paint and on subsequent DOM mutations
    queueMicrotask(() => normalizeViewport(viewport));
    requestAnimationFrame(() => normalizeViewport(viewport));
    const mo = new MutationObserver(() => normalizeViewport(viewport));
    mo.observe(viewport, { childList: true, subtree: false });
    viewport._tmObserver = mo;

    // Optional bridge: Elm -> host publish
    if (app.ports?.publishSourceData) {
      app.ports.publishSourceData.subscribe(msg => {
        window.parent.postMessage({ action: 'publishSourceData', ...msg }, '*');
      });
    }

    if (opts.debug && console?.debug) console.debug('[topicmap] Elm inline booted', flags);
    return app;
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

    // clear previous handlers for this item
    $item.off('.topicmap');

    // Always run inline (no iframe path)
    (async () => {
      try {
        const bundleSrc = pickElmBundleSrc(opts);
        await loadScriptOnce(bundleSrc);
        bootElmInline(viewport, opts);
      } catch (e) {
        viewport.innerHTML = `<div style="padding:8px;color:#c00">Elm failed: ${e.message}</div>`;
        console.error(e);
      }
    })();

    // Manual reload button
    $item.on('click.topicmap', '.tm-reload', async () => {
      try {
        const bundleSrc = pickElmBundleSrc(opts);
        await loadScriptOnce(bundleSrc);
        bootElmInline(viewport, opts);
      } catch (e) {
        console.error('reload failed', e);
      }
    });

    // Keep default double-click editor
    $item.on('dblclick.topicmap', () => wiki.textEditor($item, item));
  }

  window.plugins.topicmap = { emit, bind };
}());
