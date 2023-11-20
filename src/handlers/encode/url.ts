import { GCDappConnUrls } from '../../config'
import { APIEncoding, APIVersion, NetworkType } from '../../types'
import { validateBuildMsgArgs } from '../../utils'

import urlEncoder from '../../encodings/url'

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
}) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)

    const obj = JSON.parse(input)
    const urlPattern = GCDappConnUrls[apiVersion][network]
    if (!urlPattern)
      throw new Error(`Missing URL pattern for network '${network || ''}'`)
    const url = await urlEncoder.encoder(obj, {
      urlPattern,
      encoding
    })

    return url
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
