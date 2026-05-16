/* eslint-env es6 */

import gc from '../dist/nodejs.cjs'

const CLI_NAME = 'gamechanger-cli'
const DEFAULT_MAX_ERROR_CHARS = 160
const defaultConfig = gc.config
const defaultHandlers = {
  encode: gc.encode,
  snippet: gc.snippet,
  build: gc.build,
  validate: gc.validate
}

const preferredActionOrder = ['encode', 'snippet', 'build', 'validate']
const preferredSubActionOrder = {
  encode: ['url', 'qr'],
  snippet: ['html', 'html-zero', 'button', 'express', 'react'],
  build: ['file'],
  validate: ['file']
}

const actionDescriptions = {
  encode: 'Generate wallet connector artifacts from a valid GCScript.',
  snippet:
    'Generate ready-to-use dapp/snippet source files from a valid GCScript.',
  build:
    'Build a multi-file GCScript project into one strict JSON GCScript file.',
  validate: 'Validate built strict JSON GCScript and emit a JSON report.'
}

const subActionDescriptions = {
  encode: {
    url: 'generates a ready-to-use URL dapp connector',
    qr: 'generates a ready-to-use QR code image'
  },
  snippet: {
    html: 'generates a ready-to-use HTML dapp with shared app state and auto-rendered intent argument UI',
    'html-zero':
      'generates a resilient offline-ready zero-dependency HTML dapp',
    button: 'generates an embeddable HTML button snippet with a URL connector',
    express:
      'generates a Node.js Express backend that redirects users to the wallet',
    react:
      'generates a React dapp with shared app state and auto-rendered intent argument UI'
  },
  build: {
    file: 'builds a multi-file GCScript project into one final GCScript JSON file'
  },
  validate: {
    file: 'validates a built strict JSON GCScript file against the production language schema'
  }
}

const demoGCScript = {
  title: 'Get Address',
  description: 'Do you authorize sharing your address with this dapp?',
  type: 'script',
  exportAs: 'MyData',
  run: {
    address: {
      type: 'getCurrentAddress'
    }
  }
}

const demoGCScriptJson = JSON.stringify(demoGCScript)
const demoUrl =
  'https://wallet.gamechanger.finance/api/2/run/1-H4sIAAA...?networkTag=mainnet'

const escapeShellArg = (arg) => `'${String(arg).replace(/'/g, "'\\''")}'`

const uniqueOrdered = (values, preferred = []) => {
  const set = new Set(values || [])
  const ordered = preferred.filter((value) => set.delete(value))
  return [...ordered, ...Array.from(set).sort()]
}

const getActionNames = (handlers = defaultHandlers) =>
  uniqueOrdered(
    Object.keys(handlers || {}).filter(
      (name) => handlers?.[name] && typeof handlers[name] === 'object'
    ),
    preferredActionOrder
  )

const getSubActionNames = (action, handlers = defaultHandlers) =>
  uniqueOrdered(
    Object.keys(handlers?.[action] || {}),
    preferredSubActionOrder[action]
  )

const formatChoiceList = (values) =>
  values.map((value) => `'${value}'`).join(' | ')

const renderRows = (rows) => {
  const width = rows.reduce((max, [name]) => Math.max(max, name.length), 0)
  return rows
    .map(([name, description]) => {
      const padding = ' '.repeat(Math.max(0, width - name.length))
      return `\t'${name}'${padding} : ${description}`
    })
    .join('\n')
}

const renderCommonInputOutputOptions = () =>
  [
    '\t--args [gcscript] | -a [gcscript] : Load GCScript from arguments.',
    '\t--file [filename] | -f [filename] : Load GCScript from file.',
    '\twithout --args or --file       : Load GCScript from stdin.',
    '',
    '\t--outputFile [filename] | -o [filename] : Write generated artifact/report to a file.',
    '\twithout --outputFile                 : Write generated artifact/report to stdout.'
  ].join('\n')

const renderEncodeOptions = (config) =>
  [
    '\t--apiVersion [version] | -v [version] : Target API version.',
    `\tValid API versions: ${formatChoiceList(config.apiVersions || [])}`,
    '',
    '\t--encoding [encoding] | -e [encoding] : Target wallet message encoding.',
    `\tValid encodings by API version: ${JSON.stringify(
      config.apiEncodings || {}
    )}`,
    '',
    '\t--refAddress [cardanoAddress] | -r [cardanoAddress] : Append ref=<address> to generated wallet URLs and QRs.',
    '\t--disableNetworkRouter | -R : Do not append the default networkTag=<network> query parameter.',
    '\t--urlPattern [url] | -u [url] : Override the default wallet URL pattern. It must include {gcscript}.'
  ].join('\n')

