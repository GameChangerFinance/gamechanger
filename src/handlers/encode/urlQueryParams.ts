import { DefaultNetwork, NetworkType } from '../../types'

/**
 * Handlers are the opinionated layer that adapts the generic encoders to the
 * wallet routing conventions.
 *
 * Encoders remain GC-agnostic and only receive already-normalized generic URL
 * query parameters.
 */
export const buildWalletQueryParams = (args: {
  network?: NetworkType
  refAddress?: string
  disableNetworkRouter?: boolean
}) => {
  const queryParams: { [key: string]: string } = {}

  if (!args?.disableNetworkRouter) {
    queryParams.networkTag = args?.network || DefaultNetwork
  }

  if (args?.refAddress) {
    queryParams.ref = args.refAddress
  }

  return queryParams
}

export default buildWalletQueryParams
