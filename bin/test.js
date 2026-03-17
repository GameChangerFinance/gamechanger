#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
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

const withTimeout = async (title, fn, timeoutMs = 15000) => {
  let timeoutId
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms: ${title}`))
        }, timeoutMs)
        timeoutId.unref?.()
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

tests.push(
  run('dist/nodejs.cjs can be required', async () => {
    assert.equal(typeof gc.encode.url, 'function')
    assert.equal(typeof gc.encode.qr, 'function')
    assert.equal(typeof gc.snippet.html, 'function')
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
      "const gc=require('@gamechanger-finance/gc'); console.log(typeof gc.encode.url + ':' + typeof gc.snippet.html)"
    ])
    assert.match(result.stdout.trim(), /^function:function$/)
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
  })
)

tests.push(
  run('node library encode.qr returns PNG and SVG data', async () => {
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
    assert.ok(isPng(decodeDataUri(png)))
    assert.ok(isSvg(decodeDataUri(svg)))
  })
)

tests.push(
  run(
    'browser-like QR generation works fully from Node using the minified browser build',
    async () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
      })
      dom.window.process = undefined
      dom.window.CanvasRenderingContext2D = function () {}
      const script = await fs.readFile(
        path.resolve(rootDir, 'dist/browser.min.js'),
        'utf8'
      )
      vm.runInContext(script, dom.getInternalVMContext())
      const svg = await dom.window.gc.encode.qr({
        input: exampleScript,
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        qrResultType: 'svg',
        styles: JSON.stringify({ drawer: 'svg' })
      })
      assert.ok(isSvg(decodeDataUri(svg)))
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
  run('CLI snippet outputs can be written to files', async () => {
    const buttonFile = path.resolve(tmpDir, 'button.html')
    const htmlFile = path.resolve(tmpDir, 'snippet.html')
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
      /dist\/browser\.min\.js/
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

  await readFileIfExists(tmpDir)

  if (failures > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err)
  process.exit(1)
})
