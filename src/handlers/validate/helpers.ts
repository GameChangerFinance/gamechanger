import Ajv from 'ajv'
import {
  findNodeAtLocation,
  getLocation,
  parse as parseJSONC,
  parseTree,
  printParseErrorCode
} from 'jsonc-parser'
import { Buffer } from 'buffer'
import {
  BuildOutputMimeType,
  DefaultMainFileAppURI,
  GCScriptAPIRefURL,
  GCScriptDocsURL,
  GCScriptSchemaRootFile,
  GCScriptSchemaURL
} from '../../config'
import { bufferToDataURI } from '../../utils'
import {
  type BuildContext,
  type BuildEventHandler,
  type GCScript,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue
} from '../helpers'

export type JsonLocation = {
  line?: number
  column?: number
  offset?: number
  length?: number
}

export type ValidationErrorReport = {
  code: string
  message: string
  fileName?: string
  fileUri?: string
  filePath?: string
  jsonPath: string
  location?: JsonLocation
  error?: string
  suggestion?: string
  examples?: JsonValue[]
  relatedDocs?: string[]
  provided?: JsonValue
  details?: JsonValue
}

export type ValidationProfiling = {
  validateMs?: number
  buildMs?: number
  schemaMs?: number
}

export type ValidationReport = {
  isValid: boolean
  errors: ValidationErrorReport[]
  /** Non-blocking diagnostics. These never make isValid false. */
  warnings: ValidationErrorReport[]
  profiling?: ValidationProfiling
}

export type ValidateOptions = {
  /** validate() consumes built strict JSON. JSONC comments/trailing commas are rejected here. */
  input: string
  fileUri?: string
  fileName?: string
  filePath?: string
  useSchema?: JsonValue
  schemaUrl?: string
  schemaRootFile?: string
  profiling?: ValidationProfiling
  onEvent?: BuildEventHandler
}

export type ValidateContext = {
  input: string
  fileUri: string
  fileName?: string
  filePath?: string
  useSchema?: JsonValue
  schemaUrl: string
  schemaRootFile: string
  options: ValidateOptions
  state: Record<string, unknown>
}

const MAX_SCHEMA_INDEX_NODES = 120000
const MAX_VALUE_SCAN_NODES = 60000
const MAX_VALUE_SCAN_DEPTH = 120
const MAX_ISL_SCAN_STRING_LENGTH = 12000

const emitValidationEvent = async (
  context: ValidateContext,
  event: {
    type: string
    message?: string
    stage?: string
    fileUri?: string
    path?: string
    data?: Record<string, unknown>
  }
) => {
  if (!context.options.onEvent) return
  await context.options.onEvent(
    {
      fileUri: context.fileUri,
      ...event
    },
    context
  )
}

type SchemaValueIndexEntry = {
  propertyName: string
  value: JsonValue
  schemaPath: string
  description?: string
  docs?: string[]
  examples?: JsonValue[]
  context?: JsonObject
}

export type SchemaValueIndex = Map<string, SchemaValueIndexEntry[]>

type SchemaPropertyIndexEntry = {
  propertyName: string
  schemaPath: string
  description?: string
  docs?: string[]
  examples?: JsonValue[]
  context?: JsonObject
  siblingProperties?: string[]
  requiredProperties?: string[]
  typeValues?: JsonValue[]
}

export type SchemaPropertyIndex = Map<string, SchemaPropertyIndexEntry[]>

type SchemaISLFunctionEntry = {
  name: string
  schemaPath: string
  description?: string
  docs?: string[]
  examples?: JsonValue[]
}

export type SchemaISLFunctionIndex = Map<string, SchemaISLFunctionEntry>

type SchemaBranchIndexEntry = {
  schemaPath: string
  title?: string
  description?: string
  docs?: string[]
  examples?: JsonValue[]
  propertyNames: string[]
  requiredProperties: string[]
  discriminatorValues: Record<string, JsonValue[]>
  primitiveTypes: string[]
  additionalProperties?: unknown
}

export type SchemaBranchIndex = SchemaBranchIndexEntry[]

export type SchemaDiagnosticIndex = {
  values: SchemaValueIndex
  properties: SchemaPropertyIndex
  branches: SchemaBranchIndex
  islFunctions: SchemaISLFunctionIndex
}

type JsonParseError = { error: number; offset: number; length: number }

type NormalizerArgs = {
  context: ValidateContext | BuildContext
  input?: string
  code?: GCScript
  rootNode?: unknown
  schemaValueIndex: SchemaValueIndex
  schemaPropertyIndex: SchemaPropertyIndex
  schemaBranchIndex?: SchemaBranchIndex
  diagnosticIndex?: SchemaDiagnosticIndex
  schema?: Record<string, any>
  schemaRootFile?: string
  ajvErrors?: any[]
  syntaxErrors?: JsonParseError[]
}

type DiagnosticNormalizer = (
  args: NormalizerArgs
) => ValidationErrorReport | undefined

const schemaValueIndexCache = new WeakMap<
  Record<string, any>,
  SchemaValueIndex
>()
const schemaPropertyIndexCache = new WeakMap<
  Record<string, any>,
  SchemaPropertyIndex
>()
const schemaISLFunctionIndexCache = new WeakMap<
  Record<string, any>,
  SchemaISLFunctionIndex
>()
const schemaBranchIndexCache = new WeakMap<
  Record<string, any>,
  SchemaBranchIndex
>()
const schemaDiagnosticIndexCache = new WeakMap<
  Record<string, any>,
  SchemaDiagnosticIndex
>()
const compiledSchemaCache = new WeakMap<
  Record<string, any>,
  Map<string, ReturnType<Ajv['compile']>>
>()

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isJsonPrimitive = (value: unknown): value is JsonPrimitive =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)

const pointerEscape = (part: string) =>
  String(part).replace(/~/g, '~0').replace(/\//g, '~1')

const pointerUnescape = (part: string) =>
  String(part).replace(/~1/g, '/').replace(/~0/g, '~')

export const pathPartsToJsonPointer = (parts: string[]) =>
  parts.length > 0 ? `/${parts.map(pointerEscape).join('/')}` : '/'

export const jsonPointerToPathParts = (path: string) => {
  const normalized = String(path || '')
  if (!normalized || normalized === '/') return []
  return normalized.split('/').slice(1).map(pointerUnescape)
}

const appendJsonPointer = (basePath: string, propertyName: string) => {
  const normalized = basePath && basePath !== '/' ? basePath : ''
  return `${normalized}/${pointerEscape(propertyName)}`
}

export const getAtJsonPath = (code: GCScript | undefined, path: string) => {
  let cursor: unknown = code
  for (const part of jsonPointerToPathParts(path)) {
    if (cursor === null || cursor === undefined) return undefined
    cursor = (cursor as any)[part]
  }
  return cursor
}

const toReportJsonValue = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue
  } catch {
    return String(value)
  }
}

const normalizeExamples = (schema: Record<string, any>) =>
  Array.isArray(schema.examples)
    ? (schema.examples.map(toReportJsonValue).filter(Boolean) as JsonValue[])
    : undefined

const normalizeDocs = (value: unknown): string[] | undefined => {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value)) {
    const docs = value.filter((item) => typeof item === 'string' && item.trim())
    return docs.length > 0 ? docs : undefined
  }
  return undefined
}

const schemaPathJoin = (basePath: string, part: string) =>
  `${basePath}/${pointerEscape(part)}`

const canVisitSchemaNode = (
  node: unknown,
  seen: WeakSet<object>,
  budget: { count: number }
) => {
  if (!node || typeof node !== 'object') return false
  if (seen.has(node)) return false
  seen.add(node)
  budget.count += 1
  return budget.count <= MAX_SCHEMA_INDEX_NODES
}

const createSchemaContext = (schema: Record<string, any>) => {
  const context: JsonObject = {}
  for (const key of ['title', 'type', '$id'] as const) {
    if (isJsonPrimitive(schema[key])) context[key] = schema[key]
  }
  return Object.keys(context).length > 0 ? context : undefined
}

const addSchemaValueIndexEntry = (
  index: SchemaValueIndex,
  entry: SchemaValueIndexEntry
) => {
  const values = index.get(entry.propertyName) || []
  const duplicate = values.some(
    (item) =>
      item.schemaPath === entry.schemaPath &&
      JSON.stringify(item.value) === JSON.stringify(entry.value)
  )
  if (!duplicate) values.push(entry)
  index.set(entry.propertyName, values)
}

const walkSchemaValueIndex = ({
  node,
  schemaPath,
  propertyName,
  surroundingSchema,
  index,
  seen = new WeakSet<object>(),
  budget = { count: 0 }
}: {
  node: unknown
  schemaPath: string
  propertyName?: string
  surroundingSchema?: Record<string, any>
  index: SchemaValueIndex
  seen?: WeakSet<object>
  budget?: { count: number }
}) => {
  if (!canVisitSchemaNode(node, seen, budget)) return

  if (!isRecord(node)) {
    if (Array.isArray(node)) {
      node.forEach((item, indexValue) =>
        walkSchemaValueIndex({
          node: item,
          schemaPath: schemaPathJoin(schemaPath, String(indexValue)),
          propertyName,
          surroundingSchema,
          index,
          seen,
          budget
        })
      )
    }
    return
  }

  const docs = normalizeDocs(node.markdownDescription || node.docs || node.doc)
  const description =
    typeof node.description === 'string' && node.description.trim()
      ? node.description.trim()
      : undefined
  const examples = normalizeExamples(node)
  const context = createSchemaContext(surroundingSchema || node)

  if (propertyName && Object.prototype.hasOwnProperty.call(node, 'const')) {
    const value = toReportJsonValue(node.const)
    if (value !== undefined) {
      addSchemaValueIndexEntry(index, {
        propertyName,
        value,
        schemaPath: schemaPathJoin(schemaPath, 'const'),
        description,
        docs,
        examples,
        context
      })
    }
  }

  if (propertyName && Array.isArray(node.enum)) {
    node.enum.forEach((item: unknown, itemIndex: number) => {
      const value = toReportJsonValue(item)
      if (value !== undefined) {
        addSchemaValueIndexEntry(index, {
          propertyName,
          value,
          schemaPath: schemaPathJoin(
            schemaPathJoin(schemaPath, 'enum'),
            String(itemIndex)
          ),
          description,
          docs,
          examples,
          context
        })
      }
    })
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && isRecord(value)) {
      for (const [childPropertyName, childSchema] of Object.entries(value)) {
        walkSchemaValueIndex({
          node: childSchema,
          schemaPath: schemaPathJoin(
            schemaPathJoin(schemaPath, 'properties'),
            childPropertyName
          ),
          propertyName: childPropertyName,
          surroundingSchema: node,
          index,
          seen,
          budget
        })
      }
      continue
    }

    walkSchemaValueIndex({
      node: value,
      schemaPath: schemaPathJoin(schemaPath, key),
      propertyName,
      surroundingSchema,
      index,
      seen,
      budget
    })
  }
}

