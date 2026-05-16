import { APIEncoding, APIVersion, NetworkType, QRTemplateType } from '../types'

//import packageJson from '../../package.json'
const packageJson: any = {} //TODO: make this work with bundlers
export const version = packageJson.version
export const projectName = packageJson.name
export const repositoryUrl = packageJson.repository
export const cliName = 'gamechanger-cli'

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
export const DefaultMainFileAppURI = 'app://main.gcscript'
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

// export const demoGCS = {
//   type: 'tx',
//   title: 'Demo',
//   description: 'created with ' + cliName,
//   metadata: {
//     '123': {
//       message: 'Hello World!'
//     }
//   }
// }
// export const demoPacked =
//   'woTCpHR5cGXConR4wqV0aXRsZcKkRGVtb8KrZGVzY3JpcMSKb27DmSHEmGVhdGVkIHfEi2ggZ2FtZWNoYW5nZXItZGFwcC1jbGnCqMSudGHEuMWCwoHCozEyM8KBwqfErnNzYcS0wqxIZWxsbyBXb3JsZCE'
export const escapeShellArg = (arg: string) =>
  // eslint-disable-next-line quotes
  `'${arg.replace(/'/g, "'\\''")}'`
export const demoGCS2 = {
  gcscript: {
    title: 'Get Address',
    description: 'Do you authorize to share address to dapp?',
    type: 'script',
    exportAs: 'MyData',
    run: {
      address: {
        type: 'getCurrentAddress'
      }
    }
  },
  gzipShort:
    'https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet',
  gzip: 'https://wallet.gamechanger.finance/api/2/run/1-H4sIAAAAAAAAAzWOQQrDMAwEvyJ07gt6KaGBnvoIUYvGECIhy1A3-O-VSXpbjZhld_TsK-MVH-wwpWRcCl4wcXlZVs-yxW8WaFKBqi9i-cvgAmUhY6DDGCCR6i1Ubzr6Dj9u_qiYTyXYs83kFMxq1O542iOe1pv9Xs148_-W3vsPri6B66UAAAA?networkTag=mainnet'
}

