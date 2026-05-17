import { APIEncoding, APIVersion, NetworkType, QRTemplateType } from '../types'

//import packageJson from '../../package.json'
const packageJson: any = {} //TODO: make this work with bundlers
export const version = packageJson.version
export const projectName = packageJson.name
export const repositoryUrl = packageJson.repository

export const DefaultNetwork: NetworkType = 'mainnet'
export const DefaultAPIVersion: APIVersion = '2'
export const DefaultAPIEncodings: { [apiVer: string]: APIEncoding } = {
  '1': 'json-url-lzw',
  '2': 'gzip'
}
export const DefaultQRTemplate: QRTemplateType = 'boxed'
export const DefaultQRTitle = 'Dapp Action'
export const DefaultQRSubTitle = 'scan to execute | escanear para ejecutar'

export const networks: NetworkType[] = ['mainnet', 'preprod']
export const networkTags = networks // Future-friendly export for better devEx
export const apiVersions: APIVersion[] = [
  // '1',
  '2'
]
export const apiEncodings: { [apiVer: string]: APIEncoding[] } = {
  //   '1': ['json-url-lzw'],
  '2': ['json-url-lzma', 'gzip', 'base64url']
}

const isDevelopment = false
const SingleDomainV2 = isDevelopment
  ? ''
  : 'https://wallet.gamechanger.finance/'

export const GCDomains = {
  //   '1': {
  //     mainnet: 'https://wallet.gamechanger.finance/',
  //     preprod: 'https://preprod-wallet.gamechanger.finance/'
  //   },
  '2': {
    mainnet: SingleDomainV2,
    preprod: SingleDomainV2
  }
}

export const contact = {
  website: 'https://gamechanger.finance',
  github: 'https://github.com/GameChangerFinance/gamechanger.wallet/',
  twitter: 'https://twitter.com/GameChangerOk',
  discord: 'https://discord.gg/vpbfyRaDKG',
  youtube: 'https://www.youtube.com/@gamechanger.finance'
}

export const GCLibInSnippets = {
  browserOutputs: `
<!-- Use for local deployments or for testing the library: -->
<!-- <script src="res/browser.min.js"></script> -->
<!-- Use library from CDN: -->
<script src="https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc@latest/dist/browser.min.js"></script>
`,
  nodeJsOutputs: `
//Install on project:
//  $ npm install -s @gamechanger-finance/gc
// or
//Install globally:
//  $ npm install -g @gamechanger-finance/gc
//Run this file
//  $ node <FILENAME>.js

//Import if testing the library from this repository:
//import gc from './res/nodejs.js'
// or
//Import normally:
import gc from '@gamechanger-finance/gc'
`
}

export const GCDappConnUrls = {
  //   '1': {
  //     mainnet: 'https://wallet.gamechanger.finance/api/1/tx/{gcscript}',
  //     preprod: 'https://preprod-wallet.gamechanger.finance/api/1/tx/{gcscript}'
  //   },
  '2': {
    mainnet: `${SingleDomainV2}api/2/run/{gcscript}`,
    preprod: `${SingleDomainV2}api/2/run/{gcscript}`
  }
}
export const QRRenderTypes = ['png', 'svg']
export const QRTemplates = ['boxed', 'printable'] as const

export const BuildDataFormats = [
  'string',
  'json',
  'object',
  'base64',
  'hex'
] as const
export const BuildResourceProtocols = [
  'app',
  'http',
  'https',
  'file',
  'blob',
  'gcfs',
  'ipfs'
] as const

/**
 * Build resource protocol categories used by the build handler security model.
 *
 * - local: can read caller-local state such as an app VFS or filesystem.
 * - immutable: deterministic content-addressed/inline resources.
 * - mutable: externally controlled or time-varying resources.
 *
 * Unknown future protocols are treated as mutable by the build handler until
 * they are explicitly categorized here.
 */
export const BuildResourceProtocolCategories = {
  local: ['app', 'file', 'blob'],
  immutable: ['gcfs', 'ipfs'],
  mutable: ['http', 'https']
} as const

export const DefaultBuildAllowedProtocols = ['app'] as const
export const DefaultFilesystemRoot = '/'
export const DefaultMainFileAppURI = 'app:///main.gcscript'
export const BuildOutputMimeType = 'application/json;charset=utf-8'
export const ZipDataUriMimeType = 'application/zip'
export const TarGzDataUriMimeType = 'application/gzip'

export const GCScriptAPIRefURL =
  'https://wallet.gamechanger.finance/doc/api/v2/'
export const GCScriptDocsURL =
  'https://github.com/GameChangerFinance/gamechanger.wallet'

export const GCScriptSchemaURL =
  'https://wallet.gamechanger.finance/schema/api/v2/index.json.full'
export const GCScriptSchemaRootFile = 'api.json'
export const GCScriptSchemaCacheFileName = '.lang.def'
export const GCScriptSchemaCacheTTLHours = 24
