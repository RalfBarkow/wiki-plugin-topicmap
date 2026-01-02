# wiki-plugin-topicmap — SPEC (AppEmbed Contract)

## Problem (focused)
Ship a secure, leak-free inline **topicmap** plugin that **reuses dm6-elm's AppEmbed**
and mounts it inside a Federated Wiki item viewport. The integration must honor
the AppEmbed contract precisely and document it clearly.

## Contract Triangle (authoritative)

A) **dm6-elm provides `AppEmbed`**
- `AppEmbed` is a `Browser.element` module.
- It expects flags shaped like `{ slug: String, stored: String }`.

B) **`client/topicmap.js` boots with those exact flags**
- The plugin must call `window.Elm.AppEmbed.init({ node, flags })`.
- The `flags` object must include `slug` and `stored` as strings.
- `stored` must be a JSON string, defaulting to `"{}"` when page data is missing.

C) **Docs + defaults point to a bundle containing `Elm.AppEmbed`**
- Default bundle path: `/assets/dm6-elm/app.js`.
- `ELM_BUNDLE`/`ELM_BUNDLE_DEBUG` must be documented as the source of the bundle.
- The bundle must export `window.Elm.AppEmbed`, or boot must fail fast.

## Scope
- Inline mode only (no iframe cold-boot in the current path).
- dm6-elm's `public/cold-boot.html` is the reference harness in dm6-elm and is not used directly by this plugin.
- Client/plugin code only; no server changes.

## Explicit Non-Goals
- Do not resurrect old modules or APIs:
  - AppModel
  - AppRunner
  - MapRenderer
  - ModelAPI
- Do not add a new Elm app; reuse dm6-elm `AppEmbed`.

## Acceptance Criteria

### Functional
1) **Inline boot with AppEmbed:** `window.Elm.AppEmbed` mounts in `.topicmap-viewport`.
2) **Correct flags:** `slug` and `stored` are passed as strings, with `stored` defaulting to `"{}"`.
3) **Bundle selection:** `ELM_BUNDLE` (or `ELM_BUNDLE_DEBUG` when `DEBUG true`) loads the bundle.
4) **Render proof:** Inline boot passes `slug/stored` and successfully renders a box map
   in the FedWiki viewport.

### Security
5) **postMessage hardening (must-fix):** The inline publish bridge currently uses
   `postMessage('*')` and lacks origin/schema checks. This must be corrected to:
   - use an explicit `targetOrigin`
   - validate `event.origin`
   - validate payload schema

### Reliability & Lifecycle
6) **Single inline instance:** Rebinding yields a single Elm instance and stable DOM.
7) **Observer hygiene:** Mutation observers/timers are disconnected on unbind/rebind.

### UX & Input Modes
8) **Scoped default:** Only events from inside the viewport are forwarded.
9) **Ambient opt-in:** Ambient mode is explicit, reversible, and avoids inputs/editors.

### Documentation
10) **AppEmbed-first docs:** README explains the AppEmbed flags and bundle requirements
    with defaults matching actual behavior.

## Deliverable
- Release `v0.1` with AppEmbed boot, scoped/ambient input modes, security fix,
  and updated docs.