export const usageMessage = `
✨ GameChanger Wallet CLI:
	Official GameChanger Wallet library and CLI for integrating it with Cardano dapps and solve other related tasks (https://gamechanger.finance/)

Usage
	$ ${cliName} [network] [action] [subaction]
	$ ${cliName} build [-f file] [-o output] [--fileUri app://main.gcscript]

Networks: ${networks.map((x) => `'${x}'`).join(' | ')}

Actions:
	'encode':
		'url'     : generates a ready to use URL dApp connector from a valid GCScript
		'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
	'build':
		'file'     : builds a multi-file GCScript project into one final GCScript JSON file
	'validate':
		'file'     : validates a built strict-JSON GCScript file against the production language schema
	'snippet':
		'html'      : generates a ready to use HTML dApp with shared app state, multi-intent UX, and auto-rendered intent argument UI from a valid GCScript
		'html-zero' : generates a highly resilient offline-ready zero-dependency HTML dApp for mission-critical and on-chain hosted frontends from a valid GCScript
		'button'    : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
		'express'   : generates a ready to use Node JS Express backend that redirects browser users to connect with the wallet, from a valid GCScript
		'react'     : generates a ready to use React dApp with shared app state, multi-intent UX, and auto-rendered intent argument UI from a valid GCScript
Options:
	--args [gcscript] | -a [gcscript]:  Load GCScript from arguments

	--file [filename] | -f [filename]:  Load GCScript from file
	without --args or --file         :  Load GCScript from stdin

	--outputFile [filename] -o [filename]:  The QR Code, HTML, html-zero, button, nodejs, or react output filename
	without --outputFile                 :  Sends the QR Code, HTML, html-zero, button, nodejs, or react output file to stdin

	--apiVersion [1 | 2] | -v [1 | 2]:  Target GameChanger Wallet v1 or v2

	--encoding [see encodings below] | -v [see encodings below]:  Target GameChanger Wallet v1 or v2 messaging encodings
	Valid encodings by apiVersion:
	${JSON.stringify(apiEncodings)}

	--template [see templates below] | -t [see templates below]: QR code predefined styles
	Valid templates: default, boxed or printable

	--serve | -S : Serve code snippet outputs on http://localhost:3000

	--refAddress [cardanoAddress] | -r [cardanoAddress]: Append ref=<address> to generated wallet URLs and QRs

	--disableNetworkRouter | -R : Do not append the default networkTag=<network> query string parameter

	--urlPattern [url] | -u [url] : Override the default wallet URL pattern (must include {gcscript})

	--snippetArgs [json] | -A [json] : JSON map of snippet placeholder overrides (snippet actions only). Use {"defaultIntents": "..."} to override the whole defaultIntents block.

	--cwd [path] | -C [path] : Working directory used by the CLI app:// resolver. Defaults to the current working directory.

	--fileUri [uri] | -U [uri] : Logical parent URI used by build only to resolve relative imports. It is not the same as --file and is never read or written as the input file. Defaults to DefaultMainFileAppURI (${DefaultMainFileAppURI}).

	--allowProtocols [csv] : Build protocol allow-list. Defaults to DefaultBuildAllowedProtocols (${DefaultBuildAllowedProtocols.join(
    ','
  )}). file:// is available in CLI when explicitly allowed and is not restricted to --cwd.

	--allowedRemoteDomains [csv] : Optional exact or wildcard host allow-list for http(s) build imports, for example example.com,*.example.org.

	--noValidate : Disable schema validation during build. Validation is enabled by default and requires the language schema.

	--schemaUrl [url] : Override the GCScript JSON schema URL used by build/validate. Defaults to ${GCScriptSchemaURL}.

	--hide-warnings : Hide non-blocking validation warnings, including likely ISL typos, during build/validate.

	Validation input is strict built JSON: comments and trailing commas are rejected here. JSONC support is build-only before final emission.
	Human progress, warnings, validation summaries, and errors are written to stderr. Generated artifacts and JSON reports are written to stdout only when --outputFile is omitted.
	Exit codes: encode/snippet/build succeed with 0 and fail non-zero; validate returns 0 only when isValid is true.

	--quiet | -q : Disable non-essential human logs. Generated output still uses stdout when --outputFile is omitted.

Examples

	⭐ GCScript build:
		$ ${cliName} build -f ./main.gcscript -o ./dist/built.gcscript

	⭐ GCScript validation for CI/CD:
		$ ${cliName} validate -f ./dist/built.gcscript -o ./dist/validation-report.json

		# Bulk validate checked-in fixtures and write per-file reports.
		$ pnpm run test:gcscript

		# Resolve app:// imports relative to another project root.
		# --fileUri is the logical parent URI for relative imports, not the input file path.
		$ ${cliName} build -f ./src/main.gcscript -o ./dist/built.gcscript --cwd . --fileUri app://src/main.gcscript

	⭐ URL encoding:
		$ ${cliName} mainnet encode url -v 2 -f examples/connect.gcscript
		${demoGCS2.gzipShort}

		$ ${cliName} mainnet encode url -v 2 -r addr1... -f examples/connect.gcscript
		${demoGCS2.gzipShort}&ref=addr1...

		$ ${cliName} mainnet encode url -v 2 -a ${escapeShellArg(
  JSON.stringify(demoGCS2.gcscript)
)}
		${demoGCS2.gzipShort}

		$ cat examples/connect.gcscript | ${cliName} mainnet encode url -v 2
		${demoGCS2.gzipShort}

	⭐ QR encoding:
		$ ${cliName} preprod encode qr -v 2 -a ${escapeShellArg(
  JSON.stringify(demoGCS2.gcscript)
)} > qr_output.png

		$ ${cliName} mainnet encode qr -v 2 -o examples/qr_output.png -a ${escapeShellArg(
  JSON.stringify(demoGCS2.gcscript)
)}
		
		$ cat examples/connect.gcscript | ${cliName} mainnet encode qr -v 2 -o examples/qr_output.png


		$ ${cliName} mainnet encode qr -e gzip  -v 2 -f examples/connect.gcscript -o examples/qr_output.png


	Code generation and serve dapp (-S):

	⭐ HTML code:
		$ ${cliName} preprod snippet html -v 2 -S -o examples/htmlDapp.html -f examples/connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

	⭐ HTML Zero code:
		$ ${cliName} mainnet snippet html-zero -v 2 -S -o examples/htmlZeroDapp.html -f examples/connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

	⭐ ReactJS code:
		$ ${cliName} mainnet snippet react -v 2 -S -o examples/reactDapp.html -f examples/connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

	⭐ HTML Button snippet:
		$ ${cliName} mainnet snippet button -v 2 -S -o examples/connectButton.html -f examples/connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000
		
	⭐ Express backend code:
		$ ${cliName} mainnet snippet express -v 2 -o examples/expressBackend.js -f examples/connect.gcscript
		$ node examples/expressBackend.js
		🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://localhost:3000/

Build protocol resolvers:
	'app://'  : default virtual filesystem resolver in the library. In CLI it is resolved from --cwd and cannot escape that directory.
	'file://' : platform-specific and not allowed by default. In CLI it is unrestricted when explicitly enabled with --allowProtocols.
	'http://' and 'https://' : resolved through fetch where available and optionally restricted with --allowedRemoteDomains. Mutable remote resources cannot import nested local resources.
	'blob:'   : browser-oriented local resolver through fetch where available.

Express note:
	Express is suggested only when using snippet serving (-S) or generated express examples. The CLI does not require it for encode, snippet generation, or build actions.

`
