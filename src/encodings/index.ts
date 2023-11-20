import gzipEncoding from './gzip'
import jsonUrlLzmaEncoding from './json-url-lzma'
import jsonUrlLzwEncoding from './json-url-lzw'
import base64Encoding from './base64url'
import msgEncoding from './msg'
import urlEncoding from './url'
import qrEncoding from './qr'

export const baseEncodings = {
  gzip: gzipEncoding,
  'json-url-lzma': jsonUrlLzmaEncoding,
  'json-url-lzw': jsonUrlLzwEncoding,
  base64url: base64Encoding
}

export default {
  ...baseEncodings,
  msg: msgEncoding,
  url: urlEncoding,
  qr: qrEncoding
}
