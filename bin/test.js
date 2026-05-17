#!/usr/bin/env node
/* eslint-env es6 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { createCanvas, Image } from '@napi-rs/canvas'
import { rollup } from 'rollup'
import CommonJS from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import gc from '../dist/nodejs.cjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gc-tests-'))
const exampleScript = await fs.readFile(
  path.resolve(rootDir, 'examples/connect.gcscript'),
  'utf8'
)
const bigExampleScript = await fs.readFile(
  path.resolve(rootDir, 'test/big.gcscript'),
  'utf8'
)
const bigExampleUrl = await fs.readFile(
  path.resolve(rootDir, 'test/big.url'),
  'utf8'
)
const schemaTmpDir = path.resolve(tmpDir, 'schema')

const deriveMinSchemaUrl = (schemaUrl) => {
  if (schemaUrl.endsWith('.full')) return schemaUrl.replace(/\.full$/, '.min')
  if (schemaUrl.includes('index.json.full')) {
    return schemaUrl.replace('index.json.full', 'index.json.min')
  }
  throw new Error(`Cannot derive min schema URL from ${schemaUrl}`)
}

const readJsonIfFresh = async (filePath, ttlHours) => {
  try {
    const stat = await fs.stat(filePath)
    const ageMs = Date.now() - stat.mtimeMs
    if (ageMs >= Number(ttlHours || 24) * 60 * 60 * 1000) return undefined
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return undefined
  }
}

const writeJsonCache = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value))
}

const writeSchemaCacheForTest = async (cacheFileName, schema) => {
  const candidates = [os.tmpdir(), rootDir]
  let lastError
  for (const dir of candidates) {
    try {
      const cachePath = path.resolve(dir, cacheFileName)
      await writeJsonCache(cachePath, schema)
      return cachePath
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

const downloadJson = async (url) => {
  if (typeof fetch !== 'function') {
    throw new Error(`No fetch implementation available to download ${url}`)
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`)
  }
  return response.json()
}

const loadSchemaFromTmpDir = async ({
  schemaUrl,
  cacheFileName,
  tmpFileName
}) => {
  const ttlHours = gc.config.GCScriptSchemaCacheTTLHours
  const cacheCandidates = [
    path.resolve(os.tmpdir(), cacheFileName),
    path.resolve(rootDir, cacheFileName)
  ]

  let schema
  for (const cachePath of cacheCandidates) {
    schema = await readJsonIfFresh(cachePath, ttlHours)
    if (schema) break
  }

  if (!schema) {
    schema = await downloadJson(schemaUrl)
    await writeSchemaCacheForTest(cacheFileName, schema)
  }

  const tmpSchemaPath = path.resolve(schemaTmpDir, tmpFileName)
  await writeJsonCache(tmpSchemaPath, schema)
  return JSON.parse(await fs.readFile(tmpSchemaPath, 'utf8'))
}

const validationSchemaMin = await loadSchemaFromTmpDir({
  schemaUrl: deriveMinSchemaUrl(gc.config.GCScriptSchemaURL),
  cacheFileName: `${gc.config.GCScriptSchemaCacheFileName}.min`,
  tmpFileName: 'index.json.min'
})
const validationSchemaFull = await loadSchemaFromTmpDir({
  schemaUrl: gc.config.GCScriptSchemaURL,
  cacheFileName: gc.config.GCScriptSchemaCacheFileName,
  tmpFileName: 'index.json.full'
})
const invalidGCScript = await fs.readFile(
  path.resolve(
    rootDir,
    'test/validation-fixtures/exampleInvalidGCScript.gcscript'
  ),
  'utf8'
)
const run = (title, fn) => ({ title, fn })
const tests = []

const withTimeout = async (title, fn, timeoutMs = 60000) => {
  let timeoutId
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms: ${title}`))
        }, timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

const execCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${[command, ...args].join(' ')}`,
        result.stdout,
        result.stderr
      ]
        .filter(Boolean)
        .join('\n')
    )
  }
  return result
}

const execNode = (args, options = {}) => {
  return execCommand(process.execPath, args, options)
}

const readFileIfExists = async (filePath) => {
  try {
    return await fs.readFile(filePath)
  } catch {
    return undefined
  }
}

let packedArtifactPath

const packBuiltPackage = async () => {
  if (packedArtifactPath) return packedArtifactPath

  const packDir = path.resolve(tmpDir, 'pack')
  await fs.mkdir(packDir, { recursive: true })
  const result = execCommand('npm', ['pack', '--pack-destination', packDir], {
    cwd: rootDir
  })
  const archiveName = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
  assert.ok(archiveName, 'npm pack did not produce an archive name')
  packedArtifactPath = path.resolve(packDir, archiveName)
  return packedArtifactPath
}

const installPackedPackageInto = async (consumerDir) => {
  const archivePath = await packBuiltPackage()
  const nodeModulesDir = path.resolve(consumerDir, 'node_modules')
  const scopeDir = path.resolve(nodeModulesDir, '@gamechanger-finance')
  const unpackDir = path.resolve(consumerDir, '.unpack')
  const unpackPackageDir = path.resolve(unpackDir, 'package')
  const installedPackageDir = path.resolve(scopeDir, 'gc')

  await fs.mkdir(scopeDir, { recursive: true })
  await fs.rm(unpackDir, { recursive: true, force: true })
  await fs.mkdir(unpackDir, { recursive: true })
  execCommand('tar', ['-xzf', archivePath, '-C', unpackDir])
  await fs.rm(installedPackageDir, { recursive: true, force: true })
  await fs.rename(unpackPackageDir, installedPackageDir)

  return { archivePath, installedPackageDir }
}

const isPng = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= 8 &&
  buffer
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

const isSvg = (buffer) =>
  Buffer.from(buffer).toString('utf8').trim().startsWith('<svg')

const decodeDataUri = (value) => {
  const match = String(value).match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s
  )
  assert.ok(match, 'expected data URI')
  const payload = match[3]
  return match[2]
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload))
}

const validateReport = async (input, options = {}) =>
  JSON.parse(
    decodeDataUri(
      await gc.validate.file({
        input,
        useSchema: options.useSchema || validationSchemaFull,
        fileName: options.fileName,
        filePath: options.filePath,
        fileUri: options.fileUri
      })
    ).toString('utf8')
  )

const parseUrl = (value) => new URL(String(value))

const installCanvasShim = (dom) => {
  const { HTMLCanvasElement } = dom.window
  if (!HTMLCanvasElement?.prototype) return

  const ensureCanvas = (element) => {
    const width = Number(element.width) || 300
    const height = Number(element.height) || 150
    if (!element.__gcCanvas) {
      element.__gcCanvas = createCanvas(width, height)
    }
    if (
      element.__gcCanvas.width !== width ||
      element.__gcCanvas.height !== height
    ) {
      element.__gcCanvas.width = width
      element.__gcCanvas.height = height
    }
    return element.__gcCanvas
  }

  HTMLCanvasElement.prototype.getContext = function (type, options) {
    return ensureCanvas(this).getContext(type, options)
  }
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    return ensureCanvas(this).toDataURL(type || 'image/png')
  }
  HTMLCanvasElement.prototype.toBuffer = function (type) {
    return ensureCanvas(this).toBuffer(type)
  }
  dom.window.Image = Image
}

tests.push(
  run('dist/nodejs.cjs can be required', async () => {
    assert.equal(typeof gc.encode.url, 'function')
    assert.equal(typeof gc.encode.qr, 'function')
    assert.equal(typeof gc.snippet.html, 'function')
    assert.equal(typeof gc.snippet['html-zero'], 'function')
    assert.equal(typeof gc.build.file, 'function')
    assert.equal(typeof gc.validate.file, 'function')
  })
)

tests.push(
  run(
    'dist/nodejs.js can be imported with default and named exports',
    async () => {
      const mod = await import(
        pathToFileURL(path.resolve(rootDir, 'dist/nodejs.js')).href
      )
      assert.equal(typeof mod.default.encode.url, 'function')
      assert.equal(typeof mod.encode.url, 'function')
      assert.equal(typeof mod.build.file, 'function')
      assert.equal(typeof mod.validate.file, 'function')
      assert.equal(typeof mod.encodings.gzip.encoder, 'function')
      assert.equal(typeof mod.gc.encode.qr, 'function')
    }
  )
)

tests.push(
  run('legacy named exports remain available', async () => {
    const mod = await import(
      pathToFileURL(path.resolve(rootDir, 'dist/nodejs.js')).href
    )
    assert.equal(
      mod.config.DefaultAPIEncodings[mod.config.DefaultAPIVersion],
      'gzip'
    )
    assert.equal(mod.config.DefaultNetwork, 'mainnet')
    assert.equal(typeof mod.utils.Buffer.from, 'function')
    assert.equal(typeof mod.utils.virtualFileSystemToZip, 'function')
  })
)

tests.push(
  run('browser bundle does not contain node-only leakage markers', async () => {
    const browserBundle = await fs.readFile(
      path.resolve(rootDir, 'dist/browser.runtime.js'),
      'utf8'
    )
    assert.doesNotMatch(browserBundle, /import\(`\.\/\$\{encoder\}`\)/)
    assert.doesNotMatch(browserBundle, /@napi-rs\/canvas/)
    assert.doesNotMatch(browserBundle, /node-canvas/)
    assert.doesNotMatch(browserBundle, /jsdom/)
    assert.doesNotMatch(browserBundle, /node:fs\/promises/)
    assert.doesNotMatch(browserBundle, /node:util\/types/)
    assert.doesNotMatch(browserBundle, /easyqrcodejs-node\.cjs/)
  })
)

tests.push(
  run('package build does not emit source maps', async () => {
    const entries = await fs.readdir(path.resolve(rootDir, 'dist'))
    assert.deepEqual(
      entries.filter((entry) => entry.endsWith('.map')),
      []
    )
    for (const filename of entries.filter((entry) =>
      /\.m?js$|\.cjs$/.test(entry)
    )) {
      const text = await fs.readFile(
        path.resolve(rootDir, 'dist', filename),
        'utf8'
      )
      assert.doesNotMatch(text, /sourceMappingURL=/)
      assert.doesNotMatch(text, /sourcesContent/)
    }
  })
)

tests.push(
  run('package self import works', async () => {
    const result = execNode([
      '--input-type=module',
      '-e',
      "import('@gamechanger-finance/gc').then(({default: gc, encode, build, config:{DefaultAPIEncodings, DefaultAPIVersion}})=>{console.log(typeof gc.encode.url + ':' + typeof encode.url + ':' + typeof build.file + ':' + DefaultAPIEncodings[DefaultAPIVersion])})"
    ])
    assert.match(result.stdout.trim(), /^function:function:function:gzip$/)
  })
)

tests.push(
  run('package self require works', async () => {
    const result = execNode([
      '-e',
      "const gc=require('@gamechanger-finance/gc'); console.log(typeof gc.encode.url + ':' + typeof gc.snippet.html + ':' + typeof gc.snippet['html-zero'] + ':' + gc.config.DefaultAPIEncodings[gc.config.DefaultAPIVersion])"
    ])
    assert.match(result.stdout.trim(), /^function:function:function:gzip$/)
  })
)

tests.push(
  run('packed package includes the emitted declaration graph', async () => {
    const archivePath = await packBuiltPackage()
    const result = execCommand('tar', ['-tf', archivePath])
    const entries = result.stdout
    assert.match(entries, /package\/dist\/index\.d\.ts/)
    assert.match(entries, /package\/dist\/encodings\/index\.d\.ts/)
    assert.match(entries, /package\/dist\/types\/index\.d\.ts/)
    assert.match(entries, /package\/dist\/modules\/easyqrcodejs\.d\.ts/)
    assert.match(
      entries,
      /package\/dist\/modules\/easyqrcodejs\.browser\.d\.ts/
    )
    assert.match(entries, /package\/dist\/modules\/easyqrcodejs\.shared\.d\.ts/)
  })
)

tests.push(
  run(
    'packed package type-checks in a consumer TypeScript project',
    async () => {
      const consumerDir = path.resolve(tmpDir, 'consumer-types')
      await fs.rm(consumerDir, { recursive: true, force: true })
      await fs.mkdir(consumerDir, { recursive: true })
      await installPackedPackageInto(consumerDir)

      await fs.writeFile(
        path.resolve(consumerDir, 'index.ts'),
        `import gc, {
  gc as gcNamed,
  encode,
  snippet,
  build,
  encodings,
  utils,
  config,
  NetworkType,
} from '@gamechanger-finance/gc'

const handlers = [gc, gcNamed, encode, snippet, build, encodings, utils, config]
const defaultEncoding = config.DefaultAPIEncodings[config.DefaultAPIVersion]
const network: NetworkType = config.DefaultNetwork
const bufferValue = utils.Buffer.from('hello')
const zipValue = utils.virtualFileSystemToZip({ 'hello.txt': { data: bufferValue } })
void handlers
void defaultEncoding
void network
void bufferValue
void zipValue
`,
        'utf8'
      )
      await fs.writeFile(
        path.resolve(consumerDir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              module: 'ES2022',
              target: 'ES2022',
              moduleResolution: 'Bundler',
              strict: true,
              skipLibCheck: false,
              noEmit: true
            },
            include: ['index.ts']
          },
          null,
          2
        ),
        'utf8'
      )

      execNode(
        [
          path.resolve(rootDir, 'node_modules/typescript/bin/tsc'),
          '-p',
          path.resolve(consumerDir, 'tsconfig.json')
        ],
        { cwd: consumerDir }
      )
    }
  )
)

tests.push(
  run('packed package bundles cleanly for a browser consumer', async () => {
    const consumerDir = path.resolve(tmpDir, 'consumer-browser-bundle')
    await fs.rm(consumerDir, { recursive: true, force: true })
    await fs.mkdir(consumerDir, { recursive: true })
    await installPackedPackageInto(consumerDir)

    const entryFile = path.resolve(consumerDir, 'main.js')
    await fs.writeFile(
      entryFile,
      `import gc, { encode } from '@gamechanger-finance/gc'
console.log(typeof gc.encode.url, typeof encode.url, typeof gc.utils.virtualFileSystemToZip)
`,
      'utf8'
    )

    const bundle = await rollup({
      input: entryFile,
      plugins: [nodeResolve({ browser: true }), CommonJS()]
    })
    const generated = await bundle.generate({ format: 'es' })
    await bundle.close()

    const code = generated.output.map((chunk) => chunk.code || '').join('\n')
    assert.ok(code.includes('encode'))
    assert.doesNotMatch(code, /easyqrcodejs-node\.cjs/)
    assert.doesNotMatch(code, /@napi-rs\/canvas\/node-canvas/)
    assert.doesNotMatch(code, /runtimeImport\('node:(?:module|path|url)'\)/)
    assert.doesNotMatch(code, /require\('\.\/easyqrcodejs-node\.cjs'\)/)
    assert.doesNotMatch(code, /require\('jsdom'\)/)
    assert.doesNotMatch(code, /require\('undici'\)/)
  })
)

tests.push(
  run('dist/browser.js can be imported in Node for smoke checks', async () => {
    const mod = await import(
      pathToFileURL(path.resolve(rootDir, 'dist/browser.js')).href
    )
    assert.equal(typeof mod.default.encode.url, 'function')
    const url = await mod.default.encode.url({
      input: exampleScript,
      apiVersion: '2',
      network: 'mainnet',
      encoding: 'gzip'
    })
    assert.match(url, /^https:\/\//)
    assert.equal(parseUrl(url).searchParams.get('networkTag'), 'mainnet')
  })
)

tests.push(
  run(
    'dist/browser.min.js exposes window.gc in a browser-like VM',
    async () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
      })
      dom.window.process = undefined
      installCanvasShim(dom)
      const script = await fs.readFile(
        path.resolve(rootDir, 'dist/browser.min.js'),
        'utf8'
      )
      vm.runInContext(script, dom.getInternalVMContext())
      assert.equal(typeof dom.window.gc.encode.url, 'function')
      const url = await dom.window.gc.encode.url({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip'
      })
      assert.match(url, /^https:\/\//)
      assert.equal(parseUrl(url).searchParams.get('networkTag'), 'mainnet')
    }
  )
)

tests.push(
  run(
    'dist/browser.min.js build.file resolves app virtual filesystem imports',
    async () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
      })
      dom.window.process = undefined
      installCanvasShim(dom)
      const script = await fs.readFile(
        path.resolve(rootDir, 'dist/browser.min.js'),
        'utf8'
      )
      vm.runInContext(script, dom.getInternalVMContext())
      assert.equal(typeof dom.window.gc.build.file, 'function')
      assert.equal(typeof dom.window.gc.utils.Buffer.from, 'function')

      const output = await dom.window.gc.build.file({
        input: JSON.stringify({
          type: 'script',
          run: {
            config: {
              type: '$importAsData',
              as: 'object',
              from: { config: 'app://config.json' }
            }
          }
        }),
        fileUri: 'app:///main.gcscript',
        files: {
          'config.json': {
            data: dom.window.gc.utils.Buffer.from('{"enabled":true}', 'utf8')
          }
        },
        doValidate: false
      })

      const built = JSON.parse(decodeDataUri(output).toString('utf8'))
      assert.equal(built.run.config.type, 'data')
      assert.equal(built.run.config.value.config.enabled, true)
    }
  )
)

tests.push(
  run('node library encode.url works', async () => {
    const url = await gc.encode.url({
      input: exampleScript,
      apiVersion: '2',
      network: 'mainnet',
      encoding: 'gzip'
    })
    assert.match(url, /^https:\/\//)
    assert.equal(parseUrl(url).searchParams.get('networkTag'), 'mainnet')
  })
)

tests.push(
  run(
    'node library build.file resolves app virtual filesystem imports',
    async () => {
      const main = JSON.stringify({
        type: 'script',
        run: {
          data: {
            type: '$importAsData',
            as: 'object',
            from: {
              config: 'app://config.json'
            }
          },
          nested: {
            type: '$importAsScript',
            from: {
              child: 'app://scripts/child.gcscript'
            }
          }
        }
      })
      const out = await gc.build.file({
        input: main,
        fileUri: 'app:///main.gcscript',
        doValidate: false,
        files: {
          'config.json': { data: Buffer.from('{"enabled":true}', 'utf8') },
          'scripts/child.gcscript': {
            data: Buffer.from(
              '{"type":"script","run":{"address":{"type":"getCurrentAddress"}}}',
              'utf8'
            )
          }
        }
      })
      const built = JSON.parse(decodeDataUri(out).toString('utf8'))
      assert.equal(built.run.data.type, 'data')
      assert.equal(built.run.data.value.config.enabled, true)
      assert.equal(built.run.nested.type, 'script')
      assert.equal(
        built.run.nested.run.child.run.address.type,
        'getCurrentAddress'
      )
    }
  )
)

tests.push(
  run(
    'node library build.file accepts JSONC comments without touching strings',
    async () => {
      const input = `{
      // line comment before type
      "type": "script",
      "description": "https://example.test/path//kept /* also kept */",
      /* block comment before run */
      "run": {
        "message": {
          "type": "data",
          "value": "slash // and block /* text */ survive"
        }
      }
    }`
      const out = await gc.build.file({
        input,
        fileUri: 'app:///main.gcscript',
        doValidate: false
      })
      const built = JSON.parse(decodeDataUri(out).toString('utf8'))
      assert.equal(
        built.description,
        'https://example.test/path//kept /* also kept */'
      )
      assert.equal(
        built.run.message.value,
        'slash // and block /* text */ survive'
      )
    }
  )
)

tests.push(
  run(
    'node library build.file supports JSONC compatibility cases',
    async () => {
      const input = `{
      // line comment
      "type": "script", // trailing line comment
      "description": "unicode survives: 🚀 ñ // not a comment /* not a block */",
      /* block comment */
      "run": {
        /* multiline block comment
           with unicode λ 漢字 */
        "escaped": {
          "type": "data",
          "value": "escaped quote: \\" and slashes // /* */",
        },
      },
    }`
      const out = await gc.build.file({
        input,
        fileUri: 'app:///main.gcscript',
        doValidate: false
      })
      const builtJson = decodeDataUri(out).toString('utf8')
      const built = JSON.parse(builtJson)
      assert.equal(
        built.run.escaped.value,
        'escaped quote: " and slashes // /* */'
      )
      assert.doesNotMatch(
        builtJson,
        /\/\/ line comment|multiline block comment/
      )
    }
  )
)

tests.push(
  run(
    'node library build.file parses JSONC in script and data imports across 3 levels',
    async () => {
      const input = `{
        // level 1 root
        "type": "script",
        "run": {
          "level2": {
            "type": "$importAsScript",
            "from": { "child": "app://level2.gcscript", },
          },
        },
      }`
      const out = await gc.build.file({
        input,
        fileUri: 'app:///main.gcscript',
        doValidate: false,
        files: {
          'level2.gcscript': {
            data: Buffer.from(
              `{
                /* level 2 imported script */
                "type": "script",
                "run": {
                  "objectData": {
                    "type": "$importAsData",
                    "as": "object",
                    "from": { "obj": "app://data/object.json", },
                  },
                  "jsonData": {
                    "type": "$importAsData",
                    "as": "json",
                    "from": { "json": "app://data/json.json", },
                  },
                  "level3": {
                    "type": "$importAsScript",
                    "from": { "grandchild": "app://level3.gcscript", },
                  },
                },
              }`,
              'utf8'
            )
          },
          'level3.gcscript': {
            data: Buffer.from(
              `{
                // level 3 imported script
                "type": "script",
                "run": {
                  "address": { "type": "getCurrentAddress", },
                },
              }`,
              'utf8'
            )
          },
          'data/object.json': {
            data: Buffer.from(
              `{
                // imported as object
                "enabled": true,
                "label": "// inside string /* safe */",
              }`,
              'utf8'
            )
          },
          'data/json.json': {
            data: Buffer.from(
              `{
                /* imported as json */
                "name": "demo",
                "items": [1, 2, 3,],
              }`,
              'utf8'
            )
          }
        }
      })
      const built = JSON.parse(decodeDataUri(out).toString('utf8'))
      const child = built.run.level2.run.child
      assert.equal(child.run.objectData.value.obj.enabled, true)
      assert.equal(
        child.run.objectData.value.obj.label,
        '// inside string /* safe */'
      )
      assert.equal(
        child.run.jsonData.value.json,
        '{"name":"demo","items":[1,2,3]}'
      )
      assert.equal(
        child.run.level3.run.grandchild.run.address.type,
        'getCurrentAddress'
      )
    }
  )
)

tests.push(
  run(
    'node library build.file rejects non-comment JSONC extensions',
    async () => {
      await assert.rejects(
        () =>
          gc.build.file({
            input: `{ type: 'script', run: {}, }`,
            fileUri: 'app:///main.gcscript'
          }),
        /Invalid GCScript JSON\/JSONC input/
      )
    }
  )
)

tests.push(
  run('utils.hashCode matches SHA-512 over strict JSON output', async () => {
    const code = {
      type: 'script',
      run: { answer: { type: 'data', value: 42 } }
    }
    assert.equal(
      gc.utils.hashCode(code),
      createHash('sha512').update(JSON.stringify(code)).digest('hex')
    )
  })
)

tests.push(
  run('validate.file accepts built strict JSON with min schema', async () => {
    const input = JSON.stringify({
      type: 'script',
      run: { address: { type: 'getCurrentAddress' } }
    })
    const out = await gc.validate.file({
      input,
      fileUri: 'app://valid.gcscript',
      useSchema: validationSchemaMin
    })
    const report = JSON.parse(decodeDataUri(out).toString('utf8'))
    assert.equal(report.isValid, true)
    assert.deepEqual(report.errors, [])
  })
)

tests.push(
  run(
    'validate.file rejects JSONC because validation consumes built JSON',
    async () => {
      const out = await gc.validate.file({
        input: '{ // comment\n "type": "script", "run": {} }',
        fileUri: 'app://jsonc.gcscript',
        useSchema: validationSchemaMin
      })
      const report = JSON.parse(decodeDataUri(out).toString('utf8'))
      assert.equal(report.isValid, false)
      assert.equal(report.errors[0].code, 'code-syntax-error')
    }
  )
)

tests.push(
  run('validate.file reports deepest wallet-compatible JSON path', async () => {
    const out = await gc.validate.file({
      input: invalidGCScript,
      fileUri: 'app://invalid.gcscript',
      fileName: 'exampleInvalidGCScript.gcscript',
      useSchema: validationSchemaFull
    })
    const report = JSON.parse(decodeDataUri(out).toString('utf8'))
    assert.equal(report.isValid, false)
    assert.equal(
      report.errors[0].jsonPath,
      '/run/scripts/run/consensus/script/any/Founders/ofThese/2/pubKeyHashHexa'
    )
    assert.equal(report.errors[0].provided, 'pubKeyHashHexa')
  })
)

tests.push(
  run('build.file validates final output when schema is provided', async () => {
    const out = await gc.build.file({
      input: `{"type":"script","run":{"address":{"type":"getCurrentAddress"}}}`,
      fileUri: 'app:///main.gcscript',
      useSchema: validationSchemaMin
    })
    const built = JSON.parse(decodeDataUri(out).toString('utf8'))
    assert.equal(built.run.address.type, 'getCurrentAddress')
  })
)

tests.push(
  run('build.file can disable default validation explicitly', async () => {
    const out = await gc.build.file({
      input: `{"type":"script","run":{}}`,
      fileUri: 'app:///main.gcscript',
      doValidate: false
    })
    assert.equal(JSON.parse(decodeDataUri(out).toString('utf8')).type, 'script')
  })
)

tests.push(
  run(
    'CLI validate exits non-zero and writes JSON report for invalid code',
    async () => {
      await fs.writeFile(
        path.join(os.tmpdir(), gc.config.GCScriptSchemaCacheFileName),
        JSON.stringify(validationSchemaFull)
      )
      const reportPath = path.resolve(tmpDir, 'invalid-validation-report.json')
      const result = spawnSync(
        process.execPath,
        [
          './bin/cli.js',
          'validate',
          '-f',
          'test/validation-fixtures/exampleInvalidGCScript.gcscript',
          '-o',
          reportPath
        ],
        { cwd: rootDir, encoding: 'utf8' }
      )
      assert.equal(result.status, 1)
      assert.equal(result.stdout, '')
      const stderr = stripAnsi(result.stderr)
      assert.match(stderr, /error/i)
      assert.match(stderr, /exampleInvalidGCScript\.gcscript/)
      assert.match(stderr, /Unknown property|Did you mean|pubKeyHashHexa/)
      assert.ok(await readFileIfExists(reportPath))
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
      assert.equal(report.isValid, false)
      assert.equal(
        report.errors[0].jsonPath,
        '/run/scripts/run/consensus/script/any/Founders/ofThese/2/pubKeyHashHexa'
      )
    }
  )
)

tests.push(
  run('node library build.file can emit compact strict JSON', async () => {
    const out = await gc.build.file({
      input: `{
        // comments disappear
        "type": "script",
        "run": {},
      }`,
      fileUri: 'app:///main.gcscript',
      doValidate: false,
      compactOutput: true
    })
    const builtJson = decodeDataUri(out).toString('utf8')
    assert.equal(builtJson, '{"type":"script","run":{}}')
  })
)

tests.push(
  run(
    'node library build.file rejects app path traversal above project root',
    async () => {
      const input = JSON.stringify({
        type: 'script',
        run: {
          bad: {
            type: '$importAsData',
            from: { secret: 'app://../secret.json' }
          }
        }
      })
      await assert.rejects(
        () =>
          gc.build.file({
            input,
            fileUri: 'app:///main.gcscript',
            doValidate: false
          }),
        /Path traversal outside project root/
      )
    }
  )
)

tests.push(
  run('build.file rejects protocol-less import directives', async () => {
    const uris = [
      './common.gcscript.jsonc',
      '../common.gcscript.jsonc',
      'lib/common.gcscript.jsonc'
    ]
    for (const uri of uris) {
      await assert.rejects(
        () =>
          gc.build.file({
            input: JSON.stringify({
              type: 'script',
              run: {
                bad: {
                  type: '$importAsData',
                  as: 'string',
                  from: { value: uri }
                }
              }
            }),
            doValidate: false
          }),
        /Missing protocol/
      )
      await assert.rejects(
        () =>
          gc.build.file({
            input: JSON.stringify({
              type: 'script',
              run: {
                bad: { type: '$importAsScript', from: { value: uri } }
              }
            }),
            doValidate: false
          }),
        /Missing protocol/
      )
    }
  })
)

tests.push(
  run(
    'build.file resolves explicit app protocol relative and absolute imports',
    async () => {
      const mk = (uri) =>
        JSON.stringify({
          type: 'script',
          run: {
            data: { type: '$importAsData', as: 'string', from: { value: uri } }
          }
        })

      let out = await gc.build.file({
        input: mk('app://./x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        doValidate: false,
        files: { 'dir/x.txt': { data: Buffer.from('relative-dot') } }
      })
      assert.equal(
        JSON.parse(decodeDataUri(out).toString('utf8')).run.data.value.value,
        'relative-dot'
      )

      out = await gc.build.file({
        input: mk('app://../x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        doValidate: false,
        files: { 'x.txt': { data: Buffer.from('relative-parent') } }
      })
      assert.equal(
        JSON.parse(decodeDataUri(out).toString('utf8')).run.data.value.value,
        'relative-parent'
      )

      await assert.rejects(
        () =>
          gc.build.file({
            input: mk('app://../x.txt'),
            fileUri: 'app:///main.gcscript',
            doValidate: false
          }),
        /Path traversal outside project root/
      )

      out = await gc.build.file({
        input: mk('app://lib/x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        doValidate: false,
        files: { 'dir/lib/x.txt': { data: Buffer.from('relative-lib') } }
      })
      assert.equal(
        JSON.parse(decodeDataUri(out).toString('utf8')).run.data.value.value,
        'relative-lib'
      )

      out = await gc.build.file({
        input: mk('app:///lib/x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        doValidate: false,
        files: { 'lib/x.txt': { data: Buffer.from('absolute-lib') } }
      })
      assert.equal(
        JSON.parse(decodeDataUri(out).toString('utf8')).run.data.value.value,
        'absolute-lib'
      )
    }
  )
)

tests.push(
  run(
    'build.file resolves file protocol only when explicitly allowed',
    async () => {
      const mk = (uri) =>
        JSON.stringify({
          type: 'script',
          run: {
            data: { type: '$importAsData', as: 'string', from: { value: uri } }
          }
        })
      const read = { uri: '' }
      const file = async (uri) => {
        read.uri = uri
        return Buffer.from('file-data')
      }

      await assert.rejects(
        () =>
          gc.build.file({ input: mk('file:///tmp/x.txt'), doValidate: false }),
        /Illegal protocol 'file'/
      )

      await gc.build.file({
        input: mk('file://./x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        appWorkingDir: '/app',
        allowedProtocols: ['app', 'file'],
        protocolHandlers: { file },
        doValidate: false
      })
      assert.equal(read.uri, 'file:///app/dir/x.txt')

      await gc.build.file({
        input: mk('file://../outside.txt'),
        fileUri: 'app:///main.gcscript',
        appWorkingDir: '/app',
        allowedProtocols: ['app', 'file'],
        protocolHandlers: { file },
        doValidate: false
      })
      assert.equal(read.uri, 'file:///outside.txt')

      await gc.build.file({
        input: mk('file:///lib/x.txt'),
        fileUri: 'app:///dir/main.gcscript',
        appWorkingDir: '/app',
        allowedProtocols: ['app', 'file'],
        protocolHandlers: { file },
        doValidate: false
      })
      assert.equal(read.uri, 'file:///lib/x.txt')
    }
  )
)

tests.push(
  run(
    'build.file validates root fileUri and defaults to app absolute main URI',
    async () => {
      for (const fileUri of [
        './main.gcscript',
        'app://main.gcscript',
        'file:///tmp/main.gcscript',
        'http://example.com/main.gcscript'
      ]) {
        await assert.rejects(
          () => gc.build.file({ input: '{}', fileUri, doValidate: false }),
          /fileUri must be an absolute app/
        )
      }
      await gc.build.file({ input: '{}', doValidate: false })
      await gc.build.file({
        input: '{}',
        fileUri: 'app:///main.gcscript',
        doValidate: false
      })
    }
  )
)

tests.push(
  run('node library build.file applies http domain whitelist', async () => {
    const input = JSON.stringify({
      type: 'script',
      run: {
        remote: {
          type: '$importAsData',
          from: { config: 'https://evil.test/config.json' }
        }
      }
    })
    await assert.rejects(
      () =>
        gc.build.file({
          input,
          fileUri: 'app:///main.gcscript',
          doValidate: false,
          allowedProtocols: ['https'],
          allowedRemoteDomains: ['example.test'],
          protocolHandlers: {
            https: async () => Buffer.from('{"ok":true}', 'utf8')
          }
        }),
      /Remote domain is not allowed/
    )
  })
)

tests.push(
  run(
    'node library build.file blocks mutable remote imports from local resources',
    async () => {
      const input = JSON.stringify({
        type: 'script',
        run: {
          remote: {
            type: '$importAsScript',
            from: { child: 'https://example.test/remote.gcscript' }
          }
        }
      })
      const remoteScript = JSON.stringify({
        type: 'script',
        run: {
          local: {
            type: '$importAsData',
            from: { config: 'app://config.json' }
          }
        }
      })
      await assert.rejects(
        () =>
          gc.build.file({
            input,
            fileUri: 'app:///main.gcscript',
            doValidate: false,
            files: {
              'config.json': { data: Buffer.from('{"secret":true}', 'utf8') }
            },
            allowedProtocols: ['app', 'https'],
            allowedRemoteDomains: ['example.test'],
            protocolHandlers: {
              https: async () => Buffer.from(remoteScript, 'utf8')
            }
          }),
        /Mutable remote resource .* cannot import local resource/
      )
    }
  )
)

tests.push(
  run('virtual filesystem ZIP helpers round-trip file data', async () => {
    const zip = gc.utils.virtualFileSystemToZip({
      'main.gcscript': { data: Buffer.from(exampleScript, 'utf8') },
      'data/config.json': { data: Buffer.from('{"answer":42}', 'utf8') }
    })
    assert.match(zip, /^data:application\/zip;base64,/)
    const files = gc.utils.zipToVirtualFileSystem(zip)
    assert.equal(
      files['data/config.json'].data.toString('utf8'),
      '{"answer":42}'
    )
  })
)

tests.push(
  run('virtual filesystem TAR.GZ helpers round-trip file data', async () => {
    const tarGz = gc.utils.virtualFileSystemToTarGz({
      'main.gcscript': { data: Buffer.from(exampleScript, 'utf8') },
      'data/config.json': { data: Buffer.from('{"answer":42}', 'utf8') }
    })
    assert.match(tarGz, /^data:application\/gzip;base64,/)
    const files = gc.utils.tarGzToVirtualFileSystem(tarGz)
    assert.equal(
      files['data/config.json'].data.toString('utf8'),
      '{"answer":42}'
    )
  })
)

tests.push(
  run('node library encode.url works with big files', async () => {
    const url = await gc.encode.url({
      input: bigExampleScript,
      apiVersion: '2',
      network: 'mainnet',
      encoding: 'gzip'
    })
    assert.match(url, /^https:\/\//)
    assert.equal(parseUrl(url).searchParams.get('networkTag'), 'mainnet')
    assert.equal(url, bigExampleUrl)
  })
)

tests.push(
  run(
    'generic URL encoder preserves existing query params and appends new ones',
    async () => {
      const url = await gc.encodings.url.encoder(
        { hello: 'world' },
        {
          urlPattern: 'https://example.test/run/{gcscript}?existing=1',
          encoding: 'gzip',
          queryParams: {
            networkTag: 'preprod',
            ref: 'addr_test1_example'
          }
        }
      )
      const parsed = parseUrl(url)
      assert.equal(parsed.searchParams.get('existing'), '1')
      assert.equal(parsed.searchParams.get('networkTag'), 'preprod')
      assert.equal(parsed.searchParams.get('ref'), 'addr_test1_example')
    }
  )
)

tests.push(
  run(
    'node library encode.url supports refAddress and disableNetworkRouter',
    async () => {
      const url = await gc.encode.url({
        input: exampleScript,
        apiVersion: '2',
        network: 'preprod',
        encoding: 'gzip',
        refAddress: 'addr_test1vr3example',
        disableNetworkRouter: true
      })
      const parsed = parseUrl(url)
      assert.equal(parsed.searchParams.get('ref'), 'addr_test1vr3example')
      assert.equal(parsed.searchParams.get('networkTag'), null)
    }
  )
)

tests.push(
  run('node library encode.url supports urlPattern override', async () => {
    const urlPattern = 'http://localhost:3000/api/2/run/{gcscript}'
    const url = await gc.encode.url({
      input: exampleScript,
      apiVersion: '2',
      network: 'mainnet',
      encoding: 'gzip',
      urlPattern
    })
    const parsed = parseUrl(url)
    assert.equal(parsed.origin, 'http://localhost:3000')
    assert.match(parsed.pathname, /^\/api\/2\/run\//)
    // Handler should still append the default networkTag query arg.
    assert.equal(parsed.searchParams.get('networkTag'), 'mainnet')
  })
)

tests.push(
  run(
    'snippet.html propagates urlPattern and supports snippetArgs overrides',
    async () => {
      const urlPattern = 'http://localhost:3000/api/2/run/{gcscript}'
      const out = await gc.snippet.html({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        urlPattern,
        snippetArgs: {
          autoGeneratedLinkUrl: 'https://example.test/docs',
          autoGeneratedLinkText: 'Docs'
        }
      })
      const html = decodeDataUri(out).toString('utf8')
      assert.match(
        html,
        /urlPattern: "http:\/\/localhost:3000\/api\/2\/run\/\{gcscript\}"/
      )
      assert.match(html, /href="https:\/\/example\.test\/docs"/)
      assert.match(html, />Docs<\/a>/)
    }
  )
)

tests.push(
  run(
    'node library encode.qr still supports the new URL query args',
    async () => {
      const png = await gc.encode.qr({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        refAddress: 'addr1example',
        disableNetworkRouter: false,
        qrResultType: 'png',
        template: 'boxed'
      })
      assert.ok(isPng(decodeDataUri(png)))
    }
  )
)

tests.push(
  run(
    'node library encode.qr returns PNG and SVG data with footer text',
    async () => {
      const png = await gc.encode.qr({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        qrResultType: 'png',
        template: 'boxed'
      })
      const svg = await gc.encode.qr({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        qrResultType: 'svg',
        template: 'boxed'
      })
      const svgText = decodeDataUri(svg).toString('utf8')
      assert.ok(isPng(decodeDataUri(png)))
      assert.ok(isSvg(decodeDataUri(svg)))
      assert.match(
        svgText,
        /Scan and review in https:\/\/wallet\.gamechanger\.finance\b/
      )
      assert.match(svgText, /Connect with dapp\?/)
    }
  )
)

tests.push(
  run('encode.qr footer uses urlPattern base when provided', async () => {
    const urlPattern = 'http://localhost:3000/api/2/run/{gcscript}'
    const svg = await gc.encode.qr({
      input: exampleScript,
      apiVersion: '2',
      network: 'mainnet',
      encoding: 'gzip',
      urlPattern,
      qrResultType: 'svg',
      template: 'boxed'
    })
    const svgText = decodeDataUri(svg).toString('utf8')
    assert.match(svgText, /localhost:3000/)
  })
)

tests.push(
  run(
    'browser minified build exposes QR encoder and ships the footer defaults',
    async () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
      })
      dom.window.process = undefined
      installCanvasShim(dom)
      const script = await fs.readFile(
        path.resolve(rootDir, 'dist/browser.min.js'),
        'utf8'
      )
      vm.runInContext(script, dom.getInternalVMContext())
      assert.equal(typeof dom.window.gc.encode.qr, 'function')
      assert.match(script, /Scan and review in\b/)
      assert.match(script, /Segoe UI Variable/)
    }
  )
)

tests.push(
  run('json-url-lzw throws a deprecation error', async () => {
    await assert.rejects(
      () => gc.encodings['json-url-lzw'].encoder({ foo: 'bar' }),
      (err) =>
        err?.name === 'DeprecationError' || err?.code === 'ERR_DEPRECATED'
    )
  })
)

tests.push(
  run('CLI encode url works', async () => {
    const result = execNode([
      'bin/cli.js',
      'mainnet',
      'encode',
      'url',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript'
    ])
    assert.match(result.stdout.trim(), /^https:\/\//)
    assert.equal(
      parseUrl(result.stdout.trim()).searchParams.get('networkTag'),
      'mainnet'
    )
  })
)

tests.push(
  run(
    'CLI encode url keeps artifact on stdout and human logs on stderr',
    async () => {
      const noisy = execNode([
        'bin/cli.js',
        'mainnet',
        'encode',
        'url',
        '-v',
        '2',
        '-e',
        'gzip',
        '-f',
        'examples/connect.gcscript'
      ])
      assert.match(noisy.stdout.trim(), /^https:\/\//)
      assert.equal(
        parseUrl(noisy.stdout.trim()).searchParams.get('networkTag'),
        'mainnet'
      )

      const quiet = execNode([
        'bin/cli.js',
        'mainnet',
        'encode',
        'url',
        '-v',
        '2',
        '-e',
        'gzip',
        '-f',
        'examples/connect.gcscript',
        '--quiet'
      ])
      assert.match(quiet.stdout.trim(), /^https:\/\//)
      assert.equal(quiet.stderr, '')
    }
  )
)

tests.push(
  run('CLI help writes to stderr without polluting stdout', async () => {
    const result = spawnSync(process.execPath, ['bin/cli.js', '--help'], {
      cwd: rootDir,
      encoding: 'utf8'
    })
    assert.equal(result.status, 0)
    assert.equal(result.stdout, '')
    const stderr = stripAnsi(result.stderr)
    assert.match(stderr, /GameChanger Wallet CLI/)
    assert.match(stderr, /Usage/)
    assert.match(stderr, /--snippetArgsFile/)
  })
)

tests.push(
  run(
    'CLI invalid nested snippet navigation shows scoped usage on stderr',
    async () => {
      const result = spawnSync(
        process.execPath,
        ['bin/cli.js', 'mainnet', 'snippet', 'html-cero'],
        { cwd: rootDir, encoding: 'utf8' }
      )
      assert.notEqual(result.status, 0)
      assert.equal(result.stdout, '')
      const stderr = stripAnsi(result.stderr)
      assert.match(
        stderr,
        /Error: Unknown sub action 'html-cero' for action 'snippet'/
      )
      assert.match(stderr, /\$ gamechanger-cli mainnet snippet \[subaction\]/)
      assert.match(stderr, /'html-zero'/)
      assert.doesNotMatch(stderr, /\$ gamechanger-cli build \[-f file\]/)
    }
  )
)

tests.push(
  run('CLI encode url with output file keeps stdout empty', async () => {
    const outputFile = path.resolve(tmpDir, 'cli-url-output.txt')

    const result = execNode([
      'bin/cli.js',
      'mainnet',
      'encode',
      'url',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      outputFile
    ])

    assert.equal(result.stdout, '')
    const url = (await fs.readFile(outputFile, 'utf8')).trim()
    assert.match(url, /^https:\/\//)
    assert.equal(parseUrl(url).searchParams.get('networkTag'), 'mainnet')
  })
)

tests.push(
  run(
    'CLI encode url supports refAddress and disableNetworkRouter flags',
    async () => {
      const result = execNode([
        'bin/cli.js',
        'preprod',
        'encode',
        'url',
        '-v',
        '2',
        '-e',
        'gzip',
        '-f',
        'examples/connect.gcscript',
        '-r',
        'addr_test1cli',
        '-R'
      ])
      const parsed = parseUrl(result.stdout.trim())
      assert.equal(parsed.searchParams.get('ref'), 'addr_test1cli')
      assert.equal(parsed.searchParams.get('networkTag'), null)
    }
  )
)

tests.push(
  run('CLI encode qr writes PNG to stdout without output file', async () => {
    const result = spawnSync(
      process.execPath,
      [
        'bin/cli.js',
        'mainnet',
        'encode',
        'qr',
        '-v',
        '2',
        '-e',
        'gzip',
        '-f',
        'examples/connect.gcscript',
        '-t',
        'boxed'
      ],
      { cwd: rootDir }
    )

    assert.equal(result.status, 0, result.stderr?.toString('utf8'))
    assert.ok(isPng(result.stdout))
  })
)

tests.push(
  run('CLI encode qr with output file keeps stdout empty', async () => {
    const pngFile = path.resolve(tmpDir, 'cli-qr-output-file.png')

    const result = execNode([
      'bin/cli.js',
      'mainnet',
      'encode',
      'qr',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      pngFile,
      '-t',
      'boxed'
    ])

    assert.equal(result.stdout, '')
    assert.ok(isPng(await fs.readFile(pngFile)))
  })
)

tests.push(
  run(
    'CLI encode qr with inline args writes the requested PNG file',
    async () => {
      const pngFile = path.resolve(tmpDir, 'cli-inline-qr.png')

      execNode([
        'bin/cli.js',
        'mainnet',
        'encode',
        'qr',
        '-v',
        '2',
        '-o',
        pngFile,
        '-t',
        'boxed',
        '-a',
        '{"type":"tx","title":"Demo","description":"created with gamechanger-cli","metadata":{"123":{"message":"Hello World!"}}}'
      ])

      assert.ok(isPng(await fs.readFile(pngFile)))
    }
  )
)

tests.push(
  run('CLI encode qr writes PNG and SVG files', async () => {
    const pngFile = path.resolve(tmpDir, 'cli-qr.png')
    const svgFile = path.resolve(tmpDir, 'cli-qr.svg')

    execNode([
      'bin/cli.js',
      'mainnet',
      'encode',
      'qr',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      pngFile,
      '-t',
      'boxed'
    ])
    execNode([
      'bin/cli.js',
      'mainnet',
      'encode',
      'qr',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      svgFile,
      '-t',
      'boxed'
    ])

    assert.ok(isPng(await fs.readFile(pngFile)))
    assert.ok(isSvg(await fs.readFile(svgFile)))
  })
)

tests.push(
  run(
    'CLI encode qr writes the requested SVG file with footer text',
    async () => {
      const svgFile = path.resolve(tmpDir, 'cli-qr.svg')

      execNode([
        'bin/cli.js',
        'mainnet',
        'encode',
        'qr',
        '-v',
        '2',
        '-e',
        'gzip',
        '-f',
        'examples/connect.gcscript',
        '-o',
        svgFile,
        '-t',
        'boxed'
      ])

      assert.ok(isSvg(await fs.readFile(svgFile)))
      assert.match(
        (await fs.readFile(svgFile, 'utf8')).toString(),
        /Scan and review in https:\/\/wallet\.gamechanger\.finance\b/
      )
    }
  )
)

tests.push(
  run('CLI build writes a bundled GCScript file', async () => {
    const projectDir = path.resolve(tmpDir, 'cli-build-project')
    await fs.mkdir(path.resolve(projectDir, 'scripts'), { recursive: true })
    await fs.writeFile(
      path.resolve(projectDir, 'main.gcscript'),
      JSON.stringify({
        type: 'script',
        run: {
          data: {
            type: '$importAsData',
            as: 'object',
            from: { config: 'app://config.json' }
          },
          nested: {
            type: '$importAsScript',
            from: { child: 'app://scripts/child.gcscript' }
          }
        }
      }),
      'utf8'
    )
    await fs.writeFile(
      path.resolve(projectDir, 'config.json'),
      '{"enabled":true}',
      'utf8'
    )
    await fs.writeFile(
      path.resolve(projectDir, 'scripts/child.gcscript'),
      '{"type":"script","run":{"address":{"type":"getCurrentAddress"}}}',
      'utf8'
    )
    const outputFile = path.resolve(projectDir, 'dist/built.gcscript')

    const result = execNode([
      'bin/cli.js',
      'build',
      '-f',
      path.resolve(projectDir, 'main.gcscript'),
      '-o',
      outputFile,
      '--cwd',
      projectDir,
      '--fileUri',
      'app:///main.gcscript',
      '--quiet'
    ])

    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    const built = JSON.parse(await fs.readFile(outputFile, 'utf8'))
    assert.equal(built.run.data.value.config.enabled, true)
    assert.equal(
      built.run.nested.run.child.run.address.type,
      'getCurrentAddress'
    )
  })
)

tests.push(
  run(
    'CLI build supports compactOutput and build summary logging',
    async () => {
      const projectDir = path.resolve(tmpDir, 'cli-compact-project')
      await fs.mkdir(projectDir, { recursive: true })
      await fs.writeFile(
        path.resolve(projectDir, 'main.gcscript'),
        `{
        // JSONC + compact CLI output
        "type": "script",
        "run": {
          "data": {
            "type": "$importAsData",
            "as": "object",
            "from": { "config": "app://config.json", },
          },
        },
      }`,
        'utf8'
      )
      await fs.writeFile(
        path.resolve(projectDir, 'config.json'),
        `{
        // imported data comment
        "enabled": true,
      }`,
        'utf8'
      )
      const outputFile = path.resolve(projectDir, 'dist/built.gcscript')
      const result = execNode([
        'bin/cli.js',
        'build',
        '-f',
        path.resolve(projectDir, 'main.gcscript'),
        '-o',
        outputFile,
        '--cwd',
        projectDir,
        '--fileUri',
        'app:///main.gcscript',
        '--compactOutput'
      ])

      const builtJson = await fs.readFile(outputFile, 'utf8')
      assert.equal(
        builtJson,
        '{"type":"script","run":{"data":{"type":"data","value":{"config":{"enabled":true}}}}}'
      )
      assert.equal(result.stdout, '')
      assert.match(result.stderr, /Build summary/)
      assert.match(
        result.stderr,
        /app:\/\/\/config\.json\s+67 B, 4 lines, hash /
      )
      assert.match(result.stderr, /Built artifact .* hash /)
    }
  )
)
tests.push(
  run('CLI does not import express at startup', async () => {
    const cliSource = await fs.readFile(
      path.resolve(rootDir, 'bin/cli.js'),
      'utf8'
    )
    assert.doesNotMatch(cliSource, /^import express from/m)
    assert.match(cliSource, /import\('express'\)/)
  })
)

tests.push(
  run('CLI snippet outputs can be written to files', async () => {
    const buttonFile = path.resolve(tmpDir, 'button.html')
    const htmlFile = path.resolve(tmpDir, 'snippet.html')
    const htmlZeroFile = path.resolve(tmpDir, 'snippet-zero.html')
    const reactFile = path.resolve(tmpDir, 'react.html')
    const expressFile = path.resolve(tmpDir, 'backend.js')

    execNode([
      'bin/cli.js',
      'mainnet',
      'snippet',
      'button',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      buttonFile
    ])
    execNode([
      'bin/cli.js',
      'mainnet',
      'snippet',
      'html',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      htmlFile
    ])
    execNode([
      'bin/cli.js',
      'mainnet',
      'snippet',
      'html-zero',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      htmlZeroFile
    ])
    execNode([
      'bin/cli.js',
      'mainnet',
      'snippet',
      'react',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      reactFile
    ])
    execNode([
      'bin/cli.js',
      'mainnet',
      'snippet',
      'express',
      '-v',
      '2',
      '-e',
      'gzip',
      '-f',
      'examples/connect.gcscript',
      '-o',
      expressFile
    ])

    assert.match(
      (await fs.readFile(buttonFile, 'utf8')).toString(),
      /gcConnectButton/
    )
    assert.match(
      (await fs.readFile(htmlFile, 'utf8')).toString(),
      /@gamechanger-finance\/gc/
    )
    assert.match(
      (await fs.readFile(htmlZeroFile, 'utf8')).toString(),
      /CompressionStream/
    )
    assert.match((await fs.readFile(reactFile, 'utf8')).toString(), /React/)
    assert.match(
      (await fs.readFile(expressFile, 'utf8')).toString(),
      /express/i
    )
  })
)

tests.push(
  run(
    'CLI snippetArgsFile merges with snippetArgs for html/react/html-zero',
    async () => {
      const snippetArgsFile = path.resolve(tmpDir, 'snippet-args.json')
      await fs.writeFile(
        snippetArgsFile,
        JSON.stringify({
          title: 'Title from file',
          description: 'Description from file',
          buttonText: 'Button text from file'
        }),
        'utf8'
      )

      const dummyScript = '{"type":"script","run":{}}'
      const cliArgs = JSON.stringify({
        title: 'Title from CLI args',
        defaultIntents:
          '{\n        // default intents overridden from CLI args\n      }'
      })

      for (const subAction of ['html', 'react', 'html-zero']) {
        const outputFile = path.resolve(
          tmpDir,
          `snippet-merge-${subAction}.html`
        )
        const result = execNode([
          'bin/cli.js',
          'mainnet',
          'snippet',
          subAction,
          '-v',
          '2',
          '-e',
          'gzip',
          '-a',
          dummyScript,
          '--snippetArgsFile',
          snippetArgsFile,
          '--snippetArgs',
          cliArgs,
          '-o',
          outputFile
        ])

        assert.equal(result.stdout, '')
        const html = await fs.readFile(outputFile, 'utf8')
        assert.match(html, /Title from CLI args/)
        assert.doesNotMatch(html, /Title from file/)
        assert.match(html, /Description from file/)
        if (subAction !== 'html-zero') {
          assert.match(html, /default intents overridden from CLI args/)
        }
      }
    }
  )
)

tests.push(
  run(
    'CLI snippets reject empty -a input even with snippet args configured',
    async () => {
      const snippetArgsFile = path.resolve(
        tmpDir,
        'empty-input-snippet-args.json'
      )
      await fs.writeFile(
        snippetArgsFile,
        JSON.stringify({ title: 'Unused' }),
        'utf8'
      )

      for (const subAction of ['html', 'react', 'html-zero']) {
        const result = spawnSync(
          process.execPath,
          [
            'bin/cli.js',
            'mainnet',
            'snippet',
            subAction,
            '-v',
            '2',
            '-a',
            '',
            '--snippetArgsFile',
            snippetArgsFile,
            '--snippetArgs',
            '{"title":"Unused override"}'
          ],
          { cwd: rootDir, encoding: 'utf8' }
        )
        assert.notEqual(result.status, 0)
        assert.equal(result.stdout, '')
        const stderr = stripAnsi(result.stderr)
        assert.match(stderr, /Empty GCScript provided/)
        assert.match(
          stderr,
          new RegExp(
            `\\$ gamechanger-cli mainnet snippet ${subAction} \\[options\\]`
          )
        )
      }
    }
  )
)

const smallValidationSchema = {
  'api.json': {
    type: 'object',
    required: ['encoding'],
    additionalProperties: false,
    properties: {
      encoding: {
        type: 'string',
        enum: ['gzip', 'base64url'],
        examples: [{ encoding: 'gzip' }]
      },
      count: {
        type: 'number'
      }
    }
  }
}

tests.push(
  run('invalid GCScript type suggests closest API type only', async () => {
    const report = await validateReport(
      `{
  "type": "getCurrentAddresses"
}`,
      {
        fileName: 'invalid-type.gcscript.json'
      }
    )
    const [error] = report.errors
    assert.equal(report.isValid, false)
    assert.equal(error.code, 'code-invalid-const-enum')
    assert.match(error.message, /getCurrentAddress/)
    assert.deepEqual(error.details.closestValues, ['getCurrentAddress'])
    assert.doesNotMatch(JSON.stringify(error), /getPublicKeys/)
  })
)

tests.push(
  run(
    'generic const enum suggestion works for non type/kind properties',
    async () => {
      const report = await validateReport('{"encoding":"gip"}', {
        useSchema: smallValidationSchema
      })
      const [error] = report.errors
      assert.equal(error.code, 'code-invalid-const-enum')
      assert.equal(error.details.propertyName, 'encoding')
      assert.deepEqual(error.details.closestValues, ['gzip'])
      assert.match(error.suggestion, /gzip/)
    }
  )
)

// const stripAnsi = (value) =>
//   String(value || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')

const stripAnsi = (value) => {
  const esc = String.fromCharCode(27)
  return String(value || '').replace(
    new RegExp(`${esc}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'g'),
    ''
  )
}

