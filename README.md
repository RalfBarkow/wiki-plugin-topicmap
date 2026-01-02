# Federated Wiki - Topicmap Plugin (dm6-elm AppEmbed)

This plugin renders a Federated Wiki topicmap inline and reuses dm6-elm's `AppEmbed`.
It loads an Elm bundle into the page and mounts `window.Elm.AppEmbed` inside the plugin viewport.

## Quick Start (integration-first)

1) Build and install the plugin into a local wiki:

```
cd ~/workspace/wiki-plugin-topicmap
npm pack -s
cd ~/workspace/wiki/node_modules/wiki
npm i $(npm pack ../../../wiki-plugin-topicmap | tail -1)
```

2) Add a `topicmap` item to a page, and configure the Elm bundle in the item text:

```
ELM_BUNDLE /assets/dm6-elm/app.js
# Optional:
# ELM_BUNDLE_DEBUG /assets/dm6-elm/app.debug.js
# DEBUG true
# HEIGHT 480
# THEME auto
```

3) Ensure the bundle exports `window.Elm.AppEmbed`.

## Runtime Contract (authoritative)

The plugin always boots `window.Elm.AppEmbed` and passes flags shaped like:

```
{ slug: String, stored: String }
```

`stored` is a JSON string. If the page data is unavailable, the plugin sends `"{}"` by default.

Exact boot behavior from `client/topicmap.js`:

- `slug` comes from the closest `.page` element, in order:
  1) `data-slug`
  2) `id` with a `page_` prefix removed
  3) the last segment of `location.pathname`
  4) the literal fallback `"empty"`
- `stored` is built from `wiki.getData()` when available; otherwise it uses `"{}"`:
  - if `wiki.getData()` returns `null`/`undefined` or throws, the plugin sends `"{}"`
  - otherwise it sends `JSON.stringify(pageData)`

## Elm Bundle Loading

The plugin loads an Elm bundle by inserting a script tag and then calling:

```
window.Elm.AppEmbed.init({ node: viewport, flags })
```

Item text options control the bundle path:

- `ELM_BUNDLE` (default: `/assets/dm6-elm/app.js`)
- `ELM_BUNDLE_DEBUG` (optional; used when `DEBUG true`)
- `DEBUG` (true/false) selects which bundle to load

Your bundle must export `Elm.AppEmbed` on `window`. If it does not, the plugin fails with:
`Elm module not found: Elm.AppEmbed`.

## Conceptual Alignment: Topics vs Boxes (dm6-elm)

In dm6-elm terms:

- Topics store content.
- Boxes store topics or other boxes.
- `boxId` is the active container.
- Only boxes can be fullscreen or act as drop targets.

The plugin aligns with these ideas by treating the current page as a container context
and sending the page's data (`stored`) to AppEmbed for reconciliation.

## Input Modes (Scoped and Ambient)

The `client/topicmap-input-modes.js` module defines explicit input modes for routing pointer,
wheel, and key events to Elm:

- Scoped (default): only events that originate inside the topicmap viewport are forwarded.
- Ambient (opt-in): page-level listeners are enabled, but with guard rails.

Ambient mode behavior:

- Shows a badge in the viewport: "Ambient ON — press Esc to return to Scoped".
- Pressing `Esc` exits Ambient and returns to Scoped.
- A click on the badge also returns to Scoped.
- Events are ignored when the target matches excluded selectors.

Exclusions include built-ins plus your own selectors:

- Built-ins: `input`, `textarea`, `select`, `[contenteditable=""]`,
  `[contenteditable="true"]`, `.page`, `.editor`
- Custom: pass `excludes: []` when creating the controller

## Troubleshooting

- Missing module error:
  - Verify the bundle is loaded and that `window.Elm.AppEmbed` exists.
  - Run in the console:
    `window.Elm && window.Elm.AppEmbed && typeof window.Elm.AppEmbed.init === 'function'`
- Flags decode failures:
  - Ensure `flags.slug` and `flags.stored` are strings and that Elm decoders accept them.
- Stored JSON not parseable:
  - The plugin always sends a string. Confirm `stored` contains valid JSON and that your
    decoder treats it as a JSON string (default is `"{}"`).
- Bundle path not loading:
  - Confirm `ELM_BUNDLE` is correct and the file is accessible at that URL.

## License

MIT
