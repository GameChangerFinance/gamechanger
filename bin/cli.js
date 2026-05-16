#!/usr/bin/env node
/* eslint-env es6 */

import gc from '../dist/nodejs.cjs'
import meow from 'meow'
import getStdin from 'get-stdin'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import { createUsageContext, printUsageHelp } from './cli-usage.js'

const CLI_HANDLERS = {
  encode: gc.encode,
  snippet: gc.snippet,
  build: gc.build,
  validate: gc.validate
}

const supportsColor = () =>
  Boolean(process.stderr.isTTY) &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb'

const supportsEmoji = () => process.env.TERM !== 'dumb'

const createLogger = ({ enabled }) => {
  const color = supportsColor()
  const emoji = supportsEmoji()
  const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text)
  const createColor = (code) => (text) => paint(code, text)
  const colors = {
    reset: createColor('0'),
    bold: createColor('1'),
    muted: createColor('2'),
    red: createColor('31'),
    green: createColor('32'),
    yellow: createColor('33'),
    blue: createColor('34'),
    violet: createColor('35'),
    cyan: createColor('36'),
    white: createColor('37'),
    underline: createColor('4')
  }
  const icon = (value, fallback) => (emoji ? value : fallback)
  const write = (level, value) => {
    if (!enabled) return
    process.stderr.write(`${level} ${value}\n`)
  }
  const raw = (value = '') => {
    if (!enabled) return
    process.stderr.write(`${value}\n`)
  }
  return {
    icon,
    paint,
    color: colors,
    raw,
    info: (message) => write(icon('✨', '*'), colors.cyan(message)),
    step: (message) => write(icon('›', '-'), colors.muted(message)),
    success: (message) => write(icon('✅', 'OK'), colors.green(message + '\n')),
    warn: (message) => write(icon('⚠️', '!'), colors.yellow(message)),
    error: (message) => write(icon('❌', 'ERR'), colors.red(message + '\n'))
  }
}

const truncateMiddle = (value, max = 42) => {
  const text = String(value || '')
  if (text.length <= max) return text
  const edge = Math.max(4, Math.floor((max - 3) / 2))
  return `${text.slice(0, edge)}...${text.slice(-edge)}`
}

const humanBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Number(bytes || 0)
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${
    value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  } ${units[unitIndex]}`
}

const formatHash = (value) => truncateMiddle(value || 'non-json', 18)

const renderBuildSummary = (logger, summary) => {
  if (!summary) return
  logger.info('Build summary')
  for (const item of summary.resources) {
    const indent = '  '.repeat(Math.max(0, Number(item.depth || 0)))
    logger.step(
      `${indent}${truncateMiddle(item.fileUri, 48)}  ${humanBytes(
        item.bytes
      )}, ${item.lines} lines, hash ${formatHash(item.hashCode)}`
    )
  }
  if (summary.final) {
    logger.success(
      `Built artifact ${humanBytes(summary.final.bytes)}, ${
        summary.final.lines
      } lines, hash ${formatHash(summary.final.hashCode)}`
    )
  }
}

const formatJsonValue = (value) => {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const decodeJsonPointerToken = (token) =>
  String(token).replace(/~1/g, '/').replace(/~0/g, '~')

const highlightQuotedFragments = (
  text,
  renderQuoted,
  renderText = (value) => value
) => {
  const value = String(text || '')
  const quotedPattern = /"(?:[^"\\]|\\.)*"/g
  let rendered = ''
  let lastIndex = 0
  for (const match of value.matchAll(quotedPattern)) {
    rendered += renderText(value.slice(lastIndex, match.index))
    rendered += renderQuoted(match[0])
    lastIndex = Number(match.index) + match[0].length
  }
  rendered += renderText(value.slice(lastIndex))
  return rendered
}

const truncateLines = (text, { maxChars = 1200, maxLines = 24 } = {}) => {
  let value = String(text || '')
  let truncated = false
  if (value.length > maxChars) {
    value = value.slice(0, maxChars).trimEnd()
    truncated = true
  }
  const lines = value.split(/\r?\n/)
  if (lines.length > maxLines) {
    value = lines.slice(0, maxLines).join('\n')
    truncated = true
  }
  return truncated ? `${value}\n…` : value
}

const stringifyExample = (example) => {
  try {
    const exampleStr = JSON.stringify(example, null, 2)
    if (exampleStr && exampleStr.length <= 300) return exampleStr
    return truncateLines(exampleStr)
  } catch {
    return undefined
  }
}

const firstExample = (error) =>
  Array.isArray(error.examples) && error.examples.length > 0
    ? stringifyExample(error.examples[0])
    : undefined

const closestValues = (error) => {
  const values = error?.details?.closestValues
  return Array.isArray(values) ? values : []
}

const createValidationRenderers = (logger) => {
  const { color } = logger
  const pipe = () => color.red('    | ')
  const renderers = {
    text: (value) => color.muted(String(value)),
    value: (value, tone = 'white') =>
      (color[tone] || color.white)(formatJsonValue(value)),
    quoted: (text, tone = 'white') =>
      highlightQuotedFragments(
        text,
        (match) => (color[tone] || color.white)(match),
        color.muted
      ),
    path: (jsonPath = '/') => {
      const pathValue = String(jsonPath || '/')
      if (pathValue === '/') return color.violet('/')
      return pathValue
        .split('/')
        .map((token, index) => {
          if (index === 0) return color.muted('/')
          const prefix = index > 1 ? color.muted('/') : ''
          return `${prefix}${color.violet(decodeJsonPointerToken(token))}`
        })
        .join('')
    },
    location: (error) => {
      const location = error.location || {}
      const parts = [renderers.path(error.jsonPath || '/')]
      if (location.line && location.column) {
        parts.push(color.muted(`line ${location.line}, col ${location.column}`))
      }
      return parts.join(color.muted(' · '))
    },
    suggestion: (text) => renderers.quoted(text, 'green'),
    url: (value) => color.muted(color.underline(String(value))),
    example: (text) => color.cyan(text),
    title: (error) => {
      if (error.error && error.provided !== undefined) {
        return `${color.muted(`${error.error}: `)}${renderers.value(
          error.provided,
          'red'
        )}`
      }
      return renderers.quoted(error.message || 'Validation error', 'red')
    },
    line: (content = '') => logger.raw(`${pipe()}${content}`),
    block: (label, text, renderValue) => {
      const value = String(text || '')
      const lines = value.split(/\r?\n/)
      if (lines.length === 1) {
        renderers.line(`${color.muted(`${label}: `)}${renderValue(lines[0])}`)
        return
      }
      renderers.line(color.muted(`${label}:`))
      for (const line of lines) {
        renderers.line(`${color.muted('  ')}${renderValue(line)}`)
      }
    }
  }
  return renderers
}

const renderValidationReport = (logger, report, options = {}) => {
  if (!report) return
  const fileName =
    options.fileName ||
    report.errors?.[0]?.fileName ||
    report.warnings?.[0]?.fileName ||
    options.fallbackName ||
    'input'
  const render = createValidationRenderers(logger)
  const { color } = logger
  const showWarnings = Boolean(options.showWarnings)
  const warnings = Array.isArray(report.warnings) ? report.warnings : []

  const renderDiagnostic = (diagnostic, level = 'error') => {
    const isWarning = level === 'warning'
    const tone = isWarning ? color.yellow : color.red
    const icon = isWarning
      ? logger.icon('⚠️', 'WARN')
      : logger.icon('❌', 'ERR')

    logger.raw('')
    logger.raw(`${color.muted('   ')}${tone(icon)} ${render.title(diagnostic)}`)

    render.line(color.muted('   at ') + render.location(diagnostic))
    const values = closestValues(diagnostic)
    const propertyValues = diagnostic?.details?.closestProperties
    if (values.length > 0) {
      logger.raw(
        `${color.red('    | ')}${logger.icon('💡', 'hint')} ${color.muted(
          'Did you mean: '
        )}${values
          .map((value) => render.value(value, 'green'))
          .join(color.red(', '))}${color.muted('?')}`
      )
    } else if (Array.isArray(propertyValues) && propertyValues.length > 0) {
      logger.raw(
        `${color.red('    | ')}${logger.icon('💡', 'hint')} ${color.muted(
          'Did you mean: '
        )}${propertyValues
          .map((value) => render.value(value, 'green'))
          .join(color.red(', '))}${color.muted('?')}`
      )
    } else if (diagnostic.suggestion) {
      logger.raw(
        `${color.red('    | ')}${logger.icon('💡', 'hint')} ${render.suggestion(
          diagnostic.suggestion
        )}`
      )
    }

    const example = firstExample(diagnostic)
    if (example) render.block('Example', example, render.example)

    const docs = Array.isArray(diagnostic.relatedDocs)
      ? diagnostic.relatedDocs
      : []
    for (const doc of docs.slice(0, 2)) {
      render.line(`${color.muted('See: ')}${render.url(doc)}`)
    }
    logger.raw('')
  }

  if (report.isValid) {
    logger.success(`Valid GCScript on "${fileName}"`)
    if (showWarnings && warnings.length > 0) {
      logger.raw(
        `${color.yellow(logger.icon('›', 'WARN'))} ${color.muted(
          String(warnings.length)
        )} ${color.yellow(
          `${warnings.length === 1 ? 'warning' : 'warnings'} `
        )}${color.muted('in')} ${color.yellow(formatJsonValue(fileName))}`
      )
      for (const warning of warnings) renderDiagnostic(warning, 'warning')
    }
    return
  }

  const errors = Array.isArray(report.errors) ? report.errors : []
  const count = errors.length
  logger.raw(
    `${color.red(logger.icon('›', 'ERR'))} ${color.muted(
      String(count)
    )} ${color.red(`${count === 1 ? 'error' : 'errors'} `)}${color.muted(
      'in'
    )} ${color.red(formatJsonValue(fileName))}`
  )

  for (const error of errors) renderDiagnostic(error, 'error')

  if (showWarnings && warnings.length > 0) {
    logger.raw(
      `${color.yellow(logger.icon('›', 'WARN'))} ${color.muted(
        String(warnings.length)
      )} ${color.yellow(
        `${warnings.length === 1 ? 'warning' : 'warnings'} `
      )}${color.muted('in')} ${color.yellow(formatJsonValue(fileName))}`
    )
    for (const warning of warnings) renderDiagnostic(warning, 'warning')
  }
}

const formatCliPath = (value) => value.replace(/\\/g, '/')

const assertInsideDirectory = (baseDir, targetPath) => {
  const resolvedBase = fs.realpathSync(baseDir)
  const resolvedTarget = fs.realpathSync(targetPath)
  const relative = path.relative(resolvedBase, resolvedTarget)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Access outside working directory is not allowed: ${targetPath}`
    )
  }
  return resolvedTarget
}

