import utils from './utils/exported'
import config from './config/exported'
import handlers from './handlers'
import encodings from './encodings'

/**
 * GameChanger Lib unified export object.
 *
 * On browser, could be used as `const {gc} = window;`
 */
/*export*/ const gc = {
  ...handlers,
  encodings, // soon users should not use these, handlers should be used instead.
  utils,
  config
}

export default gc

//TODO: also check https://github.com/knightedcodemonkey/duel