/** Builds a generic index of const/enum values grouped by property name. */
export const createSchemaValueIndex = (apiDef: Record<string, any>) => {
  const cached = schemaValueIndexCache.get(apiDef)
  if (cached) return cached

  const index: SchemaValueIndex = new Map()
  for (const [schemaFile, schema] of Object.entries(apiDef)) {
    walkSchemaValueIndex({
      node: schema,
      schemaPath: `/${pointerEscape(schemaFile)}`,
      index
    })
  }
  schemaValueIndexCache.set(apiDef, index)
  return index
}

const schemaObjectPropertyNames = (schema: Record<string, any>) =>
  isRecord(schema.properties) ? Object.keys(schema.properties) : []

const schemaRequiredPropertyNames = (schema: Record<string, any>) =>
  Array.isArray(schema.required)
    ? schema.required.filter((item) => typeof item === 'string')
    : []

const collectSchemaTypeValues = (schema: Record<string, any>) => {
  const typeSchema = isRecord(schema.properties)
    ? schema.properties.type
    : undefined
  if (!isRecord(typeSchema)) return undefined
  const values: JsonValue[] = []
  if (Object.prototype.hasOwnProperty.call(typeSchema, 'const')) {
    const value = toReportJsonValue(typeSchema.const)
    if (value !== undefined) values.push(value)
  }
  if (Array.isArray(typeSchema.enum)) {
    for (const item of typeSchema.enum) {
      const value = toReportJsonValue(item)
      if (value !== undefined) values.push(value)
    }
  }
  return values.length > 0 ? values : undefined
}

const addSchemaPropertyIndexEntry = (
  index: SchemaPropertyIndex,
  entry: SchemaPropertyIndexEntry
) => {
  const values = index.get(entry.propertyName) || []
  if (!values.some((item) => item.schemaPath === entry.schemaPath)) {
    values.push(entry)
  }
  index.set(entry.propertyName, values)
}

const walkSchemaPropertyIndex = ({
  node,
  schemaPath,
  index,
  seen = new WeakSet<object>(),
  budget = { count: 0 }
}: {
  node: unknown
  schemaPath: string
  index: SchemaPropertyIndex
  seen?: WeakSet<object>
  budget?: { count: number }
}) => {
  if (!canVisitSchemaNode(node, seen, budget)) return

  if (!isRecord(node)) {
    if (Array.isArray(node)) {
      node.forEach((item, indexValue) =>
        walkSchemaPropertyIndex({
          node: item,
          schemaPath: schemaPathJoin(schemaPath, String(indexValue)),
          index,
          seen,
          budget
        })
      )
    }
    return
  }

  if (isRecord(node.properties)) {
    const siblingProperties = schemaObjectPropertyNames(node)
    const requiredProperties = schemaRequiredPropertyNames(node)
    const typeValues = collectSchemaTypeValues(node)
    const context = createSchemaContext(node)

    for (const [propertyName, propertySchema] of Object.entries(
      node.properties
    )) {
      const propertySchemaPath = schemaPathJoin(
        schemaPathJoin(schemaPath, 'properties'),
        propertyName
      )
      const typedPropertySchema = isRecord(propertySchema)
        ? propertySchema
        : undefined
      addSchemaPropertyIndexEntry(index, {
        propertyName,
        schemaPath: propertySchemaPath,
        description:
          typeof typedPropertySchema?.description === 'string'
            ? typedPropertySchema.description.trim()
            : undefined,
        docs: normalizeDocs(
          typedPropertySchema?.markdownDescription ||
            typedPropertySchema?.docs ||
            typedPropertySchema?.doc
        ),
        examples: typedPropertySchema
          ? normalizeExamples(typedPropertySchema)
          : undefined,
        context,
        siblingProperties,
        requiredProperties,
        typeValues
      })
    }
  }

  for (const [key, value] of Object.entries(node)) {
    walkSchemaPropertyIndex({
      node: value,
      schemaPath: schemaPathJoin(schemaPath, key),
      index,
      seen,
      budget
    })
  }
}

/** Builds a generic index of valid object-property names grouped by name. */
export const createSchemaPropertyIndex = (apiDef: Record<string, any>) => {
  const cached = schemaPropertyIndexCache.get(apiDef)
  if (cached) return cached

  const index: SchemaPropertyIndex = new Map()
  for (const [schemaFile, schema] of Object.entries(apiDef)) {
    walkSchemaPropertyIndex({
      node: schema,
      schemaPath: `/${pointerEscape(schemaFile)}`,
      index
    })
  }
  schemaPropertyIndexCache.set(apiDef, index)
  return index
}

const walkISLFunctionIndex = ({
  node,
  schemaPath,
  index,
  seen = new WeakSet<object>(),
  budget = { count: 0 }
}: {
  node: unknown
  schemaPath: string
  index: SchemaISLFunctionIndex
  seen?: WeakSet<object>
  budget?: { count: number }
}) => {
  if (!canVisitSchemaNode(node, seen, budget)) return

  if (!isRecord(node)) {
    if (Array.isArray(node)) {
      node.forEach((item, indexValue) =>
        walkISLFunctionIndex({
          node: item,
          schemaPath: schemaPathJoin(schemaPath, String(indexValue)),
          index,
          seen,
          budget
        })
      )
    }
    return
  }

  const title = typeof node.title === 'string' ? node.title.trim() : ''
  const pattern = typeof node.pattern === 'string' ? node.pattern : ''
  if (
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(title) &&
    pattern.includes(`${title}\\s*\\(`)
  ) {
    index.set(title, {
      name: title,
      schemaPath,
      description:
        typeof node.description === 'string'
          ? node.description.trim()
          : undefined,
      docs: normalizeDocs(node.markdownDescription || node.docs || node.doc),
      examples: normalizeExamples(node)
    })
  }

  for (const [key, value] of Object.entries(node)) {
    walkISLFunctionIndex({
      node: value,
      schemaPath: schemaPathJoin(schemaPath, key),
      index,
      seen,
      budget
    })
  }
}

export const createSchemaISLFunctionIndex = (apiDef: Record<string, any>) => {
  const cached = schemaISLFunctionIndexCache.get(apiDef)
  if (cached) return cached

  const index: SchemaISLFunctionIndex = new Map()
  if (apiDef['lang.json']) {
    walkISLFunctionIndex({
      node: apiDef['lang.json'],
      schemaPath: '/lang.json',
      index
    })
  }
  schemaISLFunctionIndexCache.set(apiDef, index)
  return index
}

const schemaPrimitiveTypes = (schema: Record<string, any>) => {
  const type = schema.type
  const types = Array.isArray(type) ? type : type ? [type] : []
  return types.filter((item) => typeof item === 'string')
}

const schemaConstEnumValues = (schema: unknown) => {
  if (!isRecord(schema)) return []
  const values: JsonValue[] = []
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    const value = toReportJsonValue(schema.const)
    if (value !== undefined) values.push(value)
  }
  if (Array.isArray(schema.enum)) {
    for (const item of schema.enum) {
      const value = toReportJsonValue(item)
      if (value !== undefined) values.push(value)
    }
  }
  return values
}

const collectSchemaDiscriminatorValues = (schema: Record<string, any>) => {
  const discriminators: Record<string, JsonValue[]> = {}
  if (!isRecord(schema.properties)) return discriminators

  for (const [propertyName, propertySchema] of Object.entries(
    schema.properties
  )) {
    const values = schemaConstEnumValues(propertySchema)
    if (values.length > 0) discriminators[propertyName] = values
  }
  return discriminators
}

const createSchemaBranchIndexEntry = (
  schema: Record<string, any>,
  schemaPath: string
): SchemaBranchIndexEntry | undefined => {
  const propertyNames = schemaObjectPropertyNames(schema)
  const requiredProperties = schemaRequiredPropertyNames(schema)
  const primitiveTypes = schemaPrimitiveTypes(schema)
  const discriminatorValues = collectSchemaDiscriminatorValues(schema)

  if (
    propertyNames.length === 0 &&
    requiredProperties.length === 0 &&
    primitiveTypes.length === 0 &&
    !Object.prototype.hasOwnProperty.call(schema, 'additionalProperties')
  ) {
    return undefined
  }

  return {
    schemaPath,
    title: typeof schema.title === 'string' ? schema.title.trim() : undefined,
    description:
      typeof schema.description === 'string'
        ? schema.description.trim()
        : undefined,
    docs: normalizeDocs(
      schema.markdownDescription || schema.docs || schema.doc
    ),
    examples: normalizeExamples(schema),
    propertyNames,
    requiredProperties,
    discriminatorValues,
    primitiveTypes,
    additionalProperties: schema.additionalProperties
  }
}

