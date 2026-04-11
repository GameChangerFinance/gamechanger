# Examples

These example files are meant for local exploration of the library and CLI
outputs.

## Quick start

Install dependencies and build the library:

```bash
npm install
npm run build
```

Serve the examples locally to run web based examples:

```bash
$ npm run examples
```

To run the backend example and consume it's endpoints:

```bash
$ npm run examples:express

```

Then open:

- `http://127.0.0.1:3000/examples/index.html` (kitchen sink dapp)
- `http://127.0.0.1:3000/examples/htmlDapp.html`
- `http://127.0.0.1:3000/examples/htmlZeroDapp.html`
- `http://127.0.0.1:3000/examples/reactDapp.html`

## What is `examples/res/`?

`examples/res/` is a convenience copy of the current root `dist/` folder. It is
refreshed by `scripts/postbuild.mjs` after builds so the example HTML files can
be opened and tested from the `examples/` folder without changing their import
paths.

For real projects, prefer installing and importing the package normally:

```bash
npm install -s @gamechanger-finance/gc
```

Browser/CDN usage:

```html
<script src="https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc/dist/browser.min.js"></script>
```

Node / bundlers:

```js
import gc from '@gamechanger-finance/gc'
import type { NetworkType } from '@gamechanger-finance/gc/types'
```

## Network Router and referral features

The kitchen sink example also exposes the handler-only URL options:

- `refAddress`: appends `ref=<address>` to generated wallet URLs and QRs
- `disableNetworkRouter`: when enabled, skips the default `networkTag=<network>`
  query string

Those options are applied by the handlers. The lower-level encoders remain
generic.

## Files

- `connect.gcscript`: a simple intent to showcase GCScript DSL in order to
  connect a user wallet. This is the default sample script used by all the
  examples
- `index.html`: Kitchen Sink dapp> 100% in-browser playground for testing ALL
  the library outputs, including html, html-zero, react, button, URL, QR, and
  express
- `htmlDapp.html`: multi-intent HTML example with shared app state and
  auto-rendered intent argument UI
- `htmlZeroDapp.html`: zero-dependency resilient HTML example for offline-ready
  and small-footprint deployments.
- `reactDapp.html`: multi-intent React example with shared app state and
  auto-rendered intent argument UI
- `expressBackend.js`: minimal Node/Express backend example
- `button.html`: minimal button HTML fragment redirecting users to the intent
  URL
- `QR.png`: Intent URL encoded as a QR code
- `QR.svg`: Intent URL encoded as a QR code
- `URL.txt`: Intent URL in plain text

## Snippet flavors

- `html-zero`: highly resilient, offline-ready, small-footprint frontend
  intended for on-chain storage, and mission-critical use cases with no external
  runtime imports
- `html`: richer HTML boilerplate with shared app state, multiple actions, and
  dynamic UI generation from intent code
- `react`: richer React boilerplate with shared app state, multiple actions, and
  dynamic UI generation from intent code
- `express`: minimal Node/Express backend example