const appUriToRelativePath = (resourceUri) => {
  const url = new URL(resourceUri)
  return formatCliPath(
    [url.hostname, decodeURIComponent(url.pathname || '')]
      .filter(Boolean)
      .join('/')
      .replace(/^\/+/, '')
  )
}

const createCliProtocolHandlers = (workingDirectory) => {
  const cwd = path.resolve(workingDirectory)
  const readFromCwd = async (relativeFilePath) => {
    const candidate = path.resolve(cwd, relativeFilePath)
    const safePath = assertInsideDirectory(cwd, candidate)
    return fs.promises.readFile(safePath)
  }

  return {
    app: async (resourceUri) => readFromCwd(appUriToRelativePath(resourceUri)),
    file: async (resourceUri) =>
      fs.promises.readFile(fileURLToPath(resourceUri))
  }
}

const isFreshEnough = (filePath, ttlHours) => {
  try {
    const stat = fs.statSync(filePath)
    const ageMs = Date.now() - stat.mtimeMs
    return ageMs < Number(ttlHours || 24) * 60 * 60 * 1000
  } catch {
    return false
  }
}

const writeSchemaCache = (preferredDir, fallbackDir, filename, data) => {
  const serialized = JSON.stringify(data)
  const candidates = [preferredDir, fallbackDir]
  let lastError
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, serialized)
      return filePath
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const loadGCScriptSchemaForCli = async ({
  schemaUrl,
  workingDirectory,
  logger,
  cacheFileName,
  cacheTtlHours
}) => {
  const preferredCachePath = path.join(os.tmpdir(), cacheFileName)
  const fallbackCachePath = path.join(workingDirectory, cacheFileName)

  for (const cachePath of [preferredCachePath, fallbackCachePath]) {
    if (isFreshEnough(cachePath, cacheTtlHours)) {
      logger.step(`Using cached schema ${cachePath}`)
      return readJsonFile(cachePath)
    }
  }

  logger.step(`Downloading GCScript schema ${schemaUrl}`)
  if (typeof fetch !== 'function') {
    throw new Error(
      'No fetch implementation available to download GCScript schema'
    )
  }
  const response = await fetch(schemaUrl)
  if (!response.ok) {
    throw new Error(`Failed to download GCScript schema (${response.status})`)
  }
  const schema = await response.json()
  const cachePath = writeSchemaCache(
    os.tmpdir(),
    workingDirectory,
    cacheFileName,
    schema
  )
  logger.step(`Cached schema ${cachePath}`)
  return schema
}

