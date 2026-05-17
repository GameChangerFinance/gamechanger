import {
  BuildDataFormats,
  BuildResourceProtocolCategories,
  BuildResourceProtocols,
  DefaultBuildAllowedProtocols,
  BuildOutputMimeType,
  DefaultMainFileAppURI,
  DefaultFilesystemRoot
} from '../config'
import { bufferToDataURI, hashCode } from '../utils'
import {
  parse as parseJSONC,
  parseTree,
  printParseErrorCode
} from 'jsonc-parser'
import { validateGCScriptObject } from './validate/helpers'
import { Buffer } from 'buffer'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

/** Final parsed/built GCScript representation. */
export type GCScript = JsonValue
export type JsonObject = { [key: string]: JsonValue }

export type SchemaDefinitionLookupResult = {
  /** Lookup key requested by the caller, for example "buildTx" or "buildTx.json". */
  key: string
  /** Schema file that contains the fragment, for example "buildTx.json". */
  schemaFile: string
  /** JSON pointer to the returned fragment inside the schema bundle. */
  schemaPath: string
  /** Full deserialized schema bundle originally passed by the caller. */
  schema: JsonValue
  /** Matching schema fragment, or definition fragment, from the bundle. */
  fragment: JsonValue
}

const schemaPointerEscape = (part: string) =>
  String(part).replace(/~/g, '~0').replace(/\//g, '~1')

const schemaDefinitionCandidateKeys = (definitionKey: string) => {
  const trimmed = String(definitionKey || '').trim()
  if (!trimmed) return []
  const withoutJson = trimmed.endsWith('.json')
    ? trimmed.slice(0, -'.json'.length)
    : trimmed
  return [...new Set([trimmed, `${withoutJson}.json`, withoutJson])]
}

/**
 * Looks up a schema file or local JSON Schema definition by name.
 *
 * Full schema flavors usually expose one file per GCScript function
 * (`buildTx.json`, `data.json`, etc.). Minified schema flavors may omit rich
 * documentation or local definitions, so the helper returns undefined when a
 * fragment is unavailable instead of throwing.
 */
export const getSchemaDefOf = (
  useSchema: JsonValue | undefined,
  definitionKey: string
): SchemaDefinitionLookupResult | undefined => {
  if (!useSchema || typeof useSchema !== 'object' || Array.isArray(useSchema)) {
    return undefined
  }

  const schemaRoot = useSchema as Record<string, JsonValue>
  const candidateKeys = schemaDefinitionCandidateKeys(definitionKey)
  if (candidateKeys.length === 0) return undefined

  for (const schemaFile of candidateKeys) {
    const fragment = schemaRoot[schemaFile]
    if (fragment !== undefined) {
      return {
        key: definitionKey,
        schemaFile,
        schemaPath: `/${schemaPointerEscape(schemaFile)}`,
        schema: useSchema,
        fragment
      }
    }
  }

  for (const [schemaFile, schemaFileValue] of Object.entries(schemaRoot)) {
    if (
      !schemaFileValue ||
      typeof schemaFileValue !== 'object' ||
      Array.isArray(schemaFileValue)
    ) {
      continue
    }

    const schemaObject = schemaFileValue as Record<string, JsonValue>
    for (const containerKey of ['definitions', '$defs']) {
      const definitions = schemaObject[containerKey]
      if (
        !definitions ||
        typeof definitions !== 'object' ||
        Array.isArray(definitions)
      ) {
        continue
      }

      const definitionObject = definitions as Record<string, JsonValue>
      for (const candidateKey of candidateKeys) {
        const fragment = definitionObject[candidateKey]
        if (fragment === undefined) continue
        return {
          key: definitionKey,
          schemaFile,
          schemaPath: `/${schemaPointerEscape(
            schemaFile
          )}/${schemaPointerEscape(containerKey)}/${schemaPointerEscape(
            candidateKey
          )}`,
          schema: useSchema,
          fragment
        }
      }
    }
  }

  return undefined
}

export type BuildDataFormat = (typeof BuildDataFormats)[number]
export type BuildResourceProtocol = (typeof BuildResourceProtocols)[number]
export type BuildResourceProtocolCategory =
  keyof typeof BuildResourceProtocolCategories

export type VirtualFile = {
  /** Runtime value is a Buffer; Uint8Array keeps declarations portable. */
  data: Uint8Array
  mimeType?: string
}

export type VirtualFileSystem = {
  [relativeFilePath: string]: VirtualFile
}

export type BuildEvent = {
  type: string
  message?: string
  stage?: string
  fileUri?: string
  protocol?: string
  path?: string
  directive?: string
  data?: Record<string, unknown>
}

export type GCScriptProcessContext = {
  fileUri: string
  options: { onEvent?: BuildEventHandler }
  importTrace?: string[]
  state?: Record<string, unknown>
}

export type BuildEventHandler = (
  event: BuildEvent,
  context: Readonly<GCScriptProcessContext>
) => void | Promise<void>

export type BuildProtocolHandler = (
  resourceUri: string,
  args: BuildResourceArgs
) => Promise<Uint8Array>

export type BuildProtocolHandlers = {
  [protocol: string]: BuildProtocolHandler | undefined
}

export type BuildSecurityContext = {
  /** Mutable remote ancestor that taints this dependency branch, if any. */
  mutableAncestorUri?: string
}

export type BuildOptions = {
  /** Raw GCScript JSON/JSONC text. build() never loads this from fileUri. */
  input: string
  /**
   * URI used only as the parent identity for resolving relative imports.
   *
   * When omitted, DefaultMainFileAppURI is used as a synthetic parent URI for
   * app:// virtual-file projects. The build handler must not read or write this
   * default URI because callers may not have such a file in their VFS or local
   * filesystem.
   */
  fileUri?: string
  /** Absolute filesystem/virtual root used as the app:// root for build-time resolution. */
  appWorkingDir?: string
  files?: VirtualFileSystem
  allowedProtocols?: string[]
  /** Optional exact/wildcard hostname whitelist for http(s) resources. */
  allowedRemoteDomains?: string[]
  protocolHandlers?: BuildProtocolHandlers
  directiveHandlers?: BuildDirectiveHandlers
  stages?: BuildStage[]
  importTrace?: string[]
  security?: BuildSecurityContext
  /** JSON schema object returned by the GCScript schema endpoint. Required when validation runs. */
  useSchema?: JsonValue
  /** Schema URL used by helper downloaders. Callers can override the production default. */
  schemaUrl?: string
  /** Root schema filename inside useSchema. Defaults to the production API schema root. */
  schemaRootFile?: string
  /** Validate final built strict JSON output. Enabled by default. */
  doValidate?: boolean
  /** Emit strict/minified JSON when serializing buildToDataURI output. */
  compactOutput?: boolean
  /** Internal/CLI flag: collect resource stats only when a caller will display them. */
  collectSummary?: boolean
  onEvent?: BuildEventHandler
}

export type BuildContext = {
  input: string
  fileUri: string
  explicitFileUri: boolean
  appWorkingDir: string
  files: VirtualFileSystem
  allowedProtocols: string[]
  allowedRemoteDomains?: string[]
  protocolHandlers: BuildProtocolHandlers
  directiveHandlers: BuildDirectiveHandlers
  importTrace: string[]
  security: BuildSecurityContext
  options: BuildOptions
  state: Record<string, unknown>
}

export type BuildStageArgs = BuildOptions & {
  context: BuildContext
  previousResult: GCScript
}

export type BuildStage = (args: BuildStageArgs) => Promise<GCScript>

export type BuildDirectiveArgs = {
  node: GCScript
  key: string
  index: number
  path: string[]
  context: BuildContext
}

export type BuildDirectiveHandler = (
  args: BuildDirectiveArgs
) => Promise<GCScript>

export type BuildDirectiveHandlers = {
  [type: string]: BuildDirectiveHandler | undefined
}

export type BuildResourceArgs = Partial<Omit<BuildOptions, 'input'>> & {
  context?: BuildContext
  baseUri?: string
  explicitBaseUri?: boolean
}

export const emitBuildEvent = async (
  context: GCScriptProcessContext,
  event: Omit<BuildEvent, 'fileUri'> & { fileUri?: string }
) => {
  const enrichedEvent = {
    fileUri: context.fileUri,
    ...event
  }
  if (context.options.onEvent) {
    await context.options.onEvent(enrichedEvent, context)
  }
}

export const isArray = (maybeArray: unknown): maybeArray is unknown[] =>
  Array.isArray(maybeArray)

export const toKVList = (maybeArray: any, options?: { sort?: boolean }) => {
  const sort = options?.sort
  let res: [string, any][] = []
  if (!maybeArray) return res
  if (isArray(maybeArray)) {
    res = maybeArray.map((item, index) => [String(index), item])
  } else {
    let keys = Object.keys(maybeArray) || []
    const numericKeys = keys.every((key) => !Number.isNaN(parseInt(key)))
    if (sort) {
      keys = numericKeys
        ? keys.sort((a, b) => parseInt(a) - parseInt(b))
        : keys.sort()
    }
    res = keys.map((itemKey) => [String(itemKey), maybeArray[itemKey]])
  }
  return res
}

export const kvList2Array = (kvMap: [string, any][]) =>
  kvMap
    .sort(([aKey], [bKey]) => parseInt(aKey) - parseInt(bKey))
    .map(([, value]) => value)

export const kvList2Object = (kvMap: [string, any][]) =>
  Object.fromEntries(kvMap.map(([itemKey, value]) => [itemKey, value]))

const isParentNode = (node: any) =>
  node?.type === 'script' && node?.run !== undefined
const getChildren = (node: any) => node?.run

export const gcScriptWalker = async ({
  code,
  onNode,
  context
}: {
  code: GCScript
  onNode: (args: BuildDirectiveArgs) => Promise<GCScript>
  context: BuildContext
}): Promise<GCScript> => {
  const rootPath = ''
  const walker = async ({
    node,
    key,
    index,
    path
  }: {
    node: GCScript
    key: string
    index: number
    path: string[]
  }): Promise<GCScript> => {
    const solvedNode = await onNode({ node, index, key, path, context })
    const solvedNodeAsAny = solvedNode as any

    if (isParentNode(solvedNodeAsAny)) {
      const children = getChildren(solvedNodeAsAny) || []
      const kvMap = toKVList(children)
      const solvedKvMap: [string, GCScript][] = []
      for (let childIndex = 0; childIndex < kvMap.length; childIndex++) {
        const [childKey, childNode] = kvMap[childIndex]
        const solvedChild = await walker({
          node: childNode,
          index: childIndex,
          key: childKey,
          path: [...path, childKey]
        })
        solvedKvMap.push([childKey, solvedChild])
      }
      return {
        ...(solvedNodeAsAny as Record<string, GCScript>),
        run: isArray(children)
          ? kvList2Array(solvedKvMap)
          : kvList2Object(solvedKvMap)
      }
    }
    return solvedNode
  }

  return walker({ node: code, key: rootPath, index: 0, path: [rootPath] })
}

const hasProtocol = (resourceUri: string) =>
  /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(resourceUri)

const splitProtocol = (resourceUri: string) => {
  const match = String(resourceUri || '').match(
    /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/s
  )
  return match ? { protocol: match[1], rest: match[2] } : undefined
}

const normalizeSlashes = (value: string) =>
  String(value || '').replace(/\\/g, '/')

const normalizeFilesystemPath = (value: string) => {
  const source = normalizeSlashes(value)
  const absolute = source.startsWith('/')
  const parts: string[] = []
  for (const rawPart of source.split('/')) {
    const part = rawPart.trim()
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') {
        parts.pop()
      } else if (!absolute) {
        parts.push('..')
      }
      continue
    }
    parts.push(part)
  }
  const joined = parts.join('/')
  return absolute ? `/${joined}`.replace(/\/+$|^$/g, '') || '/' : joined || '.'
}

