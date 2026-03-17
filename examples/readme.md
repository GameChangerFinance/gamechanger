# Examples

These example files are meant for local exploration of the library and CLI
outputs.

## Quick start

Install dependencies and build the library:

```bash
npm install
npm run build
```

Serve the examples locally:

```bash
npm run examples:serve
```

Then open:

- `http://127.0.0.1:3000/examples/reactKitchenSink.html`
- `http://127.0.0.1:3000/examples/htmlDapp.html`
- `http://127.0.0.1:3000/examples/reactDapp.html`

Or run the convenience command that builds first and then starts the server:

```bash
npm run examples:kitchen-sink
```

## What is `examples/dist/`?

`examples/dist/` is a convenience copy of the current root `dist/` folder. It is
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

## Files

- `reactKitchenSink.html`: all-in-one browser playground for the public library
  outputs
- `htmlDapp.html`: minimal HTML integration example
- `reactDapp.html`: minimal React integration example
- `expressBackend.js`: minimal Node/Express backend example
- `connect.gcscript`: default sample script used by the kitchen sink example
