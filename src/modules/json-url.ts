class JSONURLDeprecationError extends Error {
  code: string
  name: string

  constructor() {
    super('json-url is deprecated and is intentionally disabled')
    this.name = 'DeprecationError'
    this.code = 'ERR_DEPRECATED'
  }
}

export default () => {
  throw new JSONURLDeprecationError()
  // return import('json-url').then((jsonUrlLib) => {
  //   return jsonUrlLib.default
  // })
}

// export default () => {
//   const isNode = typeof process === 'object' && typeof window !== 'object'
//   const pathStr = isNode ? 'json-url' : '../../dist/json-url-single.js'
//   //const useGlobal = isNode ? global : window;
//   //WORKS: 'https://cdn.jsdelivr.net/npm/json-url@3.1.0/dist/browser/json-url-single.min.js' //'json-url/dist/browser/json-url-single.js'
//   return import(pathStr).then((jsonUrlLib) => {
//     //console.log({ jsonUrlLib, browser: window?.JsonUrl })
//     if (!isNode) return (<any>window).JsonUrl
//     return jsonUrlLib.default
//   })
// }
