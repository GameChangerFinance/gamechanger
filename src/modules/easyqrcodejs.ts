import { ObjectType } from '../types'

type QRLoaderResult = {
  _QRCode: any
  QRCode: any
  Canvas: any
  createQRCode: (options: ObjectType) => any
  renderQRCode: (args: { text: string; style: any }) => Promise<any>
  registerFonts: (items: Array<{ file: string; def: any }>) => void
}

type FontRegistryItem = { file: string; def: any }

type FooterOptions = {
  text: string
  font: string
  color: string
  bottom: number
  textPadding: number
}

const runtimeImport = async (pathStr: string) =>
  Function('pathStr', 'return import(pathStr)')(pathStr) as Promise<any>

const nodeFontRegistry: FontRegistryItem[] = []
let nodeRuntimePromise: Promise<any> | undefined

const uniqueFontRegistry = () => {
  const map = new Map<string, FontRegistryItem>()
  nodeFontRegistry.forEach((item) => {
    const key = `${String(item?.file || '')}::${String(
      item?.def?.family || ''
    )}`
    if (!map.has(key)) map.set(key, item)
  })
  return Array.from(map.values())
}

const resolveNodeFontPath = (file: string, runtime: any) => {
  if (!file || file.startsWith('data:')) return ''

  const path = runtime?.path
  const fileURLToPath = runtime?.fileURLToPath

  if (file.startsWith('file:') && typeof fileURLToPath === 'function') {
    return fileURLToPath(file)
  }

  if (path?.isAbsolute?.(file)) {
    return file
  }

  return path.resolve(typeof __dirname === 'string' ? __dirname : '.', file)
}

const addFooterToPNGDataURL = async (
  dataURL: string,
  style: any,
  runtime: any
): Promise<string> => {
  const footer = getFooterOptions(style)
  if (!footer || !dataURL) return dataURL

  try {
    const loadImage = runtime?.loadImage
    const createCanvas = runtime?.createCanvas

    if (typeof loadImage !== 'function' || typeof createCanvas !== 'function') {
      return dataURL
    }

    const image = await loadImage(dataURL)
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')

    context.drawImage(image, 0, 0, image.width, image.height)

    context.save?.()
    context.setTransform?.(1, 0, 0, 1, 0, 0)
    context.globalAlpha = 1
    context.font = footer.font
    context.fillStyle = footer.color
    context.textAlign = 'center'
    context.textBaseline = 'bottom'
    context.fillText(footer.text, image.width / 2, image.height - footer.bottom)
    context.restore?.()

    return await new Promise<string>((resolve) => {
      try {
        canvas.toDataURL((err: any, nextDataURL: string) => {
          resolve(err || !nextDataURL ? dataURL : nextDataURL)
        })
      } catch {
        resolve(dataURL)
      }
    })
  } catch {
    return dataURL
  }
}

