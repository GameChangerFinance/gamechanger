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
```

## Router and referral testing

The kitchen sink example also exposes the handler-only URL options:

- `refAddress`: appends `ref=<address>` to generated wallet URLs and QRs
- `disableNetworkRouter`: when enabled, skips the default `networkTag=<network>`
  query string

Those options are applied by the opinionated handlers. The lower-level encoders
remain generic.

## Files

- `index.html`: Kitchen Sink dapp> 100% in-browser playground for testing ALL
  the library outputs
- `htmlDapp.html`: minimal HTML integration example
- `reactDapp.html`: minimal React integration example
- `expressBackend.js`: minimal Node/Express backend example
- `connect.gcscript`: default sample script used by the kitchen sink example
