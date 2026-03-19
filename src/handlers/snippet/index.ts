import ButtonEncoder from './button'
import HtmlEncoder from './html'
import ExpressEncoder from './express'
import ReactEncoder from './react'

/**
 * Handlers are the opinionated layer that adapts the generic encoders to the
 * wallet routing conventions.
 *
 * Encoders remain GC-agnostic and should only receive generic parameters, like generic URL
 * query parameters.
 */
export default {
  button: ButtonEncoder,
  html: HtmlEncoder,
  express: ExpressEncoder,
  react: ReactEncoder
}
