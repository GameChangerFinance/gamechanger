import { buildToDataURI, BuildOptions } from '../helpers'

export type BuildFileOptions = BuildOptions

export default async (args: BuildFileOptions) => {
  try {
    return await buildToDataURI(args.input, args)
  } catch (err) {
    if (err instanceof Error) {
      // TODO: preserve BuildError metadata (type/importTrace/path/data) once CLI/report wrappers stop flattening build failures.
      throw new Error('GCScript build failed. ' + err.message)
    }
    throw new Error('GCScript build failed. Unknown error')
  }
}
