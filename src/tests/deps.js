import { Buffer } from 'buffer'
import safeJSONStringify from 'json-stringify-safe'
//import URLSafeBase64 from 'urlsafe-base64'
import * as URLSafeBase64 from '../modules/urlsafe-base64'
import pako from 'pako'
//import jsonUrl from 'json-url/dist/browser/json-url-single'
import template from 'string-placeholder'

// import logoURL from '../assets/images/dapp-logo-bg.png'
// import backgroundURL from '../assets/images/background.png'
// import fontURL from '../assets/fonts/ABSTRACT.ttf'

/**
 * It has been very hard to allow dual support for browser and nodejs due to dependencies conflicts.
 * This is un ugly unified test for now, should be improved
 */
export default async () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  console.info(
    `Running dependencies test on '${isNode ? 'nodejs' : 'browser'}'`
  )
  console.log({ Buffer })
  console.log({ safeJSONStringify })
  console.log({ safeJSONStringify })
  console.log({ URLSafeBase64 })
  console.log({ pako })

  //   const jsonUrl = await import('json-url/dist/node/loaders').then(
  //     (d) => d.default
  //   )
  //   console.log({ jsonUrl })
  //   const lzwCodec = await jsonUrl['lzw']()
  //   const lzmaCodec = await jsonUrl['lzma']()

  //const jsonUrl = await import('json-url').then((d) => d.default)
  const jsonUrl = await import('../modules/json-url')
    .then((d) => d.default())
    .catch((err) => {
      console.error(err)
      return undefined
    })

  const lzwCodec = jsonUrl('lzw') //jsonUrl ? jsonUrl('lzw') : undefined
  console.log({ lzwCodec })

  //const lzmaCodec = jsonUrl('lzma')
  //   const lzmaLib = await import('lzma/src/lzma_worker.js')
  //   //const lzmaLib = await import('lzma')
  //   console.log({ lzmaLib })
  //   const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
  const lzmaCodec = await import('../modules/lzma').then((d) => d.default())
  console.log({ lzmaCodec })
  //const template = await import('string-placeholder').then((d) => d.default)
  //const template = require('string-placeholder')

  console.log({ template })

  console.log({
    Buffer: Buffer.from('Hello').toString('hex'),
    safeJSONStringify: safeJSONStringify({ foo: 'bar' }),
    URLSafeBase64: URLSafeBase64.encode(Buffer.from('Hello')),
    pako: Buffer.from(
      pako.gzip(Buffer.from(safeJSONStringify({ foo: 'bar' }), 'utf-8'))
    ).toString('hex'),
    lzwCodec: jsonUrl
      ? await lzwCodec.compress({ foo: 'bar' })
      : 'disabled due to an error', //It is expected to fail for now

    lzmaCodec: URLSafeBase64.encode(
      Buffer.from(await lzmaCodec.compress({ foo: 'bar' }))
    ),
    template: template(
      'hello {word}',
      { word: 'world' },
      {
        before: '{',
        after: '}'
      }
    )
    // logoURL, //: await import('./assets/images/dapp-logo-bg.png'),
    // backgroundURL, //: await import('./assets/images/background.png')
    // fontURL
  })

  return 'OK'
}