const joinFilesystemPath = (...parts: string[]) =>
  normalizeFilesystemPath(parts.filter((part) => part !== undefined).join('/'))

const dirnameOf = (value: string) => {
  const normalized = normalizeFilesystemPath(value)
  if (normalized === '/') return '/'
  const parts = normalized.split('/')
  parts.pop()
  const joined = parts.join('/')
  return joined || (normalized.startsWith('/') ? '/' : '.')
}

const stripTrailingSlash = (value: string) =>
  value.length > 1 ? value.replace(/\/+$/g, '') : value

const assertAbsolutePath = (value: string, label: string) => {
  if (typeof value !== 'string' || !normalizeSlashes(value).startsWith('/')) {
    throw createBuildError({
      type: 'BuildError',
      message: `${label} must be an absolute path. Received '${value || ''}'.`
    })
  }
  return stripTrailingSlash(normalizeFilesystemPath(value)) || '/'
}

/**
 * Normalizes app/project paths and rejects traversal above the app root.
 * app:// is a restricted file-like protocol rooted at appWorkingDir.
 */
const normalizeAppProjectPath = (value: string) => {
  const normalized = normalizeFilesystemPath(value)
  if (!normalized.startsWith('/')) {
    throw new Error(`Internal app path must be absolute: ${value}`)
  }
  if (normalized.includes('/../') || normalized.endsWith('/..')) {
    throw new Error(
      `Path traversal outside project root is not allowed: ${value}`
    )
  }
  return normalized
}

