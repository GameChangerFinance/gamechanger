import { Buffer } from 'buffer'
import {
  bufferToDataURI,
  dataURIToBuffer,
  virtualFileSystemToZip,
  zipToVirtualFileSystem,
  virtualFileSystemToTarGz,
  tarGzToVirtualFileSystem,
  hashCode
} from '.'
import { downloadGCScriptSchema, getSchemaDefOf } from '../handlers/helpers'

const runtimeBuffer: any = Buffer

export default {
  Buffer: runtimeBuffer,
  ArrayBuffer: ArrayBuffer,
  Uint8Array: Uint8Array,
  Uint16Array: Uint16Array,
  Uint32Array: Uint32Array,
  BigInt: BigInt,
  bufferToDataURI,
  dataURIToBuffer,
  virtualFileSystemToZip,
  zipToVirtualFileSystem,
  virtualFileSystemToTarGz,
  tarGzToVirtualFileSystem,
  hashCode,
  downloadGCScriptSchema,
  getSchemaDefOf
}
