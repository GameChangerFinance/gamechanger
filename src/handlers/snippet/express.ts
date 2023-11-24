import { APIEncoding, APIVersion, NetworkType } from '../../types'
import { validateBuildMsgArgs } from '../../utils'
const baseTemplate = async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
}) => {
  const strProp = (str?: string) =>
    str === undefined ? 'undefined' : JSON.stringify(str)
  return `
  //#!/usr/bin/env node

  //Install on project:
  //  $ npm install -s @gamechanger-finance/gc
  // or
  //Install globally:
  //  $ npm install -g @gamechanger-finance/gc
  //Run this file
  //  $ node <FILENAME>.js

  //Import if testing the library:
  //import gc from '../dist/nodejs.cjs'
  // or
  //Import normally:
  import gc from '@gamechanger-finance/gc/dist/nodejs.cjs'

  import express from 'express';
  
  const gcscript=${args.input};
  
  export const serve = ({
      indexHtml,
      url,
      host = 'localhost',
      port = 3000,
      libPath = 'dist'
    }) => {
      const app = express()
      const routeDescriptions={
          '/dist':"Gamechanger library files",
          '/returnURL':"Endpoint to receive exported data back from the wallet",
      }
      app.use('/dist', express.static(libPath))
      app.get('/returnURL', async (req, res) => {
        const resultRaw = req.query.result;
        const resultObj = await gc.encodings.msg.decoder(resultRaw);
        //If worried about privacy or user wallet authentication use CIP-8 and or encryption GCScript features
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(resultObj,null,2));
      });
      if(url){
          app.get('/url', (req, res) => {
              res.status(301).redirect(url);
          });
          routeDescriptions['/url']="redirects user to dapp connection URL";
      }
      if(indexHtml){
          app.get('/', (req, res) => {
          res.send(indexHtml)
          });
          routeDescriptions['/']="Minimal home";
      }
      app.listen(port, () =>{
        console.info(
          \`\\n\\n🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://\${host}:\${port}/\\n\`
        );
        console.info("Routes:")
        Object.entries(routeDescriptions).map(([route,description])=>{
          console.info(\`\t\${route}: \t\${description}\`)
        });
        console.info("\\n\\n")
      })
    }
  
  export const main= async()=>{
    const host="localhost"
    const port=3000

    //GameChanger Wallet support arbitrary data returning from script execution, encoded in a redirect URL
    const patchedGCScript={
        ...gcscript,
        returnURLPattern:\`http://\${host}:\${port}/returnURL/\`
    }
      const url=await gc.encode.url({
        input:JSON.stringify(patchedGCScript,null,2),
        apiVersion:${strProp(args?.apiVersion)},
        network:${strProp(args?.network)},
        encoding:${strProp(args?.encoding)},
        });
      const indexHtml=\`<html><a href="/url">Click to get redirected to connect with GameChanger Wallet</a></html>\`
      serve({
          host,
          port,
          url,
          indexHtml
      })

  }
  
  main();
`
}

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
}) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)

    const text = await baseTemplate({
      apiVersion,
      network,
      encoding,
      input
    })
    return `data:application/javascript;base64,${Buffer.from(text).toString(
      'base64'
    )}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