const walkSchemaBranchIndex = ({
  node,
  schemaPath,
  index,
  seen = new WeakSet<object>(),
  budget = { count: 0 }
}: {
  node: unknown
  schemaPath: string
  index: SchemaBranchIndex
  seen?: WeakSet<object>
  budget?: { count: number }
}) => {
  if (!canVisitSchemaNode(node, seen, budget)) return

  if (!isRecord(node)) {
    if (Array.isArray(node)) {
      node.forEach((item, indexValue) =>
        walkSchemaBranchIndex({
          node: item,
          schemaPath: schemaPathJoin(schemaPath, String(indexValue)),
          index,
          seen,
          budget
        })
      )
    }
    return
  }

  const entry = createSchemaBranchIndexEntry(node, schemaPath)
  if (entry) index.push(entry)

  for (const [key, value] of Object.entries(node)) {
    walkSchemaBranchIndex({
      node: value,
      schemaPath: schemaPathJoin(schemaPath, key),
      index,
      seen,
      budget
    })
  }
}

export const createSchemaBranchIndex = (apiDef: Record<string, any>) => {
  const cached = schemaBranchIndexCache.get(apiDef)
  if (cached) return cached

  const index: SchemaBranchIndex = []
  for (const [schemaFile, schema] of Object.entries(apiDef)) {
    walkSchemaBranchIndex({
      node: schema,
      schemaPath: `/${pointerEscape(schemaFile)}`,
      index
    })
  }
  schemaBranchIndexCache.set(apiDef, index)
  return index
}

const walkSchemaDiagnosticIndex = ({
  node,
  schemaPath,
  index,
  propertyName,
  surroundingSchema,
  seen = new WeakSet<object>(),
  budget = { count: 0 }
}: {
  node: unknown
  schemaPath: string
  index: SchemaDiagnosticIndex
  propertyName?: string
  surroundingSchema?: Record<string, any>
  seen?: WeakSet<object>
  budget?: { count: number }
}) => {
  if (!canVisitSchemaNode(node, seen, budget)) return

  if (!isRecord(node)) {
    if (Array.isArray(node)) {
      node.forEach((item, indexValue) =>
        walkSchemaDiagnosticIndex({
          node: item,
          schemaPath: schemaPathJoin(schemaPath, String(indexValue)),
          index,
          propertyName,
          surroundingSchema,
          seen,
          budget
        })
      )
    }
    return
  }

  const docs = normalizeDocs(node.markdownDescription || node.docs || node.doc)
  const description =
    typeof node.description === 'string' && node.description.trim()
      ? node.description.trim()
      : undefined
  const examples = normalizeExamples(node)
  const context = createSchemaContext(surroundingSchema || node)

  if (propertyName && Object.prototype.hasOwnProperty.call(node, 'const')) {
    const value = toReportJsonValue(node.const)
    if (value !== undefined) {
      addSchemaValueIndexEntry(index.values, {
        propertyName,
        value,
        schemaPath: schemaPathJoin(schemaPath, 'const'),
        description,
        docs,
        examples,
        context
      })
    }
  }

  if (propertyName && Array.isArray(node.enum)) {
    node.enum.forEach((item: unknown, itemIndex: number) => {
      const value = toReportJsonValue(item)
      if (value !== undefined) {
        addSchemaValueIndexEntry(index.values, {
          propertyName,
          value,
          schemaPath: schemaPathJoin(
            schemaPathJoin(schemaPath, 'enum'),
            String(itemIndex)
          ),
          description,
          docs,
          examples,
          context
        })
      }
    })
  }

  const branch = createSchemaBranchIndexEntry(node, schemaPath)
  if (branch) index.branches.push(branch)

  const title = typeof node.title === 'string' ? node.title.trim() : ''
  const pattern = typeof node.pattern === 'string' ? node.pattern : ''
  if (
    schemaPath.startsWith('/lang.json') &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(title) &&
    pattern.includes(`${title}\\s*\\(`)
  ) {
    index.islFunctions.set(title, {
      name: title,
      schemaPath,
      description,
      docs,
      examples
    })
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && isRecord(value)) {
      const siblingProperties = schemaObjectPropertyNames(node)
      const requiredProperties = schemaRequiredPropertyNames(node)
      const typeValues = collectSchemaTypeValues(node)
      const propertyContext = createSchemaContext(node)

      for (const [childPropertyName, childSchema] of Object.entries(value)) {
        const propertySchemaPath = schemaPathJoin(
          schemaPathJoin(schemaPath, 'properties'),
          childPropertyName
        )
        const typedPropertySchema = isRecord(childSchema)
          ? childSchema
          : undefined
        addSchemaPropertyIndexEntry(index.properties, {
          propertyName: childPropertyName,
          schemaPath: propertySchemaPath,
          description:
            typeof typedPropertySchema?.description === 'string'
              ? typedPropertySchema.description.trim()
              : undefined,
          docs: normalizeDocs(
            typedPropertySchema?.markdownDescription ||
              typedPropertySchema?.docs ||
              typedPropertySchema?.doc
          ),
          examples: typedPropertySchema
            ? normalizeExamples(typedPropertySchema)
            : undefined,
          context: propertyContext,
          siblingProperties,
          requiredProperties,
          typeValues
        })
        walkSchemaDiagnosticIndex({
          node: childSchema,
          schemaPath: propertySchemaPath,
          propertyName: childPropertyName,
          surroundingSchema: node,
          index,
          seen,
          budget
        })
      }
      continue
    }

    walkSchemaDiagnosticIndex({
      node: value,
      schemaPath: schemaPathJoin(schemaPath, key),
      propertyName,
      surroundingSchema,
      index,
      seen,
      budget
    })
  }
}

export const createSchemaDiagnosticIndex = (apiDef: Record<string, any>) => {
  const cached = schemaDiagnosticIndexCache.get(apiDef)
  if (cached) return cached

  const index: SchemaDiagnosticIndex = {
    values: new Map(),
    properties: new Map(),
    branches: [],
    islFunctions: new Map()
  }
  const seen = new WeakSet<object>()
  const budget = { count: 0 }
  for (const [schemaFile, schema] of Object.entries(apiDef)) {
    walkSchemaDiagnosticIndex({
      node: schema,
      schemaPath: `/${pointerEscape(schemaFile)}`,
      index,
      seen,
      budget
    })
  }

  schemaValueIndexCache.set(apiDef, index.values)
  schemaPropertyIndexCache.set(apiDef, index.properties)
  schemaBranchIndexCache.set(apiDef, index.branches)
  schemaISLFunctionIndexCache.set(apiDef, index.islFunctions)
  schemaDiagnosticIndexCache.set(apiDef, index)
  return index
}

const getLineColumn = (input: string, offset: number): JsonLocation => {
  const prefix = input.slice(0, Math.max(0, offset))
  const lines = prefix.split(/\r?\n/)
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
    offset
  }
}

const getSyntaxLocation = (
  input: string,
  error: JsonParseError
): JsonLocation => ({
  ...getLineColumn(input, error.offset),
  length: error.length
})

const toParserPath = (jsonPath: string) =>
  jsonPointerToPathParts(jsonPath).map((part) => {
    const numberValue = Number(part)
    return String(numberValue) === part ? numberValue : part
  })

const getNodeLocation = (
  input: string,
  node: any
): JsonLocation | undefined => {
  if (!node || typeof node.offset !== 'number') return undefined
  return {
    ...getLineColumn(input, node.offset),
    length: typeof node.length === 'number' ? node.length : undefined
  }
}

export const getJsonPathLocation = ({
  input,
  rootNode,
  jsonPath
}: {
  input?: string
  rootNode?: unknown
  jsonPath: string
}): JsonLocation | undefined => {
  if (!input || !rootNode) return undefined
  const found = findNodeAtLocation(rootNode as any, toParserPath(jsonPath))
  if (found) return getNodeLocation(input, found)

  const location = getLocation(input, Number.MAX_SAFE_INTEGER)
  const closestNode = findNodeAtLocation(rootNode as any, location.path)
  return getNodeLocation(input, closestNode)
}

const createValidateContext = (options: ValidateOptions): ValidateContext => ({
  input: options.input,
  fileUri: options.fileUri || DefaultMainFileAppURI,
  fileName: options.fileName,
  filePath: options.filePath,
  useSchema: options.useSchema,
  schemaUrl: options.schemaUrl || GCScriptSchemaURL,
  schemaRootFile: options.schemaRootFile || GCScriptSchemaRootFile,
  options,
  state: {}
})

const createValidationError = (
  context: ValidateContext | BuildContext,
  error: Partial<ValidationErrorReport> & { message: string }
): ValidationErrorReport => ({
  code: error.code || 'code-invalid',
  message: error.message,
  fileName: (context as ValidateContext).fileName,
  fileUri: context.fileUri,
  filePath: (context as ValidateContext).filePath,
  jsonPath: error.jsonPath || '/',
  location: error.location,
  error: error.error,
  suggestion: error.suggestion,
  examples: error.examples,
  relatedDocs: error.relatedDocs,
  provided: error.provided,
  details: error.details
})

const schemaObject = (useSchema?: JsonValue): Record<string, any> => {
  if (!useSchema || typeof useSchema !== 'object' || Array.isArray(useSchema)) {
    throw new Error(
      'Missing useSchema. GCScript validation requires a JSON schema object.'
    )
  }
  return useSchema as Record<string, any>
}

export const downloadGCScriptSchema = async (
  schemaUrl = GCScriptSchemaURL
): Promise<JsonValue> => {
  if (typeof fetch !== 'function') {
    throw new Error(
      'No fetch implementation available to download GCScript schema'
    )
  }
  const response = await fetch(schemaUrl)
  if (!response.ok) {
    throw new Error(`Failed to download GCScript schema (${response.status})`)
  }
  return (await response.json()) as JsonValue
}

