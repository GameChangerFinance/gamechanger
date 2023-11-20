export type NetworkType = 'preprod' | 'mainnet'
export type APIEncoding =
  | 'json-url-lzw'
  | 'json-url-lzma'
  | 'gzip'
  | 'base64url'
export type APIVersion = '1' | '2'

export const DefaultNetwork: NetworkType = 'mainnet'
export const DefaultAPIVersion: APIVersion = '2'
export const DefaultAPIEncodings: { [apiVer: string]: APIEncoding } = {
  '1': 'json-url-lzw',
  '2': 'gzip'
}

export type EncodingHandler = {
  name: string
  encoder: (obj: any, options?: any) => Promise<string>
  decoder: (msg: string, options?: any) => Promise<any>
}

export type HandlerInputType =
  | {
      apiVersion: '1'
      network: NetworkType
      encoding: 'json-url-lzw'
      inputData: string
    }
  | {
      apiVersion: '2'
      network: NetworkType
      encoding: 'json-url-lzma' | 'gzip' | 'base64url'
      inputData: string
    }

export type CLIHandlerContext = {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string

  outputFile?: string
  template?: string //for QR 'default' | 'boxed' | 'printable'
  styles?: string //JSON
  debug?: boolean
}

export type SourceType = {
  [name: string]: () => Promise<any>
}

export type ActionHandlerLoaderType = {
  [action: string]: {
    [name: string]: () => Promise<(input: CLIHandlerContext) => any>
  }
}
export type ActionHandlerType = {
  [action: string]: {
    [name: string]: (input: CLIHandlerContext) => any
  }
}
export type ExecuteType = {
  network: NetworkType
  action: (input: HandlerInputType) => Promise<any>
  source: () => Promise<string>
}

export type ObjectType = { [name: string]: any }
export type QRTemplateType = 'boxed' | 'printable'
export const DefaultQRTemplate: QRTemplateType = 'boxed'
export const DefaultQRTitle = 'Dapp Connection'
export const DefaultQRSubTitle = 'scan to execute | escanear para ejecutar'