const renderQrOptions = (config) =>
  [
    '\t--template [template] | -t [template] : QR predefined style.',
    `\tValid QR templates: ${formatChoiceList(
      config.QRTemplates || []
    )}. Default: ${config.DefaultQRTemplate}.`,
    `\tQR output type is inferred from --outputFile extension when it is ${formatChoiceList(
      config.QRRenderTypes || []
    )}. Without --outputFile, PNG is used.`
  ].join('\n')

const renderSnippetOptions = () =>
  [
    '\t--snippetArgs [json] | -A [json] : JSON map of snippet placeholder overrides.',
    '\t--snippetArgsFile [filename] : JSON file with snippet placeholder overrides.',
    '\tWhen both are provided, --snippetArgs wins over --snippetArgsFile per object property.',
    '\tUse {"defaultIntents":"..."} to override the whole defaultIntents block.',
    '',
    '\t--serve | -S : Serve HTML snippet outputs on http://localhost:3000.'
  ].join('\n')

const renderBuildOptions = (config) =>
  [
    '\t--cwd [path] | -C [path] : Working directory used by the CLI app:// resolver. Defaults to the current working directory.',
    `\t--fileUri [uri] | -U [uri] : Logical parent URI used by build. Defaults to ${config.DefaultMainFileAppURI}.`,
    `\t--allowProtocols [csv] : Build protocol allow-list. Defaults to ${(
      config.DefaultBuildAllowedProtocols || []
    ).join(',')}.`,
    '\t--allowedRemoteDomains [csv] : Optional exact or wildcard host allow-list for http(s) build imports.',
    '\t--compactOutput : Emit compact strict JSON.',
    '\t--noValidate : Disable schema validation during build. Validation is enabled by default.'
  ].join('\n')

const renderValidationOptions = (config) =>
  [
    `\t--schemaUrl [url] : Override the GCScript JSON schema URL. Defaults to ${config.GCScriptSchemaURL}.`,
    '\t--hide-warnings : Hide non-blocking validation warnings during build/validate.'
  ].join('\n')

const renderSharedFooter = () =>
  [
    '\t--quiet | -q : Disable non-essential human logs. Generated output still uses stdout when --outputFile is omitted.',
    '',
    'POSIX behavior:',
    '\tHuman help, progress, warnings, validation summaries, and errors are written to stderr.',
    '\tGenerated artifacts and JSON reports are written to stdout only when --outputFile is omitted.',
    '\tExit codes: encode/snippet/build succeed with 0 and fail non-zero; validate returns 0 only when isValid is true.'
  ].join('\n')

