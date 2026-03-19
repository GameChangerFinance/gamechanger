import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const exists = async (filepath) => {
  try {
    await fs.access(filepath)
    return true
  } catch {
    return false
  }
}

const parseDataUri = (value) => {
  if (typeof value !== 'string' || !value.startsWith('data:')) {
    throw new Error('Expected a data URI payload')
  }

  const firstComma = value.indexOf(',')
  if (firstComma < 0) throw new Error('Invalid data URI payload')

  const header = value.slice(5, firstComma)
  const payload = value.slice(firstComma + 1)
  const isBase64 = /;base64$/i.test(header)

  return isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
}

const buildExampleOutputs = async ({ gc, input }) => {
  const sharedArgs = {
    apiVersion: '2',
    network: 'mainnet',
    encoding: 'gzip',
    input
  }

  return [
    {
      filename: 'URL.txt',
      value: await gc.encode.url(sharedArgs),
      encoding: 'utf8'
    },
    {
      filename: 'QR.png',
      value: parseDataUri(
        await gc.encode.qr({
          ...sharedArgs,
          qrResultType: 'png'
        })
      )
    },
    {
      filename: 'QR.svg',
      value: parseDataUri(
        await gc.encode.qr({
          ...sharedArgs,
          qrResultType: 'svg'
        })
      )
    },
    {
      filename: 'button.html',
      value: parseDataUri(await gc.snippet.button(sharedArgs))
    },
    {
      filename: 'htmlDapp.html',
      value: parseDataUri(await gc.snippet.html(sharedArgs))
    },
    {
      filename: 'reactDapp.html',
      value: parseDataUri(await gc.snippet.react(sharedArgs))
    },
    {
      filename: 'expressBackend.js',
      value: parseDataUri(await gc.snippet.express(sharedArgs))
    }
  ]
}

export const generateExamplesFromBuild = async ({ distDir, examplesDir }) => {
  const nodeEsmBundle = path.resolve(distDir, 'nodejs.js')
  const nodeCjsBundle = path.resolve(distDir, 'nodejs.cjs')
  const browserBundle = path.resolve(distDir, 'browser.js')
  const browserMinBundle = path.resolve(distDir, 'browser.min.js')
  const connectScriptFile = path.resolve(examplesDir, 'connect.gcscript')

  const isReady = await Promise.all([
    exists(nodeEsmBundle),
    exists(nodeCjsBundle),
    exists(browserBundle),
    exists(browserMinBundle),
    exists(connectScriptFile)
  ])

  if (isReady.includes(false)) return false

  const gc = await import(pathToFileURL(nodeEsmBundle).href).then(
    (mod) => mod.default || mod.gc || mod
  )
  const input = await fs.readFile(connectScriptFile, 'utf8')
  const outputs = await buildExampleOutputs({ gc, input })

  for (const output of outputs) {
    await fs.writeFile(
      path.resolve(examplesDir, output.filename),
      output.value,
      output.encoding
    )
  }

  return true
}
