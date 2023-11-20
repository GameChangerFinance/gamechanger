import { Buffer } from 'buffer'

/**
 * Based on urlsafe-base64, on version:
 */

const version = '1.0.0'

/**
 * .encode
 *
 * return an encoded Buffer as URL Safe Base64
 *
 * Note: This function encodes to the RFC 4648 Spec where '+' is encoded
 *       as '-' and '/' is encoded as '_'. The padding character '=' is
 *       removed.
 *
 * @param {Buffer} buffer
 * @return {String}
 * @api public
 */

function encode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, '') // Remove ending '='
}

/**
 * .decode
 *
 * return an decoded URL Safe Base64 as Buffer
 *
 * @param {String}
 * @return {Buffer}
 * @api public
 */

function decode(base64: string) {
  // Add removed at end '='
  base64 += Array(5 - (base64.length % 4)).join('=')

  base64 = base64
    .replace(/\-/g, '+') // Convert '-' to '+'
    .replace(/\_/g, '/') // Convert '_' to '/'

  return new Buffer(base64, 'base64')
}

/**
 * .validate
 *
 * Validates a string if it is URL Safe Base64 encoded.
 *
 * @param {String}
 * @return {Boolean}
 * @api public
 */

function validate(base64) {
  return /^[A-Za-z0-9\-_]+$/.test(base64)
}

export { version, encode, decode, validate }
