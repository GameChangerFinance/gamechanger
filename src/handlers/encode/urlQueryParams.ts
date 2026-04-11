import { DefaultNetwork, NetworkType } from '../../types'

export const buildWalletQueryParams = (args: {
  network?: NetworkType
  refAddress?: string
  disableNetworkRouter?: boolean
  /**
   * Optional URL pattern used to build the base wallet URL.
   * Currently unused here, but accepted for forward compatibility and
   * for symmetry with other handlers that pass the value through.
   */
  urlPattern?: string
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
