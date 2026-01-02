/* topicmap-input-modes.js
 *
 * Exposes explicit input modes for the inline plugin:
 *  - Scoped (default): only events from inside `viewport`
 *  - Ambient (opt-in): page-level listeners with guard rails
 *
 * API:
 *   const ctrl = createInputController({
 *     viewport: HTMLElement,
 *     send: (kind, payload) => void,   // e.g., forward to Elm port(s)
 *     excludes: [".editor", "input", "textarea", "[contenteditable=true]"] // optional; merged with built-ins
 *   });
 *
 *   ctrl.setMode('ambient' | 'scoped');
 *   ctrl.getMode() -> 'ambient' | 'scoped'
 *   ctrl.destroy(); // cleans up listeners and UI
 */

const BUILTIN_EXCLUDES = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""], [contenteditable="true"]',
  '.page',               // allow host to add page-level classes to exclude
  '.editor',             // common editor class
];

const PASSIVE_OPTS = { passive: true };
const ACTIVE_OPTS = false; // for keydown, pointerdown etc.

function isExcludedTarget(node, extraSelectors) {
  if (!(node instanceof Element)) return false;
  const all = [...BUILTIN_EXCLUDES, ...(extraSelectors || [])].join(',');
  try {
    if (!all.trim()) return false;
    return node.matches(all) || node.closest(all) !== null;
  } catch {
    // invalid selector shouldn't hard-fail input handling
    return false;
  }
}

function eventPayloadFromPointer(e) {
  return {
    type: e.type,
    timeStamp: e.timeStamp,
    pointerType: e.pointerType || 'mouse',
    buttons: e.buttons || 0,
    button: e.button ?? 0,
    altKey: !!e.altKey,
    ctrlKey: !!e.ctrlKey,
    metaKey: !!e.metaKey,
    shiftKey: !!e.shiftKey,
    clientX: e.clientX,
    clientY: e.clientY,
  };
}

function eventPayloadFromWheel(e) {
  return {
    type: 'wheel',
    timeStamp: e.timeStamp,
    deltaX: e.deltaX,
    deltaY: e.deltaY,
    deltaMode: e.deltaMode,
    altKey: !!e.altKey,
    ctrlKey: !!e.ctrlKey,
    metaKey: !!e.metaKey,
    shiftKey: !!e.shiftKey,
    clientX: e.clientX,
    clientY: e.clientY,
  };
}

function eventPayloadFromKey(e) {
  return {
    type: e.type,
    timeStamp: e.timeStamp,
    key: e.key,
    code: e.code,
    altKey: !!e.altKey,
    ctrlKey: !!e.ctrlKey,
    metaKey: !!e.metaKey,
    shiftKey: !!e.shiftKey,
    repeat: !!e.repeat,
  };
}

function makeBadge(viewport) {
  const badge = document.createElement('div');
  badge.className = 'tm-ambient-badge tm-hidden';
  badge.textContent = 'Ambient ON — press Esc to return to Scoped';
  viewport.appendChild(badge);
  return badge;
}

function ensureAmbientStyles() {
  if (document.getElementById('tm-ambient-style')) return;
  const style = document.createElement('style');
  style.id = 'tm-ambient-style';
  style.textContent = `
  .tm-ambient-badge {
    position: absolute;
    right: .5rem;
    top: .5rem;
    font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: rgba(255, 200, 40, .9);
    color: #111;
    padding: .25rem .5rem;
    border-radius: .5rem;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
    z-index: 3;
    cursor: pointer;
    user-select: none;
  }
  .tm-hidden { display: none; }
  .topicmap .topicmap-viewport { position: relative; }
  `;
  document.head.appendChild(style);
}