tests.push(
  run(
    'compact CLI validation output includes focused normalized diagnostics',
    async () => {
      const inputFile = path.resolve(tmpDir, 'cli-invalid-type.gcscript.json')
      const reportFile = path.resolve(tmpDir, 'cli-validation-report.json')

      await fs.writeFile(
        inputFile,
        `{
  "type": "getCurrentAddresses"
}\n`
      )

      const result = spawnSync(
        process.execPath,
        ['bin/cli.js', 'validate', '-f', inputFile, '-o', reportFile],
        { cwd: rootDir, encoding: 'utf8' }
      )

      const stderr = stripAnsi(result.stderr)

      assert.notEqual(result.status, 0)
      assert.equal(result.stdout, '')

      assert.match(
        stderr,
        /Unknown GCScript function type:\s*"getCurrentAddresses"/
      )
      assert.match(stderr, /Did you mean:\s*"getCurrentAddress"/)
      assert.match(stderr, /\/type\s*·\s*line\s+2,\s*col\s+11/)

      assert.match(stderr, /Example:/)
      assert.match(stderr, /"type"\s*:\s*"getCurrentAddress"/)

      assert.match(
        stderr,
        /https:\/\/wallet\.gamechanger\.finance\/doc\/api\/v2\/getCurrentAddress\.html/
      )

      const report = JSON.parse(await fs.readFile(reportFile, 'utf8'))
      const [error] = report.errors

      assert.equal(report.isValid, false)
      assert.equal(error.jsonPath, '/type')
      assert.equal(error.provided, 'getCurrentAddresses')
      assert.match(error.message, /getCurrentAddress/)
      assert.deepEqual(error.details.closestValues, ['getCurrentAddress'])
      assert.ok(
        error.relatedDocs.includes(
          'https://wallet.gamechanger.finance/doc/api/v2/getCurrentAddress.html'
        )
      )
    }
  )
)

