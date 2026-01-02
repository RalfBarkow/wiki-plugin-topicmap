# WORKLOG — compact & authoritative

## 2025-10-26
- DONE: Switched inline boot to dm6-elm AppEmbed flags `{slug, stored}` and defaulted `stored` to `"{}"`.
- DONE: Added input-mode controller module (scoped/ambient).
- DONE: Added `repomix.config.json` + `repomix-md` npm script.

Next actions (priority):
1) Security: remove `postMessage('*')`, add explicit `targetOrigin` and origin/schema checks.
2) Lifecycle: ensure MutationObserver cleanup and single Elm instance per viewport.
3) Wiring: connect input controller into topicmap boot path (Scoped default, Ambient optional).
4) Integration: verify Elm bundle path in a real wiki and confirm `Elm.AppEmbed.init`.
