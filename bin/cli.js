#!/usr/bin/env node
import gc from '../dist/nodejs.cjs'
import meow from 'meow'
import getStdin from 'get-stdin'
import fs from 'fs'
import dataURItoBuffer from 'data-uri-to-buffer'
import path from 'path'
import express from 'express'

export const serveHtml = ({
  indexHtml,
  host = 'localhost',
  port = 3000,
  libPath = 'dist'
}) => {
  const app = express()
  // app.use(express.static(libPath))
  app.use('/dist', express.static(libPath))
  app.get('/', (req, res) => {
    res.send(indexHtml)
  })
  app.listen(port, () =>
    console.log(
      `\n\n🚀 Serving output with the hosted Gamechanger library on http://${host}:${port}\n\n`
    )
  )
}

export default async function main() {
  const { usageMessage, QRRenderTypes } = gc.config

  try {
    process.on('uncaughtException', function (err) {
      console.error('Error: ' + err.message)
      console.error(usageMessage)
    })
    const cli = meow(usageMessage, {
      help: usageMessage,
      autoHelp: true,
      flags: {
        args: {
          type: 'string',
          alias: 'a'
        },
        file: {
          type: 'string',
          alias: 'f'
        },
        stdin: {
          type: 'string',
          alias: 'i'
        },
        outputFile: {
          type: 'string',
          alias: 'o'
        },
        template: {
          type: 'string',
          alias: 't'
        },
        styles: {
          type: 'string',
          alias: 's'
        },
        apiVersion: {
          type: 'string',
          alias: 'v'
        },
        encoding: {
          type: 'string',
          alias: 'e'
        },
        debug: {
          type: 'boolean',
          alias: 'd'
        },
        serve: {
          type: 'boolean',
          alias: 'S'
        }
      }
    })

    const sourcesHandlers = {
      args: () => Promise.resolve(cli.flags.args),
      file: () => {
        const filename = cli.flags.file
        return new Promise((resolve, reject) => {
          if (typeof filename === 'string') {
            fs.readFile(filename, 'utf8', (err, data) => {
              if (err)
                return reject(
                  new Error('Failed to read from stdin.' + err.message)
                )
              return resolve(data.toString())
            })
          } else {
            return reject(new Error('Undefined file'))
          }
        })
      },
      stdin: () => getStdin(),
      outputFile: () => Promise.resolve(cli.flags.outputFile)
    }

    const [network, action, subAction] = cli.input

    const actions = Object.keys(gc)
    if (!actions.includes(action)) {
      throw new Error('Unknown action')
    }
    const subActions = Object.keys(gc[action])
    if (!subActions.includes(subAction)) {
      throw new Error(`Unknown sub action for action '${action}'`)
    }

    const source = cli.flags.args ? 'args' : cli.flags.file ? 'file' : 'stdin'
    const debug = !!cli.flags.debug
    const encoding = cli.flags.encoding
    const apiVersion = cli.flags.apiVersion

    const outputFile = cli.flags.outputFile
    const template = cli.flags.template
    const styles = cli.flags.styles

    const serve = !!cli.flags.serve

    let qrResultType = 'png'
    if (outputFile) {
      const detectedType = QRRenderTypes.find((x) =>
        (outputFile || '').endsWith(`.${x}`)
      )
      if (detectedType) qrResultType = detectedType
    }

    const sourceResolver = sourcesHandlers[source]
    const actionResolver = gc[action][subAction]

    const input = await sourceResolver()
    const output = await actionResolver({
      network: network,
      input,
      encoding,
      apiVersion,
      debug,

      qrResultType,
      outputFile,
      template,
      styles
    })

    if (output) {
      if (output.trim().startsWith('data:')) {
        const dataURI = output
        const parsedDataUri = dataURItoBuffer(dataURI)

        if (outputFile) {
          const filePath = path.resolve(process.cwd(), `./${outputFile}`)
          if (debug)
            console.log(
              `Writing file ${filePath}...${String(
                parsedDataUri?.typeFull || ''
              ).slice(0, 20)}`
            )
          fs.writeFileSync(filePath, parsedDataUri, 'utf8')
        } else {
          process.stdout.write(parsedDataUri)
        }
        if (serve) {
          if (output.trim().startsWith('data:text/html')) {
            const indexHtml = parsedDataUri.toString('utf8')
            serveHtml({ indexHtml })
            // if (indexHtml.trim().startsWith('<!DOCTYPE html>')) {
            //   serveHtml({ indexHtml })
            // }
          }
        }
      } else {
        console.info(output)
      }
    }

    if (debug) {
      console.log(
        JSON.stringify(
          {
            input,
            output,
            params: {
              debug,
              action,
              subAction,
              network,
              encoding,
              apiVersion,
              source,

              outputFile,
              template,
              styles
            }
            //   config: {
            //     networks,
            //     actions,
            //     subActions: { [action]: subActions },
            //     apiVersions,
            //     defaults: {
            //       network: DefaultNetwork,
            //       encodings: DefaultAPIEncodings,
            //       apiVersion: DefaultAPIVersion,
            //       qr: {
            //         template: DefaultQRTemplate,
            //         title: DefaultQRTitle,
            //         subTitle: DefaultQRSubTitle
            //       }
            //     },
            //     apiEncodings,
            //     gcDappConnUrls: GCDappConnUrls,
            //     msgHeaders: EncodingByHeaders
            //   }
          },
          null,
          2
        )
      )
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error: ' + err.message)
      console.error(usageMessage)
    }
    process.exit(1)
  }
}

main()
