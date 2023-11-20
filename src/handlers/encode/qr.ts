import { GCDappConnUrls } from '../../config'
import {
  APIEncoding,
  APIVersion,
  DefaultQRTemplate,
  NetworkType,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'

import qrEncoder from '../../encodings/qr'
import qrLibLoader from '../../modules/easyqrcodejs'

//import path from 'path'
import stylesLoader from '../../config/styles'
//import { createReadStream, createWriteStream, } from 'fs'

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

    const obj = JSON.parse(input)
    const urlPattern = GCDappConnUrls[apiVersion][network]
    if (!urlPattern)
      throw new Error(`Missing URL pattern for network '${network || ''}'`)

    const { styles, fonts } = stylesLoader()
    const { registerFonts } = await qrLibLoader()
    registerFonts(fonts)

    const template =
      args?.template && styles[args?.template]
        ? args?.template
        : DefaultQRTemplate

    let style = styles[template]

    if (args?.styles) {
      try {
        style = {
          ...style,
          ...(JSON.parse(args?.styles) || {})
        }
      } catch (err) {
        throw new Error(`Error applying style layer over '${template}'. ${err}`)
      }
    }

    const dataURI = await qrEncoder.encoder(obj, {
      urlPattern,
      encoding,
      qrCodeStyle: style,
      qrResultType: args?.qrResultType
    })

    return dataURI
  } catch (err) {
    if (err instanceof Error)
      throw new Error('QR URL generation failed. ' + err?.message)
    else throw new Error('QR URL generation failed. ' + 'Unknown error')
  }
}
