import testDeps from './tests/deps'
import _utils from './utils/exportedUtils'
import { usageMessage, QRRenderTypes, GCDomains, contact } from './config'

import _handlers from './handlers'
import _encodings from './encodings'

export const encodings = _encodings
export const gc = _handlers
// export const cli =
//   typeof window === 'object'
//     ? undefined
//     : import('./cli.ts.old').then((d) => d.default())

export default _handlers

export const config = {
  usageMessage,
  QRRenderTypes,
  GCDomains,
  contact
}
export const utils = _utils

export const _testDeps = testDeps

//TODO: check https://github.com/knightedcodemonkey/duel
