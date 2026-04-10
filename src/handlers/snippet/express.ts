import { APIEncoding, APIVersion, NetworkType } from '../../types'
import { validateBuildMsgArgs } from '../../utils'
import {
  replaceSnippetPlaceholders,
  snippetTokens,
  toBooleanLiteral,
  toJSLiteral,
  toUtf8DataUri
} from './helpers'
import template from './templates/template-express'

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
  refAddress?: string
  disableNetworkRouter?: boolean
}) => {
  try {
    const validated = validateBuildMsgArgs(args)
    const script = JSON.parse(validated.input)
    const text = replaceSnippetPlaceholders(template, {
      [snippetTokens.gcScript]: JSON.stringify(script, null, 2),
      [snippetTokens.apiVersion]: toJSLiteral(validated.apiVersion),
      [snippetTokens.network]: toJSLiteral(validated.network),
      [snippetTokens.encoding]: toJSLiteral(validated.encoding),
      [snippetTokens.refAddress]: toJSLiteral(args.refAddress),
      [snippetTokens.disableNetworkRouter]: toBooleanLiteral(
        args.disableNetworkRouter
      )
    })
    return toUtf8DataUri('application/javascript', text)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error('URL generation failed. ' + err.message)
    }
    throw new Error('URL generation failed. Unknown error')
  }
}