const getCompiledSchemaValidator = (
  apiDef: Record<string, any>,
  rootFile: string
) => {
  let byRoot = compiledSchemaCache.get(apiDef)
  if (!byRoot) {
    byRoot = new Map()
    compiledSchemaCache.set(apiDef, byRoot)
  }
  const cached = byRoot.get(rootFile)
  if (cached) return cached

  const ajv = new Ajv({
    allErrors: true,
    logger: false,
    strict: false,
    verbose: true
  })
  for (const apiSubDef of Object.keys(apiDef)) {
    ajv.addSchema(apiDef[apiSubDef], apiSubDef)
  }
  const validateSchema = ajv.compile(apiDef[rootFile])
  byRoot.set(rootFile, validateSchema)
  return validateSchema
}

const levenshtein = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_item, i) => i)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let i = 1; i <= left.length; i++) {
    current[0] = i
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      )
    }
    for (let j = 0; j <= right.length; j++) previous[j] = current[j]
  }
  return previous[right.length]
}

const normalizedStringDistance = (left: string, right: string) => {
  if (left === right) return 0
  const maxLength = Math.max(left.length, right.length, 1)
  return levenshtein(left.toLowerCase(), right.toLowerCase()) / maxLength
}

const primitiveTypeName = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

const samePrimitiveType = (left: unknown, right: unknown) =>
  isJsonPrimitive(left) &&
  isJsonPrimitive(right) &&
  typeof left === typeof right

const schemaPathOverlap = (left?: string, right?: string) => {
  if (!left || !right) return 0
  const leftParts = jsonPointerToPathParts(left)
  const rightParts = jsonPointerToPathParts(right)
  let count = 0
  for (let i = 0; i < Math.min(leftParts.length, rightParts.length); i++) {
    if (leftParts[i] !== rightParts[i]) break
    count++
  }
  return count
}

const rankSchemaValueCandidates = ({
  provided,
  propertyName,
  schemaValueIndex,
  schemaPath
}: {
  provided: unknown
  propertyName: string
  schemaValueIndex: SchemaValueIndex
  schemaPath?: string
}) => {
  const candidates = schemaValueIndex.get(propertyName) || []
  return candidates
    .map((candidate) => {
      const typePenalty = samePrimitiveType(provided, candidate.value) ? 0 : 2
      const distance =
        typeof provided === 'string' && typeof candidate.value === 'string'
          ? normalizedStringDistance(provided, candidate.value)
          : provided === candidate.value
          ? 0
          : 1
      const contextBonus = Math.min(
        schemaPathOverlap(schemaPath, candidate.schemaPath) * 0.02,
        0.12
      )
      return {
        candidate,
        score: typePenalty + distance - contextBonus
      }
    })
    .sort((a, b) => a.score - b.score)
}

const closestSchemaValues = ({
  provided,
  propertyName,
  schemaValueIndex,
  schemaPath,
  limit = 3
}: {
  provided: unknown
  propertyName: string
  schemaValueIndex: SchemaValueIndex
  schemaPath?: string
  limit?: number
}) => {
  const ranked = rankSchemaValueCandidates({
    provided,
    propertyName,
    schemaValueIndex,
    schemaPath
  })
  const best = ranked[0]
  if (!best || best.score > 0.45) return []
  const threshold = Math.max(0.4, best.score + 0.08)
  return ranked
    .filter((item) => item.score <= threshold)
    .slice(0, limit)
    .map((item) => item.candidate)
}

const candidateHasMatchingTypeValue = (
  candidate: SchemaPropertyIndexEntry,
  parentObject: unknown
) => {
  if (!candidate.typeValues || candidate.typeValues.length === 0) return 0
  if (!isRecord(parentObject) || parentObject.type === undefined) return 0
  return candidate.typeValues.some((value) =>
    valuesEqual(value, parentObject.type)
  )
    ? -0.45
    : 1.25
}

const siblingCompatibilityScore = (
  candidate: SchemaPropertyIndexEntry,
  parentObject: unknown,
  additionalProperty: string
) => {
  if (!isRecord(parentObject) || !candidate.siblingProperties) return 0
  const siblingKeys = Object.keys(parentObject).filter(
    (key) => key !== additionalProperty
  )
  if (siblingKeys.length === 0) return 0
  const siblingSet = new Set(candidate.siblingProperties)
  const matches = siblingKeys.filter((key) => siblingSet.has(key)).length
  if (matches === 0) return 0.18
  return -Math.min(0.32, matches * 0.08)
}

const rankSchemaPropertyCandidates = ({
  propertyName,
  parentObject,
  schemaPropertyIndex,
  schemaPath
}: {
  propertyName: string
  parentObject: unknown
  schemaPropertyIndex: SchemaPropertyIndex
  schemaPath?: string
}) => {
  const candidates = [...schemaPropertyIndex.values()]
    .flat()
    .filter((candidate) => candidate.propertyName !== propertyName)
  return candidates
    .map((candidate) => {
      const distance = normalizedStringDistance(
        propertyName,
        candidate.propertyName
      )
      const contextBonus = Math.min(
        schemaPathOverlap(schemaPath, candidate.schemaPath) * 0.025,
        0.3
      )
      const typeScore = candidateHasMatchingTypeValue(candidate, parentObject)
      const siblingScore = siblingCompatibilityScore(
        candidate,
        parentObject,
        propertyName
      )
      return {
        candidate,
        distance,
        score: distance - contextBonus + typeScore + siblingScore
      }
    })
    .sort((a, b) => a.score - b.score)
}

const closestSchemaProperties = ({
  propertyName,
  parentObject,
  schemaPropertyIndex,
  schemaPath,
  limit = 3
}: {
  propertyName: string
  parentObject: unknown
  schemaPropertyIndex: SchemaPropertyIndex
  schemaPath?: string
  limit?: number
}) => {
  const ranked = rankSchemaPropertyCandidates({
    propertyName,
    parentObject,
    schemaPropertyIndex,
    schemaPath
  })
  const best = ranked[0]
  if (!best || best.distance > 0.42 || best.score > 0.38) return []
  const threshold = Math.max(0.34, best.score + 0.08)
  return ranked
    .filter((item) => item.score <= threshold && item.distance <= 0.42)
    .slice(0, limit)
    .map((item) => item.candidate)
}

const hasSchemaValueForProperty = ({
  propertyName,
  provided,
  schemaValueIndex
}: {
  propertyName: string
  provided: unknown
  schemaValueIndex: SchemaValueIndex
}) =>
  (schemaValueIndex.get(propertyName) || []).some((entry) =>
    valuesEqual(entry.value, provided)
  )

const propertyDisplayName = (propertyName: string) => {
  if (propertyName === 'type') return 'GCScript function type'
  if (propertyName === 'kind') return 'GCScript kind'
  return `"${propertyName}"`
}

const formatJsonValue = (value: unknown) => JSON.stringify(value)

const relatedDocsFor = ({
  propertyName,
  value,
  schemaPaths = []
}: {
  propertyName?: string
  value?: unknown
  schemaPaths?: string[]
}) => {
  const docs = new Set<string>()
  const isLangRelated = schemaPaths.some((schemaPath) =>
    schemaPath.includes('/lang.json')
  )

  if (isLangRelated) {
    docs.add(`${GCScriptAPIRefURL}lang.html`)
  }

  if (propertyName === 'type') {
    if (typeof value === 'string' && value.trim()) {
      docs.add(`${GCScriptAPIRefURL}${value}.html`)
    }
  }

  if (docs.size <= 0) {
    docs.add(GCScriptAPIRefURL)
  }

  return docs.size > 0 ? [...docs] : undefined
}

const usefulDetails = (value: unknown) => toReportJsonValue(value)

const firstUsefulAjvError = (errors: any[] = []) =>
  [...errors].sort((left, right) => {
    const leftDepth = String(left?.instancePath || '').split('/').length
    const rightDepth = String(right?.instancePath || '').split('/').length
    return rightDepth - leftDepth
  })[0]

/** Normalizes strict JSON syntax failures before schema validation starts. */
export const normalizeStrictJsonSyntaxError: DiagnosticNormalizer = (args) => {
  const error = args.syntaxErrors?.[0]
  if (!error || !args.input) return undefined
  const errorName = printParseErrorCode(error.error)
  return createValidationError(args.context, {
    code: 'code-syntax-error',
    message: `Strict JSON syntax error: ${errorName}. Validation input must be built JSON, not JSONC.`,
    jsonPath: '/',
    location: getSyntaxLocation(args.input, error),
    error: errorName,
    suggestion:
      'Remove comments/trailing commas or run build first. JSONC is accepted only before build emits strict JSON.',
    details: usefulDetails({ parseErrorCode: error.error })
  })
}

const valuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(toReportJsonValue(left)) ===
  JSON.stringify(toReportJsonValue(right))

type BranchScore = {
  schemaPath?: string
  title?: string
  score: number
  matchingDiscriminators: string[]
  mismatchingDiscriminators: string[]
  siblingMatches: string[]
  missingRequired: string[]
  additionalProperties: string[]
  typeCompatible?: boolean
}

const entryFromSchema = (
  schema: unknown,
  schemaPath?: string
): SchemaBranchIndexEntry | undefined => {
  if (!isRecord(schema)) return undefined
  return createSchemaBranchIndexEntry(schema, schemaPath || '#')
}

