import { EncodingHandler } from '../types'
//import jsonUrl from 'json-url/dist/browser/json-url-single'
//import jsonUrl from 'json-url/dist/node/index'
//import lzmaCodec from 'json-url/dist/node/codecs/lzma'
//const lzmaCodec = jsonUrl.default('lzma')

//JSON-URL:
//Very hard to dual import for browser and node at the same time
// const handler: EncodingHandler = {
//   name: 'JSON-URL LZMA',
//   encoder: async (obj: any /*,_options?:any*/) => {
//     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
//     const lzmaCodec = jsonUrl('lzma')
//     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
//     return lzmaCodec.compress(obj)
//   },
//   decoder: async (msg: string /*,_options?:any*/) => {
//     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
//     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
//     const lzmaCodec = jsonUrl('lzma')
//     return lzmaCodec.decompress(msg)
//   }
// }
//import URLSafeBase64 from 'urlsafe-base64'
import * as URLSafeBase64 from '../modules/urlsafe-base64'
import { Buffer } from 'buffer'

//In-House:
const handler: EncodingHandler = {
  name: 'JSON-URL LZMA',
  encoder: async (obj: any /*,_options?:any*/) => {
    // const lzmaLib = await import(
    //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
    // )
    // // this special condition is present because the web minified version has a slightly different export
    // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
    const lzmaCodec = await import('../modules/lzma').then((d) => d.default())
    // we use exact algorithm and libs as in json-url
    const packed = JSON.stringify(obj)
    const compressed = await lzmaCodec.compress(packed)
    //const encoded = (await import(/* webpackChunkName: "'urlsafe-base64" */ 'urlsafe-base64')).encode(compressed);
    const encoded = URLSafeBase64.encode(Buffer.from(compressed))
    // console.log({
    //   packed,
    //   compressed,
    //   encoded,
    //   altern: Buffer.from(compressed).toString('base64')
    // })
    return encoded
  },
  decoder: async (msg: string /*,_options?:any*/) => {
    // const lzmaLib = await import(
    //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
    // )
    // // this special condition is present because the web minified version has a slightly different export
    // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
    const lzmaCodec = await import('../modules/lzma').then((d) => d.default())
    // we use exact algorithm and libs as in json-url
    const decoded = URLSafeBase64.decode(msg)
    const decompressed = await lzmaCodec.decompress(decoded)
    const unpacked = JSON.parse(decompressed)
    return unpacked
  }
}

export default handler