const renderTopUsage = ({ config, handlers }) => {
  const actions = getActionNames(handlers)
  return [
    '✨ GameChanger Wallet CLI',
    '\tOfficial GameChanger Wallet library and CLI for integrating Cardano in dapps and related workflows.',
    '',
    'Usage',
    `\t$ ${CLI_NAME} [network] [action] [subaction] [options]`,
    `\t$ ${CLI_NAME} build [-f file] [-o output] [--fileUri ${config.DefaultMainFileAppURI}]`,
    `\t$ ${CLI_NAME} validate [-f built.gcscript] [-o report.json]`,
    '',
    `Networks: ${formatChoiceList(config.networkTags || [])}`,
    '',
    'Actions:',
    actions
      .map((action) => {
        const subActions = getSubActionNames(action, handlers)
        return [
          `\t'${action}': ${actionDescriptions[action] || ''}`,
          renderRows(
            subActions.map((subAction) => [
              subAction,
              subActionDescriptions[action]?.[subAction] ||
                'supported CLI subaction'
            ])
          )
        ].join('\n')
      })
      .join('\n'),
    '',
    'Common options:',
    renderCommonInputOutputOptions(),
    '',
    'Encoding and wallet URL options:',
    renderEncodeOptions(config),
    '',
    'QR options:',
    renderQrOptions(config),
    '',
    'Snippet options:',
    renderSnippetOptions(),
    '',
    'Build options:',
    renderBuildOptions(config),
    '',
    'Validation options:',
    renderValidationOptions(config),
    '',
    renderSharedFooter(),
    '',
    'Examples',
    '',
    '\t⭐ GCScript build:',
    `\t\t$ ${CLI_NAME} build -f ./main.gcscript -o ./dist/built.gcscript`,
    `\t\t$ ${CLI_NAME} build -f ./src/main.gcscript -o ./dist/built.gcscript --cwd . --fileUri app://src/main.gcscript`,
    '',
    '\t⭐ GCScript validation for CI/CD:',
    `\t\t$ ${CLI_NAME} validate -f ./dist/built.gcscript -o ./dist/validation-report.json`,
    `\t\t$ ${CLI_NAME} validate -f ./dist/built.gcscript >/tmp/report.json`,
    '',
    '\t⭐ URL encoding:',
    `\t\t$ ${CLI_NAME} mainnet encode url -v 2 -f examples/connect.gcscript`,
    `\t\t${demoUrl}`,
    `\t\t$ ${CLI_NAME} mainnet encode url -v 2 -r addr1... -f examples/connect.gcscript`,
    `\t\t${demoUrl}&ref=addr1...`,
    `\t\t$ ${CLI_NAME} mainnet encode url -v 2 -a ${escapeShellArg(
      demoGCScriptJson
    )}`,
    `\t\t${demoUrl}`,
    '',
    '\t⭐ QR encoding:',
    `\t\t$ ${CLI_NAME} mainnet encode qr -v 2 -f examples/connect.gcscript -o examples/qr_output.png`,
    `\t\t$ ${CLI_NAME} mainnet encode qr -e gzip -v 2 -f examples/connect.gcscript -o examples/qr_output.svg`,
    '',
    '\t⭐ Snippet generation:',
    `\t\t$ ${CLI_NAME} mainnet snippet html -v 2 -S -o examples/htmlDapp.html -f examples/connect.gcscript`,
    `\t\t$ ${CLI_NAME} mainnet snippet html-zero -v 2 -o examples/htmlZeroDapp.html -f examples/connect.gcscript`,
    `\t\t$ ${CLI_NAME} mainnet snippet react -v 2 -o examples/reactDapp.html -f examples/connect.gcscript`,
    `\t\t$ ${CLI_NAME} mainnet snippet html -v 2 -f ./dist/open.gcscript.json --snippetArgsFile ./config/snippet-args.json`,
    `\t\t$ ${CLI_NAME} mainnet snippet html -v 2 -f ./dist/open.gcscript.json --snippetArgsFile ./config/snippet-args.json --snippetArgs '{"title":"Local override"}'`,
    '',
    'Build protocol resolvers:',
    `\t${formatChoiceList(
      (config.BuildResourceProtocols || []).map((protocol) => `${protocol}://`)
    )}`,
    '\tapp:// is the default virtual filesystem resolver in the CLI and resolves from --cwd.',
    '\tfile:// is unrestricted when explicitly enabled with --allowProtocols.',
    '\thttp:// and https:// are mutable remote resources and can be restricted with --allowedRemoteDomains.',
    '\tblob://, gcfs://, and ipfs:// are available to the library build pipeline when supported by the runtime/protocol handler.'
  ].join('\n')
}

const renderNetworkUsage = ({ handlers, context }) => {
  const actions = getActionNames(handlers).filter(
    (action) => action !== 'build' && action !== 'validate'
  )
  const network = context?.network || '[network]'
  return [
    '✨ GameChanger Wallet CLI',
    '',
    'Usage',
    `\t$ ${CLI_NAME} ${network} [action] [subaction] [options]`,
    '',
    `Network: ${network}`,
    '',
    'Network actions:',
    renderRows(
      actions.map((action) => [
        action,
        actionDescriptions[action] || 'supported CLI action'
      ])
    ),
    '',
    'Common options:',
    renderCommonInputOutputOptions(),
    '',
    renderSharedFooter()
  ].join('\n')
}

const renderActionUsage = ({ config, handlers, context }) => {
  const action = context?.action
  const network = context?.network
  const subActions = getSubActionNames(action, handlers)
  const prefix = network ? `${CLI_NAME} ${network}` : CLI_NAME
  const command =
    action === 'build' || action === 'validate' ? CLI_NAME : prefix
  const actionUsage =
    action === 'build' || action === 'validate'
      ? `$ ${command} ${action} [subaction] [options]`
      : `$ ${command} ${action} [subaction] [options]`
  const sections = [
    '✨ GameChanger Wallet CLI',
    '',
    'Usage',
    `\t${actionUsage}`,
    '',
    `${action[0].toUpperCase()}${action.slice(1)} subactions:`,
    renderRows(
      subActions.map((subAction) => [
        subAction,
        subActionDescriptions[action]?.[subAction] || 'supported CLI subaction'
      ])
    ),
    '',
    'Common options:',
    renderCommonInputOutputOptions()
  ]

  if (action === 'encode') {
    sections.push(
      '',
      'Encoding and wallet URL options:',
      renderEncodeOptions(config)
    )
    sections.push('', 'QR options:', renderQrOptions(config))
  }
  if (action === 'snippet') {
    sections.push(
      '',
      'Encoding and wallet URL options:',
      renderEncodeOptions(config)
    )
    sections.push('', 'Snippet options:', renderSnippetOptions())
  }
  if (action === 'build') {
    sections.push('', 'Build options:', renderBuildOptions(config))
    sections.push('', 'Validation options:', renderValidationOptions(config))
  }
  if (action === 'validate') {
    sections.push('', 'Validation options:', renderValidationOptions(config))
  }
  sections.push('', renderSharedFooter())
  return sections.join('\n')
}

const renderSubActionUsage = ({ config, context }) => {
  const { network, action, subAction } = context || {}
  const command = network
    ? `${CLI_NAME} ${network} ${action} ${subAction}`
    : `${CLI_NAME} ${action} ${subAction}`
  const sections = [
    '✨ GameChanger Wallet CLI',
    '',
    'Usage',
    `\t$ ${command} [options]`,
    '',
    `${action}:${subAction}`,
    `\t${
      subActionDescriptions[action]?.[subAction] || 'supported CLI subaction'
    }`,
    '',
    'Common options:',
    renderCommonInputOutputOptions()
  ]

  if (action === 'encode' || action === 'snippet') {
    sections.push(
      '',
      'Encoding and wallet URL options:',
      renderEncodeOptions(config)
    )
  }
  if (action === 'encode' && subAction === 'qr') {
    sections.push('', 'QR options:', renderQrOptions(config))
  }
  if (action === 'snippet') {
    sections.push('', 'Snippet options:', renderSnippetOptions())
  }
  if (action === 'build') {
    sections.push('', 'Build options:', renderBuildOptions(config))
    sections.push('', 'Validation options:', renderValidationOptions(config))
  }
  if (action === 'validate') {
    sections.push('', 'Validation options:', renderValidationOptions(config))
  }
  sections.push('', renderSharedFooter())
  return sections.join('\n')
}

export const createUsageContext = (
  input = [],
  config = defaultConfig,
  handlers = defaultHandlers
) => {
  const args = Array.isArray(input) ? input.filter(Boolean) : []
  const [first, second, third] = args
  if (!first) return {}
  if (first === 'build' || first === 'validate') {
    return {
      action: first,
      subAction: second,
      scope:
        second && getSubActionNames(first, handlers).includes(second)
          ? 'subaction'
          : 'action'
    }
  }
  const network = first
  const action = second
  const subAction = third
  const hasKnownNetwork = (config.networkTags || []).includes(network)
  const hasKnownAction = getActionNames(handlers).includes(action)
  const hasKnownSubAction = getSubActionNames(action, handlers).includes(
    subAction
  )
  return {
    network,
    action,
    subAction,
    scope: !hasKnownNetwork
      ? 'top'
      : !action || !hasKnownAction
      ? 'network'
      : !subAction || !hasKnownSubAction
      ? 'action'
      : 'subaction'
  }
}

export const renderUsageHelp = (options = {}) => {
  const config = options.config || defaultConfig
  const handlers = options.handlers || defaultHandlers
  const context =
    options.context || createUsageContext(options.input || [], config, handlers)
  const scope = context.scope || options.scope

  if (scope === 'subaction' && context.action && context.subAction) {
    return renderSubActionUsage({ config, handlers, context })
  }
  if (scope === 'action' && context.action && handlers?.[context.action]) {
    return renderActionUsage({ config, handlers, context })
  }
  if (scope === 'network' && context.network) {
    return renderNetworkUsage({ config, handlers, context })
  }
  return renderTopUsage({ config, handlers, context })
}

const truncateErrorMessage = (message, maxChars = DEFAULT_MAX_ERROR_CHARS) => {
  const value = String(message || 'Unknown error')
    .replace(/\s+/g, ' ')
    .trim()
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

const resolveLogger = (logger) => {
  if (logger && typeof logger.raw === 'function') return logger
  return {
    color: {},
    raw: (value = '') => process.stderr.write(`${value}\n`)
  }
}

export const printUsageHelp = (options = {}) => {
  const logger = resolveLogger(options.logger)
  const color = logger.color || {}
  const paintRed = color.red || ((value) => value)
  const usage = renderUsageHelp(options)

  if (options.error instanceof Error) {
    const fullMessage = options.error.message || String(options.error)
    logger.raw(
      `${paintRed('Error:')} ${paintRed(truncateErrorMessage(fullMessage))}`
    )
    logger.raw('')
    logger.raw(usage)
    logger.raw('')
    logger.raw(`${paintRed('Full error message:')} ${fullMessage}`)
    return
  }

  logger.raw(usage)
}

export default printUsageHelp