export const getResourceProtocol = (resourceUri: string) => {
  const match = String(resourceUri || '').match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  return match ? match[1] : ''
}

export const getBuildResourceProtocolCategory = (
  protocol: string
): BuildResourceProtocolCategory => {
  const categories = BuildResourceProtocolCategories as Record<
    string,
    readonly string[]
  >
  for (const category of Object.keys(
    categories
  ) as BuildResourceProtocolCategory[]) {
    if (categories[category].includes(protocol)) return category
  }
  return 'mutable'
}

export const assertResourceHasProtocol = (
  resourceUri: string,
  context?: BuildContext,
  path?: string[]
) => {
  if (!getResourceProtocol(resourceUri)) {
    throw createBuildError({
      type: 'BuildError',
      importTrace: context?.importTrace,
      path,
      message: `Missing protocol at '${resourceUri}'. Build resource imports must be explicit, for example app://./file.gcscript.jsonc or app:///file.gcscript.jsonc.`
    })
  }
}

export const assertBuildFileUri = (fileUri: string) => {
  const parsed = parseBuildResourceUri(fileUri)
  if (parsed.protocol !== 'app' || !parsed.isAbsolute) {
    throw createBuildError({
      type: 'BuildError',
      message: `build() fileUri must be an absolute app:// URI such as '${DefaultMainFileAppURI}'. Received '${
        fileUri || ''
      }'.`
    })
  }
  return appProjectPathToUri(normalizeAppProjectPath(parsed.path))
}

const appProjectPathToUri = (projectPath: string) =>
  `app://${normalizeAppProjectPath(projectPath)}`