const scoreBranchEntry = (
  entry: SchemaBranchIndexEntry,
  value: unknown
): BranchScore => {
  let score = 0
  const matchingDiscriminators: string[] = []
  const mismatchingDiscriminators: string[] = []
  const siblingMatches: string[] = []
  const missingRequired: string[] = []
  const additionalProperties: string[] = []

  const actualType = primitiveTypeName(value)
  const typeCompatible =
    entry.primitiveTypes.length === 0 ||
    entry.primitiveTypes.includes(actualType)
  if (typeCompatible) score += 1
  else score -= 4

  if (isRecord(value)) {
    const valueKeys = Object.keys(value)
    const propertySet = new Set(entry.propertyNames)

    for (const [propertyName, allowedValues] of Object.entries(
      entry.discriminatorValues
    )) {
      if (!Object.prototype.hasOwnProperty.call(value, propertyName)) continue
      if (
        allowedValues.some((item) => valuesEqual(item, value[propertyName]))
      ) {
        matchingDiscriminators.push(propertyName)
        score += 8
      } else {
        mismatchingDiscriminators.push(propertyName)
        score -= 9
      }
    }

    for (const key of valueKeys) {
      if (propertySet.has(key)) {
        siblingMatches.push(key)
        score += 1.2
      } else {
        additionalProperties.push(key)
        score -= 1.4
      }
    }

    for (const propertyName of entry.requiredProperties) {
      if (Object.prototype.hasOwnProperty.call(value, propertyName))
        score += 0.8
      else {
        missingRequired.push(propertyName)
        score -= 0.6
      }
    }
  }

  return {
    schemaPath: entry.schemaPath,
    title: entry.title,
    score,
    matchingDiscriminators,
    mismatchingDiscriminators,
    siblingMatches,
    missingRequired,
    additionalProperties,
    typeCompatible
  }
}

const scoreBranchSchema = (
  schema: unknown,
  value: unknown,
  schemaPath?: string
) => {
  const entry = entryFromSchema(schema, schemaPath)
  if (!entry) return undefined
  return scoreBranchEntry(entry, value)
}

const branchScoreDetails = (scores: (BranchScore | undefined)[]) =>
  scores
    .filter(Boolean)
    .sort(
      (left, right) =>
        (right as BranchScore).score - (left as BranchScore).score
    )
    .slice(0, 5)
    .map((score) => ({
      schemaPath: score?.schemaPath,
      title: score?.title,
      score: Number(score?.score.toFixed(2)),
      matchingDiscriminators: score?.matchingDiscriminators,
      mismatchingDiscriminators: score?.mismatchingDiscriminators,
      siblingMatches: score?.siblingMatches,
      missingRequired: score?.missingRequired,
      additionalProperties: score?.additionalProperties,
      typeCompatible: score?.typeCompatible
    }))

const bestBranchScoreForErrors = (errors: any[] = [], value: unknown) =>
  branchScoreDetails(
    errors.map((error) =>
      scoreBranchSchema(error?.parentSchema, value, error?.schemaPath)
    )
  )[0]

const isAjvErrorFromMismatchedConstBranch = (error: any, code?: GCScript) => {
  if (!code || !isRecord(error?.parentSchema?.properties)) return false

  for (const [branchPropertyName, branchPropertySchema] of Object.entries(
    error.parentSchema.properties
  )) {
    if (!isRecord(branchPropertySchema)) continue
    if (!Object.prototype.hasOwnProperty.call(branchPropertySchema, 'const')) {
      continue
    }

    const branchJsonPath = appendJsonPointer(
      error.instancePath || '/',
      branchPropertyName
    )
    const provided = getAtJsonPath(code, branchJsonPath)
    if (
      provided !== undefined &&
      !valuesEqual(provided, branchPropertySchema.const)
    ) {
      return true
    }
  }

  return false
}

const schemaValuesForProperty = ({
  propertyName,
  provided,
  schemaValueIndex
}: {
  propertyName: string
  provided: unknown
  schemaValueIndex: SchemaValueIndex
}) =>
  (schemaValueIndex.get(propertyName) || []).filter((entry) =>
    valuesEqual(entry.value, provided)
  )

const schemaFileFromSchemaPath = (schemaPath?: string) =>
  jsonPointerToPathParts(schemaPath || '/')[0]

const schemaNodeAtPath = (
  schema: Record<string, any> | undefined,
  schemaPath?: string
) => {
  if (!schema || !schemaPath) return undefined
  let cursor: unknown = schema
  for (const part of jsonPointerToPathParts(schemaPath)) {
    if (!cursor || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

const firstSchemaExample = (schema: unknown): JsonValue | undefined => {
  if (!isRecord(schema)) return undefined
  return normalizeExamples(schema)?.[0]
}

const rootFunctionWrapperExamples = (
  providedType: string,
  functionSchema: unknown
): JsonValue[] => {
  const functionExample = firstSchemaExample(functionSchema)
  const wrappedFunction =
    functionExample && isRecord(functionExample)
      ? functionExample
      : ({ type: providedType } as JsonValue)

  return [
    {
      type: 'script',
      run: {
        main: wrappedFunction
      }
    } as JsonValue
  ]
}

const STRUCTURAL_SCHEMA_KEYWORDS = new Set([
  '$ref',
  'type',
  'const',
  'enum',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'prefixItems',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties'
])

const hasStructuralSchemaKeywords = (schema: unknown) =>
  isRecord(schema) &&
  Object.keys(schema).some((key) => STRUCTURAL_SCHEMA_KEYWORDS.has(key))

const schemaHasOpenValueBranch = (schema: unknown): boolean => {
  if (!isRecord(schema)) return false
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = schema[key]
    if (!Array.isArray(branches)) continue
    if (branches.some((branch) => !hasStructuralSchemaKeywords(branch))) {
      return true
    }
  }
  return false
}

const shallowFunctionSchemaErrors = (
  functionSchema: unknown,
  functionSchemaFile: string,
  value: Record<string, unknown>
) => {
  if (!isRecord(functionSchema)) return []
  const errors: any[] = []
  for (const propertyName of schemaRequiredPropertyNames(functionSchema)) {
    if (Object.prototype.hasOwnProperty.call(value, propertyName)) continue
    errors.push({
      keyword: 'required',
      instancePath: '',
      schemaPath: `/${pointerEscape(functionSchemaFile)}/required`,
      params: { missingProperty: propertyName },
      parentSchema: functionSchema,
      message: `must have required property '${propertyName}'`
    })
  }

  if (functionSchema.additionalProperties === false) {
    const allowedProperties = new Set(schemaObjectPropertyNames(functionSchema))
    for (const propertyName of Object.keys(value)) {
      if (allowedProperties.has(propertyName)) continue
      errors.push({
        keyword: 'additionalProperties',
        instancePath: '',
        schemaPath: `/${pointerEscape(
          functionSchemaFile
        )}/additionalProperties`,
        params: { additionalProperty: propertyName },
        parentSchema: functionSchema,
        message: 'must NOT have additional properties'
      })
    }
  }

  return errors
}

const shouldCompileFunctionSchemaForNestedDiagnostics = (
  functionSchema: unknown,
  value: Record<string, unknown>
) => {
  if (!isRecord(functionSchema) || !isRecord(functionSchema.properties)) {
    return false
  }

  for (const [propertyName, provided] of Object.entries(value)) {
    if (propertyName === 'type') continue
    if (!provided || typeof provided !== 'object') continue
    const propertySchema = functionSchema.properties[propertyName]
    if (!hasStructuralSchemaKeywords(propertySchema)) continue
    if (schemaHasOpenValueBranch(propertySchema)) continue
    return true
  }

  return false
}

const normalizeKnownFunctionErrors = (
  args: NormalizerArgs,
  functionErrors: any[]
) => {
  const nestedArgs: NormalizerArgs = {
    ...args,
    ajvErrors: functionErrors
  }

  // Reuse the same schema-driven normalizers, but deliberately skip this
  // wrapper diagnostic to avoid hiding a more actionable function-local error.
  for (const normalizer of [
    normalizeConstEnumError,
    normalizeRequiredPropertyError,
    normalizeAdditionalPropertyError,
    normalizeTypeMismatchError,
    normalizeOneOfAnyOfError,
    normalizeFallbackAjvError
  ]) {
    const diagnostic = normalizer(nestedArgs)
    if (diagnostic) return diagnostic
  }

  return undefined
}

const normalizeKnownFunctionSchemaError = (
  args: NormalizerArgs,
  functionSchemaFile: string,
  functionSchema: unknown
) => {
  if (!args.schema || !args.code || !isRecord(args.code)) return undefined

  const rootObject = args.code as Record<string, unknown>
  const shallowErrors = shallowFunctionSchemaErrors(
    functionSchema,
    functionSchemaFile,
    rootObject
  )
  if (shallowErrors.length > 0) {
    return normalizeKnownFunctionErrors(args, shallowErrors)
  }

  if (
    !shouldCompileFunctionSchemaForNestedDiagnostics(functionSchema, rootObject)
  ) {
    return undefined
  }

  const validateFunctionSchema = getCompiledSchemaValidator(
    args.schema,
    functionSchemaFile
  )
  if (validateFunctionSchema(args.code)) return undefined

  return normalizeKnownFunctionErrors(args, validateFunctionSchema.errors || [])
}

/** Explains exact nested GCScript functions that were accidentally used as root code. */
export const normalizeRootKnownFunctionError: DiagnosticNormalizer = (args) => {
  if (!args.code || !isRecord(args.code)) return undefined

  const rootObject = args.code as Record<string, unknown>
  const providedType = rootObject.type
  if (typeof providedType !== 'string' || providedType === 'script') {
    return undefined
  }

  const rootSchemaFile = args.schemaRootFile || GCScriptSchemaRootFile
  const knownTypeEntries = schemaValuesForProperty({
    propertyName: 'type',
    provided: providedType,
    schemaValueIndex: args.schemaValueIndex
  }).filter(
    (entry) => schemaFileFromSchemaPath(entry.schemaPath) !== rootSchemaFile
  )

  if (knownTypeEntries.length === 0) return undefined

  const functionSchemaFile = schemaFileFromSchemaPath(
    knownTypeEntries[0].schemaPath
  )
  const functionSchema = schemaNodeAtPath(
    args.schema,
    functionSchemaFile ? `/${pointerEscape(functionSchemaFile)}` : undefined
  )

  if (functionSchemaFile) {
    const functionLocalDiagnostic = normalizeKnownFunctionSchemaError(
      args,
      functionSchemaFile,
      functionSchema
    )
    if (functionLocalDiagnostic) return functionLocalDiagnostic
  }

  const jsonPath = '/type'
  return createValidationError(args.context, {
    code: 'code-root-function-wrapper-required',
    message: `Root GCScript type "${providedType}" is a nested function. Root GCScript must be a "script" block; move this function under "run".`,
    jsonPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath
    }),
    error: 'Nested function used as root GCScript',
    provided: providedType,
    suggestion: `Wrap this function in a root script block: {"type":"script","run":{"main":{"type":"${providedType}"}}}.`,
    examples: rootFunctionWrapperExamples(providedType, functionSchema),
    relatedDocs: relatedDocsFor({
      propertyName: 'type',
      value: providedType,
      schemaPaths: knownTypeEntries.map((entry) => entry.schemaPath)
    }),
    details: usefulDetails({
      rootType: providedType,
      expectedRootType: 'script',
      wrapperProperty: 'run',
      functionSchemaFile,
      knownSchemaPaths: knownTypeEntries.map((entry) => entry.schemaPath)
    })
  })
}

