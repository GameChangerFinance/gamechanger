import typescript from '@rollup/plugin-typescript'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/nodejs.cjs',
    format: 'cjs',
    name: 'gc',
    exports: 'default',
    extend: true,
    inlineDynamicImports: true //Solves: Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
  },
  external: [
    'canvas-prebuilt',
    'canvas',
    'jsdom/lib/jsdom/utils',
    'jsdom/lib/jsdom/living/generated/utils',
    'jsdom',
    'xmldom'
  ],
  plugins: [
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
      sourceMap: true,
      tsconfig: './tsconfig.json',
      exclude: ['./src/assets/*', './bin/*']
    }),
    CommonJS({}),
    nodeResolve({
      preferBuiltins: true
    }),
    nodePolyfills()
  ]
}