const joinAppProjectPath = (baseDir: string, childPath: string) => {
  const parts = normalizeAppProjectPath(baseDir).split('/').filter(Boolean)
  for (const rawPart of normalizeSlashes(childPath).split('/')) {
    const part = rawPart.trim()
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) {
        throw new Error(
          `Path traversal outside project root is not allowed: ${childPath}`
        )
      }
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return `/${parts.join('/')}`
}

const filePathToUri = (filesystemPath: string) =>
  `file://${encodeURI(normalizeFilesystemPath(filesystemPath))}`

export const parseBuildResourceUri = (resourceUri: string) => {
  const parsed = splitProtocol(resourceUri)
  if (!parsed) {
    return { protocol: '', path: resourceUri, isAbsolute: false }
  }
  const { protocol, rest } = parsed
  if (protocol === 'app' || protocol === 'file') {
    if (rest.startsWith('///')) {
      return {
        protocol,
        path: decodeURIComponent(rest.slice(2)),
        isAbsolute: true
      }
    }
    if (rest.startsWith('//')) {
      return {
        protocol,
        path: decodeURIComponent(rest.slice(2)),
        isAbsolute: false
      }
    }
    return {
      protocol,
      path: decodeURIComponent(rest.replace(/^\/+/, '')),
      isAbsolute: false
    }
  }
  return { protocol, path: rest, isAbsolute: true }
}

export const appUriToProjectPath = (resourceUri: string) => {
  const parsed = parseBuildResourceUri(resourceUri)
  if (parsed.protocol !== 'app') {
    throw new Error(`Expected app:// URI. Received '${resourceUri}'.`)
  }
  return normalizeAppProjectPath(
    parsed.isAbsolute ? parsed.path : `/${parsed.path}`
  )
}

export const fileUriToFilesystemPath = (resourceUri: string) => {
  const parsed = parseBuildResourceUri(resourceUri)
  if (parsed.protocol !== 'file') {
    throw new Error(`Expected file:// URI. Received '${resourceUri}'.`)
  }
  return normalizeFilesystemPath(
    parsed.isAbsolute ? parsed.path : `/${parsed.path}`
  )
}

const appProjectPathToFilesystemPath = (
  appWorkingDir: string,
  projectPath: string
) => joinFilesystemPath(appWorkingDir, normalizeAppProjectPath(projectPath))

const filesystemPathToAppProjectPath = (
  appWorkingDir: string,
  filesystemPath: string
) => {
  const root = stripTrailingSlash(normalizeFilesystemPath(appWorkingDir)) || '/'
  const target = normalizeFilesystemPath(filesystemPath)
  if (root === '/') return normalizeAppProjectPath(target)
  if (target === root) return '/'
  if (!target.startsWith(`${root}/`)) return undefined
  return normalizeAppProjectPath(target.slice(root.length) || '/')
}

const getCurrentFilesystemPath = (context: BuildContext) => {
  const protocol = getResourceProtocol(context.fileUri)
  if (protocol === 'file') return fileUriToFilesystemPath(context.fileUri)
  if (protocol === 'app') {
    return appProjectPathToFilesystemPath(
      context.appWorkingDir,
      appUriToProjectPath(context.fileUri)
    )
  }
  return appProjectPathToFilesystemPath(context.appWorkingDir, '/')
}

