# RESEARCH — evidence & decisions (compact)

## Evidence
- **AppEmbed contract:** dm6-elm `AppEmbed` expects flags `{ slug, stored }`.
- **Plugin behavior:** `client/topicmap.js` now derives `slug` from the nearest `.page`
  (with fallbacks) and supplies `stored` as a JSON string.
- **Stored default:** Using `"{}"` instead of `"null"` avoids downstream decode surprises.

## Decisions (authoritative)
- **Integration anchor:** Reuse dm6-elm `AppEmbed` as the only Elm entrypoint.
- **Flags contract:** `slug` and `stored` are non-negotiable and must remain strings.
- **No legacy modules:** Do not resurrect AppModel/AppRunner/MapRenderer/ModelAPI.

## Open Questions
- When (if ever) should the framed dialog fallback be used?
- Which Elm ports (if any) are required for topicmap beyond AppEmbed init?
- How should graph snapshots be published safely without `postMessage('*')`?
