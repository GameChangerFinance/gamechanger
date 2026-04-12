import type { ObjectType } from '../types'
import {
  appendFooterToSVG,
  drawFooterOnCanvas,
  toHandledQRError,
  type QRLoaderResult
} from './easyqrcodejs.shared'

export default async (): Promise<QRLoaderResult> => {
  const easyQRCodeModule = await import('easyqrcodejs')
  const QRCode =
    (window as any)?.QRCode ||
    (easyQRCodeModule as any)?.QRCode ||
    (easyQRCodeModule as any)?.default ||
    easyQRCodeModule
  const _QRCode = (window as any)?.QRCode || QRCode

  const createQRCode = (options: ObjectType) => {
    const wantsSVG =
      String((options || {}).drawer || '').toLowerCase() === 'svg'
    const element = document.createElement(wantsSVG ? 'div' : 'canvas')
    if (!element) throw new Error('QR host element creation failed on browser')
    return new QRCode(element, options)
  }

  const renderQRCode = async (args: {
    text: string
    style: any
  }): Promise<any> => {
    return new Promise((resolve, reject) => {
      let isSettled = false
      let qr: any

      const resolveOnce = (value: any) => {
        if (isSettled) return
        isSettled = true
        resolve(value)
      }

      const rejectOnce = (error: unknown) => {
        if (isSettled) return
        isSettled = true
        reject(toHandledQRError(error))
      }

      try {
        qr = createQRCode({
          ...(args.style || {}),
          text: args.text,
          onRenderingEnd: (qrCodeOptions: any, dataURL: string) => {
            queueMicrotask(() => {
              try {
                const wantsSVG =
                  String(
                    qrCodeOptions?.drawer || args?.style?.drawer || ''
                  ).toLowerCase() === 'svg'
                const isSVGText =
                  typeof dataURL === 'string' &&
                  dataURL.trim().startsWith('<svg')

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

                resolveOnce({
                  qr,
                  qrCodeOptions,
                  dataURL: nextDataURL,
                  SVGText: nextSVGText
                })
              } catch (error) {
                rejectOnce(error)
              }
            })
          }
        })
      } catch (error) {
        rejectOnce(error)
      }
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