tests.push(
  run('validate.file rejects JSONC comments and trailing commas', async () => {
    const withComment = await validateReport(
      `{"encoding":"gzip" // no comments
}`,
      {
        useSchema: smallValidationSchema
      }
    )
    const withTrailingComma = await validateReport('{"encoding":"gzip",}', {
      useSchema: smallValidationSchema
    })
    assert.equal(withComment.errors[0].code, 'code-syntax-error')
    assert.equal(withTrailingComma.errors[0].code, 'code-syntax-error')
  })
)

tests.push(
  run(
    'validation report includes related docs and value location metadata',
    async () => {
      const report = await validateReport(
        `{
  "type": "getCurrentAddresses"
}`,
        {
          fileName: 'location.gcscript.json'
        }
      )
      const [error] = report.errors
      assert.ok(
        error.relatedDocs.includes(
          'https://wallet.gamechanger.finance/doc/api/v2/getCurrentAddress.html'
        )
      )
      assert.equal(error.location.line, 2)
      assert.equal(error.location.column, 11)
      assert.equal(error.location.length, 21)
    }
  )
)

tests.push(
  run(
    'required additional and type mismatch validation errors are normalized',
    async () => {
      const required = await validateReport('{}', {
        useSchema: smallValidationSchema
      })
      const additional = await validateReport(
        '{"encoding":"gzip","extra":true}',
        {
          useSchema: smallValidationSchema
        }
      )
      const mismatch = await validateReport('{"encoding":"gzip","count":"3"}', {
        useSchema: smallValidationSchema
      })
      assert.equal(required.errors[0].code, 'code-required-property')
      assert.equal(required.errors[0].jsonPath, '/encoding')
      assert.equal(additional.errors[0].code, 'code-additional-property')
      assert.equal(additional.errors[0].details.propertyName, 'extra')
      assert.equal(mismatch.errors[0].code, 'code-type-mismatch')
      assert.equal(mismatch.errors[0].jsonPath, '/count')
    }
  )
)

