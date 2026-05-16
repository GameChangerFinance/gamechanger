import utils from './utils/exported'
import config from './config/exported'
import handlers from './handlers'
import encodings from './encodings'

export const { encode, snippet, build, validate } = handlers

/**
 * GameChanger Lib unified export object.
 *
 * On browser, could be used as `const {gc} = window;`
 */
export const gc = {
  encode,
  snippet,
  build,
  validate,
  encodings,
  utils,
  config
}

export { encodings, utils, config }
export * from './types'
export default gc
