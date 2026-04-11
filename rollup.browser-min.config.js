import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

const targetModuleAlias = (replacement) => ({
  name: 'target-module-alias',
  resolveId(source, importer) {
    if (!importer || source !== './easyqrcodejs.browser') return null
    return replacement
  }
})

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/browser.min.js',
    format: 'iife',
    name: 'gc',
    exports: 'default',
    extend: true,
    inlineDynamicImports: true //Solves: Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
  },
  plugins: [
    targetModuleAlias(
      new URL('./src/modules/easyqrcodejs.browser.ts', import.meta.url).pathname
    ),
    nodePolyfills(),
    json(),
    filesAsDataURIs({
      include: [
        './src/assets/images/*.png',
        './src/assets/images/*.jpg',
        './src/assets/images/*.svg'
      ]
    }),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['./src/assets/*', './bin/*']
    }),
    nodeResolve({
      browser: true // <-- suppress node-specific features
    }),
    CommonJS({
      strictRequires: 'debug',
      transformMixedEsModules: true
    }),
    terser({
      module: true,
      format: { comments: false }
    })
  ]
}
