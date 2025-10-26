# RESEARCH — evidence & decisions (compact)

## Evidence
- **Ambient behavior observed:** Elm receives pointer events originating outside `.topicmap-viewport` in current inline setup.
- **Potential value:** Enables page-level gestures (e.g., panning history, cross-item selection, quick-nav) when intentionally activated.
- **Constraints required:** Must not interfere with FedWiki editing, form inputs, or page scroll semantics.
- **Security:** `postMessage('*')` present; receiver lacks origin/schema checks.
- **Lifecycle:** `MutationObserver` created per bind; no guaranteed disconnect on rebind.

## Decisions (authoritative)
- **Modes:** Ship **Scoped** by default; expose **Ambient** as opt-in with indicator + `Esc` to exit.
- **Guard rails (Ambient):** Skip inputs/contenteditable/select; respect `ambient.excludes` allowlist; passive listeners where possible; avoid `preventDefault` unless documented.
- **Security baseline:** Lock postMessage target; validate `event.origin` and payload schema.
- **Lifecycle policy:** Disconnect observers/timers on any unbind/rebind; idempotent boot.
- **Tooling cleanup:** Fix lint globs; remove `.direnv` from git; retain Nix/direnv + `pnpm` flow.
- **Tests:** E2E for Scoped/Ambient behaviors, toggling, and protected targets; golden render snapshot.

> If chat/logs disagree with this file, follow this file.