export const resolveBuildResourceUri = (
  resourceUri: string,
  context: BuildContext,
  path?: string[]
) => {
  assertResourceHasProtocol(resourceUri, context, path)
  const parsed = parseBuildResourceUri(resourceUri)
  const protocol = parsed.protocol

  if (!BuildResourceProtocols.includes(protocol as BuildResourceProtocol)) {
    throw createBuildError({
      type: 'BuildError',
      importTrace: context.importTrace,
      path,
      message: `Unknown protocol '${protocol}' at '${resourceUri}'`
    })
  }
  if (!context.allowedProtocols.includes(protocol)) {
    throw createBuildError({
      type: 'BuildError',
      importTrace: context.importTrace,
      path,
      message: `Illegal protocol '${protocol}' at '${resourceUri}'`
    })
  }

  if (protocol === 'app' || protocol === 'file') {
    if (protocol === 'app') {
      try {
        const currentProtocol = getResourceProtocol(context.fileUri)
        if (!parsed.isAbsolute && currentProtocol === 'app') {
          const projectPath = joinAppProjectPath(
            dirnameOf(appUriToProjectPath(context.fileUri)),
            parsed.path
          )
          return appProjectPathToUri(projectPath)
        }

        const currentDir = dirnameOf(getCurrentFilesystemPath(context))
        const targetFilesystemPath = parsed.isAbsolute
          ? appProjectPathToFilesystemPath(context.appWorkingDir, parsed.path)
          : joinFilesystemPath(currentDir, parsed.path)
        const projectPath = filesystemPathToAppProjectPath(
          context.appWorkingDir,
          targetFilesystemPath
        )
        if (!projectPath) {
          throw new Error(
            `app:// resource '${resourceUri}' resolves outside the app root.`
          )
        }
        return appProjectPathToUri(projectPath)
      } catch (err) {
        throw createBuildError({
          type: 'BuildError',
          importTrace: context.importTrace,
          path,
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }

    const currentDir = dirnameOf(getCurrentFilesystemPath(context))
    const targetFilesystemPath = parsed.isAbsolute
      ? normalizeFilesystemPath(parsed.path)
      : joinFilesystemPath(currentDir, parsed.path)
    return filePathToUri(targetFilesystemPath)
  }

  if (protocol === 'http' || protocol === 'https' || protocol === 'blob') {
    return resourceUri
  }

  return resourceUri
}

export const resourceUriToRelativePath = (resourceUri: string) => {
  const protocol = getResourceProtocol(resourceUri)
  if (!protocol) return normalizeFilesystemPath(resourceUri).replace(/^\/+/, '')

  if (protocol === 'app') {
    return appUriToProjectPath(resourceUri).replace(/^\/+/, '')
  }

  if (protocol === 'file') return fileUriToFilesystemPath(resourceUri)

  return normalizeFilesystemPath(
    decodeURIComponent(new URL(resourceUri).pathname)
  ).replace(/^\/+/, '')
}

export const resolveResourceUri = (resourceUri: string, baseUri?: string) => {
  if (!baseUri || hasProtocol(resourceUri)) return resourceUri
  if (baseUri.startsWith('http:') || baseUri.startsWith('https:')) {
    return new URL(resourceUri, baseUri).toString()
  }
  return resourceUri
}

const createBuildError = ({
  type,
  importTrace,
  path,
  message,
  data
}: {
  type: string
  importTrace?: string[]
  path?: string[]
  message: string
  data?: Record<string, unknown>
}) => {
  const error = new Error(message) as Error & {
    type?: string
    importTrace?: string[]
    path?: string
    data?: Record<string, unknown>
  }
  error.type = type
  error.importTrace = importTrace
  error.path = path ? path2Str(path) : undefined
  error.data = data
  return error
}

const createBuildSecurityError = async (
  context: BuildContext | undefined,
  message: string,
  data?: Record<string, unknown>
) => {
  if (context) {
    await emitBuildEvent(context, {
      type: 'security:error',
      message,
      data
    })
  }
  return createBuildError({
    type: 'BuildSecurityError',
    importTrace: context?.importTrace,
    message
  })
}

const assertMutableBranchCanAccessProtocol = async (
  context: BuildContext | undefined,
  protocol: string,
  resourceUri: string
) => {
  const category = getBuildResourceProtocolCategory(protocol)
  const mutableAncestorUri = context?.security.mutableAncestorUri
  if (mutableAncestorUri && category === 'local') {
    throw await createBuildSecurityError(
      context,
      `Mutable remote resource '${mutableAncestorUri}' cannot import local resource '${resourceUri}'`,
      { mutableAncestorUri, resourceUri, protocol }
    )
  }
}

const isRemoteDomainAllowed = (resourceUri: string, whitelist?: string[]) => {
  if (!whitelist || whitelist.length === 0) return true
  const host = new URL(resourceUri).hostname.toLowerCase()
  return whitelist.some((entry) => {
    const rule = entry.trim().toLowerCase()
    if (!rule) return false
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1)
      return host.endsWith(suffix) && host !== suffix.slice(1)
    }
    return host === rule
  })
}

const defaultAppProtocolHandler: BuildProtocolHandler = async (
  resourceUri,
  args
) => {
  const files = args.context?.files || args.files || {}
  const relativePath = resourceUriToRelativePath(resourceUri)
  const file = files[relativePath]
  if (file?.data !== undefined) return Buffer.from(file.data)
  throw new Error(`Resource '${resourceUri}' not found in virtual filesystem`)
}

const fetchProtocolHandler: BuildProtocolHandler = async (resourceUri) => {
  if (typeof fetch !== 'function') {
    throw new Error(`No fetch implementation available for '${resourceUri}'`)
  }
  const response = await fetch(resourceUri)
  if (!response.ok) {
    throw new Error(`Failed to fetch '${resourceUri}' (${response.status})`)
  }
  return Buffer.from(await response.arrayBuffer())
}

const unavailableProtocolHandler =
  (protocol: string): BuildProtocolHandler =>
  async (resourceUri) => {
    throw new Error(
      `Protocol '${protocol}' is not available by default for '${resourceUri}'. Provide options.protocolHandlers.${protocol}.`
    )
  }

export const defaultBuildProtocolHandlers: BuildProtocolHandlers = {
  app: defaultAppProtocolHandler,
  http: fetchProtocolHandler,
  https: fetchProtocolHandler,
  file: unavailableProtocolHandler('file'),
  blob: fetchProtocolHandler
}

export const getResource = async (
  fileUri: string,
  options: BuildResourceArgs
) => {
  const context = options.context
  const resourceUri = context
    ? resolveBuildResourceUri(fileUri, context)
    : resolveResourceUri(fileUri, options?.baseUri)
  const allowedProtocols = options?.allowedProtocols ||
    context?.allowedProtocols || [...DefaultBuildAllowedProtocols]
  const protocolHandlers: BuildProtocolHandlers = {
    ...defaultBuildProtocolHandlers,
    ...(context?.protocolHandlers || {}),
    ...(options.protocolHandlers || {})
  }

  const protocol = getResourceProtocol(resourceUri)
  if (!protocol) throw new Error(`Missing protocol at '${resourceUri}'`)
  if (!BuildResourceProtocols.includes(protocol as BuildResourceProtocol)) {
    throw new Error(`Unknown protocol '${protocol}' at '${resourceUri}'`)
  }
  if (allowedProtocols && !allowedProtocols.includes(protocol)) {
    throw new Error(`Illegal protocol '${protocol}' at '${resourceUri}'`)
  }
  await assertMutableBranchCanAccessProtocol(context, protocol, resourceUri)

  if (
    (protocol === 'http' || protocol === 'https') &&
    !isRemoteDomainAllowed(
      resourceUri,
      options.allowedRemoteDomains || options.context?.allowedRemoteDomains
    )
  ) {
    throw await createBuildSecurityError(
      context,
      `Remote domain is not allowed for '${resourceUri}'`,
      { resourceUri, protocol }
    )
  }

  const handler = protocolHandlers[protocol]
  if (!handler) throw new Error(`Missing handler for protocol '${protocol}'`)

  if (context) {
    await emitBuildEvent(context, {
      type: 'resource:load',
      protocol,
      fileUri: resourceUri,
      message: `Loading ${resourceUri}`
    })
  }

  const data = await handler(resourceUri, { ...options, fileUri: resourceUri })

  if (context && context.options.collectSummary) {
    const buffer = Buffer.from(data)
    let resourceHash: string | undefined
    let jsonCompatible = false
    try {
      resourceHash = hashCode(parseGCScriptJSONC(buffer.toString('utf8')))
      jsonCompatible = true
    } catch {
      // Non-JSON resources (for example Aiken/Helios source imported as hex)
      // are valid build inputs, but they do not have a wallet-compatible
      // GCScript hashCode(). The CLI summary still reports bytes and lines.
    }
    await emitBuildEvent(context, {
      type: 'resource:loaded',
      protocol,
      fileUri: resourceUri,
      message: `Loaded ${resourceUri}`,
      data: {
        bytes: buffer.byteLength,
        lines: buffer.toString('utf8').split(/\r?\n/).length,
        hashCode: resourceHash,
        jsonCompatible
      }
    })
  }

  return data
}

/**
 * Parses build-only JSONC into strict GCScript JSON.
 *
 * Supported compatibility extensions are intentionally narrow: comments and
 * trailing commas only. The returned value is a normal JS JSON value and all
 * comments/trailing commas disappear from the final wallet-facing output.
 */
export function parseGCScriptJSONC(input: string): GCScript {
  if (typeof input !== 'string') {
    throw new Error('Build input must be a raw GCScript JSON string')
  }

  const errors: { error: number; offset: number; length: number }[] = []
  const result = parseJSONC(input, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false
  }) as GCScript

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const line = input.slice(0, error.offset).split(/\r?\n/).length
        return `${printParseErrorCode(error.error)} at line ${line}`
      })
      .join('; ')
    throw new Error(`Invalid GCScript JSON/JSONC input. ${details}`)
  }

  return result
}

