# Implementation Plan

## 0. Repo hygiene
- Remove committed `.direnv/`; add to `.gitignore`.
- Align `pnpm` scripts and lint configs; drop `theme/**` glob if dir doesn’t exist.

## 1. Input modes design
- Options: `mode: "scoped" | "ambient"` (default `"scoped"`), `ambient: { excludes: string[] }`.
- UI: small in-viewport badge when Ambient is active (“Ambient ON”, click to toggle). Keyboard: `Esc` → Scoped.

## 2. Implement Scoped mode
- Delegate listeners to the viewport only.
- Forward events to Elm **only** if `event.target` is inside viewport.

## 3. Implement Ambient mode (opt-in)
- Register global listeners (pointer/keyboard/wheel) with `passive` where possible.
- Guard rails:
  - Skip forwarding if target is input/textarea/contenteditable/select or matches `ambient.excludes`.
  - Never disrupt focus. Do not call `preventDefault` unless strictly necessary (documented).
- Indicator + toggle; clean switch between modes at runtime.

## 4. Secure messaging
- Replace `postMessage('*')` with explicit origin.
- Add receiver `event.origin` and schema validation.

## 5. Lifecycle cleanup
- Track observers/timers on `viewport`; disconnect/clear on unbind/rebind.
- Ensure single Elm instance per viewport (idempotent boot).

## 6. Overlay anchoring
- Normalize “absolute/fixed” overlays to viewport-relative positioning.
- Visual regression check via demo.

## 7. Handshake + defer routing
- JS → Elm `Init`; gate event routing until Elm sends `Ready`.

## 8. Lint/build polish
- ESLint/Stylelint pass; strict mode where feasible.

## 9. Demo & docs
- `demo/index.html` toggles modes, shows overlay, logs forwarded events.
- README documents options, modes, safety constraints, and troubleshooting.

## 10. Tests
- Playwright scenarios for Scoped/Ambient behaviors and toggling.
- Golden snapshot for a sample page JSON.

## 11. Optional framed fallback
- Keep `dialog/` behind a feature flag as isolation fallback.

## 12. Release
- Bump version, CHANGELOG, tag `v0.1`.
