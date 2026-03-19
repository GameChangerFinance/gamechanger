import { DefaultNetwork, NetworkType } from '../../types'


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