const getConstEnumErrorGroups = (errors: any[] = []) => {
  const groups = new Map<
    string,
    { jsonPath: string; propertyName: string; schemaPaths: string[] }
  >()
  for (const error of errors) {
    if (error?.keyword !== 'const' && error?.keyword !== 'enum') continue
    const jsonPath = error.instancePath || '/'
    const parts = jsonPointerToPathParts(jsonPath)
    const propertyName = parts.at(-1)
    if (!propertyName) continue
    const key = `${jsonPath}\u0000${propertyName}`
    const group = groups.get(key) || {
      jsonPath,
      propertyName,
      schemaPaths: [] as string[]
    }
    if (typeof error.schemaPath === 'string')
      group.schemaPaths.push(error.schemaPath)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Suggests valid const/enum values using the schema value index, not AJV branch noise. */
export const normalizeConstEnumError: DiagnosticNormalizer = (args) => {
  if (!args.code) return undefined

  const diagnostics = getConstEnumErrorGroups(args.ajvErrors).map((group) => {
    const provided = getAtJsonPath(args.code, group.jsonPath)
    if (!isJsonPrimitive(provided)) return undefined

    // If the value is valid for this property elsewhere in the schema, this is
    // a structural branch mismatch. Let a branch-aware diagnostic explain that
    // instead of pretending the value itself is unknown.
    if (
      hasSchemaValueForProperty({
        propertyName: group.propertyName,
        provided,
        schemaValueIndex: args.schemaValueIndex
      })
    ) {
      return undefined
    }

    const closestValues = closestSchemaValues({
      provided,
      propertyName: group.propertyName,
      schemaValueIndex: args.schemaValueIndex,
      schemaPath: group.schemaPaths[0],
      limit: 1
    })
    const best = closestValues[0]
    const suggested = best?.value
    const label = propertyDisplayName(group.propertyName)
    const relatedDocs = relatedDocsFor({
      propertyName: group.propertyName,
      value: suggested || provided,
      schemaPaths: [best?.schemaPath, ...group.schemaPaths].filter(
        (item): item is string => typeof item === 'string'
      )
    })
    const hasSuggestion =
      suggested !== undefined && !valuesEqual(provided, suggested)
    const didYouMean = hasSuggestion
      ? ` Did you mean ${formatJsonValue(suggested)}?`
      : ''

    return createValidationError(args.context, {
      code: 'code-invalid-const-enum',
      message: `Unknown ${label} ${formatJsonValue(provided)}.${didYouMean}`,
      jsonPath: group.jsonPath,
      location: getJsonPathLocation({
        input: args.input,
        rootNode: args.rootNode,
        jsonPath: group.jsonPath
      }),
      error: `Unknown ${label}`,
      provided: toReportJsonValue(provided),
      suggestion: hasSuggestion
        ? `Replace ${formatJsonValue(provided)} with ${formatJsonValue(
            suggested
          )}.`
        : `Use a value allowed by the schema for ${label}.`,
      examples: hasSuggestion
        ? best?.examples ||
          ([{ [group.propertyName]: suggested } as JsonValue] as JsonValue[])
        : best?.examples,
      relatedDocs,
      details: usefulDetails({
        propertyName: group.propertyName,
        closestValues: closestValues.map((item) => item.value),
        schemaPaths: closestValues.map((item) => item.schemaPath),
        branchScores: bestBranchScoreForErrors(
          args.ajvErrors?.filter(
            (item) => item?.instancePath === group.jsonPath
          ),
          getAtJsonPath(
            args.code,
            group.jsonPath.replace(/\/[^/]*$/, '') || '/'
          )
        )
      })
    })
  })

  return diagnostics.filter(Boolean)[0]
}

const jsonPathDepth = (jsonPath = '/') =>
  jsonPointerToPathParts(jsonPath).length

const hasDeeperAdditionalPropertyError = (
  errors: any[] = [],
  depth: number,
  code?: GCScript
) =>
  errors.some(
    (item) =>
      item?.keyword === 'additionalProperties' &&
      !isAjvErrorFromMismatchedConstBranch(item, code) &&
      jsonPathDepth(item.instancePath || '/') > depth
  )

const rankRequiredErrors = (errors: any[] = [], code?: GCScript) =>
  errors
    .filter(
      (item) =>
        item?.keyword === 'required' &&
        item?.params?.missingProperty &&
        !isAjvErrorFromMismatchedConstBranch(item, code)
    )
    .map((error) => {
      const parentObject = getAtJsonPath(code, error.instancePath || '/')
      const score = scoreBranchSchema(
        error.parentSchema,
        parentObject,
        error.schemaPath
      )
      return {
        error,
        missingProperty: String(error.params.missingProperty),
        depth: jsonPathDepth(error.instancePath || '/'),
        score: score?.score || 0,
        branchScore: score
      }
    })
    .sort((left, right) => {
      if (right.depth !== left.depth) return right.depth - left.depth
      return right.score - left.score
    })

const mostFrequentMissingPropertyAtDepth = (
  ranked: ReturnType<typeof rankRequiredErrors>,
  depth: number
) => {
  const counts = new Map<string, number>()
  for (const item of ranked.filter((entry) => entry.depth === depth)) {
    counts.set(
      item.missingProperty,
      (counts.get(item.missingProperty) || 0) + 1
    )
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
}

/** Normalizes missing required property errors at the object path that owns them. */
export const normalizeRequiredPropertyError: DiagnosticNormalizer = (args) => {
  const ranked = rankRequiredErrors(args.ajvErrors, args.code)
  if (ranked.length === 0) return undefined

  const deepestDepth = ranked[0].depth
  const frequentMissingProperty = mostFrequentMissingPropertyAtDepth(
    ranked,
    deepestDepth
  )
  const selected =
    ranked.find(
      (item) =>
        item.depth === deepestDepth &&
        item.missingProperty === frequentMissingProperty
    ) || ranked[0]
  if (
    hasDeeperAdditionalPropertyError(args.ajvErrors, selected.depth, args.code)
  ) {
    return undefined
  }

  const error = selected.error
  const missingProperty = selected.missingProperty
  const parentPath = error.instancePath || '/'
  const parentObject = getAtJsonPath(args.code, parentPath)
  const siblingTypoError = (args.ajvErrors || [])
    .filter(
      (item) =>
        item?.keyword === 'additionalProperties' &&
        (item.instancePath || '/') === parentPath &&
        item?.params?.additionalProperty
    )
    .map((item) => ({
      error: item,
      propertyName: String(item.params.additionalProperty),
      distance: normalizedStringDistance(
        String(item.params.additionalProperty),
        missingProperty
      )
    }))
    .filter(
      (item) => item.propertyName !== missingProperty && item.distance <= 0.34
    )
    .sort((left, right) => left.distance - right.distance)[0]

  if (siblingTypoError) {
    const propertyJsonPath = appendJsonPointer(
      parentPath,
      siblingTypoError.propertyName
    )
    return createValidationError(args.context, {
      code: 'code-additional-property',
      message: `Unknown property "${siblingTypoError.propertyName}". Did you mean "${missingProperty}"?`,
      jsonPath: propertyJsonPath,
      location: getJsonPathLocation({
        input: args.input,
        rootNode: args.rootNode,
        jsonPath: propertyJsonPath
      }),
      error: 'Unknown property',
      provided: siblingTypoError.propertyName,
      suggestion: `Replace "${siblingTypoError.propertyName}" with "${missingProperty}".`,
      examples: normalizeExamples(error.parentSchema || {}) as
        | JsonValue[]
        | undefined,
      details: usefulDetails({
        propertyName: siblingTypoError.propertyName,
        propertyJsonPath,
        closestProperties: [missingProperty],
        schemaPaths: [error.schemaPath],
        branchScores: branchScoreDetails([selected.branchScore]),
        keyword: siblingTypoError.error.keyword,
        schemaPath: siblingTypoError.error.schemaPath,
        params: siblingTypoError.error.params
      })
    })
  }

  const jsonPath = appendJsonPointer(parentPath, missingProperty)

  return createValidationError(args.context, {
    code: 'code-required-property',
    message: `Missing required property "${missingProperty}".`,
    jsonPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath: parentPath
    }),
    error: 'Missing required property',
    suggestion: `Add required property "${missingProperty}" at ${parentPath}.`,
    examples: normalizeExamples(error.parentSchema || {}) as
      | JsonValue[]
      | undefined,
    details: usefulDetails({
      propertyName: missingProperty,
      parentPath,
      parentProvided: toReportJsonValue(parentObject),
      branchScores: branchScoreDetails([selected.branchScore]),
      keyword: error.keyword,
      schemaPath: error.schemaPath,
      params: error.params
    })
  })
}

const exactPropertyKnownElsewhere = ({
  propertyName,
  schemaPropertyIndex
}: {
  propertyName: string
  schemaPropertyIndex: SchemaPropertyIndex
}) => (schemaPropertyIndex.get(propertyName) || []).length > 0

/** Normalizes unexpected properties without leaking branch-specific AJV internals. */
export const normalizeAdditionalPropertyError: DiagnosticNormalizer = (
  args
) => {
  const rankedErrors = (args.ajvErrors || [])
    .filter(
      (item) =>
        item?.keyword === 'additionalProperties' &&
        !isAjvErrorFromMismatchedConstBranch(item, args.code)
    )
    .map((error) => {
      const parentObject = getAtJsonPath(args.code, error.instancePath || '/')
      const branchScore = scoreBranchSchema(
        error.parentSchema,
        parentObject,
        error.schemaPath
      )
      return {
        error,
        branchScore,
        depth: jsonPathDepth(error.instancePath || '/'),
        score: branchScore?.score || 0
      }
    })
    .sort((left, right) => {
      if (right.depth !== left.depth) return right.depth - left.depth
      return right.score - left.score
    })

  const selected = rankedErrors[0]
  const error = selected?.error
  const additionalProperty = error?.params?.additionalProperty
  if (!error || !additionalProperty) return undefined

  const propertyName = String(additionalProperty)
  const jsonPath = error.instancePath || '/'
  const propertyJsonPath = appendJsonPointer(jsonPath, propertyName)
  const parentObject = getAtJsonPath(args.code, jsonPath)
  const exactKnownElsewhere = exactPropertyKnownElsewhere({
    propertyName,
    schemaPropertyIndex: args.schemaPropertyIndex
  })
  const closestProperties = exactKnownElsewhere
    ? []
    : closestSchemaProperties({
        propertyName,
        parentObject,
        schemaPropertyIndex: args.schemaPropertyIndex,
        schemaPath: error.schemaPath,
        limit: 1
      }).filter((item) => item.propertyName !== propertyName)
  const best = closestProperties[0]
  const suggestion = best
    ? `Replace "${propertyName}" with "${best.propertyName}".`
    : exactKnownElsewhere
    ? `"${propertyName}" is known in another schema branch, but it is not allowed in this object. Check the surrounding function type and object shape.`
    : `Remove "${propertyName}" or check the property spelling.`
  const message = best
    ? `Unknown property "${propertyName}". Did you mean "${best.propertyName}"?`
    : exactKnownElsewhere
    ? `Property "${propertyName}" is not allowed in this schema branch.`
    : `Unknown property "${propertyName}".`

  return createValidationError(args.context, {
    code: exactKnownElsewhere
      ? 'code-branch-property-mismatch'
      : 'code-additional-property',
    message,
    jsonPath: propertyJsonPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath: propertyJsonPath
    }),
    error: exactKnownElsewhere
      ? 'Branch property mismatch'
      : 'Unknown property',
    provided: propertyName,
    suggestion,
    examples: best?.examples,
    details: usefulDetails({
      propertyName,
      propertyJsonPath,
      branchMismatch: exactKnownElsewhere,
      closestProperties: closestProperties.map((item) => item.propertyName),
      schemaPaths: closestProperties.map((item) => item.schemaPath),
      branchScores: branchScoreDetails([selected?.branchScore]),
      keyword: error.keyword,
      schemaPath: error.schemaPath,
      params: error.params
    })
  })
}