export const serveHtml = async ({
  indexHtml,
  logger,
  host = 'localhost',
  port = 3000,
  libPath = 'dist'
}) => {
  let express
  try {
    express = (await import('express')).default
  } catch (err) {
    throw new Error(
      `Serving snippets requires express to be installed in the current project. ${err.message}`
    )
  }
  const { color } = logger
  const app = express()
  app.use('/dist', express.static(libPath))
  app.get('/', (_req, res) => {
    res.send(indexHtml)
  })
  app.listen(port, () =>
    logger.raw(
      `\n\n${color.green(`🚀 Serving output `)}${color.muted(
        `with the hosted GameChanger library on`
      )} ${color.cyan(color.underline(`http://${host}:${port}`))}\n\n`
    )
  )
}

export default async function main() {
  const {
    QRRenderTypes,
    DefaultNetwork,
    DefaultBuildAllowedProtocols,
    DefaultMainFileAppURI,
    BuildResourceProtocols,
    GCScriptSchemaURL,
    GCScriptSchemaRootFile,
    GCScriptSchemaCacheFileName,
    GCScriptSchemaCacheTTLHours
  } = gc.config

  const errorLogger = createLogger({ enabled: true })
  let usageContext = createUsageContext(
    process.argv.slice(2),
    gc.config,
    CLI_HANDLERS
  )

  try {
    process.on('uncaughtException', function (err) {
      printUsageHelp({
        logger: errorLogger,
        context: usageContext,
        error: err instanceof Error ? err : new Error(String(err))
      })
      process.exit(1)
    })
    const wantsHelp = process.argv
      .slice(2)
      .some((arg) => arg === '--help' || arg === '-h')
    const cli = meow('', {
      help: false,
      autoHelp: false,
      flags: {
        help: {
          type: 'boolean',
          alias: 'h'
        },
        args: {
          type: 'string',
          alias: 'a'
        },
        file: {
          type: 'string',
          alias: 'f'
        },
        stdin: {
          type: 'string',
          alias: 'i'
        },
        outputFile: {
          type: 'string',
          alias: 'o'
        },
        template: {
          type: 'string',
          alias: 't'
        },
        styles: {
          type: 'string',
          alias: 's'
        },
        apiVersion: {
          type: 'string',
          alias: 'v'
        },
        encoding: {
          type: 'string',
          alias: 'e'
        },
        debug: {
          type: 'boolean',
          alias: 'd'
        },
        serve: {
          type: 'boolean',
          alias: 'S'
        },
        refAddress: {
          type: 'string',
          alias: 'r'
        },
        disableNetworkRouter: {
          type: 'boolean',
          alias: 'R'
        },
        urlPattern: {
          type: 'string',
          alias: 'u'
        },
        snippetArgs: {
          type: 'string',
          alias: 'A'
        },
        snippetArgsFile: {
          type: 'string'
        },
        cwd: {
          type: 'string',
          alias: 'C'
        },
        fileUri: {
          type: 'string',
          alias: 'U'
        },
        allowProtocols: {
          type: 'string'
        },
        allowedRemoteDomains: {
          type: 'string'
        },
        compactOutput: {
          type: 'boolean'
        },
        noValidate: {
          type: 'boolean'
        },
        schemaUrl: {
          type: 'string'
        },
        hideWarnings: {
          type: 'boolean'
        },
        quiet: {
          type: 'boolean',
          alias: 'q'
        }
      }
    })

    usageContext = createUsageContext(cli.input, gc.config, CLI_HANDLERS)
    if (wantsHelp || cli.flags.help) {
      printUsageHelp({ logger: errorLogger, context: usageContext })
      return
    }

    const workingDirectory = path.resolve(cli.flags.cwd || process.cwd())
    const parseCsvFlag = (value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined
    const allowedProtocols = parseCsvFlag(cli.flags.allowProtocols) || [
      ...DefaultBuildAllowedProtocols
    ]
    for (const protocol of allowedProtocols) {
      if (!BuildResourceProtocols.includes(protocol)) {
        throw new Error(`Unknown build protocol '${protocol}'`)
      }
    }
    const allowedRemoteDomains = parseCsvFlag(cli.flags.allowedRemoteDomains)
    const sourcesHandlers = {
      args: () => Promise.resolve(cli.flags.args),
      file: () => {
        const filename = cli.flags.file
        return new Promise((resolve, reject) => {
          if (typeof filename === 'string') {
            fs.readFile(filename, 'utf8', (err, data) => {
              if (err) {
                return reject(new Error('Failed to read file. ' + err.message))
              }
              return resolve(data.toString())
            })
          } else {
            return reject(new Error('Undefined file'))
          }
        })
      },
      stdin: () => getStdin(),
      outputFile: () => Promise.resolve(cli.flags.outputFile)
    }

    const parseAction = (input) => {
      if (input[0] === 'build' || input[0] === 'validate') {
        return {
          network: DefaultNetwork,
          action: input[0],
          subAction: input[1] || 'file'
        }
      }
      return {
        network: input[0],
        action: input[1],
        subAction: input[2]
      }
    }

    const { network, action, subAction } = parseAction(cli.input)
    usageContext = createUsageContext(cli.input, gc.config, CLI_HANDLERS)
    const actions = Object.keys(CLI_HANDLERS)
    if (!action) {
      throw new Error('Missing action')
    }
    if (
      action !== 'build' &&
      action !== 'validate' &&
      !gc.config.networkTags.includes(network)
    ) {
      throw new Error(`Unknown network '${network || ''}'`)
    }
    if (!actions.includes(action)) {
      throw new Error(`Unknown action '${action}'`)
    }
    const subActions = Object.keys(CLI_HANDLERS[action])
    if (!subAction) {
      throw new Error(`Missing sub action for action '${action}'`)
    }
    if (!subActions.includes(subAction)) {
      throw new Error(
        `Unknown sub action '${subAction}' for action '${action}'`
      )
    }

    const source =
      typeof cli.flags.args === 'string'
        ? 'args'
        : cli.flags.file
        ? 'file'
        : 'stdin'
    const debug = !!cli.flags.debug
    const encoding = cli.flags.encoding
    const apiVersion = cli.flags.apiVersion

    const outputFile = cli.flags.outputFile
    const shouldLog = !cli.flags.quiet
    const logger = createLogger({ enabled: shouldLog })
    const buildSummary =
      action === 'build' && shouldLog ? { resources: [] } : undefined
    const doValidate = action === 'build' ? !cli.flags.noValidate : undefined
    const schemaUrl = cli.flags.schemaUrl || GCScriptSchemaURL
    const needsSchema =
      action === 'validate' || (action === 'build' && doValidate !== false)
    const template = cli.flags.template
    const styles = cli.flags.styles

    const serve = !!cli.flags.serve
    const refAddress = cli.flags.refAddress
    const disableNetworkRouter = !!cli.flags.disableNetworkRouter
    const urlPattern = cli.flags.urlPattern
    const snippetArgsRaw = cli.flags.snippetArgs
    const snippetArgsFileRaw = cli.flags.snippetArgsFile
    const compactOutput = !!cli.flags.compactOutput
    const showWarnings = needsSchema && !cli.flags.hideWarnings

    const parseSnippetArgsObject = (raw, sourceLabel) => {
      if (typeof raw !== 'string' || !raw.trim()) return undefined
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch (err) {
        throw new Error(`Invalid ${sourceLabel} JSON. ${err}`)
      }
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error(`${sourceLabel} must be a JSON object`)
      }
      return parsed
    }

    let snippetArgsFromFile = undefined
    if (typeof snippetArgsFileRaw === 'string' && snippetArgsFileRaw.trim()) {
      const snippetArgsFilePath = path.resolve(
        process.cwd(),
        snippetArgsFileRaw
      )
      try {
        snippetArgsFromFile = parseSnippetArgsObject(
          fs.readFileSync(snippetArgsFilePath, 'utf8'),
          '--snippetArgsFile'
        )
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith('Invalid --snippetArgsFile')
        ) {
          throw err
        }
        throw new Error(
          `Failed to read --snippetArgsFile '${snippetArgsFileRaw}'. ${err.message}`
        )
      }
    }
    const snippetArgsFromArgs = parseSnippetArgsObject(
      snippetArgsRaw,
      '--snippetArgs'
    )
    const snippetArgs =
      snippetArgsFromFile || snippetArgsFromArgs
        ? { ...(snippetArgsFromFile || {}), ...(snippetArgsFromArgs || {}) }
        : undefined

    let qrResultType = 'png'
    if (outputFile) {
      const detectedType = QRRenderTypes.find((x) =>
        (outputFile || '').endsWith(`.${x}`)
      )
      if (detectedType) qrResultType = detectedType
    }

    const sourceResolver = sourcesHandlers[source]
    const actionResolver = CLI_HANDLERS[action][subAction]

    logger.info(`Running ${action}:${subAction}`)
    const input = await sourceResolver()

    const inputFilePath = cli.flags.file
      ? path.resolve(process.cwd(), cli.flags.file)
      : undefined
    const fileUri = cli.flags.fileUri || DefaultMainFileAppURI

    const VisibleBuildEventTypes = new Set([
      'build:start',
      'resource:load',
      'validate:start',
      'validate:error',
      //'validate:success',
      'error',
      'build:error',
      'security:error',
      'BuildError',
      'BuildSecurityError'
    ])

    const shouldLogBuildEvent = (event) =>
      Boolean(
        event.message &&
          VisibleBuildEventTypes.has(event.type) &&
          !(action === 'validate' && event.type === 'validate:error')
      )

    let schemaLoadMs
    let useSchema
    if (needsSchema) {
      const schemaLoadStartedAt = Date.now()
      useSchema = await loadGCScriptSchemaForCli({
        schemaUrl,
        workingDirectory,
        logger,
        cacheFileName: GCScriptSchemaCacheFileName,
        cacheTtlHours: GCScriptSchemaCacheTTLHours
      })
      schemaLoadMs = Date.now() - schemaLoadStartedAt
    }

    const output = await actionResolver({
      network,
      input,
      encoding,
      apiVersion,
      debug,

      qrResultType,
      outputFile,
      template,
      styles,
      refAddress,
      disableNetworkRouter,
      urlPattern,
      snippetArgs,

      fileUri,
      allowedProtocols,
      allowedRemoteDomains,
      compactOutput,
      doValidate,
      useSchema,
      schemaUrl,
      schemaRootFile: GCScriptSchemaRootFile,
      profiling:
        schemaLoadMs === undefined ? undefined : { schemaMs: schemaLoadMs },
      fileName: inputFilePath ? path.basename(inputFilePath) : undefined,
      filePath: inputFilePath,
      collectSummary: Boolean(buildSummary),
      protocolHandlers: createCliProtocolHandlers(workingDirectory),
      onEvent: (event, context) => {
        if (event.type === 'resource:loaded' && buildSummary) {
          buildSummary.resources.push({
            fileUri: event.fileUri,
            depth: Math.max(0, (context.importTrace || []).length - 1),
            bytes: event.data?.bytes || 0,
            lines: event.data?.lines || 0,
            hashCode: event.data?.hashCode
          })
        }
        if (showWarnings && event.type === 'validate:warning') {
          renderValidationReport(logger, event.data?.report, {
            fileName: inputFilePath ? path.basename(inputFilePath) : undefined,
            fallbackName: source,
            showWarnings: true
          })
          return
        }
        //if (event.message) logger.step(event.message)
        if (shouldLogBuildEvent(event)) {
          logger.step(event.message)
        }
      }
    })

    let validationReport
    if (output) {
      if (output.trim().startsWith('data:')) {
        const dataURI = output
        const parsedDataUri = gc.utils.dataURIToBuffer(dataURI)

        if (action === 'validate') {
          validationReport = JSON.parse(
            Buffer.from(parsedDataUri).toString('utf8')
          )
          renderValidationReport(logger, validationReport, {
            fileName: inputFilePath ? path.basename(inputFilePath) : undefined,
            fallbackName: source,
            showWarnings
          })
        }

        if (outputFile) {
          const filePath = path.resolve(process.cwd(), outputFile)
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          logger.step(`Writing ${filePath}`)
          fs.writeFileSync(filePath, Buffer.from(parsedDataUri))
          //logger.success(`Wrote ${filePath}`)
        } else {
          process.stdout.write(parsedDataUri)
        }
        if (serve) {
          if (output.trim().startsWith('data:text/html')) {
            const indexHtml = parsedDataUri.toString('utf8')
            await serveHtml({ indexHtml, logger })
          }
        }
      } else if (outputFile) {
        const filePath = path.resolve(process.cwd(), outputFile)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        logger.step(`Writing ${filePath}`)
        fs.writeFileSync(filePath, `${output}\n`)
      } else {
        process.stdout.write(`${output}\n`)
      }
    }

    if (action === 'validate' && validationReport?.isValid === false) {
      process.exitCode = 1
    }

    if (buildSummary && output?.trim().startsWith('data:')) {
      const builtJson = Buffer.from(gc.utils.dataURIToBuffer(output)).toString(
        'utf8'
      )
      const builtCode = JSON.parse(builtJson)
      buildSummary.final = {
        bytes: Buffer.byteLength(builtJson, 'utf8'),
        lines: builtJson.split(/\r?\n/).length,
        hashCode: gc.utils.hashCode(builtCode)
      }
      renderBuildSummary(logger, buildSummary)
    }

    if (debug) {
      console.error(
        JSON.stringify(
          {
            input,
            output,
            params: {
              debug,
              action,
              subAction,
              network,
              encoding,
              apiVersion,
              source,
              workingDirectory,
              fileUri,
              allowedProtocols,
              allowedRemoteDomains,
              compactOutput,
              doValidate,
              schemaUrl,
              hideWarnings: !!cli.flags.hideWarnings,

              outputFile,
              template,
              styles,
              refAddress,
              disableNetworkRouter,
              urlPattern,
              snippetArgs,
              snippetArgsFile: snippetArgsFileRaw
            }
          },
          null,
          2
        )
      )
    }
  } catch (err) {
    printUsageHelp({
      logger: errorLogger,
      context: usageContext,
      error: err instanceof Error ? err : new Error(String(err))
    })
    process.exit(1)
  }
}

main()
