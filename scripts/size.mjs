import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.resolve(__dirname, '../dist/browser.min.js')

try {
  const contents = await fs.readFile(filePath)
  const gzipped = zlib.gzipSync(contents)
  console.info(`dist/browser.min.js: ${contents.length} bytes`)
  console.info(`dist/browser.min.js.gz: ${gzipped.length} bytes`)
} catch (err) {
  console.error(
    `Unable to measure bundle size. ${
      err instanceof Error ? err.message : String(err)
    }`
  )
  process.exit(1)
}
