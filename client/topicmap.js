(function () {
  if (!window.plugins) window.plugins = {};

  // tiny parser for KEY VALUE lines in item.text
  function parseOptions(text) {
    const opts = {
      height: 420,
      coldBoot: '/assets/pages/cold-boot/cold-boot.html',
      debug: false
    };
    (text || '').split(/\n+/).forEach(line => {
      const m = line.match(/^\s*([A-Z_]+)\s+(.*)\s*$/);
      if (!m) return;
      const [, key, val] = m;
      if (key === 'HEIGHT') opts.height = parseInt(val, 10) || opts.height;
      if (key === 'COLD_BOOT') opts.coldBoot = val.trim();
      if (key === 'DEBUG') opts.debug = /^(1|true|yes|on)$/i.test(val);
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

  function sendInitTo(frame, opts) {
    const lineup = gatherLineup();
    const payload = { kind: 'topicmap:init', lineup, options: opts, from: location.origin };
    // if coldBoot is a different origin, '*' is fine; the app should validate origin
    frame.contentWindow.postMessage(payload, '*');
    if (opts.debug) console.debug('[topicmap] init sent', payload);
  }

  window.plugins.topicmap = {
    emit: function ($item, item) {
      const opts = parseOptions(item.text);
      $item.empty().append(`
        <div class="topicmap-toolbar" style="display:flex;gap:.5rem;align-items:center;">
          <button class="tm-reload">Reload</button>
          <small style="opacity:.8">Cold Boot: ${opts.coldBoot} · Height: ${opts.height}</small>
        </div>
        <iframe class="tm-iframe"
                title="dm6-elm"
                style="width:100%;height:${opts.height}px;border:0;background:#000"></iframe>
      `);
      // stash opts for bind()
      $item.data('topicmap-opts', opts);
    },

    bind: function ($item, item) {
      const opts = $item.data('topicmap-opts') || parseOptions(item.text);
      const $frame = $item.find('iframe.tm-iframe');

      // load cold-boot.html
      $frame.attr('src', opts.coldBoot);

      // when loaded, send the lineup
      $frame.on('load', function () {
        sendInitTo(this, opts);
      });

      // manual reload
      $item.on('click', '.tm-reload', function () {
        $frame.attr('src', opts.coldBoot);
      });

      // keep default double-click editor
      $item.dblclick(() => wiki.textEditor($item, item));
    }
  };
}());