const getSVGDimensions = (svgText: string, fallback?: any) => {
  const viewBoxMatch = svgText.match(
    /\bviewBox=["'][^"']*?\s([\d.]+)\s([\d.]+)["']/i
  )
  if (viewBoxMatch) {
    return {
      width: Number(viewBoxMatch[1]) || 0,
      height: Number(viewBoxMatch[2]) || 0
    }
  }

  const widthMatch = svgText.match(/\bwidth=["']([\d.]+)(?:px)?["']/i)
  const heightMatch = svgText.match(/\bheight=["']([\d.]+)(?:px)?["']/i)

  return {
    width:
      Number(widthMatch?.[1]) ||
      Number(fallback?.realWidth) ||
      Number(fallback?.width) ||
      0,
    height:
      Number(heightMatch?.[1]) ||
      Number(fallback?.realHeight) ||
      Number(fallback?.height) ||
      0
  }
}

const getFooterOptions = (style: any): FooterOptions | null => {
  const text = String(style?.footer || '').trim()
  if (!text) return null

  return {
    text,
    font: String(
      style?.footerFont ||
        style?.subTitleFont ||
        'normal normal 600 14px sans-serif'
    ),
    color: String(style?.footerColor || style?.subTitleColor || '#222222'),
    bottom: Number(style?.footerBottom) || 18,
    textPadding: Number(style?.footerTextPadding) || 0
  }
}

const drawFooterOnCanvas = (canvas: any, context: any, style: any) => {
  const footer = getFooterOptions(style)
  if (!footer || !canvas || !context?.fillText) return false

  try {
    context.save?.()
    context.font = footer.font
    context.fillStyle = footer.color
    context.textAlign = 'center'
    // context.textBaseline = 'alphabetic'
    context.textBaseline = 'bottom'
    context.fillText(
      footer.text,
      canvas.width / 2,
      canvas.height - footer.bottom
    )
    // to debug:
    // context.fillRect(0, canvas.height - 30, canvas.width, 20)
    context.restore?.()
    return true
  } catch {
    return false
  }
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const appendFooterToSVG = (
  svgText: string,
  style: any,
  qrCodeOptions?: any
) => {
  const footer = getFooterOptions(style)
  if (!footer || !svgText) return svgText

  // const width = Number(qrCodeOptions?.realWidth || style?.width || 0)
  // const height = Number(qrCodeOptions?.realHeight || style?.height || 0)
  const { width, height } = getSVGDimensions(svgText, qrCodeOptions || style)
  if (!width || !height) return svgText

  const footerNode = `<text x="${width / 2}" y="${
    height - footer.bottom
  }" fill="${escapeXml(
    footer.color
  )}" text-anchor="middle" xml:space="preserve" style="font:${escapeXml(
    footer.font
  )}">${escapeXml(footer.text)}</text>`

  return svgText.replace(/<\/svg>\s*$/i, `${footerNode}</svg>`)
}

const getNodeRuntime = async () => {
  if (!nodeRuntimePromise) {
    nodeRuntimePromise = (async () => {
      const [{ createRequire }, path, { fileURLToPath }] = await Promise.all([
        runtimeImport('node:module'),
        runtimeImport('node:path'),
        runtimeImport('node:url')
      ])
      const require = createRequire(
        typeof __filename === 'string'
          ? __filename
          : `${process.cwd()}/package.json`
      )

      const QRCode = require('./easyqrcodejs-node.cjs')
      const canvasCompat = require('@napi-rs/canvas/node-canvas')
      const _QRCode = QRCode?.default || QRCode

      return {
        _QRCode,
        QRCode: _QRCode,
        Canvas: canvasCompat?.Canvas || null,
        Image: canvasCompat?.Image || null,
        createCanvas: canvasCompat?.createCanvas || null,
        loadImage: canvasCompat?.loadImage || null,
        registerFont:
          canvasCompat?.registerFont ||
          canvasCompat?.GlobalFonts?.registerFromPath ||
          null,
        path,
        fileURLToPath
      }
    })()
  }

  return nodeRuntimePromise
}

export default async (): Promise<QRLoaderResult> => {
  const isNode = typeof process === 'object' && !!(<any>process)?.versions?.node

  if (isNode) {
    const runtime = await getNodeRuntime()
    const { _QRCode, QRCode, Canvas, registerFont } = runtime

    const createQRCode = (options: ObjectType) =>
      new QRCode({ ...(options || {}) })

    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      items.forEach((item) => {
        nodeFontRegistry.push(item)
      })

      uniqueFontRegistry().forEach(({ file, def }) => {
        if (!registerFont) return
        const fontPath = resolveNodeFontPath(String(file || ''), runtime)
        if (!fontPath) return
        try {
          registerFont(fontPath, {
            family: String(def?.family || 'GameChangerFont'),
            weight: String(def?.weight || 'normal'),
            style: String(def?.style || 'normal')
          })
        } catch {
          // Keep current behavior best-effort for duplicated or unsupported font registrations.
        }
      })
    }

    const renderQRCode = async (args: {
      text: string
      style: any
    }): Promise<any> => {
      const qr = createQRCode({
        ...(args.style || {}),
        text: args.text
      })

      // let dataURL = await qr.toDataURL()
      // if (
      //   drawFooterOnCanvas(
      //     qr?._oDrawing?._canvas,
      //     qr?._oDrawing?._oContext,
      //     args.style
      //   )
      // ) {
      //   dataURL = qr?._oDrawing?._canvas?.toDataURL?.() || dataURL
      // }
      let dataURL = await qr.toDataURL()
      dataURL = await addFooterToPNGDataURL(dataURL, args.style, runtime)

      let SVGText = await qr.toSVGText()
      SVGText = appendFooterToSVG(SVGText, args.style, qr?._htOption)

      return {
        qr,
        qrCodeOptions: qr?._htOption,
        dataURL,
        SVGText
      }
    }

    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }
  }

  const easyQRCodeModule = await import('easyqrcodejs')
  const QRCode =
    (<any>window)?.QRCode ||
    (<any>easyQRCodeModule)?.QRCode ||
    (<any>easyQRCodeModule)?.default ||
    easyQRCodeModule
  const _QRCode = (<any>window)?.QRCode || QRCode //replaceable by a wrapper class
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
    return new Promise(async (resolve) => {
      let qr: any
      qr = createQRCode({
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
  //TODO: fix paths on browser by bundling the files. Maybe as a blob or dataURI?
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

//Example wrapper for future reference
// class QRCode extends _QRCode {
//   private _htOption!: ObjectType

//   constructor(options: ObjectType) {
//     //const { width, height } = options
//     // const canvas = Canvas.createCanvas(width, height)
//     // if (!canvas) throw new Error('canvas creation failed on nodejs')
//     super(options)
//   }

//   changeStyles(styles: ObjectType) {
//     this._htOption = {
//       ...(this._htOption || {}),
//       ...styles
//     }
//   }
// }
