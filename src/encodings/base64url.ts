import { EncodingHandler } from '../types'

import safeJSONStringify from 'json-stringify-safe'
//import URLSafeBase64 from 'urlsafe-base64'
import * as URLSafeBase64 from '../modules/urlsafe-base64'
import { Buffer } from 'buffer'

const handler: EncodingHandler = {
  name: 'URL Safe Base64',
  encoder: (obj: any /*,_options?:any*/) => {
    // const safeJSONStringify = require('json-stringify-safe')
    // const URLSafeBase64 = require('urlsafe-base64')
    return Promise.resolve(
      URLSafeBase64.encode(Buffer.from(safeJSONStringify(obj), 'utf-8'))
    )
  },
  decoder: (msg: string /*,_options?:any*/) => {
    return Promise.resolve(
      JSON.parse(URLSafeBase64.decode(msg).toString('utf-8'))
    )
  }
}

export default handler
