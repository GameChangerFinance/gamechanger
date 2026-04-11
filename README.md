[![](https://data.jsdelivr.com/v1/package/npm/@gamechanger-finance/gc/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@gamechanger-finance/gc)

![Build with us, a great future await us together](src/assets/images/dapp-logo-bg.png?raw=true)

# GameChanger Wallet Library and CLI

Official GameChanger Wallet library and CLI for integrating Cardano via intents
in links, QRs, dapps, web, screens, social media and solve other related tasks
(https://gamechanger.finance/)

> Complete refactor for Node v24.x.x . Supports all GameChanger Wallet V2.x.x
> flavors

## Try it online:

[✨ Kitchen Sink Dapp ✨](https://gclib-kitchen-sink.netlify.app/)

- 100 % backend-less: (no special backend required)
- All the supported outputs formats for you to integrate or share
- All the supported code generation languages for you to integrate

## Example CLI/Library outputs:

To run web based examples:

```bash
$ npm run examples
```

To run the backend example:

```bash
$ npm run examples:express

```

- [Kitchen Sink - all outputs in one example](examples/index.html):
- [URL](examples/URL.txt)
- [QR (png)](examples/QR.png)
- [QR (svg)](examples/QR.svg)
- [Button](examples/button.html)
- [HTML5 Dapp](examples/htmlDapp.html)
- [HTML Zero Dapp](examples/htmlZeroDapp.html)
- [ReactJs Dapp](examples/reactDapp.html)
- [ExpressJs Backend](examples/expressBackend.js)

`html` and `react` outputs are richer shared-state app boilerplates with local
storage persistence that can host multiple actions (intent scripts coded in
GCScript DSL) in one dapp and auto-render end-user UI from the intent code
itself.

`html-zero` is the minimal zero-dependency flavor aimed at highly resilient,
offline-ready, small-footprint frontends for long term reliability that can be
stored on-chain with GCFS and work without any dependencies or centralized
points of failure.

`express` is a minimal Node/Express backend example that redirects browser users
to the wallet and then captures the response via "webhook" redirection.

Read more about examples [here](examples/README.md):

## Install CLI

```
$ npm install --global @gamechanger-finance/gc
```

Node target: `>=24.12.0`

## Install Library

```
$ npm install -s @gamechanger-finance/gc
```

## Import library on your projects:

### For importing on html document:

```
Install:
  $ npm install -s @gamechanger-finance/gc
    or
  copy or host individual file 'dist/browser.min.js'

Load locally:
  <script src='dist/browser.min.js'></script>

Load using CDN :
  <script src="https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc/dist/browser.min.js"></script>

Use:
  const {gc} = window;
```

### For Node.js / React / Vite / webpack projects:

```
Install:
  $ npm install -s @gamechanger-finance/gc
Use (ESM default export):
  import gc from '@gamechanger-finance/gc'
Use (ESM named exports):
  import {gc, encode, snippet, encodings} from '@gamechanger-finance/gc'
Use (CommonJS):
  const gc = require('@gamechanger-finance/gc')

Local repository build targets:
  import gc from './dist/nodejs.js'
  const gc = require('./dist/nodejs.cjs')

```

## Distribution targets

Published artifacts kept for npm and CDN usage:

- `dist/browser.js`
- `dist/browser.min.js`
- `dist/nodejs.cjs`
- `dist/nodejs.js`

Package entrypoints:

- ESM / Node: `import gc from "@gamechanger-finance/gc"`
- CommonJS / Node: `const gc = require("@gamechanger-finance/gc")`
- Browser global: `const {gc} = window`

The Node and CLI QR path no longer depends on `canvas` / `easyqrcodejs-nodejs`
at install time. Styled QR output is generated from EasyQRCodeJS SVG output and
rasterized on Node only when PNG output is requested.

## Library usage:

### Encode dapp intent (dapp -> wallet message):

```javascript
//GCScript: the DSL scripting language to interact with GameChanger Wallet
const gcscript = {
  type: 'script',
  title: '🚀 Connect with dapp?',
  description:
    'About to share your basic public wallet information to the dapp',
  exportAs: 'connect',
  run: {
    name: {
      type: 'getName'
    },
    address: {
      type: 'getCurrentAddress'
    },
    spendPubKey: {
      type: 'getSpendingPublicKey'
    },
    stakePubKey: {
      type: 'getStakingPublicKey'
    },
    addressInfo: {
      type: 'macro',
      run: "{getAddressInfo(get('cache.address'))}"
    }
  }
}

const url = await gc.encode.url({
  input: JSON.stringify(gcscript), // GCScript is pure JSON code, supported on all platforms
  apiVersion: '2', //APIV2
  network: 'mainnet', // mainnet or preprod
  encoding: 'gzip', //suggested, default message encoding/compression
  refAddress: 'addr1...', // optional - appends ref=<address>. For referral programs, a valid Cardano address under the same `network`
  disableNetworkRouter: false // optional - by default appends networkTag=<network>. Allows to stop requesting the user to switch to the network specified in
})
```

then redirect users to the URL like:

```html
<a href="${url}">Connect with GC Wallet</a>
```

or render a QR encoded URL image like this:

```javascript
const pngDataURI = gc.encode.qr({
  input: JSON.stringify(gcscript),
  apiVersion: '2',
  network: 'mainnet',
  encoding: 'gzip',
  refAddress: 'addr1...', // optional - appends ref=<address>. For referral programs, a valid Cardano address under the same `network`
  disableNetworkRouter: false, // optional - by default appends networkTag=<network>. Allows to stop requesting the user to switch to the network specified in `network` tag
  qrResultType: 'png'
})
```

then redirect users with the QR code like:

```html
<image src="${pngDataURI}">Scan QR code to connect</image>
```

By default, `gc.encode.url(...)` and `gc.encode.qr(...)` handlers append
`networkTag=<network>` to generated wallet URLs. Set
`disableNetworkRouter: true` to skip that query string. When `refAddress` is
provided, handlers also append `ref=<address>` while preserving any query string
data already present in the base URL pattern.

### Decode intent execution results (wallet -> dapp message):

```javascript
//Once GC Wallet executes an intent script, it can return arbirary JSON data to be exported back to the dapp
const resultObj = await gc.encodings.msg.decoder(resultRaw)
console.log(resultObj)
```

and will log something like:

```json
{
  "exports": {
    "connect": {
      "name": "MyCardanoWallet",
      "address": "addr1q8aw6dzpw3cld828cqywp0sql4sxfw6syhzyh2kfcfccakddqwj2u3djrag0mene2cm9elu5mdqmcz9zc2rzgq7c5g6qshxn7l",
      "spendPubKey": {
        "pubKeyHex": "48362707efe478336740139127d8468aca10bf1358d2ab903d2d58876c99733b",
        "pubKeyHashHex": "faed34417471f69d47c008e0be00fd6064bb5025c44baac9c2718ed9",
        "derivationKind": "spend"
      },
      "stakePubKey": {
        "pubKeyHex": "9bef2297c79a52da05c33e99097e806e44ddda04e0dbaf7afef9274a64059557",
        "pubKeyHashHex": "cb6785612a53f5a093f38212db67bf4da23881d0fcf99518d02463a0",
        "derivationKind": "stake"
      },
      "addressInfo": {
        "isByron": false,
        "isReward": false,
        "isEnterprise": false,
        "isPointer": false,
        "isPaymentScript": false,
        "isStakingScript": false,
        "paymentScriptHash": "",
        "stakingScriptHash": "",
        "isScript": false,
        "kind": "base",
        "isCardano": true,
        "isShelley": true,
        "isBase": true,
        "isPaymentKey": true,
        "isStakingKey": true,
        "paymentKeyHash": "faed34417471f69d47c008e0be00fd6064bb5025c44baac9c2718ed9",
        "stakingKeyHash": "ad03a4ae45b21f50fde67956365cff94db41bc08a2c2862403d8a234",
        "rewardAddress": "stake1uxks8f9wgkep758aueu4vdjul72dksdupz3v9p3yq0v2ydqpd3mre",
        "network": "mainnet",
        "networkId": 1,
        "identity": {
          "scriptHex": "8201818200581cfaed34417471f69d47c008e0be00fd6064bb5025c44baac9c2718ed9",
          "scriptHash": "ddb4f2d0f44774964f57b444995e4a4a750d7b452a7177e739f8e21c",
          "scriptRefHex": "d818582582008201818200581cfaed34417471f69d47c008e0be00fd6064bb5025c44baac9c2718ed9"
        }
      }
    }
  }
}
```

### Important:

- "Connection intents" that share basic wallet information to dapps are the
  default sample script used in all examples here
- Connection intents like these are not mandatory: Intent-based dapps may not
  require to pre-connect in order to work!
- For simplicity sake these conection examples does not address:
  - signature validation
  - challenge validation
  - HTTP origin validation
  - nor encrypts comms beyond SSL against MITM attacks
- A highly secure connection intent could be added in the future (let us know
  your needs!)

## CLI Usage

```
✨ GameChanger Wallet CLI:
        Official GameChanger Wallet library and CLI for integrating it with Cardano dapps and solve other related tasks (https://gamechanger.finance/)

Usage
        $ gamechanger-cli [network] [action] [subaction]

Networks: 'mainnet' | 'preprod'

Actions:
        'encode':
                'url'     : generates a ready to use URL dApp connector from a valid GCScript
                'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
        'snippet':
                'html'      : generates a ready to use HTML dApp with shared app state, multi-intent UX, and auto-rendered intent argument UI from a valid GCScript
                'html-zero' : generates a highly resilient offline-ready zero-dependency HTML dApp for mission-critical and on-chain hosted frontends from a valid GCScript
                'button'    : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
                'express'   : generates a ready to use Node JS Express backend that redirects browser users to connect with the wallet, from a valid GCScript
                'react'     : generates a ready to use React dApp with shared app state, multi-intent UX, and auto-rendered intent argument UI from a valid GCScript
Options:
        --args [gcscript] | -a [gcscript]:  Load GCScript from arguments

        --file [filename] | -a [filename]:  Load GCScript from file
        without --args or --file         :  Load GCScript from stdin

        --outputFile [filename] -o [filename]:  The QR Code, HTML, html-zero, button, nodejs, or react output filename
        without --outputFile                 :  Sends the QR Code, HTML, html-zero, button, nodejs, or react output file to stdin

        --apiVersion [1 | 2] | -v [1 | 2]:  Target GameChanger Wallet v1 or v2

        --encoding [see encodings below] | -v [see encodings below]:  Target GameChanger Wallet v1 or v2 messaging encodings
        Valid encodings by apiVersion:
        {"2":["json-url-lzma","gzip","base64url"]}

        --template [see templates below] | -t [see templates below]: QR code predefined styles
        Valid templates: default, boxed or printable

        --serve | -S : Serve code snippet outputs on http://localhost:3000

        --refAddress [cardanoAddress] | -r [cardanoAddress]: Append ref=<address> to generated wallet URLs and QRs

        --disableNetworkRouter | -R : Do not append the default networkTag=<network> query string parameter

Examples

        ⭐ URL encoding:
                $ gamechanger-cli mainnet encode url -v 2 -f examples/connect.gcscript
                https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet

                $ gamechanger-cli mainnet encode url -v 2 -r addr1... -f examples/connect.gcscript
                https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet&ref=addr1...

                $ gamechanger-cli mainnet encode url -v 2 -a '{"title":"Get Address","description":"Do you authorize to share address to dapp?","type":"script","exportAs":"MyData","run":{"address":{"type":"getCurrentAddress"}}}'
                https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet

                $ cat examples/connect.gcscript | gamechanger-cli mainnet encode url -v 2
                https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet

        ⭐ QR encoding:
                $ gamechanger-cli preprod encode qr -v 2 -a '{"title":"Get Address","description":"Do you authorize to share address to dapp?","type":"script","exportAs":"MyData","run":{"address":{"type":"getCurrentAddress"}}}' > qr_output.png

                $ gamechanger-cli mainnet encode qr -v 2 -o examples/qr_output.png -a '{"title":"Get Address","description":"Do you authorize to share address to dapp?","type":"script","exportAs":"MyData","run":{"address":{"type":"getCurrentAddress"}}}'

                $ cat examples/connect.gcscript | gamechanger-cli mainnet encode qr -v 2 -o examples/qr_output.png


                $ gamechanger-cli mainnet encode qr -e gzip  -v 2 -f examples/connect.gcscript -o examples/qr_output.png


        Code generation and serve dapp (-S):

        ⭐ HTML code:
                $ gamechanger-cli preprod snippet html -v 2 -S -o examples/htmlDapp.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        ⭐ HTML Zero code:
                $ gamechanger-cli mainnet snippet html-zero -v 2 -S -o examples/htmlZeroDapp.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        ⭐ ReactJS code:
                $ gamechanger-cli mainnet snippet react -v 2 -S -o examples/reactDapp.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        ⭐ HTML Button snippet:
                $ gamechanger-cli mainnet snippet button -v 2 -S -o examples/connectButton.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        ⭐ Express backend code:
                $ gamechanger-cli mainnet snippet express -v 2 -o examples/expressBackend.js -f examples/connect.gcscript
                $ node examples/expressBackend.js
                🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://localhost:3000/



```

## Breaking Changes Notice

Generated code outputs are now much richer and complex than the ones produced
over the last years. For improvements and maintainance these may require more
internal breaking changes in their internal design, decoupling from the
versioning strategy of the actual library. If you need special treatment on
outputs let us know or consider forking for your use case.

## Resources

- [Beta Release Notes](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/RELEASE.md)
- [70+ open source example dapps](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/examples/README.md)
- [Universal Dapp Connector documentation](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/DAPP_CONNECTOR.md)
- [GCScript documentation](https://wallet.gamechanger.finance/doc/api/v2/api.html)
- [Playground IDE in GameChanger Wallet ](https://wallet.gamechanger.finance/playground)
- [Youtube Tutorials](https://www.youtube.com/@gamechanger.finance)
- [Discord Support](https://discord.gg/vpbfyRaDKG)
- [Twitter News](https://twitter.com/GameChangerOk)
- [Website](https://gamechanger.finance)

## License

MIT

## Development

```
npm install
npm run build
npm test
```
