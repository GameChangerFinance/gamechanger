[![](https://data.jsdelivr.com/v1/package/npm/@gamechanger-finance/gc/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@gamechanger-finance/gc)

![Build with us, a great future await us together](src/assets/images/dapp-cli-banner.png?raw=true)

# GameChanger Wallet Library and CLI

Official GameChanger Wallet library and CLI for integrating with Cardano dapps
and solve other tasks (https://gamechanger.finance/)

> Complete new project now compatible with GameChanger Wallet V2 and keeping
> some support for legacy GameChanger V1

## Install CLI

```
$ npm install --global @gamechanger-finance/gc
```

## Install Library

```
$ npm install -s @gamechanger-finance/gc
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

## Example CLI/Library outputs:

- [URL](examples/URL.txt)
- [QR (png)](examples/QR.png)
- [QR (svg)](examples/QR.svg)
- [Button](examples/button.html)
- [HTML5 Dapp](examples/htmlDapp.html)
- [ReactJs Dapp](examples/reactDapp.html)
- [ExpressJs Backend](examples/expressBackend.js)

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
  import {gc} from '@gamechanger-finance/gc'

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
