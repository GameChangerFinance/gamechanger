import { EncodingHandler } from '../types'

const handler: EncodingHandler = {
  name: 'JSON-URL LZW',
  encoder: async (obj: any /*,_options?:any*/) => {
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.compress(obj)
  },
  decoder: async (msg: string /*,_options?:any*/) => {
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.decompress(msg)
  }
}

export default handler
