import { Buffer } from 'buffer'
import { EncodingHandler } from '../types'
import urlEncoder from './url'
//import { renderQRCode } from '../modules/QR'
import qrLoader from '../modules/easyqrcodejs'

const handler: EncodingHandler = {
  name: 'GameChanger Wallet QR transport. The URL transport encoded as QR code',
  encoder: async (
    obj: any,
    options?: { qrCodeStyle?: any; qrResultType?: 'png' | 'svg' }
  ) => {
    const { renderQRCode } = await qrLoader() //If turns into async, must be moved inside

    const url = await urlEncoder.encoder(obj, options)
    const qrResult = await renderQRCode({
      text: url,
      style: { ...(options?.qrCodeStyle || {}) }
    })
    const qrResultType = options?.qrResultType || 'png'
    const handlers = {
      png: async () => qrResult?.dataURL, //qr.toDataURL(),
      svg: async () =>
        `data:image/svg+xml;base64,${Buffer.from(
          qrResult?.SVGText /*await qr.toSVGText()*/
        ).toString('base64')}`
    }
    const res = await handlers[qrResultType]()
    //console.log({ qrResult, qrResultType, res })
    return res
  },
  decoder: async (/*msg: string ,_options?:any*/) => {
    throw new Error('Not implemented yet')
  }
}

export default handler
