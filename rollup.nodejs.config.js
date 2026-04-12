import { createRollupConfig } from './rollup.shared.config.mjs'

export default createRollupConfig({
  browser: false,
  outputFile: 'dist/nodejs.cjs',
  format: 'cjs'
})
