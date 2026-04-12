import { GCDappConnUrls } from '../../config'
import { APIEncoding, APIVersion, NetworkType } from '../../types'
import { validateBuildMsgArgs, validateUrlPattern } from '../../utils'

import urlEncoder from '../../encodings/url'
import buildWalletQueryParams from './urlQueryParams'

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
  //new
  refAddress?: string
  disableNetworkRouter?: boolean
  urlPattern?: string
}) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)

    const obj = JSON.parse(input)
    const urlPattern = validateUrlPattern(
      args?.urlPattern ? args?.urlPattern : GCDappConnUrls[apiVersion][network]
    )
    const url = await urlEncoder.encoder(obj, {
      urlPattern,
      encoding,
      queryParams: buildWalletQueryParams({
        network,
        refAddress: args?.refAddress,
        disableNetworkRouter: args?.disableNetworkRouter,
        urlPattern
      })
    })

    return url
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
