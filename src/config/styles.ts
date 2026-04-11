import { DefaultQRSubTitle, DefaultQRTitle } from '../types'
//import { resolveGlobal } from '../utils'

import logoURL from '../assets/images/dapp-logo.png'
import backgroundURL from '../assets/images/dapp-bg.png'

export const size = 1024

export const QR_FOOTER_TEXT = `Review details in wallet`

// A modern, readable,leaning sans stack with emoji fallbacks.
// NOTE: quote family names with spaces to keep the canvas font parser happy.
export const QR_FONT_FAMILY =
  // 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  'system-ui, -apple-system, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
// 'Roboto, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

export const QR_TITLE_FONT_SIZE_PX = 30
export const QR_SUBTITLE_FONT_SIZE_PX = 24

// Footer intentionally matches subtitle size.
export const QR_FOOTER_FONT_SIZE_PX = QR_SUBTITLE_FONT_SIZE_PX + 2

// Truncate text in QRs with trailing dots based on these maximum lenghts:
export const QR_TITLE_MAX_LEN = 57
export const QR_SUBTITLE_MAX_LEN = 80
export const QR_FOOTER_MAX_LEN = 70

// Baseline offsets relative to the quietZone (keeps text inside the top margin).
// These are tuned for the default font sizes above.
export const QR_TITLE_TOP = -30
export const QR_SUBTITLE_TOP = -9

// Footer baseline offset from the bottom edge of the whole image.
export const QR_FOOTER_BOTTOM = 18

// Extra horizontal padding so text never touches the image border.
export const QR_TEXT_PADDING_PX = 26

export const QR_QUIET_ZONE = 65

export const QR_FONT_SIZE_FACTOR = 1.1

type StyleType = {
  [name: string]: { [name: string]: string | undefined | number | boolean }
}

const toCleanString = (value: any) => {
  if (value == null) return ''
  return String(value).trim()
}

export const truncateQRText = (value: any, maxLen: number) => {
  const text = toCleanString(value)
  if (!text) return ''
  if (!Number.isFinite(maxLen) || maxLen <= 0 || text.length <= maxLen) {
    return text
  }

  const targetLen = Math.max(0, Math.floor(maxLen) - 3)
  return `${text.slice(0, targetLen).trimEnd()}...`
}

export const getQRFontScale = (qrDimension?: number) => {
  const dimension = Number(qrDimension)
  if (!Number.isFinite(dimension) || dimension <= 0) {
    return QR_FONT_SIZE_FACTOR
  }

  return (dimension / size) * QR_FONT_SIZE_FACTOR
}

export const getQRFontSizePx = (basePx: number, qrDimension?: number) => {
  const scaled = Math.round(basePx * getQRFontScale(qrDimension))
  return Math.max(1, scaled)
}

export const getQRFont = (fontSizePx: number, weight = 'bold') =>
  `normal normal ${weight} ${fontSizePx}px ${QR_FONT_FAMILY}`

export const resolveQRStyle = (
  style: { [name: string]: any },
  gcscript?: { title?: string; description?: string }
) => {
  const width = Number(style?.width) || size
  const height = Number(style?.height) || size
  const qrDimension = Math.min(width, height)

  const title = truncateQRText(
    gcscript?.title || style?.title || DefaultQRTitle,
    QR_TITLE_MAX_LEN
  )
  const subTitle = truncateQRText(
    gcscript?.description || style?.subTitle || DefaultQRSubTitle,
    QR_SUBTITLE_MAX_LEN
  )
  const footer = truncateQRText(
    style?.footer || QR_FOOTER_TEXT,
    QR_FOOTER_MAX_LEN
  )

  const titleFontSize = getQRFontSizePx(QR_TITLE_FONT_SIZE_PX, qrDimension)
  const subTitleFontSize = getQRFontSizePx(
    QR_SUBTITLE_FONT_SIZE_PX,
    qrDimension
  )
  const footerFontSize = getQRFontSizePx(QR_FOOTER_FONT_SIZE_PX, qrDimension)

  const titleColor =
    typeof style?.titleColor === 'string' ? style.titleColor : '#111111'
  const subTitleColor =
    typeof style?.subTitleColor === 'string' ? style.subTitleColor : '#222222'
  const footerColor =
    typeof style?.footerColor === 'string' ? style.footerColor : '#222222'

  return {
    ...(style || {}),
    width,
    height,
    quietZone: QR_QUIET_ZONE,
    title,
    subTitle,
    titleTop: QR_TITLE_TOP,
    subTitleTop: QR_SUBTITLE_TOP,
    titleFont: getQRFont(titleFontSize, 'bold'),
    subTitleFont: getQRFont(subTitleFontSize, '600'),
    footer,
    footerBottom: QR_FOOTER_BOTTOM,
    footerFont: getQRFont(footerFontSize, '600'),
    footerColor,
    footerTextPadding: QR_TEXT_PADDING_PX,
    titleColor,
    subTitleColor
  }
}

export default () => {
  // const logoURL = await resolveGlobal('../assets/images/dapp-logo-bg.png')
  // const backgroundURL = await resolveGlobal('../assets/images/background.png')

  const defaultTemplate = {
    text: '',
    width: size,
    height: size,
    colorDark: '#000000',
    colorLight: 'rgba(0,0,0,0)',
    drawer: 'canvas',
    logo: logoURL,
    logoBackgroundTransparent: false,
    logoBackgroundColor: '#26ca80',
    logoWidth: 433,
    logoHeight: 118, //123,
    dotScale: 1,
    backgroundImage: backgroundURL,
    autoColor: false,
    quietZone: QR_QUIET_ZONE
  }

  const styles: StyleType = {
    //default: defaultTemplate,
    boxed: resolveQRStyle({
      ...defaultTemplate,
      quietZone: QR_QUIET_ZONE,
      quietZoneColor: 'rgba(0,0,0,0)',
      title: DefaultQRTitle,
      subTitle: DefaultQRSubTitle,
      titleTop: QR_TITLE_TOP,
      subTitleTop: QR_SUBTITLE_TOP,
      titleHeight: 0,
      titleBackgroundColor: 'rgba(0,0,0,0)',
      titleColor: '#111111',
      subTitleColor: '#222222',
      titleFont: getQRFont(QR_TITLE_FONT_SIZE_PX, 'bold'),
      subTitleFont: getQRFont(QR_SUBTITLE_FONT_SIZE_PX, '600')
    }),
    printable: resolveQRStyle({
      ...defaultTemplate,
      logo: undefined,
      logoWidth: undefined,
      logoHeight: undefined,
      colorDark: '#000000',
      colorLight: '#ffffff',
      backgroundImage: undefined,
      title: DefaultQRTitle,
      subTitle: DefaultQRSubTitle,
      quietZone: QR_QUIET_ZONE,
      quietZoneColor: 'rgba(0,0,0,0)',
      titleTop: QR_TITLE_TOP,
      subTitleTop: QR_SUBTITLE_TOP,
      titleHeight: 0,
      titleBackgroundColor: '#ffffff',
      titleColor: '#000000',
      subTitleColor: '#000000',
      titleFont: getQRFont(QR_TITLE_FONT_SIZE_PX, 'bold'),
      subTitleFont: getQRFont(QR_SUBTITLE_FONT_SIZE_PX, '600')
    })
  }

  const fonts: Array<{ file: string; def: { family: string } }> = []
  return { styles, fonts }
}