export type {
  JsonLocation,
  ValidationErrorReport,
  ValidationProfiling,
  ValidationReport,
  ValidateOptions,
  ValidateContext,
  SchemaValueIndex,
  SchemaPropertyIndex,
  SchemaISLFunctionIndex
} from './validate/helpers'
export {
  createSchemaISLFunctionIndex,
  createSchemaPropertyIndex,
  createSchemaValueIndex,
  docs as validationDocs,
  downloadGCScriptSchema,
  getJsonPathLocation,
  getAtJsonPath,
  jsonPointerToPathParts,
  normalizeAdditionalPropertyError,
  normalizeConstEnumError,
  normalizeFallbackAjvError,
  normalizeOneOfAnyOfError,
  normalizeRequiredPropertyError,
  normalizeRootKnownFunctionError,
  normalizeStrictJsonSyntaxError,
  normalizeTypeMismatchError,
  normalizers,
  parseGCScriptJSON,
  pathPartsToJsonPointer,
  validate,
  validateGCScriptObject,
  validateToDataURI
} from './validate/helpers'

export const getBufferAs = async (
  fileBuff: Uint8Array | ArrayBuffer,
  as: BuildDataFormat
) => {
  const buffer = Buffer.from(
    fileBuff instanceof ArrayBuffer ? new Uint8Array(fileBuff) : fileBuff
  )
  if (as === 'string') return buffer.toString('utf8')
  if (as === 'object') return parseGCScriptJSONC(buffer.toString('utf8'))
  if (as === 'json') {
    return JSON.stringify(parseGCScriptJSONC(buffer.toString('utf8')))
  }
  if (as === 'hex') return buffer.toString('hex')
  if (as === 'base64') return buffer.toString('base64')
  throw new Error(
    `Unknown data format '${as || ''}'. Must be one of '${BuildDataFormats.join(
      ', '
    )}'`
  )
}

export const path2Str = (path: string[]) => [...(path || [])].join('/')

export { createBuildError }

