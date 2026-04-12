import { Buffer } from 'buffer'
import _testDeps from '../tests/deps'

const runtimeBuffer: any = Buffer
const runtimeTestDeps: any = _testDeps

export default {
  Buffer: runtimeBuffer,
  ArrayBuffer: ArrayBuffer,
  Uint8Array: Uint8Array,
  Uint16Array: Uint16Array,
  Uint32Array: Uint32Array,
  BigInt: BigInt,
  _testDeps: runtimeTestDeps //will be deprecated
}
