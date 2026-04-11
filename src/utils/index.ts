//import path from 'node:path'
//import * as path from 'path'

import { apiEncodings, apiVersions, networks } from '../config'
import {
  APIEncoding,
  APIVersion,
  DefaultAPIEncodings,
  DefaultAPIVersion,
  DefaultNetwork,
  NetworkType
} from '../types'

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

export const validateBuildMsgArgs = (args: {
  //actionPath: string[], //TODO: [action,subAction,subSubAction...]
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
}) => {
  const network = args?.network ? args?.network : DefaultNetwork
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
