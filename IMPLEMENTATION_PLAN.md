# Implementation Plan — AppEmbed Integration

## 0. Current state (baseline)
- Inline plugin boot exists in `client/topicmap.js`.
- AppEmbed flags are already derived (`slug`, `stored`).
- Input controller exists in `client/topicmap-input-modes.js` but is not wired.
- Publish bridge still uses `postMessage('*')`.

## 1. Verify Elm bundle contract (dm6-elm AppEmbed)

Goal: confirm a bundle that exports `window.Elm.AppEmbed` is available in wiki assets.

Steps:
- Build dm6-elm and copy output to wiki assets:
  - Example path: `/assets/dm6-elm/app.js`
- Verify the bundle in a browser console:
  - `window.Elm && window.Elm.AppEmbed && typeof window.Elm.AppEmbed.init === 'function'`

Plugin options to point at it (topicmap item text):
```
ELM_BUNDLE /assets/dm6-elm/app.js
ELM_BUNDLE_DEBUG /assets/dm6-elm/app.debug.js
DEBUG false
```

Touchpoints:
- `client/topicmap.js` (bundle loading)
- `README.md` (bundle contract)

## 2. Verify boot flags correctness (slug/stored)

Goal: confirm AppEmbed receives the exact `{ slug, stored }` flags.

Checklist:
- `slug` derivation:
  - `.page[data-slug]` OR
  - `.page#page_*` OR
  - `location.pathname` last segment OR
  - `"empty"` fallback
- `stored` derivation:
  - `wiki.getData()` when available
  - `"{}"` fallback on error or null
- Confirm strings are passed: `String(slug)`, `String(stored)`

Debug steps:
- Add a temporary `console.debug('[topicmap] flags', flags)` in `client/topicmap.js`.
- Confirm values in DevTools, then remove.

Touchpoints:
- `client/topicmap.js`

## 3. Input modes integration (Scoped default, Ambient optional)

Goal: wire the input controller into the topicmap boot path.

Steps:
- Import/create the controller from `client/topicmap-input-modes.js`.
- Create it once per viewport after AppEmbed boot.
- Default to Scoped; expose optional config for Ambient (e.g. item option).
- Ensure badge visibility and Esc-to-exit behavior.

Touchpoints:
- `client/topicmap.js`
- `client/topicmap-input-modes.js`
- `README.md` (document usage)

## 4. Lifecycle hygiene (single Elm instance + cleanup)

Goal: prevent duplicate Elm instances and dangling observers.

Steps:
- Track the Elm app instance per viewport.
- On rebind/reload:
  - disconnect `MutationObserver`
  - destroy input controller (if wired)
  - clear viewport node before re-init

Touchpoints:
- `client/topicmap.js`

## 5. Security hardening (postMessage)

Goal: eliminate `postMessage('*')` and validate origin/schema.

Steps:
- Replace `window.parent.postMessage(..., '*')` with an explicit `targetOrigin`.
- Validate `event.origin` on receive side.
- Validate payload schema before acting.

Touchpoints:
- `client/topicmap.js`
- `client/dialog/index.html` (if used)

## 6. Demo/testing milestones (placeholders ok)

Milestones:
- Demo page loads AppEmbed inline and shows basic box map.
- Input modes toggle works (Scoped default, Ambient opt-in, Esc exit).
- Security checks pass (no wildcard postMessage).

Suggested commands:
- `npm pack -s` (plugin packaging)
- `npm run repomix-md` (regenerate pack for review)

Optional tests:
- Manual: click outside viewport (Scoped should not forward).
- Manual: enable Ambient, verify badge and Esc exit.

