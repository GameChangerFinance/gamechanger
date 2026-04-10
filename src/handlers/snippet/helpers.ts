import { Buffer } from 'buffer'
import { GCDomains /*, contact*/ } from '../../config'
import {
  APIEncoding,
  APIVersion,
  DefaultAPIVersion,
  DefaultNetwork,
  NetworkType,
  QRTemplateType
} from '../../types'

export type SnippetHandlerArgs = {
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
}

export const snippetTokens = {
  title: '$#___TITLE___#$',
  description: '$#___DESCRIPTION___#$',
  appId: '$#___APP_ID___#$',
  appVersion: '$#___APP_VERSION___#$',
  appYear: '$#___APP_YEAR___#$',
  defaultIntentsBlock: '$#___DEFAULT_INTENTS_BLOCK___#$',
  url: '$#___URL___#$',
  apiVersion: '$#___API_VERSION___#$',
  network: '$#___NETWORK___#$',
  encoding: '$#___ENCODING___#$',
  refAddress: '$#___REF_ADDRESS___#$',
  disableNetworkRouter: '$#___DISABLE_NETWORK_ROUTER___#$',
  gcScript: '$#___GC_SCRIPT___#$',
  origin: '$#___ORIGIN___#$',
  playgroundUrl: '$#___PLAYGROUND_URL___#$',
  twitterUrl: '$#___TWITTER_URL___#$',
  discordUrl: '$#___DISCORD_URL___#$',
  youtubeUrl: '$#___YOUTUBE_URL___#$',
  githubUrl: '$#___GITHUB_URL___#$',
  websiteUrl: '$#___WEBSITE_URL___#$',
  encodingsArray: '$#___ENCODINGS_ARRAY___#$',
  selectedEncoding: '$#___SELECTED_ENCODING___#$'
} as const

const defaultHtmlLikeTitle = 'Cardano Dapp'
const defaultHtmlLikeDescription =
  'Review the action details below and continue in GameChanger Wallet.'
const currentYear = new Date().getFullYear().toString()

const connectIntentDefinition = {
  label: 'Connect wallet',
  description: 'Share public wallet information with this dapp.',
  code: {
    type: 'script',
    title: 'Connect with this dapp?',
    description: 'About to share public wallet information with the dapp.',
    exportAs: 'connect',
    run: {
      name: { type: 'getName' },
      address: { type: 'getCurrentAddress' },
      // spendPubKey: { type: 'getSpendingPublicKey' },
      // stakePubKey: { type: 'getStakingPublicKey' },
      addressInfo: {
        type: 'macro',
        run: "{getAddressInfo(get('cache.address'))}"
      }
    }
  }
}

export const replaceSnippetPlaceholders = (
  template: string,
  replacements: Record<string, string>
) => {
  let output = template.split('\\`').join('`').split('\\${').join('${')
  for (const key of Object.keys(replacements)) {
    output = output.split(key).join(replacements[key])
  }
  const unresolved = output.match(/\$#___[A-Z0-9_]+___#\$/g)
  if (unresolved && unresolved.length > 0) {
    throw new Error(
      `Unresolved snippet placeholders: ${Array.from(new Set(unresolved)).join(
        ', '
      )}`
    )
  }
  return output
}

export const toUtf8DataUri = (mimeType: string, text: string) =>
  `data:${mimeType};charset=utf-8;base64,${Buffer.from(text, 'utf8').toString(
    'base64'
  )}`

export const toJSLiteral = (value?: string) =>
  value === undefined ? 'undefined' : JSON.stringify(value)

export const toBooleanLiteral = (value?: boolean) => (value ? 'true' : 'false')

export const resolveSnippetOrigin = (
  apiVersion?: APIVersion,
  network?: NetworkType
) => GCDomains[apiVersion || DefaultAPIVersion][network || DefaultNetwork]

export const normalizeHtmlZeroEncoding = (encoding: APIEncoding) => {
  if (encoding === 'base64url') return encoding
  return 'gzip'
}

export const resolveHtmlLikeDappTitle = (_script: any) => {
  // if (script && typeof script.title === 'string' && script.title.trim()) {
  //   return script.title.trim()
  // }
  return defaultHtmlLikeTitle
}
export const resolveHtmlLikeDappDescription = (_script: any) => {
  // if (
  //   script &&
  //   typeof script.description === 'string' &&
  //   script.description.trim()
  // ) {
  //   return script.description.trim()
  // }
  return defaultHtmlLikeDescription
}

export const resolveHtmlLikeTitle = (script: any) => {
  if (script && typeof script.title === 'string' && script.title.trim()) {
    return script.title.trim()
  }
  return defaultHtmlLikeTitle
}

export const resolveHtmlLikeDescription = (script: any) => {
  if (
    script &&
    typeof script.description === 'string' &&
    script.description.trim()
  ) {
    return script.description.trim()
  }
  return defaultHtmlLikeDescription
}

export const buildSnippetAppId = (script: any) => {
  const source =
    script && typeof script.title === 'string' && script.title.trim()
      ? script.title.trim()
      : defaultHtmlLikeTitle
  const slug = source
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '')
  if (slug) return `gc-dapp-${slug}`
  return 'gc-dapp-example'
}

