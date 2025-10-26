# wiki-plugin-topicmap — SPEC

## Problem (narrowed)
Build a secure, leak-free inline **topicmap** plugin that cleanly bridges a FedWiki item and an Elm map renderer, **and** exposes an optional **Ambient Input mode** that intentionally listens beyond the viewport for novel page-level interactions. Default remains **Scoped** (no surprises); **Ambient** is explicit and reversible.

## Scope
- Inline mode (default). Optional framed/sandboxed fallback behind a flag.
- No server changes; client/plugin + minimal demo page.

Out of scope: new Elm map features unrelated to interaction plumbing.

## Acceptance Criteria

### Functional
1. **Inline render:** Elm mounts in `.topicmap-viewport`; `--tm-height` respected. Resizes update the viewport without reloading Elm.
2. **Handshake:** JS sends `Init { pageJson, options }`; Elm replies `Ready`. No user events routed to Elm before `Ready`.
3. **Input modes (explicit):**
   - **Scoped (default):** Only events with targets inside the viewport are forwarded to Elm.
   - **Ambient (opt-in):** Global listeners are enabled; Elm may react to page-level pointer/keyboard gestures.
     - Must **not** steal focus or interfere with `<input>`, `<textarea>`, `[contenteditable]`, selects, or editable FedWiki UI.
     - Provides a visible indicator (“Ambient ON”) and a quick toggle (click on indicator or `Esc` to return to Scoped).
     - Honours an **exclusion allowlist** of selectors (configurable via options).
4. **Overlay anchoring:** Overlays are positioned relative to the viewport container (no screen-fixed leaks).

### Security
5. **postMessage origins:** All `postMessage` use a non-`*` target; receivers validate `event.origin` **and** payload schema.
6. **Option hardening:** Item options validated (types/ranges). No dynamic code execution from item text.

### Reliability & Lifecycle
7. **Observer/timer hygiene:** All observers/timers disconnected on unbind/rebind. Repeated mount/unmount shows no growth in observers.
8. **Idempotent bind:** Rebinding yields a single Elm instance and stable DOM.

### Quality & UX
9. **Lint/build clean:** ESLint/Stylelint pass; no references to non-existent `theme/` globs.
10. **Cross-browser:** Desktop Chrome, Firefox (≥145), Safari 17; iOS Safari/Chrome. Touch pan/zoom works without page scroll hijack.
11. **Perf sanity:** ~100 topics / 200 edges pan/zoom ~60fps on a 2020+ laptop; no long-task spike on mount.

### Packaging & Docs
12. **Dev shell:** Nix/direnv with Node 20+ for dev; Node 22 for build. `pnpm` scripts documented.
13. **Docs & demo:** README covers options (including `mode: scoped|ambient`, `ambient.excludes`), ports, security notes. Demo exercises both modes with overlay examples.

### Tests
14. **E2E (Playwright):**
    - Scoped: outside clicks/scrolls do **not** reach Elm.
    - Ambient: outside gestures reach Elm **except** when target matches protected inputs or `ambient.excludes`.
    - Ambient indicator present; `Esc` returns to Scoped.
15. **Golden view:** Stable fixture page JSON produces golden snapshot (Elm view JSON or DOM subset).

### Deliverable
16. **v0.1 tag**: security fix, lifecycle cleanup, explicit modes, docs, demo, and E2E.
