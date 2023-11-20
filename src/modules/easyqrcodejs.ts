import Canvas from 'canvas'
import path from 'path'
import { ObjectType } from '../types'

export default async () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  //const useGlobal = isNode ? global : window;

  /**
   * Trick:
   * by using this dynamic argument on `import(pathStr)`
   * I prevent rollup commonJs plugin to detect and auto-process the imported js files
   *
   * Excluding the files on rollup configs is producing bugs elsewhere. This solves it well for all targets
   */
  const pathStr = isNode
    ? 'easyqrcodejs-nodejs'
    : '../../dist/easy.qrcode.min.js'
  //: 'https://cdn.jsdelivr.net/npm/easyqrcodejs@4.6.0/dist/easy.qrcode.min.js' //'json-url/dist/browser/json-url-single.js'

  if (isNode) {
    const _QRCode = await import(pathStr).then((d) => d?.default) //QRCode4Node //require('easyqrcodejs-nodejs')
    //const path = require('path')
    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options: ObjectType) => {
      // const canvas = require('canvas').createCanvas(options.width, options.height) //https://github.com/Automattic/node-canvas
      return new QRCode(options)
    }
    const renderQRCode = async (args: {
      text: string
      style: any
    }): Promise<any> => {
      return new Promise(async (resolve) => {
        const options = {
          ...(args.style || {}),
          text: args.text
        }
        const qr = createQRCode(options)
        resolve({
          qr,
          qrCodeOptions: options,
          dataURL: await qr.toDataURL(),
          SVGText: await qr.toSVGText()
        })
      })
    }
    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = path.resolve(__dirname, file)
        // console.log(
        //   `Registering font '${fontPath}' (${
        //     def?.family || 'Unknown'
        //   }) on NodeJS Canvas...`
        // )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          throw new Error(
            `Error registering font '${fontPath}' (${
              def?.family || 'Unknown'
            }) on NodeJS Canvas. ${err}`
          )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }

    // return {
    //   _QRCode: {},
    //   QRCode: {},
    //   Canvas: {},
    //   createQRCode: () => {},
    //   renderQRCode: () => {},
    //   registerFonts: () => {}
    // }
  } else {
    //const _QRCode = await import('easyqrcodejs/dist/easy.qrcode.min.js').then(() => {
    //const _QRCode = await import('easyqrcodejs/src/easy.qrcode').then(() => {
    //WORKS but nodejs version breaks it on browser?
    //const _QRCode = await import('easyqrcodejs').then(() => {
    const _QRCode = await import('easyqrcodejs').then(() => {
      return (<any>window)?.QRCode
    })

    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options: ObjectType) => {
      const canvas = document.createElement('canvas')
      if (!canvas) throw new Error('canvas creation failed on browser')
      return new QRCode(canvas, options)
    }
    const renderQRCode = async (args: {
      text: string
      style: any
    }): Promise<any> => {
      return new Promise(async (resolve) => {
        const qr = createQRCode({
          ...(args.style || {}),
          text: args.text,
          onRenderingEnd: (qrCodeOptions: any, dataURL: string) => {
            //console.dir({ dataURL, qrCodeOptions })
            resolve({ qr, qrCodeOptions, dataURL, SVGText: '' })
          }
        })
      })
    }
    //TODO: fix paths on browser by bundling the files. Maybe as a blob or dataURI?
    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = file
        // console.log(
        //   `Registering font '${fontPath}' (${
        //     def?.family || 'Unknown'
        //   }) on Browser Canvas...`
        // )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          // throw new Error(
          //   `Error registering font '${fontPath}' (${
          //     def?.family || 'Unknown'
          //   }) on Browser Canvas. ${err}`
          // )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }

    // return {
    //   _QRCode: {},
    //   QRCode: {},
    //   Canvas: {},
    //   createQRCode: () => {},
    //   renderQRCode: () => {},
    //   registerFonts: () => {}
    // }
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
