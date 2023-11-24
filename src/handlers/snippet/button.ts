import { GCDappConnUrls } from '../../config'
import {
  APIEncoding,
  APIVersion,
  NetworkType,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'
import urlEncoder from '../../encodings/url'
const baseTemplate = async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean

  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string //JSON
}) => {
  const urlPattern = GCDappConnUrls[args?.apiVersion][args?.network]
  if (!urlPattern)
    throw new Error(`Missing URL pattern for network '${args?.network || ''}'`)
  const url = await urlEncoder.encoder(JSON.parse(args?.input), {
    urlPattern,
    encoding: args?.encoding
  })
  //Generated with https://www.bestcssbuttongenerator.com/
  return `
<!--GC BUTTON START-->
<a href="${url}" class="gcConnectButton">Connect with GC</a>
<style>.gcConnectButton {box-shadow: 0px 0px 0px 2px #9fb4f2;
background:linear-gradient(to bottom, #7892c2 5%, #476e9e 100%);background-color:#7892c2;border-radius:25px;border:1px solid #4e6096;
display:inline-block;cursor:pointer;color:#ffffff;font-family:Arial;font-size:16px;font-weight:bold;padding:12px 37px;text-decoration:none;
text-shadow:0px 1px 0px #283966;}.gcConnectButton:hover {background:linear-gradient(to bottom, #476e9e 5%, #7892c2 100%);
background-color:#476e9e;}.gcConnectButton:active {position:relative;top:1px;}</style>
<!--GC BUTTON END-->
`
}

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean

  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string //JSON
}) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)

    const text = await baseTemplate({
      apiVersion,
      network,
      encoding,
      input,

      qrResultType: args?.qrResultType,
      outputFile: args?.outputFile,
      template: args?.template,
      styles: args?.styles
    })
    return `data:text/html;base64,${Buffer.from(text).toString('base64')}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
