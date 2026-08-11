# cdp-web

A retro computing themed node graph front-end for
[`cdp-wasm`](https://github.com/olilarkin/cdp-wasm) engine. Also
serves as the UI for [cdp-plugin](https://github.com/cdp-wasm-suite/cdp-plugin)
and [cdp-extension](https://github.com/cdp-wasm-suite/cdp-extension).

Based on the algorithms and documentation of the
[Composer's Desktop Project](https://www.composersdesktop.com/).

Embeds the [FAUST compiler](https://github.com/grame-cncm/faustwasm) for 
custom DSP nodes.

<img width="636" height="372" alt="cdp-web screenshot" src="https://raw.githubusercontent.com/cdp-wasm-suite/cdp-web/main/img/gem.jpg" />

## Running it locally

All runtime dependencies are committed under `vendor/`, so a bare clone can
build and run the app with no install step:

```sh
npm run build        # assembles the site into dist/pages/ from vendor/
npx serve dist/pages # or any static file server
```

### Development

`npm run serve` runs the app in place with a live dev server. It reads from
`node_modules/`, so it needs `npm install` first — which requires the sibling
`file:` package `../cdp-wasm` checked out alongside this repo, and a GitHub
Packages read token for `@cdp-wasm-suite/cdp-sampler` (see `.npmrc`).

```sh
npm install
npm run serve # http://localhost:8000/  (pass a port: node serve.mjs 3000)
```

## AI agent tools (WebMCP)

The app registers 14 [WebMCP](https://github.com/webmachinelearning/webmcp)
tools on `document.modelContext`, so a browser-side AI agent can co-author the
patch with you on the same live canvas: inspect the graph and the ~250-effect
catalog, add/cable/edit nodes incrementally, load audio and render — while you
watch, tweak and undo. See `src/core/webmcp-tools.js` for the tool list.

Status: behind `chrome://flags/#enable-webmcp-testing` (Chrome 146+); a Chrome
origin trial runs from 149 (token placeholder in `index.html`); expected to
ship around Chrome 157. Standalone browser/PWA only — never registered inside
the plugin/extension WebViews.

Any other browser can join in through the optional
[MCP-B](https://mcp-b.ai/) bridge, which makes the tab an MCP server for
external clients (e.g. Claude with the MCP-B extension):

1. Install the MCP-B browser extension.
2. Open `https://cdp-web.app/?webmcp=bridge` (or set
   `localStorage['cdp-webmcp'] = 'bridge'` to keep it on).
3. The tab appears as an MCP server named after the page — connect your client
   to it and the 14 tools are available.

Privacy: tools only ever return patch structure and audio *metadata* (duration,
channels, sample rate) — never audio bytes. Nothing loads and nothing is
announced unless you opt in; the 390 KB bridge script is fetched only in bridge
mode.

## The npm package

`npm run bundle` assembles a self-contained embeddable build in `dist/bundle/`
(from `node_modules/` when the siblings are installed, else from the committed
`vendor/` snapshot). That directory is published as
[`@cdp-wasm-suite/cdp-web`](https://github.com/orgs/cdp-wasm-suite/packages)
on GitHub Packages by `.github/workflows/publish.yml` (on release, or run it
manually) — bump `version` in `package.json` first. The engine lives at
`vendor/` inside the package (npm strips `node_modules/` when packing) and all
runtime references are rewritten to match.

[cdp-plugin](https://github.com/cdp-wasm-suite/cdp-plugin) (via
`scripts/fetch-web-dist.sh`) and
[cdp-extension](https://github.com/cdp-wasm-suite/cdp-extension) (as a regular
npm dependency) consume this package instead of vendoring built assets.
Installing from GitHub Packages needs a token with `read:packages`, even for
public packages.

## Vendored dependencies

Each keeps its own license; none of them are covered by this repo's AGPL.

- **`cdp-wasm`** — LGPL-2.1-or-later. The `*.wasm` modules are
  compiled from CDP8, © 1983–2023 Trevor Wishart, Richard Dobson, Martin Atkins
  and Composers Desktop Project Ltd; the Emscripten loader glue is MIT and the
  JS API/catalog is MIT. See `vendor/cdp-wasm/wasm/LICENSE` (note
  that its "repository root LICENSE" reference points at the *cdp-wasm* repo,
  not this one).
- **`@cdp-wasm-suite/cdp-sampler`** — LGPL-2.1-or-later.
- **`@grame/faustwasm`** — LGPL, © GRAME-CNCM.
- **`monaco-editor`** — MIT.
- **`@mcp-b/global`** — MIT. WebMCP bridge, loaded only in `?webmcp=bridge` mode.

## License

AGPL-3.0-or-later — see [`LICENSE`](LICENSE).

Copyright [Oliver Larkin](https://www.olilarkin.com/) 2026.

The AGPL covers this repository's own work: `index.html`, `src/`, `scripts/`,
`recipes/`, and the design assets. If you run a modified cdp-web over a network,
§13 requires you to offer your users the corresponding source of your version —
the About dialog carries the source link that satisfies this, so keep it working
and pointed at *your* fork if you publish one.

The vendored components above are separate works under their own (LGPL/MIT)
terms and are used as libraries, not merged into the AGPL'd code. They stay
independently replaceable in `vendor/`, which is what LGPL §6 / §4 requires. The
AGPL applies to the combined distribution; it does not and cannot relicense
them.

Fonts under `fonts/` and the CDP documentation that `manual.json` is generated
from carry their own terms — see `fonts/atari-st-LICENSE.txt` and
[composersdesktop.com](https://www.composersdesktop.com/).

[`EXCEPTIONS.md`](EXCEPTIONS.md) records the standing grants made on that basis.

