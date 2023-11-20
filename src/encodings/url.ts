import { APIEncoding, EncodingHandler } from '../types'
import message from './msg'
import template from 'string-placeholder'

const encoder = async (
  obj: any,
  options: {
    urlPattern?: string
    msgPlaceholder?: string
    encodingOptions?: any
    encoding?: APIEncoding
  }
) => {
  //const template = require('string-placeholder');
  //const template = await import('string-placeholder').then((d) => d.exports)

  const useUrlPattern = options?.urlPattern || ''
  const useMsgPlaceholder = options?.msgPlaceholder || 'gcscript'
  if (!useUrlPattern) throw new Error('Missing URL pattern')
  if (!useMsgPlaceholder)
    throw new Error('Missing message placeholder for URL pattern')

  //console.log({ message })
  const msg = await message.encoder(obj, {
    encoding: options?.encoding,
    encodingOptions: options?.encodingOptions
  })
  //console.log({ msg })

  const parsedUrl = new URL(useUrlPattern)
  if (!parsedUrl || !parsedUrl.origin || !parsedUrl.host)
    throw new Error('Invalid URL pattern provided')

  const templateContext = {
    [useMsgPlaceholder]: msg
    //date:moment().toISOString(),
  }

  //naive templating, risking an origin override attack (*)
  const solvedURL: string = template(useUrlPattern, templateContext, {
    before: '{',
    after: '}'
  })
  const parsedSolvedURL = new URL(solvedURL)
  if (!parsedSolvedURL)
    //if dont pass URL validation check
    throw new Error(
      'Failed to construct a valid URL with provided pattern and message'
    )
  if (!solvedURL.startsWith(parsedSolvedURL.origin))
    //(*) check if origin was overrided by a templating attack
    throw new Error('Illegal template provided. URL origin cannot be replaced.')

  const wasTemplateUsed = useUrlPattern !== solvedURL
  if (!wasTemplateUsed)
    throw new Error(
      'Message was not embedded on URL. Invalid template or message placeholder provided'
    )

  return parsedSolvedURL.toString() //finally we construct the URL from the parsed version to ensure it's valid
}

const decoder = async (
  msg: string,
  options: {
    urlPattern?: string
    msgPlaceholder?: string
    encodingOptions?: any
    encoding?: APIEncoding
  }
) => {
  //const template = await import('string-placeholder').then((d) => d.exports)
  const useUrlPattern = options?.urlPattern || ''
  const useMsgPlaceholder = options?.msgPlaceholder || 'result'
  if (!msg) throw new Error('Missing message')
  if (!useUrlPattern) throw new Error('Missing URL pattern')
  if (!useMsgPlaceholder)
    throw new Error('Missing message placeholder for URL pattern')

  const dummySeparator = '>@<'
  const dummyContext = { [useMsgPlaceholder]: dummySeparator } //Dummy context with a temp separator. Will replace the message placeholders for the separator
  const layout = template(useUrlPattern, dummyContext, {
    before: '{',
    after: '}'
  })
  const extraParts = layout
    .split(encodeURI(dummySeparator))
    .filter((x) => !!x.trim()) //remove empty strings (and whitespace but makes no sense)
  let tempMsg = `${msg}`
  extraParts.forEach((extraPart) => {
    tempMsg = tempMsg.replace(extraPart, dummySeparator)
  })
  const foundMessages = extraParts
    .split(dummySeparator)
    .filter((x) => !!x.trim()) //remove empty strings (and whitespace but makes no sense)

  if (foundMessages.length <= 0)
    throw new Error(
      'Not messages found with the provided URL pattern and message placeholder'
    )
  if (foundMessages.length > 1)
    throw new Error(
      'More than one message found with the provided URL pattern and message placeholder'
    )
  const useMsg: string = foundMessages[0]
  if (!useMsg)
    throw new Error(
      'Empty message found with the provided URL pattern and message placeholder'
    )

  const obj = await message.decoder(useMsg, {
    encoding: options?.encoding,
    encodingOptions: options?.encodingOptions
  })

  return obj
}

const handler: EncodingHandler = {
  name: 'GameChanger Wallet URL transport. Used as dapp connector to send and receive messages through URLs',
  encoder,
  decoder
}

export default handler
