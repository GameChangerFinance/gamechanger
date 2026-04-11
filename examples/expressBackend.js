
//#!/usr/bin/env node

//Install on project:
//  $ npm install -s @gamechanger-finance/gc
// or
//Install globally:
//  $ npm install -g @gamechanger-finance/gc
//Run this file
//  $ node <FILENAME>.js

//Import if testing the library from this repository:
//import gc from './res/nodejs.js'
// or
//Import normally:
import gc from '@gamechanger-finance/gc'
import express from 'express';

const gcscript={
  "type": "script",
  "title": "🚀 Connect with dapp?",
  "description": "About to share to the dapp your public wallet information and a CIP-8 signature to verify ownership",
  "exportAs": "connect",
  "return": {
    "mode": "last"
  },
  "run": {
    "data": {
      "type": "script",
      "run": {
        "name": {
          "type": "getName"
        },
        "address": {
          "type": "getCurrentAddress"
        },
        "addressInfo": {
          "type": "macro",
          "run": "{getAddressInfo(get('cache.data.address'))}"
        },
        "agreement": {
          "type": "macro",
          "run": "{replaceAll('Myself, the user of wallet ADDRESS accepts to share all this information in order to connect with the dapp','ADDRESS',get('cache.data.address'))}"
        },
        "salt": {
          "type": "macro",
          "run": "{uuid()}"
        }
      }
    },
    "hash": {
      "type": "macro",
      "run": "{sha512(objToJson(get('cache.data')))}"
    },
    "sign": {
      "type": "signDataWithAddress",
      "address": "{get('cache.data.address')}",
      "dataHex": "{get('cache.hash')}"
    },
    "finally": {
      "type": "macro",
      "run": {
        "name": "{get('cache.data.name')}",
        "address": "{get('cache.data.address')}",
        "addressInfo": "{get('cache.data.addressInfo')}",
        "signature": "{get('cache.sign')}",
        "hash": "{get('cache.hash')}"
      }
    }
  }
};

export const serve = function (options) {
  const indexHtml = options.indexHtml;
  const url = options.url;
  const host = options.host || 'localhost';
  const port = options.port || 3000;
  const libPath = options.libPath || 'dist';
  const app = express();
  const routeDescriptions = {
    '/dist': 'Gamechanger library files',
    '/returnURL': 'Endpoint to receive exported data back from the wallet'
  };

  app.use('/dist', express.static(libPath));
  app.get('/returnURL', async function (req, res) {
    const resultRaw = req.query.result;
    const resultObj = await gc.encodings.msg.decoder(resultRaw);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(resultObj, null, 2));
  });

  if (url) {
    app.get('/url', function (req, res) {
      res.status(301).redirect(url);
    });
    routeDescriptions['/url'] = 'redirects user to dapp connection URL';
  }

  if (indexHtml) {
    app.get('/', function (req, res) {
      res.send(indexHtml);
    });
    routeDescriptions['/'] = 'Minimal home';
  }

  app.listen(port, function () {
    console.info('\n\n🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://' + host + ':' + port + '/\n');
    console.info('Routes:');
    Object.entries(routeDescriptions).forEach(function (entry) {
      console.info('\t' + entry[0] + ': \t' + entry[1]);
    });
    console.info('\n\n');
  });
};

export const main = async function () {
  const host = 'localhost';
  const port = 3000;
  const patchedGCScript = Object.assign({}, gcscript, {
    returnURLPattern: 'http://' + host + ':' + port + '/returnURL/'
  });
  const url = await gc.encode.url({
    input: JSON.stringify(patchedGCScript, null, 2),
    apiVersion: "2",
    network: "mainnet",
    encoding: "gzip",
    refAddress: undefined,
    disableNetworkRouter: false,
    urlPattern: undefined
  });
  const indexHtml = '<html><a href="/url">Click to get redirected to connect with GameChanger Wallet</a></html>';
  serve({
    host: host,
    port: port,
    url: url,
    indexHtml: indexHtml
  });
};

main();
