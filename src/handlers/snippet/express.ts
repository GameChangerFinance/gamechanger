import { GCLibInSnippets } from 'src/config'
import { APIEncoding, APIVersion, NetworkType } from '../../types'
import { validateBuildMsgArgs } from '../../utils'
import {
  applySnippetArgs,
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
  urlPattern?: string
  snippetArgs?: any
}) => {
  try {
    const validated = validateBuildMsgArgs(args)
    const script = JSON.parse(validated.input)
    const finalText = replaceSnippetPlaceholders(
      template,
      applySnippetArgs(
        {
          [snippetTokens.gcLibNodeJsImports]: GCLibInSnippets.nodeJsOutputs,
          [snippetTokens.gcScript]: JSON.stringify(script, null, 2),
          [snippetTokens.apiVersion]: toJSLiteral(validated.apiVersion),
          [snippetTokens.network]: toJSLiteral(validated.network),
          [snippetTokens.encoding]: toJSLiteral(validated.encoding),
          [snippetTokens.refAddress]: toJSLiteral(args.refAddress),
          [snippetTokens.disableNetworkRouter]: toBooleanLiteral(
            args.disableNetworkRouter
          ),
          [snippetTokens.urlPattern]: toJSLiteral(args.urlPattern)
        },
        args?.snippetArgs
      )
    )
    return toUtf8DataUri('application/javascript', finalText)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error('URL generation failed. ' + err.message)
    }
    throw new Error('URL generation failed. Unknown error')
  }
}
