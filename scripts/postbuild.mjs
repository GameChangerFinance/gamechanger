import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateExamplesFromBuild } from './generate-examples.mjs'
import { renderUsageHelp } from '../bin/cli-usage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const examplesDir = path.resolve(rootDir, 'examples')
const examplesDistDir = path.resolve(examplesDir, 'res')
const browserBundle = path.resolve(distDir, 'browser.js')
const browserMinBundle = path.resolve(distDir, 'browser.min.js')
const nodeCjsBundle = path.resolve(distDir, 'nodejs.cjs')
const nodeEsmBundle = path.resolve(distDir, 'nodejs.js')
const srcNodeQrRuntime = path.resolve(
  rootDir,
  'src/modules/easyqrcodejs-node.cjs'
)
const srcCanvas2Svg = path.resolve(rootDir, 'src/modules/canvas2svg.cjs')
const distNodeQrRuntime = path.resolve(distDir, 'easyqrcodejs-node.cjs')
const distCanvas2Svg = path.resolve(distDir, 'canvas2svg.cjs')

const readmeFile = path.resolve(rootDir, 'README.md')

const ensureDist = async () => {
  await fs.mkdir(distDir, { recursive: true })
}

const ensureExamplesDist = async () => {
  await fs.mkdir(examplesDistDir, { recursive: true })
}

const writeNodeEsmWrapper = async () => {
  try {
    await fs.access(nodeCjsBundle)
  } catch {
    return
  }

  const text = `import gc from './nodejs.cjs'

export const {
  encode,
  snippet,
  build,
  validate,
  encodings,
  utils,
  config,
} = gc
export { gc }
export default gc
`

  await fs.writeFile(nodeEsmBundle, text, 'utf8')
}

const ensureBrowserFacade = async () => {
  try {
    await fs.access(browserBundle)
  } catch {
    return
  }

  const source = await fs.readFile(browserBundle, 'utf8')
  if (!source.includes('./browser.runtime.js')) {
    await fs.rename(browserBundle, path.resolve(distDir, 'browser.runtime.js'))
    await fs.writeFile(
      browserBundle,
      `import gc from './browser.runtime.js'

export const {
  encode,
  snippet,
  build,
  validate,
  encodings,
  utils,
  config,
} = gc
export { gc }
export default gc
`,
      'utf8'
    )
  }
}

const copyNodeQrRuntimeFiles = async () => {
  for (const [from, to] of [
    [srcNodeQrRuntime, distNodeQrRuntime],
    [srcCanvas2Svg, distCanvas2Svg]
  ]) {
    try {
      await fs.copyFile(from, to)
    } catch {
      // ignore
    }
  }
}

const removeUnusedTypeArtifacts = async () => {
  for (const filePath of [path.resolve(distDir, 'runtime-entry.d.ts')]) {
    try {
      await fs.rm(filePath, { force: true })
    } catch {
      // ignore
    }
  }
}

const removeSourceMapArtifacts = async () => {
  const entries = await fs
    .readdir(distDir, { withFileTypes: true })
    .catch(() => [])
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.map')) continue
    await fs.rm(path.resolve(distDir, entry.name), { force: true })
  }
}

const refreshReadmeCliUsage = async () => {
  let readme
  try {
    readme = await fs.readFile(readmeFile, 'utf8')
  } catch {
    return
  }

  const headingIndex = readme.indexOf('## CLI Usage')
  if (headingIndex < 0) return

  const fenceStart = readme.indexOf('```', headingIndex)
  if (fenceStart < 0) return

  const lineEnd = readme.indexOf('\n', fenceStart)
  if (lineEnd < 0) return

  const fenceEnd = readme.indexOf('```', lineEnd + 1)
  if (fenceEnd < 0) return

  const usageText = renderUsageHelp()
  const next = `${readme.slice(0, lineEnd + 1)}${usageText}\n${readme.slice(
    fenceEnd
  )}`

  if (next !== readme) await fs.writeFile(readmeFile, next, 'utf8')
}

const removeDanglingLegacyArtifacts = async () => {
  for (const filename of ['easy.qrcode.min.js', 'json-url-single.js']) {
    try {
      await fs.rm(path.resolve(distDir, filename), { force: true })
    } catch {
      // ignore
    }
  }
}

const copyDir = async (fromDir, toDir) => {
  await fs.rm(toDir, { recursive: true, force: true })
  await fs.mkdir(toDir, { recursive: true })

  const entries = await fs.readdir(fromDir, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.resolve(fromDir, entry.name)
    const to = path.resolve(toDir, entry.name)
    if (entry.isDirectory()) await copyDir(from, to)
    else if (entry.isFile()) await fs.copyFile(from, to)
  }
}

await ensureDist()
await ensureExamplesDist()
await writeNodeEsmWrapper()
await ensureBrowserFacade()
await copyNodeQrRuntimeFiles()
await removeUnusedTypeArtifacts()
await removeSourceMapArtifacts()
await removeDanglingLegacyArtifacts()
await refreshReadmeCliUsage()
await copyDir(distDir, examplesDistDir)
await generateExamplesFromBuild({
  distDir,
  examplesDir
})

try {
  await fs.access(browserMinBundle)
} catch {
  // ignore
}