export function createInputController({ viewport, send, excludes = [] }) {
  if (!viewport || typeof send !== 'function') {
    throw new Error('createInputController: missing required { viewport, send }');
  }
  ensureAmbientStyles();
  const badge = makeBadge(viewport);

  let mode = 'scoped'; // 'scoped' | 'ambient'
  let disposed = false;

  // Listener refs for clean removal
  const off = [];

  // -- Core routing guards -----------------------------------------------

  function inViewport(target) {
    return viewport.contains(target);
  }

  function shouldForward(evt) {
    // Guard: never interfere with focused inputs/editors
    if (isExcludedTarget(evt.target, excludes)) return false;
    // Scoped mode: only forward if inside viewport
    if (mode === 'scoped') return inViewport(evt.target);
    // Ambient mode: page-level allowed, but still obey excludes
    return true;
  }

  // -- Forwarders ---------------------------------------------------------

  function onPointer(e) {
    if (!shouldForward(e)) return;
    send('pointer', eventPayloadFromPointer(e));
  }

  function onWheel(e) {
    if (!shouldForward(e)) return;
    // In ambient mode we DO NOT preventDefault to avoid scroll hijack
    send('wheel', eventPayloadFromWheel(e));
  }

  function onKey(e) {
    // Esc toggles back to scoped when ambient
    if (mode === 'ambient' && e.type === 'keydown' && e.key === 'Escape') {
      setMode('scoped');
      return;
    }
    if (!shouldForward(e)) return;
    send('key', eventPayloadFromKey(e));
  }

  // -- Mode wiring --------------------------------------------------------

  function wireScoped() {
    const el = viewport;
    el.addEventListener('pointerdown', onPointer, ACTIVE_OPTS);
    el.addEventListener('pointermove', onPointer, ACTIVE_OPTS);
    el.addEventListener('pointerup', onPointer, ACTIVE_OPTS);
    el.addEventListener('wheel', onWheel, PASSIVE_OPTS);
    el.addEventListener('keydown', onKey, ACTIVE_OPTS);
    // ensure focusable so key events can land
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

    off.push(() => {
      el.removeEventListener('pointerdown', onPointer, ACTIVE_OPTS);
      el.removeEventListener('pointermove', onPointer, ACTIVE_OPTS);
      el.removeEventListener('pointerup', onPointer, ACTIVE_OPTS);
      el.removeEventListener('wheel', onWheel, PASSIVE_OPTS);
      el.removeEventListener('keydown', onKey, ACTIVE_OPTS);
    });
  }

  function wireAmbient() {
    const root = document;
    root.addEventListener('pointerdown', onPointer, ACTIVE_OPTS);
    root.addEventListener('pointermove', onPointer, ACTIVE_OPTS);
    root.addEventListener('pointerup', onPointer, ACTIVE_OPTS);
    root.addEventListener('wheel', onWheel, PASSIVE_OPTS);
    root.addEventListener('keydown', onKey, ACTIVE_OPTS);

    off.push(() => {
      root.removeEventListener('pointerdown', onPointer, ACTIVE_OPTS);
      root.removeEventListener('pointermove', onPointer, ACTIVE_OPTS);
      root.removeEventListener('pointerup', onPointer, ACTIVE_OPTS);
      root.removeEventListener('wheel', onWheel, PASSIVE_OPTS);
      root.removeEventListener('keydown', onKey, ACTIVE_OPTS);
    });
  }

  function setMode(next) {
    if (disposed) return;
    if (next !== 'scoped' && next !== 'ambient') return;
    // Clear old listeners
    while (off.length) {
      try { off.pop()(); } catch { /* no-op */ }
    }
    mode = next;
    // Badge visibility & behavior
    badge.classList.toggle('tm-hidden', mode !== 'ambient');
    badge.onclick = () => setMode('scoped');
    // Wire up
    if (mode === 'scoped') wireScoped(); else wireAmbient();
  }

  function getMode() { return mode; }

  function destroy() {
    disposed = true;
    while (off.length) {
      try { off.pop()(); } catch { /* no-op */ }
    }
    badge.remove();
  }

  // Default: scoped
  setMode('scoped');

  return { setMode, getMode, destroy };
}