const getChildSecurityContext = (
  context: BuildContext,
  resourceUri: string
): BuildSecurityContext => {
  const protocol = getResourceProtocol(resourceUri)
  const category = getBuildResourceProtocolCategory(protocol)
  return {
    ...context.security,
    mutableAncestorUri:
      context.security.mutableAncestorUri ||
      (category === 'mutable' ? resourceUri : undefined)
  }
}

export const defaultBuildDirectiveHandlers: BuildDirectiveHandlers = {
  $importAsScript: async ({ node, path, context }) => {
    const { type, args, argsByKey, from, ...props } = (node || {}) as any
    const kvFrom = toKVList(from)
    const kvArgsByKey = toKVList(argsByKey)

    if (!(kvFrom.length > 0)) {
      throw new Error(
        `At least one valid resource URI must be provided in 'from' in '${type}'`
      )
    }
    if (argsByKey !== undefined && !(kvArgsByKey.length > 0)) {
      throw new Error(
        `At least one argument must be provided in 'argsByKey' in '${type}'`
      )
    }
    if (args && kvArgsByKey.length > 0) {
      throw new Error(
        `Only one argument passing method can be used. You provided 'args' and 'argsByKey' in '${type}'`
      )
    }

    const fromKeysDict: Record<string, string> = {}
    for (let kvIndex = 0; kvIndex < kvFrom.length; kvIndex++) {
      const [fromKey, rawFileUri] = kvFrom[kvIndex]
      const fileUri = resolveBuildResourceUri(String(rawFileUri), context, [
        ...path,
        String(fromKey)
      ])
      const fileBuff = await getResource(fileUri, {
        ...context.options,
        context,
        baseUri: context.fileUri,
        explicitBaseUri: context.explicitFileUri
      })
      const solvedData = await build({
        ...context.options,
        input: Buffer.from(fileBuff).toString('utf8'),
        fileUri,
        appWorkingDir: context.appWorkingDir,
        files: context.files,
        allowedProtocols: context.allowedProtocols,
        allowedRemoteDomains: context.allowedRemoteDomains,
        protocolHandlers: context.protocolHandlers,
        directiveHandlers: context.directiveHandlers,
        importTrace: context.importTrace,
        security: {
          ...getChildSecurityContext(context, fileUri),
          __allowResolvedFileUri: true
        } as BuildSecurityContext,
        onEvent: context.options.onEvent
      })
      kvFrom[kvIndex] = [fromKey, solvedData]
      fromKeysDict[fromKey] = fileUri
    }

    for (const [argKey] of kvArgsByKey) {
      if (!fromKeysDict[argKey]) {
        throw new Error(
          `Argument provided in 'argsByKey' for an unknown resource key '${argKey}' in '${type}'`
        )
      }
    }

    const solvedFrom = isArray(from)
      ? kvList2Array(kvFrom)
      : kvList2Object(kvFrom)
    const newNode: Record<string, GCScript> = {
      ...props,
      type: 'script',
      run: solvedFrom
    }
    if (args) newNode.args = args
    if (argsByKey) newNode.argsByKey = argsByKey

    await emitBuildEvent(context, {
      type: 'directive:resolved',
      directive: type,
      path: path2Str(path),
      message: `Resolved ${type}`
    })
    return newNode
  },

  $importAsData: async ({ node, path, context }) => {
    const { type, as = 'string', from, ...props } = (node || {}) as any
    const kvFrom = toKVList(from)

    if (!BuildDataFormats.includes(as)) {
      throw new Error(
        `Missing or invalid 'as' value in '${type}'. Must be one of '${BuildDataFormats.join(
          ', '
        )}'`
      )
    }
    if (!(kvFrom.length > 0)) {
      throw new Error(
        `At least one valid resource URI must be provided in 'from' in '${type}'`
      )
    }

    for (let kvIndex = 0; kvIndex < kvFrom.length; kvIndex++) {
      const [fromKey, rawFileUri] = kvFrom[kvIndex]
      const fileUri = resolveBuildResourceUri(String(rawFileUri), context, [
        ...path,
        String(fromKey)
      ])
      const fileBuff = await getResource(fileUri, {
        ...context.options,
        context,
        baseUri: context.fileUri,
        explicitBaseUri: context.explicitFileUri
      })
      const solvedData = await getBufferAs(fileBuff, as)
      kvFrom[kvIndex] = [fromKey, solvedData]
    }

    await emitBuildEvent(context, {
      type: 'directive:resolved',
      directive: type,
      path: path2Str(path),
      message: `Resolved ${type}`
    })
    return {
      ...props,
      type: 'data',
      value: isArray(from) ? kvList2Array(kvFrom) : kvList2Object(kvFrom)
    }
  }
}