tests.push(
  run(
    'oneOf anyOf branch noise does not override better const enum diagnostic',
    async () => {
      const oneOfSchema = {
        'api.json': {
          type: 'object',
          required: ['mode'],
          oneOf: [
            { properties: { mode: { const: 'alpha' } } },
            { properties: { mode: { const: 'beta' } } }
          ]
        }
      }
      const report = await validateReport('{"mode":"alpah"}', {
        useSchema: oneOfSchema
      })
      const [error] = report.errors
      assert.equal(error.code, 'code-invalid-const-enum')
      assert.deepEqual(error.details.closestValues, ['alpha'])
      assert.doesNotMatch(
        error.message,
        /one allowed schema|any allowed schema/i
      )
    }
  )
)

tests.push(
  run(
    'compact CLI validation output includes unknown property suggestion',
    async () => {
      const inputFile = path.resolve(
        tmpDir,
        'cli-unknown-property.gcscript.json'
      )
      const reportFile = path.resolve(
        tmpDir,
        'cli-unknown-property-report.json'
      )

      await fs.writeFile(
        inputFile,
        JSON.stringify(
          {
            type: 'script',
            run: {
              sig: {
                type: 'signDataWithAddress',
                adress: 'addr_test1qpzexample',
                dataHex: '00'
              }
            }
          },
          null,
          2
        )
      )

      const result = spawnSync(
        process.execPath,
        ['bin/cli.js', 'validate', '-f', inputFile, '-o', reportFile],
        { cwd: rootDir, encoding: 'utf8' }
      )

      const stderr = stripAnsi(result.stderr)
      assert.notEqual(result.status, 0)
      assert.equal(result.stdout, '')
      assert.match(stderr, /Unknown property:\s*"adress"/)
      assert.match(stderr, /Did you mean:\s*"address"/)
      assert.match(stderr, /\/run\/sig\/adress\s*·\s*line\s+6,\s*col/)

      const report = JSON.parse(await fs.readFile(reportFile, 'utf8'))
      const [error] = report.errors
      assert.equal(error.code, 'code-additional-property')
      assert.equal(error.jsonPath, '/run/sig/adress')
      assert.equal(error.provided, 'adress')
      assert.deepEqual(error.details.closestProperties, ['address'])
    }
  )
)

