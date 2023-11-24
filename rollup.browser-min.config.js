import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

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
    nodePolyfills(),
    json(),
    filesAsDataURIs({
      include: [
        './src/assets/images/*.png',
        './src/assets/images/*.jpg',
        './src/assets/images/*.svg',
        './src/assets/fonts/*.ttf'
      ]
    }),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: [
        './src/assets/*',
        './bin/*',
        './node_modules/easyqrcodejs-nodejs/*'
      ]
    }),
    nodeResolve({
      browser: true // <-- suppress node-specific features
    }),
    CommonJS({
      exclude: ['./node_modules/easyqrcodejs-nodejs/*'],
      strictRequires: 'debug',
      transformMixedEsModules: true
    }),
    terser({
      module: true,
      format: { comments: false }
    })
  ]
}