const expectedTypesFromErrors = (errors: any[]) =>
  [
    ...new Set(
      errors.flatMap((error) => {
        const type = error?.params?.type
        return Array.isArray(type) ? type : type ? [type] : []
      })
    )
  ]
    .filter((item) => typeof item === 'string')
    .sort()

const formatExpectedTypes = (types: string[]) =>
  types.length > 0 ? types.join(' or ') : 'the expected type'

/** Normalizes primitive/object/array type mismatches at the failing JSON path. */
export const normalizeTypeMismatchError: DiagnosticNormalizer = (args) => {
  const typeErrors = (args.ajvErrors || [])
    .filter(
      (item) =>
        item?.keyword === 'type' &&
        !isAjvErrorFromMismatchedConstBranch(item, args.code)
    )
    .sort(
      (left, right) =>
        jsonPathDepth(right.instancePath || '/') -
        jsonPathDepth(left.instancePath || '/')
    )
  if (typeErrors.length === 0) return undefined

  const deepestPath = typeErrors[0].instancePath || '/'
  const pathErrors = typeErrors.filter(
    (item) => (item.instancePath || '/') === deepestPath
  )
  const provided = getAtJsonPath(args.code, deepestPath)
  const expectedTypes = expectedTypesFromErrors(pathErrors)
  const expected = formatExpectedTypes(expectedTypes)

  return createValidationError(args.context, {
    code: 'code-type-mismatch',
    message: `Expected ${
      deepestPath || '/'
    } to be ${expected}, got ${primitiveTypeName(provided)}.`,
    jsonPath: deepestPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath: deepestPath
    }),
    error: 'Type mismatch',
    provided: toReportJsonValue(provided),
    suggestion: `Use a value of type ${expected}.`,
    details: usefulDetails({
      expected,
      actual: primitiveTypeName(provided),
      branchScores: branchScoreDetails(
        pathErrors.map((error) =>
          scoreBranchSchema(error.parentSchema, provided, error.schemaPath)
        )
      ),
      keyword: pathErrors[0].keyword,
      schemaPath: pathErrors[0].schemaPath,
      params: pathErrors[0].params
    })
  })
}

const branchSchemasForUnionError = (error: any) => {
  const schemas = error?.parentSchema?.[error?.keyword]
  return Array.isArray(schemas) ? schemas : []
}

/** Handles oneOf/anyOf only after more specific normalizers declined the error. */
export const normalizeOneOfAnyOfError: DiagnosticNormalizer = (args) => {
  const error = (args.ajvErrors || [])
    .filter((item) => item?.keyword === 'oneOf' || item?.keyword === 'anyOf')
    .sort(
      (left, right) =>
        jsonPathDepth(right.instancePath || '/') -
        jsonPathDepth(left.instancePath || '/')
    )[0]
  if (!error) return undefined

  const jsonPath = error.instancePath || '/'
  const provided = getAtJsonPath(args.code, jsonPath)
  const unionBranchScores = branchScoreDetails(
    branchSchemasForUnionError(error).map((schema: unknown, index: number) =>
      scoreBranchSchema(schema, provided, `${error.schemaPath}/${index}`)
    )
  )
  const best = unionBranchScores[0]
  const keyword =
    error.keyword === 'oneOf' ? 'one allowed schema' : 'any allowed schema'
  const missing = Array.isArray(best?.missingRequired)
    ? best?.missingRequired.filter(Boolean)
    : []
  const extras = Array.isArray(best?.additionalProperties)
    ? best?.additionalProperties.filter(Boolean)
    : []
  const reason = missing.length
    ? ` Best matching branch is missing: ${missing.join(', ')}.`
    : extras.length
    ? ` Best matching branch rejects: ${extras.join(', ')}.`
    : ''

  return createValidationError(args.context, {
    code: `code-${error.keyword}-mismatch`,
    message: `Value does not match ${keyword}.${reason}`,
    jsonPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath
    }),
    error: 'Schema shape mismatch',
    provided: toReportJsonValue(provided),
    suggestion:
      'Check the object discriminator, required properties, and sibling properties for this schema branch.',
    details: usefulDetails({
      keyword: error.keyword,
      branchScores: unionBranchScores,
      schemaPath: error.schemaPath,
      params: error.params
    })
  })
}

/** Last-resort AJV diagnostic when no richer normalizer can explain the error. */
export const normalizeFallbackAjvError: DiagnosticNormalizer = (args) => {
  const error = firstUsefulAjvError(args.ajvErrors)
  if (!error) return undefined
  const jsonPath = error.instancePath || '/'
  return createValidationError(args.context, {
    code: 'code-invalid',
    message: `Code has errors: ${error.message || 'schema validation failed'}.`,
    jsonPath,
    location: getJsonPathLocation({
      input: args.input,
      rootNode: args.rootNode,
      jsonPath
    }),
    error: error.message,
    provided: toReportJsonValue(getAtJsonPath(args.code, jsonPath)),
    details: usefulDetails({
      keyword: error.keyword,
      schemaPath: error.schemaPath,
      params: error.params
    })
  })
}

export const normalizers: DiagnosticNormalizer[] = [
  normalizeStrictJsonSyntaxError,
  normalizeRootKnownFunctionError,
  normalizeConstEnumError,
  normalizeRequiredPropertyError,
  normalizeAdditionalPropertyError,
  normalizeTypeMismatchError,
  normalizeOneOfAnyOfError,
  normalizeFallbackAjvError
]

const normalizeValidationErrors = (args: NormalizerArgs) => {
  for (const normalizer of normalizers) {
    const diagnostic = normalizer(args)
    if (diagnostic) return diagnostic
  }
  return createValidationError(args.context, {
    code: 'code-invalid',
    message: 'Code has errors: schema validation failed.',
    jsonPath: '/',
    error: 'schema validation failed'
  })
}

const rankISLFunctionCandidates = (
  functionName: string,
  index: SchemaISLFunctionIndex
) =>
  [...index.values()]
    .map((candidate) => ({
      candidate,
      distance: normalizedStringDistance(functionName, candidate.name)
    }))
    .sort((left, right) => left.distance - right.distance)

