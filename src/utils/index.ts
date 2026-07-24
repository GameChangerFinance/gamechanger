import { Buffer } from 'buffer'
//import path from 'node:path'
//import * as path from 'path'
import {
  apiEncodings,
  apiVersions,
  networks,
  DefaultAPIEncodings,
  DefaultNetworkTag,
  DefaultAPIVersion,
  ZipDataUriMimeType,
  TarGzDataUriMimeType
} from '../config'
import { APIEncoding, APIVersion, NetworkType } from '../types'
import type { GCScript } from '../handlers/helpers'
import { gzipSync, gunzipSync, zipSync, unzipSync } from 'fflate'
import { sha512 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'

// export const resolveGlobal = async (file) => {
//   //const path = await import('path').then(d=>d.default);
//   var commonjsGlobal =
//     typeof window !== 'undefined'
//       ? window
//       : typeof global !== 'undefined'
//       ? global
//       : this
//   console.log({ path, commonjsGlobal })
//   if (!commonjsGlobal) throw new Error('Missing global')
//   return path.resolve('dist/', file)
// }

/** Matches the wallet-side GCScript hash: SHA-512 over strict JSON. */
export const hashCode = (code: GCScript) => {
  const json = JSON.stringify(code) // this is JSON, not JSONC
  return bytesToHex(sha512(new TextEncoder().encode(json)))
}

export const validateBuildMsgArgs = (args: {
  //actionPath: string[], //TODO: [action,subAction,subSubAction...]
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
}) => {
  const network = args?.network ? args?.network : DefaultNetworkTag
  if (!networks.includes(network)) {
    throw new Error(`Unknown Cardano network specification '${network || ''}'`)
  }

  const apiVersion: APIVersion = args?.apiVersion
    ? <APIVersion>args?.apiVersion
    : DefaultAPIVersion
  if (!apiVersions.includes(apiVersion))
    throw new Error(`Unknown API version '${apiVersion || ''}'`)

  const defaultEncoding: APIEncoding = DefaultAPIEncodings[apiVersion]
  const encoding: APIEncoding = args?.encoding
    ? <APIEncoding>args?.encoding
    : defaultEncoding
  if (!apiEncodings[apiVersion].includes(encoding))
    throw new Error(
      `Unknown encoding '${encoding || ''}' for API version '${
        apiVersion || ''
      }'`
    )

  const input = args?.input
  if (!input) throw new Error('Empty GCScript provided')
  if (typeof input !== 'string')
    throw new Error(
      'Wrong input type. GCScript must be presented as JSON string'
    )
  try {
    JSON.parse(input)
  } catch (err) {
    throw new Error(`Invalid GCScript. JSON error. ${err}`)
  }
  return {
    apiVersion,
    network,
    encoding,
    input
  }
}
export const getBaseUrl = (value?: string): string | undefined => {
  try {
    return value?.trim()
      ? ((u) => (u.host ? `${u.protocol}//${u.host}` : undefined))(
          new URL(value.trim())
        )
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Validates a GameChanger wallet URL pattern.
 *
 * Requirements:
 * - Must be a valid absolute URL.
 * - Must contain the `{gcscript}` placeholder token.
 *
 * The `{gcscript}` placeholder is embedded by the URL encoding transport.
 *
 * @throws Error when the pattern is invalid.
 */
export const validateUrlPattern = (url: string): string => {
  const trimmed = (url || '').trim()
  if (!trimmed) throw new Error('Missing URL pattern')

  // URL() accepts `{}` characters in the path; we use it only to validate
  // the URL shape (scheme + host) and normalize formatting.
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Invalid URL pattern provided')
  }

  if (!parsed?.origin || !parsed?.host)
    throw new Error('Invalid URL pattern provided')

  if (!trimmed.includes('{gcscript}')) {
    throw new Error(
      "Invalid URL pattern provided. Missing required '{gcscript}' placeholder."
    )
  }

  return trimmed
}

export type SerializableVirtualFile = {
  /** Runtime value is a Buffer; Uint8Array keeps declarations portable. */
  data: Uint8Array
  mimeType?: string
}

export type SerializableVirtualFileSystem = {
  [relativeFilePath: string]: SerializableVirtualFile
}

const normalizeMimeType = (mimeType?: string) =>
  mimeType && mimeType.trim() ? mimeType.trim() : 'application/octet-stream'

/** Converts a Buffer into a base64 data URI. */
export const bufferToDataURI = (
  data: Uint8Array | ArrayBuffer | string,
  mimeType = 'application/octet-stream'
) => {
  const buffer = Buffer.isBuffer(data)
    ? data
    : typeof data === 'string'
    ? Buffer.from(data, 'utf8')
    : data instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(data))
    : Buffer.from(data)
  return `data:${normalizeMimeType(mimeType)};base64,${buffer.toString(
    'base64'
  )}`
}

/** Converts a data URI into a Buffer. */
export const dataURIToBuffer = (dataURI: string): Uint8Array => {
  const match = String(dataURI).match(
    /^data:([^;,]+(?:;[^,;=]+=[^,;]+)*)?(;base64)?,(.*)$/s
  )
  if (!match) throw new Error('Invalid data URI')
  const payload = match[3] || ''
  return match[2]
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
}

const normalizeVirtualFilePath = (relativeFilePath: string) => {
  const normalizedParts: string[] = []
  const normalizedPath = String(relativeFilePath || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
  for (const rawPart of normalizedPath.split('/')) {
    const part = rawPart.trim()
    if (!part || part === '.') continue
    if (part === '..') {
      if (normalizedParts.length === 0) {
        throw new Error(`Invalid virtual file path '${relativeFilePath}'`)
      }
      normalizedParts.pop()
      continue
    }
    normalizedParts.push(part)
  }
  const safePath = normalizedParts.join('/')
  if (!safePath)
    throw new Error(`Invalid virtual file path '${relativeFilePath}'`)
  return safePath
}

const toFileMap = (files: SerializableVirtualFileSystem) => {
  const map: Record<string, Uint8Array> = {}
  for (const relativeFilePath of Object.keys(files || {}).sort()) {
    const safePath = normalizeVirtualFilePath(relativeFilePath)
    map[safePath] = Buffer.from(files[relativeFilePath].data)
  }
  return map
}

const fromFileMap = (map: Record<string, Uint8Array>) => {
  const files: SerializableVirtualFileSystem = {}
  for (const relativeFilePath of Object.keys(map || {}).sort()) {
    const safePath = normalizeVirtualFilePath(relativeFilePath)
    files[safePath] = { data: Buffer.from(map[relativeFilePath]) }
  }
  return files
}

/** Packs a virtual filesystem into a ZIP data URI using fflate. */
export const virtualFileSystemToZip = (
  files: SerializableVirtualFileSystem,
  mimeType = ZipDataUriMimeType
) => bufferToDataURI(Buffer.from(zipSync(toFileMap(files))), mimeType)

/** Unpacks a ZIP data URI into a virtual filesystem using fflate. */
export const zipToVirtualFileSystem = (dataURI: string) =>
  fromFileMap(unzipSync(Buffer.from(dataURIToBuffer(dataURI))))

const TAR_BLOCK_SIZE = 512

const tarOctal = (value: number, length: number) => {
  const octal = Math.max(0, value).toString(8)
  return Buffer.from(octal.padStart(length - 1, '0') + '\0', 'ascii')
}

const writeTarString = (
  header: Buffer,
  offset: number,
  length: number,
  value: string
) => {
  const encoded = Buffer.from(value, 'utf8')
  if (encoded.length > length) {
    throw new Error(`TAR path field is too long: ${value}`)
  }
  encoded.copy(header, offset, 0, encoded.length)
}

const splitTarPath = (filePath: string) => {
  const encoded = Buffer.from(filePath, 'utf8')
  if (encoded.length <= 100) return { name: filePath, prefix: '' }

  const parts = filePath.split('/')
  for (let index = 1; index < parts.length; index++) {
    const prefix = parts.slice(0, index).join('/')
    const name = parts.slice(index).join('/')
    if (
      Buffer.byteLength(prefix, 'utf8') <= 155 &&
      Buffer.byteLength(name, 'utf8') <= 100
    ) {
      return { name, prefix }
    }
  }
  throw new Error(`TAR path is too long: ${filePath}`)
}

const createTarHeader = (filePath: string, data: Uint8Array) => {
  const header = Buffer.alloc(TAR_BLOCK_SIZE, 0)
  const { name, prefix } = splitTarPath(filePath)
  writeTarString(header, 0, 100, name)
  tarOctal(0o644, 8).copy(header, 100)
  tarOctal(0, 8).copy(header, 108)
  tarOctal(0, 8).copy(header, 116)
  tarOctal(data.length, 12).copy(header, 124)
  tarOctal(0, 12).copy(header, 136)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  writeTarString(header, 257, 6, 'ustar')
  writeTarString(header, 263, 2, '00')
  if (prefix) writeTarString(header, 345, 155, prefix)
  let checksum = 0
  for (const byte of header) checksum += byte
  tarOctal(checksum, 8).copy(header, 148)
  return header
}

/** Packs a virtual filesystem into a gzipped TAR data URI using fflate gzip. */
export const virtualFileSystemToTarGz = (
  files: SerializableVirtualFileSystem,
  mimeType = TarGzDataUriMimeType
) => {
  const parts: Buffer[] = []
  for (const relativeFilePath of Object.keys(files || {}).sort()) {
    const safePath = normalizeVirtualFilePath(relativeFilePath)
    const data = Buffer.from(files[relativeFilePath].data)
    parts.push(createTarHeader(safePath, data), data)
    const padding =
      (TAR_BLOCK_SIZE - (data.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE
    if (padding) parts.push(Buffer.alloc(padding, 0))
  }
  parts.push(Buffer.alloc(TAR_BLOCK_SIZE * 2, 0))
  return bufferToDataURI(Buffer.from(gzipSync(Buffer.concat(parts))), mimeType)
}

const readTarString = (buffer: Buffer, offset: number, length: number) => {
  const raw = buffer.subarray(offset, offset + length)
  const end = raw.indexOf(0)
  return raw.subarray(0, end >= 0 ? end : raw.length).toString('utf8')
}

const readTarOctal = (buffer: Buffer, offset: number, length: number) => {
  const raw = readTarString(buffer, offset, length).trim()
  return raw ? parseInt(raw, 8) : 0
}

/** Unpacks a gzipped TAR data URI into a virtual filesystem. */
export const tarGzToVirtualFileSystem = (dataURI: string) => {
  const tar = Buffer.from(gunzipSync(Buffer.from(dataURIToBuffer(dataURI))))
  const files: SerializableVirtualFileSystem = {}
  let offset = 0

  while (offset + TAR_BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_SIZE)
    if (header.every((byte) => byte === 0)) break

    const typeFlag = String.fromCharCode(header[156] || 0)
    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const safePath = normalizeVirtualFilePath(
      [prefix, name].filter(Boolean).join('/')
    )
    const size = readTarOctal(header, 124, 12)
    const dataOffset = offset + TAR_BLOCK_SIZE
    const dataEnd = dataOffset + size

    if (dataEnd > tar.length)
      throw new Error(`Invalid TAR: truncated file '${safePath}'`)
    if (typeFlag === '0' || typeFlag === '\0') {
      files[safePath] = { data: Buffer.from(tar.subarray(dataOffset, dataEnd)) }
    }

    offset =
      dataOffset +
      size +
      ((TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE)
  }

  return files
}
