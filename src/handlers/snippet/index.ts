import ButtonEncoder from './button'
import HtmlEncoder from './html'
import HtmlZeroEncoder from './html-zero'
import ExpressEncoder from './express'
import ReactEncoder from './react'

export default {
  button: ButtonEncoder,
  html: HtmlEncoder,
  'html-zero': HtmlZeroEncoder,
  express: ExpressEncoder,
  react: ReactEncoder
}
