import handler from 'src/handlers/encode/url'
import {
  APIEncoding,
  APIVersion,
  NetworkType,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'
import {
  replaceSnippetPlaceholders,
  snippetTokens,
  toUtf8DataUri
} from './helpers'
import template from './templates/template-button'

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
  refAddress?: string
  disableNetworkRouter?: boolean
  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string
}) => {
  try {
    const validated = validateBuildMsgArgs(args)
    const url = await handler({
      apiVersion: validated.apiVersion,
      network: validated.network,
      encoding: validated.encoding,
      input: validated.input,
      debug: args.debug,
      refAddress: args.refAddress,
      disableNetworkRouter: args.disableNetworkRouter
    })
    const text = replaceSnippetPlaceholders(template, {
      [snippetTokens.url]: url
    })
    return toUtf8DataUri('text/html', text)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error('URL generation failed. ' + err.message)
    }
    throw new Error('URL generation failed. Unknown error')
  }
}
