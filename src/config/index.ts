import { APIEncoding, APIVersion, NetworkType } from '../types'
//import packageJson from '../../package.json'
const packageJson: any = {} //TODO: make this work with bundlers
export const version = packageJson.version
export const projectName = packageJson.name
export const repositoryUrl = packageJson.repository

export const cliName = 'gamechanger-cli'
export const networks: NetworkType[] = ['mainnet', 'preprod']
export const apiVersions: APIVersion[] = [
  // '1',
  '2'
]
export const apiEncodings: { [apiVer: string]: APIEncoding[] } = {
  //   '1': ['json-url-lzw'],
  '2': ['json-url-lzma', 'gzip', 'base64url']
}

const isDevelopment = true
const SingleDomainV2 = isDevelopment
  ? 'https://dev-wallet.gamechanger.finance/'
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
  youtube: 'https://www.youtube.com/@gamechanger.finance',
  playgroundDiscord:
    'https://discord.com/channels/912354788795109396/921687306241458207'
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

Networks: ${networks.map((x) => `'${x}'`).join(' | ')}

Actions:
	'encode':
		'url'     : generates a ready to use URL dApp connector from a valid GCScript
		'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
	'snippet':
		'html'    : generates a ready to use HTML dApp with a URL connector from a valid GCScript
		'button'  : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
		'express' : generates a ready to use Node JS Express backend that redirects browser users to connect with the wallet, from a valid GCScript
		'react'   : generates a ready to use React dApp with a URL connector from a valid GCScript
Options:
	--args [gcscript] | -a [gcscript]:  Load GCScript from arguments

	--file [filename] | -a [filename]:  Load GCScript from file
	without --args or --file         :  Load GCScript from stdin

	--outputFile [filename] -o [filename]:  The QR Code, HTML, button, nodejs, or react output filename
	without --outputFile                 :  Sends the QR Code, HTML, button, nodejs, or react output file to stdin

	--apiVersion [1 | 2] | -v [1 | 2]:  Target GameChanger Wallet v1 or v2

	--encoding [see encodings below] | -v [see encodings below]:  Target GameChanger Wallet v1 or v2 messaging encodings
	Valid encodings by apiVersion:
	${JSON.stringify(apiEncodings)}

	--template [see templates below] | -t [see templates below]: QR code predefined styles
	Valid templates: default, boxed or printable

	--serve | -S : Serve code snippet outputs on http://localhost:3000

	--refAddress [cardanoAddress] | -r [cardanoAddress]: Append ref=<address> to generated wallet URLs and QRs

	--disableNetworkRouter | -R : Do not append the default networkTag=<network> query string parameter

Examples

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

`
