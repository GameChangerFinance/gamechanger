//import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
//import typescript from 'rollup-plugin-typescript2'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
//import image from '@rollup/plugin-image'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
//import nodeGlobals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/nodejs.cjs',
    format: 'cjs', //'es'
    name: 'window',
    extend: true,
    inlineDynamicImports: true //Solves: Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
    // globals: {
    //   //'node:path': 'path'
    //   buffer: 'Buffer'
    // }
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
    // image({
    //   include: ['./assets/images/*.png', './assets/images/*.jpg']
    // }),
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
      exclude: ['./src/assets/*', './bin/*'],
      compilerOptions: {
        strict: false,
        target: 'es2022', //'es3', 'es5', 'es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'esnext'
        module: 'es2022',
        moduleResolution: 'node10' //'node10', 'classic', 'node16', 'nodenext', 'bundler'
      }
    }),
    //nodeGlobals(),

    CommonJS({
      // ignoreDynamicRequires: true,
      // dynamicRequireTargets: [
      // ]
      //include: /node_modules/
    }),
    nodeResolve({
      preferBuiltins: true
      // // // //module: false, // <-- this library is not an ES6 module
      // browser: true // <-- suppress node-specific features
    }),
    //CommonJS({ extensions: ['.js', '.ts'] }), // the ".ts" extension is required
    nodePolyfills()

    // terser({
    //   module: true,
    //   format: { comments: false }
    // })
  ]
}
