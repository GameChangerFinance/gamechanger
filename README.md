[![](https://data.jsdelivr.com/v1/package/npm/@gamechanger-finance/gc/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@gamechanger-finance/gc)

![Build with us, a great future await us together](src/assets/images/dapp-cli-banner.png?raw=true)

# GameChanger Wallet Library and CLI

Official GameChanger Wallet library and CLI for integrating with Cardano dapps
and solve other tasks (https://gamechanger.finance/)

> Complete new project now compatible with GameChanger Wallet V2 and keeping
> some support for legacy GameChanger V1

## Example CLI/Library outputs:

- [URL](examples/URL.txt)
- [QR (png)](examples/QR.png)
- [QR (svg)](examples/QR.svg)
- [Button](examples/button.html)
- [HTML5 Dapp](examples/htmlDapp.html)
- [ReactJs Dapp](examples/reactDapp.html)
- [ExpressJs Backend](examples/expressBackend.js)

## Install CLI

```
$ npm install --global @gamechanger-finance/gc
```

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
  copy host individual file 'dist/browser.min.js'

Load locally:
  <script src='dist/browser.min.js'></script>

Load using CDN :
  <script src="https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc/dist/browser.min.js"></script>

Use:
  const {gc} = window;
```

### For webpack projects like using create-react-app:

```
Install:
  $ npm install -s @gamechanger-finance/gc
Use:
  import gc from '@gamechanger-finance/gc'

```

## Library usage:

### Encode dapp connection (dapp -> wallet message):

```javascript

//GCScript: the DSL scripting language to interact with GameChanger Wallet
const gcscript={
    "type": "script",
    "title":"🚀 Connect with dapp?",
    "description":"About to share your basic public wallet information to the dapp",
    "exportAs": "connect",
    "run": {
        "name": {
                "type": "getName"
        },
        "address": {
                "type": "getCurrentAddress"
        },
        "spendPubKey": {
                "type": "getSpendingPublicKey"
        },
        "stakePubKey": {
                "type": "getStakingPublicKey"
        },
        "addressInfo": {
                "type": "macro",
                "run": "{getAddressInfo(get('cache.data.address'))}"
        }
    }
}

const url = await gc.encode.url({
        input: JSON.stringify(gcscript), // GCScript is pure JSON code, supported on all platforms
        apiVersion: '2', //APIV2
        network: 'mainnet', // mainnet or preprod
        encoding: 'gzip' //suggested, default message encoding/compression 
});
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
        qrResultType: 'png',
});
```

then redirect users with the QR code like:

```html
<image src="${pngDataURI}">Scan QR code to connect</image>
```

### Decode dapp connection results (wallet -> dapp message):

```javascript
//GCWallet dapp connections can return arbirary JSON data you exported from the DSL code
const resultObj = await gc.encodings.msg.decoder(resultRaw)
console.log(resultObj); 

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
        },
    }
  }
}
```

## CLI Usage

```

Usage
        $ gamechanger-cli [network] [action] [subaction]

Networks: 'mainnet' | 'preprod'

Actions:
        'encode':
                'url'     : generates a ready to use URL dApp connector from a valid GCScript
                'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
        'snippet':
                'html'    : generates a ready to use HTML dApp with a URL connector from a valid GCScript
                'button'  : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
                'express' : generates a ready to use Node JS Express backend that redirects browser users to connect with the wallet, from a valid GCScript
                'react'   : generates a ready to use React dApp with a URL connector from a valid GCScript
Options:
        --args [gcscript] | -a [gcscript]:  Load GCScript from arguments

        --file [filename] | -a [filename]:  Load GCScript from file
        without --args or --file         :  Load GCScript from stdin

        --outputFile [filename] -o [filename]:  The QR Code, HTML, button, nodejs, or react output filename
        without --outputFile                 :  Sends the QR Code, HTML, button, nodejs, or react output file to stdin

        --apiVersion [1 | 2] | -v [1 | 2]:  Target GameChanger Wallet v1 or v2

        --encoding [see encodings below] | -v [see encodings below]:  Target GameChanger Wallet v1 or v2 messaging encodings
        Valid encodings by apiVersion:
        {"1":["json-url-lzw"],"2":["json-url-lzma","gzip","base64url"]}

        --template [see templates below] | -t [see templates below]: QR code predefined styles
        Valid templates: default, boxed or printable

        --serve | -S : Serve code snippet outputs on http://localhost:3000

Examples

        URL and QR Code encodings:
        URL APIv1:
                $ gamechanger-cli preprod encode url -v 1 -a '{"type":"tx","title":"Demo","description":"created with gamechanger-cli","metadata":{"123":{"message":"Hello World!"}}}'
                https://preprod-wallet.gamechanger.finance/api/1/tx/...

                $ cat demo.gcscript | gamechanger-cli mainnet encode url -v 1
                https://wallet.gamechanger.finance/api/1/tx/...

        URL APIv2
                $ gamechanger-cli mainnet encode url -v 2 -f examples/connect.gcscript
                https://beta-wallet.gamechanger.finance/api/1/run/...

        QR APIv1:
                $ gamechanger-cli preprod encode qr -v 1 -a '{"type":"tx","title":"Demo","description":"created with gamechanger-cli","metadata":{"123":{"message":"Hello World!"}}}' > qr_output.png

                $ gamechanger-cli mainnet encode qr -v 1 -o examples/qr_output.png -a '{"type":"tx","title":"Demo","description":"created with gamechanger-cli","metadata":{"123":{"message":"Hello World!"}}}'

        QR APIv2:
                $ gamechanger-cli mainnet encode qr -e gzip  -v 2 -f examples/connect.gcscript -o examples/qr_output.png


        Code snippet generation and serve dapp (-S):

        HTML:
                $ gamechanger-cli preprod snippet html -v 2 -S -o examples/htmlDapp.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        ReactJS:
                $ gamechanger-cli mainnet snippet react -v 2 -S -o examples/reactDapp.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        HTML Button snippet:
                $ gamechanger-cli mainnet snippet button -v 2 -S -o examples/connectButton.html -f examples/connect.gcscript
                🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

        Express Backend:
                $ gamechanger-cli mainnet snippet express -v 2 -o examples/expressBackend.js -f examples/connect.gcscript
                $ node examples/expressBackend.js
                🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://localhost:3000/

```

## Resources

- [Beta Release Notes](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/RELEASE.md)
- [70+ open source example dapps](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/examples/README.md)
- [Universal Dapp Connector documentation](https://github.com/GameChangerFinance/gamechanger.wallet/blob/main/DAPP_CONNECTOR.md)
- [GCScript documentation](https://beta-wallet.gamechanger.finance/doc/api/v2/api.html)
- [Playground IDE in GameChanger Wallet ](https://beta-wallet.gamechanger.finance/playground)
- [Youtube Tutorials](https://www.youtube.com/@gamechanger.finance)
- [Discord Support](https://discord.gg/vpbfyRaDKG)
- [Twitter News](https://twitter.com/GameChangerOk)
- [Website](https://gamechanger.finance)

## License

MIT
