import type { ObjectType } from '../types'

export type QRLoaderResult = {
  _QRCode: any
  QRCode: any
  Canvas: any
  createQRCode: (options: ObjectType) => any
  renderQRCode: (args: { text: string; style: any }) => Promise<any>
  registerFonts: (items: Array<{ file: string; def: any }>) => void
}

export type FontRegistryItem = { file: string; def: any }

export type FooterOptions = {
  text: string
  font: string
  color: string
  bottom: number
  textPadding: number
}

export type HandledQRError = Error & {
  handled: true
  isHandled: true
  originalError?: unknown
}

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error == null) return 'Unknown error'

  try {
    return String(error)
  } catch {
    return 'Unknown error'
  }
}

export const toHandledQRError = (error: unknown): HandledQRError => {
  if (
    error instanceof Error &&
    ((error as any).handled === true || (error as any).isHandled === true)
  ) {
    return error as HandledQRError
  }

  const sourceError =
    error instanceof Error ? error : new Error(getErrorMessage(error))
  const handledError = new Error(sourceError.message) as HandledQRError

  handledError.name = sourceError.name || 'Error'
  handledError.stack = sourceError.stack
  handledError.handled = true
  handledError.isHandled = true
  handledError.originalError = error

  return handledError
}

export const getSVGDimensions = (svgText: string, fallback?: any) => {
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

export const getFooterOptions = (style: any): FooterOptions | null => {
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

export const drawFooterOnCanvas = (canvas: any, context: any, style: any) => {
  const footer = getFooterOptions(style)
  if (!footer || !canvas || !context?.fillText) return false

  try {
    context.save?.()
    context.font = footer.font
    context.fillStyle = footer.color
    context.textAlign = 'center'
    context.textBaseline = 'bottom'
    context.fillText(
      footer.text,
      canvas.width / 2,
      canvas.height - footer.bottom
    )
    context.restore?.()
    return true
  } catch {
    return false
  }
}

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const appendFooterToSVG = (
  svgText: string,
  style: any,
  qrCodeOptions?: any
) => {
  const footer = getFooterOptions(style)
  if (!footer || !svgText) return svgText

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