const isLikelyISLBoundaryTypo = (value: string) => {
  const text = value.trim()
  if (text.length < 2) return false
  if (text.startsWith('{') && text.endsWith('}')) return false
  if (!text.startsWith('{') && !text.endsWith('}')) return false
  return /[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(text)
}

const extractISLFunctionNames = (value: string) => {
  const names = new Set<string>()
  const text = value.slice(0, MAX_ISL_SCAN_STRING_LENGTH)
  const pattern = /(?<![\w_])([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
  for (const match of text.matchAll(pattern)) names.add(match[1])
  return [...names]
}

const scanISLWarnings = ({
  value,
  jsonPath,
  context,
  input,
  rootNode,
  islFunctionIndex
}: {
  value: string
  jsonPath: string
  context: ValidateContext | BuildContext
  input?: string
  rootNode?: unknown
  islFunctionIndex: SchemaISLFunctionIndex
}) => {
  const text = value.trim()
  const warnings: ValidationErrorReport[] = []
  const location = getJsonPathLocation({ input, rootNode, jsonPath })

  if (isLikelyISLBoundaryTypo(text)) {
    warnings.push(
      createValidationError(context, {
        code: 'code-isl-block-boundary-warning',
        message:
          'Possible ISL string: inline code should start with "{" and end with "}".',
        jsonPath,
        location,
        error: 'Possible ISL block syntax issue',
        provided: text,
        suggestion:
          'Wrap inline script code with "{" and "}" or keep it as a plain string constant.',
        relatedDocs: [`${GCScriptAPIRefURL}lang.html`],
        details: usefulDetails({ kind: 'isl-boundary' })
      })
    )
    return warnings
  }

  if (!(text.startsWith('{') && text.endsWith('}'))) return warnings

  for (const functionName of extractISLFunctionNames(text)) {
    if (islFunctionIndex.has(functionName)) continue
    const [best] = rankISLFunctionCandidates(functionName, islFunctionIndex)
    if (!best || best.distance > 0.34) continue
    warnings.push(
      createValidationError(context, {
        code: 'code-isl-unknown-function-warning',
        message: `Possible ISL function typo: unknown function "${functionName}". Did you mean "${best.candidate.name}"?`,
        jsonPath,
        location,
        error: 'Possible ISL function typo',
        provided: functionName,
        suggestion: `Replace "${functionName}" with "${best.candidate.name}" if this is intended to be ISL code.`,
        examples: best.candidate.examples,
        relatedDocs: [`${GCScriptAPIRefURL}lang.html`],
        details: usefulDetails({
          functionName,
          closestFunctions: [best.candidate.name],
          schemaPath: best.candidate.schemaPath
        })
      })
    )
  }
  return warnings
}

const collectISLWarnings = ({
  code,
  context,
  input,
  rootNode,
  islFunctionIndex
}: {
  code: GCScript
  context: ValidateContext | BuildContext
  input?: string
  rootNode?: unknown
  islFunctionIndex: SchemaISLFunctionIndex
}) => {
  if (islFunctionIndex.size === 0) return []
  const warnings: ValidationErrorReport[] = []
  const seen = new WeakSet<object>()
  const stack: { value: unknown; path: string[]; depth: number }[] = [
    { value: code, path: [], depth: 0 }
  ]
  let visited = 0

  while (stack.length > 0 && visited < MAX_VALUE_SCAN_NODES) {
    const current = stack.pop()
    if (!current) break
    visited += 1

    const { value, path, depth } = current
    if (typeof value === 'string') {
      warnings.push(
        ...scanISLWarnings({
          value,
          jsonPath: pathPartsToJsonPointer(path),
          context,
          input,
          rootNode,
          islFunctionIndex
        })
      )
      continue
    }

    if (!value || typeof value !== 'object' || depth >= MAX_VALUE_SCAN_DEPTH) {
      continue
    }
    if (seen.has(value)) continue
    seen.add(value)

    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index--) {
        stack.push({
          value: value[index],
          path: [...path, String(index)],
          depth: depth + 1
        })
      }
    } else {
      for (const [key, child] of Object.entries(value)) {
        stack.push({ value: child, path: [...path, key], depth: depth + 1 })
      }
    }
  }

  return warnings.slice(0, 25)
}

const parseStrictJsonWithTree = (input: string) => {
  const syntaxErrors: JsonParseError[] = []
  const code = parseJSONC(input, syntaxErrors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false
  }) as GCScript
  const rootNode = syntaxErrors.length === 0 ? parseTree(input) : undefined
  return { code, rootNode, syntaxErrors }
}

/** Parses validate-only input. Validation consumes built strict JSON, not JSONC. */
export function parseGCScriptJSON(input: string): GCScript {
  if (typeof input !== 'string') {
    throw new Error('Validation input must be a raw built GCScript JSON string')
  }
  const parsed = parseStrictJsonWithTree(input)
  if (parsed.syntaxErrors.length > 0) {
    const details = parsed.syntaxErrors
      .map((error) => {
        const location = getSyntaxLocation(input, error)
        return `${printParseErrorCode(error.error)} at line ${location.line}`
      })
      .join('; ')
    throw new Error(`Invalid strict GCScript JSON input. ${details}`)
  }
  return parsed.code
}

export const validateGCScriptObject = async ({
  code,
  context,
  useSchema,
  schemaRootFile,
  input,
  rootNode
}: {
  code: GCScript
  context: ValidateContext | BuildContext
  useSchema?: JsonValue
  schemaRootFile?: string
  input?: string
  rootNode?: unknown
}): Promise<ValidationReport> => {
  const startedAt = Date.now()
  const apiDef = schemaObject(useSchema)
  const rootFile = schemaRootFile || GCScriptSchemaRootFile
  if (!apiDef[rootFile]) {
    throw new Error(
      `Missing API sub definition '${rootFile}'. Cannot validate code.`
    )
  }

  const schemaStartedAt = Date.now()
  const validateSchema = getCompiledSchemaValidator(apiDef, rootFile)
  const schemaISLFunctionIndex = createSchemaISLFunctionIndex(apiDef)
  let schemaMs = Date.now() - schemaStartedAt
  const isValid = Boolean(validateSchema(code))
  const warnings = collectISLWarnings({
    code,
    context,
    input,
    rootNode,
    islFunctionIndex: schemaISLFunctionIndex
  })
  const validateMs = Date.now() - startedAt

  if (isValid)
    return {
      isValid: true,
      errors: [],
      warnings,
      profiling: { validateMs, schemaMs }
    }

  // Build heavier diagnostic indexes only for invalid reports. Successful
  // validation should stay cheap, especially in bulk CI and CLI flows.
  const diagnosticIndexStartedAt = Date.now()
  const diagnosticIndex = createSchemaDiagnosticIndex(apiDef)
  schemaMs += Date.now() - diagnosticIndexStartedAt

  const diagnostic = normalizeValidationErrors({
    context,
    input,
    code,
    rootNode,
    schemaValueIndex: diagnosticIndex.values,
    schemaPropertyIndex: diagnosticIndex.properties,
    schemaBranchIndex: diagnosticIndex.branches,
    diagnosticIndex,
    schema: apiDef,
    schemaRootFile: rootFile,
    ajvErrors: validateSchema.errors || []
  })
  return {
    isValid: false,
    errors: [diagnostic],
    warnings,
    profiling: { validateMs, schemaMs }
  }
}

export const validate = async (
  options: ValidateOptions
): Promise<ValidationReport> => {
  const startedAt = Date.now()
  const context = createValidateContext(options)

  await emitValidationEvent(context, {
    type: 'validate:start',
    message: `Validating ${context.fileUri}`
  })

  await emitValidationEvent(context, {
    type: 'stage:start',
    stage: 'parse',
    message: `Parsing strict JSON ${context.fileUri}`
  })

  const parsed = parseStrictJsonWithTree(context.input)
  if (parsed.syntaxErrors.length > 0) {
    const report: ValidationReport = {
      isValid: false,
      errors: [
        normalizeValidationErrors({
          context,
          input: context.input,
          schemaValueIndex: new Map(),
          schemaPropertyIndex: new Map(),
          syntaxErrors: parsed.syntaxErrors
        })
      ],
      warnings: [],
      profiling: {
        ...options.profiling,
        validateMs: Date.now() - startedAt
      }
    }
    await emitValidationEvent(context, {
      type: 'validate:error',
      message: report.errors[0].message,
      path: report.errors[0].jsonPath,
      data: { report: report as unknown as Record<string, unknown> }
    })
    return report
  }

  await emitValidationEvent(context, {
    type: 'stage:start',
    stage: 'schema',
    message: `Checking schema ${context.schemaRootFile}`
  })

  const report = await validateGCScriptObject({
    code: parsed.code,
    context,
    useSchema: context.useSchema,
    schemaRootFile: context.schemaRootFile,
    input: context.input,
    rootNode: parsed.rootNode
  })
  report.profiling = {
    ...options.profiling,
    ...report.profiling,
    validateMs: Date.now() - startedAt
  }

  if (report.isValid) {
    await emitValidationEvent(context, {
      type: 'validate:success',
      message: `Valid ${context.fileUri}`
    })
  } else {
    await emitValidationEvent(context, {
      type: 'validate:error',
      message: report.errors[0]?.message || `Invalid ${context.fileUri}`,
      path: report.errors[0]?.jsonPath,
      data: { report: report as unknown as Record<string, unknown> }
    })
  }

  return report
}

export const validateToDataURI = async (
  input: string,
  options: Omit<ValidateOptions, 'input'> = {}
) =>
  bufferToDataURI(
    Buffer.from(
      JSON.stringify(await validate({ ...options, input }), null, 2),
      'utf8'
    ),
    BuildOutputMimeType
  )

export const docs = {
  GCScriptAPIRefURL,
  GCScriptDocsURL
}
