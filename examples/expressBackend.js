//#!/usr/bin/env node

//Install on project:
//  $ npm install -s @gamechanger-finance/gc
// or
//Install globally:
//  $ npm install -g @gamechanger-finance/gc
//Run this file
//  $ node <FILENAME>.js

//Import if testing the library:
import { gc, encodings } from '../dist/nodejs.cjs'
// or
//Import normally:
//import { gc,encodings } from '@gamechanger-finance/gc/dist/nodejs.cjs'

import express from 'express'

const gcscript = {
  type: 'script',
  title: '🚀 Connect with dapp?',
  description:
    'About to share your public wallet information and a CIP-8 signature to verify this data',
  exportAs: 'connect',
  run: {
    data: {
      type: 'script',
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
          run: "{getAddressInfo(get('cache.data.address'))}"
        },
        agreement: {
          type: 'macro',
          run: "{replaceAll('Myself, the user of wallet ADDRESS accepts to share all this information in order to connect with the dapp','ADDRESS',get('cache.data.address'))}"
        },
        salt: {
          type: 'macro',
          run: '{uuid()}'
        }
      }
    },
    hash: {
      type: 'macro',
      run: "{sha512(objToJson(get('cache.data')))}"
    },
    sign: {
      type: 'signDataWithAddress',
      address: "{get('cache.data.address')}",
      dataHex: "{get('cache.hash')}"
    }
  }
}

export const serve = ({
  indexHtml,
  url,
  host = 'localhost',
  port = 3000,
  libPath = 'dist'
}) => {
  const app = express()
  const routeDescriptions = {
    '/dist': 'Gamechanger library files',
    '/returnURL': 'Endpoint to receive exported data back from the wallet'
  }
  app.use('/dist', express.static(libPath))
  app.get('/returnURL', async (req, res) => {
    const resultRaw = req.query.result
    const resultObj = await encodings.msg.decoder(resultRaw)
    //If worried about privacy or user wallet authentication use CIP-8 and or encryption GCScript features
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(resultObj, null, 2))
  })
  if (url) {
    app.get('/url', (req, res) => {
      res.status(301).redirect(url)
    })
    routeDescriptions['/url'] = 'redirects user to dapp connection URL'
  }
  if (indexHtml) {
    app.get('/', (req, res) => {
      res.send(indexHtml)
    })
    routeDescriptions['/'] = 'Minimal home'
  }
  app.listen(port, () => {
    console.info(
      `\n\n🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://${host}:${port}/\n`
    )
    console.info('Routes:')
    Object.entries(routeDescriptions).map(([route, description]) => {
      console.info(`	${route}: 	${description}`)
    })
    console.info('\n\n')
  })
}

export const main = async () => {
  const host = 'localhost'
  const port = 3000

  //GameChanger Wallet support arbitrary data returning from script execution, encoded in a redirect URL
  const patchedGCScript = {
    ...gcscript,
    returnURLPattern: `http://${host}:${port}/returnURL/`
  }
  const url = await gc.encode.url({
    input: JSON.stringify(patchedGCScript, null, 2),
    apiVersion: '2',
    network: 'mainnet',
    encoding: 'gzip'
  })
  const indexHtml = `<html><a href="/url">Click to get redirected to connect with GameChanger Wallet</a></html>`
  serve({
    host,
    port,
    url,
    indexHtml
  })
}

main()
