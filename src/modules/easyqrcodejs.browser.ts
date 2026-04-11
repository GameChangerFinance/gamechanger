import { ObjectType } from '../types'
import {
  appendFooterToSVG,
  drawFooterOnCanvas,
  QRLoaderResult
} from './easyqrcodejs.shared'

export default async (): Promise<QRLoaderResult> => {
  const easyQRCodeModule = await import('easyqrcodejs')
  const QRCode =
    (<any>window)?.QRCode ||
    (<any>easyQRCodeModule)?.QRCode ||
    (<any>easyQRCodeModule)?.default ||
    easyQRCodeModule
  const _QRCode = (<any>window)?.QRCode || QRCode

  const createQRCode = (options: ObjectType) => {
    const wantsSVG =
      String((options || {}).drawer || '').toLowerCase() === 'svg'
    const element = document.createElement(wantsSVG ? 'div' : 'canvas')
    if (!element) throw new Error('QR host element creation failed on browser')
    return new QRCode(element, options)
  }

  const renderQRCode = async (args: { text: string; style: any }) => {
    return new Promise((resolve) => {
      const qr = createQRCode({
        ...(args.style || {}),
        text: args.text,
        onRenderingEnd: (qrCodeOptions: any, dataURL: string) => {
          const wantsSVG =
            String(
              qrCodeOptions?.drawer || args?.style?.drawer || ''
            ).toLowerCase() === 'svg'
          const isSVGText =
            typeof dataURL === 'string' && dataURL.trim().startsWith('<svg')

          queueMicrotask(() => {
            let nextDataURL = dataURL
            let nextSVGText = isSVGText
              ? dataURL
              : wantsSVG
              ? qr?._oDrawing?._oContext?.getSerializedSvg?.(true) || ''
              : ''

            if (nextSVGText) {
              nextSVGText = appendFooterToSVG(
                nextSVGText,
                args.style,
                qrCodeOptions
              )
            } else if (
              drawFooterOnCanvas(
                qr?._oDrawing?._elCanvas,
                qr?._oDrawing?._oContext,
                args.style
              )
            ) {
              nextDataURL =
                qr?._oDrawing?._elCanvas?.toDataURL?.('image/png') ||
                nextDataURL
            }

            resolve({
              qr,
              qrCodeOptions,
              dataURL: nextDataURL,
              SVGText: nextSVGText
            })
          })
        }
      })
    })
  }

  const registerFonts = (_items: Array<{ file: string; def: any }>) => {
    // Browser target keeps the current behavior here.
  }

  return {
    _QRCode,
    QRCode,
    Canvas: null,
    createQRCode,
    renderQRCode,
    registerFonts
  }
}
