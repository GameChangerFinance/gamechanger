import typescript from '@rollup/plugin-typescript'
import CommonJS from '@rollup/plugin-commonjs'
import filesAsDataURIs from '@rollup/plugin-url'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

const createEasyQRCodeAliasPlugin = (variant) => ({
  name: `gc-easyqrcodejs-${variant}-alias`,
  async resolveId(source, importer) {
    if (
      !source ||
      source === 'easyqrcodejs' ||
      !/(^|\/)easyqrcodejs$/.test(source)
    ) {
      return null
    }

    const nextSource = source.replace(
      /easyqrcodejs$/,
      `easyqrcodejs.${variant}`
    )

    const resolved = await this.resolve(nextSource, importer, {
      skipSelf: true
    })

    return resolved || nextSource
  }
})

const createPlugins = ({ browser, minify = false }) =>
  [
    browser ? nodePolyfills() : null,
    json(),
    filesAsDataURIs({
      include: [
        './src/assets/images/*.png',
        './src/assets/images/*.jpg',
        './src/assets/images/*.svg'
      ]
    }),
    createEasyQRCodeAliasPlugin(browser ? 'browser' : 'node'),
    typescript({
      sourceMap: true,
      tsconfig: './tsconfig.json',
      exclude: ['./src/assets/*', './bin/*']
    }),
    nodeResolve({
      browser,
      preferBuiltins: !browser
    }),
    CommonJS(
      browser
        ? {
            include: ['./node_modules/**/*.js'],
            dynamicRequireTargets: ['./node_modules/**/*.js']
          }
        : {}
    ),
    minify
      ? terser({
          module: true,
          format: { comments: false }
        })
      : null
  ].filter(Boolean)

export const createRollupConfig = ({
  browser,
  minify = false,
  outputFile,
  format
}) => ({
  input: 'src/runtime-entry.ts',
  output: {
    file: outputFile,
    format,
    name: 'gc',
    exports: 'default',
    extend: true,
    inlineDynamicImports: true,
    sourcemap: true
  },
  external: browser ? [] : ['jsdom', 'xmldom'],
  plugins: createPlugins({ browser, minify })
})