const indentBlock = (value: string, spaces: number) => {
  const padding = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n')
}

const commentOutBlock = (value: string, spaces: number) => {
  const padding = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => `${padding}// ${line}`)
    .join('\n')
}

const formatPropertyLiteral = (
  propertyName: string,
  value: unknown,
  withTrailingComma = false
) => {
  const json = JSON.stringify(value, null, 2).split('\n')
  const lines = [`${propertyName}: ${json[0]}`]
  for (let index = 1; index < json.length; index += 1) {
    lines.push(json[index])
  }
  if (withTrailingComma) {
    lines[lines.length - 1] = lines[lines.length - 1] + ','
  }
  return lines.join('\n')
}

export const buildHtmlLikeDefaultIntentsBlock = (script: any) => {
  const connectBlock = formatPropertyLiteral(
    'connect',
    connectIntentDefinition,
    true
  )
  const userIntentDefinition = {
    label: resolveHtmlLikeTitle(script),
    description: resolveHtmlLikeDescription(script),
    code: script
  }
  const userIntentBlock = formatPropertyLiteral(
    'userIntent',
    userIntentDefinition
  )
  return [
    '{',
    '        // Uncomment the connect intent below to enable the most common wallet connection UX out of the box.',
    '        // Intent-based Cardano dapps do not require a mandatory wallet connection to work.',
    commentOutBlock(connectBlock, 8),
    indentBlock(userIntentBlock, 8),
    '      }'
  ].join('\n')
}

export const buildHtmlLikeReplacements = (
  script: any,
  version = '0.0.1'
): Record<string, string> => ({
  [snippetTokens.title]: resolveHtmlLikeDappTitle(script),
  [snippetTokens.description]: resolveHtmlLikeDappDescription(script),
  [snippetTokens.appId]: buildSnippetAppId(script),
  [snippetTokens.appVersion]: version,
  [snippetTokens.appYear]: currentYear,
  [snippetTokens.defaultIntentsBlock]: buildHtmlLikeDefaultIntentsBlock(script)
})

export const buildHtmlZeroReplacements = (
  args: SnippetHandlerArgs,
  script: any
): Record<string, string> => {
  const origin = resolveSnippetOrigin(args.apiVersion, args.network)
  return {
    [snippetTokens.title]: resolveHtmlLikeTitle(script),
    [snippetTokens.description]: resolveHtmlLikeDescription(script),
    [snippetTokens.appYear]: currentYear,
    [snippetTokens.apiVersion]: JSON.stringify(args.apiVersion),
    [snippetTokens.network]: JSON.stringify(args.network),
    [snippetTokens.encoding]: JSON.stringify(args.encoding),
    [snippetTokens.selectedEncoding]: JSON.stringify(
      normalizeHtmlZeroEncoding(args.encoding)
    ),
    [snippetTokens.refAddress]: toJSLiteral(args.refAddress),
    [snippetTokens.disableNetworkRouter]: toBooleanLiteral(
      args.disableNetworkRouter
    ),
    [snippetTokens.gcScript]: JSON.stringify(script, null, 2),
    [snippetTokens.origin]: JSON.stringify(origin),
    // TODO: Normalize all this way in the future!
    // [snippetTokens.playgroundUrl]: JSON.stringify(`${origin}playground`),// fix this one
    // [snippetTokens.twitterUrl]: JSON.stringify(contact.twitter),
    // [snippetTokens.discordUrl]: JSON.stringify(contact.discord),
    // [snippetTokens.youtubeUrl]: JSON.stringify(contact.youtube),
    // [snippetTokens.githubUrl]: JSON.stringify(contact.github),
    // [snippetTokens.websiteUrl]: JSON.stringify(contact.website),
    [snippetTokens.encodingsArray]: JSON.stringify(['gzip', 'base64url'])
  }
}
