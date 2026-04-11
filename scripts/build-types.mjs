import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const entryTypesFile = path.resolve(distDir, 'index.d.ts')

const text = `import handlersModule from './handlers'
import encodingsModule from './encodings'
import utilsModule from './utils/exported'
import configModule from './config/exported'

type Handlers = typeof handlersModule
type Encodings = typeof encodingsModule
type Utils = typeof utilsModule
type Config = typeof configModule

declare const gc: {
  encode: Handlers['encode']
  snippet: Handlers['snippet']
  encodings: Encodings
  utils: Utils
  config: Config
}

export declare const encode: Handlers['encode']
export declare const snippet: Handlers['snippet']
export declare const utils: Utils
export declare const config: Config
export { encodingsModule as encodings, gc }
export * from './types'
export default gc
`

await fs.mkdir(distDir, { recursive: true })
await fs.writeFile(entryTypesFile, text, 'utf8')
