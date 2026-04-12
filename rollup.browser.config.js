import { createRollupConfig } from './rollup.shared.config.mjs'

export default createRollupConfig({
  browser: true,
  outputFile: 'dist/browser.js',
  format: 'es'
})
