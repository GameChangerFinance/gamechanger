import 'lzma/src/lzma_worker.js'
//import 'node-self' //TODO : use this one for useGlobal?

export default () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const useGlobal = isNode ? global : window
  const { LZMA /*, LZMA_WORKER*/ } = <any>useGlobal || {}
  //console.log({ LZMA_WORKER, LZMA })
  return LZMA
}
