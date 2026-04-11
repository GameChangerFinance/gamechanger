#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { createCanvas, Image } from '@napi-rs/canvas'
import gc from '../dist/nodejs.cjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gc-tests-'))
const exampleScript = await fs.readFile(
  path.resolve(rootDir, 'examples/connect.gcscript'),
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

const execNode = (args, options = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${[process.execPath, ...args].join(' ')}`,
        result.stdout,
        result.stderr
      ]
        .filter(Boolean)
        .join('\n')
    )
  }
  return result
}

const readFileIfExists = async (filePath) => {
  try {
    return await fs.readFile(filePath)
  } catch {
    return undefined
  }
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
      assert.equal(typeof mod.encodings.gzip.encoder, 'function')
      assert.equal(typeof mod.gc.encode.qr, 'function')
    }
  )
)

tests.push(
  run('package self import works', async () => {
    const result = execNode([
      '--input-type=module',
      '-e',
      "import('@gamechanger-finance/gc').then(({default: gc, encode})=>{console.log(typeof gc.encode.url + ':' + typeof encode.url)})"
    ])
    assert.match(result.stdout.trim(), /^function:function$/)
  })
)

tests.push(
  run('package self require works', async () => {
    const result = execNode([
      '-e',
      "const gc=require('@gamechanger-finance/gc'); console.log(typeof gc.encode.url + ':' + typeof gc.snippet.html + ':' + typeof gc.snippet['html-zero'])"
    ])
    assert.match(result.stdout.trim(), /^function:function:function$/)
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
