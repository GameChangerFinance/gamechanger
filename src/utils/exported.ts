import { Buffer } from 'buffer'
import _testDeps from '../tests/deps'

export default {
  Buffer,
  ArrayBuffer: ArrayBuffer,
  Uint8Array: Uint8Array,
  Uint16Array: Uint16Array,
  Uint32Array: Uint32Array,
  BigInt: BigInt,
  _testDeps //will be deprecated
}