tests.push(
  run(
    'CLI validation warnings are shown by default and hidden by --hide-warnings',
    async () => {
      const inputFile = path.resolve(tmpDir, 'cli-isl-typo.gcscript.json')
      const reportFile = path.resolve(tmpDir, 'cli-isl-typo-report.json')
      const hiddenReportFile = path.resolve(
        tmpDir,
        'cli-isl-typo-hidden-report.json'
      )

      await fs.writeFile(
        inputFile,
        JSON.stringify(
          {
            type: 'script',
            exportAs: 'islWarningSmoke',
            return: {
              mode: 'last'
            },
            run: {
              value: {
                type: 'macro',
                run: "{sha51('hello')}"
              }
            }
          },
          null,
          2
        ) + '\n'
      )

      const shown = spawnSync(
        process.execPath,
        ['bin/cli.js', 'validate', '-f', inputFile, '-o', reportFile],
        { cwd: rootDir, encoding: 'utf8' }
      )

      assert.equal(shown.status, 0, shown.stderr)
      assert.equal(shown.stdout, '')
      const shownStderr = stripAnsi(shown.stderr)
      assert.match(
        shownStderr,
        /Possible ISL function typo:\s*"sha51"/i,
        shownStderr
      )
      assert.match(
        shownStderr,
        /Replace\s+"sha51"\s+with\s+"sha512"/i,
        shownStderr
      )
      assert.match(
        shownStderr,
        /\/run\/value\/run\s*·\s*line\s+\d+,\s*col\s+\d+/i,
        shownStderr
      )
      assert.match(
        shownStderr,
        /https:\/\/wallet\.gamechanger\.finance\/doc\/api\/v2\/lang\.html/i,
        shownStderr
      )

      const hidden = spawnSync(
        process.execPath,
        [
          'bin/cli.js',
          'validate',
          '-f',
          inputFile,
          '-o',
          hiddenReportFile,
          '--hide-warnings'
        ],
        { cwd: rootDir, encoding: 'utf8' }
      )

      assert.equal(hidden.status, 0, hidden.stderr)
      assert.equal(hidden.stdout, '')
      const hiddenStderr = stripAnsi(hidden.stderr)
      assert.doesNotMatch(
        hiddenStderr,
        /Possible ISL function typo|Replace\s+"sha51"\s+with\s+"sha512"|lang\.html/i,
        hiddenStderr
      )

      const report = JSON.parse(await fs.readFile(reportFile, 'utf8'))
      const hiddenReport = JSON.parse(
        await fs.readFile(hiddenReportFile, 'utf8')
      )

      assert.equal(report.isValid, true)
      assert.ok(report.warnings?.length > 0)
      const warningText = JSON.stringify(report.warnings)
      assert.match(warningText, /sha51/i, warningText)
      assert.match(warningText, /sha512/i, warningText)
      assert.match(warningText, /lang\.html/i, warningText)

      assert.equal(hiddenReport.isValid, true)
      assert.ok(hiddenReport.warnings?.length > 0)
      const hiddenWarningText = JSON.stringify(hiddenReport.warnings)
      assert.match(hiddenWarningText, /sha51/i, hiddenWarningText)
      assert.match(hiddenWarningText, /sha512/i, hiddenWarningText)
    }
  )
)

const { appendValidationTests } = await import(
  pathToFileURL(path.resolve(rootDir, 'test/validation.js')).href
)
appendValidationTests({
  tests,
  run,
  assert,
  fs,
  path,
  rootDir,
  validateReport,
  validationSchemaFull,
  validationSchemaMin,
  gc
})

const main = async () => {
  let failures = 0
  for (const test of tests) {
    try {
      await withTimeout(test.title, test.fn)
      console.info(`✓ ${test.title}`)
    } catch (err) {
      failures += 1
      console.error(`✗ ${test.title}`)
      console.error(err instanceof Error ? err.stack || err.message : err)
    }
  }

  if (failures > 0) {
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err)
  process.exit(1)
})
