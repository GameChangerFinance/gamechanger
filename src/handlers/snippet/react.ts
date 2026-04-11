import {
  APIVersion,
  NetworkType,
  APIEncoding,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'
import {
  buildHtmlLikeReplacements,
  replaceSnippetPlaceholders,
  toUtf8DataUri
} from './helpers'
import template from './templates/template-react'

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
  refAddress?: string
  disableNetworkRouter?: boolean
  urlPattern?: string
  snippetArgs?: any
  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string
}) => {
  try {
    const validated = validateBuildMsgArgs(args)
    const script = JSON.parse(validated.input)
    const replacements = buildHtmlLikeReplacements(
      {
        ...validated,
        refAddress: args.refAddress,
        disableNetworkRouter: args.disableNetworkRouter,
        urlPattern: args.urlPattern
      },
      script,
      undefined,
      args.snippetArgs
    )
    const text = replaceSnippetPlaceholders(template, replacements)
    return toUtf8DataUri('text/html', text)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error('URL generation failed. ' + err.message)
    }
    throw new Error('URL generation failed. Unknown error')
  }
}
