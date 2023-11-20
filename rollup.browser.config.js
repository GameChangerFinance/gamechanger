// import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
//import typescript from 'rollup-plugin-typescript2'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
//import image from '@rollup/plugin-image'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
//import nodeGlobals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'
//import path from 'path'
//import { babel } from '@rollup/plugin-babel';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/browser.js',
    format: 'es',
    name: 'window',
    extend: true,
    inlineDynamicImports: true //Solves: Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
    // globals: {
    //   //'node:path': 'path'
    //   buffer: 'Buffer'
    // }
  },
  plugins: [
    // image({
    //   include: ['./assets/images/*.png', './assets/images/*.jpg']
    // }),
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
      sourceMap: true,
      // declaration: true,
      // declarationMap: true,
      // declarationDir: 'dist',
      // composite: true,
      tsconfig: './tsconfig.json',
      exclude: [
        './src/assets/*',
        './bin/*'
        //'./node_modules/easyqrcodejs-nodejs/*'
      ]
      // compilerOptions: {
      //   strict: false,
      //   target: 'es2022', //'es3', 'es5', 'es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'esnext'
      //   module: 'es2022',
      //   moduleResolution: 'node10' //'node10', 'classic', 'node16', 'nodenext', 'bundler'
      // }
    }),
    //nodeGlobals(),

    nodeResolve({
      // preferBuiltins: true,
      //module: true, // <-- this library is not an ES6 module
      browser: true // <-- suppress node-specific features
    }),
    //CommonJS({ extensions: ['.js', '.ts'] }), // the ".ts" extension is required
    CommonJS({
      include: [
        './node_modules/**/*.js'
        // './node_modules/easyqrcodejs/dist/easy.qrcode.min.js',
        // './node_modules/json-url/dist/node/browser-index.js',
        // './node_modules/json-stringify-safe/stringify.js'
      ],
      // exclude: ['./node_modules/easyqrcodejs-nodejs/**/*.js'],
      dynamicRequireTargets: [
        './node_modules/**/*.js'
        // './node_modules/easyqrcodejs/dist/easy.qrcode.min.js',
        // './node_modules/json-url/dist/node/browser-index.js',
        // './node_modules/json-stringify-safe/stringify.js'
      ]
      // strictRequires: 'debug',
      // transformMixedEsModules: true

      // exclude: ['./node_modules/easyqrcodejs-nodejs/*'],
      // esmExternals: true,
      // //transformMixedEsModules: true,
      // //ignoreDynamicRequires: true,
      // //requireReturnsDefault: true,

      // // dynamicRequireTargets: [
      // //   //path.resolve('./node_modules/easyqrcodejs/dist/easy.qrcode.min.js'),
      // //   //path.resolve('./node_modules/json-url/dist/node/browser-index.js')
      // //   //'./node_modules/json-url/dist/node/browser-index.js'
      // //   //'./node_modules/easyqrcodejs/src/easy.qrcode.js',
      // //   //'./node_modules/easyqrcodejs/dist/easy.qrcode.min.js'
      // // ]
    })
    //babel({ babelHelpers: 'bundled' }),
    // terser({
    //   module: true,
    //   format: { comments: false }
    // })
  ]
}

// './node_modules/easyqrcodejs/'
// "exclude": [
//   "./node_modules/easyqrcodejs/*",
//   "./node_modules/easyqrcodejs/dist/easy.qrcode.min.js"
// ]
