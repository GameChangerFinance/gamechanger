import { EncodingHandler } from '../types'

class JSONURLDeprecationError extends Error {
  code: string
  name: string

  constructor() {
    super('json-url is deprecated and is intentionally disabled')
    this.name = 'DeprecationError'
    this.code = 'ERR_DEPRECATED'
  }
}

//In-House:
const handler: EncodingHandler = {
  name: 'JSON-URL LZMA',
  encoder: async (_: any /*,_options?:any*/) => {
    throw new JSONURLDeprecationError()
  },
  decoder: async (_: string /*,_options?:any*/) => {
    throw new JSONURLDeprecationError()
  }
}

export default handler
