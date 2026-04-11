import { ObjectType } from '../types'
import {
  appendFooterToSVG,
  getFooterOptions,
  QRLoaderResult
} from './easyqrcodejs.shared'

type FontRegistryItem = { file: string; def: any }

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

  const renderQRCode = async (args: { text: string; style: any }) => {
    const qr = createQRCode({
      ...(args.style || {}),
      text: args.text
    })

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
