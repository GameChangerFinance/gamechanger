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
  //  $ npm install -s gamechanger
  // or
  //Install globally:
  //  $ npm install -g gamechanger
  //Run this file
  //  $ node <FILENAME>.js

  //Import if testing the library:
  //import { gc } from './dist/nodejs.js'
  // or
  //Import normally:
  import { gc } from 'gamechanger'

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
          
          '/':"hosted output file",
      }
      app.use('/dist', express.static(libPath))
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
      const url=await gc.encode.url({
        input:JSON.stringify(gcscript),
        apiVersion:${strProp(args?.apiVersion)},
        network:${strProp(args?.network)},
        encoding:${strProp(args?.encoding)},
        });
      serve({url,indexHtml:\`<html><a href="/url">Click to get redirected to connect with GameChanger Wallet</a></html>\`})
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
