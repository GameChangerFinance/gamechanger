import { createRollupConfig } from './rollup.shared.config.mjs'

export default createRollupConfig({
  browser: true,
  minify: true,
  outputFile: 'dist/browser.min.js',
  format: 'iife'
})
