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

      const [dataURL, SVGText] = await Promise.all([
        qr.toDataURL(),
        qr.toSVGText()
      ])

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
          //console.dir({ dataURL, qrCodeOptions })
          const isSVGText =
            typeof dataURL === 'string' && dataURL.trim().startsWith('<svg')
          queueMicrotask(() => {
            resolve({
              qr,
              qrCodeOptions,
              dataURL,
              SVGText: isSVGText ? dataURL : ''
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
