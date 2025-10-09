/* client/topicmap.js */
(function () {
  if (!window.plugins) window.plugins = {};

  // ---------- Utils ----------------------------------------------------------

  // Parse KEY VALUE lines from item.text
  function parseOptions(text) {
    const opts = {
      height: 420,
      coldBoot: '/assets/pages/cold-boot/cold-boot.html',
      theme: 'auto',           // light | dark | auto
      debug: false,
      inline: false,           // INLINE true => run Elm inline, no iframe
      elmBundle: '/assets/dm6-elm/app.js',
      elmModule: 'AppEmbed'
    };
    (text || '').split(/\n+/).forEach(line => {
      const clean = line.replace(/\s*#.*$/, ''); // allow comments with #
      const m = clean.match(/^\s*([A-Z_]+)\s+(.*)\s*$/);
      if (!m) return;
      const [, key, valRaw] = m;
      const val = valRaw.trim();

      if (key === 'HEIGHT')      opts.height   = parseInt(val, 10) || opts.height;
      if (key === 'COLD_BOOT')   opts.coldBoot = val;
      if (key === 'THEME')       opts.theme    = /^(dark|light|auto)$/i.test(val) ? val.toLowerCase() : opts.theme;
      if (key === 'DEBUG')       opts.debug    = /^(1|true|yes|on)$/i.test(val);
      if (key === 'INLINE')      opts.inline   = /^(1|true|yes|on)$/i.test(val);
      if (key === 'ELM_BUNDLE')  opts.elmBundle = val;
      if (key === 'ELM_MODULE')  opts.elmModule = val;
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

  function originOf(url) {
    try { return new URL(url, location.href).origin; }
    catch { return '*'; }
  }

  function sendInitToFrame(frame, opts) {
    const payload = { kind: 'topicmap:init', lineup: gatherLineup(), options: opts, from: location.origin };
    const target = originOf(opts.coldBoot);
    frame.contentWindow.postMessage(payload, target);
    if (opts.debug) console.debug('[topicmap] init→iframe', { target, ...payload });
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

  function bootElmInline(mount, opts) {
    mount.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'tm-inline';
    root.style.height = 'var(--tm-height, 420px)';
    root.style.width = '100%';
    mount.appendChild(root);

    const ns = (window.Elm && window.Elm[opts.elmModule]) || null;
    if (!ns) throw new Error(`Elm module not found: Elm.${opts.elmModule}`);

    const flags = { lineup: gatherLineup(), options: { theme: opts.theme, height: opts.height } };
    const app = ns.init({ node: root, flags });

    // Optional: Elm → wiki bridge (publish source data to host)
    if (app.ports?.publishSourceData) {
      app.ports.publishSourceData.subscribe(msg => {
        window.parent.postMessage({ action: 'publishSourceData', ...msg }, '*');
      });
    }
    if (opts.debug) console.debug('[topicmap] Elm inline booted', flags);
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
          <small style="opacity:.8">${opts.inline ? 'Inline Elm' : 'Cold Boot'} · Height: ${opts.height}</small>
        </div>
        <div class="tm-host"></div>
      `);

    $item.data('topicmap-opts', opts);
  }

  function bind($item, item) {
    const opts = $item.data('topicmap-opts') || parseOptions(item.text);
    const host = $item.find('.tm-host')[0];

    // clear old handlers for this item
    $item.off('.topicmap');

    if (opts.inline) {
      // INLINE ELM MODE
      let appRef = null;
      (async () => {
        try {
          await loadScriptOnce(opts.elmBundle);
          appRef = bootElmInline(host, opts);
        } catch (e) {
          host.innerHTML = `<div style="padding:8px;color:#c00">Inline Elm failed: ${e.message}</div>`;
          console.error(e);
        }
      })();

      $item.on('click.topicmap', '.tm-reload', async () => {
        try {
          await loadScriptOnce(opts.elmBundle);
          appRef = bootElmInline(host, opts);
        } catch (e) {
          console.error('reload failed', e);
        }
      });

    } else {
      // IFRAME (cold-boot) MODE
      host.innerHTML = `<iframe class="tm-iframe" title="dm6-elm" style="width:100%;height:var(--tm-height);border:0;background:transparent"></iframe>`;
      const $frame = $(host).find('iframe.tm-iframe');

      $frame.off('load.topicmap')
            .on('load.topicmap', function () { sendInitToFrame(this, opts); })
            .attr('src', opts.coldBoot);

      $item.on('click.topicmap', '.tm-reload', () => $frame.attr('src', opts.coldBoot));
    }

    // keep default text editor
    $item.on('dblclick.topicmap', () => wiki.textEditor($item, item));
  }

  window.plugins.topicmap = { emit, bind };
}());
