import { validateToDataURI, type ValidateOptions } from './helpers'

export type ValidateFileOptions = ValidateOptions

export default async (args: ValidateFileOptions) => {
  try {
    return await validateToDataURI(args.input, args)
  } catch (err) {
    if (err instanceof Error) {
      throw new Error('GCScript file validation failed. ' + err.message)
    }
    throw new Error('GCScript file validation failed. Unknown error')
  }
}