const createBuildContext = (options: BuildOptions): BuildContext => {
  const appWorkingDir = assertAbsolutePath(
    options.appWorkingDir || DefaultFilesystemRoot,
    'build() appWorkingDir'
  )
  const allowResolvedFileUri = Boolean(
    (
      options.security as
        | (BuildSecurityContext & { __allowResolvedFileUri?: boolean })
        | undefined
    )?.__allowResolvedFileUri
  )
  const rawFileUri = options.fileUri || DefaultMainFileAppURI
  const fileUri = allowResolvedFileUri
    ? resolveResourceUri(rawFileUri)
    : assertBuildFileUri(rawFileUri)
  return {
    input: options.input,
    fileUri,
    explicitFileUri: Boolean(options.fileUri),
    appWorkingDir,
    files: options.files || {},
    allowedProtocols: options.allowedProtocols || [
      ...DefaultBuildAllowedProtocols
    ],
    allowedRemoteDomains: options.allowedRemoteDomains,
    protocolHandlers: {
      ...defaultBuildProtocolHandlers,
      ...(options.protocolHandlers || {})
    },
    directiveHandlers: {
      ...defaultBuildDirectiveHandlers,
      ...(options.directiveHandlers || {})
    },
    importTrace: [...(options.importTrace || [])],
    security: { ...(options.security || {}) },
    options,
    state: {}
  }
}

export const resolveBuildDirectivesStage: BuildStage = async ({
  context,
  previousResult
}) => {
  await emitBuildEvent(context, {
    type: 'stage:start',
    stage: 'directives',
    message: `Resolving build directives in ${context.fileUri}`
  })

  return gcScriptWalker({
    code: previousResult,
    context: {
      ...context,
      importTrace: [...context.importTrace, context.fileUri]
    },
    onNode: async ({ node, path, key, index, context: walkerContext }) => {
      const type = (node as any)?.type
      const directiveHandler = type
        ? walkerContext.directiveHandlers[type]
        : undefined
      if (!directiveHandler) return node

      try {
        await emitBuildEvent(walkerContext, {
          type: 'directive:start',
          directive: type,
          path: path2Str(path),
          message: `Resolving ${type}`
        })
        return directiveHandler({
          node,
          path,
          key,
          index,
          context: walkerContext
        })
      } catch (err) {
        const typedError = err as Error & { type?: string }
        if (typedError?.type) throw typedError
        throw createBuildError({
          type: 'BuildError',
          importTrace: walkerContext.importTrace,
          path,
          message: typedError?.message || 'Unknown build directive error'
        })
      }
    }
  })
}

/** Validates the resolved build output, after build directives have been expanded. */
export const validateBuildOutputStage: BuildStage = async ({
  context,
  previousResult
}) => {
  if (context.options.doValidate === false) return previousResult

  await emitBuildEvent(context, {
    type: 'stage:start',
    stage: 'validate',
    message: `Validating ${context.fileUri}`
  })

  const validationInput = JSON.stringify(previousResult, null, 2)
  const report = await validateGCScriptObject({
    code: previousResult,
    context,
    useSchema: context.options.useSchema,
    schemaRootFile: context.options.schemaRootFile,
    input: validationInput,
    rootNode: parseTree(validationInput)
  })

  if (report.warnings.length > 0) {
    await emitBuildEvent(context, {
      type: 'validate:warning',
      message: `${report.warnings.length} validation warning(s) in ${context.fileUri}`,
      data: { report: report as unknown as Record<string, unknown> }
    })
  }

  if (!report.isValid) {
    const firstError = report.errors[0]
    await emitBuildEvent(context, {
      type: 'validate:error',
      message: firstError?.message || `Invalid ${context.fileUri}`,
      path: firstError?.jsonPath,
      data: { report: report as unknown as Record<string, unknown> }
    })
    throw createBuildError({
      type: 'BuildValidationError',
      importTrace: context.importTrace,
      message: firstError
        ? `${firstError.message} at '${firstError.jsonPath}'`
        : `Invalid GCScript at '${context.fileUri}'`
    })
  }

  await emitBuildEvent(context, {
    type: 'validate:success',
    message: `Valid ${context.fileUri}`
  })
  return previousResult
}

export const defaultBuildStages: BuildStage[] = [
  resolveBuildDirectivesStage,
  validateBuildOutputStage
]

export const build = async (options: BuildOptions): Promise<GCScript> => {
  const context = createBuildContext(options)

  if (context.importTrace.includes(context.fileUri)) {
    throw createBuildError({
      type: 'BuildError',
      importTrace: context.importTrace,
      message: `Circular import of resource '${context.fileUri}' is not allowed`
    })
  }

  await emitBuildEvent(context, {
    type: 'build:start',
    message: `Building ${context.fileUri}`
  })

  await emitBuildEvent(context, {
    type: 'stage:start',
    stage: 'parse',
    message: `Parsing ${context.fileUri}`
  })
  let result = parseGCScriptJSONC(context.input)

  for (const stage of options.stages || defaultBuildStages) {
    result = await stage({ ...options, context, previousResult: result })
  }

  await emitBuildEvent(context, {
    type: 'build:success',
    message: `Built ${context.fileUri}`
  })
  return result
}

export const buildToDataURI = async (
  input: string,
  options: Omit<BuildOptions, 'input'> = {}
) => {
  const built = await build({ ...options, input })
  const indent = options.compactOutput ? undefined : 2
  return bufferToDataURI(
    Buffer.from(JSON.stringify(built, null, indent), 'utf8'),
    BuildOutputMimeType
  )
}
