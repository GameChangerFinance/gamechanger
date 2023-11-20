function _mergeNamespaces(n, m) {
  m.forEach(function (e) {
    e &&
      typeof e !== 'string' &&
      !Array.isArray(e) &&
      Object.keys(e).forEach(function (k) {
        if (k !== 'default' && !(k in n)) {
          var d = Object.getOwnPropertyDescriptor(e, k)
          Object.defineProperty(
            n,
            k,
            d.get
              ? d
              : {
                  enumerable: true,
                  get: function () {
                    return e[k]
                  }
                }
          )
        }
      })
  })
  return Object.freeze(n)
}

var global$1 =
  typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
    ? window
    : {}

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array
var inited = false
function init() {
  inited = true
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

function toByteArray(b64) {
  if (!inited) {
    init()
  }
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr((len * 3) / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xff
    arr[L++] = (tmp >> 8) & 0xff
    arr[L++] = tmp & 0xff
  }

  if (placeHolders === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xff
  } else if (placeHolders === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xff
    arr[L++] = tmp & 0xff
  }

  return arr
}

function tripletToBase64(num) {
  return (
    lookup[(num >> 18) & 0x3f] +
    lookup[(num >> 12) & 0x3f] +
    lookup[(num >> 6) & 0x3f] +
    lookup[num & 0x3f]
  )
}

function encodeChunk(uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2]
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray(uint8) {
  if (!inited) {
    init()
  }
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(
      encodeChunk(
        uint8,
        i,
        i + maxChunkLength > len2 ? len2 : i + maxChunkLength
      )
    )
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3f]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3f]
    output += lookup[(tmp << 2) & 0x3f]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? nBytes - 1 : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << -nBits) - 1)
  s >>= -nBits
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << -nBits) - 1)
  e >>= -nBits
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0
  var i = isLE ? 0 : nBytes - 1
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (
    ;
    mLen >= 8;
    buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8
  ) {}

  e = (e << mLen) | m
  eLen += mLen
  for (
    ;
    eLen > 0;
    buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8
  ) {}

  buffer[offset + i - d] |= s * 128
}

var toString$2 = {}.toString

var isArray =
  Array.isArray ||
  function (arr) {
    return toString$2.call(arr) == '[object Array]'
  }

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer$1.TYPED_ARRAY_SUPPORT =
  global$1.TYPED_ARRAY_SUPPORT !== undefined
    ? global$1.TYPED_ARRAY_SUPPORT
    : true

/*
 * Export kMaxLength after typed array support is determined.
 */
kMaxLength()

function kMaxLength() {
  return Buffer$1.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff
}

function createBuffer(that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer$1.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer$1(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer$1(arg, encodingOrOffset, length) {
  if (!Buffer$1.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$1)) {
    return new Buffer$1(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer$1.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer$1._augment = function (arr) {
  arr.__proto__ = Buffer$1.prototype
  return arr
}

function from(that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer$1.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer$1.TYPED_ARRAY_SUPPORT) {
  Buffer$1.prototype.__proto__ = Uint8Array.prototype
  Buffer$1.__proto__ = Uint8Array
  if (
    typeof Symbol !== 'undefined' &&
    Symbol.species &&
    Buffer$1[Symbol.species] === Buffer$1
  );
}

function assertSize(size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc(that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer$1.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe(that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer$1.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer$1.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer$1.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString(that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer$1.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike(that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer(that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError("'offset' is out of bounds")
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError("'length' is out of bounds")
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer$1.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject(that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if (
      (typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) ||
      'length' in obj
    ) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError(
    'First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.'
  )
}

function checked(length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError(
      'Attempt to allocate Buffer larger than maximum ' +
        'size: 0x' +
        kMaxLength().toString(16) +
        ' bytes'
    )
  }
  return length | 0
}
Buffer$1.isBuffer = isBuffer
function internalIsBuffer(b) {
  return !!(b != null && b._isBuffer)
}

Buffer$1.compare = function compare(a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer$1.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer$1.concat = function concat(list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer$1.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer$1.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength(string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (
    typeof ArrayBuffer !== 'undefined' &&
    typeof ArrayBuffer.isView === 'function' &&
    (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)
  ) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer$1.byteLength = byteLength

function slowToString(encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer$1.prototype._isBuffer = true

function swap(b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer$1.prototype.swap16 = function swap16() {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer$1.prototype.swap32 = function swap32() {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer$1.prototype.swap64 = function swap64() {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer$1.prototype.toString = function toString() {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer$1.prototype.equals = function equals(b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer$1.compare(this, b) === 0
}

Buffer$1.prototype.inspect = function inspect() {
  var str = ''
  var max = INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer$1.prototype.compare = function compare(
  target,
  start,
  end,
  thisStart,
  thisEnd
) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (
    start < 0 ||
    end > target.length ||
    thisStart < 0 ||
    thisEnd > this.length
  ) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : buffer.length - 1
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer$1.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xff // Search for a byte value [0-255]
    if (
      Buffer$1.TYPED_ARRAY_SUPPORT &&
      typeof Uint8Array.prototype.indexOf === 'function'
    ) {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (
      encoding === 'ucs2' ||
      encoding === 'ucs-2' ||
      encoding === 'utf16le' ||
      encoding === 'utf-16le'
    ) {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read(buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer$1.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer$1.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer$1.prototype.lastIndexOf = function lastIndexOf(
  val,
  byteOffset,
  encoding
) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write(buf, string, offset, length) {
  return blitBuffer(
    utf8ToBytes(string, buf.length - offset),
    buf,
    offset,
    length
  )
}

function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write(buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write(buf, string, offset, length) {
  return blitBuffer(
    utf16leToBytes(string, buf.length - offset),
    buf,
    offset,
    length
  )
}

Buffer$1.prototype.write = function write(string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
    // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
    // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
    // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if (
    (string.length > 0 && (length < 0 || offset < 0)) ||
    offset > this.length
  ) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer$1.prototype.toJSON = function toJSON() {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence =
      firstByte > 0xef ? 4 : firstByte > 0xdf ? 3 : firstByte > 0xbf ? 2 : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xc0) === 0x80) {
            tempCodePoint = ((firstByte & 0x1f) << 0x6) | (secondByte & 0x3f)
            if (tempCodePoint > 0x7f) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80) {
            tempCodePoint =
              ((firstByte & 0xf) << 0xc) |
              ((secondByte & 0x3f) << 0x6) |
              (thirdByte & 0x3f)
            if (
              tempCodePoint > 0x7ff &&
              (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)
            ) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if (
            (secondByte & 0xc0) === 0x80 &&
            (thirdByte & 0xc0) === 0x80 &&
            (fourthByte & 0xc0) === 0x80
          ) {
            tempCodePoint =
              ((firstByte & 0xf) << 0x12) |
              ((secondByte & 0x3f) << 0xc) |
              ((thirdByte & 0x3f) << 0x6) |
              (fourthByte & 0x3f)
            if (tempCodePoint > 0xffff && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xfffd
      bytesPerSequence = 1
    } else if (codePoint > 0xffff) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(((codePoint >>> 10) & 0x3ff) | 0xd800)
      codePoint = 0xdc00 | (codePoint & 0x3ff)
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray(codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, (i += MAX_ARGUMENTS_LENGTH))
    )
  }
  return res
}

function asciiSlice(buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7f)
  }
  return ret
}

function latin1Slice(buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice(buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice(buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer$1.prototype.slice = function slice(start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer$1.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer$1(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer$1.prototype.readUIntLE = function readUIntLE(
  offset,
  byteLength,
  noAssert
) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer$1.prototype.readUIntBE = function readUIntBE(
  offset,
  byteLength,
  noAssert
) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer$1.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer$1.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer$1.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer$1.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (
    (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) +
    this[offset + 3] * 0x1000000
  )
}

Buffer$1.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (
    this[offset] * 0x1000000 +
    ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3])
  )
}

Buffer$1.prototype.readIntLE = function readIntLE(
  offset,
  byteLength,
  noAssert
) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer$1.prototype.readIntBE = function readIntBE(
  offset,
  byteLength,
  noAssert
) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer$1.prototype.readInt8 = function readInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return this[offset]
  return (0xff - this[offset] + 1) * -1
}

Buffer$1.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return val & 0x8000 ? val | 0xffff0000 : val
}

Buffer$1.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return val & 0x8000 ? val | 0xffff0000 : val
}

Buffer$1.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (
    this[offset] |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
  )
}

Buffer$1.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (
    (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3]
  )
}

Buffer$1.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return read(this, offset, true, 23, 4)
}

Buffer$1.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return read(this, offset, false, 23, 4)
}

Buffer$1.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return read(this, offset, true, 52, 8)
}

Buffer$1.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return read(this, offset, false, 52, 8)
}

function checkInt(buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf))
    throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min)
    throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer$1.prototype.writeUIntLE = function writeUIntLE(
  value,
  offset,
  byteLength,
  noAssert
) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xff
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xff
  }

  return offset + byteLength
}

Buffer$1.prototype.writeUIntBE = function writeUIntBE(
  value,
  offset,
  byteLength,
  noAssert
) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xff
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xff
  }

  return offset + byteLength
}

Buffer$1.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value & 0xff
  return offset + 1
}

function objectWriteUInt16(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] =
      (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      ((littleEndian ? i : 1 - i) * 8)
  }
}

Buffer$1.prototype.writeUInt16LE = function writeUInt16LE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff
    this[offset + 1] = value >>> 8
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer$1.prototype.writeUInt16BE = function writeUInt16BE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8
    this[offset + 1] = value & 0xff
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> ((littleEndian ? i : 3 - i) * 8)) & 0xff
  }
}

Buffer$1.prototype.writeUInt32LE = function writeUInt32LE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = value >>> 24
    this[offset + 2] = value >>> 16
    this[offset + 1] = value >>> 8
    this[offset] = value & 0xff
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer$1.prototype.writeUInt32BE = function writeUInt32BE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24
    this[offset + 1] = value >>> 16
    this[offset + 2] = value >>> 8
    this[offset + 3] = value & 0xff
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer$1.prototype.writeIntLE = function writeIntLE(
  value,
  offset,
  byteLength,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xff
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
  }

  return offset + byteLength
}

Buffer$1.prototype.writeIntBE = function writeIntBE(
  value,
  offset,
  byteLength,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xff
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
  }

  return offset + byteLength
}

Buffer$1.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value & 0xff
  return offset + 1
}

Buffer$1.prototype.writeInt16LE = function writeInt16LE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff
    this[offset + 1] = value >>> 8
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer$1.prototype.writeInt16BE = function writeInt16BE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8
    this[offset + 1] = value & 0xff
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer$1.prototype.writeInt32LE = function writeInt32LE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff
    this[offset + 1] = value >>> 8
    this[offset + 2] = value >>> 16
    this[offset + 3] = value >>> 24
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer$1.prototype.writeInt32BE = function writeInt32BE(
  value,
  offset,
  noAssert
) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24
    this[offset + 1] = value >>> 16
    this[offset + 2] = value >>> 8
    this[offset + 3] = value & 0xff
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4)
  }
  write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer$1.prototype.writeFloatLE = function writeFloatLE(
  value,
  offset,
  noAssert
) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer$1.prototype.writeFloatBE = function writeFloatBE(
  value,
  offset,
  noAssert
) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8)
  }
  write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer$1.prototype.writeDoubleLE = function writeDoubleLE(
  value,
  offset,
  noAssert
) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer$1.prototype.writeDoubleBE = function writeDoubleBE(
  value,
  offset,
  noAssert
) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer$1.prototype.copy = function copy(target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length)
    throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer$1.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer$1.prototype.fill = function fill(val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer$1.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer$1(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean(str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim(str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex(n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes(string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xd7ff && codePoint < 0xe000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xdbff) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xdc00) {
        if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint =
        (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80)
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        (codePoint >> 0xc) | 0xe0,
        ((codePoint >> 0x6) & 0x3f) | 0x80,
        (codePoint & 0x3f) | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        (codePoint >> 0x12) | 0xf0,
        ((codePoint >> 0xc) & 0x3f) | 0x80,
        ((codePoint >> 0x6) & 0x3f) | 0x80,
        (codePoint & 0x3f) | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes(str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xff)
  }
  return byteArray
}

function utf16leToBytes(str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes(str) {
  return toByteArray(base64clean(str))
}

function blitBuffer(src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan(val) {
  return val !== val // eslint-disable-line no-self-compare
}

// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer(obj) {
  return (
    obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
  )
}

function isFastBuffer(obj) {
  return (
    !!obj.constructor &&
    typeof obj.constructor.isBuffer === 'function' &&
    obj.constructor.isBuffer(obj)
  )
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer(obj) {
  return (
    typeof obj.readFloatLE === 'function' &&
    typeof obj.slice === 'function' &&
    isFastBuffer(obj.slice(0, 0))
  )
}

var commonjsGlobal =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : {}

function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default')
    ? x['default']
    : x
}

var stringify = { exports: {} }

var hasRequiredStringify

function requireStringify() {
  if (hasRequiredStringify) return stringify.exports
  hasRequiredStringify = 1
  ;(function (module, exports) {
    exports = module.exports = stringify
    exports.getSerialize = serializer

    function stringify(obj, replacer, spaces, cycleReplacer) {
      return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
    }

    function serializer(replacer, cycleReplacer) {
      var stack = [],
        keys = []

      if (cycleReplacer == null)
        cycleReplacer = function (key, value) {
          if (stack[0] === value) return '[Circular ~]'
          return (
            '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']'
          )
        }

      return function (key, value) {
        if (stack.length > 0) {
          var thisPos = stack.indexOf(this)
          ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
          ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
          if (~stack.indexOf(value))
            value = cycleReplacer.call(this, key, value)
        } else stack.push(value)

        return replacer == null ? value : replacer.call(this, key, value)
      }
    }
  })(stringify, stringify.exports)
  return stringify.exports
}

var stringifyExports = requireStringify()
var safeJSONStringify = /*@__PURE__*/ getDefaultExportFromCjs(stringifyExports)

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
function encode$1(buffer) {
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
function decode(base64) {
  // Add removed at end '='
  base64 += Array(5 - (base64.length % 4)).join('=')
  base64 = base64
    .replace(/\-/g, '+') // Convert '-' to '+'
    .replace(/\_/g, '/') // Convert '_' to '/'
  return new Buffer$1(base64, 'base64')
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

var URLSafeBase64 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  decode: decode,
  encode: encode$1,
  validate: validate,
  version: version
})

/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

/* eslint-disable space-unary-ops */

/* Public constants ==========================================================*/
/* ===========================================================================*/

//const Z_FILTERED          = 1;
//const Z_HUFFMAN_ONLY      = 2;
//const Z_RLE               = 3;
const Z_FIXED$1 = 4
//const Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
const Z_BINARY = 0
const Z_TEXT = 1
//const Z_ASCII             = 1; // = Z_TEXT
const Z_UNKNOWN$1 = 2

/*============================================================================*/

function zero$1(buf) {
  let len = buf.length
  while (--len >= 0) {
    buf[len] = 0
  }
}

// From zutil.h

const STORED_BLOCK = 0
const STATIC_TREES = 1
const DYN_TREES = 2
/* The three kinds of block type */

const MIN_MATCH$1 = 3
const MAX_MATCH$1 = 258
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

const LENGTH_CODES$1 = 29
/* number of length codes, not counting the special END_BLOCK code */

const LITERALS$1 = 256
/* number of literal bytes 0..255 */

const L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1
/* number of Literal or Length codes, including the END_BLOCK code */

const D_CODES$1 = 30
/* number of distance codes */

const BL_CODES$1 = 19
/* number of codes used to transfer the bit lengths */

const HEAP_SIZE$1 = 2 * L_CODES$1 + 1
/* maximum heap size */

const MAX_BITS$1 = 15
/* All codes must not exceed MAX_BITS bits */

const Buf_size = 16
/* size of bit buffer in bi_buf */

/* ===========================================================================
 * Constants
 */

const MAX_BL_BITS = 7
/* Bit length codes must not exceed MAX_BL_BITS bits */

const END_BLOCK = 256
/* end of block literal code */

const REP_3_6 = 16
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

const REPZ_3_10 = 17
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

const REPZ_11_138 = 18
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
const extra_lbits =
  /* extra bits for each length code */
  new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
    5, 5, 5, 0
  ])

const extra_dbits =
  /* extra bits for each distance code */
  new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13
  ])

const extra_blbits =
  /* extra bits for each bit length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])

const bl_order = new Uint8Array([
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
])
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

const DIST_CODE_LEN = 512 /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
const static_ltree = new Array((L_CODES$1 + 2) * 2)
zero$1(static_ltree)
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

const static_dtree = new Array(D_CODES$1 * 2)
zero$1(static_dtree)
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

const _dist_code = new Array(DIST_CODE_LEN)
zero$1(_dist_code)
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

const _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1)
zero$1(_length_code)
/* length code for each normalized match length (0 == MIN_MATCH) */

const base_length = new Array(LENGTH_CODES$1)
zero$1(base_length)
/* First normalized length for each code (0 = MIN_MATCH) */

const base_dist = new Array(D_CODES$1)
zero$1(base_dist)
/* First normalized distance for each code (0 = distance of 1) */

function StaticTreeDesc(
  static_tree,
  extra_bits,
  extra_base,
  elems,
  max_length
) {
  this.static_tree = static_tree /* static tree or NULL */
  this.extra_bits = extra_bits /* extra bits for each code or NULL */
  this.extra_base = extra_base /* base index for extra_bits */
  this.elems = elems /* max number of elements in the tree */
  this.max_length = max_length /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree = static_tree && static_tree.length
}

let static_l_desc
let static_d_desc
let static_bl_desc

function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree /* the dynamic tree */
  this.max_code = 0 /* largest code with non zero frequency */
  this.stat_desc = stat_desc /* the corresponding static tree */
}

const d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)]
}

/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
const put_short = (s, w) => {
  //    put_byte(s, (uch)((w) & 0xff));
  //    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = w & 0xff
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff
}

/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
const send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff
    put_short(s, s.bi_buf)
    s.bi_buf = value >> (Buf_size - s.bi_valid)
    s.bi_valid += length - Buf_size
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff
    s.bi_valid += length
  }
}

const send_code = (s, c, tree) => {
  send_bits(s, tree[c * 2] /*.Code*/, tree[c * 2 + 1] /*.Len*/)
}

/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
const bi_reverse = (code, len) => {
  let res = 0
  do {
    res |= code & 1
    code >>>= 1
    res <<= 1
  } while (--len > 0)
  return res >>> 1
}

/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
const bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf)
    s.bi_buf = 0
    s.bi_valid = 0
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff
    s.bi_buf >>= 8
    s.bi_valid -= 8
  }
}

/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
const gen_bitlen = (s, desc) => {
  //    deflate_state *s;
  //    tree_desc *desc;    /* the tree descriptor */

  const tree = desc.dyn_tree
  const max_code = desc.max_code
  const stree = desc.stat_desc.static_tree
  const has_stree = desc.stat_desc.has_stree
  const extra = desc.stat_desc.extra_bits
  const base = desc.stat_desc.extra_base
  const max_length = desc.stat_desc.max_length
  let h /* heap index */
  let n, m /* iterate over the tree elements */
  let bits /* bit length */
  let xbits /* extra bits */
  let f /* frequency */
  let overflow = 0 /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0 /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h]
    bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1
    if (bits > max_length) {
      bits = max_length
      overflow++
    }
    tree[n * 2 + 1] /*.Len*/ = bits
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) {
      continue
    } /* not a leaf node */

    s.bl_count[bits]++
    xbits = 0
    if (n >= base) {
      xbits = extra[n - base]
    }
    f = tree[n * 2] /*.Freq*/
    s.opt_len += f * (bits + xbits)
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits)
    }
  }
  if (overflow === 0) {
    return
  }

  // Tracev((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1
    while (s.bl_count[bits] === 0) {
      bits--
    }
    s.bl_count[bits]-- /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2 /* move one overflow item as its brother */
    s.bl_count[max_length]--
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2
  } while (overflow > 0)

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits]
    while (n !== 0) {
      m = s.heap[--h]
      if (m > max_code) {
        continue
      }
      if (tree[m * 2 + 1] /*.Len*/ !== bits) {
        // Tracev((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1]) /*.Len*/ * tree[m * 2] /*.Freq*/
        tree[m * 2 + 1] /*.Len*/ = bits
      }
      n--
    }
  }
}

/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
const gen_codes = (tree, max_code, bl_count) => {
  //    ct_data *tree;             /* the tree to decorate */
  //    int max_code;              /* largest code with non zero frequency */
  //    ushf *bl_count;            /* number of codes at each bit length */

  const next_code = new Array(
    MAX_BITS$1 + 1
  ) /* next code value for each bit length */
  let code = 0 /* running code value */
  let bits /* bit index */
  let n /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = (code + bl_count[bits - 1]) << 1
    next_code[bits] = code
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1] /*.Len*/
    if (len === 0) {
      continue
    }
    /* Now reverse the bits */
    tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len)

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}

/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
const tr_static_init = () => {
  let n /* iterates over tree elements */
  let bits /* bit counter */
  let length /* length value */
  let code /* code value */
  let dist /* distance index */
  const bl_count = new Array(MAX_BITS$1 + 1)
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
  /*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7 /* from now on, all distances are divided by 128 */
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7
    for (n = 0; n < 1 << (extra_dbits[code] - 7); n++) {
      _dist_code[256 + dist++] = code
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0
  }

  n = 0
  while (n <= 143) {
    static_ltree[n * 2 + 1] /*.Len*/ = 8
    n++
    bl_count[8]++
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] /*.Len*/ = 9
    n++
    bl_count[9]++
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] /*.Len*/ = 7
    n++
    bl_count[7]++
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] /*.Len*/ = 8
    n++
    bl_count[8]++
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count)

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] /*.Len*/ = 5
    static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5)
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(
    static_ltree,
    extra_lbits,
    LITERALS$1 + 1,
    L_CODES$1,
    MAX_BITS$1
  )
  static_d_desc = new StaticTreeDesc(
    static_dtree,
    extra_dbits,
    0,
    D_CODES$1,
    MAX_BITS$1
  )
  static_bl_desc = new StaticTreeDesc(
    new Array(0),
    extra_blbits,
    0,
    BL_CODES$1,
    MAX_BL_BITS
  )

  //static_init_done = true;
}

/* ===========================================================================
 * Initialize a new block.
 */
const init_block = (s) => {
  let n /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] /*.Freq*/ = 0
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] /*.Freq*/ = 0
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] /*.Freq*/ = 0
  }

  s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1
  s.opt_len = s.static_len = 0
  s.sym_next = s.matches = 0
}

/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
const bi_windup = (s) => {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf)
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf
  }
  s.bi_buf = 0
  s.bi_valid = 0
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
const smaller = (tree, n, m, depth) => {
  const _n2 = n * 2
  const _m2 = m * 2
  return (
    tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ ||
    (tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m])
  )
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
const pqdownheap = (s, tree, k) => {
  //    deflate_state *s;
  //    ct_data *tree;  /* the tree to restore */
  //    int k;               /* node to move down */

  const v = s.heap[k]
  let j = k << 1 /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break
    }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j]
    k = j

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1
  }
  s.heap[k] = v
}

// inlined manually
// const SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
const compress_block = (s, ltree, dtree) => {
  //    deflate_state *s;
  //    const ct_data *ltree; /* literal tree */
  //    const ct_data *dtree; /* distance tree */

  let dist /* distance of matched string */
  let lc /* match length or unmatched char (if dist == 0) */
  let sx = 0 /* running index in sym_buf */
  let code /* the code to send */
  let extra /* number of extra bits to send */

  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 0xff
      dist += (s.pending_buf[s.sym_buf + sx++] & 0xff) << 8
      lc = s.pending_buf[s.sym_buf + sx++]
      if (dist === 0) {
        send_code(s, lc, ltree) /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc]
        send_code(s, code + LITERALS$1 + 1, ltree) /* send the length code */
        extra = extra_lbits[code]
        if (extra !== 0) {
          lc -= base_length[code]
          send_bits(s, lc, extra) /* send the extra length bits */
        }
        dist-- /* dist is now the match distance - 1 */
        code = d_code(dist)
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree) /* send the distance code */
        extra = extra_dbits[code]
        if (extra !== 0) {
          dist -= base_dist[code]
          send_bits(s, dist, extra) /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and sym_buf is ok: */
      //Assert(s->pending < s->lit_bufsize + sx, "pendingBuf overflow");
    } while (sx < s.sym_next)
  }

  send_code(s, END_BLOCK, ltree)
}

/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
const build_tree = (s, desc) => {
  //    deflate_state *s;
  //    tree_desc *desc; /* the tree descriptor */

  const tree = desc.dyn_tree
  const stree = desc.stat_desc.static_tree
  const has_stree = desc.stat_desc.has_stree
  const elems = desc.stat_desc.elems
  let n, m /* iterate over heap elements */
  let max_code = -1 /* largest code with non zero frequency */
  let node /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0
  s.heap_max = HEAP_SIZE$1

  for (n = 0; n < elems; n++) {
    if (tree[n * 2] /*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n
      s.depth[n] = 0
    } else {
      tree[n * 2 + 1] /*.Len*/ = 0
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0
    tree[node * 2] /*.Freq*/ = 1
    s.depth[node] = 0
    s.opt_len--

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1] /*.Len*/
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = s.heap_len >> 1 /*int /2*/; n >= 1; n--) {
    pqdownheap(s, tree, n)
  }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1 /*SMALLEST*/]
    s.heap[1 /*SMALLEST*/] = s.heap[s.heap_len--]
    pqdownheap(s, tree, 1 /*SMALLEST*/)
    /***/

    m = s.heap[1 /*SMALLEST*/] /* m = node of next least frequency */

    s.heap[--s.heap_max] = n /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m

    /* Create a new node father of n and m */
    tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1
    tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node

    /* and insert the new node in the heap */
    s.heap[1 /*SMALLEST*/] = node++
    pqdownheap(s, tree, 1 /*SMALLEST*/)
  } while (s.heap_len >= 2)

  s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/]

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc)

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count)
}

/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
const scan_tree = (s, tree, max_code) => {
  //    deflate_state *s;
  //    ct_data *tree;   /* the tree to be scanned */
  //    int max_code;    /* and its largest code of non zero frequency */

  let n /* iterates over all tree elements */
  let prevlen = -1 /* last emitted length */
  let curlen /* length of current code */

  let nextlen = tree[0 * 2 + 1] /*.Len*/ /* length of next code */

  let count = 0 /* repeat count of the current code */
  let max_count = 7 /* max repeat count */
  let min_count = 4 /* min repeat count */

  if (nextlen === 0) {
    max_count = 138
    min_count = 3
  }
  tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen
    nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

    if (++count < max_count && curlen === nextlen) {
      continue
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] /*.Freq*/ += count
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2] /*.Freq*/++
      }
      s.bl_tree[REP_3_6 * 2] /*.Freq*/++
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2] /*.Freq*/++
    } else {
      s.bl_tree[REPZ_11_138 * 2] /*.Freq*/++
    }

    count = 0
    prevlen = curlen

    if (nextlen === 0) {
      max_count = 138
      min_count = 3
    } else if (curlen === nextlen) {
      max_count = 6
      min_count = 3
    } else {
      max_count = 7
      min_count = 4
    }
  }
}

/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
const send_tree = (s, tree, max_code) => {
  //    deflate_state *s;
  //    ct_data *tree; /* the tree to be scanned */
  //    int max_code;       /* and its largest code of non zero frequency */

  let n /* iterates over all tree elements */
  let prevlen = -1 /* last emitted length */
  let curlen /* length of current code */

  let nextlen = tree[0 * 2 + 1] /*.Len*/ /* length of next code */

  let count = 0 /* repeat count of the current code */
  let max_count = 7 /* max repeat count */
  let min_count = 4 /* min repeat count */

  /* tree[max_code+1].Len = -1; */ /* guard already set */
  if (nextlen === 0) {
    max_count = 138
    min_count = 3
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen
    nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

    if (++count < max_count && curlen === nextlen) {
      continue
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree)
      } while (--count !== 0)
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree)
        count--
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree)
      send_bits(s, count - 3, 2)
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree)
      send_bits(s, count - 3, 3)
    } else {
      send_code(s, REPZ_11_138, s.bl_tree)
      send_bits(s, count - 11, 7)
    }

    count = 0
    prevlen = curlen
    if (nextlen === 0) {
      max_count = 138
      min_count = 3
    } else if (curlen === nextlen) {
      max_count = 6
      min_count = 3
    } else {
      max_count = 7
      min_count = 4
    }
  }
}

/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
const build_bl_tree = (s) => {
  let max_blindex /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code)
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code)

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc)
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
      break
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex
}

/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
const send_all_trees = (s, lcodes, dcodes, blcodes) => {
  //    deflate_state *s;
  //    int lcodes, dcodes, blcodes; /* number of codes for each tree */

  let rank /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5) /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1, 5)
  send_bits(s, blcodes - 4, 4) /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/, 3)
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1) /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1) /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}

/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "block list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "allow list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
const detect_data_type = (s) => {
  /* block_mask is the bit mask of block-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  let block_mask = 0xf3ffc07f
  let n

  /* Check for non-textual ("block-listed") bytes. */
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if (block_mask & 1 && s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
      return Z_BINARY
    }
  }

  /* Check for textual ("allow-listed") bytes. */
  if (
    s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 ||
    s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 ||
    s.dyn_ltree[13 * 2] /*.Freq*/ !== 0
  ) {
    return Z_TEXT
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
      return Z_TEXT
    }
  }

  /* There are no "block-listed" or "allow-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY
}

let static_init_done = false

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
const _tr_init$1 = (s) => {
  if (!static_init_done) {
    tr_static_init()
    static_init_done = true
  }

  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc)
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc)
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc)

  s.bi_buf = 0
  s.bi_valid = 0

  /* Initialize the first block of the first file: */
  init_block(s)
}

/* ===========================================================================
 * Send a stored block
 */
const _tr_stored_block$1 = (s, buf, stored_len, last) => {
  //DeflateState *s;
  //charf *buf;       /* input block */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */

  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3) /* send block type */
  bi_windup(s) /* align on byte boundary */
  put_short(s, stored_len)
  put_short(s, ~stored_len)
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending)
  }
  s.pending += stored_len
}

/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
const _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3)
  send_code(s, END_BLOCK, static_ltree)
  bi_flush(s)
}

/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and write out the encoded block.
 */
const _tr_flush_block$1 = (s, buf, stored_len, last) => {
  //DeflateState *s;
  //charf *buf;       /* input block, or NULL if too old */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */

  let opt_lenb, static_lenb /* opt_len and static_len in bytes */
  let max_blindex = 0 /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {
    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s)
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc)
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc)
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s)

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len + 3 + 7) >>> 3
    static_lenb = (s.static_len + 3 + 7) >>> 3

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->sym_next / 3));

    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb
    }
  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5 /* force a stored block */
  }

  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block$1(s, buf, stored_len, last)
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3)
    compress_block(s, static_ltree, static_dtree)
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3)
    send_all_trees(
      s,
      s.l_desc.max_code + 1,
      s.d_desc.max_code + 1,
      max_blindex + 1
    )
    compress_block(s, s.dyn_ltree, s.dyn_dtree)
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s)

  if (last) {
    bi_windup(s)
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
const _tr_tally$1 = (s, dist, lc) => {
  //    deflate_state *s;
  //    unsigned dist;  /* distance of matched string */
  //    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */

  s.pending_buf[s.sym_buf + s.sym_next++] = dist
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8
  s.pending_buf[s.sym_buf + s.sym_next++] = lc
  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2] /*.Freq*/++
  } else {
    s.matches++
    /* Here, lc is the match length - MIN_MATCH */
    dist-- /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2] /*.Freq*/++
    s.dyn_dtree[d_code(dist) * 2] /*.Freq*/++
  }

  return s.sym_next === s.sym_end
}

var _tr_init_1 = _tr_init$1
var _tr_stored_block_1 = _tr_stored_block$1
var _tr_flush_block_1 = _tr_flush_block$1
var _tr_tally_1 = _tr_tally$1
var _tr_align_1 = _tr_align$1

var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1
}

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const adler32 = (adler, buf, len, pos) => {
  let s1 = (adler & 0xffff) | 0,
    s2 = ((adler >>> 16) & 0xffff) | 0,
    n = 0

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len
    len -= n

    do {
      s1 = (s1 + buf[pos++]) | 0
      s2 = (s2 + s1) | 0
    } while (--n)

    s1 %= 65521
    s2 %= 65521
  }

  return s1 | (s2 << 16) | 0
}

var adler32_1 = adler32

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
const makeTable = () => {
  let c,
    table = []

  for (var n = 0; n < 256; n++) {
    c = n
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }

  return table
}

// Create table on load. Just 255 signed longs. Not a problem.
const crcTable = new Uint32Array(makeTable())

const crc32 = (crc, buf, len, pos) => {
  const t = crcTable
  const end = pos + len

  crc ^= -1

  for (let i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff]
  }

  return crc ^ -1 // >>> 0;
}

var crc32_1 = crc32

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var messages = {
  2: 'need dictionary' /* Z_NEED_DICT       2  */,
  1: 'stream end' /* Z_STREAM_END      1  */,
  0: '' /* Z_OK              0  */,
  '-1': 'file error' /* Z_ERRNO         (-1) */,
  '-2': 'stream error' /* Z_STREAM_ERROR  (-2) */,
  '-3': 'data error' /* Z_DATA_ERROR    (-3) */,
  '-4': 'insufficient memory' /* Z_MEM_ERROR     (-4) */,
  '-5': 'buffer error' /* Z_BUF_ERROR     (-5) */,
  '-6': 'incompatible version' /* Z_VERSION_ERROR (-6) */
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var constants$2 = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,

  /* Return codes for the compression/decompression functions. Negative values
   * are errors, positive values are used for special but normal events.
   */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,

  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,

  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } =
  trees

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$2,
  Z_PARTIAL_FLUSH,
  Z_FULL_FLUSH: Z_FULL_FLUSH$1,
  Z_FINISH: Z_FINISH$3,
  Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3,
  Z_STREAM_END: Z_STREAM_END$3,
  Z_STREAM_ERROR: Z_STREAM_ERROR$2,
  Z_DATA_ERROR: Z_DATA_ERROR$2,
  Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED,
  Z_HUFFMAN_ONLY,
  Z_RLE,
  Z_FIXED,
  Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2

/*============================================================================*/

const MAX_MEM_LEVEL = 9
/* Maximum value for memLevel in deflateInit2 */
const MAX_WBITS$1 = 15
/* 32K LZ77 window */
const DEF_MEM_LEVEL = 8

const LENGTH_CODES = 29
/* number of length codes, not counting the special END_BLOCK code */
const LITERALS = 256
/* number of literal bytes 0..255 */
const L_CODES = LITERALS + 1 + LENGTH_CODES
/* number of Literal or Length codes, including the END_BLOCK code */
const D_CODES = 30
/* number of distance codes */
const BL_CODES = 19
/* number of codes used to transfer the bit lengths */
const HEAP_SIZE = 2 * L_CODES + 1
/* maximum heap size */
const MAX_BITS = 15
/* All codes must not exceed MAX_BITS bits */

const MIN_MATCH = 3
const MAX_MATCH = 258
const MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1

const PRESET_DICT = 0x20

const INIT_STATE = 42 /* zlib header -> BUSY_STATE */
//#ifdef GZIP
const GZIP_STATE = 57 /* gzip header -> BUSY_STATE | EXTRA_STATE */
//#endif
const EXTRA_STATE = 69 /* gzip extra block -> NAME_STATE */
const NAME_STATE = 73 /* gzip file name -> COMMENT_STATE */
const COMMENT_STATE = 91 /* gzip comment -> HCRC_STATE */
const HCRC_STATE = 103 /* gzip header CRC -> BUSY_STATE */
const BUSY_STATE = 113 /* deflate -> FINISH_STATE */
const FINISH_STATE = 666 /* stream complete */

const BS_NEED_MORE = 1 /* block not completed, need more input or more output */
const BS_BLOCK_DONE = 2 /* block flush performed */
const BS_FINISH_STARTED = 3 /* finish started, need only more output at next deflate */
const BS_FINISH_DONE = 4 /* finish done, accept no more input or output */

const OS_CODE = 0x03 // Unix :) . Don't detect, use this default.

const err = (strm, errorCode) => {
  strm.msg = messages[errorCode]
  return errorCode
}

const rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0)
}

const zero = (buf) => {
  let len = buf.length
  while (--len >= 0) {
    buf[len] = 0
  }
}

/* ===========================================================================
 * Slide the hash table when sliding the window down (could be avoided with 32
 * bit values at the expense of memory usage). We slide even when level == 0 to
 * keep the hash table consistent if we switch back to level > 0 later.
 */
const slide_hash = (s) => {
  let n, m
  let p
  let wsize = s.w_size

  n = s.hash_size
  p = n
  do {
    m = s.head[--p]
    s.head[p] = m >= wsize ? m - wsize : 0
  } while (--n)
  n = wsize
  //#ifndef FASTEST
  p = n
  do {
    m = s.prev[--p]
    s.prev[p] = m >= wsize ? m - wsize : 0
    /* If n is not on any hash chain, prev[n] is garbage but
     * its value will never be used.
     */
  } while (--n)
  //#endif
}

/* eslint-disable new-cap */
let HASH_ZLIB = (s, prev, data) => ((prev << s.hash_shift) ^ data) & s.hash_mask
// This hash causes less collisions, https://github.com/nodeca/pako/issues/135
// But breaks binary compatibility
//let HASH_FAST = (s, prev, data) => ((prev << 8) + (prev >> 8) + (data << 4)) & s.hash_mask;
let HASH = HASH_ZLIB

/* =========================================================================
 * Flush as much pending output as possible. All deflate() output, except for
 * some deflate_stored() output, goes through this function so some
 * applications may wish to modify it to avoid allocating a large
 * strm->next_out buffer and copying into it. (See also read_buf()).
 */
const flush_pending = (strm) => {
  const s = strm.state

  //_tr_flush_bits(s);
  let len = s.pending
  if (len > strm.avail_out) {
    len = strm.avail_out
  }
  if (len === 0) {
    return
  }

  strm.output.set(
    s.pending_buf.subarray(s.pending_out, s.pending_out + len),
    strm.next_out
  )
  strm.next_out += len
  s.pending_out += len
  strm.total_out += len
  strm.avail_out -= len
  s.pending -= len
  if (s.pending === 0) {
    s.pending_out = 0
  }
}

const flush_block_only = (s, last) => {
  _tr_flush_block(
    s,
    s.block_start >= 0 ? s.block_start : -1,
    s.strstart - s.block_start,
    last
  )
  s.block_start = s.strstart
  flush_pending(s.strm)
}

const put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b
}

/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
const putShortMSB = (s, b) => {
  //  put_byte(s, (Byte)(b >> 8));
  //  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff
  s.pending_buf[s.pending++] = b & 0xff
}

/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
const read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in

  if (len > size) {
    len = size
  }
  if (len === 0) {
    return 0
  }

  strm.avail_in -= len

  // zmemcpy(buf, strm->next_in, len);
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start)
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start)
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start)
  }

  strm.next_in += len
  strm.total_in += len

  return len
}

/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
const longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length /* max hash chain length */
  let scan = s.strstart /* current string */
  let match /* matched string */
  let len /* length of current match */
  let best_len = s.prev_length /* best match length so far */
  let nice_match = s.nice_match /* stop if match long enough */
  const limit =
    s.strstart > s.w_size - MIN_LOOKAHEAD
      ? s.strstart - (s.w_size - MIN_LOOKAHEAD)
      : 0 /*NIL*/

  const _win = s.window // shortcut

  const wmask = s.w_mask
  const prev = s.prev

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  const strend = s.strstart + MAX_MATCH
  let scan_end1 = _win[scan + best_len - 1]
  let scan_end = _win[scan + best_len]

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead
  }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (
      _win[match + best_len] !== scan_end ||
      _win[match + best_len - 1] !== scan_end1 ||
      _win[match] !== _win[scan] ||
      _win[++match] !== _win[scan + 1]
    ) {
      continue
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2
    match++
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      _win[++scan] === _win[++match] &&
      scan < strend
    )

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan)
    scan = strend - MAX_MATCH

    if (len > best_len) {
      s.match_start = cur_match
      best_len = len
      if (len >= nice_match) {
        break
      }
      scan_end1 = _win[scan + best_len - 1]
      scan_end = _win[scan + best_len]
    }
  } while (
    (cur_match = prev[cur_match & wmask]) > limit &&
    --chain_length !== 0
  )

  if (best_len <= s.lookahead) {
    return best_len
  }
  return s.lookahead
}

/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
const fill_window = (s) => {
  const _w_size = s.w_size
  let n, more, str

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}

    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0)
      s.match_start -= _w_size
      s.strstart -= _w_size
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size
      if (s.insert > s.strstart) {
        s.insert = s.strstart
      }
      slide_hash(s)
      more += _w_size
    }
    if (s.strm.avail_in === 0) {
      break
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more)
    s.lookahead += n

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert
      s.ins_h = s.window[str]

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1])
      //#if MIN_MATCH != 3
      //        Call update_hash() MIN_MATCH-3 more times
      //#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1])

        s.prev[str & s.w_mask] = s.head[s.ins_h]
        s.head[s.ins_h] = str
        str++
        s.insert--
        if (s.lookahead + s.insert < MIN_MATCH) {
          break
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0)

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
  //  if (s.high_water < s.window_size) {
  //    const curr = s.strstart + s.lookahead;
  //    let init = 0;
  //
  //    if (s.high_water < curr) {
  //      /* Previous high water mark below current data -- zero WIN_INIT
  //       * bytes or up to end of window, whichever is less.
  //       */
  //      init = s.window_size - curr;
  //      if (init > WIN_INIT)
  //        init = WIN_INIT;
  //      zmemzero(s->window + curr, (unsigned)init);
  //      s->high_water = curr + init;
  //    }
  //    else if (s->high_water < (ulg)curr + WIN_INIT) {
  //      /* High water mark at or above current data, but below current data
  //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
  //       * to end of window, whichever is less.
  //       */
  //      init = (ulg)curr + WIN_INIT - s->high_water;
  //      if (init > s->window_size - s->high_water)
  //        init = s->window_size - s->high_water;
  //      zmemzero(s->window + s->high_water, (unsigned)init);
  //      s->high_water += init;
  //    }
  //  }
  //
  //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
  //    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 *
 * In case deflateParams() is used to later switch to a non-zero compression
 * level, s->matches (otherwise unused when storing) keeps track of the number
 * of hash table slides to perform. If s->matches is 1, then one hash table
 * slide will be done when switching. If s->matches is 2, the maximum value
 * allowed here, then the hash table will be cleared, since two or more slides
 * is the same as a clear.
 *
 * deflate_stored() is written to minimize the number of times an input byte is
 * copied. It is most efficient with large input and output buffers, which
 * maximizes the opportunites to have a single copy from next_in to next_out.
 */
const deflate_stored = (s, flush) => {
  /* Smallest worthy block size when not flushing or finishing. By default
   * this is 32K. This can be as small as 507 bytes for memLevel == 1. For
   * large input and output buffers, the stored block size will be larger.
   */
  let min_block =
    s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5

  /* Copy as many min_block or larger stored blocks directly to next_out as
   * possible. If flushing, copy the remaining available input to next_out as
   * stored blocks, if there is enough space.
   */
  let len,
    left,
    have,
    last = 0
  let used = s.strm.avail_in
  do {
    /* Set len to the maximum size block that we can copy directly with the
     * available input data and output space. Set left to how much of that
     * would be copied from what's left in the window.
     */
    len = 65535 /* MAX_STORED */ /* maximum deflate stored block length */
    have = (s.bi_valid + 42) >> 3 /* number of header bytes */
    if (s.strm.avail_out < have) {
      /* need room for header */
      break
    }
    /* maximum stored block length that will fit in avail_out: */
    have = s.strm.avail_out - have
    left = s.strstart - s.block_start /* bytes left in window */
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in /* limit len to the input */
    }
    if (len > have) {
      len = have /* limit len to the output */
    }

    /* If the stored block would be less than min_block in length, or if
     * unable to copy all of the available input when flushing, then try
     * copying to the window and the pending buffer instead. Also don't
     * write an empty block when flushing -- deflate() does that.
     */
    if (
      len < min_block &&
      ((len === 0 && flush !== Z_FINISH$3) ||
        flush === Z_NO_FLUSH$2 ||
        len !== left + s.strm.avail_in)
    ) {
      break
    }

    /* Make a dummy stored block in pending to get the header bytes,
     * including any pending bits. This also updates the debugging counts.
     */
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0
    _tr_stored_block(s, 0, 0, last)

    /* Replace the lengths in the dummy stored block with len. */
    s.pending_buf[s.pending - 4] = len
    s.pending_buf[s.pending - 3] = len >> 8
    s.pending_buf[s.pending - 2] = ~len
    s.pending_buf[s.pending - 1] = ~len >> 8

    /* Write the stored block header bytes. */
    flush_pending(s.strm)

    //#ifdef ZLIB_DEBUG
    //    /* Update debugging counts for the data about to be copied. */
    //    s->compressed_len += len << 3;
    //    s->bits_sent += len << 3;
    //#endif

    /* Copy uncompressed bytes from the window to next_out. */
    if (left) {
      if (left > len) {
        left = len
      }
      //zmemcpy(s->strm->next_out, s->window + s->block_start, left);
      s.strm.output.set(
        s.window.subarray(s.block_start, s.block_start + left),
        s.strm.next_out
      )
      s.strm.next_out += left
      s.strm.avail_out -= left
      s.strm.total_out += left
      s.block_start += left
      len -= left
    }

    /* Copy uncompressed bytes directly from next_in to next_out, updating
     * the check value.
     */
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len)
      s.strm.next_out += len
      s.strm.avail_out -= len
      s.strm.total_out += len
    }
  } while (last === 0)

  /* Update the sliding window with the last s->w_size bytes of the copied
   * data, or append all of the copied data to the existing window if less
   * than s->w_size bytes were copied. Also update the number of bytes to
   * insert in the hash tables, in the event that deflateParams() switches to
   * a non-zero compression level.
   */
  used -= s.strm.avail_in /* number of input bytes directly copied */
  if (used) {
    /* If any input was used, then no unused input remains in the window,
     * therefore s->block_start == s->strstart.
     */
    if (used >= s.w_size) {
      /* supplant the previous history */
      s.matches = 2 /* clear hash */
      //zmemcpy(s->window, s->strm->next_in - s->w_size, s->w_size);
      s.window.set(
        s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in),
        0
      )
      s.strstart = s.w_size
      s.insert = s.strstart
    } else {
      if (s.window_size - s.strstart <= used) {
        /* Slide the window down. */
        s.strstart -= s.w_size
        //zmemcpy(s->window, s->window + s->w_size, s->strstart);
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0)
        if (s.matches < 2) {
          s.matches++ /* add a pending slide_hash() */
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart
        }
      }
      //zmemcpy(s->window + s->strstart, s->strm->next_in - used, used);
      s.window.set(
        s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in),
        s.strstart
      )
      s.strstart += used
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used
    }
    s.block_start = s.strstart
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart
  }

  /* If the last block was written to next_out, then done. */
  if (last) {
    return BS_FINISH_DONE
  }

  /* If flushing and all input has been consumed, then done. */
  if (
    flush !== Z_NO_FLUSH$2 &&
    flush !== Z_FINISH$3 &&
    s.strm.avail_in === 0 &&
    s.strstart === s.block_start
  ) {
    return BS_BLOCK_DONE
  }

  /* Fill the window with any remaining input. */
  have = s.window_size - s.strstart
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    /* Slide the window down. */
    s.block_start -= s.w_size
    s.strstart -= s.w_size
    //zmemcpy(s->window, s->window + s->w_size, s->strstart);
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0)
    if (s.matches < 2) {
      s.matches++ /* add a pending slide_hash() */
    }
    have += s.w_size /* more space now */
    if (s.insert > s.strstart) {
      s.insert = s.strstart
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have)
    s.strstart += have
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart
  }

  /* There was not enough avail_out to write a complete worthy or flushed
   * stored block to next_out. Write a stored block to pending instead, if we
   * have enough input for a worthy block, or if flushing and there is enough
   * room for the remaining input as a stored block in the pending buffer.
   */
  have = (s.bi_valid + 42) >> 3 /* number of header bytes */
  /* maximum stored block length that will fit in pending: */
  have =
    s.pending_buf_size - have > 65535 /* MAX_STORED */
      ? 65535 /* MAX_STORED */
      : s.pending_buf_size - have
  min_block = have > s.w_size ? s.w_size : have
  left = s.strstart - s.block_start
  if (
    left >= min_block ||
    ((left || flush === Z_FINISH$3) &&
      flush !== Z_NO_FLUSH$2 &&
      s.strm.avail_in === 0 &&
      left <= have)
  ) {
    len = left > have ? have : left
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0
    _tr_stored_block(s, s.block_start, len, last)
    s.block_start += len
    flush_pending(s.strm)
  }

  /* We've done all we can with the available input and output. */
  return last ? BS_FINISH_STARTED : BS_NEED_MORE
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
const deflate_fast = (s, flush) => {
  let hash_head /* head of the hash chain */
  let bflush /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s)
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE
      }
      if (s.lookahead === 0) {
        break /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0 /*NIL*/
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
      s.head[s.ins_h] = s.strstart
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (
      hash_head !== 0 /*NIL*/ &&
      s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD
    ) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head)
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(
        s,
        s.strstart - s.match_start,
        s.match_length - MIN_MATCH
      )

      s.lookahead -= s.match_length

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (
        s.match_length <= s.max_lazy_match /*max_insert_length*/ &&
        s.lookahead >= MIN_MATCH
      ) {
        s.match_length-- /* string at strstart already in table */
        do {
          s.strstart++
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
          s.head[s.ins_h] = s.strstart
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0)
        s.strstart++
      } else {
        s.strstart += s.match_length
        s.match_length = 0
        s.ins_h = s.window[s.strstart]
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1])

        //#if MIN_MATCH != 3
        //                Call UPDATE_HASH() MIN_MATCH-3 more times
        //#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart])

      s.lookahead--
      s.strstart++
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true)
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED
    }
    /***/
    return BS_FINISH_DONE
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false)
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE
    }
    /***/
  }
  return BS_BLOCK_DONE
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
const deflate_slow = (s, flush) => {
  let hash_head /* head of hash chain */
  let bflush /* set if current block must be flushed */

  let max_insert

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s)
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE
      }
      if (s.lookahead === 0) {
        break
      } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0 /*NIL*/
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
      s.head[s.ins_h] = s.strstart
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length
    s.prev_match = s.match_start
    s.match_length = MIN_MATCH - 1

    if (
      hash_head !== 0 /*NIL*/ &&
      s.prev_length < s.max_lazy_match &&
      s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD /*MAX_DIST(s)*/
    ) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head)
      /* longest_match() sets match_start */

      if (
        s.match_length <= 5 &&
        (s.strategy === Z_FILTERED ||
          (s.match_length === MIN_MATCH &&
            s.strstart - s.match_start > 4096) /*TOO_FAR*/)
      ) {
        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH - 1
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = _tr_tally(
        s,
        s.strstart - 1 - s.prev_match,
        s.prev_length - MIN_MATCH
      )
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1
      s.prev_length -= 2
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
          s.head[s.ins_h] = s.strstart
          /***/
        }
      } while (--s.prev_length !== 0)
      s.match_available = 0
      s.match_length = MIN_MATCH - 1
      s.strstart++

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false)
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE
        }
        /***/
      }
    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1])

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false)
        /***/
      }
      s.strstart++
      s.lookahead--
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1
      s.strstart++
      s.lookahead--
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1])

    s.match_available = 0
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true)
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED
    }
    /***/
    return BS_FINISH_DONE
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false)
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE
    }
    /***/
  }

  return BS_BLOCK_DONE
}

/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
const deflate_rle = (s, flush) => {
  let bflush /* set if current block must be flushed */
  let prev /* byte at distance one to match */
  let scan, strend /* scan goes up to strend for length of run */

  const _win = s.window

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s)
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE
      }
      if (s.lookahead === 0) {
        break
      } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1
      prev = _win[scan]
      if (
        prev === _win[++scan] &&
        prev === _win[++scan] &&
        prev === _win[++scan]
      ) {
        strend = s.strstart + MAX_MATCH
        do {
          /*jshint noempty:false*/
        } while (
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          scan < strend
        )
        s.match_length = MAX_MATCH - (strend - scan)
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH)

      s.lookahead -= s.match_length
      s.strstart += s.match_length
      s.match_length = 0
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart])

      s.lookahead--
      s.strstart++
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
  }
  s.insert = 0
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true)
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED
    }
    /***/
    return BS_FINISH_DONE
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false)
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE
    }
    /***/
  }
  return BS_BLOCK_DONE
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
const deflate_huff = (s, flush) => {
  let bflush /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s)
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE
        }
        break /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = _tr_tally(s, 0, s.window[s.strstart])
    s.lookahead--
    s.strstart++
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
  }
  s.insert = 0
  if (flush === Z_FINISH$3) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true)
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED
    }
    /***/
    return BS_FINISH_DONE
  }
  if (s.sym_next) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false)
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE
    }
    /***/
  }
  return BS_BLOCK_DONE
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length
  this.max_lazy = max_lazy
  this.nice_length = nice_length
  this.max_chain = max_chain
  this.func = func
}

const configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored) /* 0 store only */,
  new Config(4, 4, 8, 4, deflate_fast) /* 1 max speed, no lazy matches */,
  new Config(4, 5, 16, 8, deflate_fast) /* 2 */,
  new Config(4, 6, 32, 32, deflate_fast) /* 3 */,

  new Config(4, 4, 16, 16, deflate_slow) /* 4 lazy matches */,
  new Config(8, 16, 32, 32, deflate_slow) /* 5 */,
  new Config(8, 16, 128, 128, deflate_slow) /* 6 */,
  new Config(8, 32, 128, 256, deflate_slow) /* 7 */,
  new Config(32, 128, 258, 1024, deflate_slow) /* 8 */,
  new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
]

/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
const lm_init = (s) => {
  s.window_size = 2 * s.w_size

  /*** CLEAR_HASH(s); ***/
  zero(s.head) // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy
  s.good_match = configuration_table[s.level].good_length
  s.nice_match = configuration_table[s.level].nice_length
  s.max_chain_length = configuration_table[s.level].max_chain

  s.strstart = 0
  s.block_start = 0
  s.lookahead = 0
  s.insert = 0
  s.match_length = s.prev_length = MIN_MATCH - 1
  s.match_available = 0
  s.ins_h = 0
}

function DeflateState() {
  this.strm = null /* pointer back to this zlib stream */
  this.status = 0 /* as the name implies */
  this.pending_buf = null /* output still pending */
  this.pending_buf_size = 0 /* size of pending_buf */
  this.pending_out = 0 /* next pending byte to output to the stream */
  this.pending = 0 /* nb of bytes in the pending buffer */
  this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null /* gzip header information to write */
  this.gzindex = 0 /* where in extra, name, or comment */
  this.method = Z_DEFLATED$2 /* can only be DEFLATED */
  this.last_flush = -1 /* value of flush param for previous deflate call */

  this.w_size = 0 /* LZ77 window size (32K by default) */
  this.w_bits = 0 /* log2(w_size)  (8..16) */
  this.w_mask = 0 /* w_size - 1 */

  this.window = null
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null /* Heads of the hash chains or NIL. */

  this.ins_h = 0 /* hash index of string to be inserted */
  this.hash_size = 0 /* number of elements in hash table */
  this.hash_bits = 0 /* log2(hash_size) */
  this.hash_mask = 0 /* hash_size-1 */

  this.hash_shift = 0
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0 /* length of best match */
  this.prev_match = 0 /* previous match */
  this.match_available = 0 /* set if previous match exists */
  this.strstart = 0 /* start of string to insert */
  this.match_start = 0 /* start of matching string */
  this.lookahead = 0 /* number of valid bytes ahead in window */

  this.prev_length = 0
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0 /* compression level (1..9) */
  this.strategy = 0 /* favor or force Huffman coding*/

  this.good_match = 0
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0 /* Stop searching when current match exceeds this */

  /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2)
  this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2)
  this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2)
  zero(this.dyn_ltree)
  zero(this.dyn_dtree)
  zero(this.bl_tree)

  this.l_desc = null /* desc. for literal tree */
  this.d_desc = null /* desc. for distance tree */
  this.bl_desc = null /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new Uint16Array(MAX_BITS + 1)
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new Uint16Array(
    2 * L_CODES + 1
  ) /* heap used to build the Huffman trees */
  zero(this.heap)

  this.heap_len = 0 /* number of elements in the heap */
  this.heap_max = 0 /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new Uint16Array(2 * L_CODES + 1) //uch depth[2*L_CODES+1];
  zero(this.depth)
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.sym_buf = 0 /* buffer for distances and literals/lengths */

  this.lit_bufsize = 0
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.sym_next = 0 /* running index in sym_buf */
  this.sym_end = 0 /* symbol table full when sym_next reaches this */

  this.opt_len = 0 /* bit length of current block with optimal trees */
  this.static_len = 0 /* bit length of current block with static trees */
  this.matches = 0 /* number of string matches in current block */
  this.insert = 0 /* bytes at end of window left to insert */

  this.bi_buf = 0
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}

/* =========================================================================
 * Check for a valid deflate stream state. Return 0 if ok, 1 if not.
 */
const deflateStateCheck = (strm) => {
  if (!strm) {
    return 1
  }
  const s = strm.state
  if (
    !s ||
    s.strm !== strm ||
    (s.status !== INIT_STATE &&
      //#ifdef GZIP
      s.status !== GZIP_STATE &&
      //#endif
      s.status !== EXTRA_STATE &&
      s.status !== NAME_STATE &&
      s.status !== COMMENT_STATE &&
      s.status !== HCRC_STATE &&
      s.status !== BUSY_STATE &&
      s.status !== FINISH_STATE)
  ) {
    return 1
  }
  return 0
}

const deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2)
  }

  strm.total_in = strm.total_out = 0
  strm.data_type = Z_UNKNOWN

  const s = strm.state
  s.pending = 0
  s.pending_out = 0

  if (s.wrap < 0) {
    s.wrap = -s.wrap
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status =
    //#ifdef GZIP
    s.wrap === 2
      ? GZIP_STATE
      : //#endif
      s.wrap
      ? INIT_STATE
      : BUSY_STATE
  strm.adler =
    s.wrap === 2
      ? 0 // crc32(0, Z_NULL, 0)
      : 1 // adler32(0, Z_NULL, 0)
  s.last_flush = -2
  _tr_init(s)
  return Z_OK$3
}

const deflateReset = (strm) => {
  const ret = deflateResetKeep(strm)
  if (ret === Z_OK$3) {
    lm_init(strm.state)
  }
  return ret
}

const deflateSetHeader = (strm, head) => {
  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2
  }
  strm.state.gzhead = head
  return Z_OK$3
}

const deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
  if (!strm) {
    // === Z_NULL
    return Z_STREAM_ERROR$2
  }
  let wrap = 1

  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6
  }

  if (windowBits < 0) {
    /* suppress zlib wrapper */
    wrap = 0
    windowBits = -windowBits
  } else if (windowBits > 15) {
    wrap = 2 /* write gzip wrapper instead */
    windowBits -= 16
  }

  if (
    memLevel < 1 ||
    memLevel > MAX_MEM_LEVEL ||
    method !== Z_DEFLATED$2 ||
    windowBits < 8 ||
    windowBits > 15 ||
    level < 0 ||
    level > 9 ||
    strategy < 0 ||
    strategy > Z_FIXED ||
    (windowBits === 8 && wrap !== 1)
  ) {
    return err(strm, Z_STREAM_ERROR$2)
  }

  if (windowBits === 8) {
    windowBits = 9
  }
  /* until 256-byte window bug fixed */

  const s = new DeflateState()

  strm.state = s
  s.strm = strm
  s.status = INIT_STATE /* to pass state test in deflateReset() */

  s.wrap = wrap
  s.gzhead = null
  s.w_bits = windowBits
  s.w_size = 1 << s.w_bits
  s.w_mask = s.w_size - 1

  s.hash_bits = memLevel + 7
  s.hash_size = 1 << s.hash_bits
  s.hash_mask = s.hash_size - 1
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH)

  s.window = new Uint8Array(s.w_size * 2)
  s.head = new Uint16Array(s.hash_size)
  s.prev = new Uint16Array(s.w_size)

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6) /* 16K elements by default */

  /* We overlay pending_buf and sym_buf. This works since the average size
   * for length/distance pairs over any compressed block is assured to be 31
   * bits or less.
   *
   * Analysis: The longest fixed codes are a length code of 8 bits plus 5
   * extra bits, for lengths 131 to 257. The longest fixed distance codes are
   * 5 bits plus 13 extra bits, for distances 16385 to 32768. The longest
   * possible fixed-codes length/distance pair is then 31 bits total.
   *
   * sym_buf starts one-fourth of the way into pending_buf. So there are
   * three bytes in sym_buf for every four bytes in pending_buf. Each symbol
   * in sym_buf is three bytes -- two for the distance and one for the
   * literal/length. As each symbol is consumed, the pointer to the next
   * sym_buf value to read moves forward three bytes. From that symbol, up to
   * 31 bits are written to pending_buf. The closest the written pending_buf
   * bits gets to the next sym_buf symbol to read is just before the last
   * code is written. At that time, 31*(n-2) bits have been written, just
   * after 24*(n-2) bits have been consumed from sym_buf. sym_buf starts at
   * 8*n bits into pending_buf. (Note that the symbol buffer fills when n-1
   * symbols are written.) The closest the writing gets to what is unread is
   * then n+14 bits. Here n is lit_bufsize, which is 16384 by default, and
   * can range from 128 to 32768.
   *
   * Therefore, at a minimum, there are 142 bits of space between what is
   * written and what is read in the overlain buffers, so the symbols cannot
   * be overwritten by the compressed data. That space is actually 139 bits,
   * due to the three-bit fixed-code block header.
   *
   * That covers the case where either Z_FIXED is specified, forcing fixed
   * codes, or when the use of fixed codes is chosen, because that choice
   * results in a smaller compressed block than dynamic codes. That latter
   * condition then assures that the above analysis also covers all dynamic
   * blocks. A dynamic-code block will only be chosen to be emitted if it has
   * fewer bits than a fixed-code block would for the same set of symbols.
   * Therefore its average symbol length is assured to be less than 31. So
   * the compressed data for a dynamic block also cannot overwrite the
   * symbols from which it is being constructed.
   */

  s.pending_buf_size = s.lit_bufsize * 4
  s.pending_buf = new Uint8Array(s.pending_buf_size)

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->sym_buf = s->pending_buf + s->lit_bufsize;
  s.sym_buf = s.lit_bufsize

  //s->sym_end = (s->lit_bufsize - 1) * 3;
  s.sym_end = (s.lit_bufsize - 1) * 3
  /* We avoid equality with lit_bufsize*3 because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */

  s.level = level
  s.strategy = strategy
  s.method = method

  return deflateReset(strm)
}

const deflateInit = (strm, level) => {
  return deflateInit2(
    strm,
    level,
    Z_DEFLATED$2,
    MAX_WBITS$1,
    DEF_MEM_LEVEL,
    Z_DEFAULT_STRATEGY$1
  )
}

/* ========================================================================= */
const deflate$2 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2
  }

  const s = strm.state

  if (
    !strm.output ||
    (strm.avail_in !== 0 && !strm.input) ||
    (s.status === FINISH_STATE && flush !== Z_FINISH$3)
  ) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2)
  }

  const old_flush = s.last_flush
  s.last_flush = flush

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm)
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1
      return Z_OK$3
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (
    strm.avail_in === 0 &&
    rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH$3
  ) {
    return err(strm, Z_BUF_ERROR$1)
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1)
  }

  /* Write the header */
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE
  }
  if (s.status === INIT_STATE) {
    /* zlib header */
    let header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8
    let level_flags = -1

    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0
    } else if (s.level < 6) {
      level_flags = 1
    } else if (s.level === 6) {
      level_flags = 2
    } else {
      level_flags = 3
    }
    header |= level_flags << 6
    if (s.strstart !== 0) {
      header |= PRESET_DICT
    }
    header += 31 - (header % 31)

    putShortMSB(s, header)

    /* Save the adler32 of the preset dictionary: */
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16)
      putShortMSB(s, strm.adler & 0xffff)
    }
    strm.adler = 1 // adler32(0L, Z_NULL, 0);
    s.status = BUSY_STATE

    /* Compression must start with an empty pending buffer */
    flush_pending(strm)
    if (s.pending !== 0) {
      s.last_flush = -1
      return Z_OK$3
    }
  }
  //#ifdef GZIP
  if (s.status === GZIP_STATE) {
    /* gzip header */
    strm.adler = 0 //crc32(0L, Z_NULL, 0);
    put_byte(s, 31)
    put_byte(s, 139)
    put_byte(s, 8)
    if (!s.gzhead) {
      // s->gzhead == Z_NULL
      put_byte(s, 0)
      put_byte(s, 0)
      put_byte(s, 0)
      put_byte(s, 0)
      put_byte(s, 0)
      put_byte(
        s,
        s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0
      )
      put_byte(s, OS_CODE)
      s.status = BUSY_STATE

      /* Compression must start with an empty pending buffer */
      flush_pending(strm)
      if (s.pending !== 0) {
        s.last_flush = -1
        return Z_OK$3
      }
    } else {
      put_byte(
        s,
        (s.gzhead.text ? 1 : 0) +
          (s.gzhead.hcrc ? 2 : 0) +
          (!s.gzhead.extra ? 0 : 4) +
          (!s.gzhead.name ? 0 : 8) +
          (!s.gzhead.comment ? 0 : 16)
      )
      put_byte(s, s.gzhead.time & 0xff)
      put_byte(s, (s.gzhead.time >> 8) & 0xff)
      put_byte(s, (s.gzhead.time >> 16) & 0xff)
      put_byte(s, (s.gzhead.time >> 24) & 0xff)
      put_byte(
        s,
        s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0
      )
      put_byte(s, s.gzhead.os & 0xff)
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 0xff)
        put_byte(s, (s.gzhead.extra.length >> 8) & 0xff)
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0)
      }
      s.gzindex = 0
      s.status = EXTRA_STATE
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra /* != Z_NULL*/) {
      let beg = s.pending /* start of bytes to update crc */
      let left = (s.gzhead.extra.length & 0xffff) - s.gzindex
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending
        // zmemcpy(s.pending_buf + s.pending,
        //    s.gzhead.extra + s.gzindex, copy);
        s.pending_buf.set(
          s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy),
          s.pending
        )
        s.pending = s.pending_buf_size
        //--- HCRC_UPDATE(beg) ---//
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
        }
        //---//
        s.gzindex += copy
        flush_pending(strm)
        if (s.pending !== 0) {
          s.last_flush = -1
          return Z_OK$3
        }
        beg = 0
        left -= copy
      }
      // JS specific: s.gzhead.extra may be TypedArray or Array for backward compatibility
      //              TypedArray.slice and TypedArray.from don't exist in IE10-IE11
      let gzhead_extra = new Uint8Array(s.gzhead.extra)
      // zmemcpy(s->pending_buf + s->pending,
      //     s->gzhead->extra + s->gzindex, left);
      s.pending_buf.set(
        gzhead_extra.subarray(s.gzindex, s.gzindex + left),
        s.pending
      )
      s.pending += left
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
      }
      //---//
      s.gzindex = 0
    }
    s.status = NAME_STATE
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name /* != Z_NULL*/) {
      let beg = s.pending /* start of bytes to update crc */
      let val
      do {
        if (s.pending === s.pending_buf_size) {
          //--- HCRC_UPDATE(beg) ---//
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(
              strm.adler,
              s.pending_buf,
              s.pending - beg,
              beg
            )
          }
          //---//
          flush_pending(strm)
          if (s.pending !== 0) {
            s.last_flush = -1
            return Z_OK$3
          }
          beg = 0
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff
        } else {
          val = 0
        }
        put_byte(s, val)
      } while (val !== 0)
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
      }
      //---//
      s.gzindex = 0
    }
    s.status = COMMENT_STATE
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment /* != Z_NULL*/) {
      let beg = s.pending /* start of bytes to update crc */
      let val
      do {
        if (s.pending === s.pending_buf_size) {
          //--- HCRC_UPDATE(beg) ---//
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(
              strm.adler,
              s.pending_buf,
              s.pending - beg,
              beg
            )
          }
          //---//
          flush_pending(strm)
          if (s.pending !== 0) {
            s.last_flush = -1
            return Z_OK$3
          }
          beg = 0
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff
        } else {
          val = 0
        }
        put_byte(s, val)
      } while (val !== 0)
      //--- HCRC_UPDATE(beg) ---//
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
      }
      //---//
    }
    s.status = HCRC_STATE
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm)
        if (s.pending !== 0) {
          s.last_flush = -1
          return Z_OK$3
        }
      }
      put_byte(s, strm.adler & 0xff)
      put_byte(s, (strm.adler >> 8) & 0xff)
      strm.adler = 0 //crc32(0L, Z_NULL, 0);
    }
    s.status = BUSY_STATE

    /* Compression must start with an empty pending buffer */
    flush_pending(strm)
    if (s.pending !== 0) {
      s.last_flush = -1
      return Z_OK$3
    }
  }
  //#endif

  /* Start a new block or continue the current one.
   */
  if (
    strm.avail_in !== 0 ||
    s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE)
  ) {
    let bstate =
      s.level === 0
        ? deflate_stored(s, flush)
        : s.strategy === Z_HUFFMAN_ONLY
        ? deflate_huff(s, flush)
        : s.strategy === Z_RLE
        ? deflate_rle(s, flush)
        : configuration_table[s.level].func(s, flush)

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK$3
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s)
      } else if (flush !== Z_BLOCK$1) {
        /* FULL_FLUSH or SYNC_FLUSH */

        _tr_stored_block(s, 0, 0, false)
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH$1) {
          /*** CLEAR_HASH(s); ***/ /* forget history */
          zero(s.head) // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0
            s.block_start = 0
            s.insert = 0
          }
        }
      }
      flush_pending(strm)
      if (strm.avail_out === 0) {
        s.last_flush = -1 /* avoid BUF_ERROR at next call, see above */
        return Z_OK$3
      }
    }
  }

  if (flush !== Z_FINISH$3) {
    return Z_OK$3
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$3
  }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff)
    put_byte(s, (strm.adler >> 8) & 0xff)
    put_byte(s, (strm.adler >> 16) & 0xff)
    put_byte(s, (strm.adler >> 24) & 0xff)
    put_byte(s, strm.total_in & 0xff)
    put_byte(s, (strm.total_in >> 8) & 0xff)
    put_byte(s, (strm.total_in >> 16) & 0xff)
    put_byte(s, (strm.total_in >> 24) & 0xff)
  } else {
    putShortMSB(s, strm.adler >>> 16)
    putShortMSB(s, strm.adler & 0xffff)
  }

  flush_pending(strm)
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) {
    s.wrap = -s.wrap
  }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3
}

const deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2
  }

  const status = strm.state.status

  strm.state = null

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3
}

/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
const deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length

  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2
  }

  const s = strm.state
  const wrap = s.wrap

  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR$2
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0)
  }

  s.wrap = 0 /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero(s.head) // Fill with NIL (= 0);
      s.strstart = 0
      s.block_start = 0
      s.insert = 0
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    let tmpDict = new Uint8Array(s.w_size)
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0)
    dictionary = tmpDict
    dictLength = s.w_size
  }
  /* insert dictionary into window and hash */
  const avail = strm.avail_in
  const next = strm.next_in
  const input = strm.input
  strm.avail_in = dictLength
  strm.next_in = 0
  strm.input = dictionary
  fill_window(s)
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart
    let n = s.lookahead - (MIN_MATCH - 1)
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1])

      s.prev[str & s.w_mask] = s.head[s.ins_h]

      s.head[s.ins_h] = str
      str++
    } while (--n)
    s.strstart = str
    s.lookahead = MIN_MATCH - 1
    fill_window(s)
  }
  s.strstart += s.lookahead
  s.block_start = s.strstart
  s.insert = s.lookahead
  s.lookahead = 0
  s.match_length = s.prev_length = MIN_MATCH - 1
  s.match_available = 0
  strm.next_in = next
  strm.input = input
  strm.avail_in = avail
  s.wrap = wrap
  return Z_OK$3
}

var deflateInit_1 = deflateInit
var deflateInit2_1 = deflateInit2
var deflateReset_1 = deflateReset
var deflateResetKeep_1 = deflateResetKeep
var deflateSetHeader_1 = deflateSetHeader
var deflate_2$1 = deflate$2
var deflateEnd_1 = deflateEnd
var deflateSetDictionary_1 = deflateSetDictionary
var deflateInfo = 'pako deflate (from Nodeca project)'

/* Not implemented
module.exports.deflateBound = deflateBound;
module.exports.deflateCopy = deflateCopy;
module.exports.deflateGetDictionary = deflateGetDictionary;
module.exports.deflateParams = deflateParams;
module.exports.deflatePending = deflatePending;
module.exports.deflatePrime = deflatePrime;
module.exports.deflateTune = deflateTune;
*/

var deflate_1$2 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2$1,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo: deflateInfo
}

const _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

var assign = function (obj /*from1, from2, from3, ...*/) {
  const sources = Array.prototype.slice.call(arguments, 1)
  while (sources.length) {
    const source = sources.shift()
    if (!source) {
      continue
    }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object')
    }

    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p]
      }
    }
  }

  return obj
}

// Join array of chunks to single array.
var flattenChunks = (chunks) => {
  // calculate data length
  let len = 0

  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length
  }

  // join chunks
  const result = new Uint8Array(len)

  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i]
    result.set(chunk, pos)
    pos += chunk.length
  }

  return result
}

var common = {
  assign: assign,
  flattenChunks: flattenChunks
}

// String encode/decode helpers

// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
let STR_APPLY_UIA_OK = true

try {
  String.fromCharCode.apply(null, new Uint8Array(1))
} catch (__) {
  STR_APPLY_UIA_OK = false
}

// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
const _utf8len = new Uint8Array(256)
for (let q = 0; q < 256; q++) {
  _utf8len[q] =
    q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1
}
_utf8len[254] = _utf8len[254] = 1 // Invalid sequence start

// convert string to array (typed, when possible)
var string2buf = (str) => {
  if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str)
  }

  let buf,
    c,
    c2,
    m_pos,
    i,
    str_len = str.length,
    buf_len = 0

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos)
    if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1)
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
        m_pos++
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
  }

  // allocate buffer
  buf = new Uint8Array(buf_len)

  // convert
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos)
    if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1)
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
        m_pos++
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xc0 | (c >>> 6)
      buf[i++] = 0x80 | (c & 0x3f)
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xe0 | (c >>> 12)
      buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
      buf[i++] = 0x80 | (c & 0x3f)
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | (c >>> 18)
      buf[i++] = 0x80 | ((c >>> 12) & 0x3f)
      buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
      buf[i++] = 0x80 | (c & 0x3f)
    }
  }

  return buf
}

// Helper
const buf2binstring = (buf, len) => {
  // On Chrome, the arguments in a function call that are allowed is `65534`.
  // If the length of the buffer is smaller than that, we can use this optimization,
  // otherwise we will take a slower path.
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(
        null,
        buf.length === len ? buf : buf.subarray(0, len)
      )
    }
  }

  let result = ''
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i])
  }
  return result
}

// convert array to string
var buf2string = (buf, max) => {
  const len = max || buf.length

  if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max))
  }

  let i, out

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  const utf16buf = new Array(len * 2)

  for (out = 0, i = 0; i < len; ) {
    let c = buf[i++]
    // quick process ascii
    if (c < 0x80) {
      utf16buf[out++] = c
      continue
    }

    let c_len = _utf8len[c]
    // skip 5 & 6 byte codes
    if (c_len > 4) {
      utf16buf[out++] = 0xfffd
      i += c_len - 1
      continue
    }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07
    // join the rest
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 0x3f)
      c_len--
    }

    // terminated by end of string?
    if (c_len > 1) {
      utf16buf[out++] = 0xfffd
      continue
    }

    if (c < 0x10000) {
      utf16buf[out++] = c
    } else {
      c -= 0x10000
      utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff)
      utf16buf[out++] = 0xdc00 | (c & 0x3ff)
    }
  }

  return buf2binstring(utf16buf, out)
}

// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = (buf, max) => {
  max = max || buf.length
  if (max > buf.length) {
    max = buf.length
  }

  // go back from last position, until start of sequence found
  let pos = max - 1
  while (pos >= 0 && (buf[pos] & 0xc0) === 0x80) {
    pos--
  }

  // Very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) {
    return max
  }

  // If we came to start of buffer - that means buffer is too small,
  // return max too.
  if (pos === 0) {
    return max
  }

  return pos + _utf8len[buf[pos]] > max ? pos : max
}

var strings = {
  string2buf: string2buf,
  buf2string: buf2string,
  utf8border: utf8border
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null // JS specific, because we have no pointers
  this.next_in = 0
  /* number of bytes available at input */
  this.avail_in = 0
  /* total number of input bytes read so far */
  this.total_in = 0
  /* next output byte should be put there */
  this.output = null // JS specific, because we have no pointers
  this.next_out = 0
  /* remaining free space at output */
  this.avail_out = 0
  /* total number of bytes output so far */
  this.total_out = 0
  /* last error message, NULL if no error */
  this.msg = '' /*Z_NULL*/
  /* not visible by applications */
  this.state = null
  /* best guess about the data type: binary or text */
  this.data_type = 2 /*Z_UNKNOWN*/
  /* adler32 value of the uncompressed data */
  this.adler = 0
}

var zstream = ZStream

const toString$1 = Object.prototype.toString

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH: Z_NO_FLUSH$1,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2,
  Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2

/* ===========================================================================*/

/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overridden.
 **/

/**
 * Deflate.result -> Uint8Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/

/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 *   , chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
function Deflate$1(options) {
  this.options = common.assign(
    {
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED$1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY
    },
    options || {}
  )

  let opt = this.options

  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16
  }

  this.err = 0 // error code, if happens (0 = Z_OK)
  this.msg = '' // error message
  this.ended = false // used to avoid multiple onEnd() calls
  this.chunks = [] // chunks of compressed data

  this.strm = new zstream()
  this.strm.avail_out = 0

  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  )

  if (status !== Z_OK$2) {
    throw new Error(messages[status])
  }

  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header)
  }

  if (opt.dictionary) {
    let dict
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      // If we need to compress text, change encoding to utf8.
      dict = strings.string2buf(opt.dictionary)
    } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary)
    } else {
      dict = opt.dictionary
    }

    status = deflate_1$2.deflateSetDictionary(this.strm, dict)

    if (status !== Z_OK$2) {
      throw new Error(messages[status])
    }

    this._dict_set = true
  }
}

/**
 * Deflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must
 * have `flush_mode` Z_FINISH (or `true`). That will flush internal pending
 * buffers and call [[Deflate#onEnd]].
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm
  const chunkSize = this.options.chunkSize
  let status, _flush_mode

  if (this.ended) {
    return false
  }

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data)
  } else if (toString$1.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data)
  } else {
    strm.input = data
  }

  strm.next_in = 0
  strm.avail_in = strm.input.length

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize)
      strm.next_out = 0
      strm.avail_out = chunkSize
    }

    // Make sure avail_out > 6 to avoid repeating markers
    if (
      (_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) &&
      strm.avail_out <= 6
    ) {
      this.onData(strm.output.subarray(0, strm.next_out))
      strm.avail_out = 0
      continue
    }

    status = deflate_1$2.deflate(strm, _flush_mode)

    // Ended => flush and finish
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out))
      }
      status = deflate_1$2.deflateEnd(this.strm)
      this.onEnd(status)
      this.ended = true
      return status === Z_OK$2
    }

    // Flush if out buffer full
    if (strm.avail_out === 0) {
      this.onData(strm.output)
      continue
    }

    // Flush if requested and has data
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out))
      strm.avail_out = 0
      continue
    }

    if (strm.avail_in === 0) break
  }

  return true
}

/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array): output data.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk)
}

/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks)
  }
  this.chunks = []
  this.err = status
  this.msg = this.strm.msg
}

/**
 * deflate(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate algorithm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 * - dictionary
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const data = new Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate$1(input, options) {
  const deflator = new Deflate$1(options)

  deflator.push(input, true)

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err]
  }

  return deflator.result
}

/**
 * deflateRaw(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw$1(input, options) {
  options = options || {}
  options.raw = true
  return deflate$1(input, options)
}

/**
 * gzip(data[, options]) -> Uint8Array
 * - data (Uint8Array|ArrayBuffer|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip$1(input, options) {
  options = options || {}
  options.gzip = true
  return deflate$1(input, options)
}

var Deflate_1$1 = Deflate$1
var deflate_2 = deflate$1
var deflateRaw_1$1 = deflateRaw$1
var gzip_1$1 = gzip$1
var constants$1 = constants$2

var deflate_1$1 = {
  Deflate: Deflate_1$1,
  deflate: deflate_2,
  deflateRaw: deflateRaw_1$1,
  gzip: gzip_1$1,
  constants: constants$1
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
const BAD$1 = 16209 /* got a data error -- remain here until reset */
const TYPE$1 = 16191 /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
var inffast = function inflate_fast(strm, start) {
  let _in /* local strm.input */
  let last /* have enough input while in < last */
  let _out /* local strm.output */
  let beg /* inflate()'s initial strm.output */
  let end /* while out < end, enough space available */
  //#ifdef INFLATE_STRICT
  let dmax /* maximum distance from zlib header */
  //#endif
  let wsize /* window size or zero if not using window */
  let whave /* valid bytes in the window */
  let wnext /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  let s_window /* allocated sliding window, if wsize != 0 */
  let hold /* local strm.hold */
  let bits /* local strm.bits */
  let lcode /* local strm.lencode */
  let dcode /* local strm.distcode */
  let lmask /* mask for first level of length codes */
  let dmask /* mask for first level of distance codes */
  let here /* retrieved table entry */
  let op /* code bits, operation, extra bits, or */
  /*  window position, window bytes to copy */
  let len /* match length, unused bytes */
  let dist /* match distance */
  let from /* where to copy match from */
  let from_source

  let input, output // JS specific, because we have no pointers

  /* copy state to local variables */
  const state = strm.state
  //here = state.here;
  _in = strm.next_in
  input = strm.input
  last = _in + (strm.avail_in - 5)
  _out = strm.next_out
  output = strm.output
  beg = _out - (start - strm.avail_out)
  end = _out + (strm.avail_out - 257)
  //#ifdef INFLATE_STRICT
  dmax = state.dmax
  //#endif
  wsize = state.wsize
  whave = state.whave
  wnext = state.wnext
  s_window = state.window
  hold = state.hold
  bits = state.bits
  lcode = state.lencode
  dcode = state.distcode
  lmask = (1 << state.lenbits) - 1
  dmask = (1 << state.distbits) - 1

  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top: do {
    if (bits < 15) {
      hold += input[_in++] << bits
      bits += 8
      hold += input[_in++] << bits
      bits += 8
    }

    here = lcode[hold & lmask]

    dolen: for (;;) {
      // Goto emulation
      op = here >>> 24 /*here.bits*/
      hold >>>= op
      bits -= op
      op = (here >>> 16) & 0xff /*here.op*/
      if (op === 0) {
        /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff /*here.val*/
      } else if (op & 16) {
        /* length base */
        len = here & 0xffff /*here.val*/
        op &= 15 /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits
            bits += 8
          }
          len += hold & ((1 << op) - 1)
          hold >>>= op
          bits -= op
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits
          bits += 8
          hold += input[_in++] << bits
          bits += 8
        }
        here = dcode[hold & dmask]

        dodist: for (;;) {
          // goto emulation
          op = here >>> 24 /*here.bits*/
          hold >>>= op
          bits -= op
          op = (here >>> 16) & 0xff /*here.op*/

          if (op & 16) {
            /* distance base */
            dist = here & 0xffff /*here.val*/
            op &= 15 /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits
              bits += 8
              if (bits < op) {
                hold += input[_in++] << bits
                bits += 8
              }
            }
            dist += hold & ((1 << op) - 1)
            //#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back'
              state.mode = BAD$1
              break top
            }
            //#endif
            hold >>>= op
            bits -= op
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg /* max distance in output */
            if (dist > op) {
              /* see if copy from window */
              op = dist - op /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back'
                  state.mode = BAD$1
                  break top
                }

                // (!) This block is disabled in zlib defaults,
                // don't enable it for binary compatibility
                //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                //                if (len <= op - whave) {
                //                  do {
                //                    output[_out++] = 0;
                //                  } while (--len);
                //                  continue top;
                //                }
                //                len -= op - whave;
                //                do {
                //                  output[_out++] = 0;
                //                } while (--op > whave);
                //                if (op === 0) {
                //                  from = _out - dist;
                //                  do {
                //                    output[_out++] = output[from++];
                //                  } while (--len);
                //                  continue top;
                //                }
                //#endif
              }
              from = 0 // window index
              from_source = s_window
              if (wnext === 0) {
                /* very common case */
                from += wsize - op
                if (op < len) {
                  /* some from window */
                  len -= op
                  do {
                    output[_out++] = s_window[from++]
                  } while (--op)
                  from = _out - dist /* rest from output */
                  from_source = output
                }
              } else if (wnext < op) {
                /* wrap around window */
                from += wsize + wnext - op
                op -= wnext
                if (op < len) {
                  /* some from end of window */
                  len -= op
                  do {
                    output[_out++] = s_window[from++]
                  } while (--op)
                  from = 0
                  if (wnext < len) {
                    /* some from start of window */
                    op = wnext
                    len -= op
                    do {
                      output[_out++] = s_window[from++]
                    } while (--op)
                    from = _out - dist /* rest from output */
                    from_source = output
                  }
                }
              } else {
                /* contiguous in window */
                from += wnext - op
                if (op < len) {
                  /* some from window */
                  len -= op
                  do {
                    output[_out++] = s_window[from++]
                  } while (--op)
                  from = _out - dist /* rest from output */
                  from_source = output
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++]
                output[_out++] = from_source[from++]
                output[_out++] = from_source[from++]
                len -= 3
              }
              if (len) {
                output[_out++] = from_source[from++]
                if (len > 1) {
                  output[_out++] = from_source[from++]
                }
              }
            } else {
              from = _out - dist /* copy direct from output */
              do {
                /* minimum length is three */
                output[_out++] = output[from++]
                output[_out++] = output[from++]
                output[_out++] = output[from++]
                len -= 3
              } while (len > 2)
              if (len) {
                output[_out++] = output[from++]
                if (len > 1) {
                  output[_out++] = output[from++]
                }
              }
            }
          } else if ((op & 64) === 0) {
            /* 2nd level distance code */
            here =
              dcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
            continue dodist
          } else {
            strm.msg = 'invalid distance code'
            state.mode = BAD$1
            break top
          }

          break // need to emulate goto via "continue"
        }
      } else if ((op & 64) === 0) {
        /* 2nd level length code */
        here = lcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
        continue dolen
      } else if (op & 32) {
        /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE$1
        break top
      } else {
        strm.msg = 'invalid literal/length code'
        state.mode = BAD$1
        break top
      }

      break // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end)

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3
  _in -= len
  bits -= len << 3
  hold &= (1 << bits) - 1

  /* update state and return */
  strm.next_in = _in
  strm.next_out = _out
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last)
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end)
  state.hold = hold
  state.bits = bits
  return
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const MAXBITS = 15
const ENOUGH_LENS$1 = 852
const ENOUGH_DISTS$1 = 592
//const ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

const CODES$1 = 0
const LENS$1 = 1
const DISTS$1 = 2

const lbase = new Uint16Array([
  /* Length codes 257..285 base */ 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19,
  23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
])

const lext = new Uint8Array([
  /* Length codes 257..285 extra */ 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17,
  17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
])

const dbase = new Uint16Array([
  /* Distance codes 0..29 base */ 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65,
  97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193,
  12289, 16385, 24577, 0, 0
])

const dext = new Uint8Array([
  /* Distance codes 0..29 extra */ 16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20,
  20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29,
  64, 64
])

const inflate_table = (
  type,
  lens,
  lens_index,
  codes,
  table,
  table_index,
  work,
  opts
) => {
  const bits = opts.bits
  //here = opts.here; /* table entry for duplication */

  let len = 0 /* a code's length in bits */
  let sym = 0 /* index of code symbols */
  let min = 0,
    max = 0 /* minimum and maximum code lengths */
  let root = 0 /* number of index bits for root table */
  let curr = 0 /* number of index bits for current table */
  let drop = 0 /* code bits to drop for sub-table */
  let left = 0 /* number of prefix codes available */
  let used = 0 /* code entries in table used */
  let huff = 0 /* Huffman code */
  let incr /* for incrementing code, index */
  let fill /* index for replicating entries */
  let low /* low bits for current root entry */
  let mask /* mask for low root bits */
  let next /* next available space in table */
  let base = null /* base value table to use */
  //  let shoextra;    /* extra bits table to use */
  let match /* use base and extra for symbol >= match */
  const count = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];    /* number of codes of each length */
  const offs = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];     /* offsets in table for each length */
  let extra = null

  let here_bits, here_op, here_val

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break
    }
  }
  if (root > max) {
    root = max
  }
  if (max === 0) {
    /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0

    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0

    opts.bits = 1
    return 0 /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break
    }
  }
  if (root < min) {
    root = min
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1
    left -= count[len]
    if (left < 0) {
      return -1
    } /* over-subscribed */
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1 /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len]
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES$1) {
    base = extra = work /* dummy value--not used */
    match = 20
  } else if (type === LENS$1) {
    base = lbase
    extra = lext
    match = 257
  } else {
    /* DISTS */
    base = dbase
    extra = dext
    match = 0
  }

  /* initialize opts for loop */
  huff = 0 /* starting code */
  sym = 0 /* starting code symbol */
  len = min /* starting code length */
  next = table_index /* current table to fill in */
  curr = root /* current table index bits */
  drop = 0 /* current bits to drop from code for index */
  low = -1 /* trigger new sub-table when len > root */
  used = 1 << root /* use root table entries */
  mask = used - 1 /* mask for comparing low */

  /* check available table space */
  if (
    (type === LENS$1 && used > ENOUGH_LENS$1) ||
    (type === DISTS$1 && used > ENOUGH_DISTS$1)
  ) {
    return 1
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop
    if (work[sym] + 1 < match) {
      here_op = 0
      here_val = work[sym]
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match]
      here_val = base[work[sym] - match]
    } else {
      here_op = 32 + 64 /* end of block */
      here_val = 0
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop)
    fill = 1 << curr
    min = fill /* save offset to next table */
    do {
      fill -= incr
      table[next + (huff >> drop) + fill] =
        (here_bits << 24) | (here_op << 16) | here_val | 0
    } while (fill !== 0)

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1)
    while (huff & incr) {
      incr >>= 1
    }
    if (incr !== 0) {
      huff &= incr - 1
      huff += incr
    } else {
      huff = 0
    }

    /* go to next symbol, update count, len */
    sym++
    if (--count[len] === 0) {
      if (len === max) {
        break
      }
      len = lens[lens_index + work[sym]]
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root
      }

      /* increment past last table */
      next += min /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop
      left = 1 << curr
      while (curr + drop < max) {
        left -= count[curr + drop]
        if (left <= 0) {
          break
        }
        curr++
        left <<= 1
      }

      /* check for enough space */
      used += 1 << curr
      if (
        (type === LENS$1 && used > ENOUGH_LENS$1) ||
        (type === DISTS$1 && used > ENOUGH_DISTS$1)
      ) {
        return 1
      }

      /* point entry in root table to sub-table */
      low = huff & mask
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root
  return 0
}

var inftrees = inflate_table

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

const CODES = 0
const LENS = 1
const DISTS = 2

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_FINISH: Z_FINISH$1,
  Z_BLOCK,
  Z_TREES,
  Z_OK: Z_OK$1,
  Z_STREAM_END: Z_STREAM_END$1,
  Z_NEED_DICT: Z_NEED_DICT$1,
  Z_STREAM_ERROR: Z_STREAM_ERROR$1,
  Z_DATA_ERROR: Z_DATA_ERROR$1,
  Z_MEM_ERROR: Z_MEM_ERROR$1,
  Z_BUF_ERROR,
  Z_DEFLATED
} = constants$2

/* STATES ====================================================================*/
/* ===========================================================================*/

const HEAD = 16180 /* i: waiting for magic header */
const FLAGS = 16181 /* i: waiting for method and flags (gzip) */
const TIME = 16182 /* i: waiting for modification time (gzip) */
const OS = 16183 /* i: waiting for extra flags and operating system (gzip) */
const EXLEN = 16184 /* i: waiting for extra length (gzip) */
const EXTRA = 16185 /* i: waiting for extra bytes (gzip) */
const NAME = 16186 /* i: waiting for end of file name (gzip) */
const COMMENT = 16187 /* i: waiting for end of comment (gzip) */
const HCRC = 16188 /* i: waiting for header crc (gzip) */
const DICTID = 16189 /* i: waiting for dictionary check value */
const DICT = 16190 /* waiting for inflateSetDictionary() call */
const TYPE = 16191 /* i: waiting for type bits, including last-flag bit */
const TYPEDO = 16192 /* i: same, but skip check to exit inflate on new block */
const STORED = 16193 /* i: waiting for stored size (length and complement) */
const COPY_ = 16194 /* i/o: same as COPY below, but only first time in */
const COPY = 16195 /* i/o: waiting for input or output to copy stored block */
const TABLE = 16196 /* i: waiting for dynamic block table lengths */
const LENLENS = 16197 /* i: waiting for code length code lengths */
const CODELENS = 16198 /* i: waiting for length/lit and distance code lengths */
const LEN_ = 16199 /* i: same as LEN below, but only first time in */
const LEN = 16200 /* i: waiting for length/lit/eob code */
const LENEXT = 16201 /* i: waiting for length extra bits */
const DIST = 16202 /* i: waiting for distance code */
const DISTEXT = 16203 /* i: waiting for distance extra bits */
const MATCH = 16204 /* o: waiting for output space to copy string */
const LIT = 16205 /* o: waiting for output space to write literal */
const CHECK = 16206 /* i: waiting for 32-bit check value */
const LENGTH = 16207 /* i: waiting for 32-bit length (gzip) */
const DONE = 16208 /* finished check, done -- remain here until reset */
const BAD = 16209 /* got a data error -- remain here until reset */
const MEM = 16210 /* got an inflate() memory error -- remain here until reset */
const SYNC = 16211 /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/

const ENOUGH_LENS = 852
const ENOUGH_DISTS = 592
//const ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

const MAX_WBITS = 15
/* 32K LZ77 window */
const DEF_WBITS = MAX_WBITS

const zswap32 = (q) => {
  return (
    ((q >>> 24) & 0xff) +
    ((q >>> 8) & 0xff00) +
    ((q & 0xff00) << 8) +
    ((q & 0xff) << 24)
  )
}

function InflateState() {
  this.strm = null /* pointer back to this zlib stream */
  this.mode = 0 /* current inflate mode */
  this.last = false /* true if processing last block */
  this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip,
                                 bit 2 true to validate check value */
  this.havedict = false /* true if dictionary provided */
  this.flags = 0 /* gzip header method and flags (0 if zlib), or
                                 -1 if raw or no header yet */
  this.dmax = 0 /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0 /* protected copy of check value */
  this.total = 0 /* protected copy of output count */
  // TODO: may be {}
  this.head = null /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0 /* log base 2 of requested window size */
  this.wsize = 0 /* window size or zero if not using window */
  this.whave = 0 /* valid bytes in the window */
  this.wnext = 0 /* window write index */
  this.window = null /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0 /* input bit accumulator */
  this.bits = 0 /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0 /* literal or length of data to copy */
  this.offset = 0 /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0 /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null /* starting table for length/literal codes */
  this.distcode = null /* starting table for distance codes */
  this.lenbits = 0 /* index bits for lencode */
  this.distbits = 0 /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0 /* number of code length code lengths */
  this.nlen = 0 /* number of length code lengths */
  this.ndist = 0 /* number of distance code lengths */
  this.have = 0 /* number of code lengths in lens[] */
  this.next = null /* next available space in codes[] */

  this.lens = new Uint16Array(320) /* temporary storage for code lengths */
  this.work = new Uint16Array(288) /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new Int32Array(ENOUGH);       /* space for code tables */
  this.lendyn = null /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null /* dynamic table for distance codes (JS specific) */
  this.sane = 0 /* if false, allow invalid distance too far */
  this.back = 0 /* bits back of last unprocessed length/lit */
  this.was = 0 /* initial length of match */
}

const inflateStateCheck = (strm) => {
  if (!strm) {
    return 1
  }
  const state = strm.state
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
    return 1
  }
  return 0
}

const inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }
  const state = strm.state
  strm.total_in = strm.total_out = state.total = 0
  strm.msg = '' /*Z_NULL*/
  if (state.wrap) {
    /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1
  }
  state.mode = HEAD
  state.last = 0
  state.havedict = 0
  state.flags = -1
  state.dmax = 32768
  state.head = null /*Z_NULL*/
  state.hold = 0
  state.bits = 0
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS)
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS)

  state.sane = 1
  state.back = -1
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK$1
}

const inflateReset = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }
  const state = strm.state
  state.wsize = 0
  state.whave = 0
  state.wnext = 0
  return inflateResetKeep(strm)
}

const inflateReset2 = (strm, windowBits) => {
  let wrap

  /* get the state */
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }
  const state = strm.state

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0
    windowBits = -windowBits
  } else {
    wrap = (windowBits >> 4) + 5
    if (windowBits < 48) {
      windowBits &= 15
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null
  }

  /* update state and reset the rest of it */
  state.wrap = wrap
  state.wbits = windowBits
  return inflateReset(strm)
}

const inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1
  }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  const state = new InflateState()

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state
  state.strm = strm
  state.window = null /*Z_NULL*/
  state.mode = HEAD /* to pass state test in inflateReset2() */
  const ret = inflateReset2(strm, windowBits)
  if (ret !== Z_OK$1) {
    strm.state = null /*Z_NULL*/
  }
  return ret
}

const inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS)
}

/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
let virgin = true

let lenfix, distfix // We have no pointers in JS, so keep tables separate

const fixedtables = (state) => {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    lenfix = new Int32Array(512)
    distfix = new Int32Array(32)

    /* literal/length table */
    let sym = 0
    while (sym < 144) {
      state.lens[sym++] = 8
    }
    while (sym < 256) {
      state.lens[sym++] = 9
    }
    while (sym < 280) {
      state.lens[sym++] = 7
    }
    while (sym < 288) {
      state.lens[sym++] = 8
    }

    inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 })

    /* distance table */
    sym = 0
    while (sym < 32) {
      state.lens[sym++] = 5
    }

    inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 })

    /* do this just once */
    virgin = false
  }

  state.lencode = lenfix
  state.lenbits = 9
  state.distcode = distfix
  state.distbits = 5
}

/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
const updatewindow = (strm, src, end, copy) => {
  let dist
  const state = strm.state

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits
    state.wnext = 0
    state.whave = 0

    state.window = new Uint8Array(state.wsize)
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0)
    state.wnext = 0
    state.whave = state.wsize
  } else {
    dist = state.wsize - state.wnext
    if (dist > copy) {
      dist = copy
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext)
    copy -= dist
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      state.window.set(src.subarray(end - copy, end), 0)
      state.wnext = copy
      state.whave = state.wsize
    } else {
      state.wnext += dist
      if (state.wnext === state.wsize) {
        state.wnext = 0
      }
      if (state.whave < state.wsize) {
        state.whave += dist
      }
    }
  }
  return 0
}

const inflate$2 = (strm, flush) => {
  let state
  let input, output // input/output buffers
  let next /* next input INDEX */
  let put /* next output INDEX */
  let have, left /* available input and output */
  let hold /* bit buffer */
  let bits /* bits in bit buffer */
  let _in, _out /* save starting available input and output */
  let copy /* number of stored or match bytes to copy */
  let from /* where to copy match bytes from */
  let from_source
  let here = 0 /* current decoding table entry */
  let here_bits, here_op, here_val // paked "here" denormalized (JS specific)
  //let last;                   /* parent table entry */
  let last_bits, last_op, last_val // paked "last" denormalized (JS specific)
  let len /* length to copy for repeats, bits to drop */
  let ret /* return code */
  const hbuf = new Uint8Array(4) /* buffer for gzip header crc calculation */
  let opts

  let n // temporary variable for NEED_BITS

  const order =
    /* permutation of code lengths */
    new Uint8Array([
      16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
    ])

  if (
    inflateStateCheck(strm) ||
    !strm.output ||
    (!strm.input && strm.avail_in !== 0)
  ) {
    return Z_STREAM_ERROR$1
  }

  state = strm.state
  if (state.mode === TYPE) {
    state.mode = TYPEDO
  } /* skip check */

  //--- LOAD() ---
  put = strm.next_out
  output = strm.output
  left = strm.avail_out
  next = strm.next_in
  input = strm.input
  have = strm.avail_in
  hold = state.hold
  bits = state.bits
  //---

  _in = have
  _out = left
  ret = Z_OK$1

  // goto emulation
  inf_leave: for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO
          break
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        if (state.wrap & 2 && hold === 0x8b1f) {
          /* gzip header */
          if (state.wbits === 0) {
            state.wbits = 15
          }
          state.check = 0 /*crc32(0L, Z_NULL, 0)*/
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff
          hbuf[1] = (hold >>> 8) & 0xff
          state.check = crc32_1(state.check, hbuf, 2, 0)
          //===//

          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = FLAGS
          break
        }
        if (state.head) {
          state.head.done = false
        }
        if (
          !(state.wrap & 1) /* check if zlib header allowed */ ||
          (((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31
        ) {
          strm.msg = 'incorrect header check'
          state.mode = BAD
          break
        }
        if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method'
          state.mode = BAD
          break
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4
        bits -= 4
        //---//
        len = (hold & 0x0f) /*BITS(4)*/ + 8
        if (state.wbits === 0) {
          state.wbits = len
        }
        if (len > 15 || len > state.wbits) {
          strm.msg = 'invalid window size'
          state.mode = BAD
          break
        }

        // !!! pako patch. Force use `options.windowBits` if passed.
        // Required to always use max window size by default.
        state.dmax = 1 << state.wbits
        //state.dmax = 1 << len;

        state.flags = 0 /* indicate zlib header */
        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
        state.mode = hold & 0x200 ? DICTID : TYPE
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        break
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        state.flags = hold
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method'
          state.mode = BAD
          break
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set'
          state.mode = BAD
          break
        }
        if (state.head) {
          state.head.text = (hold >> 8) & 1
        }
        if (state.flags & 0x0200 && state.wrap & 4) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff
          hbuf[1] = (hold >>> 8) & 0xff
          state.check = crc32_1(state.check, hbuf, 2, 0)
          //===//
        }
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        state.mode = TIME
      /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        if (state.head) {
          state.head.time = hold
        }
        if (state.flags & 0x0200 && state.wrap & 4) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff
          hbuf[1] = (hold >>> 8) & 0xff
          hbuf[2] = (hold >>> 16) & 0xff
          hbuf[3] = (hold >>> 24) & 0xff
          state.check = crc32_1(state.check, hbuf, 4, 0)
          //===
        }
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        state.mode = OS
      /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        if (state.head) {
          state.head.xflags = hold & 0xff
          state.head.os = hold >> 8
        }
        if (state.flags & 0x0200 && state.wrap & 4) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff
          hbuf[1] = (hold >>> 8) & 0xff
          state.check = crc32_1(state.check, hbuf, 2, 0)
          //===//
        }
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        state.mode = EXLEN
      /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.length = hold
          if (state.head) {
            state.head.extra_len = hold
          }
          if (state.flags & 0x0200 && state.wrap & 4) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff
            hbuf[1] = (hold >>> 8) & 0xff
            state.check = crc32_1(state.check, hbuf, 2, 0)
            //===//
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
        } else if (state.head) {
          state.head.extra = null /*Z_NULL*/
        }
        state.mode = EXTRA
      /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length
          if (copy > have) {
            copy = have
          }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Uint8Array(state.head.extra_len)
              }
              state.head.extra.set(
                input.subarray(
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  next + copy
                ),
                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                len
              )
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if (state.flags & 0x0200 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next)
            }
            have -= copy
            next += copy
            state.length -= copy
          }
          if (state.length) {
            break inf_leave
          }
        }
        state.length = 0
        state.mode = NAME
      /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) {
            break inf_leave
          }
          copy = 0
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++]
            /* use constant limit because in js we should not preallocate memory */
            if (
              state.head &&
              len &&
              state.length < 65536 /*state.head.name_max*/
            ) {
              state.head.name += String.fromCharCode(len)
            }
          } while (len && copy < have)

          if (state.flags & 0x0200 && state.wrap & 4) {
            state.check = crc32_1(state.check, input, copy, next)
          }
          have -= copy
          next += copy
          if (len) {
            break inf_leave
          }
        } else if (state.head) {
          state.head.name = null
        }
        state.length = 0
        state.mode = COMMENT
      /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) {
            break inf_leave
          }
          copy = 0
          do {
            len = input[next + copy++]
            /* use constant limit because in js we should not preallocate memory */
            if (
              state.head &&
              len &&
              state.length < 65536 /*state.head.comm_max*/
            ) {
              state.head.comment += String.fromCharCode(len)
            }
          } while (len && copy < have)
          if (state.flags & 0x0200 && state.wrap & 4) {
            state.check = crc32_1(state.check, input, copy, next)
          }
          have -= copy
          next += copy
          if (len) {
            break inf_leave
          }
        } else if (state.head) {
          state.head.comment = null
        }
        state.mode = HCRC
      /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if (state.wrap & 4 && hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch'
            state.mode = BAD
            break
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
        }
        if (state.head) {
          state.head.hcrc = (state.flags >> 9) & 1
          state.head.done = true
        }
        strm.adler = state.check = 0
        state.mode = TYPE
        break
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        strm.adler = state.check = zswap32(hold)
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        state.mode = DICT
      /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put
          strm.avail_out = left
          strm.next_in = next
          strm.avail_in = have
          state.hold = hold
          state.bits = bits
          //---
          return Z_NEED_DICT$1
        }
        strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
        state.mode = TYPE
      /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) {
          break inf_leave
        }
      /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7
          bits -= bits & 7
          //---//
          state.mode = CHECK
          break
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        state.last = hold & 0x01 /*BITS(1)*/
        //--- DROPBITS(1) ---//
        hold >>>= 1
        bits -= 1
        //---//

        switch (hold & 0x03 /*BITS(2)*/) {
          case 0 /* stored block */:
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED
            break
          case 1 /* fixed block */:
            fixedtables(state)
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_ /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2
              bits -= 2
              //---//
              break inf_leave
            }
            break
          case 2 /* dynamic block */:
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE
            break
          case 3:
            strm.msg = 'invalid block type'
            state.mode = BAD
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2
        bits -= 2
        //---//
        break
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7
        bits -= bits & 7
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths'
          state.mode = BAD
          break
        }
        state.length = hold & 0xffff
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0
        bits = 0
        //===//
        state.mode = COPY_
        if (flush === Z_TREES) {
          break inf_leave
        }
      /* falls through */
      case COPY_:
        state.mode = COPY
      /* falls through */
      case COPY:
        copy = state.length
        if (copy) {
          if (copy > have) {
            copy = have
          }
          if (copy > left) {
            copy = left
          }
          if (copy === 0) {
            break inf_leave
          }
          //--- zmemcpy(put, next, copy); ---
          output.set(input.subarray(next, next + copy), put)
          //---//
          have -= copy
          next += copy
          left -= copy
          put += copy
          state.length -= copy
          break
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE
        break
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
        }
        //===//
        state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257
        //--- DROPBITS(5) ---//
        hold >>>= 5
        bits -= 5
        //---//
        state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1
        //--- DROPBITS(5) ---//
        hold >>>= 5
        bits -= 5
        //---//
        state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4
        //--- DROPBITS(4) ---//
        hold >>>= 4
        bits -= 4
        //---//
        //#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols'
          state.mode = BAD
          break
        }
        //#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0
        state.mode = LENLENS
      /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.lens[order[state.have++]] = hold & 0x07 //BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3
          bits -= 3
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn
        state.lenbits = 7

        opts = { bits: state.lenbits }
        ret = inftrees(
          CODES,
          state.lens,
          0,
          19,
          state.lencode,
          0,
          state.work,
          opts
        )
        state.lenbits = opts.bits

        if (ret) {
          strm.msg = 'invalid code lengths set'
          state.mode = BAD
          break
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0
        state.mode = CODELENS
      /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here =
              state.lencode[
                hold & ((1 << state.lenbits) - 1)
              ] /*BITS(state.lenbits)*/
            here_bits = here >>> 24
            here_op = (here >>> 16) & 0xff
            here_val = here & 0xffff

            if (here_bits <= bits) {
              break
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits
            bits -= here_bits
            //---//
            state.lens[state.have++] = here_val
          } else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2
              while (bits < n) {
                if (have === 0) {
                  break inf_leave
                }
                have--
                hold += input[next++] << bits
                bits += 8
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits
              bits -= here_bits
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat'
                state.mode = BAD
                break
              }
              len = state.lens[state.have - 1]
              copy = 3 + (hold & 0x03) //BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2
              bits -= 2
              //---//
            } else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3
              while (bits < n) {
                if (have === 0) {
                  break inf_leave
                }
                have--
                hold += input[next++] << bits
                bits += 8
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits
              bits -= here_bits
              //---//
              len = 0
              copy = 3 + (hold & 0x07) //BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3
              bits -= 3
              //---//
            } else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7
              while (bits < n) {
                if (have === 0) {
                  break inf_leave
                }
                have--
                hold += input[next++] << bits
                bits += 8
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits
              bits -= here_bits
              //---//
              len = 0
              copy = 11 + (hold & 0x7f) //BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7
              bits -= 7
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat'
              state.mode = BAD
              break
            }
            while (copy--) {
              state.lens[state.have++] = len
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) {
          break
        }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block'
          state.mode = BAD
          break
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9

        opts = { bits: state.lenbits }
        ret = inftrees(
          LENS,
          state.lens,
          0,
          state.nlen,
          state.lencode,
          0,
          state.work,
          opts
        )
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set'
          state.mode = BAD
          break
        }

        state.distbits = 6
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn
        opts = { bits: state.distbits }
        ret = inftrees(
          DISTS,
          state.lens,
          state.nlen,
          state.ndist,
          state.distcode,
          0,
          state.work,
          opts
        )
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set'
          state.mode = BAD
          break
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_
        if (flush === Z_TREES) {
          break inf_leave
        }
      /* falls through */
      case LEN_:
        state.mode = LEN
      /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put
          strm.avail_out = left
          strm.next_in = next
          strm.avail_in = have
          state.hold = hold
          state.bits = bits
          //---
          inffast(strm, _out)
          //--- LOAD() ---
          put = strm.next_out
          output = strm.output
          left = strm.avail_out
          next = strm.next_in
          input = strm.input
          have = strm.avail_in
          hold = state.hold
          bits = state.bits
          //---

          if (state.mode === TYPE) {
            state.back = -1
          }
          break
        }
        state.back = 0
        for (;;) {
          here =
            state.lencode[
              hold & ((1 << state.lenbits) - 1)
            ] /*BITS(state.lenbits)*/
          here_bits = here >>> 24
          here_op = (here >>> 16) & 0xff
          here_val = here & 0xffff

          if (here_bits <= bits) {
            break
          }
          //--- PULLBYTE() ---//
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits
          last_op = here_op
          last_val = here_val
          for (;;) {
            here =
              state.lencode[
                last_val +
                  ((hold &
                    ((1 << (last_bits + last_op)) -
                      1)) /*BITS(last.bits + last.op)*/ >>
                    last_bits)
              ]
            here_bits = here >>> 24
            here_op = (here >>> 16) & 0xff
            here_val = here & 0xffff

            if (last_bits + here_bits <= bits) {
              break
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits
          bits -= last_bits
          //---//
          state.back += last_bits
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits
        bits -= here_bits
        //---//
        state.back += here_bits
        state.length = here_val
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT
          break
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1
          state.mode = TYPE
          break
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code'
          state.mode = BAD
          break
        }
        state.extra = here_op & 15
        state.mode = LENEXT
      /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra
          while (bits < n) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.length += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra
          bits -= state.extra
          //---//
          state.back += state.extra
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length
        state.mode = DIST
      /* falls through */
      case DIST:
        for (;;) {
          here =
            state.distcode[
              hold & ((1 << state.distbits) - 1)
            ] /*BITS(state.distbits)*/
          here_bits = here >>> 24
          here_op = (here >>> 16) & 0xff
          here_val = here & 0xffff

          if (here_bits <= bits) {
            break
          }
          //--- PULLBYTE() ---//
          if (have === 0) {
            break inf_leave
          }
          have--
          hold += input[next++] << bits
          bits += 8
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits
          last_op = here_op
          last_val = here_val
          for (;;) {
            here =
              state.distcode[
                last_val +
                  ((hold &
                    ((1 << (last_bits + last_op)) -
                      1)) /*BITS(last.bits + last.op)*/ >>
                    last_bits)
              ]
            here_bits = here >>> 24
            here_op = (here >>> 16) & 0xff
            here_val = here & 0xffff

            if (last_bits + here_bits <= bits) {
              break
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits
          bits -= last_bits
          //---//
          state.back += last_bits
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits
        bits -= here_bits
        //---//
        state.back += here_bits
        if (here_op & 64) {
          strm.msg = 'invalid distance code'
          state.mode = BAD
          break
        }
        state.offset = here_val
        state.extra = here_op & 15
        state.mode = DISTEXT
      /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra
          while (bits < n) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.offset += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra
          bits -= state.extra
          //---//
          state.back += state.extra
        }
        //#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back'
          state.mode = BAD
          break
        }
        //#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH
      /* falls through */
      case MATCH:
        if (left === 0) {
          break inf_leave
        }
        copy = _out - left
        if (state.offset > copy) {
          /* copy from window */
          copy = state.offset - copy
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back'
              state.mode = BAD
              break
            }
            // (!) This block is disabled in zlib defaults,
            // don't enable it for binary compatibility
            //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
            //          Trace((stderr, "inflate.c too far\n"));
            //          copy -= state.whave;
            //          if (copy > state.length) { copy = state.length; }
            //          if (copy > left) { copy = left; }
            //          left -= copy;
            //          state.length -= copy;
            //          do {
            //            output[put++] = 0;
            //          } while (--copy);
            //          if (state.length === 0) { state.mode = LEN; }
            //          break;
            //#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext
            from = state.wsize - copy
          } else {
            from = state.wnext - copy
          }
          if (copy > state.length) {
            copy = state.length
          }
          from_source = state.window
        } else {
          /* copy from output */
          from_source = output
          from = put - state.offset
          copy = state.length
        }
        if (copy > left) {
          copy = left
        }
        left -= copy
        state.length -= copy
        do {
          output[put++] = from_source[from++]
        } while (--copy)
        if (state.length === 0) {
          state.mode = LEN
        }
        break
      case LIT:
        if (left === 0) {
          break inf_leave
        }
        output[put++] = state.length
        left--
        state.mode = LEN
        break
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) {
              break inf_leave
            }
            have--
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits
            bits += 8
          }
          //===//
          _out -= left
          strm.total_out += _out
          state.total += _out
          if (state.wrap & 4 && _out) {
            strm.adler = state.check =
              /*UPDATE_CHECK(state.check, put - _out, _out);*/
              state.flags
                ? crc32_1(state.check, output, _out, put - _out)
                : adler32_1(state.check, output, _out, put - _out)
          }
          _out = left
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if (
            state.wrap & 4 &&
            (state.flags ? hold : zswap32(hold)) !== state.check
          ) {
            strm.msg = 'incorrect data check'
            state.mode = BAD
            break
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH
      /* falls through */
      case LENGTH:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if (state.wrap & 4 && hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check'
            state.mode = BAD
            break
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE
      /* falls through */
      case DONE:
        ret = Z_STREAM_END$1
        break inf_leave
      case BAD:
        ret = Z_DATA_ERROR$1
        break inf_leave
      case MEM:
        return Z_MEM_ERROR$1
      case SYNC:
      /* falls through */
      default:
        return Z_STREAM_ERROR$1
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put
  strm.avail_out = left
  strm.next_in = next
  strm.avail_in = have
  state.hold = hold
  state.bits = bits
  //---

  if (
    state.wsize ||
    (_out !== strm.avail_out &&
      state.mode < BAD &&
      (state.mode < CHECK || flush !== Z_FINISH$1))
  ) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out));
  }
  _in -= strm.avail_in
  _out -= strm.avail_out
  strm.total_in += _in
  strm.total_out += _out
  state.total += _out
  if (state.wrap & 4 && _out) {
    strm.adler = state.check =
      /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
      state.flags
        ? crc32_1(state.check, output, _out, strm.next_out - _out)
        : adler32_1(state.check, output, _out, strm.next_out - _out)
  }
  strm.data_type =
    state.bits +
    (state.last ? 64 : 0) +
    (state.mode === TYPE ? 128 : 0) +
    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0)
  if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR
  }
  return ret
}

const inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }

  let state = strm.state
  if (state.window) {
    state.window = null
  }
  strm.state = null
  return Z_OK$1
}

const inflateGetHeader = (strm, head) => {
  /* check state */
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }
  const state = strm.state
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1
  }

  /* save header structure */
  state.head = head
  head.done = false
  return Z_OK$1
}

const inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length

  let state
  let dictid
  let ret

  /* check state */
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1
  }
  state = strm.state

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1 /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32_1(dictid, dictionary, dictLength, 0)
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength)
  if (ret) {
    state.mode = MEM
    return Z_MEM_ERROR$1
  }
  state.havedict = 1
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK$1
}

var inflateReset_1 = inflateReset
var inflateReset2_1 = inflateReset2
var inflateResetKeep_1 = inflateResetKeep
var inflateInit_1 = inflateInit
var inflateInit2_1 = inflateInit2
var inflate_2$1 = inflate$2
var inflateEnd_1 = inflateEnd
var inflateGetHeader_1 = inflateGetHeader
var inflateSetDictionary_1 = inflateSetDictionary
var inflateInfo = 'pako inflate (from Nodeca project)'

/* Not implemented
module.exports.inflateCodesUsed = inflateCodesUsed;
module.exports.inflateCopy = inflateCopy;
module.exports.inflateGetDictionary = inflateGetDictionary;
module.exports.inflateMark = inflateMark;
module.exports.inflatePrime = inflatePrime;
module.exports.inflateSync = inflateSync;
module.exports.inflateSyncPoint = inflateSyncPoint;
module.exports.inflateUndermine = inflateUndermine;
module.exports.inflateValidate = inflateValidate;
*/

var inflate_1$2 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2$1,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo: inflateInfo
}

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
  /* true if compressed data believed to be text */
  this.text = 0
  /* modification time */
  this.time = 0
  /* extra flags (not used when writing a gzip file) */
  this.xflags = 0
  /* operating system */
  this.os = 0
  /* pointer to extra field or Z_NULL if none */
  this.extra = null
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len = 0 // Actually, we don't need it in JS,
  // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name = ''
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment = ''
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc = 0
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done = false
}

var gzheader = GZheader

const toString = Object.prototype.toString

/* Public constants ==========================================================*/
/* ===========================================================================*/

const {
  Z_NO_FLUSH,
  Z_FINISH,
  Z_OK,
  Z_STREAM_END,
  Z_NEED_DICT,
  Z_STREAM_ERROR,
  Z_DATA_ERROR,
  Z_MEM_ERROR
} = constants$2

/* ===========================================================================*/

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/

/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako')
 * const chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
 * const chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * const inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate$1(options) {
  this.options = common.assign(
    {
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: ''
    },
    options || {}
  )

  const opt = this.options

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits
    if (opt.windowBits === 0) {
      opt.windowBits = -15
    }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if (
    opt.windowBits >= 0 &&
    opt.windowBits < 16 &&
    !(options && options.windowBits)
  ) {
    opt.windowBits += 32
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15
    }
  }

  this.err = 0 // error code, if happens (0 = Z_OK)
  this.msg = '' // error message
  this.ended = false // used to avoid multiple onEnd() calls
  this.chunks = [] // chunks of compressed data

  this.strm = new zstream()
  this.strm.avail_out = 0

  let status = inflate_1$2.inflateInit2(this.strm, opt.windowBits)

  if (status !== Z_OK) {
    throw new Error(messages[status])
  }

  this.header = new gzheader()

  inflate_1$2.inflateGetHeader(this.strm, this.header)

  // Setup dictionary
  if (opt.dictionary) {
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      opt.dictionary = strings.string2buf(opt.dictionary)
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      opt.dictionary = new Uint8Array(opt.dictionary)
    }
    if (opt.raw) {
      //In raw mode we need to set the dictionary early
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary)
      if (status !== Z_OK) {
        throw new Error(messages[status])
      }
    }
  }
}

/**
 * Inflate#push(data[, flush_mode]) -> Boolean
 * - data (Uint8Array|ArrayBuffer): input data
 * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE
 *   flush modes. See constants. Skipped or `false` means Z_NO_FLUSH,
 *   `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. If end of stream detected,
 * [[Inflate#onEnd]] will be called.
 *
 * `flush_mode` is not needed for normal operation, because end of stream
 * detected automatically. You may try to use it for advanced things, but
 * this functionality was not tested.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm
  const chunkSize = this.options.chunkSize
  const dictionary = this.options.dictionary
  let status, _flush_mode, last_avail_out

  if (this.ended) return false

  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH

  // Convert data if needed
  if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data)
  } else {
    strm.input = data
  }

  strm.next_in = 0
  strm.avail_in = strm.input.length

  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize)
      strm.next_out = 0
      strm.avail_out = chunkSize
    }

    status = inflate_1$2.inflate(strm, _flush_mode)

    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary)

      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode)
      } else if (status === Z_DATA_ERROR) {
        // Replace code with more verbose
        status = Z_NEED_DICT
      }
    }

    // Skip snyc markers if more data follows and not raw mode
    while (
      strm.avail_in > 0 &&
      status === Z_STREAM_END &&
      strm.state.wrap > 0 &&
      data[strm.next_in] !== 0
    ) {
      inflate_1$2.inflateReset(strm)
      status = inflate_1$2.inflate(strm, _flush_mode)
    }

    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status)
        this.ended = true
        return false
    }

    // Remember real `avail_out` value, because we may patch out buffer content
    // to align utf8 strings boundaries.
    last_avail_out = strm.avail_out

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {
        if (this.options.to === 'string') {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out)

          let tail = strm.next_out - next_out_utf8
          let utf8str = strings.buf2string(strm.output, next_out_utf8)

          // move tail & realign counters
          strm.next_out = tail
          strm.avail_out = chunkSize - tail
          if (tail)
            strm.output.set(
              strm.output.subarray(next_out_utf8, next_out_utf8 + tail),
              0
            )

          this.onData(utf8str)
        } else {
          this.onData(
            strm.output.length === strm.next_out
              ? strm.output
              : strm.output.subarray(0, strm.next_out)
          )
        }
      }
    }

    // Must repeat iteration if out buffer is full
    if (status === Z_OK && last_avail_out === 0) continue

    // Finalize if end of stream reached.
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm)
      this.onEnd(status)
      this.ended = true
      return true
    }

    if (strm.avail_in === 0) break
  }

  return true
}

/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|String): output data. When string output requested,
 *   each chunk will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk)
}

/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH). By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate$1.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('')
    } else {
      this.result = common.flattenChunks(this.chunks)
    }
  }
  this.chunks = []
  this.err = status
  this.msg = this.strm.msg
}

/**
 * inflate(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * const pako = require('pako');
 * const input = pako.deflate(new Uint8Array([1,2,3,4,5,6,7,8,9]));
 * let output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err) {
 *   console.log(err);
 * }
 * ```
 **/
function inflate$1(input, options) {
  const inflator = new Inflate$1(options)

  inflator.push(input)

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) throw inflator.msg || messages[inflator.err]

  return inflator.result
}

/**
 * inflateRaw(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw$1(input, options) {
  options = options || {}
  options.raw = true
  return inflate$1(input, options)
}

/**
 * ungzip(data[, options]) -> Uint8Array|String
 * - data (Uint8Array|ArrayBuffer): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/

var Inflate_1$1 = Inflate$1
var inflate_2 = inflate$1
var inflateRaw_1$1 = inflateRaw$1
var ungzip$1 = inflate$1
var constants = constants$2

var inflate_1$1 = {
  Inflate: Inflate_1$1,
  inflate: inflate_2,
  inflateRaw: inflateRaw_1$1,
  ungzip: ungzip$1,
  constants: constants
}

const { Deflate, deflate, deflateRaw, gzip } = deflate_1$1

const { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1

var Deflate_1 = Deflate
var deflate_1 = deflate
var deflateRaw_1 = deflateRaw
var gzip_1 = gzip
var Inflate_1 = Inflate
var inflate_1 = inflate
var inflateRaw_1 = inflateRaw
var ungzip_1 = ungzip
var constants_1 = constants$2

var pako = {
  Deflate: Deflate_1,
  deflate: deflate_1,
  deflateRaw: deflateRaw_1,
  gzip: gzip_1,
  Inflate: Inflate_1,
  inflate: inflate_1,
  inflateRaw: inflateRaw_1,
  ungzip: ungzip_1,
  constants: constants_1
}

var stringPlaceholder
var hasRequiredStringPlaceholder

function requireStringPlaceholder() {
  if (hasRequiredStringPlaceholder) return stringPlaceholder
  hasRequiredStringPlaceholder = 1
  var cache = {}

  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
  }
  /**
   * Replaces variable placeholders inside a string with any given data. Each key
   * in `data` corresponds to a variable placeholder name in `str`.
   *
   * Usage:
   * {{{
   * template('My name is ${name} and I am ${age} years old.', { name: 'Bob', age: '65' });
   * }}}
   *
   * @param  String str     A string containing variable place-holders.
   * @param  Object data    A key, value array where each key stands for a place-holder variable
   *                        name to be replaced with value.
   * @param  Object options Available options are:
   *                        - `'before'`: The character or string in front of the name of the variable
   *                          place-holder (defaults to `'${'`).
   *                        - `'after'`: The character or string after the name of the variable
   *                          place-holder (defaults to `}`).
   *                        - `'escape'`: The character or string used to escape the before character or string
   *                          (defaults to `'\\'`).
   *                        - `'clean'`: A boolean or array with instructions for cleaning.
   * @return String
   */
  function template(str, data, options) {
    var data = data || {}
    var options = options || {}

    var keys = Array.isArray(data)
      ? Array.apply(null, { length: data.length }).map(Number.call, Number)
      : Object.keys(data)
    var len = keys.length

    if (!len) {
      return str
    }

    var before = options.before !== undefined ? options.before : '${'
    var after = options.after !== undefined ? options.after : '}'
    var escape = options.escape !== undefined ? options.escape : '\\'
    var clean = options.clean !== undefined ? options.clean : false

    cache[escape] = cache[escape] || escapeRegExp(escape)
    cache[before] = cache[before] || escapeRegExp(before)
    cache[after] = cache[after] || escapeRegExp(after)

    var begin = escape
      ? '(' + cache[escape] + ')?' + cache[before]
      : cache[before]
    var end = cache[after]

    for (var i = 0; i < len; i++) {
      str = str.replace(
        new RegExp(begin + String(keys[i]) + end, 'g'),
        function (match, behind) {
          return behind ? match : String(data[keys[i]])
        }
      )
    }

    if (escape) {
      str = str.replace(
        new RegExp(escapeRegExp(escape) + escapeRegExp(before), 'g'),
        before
      )
    }
    return clean ? template.clean(str, options) : str
  }

  /**
   * Cleans up a formatted string with given `options` depending
   * on the `'clean'` option. The goal of this function is to replace all whitespace
   * and unneeded mark-up around place-holders that did not get replaced by `Text::insert()`.
   *
   * @param  String str     The string to clean.
   * @param  Object options Available options are:
   *                        - `'before'`: characters marking the start of targeted substring.
   *                        - `'after'`: characters marking the end of targeted substring.
   *                        - `'escape'`: The character or string used to escape the before character or string
   *                          (defaults to `'\\'`).
   *                        - `'gap'`: Regular expression matching gaps.
   *                        - `'word'`: Regular expression matching words.
   *                        - `'replacement'`: String to use for cleaned substrings (defaults to `''`).
   * @return String         The cleaned string.
   */
  template.clean = function (str, options) {
    var options = options || {}

    var before = options.before !== undefined ? options.before : '${'
    var after = options.after !== undefined ? options.after : '}'
    var escape = options.escape !== undefined ? options.escape : '\\'
    var word = options.word !== undefined ? options.word : '[\\w,.]+'
    var gap =
      options.gap !== undefined ? options.gap : '(\\s*(?:(?:and|or|,)\\s*)?)'
    var replacement =
      options.replacement !== undefined ? options.replacement : ''

    cache[escape] = cache[escape] || escapeRegExp(escape)
    cache[before] = cache[before] || escapeRegExp(before)
    cache[after] = cache[after] || escapeRegExp(after)

    var begin = escape
      ? '(' + cache[escape] + ')?' + cache[before]
      : cache[before]
    var end = cache[after]

    str = str.replace(
      new RegExp(gap + begin + word + end + gap, 'g'),
      function (match, before, behind, after) {
        if (behind) {
          return match
        }
        if (before && after && before.trim() === after.trim()) {
          if (before.trim() || (before && after)) {
            return before + replacement
          }
        }
        return replacement
      }
    )

    if (escape) {
      str = str.replace(
        new RegExp(escapeRegExp(escape) + escapeRegExp(before)),
        before
      )
    }
    return str
  }

  stringPlaceholder = template
  return stringPlaceholder
}

var stringPlaceholderExports = requireStringPlaceholder()
var template = /*@__PURE__*/ getDefaultExportFromCjs(stringPlaceholderExports)

// import logoURL from '../assets/images/dapp-logo-bg.png'
// import backgroundURL from '../assets/images/background.png'
// import fontURL from '../assets/fonts/ABSTRACT.ttf'

/**
 * It has been very hard to allow dual support for browser and nodejs due to dependencies conflicts.
 * This is un ugly unified test for now, should be improved
 */
var testDeps = async () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  console.info(
    `Running dependencies test on '${isNode ? 'nodejs' : 'browser'}'`
  )
  console.log({ Buffer: Buffer$1 })
  console.log({ safeJSONStringify })
  console.log({ safeJSONStringify })
  console.log({ URLSafeBase64 })
  console.log({ pako })

  //   const jsonUrl = await import('json-url/dist/node/loaders').then(
  //     (d) => d.default
  //   )
  //   console.log({ jsonUrl })
  //   const lzwCodec = await jsonUrl['lzw']()
  //   const lzmaCodec = await jsonUrl['lzma']()

  //const jsonUrl = await import('json-url').then((d) => d.default)
  const jsonUrl = await Promise.resolve()
    .then(function () {
      return jsonUrl$1
    })
    .then((d) => d.default())
    .catch((err) => {
      console.error(err)
      return undefined
    })

  const lzwCodec = jsonUrl('lzw') //jsonUrl ? jsonUrl('lzw') : undefined
  console.log({ lzwCodec })

  //const lzmaCodec = jsonUrl('lzma')
  //   const lzmaLib = await import('lzma/src/lzma_worker.js')
  //   //const lzmaLib = await import('lzma')
  //   console.log({ lzmaLib })
  //   const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
  const lzmaCodec = await Promise.resolve()
    .then(function () {
      return lzma$1
    })
    .then((d) => d.default())
  console.log({ lzmaCodec })
  //const template = await import('string-placeholder').then((d) => d.default)
  //const template = require('string-placeholder')

  console.log({ template })

  console.log({
    Buffer: Buffer$1.from('Hello').toString('hex'),
    safeJSONStringify: safeJSONStringify({ foo: 'bar' }),
    URLSafeBase64: encode$1(Buffer$1.from('Hello')),
    pako: Buffer$1.from(
      pako.gzip(Buffer$1.from(safeJSONStringify({ foo: 'bar' }), 'utf-8'))
    ).toString('hex'),
    lzwCodec: jsonUrl
      ? await lzwCodec.compress({ foo: 'bar' })
      : 'disabled due to an error', //It is expected to fail for now

    lzmaCodec: encode$1(
      Buffer$1.from(await lzmaCodec.compress({ foo: 'bar' }))
    ),
    template: template(
      'hello {word}',
      { word: 'world' },
      {
        before: '{',
        after: '}'
      }
    )
    // logoURL, //: await import('./assets/images/dapp-logo-bg.png'),
    // backgroundURL, //: await import('./assets/images/background.png')
    // fontURL
  })

  return 'OK'
}

const cliName = 'gamechanger-cli'
const networks = ['mainnet', 'preprod']
const apiVersions = ['1', '2']
const apiEncodings = {
  1: ['json-url-lzw'],
  2: ['json-url-lzma', 'gzip', 'base64url']
}
const GCDomains = {
  1: {
    mainnet: 'https://wallet.gamechanger.finance/',
    preprod: 'https://preprod-wallet.gamechanger.finance/'
  },
  2: {
    mainnet: 'https://beta-wallet.gamechanger.finance/',
    preprod: 'https://beta-preprod-wallet.gamechanger.finance/'
  }
}
const contact = {
  website: 'https://gamechanger.finance',
  github: 'https://github.com/GameChangerFinance/gamechanger.wallet/',
  twitter: 'https://twitter.com/GameChangerOk',
  discord: 'https://discord.gg/vpbfyRaDKG',
  youtube: 'https://www.youtube.com/@gamechanger.finance',
  playgroundDiscord:
    'https://discord.com/channels/912354788795109396/921687306241458207'
}
const GCDappConnUrls = {
  1: {
    mainnet: 'https://wallet.gamechanger.finance/api/1/tx/{gcscript}',
    preprod: 'https://preprod-wallet.gamechanger.finance/api/1/tx/{gcscript}'
  },
  2: {
    mainnet: 'https://beta-wallet.gamechanger.finance/api/2/run/{gcscript}',
    preprod:
      'https://beta-preprod-wallet.gamechanger.finance/api/2/run/{gcscript}'
  }
}
const QRRenderTypes = ['png', 'svg']
const demoGCS = {
  type: 'tx',
  title: 'Demo',
  description: 'created with ' + cliName,
  metadata: {
    123: {
      message: 'Hello World!'
    }
  }
}
const escapeShellArg = (arg) =>
  // eslint-disable-next-line quotes
  `'${arg.replace(/'/g, "'\\''")}'`
const usageMessage = `
GameChanger Wallet CLI:
	Official GameChanger Wallet library and CLI for integrating it with Cardano dapps and solve other tasks (https://gamechanger.finance/)

Usage
	$ ${cliName} [network] [action] [subaction]

Networks: ${networks.map((x) => `'${x}'`).join(' | ')}

Actions:
	'encode':
		'url'     : generates a ready to use URL dApp connector from a valid GCScript
		'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
	'snippet':
		'html'    : generates a ready to use HTML dApp with a URL connector from a valid GCScript
		'button'  : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
		'express' : generates a ready to use Node JS Express backend that redirects browser users to connect with the wallet, from a valid GCScript
		'react'   : generates a ready to use React dApp with a URL connector from a valid GCScript
Options:
	--args [gcscript] | -a [gcscript]:  Load GCScript from arguments

	--file [filename] | -a [filename]:  Load GCScript from file
	without --args or --file         :  Load GCScript from stdin

	--outputFile [filename] -o [filename]:  The QR Code, HTML, button, nodejs, or react output filename
	without --outputFile                 :  Sends the QR Code, HTML, button, nodejs, or react output file to stdin

	--apiVersion [1 | 2] | -v [1 | 2]:  Target GameChanger Wallet v1 or v2

	--encoding [see encodings below] | -v [see encodings below]:  Target GameChanger Wallet v1 or v2 messaging encodings
	Valid encodings by apiVersion:
	${JSON.stringify(apiEncodings)}

	--template [see templates below] | -t [see templates below]: QR code predefined styles
	Valid templates: default, boxed or printable

	--serve | -S : Serve code snippet outputs on http://localhost:3000

Examples

	URL and QR Code encodings:
	URL APIv1:
		$ ${cliName} preprod encode url -v 1 -a ${escapeShellArg(
  JSON.stringify(demoGCS)
)}
		https://preprod-wallet.gamechanger.finance/api/1/tx/...

		$ cat demo.gcscript | ${cliName} mainnet encode url -v 1
		https://wallet.gamechanger.finance/api/1/tx/...

	URL APIv2
		$ ${cliName} mainnet encode url -v 2 -f connect.gcscript
		https://beta-wallet.gamechanger.finance/api/1/run/...

	QR APIv1:
		$ ${cliName} preprod encode qr -v 1 -a ${escapeShellArg(
  JSON.stringify(demoGCS)
)} > qr_output.png

		$ ${cliName} mainnet encode qr -v 1 -o qr_output.png -a ${escapeShellArg(
  JSON.stringify(demoGCS)
)}
	
	QR APIv2:
		$ ${cliName} mainnet encode qr -e gzip  -v 2 -f connect.gcscript -o qr_output.png


	Code snippet generation and serve dapp (-S):

	HTML:
		$ ${cliName} preprod snippet html -v 2 -S -o htmlDapp.html -f connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

	ReactJS:
		$ ${cliName} mainnet snippet react -v 2 -S -o reactDapp.html -f connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000

	HTML Button snippet:
		$ ${cliName} mainnet snippet button -v 2 -S -o connectButton.html -f connect.gcscript
		🚀 Serving output with the hosted Gamechanger library on http://localhost:3000
		
	Express Backend:
		$ ${cliName} mainnet snippet express -v 2 -o expressBackend.js -f connect.gcscript
		$ node expressBackend.js
		🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://localhost:3000/


`

const DefaultNetwork = 'mainnet'
const DefaultAPIVersion = '2'
const DefaultAPIEncodings = {
  1: 'json-url-lzw',
  2: 'gzip'
}
const DefaultQRTemplate = 'boxed'
const DefaultQRTitle = 'Dapp Connection'
const DefaultQRSubTitle = 'scan to execute | escanear para ejecutar'

//import path from 'node:path'
//import * as path from 'path'
// export const resolveGlobal = async (file) => {
//   //const path = await import('path').then(d=>d.default);
//   var commonjsGlobal =
//     typeof window !== 'undefined'
//       ? window
//       : typeof global !== 'undefined'
//       ? global
//       : this
//   console.log({ path, commonjsGlobal })
//   if (!commonjsGlobal) throw new Error('Missing global')
//   return path.resolve('dist/', file)
// }
const validateBuildMsgArgs = (args) => {
  const network = args?.network ? args?.network : DefaultNetwork
  if (!networks.includes(network)) {
    throw new Error(`Unknown Cardano network specification '${network || ''}'`)
  }
  const apiVersion = args?.apiVersion ? args?.apiVersion : DefaultAPIVersion
  if (!apiVersions.includes(apiVersion))
    throw new Error(`Unknown API version '${apiVersion || ''}'`)
  const defaultEncoding = DefaultAPIEncodings[apiVersion]
  const encoding = args?.encoding ? args?.encoding : defaultEncoding
  if (!apiEncodings[apiVersion].includes(encoding))
    throw new Error(
      `Unknown encoding '${encoding || ''}' for API version '${
        apiVersion || ''
      }'`
    )
  const input = args?.input
  if (!input) throw new Error('Empty GCScript provided')
  if (typeof input !== 'string')
    throw new Error(
      'Wrong input type. GCScript must be presented as JSON string'
    )
  try {
    JSON.parse(input)
  } catch (err) {
    throw new Error(`Invalid GCScript. JSON error. ${err}`)
  }
  return {
    apiVersion,
    network,
    encoding,
    input
  }
}
// export const getPlatform = () => {
//   try {
//     // Check if the environment is Node.js
//     if (typeof process === 'object' && typeof require === 'function') {
//       return 'nodejs'
//     }
//   } catch (err) {}
//   // try {
//   //   // Check if the environment is a
//   //   // Service worker
//   //   if (typeof importScripts === 'function') {
//   //     return 'worker'
//   //   }
//   // } catch (err) {}
//   try {
//     // Check if the environment is a Browser
//     if (typeof window === 'object') {
//       return 'browser'
//     }
//   } catch (err) {}
// }

const handler$6 = {
  name: 'GZip',
  encoder: (obj, options) =>
    new Promise(async (resolve, reject) => {
      try {
        const buff = Buffer$1.from(
          pako.gzip(
            Buffer$1.from(safeJSONStringify(obj), 'utf-8'),
            options?.codecOptions || {}
          )
        )
        return resolve(encode$1(buff))
      } catch (err) {
        return reject(err)
      }
    }),
  decoder: (msg, options) =>
    new Promise(async (resolve, reject) => {
      try {
        //const URLSafeBase64 = require('urlsafe-base64')
        //const pako = await import('pako').then((d) => d.default)
        // const buff=Buffer.from(pako.ungzip(Buffer.from(URLSafeBase64.decode(msg),'utf-8'),options?.codecOptions||{}));
        // return resolve(JSON.parse(buff.toString('utf-8')));
        //console.log({ msg, options })
        const buff = Buffer$1.from(
          pako.ungzip(
            Uint8Array.from(decode(msg)),
            //Buffer.from(URLSafeBase64.decode(msg),'utf-8'),
            options?.codecOptions || {}
          )
        )
        return resolve(JSON.parse(buff.toString('utf-8')))
      } catch (err) {
        return reject(err)
      }
    })
}

//import jsonUrl from 'json-url/dist/browser/json-url-single'
//import jsonUrl from 'json-url/dist/node/index'
//import lzmaCodec from 'json-url/dist/node/codecs/lzma'
//const lzmaCodec = jsonUrl.default('lzma')
//JSON-URL:
//Very hard to dual import for browser and node at the same time
// const handler: EncodingHandler = {
//   name: 'JSON-URL LZMA',
//   encoder: async (obj: any /*,_options?:any*/) => {
//     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
//     const lzmaCodec = jsonUrl('lzma')
//     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
//     return lzmaCodec.compress(obj)
//   },
//   decoder: async (msg: string /*,_options?:any*/) => {
//     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
//     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
//     const lzmaCodec = jsonUrl('lzma')
//     return lzmaCodec.decompress(msg)
//   }
// }
//import URLSafeBase64 from 'urlsafe-base64'
//In-House:
const handler$5 = {
  name: 'JSON-URL LZMA',
  encoder: async (obj /*,_options?:any*/) => {
    // const lzmaLib = await import(
    //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
    // )
    // // this special condition is present because the web minified version has a slightly different export
    // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
    const lzmaCodec = await Promise.resolve()
      .then(function () {
        return lzma$1
      })
      .then((d) => d.default())
    // we use exact algorithm and libs as in json-url
    const packed = JSON.stringify(obj)
    const compressed = await lzmaCodec.compress(packed)
    //const encoded = (await import(/* webpackChunkName: "'urlsafe-base64" */ 'urlsafe-base64')).encode(compressed);
    const encoded = encode$1(Buffer$1.from(compressed))
    // console.log({
    //   packed,
    //   compressed,
    //   encoded,
    //   altern: Buffer.from(compressed).toString('base64')
    // })
    return encoded
  },
  decoder: async (msg /*,_options?:any*/) => {
    // const lzmaLib = await import(
    //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
    // )
    // // this special condition is present because the web minified version has a slightly different export
    // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
    const lzmaCodec = await Promise.resolve()
      .then(function () {
        return lzma$1
      })
      .then((d) => d.default())
    // we use exact algorithm and libs as in json-url
    const decoded = decode(msg)
    const decompressed = await lzmaCodec.decompress(decoded)
    const unpacked = JSON.parse(decompressed)
    return unpacked
  }
}

const handler$4 = {
  name: 'JSON-URL LZW',
  encoder: async (obj /*,_options?:any*/) => {
    const jsonUrl = await Promise.resolve()
      .then(function () {
        return jsonUrl$1
      })
      .then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.compress(obj)
  },
  decoder: async (msg /*,_options?:any*/) => {
    const jsonUrl = await Promise.resolve()
      .then(function () {
        return jsonUrl$1
      })
      .then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.decompress(msg)
  }
}

const handler$3 = {
  name: 'URL Safe Base64',
  encoder: (obj /*,_options?:any*/) => {
    // const safeJSONStringify = require('json-stringify-safe')
    // const URLSafeBase64 = require('urlsafe-base64')
    return Promise.resolve(
      encode$1(Buffer$1.from(safeJSONStringify(obj), 'utf-8'))
    )
  },
  decoder: (msg /*,_options?:any*/) => {
    return Promise.resolve(JSON.parse(decode(msg).toString('utf-8')))
  }
}

//import { baseEncodings } from '.'
const msgEncodings = {
  gzip: handler$6,
  'json-url-lzma': handler$5,
  'json-url-lzw': handler$4,
  base64url: handler$3
}
/**
 * Map of encoders and their message headers. Headers are used to auto-detect which decoder needs to be used to decode the message
 *
 * Sorted from worst to best compression for average message bodies
 */
const EncodingByHeaders = {
  '0-': 'base64url', //gc wallet v2
  XQ: 'json-url-lzma', //gc wallet v2 legacy
  wo: 'json-url-lzw', //gc wallet v1 legacy
  '1-': 'gzip' //gc wallet v2
}
/**
 * Map of message headers and their encoders.
 */
const HeadersByEncoders = Object.fromEntries(
  Object.entries(EncodingByHeaders).map(([header, encoding]) => [
    encoding,
    header
  ])
)
/**
 * Async loaders for the required encoding handlers, as a map.
 */
Object.fromEntries(
  Object.keys(HeadersByEncoders).map((encoder) => {
    const loader = () =>
      import(`./${encoder}`).then((module) => module?.default)
    return [encoder, loader]
  })
)
const handler$2 = {
  name: 'Packed GCScript or data message with header',
  encoder: async (obj, options) => {
    const useEncoding =
      options?.encoding || DefaultAPIEncodings[DefaultAPIVersion] // use an specific encoder or use the default one
    // const handlerLoader = EncodingHandlers[useEncoding]
    // if (!handlerLoader) throw new Error('Unknown encoder. Cannot encode')
    const codec = msgEncodings[useEncoding] //await handlerLoader()
    if (!codec) throw new Error('Unknown encoder. Cannot encode')
    const header = HeadersByEncoders[useEncoding]
    if (!header) throw new Error('Unknown encoder header. Cannot encode')
    const msgBody = await codec.encoder(obj, options?.encodingOptions)
    const msg = `${['XQ', 'wo'].includes(header) ? '' : header}${msgBody}` //legacy modes has no added header
    return msg
  },
  decoder: async (msg, options) => {
    if (!msg) throw new Error('Empty data. Cannot decode')
    let detectedEnconding = undefined
    let useHeader = ''
    Object.keys(EncodingByHeaders).forEach((header) => {
      if (!detectedEnconding && msg.startsWith(header)) {
        detectedEnconding = EncodingByHeaders[header]
        useHeader = header
      }
    })
    if (!detectedEnconding)
      throw new Error('Unknown decoder header. Cannot decode')
    if (options?.encoding && detectedEnconding !== options?.encoding)
      throw new Error('Unexpected encoding detected. Cannot decode')
    // const handlerLoader = EncodingHandlers[detectedEnconding]
    // if (!handlerLoader) throw new Error('Unknown decoder. Cannot decode')
    const codec = msgEncodings[detectedEnconding] //await handlerLoader()
    if (!codec) throw new Error('Unknown decoder. Cannot decode')
    const useMsg = !['XQ', 'wo'].includes(useHeader) //legacy modes has no header actually
      ? msg.replace(useHeader, '')
      : msg
    const obj = await codec.decoder(useMsg, options?.encodingOptions)
    return obj
  }
}

const encoder = async (obj, options) => {
  //const template = require('string-placeholder');
  //const template = await import('string-placeholder').then((d) => d.exports)
  const useUrlPattern = options?.urlPattern || ''
  const useMsgPlaceholder = options?.msgPlaceholder || 'gcscript'
  if (!useUrlPattern) throw new Error('Missing URL pattern')
  if (!useMsgPlaceholder)
    throw new Error('Missing message placeholder for URL pattern')
  //console.log({ message })
  const msg = await handler$2.encoder(obj, {
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
  const solvedURL = template(useUrlPattern, templateContext, {
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
const decoder = async (msg, options) => {
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
  const useMsg = foundMessages[0]
  if (!useMsg)
    throw new Error(
      'Empty message found with the provided URL pattern and message placeholder'
    )
  const obj = await handler$2.decoder(useMsg, {
    encoding: options?.encoding,
    encodingOptions: options?.encodingOptions
  })
  return obj
}
const handler$1 = {
  name: 'GameChanger Wallet URL transport. Used as dapp connector to send and receive messages through URLs',
  encoder,
  decoder
}

var URLEncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const obj = JSON.parse(input)
    const urlPattern = GCDappConnUrls[apiVersion][network]
    if (!urlPattern)
      throw new Error(`Missing URL pattern for network '${network || ''}'`)
    const url = await handler$1.encoder(obj, {
      urlPattern,
      encoding
    })
    return url
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}

var browser = {}

var parseFont
var hasRequiredParseFont

function requireParseFont() {
  if (hasRequiredParseFont) return parseFont
  hasRequiredParseFont = 1

  /**
   * Font RegExp helpers.
   */

  const weights = 'bold|bolder|lighter|[1-9]00'
  const styles = 'italic|oblique'
  const variants = 'small-caps'
  const stretches =
    'ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded'
  const units = 'px|pt|pc|in|cm|mm|%|em|ex|ch|rem|q'
  const string = '\'([^\']+)\'|"([^"]+)"|[\\w\\s-]+'

  // [ [ <‘font-style’> || <font-variant-css21> || <‘font-weight’> || <‘font-stretch’> ]?
  //    <‘font-size’> [ / <‘line-height’> ]? <‘font-family’> ]
  // https://drafts.csswg.org/css-fonts-3/#font-prop
  const weightRe = new RegExp(`(${weights}) +`, 'i')
  const styleRe = new RegExp(`(${styles}) +`, 'i')
  const variantRe = new RegExp(`(${variants}) +`, 'i')
  const stretchRe = new RegExp(`(${stretches}) +`, 'i')
  const sizeFamilyRe = new RegExp(
    `([\\d\\.]+)(${units}) *((?:${string})( *, *(?:${string}))*)`
  )

  /**
   * Cache font parsing.
   */

  const cache = {}

  const defaultHeight = 16 // pt, common browser default

  /**
   * Parse font `str`.
   *
   * @param {String} str
   * @return {Object} Parsed font. `size` is in device units. `unit` is the unit
   *   appearing in the input string.
   * @api private
   */

  parseFont = (str) => {
    // Cached
    if (cache[str]) return cache[str]

    // Try for required properties first.
    const sizeFamily = sizeFamilyRe.exec(str)
    if (!sizeFamily) return // invalid

    // Default values and required properties
    const font = {
      weight: 'normal',
      style: 'normal',
      stretch: 'normal',
      variant: 'normal',
      size: parseFloat(sizeFamily[1]),
      unit: sizeFamily[2],
      family: sizeFamily[3].replace(/["']/g, '').replace(/ *, */g, ',')
    }

    // Optional, unordered properties.
    let weight, style, variant, stretch
    // Stop search at `sizeFamily.index`
    const substr = str.substring(0, sizeFamily.index)
    if ((weight = weightRe.exec(substr))) font.weight = weight[1]
    if ((style = styleRe.exec(substr))) font.style = style[1]
    if ((variant = variantRe.exec(substr))) font.variant = variant[1]
    if ((stretch = stretchRe.exec(substr))) font.stretch = stretch[1]

    // Convert to device units. (`font.unit` is the original unit)
    // TODO: ch, ex
    switch (font.unit) {
      case 'pt':
        font.size /= 0.75
        break
      case 'pc':
        font.size *= 16
        break
      case 'in':
        font.size *= 96
        break
      case 'cm':
        font.size *= 96.0 / 2.54
        break
      case 'mm':
        font.size *= 96.0 / 25.4
        break
      case '%':
        // TODO disabled because existing unit tests assume 100
        // font.size *= defaultHeight / 100 / 0.75
        break
      case 'em':
      case 'rem':
        font.size *= defaultHeight / 0.75
        break
      case 'q':
        font.size *= 96 / 25.4 / 4
        break
    }

    return (cache[str] = font)
  }
  return parseFont
}

/* globals document, ImageData */

var hasRequiredBrowser

function requireBrowser() {
  if (hasRequiredBrowser) return browser
  hasRequiredBrowser = 1
  const parseFont = requireParseFont()

  browser.parseFont = parseFont

  browser.createCanvas = function (width, height) {
    return Object.assign(document.createElement('canvas'), {
      width: width,
      height: height
    })
  }

  browser.createImageData = function (array, width, height) {
    // Browser implementation of ImageData looks at the number of arguments passed
    switch (arguments.length) {
      case 0:
        return new ImageData()
      case 1:
        return new ImageData(array)
      case 2:
        return new ImageData(array, width)
      default:
        return new ImageData(array, width, height)
    }
  }

  browser.loadImage = function (src, options) {
    return new Promise(function (resolve, reject) {
      const image = Object.assign(document.createElement('img'), options)

      function cleanup() {
        image.onload = null
        image.onerror = null
      }

      image.onload = function () {
        cleanup()
        resolve(image)
      }
      image.onerror = function () {
        cleanup()
        reject(new Error('Failed to load the image "' + src + '"'))
      }

      image.src = src
    })
  }
  return browser
}

var browserExports = requireBrowser()
var Canvas = /*@__PURE__*/ getDefaultExportFromCjs(browserExports)

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i]
    if (last === '.') {
      parts.splice(i, 1)
    } else if (last === '..') {
      parts.splice(i, 1)
      up++
    } else if (up) {
      parts.splice(i, 1)
      up--
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..')
    }
  }

  return parts
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
  /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
var splitPath = function (filename) {
  return splitPathRe.exec(filename).slice(1)
}

// path.resolve([from ...], to)
// posix version
function resolve() {
  var resolvedPath = '',
    resolvedAbsolute = false

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = i >= 0 ? arguments[i] : '/'

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings')
    } else if (!path) {
      continue
    }

    resolvedPath = path + '/' + resolvedPath
    resolvedAbsolute = path.charAt(0) === '/'
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(
    filter(resolvedPath.split('/'), function (p) {
      return !!p
    }),
    !resolvedAbsolute
  ).join('/')

  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
}
// path.normalize(path)
// posix version
function normalize(path) {
  var isPathAbsolute = isAbsolute(path),
    trailingSlash = substr(path, -1) === '/'

  // Normalize the path
  path = normalizeArray(
    filter(path.split('/'), function (p) {
      return !!p
    }),
    !isPathAbsolute
  ).join('/')

  if (!path && !isPathAbsolute) {
    path = '.'
  }
  if (path && trailingSlash) {
    path += '/'
  }

  return (isPathAbsolute ? '/' : '') + path
}
// posix version
function isAbsolute(path) {
  return path.charAt(0) === '/'
}

// posix version
function join() {
  var paths = Array.prototype.slice.call(arguments, 0)
  return normalize(
    filter(paths, function (p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings')
      }
      return p
    }).join('/')
  )
}

// path.relative(from, to)
// posix version
function relative(from, to) {
  from = resolve(from).substr(1)
  to = resolve(to).substr(1)

  function trim(arr) {
    var start = 0
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break
    }

    var end = arr.length - 1
    for (; end >= 0; end--) {
      if (arr[end] !== '') break
    }

    if (start > end) return []
    return arr.slice(start, end - start + 1)
  }

  var fromParts = trim(from.split('/'))
  var toParts = trim(to.split('/'))

  var length = Math.min(fromParts.length, toParts.length)
  var samePartsLength = length
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i
      break
    }
  }

  var outputParts = []
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..')
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength))

  return outputParts.join('/')
}

var sep = '/'
var delimiter = ':'

function dirname(path) {
  var result = splitPath(path),
    root = result[0],
    dir = result[1]

  if (!root && !dir) {
    // No dirname whatsoever
    return '.'
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1)
  }

  return root + dir
}

function basename(path, ext) {
  var f = splitPath(path)[2]
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length)
  }
  return f
}

function extname(path) {
  return splitPath(path)[3]
}
var path = {
  extname: extname,
  basename: basename,
  dirname: dirname,
  sep: sep,
  delimiter: delimiter,
  relative: relative,
  join: join,
  isAbsolute: isAbsolute,
  normalize: normalize,
  resolve: resolve
}
function filter(xs, f) {
  if (xs.filter) return xs.filter(f)
  var res = []
  for (var i = 0; i < xs.length; i++) {
    if (f(xs[i], i, xs)) res.push(xs[i])
  }
  return res
}

// String.prototype.substr - negative index don't work in IE8
var substr =
  'ab'.substr(-1) === 'b'
    ? function (str, start, len) {
        return str.substr(start, len)
      }
    : function (str, start, len) {
        if (start < 0) start = str.length + start
        return str.substr(start, len)
      }
var qrLibLoader = async () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  //const useGlobal = isNode ? global : window;
  /**
   * Trick:
   * by using this dynamic argument on `import(pathStr)`
   * I prevent rollup commonJs plugin to detect and auto-process the imported js files
   *
   * Excluding the files on rollup configs is producing bugs elsewhere. This solves it well for all targets
   */
  const pathStr = isNode
    ? 'easyqrcodejs-nodejs'
    : '../../dist/easy.qrcode.min.js'
  //: 'https://cdn.jsdelivr.net/npm/easyqrcodejs@4.6.0/dist/easy.qrcode.min.js' //'json-url/dist/browser/json-url-single.js'
  if (isNode) {
    const _QRCode = await import(pathStr).then((d) => d?.default) //QRCode4Node //require('easyqrcodejs-nodejs')
    //const path = require('path')
    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options) => {
      // const canvas = require('canvas').createCanvas(options.width, options.height) //https://github.com/Automattic/node-canvas
      return new QRCode(options)
    }
    const renderQRCode = async (args) => {
      return new Promise(async (resolve) => {
        const options = {
          ...(args.style || {}),
          text: args.text
        }
        const qr = createQRCode(options)
        resolve({
          qr,
          qrCodeOptions: options,
          dataURL: await qr.toDataURL(),
          SVGText: await qr.toSVGText()
        })
      })
    }
    const registerFonts = (items) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = path.resolve(__dirname, file)
        // console.log(
        //   `Registering font '${fontPath}' (${
        //     def?.family || 'Unknown'
        //   }) on NodeJS Canvas...`
        // )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          throw new Error(
            `Error registering font '${fontPath}' (${
              def?.family || 'Unknown'
            }) on NodeJS Canvas. ${err}`
          )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }
    // return {
    //   _QRCode: {},
    //   QRCode: {},
    //   Canvas: {},
    //   createQRCode: () => {},
    //   renderQRCode: () => {},
    //   registerFonts: () => {}
    // }
  } else {
    //const _QRCode = await import('easyqrcodejs/dist/easy.qrcode.min.js').then(() => {
    //const _QRCode = await import('easyqrcodejs/src/easy.qrcode').then(() => {
    //WORKS but nodejs version breaks it on browser?
    //const _QRCode = await import('easyqrcodejs').then(() => {
    const _QRCode = await Promise.resolve()
      .then(function () {
        return easy_qrcode_min
      })
      .then(() => {
        return window?.QRCode
      })
    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options) => {
      const canvas = document.createElement('canvas')
      if (!canvas) throw new Error('canvas creation failed on browser')
      return new QRCode(canvas, options)
    }
    const renderQRCode = async (args) => {
      return new Promise(async (resolve) => {
        const qr = createQRCode({
          ...(args.style || {}),
          text: args.text,
          onRenderingEnd: (qrCodeOptions, dataURL) => {
            //console.dir({ dataURL, qrCodeOptions })
            resolve({ qr, qrCodeOptions, dataURL, SVGText: '' })
          }
        })
      })
    }
    //TODO: fix paths on browser by bundling the files. Maybe as a blob or dataURI?
    const registerFonts = (items) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = file
        // console.log(
        //   `Registering font '${fontPath}' (${
        //     def?.family || 'Unknown'
        //   }) on Browser Canvas...`
        // )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          // throw new Error(
          //   `Error registering font '${fontPath}' (${
          //     def?.family || 'Unknown'
          //   }) on Browser Canvas. ${err}`
          // )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }
    // return {
    //   _QRCode: {},
    //   QRCode: {},
    //   Canvas: {},
    //   createQRCode: () => {},
    //   renderQRCode: () => {},
    //   registerFonts: () => {}
    // }
  }
}
//Example wrapper for future reference
// class QRCode extends _QRCode {
//   private _htOption!: ObjectType
//   constructor(options: ObjectType) {
//     //const { width, height } = options
//     // const canvas = Canvas.createCanvas(width, height)
//     // if (!canvas) throw new Error('canvas creation failed on nodejs')
//     super(options)
//   }
//   changeStyles(styles: ObjectType) {
//     this._htOption = {
//       ...(this._htOption || {}),
//       ...styles
//     }
//   }
// }

const handler = {
  name: 'GameChanger Wallet QR transport. The URL transport encoded as QR code',
  encoder: async (obj, options) => {
    const { renderQRCode } = await qrLibLoader() //If turns into async, must be moved inside
    const url = await handler$1.encoder(obj, options)
    const qrResult = await renderQRCode({
      text: url,
      style: { ...(options?.qrCodeStyle || {}) }
    })
    const qrResultType = options?.qrResultType || 'png'
    const handlers = {
      png: async () => qrResult?.dataURL, //qr.toDataURL(),
      svg: async () =>
        `data:image/svg+xml;base64,${Buffer$1.from(
          qrResult?.SVGText /*await qr.toSVGText()*/
        ).toString('base64')}`
    }
    const res = await handlers[qrResultType]()
    //console.log({ qrResult, qrResultType, res })
    return res
  },
  decoder: async (/*msg: string ,_options?:any*/) => {
    throw new Error('Not implemented yet')
  }
}

var logoURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAa0AAAB1CAYAAAD9TL7BAAAe3UlEQVR4nO2dC5hU1ZXvf9V00zTNo5tHgyCvRhBR8AWIIoqAohM0DibxkagzmoeJJmYy95tMzBijGXW8j0n0mu86cydqTIwab27MVaNRxzdGRQQib1CR97u7gaZ5NF33W6vOOZzqelefqq7TrJ8fdtWpfc7ZZ5+q/T9r7bXXjswmGgWIkB3ZlCtmmSDPl025UmynbMqVYlsGeayw1snasvjHst9wuPv7sizLGYZhGEanY6JlGIZhhAYTLcMoEFFrWMMIHBMtwygQ2froDcPIHhMtwygQZmkZRvCYaBlGgTBLyzCCx0TLMAqEWVqGETwmWoZRIMzSMozgMdEyjAJhlpZhBI+JlmEUCLO0DCN4TLQMwzCM0GCiZRiGYYQGEy3DMAwjNJhoGYZhGKHBRMswDMMIDSZahmEYRmgw0TIMwzBCg4mWYRiGERpMtAzDMIzQUG63KndeoDdRokToFpo655OdoY1WTuNBRvK3acut4xEWcYu2R6QL54GI0qb/n80b9OPMtGU/4Nt8zMNE7CembRblCOfxS0bxhbQll3I/H3Bb0nbrSt8s+W2VUc5XaSqB2oQL+0XlQSv7QlfnfGllb8Y9pcwR9pfqJQROGwczHvIAO2k9htokG1ppzljqME3WbkZazD1opKWMyowNlE2ZrkQ21lM51fbFakcZ3TOW6UaPItfKCBsmWoZhGEZoMNEyMmALbBiGUTqYaBlpyWZMyzAMo1hYIEaAjODr9OYUorRmddBsoqGCipjK5zhHaGYQc/I+p4xhnMQ/UUEfJ/IumHp15DjZlJOoriaWs4aHOlirRKoZzkl8z4moiwYaERdxxtt28Gc+5Ykkn5cxkX+iB/1p40ja42R7vvj33WhhO0u4O8eaZ0a+Q6fxA8qpSvldyrX+mSjkcSSaMkzRx6WEiVaAjORm+jBRDxiUIAXVGQfZqWdLGRWM5/ai1CvI65Mye1hZINEayThuzak+2ZZzy/RlbFLRkhKncWdB21IEZQn3BO5WrqSG0/jHvOuVy+fZHifIMkb2mHswQA6wqctcSxCIJXGQ7aGs+342FuS4RzhQkOP6aWFrys+a2VDQc+/j04IcV+Y1HTZX9TEPJlqGYRhGmDDRMgwjJJijzTDRMgwjBEhwTAW97FYZFohRKjSzhvU8psEL+VCISCdJVzSEedRmyLNnGIXmIA0s4IdUUK3jW9l+hztCYaMH2zSacxI/KkLrdS1MtEqERhaxmn8uuXpVUGOiZXQ6EoSxWKMSuxYmWrlj7sESoRs9S7Je5fTJe9+IZiWsC7Q+xaInw0JZb8Po6pilZRSMNg6xhgeooG/KeTul5spBn+TKaGRpgEc0DCMoTLSMgiGitdg3kdYwDKOjmHuwRMhmjSbDMIxjHbO0SgQJeKhimI4DFROJVpQsDQfYnDGnm2F0FpKnr5qh+n3NFD2YiVKY7RXLO2nzzvLBRKtEGMAFzGZNwk+q0Ln5JKltCxt5hZM5zJ6QtJZxrFHFIOaxiEpqaeNw2qu33INdGxOtEkEsrEiSFYCLkVC2glr7aRklTUR/Hf20iplWQDbR6tqYaBkcYV/BFnuMdTCRUC0mKQ8QsnREpid6o3iIO03malXQ21r9GMdEyygY3ahiJu9QyQDtdJJRmkuTlLGDN5nPNVke1TCMYmGiFSDlIc2NVq7zqIJ3Ykjn35eJaYNLSnU9rd6MyfKIRjGIaAiGWVmGiVagHGQHrepqC9cikLLmVSEiB8W6OsTOUGbFOERjCdTCcBF37X62ZCVcYRjTiuUejJgQ54GJVoAs4lpd7rwUSffjEnFxxdYwSpEWtvFbTuwyYeKxh8QIX7OI3Zwx0QoQeRY0DCN4ohoWYysXG5YRwzAMwwgRJlqGYRhGaDDRMjKQzfyqVGXCnBaqo/PKOq9NUk0vKF6arlTXnrlNU9XdMFxMtIy0tGYxUJwq/ZPkNJSorzDSSkvKWst1ZeIAO5KW2M/mgrdG6qCaWMhNIUk3IftwFsE+FrVpZMICMfJgnK6gGtUknqkIw5LfmThCM3VclLHcIC7SIBSZTOwiSU3LqXLW0goftUxkInfp7CC39WKWSjSrOVxj+Sb9OJ1y3+KeIna9qC94WwxmBqfxY12C0422k/sh2UlkonchqWIwk7lPxUsiaSOOVMoyNYOZnvHMI7hc27yc6oTPSnHttXxD3ts4Qlma/sNI056ziUazbfxsy5XaHKUgj1WqectKrd7FPlZY62RtWfxj2W843P29uQcNwzCM0GCiZRiGYYQGG9PKg/lMc3Yq/Oz8VGeQcYKhXMlovhO3/QBb+YBrOOKshDyQmYznJwWvZ+zcW3iXL3lRaoOYzcncGVdGxr7e5SoOsqtTshu4Z5T268eZnMkDCWXe4cvsY11R6pfu/vZiJOfyeMJn7/MddrGwk7NDROlBf2bwZNy4nfAhd7CZVzqtfu44Wjcqmclv6MnguM+X8gBreapo9UuexikWJTmP+UWpQ1fCRCsPdvNOSdSjmhMStknwxA5e897HAgmKQyvN7ORt71z+wAwXGaDfzLNFq1M6DtGQ9NNNPFcSC2I2sjTp9i28QhMril6fZCSLFtzOfLaXyG9EvpPt2cFCtpVI/YzcMfdgiOmWdNHIcrrRw3tfzGS1sWixo1+pSgYmKVNGj3ZPvp1FVYp6VDG0JOrXM0U9UtW72Eg0YjJrpUeS+955JNbPXUzSCCdmaXWQbvSkgpqCTdxM5z6qLJHOqyP4w7ALOfk1trBjKwfZmdN5RIilfrH929p9FiRlarcc0PplP5cqooHtAyijvIiTh3Hcg3VZPfeKiInF39H65dLeMfdgD7plWOU4Vr/++gBY6PaTe3WQRlotR2mHMNHqIMdzHRP4eUJHU4ww0HTzxMJCP6ZwAW843UzqicgdDQcW8TlME88zRsfTskXmZP0VS7StC3GPI97fcr3+5zg1J9dfd2q5nJXOfLjsxC640OpIFu7nCHN5mz6ckFaMCxWmnY17fA5/YBBnF/w3LPf4TW5mGQ9lsZeRChOtDiJPc/LTjbR7oiv23IVCHiH7M+V+rjKfS7Ejk7WzObN08Lm2h0wAdTu+QtzjSNzrsjweRCLOdSXWL4g6BVFOLJlkv5Fczxl0vVwqqSnab7jc57o38sPGtDqIzPQvZZJlFigUPRme85GLmeYpNiifW267jriM8nlcyP180aTBBqWEK6qlyuEitt+REu8vwoBZWl2c3bzHau51oryC8dkn64xlZOUg2/JIeFpMS/DYfEaT9FHL+VcnZ2JZQC3eRnf6Mp5v67hkOt7je1QxyJuGkYygUyuJ+Ms41cncTHdqMpQv5veiayxi2ZmYaHVx9rKcZdxWsheZqcMLklgI/rEnXDLw/yE/LMixx/JVuqe9h1GWcX9Bzp0No7kqo2j1KHA+Rj8VRfR8dFVMtIxOpZHF/FknJKe30IIY24tyWIMxjjUiOjJXmdbSyQcJvS9l61XGB7MZI3yDG6mkf17L0eTyvZS2kjliRscw0TI6FQlB38DTdhMKSjRwwQoDctXZjBFu4tVjrm3CjIlWF2cA5zOOH2X9FJl/xFRE0zi9z7UBLKBoBEkFvZnDazqmJZGQ+UcPRniP79LARznULsIMfkUVx6X9XgQ/phVbiqWaIQEe2SgFTLS6ONXUa/7B4ixFEGUB1+UUjCEukzLN7BEt8OTibvrkXerRnoVA5gfJGlsuHQl5F5dgbqIF9VyV0U3XmSHvIuQicOkWsMzteOW6flmy75q0g6wzZ1GE+WOi1UHK6V3S9Uu9im3wNPNZzsesZRLn8owKVjrRCmJysazC/DJnp8w5GEYi2kUWc3A/dytaHhZKeSL8RfyOQUyltd2K1PkKqYjgPtbzO85K+OxMbmMKd3GAXSU/VaFUMdHqIPtYTQPvEc3jyakjT5dtHKQn9WpJhZlyetFDXUcda6vsnq6PU/HqSsjT/GZecoQrO0s1v7aM6H8tbM+59T7jGaoZptZHvnXKtoxbLrYycAUDOTMuF2cyahiXNF9iR+pURR0DOJ39bGU/W7ztLeyggeXUMh40+MPIFROtDrKV3+u/zmAk3+C0kKeEiQbkksmG2JNtMfPzFZ5DNPEKc0q4hlFe5cpOO/vVfEJvRqUtc7AAlrdYwF/kQ9bzR57nc952SeEk/y7jZY5nduDnPRawjBghpizFM0fuE3yDI7tzR32vilvXaFbn7rz6xbvfMtevcwlDwE3nTuYVK24MV9GfCXHbV/M4q/l1p9UrzJhohZhkc46iOgB8NLxZFoUsFrGEo0c7MsmQkVg/yWR+dHsLm4t4A8SZttt7d8DntvGznw3eO//rYtDsO19zinPvT1HvYtOiGVASLdeWJPe9s0iWJkwy6fsp5HSAPtRzIU9wCt+K276SR3lFI22NXDH3YB7U8z3dqaMTKzvyDNhGC3VclLC9O/0Yyw9UGiQaqpYpHapjLnSnPyfyD3pekYcBnJ2wt4wvnMxdHGKXdih9OKlo9ZMoxVO4Q8VeBLYvJyctN4Efe2LVk2FFq59wKnd4YlWd4tzj+S6NLMs4VpOKIGwPucexJT0S6zCWG6lhvEbJBUluS5Mc0bolWzurni9qCqpuTtRqb0YGWs9kyPjWBG7x2qu4y8h0LSKzieqjcXFCooMvE+T5silXiu2UTblSbMsgjxXWOllbFv9Y9hsOd39v7kHDMAwjNJhoGYZhGKHBRMswDMMIDSZahmEYRmgw0TIMwzBCg4W8GznTyIfsZY0G7g7gXKo43hrR8NjBe+xjnaZSGsosXbXYMILCRMvImYXcRAMLdLcZvGWiZcTxOlezl0910xWsMNEyAsXcg0ZORDUXdiyLRSV11HKmNaDhIfkd3YwYfThB0xgZRpCYaBk50cwntLBJd+nNOLoFnPXACDctbKWV/XoNgznf7qYROOYeNJKyi/ls4vfsY42mq+rDKYzlv3CIRq94X05Juu82XmIX79DCRrXGjuMSBjCd/XxGA4u0zGDmqODt4j3NAVjFEPoxhWbWsZUXaeIjXUakltMZwqVUtlvGQdIsNbBQXw/lcv0ry/bL8aTT7MUoBnMxNe0SlWZLI39hG6/RxApNR9SfKRzHxXSnNuURWjUr4Etah4Ps0jRMg5nFQM5JKCvH3cMqutNbyzSxks/4Lc2s1/2GMpf+7azYPaymieWU0YOhXMxe1rKOp9QV15MhDONzDEiyhtPR+u1jEy+xk3f1PkobDWEWAzKk+pJr2cwrOlYl19iXExnChfRrd/93sYg1POq9P8we3a8fp9GDAb56NLOJl9nOuxxkN70YwVBmUpck7VcDy9jDGnpQp2tereTf9XoncXfKhNFG18bSOOVYrqungDnIVhZzC5v4XcJnvTiBXoxlK3/U92fwEPV8w/t8C8+xjNtpZHHCvqfzoArZen6j7+fRonnY/h+DOMh2ajmDIVzGCu5OWEFWhO8cnqLOt/ruIm5lNQ/o64ncw3qeVKFpz8nczgTuyrodRAj+wm2s5+mEzyoZyBn8D0Y5iU79x1rDQyzlbvazMWG/4VzBNH4dl6fvFWaxlVd1xdx6rmUtv0jYbzI/Yxy3eud6lcvYyLP6/gRuYC0PJ+xzBvcygX9M2L6CB1jKfexPkqB4NF/hXB71Fmr0X9cS/pnl3J+QZBbNMXgD0/jf+lAjYvZYisUov8Aq+jJWXy/nQZbwL+x3rHU/9XyJ8/llXDs9x/ls5U0q6KP5+7bwBj0ZzJf1OlKt/JUeS+MU8v7eRCu3cl35C9/Mp7zO2XHZ2asZpSLSkqQznsGbakEJq7iPj9p1lrElzI8ujimdmyQKlX0u4E21sJ5laJZLXES4lHX0ZLi+e4OL2MrLao1FfYsLtn+Pdv7/xmi+nrEdtvEqbzCXI7T4rqEiQUSn8zuGMc871nyuYR1PpK19HedyEW9573/PCLWq/CQ711/zKb0Yqef6A+PVQsu0z+WsVGvI5Q2+xDqfCLuJnv1JW4dzOTOddeEiTsLZl7iEzbwct1/7RK/HcwkX8Ud2s5hnOD3humUxxGuc79NrXMUnPJW2nQYznbm86dTvCE8ykuZ2373x3Mw0Hkx5DBOtYMoEeSzLPWgEjnQQb3OhJ1h1zOZ8lYZVzGEVk9tZCiJIfRz30EaejhOs0XyLWSzgYlZyHn+iLxN1u9vh1TjvY5bRUcGSLPFn8CCXsIKLWc4E7vFdZpTl3O293sNK51VMoMbybeawkM+ximk8TU9fRONizTyffmXpvazmVWZ5gjWaG5nDe8xlJRfwItW+TOBvcYVX73e5wROsKo5jCv+LS1nJXJZxMv/g7bOdt1nHk/q6mc/iLLJaJjKbl/i81v1Xce0srjycsaJ9fOJt78OJzOKPXM4qzuOpuCX3t/vE8S2+4gmWuOnO4wnmsZq/ZhXn8ojn7lzPM+zgz95+r3CZJ1g1nMz5PM48VnI5f+EkbvbKbeQF/Seuxuk8THdqdHsltUznUWbzB33/Btd7giWuzGk8xBdYyRUsYwJ/7x1vK2+xjv/r3JN1cYIlq/3O4DHO4Pa099Lo2phT2FBWcS/NfKyvj2Mu5zhuqBgVDOfLHGIHS/g73SJuQunwRAwWcL1XcjKPMcLnPhNLbSbTeJ5hHHJWiHVFTMatXKoYyoUsiFt6X5YtaWUvK7hX38tYETqetTFunauz+Q0juNp734t63fdFTlUxlqVImnSJ89NS3uz5XOW9nsQDKoL+483kJRZyqy4ZH1ttOcIO3uFjHtEy1QznEj5QF6LL6dyn40Gu60/GrEZylY5fuQIuQvdXLNCHgNi5RvEpv9Il9P2IheWu+1TJAOay0BOq2D5PsIFn4vbZwLN8wuP6up4vM91ZdNB9ou2j7t6RvMgF+l7EZyBns5ZfstFxAQ9kKp9jftwyPFN5UBfHbNIHhzYVFlnqYzTXMp+btIwI5Biu13Ot5znW8phul1WEL+P9uDGuKfx3bafVznjYJ9pO85zju3UdzTwWq2VpHNuYaOVBe/dTOOoc1Y7HHbfwI4tGruV+3SId4WR+lfQYg5nriVZfJ8DhMx7zrJMRXOcJlh85Zh0z2eiMk/Vx1rFq8o1BTebhOMFyGcnfeKLltntsYnOMkVzLcJ9guchaWRLEsZsPdIuIXyq28Z++AJEL4wTLpTdjmOF05C4LnbYQzuHXcYLlMpZveqLlLn4pVp3/c1ewXPzvJUAFtUqXetvGcGOcZYWuU3Z0nz6Oa3AJP/a2yb1fwk/0wSHibSvncJJ2Wcyd+lcCHS7gt0nXjTubnye4c0QkXYu2ry/U/UPu8F5fwJNxguUyjq97ouWOdzX6XKGn8L2UgiUPALHFHiPOdaWndFxjURPhPDDRyoOXnI6koxR7IfD+nMtUx/Xip4EPOOQMtA9kFhWOi6c9srCkSw2n6qtNvuONbrc6qx932XqJGKxxLJ49LNe/vRjN4CQLWranu7Ognxs1iAYkpD5nxPf1rtKxs+Rs8AWd1HNDxnrgRC/u4n19LQJZ54ztpbpuHPEWdjsCKQzivIR99jkTc8vU2TZeXzf4rNJBvoCUo/us814P5CwVo1186G37OMWDiJ/ejFbRcScGS91SLUSZjN2+h5B+zvdjL5949ahlAgOzWJTUdVnu9l1z/zRW8qc8zfwkDxodpRi/z79lexHO0rUw0coDcZOFkT2+TsCP6xbEcVelQkLRXWo4Q1/t93WWPRmRct+dzjiLRCBK592mAdGxJ2lxIaY+5wve6/5M1b+u9USalYUPsNUTNwneEBdfKvbFXUNqcfPT5AgujnsuGVEV9ee9TwYzU/82sET/ysq5fdut3HyQnRrBiIrICeoKxHc+sZT7tpuwKy25x7E+e1OvYucXxnJ6Uk4vtVT9IipP+fIvZqm0MpgZNPgsul45rugrqym71HrW9FGrsi9jUu67wXefJQwfJ4QeR7zd6MNktLCdAyH9TRq5Y6KVB+fwWiDHKW6UT5sGOiTf9+jXYLdjPbRHlsdfxb94W10Xnz+aTCYe92Bwwr4ruIeDTqfizu3aw1KOOJNQ9/jGLvzI565rELWCvqZ/9/rKN7E0qRW1iL/3oupG8pWUrUI715oISjKraQfz1Q0q7jWZr+UX9yZfZ+1HMoes4F+9LWP4hraXzM/CESWZf+SnkeXe2FWN01YiKK57sFoFOP7hQOZvHR0vjFlmbT4XdhWDmcfHOj9KLKkIES9gQgRPXGuH2KPHbfBZS35LzY9EPTbqPThCBb0Y5LRXg9MOYk27whpb0t49XuJUCPShYT1L+Zn3fix/o/VvdNpJxC6ZS9FlFF9UkUzmxkxGZ0ThJceW3M8HE6086J/EPdOeMIXL9nVcOWinuYjl/IjxvrlNu3mP97lahQvHcnE77Wrq2et0Lov5DufyQtzYzmp+ylJ+6L13Iw4bfB2ihNMv4AYm8R9ex9PIEt7nOm8caATX6LjSYRq9Th8dV7qF8/mTWhg4nfBH3M5nznwwsTBO8kXxJWMA57DRiXJbyp3qfnMFQybkLuGHrHLmhIml8wUaNAKyjEodDxR33gJuYbIvDFsi+CQUXuqDziW7Q91eu1ig4oETaNIevwVX4zwYiAVziCZn2/iEu+m3cNx95K875UBcdGt4mDHq+qzWvaVeH/B9tdCkjSfzUxWtAUzy3ffF/IV7mcgPvG0SZfgm13vXdQ4PqWhJIMUex6ryi4wEZPjr8S5/x1R+6h1vC6/zurZTbGztTO5Uu2ob73jjY/0yTBCXeVs9fQ9LYQ15N7LDRMtQq0nGu3bxtjbGCn7CFp7XYAtxs23jT04jxWbw9NbONvZTHM03PReeuOP+xDjqmKXWWywb/Kq4BnYDOJp8bih0XOIRdvKOZsWQ8bUtPndRL8Ywmf/Q1xIm3+ZYIuhT+lpeZAJDuEQFZQdv0cIW7/Pp/J4K+qa9yaP5Kku5S8VE3HMvcgZDuVQ7WzmefyLsRcyngt76WkLaP+In+no1P2cHb1PLqXr+Lb75TcOZx0QnKGK3T6xrk3TGjT4XrpvNwx+EUZMkC0lDkrGk2GjYd1nKf9X373Ajq/k3ajmFA2zXTBVHnDFK2dbfcffKw8g4bmIlD+n7hdymARZ9GKvivNWZQ4XOl/oO45zJ5eJWdK07VzhxQt8lpH2JYzEv42ds5XWtp+TFkHq41HMlp/Mjp52W+K55fLLbZhyjmGgZymQe53Wm6oRfnOVHGn0d7BA+z2bHGpHACZfjuJR6buITp5M7xG6dt+USC9goUwsO7SBjqYnccHcZ3xJ3UmwsZ1WCyEm6p6n8xstx2BgXJj+EFjarG3FDuwwePRjEWTzCIGZnvMES4DGDF3iNOeoCFLfihnYBKxJsIRGC/rD5idylgrLBmZQrrsUGX2eLCtv3Od3nVt3sE+NkltYGp43xCdBm31hi+/EsNFT9Wd/nRzv4M7lP6+eGr+/kff3nZyxf4xz+PW7bWfxP9rDWE5Tt/Fn/HSXCJLXAvu+7rqPi0378aRL3aCCJhL7juAnbuwpP5QdM9s3LW+8bCzTRMvx0q+fH+ghoGTGyK9dVZ9OLNTKc63QOkrjgjtCsbj6xmqbwBCO4Xh1v4g4cxY3610XmdUkQhoSVy75i8UgyXRmDOovHNXefHE8CKSSEXay1pdym5cXVeCEfEKFCBVPSAcl5B3K+pmA6lf+mguXWfx2PeoEY0/g/DOMKtQDkvJKTrx+TNPuFCJY7iTmbdqhmhI59yfiRuL5ECKVNZN7SidzKWfwiIUgjom7LK+nBQLXSDmkdylXgRnIlU/kFo7gmbh8RNWkPsVzG8g1vbAkd4ZCRqcU6BiXnPUHdeRHdxw1GGMtNVDpRlDhjihJ0IXUQ1564AP1h1DI/S7JStNKi1yXjWeJKHcZcpnA/JyWJuiujjBO4Tq0kaYdDek/LVTzquVonDQ/n83Ft2cBybbs+jGEsX6XamdztlhnNNeoyjFmzDdpOYuHVcxXn8QijuTKuDhKEUUG1XvN4vqVT2e03HMxxOuNYlsapE491rHzhJXAiZgX1zOlYIh7iJpKot1TlJJDiRcfKGMA0ZjpuyVhAwC66UZ0wD8k91n8ynZ1O+UtZ70UPiksxol17P9KRbZvL9cuYleS8S1fOj0iOXIMb8Zf7/Y2m3CuI74qMi4kwViWZT5buOHJdsqBj+2CIfOskSXJFbP3HswdPE61s62TuQSMpySbKZkOqOV5+9sQFGxwNAolorFldyv3aNMYttq+4Bv2pmirTRJflQz7Xny4DfHYUdsi+e4axvdT7dfS64qnM8GBhGOmw3ING0dnqBXbE1uTKFknjJGNmqGgdb3FZhnEMYpaWUXTESqpzJtrWOXnvskHGTKS8jMsM44t24wzjGMTGtHIsZ/5wuy/ZlrO2tOsL8nw2phXD3IOGYRhGaDDRMgzDMEKDiZZhGIYRGky0DMMwjNBgomUYhmGEBhMtwygQUWtYwwgcEy3DKBA29dkwgsdEyzAKhFlahhE8JlqGUSDM0jKM4DHRMowCYZaWYQSPiZZhFAiztAwjeEy0DKNAmKVlGMFjomUYBcIsLcMIHhMtwzAMIzSYaBmGYRjhAPj/DyUWjT5W+J8AAAAASUVORK5CYII='

var backgroundURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAAABmJLR0QA/wD/AP+gvaeTAAAZYklEQVR4nOzYMRKDMBAEQfBH/P9X4tQZBLLKV9Mdw+riOd/HdR1fzuPe3TdTNqbcaWP/Gzb+c2PKnTb2v2Fj/caUO23sf8PG+o0pd9pYvzHlThv73/jVxuvBPwAAAMBwAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAHzasQMBAAAAAEH+1oNcGAEMCAAAAAAYCEVwCpbh5pN9AAAAAElFTkSuQmCC'

var abstractFont = '15fda0823f200837.ttf'

const size = 1024
var stylesLoader = () => {
  // const logoURL = await resolveGlobal('../assets/images/dapp-logo-bg.png')
  // const backgroundURL = await resolveGlobal('../assets/images/background.png')
  const defaultTemplate = {
    text: '',
    width: size,
    height: size,
    colorDark: '#000000',
    colorLight: 'rgba(0,0,0,0)',
    drawer: 'canvas',
    logo: logoURL,
    logoWidth: 433,
    logoHeight: 118,
    dotScale: 1,
    logoBackgroundTransparent: true,
    backgroundImage: backgroundURL,
    autoColor: false,
    quietZone: 60
  }
  const styles = {
    //default: defaultTemplate,
    boxed: {
      ...defaultTemplate,
      quietZone: 60,
      quietZoneColor: 'rgba(0,0,0,0)',
      title: DefaultQRTitle,
      subTitle: DefaultQRSubTitle,
      titleTop: -25,
      subTitleTop: -8,
      titleHeight: 0,
      titleBackgroundColor: 'rgba(0,0,0,0)',
      titleColor: '#111111',
      subTitleColor: '#222222',
      titleFont: 'normal normal bold 12px Abstract',
      subTitleFont: 'normal normal bold 9px Abstract'
    },
    printable: {
      ...defaultTemplate,
      logo: undefined,
      logoWidth: undefined,
      logoHeight: undefined,
      colorDark: '#000000',
      colorLight: '#ffffff',
      backgroundImage: undefined,
      title: DefaultQRTitle,
      subTitle: DefaultQRSubTitle,
      quietZone: 60,
      quietZoneColor: 'rgba(0,0,0,0)',
      titleTop: -25,
      subTitleTop: -8,
      titleHeight: 0,
      titleBackgroundColor: '#ffffff',
      titleColor: '#000000',
      subTitleColor: '#000000',
      titleFont: 'normal normal bold 12px Abstract',
      subTitleFont: 'normal normal bold 9px Abstract'
    }
  }
  const fonts = [{ file: abstractFont, def: { family: 'Abstract' } }]
  return { styles, fonts }
}

//import { createReadStream, createWriteStream, } from 'fs'
var QREncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const obj = JSON.parse(input)
    const urlPattern = GCDappConnUrls[apiVersion][network]
    if (!urlPattern)
      throw new Error(`Missing URL pattern for network '${network || ''}'`)
    const { styles, fonts } = stylesLoader()
    const { registerFonts } = await qrLibLoader()
    registerFonts(fonts)
    const template =
      args?.template && styles[args?.template]
        ? args?.template
        : DefaultQRTemplate
    let style = styles[template]
    if (args?.styles) {
      try {
        style = {
          ...style,
          ...(JSON.parse(args?.styles) || {})
        }
      } catch (err) {
        throw new Error(`Error applying style layer over '${template}'. ${err}`)
      }
    }
    const dataURI = await handler.encoder(obj, {
      urlPattern,
      encoding,
      qrCodeStyle: style,
      qrResultType: args?.qrResultType
    })
    return dataURI
  } catch (err) {
    if (err instanceof Error)
      throw new Error('QR URL generation failed. ' + err?.message)
    else throw new Error('QR URL generation failed. ' + 'Unknown error')
  }
}

var encode = {
  url: URLEncoder,
  qr: QREncoder
}

const baseTemplate$2 = async (args) => {
  const urlPattern = GCDappConnUrls[args?.apiVersion][args?.network]
  if (!urlPattern)
    throw new Error(`Missing URL pattern for network '${args?.network || ''}'`)
  const url = await handler$1.encoder(JSON.parse(args?.input), {
    urlPattern,
    encoding: args?.encoding
  })
  //Generated with https://www.bestcssbuttongenerator.com/
  return `
<!--GC BUTTON START-->
<a href="${url}" class="gcConnectButton">Connect with GC</a>
<style>.gcConnectButton {box-shadow: 0px 0px 0px 2px #9fb4f2;
background:linear-gradient(to bottom, #7892c2 5%, #476e9e 100%);background-color:#7892c2;border-radius:25px;border:1px solid #4e6096;
display:inline-block;cursor:pointer;color:#ffffff;font-family:Arial;font-size:16px;font-weight:bold;padding:12px 37px;text-decoration:none;
text-shadow:0px 1px 0px #283966;}.gcConnectButton:hover {background:linear-gradient(to bottom, #476e9e 5%, #7892c2 100%);
background-color:#476e9e;}.gcConnectButton:active {position:relative;top:1px;}</style>
<!--GC BUTTON END-->
`
}
var ButtonEncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const text = await baseTemplate$2({
      apiVersion,
      network,
      encoding,
      input,
      qrResultType: args?.qrResultType,
      outputFile: args?.outputFile,
      template: args?.template,
      styles: args?.styles
    })
    return `data:text/html;base64,${Buffer.from(text).toString('base64')}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
// For importing on html document:
// Install:
//   $ npm install -s gamechanger
//     or
//   copy host individual file 'dist/browser.min.js'
// Load:
//   \\<script src='dist/browser.min.js'\\>\\</script\\>
// Use:
//   const {gc} = window;
// For webpack projects like using create-react-app:
// Install:
//   $ npm install -s gamechanger
// Use:
//   import {gc} from 'gamechanger'

// import { GCDappConnUrls } from '../../config'
// import urlEncoder from '../../encodings/url'
const AstonMaartenTemplate = (args) => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const strProp = (str) =>
    str === undefined ? 'undefined' : JSON.stringify(str)
  const origin =
    GCDomains[args?.apiVersion || DefaultAPIVersion][
      args?.network || DefaultNetwork
    ]
  const gcscript = JSON.parse(args?.input)
  const _title = gcscript?.title || 'Cardano HTML5 Dapp Boilerplate'
  const _description =
    gcscript?.description ||
    `Cardano HTML5 Dapp Boilerplate, created with ${
      isNode ? 'gamechanger-cli' : 'gamechanger lib'
    }. Using Aston Maarten template.`
  const cfg = {
    domain: origin,
    apiDocRelBasePath: 'doc/api/v2',
    contact
  }
  const encodings = apiEncodings[args?.apiVersion || DefaultAPIVersion]
  const returnURLTip =
    args?.apiVersion === '2'
      ? `//Head to ${cfg.domain}${cfg.apiDocRelBasePath}/api.html#returnURLPattern to learn ways how to customize this URL`
      : ''
  return `
<!DOCTYPE html>
<html lang="en">

<head>
<title>${_title}</title>
<meta name="title" content="${_title}">
<meta name="description" content="${_description}">

<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#6d41a1" />

<script src='dist/browser.min.js'></script>

<script>
  let handleSetEncoder;

  ///////////////////////////
  ////    Dapp Logic    /////
  ///////////////////////////
  async function main() {
      // import {gc,encodings} from '@gamechanger-finance/gc'
      const {gc,encodings} = window;

      //Dapp <--> GameChanger Wallet connections can use URL redirections
      let   actionUrl   = "";
      let   resultObj   = undefined;
      let   error       = ""; 
      let   useCodec    = ${strProp(args?.encoding)};

      //GameChanger Wallet is pure Web3, zero backend procesing of user data. 
      //Dapp connector links are fully processed on end-user browsers.
      const currentUrl  = window.location.href;

      //UI components:
      const connectForm = document.getElementById("dappConnectorBox");
      const actionBtn   = document.getElementById("connectBtn");
      const errorsBox   = document.getElementById("errorBox");
      const resultsBox  = document.getElementById("resultBox");
      const encodersBox = document.getElementById("encodersBox");

      //here we register a function to change connection encoding/compression
      handleSetEncoder=(codec)=>{
          useCodec=codec;
          updateUI();
          return false;
      }
      async function updateUI() {
          error="";
          actionUrl="";


          //GameChanger Wallet support arbitrary data returning from script execution, encoded in a redirect URL
          ${returnURLTip}

          //lets try to capture the execution results by decoding/decompressing the return URL
          try{                
              const resultRaw   = (new URL(currentUrl)).searchParams.get("result");
              if(resultRaw){
                  resultObj     = await encodings.msg.decoder(resultRaw);
                  //avoids current url carrying latest results all the time 
                  history.pushState({}, '', window.location.pathname);
              }
          }catch(err){
              error+=\`Failed to decode results.\${err?.message||"unknown error"}\`;
              console.error(err);
          }


          //This is the GCScript code, packed into a URL, that GameChanger Wallet will execute
          //lets try to generate this connection URL by encoding/compressing the gcscript code
          try{                
              //GCScript (dapp connector code) will be packed inside this URL    
              actionUrl   = await buildActionUrl(); 
          }catch(err){
              error+=\`Failed to build URL.\${err?.message||"unknown error"}\`
              console.error(err);
          }
          
          //Now lets render the current application state
          if(error){
              errorBox.innerHTML="Error: " + error;
          }
          if(actionUrl){
              errorBox.innerHTML="";
              actionBtn.href=actionUrl;
              actionBtn.innerHTML = \`Connect\`;
          }else{
              actionBtn.href      = '#';
              actionBtn.innerHTML = "Loading...";
          }

          if(resultObj){
              resultsBox.innerHTML=JSON.stringify(resultObj,null,2);
          }
          encodersBox.innerHTML="Encoding: "
          encodersBox.innerHTML+=${JSON.stringify(encodings)}
              .map(codec=>\`<a href="#" class="a-unstyled" \${codec===useCodec?'style="font-weight:bold;""':''} onclick="return handleSetEncoder('\${codec}')">\${codec}</a>\`)
              .join(" | ");               

      }

      async function buildActionUrl(args){
          //This is the GCScript code that GameChanger Wallet will execute
          //JSON code that will be encoded/compressed inside 'actionUrl'
          var gcscript = ${args.input};
          //This is a patch to adapt the return URL of the script to the origin that is hosting this html file.
          //so this way executed scripts data exports can be captured back on dapp side
          gcscript.returnURLPattern  = window.location.origin +  window.location.pathname ;
          const url=await gc.encode.url({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:useCodec,
          });
          return url;
      }

      updateUI();
  }


  window.onload = function () {
      main();
  }

</script>

<style>
  body {
      background: fixed;
      background-image: linear-gradient(to left top, #097790, #006c8a, #006184, #00567c, #0b4b74, #184878, #26457b, #35417c, #514187, #6f3e8d, #8d378e, #ab2b89);
      font-family: Arial, Helvetica, sans-serif;
      color: rgb(222, 222, 222);
      text-align: center;
      margin: 12px;
  }

  .box {
      background: #332f39;
      margin: auto;
      padding: 30px;
      border: thin solid black;
      border-radius: 30px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.11), 
        0 2px 2px rgba(0,0,0,0.2), 
        0 4px 4px rgba(0,0,0,0.2), 
        0 8px 8px rgba(0,0,0,0.2), 
        0 16px 16px rgba(0,0,0,0.2), 
        0 32px 32px rgba(0,0,0,0.15);
      max-width: 600px;
  }

  a:link {
      color: rgb(174, 47, 174);
  }

  /* visited link */
  a:visited {
      color: rgb(76, 122, 171);
  }

  /* mouse over link */
  a:hover {
      color: rgb(203, 64, 215);
  }

  /* selected link */
  a:active {
      color: blue;
  }
  #errorBox{
      color: #f58000;
      font-weight: bold;
  }
  .console {
      overflow: auto;
      text-align: left;
      background-color: rgb(30, 30, 30);
      color: green;
      min-height: 200px;
      padding: 8px;
      border-radius: 5px;
      box-shadow: inset 0 1px 1px rgba(0,0,0,0.11), 
      inset 5px 2px 2px 2px rgba(0,0,0,0.2), 
      inset 5px 4px 4px rgba(0,0,0,0.2), 
      inset  0 8px 8px rgba(0,0,0,0.2), 
      inset   0 16px 16px rgba(0,0,0,0.2), 
      inset  0 32px 32px rgba(0,0,0,0.15);
  }

  .flexrow {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 10px;
  }

  form{
      width: 100%;
  }
  .a-unstyled, .a-unstyled > *{
      color: inherit;
      text-decoration: none; 
  }
  .a-unstyled:link { color: inherit;text-decoration: none; }
  .a-unstyled:visited { color: inherit;text-decoration: none; }
  .a-unstyled:hover { color: inherit;text-decoration: none; }
  .a-unstyled:active { color: inherit;text-decoration: none; }
  .button {
      display:inline-block;
      background-color: #181818;
      color: rgb(222, 222, 222);
      border: thin solid white;
      width: 100%;
      margin: 10px 0px;
      padding-top: 20px;
      padding-bottom: 20px;
      font-size: 20px;
      font-weight: bold;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 1px 1px rgba(0,0,0,0.11), 
        0 2px 2px rgba(0,0,0,0.2), 
        0 4px 4px rgba(0,0,0,0.2), 
        0 8px 8px rgba(0,0,0,0.2), 
        0 16px 16px rgba(0,0,0,0.11);
      background-color:#734cad60;
  }
  .button:hover {
      background:linear-gradient(to bottom, #734cad 5%, #644b8a 100%);
      background-color:#734cad;
  }
  .button:active {
      position:relative;
      top:1px;
  }

  /* ===== Scrollbar CSS ===== */
  /* Firefox */
  * {
      scrollbar-width: 10px!important;
      scrollbar-color: gray rgb(30, 30, 30,0);
  }

  /* Chrome, Edge, and Safari */
  *::-webkit-scrollbar {
      width: 10px!important;
  }

  *::-webkit-scrollbar-track {
      background: rgb(30, 30, 30,0);
  }

  *::-webkit-scrollbar-thumb {
      background-color: gray;
      border-radius: 10px;
      border: 3px solid rgb(30, 30, 30,0);
  }
</style>
</head>

<body>
<div class="box">
  <h1>${_title}</h1>
  <p><i>${_description}</i></p>
   
      <div id="dappConnectorBox">
          <a href="#" id="connectBtn" class="button a-unstyled">
              Loading....
          </a>
      </div>

  <pre id="errorBox"  class="errors"></pre>
  <pre id="resultBox" class="console">Results will appear here after you connect with the wallet</pre>

  <pre id="encodersBox"></pre>

  <h6><i> 💪 Lets turn Cardano into the Blockchain of the Web! 💪 </i> </h6>

  <i>Generated with ❤️ 
  <br/>
  by <b>
      <a target="_blank" rel="noopener noreferrer" href="${origin}playground"> GameChanger Wallet Playground IDE</a>
  </b>
  <br/>
   2023 </i></p>
  </p>

  <h6 class="flexrow">
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.twitter
      }">Twitter News</a> 
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.discord
      }">Discord Support</a> 
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.youtube
      }">Youtube Tutorials</a>            
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.github
      }">Github Docs and examples</a>            
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.website
      }">Website</a>
  </h6>
</div>
</body>

</html>

`
}
var HtmlEncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const text = AstonMaartenTemplate({
      apiVersion,
      network,
      encoding,
      input,
      qrResultType: args?.qrResultType,
      outputFile: args?.outputFile,
      template: args?.template,
      styles: args?.styles
    })
    return `data:text/html;base64,${Buffer.from(text).toString('base64')}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
// For importing on html document:
// Install:
//   $ npm install -s gamechanger
//     or
//   copy host individual file 'dist/browser.min.js'
// Load:
//   \\<script src='dist/browser.min.js'\\>\\</script\\>
// Use:
//   const {gc} = window;
// For webpack projects like using create-react-app:
// Install:
//   $ npm install -s gamechanger
// Use:
//   import {gc} from 'gamechanger'

const baseTemplate$1 = async (args) => {
  const strProp = (str) =>
    str === undefined ? 'undefined' : JSON.stringify(str)
  return `
  //#!/usr/bin/env node

  //Install on project:
  //  $ npm install -s @gamechanger-finance/gc
  // or
  //Install globally:
  //  $ npm install -g @gamechanger-finance/gc
  //Run this file
  //  $ node <FILENAME>.js

  //Import if testing the library:
  //import { gc } from './dist/nodejs.js'
  // or
  //Import normally:
  import { gc } from '@gamechanger-finance/gc'

  import express from 'express';
  
  const gcscript=${args.input};
  
  export const serve = ({
      indexHtml,
      url,
      host = 'localhost',
      port = 3000,
      libPath = 'dist'
    }) => {
      const app = express()
      const routeDescriptions={
          '/dist':"Gamechanger library files",
          
          '/':"hosted output file",
      }
      app.use('/dist', express.static(libPath))
      if(url){
          app.get('/url', (req, res) => {
              res.status(301).redirect(url);
          });
          routeDescriptions['/url']="redirects user to dapp connection URL";
      }
      if(indexHtml){
          app.get('/', (req, res) => {
          res.send(indexHtml)
          });
          routeDescriptions['/']="Minimal home";
      }
      app.listen(port, () =>{
        console.info(
          \`\\n\\n🚀 Express NodeJs Backend serving output URL with the hosted Gamechanger library on http://\${host}:\${port}/\\n\`
        );
        console.info("Routes:")
        Object.entries(routeDescriptions).map(([route,description])=>{
          console.info(\`\t\${route}: \t\${description}\`)
        });
        console.info("\\n\\n")
      })
    }
  
  export const main= async()=>{
      const url=await gc.encode.url({
        input:JSON.stringify(gcscript),
        apiVersion:${strProp(args?.apiVersion)},
        network:${strProp(args?.network)},
        encoding:${strProp(args?.encoding)},
        });
      serve({url,indexHtml:\`<html><a href="/url">Click to get redirected to connect with GameChanger Wallet</a></html>\`})
  }
  
  main();
`
}
var ExpressEncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const text = await baseTemplate$1({
      apiVersion,
      network,
      encoding,
      input
    })
    return `data:application/javascript;base64,${Buffer.from(text).toString(
      'base64'
    )}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}

// import urlEncoder from '../../encodings/url'
const baseTemplate = (args) => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const title = 'Cardano React Dapp Boilerplate'
  const strProp = (str) =>
    str === undefined ? 'undefined' : JSON.stringify(str)
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset='UTF-8'>
    <title>${title}</title>
    <script src='https://unpkg.com/react@18.2.0/umd/react.production.min.js'></script>
    <script src='https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js'></script>
    <script src='https://unpkg.com/babel-standalone@6.26.0/babel.js'></script>
    <script src='dist/browser.min.js'></script>
    <style>
    * { margin: 0; background: #334d56; color: #fff; }
    body { padding: 30px; box-sizing: content-box; }
    span { font-size: 50px; margin: 10px; }
    .centered { text-align: center; }
    .qrImage { height:65vh; }
    </style>
  </head>
  <body>
    <div id='root'></div>

    <script type='text/babel'>
      // import {gc,encodings} from '@gamechanger-finance/gc'
      const {gc,encodings} = window;

      const App=()=>{
        const _gcscript=${args.input};
        //This is a patch to adapt the return URL of the script to the origin that is hosting this html file.
        //so this way executed scripts data exports can be captured back on the hosted dapp
        _gcscript.returnURLPattern = \`\${window.location.origin + window.location.pathname}?result={result}\`;
        const [gcscript,setGCscript]=React.useState(_gcscript);
        const [url,setUrl]=React.useState('');
        const [qr,setQr]  =React.useState('');
        const [result,setResult]  =React.useState(null);

        React.useEffect(()=>{
          const currentUrl = new URL(window.location.href);
          const msg        = currentUrl.searchParams.get("result");

          if(msg){
            encodings.msg.decoder(msg)
              .then(newResult=>{
                setResult(newResult);
                //avoids current url carrying latest results all the time
                window.history.pushState({}, '', window.location.pathname);
              })
              .catch(console.error)
          }

          gc.encode.url({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:${strProp(args?.encoding)},
          })
            .then(newUrl=>setUrl(newUrl))
            .catch(console.error)

          gc.encode.qr({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:${strProp(args?.encoding)},

            qrResultType:${strProp(args?.qrResultType)},
            outputFile:${strProp(args?.outputFile)},
            template:${strProp(args?.template)},
            styles:${strProp(args?.styles)},                        
          })
            .then(newQr=>setQr(newQr))
            .catch(console.error)

      },[gcscript]);

        return <div class="centered">
          <h1>${title}</h1>
          <br/>
          {result && <div>
            <h3>this is the response from the wallet:</h3>
            <pre style={{textAlign:"left"}}>{JSON.stringify(result,null,2)}</pre>
            <br/>
            <a href="#" onClick={()=>setResult(null)}><h2>Reset</h2></a>
          </div>}
          {!result && <div>
            <h3>connect with wallet by clicking on this link:</h3>
            <a href={url}><h2>Connect</h2></a>
            <br/><br/>
            <h3>or by scanning the QR code with wallet or mobile camera:</h3>
            <img class="qrImage" src={qr}/>
          </div>}
          <br/><br/>
          <i>Created with <a href="#">${
            isNode ? 'gamechanger-cli' : 'gamechanger lib'
          }</a></i>
        </div>
      }
      ReactDOM.render(<App />, document.querySelector('#root'));
    </script>
  </body>
</html>  
`
}
var ReactEncoder = async (args) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)
    const text = baseTemplate({
      apiVersion,
      network,
      encoding,
      input,
      qrResultType: args?.qrResultType,
      outputFile: args?.outputFile,
      template: args?.template,
      styles: args?.styles
    })
    return `data:text/html;base64,${Buffer.from(text).toString('base64')}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
// For importing on html document:
// Install:
//   $ npm install -s gamechanger
//     or
//   copy host individual file 'dist/browser.min.js'
// Load:
//   \\<script src='dist/browser.min.js'\\>\\</script\\>
// Use:
//   const {gc} = window;
// For webpack projects like using create-react-app:
// Install:
//   $ npm install -s gamechanger
// Use:
//   import {gc} from 'gamechanger'

var snippet = {
  button: ButtonEncoder,
  html: HtmlEncoder,
  express: ExpressEncoder,
  react: ReactEncoder
}

var _handlers = {
  encode,
  snippet
}
// import { ActionHandlerType} from '../types';
// import URLEncoder from './encode/url';
// import QREncoder  from './encode/qr';
// import ButtonEncoder  from './encode/button';
// import HtmlEncoder  from './encode/html';
// import ReactEncoder  from './encode/react';
// import ExpressEncoder  from './encode/express';
// export const actionsHandlerLoaders: ActionHandlerLoaderType = {
// 	encode: {
// 		'url': ()=>import(`./encode/url`).then(d=>d?.default),
// 		'qr' : ()=>import(`./encode/qr`) .then(d=>d?.default),
// 	},
// };
//export const handlers: ActionHandlerType = {

const baseEncodings = {
  gzip: handler$6,
  'json-url-lzma': handler$5,
  'json-url-lzw': handler$4,
  base64url: handler$3
}
var _encodings = {
  ...baseEncodings,
  msg: handler$2,
  url: handler$1,
  qr: handler
}

const encodings = _encodings
const gc = _handlers
const config = {
  usageMessage,
  QRRenderTypes,
  GCDomains,
  contact
}
const _testDeps = testDeps
//TODO: check https://github.com/knightedcodemonkey/duel

var jsonUrl = () => {
  return Promise.resolve()
    .then(function () {
      return jsonUrlSingle$1
    })
    .then((jsonUrlLib) => {
      return jsonUrlLib.default
    })
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

var jsonUrl$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  default: jsonUrl
})

var lzma_worker = {}

var hasRequiredLzma_worker

function requireLzma_worker() {
  if (hasRequiredLzma_worker) return lzma_worker
  hasRequiredLzma_worker = 1
  /// © 2015 Nathan Rugg <nmrugg@gmail.com> | MIT
  /// See LICENSE for more details.

  /* jshint noarg:true, boss:true, unused:strict, strict:true, undef:true, noarg: true, forin:true, evil:true, newcap:false, -W041, -W021, worker:true, browser:true, node:true */

  /* global setImmediate, setTimeout, window, onmessage */

  /** xs */
  ///NOTE: This is the master file that is used to generate lzma-c.js and lzma-d.js.
  ///      Comments are used to determine which parts are to be removed.
  ///
  /// cs-ce (compression start-end)
  /// ds-de (decompression start-end)
  /// xs-xe (only in this file start-end)
  /// co    (compression only)
  /// do    (decompression only)
  /** xe */

  var LZMA = (function () {
    var /** cs */
      action_compress = 1,
      /** ce */
      /** ds */
      action_decompress = 2,
      /** de */
      action_progress = 3,
      wait = typeof setImmediate == 'function' ? setImmediate : setTimeout,
      __4294967296 = 4294967296,
      N1_longLit = [4294967295, -__4294967296],
      /** cs */
      MIN_VALUE = [0, -9223372036854775808],
      /** ce */
      P0_longLit = [0, 0],
      P1_longLit = [1, 0]

    function update_progress(percent, cbn) {
      postMessage({
        action: action_progress,
        cbn: cbn,
        result: percent
      })
    }

    function initDim(len) {
      ///NOTE: This is MUCH faster than "new Array(len)" in newer versions of v8 (starting with Node.js 0.11.15, which uses v8 3.28.73).
      var a = []
      a[len - 1] = undefined
      return a
    }

    function add(a, b) {
      return create(a[0] + b[0], a[1] + b[1])
    }

    /** cs */
    function and(a, b) {
      return makeFromBits(
        ~~Math.max(Math.min(a[1] / __4294967296, 2147483647), -2147483648) &
          ~~Math.max(Math.min(b[1] / __4294967296, 2147483647), -2147483648),
        lowBits_0(a) & lowBits_0(b)
      )
    }
    /** ce */

    function compare(a, b) {
      var nega, negb
      if (a[0] == b[0] && a[1] == b[1]) {
        return 0
      }
      nega = a[1] < 0
      negb = b[1] < 0
      if (nega && !negb) {
        return -1
      }
      if (!nega && negb) {
        return 1
      }
      if (sub(a, b)[1] < 0) {
        return -1
      }
      return 1
    }

    function create(valueLow, valueHigh) {
      var diffHigh, diffLow
      valueHigh %= 1.8446744073709552e19
      valueLow %= 1.8446744073709552e19
      diffHigh = valueHigh % __4294967296
      diffLow = Math.floor(valueLow / __4294967296) * __4294967296
      valueHigh = valueHigh - diffHigh + diffLow
      valueLow = valueLow - diffLow + diffHigh
      while (valueLow < 0) {
        valueLow += __4294967296
        valueHigh -= __4294967296
      }
      while (valueLow > 4294967295) {
        valueLow -= __4294967296
        valueHigh += __4294967296
      }
      valueHigh = valueHigh % 1.8446744073709552e19
      while (valueHigh > 9223372032559808512) {
        valueHigh -= 1.8446744073709552e19
      }
      while (valueHigh < -9223372036854775808) {
        valueHigh += 1.8446744073709552e19
      }
      return [valueLow, valueHigh]
    }

    /** cs */
    function eq(a, b) {
      return a[0] == b[0] && a[1] == b[1]
    }
    /** ce */
    function fromInt(value) {
      if (value >= 0) {
        return [value, 0]
      } else {
        return [value + __4294967296, -__4294967296]
      }
    }

    function lowBits_0(a) {
      if (a[0] >= 2147483648) {
        return ~~Math.max(
          Math.min(a[0] - __4294967296, 2147483647),
          -2147483648
        )
      } else {
        return ~~Math.max(Math.min(a[0], 2147483647), -2147483648)
      }
    }
    /** cs */
    function makeFromBits(highBits, lowBits) {
      var high, low
      high = highBits * __4294967296
      low = lowBits
      if (lowBits < 0) {
        low += __4294967296
      }
      return [low, high]
    }

    function pwrAsDouble(n) {
      if (n <= 30) {
        return 1 << n
      } else {
        return pwrAsDouble(30) * pwrAsDouble(n - 30)
      }
    }

    function shl(a, n) {
      var diff, newHigh, newLow, twoToN
      n &= 63
      if (eq(a, MIN_VALUE)) {
        if (!n) {
          return a
        }
        return P0_longLit
      }
      if (a[1] < 0) {
        throw new Error('Neg')
      }
      twoToN = pwrAsDouble(n)
      newHigh = (a[1] * twoToN) % 1.8446744073709552e19
      newLow = a[0] * twoToN
      diff = newLow - (newLow % __4294967296)
      newHigh += diff
      newLow -= diff
      if (newHigh >= 9223372036854775807) {
        newHigh -= 1.8446744073709552e19
      }
      return [newLow, newHigh]
    }

    function shr(a, n) {
      var shiftFact
      n &= 63
      shiftFact = pwrAsDouble(n)
      return create(Math.floor(a[0] / shiftFact), a[1] / shiftFact)
    }

    function shru(a, n) {
      var sr
      n &= 63
      sr = shr(a, n)
      if (a[1] < 0) {
        sr = add(sr, shl([2, 0], 63 - n))
      }
      return sr
    }

    /** ce */

    function sub(a, b) {
      return create(a[0] - b[0], a[1] - b[1])
    }

    function $ByteArrayInputStream(this$static, buf) {
      this$static.buf = buf
      this$static.pos = 0
      this$static.count = buf.length
      return this$static
    }

    /** ds */
    function $read(this$static) {
      if (this$static.pos >= this$static.count) return -1
      return this$static.buf[this$static.pos++] & 255
    }
    /** de */
    /** cs */
    function $read_0(this$static, buf, off, len) {
      if (this$static.pos >= this$static.count) return -1
      len = Math.min(len, this$static.count - this$static.pos)
      arraycopy(this$static.buf, this$static.pos, buf, off, len)
      this$static.pos += len
      return len
    }
    /** ce */

    function $ByteArrayOutputStream(this$static) {
      this$static.buf = initDim(32)
      this$static.count = 0
      return this$static
    }

    function $toByteArray(this$static) {
      var data = this$static.buf
      data.length = this$static.count
      return data
    }

    /** cs */
    function $write(this$static, b) {
      this$static.buf[this$static.count++] = (b << 24) >> 24
    }
    /** ce */

    function $write_0(this$static, buf, off, len) {
      arraycopy(buf, off, this$static.buf, this$static.count, len)
      this$static.count += len
    }

    /** cs */
    function $getChars(this$static, srcBegin, srcEnd, dst, dstBegin) {
      var srcIdx
      for (srcIdx = srcBegin; srcIdx < srcEnd; ++srcIdx) {
        dst[dstBegin++] = this$static.charCodeAt(srcIdx)
      }
    }
    /** ce */

    function arraycopy(src, srcOfs, dest, destOfs, len) {
      for (var i = 0; i < len; ++i) {
        dest[destOfs + i] = src[srcOfs + i]
      }
    }

    /** cs */
    function $configure(this$static, encoder) {
      $SetDictionarySize_0(encoder, 1 << this$static.s)
      encoder._numFastBytes = this$static.f
      $SetMatchFinder(encoder, this$static.m)

      /// lc is always 3
      /// lp is always 0
      /// pb is always 2
      encoder._numLiteralPosStateBits = 0
      encoder._numLiteralContextBits = 3
      encoder._posStateBits = 2
      ///this$static._posStateMask = (1 << pb) - 1;
      encoder._posStateMask = 3
    }

    function $init(this$static, input, output, length_0, mode) {
      var encoder, i
      if (compare(length_0, N1_longLit) < 0)
        throw new Error('invalid length ' + length_0)
      this$static.length_0 = length_0
      encoder = $Encoder({})
      $configure(mode, encoder)
      encoder._writeEndMark = typeof LZMA.disableEndMark == 'undefined'
      $WriteCoderProperties(encoder, output)
      for (i = 0; i < 64; i += 8)
        $write(output, lowBits_0(shr(length_0, i)) & 255)
      this$static.chunker =
        ((encoder._needReleaseMFStream = 0),
        ((encoder._inStream = input),
        (encoder._finished = 0),
        $Create_2(encoder),
        (encoder._rangeEncoder.Stream = output),
        $Init_4(encoder),
        $FillDistancesPrices(encoder),
        $FillAlignPrices(encoder),
        (encoder._lenEncoder._tableSize = encoder._numFastBytes + 1 - 2),
        $UpdateTables(encoder._lenEncoder, 1 << encoder._posStateBits),
        (encoder._repMatchLenEncoder._tableSize =
          encoder._numFastBytes + 1 - 2),
        $UpdateTables(encoder._repMatchLenEncoder, 1 << encoder._posStateBits),
        (encoder.nowPos64 = P0_longLit),
        undefined),
        $Chunker_0({}, encoder))
    }

    function $LZMAByteArrayCompressor(this$static, data, mode) {
      this$static.output = $ByteArrayOutputStream({})
      $init(
        this$static,
        $ByteArrayInputStream({}, data),
        this$static.output,
        fromInt(data.length),
        mode
      )
      return this$static
    }
    /** ce */

    /** ds */
    function $init_0(this$static, input, output) {
      var decoder,
        hex_length = '',
        i,
        properties = [],
        r,
        tmp_length

      for (i = 0; i < 5; ++i) {
        r = $read(input)
        if (r == -1) throw new Error('truncated input')
        properties[i] = (r << 24) >> 24
      }

      decoder = $Decoder({})
      if (!$SetDecoderProperties(decoder, properties)) {
        throw new Error('corrupted input')
      }
      for (i = 0; i < 64; i += 8) {
        r = $read(input)
        if (r == -1) throw new Error('truncated input')
        r = r.toString(16)
        if (r.length == 1) r = '0' + r
        hex_length = r + '' + hex_length
      }

      /// Was the length set in the header (if it was compressed from a stream, the length is all f"s).
      if (/^0+$|^f+$/i.test(hex_length)) {
        /// The length is unknown, so set to -1.
        this$static.length_0 = N1_longLit
      } else {
        ///NOTE: If there is a problem with the decoder because of the length, you can always set the length to -1 (N1_longLit) which means unknown.
        tmp_length = parseInt(hex_length, 16)
        /// If the length is too long to handle, just set it to unknown.
        if (tmp_length > 4294967295) {
          this$static.length_0 = N1_longLit
        } else {
          this$static.length_0 = fromInt(tmp_length)
        }
      }

      this$static.chunker = $CodeInChunks(
        decoder,
        input,
        output,
        this$static.length_0
      )
    }

    function $LZMAByteArrayDecompressor(this$static, data) {
      this$static.output = $ByteArrayOutputStream({})
      $init_0(this$static, $ByteArrayInputStream({}, data), this$static.output)
      return this$static
    }
    /** de */
    /** cs */
    function $Create_4(
      this$static,
      keepSizeBefore,
      keepSizeAfter,
      keepSizeReserv
    ) {
      var blockSize
      this$static._keepSizeBefore = keepSizeBefore
      this$static._keepSizeAfter = keepSizeAfter
      blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv
      if (
        this$static._bufferBase == null ||
        this$static._blockSize != blockSize
      ) {
        this$static._bufferBase = null
        this$static._blockSize = blockSize
        this$static._bufferBase = initDim(this$static._blockSize)
      }
      this$static._pointerToLastSafePosition =
        this$static._blockSize - keepSizeAfter
    }

    function $GetIndexByte(this$static, index) {
      return this$static._bufferBase[
        this$static._bufferOffset + this$static._pos + index
      ]
    }

    function $GetMatchLen(this$static, index, distance, limit) {
      var i, pby
      if (this$static._streamEndWasReached) {
        if (this$static._pos + index + limit > this$static._streamPos) {
          limit = this$static._streamPos - (this$static._pos + index)
        }
      }
      ++distance
      pby = this$static._bufferOffset + this$static._pos + index
      for (
        i = 0;
        i < limit &&
        this$static._bufferBase[pby + i] ==
          this$static._bufferBase[pby + i - distance];
        ++i
      ) {}
      return i
    }

    function $GetNumAvailableBytes(this$static) {
      return this$static._streamPos - this$static._pos
    }

    function $MoveBlock(this$static) {
      var i, numBytes, offset
      offset =
        this$static._bufferOffset +
        this$static._pos -
        this$static._keepSizeBefore
      if (offset > 0) {
        --offset
      }
      numBytes = this$static._bufferOffset + this$static._streamPos - offset
      for (i = 0; i < numBytes; ++i) {
        this$static._bufferBase[i] = this$static._bufferBase[offset + i]
      }
      this$static._bufferOffset -= offset
    }

    function $MovePos_1(this$static) {
      var pointerToPostion
      ++this$static._pos
      if (this$static._pos > this$static._posLimit) {
        pointerToPostion = this$static._bufferOffset + this$static._pos
        if (pointerToPostion > this$static._pointerToLastSafePosition) {
          $MoveBlock(this$static)
        }
        $ReadBlock(this$static)
      }
    }

    function $ReadBlock(this$static) {
      var numReadBytes, pointerToPostion, size
      if (this$static._streamEndWasReached) return
      while (1) {
        size =
          -this$static._bufferOffset +
          this$static._blockSize -
          this$static._streamPos
        if (!size) return
        numReadBytes = $read_0(
          this$static._stream,
          this$static._bufferBase,
          this$static._bufferOffset + this$static._streamPos,
          size
        )
        if (numReadBytes == -1) {
          this$static._posLimit = this$static._streamPos
          pointerToPostion = this$static._bufferOffset + this$static._posLimit
          if (pointerToPostion > this$static._pointerToLastSafePosition) {
            this$static._posLimit =
              this$static._pointerToLastSafePosition - this$static._bufferOffset
          }
          this$static._streamEndWasReached = 1
          return
        }
        this$static._streamPos += numReadBytes
        if (
          this$static._streamPos >=
          this$static._pos + this$static._keepSizeAfter
        ) {
          this$static._posLimit =
            this$static._streamPos - this$static._keepSizeAfter
        }
      }
    }

    function $ReduceOffsets(this$static, subValue) {
      this$static._bufferOffset += subValue
      this$static._posLimit -= subValue
      this$static._pos -= subValue
      this$static._streamPos -= subValue
    }

    var CrcTable = (function () {
      var i,
        j,
        r,
        CrcTable = []
      for (i = 0; i < 256; ++i) {
        r = i
        for (j = 0; j < 8; ++j)
          if ((r & 1) != 0) {
            r = (r >>> 1) ^ -306674912
          } else {
            r >>>= 1
          }
        CrcTable[i] = r
      }
      return CrcTable
    })()

    function $Create_3(
      this$static,
      historySize,
      keepAddBufferBefore,
      matchMaxLen,
      keepAddBufferAfter
    ) {
      var cyclicBufferSize, hs, windowReservSize
      if (historySize < 1073741567) {
        this$static._cutValue = 16 + (matchMaxLen >> 1)
        windowReservSize =
          ~~(
            (historySize +
              keepAddBufferBefore +
              matchMaxLen +
              keepAddBufferAfter) /
            2
          ) + 256
        $Create_4(
          this$static,
          historySize + keepAddBufferBefore,
          matchMaxLen + keepAddBufferAfter,
          windowReservSize
        )
        this$static._matchMaxLen = matchMaxLen
        cyclicBufferSize = historySize + 1
        if (this$static._cyclicBufferSize != cyclicBufferSize) {
          this$static._son = initDim(
            (this$static._cyclicBufferSize = cyclicBufferSize) * 2
          )
        }

        hs = 65536
        if (this$static.HASH_ARRAY) {
          hs = historySize - 1
          hs |= hs >> 1
          hs |= hs >> 2
          hs |= hs >> 4
          hs |= hs >> 8
          hs >>= 1
          hs |= 65535
          if (hs > 16777216) hs >>= 1
          this$static._hashMask = hs
          ++hs
          hs += this$static.kFixHashSize
        }

        if (hs != this$static._hashSizeSum) {
          this$static._hash = initDim((this$static._hashSizeSum = hs))
        }
      }
    }

    function $GetMatches(this$static, distances) {
      var count,
        cur,
        curMatch,
        curMatch2,
        curMatch3,
        cyclicPos,
        delta,
        hash2Value,
        hash3Value,
        hashValue,
        len,
        len0,
        len1,
        lenLimit,
        matchMinPos,
        maxLen,
        offset,
        pby1,
        ptr0,
        ptr1,
        temp
      if (
        this$static._pos + this$static._matchMaxLen <=
        this$static._streamPos
      ) {
        lenLimit = this$static._matchMaxLen
      } else {
        lenLimit = this$static._streamPos - this$static._pos
        if (lenLimit < this$static.kMinMatchCheck) {
          $MovePos_0(this$static)
          return 0
        }
      }
      offset = 0
      matchMinPos =
        this$static._pos > this$static._cyclicBufferSize
          ? this$static._pos - this$static._cyclicBufferSize
          : 0
      cur = this$static._bufferOffset + this$static._pos
      maxLen = 1
      hash2Value = 0
      hash3Value = 0
      if (this$static.HASH_ARRAY) {
        temp =
          CrcTable[this$static._bufferBase[cur] & 255] ^
          (this$static._bufferBase[cur + 1] & 255)
        hash2Value = temp & 1023
        temp ^= (this$static._bufferBase[cur + 2] & 255) << 8
        hash3Value = temp & 65535
        hashValue =
          (temp ^ (CrcTable[this$static._bufferBase[cur + 3] & 255] << 5)) &
          this$static._hashMask
      } else {
        hashValue =
          (this$static._bufferBase[cur] & 255) ^
          ((this$static._bufferBase[cur + 1] & 255) << 8)
      }

      curMatch = this$static._hash[this$static.kFixHashSize + hashValue] || 0
      if (this$static.HASH_ARRAY) {
        curMatch2 = this$static._hash[hash2Value] || 0
        curMatch3 = this$static._hash[1024 + hash3Value] || 0
        this$static._hash[hash2Value] = this$static._pos
        this$static._hash[1024 + hash3Value] = this$static._pos
        if (curMatch2 > matchMinPos) {
          if (
            this$static._bufferBase[this$static._bufferOffset + curMatch2] ==
            this$static._bufferBase[cur]
          ) {
            distances[offset++] = maxLen = 2
            distances[offset++] = this$static._pos - curMatch2 - 1
          }
        }
        if (curMatch3 > matchMinPos) {
          if (
            this$static._bufferBase[this$static._bufferOffset + curMatch3] ==
            this$static._bufferBase[cur]
          ) {
            if (curMatch3 == curMatch2) {
              offset -= 2
            }
            distances[offset++] = maxLen = 3
            distances[offset++] = this$static._pos - curMatch3 - 1
            curMatch2 = curMatch3
          }
        }
        if (offset != 0 && curMatch2 == curMatch) {
          offset -= 2
          maxLen = 1
        }
      }
      this$static._hash[this$static.kFixHashSize + hashValue] = this$static._pos
      ptr0 = (this$static._cyclicBufferPos << 1) + 1
      ptr1 = this$static._cyclicBufferPos << 1
      len0 = len1 = this$static.kNumHashDirectBytes
      if (this$static.kNumHashDirectBytes != 0) {
        if (curMatch > matchMinPos) {
          if (
            this$static._bufferBase[
              this$static._bufferOffset +
                curMatch +
                this$static.kNumHashDirectBytes
            ] != this$static._bufferBase[cur + this$static.kNumHashDirectBytes]
          ) {
            distances[offset++] = maxLen = this$static.kNumHashDirectBytes
            distances[offset++] = this$static._pos - curMatch - 1
          }
        }
      }
      count = this$static._cutValue
      while (1) {
        if (curMatch <= matchMinPos || count-- == 0) {
          this$static._son[ptr0] = this$static._son[ptr1] = 0
          break
        }
        delta = this$static._pos - curMatch
        cyclicPos =
          (delta <= this$static._cyclicBufferPos
            ? this$static._cyclicBufferPos - delta
            : this$static._cyclicBufferPos -
              delta +
              this$static._cyclicBufferSize) << 1
        pby1 = this$static._bufferOffset + curMatch
        len = len0 < len1 ? len0 : len1
        if (
          this$static._bufferBase[pby1 + len] ==
          this$static._bufferBase[cur + len]
        ) {
          while (++len != lenLimit) {
            if (
              this$static._bufferBase[pby1 + len] !=
              this$static._bufferBase[cur + len]
            ) {
              break
            }
          }
          if (maxLen < len) {
            distances[offset++] = maxLen = len
            distances[offset++] = delta - 1
            if (len == lenLimit) {
              this$static._son[ptr1] = this$static._son[cyclicPos]
              this$static._son[ptr0] = this$static._son[cyclicPos + 1]
              break
            }
          }
        }
        if (
          (this$static._bufferBase[pby1 + len] & 255) <
          (this$static._bufferBase[cur + len] & 255)
        ) {
          this$static._son[ptr1] = curMatch
          ptr1 = cyclicPos + 1
          curMatch = this$static._son[ptr1]
          len1 = len
        } else {
          this$static._son[ptr0] = curMatch
          ptr0 = cyclicPos
          curMatch = this$static._son[ptr0]
          len0 = len
        }
      }
      $MovePos_0(this$static)
      return offset
    }

    function $Init_5(this$static) {
      this$static._bufferOffset = 0
      this$static._pos = 0
      this$static._streamPos = 0
      this$static._streamEndWasReached = 0
      $ReadBlock(this$static)
      this$static._cyclicBufferPos = 0
      $ReduceOffsets(this$static, -1)
    }

    function $MovePos_0(this$static) {
      var subValue
      if (++this$static._cyclicBufferPos >= this$static._cyclicBufferSize) {
        this$static._cyclicBufferPos = 0
      }
      $MovePos_1(this$static)
      if (this$static._pos == 1073741823) {
        subValue = this$static._pos - this$static._cyclicBufferSize
        $NormalizeLinks(
          this$static._son,
          this$static._cyclicBufferSize * 2,
          subValue
        )
        $NormalizeLinks(this$static._hash, this$static._hashSizeSum, subValue)
        $ReduceOffsets(this$static, subValue)
      }
    }

    ///NOTE: This is only called after reading one whole gigabyte.
    function $NormalizeLinks(items, numItems, subValue) {
      var i, value
      for (i = 0; i < numItems; ++i) {
        value = items[i] || 0
        if (value <= subValue) {
          value = 0
        } else {
          value -= subValue
        }
        items[i] = value
      }
    }

    function $SetType(this$static, numHashBytes) {
      this$static.HASH_ARRAY = numHashBytes > 2
      if (this$static.HASH_ARRAY) {
        this$static.kNumHashDirectBytes = 0
        this$static.kMinMatchCheck = 4
        this$static.kFixHashSize = 66560
      } else {
        this$static.kNumHashDirectBytes = 2
        this$static.kMinMatchCheck = 3
        this$static.kFixHashSize = 0
      }
    }

    function $Skip(this$static, num) {
      var count,
        cur,
        curMatch,
        cyclicPos,
        delta,
        hash2Value,
        hash3Value,
        hashValue,
        len,
        len0,
        len1,
        lenLimit,
        matchMinPos,
        pby1,
        ptr0,
        ptr1,
        temp
      do {
        if (
          this$static._pos + this$static._matchMaxLen <=
          this$static._streamPos
        ) {
          lenLimit = this$static._matchMaxLen
        } else {
          lenLimit = this$static._streamPos - this$static._pos
          if (lenLimit < this$static.kMinMatchCheck) {
            $MovePos_0(this$static)
            continue
          }
        }
        matchMinPos =
          this$static._pos > this$static._cyclicBufferSize
            ? this$static._pos - this$static._cyclicBufferSize
            : 0
        cur = this$static._bufferOffset + this$static._pos
        if (this$static.HASH_ARRAY) {
          temp =
            CrcTable[this$static._bufferBase[cur] & 255] ^
            (this$static._bufferBase[cur + 1] & 255)
          hash2Value = temp & 1023
          this$static._hash[hash2Value] = this$static._pos
          temp ^= (this$static._bufferBase[cur + 2] & 255) << 8
          hash3Value = temp & 65535
          this$static._hash[1024 + hash3Value] = this$static._pos
          hashValue =
            (temp ^ (CrcTable[this$static._bufferBase[cur + 3] & 255] << 5)) &
            this$static._hashMask
        } else {
          hashValue =
            (this$static._bufferBase[cur] & 255) ^
            ((this$static._bufferBase[cur + 1] & 255) << 8)
        }
        curMatch = this$static._hash[this$static.kFixHashSize + hashValue]
        this$static._hash[this$static.kFixHashSize + hashValue] =
          this$static._pos
        ptr0 = (this$static._cyclicBufferPos << 1) + 1
        ptr1 = this$static._cyclicBufferPos << 1
        len0 = len1 = this$static.kNumHashDirectBytes
        count = this$static._cutValue
        while (1) {
          if (curMatch <= matchMinPos || count-- == 0) {
            this$static._son[ptr0] = this$static._son[ptr1] = 0
            break
          }
          delta = this$static._pos - curMatch
          cyclicPos =
            (delta <= this$static._cyclicBufferPos
              ? this$static._cyclicBufferPos - delta
              : this$static._cyclicBufferPos -
                delta +
                this$static._cyclicBufferSize) << 1
          pby1 = this$static._bufferOffset + curMatch
          len = len0 < len1 ? len0 : len1
          if (
            this$static._bufferBase[pby1 + len] ==
            this$static._bufferBase[cur + len]
          ) {
            while (++len != lenLimit) {
              if (
                this$static._bufferBase[pby1 + len] !=
                this$static._bufferBase[cur + len]
              ) {
                break
              }
            }
            if (len == lenLimit) {
              this$static._son[ptr1] = this$static._son[cyclicPos]
              this$static._son[ptr0] = this$static._son[cyclicPos + 1]
              break
            }
          }
          if (
            (this$static._bufferBase[pby1 + len] & 255) <
            (this$static._bufferBase[cur + len] & 255)
          ) {
            this$static._son[ptr1] = curMatch
            ptr1 = cyclicPos + 1
            curMatch = this$static._son[ptr1]
            len1 = len
          } else {
            this$static._son[ptr0] = curMatch
            ptr0 = cyclicPos
            curMatch = this$static._son[ptr0]
            len0 = len
          }
        }
        $MovePos_0(this$static)
      } while (--num != 0)
    }

    /** ce */
    /** ds */
    function $CopyBlock(this$static, distance, len) {
      var pos = this$static._pos - distance - 1
      if (pos < 0) {
        pos += this$static._windowSize
      }
      for (; len != 0; --len) {
        if (pos >= this$static._windowSize) {
          pos = 0
        }
        this$static._buffer[this$static._pos++] = this$static._buffer[pos++]
        if (this$static._pos >= this$static._windowSize) {
          $Flush_0(this$static)
        }
      }
    }

    function $Create_5(this$static, windowSize) {
      if (
        this$static._buffer == null ||
        this$static._windowSize != windowSize
      ) {
        this$static._buffer = initDim(windowSize)
      }
      this$static._windowSize = windowSize
      this$static._pos = 0
      this$static._streamPos = 0
    }

    function $Flush_0(this$static) {
      var size = this$static._pos - this$static._streamPos
      if (!size) {
        return
      }
      $write_0(
        this$static._stream,
        this$static._buffer,
        this$static._streamPos,
        size
      )
      if (this$static._pos >= this$static._windowSize) {
        this$static._pos = 0
      }
      this$static._streamPos = this$static._pos
    }

    function $GetByte(this$static, distance) {
      var pos = this$static._pos - distance - 1
      if (pos < 0) {
        pos += this$static._windowSize
      }
      return this$static._buffer[pos]
    }

    function $PutByte(this$static, b) {
      this$static._buffer[this$static._pos++] = b
      if (this$static._pos >= this$static._windowSize) {
        $Flush_0(this$static)
      }
    }

    function $ReleaseStream(this$static) {
      $Flush_0(this$static)
      this$static._stream = null
    }
    /** de */

    function GetLenToPosState(len) {
      len -= 2
      if (len < 4) {
        return len
      }
      return 3
    }

    function StateUpdateChar(index) {
      if (index < 4) {
        return 0
      }
      if (index < 10) {
        return index - 3
      }
      return index - 6
    }

    /** cs */
    function $Chunker_0(this$static, encoder) {
      this$static.encoder = encoder
      this$static.decoder = null
      this$static.alive = 1
      return this$static
    }
    /** ce */
    /** ds */
    function $Chunker(this$static, decoder) {
      this$static.decoder = decoder
      this$static.encoder = null
      this$static.alive = 1
      return this$static
    }
    /** de */

    function $processChunk(this$static) {
      if (!this$static.alive) {
        throw new Error('bad state')
      }

      if (this$static.encoder) {
        /// do:throw new Error("No encoding");
        /** cs */
        $processEncoderChunk(this$static)
        /** ce */
      } else {
        /// co:throw new Error("No decoding");
        /** ds */
        $processDecoderChunk(this$static)
        /** de */
      }
      return this$static.alive
    }

    /** ds */
    function $processDecoderChunk(this$static) {
      var result = $CodeOneChunk(this$static.decoder)
      if (result == -1) {
        throw new Error('corrupted input')
      }
      this$static.inBytesProcessed = N1_longLit
      this$static.outBytesProcessed = this$static.decoder.nowPos64
      if (
        result ||
        (compare(this$static.decoder.outSize, P0_longLit) >= 0 &&
          compare(this$static.decoder.nowPos64, this$static.decoder.outSize) >=
            0)
      ) {
        $Flush_0(this$static.decoder.m_OutWindow)
        $ReleaseStream(this$static.decoder.m_OutWindow)
        this$static.decoder.m_RangeDecoder.Stream = null
        this$static.alive = 0
      }
    }
    /** de */
    /** cs */
    function $processEncoderChunk(this$static) {
      $CodeOneBlock(
        this$static.encoder,
        this$static.encoder.processedInSize,
        this$static.encoder.processedOutSize,
        this$static.encoder.finished
      )
      this$static.inBytesProcessed = this$static.encoder.processedInSize[0]
      if (this$static.encoder.finished[0]) {
        $ReleaseStreams(this$static.encoder)
        this$static.alive = 0
      }
    }
    /** ce */

    /** ds */
    function $CodeInChunks(this$static, inStream, outStream, outSize) {
      this$static.m_RangeDecoder.Stream = inStream
      $ReleaseStream(this$static.m_OutWindow)
      this$static.m_OutWindow._stream = outStream
      $Init_1(this$static)
      this$static.state = 0
      this$static.rep0 = 0
      this$static.rep1 = 0
      this$static.rep2 = 0
      this$static.rep3 = 0
      this$static.outSize = outSize
      this$static.nowPos64 = P0_longLit
      this$static.prevByte = 0
      return $Chunker({}, this$static)
    }

    function $CodeOneChunk(this$static) {
      var decoder2, distance, len, numDirectBits, posSlot, posState
      posState = lowBits_0(this$static.nowPos64) & this$static.m_PosStateMask
      if (
        !$DecodeBit(
          this$static.m_RangeDecoder,
          this$static.m_IsMatchDecoders,
          (this$static.state << 4) + posState
        )
      ) {
        decoder2 = $GetDecoder(
          this$static.m_LiteralDecoder,
          lowBits_0(this$static.nowPos64),
          this$static.prevByte
        )
        if (this$static.state < 7) {
          this$static.prevByte = $DecodeNormal(
            decoder2,
            this$static.m_RangeDecoder
          )
        } else {
          this$static.prevByte = $DecodeWithMatchByte(
            decoder2,
            this$static.m_RangeDecoder,
            $GetByte(this$static.m_OutWindow, this$static.rep0)
          )
        }
        $PutByte(this$static.m_OutWindow, this$static.prevByte)
        this$static.state = StateUpdateChar(this$static.state)
        this$static.nowPos64 = add(this$static.nowPos64, P1_longLit)
      } else {
        if (
          $DecodeBit(
            this$static.m_RangeDecoder,
            this$static.m_IsRepDecoders,
            this$static.state
          )
        ) {
          len = 0
          if (
            !$DecodeBit(
              this$static.m_RangeDecoder,
              this$static.m_IsRepG0Decoders,
              this$static.state
            )
          ) {
            if (
              !$DecodeBit(
                this$static.m_RangeDecoder,
                this$static.m_IsRep0LongDecoders,
                (this$static.state << 4) + posState
              )
            ) {
              this$static.state = this$static.state < 7 ? 9 : 11
              len = 1
            }
          } else {
            if (
              !$DecodeBit(
                this$static.m_RangeDecoder,
                this$static.m_IsRepG1Decoders,
                this$static.state
              )
            ) {
              distance = this$static.rep1
            } else {
              if (
                !$DecodeBit(
                  this$static.m_RangeDecoder,
                  this$static.m_IsRepG2Decoders,
                  this$static.state
                )
              ) {
                distance = this$static.rep2
              } else {
                distance = this$static.rep3
                this$static.rep3 = this$static.rep2
              }
              this$static.rep2 = this$static.rep1
            }
            this$static.rep1 = this$static.rep0
            this$static.rep0 = distance
          }
          if (!len) {
            len =
              $Decode(
                this$static.m_RepLenDecoder,
                this$static.m_RangeDecoder,
                posState
              ) + 2
            this$static.state = this$static.state < 7 ? 8 : 11
          }
        } else {
          this$static.rep3 = this$static.rep2
          this$static.rep2 = this$static.rep1
          this$static.rep1 = this$static.rep0
          len =
            2 +
            $Decode(
              this$static.m_LenDecoder,
              this$static.m_RangeDecoder,
              posState
            )
          this$static.state = this$static.state < 7 ? 7 : 10
          posSlot = $Decode_0(
            this$static.m_PosSlotDecoder[GetLenToPosState(len)],
            this$static.m_RangeDecoder
          )
          if (posSlot >= 4) {
            numDirectBits = (posSlot >> 1) - 1
            this$static.rep0 = (2 | (posSlot & 1)) << numDirectBits
            if (posSlot < 14) {
              this$static.rep0 += ReverseDecode(
                this$static.m_PosDecoders,
                this$static.rep0 - posSlot - 1,
                this$static.m_RangeDecoder,
                numDirectBits
              )
            } else {
              this$static.rep0 +=
                $DecodeDirectBits(
                  this$static.m_RangeDecoder,
                  numDirectBits - 4
                ) << 4
              this$static.rep0 += $ReverseDecode(
                this$static.m_PosAlignDecoder,
                this$static.m_RangeDecoder
              )
              if (this$static.rep0 < 0) {
                if (this$static.rep0 == -1) {
                  return 1
                }
                return -1
              }
            }
          } else this$static.rep0 = posSlot
        }
        if (
          compare(fromInt(this$static.rep0), this$static.nowPos64) >= 0 ||
          this$static.rep0 >= this$static.m_DictionarySizeCheck
        ) {
          return -1
        }
        $CopyBlock(this$static.m_OutWindow, this$static.rep0, len)
        this$static.nowPos64 = add(this$static.nowPos64, fromInt(len))
        this$static.prevByte = $GetByte(this$static.m_OutWindow, 0)
      }
      return 0
    }

    function $Decoder(this$static) {
      this$static.m_OutWindow = {}
      this$static.m_RangeDecoder = {}
      this$static.m_IsMatchDecoders = initDim(192)
      this$static.m_IsRepDecoders = initDim(12)
      this$static.m_IsRepG0Decoders = initDim(12)
      this$static.m_IsRepG1Decoders = initDim(12)
      this$static.m_IsRepG2Decoders = initDim(12)
      this$static.m_IsRep0LongDecoders = initDim(192)
      this$static.m_PosSlotDecoder = initDim(4)
      this$static.m_PosDecoders = initDim(114)
      this$static.m_PosAlignDecoder = $BitTreeDecoder({}, 4)
      this$static.m_LenDecoder = $Decoder$LenDecoder({})
      this$static.m_RepLenDecoder = $Decoder$LenDecoder({})
      this$static.m_LiteralDecoder = {}
      for (var i = 0; i < 4; ++i) {
        this$static.m_PosSlotDecoder[i] = $BitTreeDecoder({}, 6)
      }
      return this$static
    }

    function $Init_1(this$static) {
      this$static.m_OutWindow._streamPos = 0
      this$static.m_OutWindow._pos = 0
      InitBitModels(this$static.m_IsMatchDecoders)
      InitBitModels(this$static.m_IsRep0LongDecoders)
      InitBitModels(this$static.m_IsRepDecoders)
      InitBitModels(this$static.m_IsRepG0Decoders)
      InitBitModels(this$static.m_IsRepG1Decoders)
      InitBitModels(this$static.m_IsRepG2Decoders)
      InitBitModels(this$static.m_PosDecoders)
      $Init_0(this$static.m_LiteralDecoder)
      for (var i = 0; i < 4; ++i) {
        InitBitModels(this$static.m_PosSlotDecoder[i].Models)
      }
      $Init(this$static.m_LenDecoder)
      $Init(this$static.m_RepLenDecoder)
      InitBitModels(this$static.m_PosAlignDecoder.Models)
      $Init_8(this$static.m_RangeDecoder)
    }

    function $SetDecoderProperties(this$static, properties) {
      var dictionarySize, i, lc, lp, pb, remainder, val
      if (properties.length < 5) return 0
      val = properties[0] & 255
      lc = val % 9
      remainder = ~~(val / 9)
      lp = remainder % 5
      pb = ~~(remainder / 5)
      dictionarySize = 0
      for (i = 0; i < 4; ++i) {
        dictionarySize += (properties[1 + i] & 255) << (i * 8)
      }
      ///NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
      if (dictionarySize > 99999999 || !$SetLcLpPb(this$static, lc, lp, pb)) {
        return 0
      }
      return $SetDictionarySize(this$static, dictionarySize)
    }

    function $SetDictionarySize(this$static, dictionarySize) {
      if (dictionarySize < 0) {
        return 0
      }
      if (this$static.m_DictionarySize != dictionarySize) {
        this$static.m_DictionarySize = dictionarySize
        this$static.m_DictionarySizeCheck = Math.max(
          this$static.m_DictionarySize,
          1
        )
        $Create_5(
          this$static.m_OutWindow,
          Math.max(this$static.m_DictionarySizeCheck, 4096)
        )
      }
      return 1
    }

    function $SetLcLpPb(this$static, lc, lp, pb) {
      if (lc > 8 || lp > 4 || pb > 4) {
        return 0
      }
      $Create_0(this$static.m_LiteralDecoder, lp, lc)
      var numPosStates = 1 << pb
      $Create(this$static.m_LenDecoder, numPosStates)
      $Create(this$static.m_RepLenDecoder, numPosStates)
      this$static.m_PosStateMask = numPosStates - 1
      return 1
    }

    function $Create(this$static, numPosStates) {
      for (
        ;
        this$static.m_NumPosStates < numPosStates;
        ++this$static.m_NumPosStates
      ) {
        this$static.m_LowCoder[this$static.m_NumPosStates] = $BitTreeDecoder(
          {},
          3
        )
        this$static.m_MidCoder[this$static.m_NumPosStates] = $BitTreeDecoder(
          {},
          3
        )
      }
    }

    function $Decode(this$static, rangeDecoder, posState) {
      if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 0)) {
        return $Decode_0(this$static.m_LowCoder[posState], rangeDecoder)
      }
      var symbol = 8
      if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 1)) {
        symbol += $Decode_0(this$static.m_MidCoder[posState], rangeDecoder)
      } else {
        symbol += 8 + $Decode_0(this$static.m_HighCoder, rangeDecoder)
      }
      return symbol
    }

    function $Decoder$LenDecoder(this$static) {
      this$static.m_Choice = initDim(2)
      this$static.m_LowCoder = initDim(16)
      this$static.m_MidCoder = initDim(16)
      this$static.m_HighCoder = $BitTreeDecoder({}, 8)
      this$static.m_NumPosStates = 0
      return this$static
    }

    function $Init(this$static) {
      InitBitModels(this$static.m_Choice)
      for (
        var posState = 0;
        posState < this$static.m_NumPosStates;
        ++posState
      ) {
        InitBitModels(this$static.m_LowCoder[posState].Models)
        InitBitModels(this$static.m_MidCoder[posState].Models)
      }
      InitBitModels(this$static.m_HighCoder.Models)
    }

    function $Create_0(this$static, numPosBits, numPrevBits) {
      var i, numStates
      if (
        this$static.m_Coders != null &&
        this$static.m_NumPrevBits == numPrevBits &&
        this$static.m_NumPosBits == numPosBits
      )
        return
      this$static.m_NumPosBits = numPosBits
      this$static.m_PosMask = (1 << numPosBits) - 1
      this$static.m_NumPrevBits = numPrevBits
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      this$static.m_Coders = initDim(numStates)
      for (i = 0; i < numStates; ++i)
        this$static.m_Coders[i] = $Decoder$LiteralDecoder$Decoder2({})
    }

    function $GetDecoder(this$static, pos, prevByte) {
      return this$static.m_Coders[
        ((pos & this$static.m_PosMask) << this$static.m_NumPrevBits) +
          ((prevByte & 255) >>> (8 - this$static.m_NumPrevBits))
      ]
    }

    function $Init_0(this$static) {
      var i, numStates
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      for (i = 0; i < numStates; ++i) {
        InitBitModels(this$static.m_Coders[i].m_Decoders)
      }
    }

    function $DecodeNormal(this$static, rangeDecoder) {
      var symbol = 1
      do {
        symbol =
          (symbol << 1) |
          $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol)
      } while (symbol < 256)
      return (symbol << 24) >> 24
    }

    function $DecodeWithMatchByte(this$static, rangeDecoder, matchByte) {
      var bit,
        matchBit,
        symbol = 1
      do {
        matchBit = (matchByte >> 7) & 1
        matchByte <<= 1
        bit = $DecodeBit(
          rangeDecoder,
          this$static.m_Decoders,
          ((1 + matchBit) << 8) + symbol
        )
        symbol = (symbol << 1) | bit
        if (matchBit != bit) {
          while (symbol < 256) {
            symbol =
              (symbol << 1) |
              $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol)
          }
          break
        }
      } while (symbol < 256)
      return (symbol << 24) >> 24
    }

    function $Decoder$LiteralDecoder$Decoder2(this$static) {
      this$static.m_Decoders = initDim(768)
      return this$static
    }

    /** de */
    /** cs */
    var g_FastPos = (function () {
      var j,
        k,
        slotFast,
        c = 2,
        g_FastPos = [0, 1]
      for (slotFast = 2; slotFast < 22; ++slotFast) {
        k = 1 << ((slotFast >> 1) - 1)
        for (j = 0; j < k; ++j, ++c) g_FastPos[c] = (slotFast << 24) >> 24
      }
      return g_FastPos
    })()

    function $Backward(this$static, cur) {
      var backCur, backMem, posMem, posPrev
      this$static._optimumEndIndex = cur
      posMem = this$static._optimum[cur].PosPrev
      backMem = this$static._optimum[cur].BackPrev
      do {
        if (this$static._optimum[cur].Prev1IsChar) {
          $MakeAsChar(this$static._optimum[posMem])
          this$static._optimum[posMem].PosPrev = posMem - 1
          if (this$static._optimum[cur].Prev2) {
            this$static._optimum[posMem - 1].Prev1IsChar = 0
            this$static._optimum[posMem - 1].PosPrev =
              this$static._optimum[cur].PosPrev2
            this$static._optimum[posMem - 1].BackPrev =
              this$static._optimum[cur].BackPrev2
          }
        }
        posPrev = posMem
        backCur = backMem
        backMem = this$static._optimum[posPrev].BackPrev
        posMem = this$static._optimum[posPrev].PosPrev
        this$static._optimum[posPrev].BackPrev = backCur
        this$static._optimum[posPrev].PosPrev = cur
        cur = posPrev
      } while (cur > 0)
      this$static.backRes = this$static._optimum[0].BackPrev
      this$static._optimumCurrentIndex = this$static._optimum[0].PosPrev
      return this$static._optimumCurrentIndex
    }

    function $BaseInit(this$static) {
      this$static._state = 0
      this$static._previousByte = 0
      for (var i = 0; i < 4; ++i) {
        this$static._repDistances[i] = 0
      }
    }

    function $CodeOneBlock(this$static, inSize, outSize, finished) {
      var baseVal,
        complexState,
        curByte,
        distance,
        footerBits,
        i,
        len,
        lenToPosState,
        matchByte,
        pos,
        posReduced,
        posSlot,
        posState,
        progressPosValuePrev,
        subCoder
      inSize[0] = P0_longLit
      outSize[0] = P0_longLit
      finished[0] = 1
      if (this$static._inStream) {
        this$static._matchFinder._stream = this$static._inStream
        $Init_5(this$static._matchFinder)
        this$static._needReleaseMFStream = 1
        this$static._inStream = null
      }
      if (this$static._finished) {
        return
      }
      this$static._finished = 1
      progressPosValuePrev = this$static.nowPos64
      if (eq(this$static.nowPos64, P0_longLit)) {
        if (!$GetNumAvailableBytes(this$static._matchFinder)) {
          $Flush(this$static, lowBits_0(this$static.nowPos64))
          return
        }
        $ReadMatchDistances(this$static)
        posState = lowBits_0(this$static.nowPos64) & this$static._posStateMask
        $Encode_3(
          this$static._rangeEncoder,
          this$static._isMatch,
          (this$static._state << 4) + posState,
          0
        )
        this$static._state = StateUpdateChar(this$static._state)
        curByte = $GetIndexByte(
          this$static._matchFinder,
          -this$static._additionalOffset
        )
        $Encode_1(
          $GetSubCoder(
            this$static._literalEncoder,
            lowBits_0(this$static.nowPos64),
            this$static._previousByte
          ),
          this$static._rangeEncoder,
          curByte
        )
        this$static._previousByte = curByte
        --this$static._additionalOffset
        this$static.nowPos64 = add(this$static.nowPos64, P1_longLit)
      }
      if (!$GetNumAvailableBytes(this$static._matchFinder)) {
        $Flush(this$static, lowBits_0(this$static.nowPos64))
        return
      }
      while (1) {
        len = $GetOptimum(this$static, lowBits_0(this$static.nowPos64))
        pos = this$static.backRes
        posState = lowBits_0(this$static.nowPos64) & this$static._posStateMask
        complexState = (this$static._state << 4) + posState
        if (len == 1 && pos == -1) {
          $Encode_3(
            this$static._rangeEncoder,
            this$static._isMatch,
            complexState,
            0
          )
          curByte = $GetIndexByte(
            this$static._matchFinder,
            -this$static._additionalOffset
          )
          subCoder = $GetSubCoder(
            this$static._literalEncoder,
            lowBits_0(this$static.nowPos64),
            this$static._previousByte
          )
          if (this$static._state < 7) {
            $Encode_1(subCoder, this$static._rangeEncoder, curByte)
          } else {
            matchByte = $GetIndexByte(
              this$static._matchFinder,
              -this$static._repDistances[0] - 1 - this$static._additionalOffset
            )
            $EncodeMatched(
              subCoder,
              this$static._rangeEncoder,
              matchByte,
              curByte
            )
          }
          this$static._previousByte = curByte
          this$static._state = StateUpdateChar(this$static._state)
        } else {
          $Encode_3(
            this$static._rangeEncoder,
            this$static._isMatch,
            complexState,
            1
          )
          if (pos < 4) {
            $Encode_3(
              this$static._rangeEncoder,
              this$static._isRep,
              this$static._state,
              1
            )
            if (!pos) {
              $Encode_3(
                this$static._rangeEncoder,
                this$static._isRepG0,
                this$static._state,
                0
              )
              if (len == 1) {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRep0Long,
                  complexState,
                  0
                )
              } else {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRep0Long,
                  complexState,
                  1
                )
              }
            } else {
              $Encode_3(
                this$static._rangeEncoder,
                this$static._isRepG0,
                this$static._state,
                1
              )
              if (pos == 1) {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG1,
                  this$static._state,
                  0
                )
              } else {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG1,
                  this$static._state,
                  1
                )
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG2,
                  this$static._state,
                  pos - 2
                )
              }
            }
            if (len == 1) {
              this$static._state = this$static._state < 7 ? 9 : 11
            } else {
              $Encode_0(
                this$static._repMatchLenEncoder,
                this$static._rangeEncoder,
                len - 2,
                posState
              )
              this$static._state = this$static._state < 7 ? 8 : 11
            }
            distance = this$static._repDistances[pos]
            if (pos != 0) {
              for (i = pos; i >= 1; --i) {
                this$static._repDistances[i] = this$static._repDistances[i - 1]
              }
              this$static._repDistances[0] = distance
            }
          } else {
            $Encode_3(
              this$static._rangeEncoder,
              this$static._isRep,
              this$static._state,
              0
            )
            this$static._state = this$static._state < 7 ? 7 : 10
            $Encode_0(
              this$static._lenEncoder,
              this$static._rangeEncoder,
              len - 2,
              posState
            )
            pos -= 4
            posSlot = GetPosSlot(pos)
            lenToPosState = GetLenToPosState(len)
            $Encode_2(
              this$static._posSlotEncoder[lenToPosState],
              this$static._rangeEncoder,
              posSlot
            )
            if (posSlot >= 4) {
              footerBits = (posSlot >> 1) - 1
              baseVal = (2 | (posSlot & 1)) << footerBits
              posReduced = pos - baseVal
              if (posSlot < 14) {
                ReverseEncode(
                  this$static._posEncoders,
                  baseVal - posSlot - 1,
                  this$static._rangeEncoder,
                  footerBits,
                  posReduced
                )
              } else {
                $EncodeDirectBits(
                  this$static._rangeEncoder,
                  posReduced >> 4,
                  footerBits - 4
                )
                $ReverseEncode(
                  this$static._posAlignEncoder,
                  this$static._rangeEncoder,
                  posReduced & 15
                )
                ++this$static._alignPriceCount
              }
            }
            distance = pos
            for (i = 3; i >= 1; --i) {
              this$static._repDistances[i] = this$static._repDistances[i - 1]
            }
            this$static._repDistances[0] = distance
            ++this$static._matchPriceCount
          }
          this$static._previousByte = $GetIndexByte(
            this$static._matchFinder,
            len - 1 - this$static._additionalOffset
          )
        }
        this$static._additionalOffset -= len
        this$static.nowPos64 = add(this$static.nowPos64, fromInt(len))
        if (!this$static._additionalOffset) {
          if (this$static._matchPriceCount >= 128) {
            $FillDistancesPrices(this$static)
          }
          if (this$static._alignPriceCount >= 16) {
            $FillAlignPrices(this$static)
          }
          inSize[0] = this$static.nowPos64
          outSize[0] = $GetProcessedSizeAdd(this$static._rangeEncoder)
          if (!$GetNumAvailableBytes(this$static._matchFinder)) {
            $Flush(this$static, lowBits_0(this$static.nowPos64))
            return
          }
          if (
            compare(
              sub(this$static.nowPos64, progressPosValuePrev),
              [4096, 0]
            ) >= 0
          ) {
            this$static._finished = 0
            finished[0] = 0
            return
          }
        }
      }
    }

    function $Create_2(this$static) {
      var bt, numHashBytes
      if (!this$static._matchFinder) {
        bt = {}
        numHashBytes = 4
        if (!this$static._matchFinderType) {
          numHashBytes = 2
        }
        $SetType(bt, numHashBytes)
        this$static._matchFinder = bt
      }
      $Create_1(
        this$static._literalEncoder,
        this$static._numLiteralPosStateBits,
        this$static._numLiteralContextBits
      )
      if (
        this$static._dictionarySize == this$static._dictionarySizePrev &&
        this$static._numFastBytesPrev == this$static._numFastBytes
      ) {
        return
      }
      $Create_3(
        this$static._matchFinder,
        this$static._dictionarySize,
        4096,
        this$static._numFastBytes,
        274
      )
      this$static._dictionarySizePrev = this$static._dictionarySize
      this$static._numFastBytesPrev = this$static._numFastBytes
    }

    function $Encoder(this$static) {
      var i
      this$static._repDistances = initDim(4)
      this$static._optimum = []
      this$static._rangeEncoder = {}
      this$static._isMatch = initDim(192)
      this$static._isRep = initDim(12)
      this$static._isRepG0 = initDim(12)
      this$static._isRepG1 = initDim(12)
      this$static._isRepG2 = initDim(12)
      this$static._isRep0Long = initDim(192)
      this$static._posSlotEncoder = []
      this$static._posEncoders = initDim(114)
      this$static._posAlignEncoder = $BitTreeEncoder({}, 4)
      this$static._lenEncoder = $Encoder$LenPriceTableEncoder({})
      this$static._repMatchLenEncoder = $Encoder$LenPriceTableEncoder({})
      this$static._literalEncoder = {}
      this$static._matchDistances = []
      this$static._posSlotPrices = []
      this$static._distancesPrices = []
      this$static._alignPrices = initDim(16)
      this$static.reps = initDim(4)
      this$static.repLens = initDim(4)
      this$static.processedInSize = [P0_longLit]
      this$static.processedOutSize = [P0_longLit]
      this$static.finished = [0]
      this$static.properties = initDim(5)
      this$static.tempPrices = initDim(128)
      this$static._longestMatchLength = 0
      this$static._matchFinderType = 1
      this$static._numDistancePairs = 0
      this$static._numFastBytesPrev = -1
      this$static.backRes = 0
      for (i = 0; i < 4096; ++i) {
        this$static._optimum[i] = {}
      }
      for (i = 0; i < 4; ++i) {
        this$static._posSlotEncoder[i] = $BitTreeEncoder({}, 6)
      }
      return this$static
    }

    function $FillAlignPrices(this$static) {
      for (var i = 0; i < 16; ++i) {
        this$static._alignPrices[i] = $ReverseGetPrice(
          this$static._posAlignEncoder,
          i
        )
      }
      this$static._alignPriceCount = 0
    }

    function $FillDistancesPrices(this$static) {
      var baseVal, encoder, footerBits, i, lenToPosState, posSlot, st, st2
      for (i = 4; i < 128; ++i) {
        posSlot = GetPosSlot(i)
        footerBits = (posSlot >> 1) - 1
        baseVal = (2 | (posSlot & 1)) << footerBits
        this$static.tempPrices[i] = ReverseGetPrice(
          this$static._posEncoders,
          baseVal - posSlot - 1,
          footerBits,
          i - baseVal
        )
      }
      for (lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
        encoder = this$static._posSlotEncoder[lenToPosState]
        st = lenToPosState << 6
        for (posSlot = 0; posSlot < this$static._distTableSize; ++posSlot) {
          this$static._posSlotPrices[st + posSlot] = $GetPrice_1(
            encoder,
            posSlot
          )
        }
        for (posSlot = 14; posSlot < this$static._distTableSize; ++posSlot) {
          this$static._posSlotPrices[st + posSlot] +=
            ((posSlot >> 1) - 1 - 4) << 6
        }
        st2 = lenToPosState * 128
        for (i = 0; i < 4; ++i) {
          this$static._distancesPrices[st2 + i] =
            this$static._posSlotPrices[st + i]
        }
        for (; i < 128; ++i) {
          this$static._distancesPrices[st2 + i] =
            this$static._posSlotPrices[st + GetPosSlot(i)] +
            this$static.tempPrices[i]
        }
      }
      this$static._matchPriceCount = 0
    }

    function $Flush(this$static, nowPos) {
      $ReleaseMFStream(this$static)
      $WriteEndMarker(this$static, nowPos & this$static._posStateMask)
      for (var i = 0; i < 5; ++i) {
        $ShiftLow(this$static._rangeEncoder)
      }
    }

    function $GetOptimum(this$static, position) {
      var cur,
        curAnd1Price,
        curAndLenCharPrice,
        curAndLenPrice,
        curBack,
        curPrice,
        currentByte,
        distance,
        i,
        len,
        lenEnd,
        lenMain,
        lenRes,
        lenTest,
        lenTest2,
        lenTestTemp,
        matchByte,
        matchPrice,
        newLen,
        nextIsChar,
        nextMatchPrice,
        nextOptimum,
        nextRepMatchPrice,
        normalMatchPrice,
        numAvailableBytes,
        numAvailableBytesFull,
        numDistancePairs,
        offs,
        offset,
        opt,
        optimum,
        pos,
        posPrev,
        posState,
        posStateNext,
        price_4,
        repIndex,
        repLen,
        repMatchPrice,
        repMaxIndex,
        shortRepPrice,
        startLen,
        state,
        state2,
        t,
        price,
        price_0,
        price_1,
        price_2,
        price_3
      if (this$static._optimumEndIndex != this$static._optimumCurrentIndex) {
        lenRes =
          this$static._optimum[this$static._optimumCurrentIndex].PosPrev -
          this$static._optimumCurrentIndex
        this$static.backRes =
          this$static._optimum[this$static._optimumCurrentIndex].BackPrev
        this$static._optimumCurrentIndex =
          this$static._optimum[this$static._optimumCurrentIndex].PosPrev
        return lenRes
      }
      this$static._optimumCurrentIndex = this$static._optimumEndIndex = 0
      if (this$static._longestMatchWasFound) {
        lenMain = this$static._longestMatchLength
        this$static._longestMatchWasFound = 0
      } else {
        lenMain = $ReadMatchDistances(this$static)
      }
      numDistancePairs = this$static._numDistancePairs
      numAvailableBytes = $GetNumAvailableBytes(this$static._matchFinder) + 1
      if (numAvailableBytes < 2) {
        this$static.backRes = -1
        return 1
      }
      if (numAvailableBytes > 273) {
        numAvailableBytes = 273
      }
      repMaxIndex = 0
      for (i = 0; i < 4; ++i) {
        this$static.reps[i] = this$static._repDistances[i]
        this$static.repLens[i] = $GetMatchLen(
          this$static._matchFinder,
          -1,
          this$static.reps[i],
          273
        )
        if (this$static.repLens[i] > this$static.repLens[repMaxIndex]) {
          repMaxIndex = i
        }
      }
      if (this$static.repLens[repMaxIndex] >= this$static._numFastBytes) {
        this$static.backRes = repMaxIndex
        lenRes = this$static.repLens[repMaxIndex]
        $MovePos(this$static, lenRes - 1)
        return lenRes
      }
      if (lenMain >= this$static._numFastBytes) {
        this$static.backRes =
          this$static._matchDistances[numDistancePairs - 1] + 4
        $MovePos(this$static, lenMain - 1)
        return lenMain
      }
      currentByte = $GetIndexByte(this$static._matchFinder, -1)
      matchByte = $GetIndexByte(
        this$static._matchFinder,
        -this$static._repDistances[0] - 1 - 1
      )
      if (
        lenMain < 2 &&
        currentByte != matchByte &&
        this$static.repLens[repMaxIndex] < 2
      ) {
        this$static.backRes = -1
        return 1
      }
      this$static._optimum[0].State = this$static._state
      posState = position & this$static._posStateMask
      this$static._optimum[1].Price =
        ProbPrices[
          this$static._isMatch[(this$static._state << 4) + posState] >>> 2
        ] +
        $GetPrice_0(
          $GetSubCoder(
            this$static._literalEncoder,
            position,
            this$static._previousByte
          ),
          this$static._state >= 7,
          matchByte,
          currentByte
        )
      $MakeAsChar(this$static._optimum[1])
      matchPrice =
        ProbPrices[
          (2048 -
            this$static._isMatch[(this$static._state << 4) + posState]) >>>
            2
        ]
      repMatchPrice =
        matchPrice +
        ProbPrices[(2048 - this$static._isRep[this$static._state]) >>> 2]
      if (matchByte == currentByte) {
        shortRepPrice =
          repMatchPrice +
          $GetRepLen1Price(this$static, this$static._state, posState)
        if (shortRepPrice < this$static._optimum[1].Price) {
          this$static._optimum[1].Price = shortRepPrice
          $MakeAsShortRep(this$static._optimum[1])
        }
      }
      lenEnd =
        lenMain >= this$static.repLens[repMaxIndex]
          ? lenMain
          : this$static.repLens[repMaxIndex]
      if (lenEnd < 2) {
        this$static.backRes = this$static._optimum[1].BackPrev
        return 1
      }
      this$static._optimum[1].PosPrev = 0
      this$static._optimum[0].Backs0 = this$static.reps[0]
      this$static._optimum[0].Backs1 = this$static.reps[1]
      this$static._optimum[0].Backs2 = this$static.reps[2]
      this$static._optimum[0].Backs3 = this$static.reps[3]
      len = lenEnd
      do {
        this$static._optimum[len--].Price = 268435455
      } while (len >= 2)
      for (i = 0; i < 4; ++i) {
        repLen = this$static.repLens[i]
        if (repLen < 2) {
          continue
        }
        price_4 =
          repMatchPrice +
          $GetPureRepPrice(this$static, i, this$static._state, posState)
        do {
          curAndLenPrice =
            price_4 +
            $GetPrice(this$static._repMatchLenEncoder, repLen - 2, posState)
          optimum = this$static._optimum[repLen]
          if (curAndLenPrice < optimum.Price) {
            optimum.Price = curAndLenPrice
            optimum.PosPrev = 0
            optimum.BackPrev = i
            optimum.Prev1IsChar = 0
          }
        } while (--repLen >= 2)
      }
      normalMatchPrice =
        matchPrice + ProbPrices[this$static._isRep[this$static._state] >>> 2]
      len = this$static.repLens[0] >= 2 ? this$static.repLens[0] + 1 : 2
      if (len <= lenMain) {
        offs = 0
        while (len > this$static._matchDistances[offs]) {
          offs += 2
        }
        for (; ; ++len) {
          distance = this$static._matchDistances[offs + 1]
          curAndLenPrice =
            normalMatchPrice +
            $GetPosLenPrice(this$static, distance, len, posState)
          optimum = this$static._optimum[len]
          if (curAndLenPrice < optimum.Price) {
            optimum.Price = curAndLenPrice
            optimum.PosPrev = 0
            optimum.BackPrev = distance + 4
            optimum.Prev1IsChar = 0
          }
          if (len == this$static._matchDistances[offs]) {
            offs += 2
            if (offs == numDistancePairs) {
              break
            }
          }
        }
      }
      cur = 0
      while (1) {
        ++cur
        if (cur == lenEnd) {
          return $Backward(this$static, cur)
        }
        newLen = $ReadMatchDistances(this$static)
        numDistancePairs = this$static._numDistancePairs
        if (newLen >= this$static._numFastBytes) {
          this$static._longestMatchLength = newLen
          this$static._longestMatchWasFound = 1
          return $Backward(this$static, cur)
        }
        ++position
        posPrev = this$static._optimum[cur].PosPrev
        if (this$static._optimum[cur].Prev1IsChar) {
          --posPrev
          if (this$static._optimum[cur].Prev2) {
            state =
              this$static._optimum[this$static._optimum[cur].PosPrev2].State
            if (this$static._optimum[cur].BackPrev2 < 4) {
              state = state < 7 ? 8 : 11
            } else {
              state = state < 7 ? 7 : 10
            }
          } else {
            state = this$static._optimum[posPrev].State
          }
          state = StateUpdateChar(state)
        } else {
          state = this$static._optimum[posPrev].State
        }
        if (posPrev == cur - 1) {
          if (!this$static._optimum[cur].BackPrev) {
            state = state < 7 ? 9 : 11
          } else {
            state = StateUpdateChar(state)
          }
        } else {
          if (
            this$static._optimum[cur].Prev1IsChar &&
            this$static._optimum[cur].Prev2
          ) {
            posPrev = this$static._optimum[cur].PosPrev2
            pos = this$static._optimum[cur].BackPrev2
            state = state < 7 ? 8 : 11
          } else {
            pos = this$static._optimum[cur].BackPrev
            if (pos < 4) {
              state = state < 7 ? 8 : 11
            } else {
              state = state < 7 ? 7 : 10
            }
          }
          opt = this$static._optimum[posPrev]
          if (pos < 4) {
            if (!pos) {
              this$static.reps[0] = opt.Backs0
              this$static.reps[1] = opt.Backs1
              this$static.reps[2] = opt.Backs2
              this$static.reps[3] = opt.Backs3
            } else if (pos == 1) {
              this$static.reps[0] = opt.Backs1
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs2
              this$static.reps[3] = opt.Backs3
            } else if (pos == 2) {
              this$static.reps[0] = opt.Backs2
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs1
              this$static.reps[3] = opt.Backs3
            } else {
              this$static.reps[0] = opt.Backs3
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs1
              this$static.reps[3] = opt.Backs2
            }
          } else {
            this$static.reps[0] = pos - 4
            this$static.reps[1] = opt.Backs0
            this$static.reps[2] = opt.Backs1
            this$static.reps[3] = opt.Backs2
          }
        }
        this$static._optimum[cur].State = state
        this$static._optimum[cur].Backs0 = this$static.reps[0]
        this$static._optimum[cur].Backs1 = this$static.reps[1]
        this$static._optimum[cur].Backs2 = this$static.reps[2]
        this$static._optimum[cur].Backs3 = this$static.reps[3]
        curPrice = this$static._optimum[cur].Price
        currentByte = $GetIndexByte(this$static._matchFinder, -1)
        matchByte = $GetIndexByte(
          this$static._matchFinder,
          -this$static.reps[0] - 1 - 1
        )
        posState = position & this$static._posStateMask
        curAnd1Price =
          curPrice +
          ProbPrices[this$static._isMatch[(state << 4) + posState] >>> 2] +
          $GetPrice_0(
            $GetSubCoder(
              this$static._literalEncoder,
              position,
              $GetIndexByte(this$static._matchFinder, -2)
            ),
            state >= 7,
            matchByte,
            currentByte
          )
        nextOptimum = this$static._optimum[cur + 1]
        nextIsChar = 0
        if (curAnd1Price < nextOptimum.Price) {
          nextOptimum.Price = curAnd1Price
          nextOptimum.PosPrev = cur
          nextOptimum.BackPrev = -1
          nextOptimum.Prev1IsChar = 0
          nextIsChar = 1
        }
        matchPrice =
          curPrice +
          ProbPrices[
            (2048 - this$static._isMatch[(state << 4) + posState]) >>> 2
          ]
        repMatchPrice =
          matchPrice + ProbPrices[(2048 - this$static._isRep[state]) >>> 2]
        if (
          matchByte == currentByte &&
          !(nextOptimum.PosPrev < cur && !nextOptimum.BackPrev)
        ) {
          shortRepPrice =
            repMatchPrice +
            (ProbPrices[this$static._isRepG0[state] >>> 2] +
              ProbPrices[
                this$static._isRep0Long[(state << 4) + posState] >>> 2
              ])
          if (shortRepPrice <= nextOptimum.Price) {
            nextOptimum.Price = shortRepPrice
            nextOptimum.PosPrev = cur
            nextOptimum.BackPrev = 0
            nextOptimum.Prev1IsChar = 0
            nextIsChar = 1
          }
        }
        numAvailableBytesFull =
          $GetNumAvailableBytes(this$static._matchFinder) + 1
        numAvailableBytesFull =
          4095 - cur < numAvailableBytesFull
            ? 4095 - cur
            : numAvailableBytesFull
        numAvailableBytes = numAvailableBytesFull
        if (numAvailableBytes < 2) {
          continue
        }
        if (numAvailableBytes > this$static._numFastBytes) {
          numAvailableBytes = this$static._numFastBytes
        }
        if (!nextIsChar && matchByte != currentByte) {
          t = Math.min(numAvailableBytesFull - 1, this$static._numFastBytes)
          lenTest2 = $GetMatchLen(
            this$static._matchFinder,
            0,
            this$static.reps[0],
            t
          )
          if (lenTest2 >= 2) {
            state2 = StateUpdateChar(state)
            posStateNext = (position + 1) & this$static._posStateMask
            nextRepMatchPrice =
              curAnd1Price +
              ProbPrices[
                (2048 - this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                  2
              ] +
              ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
            offset = cur + 1 + lenTest2
            while (lenEnd < offset) {
              this$static._optimum[++lenEnd].Price = 268435455
            }
            curAndLenPrice =
              nextRepMatchPrice +
              ((price = $GetPrice(
                this$static._repMatchLenEncoder,
                lenTest2 - 2,
                posStateNext
              )),
              price + $GetPureRepPrice(this$static, 0, state2, posStateNext))
            optimum = this$static._optimum[offset]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur + 1
              optimum.BackPrev = 0
              optimum.Prev1IsChar = 1
              optimum.Prev2 = 0
            }
          }
        }
        startLen = 2
        for (repIndex = 0; repIndex < 4; ++repIndex) {
          lenTest = $GetMatchLen(
            this$static._matchFinder,
            -1,
            this$static.reps[repIndex],
            numAvailableBytes
          )
          if (lenTest < 2) {
            continue
          }
          lenTestTemp = lenTest
          do {
            while (lenEnd < cur + lenTest) {
              this$static._optimum[++lenEnd].Price = 268435455
            }
            curAndLenPrice =
              repMatchPrice +
              ((price_0 = $GetPrice(
                this$static._repMatchLenEncoder,
                lenTest - 2,
                posState
              )),
              price_0 +
                $GetPureRepPrice(this$static, repIndex, state, posState))
            optimum = this$static._optimum[cur + lenTest]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur
              optimum.BackPrev = repIndex
              optimum.Prev1IsChar = 0
            }
          } while (--lenTest >= 2)
          lenTest = lenTestTemp
          if (!repIndex) {
            startLen = lenTest + 1
          }
          if (lenTest < numAvailableBytesFull) {
            t = Math.min(
              numAvailableBytesFull - 1 - lenTest,
              this$static._numFastBytes
            )
            lenTest2 = $GetMatchLen(
              this$static._matchFinder,
              lenTest,
              this$static.reps[repIndex],
              t
            )
            if (lenTest2 >= 2) {
              state2 = state < 7 ? 8 : 11
              posStateNext = (position + lenTest) & this$static._posStateMask
              curAndLenCharPrice =
                repMatchPrice +
                ((price_1 = $GetPrice(
                  this$static._repMatchLenEncoder,
                  lenTest - 2,
                  posState
                )),
                price_1 +
                  $GetPureRepPrice(this$static, repIndex, state, posState)) +
                ProbPrices[
                  this$static._isMatch[(state2 << 4) + posStateNext] >>> 2
                ] +
                $GetPrice_0(
                  $GetSubCoder(
                    this$static._literalEncoder,
                    position + lenTest,
                    $GetIndexByte(this$static._matchFinder, lenTest - 1 - 1)
                  ),
                  1,
                  $GetIndexByte(
                    this$static._matchFinder,
                    lenTest - 1 - (this$static.reps[repIndex] + 1)
                  ),
                  $GetIndexByte(this$static._matchFinder, lenTest - 1)
                )
              state2 = StateUpdateChar(state2)
              posStateNext =
                (position + lenTest + 1) & this$static._posStateMask
              nextMatchPrice =
                curAndLenCharPrice +
                ProbPrices[
                  (2048 -
                    this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                    2
                ]
              nextRepMatchPrice =
                nextMatchPrice +
                ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
              offset = lenTest + 1 + lenTest2
              while (lenEnd < cur + offset) {
                this$static._optimum[++lenEnd].Price = 268435455
              }
              curAndLenPrice =
                nextRepMatchPrice +
                ((price_2 = $GetPrice(
                  this$static._repMatchLenEncoder,
                  lenTest2 - 2,
                  posStateNext
                )),
                price_2 +
                  $GetPureRepPrice(this$static, 0, state2, posStateNext))
              optimum = this$static._optimum[cur + offset]
              if (curAndLenPrice < optimum.Price) {
                optimum.Price = curAndLenPrice
                optimum.PosPrev = cur + lenTest + 1
                optimum.BackPrev = 0
                optimum.Prev1IsChar = 1
                optimum.Prev2 = 1
                optimum.PosPrev2 = cur
                optimum.BackPrev2 = repIndex
              }
            }
          }
        }
        if (newLen > numAvailableBytes) {
          newLen = numAvailableBytes
          for (
            numDistancePairs = 0;
            newLen > this$static._matchDistances[numDistancePairs];
            numDistancePairs += 2
          ) {}
          this$static._matchDistances[numDistancePairs] = newLen
          numDistancePairs += 2
        }
        if (newLen >= startLen) {
          normalMatchPrice =
            matchPrice + ProbPrices[this$static._isRep[state] >>> 2]
          while (lenEnd < cur + newLen) {
            this$static._optimum[++lenEnd].Price = 268435455
          }
          offs = 0
          while (startLen > this$static._matchDistances[offs]) {
            offs += 2
          }
          for (lenTest = startLen; ; ++lenTest) {
            curBack = this$static._matchDistances[offs + 1]
            curAndLenPrice =
              normalMatchPrice +
              $GetPosLenPrice(this$static, curBack, lenTest, posState)
            optimum = this$static._optimum[cur + lenTest]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur
              optimum.BackPrev = curBack + 4
              optimum.Prev1IsChar = 0
            }
            if (lenTest == this$static._matchDistances[offs]) {
              if (lenTest < numAvailableBytesFull) {
                t = Math.min(
                  numAvailableBytesFull - 1 - lenTest,
                  this$static._numFastBytes
                )
                lenTest2 = $GetMatchLen(
                  this$static._matchFinder,
                  lenTest,
                  curBack,
                  t
                )
                if (lenTest2 >= 2) {
                  state2 = state < 7 ? 7 : 10
                  posStateNext =
                    (position + lenTest) & this$static._posStateMask
                  curAndLenCharPrice =
                    curAndLenPrice +
                    ProbPrices[
                      this$static._isMatch[(state2 << 4) + posStateNext] >>> 2
                    ] +
                    $GetPrice_0(
                      $GetSubCoder(
                        this$static._literalEncoder,
                        position + lenTest,
                        $GetIndexByte(this$static._matchFinder, lenTest - 1 - 1)
                      ),
                      1,
                      $GetIndexByte(
                        this$static._matchFinder,
                        lenTest - (curBack + 1) - 1
                      ),
                      $GetIndexByte(this$static._matchFinder, lenTest - 1)
                    )
                  state2 = StateUpdateChar(state2)
                  posStateNext =
                    (position + lenTest + 1) & this$static._posStateMask
                  nextMatchPrice =
                    curAndLenCharPrice +
                    ProbPrices[
                      (2048 -
                        this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                        2
                    ]
                  nextRepMatchPrice =
                    nextMatchPrice +
                    ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
                  offset = lenTest + 1 + lenTest2
                  while (lenEnd < cur + offset) {
                    this$static._optimum[++lenEnd].Price = 268435455
                  }
                  curAndLenPrice =
                    nextRepMatchPrice +
                    ((price_3 = $GetPrice(
                      this$static._repMatchLenEncoder,
                      lenTest2 - 2,
                      posStateNext
                    )),
                    price_3 +
                      $GetPureRepPrice(this$static, 0, state2, posStateNext))
                  optimum = this$static._optimum[cur + offset]
                  if (curAndLenPrice < optimum.Price) {
                    optimum.Price = curAndLenPrice
                    optimum.PosPrev = cur + lenTest + 1
                    optimum.BackPrev = 0
                    optimum.Prev1IsChar = 1
                    optimum.Prev2 = 1
                    optimum.PosPrev2 = cur
                    optimum.BackPrev2 = curBack + 4
                  }
                }
              }
              offs += 2
              if (offs == numDistancePairs) break
            }
          }
        }
      }
    }

    function $GetPosLenPrice(this$static, pos, len, posState) {
      var price,
        lenToPosState = GetLenToPosState(len)
      if (pos < 128) {
        price = this$static._distancesPrices[lenToPosState * 128 + pos]
      } else {
        price =
          this$static._posSlotPrices[(lenToPosState << 6) + GetPosSlot2(pos)] +
          this$static._alignPrices[pos & 15]
      }
      return price + $GetPrice(this$static._lenEncoder, len - 2, posState)
    }

    function $GetPureRepPrice(this$static, repIndex, state, posState) {
      var price
      if (!repIndex) {
        price = ProbPrices[this$static._isRepG0[state] >>> 2]
        price +=
          ProbPrices[
            (2048 - this$static._isRep0Long[(state << 4) + posState]) >>> 2
          ]
      } else {
        price = ProbPrices[(2048 - this$static._isRepG0[state]) >>> 2]
        if (repIndex == 1) {
          price += ProbPrices[this$static._isRepG1[state] >>> 2]
        } else {
          price += ProbPrices[(2048 - this$static._isRepG1[state]) >>> 2]
          price += GetPrice(this$static._isRepG2[state], repIndex - 2)
        }
      }
      return price
    }

    function $GetRepLen1Price(this$static, state, posState) {
      return (
        ProbPrices[this$static._isRepG0[state] >>> 2] +
        ProbPrices[this$static._isRep0Long[(state << 4) + posState] >>> 2]
      )
    }

    function $Init_4(this$static) {
      $BaseInit(this$static)
      $Init_9(this$static._rangeEncoder)
      InitBitModels(this$static._isMatch)
      InitBitModels(this$static._isRep0Long)
      InitBitModels(this$static._isRep)
      InitBitModels(this$static._isRepG0)
      InitBitModels(this$static._isRepG1)
      InitBitModels(this$static._isRepG2)
      InitBitModels(this$static._posEncoders)
      $Init_3(this$static._literalEncoder)
      for (var i = 0; i < 4; ++i) {
        InitBitModels(this$static._posSlotEncoder[i].Models)
      }
      $Init_2(this$static._lenEncoder, 1 << this$static._posStateBits)
      $Init_2(this$static._repMatchLenEncoder, 1 << this$static._posStateBits)
      InitBitModels(this$static._posAlignEncoder.Models)
      this$static._longestMatchWasFound = 0
      this$static._optimumEndIndex = 0
      this$static._optimumCurrentIndex = 0
      this$static._additionalOffset = 0
    }

    function $MovePos(this$static, num) {
      if (num > 0) {
        $Skip(this$static._matchFinder, num)
        this$static._additionalOffset += num
      }
    }

    function $ReadMatchDistances(this$static) {
      var lenRes = 0
      this$static._numDistancePairs = $GetMatches(
        this$static._matchFinder,
        this$static._matchDistances
      )
      if (this$static._numDistancePairs > 0) {
        lenRes = this$static._matchDistances[this$static._numDistancePairs - 2]
        if (lenRes == this$static._numFastBytes)
          lenRes += $GetMatchLen(
            this$static._matchFinder,
            lenRes - 1,
            this$static._matchDistances[this$static._numDistancePairs - 1],
            273 - lenRes
          )
      }
      ++this$static._additionalOffset
      return lenRes
    }

    function $ReleaseMFStream(this$static) {
      if (this$static._matchFinder && this$static._needReleaseMFStream) {
        this$static._matchFinder._stream = null
        this$static._needReleaseMFStream = 0
      }
    }

    function $ReleaseStreams(this$static) {
      $ReleaseMFStream(this$static)
      this$static._rangeEncoder.Stream = null
    }

    function $SetDictionarySize_0(this$static, dictionarySize) {
      this$static._dictionarySize = dictionarySize
      for (
        var dicLogSize = 0;
        dictionarySize > 1 << dicLogSize;
        ++dicLogSize
      ) {}
      this$static._distTableSize = dicLogSize * 2
    }

    function $SetMatchFinder(this$static, matchFinderIndex) {
      var matchFinderIndexPrev = this$static._matchFinderType
      this$static._matchFinderType = matchFinderIndex
      if (
        this$static._matchFinder &&
        matchFinderIndexPrev != this$static._matchFinderType
      ) {
        this$static._dictionarySizePrev = -1
        this$static._matchFinder = null
      }
    }

    function $WriteCoderProperties(this$static, outStream) {
      this$static.properties[0] =
        (((this$static._posStateBits * 5 +
          this$static._numLiteralPosStateBits) *
          9 +
          this$static._numLiteralContextBits) <<
          24) >>
        24
      for (var i = 0; i < 4; ++i) {
        this$static.properties[1 + i] =
          ((this$static._dictionarySize >> (8 * i)) << 24) >> 24
      }
      $write_0(outStream, this$static.properties, 0, 5)
    }

    function $WriteEndMarker(this$static, posState) {
      if (!this$static._writeEndMark) {
        return
      }
      $Encode_3(
        this$static._rangeEncoder,
        this$static._isMatch,
        (this$static._state << 4) + posState,
        1
      )
      $Encode_3(
        this$static._rangeEncoder,
        this$static._isRep,
        this$static._state,
        0
      )
      this$static._state = this$static._state < 7 ? 7 : 10
      $Encode_0(this$static._lenEncoder, this$static._rangeEncoder, 0, posState)
      var lenToPosState = GetLenToPosState(2)
      $Encode_2(
        this$static._posSlotEncoder[lenToPosState],
        this$static._rangeEncoder,
        63
      )
      $EncodeDirectBits(this$static._rangeEncoder, 67108863, 26)
      $ReverseEncode(
        this$static._posAlignEncoder,
        this$static._rangeEncoder,
        15
      )
    }

    function GetPosSlot(pos) {
      if (pos < 2048) {
        return g_FastPos[pos]
      }
      if (pos < 2097152) {
        return g_FastPos[pos >> 10] + 20
      }
      return g_FastPos[pos >> 20] + 40
    }

    function GetPosSlot2(pos) {
      if (pos < 131072) {
        return g_FastPos[pos >> 6] + 12
      }
      if (pos < 134217728) {
        return g_FastPos[pos >> 16] + 32
      }
      return g_FastPos[pos >> 26] + 52
    }

    function $Encode(this$static, rangeEncoder, symbol, posState) {
      if (symbol < 8) {
        $Encode_3(rangeEncoder, this$static._choice, 0, 0)
        $Encode_2(this$static._lowCoder[posState], rangeEncoder, symbol)
      } else {
        symbol -= 8
        $Encode_3(rangeEncoder, this$static._choice, 0, 1)
        if (symbol < 8) {
          $Encode_3(rangeEncoder, this$static._choice, 1, 0)
          $Encode_2(this$static._midCoder[posState], rangeEncoder, symbol)
        } else {
          $Encode_3(rangeEncoder, this$static._choice, 1, 1)
          $Encode_2(this$static._highCoder, rangeEncoder, symbol - 8)
        }
      }
    }

    function $Encoder$LenEncoder(this$static) {
      this$static._choice = initDim(2)
      this$static._lowCoder = initDim(16)
      this$static._midCoder = initDim(16)
      this$static._highCoder = $BitTreeEncoder({}, 8)
      for (var posState = 0; posState < 16; ++posState) {
        this$static._lowCoder[posState] = $BitTreeEncoder({}, 3)
        this$static._midCoder[posState] = $BitTreeEncoder({}, 3)
      }
      return this$static
    }

    function $Init_2(this$static, numPosStates) {
      InitBitModels(this$static._choice)
      for (var posState = 0; posState < numPosStates; ++posState) {
        InitBitModels(this$static._lowCoder[posState].Models)
        InitBitModels(this$static._midCoder[posState].Models)
      }
      InitBitModels(this$static._highCoder.Models)
    }

    function $SetPrices(this$static, posState, numSymbols, prices, st) {
      var a0, a1, b0, b1, i
      a0 = ProbPrices[this$static._choice[0] >>> 2]
      a1 = ProbPrices[(2048 - this$static._choice[0]) >>> 2]
      b0 = a1 + ProbPrices[this$static._choice[1] >>> 2]
      b1 = a1 + ProbPrices[(2048 - this$static._choice[1]) >>> 2]
      i = 0
      for (i = 0; i < 8; ++i) {
        if (i >= numSymbols) return
        prices[st + i] = a0 + $GetPrice_1(this$static._lowCoder[posState], i)
      }
      for (; i < 16; ++i) {
        if (i >= numSymbols) return
        prices[st + i] =
          b0 + $GetPrice_1(this$static._midCoder[posState], i - 8)
      }
      for (; i < numSymbols; ++i) {
        prices[st + i] = b1 + $GetPrice_1(this$static._highCoder, i - 8 - 8)
      }
    }

    function $Encode_0(this$static, rangeEncoder, symbol, posState) {
      $Encode(this$static, rangeEncoder, symbol, posState)
      if (--this$static._counters[posState] == 0) {
        $SetPrices(
          this$static,
          posState,
          this$static._tableSize,
          this$static._prices,
          posState * 272
        )
        this$static._counters[posState] = this$static._tableSize
      }
    }

    function $Encoder$LenPriceTableEncoder(this$static) {
      $Encoder$LenEncoder(this$static)
      this$static._prices = []
      this$static._counters = []
      return this$static
    }

    function $GetPrice(this$static, symbol, posState) {
      return this$static._prices[posState * 272 + symbol]
    }

    function $UpdateTables(this$static, numPosStates) {
      for (var posState = 0; posState < numPosStates; ++posState) {
        $SetPrices(
          this$static,
          posState,
          this$static._tableSize,
          this$static._prices,
          posState * 272
        )
        this$static._counters[posState] = this$static._tableSize
      }
    }

    function $Create_1(this$static, numPosBits, numPrevBits) {
      var i, numStates
      if (
        this$static.m_Coders != null &&
        this$static.m_NumPrevBits == numPrevBits &&
        this$static.m_NumPosBits == numPosBits
      ) {
        return
      }
      this$static.m_NumPosBits = numPosBits
      this$static.m_PosMask = (1 << numPosBits) - 1
      this$static.m_NumPrevBits = numPrevBits
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      this$static.m_Coders = initDim(numStates)
      for (i = 0; i < numStates; ++i) {
        this$static.m_Coders[i] = $Encoder$LiteralEncoder$Encoder2({})
      }
    }

    function $GetSubCoder(this$static, pos, prevByte) {
      return this$static.m_Coders[
        ((pos & this$static.m_PosMask) << this$static.m_NumPrevBits) +
          ((prevByte & 255) >>> (8 - this$static.m_NumPrevBits))
      ]
    }

    function $Init_3(this$static) {
      var i,
        numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      for (i = 0; i < numStates; ++i) {
        InitBitModels(this$static.m_Coders[i].m_Encoders)
      }
    }

    function $Encode_1(this$static, rangeEncoder, symbol) {
      var bit,
        i,
        context = 1
      for (i = 7; i >= 0; --i) {
        bit = (symbol >> i) & 1
        $Encode_3(rangeEncoder, this$static.m_Encoders, context, bit)
        context = (context << 1) | bit
      }
    }

    function $EncodeMatched(this$static, rangeEncoder, matchByte, symbol) {
      var bit,
        i,
        matchBit,
        state,
        same = 1,
        context = 1
      for (i = 7; i >= 0; --i) {
        bit = (symbol >> i) & 1
        state = context
        if (same) {
          matchBit = (matchByte >> i) & 1
          state += (1 + matchBit) << 8
          same = matchBit == bit
        }
        $Encode_3(rangeEncoder, this$static.m_Encoders, state, bit)
        context = (context << 1) | bit
      }
    }

    function $Encoder$LiteralEncoder$Encoder2(this$static) {
      this$static.m_Encoders = initDim(768)
      return this$static
    }

    function $GetPrice_0(this$static, matchMode, matchByte, symbol) {
      var bit,
        context = 1,
        i = 7,
        matchBit,
        price = 0
      if (matchMode) {
        for (; i >= 0; --i) {
          matchBit = (matchByte >> i) & 1
          bit = (symbol >> i) & 1
          price += GetPrice(
            this$static.m_Encoders[((1 + matchBit) << 8) + context],
            bit
          )
          context = (context << 1) | bit
          if (matchBit != bit) {
            --i
            break
          }
        }
      }
      for (; i >= 0; --i) {
        bit = (symbol >> i) & 1
        price += GetPrice(this$static.m_Encoders[context], bit)
        context = (context << 1) | bit
      }
      return price
    }

    function $MakeAsChar(this$static) {
      this$static.BackPrev = -1
      this$static.Prev1IsChar = 0
    }

    function $MakeAsShortRep(this$static) {
      this$static.BackPrev = 0
      this$static.Prev1IsChar = 0
    }
    /** ce */
    /** ds */
    function $BitTreeDecoder(this$static, numBitLevels) {
      this$static.NumBitLevels = numBitLevels
      this$static.Models = initDim(1 << numBitLevels)
      return this$static
    }

    function $Decode_0(this$static, rangeDecoder) {
      var bitIndex,
        m = 1
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; --bitIndex) {
        m = (m << 1) + $DecodeBit(rangeDecoder, this$static.Models, m)
      }
      return m - (1 << this$static.NumBitLevels)
    }

    function $ReverseDecode(this$static, rangeDecoder) {
      var bit,
        bitIndex,
        m = 1,
        symbol = 0
      for (bitIndex = 0; bitIndex < this$static.NumBitLevels; ++bitIndex) {
        bit = $DecodeBit(rangeDecoder, this$static.Models, m)
        m <<= 1
        m += bit
        symbol |= bit << bitIndex
      }
      return symbol
    }

    function ReverseDecode(Models, startIndex, rangeDecoder, NumBitLevels) {
      var bit,
        bitIndex,
        m = 1,
        symbol = 0
      for (bitIndex = 0; bitIndex < NumBitLevels; ++bitIndex) {
        bit = $DecodeBit(rangeDecoder, Models, startIndex + m)
        m <<= 1
        m += bit
        symbol |= bit << bitIndex
      }
      return symbol
    }
    /** de */
    /** cs */
    function $BitTreeEncoder(this$static, numBitLevels) {
      this$static.NumBitLevels = numBitLevels
      this$static.Models = initDim(1 << numBitLevels)
      return this$static
    }

    function $Encode_2(this$static, rangeEncoder, symbol) {
      var bit,
        bitIndex,
        m = 1
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; ) {
        --bitIndex
        bit = (symbol >>> bitIndex) & 1
        $Encode_3(rangeEncoder, this$static.Models, m, bit)
        m = (m << 1) | bit
      }
    }

    function $GetPrice_1(this$static, symbol) {
      var bit,
        bitIndex,
        m = 1,
        price = 0
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; ) {
        --bitIndex
        bit = (symbol >>> bitIndex) & 1
        price += GetPrice(this$static.Models[m], bit)
        m = (m << 1) + bit
      }
      return price
    }

    function $ReverseEncode(this$static, rangeEncoder, symbol) {
      var bit,
        i,
        m = 1
      for (i = 0; i < this$static.NumBitLevels; ++i) {
        bit = symbol & 1
        $Encode_3(rangeEncoder, this$static.Models, m, bit)
        m = (m << 1) | bit
        symbol >>= 1
      }
    }

    function $ReverseGetPrice(this$static, symbol) {
      var bit,
        i,
        m = 1,
        price = 0
      for (i = this$static.NumBitLevels; i != 0; --i) {
        bit = symbol & 1
        symbol >>>= 1
        price += GetPrice(this$static.Models[m], bit)
        m = (m << 1) | bit
      }
      return price
    }

    function ReverseEncode(
      Models,
      startIndex,
      rangeEncoder,
      NumBitLevels,
      symbol
    ) {
      var bit,
        i,
        m = 1
      for (i = 0; i < NumBitLevels; ++i) {
        bit = symbol & 1
        $Encode_3(rangeEncoder, Models, startIndex + m, bit)
        m = (m << 1) | bit
        symbol >>= 1
      }
    }

    function ReverseGetPrice(Models, startIndex, NumBitLevels, symbol) {
      var bit,
        i,
        m = 1,
        price = 0
      for (i = NumBitLevels; i != 0; --i) {
        bit = symbol & 1
        symbol >>>= 1
        price +=
          ProbPrices[(((Models[startIndex + m] - bit) ^ -bit) & 2047) >>> 2]
        m = (m << 1) | bit
      }
      return price
    }
    /** ce */
    /** ds */
    function $DecodeBit(this$static, probs, index) {
      var newBound,
        prob = probs[index]
      newBound = (this$static.Range >>> 11) * prob
      if ((this$static.Code ^ -2147483648) < (newBound ^ -2147483648)) {
        this$static.Range = newBound
        probs[index] = ((prob + ((2048 - prob) >>> 5)) << 16) >> 16
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
        return 0
      } else {
        this$static.Range -= newBound
        this$static.Code -= newBound
        probs[index] = ((prob - (prob >>> 5)) << 16) >> 16
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
        return 1
      }
    }

    function $DecodeDirectBits(this$static, numTotalBits) {
      var i,
        t,
        result = 0
      for (i = numTotalBits; i != 0; --i) {
        this$static.Range >>>= 1
        t = (this$static.Code - this$static.Range) >>> 31
        this$static.Code -= this$static.Range & (t - 1)
        result = (result << 1) | (1 - t)
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
      }
      return result
    }

    function $Init_8(this$static) {
      this$static.Code = 0
      this$static.Range = -1
      for (var i = 0; i < 5; ++i) {
        this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
      }
    }
    /** de */

    function InitBitModels(probs) {
      for (var i = probs.length - 1; i >= 0; --i) {
        probs[i] = 1024
      }
    }
    /** cs */
    var ProbPrices = (function () {
      var end,
        i,
        j,
        start,
        ProbPrices = []
      for (i = 8; i >= 0; --i) {
        start = 1 << (9 - i - 1)
        end = 1 << (9 - i)
        for (j = start; j < end; ++j) {
          ProbPrices[j] = (i << 6) + (((end - j) << 6) >>> (9 - i - 1))
        }
      }
      return ProbPrices
    })()

    function $Encode_3(this$static, probs, index, symbol) {
      var newBound,
        prob = probs[index]
      newBound = (this$static.Range >>> 11) * prob
      if (!symbol) {
        this$static.Range = newBound
        probs[index] = ((prob + ((2048 - prob) >>> 5)) << 16) >> 16
      } else {
        this$static.Low = add(
          this$static.Low,
          and(fromInt(newBound), [4294967295, 0])
        )
        this$static.Range -= newBound
        probs[index] = ((prob - (prob >>> 5)) << 16) >> 16
      }
      if (!(this$static.Range & -16777216)) {
        this$static.Range <<= 8
        $ShiftLow(this$static)
      }
    }

    function $EncodeDirectBits(this$static, v, numTotalBits) {
      for (var i = numTotalBits - 1; i >= 0; --i) {
        this$static.Range >>>= 1
        if (((v >>> i) & 1) == 1) {
          this$static.Low = add(this$static.Low, fromInt(this$static.Range))
        }
        if (!(this$static.Range & -16777216)) {
          this$static.Range <<= 8
          $ShiftLow(this$static)
        }
      }
    }

    function $GetProcessedSizeAdd(this$static) {
      return add(
        add(fromInt(this$static._cacheSize), this$static._position),
        [4, 0]
      )
    }

    function $Init_9(this$static) {
      this$static._position = P0_longLit
      this$static.Low = P0_longLit
      this$static.Range = -1
      this$static._cacheSize = 1
      this$static._cache = 0
    }

    function $ShiftLow(this$static) {
      var temp,
        LowHi = lowBits_0(shru(this$static.Low, 32))
      if (LowHi != 0 || compare(this$static.Low, [4278190080, 0]) < 0) {
        this$static._position = add(
          this$static._position,
          fromInt(this$static._cacheSize)
        )
        temp = this$static._cache
        do {
          $write(this$static.Stream, temp + LowHi)
          temp = 255
        } while (--this$static._cacheSize != 0)
        this$static._cache = lowBits_0(this$static.Low) >>> 24
      }
      ++this$static._cacheSize
      this$static.Low = shl(and(this$static.Low, [16777215, 0]), 8)
    }

    function GetPrice(Prob, symbol) {
      return ProbPrices[(((Prob - symbol) ^ -symbol) & 2047) >>> 2]
    }

    /** ce */
    /** ds */
    function decode(utf) {
      var i = 0,
        j = 0,
        x,
        y,
        z,
        l = utf.length,
        buf = [],
        charCodes = []
      for (; i < l; ++i, ++j) {
        x = utf[i] & 255
        if (!(x & 128)) {
          if (!x) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = x
        } else if ((x & 224) == 192) {
          if (i + 1 >= l) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          y = utf[++i] & 255
          if ((y & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = ((x & 31) << 6) | (y & 63)
        } else if ((x & 240) == 224) {
          if (i + 2 >= l) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          y = utf[++i] & 255
          if ((y & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          z = utf[++i] & 255
          if ((z & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = ((x & 15) << 12) | ((y & 63) << 6) | (z & 63)
        } else {
          /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
          return utf
        }
        if (j == 16383) {
          buf.push(String.fromCharCode.apply(String, charCodes))
          j = -1
        }
      }
      if (j > 0) {
        charCodes.length = j
        buf.push(String.fromCharCode.apply(String, charCodes))
      }
      return buf.join('')
    }
    /** de */
    /** cs */
    function encode(s) {
      var ch,
        chars = [],
        data,
        elen = 0,
        i,
        l = s.length
      /// Be able to handle binary arrays and buffers.
      if (typeof s == 'object') {
        return s
      } else {
        $getChars(s, 0, l, chars, 0)
      }
      /// Add extra spaces in the array to break up the unicode symbols.
      for (i = 0; i < l; ++i) {
        ch = chars[i]
        if (ch >= 1 && ch <= 127) {
          ++elen
        } else if (!ch || (ch >= 128 && ch <= 2047)) {
          elen += 2
        } else {
          elen += 3
        }
      }
      data = []
      elen = 0
      for (i = 0; i < l; ++i) {
        ch = chars[i]
        if (ch >= 1 && ch <= 127) {
          data[elen++] = (ch << 24) >> 24
        } else if (!ch || (ch >= 128 && ch <= 2047)) {
          data[elen++] = ((192 | ((ch >> 6) & 31)) << 24) >> 24
          data[elen++] = ((128 | (ch & 63)) << 24) >> 24
        } else {
          data[elen++] = ((224 | ((ch >> 12) & 15)) << 24) >> 24
          data[elen++] = ((128 | ((ch >> 6) & 63)) << 24) >> 24
          data[elen++] = ((128 | (ch & 63)) << 24) >> 24
        }
      }
      return data
    }
    /** ce */

    function toDouble(a) {
      return a[1] + a[0]
    }

    /** cs */
    function compress(str, mode, on_finish, on_progress) {
      var this$static = {},
        percent,
        cbn, /// A callback number should be supplied instead of on_finish() if we are using Web Workers.
        sync =
          typeof on_finish == 'undefined' && typeof on_progress == 'undefined'

      if (typeof on_finish != 'function') {
        cbn = on_finish
        on_finish = on_progress = 0
      }

      on_progress =
        on_progress ||
        function (percent) {
          if (typeof cbn == 'undefined') return

          return update_progress(percent, cbn)
        }

      on_finish =
        on_finish ||
        function (res, err) {
          if (typeof cbn == 'undefined') return

          return postMessage({
            action: action_compress,
            cbn: cbn,
            result: res,
            error: err
          })
        }

      if (sync) {
        this$static.c = $LZMAByteArrayCompressor(
          {},
          encode(str),
          get_mode_obj(mode)
        )
        while ($processChunk(this$static.c.chunker));
        return $toByteArray(this$static.c.output)
      }

      try {
        this$static.c = $LZMAByteArrayCompressor(
          {},
          encode(str),
          get_mode_obj(mode)
        )

        on_progress(0)
      } catch (err) {
        return on_finish(null, err)
      }

      function do_action() {
        try {
          var res,
            start = new Date().getTime()

          while ($processChunk(this$static.c.chunker)) {
            percent =
              toDouble(this$static.c.chunker.inBytesProcessed) /
              toDouble(this$static.c.length_0)
            /// If about 200 miliseconds have passed, update the progress.
            if (new Date().getTime() - start > 200) {
              on_progress(percent)

              wait(do_action, 0)
              return 0
            }
          }

          on_progress(1)

          res = $toByteArray(this$static.c.output)

          /// delay so we don’t catch errors from the on_finish handler
          wait(on_finish.bind(null, res), 0)
        } catch (err) {
          on_finish(null, err)
        }
      }

      ///NOTE: We need to wait to make sure it is always async.
      wait(do_action, 0)
    }
    /** ce */
    /** ds */
    function decompress(byte_arr, on_finish, on_progress) {
      var this$static = {},
        percent,
        cbn, /// A callback number should be supplied instead of on_finish() if we are using Web Workers.
        has_progress,
        len,
        sync =
          typeof on_finish == 'undefined' && typeof on_progress == 'undefined'

      if (typeof on_finish != 'function') {
        cbn = on_finish
        on_finish = on_progress = 0
      }

      on_progress =
        on_progress ||
        function (percent) {
          if (typeof cbn == 'undefined') return

          return update_progress(has_progress ? percent : -1, cbn)
        }

      on_finish =
        on_finish ||
        function (res, err) {
          if (typeof cbn == 'undefined') return

          return postMessage({
            action: action_decompress,
            cbn: cbn,
            result: res,
            error: err
          })
        }

      if (sync) {
        this$static.d = $LZMAByteArrayDecompressor({}, byte_arr)
        while ($processChunk(this$static.d.chunker));
        return decode($toByteArray(this$static.d.output))
      }

      try {
        this$static.d = $LZMAByteArrayDecompressor({}, byte_arr)

        len = toDouble(this$static.d.length_0)

        ///NOTE: If the data was created via a stream, it will not have a length value, and therefore we can't calculate the progress.
        has_progress = len > -1

        on_progress(0)
      } catch (err) {
        return on_finish(null, err)
      }

      function do_action() {
        try {
          var res,
            i = 0,
            start = new Date().getTime()
          while ($processChunk(this$static.d.chunker)) {
            if (++i % 1000 == 0 && new Date().getTime() - start > 200) {
              if (has_progress) {
                percent = toDouble(this$static.d.chunker.decoder.nowPos64) / len
                /// If about 200 miliseconds have passed, update the progress.
                on_progress(percent)
              }

              ///NOTE: This allows other code to run, like the browser to update.
              wait(do_action, 0)
              return 0
            }
          }

          on_progress(1)

          res = decode($toByteArray(this$static.d.output))

          /// delay so we don’t catch errors from the on_finish handler
          wait(on_finish.bind(null, res), 0)
        } catch (err) {
          on_finish(null, err)
        }
      }

      ///NOTE: We need to wait to make sure it is always async.
      wait(do_action, 0)
    }
    /** de */
    /** cs */
    var get_mode_obj = (function () {
      /// s is dictionarySize
      /// f is fb
      /// m is matchFinder
      ///NOTE: Because some values are always the same, they have been removed.
      /// lc is always 3
      /// lp is always 0
      /// pb is always 2
      var modes = [
        { s: 16, f: 64, m: 0 },
        { s: 20, f: 64, m: 0 },
        { s: 19, f: 64, m: 1 },
        { s: 20, f: 64, m: 1 },
        { s: 21, f: 128, m: 1 },
        { s: 22, f: 128, m: 1 },
        { s: 23, f: 128, m: 1 },
        { s: 24, f: 255, m: 1 },
        { s: 25, f: 255, m: 1 }
      ]

      return function (mode) {
        return modes[mode - 1] || modes[6]
      }
    })()
    /** ce */

    /// If we're in a Web Worker, create the onmessage() communication channel.
    ///NOTE: This seems to be the most reliable way to detect this.
    if (
      typeof onmessage != 'undefined' &&
      (typeof window == 'undefined' || typeof window.document == 'undefined')
    ) {
      ;(function () {
        /* jshint -W020 */
        /// Create the global onmessage function.
        onmessage = function (e) {
          if (e && e.data) {
            /** xs */
            if (e.data.action == action_decompress) {
              LZMA.decompress(e.data.data, e.data.cbn)
            } else if (e.data.action == action_compress) {
              LZMA.compress(e.data.data, e.data.mode, e.data.cbn)
            }
            /** xe */
            /// co:if (e.data.action == action_compress) {
            /// co:    LZMA.compress(e.data.data, e.data.mode, e.data.cbn);
            /// co:}
            /// do:if (e.data.action == action_decompress) {
            /// do:    LZMA.decompress(e.data.data, e.data.cbn);
            /// do:}
          }
        }
      })()
    }

    return {
      /** xs */
      compress: compress,
      decompress: decompress
      /** xe */
      /// co:compress:   compress
      /// do:decompress: decompress
    }
  })()

  /// This is used by browsers that do not support web workers (and possibly Node.js).
  commonjsGlobal.LZMA = commonjsGlobal.LZMA_WORKER = LZMA
  return lzma_worker
}

requireLzma_worker()

//import 'node-self' //TODO : use this one for useGlobal?
var lzma = () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const useGlobal = isNode ? global : window
  const { LZMA /*, LZMA_WORKER*/ } = useGlobal || {}
  //console.log({ LZMA_WORKER, LZMA })
  return LZMA
}

var lzma$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  default: lzma
})

/**
 * EasyQRCodeJS
 *
 * Cross-browser QRCode generator for pure javascript. Support Canvas, SVG and Table drawing methods. Support Dot style, Logo, Background image, Colorful, Title etc. settings. Support Angular, Vue.js, React, Next.js, Svelte framework. Support binary(hex) data mode.(Running with DOM on client side)
 *
 * Version 4.6.0
 *
 * @author [ inthinkcolor@gmail.com ]
 *
 * @see https://github.com/ushelp/EasyQRCodeJS
 * @see http://www.easyproject.cn/easyqrcodejs/tryit.html
 * @see https://github.com/ushelp/EasyQRCodeJS-NodeJS
 *
 * Copyright 2017 Ray, EasyProject
 * Released under the MIT license
 *
 * [Support AMD, CMD, CommonJS/Node.js]
 *
 */
!(function () {
  function a(a, b) {
    var c,
      d = Object.keys(b)
    for (c = 0; c < d.length; c++)
      a = a.replace(new RegExp('\\{' + d[c] + '\\}', 'gi'), b[d[c]])
    return a
  }
  function b(a) {
    var b, c, d
    if (!a)
      throw new Error(
        'cannot create a random attribute name for an undefined object'
      )
    ;(b = 'ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'), (c = '')
    do {
      for (c = '', d = 0; d < 12; d++)
        c += b[Math.floor(Math.random() * b.length)]
    } while (a[c])
    return c
  }
  function c(a) {
    var b = {
      left: 'start',
      right: 'end',
      center: 'middle',
      start: 'start',
      end: 'end'
    }
    return b[a] || b.start
  }
  function d(a) {
    var b = {
      alphabetic: 'alphabetic',
      hanging: 'hanging',
      top: 'text-before-edge',
      bottom: 'text-after-edge',
      middle: 'central'
    }
    return b[a] || b.alphabetic
  }
  var e, f, g, h, i
  ;(i = (function (a, b) {
    var c,
      d,
      e,
      f = {}
    for (a = a.split(','), b = b || 10, c = 0; c < a.length; c += 2)
      (d = '&' + a[c + 1] + ';'),
        (e = parseInt(a[c], b)),
        (f[d] = '&#' + e + ';')
    return (f['\\xa0'] = '&#160;'), f
  })(
    '50,nbsp,51,iexcl,52,cent,53,pound,54,curren,55,yen,56,brvbar,57,sect,58,uml,59,copy,5a,ordf,5b,laquo,5c,not,5d,shy,5e,reg,5f,macr,5g,deg,5h,plusmn,5i,sup2,5j,sup3,5k,acute,5l,micro,5m,para,5n,middot,5o,cedil,5p,sup1,5q,ordm,5r,raquo,5s,frac14,5t,frac12,5u,frac34,5v,iquest,60,Agrave,61,Aacute,62,Acirc,63,Atilde,64,Auml,65,Aring,66,AElig,67,Ccedil,68,Egrave,69,Eacute,6a,Ecirc,6b,Euml,6c,Igrave,6d,Iacute,6e,Icirc,6f,Iuml,6g,ETH,6h,Ntilde,6i,Ograve,6j,Oacute,6k,Ocirc,6l,Otilde,6m,Ouml,6n,times,6o,Oslash,6p,Ugrave,6q,Uacute,6r,Ucirc,6s,Uuml,6t,Yacute,6u,THORN,6v,szlig,70,agrave,71,aacute,72,acirc,73,atilde,74,auml,75,aring,76,aelig,77,ccedil,78,egrave,79,eacute,7a,ecirc,7b,euml,7c,igrave,7d,iacute,7e,icirc,7f,iuml,7g,eth,7h,ntilde,7i,ograve,7j,oacute,7k,ocirc,7l,otilde,7m,ouml,7n,divide,7o,oslash,7p,ugrave,7q,uacute,7r,ucirc,7s,uuml,7t,yacute,7u,thorn,7v,yuml,ci,fnof,sh,Alpha,si,Beta,sj,Gamma,sk,Delta,sl,Epsilon,sm,Zeta,sn,Eta,so,Theta,sp,Iota,sq,Kappa,sr,Lambda,ss,Mu,st,Nu,su,Xi,sv,Omicron,t0,Pi,t1,Rho,t3,Sigma,t4,Tau,t5,Upsilon,t6,Phi,t7,Chi,t8,Psi,t9,Omega,th,alpha,ti,beta,tj,gamma,tk,delta,tl,epsilon,tm,zeta,tn,eta,to,theta,tp,iota,tq,kappa,tr,lambda,ts,mu,tt,nu,tu,xi,tv,omicron,u0,pi,u1,rho,u2,sigmaf,u3,sigma,u4,tau,u5,upsilon,u6,phi,u7,chi,u8,psi,u9,omega,uh,thetasym,ui,upsih,um,piv,812,bull,816,hellip,81i,prime,81j,Prime,81u,oline,824,frasl,88o,weierp,88h,image,88s,real,892,trade,89l,alefsym,8cg,larr,8ch,uarr,8ci,rarr,8cj,darr,8ck,harr,8dl,crarr,8eg,lArr,8eh,uArr,8ei,rArr,8ej,dArr,8ek,hArr,8g0,forall,8g2,part,8g3,exist,8g5,empty,8g7,nabla,8g8,isin,8g9,notin,8gb,ni,8gf,prod,8gh,sum,8gi,minus,8gn,lowast,8gq,radic,8gt,prop,8gu,infin,8h0,ang,8h7,and,8h8,or,8h9,cap,8ha,cup,8hb,int,8hk,there4,8hs,sim,8i5,cong,8i8,asymp,8j0,ne,8j1,equiv,8j4,le,8j5,ge,8k2,sub,8k3,sup,8k4,nsub,8k6,sube,8k7,supe,8kl,oplus,8kn,otimes,8l5,perp,8m5,sdot,8o8,lceil,8o9,rceil,8oa,lfloor,8ob,rfloor,8p9,lang,8pa,rang,9ea,loz,9j0,spades,9j3,clubs,9j5,hearts,9j6,diams,ai,OElig,aj,oelig,b0,Scaron,b1,scaron,bo,Yuml,m6,circ,ms,tilde,802,ensp,803,emsp,809,thinsp,80c,zwnj,80d,zwj,80e,lrm,80f,rlm,80j,ndash,80k,mdash,80o,lsquo,80p,rsquo,80q,sbquo,80s,ldquo,80t,rdquo,80u,bdquo,810,dagger,811,Dagger,81g,permil,81p,lsaquo,81q,rsaquo,85c,euro',
    32
  )),
    (e = {
      strokeStyle: {
        svgAttr: 'stroke',
        canvas: '#000000',
        svg: 'none',
        apply: 'stroke'
      },
      fillStyle: {
        svgAttr: 'fill',
        canvas: '#000000',
        svg: null,
        apply: 'fill'
      },
      lineCap: {
        svgAttr: 'stroke-linecap',
        canvas: 'butt',
        svg: 'butt',
        apply: 'stroke'
      },
      lineJoin: {
        svgAttr: 'stroke-linejoin',
        canvas: 'miter',
        svg: 'miter',
        apply: 'stroke'
      },
      miterLimit: {
        svgAttr: 'stroke-miterlimit',
        canvas: 10,
        svg: 4,
        apply: 'stroke'
      },
      lineWidth: {
        svgAttr: 'stroke-width',
        canvas: 1,
        svg: 1,
        apply: 'stroke'
      },
      globalAlpha: {
        svgAttr: 'opacity',
        canvas: 1,
        svg: 1,
        apply: 'fill stroke'
      },
      font: { canvas: '10px sans-serif' },
      shadowColor: { canvas: '#000000' },
      shadowOffsetX: { canvas: 0 },
      shadowOffsetY: { canvas: 0 },
      shadowBlur: { canvas: 0 },
      textAlign: { canvas: 'start' },
      textBaseline: { canvas: 'alphabetic' },
      lineDash: {
        svgAttr: 'stroke-dasharray',
        canvas: [],
        svg: null,
        apply: 'stroke'
      }
    }),
    (g = function (a, b) {
      ;(this.__root = a), (this.__ctx = b)
    }),
    (g.prototype.addColorStop = function (b, c) {
      var d,
        e,
        f = this.__ctx.__createElement('stop')
      f.setAttribute('offset', b),
        -1 !== c.indexOf('rgba')
          ? ((d =
              /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d?\.?\d*)\s*\)/gi),
            (e = d.exec(c)),
            f.setAttribute(
              'stop-color',
              a('rgb({r},{g},{b})', { r: e[1], g: e[2], b: e[3] })
            ),
            f.setAttribute('stop-opacity', e[4]))
          : f.setAttribute('stop-color', c),
        this.__root.appendChild(f)
    }),
    (h = function (a, b) {
      ;(this.__root = a), (this.__ctx = b)
    }),
    (f = function (a) {
      var b,
        c = { width: 500, height: 500, enableMirroring: !1 }
      if (
        (arguments.length > 1
          ? ((b = c), (b.width = arguments[0]), (b.height = arguments[1]))
          : (b = a || c),
        !(this instanceof f))
      )
        return new f(b)
      ;(this.width = b.width || c.width),
        (this.height = b.height || c.height),
        (this.enableMirroring =
          void 0 !== b.enableMirroring ? b.enableMirroring : c.enableMirroring),
        (this.canvas = this),
        (this.__document = b.document || document),
        b.ctx
          ? (this.__ctx = b.ctx)
          : ((this.__canvas = this.__document.createElement('canvas')),
            (this.__ctx = this.__canvas.getContext('2d'))),
        this.__setDefaultStyles(),
        (this.__stack = [this.__getStyleState()]),
        (this.__groupStack = []),
        (this.__root = this.__document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        )),
        this.__root.setAttribute('version', 1.1),
        this.__root.setAttribute('xmlns', 'http://www.w3.org/2000/svg'),
        this.__root.setAttributeNS(
          'http://www.w3.org/2000/xmlns/',
          'xmlns:xlink',
          'http://www.w3.org/1999/xlink'
        ),
        this.__root.setAttribute('width', this.width),
        this.__root.setAttribute('height', this.height),
        (this.__ids = {}),
        (this.__defs = this.__document.createElementNS(
          'http://www.w3.org/2000/svg',
          'defs'
        )),
        this.__root.appendChild(this.__defs),
        (this.__currentElement = this.__document.createElementNS(
          'http://www.w3.org/2000/svg',
          'g'
        )),
        this.__root.appendChild(this.__currentElement)
    }),
    (f.prototype.__createElement = function (a, b, c) {
      void 0 === b && (b = {})
      var d,
        e,
        f = this.__document.createElementNS('http://www.w3.org/2000/svg', a),
        g = Object.keys(b)
      for (
        c && (f.setAttribute('fill', 'none'), f.setAttribute('stroke', 'none')),
          d = 0;
        d < g.length;
        d++
      )
        (e = g[d]), f.setAttribute(e, b[e])
      return f
    }),
    (f.prototype.__setDefaultStyles = function () {
      var a,
        b,
        c = Object.keys(e)
      for (a = 0; a < c.length; a++) (b = c[a]), (this[b] = e[b].canvas)
    }),
    (f.prototype.__applyStyleState = function (a) {
      var b,
        c,
        d = Object.keys(a)
      for (b = 0; b < d.length; b++) (c = d[b]), (this[c] = a[c])
    }),
    (f.prototype.__getStyleState = function () {
      var a,
        b,
        c = {},
        d = Object.keys(e)
      for (a = 0; a < d.length; a++) (b = d[a]), (c[b] = this[b])
      return c
    }),
    (f.prototype.__applyStyleToCurrentElement = function (b) {
      var c = this.__currentElement,
        d = this.__currentElementsToStyle
      d &&
        (c.setAttribute(b, ''),
        (c = d.element),
        d.children.forEach(function (a) {
          a.setAttribute(b, '')
        }))
      var f,
        i,
        j,
        k,
        l,
        m,
        n = Object.keys(e)
      for (f = 0; f < n.length; f++)
        if (((i = e[n[f]]), (j = this[n[f]]), i.apply))
          if (j instanceof h) {
            if (j.__ctx)
              for (; j.__ctx.__defs.childNodes.length; )
                (k = j.__ctx.__defs.childNodes[0].getAttribute('id')),
                  (this.__ids[k] = k),
                  this.__defs.appendChild(j.__ctx.__defs.childNodes[0])
            c.setAttribute(
              i.apply,
              a('url(#{id})', { id: j.__root.getAttribute('id') })
            )
          } else if (j instanceof g)
            c.setAttribute(
              i.apply,
              a('url(#{id})', { id: j.__root.getAttribute('id') })
            )
          else if (-1 !== i.apply.indexOf(b) && i.svg !== j)
            if (
              ('stroke' !== i.svgAttr && 'fill' !== i.svgAttr) ||
              -1 === j.indexOf('rgba')
            ) {
              var o = i.svgAttr
              if (
                'globalAlpha' === n[f] &&
                ((o = b + '-' + i.svgAttr), c.getAttribute(o))
              )
                continue
              c.setAttribute(o, j)
            } else {
              ;(l =
                /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d?\.?\d*)\s*\)/gi),
                (m = l.exec(j)),
                c.setAttribute(
                  i.svgAttr,
                  a('rgb({r},{g},{b})', { r: m[1], g: m[2], b: m[3] })
                )
              var p = m[4],
                q = this.globalAlpha
              null != q && (p *= q), c.setAttribute(i.svgAttr + '-opacity', p)
            }
    }),
    (f.prototype.__closestGroupOrSvg = function (a) {
      return (
        (a = a || this.__currentElement),
        'g' === a.nodeName || 'svg' === a.nodeName
          ? a
          : this.__closestGroupOrSvg(a.parentNode)
      )
    }),
    (f.prototype.getSerializedSvg = function (a) {
      var b,
        c,
        d,
        e,
        f,
        g,
        h = new XMLSerializer().serializeToString(this.__root)
      if (
        ((g =
          /xmlns="http:\/\/www\.w3\.org\/2000\/svg".+xmlns="http:\/\/www\.w3\.org\/2000\/svg/gi),
        g.test(h) &&
          (h = h.replace(
            'xmlns="http://www.w3.org/2000/svg',
            'xmlns:xlink="http://www.w3.org/1999/xlink'
          )),
        a)
      )
        for (b = Object.keys(i), c = 0; c < b.length; c++)
          (d = b[c]),
            (e = i[d]),
            (f = new RegExp(d, 'gi')),
            f.test(h) && (h = h.replace(f, e))
      return h
    }),
    (f.prototype.getSvg = function () {
      return this.__root
    }),
    (f.prototype.save = function () {
      var a = this.__createElement('g'),
        b = this.__closestGroupOrSvg()
      this.__groupStack.push(b),
        b.appendChild(a),
        (this.__currentElement = a),
        this.__stack.push(this.__getStyleState())
    }),
    (f.prototype.restore = function () {
      ;(this.__currentElement = this.__groupStack.pop()),
        (this.__currentElementsToStyle = null),
        this.__currentElement ||
          (this.__currentElement = this.__root.childNodes[1])
      var a = this.__stack.pop()
      this.__applyStyleState(a)
    }),
    (f.prototype.__addTransform = function (a) {
      var b = this.__closestGroupOrSvg()
      if (b.childNodes.length > 0) {
        'path' === this.__currentElement.nodeName &&
          (this.__currentElementsToStyle ||
            (this.__currentElementsToStyle = { element: b, children: [] }),
          this.__currentElementsToStyle.children.push(this.__currentElement),
          this.__applyCurrentDefaultPath())
        var c = this.__createElement('g')
        b.appendChild(c), (this.__currentElement = c)
      }
      var d = this.__currentElement.getAttribute('transform')
      d ? (d += ' ') : (d = ''),
        (d += a),
        this.__currentElement.setAttribute('transform', d)
    }),
    (f.prototype.scale = function (b, c) {
      void 0 === c && (c = b),
        this.__addTransform(a('scale({x},{y})', { x: b, y: c }))
    }),
    (f.prototype.rotate = function (b) {
      var c = (180 * b) / Math.PI
      this.__addTransform(
        a('rotate({angle},{cx},{cy})', { angle: c, cx: 0, cy: 0 })
      )
    }),
    (f.prototype.translate = function (b, c) {
      this.__addTransform(a('translate({x},{y})', { x: b, y: c }))
    }),
    (f.prototype.transform = function (b, c, d, e, f, g) {
      this.__addTransform(
        a('matrix({a},{b},{c},{d},{e},{f})', {
          a: b,
          b: c,
          c: d,
          d: e,
          e: f,
          f: g
        })
      )
    }),
    (f.prototype.beginPath = function () {
      var a, b
      ;(this.__currentDefaultPath = ''),
        (this.__currentPosition = {}),
        (a = this.__createElement('path', {}, !0)),
        (b = this.__closestGroupOrSvg()),
        b.appendChild(a),
        (this.__currentElement = a)
    }),
    (f.prototype.__applyCurrentDefaultPath = function () {
      var a = this.__currentElement
      'path' === a.nodeName
        ? a.setAttribute('d', this.__currentDefaultPath)
        : console.error('Attempted to apply path command to node', a.nodeName)
    }),
    (f.prototype.__addPathCommand = function (a) {
      ;(this.__currentDefaultPath += ' '), (this.__currentDefaultPath += a)
    }),
    (f.prototype.moveTo = function (b, c) {
      'path' !== this.__currentElement.nodeName && this.beginPath(),
        (this.__currentPosition = { x: b, y: c }),
        this.__addPathCommand(a('M {x} {y}', { x: b, y: c }))
    }),
    (f.prototype.closePath = function () {
      this.__currentDefaultPath && this.__addPathCommand('Z')
    }),
    (f.prototype.lineTo = function (b, c) {
      ;(this.__currentPosition = { x: b, y: c }),
        this.__currentDefaultPath.indexOf('M') > -1
          ? this.__addPathCommand(a('L {x} {y}', { x: b, y: c }))
          : this.__addPathCommand(a('M {x} {y}', { x: b, y: c }))
    }),
    (f.prototype.bezierCurveTo = function (b, c, d, e, f, g) {
      ;(this.__currentPosition = { x: f, y: g }),
        this.__addPathCommand(
          a('C {cp1x} {cp1y} {cp2x} {cp2y} {x} {y}', {
            cp1x: b,
            cp1y: c,
            cp2x: d,
            cp2y: e,
            x: f,
            y: g
          })
        )
    }),
    (f.prototype.quadraticCurveTo = function (b, c, d, e) {
      ;(this.__currentPosition = { x: d, y: e }),
        this.__addPathCommand(
          a('Q {cpx} {cpy} {x} {y}', { cpx: b, cpy: c, x: d, y: e })
        )
    })
  var j = function (a) {
    var b = Math.sqrt(a[0] * a[0] + a[1] * a[1])
    return [a[0] / b, a[1] / b]
  }
  ;(f.prototype.arcTo = function (a, b, c, d, e) {
    var f = this.__currentPosition && this.__currentPosition.x,
      g = this.__currentPosition && this.__currentPosition.y
    if (void 0 !== f && void 0 !== g) {
      if (e < 0)
        throw new Error(
          'IndexSizeError: The radius provided (' + e + ') is negative.'
        )
      if ((f === a && g === b) || (a === c && b === d) || 0 === e)
        return void this.lineTo(a, b)
      var h = j([f - a, g - b]),
        i = j([c - a, d - b])
      if (h[0] * i[1] == h[1] * i[0]) return void this.lineTo(a, b)
      var k = h[0] * i[0] + h[1] * i[1],
        l = Math.acos(Math.abs(k)),
        m = j([h[0] + i[0], h[1] + i[1]]),
        n = e / Math.sin(l / 2),
        o = a + n * m[0],
        p = b + n * m[1],
        q = [-h[1], h[0]],
        r = [i[1], -i[0]],
        s = function (a) {
          var b = a[0]
          return a[1] >= 0 ? Math.acos(b) : -Math.acos(b)
        },
        t = s(q),
        u = s(r)
      this.lineTo(o + q[0] * e, p + q[1] * e), this.arc(o, p, e, t, u)
    }
  }),
    (f.prototype.stroke = function () {
      'path' === this.__currentElement.nodeName &&
        this.__currentElement.setAttribute(
          'paint-order',
          'fill stroke markers'
        ),
        this.__applyCurrentDefaultPath(),
        this.__applyStyleToCurrentElement('stroke')
    }),
    (f.prototype.fill = function () {
      'path' === this.__currentElement.nodeName &&
        this.__currentElement.setAttribute(
          'paint-order',
          'stroke fill markers'
        ),
        this.__applyCurrentDefaultPath(),
        this.__applyStyleToCurrentElement('fill')
    }),
    (f.prototype.rect = function (a, b, c, d) {
      'path' !== this.__currentElement.nodeName && this.beginPath(),
        this.moveTo(a, b),
        this.lineTo(a + c, b),
        this.lineTo(a + c, b + d),
        this.lineTo(a, b + d),
        this.lineTo(a, b),
        this.closePath()
    }),
    (f.prototype.fillRect = function (a, b, c, d) {
      var e, f
      ;(e = this.__createElement(
        'rect',
        { x: a, y: b, width: c, height: d, 'shape-rendering': 'crispEdges' },
        !0
      )),
        (f = this.__closestGroupOrSvg()),
        f.appendChild(e),
        (this.__currentElement = e),
        this.__applyStyleToCurrentElement('fill')
    }),
    (f.prototype.strokeRect = function (a, b, c, d) {
      var e, f
      ;(e = this.__createElement(
        'rect',
        { x: a, y: b, width: c, height: d },
        !0
      )),
        (f = this.__closestGroupOrSvg()),
        f.appendChild(e),
        (this.__currentElement = e),
        this.__applyStyleToCurrentElement('stroke')
    }),
    (f.prototype.__clearCanvas = function () {
      for (
        var a = this.__closestGroupOrSvg(),
          b = a.getAttribute('transform'),
          c = this.__root.childNodes[1],
          d = c.childNodes,
          e = d.length - 1;
        e >= 0;
        e--
      )
        d[e] && c.removeChild(d[e])
      ;(this.__currentElement = c),
        (this.__groupStack = []),
        b && this.__addTransform(b)
    }),
    (f.prototype.clearRect = function (a, b, c, d) {
      if (0 === a && 0 === b && c === this.width && d === this.height)
        return void this.__clearCanvas()
      var e,
        f = this.__closestGroupOrSvg()
      ;(e = this.__createElement(
        'rect',
        { x: a, y: b, width: c, height: d, fill: '#FFFFFF' },
        !0
      )),
        f.appendChild(e)
    }),
    (f.prototype.createLinearGradient = function (a, c, d, e) {
      var f = this.__createElement(
        'linearGradient',
        {
          id: b(this.__ids),
          x1: a + 'px',
          x2: d + 'px',
          y1: c + 'px',
          y2: e + 'px',
          gradientUnits: 'userSpaceOnUse'
        },
        !1
      )
      return this.__defs.appendChild(f), new g(f, this)
    }),
    (f.prototype.createRadialGradient = function (a, c, d, e, f, h) {
      var i = this.__createElement(
        'radialGradient',
        {
          id: b(this.__ids),
          cx: e + 'px',
          cy: f + 'px',
          r: h + 'px',
          fx: a + 'px',
          fy: c + 'px',
          gradientUnits: 'userSpaceOnUse'
        },
        !1
      )
      return this.__defs.appendChild(i), new g(i, this)
    }),
    (f.prototype.__parseFont = function () {
      var a =
          /^\s*(?=(?:(?:[-a-z]+\s*){0,2}(italic|oblique))?)(?=(?:(?:[-a-z]+\s*){0,2}(small-caps))?)(?=(?:(?:[-a-z]+\s*){0,2}(bold(?:er)?|lighter|[1-9]00))?)(?:(?:normal|\1|\2|\3)\s*){0,3}((?:xx?-)?(?:small|large)|medium|smaller|larger|[.\d]+(?:\%|in|[cem]m|ex|p[ctx]))(?:\s*\/\s*(normal|[.\d]+(?:\%|in|[cem]m|ex|p[ctx])))?\s*([-,\'\"\sa-z0-9]+?)\s*$/i,
        b = a.exec(this.font),
        c = {
          style: b[1] || 'normal',
          size: b[4] || '10px',
          family: b[6] || 'sans-serif',
          weight: b[3] || 'normal',
          decoration: b[2] || 'normal',
          href: null
        }
      return (
        'underline' === this.__fontUnderline && (c.decoration = 'underline'),
        this.__fontHref && (c.href = this.__fontHref),
        c
      )
    }),
    (f.prototype.__wrapTextLink = function (a, b) {
      if (a.href) {
        var c = this.__createElement('a')
        return (
          c.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'xlink:href',
            a.href
          ),
          c.appendChild(b),
          c
        )
      }
      return b
    }),
    (f.prototype.__applyText = function (a, b, e, f) {
      var g = this.__parseFont(),
        h = this.__closestGroupOrSvg(),
        i = this.__createElement(
          'text',
          {
            'font-family': g.family,
            'font-size': g.size,
            'font-style': g.style,
            'font-weight': g.weight,
            'text-decoration': g.decoration,
            x: b,
            y: e,
            'text-anchor': c(this.textAlign),
            'dominant-baseline': d(this.textBaseline)
          },
          !0
        )
      i.appendChild(this.__document.createTextNode(a)),
        (this.__currentElement = i),
        this.__applyStyleToCurrentElement(f),
        h.appendChild(this.__wrapTextLink(g, i))
    }),
    (f.prototype.fillText = function (a, b, c) {
      this.__applyText(a, b, c, 'fill')
    }),
    (f.prototype.strokeText = function (a, b, c) {
      this.__applyText(a, b, c, 'stroke')
    }),
    (f.prototype.measureText = function (a) {
      return (this.__ctx.font = this.font), this.__ctx.measureText(a)
    }),
    (f.prototype.arc = function (b, c, d, e, f, g) {
      if (e !== f) {
        ;(e %= 2 * Math.PI),
          (f %= 2 * Math.PI),
          e === f &&
            (f = (f + 2 * Math.PI - 0.001 * (g ? -1 : 1)) % (2 * Math.PI))
        var h = b + d * Math.cos(f),
          i = c + d * Math.sin(f),
          j = b + d * Math.cos(e),
          k = c + d * Math.sin(e),
          l = g ? 0 : 1,
          m = 0,
          n = f - e
        n < 0 && (n += 2 * Math.PI),
          (m = g ? (n > Math.PI ? 0 : 1) : n > Math.PI ? 1 : 0),
          this.lineTo(j, k),
          this.__addPathCommand(
            a(
              'A {rx} {ry} {xAxisRotation} {largeArcFlag} {sweepFlag} {endX} {endY}',
              {
                rx: d,
                ry: d,
                xAxisRotation: 0,
                largeArcFlag: m,
                sweepFlag: l,
                endX: h,
                endY: i
              }
            )
          ),
          (this.__currentPosition = { x: h, y: i })
      }
    }),
    (f.prototype.clip = function () {
      var c = this.__closestGroupOrSvg(),
        d = this.__createElement('clipPath'),
        e = b(this.__ids),
        f = this.__createElement('g')
      this.__applyCurrentDefaultPath(),
        c.removeChild(this.__currentElement),
        d.setAttribute('id', e),
        d.appendChild(this.__currentElement),
        this.__defs.appendChild(d),
        c.setAttribute('clip-path', a('url(#{id})', { id: e })),
        c.appendChild(f),
        (this.__currentElement = f)
    }),
    (f.prototype.drawImage = function () {
      var a,
        b,
        c,
        d,
        e,
        g,
        h,
        i,
        j,
        k,
        l,
        m,
        n,
        o,
        p = Array.prototype.slice.call(arguments),
        q = p[0],
        r = 0,
        s = 0
      if (3 === p.length)
        (a = p[1]), (b = p[2]), (e = q.width), (g = q.height), (c = e), (d = g)
      else if (5 === p.length)
        (a = p[1]),
          (b = p[2]),
          (c = p[3]),
          (d = p[4]),
          (e = q.width),
          (g = q.height)
      else {
        if (9 !== p.length)
          throw new Error(
            'Invalid number of arguments passed to drawImage: ' +
              arguments.length
          )
        ;(r = p[1]),
          (s = p[2]),
          (e = p[3]),
          (g = p[4]),
          (a = p[5]),
          (b = p[6]),
          (c = p[7]),
          (d = p[8])
      }
      ;(h = this.__closestGroupOrSvg()), this.__currentElement
      var t = 'translate(' + a + ', ' + b + ')'
      if (q instanceof f) {
        if (
          ((i = q.getSvg().cloneNode(!0)),
          i.childNodes && i.childNodes.length > 1)
        ) {
          for (j = i.childNodes[0]; j.childNodes.length; )
            (o = j.childNodes[0].getAttribute('id')),
              (this.__ids[o] = o),
              this.__defs.appendChild(j.childNodes[0])
          if ((k = i.childNodes[1])) {
            var u,
              v = k.getAttribute('transform')
            ;(u = v ? v + ' ' + t : t),
              k.setAttribute('transform', u),
              h.appendChild(k)
          }
        }
      } else
        ('CANVAS' !== q.nodeName && 'IMG' !== q.nodeName) ||
          ((l = this.__createElement('image')),
          l.setAttribute('width', c),
          l.setAttribute('height', d),
          l.setAttribute('preserveAspectRatio', 'none'),
          l.setAttribute('opacity', this.globalAlpha),
          (r || s || e !== q.width || g !== q.height) &&
            ((m = this.__document.createElement('canvas')),
            (m.width = c),
            (m.height = d),
            (n = m.getContext('2d')),
            n.drawImage(q, r, s, e, g, 0, 0, c, d),
            (q = m)),
          l.setAttribute('transform', t),
          l.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'xlink:href',
            'CANVAS' === q.nodeName ? q.toDataURL() : q.originalSrc
          ),
          h.appendChild(l))
    }),
    (f.prototype.createPattern = function (a, c) {
      var d,
        e = this.__document.createElementNS(
          'http://www.w3.org/2000/svg',
          'pattern'
        ),
        g = b(this.__ids)
      return (
        e.setAttribute('id', g),
        e.setAttribute('width', a.width),
        e.setAttribute('height', a.height),
        'CANVAS' === a.nodeName || 'IMG' === a.nodeName
          ? ((d = this.__document.createElementNS(
              'http://www.w3.org/2000/svg',
              'image'
            )),
            d.setAttribute('width', a.width),
            d.setAttribute('height', a.height),
            d.setAttributeNS(
              'http://www.w3.org/1999/xlink',
              'xlink:href',
              'CANVAS' === a.nodeName ? a.toDataURL() : a.getAttribute('src')
            ),
            e.appendChild(d),
            this.__defs.appendChild(e))
          : a instanceof f &&
            (e.appendChild(a.__root.childNodes[1]), this.__defs.appendChild(e)),
        new h(e, this)
      )
    }),
    (f.prototype.setLineDash = function (a) {
      a && a.length > 0 ? (this.lineDash = a.join(',')) : (this.lineDash = null)
    }),
    (f.prototype.drawFocusRing = function () {}),
    (f.prototype.createImageData = function () {}),
    (f.prototype.getImageData = function () {}),
    (f.prototype.putImageData = function () {}),
    (f.prototype.globalCompositeOperation = function () {}),
    (f.prototype.setTransform = function () {}),
    'object' == typeof window && (window.C2S = f),
    'object' == typeof module &&
      'object' == typeof module.exports &&
      (module.exports = f)
})(),
  function () {
    function a(a, b, c) {
      if (
        ((this.mode = q.MODE_8BIT_BYTE),
        (this.data = a),
        (this.parsedData = []),
        b)
      ) {
        for (var d = 0, e = this.data.length; d < e; d++) {
          var f = [],
            g = this.data.charCodeAt(d)
          ;(f[0] = g), this.parsedData.push(f)
        }
        this.parsedData = Array.prototype.concat.apply([], this.parsedData)
      } else
        this.parsedData = (function (a) {
          for (var b = [], c = 0; c < a.length; c++) {
            var d = a.charCodeAt(c)
            d < 128
              ? b.push(d)
              : d < 2048
              ? b.push(192 | (d >> 6), 128 | (63 & d))
              : d < 55296 || d >= 57344
              ? b.push(224 | (d >> 12), 128 | ((d >> 6) & 63), 128 | (63 & d))
              : (c++,
                (d = 65536 + (((1023 & d) << 10) | (1023 & a.charCodeAt(c)))),
                b.push(
                  240 | (d >> 18),
                  128 | ((d >> 12) & 63),
                  128 | ((d >> 6) & 63),
                  128 | (63 & d)
                ))
          }
          return b
        })(a)
      ;(this.parsedData = Array.prototype.concat.apply([], this.parsedData)),
        c ||
          this.parsedData.length == this.data.length ||
          (this.parsedData.unshift(191),
          this.parsedData.unshift(187),
          this.parsedData.unshift(239))
    }
    function b(a, b) {
      ;(this.typeNumber = a),
        (this.errorCorrectLevel = b),
        (this.modules = null),
        (this.moduleCount = 0),
        (this.dataCache = null),
        (this.dataList = [])
    }
    function c(a, b) {
      if (a.length == i) throw new Error(a.length + '/' + b)
      for (var c = 0; c < a.length && 0 == a[c]; ) c++
      this.num = new Array(a.length - c + b)
      for (var d = 0; d < a.length - c; d++) this.num[d] = a[d + c]
    }
    function d(a, b) {
      ;(this.totalCount = a), (this.dataCount = b)
    }
    function e() {
      ;(this.buffer = []), (this.length = 0)
    }
    function f() {
      var a = !1,
        b = navigator.userAgent
      if (/android/i.test(b)) {
        a = !0
        var c = b.toString().match(/android ([0-9]\.[0-9])/i)
        c && c[1] && (a = parseFloat(c[1]))
      }
      return a
    }
    function g(a, b) {
      for (
        var c = b.correctLevel, d = 1, e = h(a), f = 0, g = w.length;
        f < g;
        f++
      ) {
        var i = 0
        switch (c) {
          case r.L:
            i = w[f][0]
            break
          case r.M:
            i = w[f][1]
            break
          case r.Q:
            i = w[f][2]
            break
          case r.H:
            i = w[f][3]
        }
        if (e <= i) break
        d++
      }
      if (d > w.length)
        throw new Error(
          'Too long data. the CorrectLevel.' +
            ['M', 'L', 'H', 'Q'][c] +
            ' limit length is ' +
            i
        )
      return (
        0 != b.version &&
          (d <= b.version
            ? ((d = b.version), (b.runVersion = d))
            : (console.warn(
                'QR Code version ' +
                  b.version +
                  ' too small, run version use ' +
                  d
              ),
              (b.runVersion = d))),
        d
      )
    }
    function h(a) {
      return encodeURI(a)
        .toString()
        .replace(/\%[0-9a-fA-F]{2}/g, 'a').length
    }
    var i,
      j,
      k =
        'object' == typeof global$1 &&
        global$1 &&
        global$1.Object === Object &&
        global$1,
      l = 'object' == typeof self && self && self.Object === Object && self,
      m = k || l || Function('return this')(),
      n = 'object' == typeof exports && exports && !exports.nodeType && exports,
      o =
        n && 'object' == typeof module && module && !module.nodeType && module,
      p = m.QRCode
    ;(a.prototype = {
      getLength: function (a) {
        return this.parsedData.length
      },
      write: function (a) {
        for (var b = 0, c = this.parsedData.length; b < c; b++)
          a.put(this.parsedData[b], 8)
      }
    }),
      (b.prototype = {
        addData: function (b, c, d) {
          var e = new a(b, c, d)
          this.dataList.push(e), (this.dataCache = null)
        },
        isDark: function (a, b) {
          if (a < 0 || this.moduleCount <= a || b < 0 || this.moduleCount <= b)
            throw new Error(a + ',' + b)
          return this.modules[a][b][0]
        },
        getEye: function (a, b) {
          if (a < 0 || this.moduleCount <= a || b < 0 || this.moduleCount <= b)
            throw new Error(a + ',' + b)
          var c = this.modules[a][b]
          if (c[1]) {
            var d = 'P' + c[1] + '_' + c[2]
            return 'A' == c[2] && (d = 'A' + c[1]), { isDark: c[0], type: d }
          }
          return null
        },
        getModuleCount: function () {
          return this.moduleCount
        },
        make: function () {
          this.makeImpl(!1, this.getBestMaskPattern())
        },
        makeImpl: function (a, c) {
          ;(this.moduleCount = 4 * this.typeNumber + 17),
            (this.modules = new Array(this.moduleCount))
          for (var d = 0; d < this.moduleCount; d++) {
            this.modules[d] = new Array(this.moduleCount)
            for (var e = 0; e < this.moduleCount; e++) this.modules[d][e] = []
          }
          this.setupPositionProbePattern(0, 0, 'TL'),
            this.setupPositionProbePattern(this.moduleCount - 7, 0, 'BL'),
            this.setupPositionProbePattern(0, this.moduleCount - 7, 'TR'),
            this.setupPositionAdjustPattern('A'),
            this.setupTimingPattern(),
            this.setupTypeInfo(a, c),
            this.typeNumber >= 7 && this.setupTypeNumber(a),
            null == this.dataCache &&
              (this.dataCache = b.createData(
                this.typeNumber,
                this.errorCorrectLevel,
                this.dataList
              )),
            this.mapData(this.dataCache, c)
        },
        setupPositionProbePattern: function (a, b, c) {
          for (var d = -1; d <= 7; d++)
            if (!(a + d <= -1 || this.moduleCount <= a + d))
              for (var e = -1; e <= 7; e++)
                b + e <= -1 ||
                  this.moduleCount <= b + e ||
                  ((0 <= d && d <= 6 && (0 == e || 6 == e)) ||
                  (0 <= e && e <= 6 && (0 == d || 6 == d)) ||
                  (2 <= d && d <= 4 && 2 <= e && e <= 4)
                    ? ((this.modules[a + d][b + e][0] = !0),
                      (this.modules[a + d][b + e][2] = c),
                      (this.modules[a + d][b + e][1] =
                        -0 == d || -0 == e || 6 == d || 6 == e ? 'O' : 'I'))
                    : (this.modules[a + d][b + e][0] = !1))
        },
        getBestMaskPattern: function () {
          for (var a = 0, b = 0, c = 0; c < 8; c++) {
            this.makeImpl(!0, c)
            var d = t.getLostPoint(this)
            ;(0 == c || a > d) && ((a = d), (b = c))
          }
          return b
        },
        createMovieClip: function (a, b, c) {
          var d = a.createEmptyMovieClip(b, c)
          this.make()
          for (var e = 0; e < this.modules.length; e++)
            for (var f = 1 * e, g = 0; g < this.modules[e].length; g++) {
              var h = 1 * g,
                i = this.modules[e][g][0]
              i &&
                (d.beginFill(0, 100),
                d.moveTo(h, f),
                d.lineTo(h + 1, f),
                d.lineTo(h + 1, f + 1),
                d.lineTo(h, f + 1),
                d.endFill())
            }
          return d
        },
        setupTimingPattern: function () {
          for (var a = 8; a < this.moduleCount - 8; a++)
            null == this.modules[a][6][0] &&
              (this.modules[a][6][0] = a % 2 == 0)
          for (var b = 8; b < this.moduleCount - 8; b++)
            null == this.modules[6][b][0] &&
              (this.modules[6][b][0] = b % 2 == 0)
        },
        setupPositionAdjustPattern: function (a) {
          for (
            var b = t.getPatternPosition(this.typeNumber), c = 0;
            c < b.length;
            c++
          )
            for (var d = 0; d < b.length; d++) {
              var e = b[c],
                f = b[d]
              if (null == this.modules[e][f][0])
                for (var g = -2; g <= 2; g++)
                  for (var h = -2; h <= 2; h++)
                    -2 == g || 2 == g || -2 == h || 2 == h || (0 == g && 0 == h)
                      ? ((this.modules[e + g][f + h][0] = !0),
                        (this.modules[e + g][f + h][2] = a),
                        (this.modules[e + g][f + h][1] =
                          -2 == g || -2 == h || 2 == g || 2 == h ? 'O' : 'I'))
                      : (this.modules[e + g][f + h][0] = !1)
            }
        },
        setupTypeNumber: function (a) {
          for (
            var b = t.getBCHTypeNumber(this.typeNumber), c = 0;
            c < 18;
            c++
          ) {
            var d = !a && 1 == ((b >> c) & 1)
            this.modules[Math.floor(c / 3)][
              (c % 3) + this.moduleCount - 8 - 3
            ][0] = d
          }
          for (var c = 0; c < 18; c++) {
            var d = !a && 1 == ((b >> c) & 1)
            this.modules[(c % 3) + this.moduleCount - 8 - 3][
              Math.floor(c / 3)
            ][0] = d
          }
        },
        setupTypeInfo: function (a, b) {
          for (
            var c = (this.errorCorrectLevel << 3) | b,
              d = t.getBCHTypeInfo(c),
              e = 0;
            e < 15;
            e++
          ) {
            var f = !a && 1 == ((d >> e) & 1)
            e < 6
              ? (this.modules[e][8][0] = f)
              : e < 8
              ? (this.modules[e + 1][8][0] = f)
              : (this.modules[this.moduleCount - 15 + e][8][0] = f)
          }
          for (var e = 0; e < 15; e++) {
            var f = !a && 1 == ((d >> e) & 1)
            e < 8
              ? (this.modules[8][this.moduleCount - e - 1][0] = f)
              : e < 9
              ? (this.modules[8][15 - e - 1 + 1][0] = f)
              : (this.modules[8][15 - e - 1][0] = f)
          }
          this.modules[this.moduleCount - 8][8][0] = !a
        },
        mapData: function (a, b) {
          for (
            var c = -1,
              d = this.moduleCount - 1,
              e = 7,
              f = 0,
              g = this.moduleCount - 1;
            g > 0;
            g -= 2
          )
            for (6 == g && g--; ; ) {
              for (var h = 0; h < 2; h++)
                if (null == this.modules[d][g - h][0]) {
                  var i = !1
                  f < a.length && (i = 1 == ((a[f] >>> e) & 1))
                  var j = t.getMask(b, d, g - h)
                  j && (i = !i),
                    (this.modules[d][g - h][0] = i),
                    e--,
                    -1 == e && (f++, (e = 7))
                }
              if ((d += c) < 0 || this.moduleCount <= d) {
                ;(d -= c), (c = -c)
                break
              }
            }
        }
      }),
      (b.PAD0 = 236),
      (b.PAD1 = 17),
      (b.createData = function (a, c, f) {
        for (
          var g = d.getRSBlocks(a, c), h = new e(), i = 0;
          i < f.length;
          i++
        ) {
          var j = f[i]
          h.put(j.mode, 4),
            h.put(j.getLength(), t.getLengthInBits(j.mode, a)),
            j.write(h)
        }
        for (var k = 0, i = 0; i < g.length; i++) k += g[i].dataCount
        if (h.getLengthInBits() > 8 * k)
          throw new Error(
            'code length overflow. (' + h.getLengthInBits() + '>' + 8 * k + ')'
          )
        for (
          h.getLengthInBits() + 4 <= 8 * k && h.put(0, 4);
          h.getLengthInBits() % 8 != 0;

        )
          h.putBit(!1)
        for (;;) {
          if (h.getLengthInBits() >= 8 * k) break
          if ((h.put(b.PAD0, 8), h.getLengthInBits() >= 8 * k)) break
          h.put(b.PAD1, 8)
        }
        return b.createBytes(h, g)
      }),
      (b.createBytes = function (a, b) {
        for (
          var d = 0,
            e = 0,
            f = 0,
            g = new Array(b.length),
            h = new Array(b.length),
            i = 0;
          i < b.length;
          i++
        ) {
          var j = b[i].dataCount,
            k = b[i].totalCount - j
          ;(e = Math.max(e, j)), (f = Math.max(f, k)), (g[i] = new Array(j))
          for (var l = 0; l < g[i].length; l++) g[i][l] = 255 & a.buffer[l + d]
          d += j
          var m = t.getErrorCorrectPolynomial(k),
            n = new c(g[i], m.getLength() - 1),
            o = n.mod(m)
          h[i] = new Array(m.getLength() - 1)
          for (var l = 0; l < h[i].length; l++) {
            var p = l + o.getLength() - h[i].length
            h[i][l] = p >= 0 ? o.get(p) : 0
          }
        }
        for (var q = 0, l = 0; l < b.length; l++) q += b[l].totalCount
        for (var r = new Array(q), s = 0, l = 0; l < e; l++)
          for (var i = 0; i < b.length; i++)
            l < g[i].length && (r[s++] = g[i][l])
        for (var l = 0; l < f; l++)
          for (var i = 0; i < b.length; i++)
            l < h[i].length && (r[s++] = h[i][l])
        return r
      })
    for (
      var q = {
          MODE_NUMBER: 1,
          MODE_ALPHA_NUM: 2,
          MODE_8BIT_BYTE: 4,
          MODE_KANJI: 8
        },
        r = { L: 1, M: 0, Q: 3, H: 2 },
        s = {
          PATTERN000: 0,
          PATTERN001: 1,
          PATTERN010: 2,
          PATTERN011: 3,
          PATTERN100: 4,
          PATTERN101: 5,
          PATTERN110: 6,
          PATTERN111: 7
        },
        t = {
          PATTERN_POSITION_TABLE: [
            [],
            [6, 18],
            [6, 22],
            [6, 26],
            [6, 30],
            [6, 34],
            [6, 22, 38],
            [6, 24, 42],
            [6, 26, 46],
            [6, 28, 50],
            [6, 30, 54],
            [6, 32, 58],
            [6, 34, 62],
            [6, 26, 46, 66],
            [6, 26, 48, 70],
            [6, 26, 50, 74],
            [6, 30, 54, 78],
            [6, 30, 56, 82],
            [6, 30, 58, 86],
            [6, 34, 62, 90],
            [6, 28, 50, 72, 94],
            [6, 26, 50, 74, 98],
            [6, 30, 54, 78, 102],
            [6, 28, 54, 80, 106],
            [6, 32, 58, 84, 110],
            [6, 30, 58, 86, 114],
            [6, 34, 62, 90, 118],
            [6, 26, 50, 74, 98, 122],
            [6, 30, 54, 78, 102, 126],
            [6, 26, 52, 78, 104, 130],
            [6, 30, 56, 82, 108, 134],
            [6, 34, 60, 86, 112, 138],
            [6, 30, 58, 86, 114, 142],
            [6, 34, 62, 90, 118, 146],
            [6, 30, 54, 78, 102, 126, 150],
            [6, 24, 50, 76, 102, 128, 154],
            [6, 28, 54, 80, 106, 132, 158],
            [6, 32, 58, 84, 110, 136, 162],
            [6, 26, 54, 82, 110, 138, 166],
            [6, 30, 58, 86, 114, 142, 170]
          ],
          G15: 1335,
          G18: 7973,
          G15_MASK: 21522,
          getBCHTypeInfo: function (a) {
            for (
              var b = a << 10;
              t.getBCHDigit(b) - t.getBCHDigit(t.G15) >= 0;

            )
              b ^= t.G15 << (t.getBCHDigit(b) - t.getBCHDigit(t.G15))
            return ((a << 10) | b) ^ t.G15_MASK
          },
          getBCHTypeNumber: function (a) {
            for (
              var b = a << 12;
              t.getBCHDigit(b) - t.getBCHDigit(t.G18) >= 0;

            )
              b ^= t.G18 << (t.getBCHDigit(b) - t.getBCHDigit(t.G18))
            return (a << 12) | b
          },
          getBCHDigit: function (a) {
            for (var b = 0; 0 != a; ) b++, (a >>>= 1)
            return b
          },
          getPatternPosition: function (a) {
            return t.PATTERN_POSITION_TABLE[a - 1]
          },
          getMask: function (a, b, c) {
            switch (a) {
              case s.PATTERN000:
                return (b + c) % 2 == 0
              case s.PATTERN001:
                return b % 2 == 0
              case s.PATTERN010:
                return c % 3 == 0
              case s.PATTERN011:
                return (b + c) % 3 == 0
              case s.PATTERN100:
                return (Math.floor(b / 2) + Math.floor(c / 3)) % 2 == 0
              case s.PATTERN101:
                return ((b * c) % 2) + ((b * c) % 3) == 0
              case s.PATTERN110:
                return (((b * c) % 2) + ((b * c) % 3)) % 2 == 0
              case s.PATTERN111:
                return (((b * c) % 3) + ((b + c) % 2)) % 2 == 0
              default:
                throw new Error('bad maskPattern:' + a)
            }
          },
          getErrorCorrectPolynomial: function (a) {
            for (var b = new c([1], 0), d = 0; d < a; d++)
              b = b.multiply(new c([1, u.gexp(d)], 0))
            return b
          },
          getLengthInBits: function (a, b) {
            if (1 <= b && b < 10)
              switch (a) {
                case q.MODE_NUMBER:
                  return 10
                case q.MODE_ALPHA_NUM:
                  return 9
                case q.MODE_8BIT_BYTE:
                case q.MODE_KANJI:
                  return 8
                default:
                  throw new Error('mode:' + a)
              }
            else if (b < 27)
              switch (a) {
                case q.MODE_NUMBER:
                  return 12
                case q.MODE_ALPHA_NUM:
                  return 11
                case q.MODE_8BIT_BYTE:
                  return 16
                case q.MODE_KANJI:
                  return 10
                default:
                  throw new Error('mode:' + a)
              }
            else {
              if (!(b < 41)) throw new Error('type:' + b)
              switch (a) {
                case q.MODE_NUMBER:
                  return 14
                case q.MODE_ALPHA_NUM:
                  return 13
                case q.MODE_8BIT_BYTE:
                  return 16
                case q.MODE_KANJI:
                  return 12
                default:
                  throw new Error('mode:' + a)
              }
            }
          },
          getLostPoint: function (a) {
            for (var b = a.getModuleCount(), c = 0, d = 0; d < b; d++)
              for (var e = 0; e < b; e++) {
                for (var f = 0, g = a.isDark(d, e), h = -1; h <= 1; h++)
                  if (!(d + h < 0 || b <= d + h))
                    for (var i = -1; i <= 1; i++)
                      e + i < 0 ||
                        b <= e + i ||
                        (0 == h && 0 == i) ||
                        (g == a.isDark(d + h, e + i) && f++)
                f > 5 && (c += 3 + f - 5)
              }
            for (var d = 0; d < b - 1; d++)
              for (var e = 0; e < b - 1; e++) {
                var j = 0
                a.isDark(d, e) && j++,
                  a.isDark(d + 1, e) && j++,
                  a.isDark(d, e + 1) && j++,
                  a.isDark(d + 1, e + 1) && j++,
                  (0 != j && 4 != j) || (c += 3)
              }
            for (var d = 0; d < b; d++)
              for (var e = 0; e < b - 6; e++)
                a.isDark(d, e) &&
                  !a.isDark(d, e + 1) &&
                  a.isDark(d, e + 2) &&
                  a.isDark(d, e + 3) &&
                  a.isDark(d, e + 4) &&
                  !a.isDark(d, e + 5) &&
                  a.isDark(d, e + 6) &&
                  (c += 40)
            for (var e = 0; e < b; e++)
              for (var d = 0; d < b - 6; d++)
                a.isDark(d, e) &&
                  !a.isDark(d + 1, e) &&
                  a.isDark(d + 2, e) &&
                  a.isDark(d + 3, e) &&
                  a.isDark(d + 4, e) &&
                  !a.isDark(d + 5, e) &&
                  a.isDark(d + 6, e) &&
                  (c += 40)
            for (var k = 0, e = 0; e < b; e++)
              for (var d = 0; d < b; d++) a.isDark(d, e) && k++
            return (c += (Math.abs((100 * k) / b / b - 50) / 5) * 10)
          }
        },
        u = {
          glog: function (a) {
            if (a < 1) throw new Error('glog(' + a + ')')
            return u.LOG_TABLE[a]
          },
          gexp: function (a) {
            for (; a < 0; ) a += 255
            for (; a >= 256; ) a -= 255
            return u.EXP_TABLE[a]
          },
          EXP_TABLE: new Array(256),
          LOG_TABLE: new Array(256)
        },
        v = 0;
      v < 8;
      v++
    )
      u.EXP_TABLE[v] = 1 << v
    for (var v = 8; v < 256; v++)
      u.EXP_TABLE[v] =
        u.EXP_TABLE[v - 4] ^
        u.EXP_TABLE[v - 5] ^
        u.EXP_TABLE[v - 6] ^
        u.EXP_TABLE[v - 8]
    for (var v = 0; v < 255; v++) u.LOG_TABLE[u.EXP_TABLE[v]] = v
    ;(c.prototype = {
      get: function (a) {
        return this.num[a]
      },
      getLength: function () {
        return this.num.length
      },
      multiply: function (a) {
        for (
          var b = new Array(this.getLength() + a.getLength() - 1), d = 0;
          d < this.getLength();
          d++
        )
          for (var e = 0; e < a.getLength(); e++)
            b[d + e] ^= u.gexp(u.glog(this.get(d)) + u.glog(a.get(e)))
        return new c(b, 0)
      },
      mod: function (a) {
        if (this.getLength() - a.getLength() < 0) return this
        for (
          var b = u.glog(this.get(0)) - u.glog(a.get(0)),
            d = new Array(this.getLength()),
            e = 0;
          e < this.getLength();
          e++
        )
          d[e] = this.get(e)
        for (var e = 0; e < a.getLength(); e++)
          d[e] ^= u.gexp(u.glog(a.get(e)) + b)
        return new c(d, 0).mod(a)
      }
    }),
      (d.RS_BLOCK_TABLE = [
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12, 7, 37, 13],
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
      ]),
      (d.getRSBlocks = function (a, b) {
        var c = d.getRsBlockTable(a, b)
        if (c == i)
          throw new Error(
            'bad rs block @ typeNumber:' + a + '/errorCorrectLevel:' + b
          )
        for (var e = c.length / 3, f = [], g = 0; g < e; g++)
          for (
            var h = c[3 * g + 0], j = c[3 * g + 1], k = c[3 * g + 2], l = 0;
            l < h;
            l++
          )
            f.push(new d(j, k))
        return f
      }),
      (d.getRsBlockTable = function (a, b) {
        switch (b) {
          case r.L:
            return d.RS_BLOCK_TABLE[4 * (a - 1) + 0]
          case r.M:
            return d.RS_BLOCK_TABLE[4 * (a - 1) + 1]
          case r.Q:
            return d.RS_BLOCK_TABLE[4 * (a - 1) + 2]
          case r.H:
            return d.RS_BLOCK_TABLE[4 * (a - 1) + 3]
          default:
            return i
        }
      }),
      (e.prototype = {
        get: function (a) {
          var b = Math.floor(a / 8)
          return 1 == ((this.buffer[b] >>> (7 - (a % 8))) & 1)
        },
        put: function (a, b) {
          for (var c = 0; c < b; c++)
            this.putBit(1 == ((a >>> (b - c - 1)) & 1))
        },
        getLengthInBits: function () {
          return this.length
        },
        putBit: function (a) {
          var b = Math.floor(this.length / 8)
          this.buffer.length <= b && this.buffer.push(0),
            a && (this.buffer[b] |= 128 >>> this.length % 8),
            this.length++
        }
      })
    var w = [
        [17, 14, 11, 7],
        [32, 26, 20, 14],
        [53, 42, 32, 24],
        [78, 62, 46, 34],
        [106, 84, 60, 44],
        [134, 106, 74, 58],
        [154, 122, 86, 64],
        [192, 152, 108, 84],
        [230, 180, 130, 98],
        [271, 213, 151, 119],
        [321, 251, 177, 137],
        [367, 287, 203, 155],
        [425, 331, 241, 177],
        [458, 362, 258, 194],
        [520, 412, 292, 220],
        [586, 450, 322, 250],
        [644, 504, 364, 280],
        [718, 560, 394, 310],
        [792, 624, 442, 338],
        [858, 666, 482, 382],
        [929, 711, 509, 403],
        [1003, 779, 565, 439],
        [1091, 857, 611, 461],
        [1171, 911, 661, 511],
        [1273, 997, 715, 535],
        [1367, 1059, 751, 593],
        [1465, 1125, 805, 625],
        [1528, 1190, 868, 658],
        [1628, 1264, 908, 698],
        [1732, 1370, 982, 742],
        [1840, 1452, 1030, 790],
        [1952, 1538, 1112, 842],
        [2068, 1628, 1168, 898],
        [2188, 1722, 1228, 958],
        [2303, 1809, 1283, 983],
        [2431, 1911, 1351, 1051],
        [2563, 1989, 1423, 1093],
        [2699, 2099, 1499, 1139],
        [2809, 2213, 1579, 1219],
        [2953, 2331, 1663, 1273]
      ],
      x = (function () {
        return 'undefined' != typeof CanvasRenderingContext2D
      })()
        ? (function () {
            function a() {
              if ('svg' == this._htOption.drawer) {
                var a = this._oContext.getSerializedSvg(!0)
                ;(this.dataURL = a), (this._el.innerHTML = a)
              } else
                try {
                  var b = this._elCanvas.toDataURL('image/png')
                  this.dataURL = b
                } catch (a) {
                  console.error(a)
                }
              this._htOption.onRenderingEnd &&
                (this.dataURL ||
                  console.error(
                    "Can not get base64 data, please check: 1. Published the page and image to the server 2. The image request support CORS 3. Configured `crossOrigin:'anonymous'` option"
                  ),
                this._htOption.onRenderingEnd(this._htOption, this.dataURL))
            }
            function b(a, b) {
              var c = this
              if (
                ((c._fFail = b), (c._fSuccess = a), null === c._bSupportDataURI)
              ) {
                var d = document.createElement('img'),
                  e = function () {
                    ;(c._bSupportDataURI = !1), c._fFail && c._fFail.call(c)
                  },
                  f = function () {
                    ;(c._bSupportDataURI = !0),
                      c._fSuccess && c._fSuccess.call(c)
                  }
                ;(d.onabort = e),
                  (d.onerror = e),
                  (d.onload = f),
                  (d.src =
                    'data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==')
              } else
                !0 === c._bSupportDataURI && c._fSuccess
                  ? c._fSuccess.call(c)
                  : !1 === c._bSupportDataURI && c._fFail && c._fFail.call(c)
            }
            if (m._android && m._android <= 2.1) {
              var c = 1 / window.devicePixelRatio,
                d = CanvasRenderingContext2D.prototype.drawImage
              CanvasRenderingContext2D.prototype.drawImage = function (
                a,
                b,
                e,
                f,
                g,
                h,
                i,
                j,
                k
              ) {
                if ('nodeName' in a && /img/i.test(a.nodeName))
                  for (var l = arguments.length - 1; l >= 1; l--)
                    arguments[l] = arguments[l] * c
                else
                  void 0 === j &&
                    ((arguments[1] *= c),
                    (arguments[2] *= c),
                    (arguments[3] *= c),
                    (arguments[4] *= c))
                d.apply(this, arguments)
              }
            }
            var e = function (a, b) {
              ;(this._bIsPainted = !1),
                (this._android = f()),
                (this._el = a),
                (this._htOption = b),
                'svg' == this._htOption.drawer
                  ? ((this._oContext = {}), (this._elCanvas = {}))
                  : ((this._elCanvas = document.createElement('canvas')),
                    this._el.appendChild(this._elCanvas),
                    (this._oContext = this._elCanvas.getContext('2d'))),
                (this._bSupportDataURI = null),
                (this.dataURL = null)
            }
            return (
              (e.prototype.draw = function (a) {
                function b() {
                  d.quietZone > 0 &&
                    d.quietZoneColor &&
                    ((j.lineWidth = 0),
                    (j.fillStyle = d.quietZoneColor),
                    j.fillRect(0, 0, k._elCanvas.width, d.quietZone),
                    j.fillRect(
                      0,
                      d.quietZone,
                      d.quietZone,
                      k._elCanvas.height - 2 * d.quietZone
                    ),
                    j.fillRect(
                      k._elCanvas.width - d.quietZone,
                      d.quietZone,
                      d.quietZone,
                      k._elCanvas.height - 2 * d.quietZone
                    ),
                    j.fillRect(
                      0,
                      k._elCanvas.height - d.quietZone,
                      k._elCanvas.width,
                      d.quietZone
                    ))
                }
                function c(a) {
                  function c(a) {
                    var c = Math.round(d.width / 3.5),
                      e = Math.round(d.height / 3.5)
                    c !== e && (c = e),
                      d.logoMaxWidth
                        ? (c = Math.round(d.logoMaxWidth))
                        : d.logoWidth && (c = Math.round(d.logoWidth)),
                      d.logoMaxHeight
                        ? (e = Math.round(d.logoMaxHeight))
                        : d.logoHeight && (e = Math.round(d.logoHeight))
                    var f, g
                    void 0 === a.naturalWidth
                      ? ((f = a.width), (g = a.height))
                      : ((f = a.naturalWidth), (g = a.naturalHeight)),
                      (d.logoMaxWidth || d.logoMaxHeight) &&
                        (d.logoMaxWidth && f <= c && (c = f),
                        d.logoMaxHeight && g <= e && (e = g),
                        f <= c && g <= e && ((c = f), (e = g)))
                    var h = (d.realWidth - c) / 2,
                      i = (d.realHeight - e) / 2,
                      k = Math.min(c / f, e / g),
                      l = f * k,
                      m = g * k
                    ;(d.logoMaxWidth || d.logoMaxHeight) &&
                      ((c = l),
                      (e = m),
                      (h = (d.realWidth - c) / 2),
                      (i = (d.realHeight - e) / 2)),
                      d.logoBackgroundTransparent ||
                        ((j.fillStyle = d.logoBackgroundColor),
                        j.fillRect(h, i, c, e))
                    var n = j.imageSmoothingQuality,
                      o = j.imageSmoothingEnabled
                    ;(j.imageSmoothingEnabled = !0),
                      (j.imageSmoothingQuality = 'high'),
                      j.drawImage(a, h + (c - l) / 2, i + (e - m) / 2, l, m),
                      (j.imageSmoothingEnabled = o),
                      (j.imageSmoothingQuality = n),
                      b(),
                      (s._bIsPainted = !0),
                      s.makeImage()
                  }
                  d.onRenderingStart && d.onRenderingStart(d)
                  for (var h = 0; h < e; h++)
                    for (var i = 0; i < e; i++) {
                      var k = i * f + d.quietZone,
                        l = h * g + d.quietZone,
                        m = a.isDark(h, i),
                        n = a.getEye(h, i),
                        o = d.dotScale
                      j.lineWidth = 0
                      var p, q
                      n
                        ? ((p =
                            d[n.type] ||
                            d[n.type.substring(0, 2)] ||
                            d.colorDark),
                          (q = d.colorLight))
                        : d.backgroundImage
                        ? ((q = 'rgba(0,0,0,0)'),
                          6 == h
                            ? d.autoColor
                              ? ((p =
                                  d.timing_H || d.timing || d.autoColorDark),
                                (q = d.autoColorLight))
                              : (p = d.timing_H || d.timing || d.colorDark)
                            : 6 == i
                            ? d.autoColor
                              ? ((p =
                                  d.timing_V || d.timing || d.autoColorDark),
                                (q = d.autoColorLight))
                              : (p = d.timing_V || d.timing || d.colorDark)
                            : d.autoColor
                            ? ((p = d.autoColorDark), (q = d.autoColorLight))
                            : (p = d.colorDark))
                        : ((p =
                            6 == h
                              ? d.timing_H || d.timing || d.colorDark
                              : 6 == i
                              ? d.timing_V || d.timing || d.colorDark
                              : d.colorDark),
                          (q = d.colorLight)),
                        (j.strokeStyle = m ? p : q),
                        (j.fillStyle = m ? p : q),
                        n
                          ? ((o =
                              'AO' == n.type
                                ? d.dotScaleAO
                                : 'AI' == n.type
                                ? d.dotScaleAI
                                : 1),
                            d.backgroundImage && d.autoColor
                              ? ((p =
                                  ('AO' == n.type ? d.AI : d.AO) ||
                                  d.autoColorDark),
                                (q = d.autoColorLight))
                              : (p = ('AO' == n.type ? d.AI : d.AO) || p),
                            (m = n.isDark),
                            j.fillRect(
                              Math.ceil(k + (f * (1 - o)) / 2),
                              Math.ceil(d.titleHeight + l + (g * (1 - o)) / 2),
                              Math.ceil(f * o),
                              Math.ceil(g * o)
                            ))
                          : 6 == h
                          ? ((o = d.dotScaleTiming_H),
                            j.fillRect(
                              Math.ceil(k + (f * (1 - o)) / 2),
                              Math.ceil(d.titleHeight + l + (g * (1 - o)) / 2),
                              Math.ceil(f * o),
                              Math.ceil(g * o)
                            ))
                          : 6 == i
                          ? ((o = d.dotScaleTiming_V),
                            j.fillRect(
                              Math.ceil(k + (f * (1 - o)) / 2),
                              Math.ceil(d.titleHeight + l + (g * (1 - o)) / 2),
                              Math.ceil(f * o),
                              Math.ceil(g * o)
                            ))
                          : (d.backgroundImage,
                            j.fillRect(
                              Math.ceil(k + (f * (1 - o)) / 2),
                              Math.ceil(d.titleHeight + l + (g * (1 - o)) / 2),
                              Math.ceil(f * o),
                              Math.ceil(g * o)
                            )),
                        1 == d.dotScale || n || (j.strokeStyle = d.colorLight)
                    }
                  if (
                    (d.title &&
                      ((j.fillStyle = d.titleBackgroundColor),
                      j.fillRect(
                        d.quietZone,
                        d.quietZone,
                        d.width,
                        d.titleHeight
                      ),
                      (j.font = d.titleFont),
                      (j.fillStyle = d.titleColor),
                      (j.textAlign = 'center'),
                      j.fillText(
                        d.title,
                        this._elCanvas.width / 2,
                        +d.quietZone + d.titleTop
                      )),
                    d.subTitle &&
                      ((j.font = d.subTitleFont),
                      (j.fillStyle = d.subTitleColor),
                      j.fillText(
                        d.subTitle,
                        this._elCanvas.width / 2,
                        +d.quietZone + d.subTitleTop
                      )),
                    d.logo)
                  ) {
                    var r = new Image(),
                      s = this
                    ;(r.onload = function () {
                      c(r)
                    }),
                      (r.onerror = function (a) {
                        console.error(a)
                      }),
                      null != d.crossOrigin && (r.crossOrigin = d.crossOrigin),
                      (r.originalSrc = d.logo),
                      (r.src = d.logo)
                  } else b(), (this._bIsPainted = !0), this.makeImage()
                }
                var d = this._htOption,
                  e = a.getModuleCount(),
                  f = d.width / e,
                  g = d.height / e
                f <= 1 && (f = 1), g <= 1 && (g = 1)
                var h = f * e,
                  i = g * e
                ;(d.heightWithTitle = i + d.titleHeight),
                  (d.realHeight = d.heightWithTitle + 2 * d.quietZone),
                  (d.realWidth = h + 2 * d.quietZone),
                  (this._elCanvas.width = d.realWidth),
                  (this._elCanvas.height = d.realHeight),
                  'canvas' != d.drawer &&
                    (this._oContext = new C2S(
                      this._elCanvas.width,
                      this._elCanvas.height
                    )),
                  this.clear()
                var j = this._oContext
                ;(j.lineWidth = 0),
                  (j.fillStyle = d.colorLight),
                  j.fillRect(0, 0, this._elCanvas.width, this._elCanvas.height),
                  j.clearRect(d.quietZone, d.quietZone, d.width, d.titleHeight)
                var k = this
                if (d.backgroundImage) {
                  var l = new Image()
                  ;(l.onload = function () {
                    ;(j.globalAlpha = 1),
                      (j.globalAlpha = d.backgroundImageAlpha)
                    var b = j.imageSmoothingQuality,
                      e = j.imageSmoothingEnabled
                    ;(j.imageSmoothingEnabled = !0),
                      (j.imageSmoothingQuality = 'high'),
                      (d.title || d.subTitle) && d.titleHeight
                        ? j.drawImage(
                            l,
                            d.quietZone,
                            d.quietZone + d.titleHeight,
                            d.width,
                            d.height
                          )
                        : j.drawImage(l, 0, 0, d.realWidth, d.realHeight),
                      (j.imageSmoothingEnabled = e),
                      (j.imageSmoothingQuality = b),
                      (j.globalAlpha = 1),
                      c.call(k, a)
                  }),
                    null != d.crossOrigin && (l.crossOrigin = d.crossOrigin),
                    (l.originalSrc = d.backgroundImage),
                    (l.src = d.backgroundImage)
                } else c.call(k, a)
              }),
              (e.prototype.makeImage = function () {
                this._bIsPainted && b.call(this, a)
              }),
              (e.prototype.isPainted = function () {
                return this._bIsPainted
              }),
              (e.prototype.clear = function () {
                this._oContext.clearRect(
                  0,
                  0,
                  this._elCanvas.width,
                  this._elCanvas.height
                ),
                  (this._bIsPainted = !1)
              }),
              (e.prototype.remove = function () {
                this._oContext.clearRect(
                  0,
                  0,
                  this._elCanvas.width,
                  this._elCanvas.height
                ),
                  (this._bIsPainted = !1),
                  (this._el.innerHTML = '')
              }),
              (e.prototype.round = function (a) {
                return a ? Math.floor(1e3 * a) / 1e3 : a
              }),
              e
            )
          })()
        : (function () {
            var a = function (a, b) {
              ;(this._el = a), (this._htOption = b)
            }
            return (
              (a.prototype.draw = function (a) {
                var b = this._htOption,
                  c = this._el,
                  d = a.getModuleCount(),
                  e = b.width / d,
                  f = b.height / d
                e <= 1 && (e = 1), f <= 1 && (f = 1)
                var g = e * d,
                  h = f * d
                ;(b.heightWithTitle = h + b.titleHeight),
                  (b.realHeight = b.heightWithTitle + 2 * b.quietZone),
                  (b.realWidth = g + 2 * b.quietZone)
                var i = [],
                  j = '',
                  k = Math.round(e * b.dotScale),
                  l = Math.round(f * b.dotScale)
                k < 4 && ((k = 4), (l = 4))
                var m = b.colorDark,
                  n = b.colorLight
                if (b.backgroundImage) {
                  b.autoColor
                    ? ((b.colorDark =
                        "rgba(0, 0, 0, .6);filter:progid:DXImageTransform.Microsoft.Gradient(GradientType=0, StartColorStr='#99000000', EndColorStr='#99000000');"),
                      (b.colorLight =
                        "rgba(255, 255, 255, .7);filter:progid:DXImageTransform.Microsoft.Gradient(GradientType=0, StartColorStr='#B2FFFFFF', EndColorStr='#B2FFFFFF');"))
                    : (b.colorLight = 'rgba(0,0,0,0)')
                  var o =
                    '<div style="display:inline-block; z-index:-10;position:absolute;"><img src="' +
                    b.backgroundImage +
                    '" width="' +
                    (b.width + 2 * b.quietZone) +
                    '" height="' +
                    b.realHeight +
                    '" style="opacity:' +
                    b.backgroundImageAlpha +
                    ';filter:alpha(opacity=' +
                    100 * b.backgroundImageAlpha +
                    '); "/></div>'
                  i.push(o)
                }
                if (
                  (b.quietZone &&
                    (j =
                      'display:inline-block; width:' +
                      (b.width + 2 * b.quietZone) +
                      'px; height:' +
                      (b.width + 2 * b.quietZone) +
                      'px;background:' +
                      b.quietZoneColor +
                      '; text-align:center;'),
                  i.push('<div style="font-size:0;' + j + '">'),
                  i.push(
                    '<table  style="font-size:0;border:0;border-collapse:collapse; margin-top:' +
                      b.quietZone +
                      'px;" border="0" cellspacing="0" cellspadding="0" align="center" valign="middle">'
                  ),
                  i.push(
                    '<tr height="' +
                      b.titleHeight +
                      '" align="center"><td style="border:0;border-collapse:collapse;margin:0;padding:0" colspan="' +
                      d +
                      '">'
                  ),
                  b.title)
                ) {
                  var p = b.titleColor,
                    q = b.titleFont
                  i.push(
                    '<div style="width:100%;margin-top:' +
                      b.titleTop +
                      'px;color:' +
                      p +
                      ';font:' +
                      q +
                      ';background:' +
                      b.titleBackgroundColor +
                      '">' +
                      b.title +
                      '</div>'
                  )
                }
                b.subTitle &&
                  i.push(
                    '<div style="width:100%;margin-top:' +
                      (b.subTitleTop - b.titleTop) +
                      'px;color:' +
                      b.subTitleColor +
                      '; font:' +
                      b.subTitleFont +
                      '">' +
                      b.subTitle +
                      '</div>'
                  ),
                  i.push('</td></tr>')
                for (var r = 0; r < d; r++) {
                  i.push(
                    '<tr style="border:0; padding:0; margin:0;" height="7">'
                  )
                  for (var s = 0; s < d; s++) {
                    var t = a.isDark(r, s),
                      u = a.getEye(r, s)
                    if (u) {
                      t = u.isDark
                      var v = u.type,
                        w = b[v] || b[v.substring(0, 2)] || m
                      i.push(
                        '<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' +
                          e +
                          'px;height:' +
                          f +
                          'px;"><span style="width:' +
                          e +
                          'px;height:' +
                          f +
                          'px;background-color:' +
                          (t ? w : n) +
                          ';display:inline-block"></span></td>'
                      )
                    } else {
                      var x = b.colorDark
                      6 == r
                        ? ((x = b.timing_H || b.timing || m),
                          i.push(
                            '<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' +
                              e +
                              'px;height:' +
                              f +
                              'px;background-color:' +
                              (t ? x : n) +
                              ';"></td>'
                          ))
                        : 6 == s
                        ? ((x = b.timing_V || b.timing || m),
                          i.push(
                            '<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' +
                              e +
                              'px;height:' +
                              f +
                              'px;background-color:' +
                              (t ? x : n) +
                              ';"></td>'
                          ))
                        : i.push(
                            '<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' +
                              e +
                              'px;height:' +
                              f +
                              'px;"><div style="display:inline-block;width:' +
                              k +
                              'px;height:' +
                              l +
                              'px;background-color:' +
                              (t ? x : b.colorLight) +
                              ';"></div></td>'
                          )
                    }
                  }
                  i.push('</tr>')
                }
                if ((i.push('</table>'), i.push('</div>'), b.logo)) {
                  var y = new Image()
                  null != b.crossOrigin && (y.crossOrigin = b.crossOrigin),
                    (y.src = b.logo)
                  var z = b.width / 3.5,
                    A = b.height / 3.5
                  z != A && (z = A),
                    b.logoWidth && (z = b.logoWidth),
                    b.logoHeight && (A = b.logoHeight)
                  var B =
                    'position:relative; z-index:1;display:table-cell;top:-' +
                    (b.height / 2 + A / 2 + b.quietZone) +
                    'px;text-align:center; width:' +
                    z +
                    'px; height:' +
                    A +
                    'px;line-height:' +
                    z +
                    'px; vertical-align: middle;'
                  b.logoBackgroundTransparent ||
                    (B += 'background:' + b.logoBackgroundColor),
                    i.push(
                      '<div style="' +
                        B +
                        '"><img  src="' +
                        b.logo +
                        '"  style="max-width: ' +
                        z +
                        'px; max-height: ' +
                        A +
                        'px;" /> <div style=" display: none; width:1px;margin-left: -1px;"></div></div>'
                    )
                }
                b.onRenderingStart && b.onRenderingStart(b),
                  (c.innerHTML = i.join(''))
                var C = c.childNodes[0],
                  D = (b.width - C.offsetWidth) / 2,
                  E = (b.heightWithTitle - C.offsetHeight) / 2
                D > 0 && E > 0 && (C.style.margin = E + 'px ' + D + 'px'),
                  this._htOption.onRenderingEnd &&
                    this._htOption.onRenderingEnd(this._htOption, null)
              }),
              (a.prototype.clear = function () {
                this._el.innerHTML = ''
              }),
              a
            )
          })()
    ;(j = function (a, b) {
      if (
        ((this._htOption = {
          width: 256,
          height: 256,
          typeNumber: 4,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: r.H,
          dotScale: 1,
          dotScaleTiming: 1,
          dotScaleTiming_H: i,
          dotScaleTiming_V: i,
          dotScaleA: 1,
          dotScaleAO: i,
          dotScaleAI: i,
          quietZone: 0,
          quietZoneColor: 'rgba(0,0,0,0)',
          title: '',
          titleFont: 'normal normal bold 16px Arial',
          titleColor: '#000000',
          titleBackgroundColor: '#ffffff',
          titleHeight: 0,
          titleTop: 30,
          subTitle: '',
          subTitleFont: 'normal normal normal 14px Arial',
          subTitleColor: '#4F4F4F',
          subTitleTop: 60,
          logo: i,
          logoWidth: i,
          logoHeight: i,
          logoMaxWidth: i,
          logoMaxHeight: i,
          logoBackgroundColor: '#ffffff',
          logoBackgroundTransparent: !1,
          PO: i,
          PI: i,
          PO_TL: i,
          PI_TL: i,
          PO_TR: i,
          PI_TR: i,
          PO_BL: i,
          PI_BL: i,
          AO: i,
          AI: i,
          timing: i,
          timing_H: i,
          timing_V: i,
          backgroundImage: i,
          backgroundImageAlpha: 1,
          autoColor: !1,
          autoColorDark: 'rgba(0, 0, 0, .6)',
          autoColorLight: 'rgba(255, 255, 255, .7)',
          onRenderingStart: i,
          onRenderingEnd: i,
          version: 0,
          tooltip: !1,
          binary: !1,
          drawer: 'canvas',
          crossOrigin: null,
          utf8WithoutBOM: !0
        }),
        'string' == typeof b && (b = { text: b }),
        b)
      )
        for (var c in b) this._htOption[c] = b[c]
      this._htOption.title ||
        this._htOption.subTitle ||
        (this._htOption.titleHeight = 0),
        (this._htOption.version < 0 || this._htOption.version > 40) &&
          (console.warn(
            "QR Code version '" +
              this._htOption.version +
              "' is invalidate, reset to 0"
          ),
          (this._htOption.version = 0)),
        (this._htOption.dotScale < 0 || this._htOption.dotScale > 1) &&
          (console.warn(
            this._htOption.dotScale +
              ' , is invalidate, dotScale must greater than 0, less than or equal to 1, now reset to 1. '
          ),
          (this._htOption.dotScale = 1)),
        (this._htOption.dotScaleTiming < 0 ||
          this._htOption.dotScaleTiming > 1) &&
          (console.warn(
            this._htOption.dotScaleTiming +
              ' , is invalidate, dotScaleTiming must greater than 0, less than or equal to 1, now reset to 1. '
          ),
          (this._htOption.dotScaleTiming = 1)),
        this._htOption.dotScaleTiming_H
          ? (this._htOption.dotScaleTiming_H < 0 ||
              this._htOption.dotScaleTiming_H > 1) &&
            (console.warn(
              this._htOption.dotScaleTiming_H +
                ' , is invalidate, dotScaleTiming_H must greater than 0, less than or equal to 1, now reset to 1. '
            ),
            (this._htOption.dotScaleTiming_H = 1))
          : (this._htOption.dotScaleTiming_H = this._htOption.dotScaleTiming),
        this._htOption.dotScaleTiming_V
          ? (this._htOption.dotScaleTiming_V < 0 ||
              this._htOption.dotScaleTiming_V > 1) &&
            (console.warn(
              this._htOption.dotScaleTiming_V +
                ' , is invalidate, dotScaleTiming_V must greater than 0, less than or equal to 1, now reset to 1. '
            ),
            (this._htOption.dotScaleTiming_V = 1))
          : (this._htOption.dotScaleTiming_V = this._htOption.dotScaleTiming),
        (this._htOption.dotScaleA < 0 || this._htOption.dotScaleA > 1) &&
          (console.warn(
            this._htOption.dotScaleA +
              ' , is invalidate, dotScaleA must greater than 0, less than or equal to 1, now reset to 1. '
          ),
          (this._htOption.dotScaleA = 1)),
        this._htOption.dotScaleAO
          ? (this._htOption.dotScaleAO < 0 || this._htOption.dotScaleAO > 1) &&
            (console.warn(
              this._htOption.dotScaleAO +
                ' , is invalidate, dotScaleAO must greater than 0, less than or equal to 1, now reset to 1. '
            ),
            (this._htOption.dotScaleAO = 1))
          : (this._htOption.dotScaleAO = this._htOption.dotScaleA),
        this._htOption.dotScaleAI
          ? (this._htOption.dotScaleAI < 0 || this._htOption.dotScaleAI > 1) &&
            (console.warn(
              this._htOption.dotScaleAI +
                ' , is invalidate, dotScaleAI must greater than 0, less than or equal to 1, now reset to 1. '
            ),
            (this._htOption.dotScaleAI = 1))
          : (this._htOption.dotScaleAI = this._htOption.dotScaleA),
        (this._htOption.backgroundImageAlpha < 0 ||
          this._htOption.backgroundImageAlpha > 1) &&
          (console.warn(
            this._htOption.backgroundImageAlpha +
              ' , is invalidate, backgroundImageAlpha must between 0 and 1, now reset to 1. '
          ),
          (this._htOption.backgroundImageAlpha = 1)),
        this._htOption.quietZone || (this._htOption.quietZone = 0),
        this._htOption.titleHeight || (this._htOption.titleHeight = 0),
        (this._htOption.width = Math.round(this._htOption.width)),
        (this._htOption.height = Math.round(this._htOption.height)),
        (this._htOption.quietZone = Math.round(this._htOption.quietZone)),
        (this._htOption.titleHeight = Math.round(this._htOption.titleHeight)),
        'string' == typeof a && (a = document.getElementById(a)),
        (!this._htOption.drawer ||
          ('svg' != this._htOption.drawer &&
            'canvas' != this._htOption.drawer)) &&
          (this._htOption.drawer = 'canvas'),
        (this._android = f()),
        (this._el = a),
        (this._oQRCode = null),
        (this._htOption._element = a)
      var d = {}
      for (var c in this._htOption) d[c] = this._htOption[c]
      ;(this._oDrawing = new x(this._el, d)),
        this._htOption.text && this.makeCode(this._htOption.text)
    }),
      (j.prototype.makeCode = function (a) {
        ;(this._oQRCode = new b(
          g(a, this._htOption),
          this._htOption.correctLevel
        )),
          this._oQRCode.addData(
            a,
            this._htOption.binary,
            this._htOption.utf8WithoutBOM
          ),
          this._oQRCode.make(),
          this._htOption.tooltip && (this._el.title = a),
          this._oDrawing.draw(this._oQRCode)
      }),
      (j.prototype.makeImage = function () {
        'function' == typeof this._oDrawing.makeImage &&
          (!this._android || this._android >= 3) &&
          this._oDrawing.makeImage()
      }),
      (j.prototype.clear = function () {
        this._oDrawing.remove()
      }),
      (j.prototype.resize = function (a, b) {
        ;(this._oDrawing._htOption.width = a),
          (this._oDrawing._htOption.height = b),
          this._oDrawing.draw(this._oQRCode)
      }),
      (j.prototype.download = function (a) {
        var b = this._oDrawing.dataURL,
          c = document.createElement('a')
        if ('svg' == this._htOption.drawer) {
          a += '.svg'
          var d = new Blob([b], { type: 'text/plain' })
          if (navigator.msSaveBlob) navigator.msSaveBlob(d, a)
          else {
            c.download = a
            var e = new FileReader()
            ;(e.onload = function () {
              ;(c.href = e.result), c.click()
            }),
              e.readAsDataURL(d)
          }
        } else if (((a += '.png'), navigator.msSaveBlob)) {
          var f = (function (a) {
            var b = atob(a.split(',')[1]),
              c = a.split(',')[0].split(':')[1].split(';')[0],
              d = new ArrayBuffer(b.length),
              e = new Uint8Array(d)
            for (v = 0; v < b.length; v++) e[v] = b.charCodeAt(v)
            return new Blob([d], { type: c })
          })(b)
          navigator.msSaveBlob(f, a)
        } else (c.download = a), (c.href = b), c.click()
      }),
      (j.prototype.noConflict = function () {
        return m.QRCode === this && (m.QRCode = p), j
      }),
      (j.CorrectLevel = r),
      o ? (((o.exports = j).QRCode = j), (n.QRCode = j)) : (m.QRCode = j)
  }.call(undefined)

var easy_qrcode_min = /*#__PURE__*/ Object.freeze({
  __proto__: null
})

var jsonUrlSingle$2 = { exports: {} }

/*! For license information please see json-url-single.js.LICENSE.txt */

var hasRequiredJsonUrlSingle

function requireJsonUrlSingle() {
  if (hasRequiredJsonUrlSingle) return jsonUrlSingle$2.exports
  hasRequiredJsonUrlSingle = 1
  ;(function (module, exports) {
    !(function (t, e) {
      module.exports = e()
    })(window, function () {
      return (function (t) {
        function e(e) {
          for (var r, i, o = e[0], a = e[1], u = 0, f = []; u < o.length; u++)
            (i = o[u]),
              Object.prototype.hasOwnProperty.call(n, i) &&
                n[i] &&
                f.push(n[i][0]),
              (n[i] = 0)
          for (r in a)
            Object.prototype.hasOwnProperty.call(a, r) && (t[r] = a[r])
          for (s && s(e); f.length; ) f.shift()()
        }
        var r = {},
          n = { 0: 0 }
        function i(e) {
          if (r[e]) return r[e].exports
          var n = (r[e] = { i: e, l: !1, exports: {} })
          return t[e].call(n.exports, n, n.exports, i), (n.l = !0), n.exports
        }
        ;(i.e = function () {
          return Promise.resolve()
        }),
          (i.m = t),
          (i.c = r),
          (i.d = function (t, e, r) {
            i.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: r })
          }),
          (i.r = function (t) {
            'undefined' != typeof Symbol &&
              Symbol.toStringTag &&
              Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
              Object.defineProperty(t, '__esModule', { value: !0 })
          }),
          (i.t = function (t, e) {
            if ((1 & e && (t = i(t)), 8 & e)) return t
            if (4 & e && 'object' == typeof t && t && t.__esModule) return t
            var r = Object.create(null)
            if (
              (i.r(r),
              Object.defineProperty(r, 'default', { enumerable: !0, value: t }),
              2 & e && 'string' != typeof t)
            )
              for (var n in t)
                i.d(
                  r,
                  n,
                  function (e) {
                    return t[e]
                  }.bind(null, n)
                )
            return r
          }),
          (i.n = function (t) {
            var e =
              t && t.__esModule
                ? function () {
                    return t.default
                  }
                : function () {
                    return t
                  }
            return i.d(e, 'a', e), e
          }),
          (i.o = function (t, e) {
            return Object.prototype.hasOwnProperty.call(t, e)
          }),
          (i.p = ''),
          (i.oe = function (t) {
            throw (console.error(t), t)
          })
        var o = (window.webpackJsonpJsonUrl = window.webpackJsonpJsonUrl || []),
          a = o.push.bind(o)
        ;(o.push = e), (o = o.slice())
        for (var u = 0; u < o.length; u++) e(o[u])
        var s = a
        return i((i.s = 50))
      })([
        function (t, e, r) {
          var n = r(26)()
          t.exports = n
          try {
            regeneratorRuntime = n
          } catch (t) {
            'object' == typeof globalThis
              ? (globalThis.regeneratorRuntime = n)
              : Function('r', 'regeneratorRuntime = r')(n)
          }
        },
        function (t, e) {
          function r(t, e, r, n, i, o, a) {
            try {
              var u = t[o](a),
                s = u.value
            } catch (t) {
              return void r(t)
            }
            u.done ? e(s) : Promise.resolve(s).then(n, i)
          }
          ;(t.exports = function (t) {
            return function () {
              var e = this,
                n = arguments
              return new Promise(function (i, o) {
                var a = t.apply(e, n)
                function u(t) {
                  r(a, i, o, u, s, 'next', t)
                }
                function s(t) {
                  r(a, i, o, u, s, 'throw', t)
                }
                u(void 0)
              })
            }
          }),
            (t.exports.__esModule = !0),
            (t.exports.default = t.exports)
        },
        function (t, e, r) {
          var n = r(1),
            i = r.n(n),
            o = r(0),
            a = r.n(o)
          e.a = {
            msgpack: function () {
              return i()(
                a.a.mark(function t() {
                  var e, n
                  return a.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (t.next = 2),
                            Promise.resolve().then(r.t.bind(null, 30, 7))
                          )
                        case 2:
                          return (
                            (e = t.sent),
                            (n = e.default || e),
                            t.abrupt('return', n())
                          )
                        case 5:
                        case 'end':
                          return t.stop()
                      }
                  }, t)
                })
              )()
            },
            safe64: function () {
              return i()(
                a.a.mark(function t() {
                  return a.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (t.next = 2),
                            Promise.resolve().then(r.t.bind(null, 45, 7))
                          )
                        case 2:
                          return t.abrupt('return', t.sent)
                        case 3:
                        case 'end':
                          return t.stop()
                      }
                  }, t)
                })
              )()
            },
            lzma: function () {
              return i()(
                a.a.mark(function t() {
                  var e
                  return a.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (t.next = 2),
                            Promise.resolve().then(r.t.bind(null, 47, 7))
                          )
                        case 2:
                          return (
                            (e = t.sent),
                            t.abrupt('return', e.compress ? e : e.LZMA)
                          )
                        case 4:
                        case 'end':
                          return t.stop()
                      }
                  }, t)
                })
              )()
            },
            lzstring: function () {
              return i()(
                a.a.mark(function t() {
                  return a.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (t.next = 2),
                            Promise.resolve().then(r.t.bind(null, 48, 7))
                          )
                        case 2:
                          return t.abrupt('return', t.sent)
                        case 3:
                        case 'end':
                          return t.stop()
                      }
                  }, t)
                })
              )()
            },
            lzw: function () {
              return i()(
                a.a.mark(function t() {
                  var e, n
                  return a.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (t.next = 2),
                            Promise.resolve().then(r.t.bind(null, 49, 7))
                          )
                        case 2:
                          return (
                            (e = t.sent),
                            (n = e.default || e),
                            t.abrupt('return', n)
                          )
                        case 5:
                        case 'end':
                          return t.stop()
                      }
                  }, t)
                })
              )()
            }
          }
        },
        function (t, e, r) {
          var n = r(28),
            i = r(29),
            o = r(13)
          function a() {
            return s.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823
          }
          function u(t, e) {
            if (a() < e) throw new RangeError('Invalid typed array length')
            return (
              s.TYPED_ARRAY_SUPPORT
                ? ((t = new Uint8Array(e)).__proto__ = s.prototype)
                : (null === t && (t = new s(e)), (t.length = e)),
              t
            )
          }
          function s(t, e, r) {
            if (!(s.TYPED_ARRAY_SUPPORT || this instanceof s))
              return new s(t, e, r)
            if ('number' == typeof t) {
              if ('string' == typeof e)
                throw new Error(
                  'If encoding is specified then the first argument must be a string'
                )
              return l(this, t)
            }
            return f(this, t, e, r)
          }
          function f(t, e, r, n) {
            if ('number' == typeof e)
              throw new TypeError('"value" argument must not be a number')
            return 'undefined' != typeof ArrayBuffer && e instanceof ArrayBuffer
              ? (function (t, e, r, n) {
                  if ((e.byteLength, r < 0 || e.byteLength < r))
                    throw new RangeError("'offset' is out of bounds")
                  if (e.byteLength < r + (n || 0))
                    throw new RangeError("'length' is out of bounds")
                  e =
                    void 0 === r && void 0 === n
                      ? new Uint8Array(e)
                      : void 0 === n
                      ? new Uint8Array(e, r)
                      : new Uint8Array(e, r, n)
                  s.TYPED_ARRAY_SUPPORT
                    ? ((t = e).__proto__ = s.prototype)
                    : (t = h(t, e))
                  return t
                })(t, e, r, n)
              : 'string' == typeof e
              ? (function (t, e, r) {
                  ;('string' == typeof r && '' !== r) || (r = 'utf8')
                  if (!s.isEncoding(r))
                    throw new TypeError(
                      '"encoding" must be a valid string encoding'
                    )
                  var n = 0 | d(e, r)
                  t = u(t, n)
                  var i = t.write(e, r)
                  i !== n && (t = t.slice(0, i))
                  return t
                })(t, e, r)
              : (function (t, e) {
                  if (s.isBuffer(e)) {
                    var r = 0 | p(e.length)
                    return 0 === (t = u(t, r)).length || e.copy(t, 0, 0, r), t
                  }
                  if (e) {
                    if (
                      ('undefined' != typeof ArrayBuffer &&
                        e.buffer instanceof ArrayBuffer) ||
                      'length' in e
                    )
                      return 'number' != typeof e.length || (n = e.length) != n
                        ? u(t, 0)
                        : h(t, e)
                    if ('Buffer' === e.type && o(e.data)) return h(t, e.data)
                  }
                  var n
                  throw new TypeError(
                    'First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.'
                  )
                })(t, e)
          }
          function c(t) {
            if ('number' != typeof t)
              throw new TypeError('"size" argument must be a number')
            if (t < 0)
              throw new RangeError('"size" argument must not be negative')
          }
          function l(t, e) {
            if (
              (c(e), (t = u(t, e < 0 ? 0 : 0 | p(e))), !s.TYPED_ARRAY_SUPPORT)
            )
              for (var r = 0; r < e; ++r) t[r] = 0
            return t
          }
          function h(t, e) {
            var r = e.length < 0 ? 0 : 0 | p(e.length)
            t = u(t, r)
            for (var n = 0; n < r; n += 1) t[n] = 255 & e[n]
            return t
          }
          function p(t) {
            if (t >= a())
              throw new RangeError(
                'Attempt to allocate Buffer larger than maximum size: 0x' +
                  a().toString(16) +
                  ' bytes'
              )
            return 0 | t
          }
          function d(t, e) {
            if (s.isBuffer(t)) return t.length
            if (
              'undefined' != typeof ArrayBuffer &&
              'function' == typeof ArrayBuffer.isView &&
              (ArrayBuffer.isView(t) || t instanceof ArrayBuffer)
            )
              return t.byteLength
            'string' != typeof t && (t = '' + t)
            var r = t.length
            if (0 === r) return 0
            for (var n = !1; ; )
              switch (e) {
                case 'ascii':
                case 'latin1':
                case 'binary':
                  return r
                case 'utf8':
                case 'utf-8':
                case void 0:
                  return q(t).length
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return 2 * r
                case 'hex':
                  return r >>> 1
                case 'base64':
                  return F(t).length
                default:
                  if (n) return q(t).length
                  ;(e = ('' + e).toLowerCase()), (n = !0)
              }
          }
          function b(t, e, r) {
            var n = !1
            if (((void 0 === e || e < 0) && (e = 0), e > this.length)) return ''
            if (
              ((void 0 === r || r > this.length) && (r = this.length), r <= 0)
            )
              return ''
            if ((r >>>= 0) <= (e >>>= 0)) return ''
            for (t || (t = 'utf8'); ; )
              switch (t) {
                case 'hex':
                  return U(this, e, r)
                case 'utf8':
                case 'utf-8':
                  return A(this, e, r)
                case 'ascii':
                  return O(this, e, r)
                case 'latin1':
                case 'binary':
                  return j(this, e, r)
                case 'base64':
                  return k(this, e, r)
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return B(this, e, r)
                default:
                  if (n) throw new TypeError('Unknown encoding: ' + t)
                  ;(t = (t + '').toLowerCase()), (n = !0)
              }
          }
          function g(t, e, r) {
            var n = t[e]
            ;(t[e] = t[r]), (t[r] = n)
          }
          function y(t, e, r, n, i) {
            if (0 === t.length) return -1
            if (
              ('string' == typeof r
                ? ((n = r), (r = 0))
                : r > 2147483647
                ? (r = 2147483647)
                : r < -2147483648 && (r = -2147483648),
              (r = +r),
              isNaN(r) && (r = i ? 0 : t.length - 1),
              r < 0 && (r = t.length + r),
              r >= t.length)
            ) {
              if (i) return -1
              r = t.length - 1
            } else if (r < 0) {
              if (!i) return -1
              r = 0
            }
            if (('string' == typeof e && (e = s.from(e, n)), s.isBuffer(e)))
              return 0 === e.length ? -1 : v(t, e, r, n, i)
            if ('number' == typeof e)
              return (
                (e &= 255),
                s.TYPED_ARRAY_SUPPORT &&
                'function' == typeof Uint8Array.prototype.indexOf
                  ? i
                    ? Uint8Array.prototype.indexOf.call(t, e, r)
                    : Uint8Array.prototype.lastIndexOf.call(t, e, r)
                  : v(t, [e], r, n, i)
              )
            throw new TypeError('val must be string, number or Buffer')
          }
          function v(t, e, r, n, i) {
            var o,
              a = 1,
              u = t.length,
              s = e.length
            if (
              void 0 !== n &&
              ('ucs2' === (n = String(n).toLowerCase()) ||
                'ucs-2' === n ||
                'utf16le' === n ||
                'utf-16le' === n)
            ) {
              if (t.length < 2 || e.length < 2) return -1
              ;(a = 2), (u /= 2), (s /= 2), (r /= 2)
            }
            function f(t, e) {
              return 1 === a ? t[e] : t.readUInt16BE(e * a)
            }
            if (i) {
              var c = -1
              for (o = r; o < u; o++)
                if (f(t, o) === f(e, -1 === c ? 0 : o - c)) {
                  if ((-1 === c && (c = o), o - c + 1 === s)) return c * a
                } else -1 !== c && (o -= o - c), (c = -1)
            } else
              for (r + s > u && (r = u - s), o = r; o >= 0; o--) {
                for (var l = !0, h = 0; h < s; h++)
                  if (f(t, o + h) !== f(e, h)) {
                    l = !1
                    break
                  }
                if (l) return o
              }
            return -1
          }
          function m(t, e, r, n) {
            r = Number(r) || 0
            var i = t.length - r
            n ? (n = Number(n)) > i && (n = i) : (n = i)
            var o = e.length
            if (o % 2 != 0) throw new TypeError('Invalid hex string')
            n > o / 2 && (n = o / 2)
            for (var a = 0; a < n; ++a) {
              var u = parseInt(e.substr(2 * a, 2), 16)
              if (isNaN(u)) return a
              t[r + a] = u
            }
            return a
          }
          function w(t, e, r, n) {
            return Y(q(e, t.length - r), t, r, n)
          }
          function _(t, e, r, n) {
            return Y(
              (function (t) {
                for (var e = [], r = 0; r < t.length; ++r)
                  e.push(255 & t.charCodeAt(r))
                return e
              })(e),
              t,
              r,
              n
            )
          }
          function E(t, e, r, n) {
            return _(t, e, r, n)
          }
          function x(t, e, r, n) {
            return Y(F(e), t, r, n)
          }
          function S(t, e, r, n) {
            return Y(
              (function (t, e) {
                for (
                  var r, n, i, o = [], a = 0;
                  a < t.length && !((e -= 2) < 0);
                  ++a
                )
                  (n = (r = t.charCodeAt(a)) >> 8),
                    (i = r % 256),
                    o.push(i),
                    o.push(n)
                return o
              })(e, t.length - r),
              t,
              r,
              n
            )
          }
          function k(t, e, r) {
            return 0 === e && r === t.length
              ? n.fromByteArray(t)
              : n.fromByteArray(t.slice(e, r))
          }
          function A(t, e, r) {
            r = Math.min(t.length, r)
            for (var n = [], i = e; i < r; ) {
              var o,
                a,
                u,
                s,
                f = t[i],
                c = null,
                l = f > 239 ? 4 : f > 223 ? 3 : f > 191 ? 2 : 1
              if (i + l <= r)
                switch (l) {
                  case 1:
                    f < 128 && (c = f)
                    break
                  case 2:
                    128 == (192 & (o = t[i + 1])) &&
                      (s = ((31 & f) << 6) | (63 & o)) > 127 &&
                      (c = s)
                    break
                  case 3:
                    ;(o = t[i + 1]),
                      (a = t[i + 2]),
                      128 == (192 & o) &&
                        128 == (192 & a) &&
                        (s = ((15 & f) << 12) | ((63 & o) << 6) | (63 & a)) >
                          2047 &&
                        (s < 55296 || s > 57343) &&
                        (c = s)
                    break
                  case 4:
                    ;(o = t[i + 1]),
                      (a = t[i + 2]),
                      (u = t[i + 3]),
                      128 == (192 & o) &&
                        128 == (192 & a) &&
                        128 == (192 & u) &&
                        (s =
                          ((15 & f) << 18) |
                          ((63 & o) << 12) |
                          ((63 & a) << 6) |
                          (63 & u)) > 65535 &&
                        s < 1114112 &&
                        (c = s)
                }
              null === c
                ? ((c = 65533), (l = 1))
                : c > 65535 &&
                  ((c -= 65536),
                  n.push(((c >>> 10) & 1023) | 55296),
                  (c = 56320 | (1023 & c))),
                n.push(c),
                (i += l)
            }
            return (function (t) {
              var e = t.length
              if (e <= T) return String.fromCharCode.apply(String, t)
              var r = '',
                n = 0
              for (; n < e; )
                r += String.fromCharCode.apply(String, t.slice(n, (n += T)))
              return r
            })(n)
          }
          ;(e.Buffer = s),
            (e.SlowBuffer = function (t) {
              ;+t != t && (t = 0)
              return s.alloc(+t)
            }),
            (e.INSPECT_MAX_BYTES = 50),
            (s.TYPED_ARRAY_SUPPORT =
              void 0 !== window.TYPED_ARRAY_SUPPORT
                ? window.TYPED_ARRAY_SUPPORT
                : (function () {
                    try {
                      var t = new Uint8Array(1)
                      return (
                        (t.__proto__ = {
                          __proto__: Uint8Array.prototype,
                          foo: function () {
                            return 42
                          }
                        }),
                        42 === t.foo() &&
                          'function' == typeof t.subarray &&
                          0 === t.subarray(1, 1).byteLength
                      )
                    } catch (t) {
                      return !1
                    }
                  })()),
            (e.kMaxLength = a()),
            (s.poolSize = 8192),
            (s._augment = function (t) {
              return (t.__proto__ = s.prototype), t
            }),
            (s.from = function (t, e, r) {
              return f(null, t, e, r)
            }),
            s.TYPED_ARRAY_SUPPORT &&
              ((s.prototype.__proto__ = Uint8Array.prototype),
              (s.__proto__ = Uint8Array),
              'undefined' != typeof Symbol &&
                Symbol.species &&
                s[Symbol.species] === s &&
                Object.defineProperty(s, Symbol.species, {
                  value: null,
                  configurable: !0
                })),
            (s.alloc = function (t, e, r) {
              return (function (t, e, r, n) {
                return (
                  c(e),
                  e <= 0
                    ? u(t, e)
                    : void 0 !== r
                    ? 'string' == typeof n
                      ? u(t, e).fill(r, n)
                      : u(t, e).fill(r)
                    : u(t, e)
                )
              })(null, t, e, r)
            }),
            (s.allocUnsafe = function (t) {
              return l(null, t)
            }),
            (s.allocUnsafeSlow = function (t) {
              return l(null, t)
            }),
            (s.isBuffer = function (t) {
              return !(null == t || !t._isBuffer)
            }),
            (s.compare = function (t, e) {
              if (!s.isBuffer(t) || !s.isBuffer(e))
                throw new TypeError('Arguments must be Buffers')
              if (t === e) return 0
              for (
                var r = t.length, n = e.length, i = 0, o = Math.min(r, n);
                i < o;
                ++i
              )
                if (t[i] !== e[i]) {
                  ;(r = t[i]), (n = e[i])
                  break
                }
              return r < n ? -1 : n < r ? 1 : 0
            }),
            (s.isEncoding = function (t) {
              switch (String(t).toLowerCase()) {
                case 'hex':
                case 'utf8':
                case 'utf-8':
                case 'ascii':
                case 'latin1':
                case 'binary':
                case 'base64':
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return !0
                default:
                  return !1
              }
            }),
            (s.concat = function (t, e) {
              if (!o(t))
                throw new TypeError(
                  '"list" argument must be an Array of Buffers'
                )
              if (0 === t.length) return s.alloc(0)
              var r
              if (void 0 === e)
                for (e = 0, r = 0; r < t.length; ++r) e += t[r].length
              var n = s.allocUnsafe(e),
                i = 0
              for (r = 0; r < t.length; ++r) {
                var a = t[r]
                if (!s.isBuffer(a))
                  throw new TypeError(
                    '"list" argument must be an Array of Buffers'
                  )
                a.copy(n, i), (i += a.length)
              }
              return n
            }),
            (s.byteLength = d),
            (s.prototype._isBuffer = !0),
            (s.prototype.swap16 = function () {
              var t = this.length
              if (t % 2 != 0)
                throw new RangeError(
                  'Buffer size must be a multiple of 16-bits'
                )
              for (var e = 0; e < t; e += 2) g(this, e, e + 1)
              return this
            }),
            (s.prototype.swap32 = function () {
              var t = this.length
              if (t % 4 != 0)
                throw new RangeError(
                  'Buffer size must be a multiple of 32-bits'
                )
              for (var e = 0; e < t; e += 4)
                g(this, e, e + 3), g(this, e + 1, e + 2)
              return this
            }),
            (s.prototype.swap64 = function () {
              var t = this.length
              if (t % 8 != 0)
                throw new RangeError(
                  'Buffer size must be a multiple of 64-bits'
                )
              for (var e = 0; e < t; e += 8)
                g(this, e, e + 7),
                  g(this, e + 1, e + 6),
                  g(this, e + 2, e + 5),
                  g(this, e + 3, e + 4)
              return this
            }),
            (s.prototype.toString = function () {
              var t = 0 | this.length
              return 0 === t
                ? ''
                : 0 === arguments.length
                ? A(this, 0, t)
                : b.apply(this, arguments)
            }),
            (s.prototype.equals = function (t) {
              if (!s.isBuffer(t))
                throw new TypeError('Argument must be a Buffer')
              return this === t || 0 === s.compare(this, t)
            }),
            (s.prototype.inspect = function () {
              var t = '',
                r = e.INSPECT_MAX_BYTES
              return (
                this.length > 0 &&
                  ((t = this.toString('hex', 0, r).match(/.{2}/g).join(' ')),
                  this.length > r && (t += ' ... ')),
                '<Buffer ' + t + '>'
              )
            }),
            (s.prototype.compare = function (t, e, r, n, i) {
              if (!s.isBuffer(t))
                throw new TypeError('Argument must be a Buffer')
              if (
                (void 0 === e && (e = 0),
                void 0 === r && (r = t ? t.length : 0),
                void 0 === n && (n = 0),
                void 0 === i && (i = this.length),
                e < 0 || r > t.length || n < 0 || i > this.length)
              )
                throw new RangeError('out of range index')
              if (n >= i && e >= r) return 0
              if (n >= i) return -1
              if (e >= r) return 1
              if (this === t) return 0
              for (
                var o = (i >>>= 0) - (n >>>= 0),
                  a = (r >>>= 0) - (e >>>= 0),
                  u = Math.min(o, a),
                  f = this.slice(n, i),
                  c = t.slice(e, r),
                  l = 0;
                l < u;
                ++l
              )
                if (f[l] !== c[l]) {
                  ;(o = f[l]), (a = c[l])
                  break
                }
              return o < a ? -1 : a < o ? 1 : 0
            }),
            (s.prototype.includes = function (t, e, r) {
              return -1 !== this.indexOf(t, e, r)
            }),
            (s.prototype.indexOf = function (t, e, r) {
              return y(this, t, e, r, !0)
            }),
            (s.prototype.lastIndexOf = function (t, e, r) {
              return y(this, t, e, r, !1)
            }),
            (s.prototype.write = function (t, e, r, n) {
              if (void 0 === e) (n = 'utf8'), (r = this.length), (e = 0)
              else if (void 0 === r && 'string' == typeof e)
                (n = e), (r = this.length), (e = 0)
              else {
                if (!isFinite(e))
                  throw new Error(
                    'Buffer.write(string, encoding, offset[, length]) is no longer supported'
                  )
                ;(e |= 0),
                  isFinite(r)
                    ? ((r |= 0), void 0 === n && (n = 'utf8'))
                    : ((n = r), (r = void 0))
              }
              var i = this.length - e
              if (
                ((void 0 === r || r > i) && (r = i),
                (t.length > 0 && (r < 0 || e < 0)) || e > this.length)
              )
                throw new RangeError('Attempt to write outside buffer bounds')
              n || (n = 'utf8')
              for (var o = !1; ; )
                switch (n) {
                  case 'hex':
                    return m(this, t, e, r)
                  case 'utf8':
                  case 'utf-8':
                    return w(this, t, e, r)
                  case 'ascii':
                    return _(this, t, e, r)
                  case 'latin1':
                  case 'binary':
                    return E(this, t, e, r)
                  case 'base64':
                    return x(this, t, e, r)
                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return S(this, t, e, r)
                  default:
                    if (o) throw new TypeError('Unknown encoding: ' + n)
                    ;(n = ('' + n).toLowerCase()), (o = !0)
                }
            }),
            (s.prototype.toJSON = function () {
              return {
                type: 'Buffer',
                data: Array.prototype.slice.call(this._arr || this, 0)
              }
            })
          var T = 4096
          function O(t, e, r) {
            var n = ''
            r = Math.min(t.length, r)
            for (var i = e; i < r; ++i) n += String.fromCharCode(127 & t[i])
            return n
          }
          function j(t, e, r) {
            var n = ''
            r = Math.min(t.length, r)
            for (var i = e; i < r; ++i) n += String.fromCharCode(t[i])
            return n
          }
          function U(t, e, r) {
            var n = t.length
            ;(!e || e < 0) && (e = 0), (!r || r < 0 || r > n) && (r = n)
            for (var i = '', o = e; o < r; ++o) i += z(t[o])
            return i
          }
          function B(t, e, r) {
            for (var n = t.slice(e, r), i = '', o = 0; o < n.length; o += 2)
              i += String.fromCharCode(n[o] + 256 * n[o + 1])
            return i
          }
          function M(t, e, r) {
            if (t % 1 != 0 || t < 0) throw new RangeError('offset is not uint')
            if (t + e > r)
              throw new RangeError('Trying to access beyond buffer length')
          }
          function L(t, e, r, n, i, o) {
            if (!s.isBuffer(t))
              throw new TypeError('"buffer" argument must be a Buffer instance')
            if (e > i || e < o)
              throw new RangeError('"value" argument is out of bounds')
            if (r + n > t.length) throw new RangeError('Index out of range')
          }
          function R(t, e, r, n) {
            e < 0 && (e = 65535 + e + 1)
            for (var i = 0, o = Math.min(t.length - r, 2); i < o; ++i)
              t[r + i] =
                (e & (255 << (8 * (n ? i : 1 - i)))) >>> (8 * (n ? i : 1 - i))
          }
          function I(t, e, r, n) {
            e < 0 && (e = 4294967295 + e + 1)
            for (var i = 0, o = Math.min(t.length - r, 4); i < o; ++i)
              t[r + i] = (e >>> (8 * (n ? i : 3 - i))) & 255
          }
          function P(t, e, r, n, i, o) {
            if (r + n > t.length) throw new RangeError('Index out of range')
            if (r < 0) throw new RangeError('Index out of range')
          }
          function C(t, e, r, n, o) {
            return o || P(t, 0, r, 4), i.write(t, e, r, n, 23, 4), r + 4
          }
          function N(t, e, r, n, o) {
            return o || P(t, 0, r, 8), i.write(t, e, r, n, 52, 8), r + 8
          }
          ;(s.prototype.slice = function (t, e) {
            var r,
              n = this.length
            if (
              ((t = ~~t) < 0 ? (t += n) < 0 && (t = 0) : t > n && (t = n),
              (e = void 0 === e ? n : ~~e) < 0
                ? (e += n) < 0 && (e = 0)
                : e > n && (e = n),
              e < t && (e = t),
              s.TYPED_ARRAY_SUPPORT)
            )
              (r = this.subarray(t, e)).__proto__ = s.prototype
            else {
              var i = e - t
              r = new s(i, void 0)
              for (var o = 0; o < i; ++o) r[o] = this[o + t]
            }
            return r
          }),
            (s.prototype.readUIntLE = function (t, e, r) {
              ;(t |= 0), (e |= 0), r || M(t, e, this.length)
              for (var n = this[t], i = 1, o = 0; ++o < e && (i *= 256); )
                n += this[t + o] * i
              return n
            }),
            (s.prototype.readUIntBE = function (t, e, r) {
              ;(t |= 0), (e |= 0), r || M(t, e, this.length)
              for (var n = this[t + --e], i = 1; e > 0 && (i *= 256); )
                n += this[t + --e] * i
              return n
            }),
            (s.prototype.readUInt8 = function (t, e) {
              return e || M(t, 1, this.length), this[t]
            }),
            (s.prototype.readUInt16LE = function (t, e) {
              return e || M(t, 2, this.length), this[t] | (this[t + 1] << 8)
            }),
            (s.prototype.readUInt16BE = function (t, e) {
              return e || M(t, 2, this.length), (this[t] << 8) | this[t + 1]
            }),
            (s.prototype.readUInt32LE = function (t, e) {
              return (
                e || M(t, 4, this.length),
                (this[t] | (this[t + 1] << 8) | (this[t + 2] << 16)) +
                  16777216 * this[t + 3]
              )
            }),
            (s.prototype.readUInt32BE = function (t, e) {
              return (
                e || M(t, 4, this.length),
                16777216 * this[t] +
                  ((this[t + 1] << 16) | (this[t + 2] << 8) | this[t + 3])
              )
            }),
            (s.prototype.readIntLE = function (t, e, r) {
              ;(t |= 0), (e |= 0), r || M(t, e, this.length)
              for (var n = this[t], i = 1, o = 0; ++o < e && (i *= 256); )
                n += this[t + o] * i
              return n >= (i *= 128) && (n -= Math.pow(2, 8 * e)), n
            }),
            (s.prototype.readIntBE = function (t, e, r) {
              ;(t |= 0), (e |= 0), r || M(t, e, this.length)
              for (var n = e, i = 1, o = this[t + --n]; n > 0 && (i *= 256); )
                o += this[t + --n] * i
              return o >= (i *= 128) && (o -= Math.pow(2, 8 * e)), o
            }),
            (s.prototype.readInt8 = function (t, e) {
              return (
                e || M(t, 1, this.length),
                128 & this[t] ? -1 * (255 - this[t] + 1) : this[t]
              )
            }),
            (s.prototype.readInt16LE = function (t, e) {
              e || M(t, 2, this.length)
              var r = this[t] | (this[t + 1] << 8)
              return 32768 & r ? 4294901760 | r : r
            }),
            (s.prototype.readInt16BE = function (t, e) {
              e || M(t, 2, this.length)
              var r = this[t + 1] | (this[t] << 8)
              return 32768 & r ? 4294901760 | r : r
            }),
            (s.prototype.readInt32LE = function (t, e) {
              return (
                e || M(t, 4, this.length),
                this[t] |
                  (this[t + 1] << 8) |
                  (this[t + 2] << 16) |
                  (this[t + 3] << 24)
              )
            }),
            (s.prototype.readInt32BE = function (t, e) {
              return (
                e || M(t, 4, this.length),
                (this[t] << 24) |
                  (this[t + 1] << 16) |
                  (this[t + 2] << 8) |
                  this[t + 3]
              )
            }),
            (s.prototype.readFloatLE = function (t, e) {
              return e || M(t, 4, this.length), i.read(this, t, !0, 23, 4)
            }),
            (s.prototype.readFloatBE = function (t, e) {
              return e || M(t, 4, this.length), i.read(this, t, !1, 23, 4)
            }),
            (s.prototype.readDoubleLE = function (t, e) {
              return e || M(t, 8, this.length), i.read(this, t, !0, 52, 8)
            }),
            (s.prototype.readDoubleBE = function (t, e) {
              return e || M(t, 8, this.length), i.read(this, t, !1, 52, 8)
            }),
            (s.prototype.writeUIntLE = function (t, e, r, n) {
              ;((t = +t), (e |= 0), (r |= 0), n) ||
                L(this, t, e, r, Math.pow(2, 8 * r) - 1, 0)
              var i = 1,
                o = 0
              for (this[e] = 255 & t; ++o < r && (i *= 256); )
                this[e + o] = (t / i) & 255
              return e + r
            }),
            (s.prototype.writeUIntBE = function (t, e, r, n) {
              ;((t = +t), (e |= 0), (r |= 0), n) ||
                L(this, t, e, r, Math.pow(2, 8 * r) - 1, 0)
              var i = r - 1,
                o = 1
              for (this[e + i] = 255 & t; --i >= 0 && (o *= 256); )
                this[e + i] = (t / o) & 255
              return e + r
            }),
            (s.prototype.writeUInt8 = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 1, 255, 0),
                s.TYPED_ARRAY_SUPPORT || (t = Math.floor(t)),
                (this[e] = 255 & t),
                e + 1
              )
            }),
            (s.prototype.writeUInt16LE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 2, 65535, 0),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = 255 & t), (this[e + 1] = t >>> 8))
                  : R(this, t, e, !0),
                e + 2
              )
            }),
            (s.prototype.writeUInt16BE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 2, 65535, 0),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = t >>> 8), (this[e + 1] = 255 & t))
                  : R(this, t, e, !1),
                e + 2
              )
            }),
            (s.prototype.writeUInt32LE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 4, 4294967295, 0),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e + 3] = t >>> 24),
                    (this[e + 2] = t >>> 16),
                    (this[e + 1] = t >>> 8),
                    (this[e] = 255 & t))
                  : I(this, t, e, !0),
                e + 4
              )
            }),
            (s.prototype.writeUInt32BE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 4, 4294967295, 0),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = t >>> 24),
                    (this[e + 1] = t >>> 16),
                    (this[e + 2] = t >>> 8),
                    (this[e + 3] = 255 & t))
                  : I(this, t, e, !1),
                e + 4
              )
            }),
            (s.prototype.writeIntLE = function (t, e, r, n) {
              if (((t = +t), (e |= 0), !n)) {
                var i = Math.pow(2, 8 * r - 1)
                L(this, t, e, r, i - 1, -i)
              }
              var o = 0,
                a = 1,
                u = 0
              for (this[e] = 255 & t; ++o < r && (a *= 256); )
                t < 0 && 0 === u && 0 !== this[e + o - 1] && (u = 1),
                  (this[e + o] = (((t / a) >> 0) - u) & 255)
              return e + r
            }),
            (s.prototype.writeIntBE = function (t, e, r, n) {
              if (((t = +t), (e |= 0), !n)) {
                var i = Math.pow(2, 8 * r - 1)
                L(this, t, e, r, i - 1, -i)
              }
              var o = r - 1,
                a = 1,
                u = 0
              for (this[e + o] = 255 & t; --o >= 0 && (a *= 256); )
                t < 0 && 0 === u && 0 !== this[e + o + 1] && (u = 1),
                  (this[e + o] = (((t / a) >> 0) - u) & 255)
              return e + r
            }),
            (s.prototype.writeInt8 = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 1, 127, -128),
                s.TYPED_ARRAY_SUPPORT || (t = Math.floor(t)),
                t < 0 && (t = 255 + t + 1),
                (this[e] = 255 & t),
                e + 1
              )
            }),
            (s.prototype.writeInt16LE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 2, 32767, -32768),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = 255 & t), (this[e + 1] = t >>> 8))
                  : R(this, t, e, !0),
                e + 2
              )
            }),
            (s.prototype.writeInt16BE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 2, 32767, -32768),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = t >>> 8), (this[e + 1] = 255 & t))
                  : R(this, t, e, !1),
                e + 2
              )
            }),
            (s.prototype.writeInt32LE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 4, 2147483647, -2147483648),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = 255 & t),
                    (this[e + 1] = t >>> 8),
                    (this[e + 2] = t >>> 16),
                    (this[e + 3] = t >>> 24))
                  : I(this, t, e, !0),
                e + 4
              )
            }),
            (s.prototype.writeInt32BE = function (t, e, r) {
              return (
                (t = +t),
                (e |= 0),
                r || L(this, t, e, 4, 2147483647, -2147483648),
                t < 0 && (t = 4294967295 + t + 1),
                s.TYPED_ARRAY_SUPPORT
                  ? ((this[e] = t >>> 24),
                    (this[e + 1] = t >>> 16),
                    (this[e + 2] = t >>> 8),
                    (this[e + 3] = 255 & t))
                  : I(this, t, e, !1),
                e + 4
              )
            }),
            (s.prototype.writeFloatLE = function (t, e, r) {
              return C(this, t, e, !0, r)
            }),
            (s.prototype.writeFloatBE = function (t, e, r) {
              return C(this, t, e, !1, r)
            }),
            (s.prototype.writeDoubleLE = function (t, e, r) {
              return N(this, t, e, !0, r)
            }),
            (s.prototype.writeDoubleBE = function (t, e, r) {
              return N(this, t, e, !1, r)
            }),
            (s.prototype.copy = function (t, e, r, n) {
              if (
                (r || (r = 0),
                n || 0 === n || (n = this.length),
                e >= t.length && (e = t.length),
                e || (e = 0),
                n > 0 && n < r && (n = r),
                n === r)
              )
                return 0
              if (0 === t.length || 0 === this.length) return 0
              if (e < 0) throw new RangeError('targetStart out of bounds')
              if (r < 0 || r >= this.length)
                throw new RangeError('sourceStart out of bounds')
              if (n < 0) throw new RangeError('sourceEnd out of bounds')
              n > this.length && (n = this.length),
                t.length - e < n - r && (n = t.length - e + r)
              var i,
                o = n - r
              if (this === t && r < e && e < n)
                for (i = o - 1; i >= 0; --i) t[i + e] = this[i + r]
              else if (o < 1e3 || !s.TYPED_ARRAY_SUPPORT)
                for (i = 0; i < o; ++i) t[i + e] = this[i + r]
              else Uint8Array.prototype.set.call(t, this.subarray(r, r + o), e)
              return o
            }),
            (s.prototype.fill = function (t, e, r, n) {
              if ('string' == typeof t) {
                if (
                  ('string' == typeof e
                    ? ((n = e), (e = 0), (r = this.length))
                    : 'string' == typeof r && ((n = r), (r = this.length)),
                  1 === t.length)
                ) {
                  var i = t.charCodeAt(0)
                  i < 256 && (t = i)
                }
                if (void 0 !== n && 'string' != typeof n)
                  throw new TypeError('encoding must be a string')
                if ('string' == typeof n && !s.isEncoding(n))
                  throw new TypeError('Unknown encoding: ' + n)
              } else 'number' == typeof t && (t &= 255)
              if (e < 0 || this.length < e || this.length < r)
                throw new RangeError('Out of range index')
              if (r <= e) return this
              var o
              if (
                ((e >>>= 0),
                (r = void 0 === r ? this.length : r >>> 0),
                t || (t = 0),
                'number' == typeof t)
              )
                for (o = e; o < r; ++o) this[o] = t
              else {
                var a = s.isBuffer(t) ? t : q(new s(t, n).toString()),
                  u = a.length
                for (o = 0; o < r - e; ++o) this[o + e] = a[o % u]
              }
              return this
            })
          var D = /[^+\/0-9A-Za-z-_]/g
          function z(t) {
            return t < 16 ? '0' + t.toString(16) : t.toString(16)
          }
          function q(t, e) {
            var r
            e = e || 1 / 0
            for (var n = t.length, i = null, o = [], a = 0; a < n; ++a) {
              if ((r = t.charCodeAt(a)) > 55295 && r < 57344) {
                if (!i) {
                  if (r > 56319) {
                    ;(e -= 3) > -1 && o.push(239, 191, 189)
                    continue
                  }
                  if (a + 1 === n) {
                    ;(e -= 3) > -1 && o.push(239, 191, 189)
                    continue
                  }
                  i = r
                  continue
                }
                if (r < 56320) {
                  ;(e -= 3) > -1 && o.push(239, 191, 189), (i = r)
                  continue
                }
                r = 65536 + (((i - 55296) << 10) | (r - 56320))
              } else i && (e -= 3) > -1 && o.push(239, 191, 189)
              if (((i = null), r < 128)) {
                if ((e -= 1) < 0) break
                o.push(r)
              } else if (r < 2048) {
                if ((e -= 2) < 0) break
                o.push((r >> 6) | 192, (63 & r) | 128)
              } else if (r < 65536) {
                if ((e -= 3) < 0) break
                o.push((r >> 12) | 224, ((r >> 6) & 63) | 128, (63 & r) | 128)
              } else {
                if (!(r < 1114112)) throw new Error('Invalid code point')
                if ((e -= 4) < 0) break
                o.push(
                  (r >> 18) | 240,
                  ((r >> 12) & 63) | 128,
                  ((r >> 6) & 63) | 128,
                  (63 & r) | 128
                )
              }
            }
            return o
          }
          function F(t) {
            return n.toByteArray(
              (function (t) {
                if (
                  (t = (function (t) {
                    return t.trim ? t.trim() : t.replace(/^\s+|\s+$/g, '')
                  })(t).replace(D, '')).length < 2
                )
                  return ''
                for (; t.length % 4 != 0; ) t += '='
                return t
              })(t)
            )
          }
          function Y(t, e, r, n) {
            for (var i = 0; i < n && !(i + r >= e.length || i >= t.length); ++i)
              e[i + r] = t[i]
            return i
          }
        },
        function (t, e) {
          'function' == typeof Object.create
            ? (t.exports = function (t, e) {
                e &&
                  ((t.super_ = e),
                  (t.prototype = Object.create(e.prototype, {
                    constructor: {
                      value: t,
                      enumerable: !1,
                      writable: !0,
                      configurable: !0
                    }
                  })))
              })
            : (t.exports = function (t, e) {
                if (e) {
                  t.super_ = e
                  var r = function () {}
                  ;(r.prototype = e.prototype),
                    (t.prototype = new r()),
                    (t.prototype.constructor = t)
                }
              })
        },
        function (t, e, r) {
          var n = r(9),
            i =
              Object.keys ||
              function (t) {
                var e = []
                for (var r in t) e.push(r)
                return e
              }
          t.exports = l
          var o = Object.create(r(7))
          o.inherits = r(4)
          var a = r(15),
            u = r(19)
          o.inherits(l, a)
          for (var s = i(u.prototype), f = 0; f < s.length; f++) {
            var c = s[f]
            l.prototype[c] || (l.prototype[c] = u.prototype[c])
          }
          function l(t) {
            if (!(this instanceof l)) return new l(t)
            a.call(this, t),
              u.call(this, t),
              t && !1 === t.readable && (this.readable = !1),
              t && !1 === t.writable && (this.writable = !1),
              (this.allowHalfOpen = !0),
              t && !1 === t.allowHalfOpen && (this.allowHalfOpen = !1),
              this.once('end', h)
          }
          function h() {
            this.allowHalfOpen ||
              this._writableState.ended ||
              n.nextTick(p, this)
          }
          function p(t) {
            t.end()
          }
          Object.defineProperty(l.prototype, 'writableHighWaterMark', {
            enumerable: !1,
            get: function () {
              return this._writableState.highWaterMark
            }
          }),
            Object.defineProperty(l.prototype, 'destroyed', {
              get: function () {
                return (
                  void 0 !== this._readableState &&
                  void 0 !== this._writableState &&
                  this._readableState.destroyed &&
                  this._writableState.destroyed
                )
              },
              set: function (t) {
                void 0 !== this._readableState &&
                  void 0 !== this._writableState &&
                  ((this._readableState.destroyed = t),
                  (this._writableState.destroyed = t))
              }
            }),
            (l.prototype._destroy = function (t, e) {
              this.push(null), this.end(), n.nextTick(e, t)
            })
        },
        function (t, e) {
          var r,
            n,
            i = (t.exports = {})
          function o() {
            throw new Error('setTimeout has not been defined')
          }
          function a() {
            throw new Error('clearTimeout has not been defined')
          }
          function u(t) {
            if (r === setTimeout) return setTimeout(t, 0)
            if ((r === o || !r) && setTimeout)
              return (r = setTimeout), setTimeout(t, 0)
            try {
              return r(t, 0)
            } catch (e) {
              try {
                return r.call(null, t, 0)
              } catch (e) {
                return r.call(this, t, 0)
              }
            }
          }
          !(function () {
            try {
              r = 'function' == typeof setTimeout ? setTimeout : o
            } catch (t) {
              r = o
            }
            try {
              n = 'function' == typeof clearTimeout ? clearTimeout : a
            } catch (t) {
              n = a
            }
          })()
          var s,
            f = [],
            c = !1,
            l = -1
          function h() {
            c &&
              s &&
              ((c = !1),
              s.length ? (f = s.concat(f)) : (l = -1),
              f.length && p())
          }
          function p() {
            if (!c) {
              var t = u(h)
              c = !0
              for (var e = f.length; e; ) {
                for (s = f, f = []; ++l < e; ) s && s[l].run()
                ;(l = -1), (e = f.length)
              }
              ;(s = null),
                (c = !1),
                (function (t) {
                  if (n === clearTimeout) return clearTimeout(t)
                  if ((n === a || !n) && clearTimeout)
                    return (n = clearTimeout), clearTimeout(t)
                  try {
                    return n(t)
                  } catch (e) {
                    try {
                      return n.call(null, t)
                    } catch (e) {
                      return n.call(this, t)
                    }
                  }
                })(t)
            }
          }
          function d(t, e) {
            ;(this.fun = t), (this.array = e)
          }
          function b() {}
          ;(i.nextTick = function (t) {
            var e = new Array(arguments.length - 1)
            if (arguments.length > 1)
              for (var r = 1; r < arguments.length; r++) e[r - 1] = arguments[r]
            f.push(new d(t, e)), 1 !== f.length || c || u(p)
          }),
            (d.prototype.run = function () {
              this.fun.apply(null, this.array)
            }),
            (i.title = 'browser'),
            (i.browser = !0),
            (i.env = {}),
            (i.argv = []),
            (i.version = ''),
            (i.versions = {}),
            (i.on = b),
            (i.addListener = b),
            (i.once = b),
            (i.off = b),
            (i.removeListener = b),
            (i.removeAllListeners = b),
            (i.emit = b),
            (i.prependListener = b),
            (i.prependOnceListener = b),
            (i.listeners = function (t) {
              return []
            }),
            (i.binding = function (t) {
              throw new Error('process.binding is not supported')
            }),
            (i.cwd = function () {
              return '/'
            }),
            (i.chdir = function (t) {
              throw new Error('process.chdir is not supported')
            }),
            (i.umask = function () {
              return 0
            })
        },
        function (t, e, r) {
          function n(t) {
            return Object.prototype.toString.call(t)
          }
          ;(e.isArray = function (t) {
            return Array.isArray ? Array.isArray(t) : '[object Array]' === n(t)
          }),
            (e.isBoolean = function (t) {
              return 'boolean' == typeof t
            }),
            (e.isNull = function (t) {
              return null === t
            }),
            (e.isNullOrUndefined = function (t) {
              return null == t
            }),
            (e.isNumber = function (t) {
              return 'number' == typeof t
            }),
            (e.isString = function (t) {
              return 'string' == typeof t
            }),
            (e.isSymbol = function (t) {
              return 'symbol' == typeof t
            }),
            (e.isUndefined = function (t) {
              return void 0 === t
            }),
            (e.isRegExp = function (t) {
              return '[object RegExp]' === n(t)
            }),
            (e.isObject = function (t) {
              return 'object' == typeof t && null !== t
            }),
            (e.isDate = function (t) {
              return '[object Date]' === n(t)
            }),
            (e.isError = function (t) {
              return '[object Error]' === n(t) || t instanceof Error
            }),
            (e.isFunction = function (t) {
              return 'function' == typeof t
            }),
            (e.isPrimitive = function (t) {
              return (
                null === t ||
                'boolean' == typeof t ||
                'number' == typeof t ||
                'string' == typeof t ||
                'symbol' == typeof t ||
                void 0 === t
              )
            }),
            (e.isBuffer = r(3).Buffer.isBuffer)
        },
        function (t, e, r) {
          var n = r(14).Duplex,
            i = r(11),
            o = r(10).Buffer
          function a(t) {
            if (!(this instanceof a)) return new a(t)
            if (
              ((this._bufs = []), (this.length = 0), 'function' == typeof t)
            ) {
              this._callback = t
              var e = function (t) {
                this._callback && (this._callback(t), (this._callback = null))
              }.bind(this)
              this.on('pipe', function (t) {
                t.on('error', e)
              }),
                this.on('unpipe', function (t) {
                  t.removeListener('error', e)
                })
            } else this.append(t)
            n.call(this)
          }
          i.inherits(a, n),
            (a.prototype._offset = function (t) {
              var e,
                r = 0,
                n = 0
              if (0 === t) return [0, 0]
              for (; n < this._bufs.length; n++) {
                if (
                  t < (e = r + this._bufs[n].length) ||
                  n == this._bufs.length - 1
                )
                  return [n, t - r]
                r = e
              }
            }),
            (a.prototype._reverseOffset = function (t) {
              for (var e = t[0], r = t[1], n = 0; n < e; n++)
                r += this._bufs[n].length
              return r
            }),
            (a.prototype.append = function (t) {
              var e = 0
              if (o.isBuffer(t)) this._appendBuffer(t)
              else if (Array.isArray(t))
                for (; e < t.length; e++) this.append(t[e])
              else if (t instanceof a)
                for (; e < t._bufs.length; e++) this.append(t._bufs[e])
              else
                null != t &&
                  ('number' == typeof t && (t = t.toString()),
                  this._appendBuffer(o.from(t)))
              return this
            }),
            (a.prototype._appendBuffer = function (t) {
              this._bufs.push(t), (this.length += t.length)
            }),
            (a.prototype._write = function (t, e, r) {
              this._appendBuffer(t), 'function' == typeof r && r()
            }),
            (a.prototype._read = function (t) {
              if (!this.length) return this.push(null)
              ;(t = Math.min(t, this.length)),
                this.push(this.slice(0, t)),
                this.consume(t)
            }),
            (a.prototype.end = function (t) {
              n.prototype.end.call(this, t),
                this._callback &&
                  (this._callback(null, this.slice()), (this._callback = null))
            }),
            (a.prototype.get = function (t) {
              if (!(t > this.length || t < 0)) {
                var e = this._offset(t)
                return this._bufs[e[0]][e[1]]
              }
            }),
            (a.prototype.slice = function (t, e) {
              return (
                'number' == typeof t && t < 0 && (t += this.length),
                'number' == typeof e && e < 0 && (e += this.length),
                this.copy(null, 0, t, e)
              )
            }),
            (a.prototype.copy = function (t, e, r, n) {
              if (
                (('number' != typeof r || r < 0) && (r = 0),
                ('number' != typeof n || n > this.length) && (n = this.length),
                r >= this.length)
              )
                return t || o.alloc(0)
              if (n <= 0) return t || o.alloc(0)
              var i,
                a,
                u = !!t,
                s = this._offset(r),
                f = n - r,
                c = f,
                l = (u && e) || 0,
                h = s[1]
              if (0 === r && n == this.length) {
                if (!u)
                  return 1 === this._bufs.length
                    ? this._bufs[0]
                    : o.concat(this._bufs, this.length)
                for (a = 0; a < this._bufs.length; a++)
                  this._bufs[a].copy(t, l), (l += this._bufs[a].length)
                return t
              }
              if (c <= this._bufs[s[0]].length - h)
                return u
                  ? this._bufs[s[0]].copy(t, e, h, h + c)
                  : this._bufs[s[0]].slice(h, h + c)
              for (
                u || (t = o.allocUnsafe(f)), a = s[0];
                a < this._bufs.length;
                a++
              ) {
                if (!(c > (i = this._bufs[a].length - h))) {
                  this._bufs[a].copy(t, l, h, h + c), (l += i)
                  break
                }
                this._bufs[a].copy(t, l, h), (l += i), (c -= i), h && (h = 0)
              }
              return t.length > l ? t.slice(0, l) : t
            }),
            (a.prototype.shallowSlice = function (t, e) {
              if (
                ((t = t || 0),
                (e = 'number' != typeof e ? this.length : e),
                t < 0 && (t += this.length),
                e < 0 && (e += this.length),
                t === e)
              )
                return new a()
              var r = this._offset(t),
                n = this._offset(e),
                i = this._bufs.slice(r[0], n[0] + 1)
              return (
                0 == n[1]
                  ? i.pop()
                  : (i[i.length - 1] = i[i.length - 1].slice(0, n[1])),
                0 != r[1] && (i[0] = i[0].slice(r[1])),
                new a(i)
              )
            }),
            (a.prototype.toString = function (t, e, r) {
              return this.slice(e, r).toString(t)
            }),
            (a.prototype.consume = function (t) {
              if (((t = Math.trunc(t)), Number.isNaN(t) || t <= 0)) return this
              for (; this._bufs.length; ) {
                if (!(t >= this._bufs[0].length)) {
                  ;(this._bufs[0] = this._bufs[0].slice(t)), (this.length -= t)
                  break
                }
                ;(t -= this._bufs[0].length),
                  (this.length -= this._bufs[0].length),
                  this._bufs.shift()
              }
              return this
            }),
            (a.prototype.duplicate = function () {
              for (var t = 0, e = new a(); t < this._bufs.length; t++)
                e.append(this._bufs[t])
              return e
            }),
            (a.prototype.destroy = function () {
              ;(this._bufs.length = 0), (this.length = 0), this.push(null)
            }),
            (a.prototype.indexOf = function (t, e, r) {
              if (
                (void 0 === r &&
                  'string' == typeof e &&
                  ((r = e), (e = void 0)),
                'function' == typeof t || Array.isArray(t))
              )
                throw new TypeError(
                  'The "value" argument must be one of type string, Buffer, BufferList, or Uint8Array.'
                )
              if (
                ('number' == typeof t
                  ? (t = o.from([t]))
                  : 'string' == typeof t
                  ? (t = o.from(t, r))
                  : t instanceof a
                  ? (t = t.slice())
                  : o.isBuffer(t) || (t = o.from(t)),
                (e = Number(e || 0)),
                isNaN(e) && (e = 0),
                e < 0 && (e = this.length + e),
                e < 0 && (e = 0),
                0 === t.length)
              )
                return e > this.length ? this.length : e
              for (
                var n = this._offset(e), i = n[0], u = n[1];
                i < this._bufs.length;
                i++
              ) {
                for (var s = this._bufs[i]; u < s.length; ) {
                  if (s.length - u >= t.length) {
                    var f = s.indexOf(t, u)
                    if (-1 !== f) return this._reverseOffset([i, f])
                    u = s.length - t.length + 1
                  } else {
                    var c = this._reverseOffset([i, u])
                    if (this._match(c, t)) return c
                    u++
                  }
                }
                u = 0
              }
              return -1
            }),
            (a.prototype._match = function (t, e) {
              if (this.length - t < e.length) return !1
              for (var r = 0; r < e.length; r++)
                if (this.get(t + r) !== e[r]) return !1
              return !0
            }),
            (function () {
              var t = {
                readDoubleBE: 8,
                readDoubleLE: 8,
                readFloatBE: 4,
                readFloatLE: 4,
                readInt32BE: 4,
                readInt32LE: 4,
                readUInt32BE: 4,
                readUInt32LE: 4,
                readInt16BE: 2,
                readInt16LE: 2,
                readUInt16BE: 2,
                readUInt16LE: 2,
                readInt8: 1,
                readUInt8: 1,
                readIntBE: null,
                readIntLE: null,
                readUIntBE: null,
                readUIntLE: null
              }
              for (var e in t)
                !(function (e) {
                  a.prototype[e] =
                    null === t[e]
                      ? function (t, r) {
                          return this.slice(t, t + r)[e](0, r)
                        }
                      : function (r) {
                          return this.slice(r, r + t[e])[e](0)
                        }
                })(e)
            })(),
            (t.exports = a)
        },
        function (t, e, r) {
          ;(function (e) {
            void 0 === e ||
            !e.version ||
            0 === e.version.indexOf('v0.') ||
            (0 === e.version.indexOf('v1.') && 0 !== e.version.indexOf('v1.8.'))
              ? (t.exports = {
                  nextTick: function (t, r, n, i) {
                    if ('function' != typeof t)
                      throw new TypeError(
                        '"callback" argument must be a function'
                      )
                    var o,
                      a,
                      u = arguments.length
                    switch (u) {
                      case 0:
                      case 1:
                        return e.nextTick(t)
                      case 2:
                        return e.nextTick(function () {
                          t.call(null, r)
                        })
                      case 3:
                        return e.nextTick(function () {
                          t.call(null, r, n)
                        })
                      case 4:
                        return e.nextTick(function () {
                          t.call(null, r, n, i)
                        })
                      default:
                        for (o = new Array(u - 1), a = 0; a < o.length; )
                          o[a++] = arguments[a]
                        return e.nextTick(function () {
                          t.apply(null, o)
                        })
                    }
                  }
                })
              : (t.exports = e)
          }).call(this, r(6))
        },
        function (t, e, r) {
          var n = r(3),
            i = n.Buffer
          function o(t, e) {
            for (var r in t) e[r] = t[r]
          }
          function a(t, e, r) {
            return i(t, e, r)
          }
          i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow
            ? (t.exports = n)
            : (o(n, e), (e.Buffer = a)),
            (a.prototype = Object.create(i.prototype)),
            o(i, a),
            (a.from = function (t, e, r) {
              if ('number' == typeof t)
                throw new TypeError('Argument must not be a number')
              return i(t, e, r)
            }),
            (a.alloc = function (t, e, r) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              var n = i(t)
              return (
                void 0 !== e
                  ? 'string' == typeof r
                    ? n.fill(e, r)
                    : n.fill(e)
                  : n.fill(0),
                n
              )
            }),
            (a.allocUnsafe = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return i(t)
            }),
            (a.allocUnsafeSlow = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return n.SlowBuffer(t)
            })
        },
        function (t, e, r) {
          ;(function (t) {
            var n =
                Object.getOwnPropertyDescriptors ||
                function (t) {
                  for (var e = Object.keys(t), r = {}, n = 0; n < e.length; n++)
                    r[e[n]] = Object.getOwnPropertyDescriptor(t, e[n])
                  return r
                },
              i = /%[sdj%]/g
            ;(e.format = function (t) {
              if (!y(t)) {
                for (var e = [], r = 0; r < arguments.length; r++)
                  e.push(u(arguments[r]))
                return e.join(' ')
              }
              r = 1
              for (
                var n = arguments,
                  o = n.length,
                  a = String(t).replace(i, function (t) {
                    if ('%%' === t) return '%'
                    if (r >= o) return t
                    switch (t) {
                      case '%s':
                        return String(n[r++])
                      case '%d':
                        return Number(n[r++])
                      case '%j':
                        try {
                          return JSON.stringify(n[r++])
                        } catch (t) {
                          return '[Circular]'
                        }
                      default:
                        return t
                    }
                  }),
                  s = n[r];
                r < o;
                s = n[++r]
              )
                b(s) || !w(s) ? (a += ' ' + s) : (a += ' ' + u(s))
              return a
            }),
              (e.deprecate = function (r, n) {
                if (void 0 !== t && !0 === t.noDeprecation) return r
                if (void 0 === t)
                  return function () {
                    return e.deprecate(r, n).apply(this, arguments)
                  }
                var i = !1
                return function () {
                  if (!i) {
                    if (t.throwDeprecation) throw new Error(n)
                    t.traceDeprecation ? console.trace(n) : console.error(n),
                      (i = !0)
                  }
                  return r.apply(this, arguments)
                }
              })
            var o,
              a = {}
            function u(t, r) {
              var n = { seen: [], stylize: f }
              return (
                arguments.length >= 3 && (n.depth = arguments[2]),
                arguments.length >= 4 && (n.colors = arguments[3]),
                d(r) ? (n.showHidden = r) : r && e._extend(n, r),
                v(n.showHidden) && (n.showHidden = !1),
                v(n.depth) && (n.depth = 2),
                v(n.colors) && (n.colors = !1),
                v(n.customInspect) && (n.customInspect = !0),
                n.colors && (n.stylize = s),
                c(n, t, n.depth)
              )
            }
            function s(t, e) {
              var r = u.styles[e]
              return r
                ? '[' + u.colors[r][0] + 'm' + t + '[' + u.colors[r][1] + 'm'
                : t
            }
            function f(t, e) {
              return t
            }
            function c(t, r, n) {
              if (
                t.customInspect &&
                r &&
                x(r.inspect) &&
                r.inspect !== e.inspect &&
                (!r.constructor || r.constructor.prototype !== r)
              ) {
                var i = r.inspect(n, t)
                return y(i) || (i = c(t, i, n)), i
              }
              var o = (function (t, e) {
                if (v(e)) return t.stylize('undefined', 'undefined')
                if (y(e)) {
                  var r =
                    "'" +
                    JSON.stringify(e)
                      .replace(/^"|"$/g, '')
                      .replace(/'/g, "\\'")
                      .replace(/\\"/g, '"') +
                    "'"
                  return t.stylize(r, 'string')
                }
                if (g(e)) return t.stylize('' + e, 'number')
                if (d(e)) return t.stylize('' + e, 'boolean')
                if (b(e)) return t.stylize('null', 'null')
              })(t, r)
              if (o) return o
              var a = Object.keys(r),
                u = (function (t) {
                  var e = {}
                  return (
                    t.forEach(function (t, r) {
                      e[t] = !0
                    }),
                    e
                  )
                })(a)
              if (
                (t.showHidden && (a = Object.getOwnPropertyNames(r)),
                E(r) &&
                  (a.indexOf('message') >= 0 || a.indexOf('description') >= 0))
              )
                return l(r)
              if (0 === a.length) {
                if (x(r)) {
                  var s = r.name ? ': ' + r.name : ''
                  return t.stylize('[Function' + s + ']', 'special')
                }
                if (m(r))
                  return t.stylize(RegExp.prototype.toString.call(r), 'regexp')
                if (_(r))
                  return t.stylize(Date.prototype.toString.call(r), 'date')
                if (E(r)) return l(r)
              }
              var f,
                w = '',
                S = !1,
                k = ['{', '}']
              ;(p(r) && ((S = !0), (k = ['[', ']'])), x(r)) &&
                (w = ' [Function' + (r.name ? ': ' + r.name : '') + ']')
              return (
                m(r) && (w = ' ' + RegExp.prototype.toString.call(r)),
                _(r) && (w = ' ' + Date.prototype.toUTCString.call(r)),
                E(r) && (w = ' ' + l(r)),
                0 !== a.length || (S && 0 != r.length)
                  ? n < 0
                    ? m(r)
                      ? t.stylize(RegExp.prototype.toString.call(r), 'regexp')
                      : t.stylize('[Object]', 'special')
                    : (t.seen.push(r),
                      (f = S
                        ? (function (t, e, r, n, i) {
                            for (var o = [], a = 0, u = e.length; a < u; ++a)
                              T(e, String(a))
                                ? o.push(h(t, e, r, n, String(a), !0))
                                : o.push('')
                            return (
                              i.forEach(function (i) {
                                i.match(/^\d+$/) || o.push(h(t, e, r, n, i, !0))
                              }),
                              o
                            )
                          })(t, r, n, u, a)
                        : a.map(function (e) {
                            return h(t, r, n, u, e, S)
                          })),
                      t.seen.pop(),
                      (function (t, e, r) {
                        var n = t.reduce(function (t, e) {
                          return (
                            e.indexOf('\n') >= 0 && 0,
                            t + e.replace(/\u001b\[\d\d?m/g, '').length + 1
                          )
                        }, 0)
                        if (n > 60)
                          return (
                            r[0] +
                            ('' === e ? '' : e + '\n ') +
                            ' ' +
                            t.join(',\n  ') +
                            ' ' +
                            r[1]
                          )
                        return r[0] + e + ' ' + t.join(', ') + ' ' + r[1]
                      })(f, w, k))
                  : k[0] + w + k[1]
              )
            }
            function l(t) {
              return '[' + Error.prototype.toString.call(t) + ']'
            }
            function h(t, e, r, n, i, o) {
              var a, u, s
              if (
                ((s = Object.getOwnPropertyDescriptor(e, i) || { value: e[i] })
                  .get
                  ? (u = s.set
                      ? t.stylize('[Getter/Setter]', 'special')
                      : t.stylize('[Getter]', 'special'))
                  : s.set && (u = t.stylize('[Setter]', 'special')),
                T(n, i) || (a = '[' + i + ']'),
                u ||
                  (t.seen.indexOf(s.value) < 0
                    ? (u = b(r)
                        ? c(t, s.value, null)
                        : c(t, s.value, r - 1)).indexOf('\n') > -1 &&
                      (u = o
                        ? u
                            .split('\n')
                            .map(function (t) {
                              return '  ' + t
                            })
                            .join('\n')
                            .substr(2)
                        : '\n' +
                          u
                            .split('\n')
                            .map(function (t) {
                              return '   ' + t
                            })
                            .join('\n'))
                    : (u = t.stylize('[Circular]', 'special'))),
                v(a))
              ) {
                if (o && i.match(/^\d+$/)) return u
                ;(a = JSON.stringify('' + i)).match(
                  /^"([a-zA-Z_][a-zA-Z_0-9]*)"$/
                )
                  ? ((a = a.substr(1, a.length - 2)),
                    (a = t.stylize(a, 'name')))
                  : ((a = a
                      .replace(/'/g, "\\'")
                      .replace(/\\"/g, '"')
                      .replace(/(^"|"$)/g, "'")),
                    (a = t.stylize(a, 'string')))
              }
              return a + ': ' + u
            }
            function p(t) {
              return Array.isArray(t)
            }
            function d(t) {
              return 'boolean' == typeof t
            }
            function b(t) {
              return null === t
            }
            function g(t) {
              return 'number' == typeof t
            }
            function y(t) {
              return 'string' == typeof t
            }
            function v(t) {
              return void 0 === t
            }
            function m(t) {
              return w(t) && '[object RegExp]' === S(t)
            }
            function w(t) {
              return 'object' == typeof t && null !== t
            }
            function _(t) {
              return w(t) && '[object Date]' === S(t)
            }
            function E(t) {
              return w(t) && ('[object Error]' === S(t) || t instanceof Error)
            }
            function x(t) {
              return 'function' == typeof t
            }
            function S(t) {
              return Object.prototype.toString.call(t)
            }
            function k(t) {
              return t < 10 ? '0' + t.toString(10) : t.toString(10)
            }
            ;(e.debuglog = function (r) {
              if (
                (v(o) && (o = t.env.NODE_DEBUG || ''),
                (r = r.toUpperCase()),
                !a[r])
              )
                if (new RegExp('\\b' + r + '\\b', 'i').test(o)) {
                  var n = t.pid
                  a[r] = function () {
                    var t = e.format.apply(e, arguments)
                    console.error('%s %d: %s', r, n, t)
                  }
                } else a[r] = function () {}
              return a[r]
            }),
              (e.inspect = u),
              (u.colors = {
                bold: [1, 22],
                italic: [3, 23],
                underline: [4, 24],
                inverse: [7, 27],
                white: [37, 39],
                grey: [90, 39],
                black: [30, 39],
                blue: [34, 39],
                cyan: [36, 39],
                green: [32, 39],
                magenta: [35, 39],
                red: [31, 39],
                yellow: [33, 39]
              }),
              (u.styles = {
                special: 'cyan',
                number: 'yellow',
                boolean: 'yellow',
                undefined: 'grey',
                null: 'bold',
                string: 'green',
                date: 'magenta',
                regexp: 'red'
              }),
              (e.isArray = p),
              (e.isBoolean = d),
              (e.isNull = b),
              (e.isNullOrUndefined = function (t) {
                return null == t
              }),
              (e.isNumber = g),
              (e.isString = y),
              (e.isSymbol = function (t) {
                return 'symbol' == typeof t
              }),
              (e.isUndefined = v),
              (e.isRegExp = m),
              (e.isObject = w),
              (e.isDate = _),
              (e.isError = E),
              (e.isFunction = x),
              (e.isPrimitive = function (t) {
                return (
                  null === t ||
                  'boolean' == typeof t ||
                  'number' == typeof t ||
                  'string' == typeof t ||
                  'symbol' == typeof t ||
                  void 0 === t
                )
              }),
              (e.isBuffer = r(33))
            var A = [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec'
            ]
            function T(t, e) {
              return Object.prototype.hasOwnProperty.call(t, e)
            }
            ;(e.log = function () {
              var t, r
              console.log(
                '%s - %s',
                ((t = new Date()),
                (r = [
                  k(t.getHours()),
                  k(t.getMinutes()),
                  k(t.getSeconds())
                ].join(':')),
                [t.getDate(), A[t.getMonth()], r].join(' ')),
                e.format.apply(e, arguments)
              )
            }),
              (e.inherits = r(34)),
              (e._extend = function (t, e) {
                if (!e || !w(e)) return t
                for (var r = Object.keys(e), n = r.length; n--; )
                  t[r[n]] = e[r[n]]
                return t
              })
            var O =
              'undefined' != typeof Symbol
                ? Symbol('util.promisify.custom')
                : void 0
            function j(t, e) {
              if (!t) {
                var r = new Error('Promise was rejected with a falsy value')
                ;(r.reason = t), (t = r)
              }
              return e(t)
            }
            ;(e.promisify = function (t) {
              if ('function' != typeof t)
                throw new TypeError(
                  'The "original" argument must be of type Function'
                )
              if (O && t[O]) {
                var e
                if ('function' != typeof (e = t[O]))
                  throw new TypeError(
                    'The "util.promisify.custom" argument must be of type Function'
                  )
                return (
                  Object.defineProperty(e, O, {
                    value: e,
                    enumerable: !1,
                    writable: !1,
                    configurable: !0
                  }),
                  e
                )
              }
              function e() {
                for (
                  var e,
                    r,
                    n = new Promise(function (t, n) {
                      ;(e = t), (r = n)
                    }),
                    i = [],
                    o = 0;
                  o < arguments.length;
                  o++
                )
                  i.push(arguments[o])
                i.push(function (t, n) {
                  t ? r(t) : e(n)
                })
                try {
                  t.apply(this, i)
                } catch (t) {
                  r(t)
                }
                return n
              }
              return (
                Object.setPrototypeOf(e, Object.getPrototypeOf(t)),
                O &&
                  Object.defineProperty(e, O, {
                    value: e,
                    enumerable: !1,
                    writable: !1,
                    configurable: !0
                  }),
                Object.defineProperties(e, n(t))
              )
            }),
              (e.promisify.custom = O),
              (e.callbackify = function (e) {
                if ('function' != typeof e)
                  throw new TypeError(
                    'The "original" argument must be of type Function'
                  )
                function r() {
                  for (var r = [], n = 0; n < arguments.length; n++)
                    r.push(arguments[n])
                  var i = r.pop()
                  if ('function' != typeof i)
                    throw new TypeError(
                      'The last argument must be of type Function'
                    )
                  var o = this,
                    a = function () {
                      return i.apply(o, arguments)
                    }
                  e.apply(this, r).then(
                    function (e) {
                      t.nextTick(a, null, e)
                    },
                    function (e) {
                      t.nextTick(j, e, a)
                    }
                  )
                }
                return (
                  Object.setPrototypeOf(r, Object.getPrototypeOf(e)),
                  Object.defineProperties(r, n(e)),
                  r
                )
              })
          }).call(this, r(6))
        },
        function (t, e, r) {
          var n = r(3),
            i = n.Buffer
          function o(t, e) {
            for (var r in t) e[r] = t[r]
          }
          function a(t, e, r) {
            return i(t, e, r)
          }
          i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow
            ? (t.exports = n)
            : (o(n, e), (e.Buffer = a)),
            o(i, a),
            (a.from = function (t, e, r) {
              if ('number' == typeof t)
                throw new TypeError('Argument must not be a number')
              return i(t, e, r)
            }),
            (a.alloc = function (t, e, r) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              var n = i(t)
              return (
                void 0 !== e
                  ? 'string' == typeof r
                    ? n.fill(e, r)
                    : n.fill(e)
                  : n.fill(0),
                n
              )
            }),
            (a.allocUnsafe = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return i(t)
            }),
            (a.allocUnsafeSlow = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return n.SlowBuffer(t)
            })
        },
        function (t, e) {
          var r = {}.toString
          t.exports =
            Array.isArray ||
            function (t) {
              return '[object Array]' == r.call(t)
            }
        },
        function (t, e, r) {
          ;((e = t.exports = r(15)).Stream = e),
            (e.Readable = e),
            (e.Writable = r(19)),
            (e.Duplex = r(5)),
            (e.Transform = r(22)),
            (e.PassThrough = r(41))
        },
        function (t, e, r) {
          ;(function (e) {
            var n = r(9)
            t.exports = v
            var i,
              o = r(13)
            v.ReadableState = y
            r(16).EventEmitter
            var a = function (t, e) {
                return t.listeners(e).length
              },
              u = r(17),
              s = r(12).Buffer,
              f = window.Uint8Array || function () {}
            var c = Object.create(r(7))
            c.inherits = r(4)
            var l = r(35),
              h = void 0
            h = l && l.debuglog ? l.debuglog('stream') : function () {}
            var p,
              d = r(36),
              b = r(18)
            c.inherits(v, u)
            var g = ['error', 'close', 'destroy', 'pause', 'resume']
            function y(t, e) {
              t = t || {}
              var n = e instanceof (i = i || r(5))
              ;(this.objectMode = !!t.objectMode),
                n &&
                  (this.objectMode = this.objectMode || !!t.readableObjectMode)
              var o = t.highWaterMark,
                a = t.readableHighWaterMark,
                u = this.objectMode ? 16 : 16384
              ;(this.highWaterMark =
                o || 0 === o ? o : n && (a || 0 === a) ? a : u),
                (this.highWaterMark = Math.floor(this.highWaterMark)),
                (this.buffer = new d()),
                (this.length = 0),
                (this.pipes = null),
                (this.pipesCount = 0),
                (this.flowing = null),
                (this.ended = !1),
                (this.endEmitted = !1),
                (this.reading = !1),
                (this.sync = !0),
                (this.needReadable = !1),
                (this.emittedReadable = !1),
                (this.readableListening = !1),
                (this.resumeScheduled = !1),
                (this.destroyed = !1),
                (this.defaultEncoding = t.defaultEncoding || 'utf8'),
                (this.awaitDrain = 0),
                (this.readingMore = !1),
                (this.decoder = null),
                (this.encoding = null),
                t.encoding &&
                  (p || (p = r(21).StringDecoder),
                  (this.decoder = new p(t.encoding)),
                  (this.encoding = t.encoding))
            }
            function v(t) {
              if (((i = i || r(5)), !(this instanceof v))) return new v(t)
              ;(this._readableState = new y(t, this)),
                (this.readable = !0),
                t &&
                  ('function' == typeof t.read && (this._read = t.read),
                  'function' == typeof t.destroy &&
                    (this._destroy = t.destroy)),
                u.call(this)
            }
            function m(t, e, r, n, i) {
              var o,
                a = t._readableState
              null === e
                ? ((a.reading = !1),
                  (function (t, e) {
                    if (e.ended) return
                    if (e.decoder) {
                      var r = e.decoder.end()
                      r &&
                        r.length &&
                        (e.buffer.push(r),
                        (e.length += e.objectMode ? 1 : r.length))
                    }
                    ;(e.ended = !0), x(t)
                  })(t, a))
                : (i ||
                    (o = (function (t, e) {
                      var r
                      ;(n = e),
                        s.isBuffer(n) ||
                          n instanceof f ||
                          'string' == typeof e ||
                          void 0 === e ||
                          t.objectMode ||
                          (r = new TypeError('Invalid non-string/buffer chunk'))
                      var n
                      return r
                    })(a, e)),
                  o
                    ? t.emit('error', o)
                    : a.objectMode || (e && e.length > 0)
                    ? ('string' == typeof e ||
                        a.objectMode ||
                        Object.getPrototypeOf(e) === s.prototype ||
                        (e = (function (t) {
                          return s.from(t)
                        })(e)),
                      n
                        ? a.endEmitted
                          ? t.emit(
                              'error',
                              new Error('stream.unshift() after end event')
                            )
                          : w(t, a, e, !0)
                        : a.ended
                        ? t.emit('error', new Error('stream.push() after EOF'))
                        : ((a.reading = !1),
                          a.decoder && !r
                            ? ((e = a.decoder.write(e)),
                              a.objectMode || 0 !== e.length
                                ? w(t, a, e, !1)
                                : k(t, a))
                            : w(t, a, e, !1)))
                    : n || (a.reading = !1))
              return (function (t) {
                return (
                  !t.ended &&
                  (t.needReadable ||
                    t.length < t.highWaterMark ||
                    0 === t.length)
                )
              })(a)
            }
            function w(t, e, r, n) {
              e.flowing && 0 === e.length && !e.sync
                ? (t.emit('data', r), t.read(0))
                : ((e.length += e.objectMode ? 1 : r.length),
                  n ? e.buffer.unshift(r) : e.buffer.push(r),
                  e.needReadable && x(t)),
                k(t, e)
            }
            Object.defineProperty(v.prototype, 'destroyed', {
              get: function () {
                return (
                  void 0 !== this._readableState &&
                  this._readableState.destroyed
                )
              },
              set: function (t) {
                this._readableState && (this._readableState.destroyed = t)
              }
            }),
              (v.prototype.destroy = b.destroy),
              (v.prototype._undestroy = b.undestroy),
              (v.prototype._destroy = function (t, e) {
                this.push(null), e(t)
              }),
              (v.prototype.push = function (t, e) {
                var r,
                  n = this._readableState
                return (
                  n.objectMode
                    ? (r = !0)
                    : 'string' == typeof t &&
                      ((e = e || n.defaultEncoding) !== n.encoding &&
                        ((t = s.from(t, e)), (e = '')),
                      (r = !0)),
                  m(this, t, e, !1, r)
                )
              }),
              (v.prototype.unshift = function (t) {
                return m(this, t, null, !0, !1)
              }),
              (v.prototype.isPaused = function () {
                return !1 === this._readableState.flowing
              }),
              (v.prototype.setEncoding = function (t) {
                return (
                  p || (p = r(21).StringDecoder),
                  (this._readableState.decoder = new p(t)),
                  (this._readableState.encoding = t),
                  this
                )
              })
            var _ = 8388608
            function E(t, e) {
              return t <= 0 || (0 === e.length && e.ended)
                ? 0
                : e.objectMode
                ? 1
                : t != t
                ? e.flowing && e.length
                  ? e.buffer.head.data.length
                  : e.length
                : (t > e.highWaterMark &&
                    (e.highWaterMark = (function (t) {
                      return (
                        t >= _
                          ? (t = _)
                          : (t--,
                            (t |= t >>> 1),
                            (t |= t >>> 2),
                            (t |= t >>> 4),
                            (t |= t >>> 8),
                            (t |= t >>> 16),
                            t++),
                        t
                      )
                    })(t)),
                  t <= e.length
                    ? t
                    : e.ended
                    ? e.length
                    : ((e.needReadable = !0), 0))
            }
            function x(t) {
              var e = t._readableState
              ;(e.needReadable = !1),
                e.emittedReadable ||
                  (h('emitReadable', e.flowing),
                  (e.emittedReadable = !0),
                  e.sync ? n.nextTick(S, t) : S(t))
            }
            function S(t) {
              h('emit readable'), t.emit('readable'), j(t)
            }
            function k(t, e) {
              e.readingMore || ((e.readingMore = !0), n.nextTick(A, t, e))
            }
            function A(t, e) {
              for (
                var r = e.length;
                !e.reading &&
                !e.flowing &&
                !e.ended &&
                e.length < e.highWaterMark &&
                (h('maybeReadMore read 0'), t.read(0), r !== e.length);

              )
                r = e.length
              e.readingMore = !1
            }
            function T(t) {
              h('readable nexttick read 0'), t.read(0)
            }
            function O(t, e) {
              e.reading || (h('resume read 0'), t.read(0)),
                (e.resumeScheduled = !1),
                (e.awaitDrain = 0),
                t.emit('resume'),
                j(t),
                e.flowing && !e.reading && t.read(0)
            }
            function j(t) {
              var e = t._readableState
              for (h('flow', e.flowing); e.flowing && null !== t.read(); );
            }
            function U(t, e) {
              return 0 === e.length
                ? null
                : (e.objectMode
                    ? (r = e.buffer.shift())
                    : !t || t >= e.length
                    ? ((r = e.decoder
                        ? e.buffer.join('')
                        : 1 === e.buffer.length
                        ? e.buffer.head.data
                        : e.buffer.concat(e.length)),
                      e.buffer.clear())
                    : (r = (function (t, e, r) {
                        var n
                        t < e.head.data.length
                          ? ((n = e.head.data.slice(0, t)),
                            (e.head.data = e.head.data.slice(t)))
                          : (n =
                              t === e.head.data.length
                                ? e.shift()
                                : r
                                ? (function (t, e) {
                                    var r = e.head,
                                      n = 1,
                                      i = r.data
                                    t -= i.length
                                    for (; (r = r.next); ) {
                                      var o = r.data,
                                        a = t > o.length ? o.length : t
                                      if (
                                        (a === o.length
                                          ? (i += o)
                                          : (i += o.slice(0, t)),
                                        0 === (t -= a))
                                      ) {
                                        a === o.length
                                          ? (++n,
                                            r.next
                                              ? (e.head = r.next)
                                              : (e.head = e.tail = null))
                                          : ((e.head = r),
                                            (r.data = o.slice(a)))
                                        break
                                      }
                                      ++n
                                    }
                                    return (e.length -= n), i
                                  })(t, e)
                                : (function (t, e) {
                                    var r = s.allocUnsafe(t),
                                      n = e.head,
                                      i = 1
                                    n.data.copy(r), (t -= n.data.length)
                                    for (; (n = n.next); ) {
                                      var o = n.data,
                                        a = t > o.length ? o.length : t
                                      if (
                                        (o.copy(r, r.length - t, 0, a),
                                        0 === (t -= a))
                                      ) {
                                        a === o.length
                                          ? (++i,
                                            n.next
                                              ? (e.head = n.next)
                                              : (e.head = e.tail = null))
                                          : ((e.head = n),
                                            (n.data = o.slice(a)))
                                        break
                                      }
                                      ++i
                                    }
                                    return (e.length -= i), r
                                  })(t, e))
                        return n
                      })(t, e.buffer, e.decoder)),
                  r)
              var r
            }
            function B(t) {
              var e = t._readableState
              if (e.length > 0)
                throw new Error('"endReadable()" called on non-empty stream')
              e.endEmitted || ((e.ended = !0), n.nextTick(M, e, t))
            }
            function M(t, e) {
              t.endEmitted ||
                0 !== t.length ||
                ((t.endEmitted = !0), (e.readable = !1), e.emit('end'))
            }
            function L(t, e) {
              for (var r = 0, n = t.length; r < n; r++) if (t[r] === e) return r
              return -1
            }
            ;(v.prototype.read = function (t) {
              h('read', t), (t = parseInt(t, 10))
              var e = this._readableState,
                r = t
              if (
                (0 !== t && (e.emittedReadable = !1),
                0 === t &&
                  e.needReadable &&
                  (e.length >= e.highWaterMark || e.ended))
              )
                return (
                  h('read: emitReadable', e.length, e.ended),
                  0 === e.length && e.ended ? B(this) : x(this),
                  null
                )
              if (0 === (t = E(t, e)) && e.ended)
                return 0 === e.length && B(this), null
              var n,
                i = e.needReadable
              return (
                h('need readable', i),
                (0 === e.length || e.length - t < e.highWaterMark) &&
                  h('length less than watermark', (i = !0)),
                e.ended || e.reading
                  ? h('reading or ended', (i = !1))
                  : i &&
                    (h('do read'),
                    (e.reading = !0),
                    (e.sync = !0),
                    0 === e.length && (e.needReadable = !0),
                    this._read(e.highWaterMark),
                    (e.sync = !1),
                    e.reading || (t = E(r, e))),
                null === (n = t > 0 ? U(t, e) : null)
                  ? ((e.needReadable = !0), (t = 0))
                  : (e.length -= t),
                0 === e.length &&
                  (e.ended || (e.needReadable = !0),
                  r !== t && e.ended && B(this)),
                null !== n && this.emit('data', n),
                n
              )
            }),
              (v.prototype._read = function (t) {
                this.emit('error', new Error('_read() is not implemented'))
              }),
              (v.prototype.pipe = function (t, r) {
                var i = this,
                  u = this._readableState
                switch (u.pipesCount) {
                  case 0:
                    u.pipes = t
                    break
                  case 1:
                    u.pipes = [u.pipes, t]
                    break
                  default:
                    u.pipes.push(t)
                }
                ;(u.pipesCount += 1),
                  h('pipe count=%d opts=%j', u.pipesCount, r)
                var s =
                  (!r || !1 !== r.end) && t !== e.stdout && t !== e.stderr
                    ? c
                    : m
                function f(e, r) {
                  h('onunpipe'),
                    e === i &&
                      r &&
                      !1 === r.hasUnpiped &&
                      ((r.hasUnpiped = !0),
                      h('cleanup'),
                      t.removeListener('close', y),
                      t.removeListener('finish', v),
                      t.removeListener('drain', l),
                      t.removeListener('error', g),
                      t.removeListener('unpipe', f),
                      i.removeListener('end', c),
                      i.removeListener('end', m),
                      i.removeListener('data', b),
                      (p = !0),
                      !u.awaitDrain ||
                        (t._writableState && !t._writableState.needDrain) ||
                        l())
                }
                function c() {
                  h('onend'), t.end()
                }
                u.endEmitted ? n.nextTick(s) : i.once('end', s),
                  t.on('unpipe', f)
                var l = (function (t) {
                  return function () {
                    var e = t._readableState
                    h('pipeOnDrain', e.awaitDrain),
                      e.awaitDrain && e.awaitDrain--,
                      0 === e.awaitDrain &&
                        a(t, 'data') &&
                        ((e.flowing = !0), j(t))
                  }
                })(i)
                t.on('drain', l)
                var p = !1
                var d = !1
                function b(e) {
                  h('ondata'),
                    (d = !1),
                    !1 !== t.write(e) ||
                      d ||
                      (((1 === u.pipesCount && u.pipes === t) ||
                        (u.pipesCount > 1 && -1 !== L(u.pipes, t))) &&
                        !p &&
                        (h(
                          'false write response, pause',
                          i._readableState.awaitDrain
                        ),
                        i._readableState.awaitDrain++,
                        (d = !0)),
                      i.pause())
                }
                function g(e) {
                  h('onerror', e),
                    m(),
                    t.removeListener('error', g),
                    0 === a(t, 'error') && t.emit('error', e)
                }
                function y() {
                  t.removeListener('finish', v), m()
                }
                function v() {
                  h('onfinish'), t.removeListener('close', y), m()
                }
                function m() {
                  h('unpipe'), i.unpipe(t)
                }
                return (
                  i.on('data', b),
                  (function (t, e, r) {
                    if ('function' == typeof t.prependListener)
                      return t.prependListener(e, r)
                    t._events && t._events[e]
                      ? o(t._events[e])
                        ? t._events[e].unshift(r)
                        : (t._events[e] = [r, t._events[e]])
                      : t.on(e, r)
                  })(t, 'error', g),
                  t.once('close', y),
                  t.once('finish', v),
                  t.emit('pipe', i),
                  u.flowing || (h('pipe resume'), i.resume()),
                  t
                )
              }),
              (v.prototype.unpipe = function (t) {
                var e = this._readableState,
                  r = { hasUnpiped: !1 }
                if (0 === e.pipesCount) return this
                if (1 === e.pipesCount)
                  return (
                    (t && t !== e.pipes) ||
                      (t || (t = e.pipes),
                      (e.pipes = null),
                      (e.pipesCount = 0),
                      (e.flowing = !1),
                      t && t.emit('unpipe', this, r)),
                    this
                  )
                if (!t) {
                  var n = e.pipes,
                    i = e.pipesCount
                  ;(e.pipes = null), (e.pipesCount = 0), (e.flowing = !1)
                  for (var o = 0; o < i; o++) n[o].emit('unpipe', this, r)
                  return this
                }
                var a = L(e.pipes, t)
                return (
                  -1 === a ||
                    (e.pipes.splice(a, 1),
                    (e.pipesCount -= 1),
                    1 === e.pipesCount && (e.pipes = e.pipes[0]),
                    t.emit('unpipe', this, r)),
                  this
                )
              }),
              (v.prototype.on = function (t, e) {
                var r = u.prototype.on.call(this, t, e)
                if ('data' === t)
                  !1 !== this._readableState.flowing && this.resume()
                else if ('readable' === t) {
                  var i = this._readableState
                  i.endEmitted ||
                    i.readableListening ||
                    ((i.readableListening = i.needReadable = !0),
                    (i.emittedReadable = !1),
                    i.reading ? i.length && x(this) : n.nextTick(T, this))
                }
                return r
              }),
              (v.prototype.addListener = v.prototype.on),
              (v.prototype.resume = function () {
                var t = this._readableState
                return (
                  t.flowing ||
                    (h('resume'),
                    (t.flowing = !0),
                    (function (t, e) {
                      e.resumeScheduled ||
                        ((e.resumeScheduled = !0), n.nextTick(O, t, e))
                    })(this, t)),
                  this
                )
              }),
              (v.prototype.pause = function () {
                return (
                  h('call pause flowing=%j', this._readableState.flowing),
                  !1 !== this._readableState.flowing &&
                    (h('pause'),
                    (this._readableState.flowing = !1),
                    this.emit('pause')),
                  this
                )
              }),
              (v.prototype.wrap = function (t) {
                var e = this,
                  r = this._readableState,
                  n = !1
                for (var i in (t.on('end', function () {
                  if ((h('wrapped end'), r.decoder && !r.ended)) {
                    var t = r.decoder.end()
                    t && t.length && e.push(t)
                  }
                  e.push(null)
                }),
                t.on('data', function (i) {
                  ;(h('wrapped data'),
                  r.decoder && (i = r.decoder.write(i)),
                  r.objectMode && null == i) ||
                    ((r.objectMode || (i && i.length)) &&
                      (e.push(i) || ((n = !0), t.pause())))
                }),
                t))
                  void 0 === this[i] &&
                    'function' == typeof t[i] &&
                    (this[i] = (function (e) {
                      return function () {
                        return t[e].apply(t, arguments)
                      }
                    })(i))
                for (var o = 0; o < g.length; o++)
                  t.on(g[o], this.emit.bind(this, g[o]))
                return (
                  (this._read = function (e) {
                    h('wrapped _read', e), n && ((n = !1), t.resume())
                  }),
                  this
                )
              }),
              Object.defineProperty(v.prototype, 'readableHighWaterMark', {
                enumerable: !1,
                get: function () {
                  return this._readableState.highWaterMark
                }
              }),
              (v._fromList = U)
          }).call(this, r(6))
        },
        function (t, e, r) {
          var n,
            i = 'object' == typeof Reflect ? Reflect : null,
            o =
              i && 'function' == typeof i.apply
                ? i.apply
                : function (t, e, r) {
                    return Function.prototype.apply.call(t, e, r)
                  }
          n =
            i && 'function' == typeof i.ownKeys
              ? i.ownKeys
              : Object.getOwnPropertySymbols
              ? function (t) {
                  return Object.getOwnPropertyNames(t).concat(
                    Object.getOwnPropertySymbols(t)
                  )
                }
              : function (t) {
                  return Object.getOwnPropertyNames(t)
                }
          var a =
            Number.isNaN ||
            function (t) {
              return t != t
            }
          function u() {
            u.init.call(this)
          }
          ;(t.exports = u),
            (t.exports.once = function (t, e) {
              return new Promise(function (r, n) {
                function i(r) {
                  t.removeListener(e, o), n(r)
                }
                function o() {
                  'function' == typeof t.removeListener &&
                    t.removeListener('error', i),
                    r([].slice.call(arguments))
                }
                y(t, e, o, { once: !0 }),
                  'error' !== e &&
                    (function (t, e, r) {
                      'function' == typeof t.on && y(t, 'error', e, r)
                    })(t, i, { once: !0 })
              })
            }),
            (u.EventEmitter = u),
            (u.prototype._events = void 0),
            (u.prototype._eventsCount = 0),
            (u.prototype._maxListeners = void 0)
          var s = 10
          function f(t) {
            if ('function' != typeof t)
              throw new TypeError(
                'The "listener" argument must be of type Function. Received type ' +
                  typeof t
              )
          }
          function c(t) {
            return void 0 === t._maxListeners
              ? u.defaultMaxListeners
              : t._maxListeners
          }
          function l(t, e, r, n) {
            var i, o, a, u
            if (
              (f(r),
              void 0 === (o = t._events)
                ? ((o = t._events = Object.create(null)), (t._eventsCount = 0))
                : (void 0 !== o.newListener &&
                    (t.emit('newListener', e, r.listener ? r.listener : r),
                    (o = t._events)),
                  (a = o[e])),
              void 0 === a)
            )
              (a = o[e] = r), ++t._eventsCount
            else if (
              ('function' == typeof a
                ? (a = o[e] = n ? [r, a] : [a, r])
                : n
                ? a.unshift(r)
                : a.push(r),
              (i = c(t)) > 0 && a.length > i && !a.warned)
            ) {
              a.warned = !0
              var s = new Error(
                'Possible EventEmitter memory leak detected. ' +
                  a.length +
                  ' ' +
                  String(e) +
                  ' listeners added. Use emitter.setMaxListeners() to increase limit'
              )
              ;(s.name = 'MaxListenersExceededWarning'),
                (s.emitter = t),
                (s.type = e),
                (s.count = a.length),
                (u = s),
                console && console.warn && console.warn(u)
            }
            return t
          }
          function h() {
            if (!this.fired)
              return (
                this.target.removeListener(this.type, this.wrapFn),
                (this.fired = !0),
                0 === arguments.length
                  ? this.listener.call(this.target)
                  : this.listener.apply(this.target, arguments)
              )
          }
          function p(t, e, r) {
            var n = {
                fired: !1,
                wrapFn: void 0,
                target: t,
                type: e,
                listener: r
              },
              i = h.bind(n)
            return (i.listener = r), (n.wrapFn = i), i
          }
          function d(t, e, r) {
            var n = t._events
            if (void 0 === n) return []
            var i = n[e]
            return void 0 === i
              ? []
              : 'function' == typeof i
              ? r
                ? [i.listener || i]
                : [i]
              : r
              ? (function (t) {
                  for (var e = new Array(t.length), r = 0; r < e.length; ++r)
                    e[r] = t[r].listener || t[r]
                  return e
                })(i)
              : g(i, i.length)
          }
          function b(t) {
            var e = this._events
            if (void 0 !== e) {
              var r = e[t]
              if ('function' == typeof r) return 1
              if (void 0 !== r) return r.length
            }
            return 0
          }
          function g(t, e) {
            for (var r = new Array(e), n = 0; n < e; ++n) r[n] = t[n]
            return r
          }
          function y(t, e, r, n) {
            if ('function' == typeof t.on) n.once ? t.once(e, r) : t.on(e, r)
            else {
              if ('function' != typeof t.addEventListener)
                throw new TypeError(
                  'The "emitter" argument must be of type EventEmitter. Received type ' +
                    typeof t
                )
              t.addEventListener(e, function i(o) {
                n.once && t.removeEventListener(e, i), r(o)
              })
            }
          }
          Object.defineProperty(u, 'defaultMaxListeners', {
            enumerable: !0,
            get: function () {
              return s
            },
            set: function (t) {
              if ('number' != typeof t || t < 0 || a(t))
                throw new RangeError(
                  'The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' +
                    t +
                    '.'
                )
              s = t
            }
          }),
            (u.init = function () {
              ;(void 0 !== this._events &&
                this._events !== Object.getPrototypeOf(this)._events) ||
                ((this._events = Object.create(null)), (this._eventsCount = 0)),
                (this._maxListeners = this._maxListeners || void 0)
            }),
            (u.prototype.setMaxListeners = function (t) {
              if ('number' != typeof t || t < 0 || a(t))
                throw new RangeError(
                  'The value of "n" is out of range. It must be a non-negative number. Received ' +
                    t +
                    '.'
                )
              return (this._maxListeners = t), this
            }),
            (u.prototype.getMaxListeners = function () {
              return c(this)
            }),
            (u.prototype.emit = function (t) {
              for (var e = [], r = 1; r < arguments.length; r++)
                e.push(arguments[r])
              var n = 'error' === t,
                i = this._events
              if (void 0 !== i) n = n && void 0 === i.error
              else if (!n) return !1
              if (n) {
                var a
                if ((e.length > 0 && (a = e[0]), a instanceof Error)) throw a
                var u = new Error(
                  'Unhandled error.' + (a ? ' (' + a.message + ')' : '')
                )
                throw ((u.context = a), u)
              }
              var s = i[t]
              if (void 0 === s) return !1
              if ('function' == typeof s) o(s, this, e)
              else {
                var f = s.length,
                  c = g(s, f)
                for (r = 0; r < f; ++r) o(c[r], this, e)
              }
              return !0
            }),
            (u.prototype.addListener = function (t, e) {
              return l(this, t, e, !1)
            }),
            (u.prototype.on = u.prototype.addListener),
            (u.prototype.prependListener = function (t, e) {
              return l(this, t, e, !0)
            }),
            (u.prototype.once = function (t, e) {
              return f(e), this.on(t, p(this, t, e)), this
            }),
            (u.prototype.prependOnceListener = function (t, e) {
              return f(e), this.prependListener(t, p(this, t, e)), this
            }),
            (u.prototype.removeListener = function (t, e) {
              var r, n, i, o, a
              if ((f(e), void 0 === (n = this._events))) return this
              if (void 0 === (r = n[t])) return this
              if (r === e || r.listener === e)
                0 == --this._eventsCount
                  ? (this._events = Object.create(null))
                  : (delete n[t],
                    n.removeListener &&
                      this.emit('removeListener', t, r.listener || e))
              else if ('function' != typeof r) {
                for (i = -1, o = r.length - 1; o >= 0; o--)
                  if (r[o] === e || r[o].listener === e) {
                    ;(a = r[o].listener), (i = o)
                    break
                  }
                if (i < 0) return this
                0 === i
                  ? r.shift()
                  : (function (t, e) {
                      for (; e + 1 < t.length; e++) t[e] = t[e + 1]
                      t.pop()
                    })(r, i),
                  1 === r.length && (n[t] = r[0]),
                  void 0 !== n.removeListener &&
                    this.emit('removeListener', t, a || e)
              }
              return this
            }),
            (u.prototype.off = u.prototype.removeListener),
            (u.prototype.removeAllListeners = function (t) {
              var e, r, n
              if (void 0 === (r = this._events)) return this
              if (void 0 === r.removeListener)
                return (
                  0 === arguments.length
                    ? ((this._events = Object.create(null)),
                      (this._eventsCount = 0))
                    : void 0 !== r[t] &&
                      (0 == --this._eventsCount
                        ? (this._events = Object.create(null))
                        : delete r[t]),
                  this
                )
              if (0 === arguments.length) {
                var i,
                  o = Object.keys(r)
                for (n = 0; n < o.length; ++n)
                  'removeListener' !== (i = o[n]) && this.removeAllListeners(i)
                return (
                  this.removeAllListeners('removeListener'),
                  (this._events = Object.create(null)),
                  (this._eventsCount = 0),
                  this
                )
              }
              if ('function' == typeof (e = r[t])) this.removeListener(t, e)
              else if (void 0 !== e)
                for (n = e.length - 1; n >= 0; n--) this.removeListener(t, e[n])
              return this
            }),
            (u.prototype.listeners = function (t) {
              return d(this, t, !0)
            }),
            (u.prototype.rawListeners = function (t) {
              return d(this, t, !1)
            }),
            (u.listenerCount = function (t, e) {
              return 'function' == typeof t.listenerCount
                ? t.listenerCount(e)
                : b.call(t, e)
            }),
            (u.prototype.listenerCount = b),
            (u.prototype.eventNames = function () {
              return this._eventsCount > 0 ? n(this._events) : []
            })
        },
        function (t, e, r) {
          t.exports = r(16).EventEmitter
        },
        function (t, e, r) {
          var n = r(9)
          function i(t, e) {
            t.emit('error', e)
          }
          t.exports = {
            destroy: function (t, e) {
              var r = this,
                o = this._readableState && this._readableState.destroyed,
                a = this._writableState && this._writableState.destroyed
              return o || a
                ? (e
                    ? e(t)
                    : !t ||
                      (this._writableState &&
                        this._writableState.errorEmitted) ||
                      n.nextTick(i, this, t),
                  this)
                : (this._readableState && (this._readableState.destroyed = !0),
                  this._writableState && (this._writableState.destroyed = !0),
                  this._destroy(t || null, function (t) {
                    !e && t
                      ? (n.nextTick(i, r, t),
                        r._writableState &&
                          (r._writableState.errorEmitted = !0))
                      : e && e(t)
                  }),
                  this)
            },
            undestroy: function () {
              this._readableState &&
                ((this._readableState.destroyed = !1),
                (this._readableState.reading = !1),
                (this._readableState.ended = !1),
                (this._readableState.endEmitted = !1)),
                this._writableState &&
                  ((this._writableState.destroyed = !1),
                  (this._writableState.ended = !1),
                  (this._writableState.ending = !1),
                  (this._writableState.finished = !1),
                  (this._writableState.errorEmitted = !1))
            }
          }
        },
        function (t, e, r) {
          ;(function (e, n) {
            var i = r(9)
            function o(t) {
              var e = this
              ;(this.next = null),
                (this.entry = null),
                (this.finish = function () {
                  !(function (t, e, r) {
                    var n = t.entry
                    t.entry = null
                    for (; n; ) {
                      var i = n.callback
                      e.pendingcb--, i(r), (n = n.next)
                    }
                    e.corkedRequestsFree
                      ? (e.corkedRequestsFree.next = t)
                      : (e.corkedRequestsFree = t)
                  })(e, t)
                })
            }
            t.exports = y
            var a,
              u =
                !e.browser &&
                ['v0.10', 'v0.9.'].indexOf(e.version.slice(0, 5)) > -1
                  ? n
                  : i.nextTick
            y.WritableState = g
            var s = Object.create(r(7))
            s.inherits = r(4)
            var f = { deprecate: r(39) },
              c = r(17),
              l = r(12).Buffer,
              h = window.Uint8Array || function () {}
            var p,
              d = r(18)
            function b() {}
            function g(t, e) {
              ;(a = a || r(5)), (t = t || {})
              var n = e instanceof a
              ;(this.objectMode = !!t.objectMode),
                n &&
                  (this.objectMode = this.objectMode || !!t.writableObjectMode)
              var s = t.highWaterMark,
                f = t.writableHighWaterMark,
                c = this.objectMode ? 16 : 16384
              ;(this.highWaterMark =
                s || 0 === s ? s : n && (f || 0 === f) ? f : c),
                (this.highWaterMark = Math.floor(this.highWaterMark)),
                (this.finalCalled = !1),
                (this.needDrain = !1),
                (this.ending = !1),
                (this.ended = !1),
                (this.finished = !1),
                (this.destroyed = !1)
              var l = !1 === t.decodeStrings
              ;(this.decodeStrings = !l),
                (this.defaultEncoding = t.defaultEncoding || 'utf8'),
                (this.length = 0),
                (this.writing = !1),
                (this.corked = 0),
                (this.sync = !0),
                (this.bufferProcessing = !1),
                (this.onwrite = function (t) {
                  !(function (t, e) {
                    var r = t._writableState,
                      n = r.sync,
                      o = r.writecb
                    if (
                      ((function (t) {
                        ;(t.writing = !1),
                          (t.writecb = null),
                          (t.length -= t.writelen),
                          (t.writelen = 0)
                      })(r),
                      e)
                    )
                      !(function (t, e, r, n, o) {
                        --e.pendingcb,
                          r
                            ? (i.nextTick(o, n),
                              i.nextTick(x, t, e),
                              (t._writableState.errorEmitted = !0),
                              t.emit('error', n))
                            : (o(n),
                              (t._writableState.errorEmitted = !0),
                              t.emit('error', n),
                              x(t, e))
                      })(t, r, n, e, o)
                    else {
                      var a = _(r)
                      a ||
                        r.corked ||
                        r.bufferProcessing ||
                        !r.bufferedRequest ||
                        w(t, r),
                        n ? u(m, t, r, a, o) : m(t, r, a, o)
                    }
                  })(e, t)
                }),
                (this.writecb = null),
                (this.writelen = 0),
                (this.bufferedRequest = null),
                (this.lastBufferedRequest = null),
                (this.pendingcb = 0),
                (this.prefinished = !1),
                (this.errorEmitted = !1),
                (this.bufferedRequestCount = 0),
                (this.corkedRequestsFree = new o(this))
            }
            function y(t) {
              if (((a = a || r(5)), !(p.call(y, this) || this instanceof a)))
                return new y(t)
              ;(this._writableState = new g(t, this)),
                (this.writable = !0),
                t &&
                  ('function' == typeof t.write && (this._write = t.write),
                  'function' == typeof t.writev && (this._writev = t.writev),
                  'function' == typeof t.destroy && (this._destroy = t.destroy),
                  'function' == typeof t.final && (this._final = t.final)),
                c.call(this)
            }
            function v(t, e, r, n, i, o, a) {
              ;(e.writelen = n),
                (e.writecb = a),
                (e.writing = !0),
                (e.sync = !0),
                r ? t._writev(i, e.onwrite) : t._write(i, o, e.onwrite),
                (e.sync = !1)
            }
            function m(t, e, r, n) {
              r ||
                (function (t, e) {
                  0 === e.length &&
                    e.needDrain &&
                    ((e.needDrain = !1), t.emit('drain'))
                })(t, e),
                e.pendingcb--,
                n(),
                x(t, e)
            }
            function w(t, e) {
              e.bufferProcessing = !0
              var r = e.bufferedRequest
              if (t._writev && r && r.next) {
                var n = e.bufferedRequestCount,
                  i = new Array(n),
                  a = e.corkedRequestsFree
                a.entry = r
                for (var u = 0, s = !0; r; )
                  (i[u] = r), r.isBuf || (s = !1), (r = r.next), (u += 1)
                ;(i.allBuffers = s),
                  v(t, e, !0, e.length, i, '', a.finish),
                  e.pendingcb++,
                  (e.lastBufferedRequest = null),
                  a.next
                    ? ((e.corkedRequestsFree = a.next), (a.next = null))
                    : (e.corkedRequestsFree = new o(e)),
                  (e.bufferedRequestCount = 0)
              } else {
                for (; r; ) {
                  var f = r.chunk,
                    c = r.encoding,
                    l = r.callback
                  if (
                    (v(t, e, !1, e.objectMode ? 1 : f.length, f, c, l),
                    (r = r.next),
                    e.bufferedRequestCount--,
                    e.writing)
                  )
                    break
                }
                null === r && (e.lastBufferedRequest = null)
              }
              ;(e.bufferedRequest = r), (e.bufferProcessing = !1)
            }
            function _(t) {
              return (
                t.ending &&
                0 === t.length &&
                null === t.bufferedRequest &&
                !t.finished &&
                !t.writing
              )
            }
            function E(t, e) {
              t._final(function (r) {
                e.pendingcb--,
                  r && t.emit('error', r),
                  (e.prefinished = !0),
                  t.emit('prefinish'),
                  x(t, e)
              })
            }
            function x(t, e) {
              var r = _(e)
              return (
                r &&
                  (!(function (t, e) {
                    e.prefinished ||
                      e.finalCalled ||
                      ('function' == typeof t._final
                        ? (e.pendingcb++,
                          (e.finalCalled = !0),
                          i.nextTick(E, t, e))
                        : ((e.prefinished = !0), t.emit('prefinish')))
                  })(t, e),
                  0 === e.pendingcb && ((e.finished = !0), t.emit('finish'))),
                r
              )
            }
            s.inherits(y, c),
              (g.prototype.getBuffer = function () {
                for (var t = this.bufferedRequest, e = []; t; )
                  e.push(t), (t = t.next)
                return e
              }),
              (function () {
                try {
                  Object.defineProperty(g.prototype, 'buffer', {
                    get: f.deprecate(
                      function () {
                        return this.getBuffer()
                      },
                      '_writableState.buffer is deprecated. Use _writableState.getBuffer instead.',
                      'DEP0003'
                    )
                  })
                } catch (t) {}
              })(),
              'function' == typeof Symbol &&
              Symbol.hasInstance &&
              'function' == typeof Function.prototype[Symbol.hasInstance]
                ? ((p = Function.prototype[Symbol.hasInstance]),
                  Object.defineProperty(y, Symbol.hasInstance, {
                    value: function (t) {
                      return (
                        !!p.call(this, t) ||
                        (this === y && t && t._writableState instanceof g)
                      )
                    }
                  }))
                : (p = function (t) {
                    return t instanceof this
                  }),
              (y.prototype.pipe = function () {
                this.emit('error', new Error('Cannot pipe, not readable'))
              }),
              (y.prototype.write = function (t, e, r) {
                var n,
                  o = this._writableState,
                  a = !1,
                  u =
                    !o.objectMode && ((n = t), l.isBuffer(n) || n instanceof h)
                return (
                  u &&
                    !l.isBuffer(t) &&
                    (t = (function (t) {
                      return l.from(t)
                    })(t)),
                  'function' == typeof e && ((r = e), (e = null)),
                  u ? (e = 'buffer') : e || (e = o.defaultEncoding),
                  'function' != typeof r && (r = b),
                  o.ended
                    ? (function (t, e) {
                        var r = new Error('write after end')
                        t.emit('error', r), i.nextTick(e, r)
                      })(this, r)
                    : (u ||
                        (function (t, e, r, n) {
                          var o = !0,
                            a = !1
                          return (
                            null === r
                              ? (a = new TypeError(
                                  'May not write null values to stream'
                                ))
                              : 'string' == typeof r ||
                                void 0 === r ||
                                e.objectMode ||
                                (a = new TypeError(
                                  'Invalid non-string/buffer chunk'
                                )),
                            a &&
                              (t.emit('error', a), i.nextTick(n, a), (o = !1)),
                            o
                          )
                        })(this, o, t, r)) &&
                      (o.pendingcb++,
                      (a = (function (t, e, r, n, i, o) {
                        if (!r) {
                          var a = (function (t, e, r) {
                            t.objectMode ||
                              !1 === t.decodeStrings ||
                              'string' != typeof e ||
                              (e = l.from(e, r))
                            return e
                          })(e, n, i)
                          n !== a && ((r = !0), (i = 'buffer'), (n = a))
                        }
                        var u = e.objectMode ? 1 : n.length
                        e.length += u
                        var s = e.length < e.highWaterMark
                        s || (e.needDrain = !0)
                        if (e.writing || e.corked) {
                          var f = e.lastBufferedRequest
                          ;(e.lastBufferedRequest = {
                            chunk: n,
                            encoding: i,
                            isBuf: r,
                            callback: o,
                            next: null
                          }),
                            f
                              ? (f.next = e.lastBufferedRequest)
                              : (e.bufferedRequest = e.lastBufferedRequest),
                            (e.bufferedRequestCount += 1)
                        } else v(t, e, !1, u, n, i, o)
                        return s
                      })(this, o, u, t, e, r))),
                  a
                )
              }),
              (y.prototype.cork = function () {
                this._writableState.corked++
              }),
              (y.prototype.uncork = function () {
                var t = this._writableState
                t.corked &&
                  (t.corked--,
                  t.writing ||
                    t.corked ||
                    t.finished ||
                    t.bufferProcessing ||
                    !t.bufferedRequest ||
                    w(this, t))
              }),
              (y.prototype.setDefaultEncoding = function (t) {
                if (
                  ('string' == typeof t && (t = t.toLowerCase()),
                  !(
                    [
                      'hex',
                      'utf8',
                      'utf-8',
                      'ascii',
                      'binary',
                      'base64',
                      'ucs2',
                      'ucs-2',
                      'utf16le',
                      'utf-16le',
                      'raw'
                    ].indexOf((t + '').toLowerCase()) > -1
                  ))
                )
                  throw new TypeError('Unknown encoding: ' + t)
                return (this._writableState.defaultEncoding = t), this
              }),
              Object.defineProperty(y.prototype, 'writableHighWaterMark', {
                enumerable: !1,
                get: function () {
                  return this._writableState.highWaterMark
                }
              }),
              (y.prototype._write = function (t, e, r) {
                r(new Error('_write() is not implemented'))
              }),
              (y.prototype._writev = null),
              (y.prototype.end = function (t, e, r) {
                var n = this._writableState
                'function' == typeof t
                  ? ((r = t), (t = null), (e = null))
                  : 'function' == typeof e && ((r = e), (e = null)),
                  null != t && this.write(t, e),
                  n.corked && ((n.corked = 1), this.uncork()),
                  n.ending ||
                    n.finished ||
                    (function (t, e, r) {
                      ;(e.ending = !0),
                        x(t, e),
                        r && (e.finished ? i.nextTick(r) : t.once('finish', r))
                      ;(e.ended = !0), (t.writable = !1)
                    })(this, n, r)
              }),
              Object.defineProperty(y.prototype, 'destroyed', {
                get: function () {
                  return (
                    void 0 !== this._writableState &&
                    this._writableState.destroyed
                  )
                },
                set: function (t) {
                  this._writableState && (this._writableState.destroyed = t)
                }
              }),
              (y.prototype.destroy = d.destroy),
              (y.prototype._undestroy = d.undestroy),
              (y.prototype._destroy = function (t, e) {
                this.end(), e(t)
              })
          }).call(this, r(6), r(20).setImmediate)
        },
        function (t, e, r) {
          var n =
              ('undefined' != typeof window && window) ||
              ('undefined' != typeof self && self) ||
              window,
            i = Function.prototype.apply
          function o(t, e) {
            ;(this._id = t), (this._clearFn = e)
          }
          ;(e.setTimeout = function () {
            return new o(i.call(setTimeout, n, arguments), clearTimeout)
          }),
            (e.setInterval = function () {
              return new o(i.call(setInterval, n, arguments), clearInterval)
            }),
            (e.clearTimeout = e.clearInterval =
              function (t) {
                t && t.close()
              }),
            (o.prototype.unref = o.prototype.ref = function () {}),
            (o.prototype.close = function () {
              this._clearFn.call(n, this._id)
            }),
            (e.enroll = function (t, e) {
              clearTimeout(t._idleTimeoutId), (t._idleTimeout = e)
            }),
            (e.unenroll = function (t) {
              clearTimeout(t._idleTimeoutId), (t._idleTimeout = -1)
            }),
            (e._unrefActive = e.active =
              function (t) {
                clearTimeout(t._idleTimeoutId)
                var e = t._idleTimeout
                e >= 0 &&
                  (t._idleTimeoutId = setTimeout(function () {
                    t._onTimeout && t._onTimeout()
                  }, e))
              }),
            r(38),
            (e.setImmediate =
              ('undefined' != typeof self && self.setImmediate) ||
              ('undefined' != typeof window && window.setImmediate) ||
              (this && this.setImmediate)),
            (e.clearImmediate =
              ('undefined' != typeof self && self.clearImmediate) ||
              ('undefined' != typeof window && window.clearImmediate) ||
              (this && this.clearImmediate))
        },
        function (t, e, r) {
          var n = r(40).Buffer,
            i =
              n.isEncoding ||
              function (t) {
                switch ((t = '' + t) && t.toLowerCase()) {
                  case 'hex':
                  case 'utf8':
                  case 'utf-8':
                  case 'ascii':
                  case 'binary':
                  case 'base64':
                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                  case 'raw':
                    return !0
                  default:
                    return !1
                }
              }
          function o(t) {
            var e
            switch (
              ((this.encoding = (function (t) {
                var e = (function (t) {
                  if (!t) return 'utf8'
                  for (var e; ; )
                    switch (t) {
                      case 'utf8':
                      case 'utf-8':
                        return 'utf8'
                      case 'ucs2':
                      case 'ucs-2':
                      case 'utf16le':
                      case 'utf-16le':
                        return 'utf16le'
                      case 'latin1':
                      case 'binary':
                        return 'latin1'
                      case 'base64':
                      case 'ascii':
                      case 'hex':
                        return t
                      default:
                        if (e) return
                        ;(t = ('' + t).toLowerCase()), (e = !0)
                    }
                })(t)
                if ('string' != typeof e && (n.isEncoding === i || !i(t)))
                  throw new Error('Unknown encoding: ' + t)
                return e || t
              })(t)),
              this.encoding)
            ) {
              case 'utf16le':
                ;(this.text = s), (this.end = f), (e = 4)
                break
              case 'utf8':
                ;(this.fillLast = u), (e = 4)
                break
              case 'base64':
                ;(this.text = c), (this.end = l), (e = 3)
                break
              default:
                return (this.write = h), void (this.end = p)
            }
            ;(this.lastNeed = 0),
              (this.lastTotal = 0),
              (this.lastChar = n.allocUnsafe(e))
          }
          function a(t) {
            return t <= 127
              ? 0
              : t >> 5 == 6
              ? 2
              : t >> 4 == 14
              ? 3
              : t >> 3 == 30
              ? 4
              : t >> 6 == 2
              ? -1
              : -2
          }
          function u(t) {
            var e = this.lastTotal - this.lastNeed,
              r = (function (t, e, r) {
                if (128 != (192 & e[0])) return (t.lastNeed = 0), '�'
                if (t.lastNeed > 1 && e.length > 1) {
                  if (128 != (192 & e[1])) return (t.lastNeed = 1), '�'
                  if (t.lastNeed > 2 && e.length > 2 && 128 != (192 & e[2]))
                    return (t.lastNeed = 2), '�'
                }
              })(this, t)
            return void 0 !== r
              ? r
              : this.lastNeed <= t.length
              ? (t.copy(this.lastChar, e, 0, this.lastNeed),
                this.lastChar.toString(this.encoding, 0, this.lastTotal))
              : (t.copy(this.lastChar, e, 0, t.length),
                void (this.lastNeed -= t.length))
          }
          function s(t, e) {
            if ((t.length - e) % 2 == 0) {
              var r = t.toString('utf16le', e)
              if (r) {
                var n = r.charCodeAt(r.length - 1)
                if (n >= 55296 && n <= 56319)
                  return (
                    (this.lastNeed = 2),
                    (this.lastTotal = 4),
                    (this.lastChar[0] = t[t.length - 2]),
                    (this.lastChar[1] = t[t.length - 1]),
                    r.slice(0, -1)
                  )
              }
              return r
            }
            return (
              (this.lastNeed = 1),
              (this.lastTotal = 2),
              (this.lastChar[0] = t[t.length - 1]),
              t.toString('utf16le', e, t.length - 1)
            )
          }
          function f(t) {
            var e = t && t.length ? this.write(t) : ''
            if (this.lastNeed) {
              var r = this.lastTotal - this.lastNeed
              return e + this.lastChar.toString('utf16le', 0, r)
            }
            return e
          }
          function c(t, e) {
            var r = (t.length - e) % 3
            return 0 === r
              ? t.toString('base64', e)
              : ((this.lastNeed = 3 - r),
                (this.lastTotal = 3),
                1 === r
                  ? (this.lastChar[0] = t[t.length - 1])
                  : ((this.lastChar[0] = t[t.length - 2]),
                    (this.lastChar[1] = t[t.length - 1])),
                t.toString('base64', e, t.length - r))
          }
          function l(t) {
            var e = t && t.length ? this.write(t) : ''
            return this.lastNeed
              ? e + this.lastChar.toString('base64', 0, 3 - this.lastNeed)
              : e
          }
          function h(t) {
            return t.toString(this.encoding)
          }
          function p(t) {
            return t && t.length ? this.write(t) : ''
          }
          ;(e.StringDecoder = o),
            (o.prototype.write = function (t) {
              if (0 === t.length) return ''
              var e, r
              if (this.lastNeed) {
                if (void 0 === (e = this.fillLast(t))) return ''
                ;(r = this.lastNeed), (this.lastNeed = 0)
              } else r = 0
              return r < t.length
                ? e
                  ? e + this.text(t, r)
                  : this.text(t, r)
                : e || ''
            }),
            (o.prototype.end = function (t) {
              var e = t && t.length ? this.write(t) : ''
              return this.lastNeed ? e + '�' : e
            }),
            (o.prototype.text = function (t, e) {
              var r = (function (t, e, r) {
                var n = e.length - 1
                if (n < r) return 0
                var i = a(e[n])
                if (i >= 0) return i > 0 && (t.lastNeed = i - 1), i
                if (--n < r || -2 === i) return 0
                if (((i = a(e[n])), i >= 0))
                  return i > 0 && (t.lastNeed = i - 2), i
                if (--n < r || -2 === i) return 0
                if (((i = a(e[n])), i >= 0))
                  return i > 0 && (2 === i ? (i = 0) : (t.lastNeed = i - 3)), i
                return 0
              })(this, t, e)
              if (!this.lastNeed) return t.toString('utf8', e)
              this.lastTotal = r
              var n = t.length - (r - this.lastNeed)
              return t.copy(this.lastChar, 0, n), t.toString('utf8', e, n)
            }),
            (o.prototype.fillLast = function (t) {
              if (this.lastNeed <= t.length)
                return (
                  t.copy(
                    this.lastChar,
                    this.lastTotal - this.lastNeed,
                    0,
                    this.lastNeed
                  ),
                  this.lastChar.toString(this.encoding, 0, this.lastTotal)
                )
              t.copy(
                this.lastChar,
                this.lastTotal - this.lastNeed,
                0,
                t.length
              ),
                (this.lastNeed -= t.length)
            })
        },
        function (t, e, r) {
          t.exports = a
          var n = r(5),
            i = Object.create(r(7))
          function o(t, e) {
            var r = this._transformState
            r.transforming = !1
            var n = r.writecb
            if (!n)
              return this.emit(
                'error',
                new Error('write callback called multiple times')
              )
            ;(r.writechunk = null),
              (r.writecb = null),
              null != e && this.push(e),
              n(t)
            var i = this._readableState
            ;(i.reading = !1),
              (i.needReadable || i.length < i.highWaterMark) &&
                this._read(i.highWaterMark)
          }
          function a(t) {
            if (!(this instanceof a)) return new a(t)
            n.call(this, t),
              (this._transformState = {
                afterTransform: o.bind(this),
                needTransform: !1,
                transforming: !1,
                writecb: null,
                writechunk: null,
                writeencoding: null
              }),
              (this._readableState.needReadable = !0),
              (this._readableState.sync = !1),
              t &&
                ('function' == typeof t.transform &&
                  (this._transform = t.transform),
                'function' == typeof t.flush && (this._flush = t.flush)),
              this.on('prefinish', u)
          }
          function u() {
            var t = this
            'function' == typeof this._flush
              ? this._flush(function (e, r) {
                  s(t, e, r)
                })
              : s(this, null, null)
          }
          function s(t, e, r) {
            if (e) return t.emit('error', e)
            if ((null != r && t.push(r), t._writableState.length))
              throw new Error('Calling transform done when ws.length != 0')
            if (t._transformState.transforming)
              throw new Error('Calling transform done when still transforming')
            return t.push(null)
          }
          ;(i.inherits = r(4)),
            i.inherits(a, n),
            (a.prototype.push = function (t, e) {
              return (
                (this._transformState.needTransform = !1),
                n.prototype.push.call(this, t, e)
              )
            }),
            (a.prototype._transform = function (t, e, r) {
              throw new Error('_transform() is not implemented')
            }),
            (a.prototype._write = function (t, e, r) {
              var n = this._transformState
              if (
                ((n.writecb = r),
                (n.writechunk = t),
                (n.writeencoding = e),
                !n.transforming)
              ) {
                var i = this._readableState
                ;(n.needTransform ||
                  i.needReadable ||
                  i.length < i.highWaterMark) &&
                  this._read(i.highWaterMark)
              }
            }),
            (a.prototype._read = function (t) {
              var e = this._transformState
              null !== e.writechunk && e.writecb && !e.transforming
                ? ((e.transforming = !0),
                  this._transform(
                    e.writechunk,
                    e.writeencoding,
                    e.afterTransform
                  ))
                : (e.needTransform = !0)
            }),
            (a.prototype._destroy = function (t, e) {
              var r = this
              n.prototype._destroy.call(this, t, function (t) {
                e(t), r.emit('close')
              })
            })
        },
        function (t, e, r) {
          ;(function (t) {
            var n,
              i,
              o = r(1),
              a = r.n(o),
              u = r(0),
              s = r.n(u),
              f = r(2)
            e.a = {
              pack: !0,
              encode: !0,
              compress:
                ((i = a()(
                  s.a.mark(function e(r) {
                    var n
                    return s.a.wrap(function (e) {
                      for (;;)
                        switch ((e.prev = e.next)) {
                          case 0:
                            return (e.next = 2), f.a.lzma()
                          case 2:
                            return (
                              (n = e.sent),
                              e.abrupt(
                                'return',
                                new Promise(function (e, i) {
                                  return n.compress(r, 9, function (r, n) {
                                    return n ? i(n) : e(t.from(r))
                                  })
                                })
                              )
                            )
                          case 4:
                          case 'end':
                            return e.stop()
                        }
                    }, e)
                  })
                )),
                function (t) {
                  return i.apply(this, arguments)
                }),
              decompress:
                ((n = a()(
                  s.a.mark(function e(r) {
                    var n
                    return s.a.wrap(function (e) {
                      for (;;)
                        switch ((e.prev = e.next)) {
                          case 0:
                            return (e.next = 2), f.a.lzma()
                          case 2:
                            return (
                              (n = e.sent),
                              e.abrupt(
                                'return',
                                new Promise(function (e, i) {
                                  return n.decompress(r, function (r, n) {
                                    return n ? i(n) : e(t.from(r))
                                  })
                                })
                              )
                            )
                          case 4:
                          case 'end':
                            return e.stop()
                        }
                    }, e)
                  })
                )),
                function (t) {
                  return n.apply(this, arguments)
                })
            }
          }).call(this, r(3).Buffer)
        },
        function (t, e, r) {
          ;(function (t) {
            var n,
              i,
              o = r(1),
              a = r.n(o),
              u = r(0),
              s = r.n(u),
              f = r(2)
            e.a = {
              pack: !1,
              encode: !0,
              compress:
                ((i = a()(
                  s.a.mark(function e(r) {
                    return s.a.wrap(function (e) {
                      for (;;)
                        switch ((e.prev = e.next)) {
                          case 0:
                            return (e.t0 = t), (e.next = 3), f.a.lzstring()
                          case 3:
                            return (
                              (e.t1 = e.sent.compressToUint8Array(r)),
                              e.abrupt('return', e.t0.from.call(e.t0, e.t1))
                            )
                          case 5:
                          case 'end':
                            return e.stop()
                        }
                    }, e)
                  })
                )),
                function (t) {
                  return i.apply(this, arguments)
                }),
              decompress:
                ((n = a()(
                  s.a.mark(function t(e) {
                    return s.a.wrap(function (t) {
                      for (;;)
                        switch ((t.prev = t.next)) {
                          case 0:
                            return (t.next = 2), f.a.lzstring()
                          case 2:
                            return t.abrupt(
                              'return',
                              t.sent.decompressFromUint8Array(e)
                            )
                          case 3:
                          case 'end':
                            return t.stop()
                        }
                    }, t)
                  })
                )),
                function (t) {
                  return n.apply(this, arguments)
                })
            }
          }).call(this, r(3).Buffer)
        },
        function (t, e, r) {
          ;(function (t) {
            var n,
              i,
              o = r(1),
              a = r.n(o),
              u = r(0),
              s = r.n(u),
              f = r(2)
            e.a = {
              pack: !0,
              encode: !0,
              compress:
                ((i = a()(
                  s.a.mark(function e(r) {
                    return s.a.wrap(function (e) {
                      for (;;)
                        switch ((e.prev = e.next)) {
                          case 0:
                            return (e.t0 = t), (e.next = 3), f.a.lzw()
                          case 3:
                            return (
                              (e.t1 = e.sent.encode(r.toString('binary'))),
                              e.abrupt('return', e.t0.from.call(e.t0, e.t1))
                            )
                          case 5:
                          case 'end':
                            return e.stop()
                        }
                    }, e)
                  })
                )),
                function (t) {
                  return i.apply(this, arguments)
                }),
              decompress:
                ((n = a()(
                  s.a.mark(function e(r) {
                    return s.a.wrap(function (e) {
                      for (;;)
                        switch ((e.prev = e.next)) {
                          case 0:
                            return (e.t0 = t), (e.next = 3), f.a.lzw()
                          case 3:
                            return (
                              (e.t1 = e.sent.decode(r)),
                              e.abrupt(
                                'return',
                                e.t0.from.call(e.t0, e.t1, 'binary')
                              )
                            )
                          case 5:
                          case 'end':
                            return e.stop()
                        }
                    }, e)
                  })
                )),
                function (t) {
                  return n.apply(this, arguments)
                })
            }
          }).call(this, r(3).Buffer)
        },
        function (t, e, r) {
          var n = r(27).default
          function i() {
            ;(t.exports = i =
              function () {
                return e
              }),
              (t.exports.__esModule = !0),
              (t.exports.default = t.exports)
            var e = {},
              r = Object.prototype,
              o = r.hasOwnProperty,
              a =
                Object.defineProperty ||
                function (t, e, r) {
                  t[e] = r.value
                },
              u = 'function' == typeof Symbol ? Symbol : {},
              s = u.iterator || '@@iterator',
              f = u.asyncIterator || '@@asyncIterator',
              c = u.toStringTag || '@@toStringTag'
            function l(t, e, r) {
              return (
                Object.defineProperty(t, e, {
                  value: r,
                  enumerable: !0,
                  configurable: !0,
                  writable: !0
                }),
                t[e]
              )
            }
            try {
              l({}, '')
            } catch (t) {
              l = function (t, e, r) {
                return (t[e] = r)
              }
            }
            function h(t, e, r, n) {
              var i = e && e.prototype instanceof b ? e : b,
                o = Object.create(i.prototype),
                u = new O(n || [])
              return a(o, '_invoke', { value: S(t, r, u) }), o
            }
            function p(t, e, r) {
              try {
                return { type: 'normal', arg: t.call(e, r) }
              } catch (t) {
                return { type: 'throw', arg: t }
              }
            }
            e.wrap = h
            var d = {}
            function b() {}
            function g() {}
            function y() {}
            var v = {}
            l(v, s, function () {
              return this
            })
            var m = Object.getPrototypeOf,
              w = m && m(m(j([])))
            w && w !== r && o.call(w, s) && (v = w)
            var _ = (y.prototype = b.prototype = Object.create(v))
            function E(t) {
              ;['next', 'throw', 'return'].forEach(function (e) {
                l(t, e, function (t) {
                  return this._invoke(e, t)
                })
              })
            }
            function x(t, e) {
              function r(i, a, u, s) {
                var f = p(t[i], t, a)
                if ('throw' !== f.type) {
                  var c = f.arg,
                    l = c.value
                  return l && 'object' == n(l) && o.call(l, '__await')
                    ? e.resolve(l.__await).then(
                        function (t) {
                          r('next', t, u, s)
                        },
                        function (t) {
                          r('throw', t, u, s)
                        }
                      )
                    : e.resolve(l).then(
                        function (t) {
                          ;(c.value = t), u(c)
                        },
                        function (t) {
                          return r('throw', t, u, s)
                        }
                      )
                }
                s(f.arg)
              }
              var i
              a(this, '_invoke', {
                value: function (t, n) {
                  function o() {
                    return new e(function (e, i) {
                      r(t, n, e, i)
                    })
                  }
                  return (i = i ? i.then(o, o) : o())
                }
              })
            }
            function S(t, e, r) {
              var n = 'suspendedStart'
              return function (i, o) {
                if ('executing' === n)
                  throw new Error('Generator is already running')
                if ('completed' === n) {
                  if ('throw' === i) throw o
                  return U()
                }
                for (r.method = i, r.arg = o; ; ) {
                  var a = r.delegate
                  if (a) {
                    var u = k(a, r)
                    if (u) {
                      if (u === d) continue
                      return u
                    }
                  }
                  if ('next' === r.method) r.sent = r._sent = r.arg
                  else if ('throw' === r.method) {
                    if ('suspendedStart' === n) throw ((n = 'completed'), r.arg)
                    r.dispatchException(r.arg)
                  } else 'return' === r.method && r.abrupt('return', r.arg)
                  n = 'executing'
                  var s = p(t, e, r)
                  if ('normal' === s.type) {
                    if (
                      ((n = r.done ? 'completed' : 'suspendedYield'),
                      s.arg === d)
                    )
                      continue
                    return { value: s.arg, done: r.done }
                  }
                  'throw' === s.type &&
                    ((n = 'completed'), (r.method = 'throw'), (r.arg = s.arg))
                }
              }
            }
            function k(t, e) {
              var r = e.method,
                n = t.iterator[r]
              if (void 0 === n)
                return (
                  (e.delegate = null),
                  ('throw' === r &&
                    t.iterator.return &&
                    ((e.method = 'return'),
                    (e.arg = void 0),
                    k(t, e),
                    'throw' === e.method)) ||
                    ('return' !== r &&
                      ((e.method = 'throw'),
                      (e.arg = new TypeError(
                        "The iterator does not provide a '" + r + "' method"
                      )))),
                  d
                )
              var i = p(n, t.iterator, e.arg)
              if ('throw' === i.type)
                return (
                  (e.method = 'throw'), (e.arg = i.arg), (e.delegate = null), d
                )
              var o = i.arg
              return o
                ? o.done
                  ? ((e[t.resultName] = o.value),
                    (e.next = t.nextLoc),
                    'return' !== e.method &&
                      ((e.method = 'next'), (e.arg = void 0)),
                    (e.delegate = null),
                    d)
                  : o
                : ((e.method = 'throw'),
                  (e.arg = new TypeError('iterator result is not an object')),
                  (e.delegate = null),
                  d)
            }
            function A(t) {
              var e = { tryLoc: t[0] }
              1 in t && (e.catchLoc = t[1]),
                2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
                this.tryEntries.push(e)
            }
            function T(t) {
              var e = t.completion || {}
              ;(e.type = 'normal'), delete e.arg, (t.completion = e)
            }
            function O(t) {
              ;(this.tryEntries = [{ tryLoc: 'root' }]),
                t.forEach(A, this),
                this.reset(!0)
            }
            function j(t) {
              if (t) {
                var e = t[s]
                if (e) return e.call(t)
                if ('function' == typeof t.next) return t
                if (!isNaN(t.length)) {
                  var r = -1,
                    n = function e() {
                      for (; ++r < t.length; )
                        if (o.call(t, r))
                          return (e.value = t[r]), (e.done = !1), e
                      return (e.value = void 0), (e.done = !0), e
                    }
                  return (n.next = n)
                }
              }
              return { next: U }
            }
            function U() {
              return { value: void 0, done: !0 }
            }
            return (
              (g.prototype = y),
              a(_, 'constructor', { value: y, configurable: !0 }),
              a(y, 'constructor', { value: g, configurable: !0 }),
              (g.displayName = l(y, c, 'GeneratorFunction')),
              (e.isGeneratorFunction = function (t) {
                var e = 'function' == typeof t && t.constructor
                return (
                  !!e &&
                  (e === g || 'GeneratorFunction' === (e.displayName || e.name))
                )
              }),
              (e.mark = function (t) {
                return (
                  Object.setPrototypeOf
                    ? Object.setPrototypeOf(t, y)
                    : ((t.__proto__ = y), l(t, c, 'GeneratorFunction')),
                  (t.prototype = Object.create(_)),
                  t
                )
              }),
              (e.awrap = function (t) {
                return { __await: t }
              }),
              E(x.prototype),
              l(x.prototype, f, function () {
                return this
              }),
              (e.AsyncIterator = x),
              (e.async = function (t, r, n, i, o) {
                void 0 === o && (o = Promise)
                var a = new x(h(t, r, n, i), o)
                return e.isGeneratorFunction(r)
                  ? a
                  : a.next().then(function (t) {
                      return t.done ? t.value : a.next()
                    })
              }),
              E(_),
              l(_, c, 'Generator'),
              l(_, s, function () {
                return this
              }),
              l(_, 'toString', function () {
                return '[object Generator]'
              }),
              (e.keys = function (t) {
                var e = Object(t),
                  r = []
                for (var n in e) r.push(n)
                return (
                  r.reverse(),
                  function t() {
                    for (; r.length; ) {
                      var n = r.pop()
                      if (n in e) return (t.value = n), (t.done = !1), t
                    }
                    return (t.done = !0), t
                  }
                )
              }),
              (e.values = j),
              (O.prototype = {
                constructor: O,
                reset: function (t) {
                  if (
                    ((this.prev = 0),
                    (this.next = 0),
                    (this.sent = this._sent = void 0),
                    (this.done = !1),
                    (this.delegate = null),
                    (this.method = 'next'),
                    (this.arg = void 0),
                    this.tryEntries.forEach(T),
                    !t)
                  )
                    for (var e in this)
                      't' === e.charAt(0) &&
                        o.call(this, e) &&
                        !isNaN(+e.slice(1)) &&
                        (this[e] = void 0)
                },
                stop: function () {
                  this.done = !0
                  var t = this.tryEntries[0].completion
                  if ('throw' === t.type) throw t.arg
                  return this.rval
                },
                dispatchException: function (t) {
                  if (this.done) throw t
                  var e = this
                  function r(r, n) {
                    return (
                      (a.type = 'throw'),
                      (a.arg = t),
                      (e.next = r),
                      n && ((e.method = 'next'), (e.arg = void 0)),
                      !!n
                    )
                  }
                  for (var n = this.tryEntries.length - 1; n >= 0; --n) {
                    var i = this.tryEntries[n],
                      a = i.completion
                    if ('root' === i.tryLoc) return r('end')
                    if (i.tryLoc <= this.prev) {
                      var u = o.call(i, 'catchLoc'),
                        s = o.call(i, 'finallyLoc')
                      if (u && s) {
                        if (this.prev < i.catchLoc) return r(i.catchLoc, !0)
                        if (this.prev < i.finallyLoc) return r(i.finallyLoc)
                      } else if (u) {
                        if (this.prev < i.catchLoc) return r(i.catchLoc, !0)
                      } else {
                        if (!s)
                          throw new Error(
                            'try statement without catch or finally'
                          )
                        if (this.prev < i.finallyLoc) return r(i.finallyLoc)
                      }
                    }
                  }
                },
                abrupt: function (t, e) {
                  for (var r = this.tryEntries.length - 1; r >= 0; --r) {
                    var n = this.tryEntries[r]
                    if (
                      n.tryLoc <= this.prev &&
                      o.call(n, 'finallyLoc') &&
                      this.prev < n.finallyLoc
                    ) {
                      var i = n
                      break
                    }
                  }
                  i &&
                    ('break' === t || 'continue' === t) &&
                    i.tryLoc <= e &&
                    e <= i.finallyLoc &&
                    (i = null)
                  var a = i ? i.completion : {}
                  return (
                    (a.type = t),
                    (a.arg = e),
                    i
                      ? ((this.method = 'next'), (this.next = i.finallyLoc), d)
                      : this.complete(a)
                  )
                },
                complete: function (t, e) {
                  if ('throw' === t.type) throw t.arg
                  return (
                    'break' === t.type || 'continue' === t.type
                      ? (this.next = t.arg)
                      : 'return' === t.type
                      ? ((this.rval = this.arg = t.arg),
                        (this.method = 'return'),
                        (this.next = 'end'))
                      : 'normal' === t.type && e && (this.next = e),
                    d
                  )
                },
                finish: function (t) {
                  for (var e = this.tryEntries.length - 1; e >= 0; --e) {
                    var r = this.tryEntries[e]
                    if (r.finallyLoc === t)
                      return this.complete(r.completion, r.afterLoc), T(r), d
                  }
                },
                catch: function (t) {
                  for (var e = this.tryEntries.length - 1; e >= 0; --e) {
                    var r = this.tryEntries[e]
                    if (r.tryLoc === t) {
                      var n = r.completion
                      if ('throw' === n.type) {
                        var i = n.arg
                        T(r)
                      }
                      return i
                    }
                  }
                  throw new Error('illegal catch attempt')
                },
                delegateYield: function (t, e, r) {
                  return (
                    (this.delegate = {
                      iterator: j(t),
                      resultName: e,
                      nextLoc: r
                    }),
                    'next' === this.method && (this.arg = void 0),
                    d
                  )
                }
              }),
              e
            )
          }
          ;(t.exports = i),
            (t.exports.__esModule = !0),
            (t.exports.default = t.exports)
        },
        function (t, e) {
          function r(e) {
            return (
              (t.exports = r =
                'function' == typeof Symbol &&
                'symbol' == typeof Symbol.iterator
                  ? function (t) {
                      return typeof t
                    }
                  : function (t) {
                      return t &&
                        'function' == typeof Symbol &&
                        t.constructor === Symbol &&
                        t !== Symbol.prototype
                        ? 'symbol'
                        : typeof t
                    }),
              (t.exports.__esModule = !0),
              (t.exports.default = t.exports),
              r(e)
            )
          }
          ;(t.exports = r),
            (t.exports.__esModule = !0),
            (t.exports.default = t.exports)
        },
        function (t, e, r) {
          ;(e.byteLength = function (t) {
            var e = s(t),
              r = e[0],
              n = e[1]
            return (3 * (r + n)) / 4 - n
          }),
            (e.toByteArray = function (t) {
              var e,
                r,
                n = s(t),
                a = n[0],
                u = n[1],
                f = new o(
                  (function (t, e, r) {
                    return (3 * (e + r)) / 4 - r
                  })(0, a, u)
                ),
                c = 0,
                l = u > 0 ? a - 4 : a
              for (r = 0; r < l; r += 4)
                (e =
                  (i[t.charCodeAt(r)] << 18) |
                  (i[t.charCodeAt(r + 1)] << 12) |
                  (i[t.charCodeAt(r + 2)] << 6) |
                  i[t.charCodeAt(r + 3)]),
                  (f[c++] = (e >> 16) & 255),
                  (f[c++] = (e >> 8) & 255),
                  (f[c++] = 255 & e)
              2 === u &&
                ((e =
                  (i[t.charCodeAt(r)] << 2) | (i[t.charCodeAt(r + 1)] >> 4)),
                (f[c++] = 255 & e))
              1 === u &&
                ((e =
                  (i[t.charCodeAt(r)] << 10) |
                  (i[t.charCodeAt(r + 1)] << 4) |
                  (i[t.charCodeAt(r + 2)] >> 2)),
                (f[c++] = (e >> 8) & 255),
                (f[c++] = 255 & e))
              return f
            }),
            (e.fromByteArray = function (t) {
              for (
                var e,
                  r = t.length,
                  i = r % 3,
                  o = [],
                  a = 16383,
                  u = 0,
                  s = r - i;
                u < s;
                u += a
              )
                o.push(f(t, u, u + a > s ? s : u + a))
              1 === i
                ? ((e = t[r - 1]), o.push(n[e >> 2] + n[(e << 4) & 63] + '=='))
                : 2 === i &&
                  ((e = (t[r - 2] << 8) + t[r - 1]),
                  o.push(
                    n[e >> 10] + n[(e >> 4) & 63] + n[(e << 2) & 63] + '='
                  ))
              return o.join('')
            })
          for (
            var n = [],
              i = [],
              o = 'undefined' != typeof Uint8Array ? Uint8Array : Array,
              a =
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
              u = 0;
            u < 64;
            ++u
          )
            (n[u] = a[u]), (i[a.charCodeAt(u)] = u)
          function s(t) {
            var e = t.length
            if (e % 4 > 0)
              throw new Error('Invalid string. Length must be a multiple of 4')
            var r = t.indexOf('=')
            return -1 === r && (r = e), [r, r === e ? 0 : 4 - (r % 4)]
          }
          function f(t, e, r) {
            for (var i, o, a = [], u = e; u < r; u += 3)
              (i =
                ((t[u] << 16) & 16711680) +
                ((t[u + 1] << 8) & 65280) +
                (255 & t[u + 2])),
                a.push(
                  n[((o = i) >> 18) & 63] +
                    n[(o >> 12) & 63] +
                    n[(o >> 6) & 63] +
                    n[63 & o]
                )
            return a.join('')
          }
          ;(i['-'.charCodeAt(0)] = 62), (i['_'.charCodeAt(0)] = 63)
        },
        function (t, e) {
          ;(e.read = function (t, e, r, n, i) {
            var o,
              a,
              u = 8 * i - n - 1,
              s = (1 << u) - 1,
              f = s >> 1,
              c = -7,
              l = r ? i - 1 : 0,
              h = r ? -1 : 1,
              p = t[e + l]
            for (
              l += h, o = p & ((1 << -c) - 1), p >>= -c, c += u;
              c > 0;
              o = 256 * o + t[e + l], l += h, c -= 8
            );
            for (
              a = o & ((1 << -c) - 1), o >>= -c, c += n;
              c > 0;
              a = 256 * a + t[e + l], l += h, c -= 8
            );
            if (0 === o) o = 1 - f
            else {
              if (o === s) return a ? NaN : (1 / 0) * (p ? -1 : 1)
              ;(a += Math.pow(2, n)), (o -= f)
            }
            return (p ? -1 : 1) * a * Math.pow(2, o - n)
          }),
            (e.write = function (t, e, r, n, i, o) {
              var a,
                u,
                s,
                f = 8 * o - i - 1,
                c = (1 << f) - 1,
                l = c >> 1,
                h = 23 === i ? Math.pow(2, -24) - Math.pow(2, -77) : 0,
                p = n ? 0 : o - 1,
                d = n ? 1 : -1,
                b = e < 0 || (0 === e && 1 / e < 0) ? 1 : 0
              for (
                e = Math.abs(e),
                  isNaN(e) || e === 1 / 0
                    ? ((u = isNaN(e) ? 1 : 0), (a = c))
                    : ((a = Math.floor(Math.log(e) / Math.LN2)),
                      e * (s = Math.pow(2, -a)) < 1 && (a--, (s *= 2)),
                      (e += a + l >= 1 ? h / s : h * Math.pow(2, 1 - l)) * s >=
                        2 && (a++, (s /= 2)),
                      a + l >= c
                        ? ((u = 0), (a = c))
                        : a + l >= 1
                        ? ((u = (e * s - 1) * Math.pow(2, i)), (a += l))
                        : ((u = e * Math.pow(2, l - 1) * Math.pow(2, i)),
                          (a = 0)));
                i >= 8;
                t[r + p] = 255 & u, p += d, u /= 256, i -= 8
              );
              for (
                a = (a << i) | u, f += i;
                f > 0;
                t[r + p] = 255 & a, p += d, a /= 256, f -= 8
              );
              t[r + p - d] |= 128 * b
            })
        },
        function (t, e, r) {
          var n = r(10).Buffer,
            i = r(31),
            o = r(8),
            a = r(42),
            u = r(43),
            s = r(44)
          t.exports = function (t) {
            var e = [],
              r = []
            return {
              encode: s(
                e,
                (t = t || {
                  forceFloat64: !1,
                  compatibilityMode: !1,
                  disableTimestampEncoding: !1,
                  protoAction: 'error'
                }).forceFloat64,
                t.compatibilityMode,
                t.disableTimestampEncoding
              ),
              decode: u(r, t),
              register: function (t, e, r, a) {
                return (
                  i(e, 'must have a constructor'),
                  i(r, 'must have an encode function'),
                  i(t >= 0, 'must have a non-negative type'),
                  i(a, 'must have a decode function'),
                  this.registerEncoder(
                    function (t) {
                      return t instanceof e
                    },
                    function (e) {
                      var i = o(),
                        a = n.allocUnsafe(1)
                      return a.writeInt8(t, 0), i.append(a), i.append(r(e)), i
                    }
                  ),
                  this.registerDecoder(t, a),
                  this
                )
              },
              registerEncoder: function (t, r) {
                return (
                  i(t, 'must have an encode function'),
                  i(r, 'must have an encode function'),
                  e.push({ check: t, encode: r }),
                  this
                )
              },
              registerDecoder: function (t, e) {
                return (
                  i(t >= 0, 'must have a non-negative type'),
                  i(e, 'must have a decode function'),
                  r.push({ type: t, decode: e }),
                  this
                )
              },
              encoder: a.encoder,
              decoder: a.decoder,
              buffer: !0,
              type: 'msgpack5',
              IncompleteBufferError: u.IncompleteBufferError
            }
          }
        },
        function (t, e, r) {
          var n = r(32)
          function i(t, e) {
            if (t === e) return 0
            for (
              var r = t.length, n = e.length, i = 0, o = Math.min(r, n);
              i < o;
              ++i
            )
              if (t[i] !== e[i]) {
                ;(r = t[i]), (n = e[i])
                break
              }
            return r < n ? -1 : n < r ? 1 : 0
          }
          function o(t) {
            return window.Buffer && 'function' == typeof window.Buffer.isBuffer
              ? window.Buffer.isBuffer(t)
              : !(null == t || !t._isBuffer)
          }
          var a = r(11),
            u = Object.prototype.hasOwnProperty,
            s = Array.prototype.slice,
            f = 'foo' === function () {}.name
          function c(t) {
            return Object.prototype.toString.call(t)
          }
          function l(t) {
            return (
              !o(t) &&
              'function' == typeof window.ArrayBuffer &&
              ('function' == typeof ArrayBuffer.isView
                ? ArrayBuffer.isView(t)
                : !!t &&
                  (t instanceof DataView ||
                    !!(t.buffer && t.buffer instanceof ArrayBuffer)))
            )
          }
          var h = (t.exports = v),
            p = /\s*function\s+([^\(\s]*)\s*/
          function d(t) {
            if (a.isFunction(t)) {
              if (f) return t.name
              var e = t.toString().match(p)
              return e && e[1]
            }
          }
          function b(t, e) {
            return 'string' == typeof t ? (t.length < e ? t : t.slice(0, e)) : t
          }
          function g(t) {
            if (f || !a.isFunction(t)) return a.inspect(t)
            var e = d(t)
            return '[Function' + (e ? ': ' + e : '') + ']'
          }
          function y(t, e, r, n, i) {
            throw new h.AssertionError({
              message: r,
              actual: t,
              expected: e,
              operator: n,
              stackStartFunction: i
            })
          }
          function v(t, e) {
            t || y(t, !0, e, '==', h.ok)
          }
          function m(t, e, r, n) {
            if (t === e) return !0
            if (o(t) && o(e)) return 0 === i(t, e)
            if (a.isDate(t) && a.isDate(e)) return t.getTime() === e.getTime()
            if (a.isRegExp(t) && a.isRegExp(e))
              return (
                t.source === e.source &&
                t.global === e.global &&
                t.multiline === e.multiline &&
                t.lastIndex === e.lastIndex &&
                t.ignoreCase === e.ignoreCase
              )
            if (
              (null !== t && 'object' == typeof t) ||
              (null !== e && 'object' == typeof e)
            ) {
              if (
                l(t) &&
                l(e) &&
                c(t) === c(e) &&
                !(t instanceof Float32Array || t instanceof Float64Array)
              )
                return (
                  0 === i(new Uint8Array(t.buffer), new Uint8Array(e.buffer))
                )
              if (o(t) !== o(e)) return !1
              var u = (n = n || { actual: [], expected: [] }).actual.indexOf(t)
              return (
                (-1 !== u && u === n.expected.indexOf(e)) ||
                (n.actual.push(t),
                n.expected.push(e),
                (function (t, e, r, n) {
                  if (null == t || null == e) return !1
                  if (a.isPrimitive(t) || a.isPrimitive(e)) return t === e
                  if (
                    r &&
                    Object.getPrototypeOf(t) !== Object.getPrototypeOf(e)
                  )
                    return !1
                  var i = w(t),
                    o = w(e)
                  if ((i && !o) || (!i && o)) return !1
                  if (i) return m((t = s.call(t)), (e = s.call(e)), r)
                  var u,
                    f,
                    c = x(t),
                    l = x(e)
                  if (c.length !== l.length) return !1
                  for (c.sort(), l.sort(), f = c.length - 1; f >= 0; f--)
                    if (c[f] !== l[f]) return !1
                  for (f = c.length - 1; f >= 0; f--)
                    if (!m(t[(u = c[f])], e[u], r, n)) return !1
                  return !0
                })(t, e, r, n))
              )
            }
            return r ? t === e : t == e
          }
          function w(t) {
            return '[object Arguments]' == Object.prototype.toString.call(t)
          }
          function _(t, e) {
            if (!t || !e) return !1
            if ('[object RegExp]' == Object.prototype.toString.call(e))
              return e.test(t)
            try {
              if (t instanceof e) return !0
            } catch (t) {}
            return !Error.isPrototypeOf(e) && !0 === e.call({}, t)
          }
          function E(t, e, r, n) {
            var i
            if ('function' != typeof e)
              throw new TypeError('"block" argument must be a function')
            'string' == typeof r && ((n = r), (r = null)),
              (i = (function (t) {
                var e
                try {
                  t()
                } catch (t) {
                  e = t
                }
                return e
              })(e)),
              (n =
                (r && r.name ? ' (' + r.name + ').' : '.') +
                (n ? ' ' + n : '.')),
              t && !i && y(i, r, 'Missing expected exception' + n)
            var o = 'string' == typeof n,
              u = !t && i && !r
            if (
              (((!t && a.isError(i) && o && _(i, r)) || u) &&
                y(i, r, 'Got unwanted exception' + n),
              (t && i && r && !_(i, r)) || (!t && i))
            )
              throw i
          }
          ;(h.AssertionError = function (t) {
            ;(this.name = 'AssertionError'),
              (this.actual = t.actual),
              (this.expected = t.expected),
              (this.operator = t.operator),
              t.message
                ? ((this.message = t.message), (this.generatedMessage = !1))
                : ((this.message = (function (t) {
                    return (
                      b(g(t.actual), 128) +
                      ' ' +
                      t.operator +
                      ' ' +
                      b(g(t.expected), 128)
                    )
                  })(this)),
                  (this.generatedMessage = !0))
            var e = t.stackStartFunction || y
            if (Error.captureStackTrace) Error.captureStackTrace(this, e)
            else {
              var r = new Error()
              if (r.stack) {
                var n = r.stack,
                  i = d(e),
                  o = n.indexOf('\n' + i)
                if (o >= 0) {
                  var a = n.indexOf('\n', o + 1)
                  n = n.substring(a + 1)
                }
                this.stack = n
              }
            }
          }),
            a.inherits(h.AssertionError, Error),
            (h.fail = y),
            (h.ok = v),
            (h.equal = function (t, e, r) {
              t != e && y(t, e, r, '==', h.equal)
            }),
            (h.notEqual = function (t, e, r) {
              t == e && y(t, e, r, '!=', h.notEqual)
            }),
            (h.deepEqual = function (t, e, r) {
              m(t, e, !1) || y(t, e, r, 'deepEqual', h.deepEqual)
            }),
            (h.deepStrictEqual = function (t, e, r) {
              m(t, e, !0) || y(t, e, r, 'deepStrictEqual', h.deepStrictEqual)
            }),
            (h.notDeepEqual = function (t, e, r) {
              m(t, e, !1) && y(t, e, r, 'notDeepEqual', h.notDeepEqual)
            }),
            (h.notDeepStrictEqual = function t(e, r, n) {
              m(e, r, !0) && y(e, r, n, 'notDeepStrictEqual', t)
            }),
            (h.strictEqual = function (t, e, r) {
              t !== e && y(t, e, r, '===', h.strictEqual)
            }),
            (h.notStrictEqual = function (t, e, r) {
              t === e && y(t, e, r, '!==', h.notStrictEqual)
            }),
            (h.throws = function (t, e, r) {
              E(!0, t, e, r)
            }),
            (h.doesNotThrow = function (t, e, r) {
              E(!1, t, e, r)
            }),
            (h.ifError = function (t) {
              if (t) throw t
            }),
            (h.strict = n(
              function t(e, r) {
                e || y(e, !0, r, '==', t)
              },
              h,
              {
                equal: h.strictEqual,
                deepEqual: h.deepStrictEqual,
                notEqual: h.notStrictEqual,
                notDeepEqual: h.notDeepStrictEqual
              }
            )),
            (h.strict.strict = h.strict)
          var x =
            Object.keys ||
            function (t) {
              var e = []
              for (var r in t) u.call(t, r) && e.push(r)
              return e
            }
        },
        function (t, e, r) {
          var n = Object.getOwnPropertySymbols,
            i = Object.prototype.hasOwnProperty,
            o = Object.prototype.propertyIsEnumerable
          t.exports = (function () {
            try {
              if (!Object.assign) return !1
              var t = new String('abc')
              if (((t[5] = 'de'), '5' === Object.getOwnPropertyNames(t)[0]))
                return !1
              for (var e = {}, r = 0; r < 10; r++)
                e['_' + String.fromCharCode(r)] = r
              if (
                '0123456789' !==
                Object.getOwnPropertyNames(e)
                  .map(function (t) {
                    return e[t]
                  })
                  .join('')
              )
                return !1
              var n = {}
              return (
                'abcdefghijklmnopqrst'.split('').forEach(function (t) {
                  n[t] = t
                }),
                'abcdefghijklmnopqrst' ===
                  Object.keys(Object.assign({}, n)).join('')
              )
            } catch (t) {
              return !1
            }
          })()
            ? Object.assign
            : function (t, e) {
                for (
                  var r,
                    a,
                    u = (function (t) {
                      if (null == t)
                        throw new TypeError(
                          'Object.assign cannot be called with null or undefined'
                        )
                      return Object(t)
                    })(t),
                    s = 1;
                  s < arguments.length;
                  s++
                ) {
                  for (var f in (r = Object(arguments[s])))
                    i.call(r, f) && (u[f] = r[f])
                  if (n) {
                    a = n(r)
                    for (var c = 0; c < a.length; c++)
                      o.call(r, a[c]) && (u[a[c]] = r[a[c]])
                  }
                }
                return u
              }
        },
        function (t, e) {
          t.exports = function (t) {
            return (
              t &&
              'object' == typeof t &&
              'function' == typeof t.copy &&
              'function' == typeof t.fill &&
              'function' == typeof t.readUInt8
            )
          }
        },
        function (t, e) {
          'function' == typeof Object.create
            ? (t.exports = function (t, e) {
                ;(t.super_ = e),
                  (t.prototype = Object.create(e.prototype, {
                    constructor: {
                      value: t,
                      enumerable: !1,
                      writable: !0,
                      configurable: !0
                    }
                  }))
              })
            : (t.exports = function (t, e) {
                t.super_ = e
                var r = function () {}
                ;(r.prototype = e.prototype),
                  (t.prototype = new r()),
                  (t.prototype.constructor = t)
              })
        },
        function (t, e) {},
        function (t, e, r) {
          var n = r(12).Buffer,
            i = r(37)
          ;(t.exports = (function () {
            function t() {
              !(function (t, e) {
                if (!(t instanceof e))
                  throw new TypeError('Cannot call a class as a function')
              })(this, t),
                (this.head = null),
                (this.tail = null),
                (this.length = 0)
            }
            return (
              (t.prototype.push = function (t) {
                var e = { data: t, next: null }
                this.length > 0 ? (this.tail.next = e) : (this.head = e),
                  (this.tail = e),
                  ++this.length
              }),
              (t.prototype.unshift = function (t) {
                var e = { data: t, next: this.head }
                0 === this.length && (this.tail = e),
                  (this.head = e),
                  ++this.length
              }),
              (t.prototype.shift = function () {
                if (0 !== this.length) {
                  var t = this.head.data
                  return (
                    1 === this.length
                      ? (this.head = this.tail = null)
                      : (this.head = this.head.next),
                    --this.length,
                    t
                  )
                }
              }),
              (t.prototype.clear = function () {
                ;(this.head = this.tail = null), (this.length = 0)
              }),
              (t.prototype.join = function (t) {
                if (0 === this.length) return ''
                for (var e = this.head, r = '' + e.data; (e = e.next); )
                  r += t + e.data
                return r
              }),
              (t.prototype.concat = function (t) {
                if (0 === this.length) return n.alloc(0)
                if (1 === this.length) return this.head.data
                for (
                  var e, r, i, o = n.allocUnsafe(t >>> 0), a = this.head, u = 0;
                  a;

                )
                  (e = a.data),
                    (r = o),
                    (i = u),
                    e.copy(r, i),
                    (u += a.data.length),
                    (a = a.next)
                return o
              }),
              t
            )
          })()),
            i &&
              i.inspect &&
              i.inspect.custom &&
              (t.exports.prototype[i.inspect.custom] = function () {
                var t = i.inspect({ length: this.length })
                return this.constructor.name + ' ' + t
              })
        },
        function (t, e) {},
        function (t, e, r) {
          ;(function (t) {
            !(function (e, r) {
              if (!e.setImmediate) {
                var n,
                  i,
                  o,
                  a,
                  u,
                  s = 1,
                  f = {},
                  c = !1,
                  l = e.document,
                  h = Object.getPrototypeOf && Object.getPrototypeOf(e)
                ;(h = h && h.setTimeout ? h : e),
                  '[object process]' === {}.toString.call(e.process)
                    ? (n = function (e) {
                        t.nextTick(function () {
                          d(e)
                        })
                      })
                    : !(function () {
                        if (e.postMessage && !e.importScripts) {
                          var t = !0,
                            r = e.onmessage
                          return (
                            (e.onmessage = function () {
                              t = !1
                            }),
                            e.postMessage('', '*'),
                            (e.onmessage = r),
                            t
                          )
                        }
                      })()
                    ? e.MessageChannel
                      ? (((o = new MessageChannel()).port1.onmessage =
                          function (t) {
                            d(t.data)
                          }),
                        (n = function (t) {
                          o.port2.postMessage(t)
                        }))
                      : l && 'onreadystatechange' in l.createElement('script')
                      ? ((i = l.documentElement),
                        (n = function (t) {
                          var e = l.createElement('script')
                          ;(e.onreadystatechange = function () {
                            d(t),
                              (e.onreadystatechange = null),
                              i.removeChild(e),
                              (e = null)
                          }),
                            i.appendChild(e)
                        }))
                      : (n = function (t) {
                          setTimeout(d, 0, t)
                        })
                    : ((a = 'setImmediate$' + Math.random() + '$'),
                      (u = function (t) {
                        t.source === e &&
                          'string' == typeof t.data &&
                          0 === t.data.indexOf(a) &&
                          d(+t.data.slice(a.length))
                      }),
                      e.addEventListener
                        ? e.addEventListener('message', u, !1)
                        : e.attachEvent('onmessage', u),
                      (n = function (t) {
                        e.postMessage(a + t, '*')
                      })),
                  (h.setImmediate = function (t) {
                    'function' != typeof t && (t = new Function('' + t))
                    for (
                      var e = new Array(arguments.length - 1), r = 0;
                      r < e.length;
                      r++
                    )
                      e[r] = arguments[r + 1]
                    var i = { callback: t, args: e }
                    return (f[s] = i), n(s), s++
                  }),
                  (h.clearImmediate = p)
              }
              function p(t) {
                delete f[t]
              }
              function d(t) {
                if (c) setTimeout(d, 0, t)
                else {
                  var e = f[t]
                  if (e) {
                    c = !0
                    try {
                      !(function (t) {
                        var e = t.callback,
                          n = t.args
                        switch (n.length) {
                          case 0:
                            e()
                            break
                          case 1:
                            e(n[0])
                            break
                          case 2:
                            e(n[0], n[1])
                            break
                          case 3:
                            e(n[0], n[1], n[2])
                            break
                          default:
                            e.apply(r, n)
                        }
                      })(e)
                    } finally {
                      p(t), (c = !1)
                    }
                  }
                }
              }
            })(
              'undefined' == typeof self
                ? 'undefined' == typeof window
                  ? this
                  : window
                : self
            )
          }).call(this, r(6))
        },
        function (t, e) {
          function r(t) {
            try {
              if (!window.localStorage) return !1
            } catch (t) {
              return !1
            }
            var e = window.localStorage[t]
            return null != e && 'true' === String(e).toLowerCase()
          }
          t.exports = function (t, e) {
            if (r('noDeprecation')) return t
            var n = !1
            return function () {
              if (!n) {
                if (r('throwDeprecation')) throw new Error(e)
                r('traceDeprecation') ? console.trace(e) : console.warn(e),
                  (n = !0)
              }
              return t.apply(this, arguments)
            }
          }
        },
        function (t, e, r) {
          var n = r(3),
            i = n.Buffer
          function o(t, e) {
            for (var r in t) e[r] = t[r]
          }
          function a(t, e, r) {
            return i(t, e, r)
          }
          i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow
            ? (t.exports = n)
            : (o(n, e), (e.Buffer = a)),
            o(i, a),
            (a.from = function (t, e, r) {
              if ('number' == typeof t)
                throw new TypeError('Argument must not be a number')
              return i(t, e, r)
            }),
            (a.alloc = function (t, e, r) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              var n = i(t)
              return (
                void 0 !== e
                  ? 'string' == typeof r
                    ? n.fill(e, r)
                    : n.fill(e)
                  : n.fill(0),
                n
              )
            }),
            (a.allocUnsafe = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return i(t)
            }),
            (a.allocUnsafeSlow = function (t) {
              if ('number' != typeof t)
                throw new TypeError('Argument must be a number')
              return n.SlowBuffer(t)
            })
        },
        function (t, e, r) {
          t.exports = o
          var n = r(22),
            i = Object.create(r(7))
          function o(t) {
            if (!(this instanceof o)) return new o(t)
            n.call(this, t)
          }
          ;(i.inherits = r(4)),
            i.inherits(o, n),
            (o.prototype._transform = function (t, e, r) {
              r(null, t)
            })
        },
        function (t, e, r) {
          var n = r(14).Transform,
            i = r(4),
            o = r(8)
          function a(t) {
            ;((t = t || {}).objectMode = !0),
              (t.highWaterMark = 16),
              n.call(this, t),
              (this._msgpack = t.msgpack)
          }
          function u(t) {
            if (!(this instanceof u))
              return ((t = t || {}).msgpack = this), new u(t)
            a.call(this, t), (this._wrap = 'wrap' in t && t.wrap)
          }
          function s(t) {
            if (!(this instanceof s))
              return ((t = t || {}).msgpack = this), new s(t)
            a.call(this, t),
              (this._chunks = o()),
              (this._wrap = 'wrap' in t && t.wrap)
          }
          i(a, n),
            i(u, a),
            (u.prototype._transform = function (t, e, r) {
              var n = null
              try {
                n = this._msgpack.encode(this._wrap ? t.value : t).slice(0)
              } catch (t) {
                return this.emit('error', t), r()
              }
              this.push(n), r()
            }),
            i(s, a),
            (s.prototype._transform = function (t, e, r) {
              t && this._chunks.append(t)
              try {
                var n = this._msgpack.decode(this._chunks)
                this._wrap && (n = { value: n }), this.push(n)
              } catch (t) {
                return void (t instanceof this._msgpack.IncompleteBufferError
                  ? r()
                  : this.emit('error', t))
              }
              this._chunks.length > 0 ? this._transform(null, e, r) : r()
            }),
            (t.exports.decoder = s),
            (t.exports.encoder = u)
        },
        function (t, e, r) {
          var n = r(8)
          function i(t) {
            Error.call(this),
              Error.captureStackTrace &&
                Error.captureStackTrace(this, this.constructor),
              (this.name = this.constructor.name),
              (this.message = t || 'unable to decode')
          }
          r(11).inherits(i, Error),
            (t.exports = function (t, e) {
              return function (t) {
                t instanceof n || (t = n().append(t))
                var e = a(t)
                if (e) return t.consume(e.bytesConsumed), e.value
                throw new i()
              }
              function r(t, e, r) {
                return e >= r + t
              }
              function o(t, e) {
                return { value: t, bytesConsumed: e }
              }
              function a(t, e) {
                e = void 0 === e ? 0 : e
                var n = t.length - e
                if (n <= 0) return null
                var i,
                  a,
                  l,
                  h = t.readUInt8(e),
                  p = 0
                if (
                  !(function (t, e) {
                    var r = (function (t) {
                      switch (t) {
                        case 196:
                        case 204:
                        case 208:
                        case 217:
                          return 2
                        case 197:
                        case 199:
                        case 205:
                        case 209:
                        case 212:
                        case 218:
                        case 222:
                          return 3
                        case 198:
                        case 202:
                        case 206:
                        case 210:
                        case 219:
                          return 5
                        case 200:
                        case 213:
                          return 4
                        case 201:
                        case 214:
                          return 6
                        case 203:
                        case 207:
                        case 211:
                          return 9
                        case 215:
                          return 10
                        case 216:
                          return 18
                        default:
                          return -1
                      }
                    })(t)
                    return !(-1 !== r && e < r)
                  })(h, n)
                )
                  return null
                switch (h) {
                  case 192:
                    return o(null, 1)
                  case 194:
                    return o(!1, 1)
                  case 195:
                    return o(!0, 1)
                  case 204:
                    return o((p = t.readUInt8(e + 1)), 2)
                  case 205:
                    return o((p = t.readUInt16BE(e + 1)), 3)
                  case 206:
                    return o((p = t.readUInt32BE(e + 1)), 5)
                  case 207:
                    for (l = 7; l >= 0; l--)
                      p += t.readUInt8(e + l + 1) * Math.pow(2, 8 * (7 - l))
                    return o(p, 9)
                  case 208:
                    return o((p = t.readInt8(e + 1)), 2)
                  case 209:
                    return o((p = t.readInt16BE(e + 1)), 3)
                  case 210:
                    return o((p = t.readInt32BE(e + 1)), 5)
                  case 211:
                    return (
                      (p = (function (t, e) {
                        var r = 128 == (128 & t[e])
                        if (r)
                          for (var n = 1, i = e + 7; i >= e; i--) {
                            var o = (255 ^ t[i]) + n
                            ;(t[i] = 255 & o), (n = o >> 8)
                          }
                        var a = t.readUInt32BE(e + 0),
                          u = t.readUInt32BE(e + 4)
                        return (4294967296 * a + u) * (r ? -1 : 1)
                      })(t.slice(e + 1, e + 9), 0)),
                      o(p, 9)
                    )
                  case 202:
                    return o((p = t.readFloatBE(e + 1)), 5)
                  case 203:
                    return o((p = t.readDoubleBE(e + 1)), 9)
                  case 217:
                    return r((i = t.readUInt8(e + 1)), n, 2)
                      ? o((p = t.toString('utf8', e + 2, e + 2 + i)), 2 + i)
                      : null
                  case 218:
                    return r((i = t.readUInt16BE(e + 1)), n, 3)
                      ? o((p = t.toString('utf8', e + 3, e + 3 + i)), 3 + i)
                      : null
                  case 219:
                    return r((i = t.readUInt32BE(e + 1)), n, 5)
                      ? o((p = t.toString('utf8', e + 5, e + 5 + i)), 5 + i)
                      : null
                  case 196:
                    return r((i = t.readUInt8(e + 1)), n, 2)
                      ? o((p = t.slice(e + 2, e + 2 + i)), 2 + i)
                      : null
                  case 197:
                    return r((i = t.readUInt16BE(e + 1)), n, 3)
                      ? o((p = t.slice(e + 3, e + 3 + i)), 3 + i)
                      : null
                  case 198:
                    return r((i = t.readUInt32BE(e + 1)), n, 5)
                      ? o((p = t.slice(e + 5, e + 5 + i)), 5 + i)
                      : null
                  case 220:
                    return n < 3
                      ? null
                      : ((i = t.readUInt16BE(e + 1)), u(t, e, i, 3))
                  case 221:
                    return n < 5
                      ? null
                      : ((i = t.readUInt32BE(e + 1)), u(t, e, i, 5))
                  case 222:
                    return (i = t.readUInt16BE(e + 1)), s(t, e, i, 3)
                  case 223:
                    return (i = t.readUInt32BE(e + 1)), s(t, e, i, 5)
                  case 212:
                    return f(t, e, 1)
                  case 213:
                    return f(t, e, 2)
                  case 214:
                    return f(t, e, 4)
                  case 215:
                    return f(t, e, 8)
                  case 216:
                    return f(t, e, 16)
                  case 199:
                    return (
                      (i = t.readUInt8(e + 1)),
                      (a = t.readUInt8(e + 2)),
                      r(i, n, 3) ? c(t, e, a, i, 3) : null
                    )
                  case 200:
                    return (
                      (i = t.readUInt16BE(e + 1)),
                      (a = t.readUInt8(e + 3)),
                      r(i, n, 4) ? c(t, e, a, i, 4) : null
                    )
                  case 201:
                    return (
                      (i = t.readUInt32BE(e + 1)),
                      (a = t.readUInt8(e + 5)),
                      r(i, n, 6) ? c(t, e, a, i, 6) : null
                    )
                }
                if (144 == (240 & h)) return u(t, e, (i = 15 & h), 1)
                if (128 == (240 & h)) return s(t, e, (i = 15 & h), 1)
                if (160 == (224 & h))
                  return r((i = 31 & h), n, 1)
                    ? o((p = t.toString('utf8', e + 1, e + i + 1)), i + 1)
                    : null
                if (h >= 224) return o((p = h - 256), 1)
                if (h < 128) return o(h, 1)
                throw new Error('not implemented yet')
              }
              function u(t, e, r, n) {
                var i,
                  u = [],
                  s = 0
                for (e += n, i = 0; i < r; i++) {
                  var f = a(t, e)
                  if (!f) return null
                  u.push(f.value),
                    (e += f.bytesConsumed),
                    (s += f.bytesConsumed)
                }
                return o(u, n + s)
              }
              function s(t, r, n, i) {
                var u,
                  s,
                  f = {},
                  c = 0
                for (r += i, s = 0; s < n; s++) {
                  var l = a(t, r)
                  if (!l) return null
                  var h = a(t, (r += l.bytesConsumed))
                  if (!h) return null
                  if ('__proto__' === (u = l.value)) {
                    if ('error' === e.protoAction)
                      throw new SyntaxError(
                        'Object contains forbidden prototype property'
                      )
                    if ('remove' === e.protoAction) continue
                  }
                  ;(f[u] = h.value),
                    (r += h.bytesConsumed),
                    (c += l.bytesConsumed + h.bytesConsumed)
                }
                return o(f, i + c)
              }
              function f(t, e, r) {
                var n = t.readInt8(e + 1)
                return c(t, e, n, r, 2)
              }
              function c(e, r, n, i, a) {
                var u, s
                if (((r += a), n < 0 && -1 === n))
                  return (function (t, e, r) {
                    var n,
                      i = 0
                    switch (e) {
                      case 4:
                        n = t.readUInt32BE(0)
                        break
                      case 8:
                        var a = t.readUInt32BE(0),
                          u = t.readUInt32BE(4)
                        ;(i = a / 4), (n = (3 & a) * Math.pow(2, 32) + u)
                        break
                      case 12:
                        throw new Error('timestamp 96 is not yet implemented')
                    }
                    var s = 1e3 * n + Math.round(i / 1e6)
                    return o(new Date(s), e + r)
                  })((s = e.slice(r, r + i)), i, a)
                for (u = 0; u < t.length; u++) {
                  if (n === t[u].type)
                    return (s = e.slice(r, r + i)), o(t[u].decode(s), a + i)
                }
                throw new Error('unable to find ext type ' + n)
              }
            }),
            (t.exports.IncompleteBufferError = i)
        },
        function (t, e, r) {
          var n = r(10).Buffer,
            i = r(8)
          function o(t, e) {
            var r,
              i = !0
            return (
              Math.fround && (i = Math.fround(t) !== t),
              e && (i = !0),
              i
                ? (((r = n.allocUnsafe(9))[0] = 203), r.writeDoubleBE(t, 1))
                : (((r = n.allocUnsafe(5))[0] = 202), r.writeFloatBE(t, 1)),
              r
            )
          }
          t.exports = function (t, e, r, a) {
            function u(s, f) {
              var c, l, h
              if (void 0 === s)
                throw new Error('undefined is not encodable in msgpack!')
              if ((h = s) != h && 'number' == typeof h)
                throw new Error('NaN is not encodable in msgpack!')
              if (null === s) (c = n.allocUnsafe(1))[0] = 192
              else if (!0 === s) (c = n.allocUnsafe(1))[0] = 195
              else if (!1 === s) (c = n.allocUnsafe(1))[0] = 194
              else if ('string' == typeof s)
                (l = n.byteLength(s)) < 32
                  ? (((c = n.allocUnsafe(1 + l))[0] = 160 | l),
                    l > 0 && c.write(s, 1))
                  : l <= 255 && !r
                  ? (((c = n.allocUnsafe(2 + l))[0] = 217),
                    (c[1] = l),
                    c.write(s, 2))
                  : l <= 65535
                  ? (((c = n.allocUnsafe(3 + l))[0] = 218),
                    c.writeUInt16BE(l, 1),
                    c.write(s, 3))
                  : (((c = n.allocUnsafe(5 + l))[0] = 219),
                    c.writeUInt32BE(l, 1),
                    c.write(s, 5))
              else if (s && (s.readUInt32LE || s instanceof Uint8Array))
                s instanceof Uint8Array && (s = n.from(s)),
                  s.length <= 255
                    ? (((c = n.allocUnsafe(2))[0] = 196), (c[1] = s.length))
                    : s.length <= 65535
                    ? (((c = n.allocUnsafe(3))[0] = 197),
                      c.writeUInt16BE(s.length, 1))
                    : (((c = n.allocUnsafe(5))[0] = 198),
                      c.writeUInt32BE(s.length, 1)),
                  (c = i([c, s]))
              else if (Array.isArray(s))
                s.length < 16
                  ? ((c = n.allocUnsafe(1))[0] = 144 | s.length)
                  : s.length < 65536
                  ? (((c = n.allocUnsafe(3))[0] = 220),
                    c.writeUInt16BE(s.length, 1))
                  : (((c = n.allocUnsafe(5))[0] = 221),
                    c.writeUInt32BE(s.length, 1)),
                  (c = s.reduce(function (t, e) {
                    return t.append(u(e, !0)), t
                  }, i().append(c)))
              else {
                if (!a && 'function' == typeof s.getDate)
                  return (function (t) {
                    var e,
                      r = 1 * t,
                      o = Math.floor(r / 1e3),
                      a = 1e6 * (r - 1e3 * o)
                    if (a || o > 4294967295) {
                      ;((e = n.allocUnsafe(10))[0] = 215), (e[1] = -1)
                      var u = (4 * a + o / Math.pow(2, 32)) & 4294967295,
                        s = 4294967295 & o
                      e.writeInt32BE(u, 2), e.writeInt32BE(s, 6)
                    } else
                      ((e = n.allocUnsafe(6))[0] = 214),
                        (e[1] = -1),
                        e.writeUInt32BE(Math.floor(r / 1e3), 2)
                    return i().append(e)
                  })(s)
                if ('object' == typeof s)
                  c =
                    (function (e) {
                      var r,
                        o,
                        a = -1,
                        u = []
                      for (r = 0; r < t.length; r++)
                        if (t[r].check(e)) {
                          o = t[r].encode(e)
                          break
                        }
                      if (!o) return null
                      1 === (a = o.length - 1)
                        ? u.push(212)
                        : 2 === a
                        ? u.push(213)
                        : 4 === a
                        ? u.push(214)
                        : 8 === a
                        ? u.push(215)
                        : 16 === a
                        ? u.push(216)
                        : a < 256
                        ? (u.push(199), u.push(a))
                        : a < 65536
                        ? (u.push(200), u.push(a >> 8), u.push(255 & a))
                        : (u.push(201),
                          u.push(a >> 24),
                          u.push((a >> 16) & 255),
                          u.push((a >> 8) & 255),
                          u.push(255 & a))
                      return i().append(n.from(u)).append(o)
                    })(s) ||
                    (function (t) {
                      var e,
                        r,
                        o = [],
                        a = 0
                      for (e in t)
                        t.hasOwnProperty(e) &&
                          void 0 !== t[e] &&
                          'function' != typeof t[e] &&
                          (++a, o.push(u(e, !0)), o.push(u(t[e], !0)))
                      a < 16
                        ? ((r = n.allocUnsafe(1))[0] = 128 | a)
                        : a < 65535
                        ? (((r = n.allocUnsafe(3))[0] = 222),
                          r.writeUInt16BE(a, 1))
                        : (((r = n.allocUnsafe(5))[0] = 223),
                          r.writeUInt32BE(a, 1))
                      o.unshift(r)
                      var s = o.reduce(function (t, e) {
                        return t.append(e)
                      }, i())
                      return s
                    })(s)
                else if ('number' == typeof s) {
                  if (
                    (function (t) {
                      return t % 1 != 0
                    })(s)
                  )
                    return o(s, e)
                  if (s >= 0)
                    if (s < 128) (c = n.allocUnsafe(1))[0] = s
                    else if (s < 256)
                      ((c = n.allocUnsafe(2))[0] = 204), (c[1] = s)
                    else if (s < 65536)
                      ((c = n.allocUnsafe(3))[0] = 205), c.writeUInt16BE(s, 1)
                    else if (s <= 4294967295)
                      ((c = n.allocUnsafe(5))[0] = 206), c.writeUInt32BE(s, 1)
                    else {
                      if (!(s <= 9007199254740991)) return o(s, !0)
                      ;((c = n.allocUnsafe(9))[0] = 207),
                        (function (t, e) {
                          for (var r = 7; r >= 0; r--)
                            (t[r + 1] = 255 & e), (e /= 256)
                        })(c, s)
                    }
                  else if (s >= -32) (c = n.allocUnsafe(1))[0] = 256 + s
                  else if (s >= -128)
                    ((c = n.allocUnsafe(2))[0] = 208), c.writeInt8(s, 1)
                  else if (s >= -32768)
                    ((c = n.allocUnsafe(3))[0] = 209), c.writeInt16BE(s, 1)
                  else if (s > -214748365)
                    ((c = n.allocUnsafe(5))[0] = 210), c.writeInt32BE(s, 1)
                  else {
                    if (!(s >= -9007199254740991)) return o(s, !0)
                    ;((c = n.allocUnsafe(9))[0] = 211),
                      (function (t, e, r) {
                        var n = r < 0
                        n && (r = Math.abs(r))
                        var i = r % 4294967296,
                          o = r / 4294967296
                        if (
                          (t.writeUInt32BE(Math.floor(o), e + 0),
                          t.writeUInt32BE(i, e + 4),
                          n)
                        )
                          for (var a = 1, u = e + 7; u >= e; u--) {
                            var s = (255 ^ t[u]) + a
                            ;(t[u] = 255 & s), (a = s >> 8)
                          }
                      })(c, 1, s)
                  }
                }
              }
              if (!c) throw new Error('not implemented yet')
              return f ? c : c.slice()
            }
            return u
          }
        },
        function (t, e, r) {
          t.exports = r(46)
        },
        function (t, e, r) {
          ;(function (t) {
            ;(e.version = '1.0.0'),
              (e.encode = function (t) {
                return t
                  .toString('base64')
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=+$/, '')
              }),
              (e.decode = function (e) {
                return (
                  (e = (e += Array(5 - (e.length % 4)).join('='))
                    .replace(/\-/g, '+')
                    .replace(/\_/g, '/')),
                  new t(e, 'base64')
                )
              }),
              (e.validate = function (t) {
                return /^[A-Za-z0-9\-_]+$/.test(t)
              })
          }).call(this, r(3).Buffer)
        },
        function (t, e, r) {
          ;(function (t) {
            var e = (function () {
              function r(t, e) {
                postMessage({ action: qt, cbn: e, result: t })
              }
              function n(t) {
                var e = []
                return (e[t - 1] = void 0), e
              }
              function i(t, e) {
                return u(t[0] + e[0], t[1] + e[1])
              }
              function o(t, e) {
                return (function (t, e) {
                  var r, n
                  return (r = t * Yt), (n = e), 0 > e && (n += Yt), [n, r]
                })(
                  ~~Math.max(Math.min(t[1] / Yt, 2147483647), -2147483648) &
                    ~~Math.max(Math.min(e[1] / Yt, 2147483647), -2147483648),
                  c(t) & c(e)
                )
              }
              function a(t, e) {
                var r, n
                return t[0] == e[0] && t[1] == e[1]
                  ? 0
                  : ((r = 0 > t[1]),
                    (n = 0 > e[1]),
                    r && !n ? -1 : !r && n ? 1 : d(t, e)[1] < 0 ? -1 : 1)
              }
              function u(t, e) {
                var r, n
                for (
                  t %= 0x10000000000000000,
                    e =
                      (e %= 0x10000000000000000) -
                      (r = e % Yt) +
                      (n = Math.floor(t / Yt) * Yt),
                    t = t - n + r;
                  0 > t;

                )
                  (t += Yt), (e -= Yt)
                for (; t > 4294967295; ) (t -= Yt), (e += Yt)
                for (e %= 0x10000000000000000; e > 0x7fffffff00000000; )
                  e -= 0x10000000000000000
                for (; -0x8000000000000000 > e; ) e += 0x10000000000000000
                return [t, e]
              }
              function s(t, e) {
                return t[0] == e[0] && t[1] == e[1]
              }
              function f(t) {
                return t >= 0 ? [t, 0] : [t + Yt, -Yt]
              }
              function c(t) {
                return t[0] >= 2147483648
                  ? ~~Math.max(Math.min(t[0] - Yt, 2147483647), -2147483648)
                  : ~~Math.max(Math.min(t[0], 2147483647), -2147483648)
              }
              function l(t) {
                return 30 >= t ? 1 << t : l(30) * l(t - 30)
              }
              function h(t, e) {
                var r, n, i, o
                if (((e &= 63), s(t, Gt))) return e ? Jt : t
                if (0 > t[1]) throw Error('Neg')
                return (
                  (o = l(e)),
                  (n = (t[1] * o) % 0x10000000000000000),
                  (n += r = (i = t[0] * o) - (i % Yt)) >= 0x8000000000000000 &&
                    (n -= 0x10000000000000000),
                  [(i -= r), n]
                )
              }
              function p(t, e) {
                var r
                return (r = l((e &= 63))), u(Math.floor(t[0] / r), t[1] / r)
              }
              function d(t, e) {
                return u(t[0] - e[0], t[1] - e[1])
              }
              function b(t, e) {
                return (t.Mc = e), (t.Lc = 0), (t.Yb = e.length), t
              }
              function g(t) {
                return t.Lc >= t.Yb ? -1 : 255 & t.Mc[t.Lc++]
              }
              function y(t, e, r, n) {
                return t.Lc >= t.Yb
                  ? -1
                  : ((n = Math.min(n, t.Yb - t.Lc)),
                    E(t.Mc, t.Lc, e, r, n),
                    (t.Lc += n),
                    n)
              }
              function v(t) {
                return (t.Mc = n(32)), (t.Yb = 0), t
              }
              function m(t) {
                var e = t.Mc
                return (e.length = t.Yb), e
              }
              function w(t, e) {
                t.Mc[t.Yb++] = (e << 24) >> 24
              }
              function _(t, e, r, n) {
                E(e, r, t.Mc, t.Yb, n), (t.Yb += n)
              }
              function E(t, e, r, n, i) {
                for (var o = 0; i > o; ++o) r[n + o] = t[e + o]
              }
              function x(t, r, n, i, o) {
                var u, s
                if (a(i, Wt) < 0) throw Error('invalid length ' + i)
                for (
                  t.Tb = i,
                    (function (t, e) {
                      ;(function (t, e) {
                        t.ab = e
                        for (var r = 0; e > 1 << r; ++r);
                        t.$b = 2 * r
                      })(e, 1 << t.s),
                        (e.n = t.f),
                        (function (t, e) {
                          var r = t.X
                          ;(t.X = e),
                            t.b && r != t.X && ((t.wb = -1), (t.b = null))
                        })(e, t.m),
                        (e.eb = 0),
                        (e.fb = 3),
                        (e.Y = 2),
                        (e.y = 3)
                    })(o, (u = $({}))),
                    u.Gc = void 0 === e.disableEndMark,
                    (function (t, e) {
                      t.fc[0] = ((9 * (5 * t.Y + t.eb) + t.fb) << 24) >> 24
                      for (var r = 0; 4 > r; ++r)
                        t.fc[1 + r] = ((t.ab >> (8 * r)) << 24) >> 24
                      _(e, t.fc, 0, 5)
                    })(u, n),
                    s = 0;
                  64 > s;
                  s += 8
                )
                  w(n, 255 & c(p(i, s)))
                t.yb =
                  ((u.W = 0),
                  (u.oc = r),
                  (u.pc = 0),
                  (function (t) {
                    var e, r
                    t.b ||
                      ((e = {}),
                      (r = 4),
                      t.X || (r = 2),
                      (function (t, e) {
                        ;(t.qb = e > 2),
                          t.qb
                            ? ((t.w = 0), (t.xb = 4), (t.R = 66560))
                            : ((t.w = 2), (t.xb = 3), (t.R = 0))
                      })(e, r),
                      (t.b = e)),
                      pt(t.A, t.eb, t.fb),
                      (t.ab != t.wb || t.Hb != t.n) &&
                        (M(t.b, t.ab, 4096, t.n, 274),
                        (t.wb = t.ab),
                        (t.Hb = t.n))
                  })(u),
                  (u.d.Ab = n),
                  (function (t) {
                    ;(function (t) {
                      ;(t.l = 0), (t.J = 0)
                      for (var e = 0; 4 > e; ++e) t.v[e] = 0
                    })(t),
                      (function (t) {
                        ;(t.mc = Jt),
                          (t.xc = Jt),
                          (t.E = -1),
                          (t.Jb = 1),
                          (t.Oc = 0)
                      })(t.d),
                      Ut(t.C),
                      Ut(t._),
                      Ut(t.bb),
                      Ut(t.hb),
                      Ut(t.Ub),
                      Ut(t.vc),
                      Ut(t.Sb),
                      (function (t) {
                        var e,
                          r = 1 << (t.u + t.I)
                        for (e = 0; r > e; ++e) Ut(t.V[e].tb)
                      })(t.A)
                    for (var e = 0; 4 > e; ++e) Ut(t.K[e].G)
                    ut(t.$, 1 << t.Y),
                      ut(t.i, 1 << t.Y),
                      Ut(t.S.G),
                      (t.N = 0),
                      (t.jb = 0),
                      (t.q = 0),
                      (t.s = 0)
                  })(u),
                  K(u),
                  Q(u),
                  (u.$.rb = u.n + 1 - 2),
                  ht(u.$, 1 << u.Y),
                  (u.i.rb = u.n + 1 - 2),
                  ht(u.i, 1 << u.Y),
                  (u.g = Jt),
                  (function (t, e) {
                    return (t.cb = e), (t.Z = null), (t.zc = 1), t
                  })({}, u))
              }
              function S(t, e, r) {
                return (t.Nb = v({})), x(t, b({}, e), t.Nb, f(e.length), r), t
              }
              function k(t, e, r) {
                var n,
                  i,
                  o,
                  a,
                  u = '',
                  s = []
                for (i = 0; 5 > i; ++i) {
                  if (-1 == (o = g(e))) throw Error('truncated input')
                  s[i] = (o << 24) >> 24
                }
                if (
                  !(function (t, e) {
                    var r, n, i, o, a, u, s
                    if (5 > e.length) return 0
                    for (
                      s = 255 & e[0],
                        i = s % 9,
                        o = (u = ~~(s / 9)) % 5,
                        a = ~~(u / 5),
                        r = 0,
                        n = 0;
                      4 > n;
                      ++n
                    )
                      r += (255 & e[1 + n]) << (8 * n)
                    return r > 99999999 ||
                      !(function (t, e, r, n) {
                        if (e > 8 || r > 4 || n > 4) return 0
                        H(t.gb, r, e)
                        var i = 1 << n
                        return Y(t.Rb, i), Y(t.sb, i), (t.Dc = i - 1), 1
                      })(t, i, o, a)
                      ? 0
                      : (function (t, e) {
                          return 0 > e
                            ? 0
                            : (t.Ob != e &&
                                ((t.Ob = e),
                                (t.nb = Math.max(t.Ob, 1)),
                                I(t.B, Math.max(t.nb, 4096))),
                              1)
                        })(t, r)
                  })((n = F({})), s)
                )
                  throw Error('corrupted input')
                for (i = 0; 64 > i; i += 8) {
                  if (-1 == (o = g(e))) throw Error('truncated input')
                  1 == (o = o.toString(16)).length && (o = '0' + o),
                    (u = o + '' + u)
                }
                ;/^0+$|^f+$/i.test(u)
                  ? (t.Tb = Wt)
                  : ((a = parseInt(u, 16)),
                    (t.Tb = a > 4294967295 ? Wt : f(a))),
                  (t.yb = (function (t, e, r, n) {
                    return (
                      (t.e.Ab = e),
                      N(t.B),
                      (t.B.cc = r),
                      (function (t) {
                        ;(t.B.h = 0),
                          (t.B.o = 0),
                          Ut(t.Gb),
                          Ut(t.pb),
                          Ut(t.Zb),
                          Ut(t.Cb),
                          Ut(t.Db),
                          Ut(t.Eb),
                          Ut(t.kc),
                          (function (t) {
                            var e, r
                            for (r = 1 << (t.u + t.I), e = 0; r > e; ++e)
                              Ut(t.V[e].Ib)
                          })(t.gb)
                        for (var e = 0; 4 > e; ++e) Ut(t.kb[e].G)
                        J(t.Rb),
                          J(t.sb),
                          Ut(t.Fb.G),
                          (function (t) {
                            ;(t.Bb = 0), (t.E = -1)
                            for (var e = 0; 5 > e; ++e)
                              t.Bb = (t.Bb << 8) | g(t.Ab)
                          })(t.e)
                      })(t),
                      (t.U = 0),
                      (t.ib = 0),
                      (t.Jc = 0),
                      (t.Ic = 0),
                      (t.Qc = 0),
                      (t.Nc = n),
                      (t.g = Jt),
                      (t.jc = 0),
                      (function (t, e) {
                        return (t.Z = e), (t.cb = null), (t.zc = 1), t
                      })({}, t)
                    )
                  })(n, e, r, t.Tb))
              }
              function A(t, e) {
                return (t.Nb = v({})), k(t, b({}, e), t.Nb), t
              }
              function T(t, e) {
                return t.c[t.f + t.o + e]
              }
              function O(t, e, r, n) {
                var i, o
                for (
                  t.T && t.o + e + n > t.h && (n = t.h - (t.o + e)),
                    ++r,
                    o = t.f + t.o + e,
                    i = 0;
                  n > i && t.c[o + i] == t.c[o + i - r];
                  ++i
                );
                return i
              }
              function j(t) {
                return t.h - t.o
              }
              function U(t) {
                var e, r
                if (!t.T)
                  for (;;) {
                    if (!(r = -t.f + t.Kb - t.h)) return
                    if (-1 == (e = y(t.cc, t.c, t.f + t.h, r)))
                      return (
                        (t.zb = t.h),
                        t.f + t.zb > t.H && (t.zb = t.H - t.f),
                        void (t.T = 1)
                      )
                    ;(t.h += e), t.h >= t.o + t._b && (t.zb = t.h - t._b)
                  }
              }
              function B(t, e) {
                ;(t.f += e), (t.zb -= e), (t.o -= e), (t.h -= e)
              }
              function M(t, e, r, i, o) {
                var a, u
                1073741567 > e &&
                  ((t.Fc = 16 + (i >> 1)),
                  (function (t, e, r, i) {
                    var o
                    ;(t.Bc = e),
                      (t._b = r),
                      (o = e + r + i),
                      (null == t.c || t.Kb != o) &&
                        ((t.c = null), (t.Kb = o), (t.c = n(t.Kb))),
                      (t.H = t.Kb - r)
                  })(t, e + r, i + o, 256 + ~~((e + r + i + o) / 2)),
                  (t.ob = i),
                  (a = e + 1),
                  t.p != a && (t.L = n(2 * (t.p = a))),
                  (u = 65536),
                  t.qb &&
                    ((u = e - 1),
                    (u |= u >> 1),
                    (u |= u >> 2),
                    (u |= u >> 4),
                    (u |= u >> 8),
                    (u >>= 1),
                    (u |= 65535) > 16777216 && (u >>= 1),
                    (t.Ec = u),
                    ++u,
                    (u += t.R)),
                  u != t.rc && (t.ub = n((t.rc = u))))
              }
              function L(t) {
                var e
                ++t.k >= t.p && (t.k = 0),
                  (function (t) {
                    ++t.o,
                      t.o > t.zb &&
                        (t.f + t.o > t.H &&
                          (function (t) {
                            var e, r, n
                            for (
                              (n = t.f + t.o - t.Bc) > 0 && --n,
                                r = t.f + t.h - n,
                                e = 0;
                              r > e;
                              ++e
                            )
                              t.c[e] = t.c[n + e]
                            t.f -= n
                          })(t),
                        U(t))
                  })(t),
                  1073741823 == t.o &&
                    ((e = t.o - t.p),
                    R(t.L, 2 * t.p, e),
                    R(t.ub, t.rc, e),
                    B(t, e))
              }
              function R(t, e, r) {
                var n, i
                for (n = 0; e > n; ++n)
                  r >= (i = t[n] || 0) ? (i = 0) : (i -= r), (t[n] = i)
              }
              function I(t, e) {
                ;(null == t.Lb || t.M != e) && (t.Lb = n(e)),
                  (t.M = e),
                  (t.o = 0),
                  (t.h = 0)
              }
              function P(t) {
                var e = t.o - t.h
                e &&
                  (_(t.cc, t.Lb, t.h, e), t.o >= t.M && (t.o = 0), (t.h = t.o))
              }
              function C(t, e) {
                var r = t.o - e - 1
                return 0 > r && (r += t.M), t.Lb[r]
              }
              function N(t) {
                P(t), (t.cc = null)
              }
              function D(t) {
                return 4 > (t -= 2) ? t : 3
              }
              function z(t) {
                return 4 > t ? 0 : 10 > t ? t - 3 : t - 6
              }
              function q(t) {
                if (!t.zc) throw Error('bad state')
                return (
                  t.cb
                    ? (function (t) {
                        ;(function (t, e, r, n) {
                          var o, u, l, h, p, b, g, y, v, m, w, _, E, x, S
                          if (
                            ((e[0] = Jt),
                            (r[0] = Jt),
                            (n[0] = 1),
                            t.oc &&
                              ((t.b.cc = t.oc),
                              (function (t) {
                                ;(t.f = 0),
                                  (t.o = 0),
                                  (t.h = 0),
                                  (t.T = 0),
                                  U(t),
                                  (t.k = 0),
                                  B(t, -1)
                              })(t.b),
                              (t.W = 1),
                              (t.oc = null)),
                            !t.pc)
                          ) {
                            if (((t.pc = 1), (x = t.g), s(t.g, Jt))) {
                              if (!j(t.b)) return void X(t, c(t.g))
                              it(t),
                                (E = c(t.g) & t.y),
                                Bt(t.d, t.C, (t.l << 4) + E, 0),
                                (t.l = z(t.l)),
                                (l = T(t.b, -t.s)),
                                bt(dt(t.A, c(t.g), t.J), t.d, l),
                                (t.J = l),
                                --t.s,
                                (t.g = i(t.g, Ht))
                            }
                            if (!j(t.b)) return void X(t, c(t.g))
                            for (;;) {
                              if (
                                ((g = tt(t, c(t.g))),
                                (m = t.mb),
                                (E = c(t.g) & t.y),
                                (u = (t.l << 4) + E),
                                1 == g && -1 == m)
                              )
                                Bt(t.d, t.C, u, 0),
                                  (l = T(t.b, -t.s)),
                                  (S = dt(t.A, c(t.g), t.J)),
                                  7 > t.l
                                    ? bt(S, t.d, l)
                                    : ((v = T(t.b, -t.v[0] - 1 - t.s)),
                                      gt(S, t.d, v, l)),
                                  (t.J = l),
                                  (t.l = z(t.l))
                              else {
                                if ((Bt(t.d, t.C, u, 1), 4 > m)) {
                                  if (
                                    (Bt(t.d, t.bb, t.l, 1),
                                    m
                                      ? (Bt(t.d, t.hb, t.l, 1),
                                        1 == m
                                          ? Bt(t.d, t.Ub, t.l, 0)
                                          : (Bt(t.d, t.Ub, t.l, 1),
                                            Bt(t.d, t.vc, t.l, m - 2)))
                                      : (Bt(t.d, t.hb, t.l, 0),
                                        Bt(t.d, t._, u, 1 == g ? 0 : 1)),
                                    1 == g
                                      ? (t.l = 7 > t.l ? 9 : 11)
                                      : (ft(t.i, t.d, g - 2, E),
                                        (t.l = 7 > t.l ? 8 : 11)),
                                    (h = t.v[m]),
                                    0 != m)
                                  ) {
                                    for (b = m; b >= 1; --b) t.v[b] = t.v[b - 1]
                                    t.v[0] = h
                                  }
                                } else {
                                  for (
                                    Bt(t.d, t.bb, t.l, 0),
                                      t.l = 7 > t.l ? 7 : 10,
                                      ft(t.$, t.d, g - 2, E),
                                      _ = at((m -= 4)),
                                      y = D(g),
                                      xt(t.K[y], t.d, _),
                                      _ >= 4 &&
                                        ((w =
                                          m -
                                          (o =
                                            (2 | (1 & _)) <<
                                            (p = (_ >> 1) - 1))),
                                        14 > _
                                          ? Tt(t.Sb, o - _ - 1, t.d, p, w)
                                          : (Mt(t.d, w >> 4, p - 4),
                                            kt(t.S, t.d, 15 & w),
                                            ++t.Qb)),
                                      h = m,
                                      b = 3;
                                    b >= 1;
                                    --b
                                  )
                                    t.v[b] = t.v[b - 1]
                                  ;(t.v[0] = h), ++t.Mb
                                }
                                t.J = T(t.b, g - 1 - t.s)
                              }
                              if (((t.s -= g), (t.g = i(t.g, f(g))), !t.s)) {
                                if (
                                  (t.Mb >= 128 && K(t),
                                  t.Qb >= 16 && Q(t),
                                  (e[0] = t.g),
                                  (r[0] = Lt(t.d)),
                                  !j(t.b))
                                )
                                  return void X(t, c(t.g))
                                if (a(d(t.g, x), [4096, 0]) >= 0)
                                  return (t.pc = 0), void (n[0] = 0)
                              }
                            }
                          }
                        })(t.cb, t.cb.Xb, t.cb.uc, t.cb.Kc),
                          (t.Pb = t.cb.Xb[0]),
                          t.cb.Kc[0] &&
                            ((function (t) {
                              ot(t), (t.d.Ab = null)
                            })(t.cb),
                            (t.zc = 0))
                      })(t)
                    : (function (t) {
                        var e = (function (t) {
                          var e, r, n, o, u, s
                          if (
                            ((s = c(t.g) & t.Dc), jt(t.e, t.Gb, (t.U << 4) + s))
                          ) {
                            if (jt(t.e, t.Zb, t.U))
                              (n = 0),
                                jt(t.e, t.Cb, t.U)
                                  ? (jt(t.e, t.Db, t.U)
                                      ? (jt(t.e, t.Eb, t.U)
                                          ? ((r = t.Qc), (t.Qc = t.Ic))
                                          : (r = t.Ic),
                                        (t.Ic = t.Jc))
                                      : (r = t.Jc),
                                    (t.Jc = t.ib),
                                    (t.ib = r))
                                  : jt(t.e, t.pb, (t.U << 4) + s) ||
                                    ((t.U = 7 > t.U ? 9 : 11), (n = 1)),
                                n ||
                                  ((n = W(t.sb, t.e, s) + 2),
                                  (t.U = 7 > t.U ? 8 : 11))
                            else if (
                              ((t.Qc = t.Ic),
                              (t.Ic = t.Jc),
                              (t.Jc = t.ib),
                              (n = 2 + W(t.Rb, t.e, s)),
                              (t.U = 7 > t.U ? 7 : 10),
                              (u = _t(t.kb[D(n)], t.e)) >= 4)
                            ) {
                              if (
                                ((o = (u >> 1) - 1),
                                (t.ib = (2 | (1 & u)) << o),
                                14 > u)
                              )
                                t.ib += (function (t, e, r, n) {
                                  var i,
                                    o,
                                    a = 1,
                                    u = 0
                                  for (o = 0; n > o; ++o)
                                    (i = jt(r, t, e + a)),
                                      (a <<= 1),
                                      (a += i),
                                      (u |= i << o)
                                  return u
                                })(t.kc, t.ib - u - 1, t.e, o)
                              else if (
                                ((t.ib +=
                                  (function (t, e) {
                                    var r,
                                      n,
                                      i = 0
                                    for (r = e; 0 != r; --r)
                                      (t.E >>>= 1),
                                        (n = (t.Bb - t.E) >>> 31),
                                        (t.Bb -= t.E & (n - 1)),
                                        (i = (i << 1) | (1 - n)),
                                        -16777216 & t.E ||
                                          ((t.Bb = (t.Bb << 8) | g(t.Ab)),
                                          (t.E <<= 8))
                                    return i
                                  })(t.e, o - 4) << 4),
                                (t.ib += (function (t, e) {
                                  var r,
                                    n,
                                    i = 1,
                                    o = 0
                                  for (n = 0; t.F > n; ++n)
                                    (r = jt(e, t.G, i)),
                                      (i <<= 1),
                                      (i += r),
                                      (o |= r << n)
                                  return o
                                })(t.Fb, t.e)),
                                0 > t.ib)
                              )
                                return -1 == t.ib ? 1 : -1
                            } else t.ib = u
                            if (a(f(t.ib), t.g) >= 0 || t.ib >= t.nb) return -1
                            ;(function (t, e, r) {
                              var n = t.o - e - 1
                              for (0 > n && (n += t.M); 0 != r; --r)
                                n >= t.M && (n = 0),
                                  (t.Lb[t.o++] = t.Lb[n++]),
                                  t.o >= t.M && P(t)
                            })(t.B, t.ib, n),
                              (t.g = i(t.g, f(n))),
                              (t.jc = C(t.B, 0))
                          } else
                            (e = (function (t, e, r) {
                              return t.V[
                                ((e & t.qc) << t.u) + ((255 & r) >>> (8 - t.u))
                              ]
                            })(t.gb, c(t.g), t.jc)),
                              (t.jc =
                                7 > t.U
                                  ? (function (t, e) {
                                      var r = 1
                                      do {
                                        r = (r << 1) | jt(e, t.Ib, r)
                                      } while (256 > r)
                                      return (r << 24) >> 24
                                    })(e, t.e)
                                  : (function (t, e, r) {
                                      var n,
                                        i,
                                        o = 1
                                      do {
                                        if (
                                          ((i = (r >> 7) & 1),
                                          (r <<= 1),
                                          (n = jt(e, t.Ib, ((1 + i) << 8) + o)),
                                          (o = (o << 1) | n),
                                          i != n)
                                        ) {
                                          for (; 256 > o; )
                                            o = (o << 1) | jt(e, t.Ib, o)
                                          break
                                        }
                                      } while (256 > o)
                                      return (o << 24) >> 24
                                    })(e, t.e, C(t.B, t.ib))),
                              (function (t, e) {
                                ;(t.Lb[t.o++] = e), t.o >= t.M && P(t)
                              })(t.B, t.jc),
                              (t.U = z(t.U)),
                              (t.g = i(t.g, Ht))
                          return 0
                        })(t.Z)
                        if (-1 == e) throw Error('corrupted input')
                        ;(t.Pb = Wt),
                          (t.Pc = t.Z.g),
                          (e ||
                            (a(t.Z.Nc, Jt) >= 0 && a(t.Z.g, t.Z.Nc) >= 0)) &&
                            (P(t.Z.B), N(t.Z.B), (t.Z.e.Ab = null), (t.zc = 0))
                      })(t),
                  t.zc
                )
              }
              function F(t) {
                ;(t.B = {}),
                  (t.e = {}),
                  (t.Gb = n(192)),
                  (t.Zb = n(12)),
                  (t.Cb = n(12)),
                  (t.Db = n(12)),
                  (t.Eb = n(12)),
                  (t.pb = n(192)),
                  (t.kb = n(4)),
                  (t.kc = n(114)),
                  (t.Fb = wt({}, 4)),
                  (t.Rb = G({})),
                  (t.sb = G({})),
                  (t.gb = {})
                for (var e = 0; 4 > e; ++e) t.kb[e] = wt({}, 6)
                return t
              }
              function Y(t, e) {
                for (; e > t.O; ++t.O)
                  (t.ec[t.O] = wt({}, 3)), (t.hc[t.O] = wt({}, 3))
              }
              function W(t, e, r) {
                return jt(e, t.wc, 0)
                  ? 8 + (jt(e, t.wc, 1) ? 8 + _t(t.tc, e) : _t(t.hc[r], e))
                  : _t(t.ec[r], e)
              }
              function G(t) {
                return (
                  (t.wc = n(2)),
                  (t.ec = n(16)),
                  (t.hc = n(16)),
                  (t.tc = wt({}, 8)),
                  (t.O = 0),
                  t
                )
              }
              function J(t) {
                Ut(t.wc)
                for (var e = 0; t.O > e; ++e) Ut(t.ec[e].G), Ut(t.hc[e].G)
                Ut(t.tc.G)
              }
              function H(t, e, r) {
                var i, o
                if (null == t.V || t.u != r || t.I != e)
                  for (
                    t.I = e,
                      t.qc = (1 << e) - 1,
                      t.u = r,
                      o = 1 << (t.u + t.I),
                      t.V = n(o),
                      i = 0;
                    o > i;
                    ++i
                  )
                    t.V[i] = Z({})
              }
              function Z(t) {
                return (t.Ib = n(768)), t
              }
              function V(t, e) {
                var r, n, i, o
                ;(t.jb = e), (i = t.a[e].r), (n = t.a[e].j)
                do {
                  t.a[e].t &&
                    (mt(t.a[i]),
                    (t.a[i].r = i - 1),
                    t.a[e].Ac &&
                      ((t.a[i - 1].t = 0),
                      (t.a[i - 1].r = t.a[e].r2),
                      (t.a[i - 1].j = t.a[e].j2))),
                    (o = i),
                    (r = n),
                    (n = t.a[o].j),
                    (i = t.a[o].r),
                    (t.a[o].j = r),
                    (t.a[o].r = e),
                    (e = o)
                } while (e > 0)
                return (t.mb = t.a[0].j), (t.q = t.a[0].r)
              }
              function $(t) {
                var e
                for (
                  t.v = n(4),
                    t.a = [],
                    t.d = {},
                    t.C = n(192),
                    t.bb = n(12),
                    t.hb = n(12),
                    t.Ub = n(12),
                    t.vc = n(12),
                    t._ = n(192),
                    t.K = [],
                    t.Sb = n(114),
                    t.S = Et({}, 4),
                    t.$ = ct({}),
                    t.i = ct({}),
                    t.A = {},
                    t.m = [],
                    t.P = [],
                    t.lb = [],
                    t.nc = n(16),
                    t.x = n(4),
                    t.Q = n(4),
                    t.Xb = [Jt],
                    t.uc = [Jt],
                    t.Kc = [0],
                    t.fc = n(5),
                    t.yc = n(128),
                    t.vb = 0,
                    t.X = 1,
                    t.D = 0,
                    t.Hb = -1,
                    t.mb = 0,
                    e = 0;
                  4096 > e;
                  ++e
                )
                  t.a[e] = {}
                for (e = 0; 4 > e; ++e) t.K[e] = Et({}, 6)
                return t
              }
              function Q(t) {
                for (var e = 0; 16 > e; ++e) t.nc[e] = At(t.S, e)
                t.Qb = 0
              }
              function K(t) {
                var e, r, n, i, o, a, u, s
                for (i = 4; 128 > i; ++i)
                  (e = (2 | (1 & (a = at(i)))) << (n = (a >> 1) - 1)),
                    (t.yc[i] = Ot(t.Sb, e - a - 1, n, i - e))
                for (o = 0; 4 > o; ++o) {
                  for (r = t.K[o], u = o << 6, a = 0; t.$b > a; ++a)
                    t.P[u + a] = St(r, a)
                  for (a = 14; t.$b > a; ++a)
                    t.P[u + a] += ((a >> 1) - 1 - 4) << 6
                  for (s = 128 * o, i = 0; 4 > i; ++i) t.lb[s + i] = t.P[u + i]
                  for (; 128 > i; ++i) t.lb[s + i] = t.P[u + at(i)] + t.yc[i]
                }
                t.Mb = 0
              }
              function X(t, e) {
                ot(t),
                  (function (t, e) {
                    if (t.Gc) {
                      Bt(t.d, t.C, (t.l << 4) + e, 1),
                        Bt(t.d, t.bb, t.l, 0),
                        (t.l = 7 > t.l ? 7 : 10),
                        ft(t.$, t.d, 0, e)
                      var r = D(2)
                      xt(t.K[r], t.d, 63),
                        Mt(t.d, 67108863, 26),
                        kt(t.S, t.d, 15)
                    }
                  })(t, e & t.y)
                for (var r = 0; 5 > r; ++r) Rt(t.d)
              }
              function tt(t, e) {
                var r,
                  n,
                  i,
                  o,
                  a,
                  u,
                  s,
                  f,
                  c,
                  l,
                  h,
                  p,
                  d,
                  b,
                  g,
                  y,
                  v,
                  m,
                  w,
                  _,
                  E,
                  x,
                  S,
                  k,
                  A,
                  U,
                  B,
                  M,
                  L,
                  R,
                  I,
                  P,
                  C,
                  N,
                  D,
                  q,
                  F,
                  Y,
                  W,
                  G,
                  J,
                  H,
                  Z,
                  $
                if (t.jb != t.q)
                  return (
                    (d = t.a[t.q].r - t.q),
                    (t.mb = t.a[t.q].j),
                    (t.q = t.a[t.q].r),
                    d
                  )
                if (
                  ((t.q = t.jb = 0),
                  t.N ? ((p = t.vb), (t.N = 0)) : (p = it(t)),
                  (U = t.D),
                  2 > (k = j(t.b) + 1))
                )
                  return (t.mb = -1), 1
                for (k > 273 && (k = 273), W = 0, c = 0; 4 > c; ++c)
                  (t.x[c] = t.v[c]),
                    (t.Q[c] = O(t.b, -1, t.x[c], 273)),
                    t.Q[c] > t.Q[W] && (W = c)
                if (t.Q[W] >= t.n) return (t.mb = W), nt(t, (d = t.Q[W]) - 1), d
                if (p >= t.n) return (t.mb = t.m[U - 1] + 4), nt(t, p - 1), p
                if (
                  ((s = T(t.b, -1)),
                  (v = T(t.b, -t.v[0] - 1 - 1)),
                  2 > p && s != v && 2 > t.Q[W])
                )
                  return (t.mb = -1), 1
                if (
                  ((t.a[0].Hc = t.l),
                  (C = e & t.y),
                  (t.a[1].z =
                    $t[t.C[(t.l << 4) + C] >>> 2] +
                    vt(dt(t.A, e, t.J), t.l >= 7, v, s)),
                  mt(t.a[1]),
                  (Y =
                    (m = $t[(2048 - t.C[(t.l << 4) + C]) >>> 2]) +
                    $t[(2048 - t.bb[t.l]) >>> 2]),
                  v == s &&
                    ((G =
                      Y +
                      (function (t, e, r) {
                        return $t[t.hb[e] >>> 2] + $t[t._[(e << 4) + r] >>> 2]
                      })(t, t.l, C)),
                    t.a[1].z > G &&
                      ((t.a[1].z = G),
                      (function (t) {
                        ;(t.j = 0), (t.t = 0)
                      })(t.a[1]))),
                  2 > (h = p >= t.Q[W] ? p : t.Q[W]))
                )
                  return (t.mb = t.a[1].j), 1
                ;(t.a[1].r = 0),
                  (t.a[0].bc = t.x[0]),
                  (t.a[0].ac = t.x[1]),
                  (t.a[0].dc = t.x[2]),
                  (t.a[0].lc = t.x[3]),
                  (l = h)
                do {
                  t.a[l--].z = 268435455
                } while (l >= 2)
                for (c = 0; 4 > c; ++c)
                  if (!(2 > (F = t.Q[c]))) {
                    D = Y + rt(t, c, t.l, C)
                    do {
                      ;(o = D + lt(t.i, F - 2, C)),
                        (R = t.a[F]).z > o &&
                          ((R.z = o), (R.r = 0), (R.j = c), (R.t = 0))
                    } while (--F >= 2)
                  }
                if (
                  ((S = m + $t[t.bb[t.l] >>> 2]),
                  p >= (l = t.Q[0] >= 2 ? t.Q[0] + 1 : 2))
                ) {
                  for (B = 0; l > t.m[B]; ) B += 2
                  for (
                    ;
                    (o = S + et(t, (f = t.m[B + 1]), l, C)),
                      (R = t.a[l]).z > o &&
                        ((R.z = o), (R.r = 0), (R.j = f + 4), (R.t = 0)),
                      l != t.m[B] || (B += 2) != U;
                    ++l
                  );
                }
                for (r = 0; ; ) {
                  if (++r == h) return V(t, r)
                  if (((w = it(t)), (U = t.D), w >= t.n))
                    return (t.vb = w), (t.N = 1), V(t, r)
                  if (
                    (++e,
                    (P = t.a[r].r),
                    t.a[r].t
                      ? (--P,
                        t.a[r].Ac
                          ? ((H = t.a[t.a[r].r2].Hc),
                            (H =
                              4 > t.a[r].j2
                                ? 7 > H
                                  ? 8
                                  : 11
                                : 7 > H
                                ? 7
                                : 10))
                          : (H = t.a[P].Hc),
                        (H = z(H)))
                      : (H = t.a[P].Hc),
                    P == r - 1
                      ? (H = t.a[r].j ? z(H) : 7 > H ? 9 : 11)
                      : (t.a[r].t && t.a[r].Ac
                          ? ((P = t.a[r].r2),
                            (I = t.a[r].j2),
                            (H = 7 > H ? 8 : 11))
                          : (H =
                              4 > (I = t.a[r].j)
                                ? 7 > H
                                  ? 8
                                  : 11
                                : 7 > H
                                ? 7
                                : 10),
                        (L = t.a[P]),
                        4 > I
                          ? I
                            ? 1 == I
                              ? ((t.x[0] = L.ac),
                                (t.x[1] = L.bc),
                                (t.x[2] = L.dc),
                                (t.x[3] = L.lc))
                              : 2 == I
                              ? ((t.x[0] = L.dc),
                                (t.x[1] = L.bc),
                                (t.x[2] = L.ac),
                                (t.x[3] = L.lc))
                              : ((t.x[0] = L.lc),
                                (t.x[1] = L.bc),
                                (t.x[2] = L.ac),
                                (t.x[3] = L.dc))
                            : ((t.x[0] = L.bc),
                              (t.x[1] = L.ac),
                              (t.x[2] = L.dc),
                              (t.x[3] = L.lc))
                          : ((t.x[0] = I - 4),
                            (t.x[1] = L.bc),
                            (t.x[2] = L.ac),
                            (t.x[3] = L.dc))),
                    (t.a[r].Hc = H),
                    (t.a[r].bc = t.x[0]),
                    (t.a[r].ac = t.x[1]),
                    (t.a[r].dc = t.x[2]),
                    (t.a[r].lc = t.x[3]),
                    (u = t.a[r].z),
                    (s = T(t.b, -1)),
                    (v = T(t.b, -t.x[0] - 1 - 1)),
                    (C = e & t.y),
                    (n =
                      u +
                      $t[t.C[(H << 4) + C] >>> 2] +
                      vt(dt(t.A, e, T(t.b, -2)), H >= 7, v, s)),
                    (_ = 0),
                    (E = t.a[r + 1]).z > n &&
                      ((E.z = n), (E.r = r), (E.j = -1), (E.t = 0), (_ = 1)),
                    (Y =
                      (m = u + $t[(2048 - t.C[(H << 4) + C]) >>> 2]) +
                      $t[(2048 - t.bb[H]) >>> 2]),
                    v != s ||
                      (r > E.r && !E.j) ||
                      ((G =
                        Y + ($t[t.hb[H] >>> 2] + $t[t._[(H << 4) + C] >>> 2])),
                      E.z >= G &&
                        ((E.z = G), (E.r = r), (E.j = 0), (E.t = 0), (_ = 1))),
                    !(2 > (k = A = (A = j(t.b) + 1) > 4095 - r ? 4095 - r : A)))
                  ) {
                    if (
                      (k > t.n && (k = t.n),
                      !_ &&
                        v != s &&
                        (($ = Math.min(A - 1, t.n)),
                        (g = O(t.b, 0, t.x[0], $)) >= 2))
                    ) {
                      for (
                        Z = z(H),
                          N = (e + 1) & t.y,
                          x =
                            n +
                            $t[(2048 - t.C[(Z << 4) + N]) >>> 2] +
                            $t[(2048 - t.bb[Z]) >>> 2],
                          M = r + 1 + g;
                        M > h;

                      )
                        t.a[++h].z = 268435455
                      ;(o = x + (lt(t.i, g - 2, N) + rt(t, 0, Z, N))),
                        (R = t.a[M]).z > o &&
                          ((R.z = o),
                          (R.r = r + 1),
                          (R.j = 0),
                          (R.t = 1),
                          (R.Ac = 0))
                    }
                    for (J = 2, q = 0; 4 > q; ++q)
                      if (!(2 > (b = O(t.b, -1, t.x[q], k)))) {
                        y = b
                        do {
                          for (; r + b > h; ) t.a[++h].z = 268435455
                          ;(o = Y + (lt(t.i, b - 2, C) + rt(t, q, H, C))),
                            (R = t.a[r + b]).z > o &&
                              ((R.z = o), (R.r = r), (R.j = q), (R.t = 0))
                        } while (--b >= 2)
                        if (
                          ((b = y),
                          q || (J = b + 1),
                          A > b &&
                            (($ = Math.min(A - 1 - b, t.n)),
                            (g = O(t.b, b, t.x[q], $)) >= 2))
                        ) {
                          for (
                            Z = 7 > H ? 8 : 11,
                              N = (e + b) & t.y,
                              i =
                                Y +
                                (lt(t.i, b - 2, C) + rt(t, q, H, C)) +
                                $t[t.C[(Z << 4) + N] >>> 2] +
                                vt(
                                  dt(t.A, e + b, T(t.b, b - 1 - 1)),
                                  1,
                                  T(t.b, b - 1 - (t.x[q] + 1)),
                                  T(t.b, b - 1)
                                ),
                              Z = z(Z),
                              N = (e + b + 1) & t.y,
                              x =
                                i +
                                $t[(2048 - t.C[(Z << 4) + N]) >>> 2] +
                                $t[(2048 - t.bb[Z]) >>> 2],
                              M = b + 1 + g;
                            r + M > h;

                          )
                            t.a[++h].z = 268435455
                          ;(o = x + (lt(t.i, g - 2, N) + rt(t, 0, Z, N))),
                            (R = t.a[r + M]).z > o &&
                              ((R.z = o),
                              (R.r = r + b + 1),
                              (R.j = 0),
                              (R.t = 1),
                              (R.Ac = 1),
                              (R.r2 = r),
                              (R.j2 = q))
                        }
                      }
                    if (w > k) {
                      for (w = k, U = 0; w > t.m[U]; U += 2);
                      ;(t.m[U] = w), (U += 2)
                    }
                    if (w >= J) {
                      for (S = m + $t[t.bb[H] >>> 2]; r + w > h; )
                        t.a[++h].z = 268435455
                      for (B = 0; J > t.m[B]; ) B += 2
                      for (b = J; ; ++b)
                        if (
                          ((o = S + et(t, (a = t.m[B + 1]), b, C)),
                          (R = t.a[r + b]).z > o &&
                            ((R.z = o), (R.r = r), (R.j = a + 4), (R.t = 0)),
                          b == t.m[B])
                        ) {
                          if (
                            A > b &&
                            (($ = Math.min(A - 1 - b, t.n)),
                            (g = O(t.b, b, a, $)) >= 2)
                          ) {
                            for (
                              Z = 7 > H ? 7 : 10,
                                N = (e + b) & t.y,
                                i =
                                  o +
                                  $t[t.C[(Z << 4) + N] >>> 2] +
                                  vt(
                                    dt(t.A, e + b, T(t.b, b - 1 - 1)),
                                    1,
                                    T(t.b, b - (a + 1) - 1),
                                    T(t.b, b - 1)
                                  ),
                                Z = z(Z),
                                N = (e + b + 1) & t.y,
                                x =
                                  i +
                                  $t[(2048 - t.C[(Z << 4) + N]) >>> 2] +
                                  $t[(2048 - t.bb[Z]) >>> 2],
                                M = b + 1 + g;
                              r + M > h;

                            )
                              t.a[++h].z = 268435455
                            ;(o = x + (lt(t.i, g - 2, N) + rt(t, 0, Z, N))),
                              (R = t.a[r + M]).z > o &&
                                ((R.z = o),
                                (R.r = r + b + 1),
                                (R.j = 0),
                                (R.t = 1),
                                (R.Ac = 1),
                                (R.r2 = r),
                                (R.j2 = a + 4))
                          }
                          if ((B += 2) == U) break
                        }
                    }
                  }
                }
              }
              function et(t, e, r, n) {
                var i = D(r)
                return (
                  (128 > e
                    ? t.lb[128 * i + e]
                    : t.P[
                        (i << 6) +
                          (function (t) {
                            return 131072 > t
                              ? Vt[t >> 6] + 12
                              : 134217728 > t
                              ? Vt[t >> 16] + 32
                              : Vt[t >> 26] + 52
                          })(e)
                      ] + t.nc[15 & e]) + lt(t.$, r - 2, n)
                )
              }
              function rt(t, e, r, n) {
                var i
                return (
                  e
                    ? ((i = $t[(2048 - t.hb[r]) >>> 2]),
                      1 == e
                        ? (i += $t[t.Ub[r] >>> 2])
                        : ((i += $t[(2048 - t.Ub[r]) >>> 2]),
                          (i += It(t.vc[r], e - 2))))
                    : ((i = $t[t.hb[r] >>> 2]),
                      (i += $t[(2048 - t._[(r << 4) + n]) >>> 2])),
                  i
                )
              }
              function nt(t, e) {
                e > 0 &&
                  ((function (t, e) {
                    var r, n, i, o, a, u, s, f, c, l, h, p, d, b, g, y, v
                    do {
                      if (t.h >= t.o + t.ob) p = t.ob
                      else if (((p = t.h - t.o), t.xb > p)) {
                        L(t)
                        continue
                      }
                      for (
                        d = t.o > t.p ? t.o - t.p : 0,
                          n = t.f + t.o,
                          t.qb
                            ? ((u =
                                1023 &
                                (v = Zt[255 & t.c[n]] ^ (255 & t.c[n + 1]))),
                              (t.ub[u] = t.o),
                              (s = 65535 & (v ^= (255 & t.c[n + 2]) << 8)),
                              (t.ub[1024 + s] = t.o),
                              (f = (v ^ (Zt[255 & t.c[n + 3]] << 5)) & t.Ec))
                            : (f = (255 & t.c[n]) ^ ((255 & t.c[n + 1]) << 8)),
                          i = t.ub[t.R + f],
                          t.ub[t.R + f] = t.o,
                          g = 1 + (t.k << 1),
                          y = t.k << 1,
                          l = h = t.w,
                          r = t.Fc;
                        ;

                      ) {
                        if (d >= i || 0 == r--) {
                          t.L[g] = t.L[y] = 0
                          break
                        }
                        if (
                          ((a = t.o - i),
                          (o = (t.k >= a ? t.k - a : t.k - a + t.p) << 1),
                          (b = t.f + i),
                          (c = h > l ? l : h),
                          t.c[b + c] == t.c[n + c])
                        ) {
                          for (; ++c != p && t.c[b + c] == t.c[n + c]; );
                          if (c == p) {
                            ;(t.L[y] = t.L[o]), (t.L[g] = t.L[o + 1])
                            break
                          }
                        }
                        ;(255 & t.c[n + c]) > (255 & t.c[b + c])
                          ? ((t.L[y] = i), (y = o + 1), (i = t.L[y]), (h = c))
                          : ((t.L[g] = i), (g = o), (i = t.L[g]), (l = c))
                      }
                      L(t)
                    } while (0 != --e)
                  })(t.b, e),
                  (t.s += e))
              }
              function it(t) {
                var e = 0
                return (
                  (t.D = (function (t, e) {
                    var r,
                      n,
                      i,
                      o,
                      a,
                      u,
                      s,
                      f,
                      c,
                      l,
                      h,
                      p,
                      d,
                      b,
                      g,
                      y,
                      v,
                      m,
                      w,
                      _,
                      E
                    if (t.h >= t.o + t.ob) b = t.ob
                    else if (((b = t.h - t.o), t.xb > b)) return L(t), 0
                    for (
                      v = 0,
                        g = t.o > t.p ? t.o - t.p : 0,
                        n = t.f + t.o,
                        y = 1,
                        f = 0,
                        c = 0,
                        t.qb
                          ? ((f =
                              1023 &
                              (E = Zt[255 & t.c[n]] ^ (255 & t.c[n + 1]))),
                            (c = 65535 & (E ^= (255 & t.c[n + 2]) << 8)),
                            (l = (E ^ (Zt[255 & t.c[n + 3]] << 5)) & t.Ec))
                          : (l = (255 & t.c[n]) ^ ((255 & t.c[n + 1]) << 8)),
                        i = t.ub[t.R + l] || 0,
                        t.qb &&
                          ((o = t.ub[f] || 0),
                          (a = t.ub[1024 + c] || 0),
                          (t.ub[f] = t.o),
                          (t.ub[1024 + c] = t.o),
                          o > g &&
                            t.c[t.f + o] == t.c[n] &&
                            ((e[v++] = y = 2), (e[v++] = t.o - o - 1)),
                          a > g &&
                            t.c[t.f + a] == t.c[n] &&
                            (a == o && (v -= 2),
                            (e[v++] = y = 3),
                            (e[v++] = t.o - a - 1),
                            (o = a)),
                          0 != v && o == i && ((v -= 2), (y = 1))),
                        t.ub[t.R + l] = t.o,
                        w = 1 + (t.k << 1),
                        _ = t.k << 1,
                        p = d = t.w,
                        0 != t.w &&
                          i > g &&
                          t.c[t.f + i + t.w] != t.c[n + t.w] &&
                          ((e[v++] = y = t.w), (e[v++] = t.o - i - 1)),
                        r = t.Fc;
                      ;

                    ) {
                      if (g >= i || 0 == r--) {
                        t.L[w] = t.L[_] = 0
                        break
                      }
                      if (
                        ((s = t.o - i),
                        (u = (t.k >= s ? t.k - s : t.k - s + t.p) << 1),
                        (m = t.f + i),
                        (h = d > p ? p : d),
                        t.c[m + h] == t.c[n + h])
                      ) {
                        for (; ++h != b && t.c[m + h] == t.c[n + h]; );
                        if (
                          h > y &&
                          ((e[v++] = y = h), (e[v++] = s - 1), h == b)
                        ) {
                          ;(t.L[_] = t.L[u]), (t.L[w] = t.L[u + 1])
                          break
                        }
                      }
                      ;(255 & t.c[n + h]) > (255 & t.c[m + h])
                        ? ((t.L[_] = i), (_ = u + 1), (i = t.L[_]), (d = h))
                        : ((t.L[w] = i), (w = u), (i = t.L[w]), (p = h))
                    }
                    return L(t), v
                  })(t.b, t.m)),
                  t.D > 0 &&
                    (e = t.m[t.D - 2]) == t.n &&
                    (e += O(t.b, e - 1, t.m[t.D - 1], 273 - e)),
                  ++t.s,
                  e
                )
              }
              function ot(t) {
                t.b && t.W && ((t.b.cc = null), (t.W = 0))
              }
              function at(t) {
                return 2048 > t
                  ? Vt[t]
                  : 2097152 > t
                  ? Vt[t >> 10] + 20
                  : Vt[t >> 20] + 40
              }
              function ut(t, e) {
                Ut(t.db)
                for (var r = 0; e > r; ++r) Ut(t.Vb[r].G), Ut(t.Wb[r].G)
                Ut(t.ic.G)
              }
              function st(t, e, r, n, i) {
                var o, a, u, s, f
                for (
                  o = $t[t.db[0] >>> 2],
                    u = (a = $t[(2048 - t.db[0]) >>> 2]) + $t[t.db[1] >>> 2],
                    s = a + $t[(2048 - t.db[1]) >>> 2],
                    f = 0,
                    f = 0;
                  8 > f;
                  ++f
                ) {
                  if (f >= r) return
                  n[i + f] = o + St(t.Vb[e], f)
                }
                for (; 16 > f; ++f) {
                  if (f >= r) return
                  n[i + f] = u + St(t.Wb[e], f - 8)
                }
                for (; r > f; ++f) n[i + f] = s + St(t.ic, f - 8 - 8)
              }
              function ft(t, e, r, n) {
                ;(function (t, e, r, n) {
                  8 > r
                    ? (Bt(e, t.db, 0, 0), xt(t.Vb[n], e, r))
                    : ((r -= 8),
                      Bt(e, t.db, 0, 1),
                      8 > r
                        ? (Bt(e, t.db, 1, 0), xt(t.Wb[n], e, r))
                        : (Bt(e, t.db, 1, 1), xt(t.ic, e, r - 8)))
                })(t, e, r, n),
                  0 == --t.sc[n] &&
                    (st(t, n, t.rb, t.Cc, 272 * n), (t.sc[n] = t.rb))
              }
              function ct(t) {
                return (
                  (function (t) {
                    ;(t.db = n(2)),
                      (t.Vb = n(16)),
                      (t.Wb = n(16)),
                      (t.ic = Et({}, 8))
                    for (var e = 0; 16 > e; ++e)
                      (t.Vb[e] = Et({}, 3)), (t.Wb[e] = Et({}, 3))
                  })(t),
                  (t.Cc = []),
                  (t.sc = []),
                  t
                )
              }
              function lt(t, e, r) {
                return t.Cc[272 * r + e]
              }
              function ht(t, e) {
                for (var r = 0; e > r; ++r)
                  st(t, r, t.rb, t.Cc, 272 * r), (t.sc[r] = t.rb)
              }
              function pt(t, e, r) {
                var i, o
                if (null == t.V || t.u != r || t.I != e)
                  for (
                    t.I = e,
                      t.qc = (1 << e) - 1,
                      t.u = r,
                      o = 1 << (t.u + t.I),
                      t.V = n(o),
                      i = 0;
                    o > i;
                    ++i
                  )
                    t.V[i] = yt({})
              }
              function dt(t, e, r) {
                return t.V[((e & t.qc) << t.u) + ((255 & r) >>> (8 - t.u))]
              }
              function bt(t, e, r) {
                var n,
                  i,
                  o = 1
                for (i = 7; i >= 0; --i)
                  (n = (r >> i) & 1), Bt(e, t.tb, o, n), (o = (o << 1) | n)
              }
              function gt(t, e, r, n) {
                var i,
                  o,
                  a,
                  u,
                  s = 1,
                  f = 1
                for (o = 7; o >= 0; --o)
                  (i = (n >> o) & 1),
                    (u = f),
                    s && ((u += (1 + (a = (r >> o) & 1)) << 8), (s = a == i)),
                    Bt(e, t.tb, u, i),
                    (f = (f << 1) | i)
              }
              function yt(t) {
                return (t.tb = n(768)), t
              }
              function vt(t, e, r, n) {
                var i,
                  o,
                  a = 1,
                  u = 7,
                  s = 0
                if (e)
                  for (; u >= 0; --u)
                    if (
                      ((o = (r >> u) & 1),
                      (i = (n >> u) & 1),
                      (s += It(t.tb[((1 + o) << 8) + a], i)),
                      (a = (a << 1) | i),
                      o != i)
                    ) {
                      --u
                      break
                    }
                for (; u >= 0; --u)
                  (i = (n >> u) & 1), (s += It(t.tb[a], i)), (a = (a << 1) | i)
                return s
              }
              function mt(t) {
                ;(t.j = -1), (t.t = 0)
              }
              function wt(t, e) {
                return (t.F = e), (t.G = n(1 << e)), t
              }
              function _t(t, e) {
                var r,
                  n = 1
                for (r = t.F; 0 != r; --r) n = (n << 1) + jt(e, t.G, n)
                return n - (1 << t.F)
              }
              function Et(t, e) {
                return (t.F = e), (t.G = n(1 << e)), t
              }
              function xt(t, e, r) {
                var n,
                  i,
                  o = 1
                for (i = t.F; 0 != i; )
                  (n = (r >>> --i) & 1), Bt(e, t.G, o, n), (o = (o << 1) | n)
              }
              function St(t, e) {
                var r,
                  n,
                  i = 1,
                  o = 0
                for (n = t.F; 0 != n; )
                  (r = (e >>> --n) & 1),
                    (o += It(t.G[i], r)),
                    (i = (i << 1) + r)
                return o
              }
              function kt(t, e, r) {
                var n,
                  i,
                  o = 1
                for (i = 0; t.F > i; ++i)
                  (n = 1 & r), Bt(e, t.G, o, n), (o = (o << 1) | n), (r >>= 1)
              }
              function At(t, e) {
                var r,
                  n,
                  i = 1,
                  o = 0
                for (n = t.F; 0 != n; --n)
                  (r = 1 & e),
                    (e >>>= 1),
                    (o += It(t.G[i], r)),
                    (i = (i << 1) | r)
                return o
              }
              function Tt(t, e, r, n, i) {
                var o,
                  a,
                  u = 1
                for (a = 0; n > a; ++a)
                  Bt(r, t, e + u, (o = 1 & i)), (u = (u << 1) | o), (i >>= 1)
              }
              function Ot(t, e, r, n) {
                var i,
                  o,
                  a = 1,
                  u = 0
                for (o = r; 0 != o; --o)
                  (i = 1 & n),
                    (n >>>= 1),
                    (u += $t[(2047 & ((t[e + a] - i) ^ -i)) >>> 2]),
                    (a = (a << 1) | i)
                return u
              }
              function jt(t, e, r) {
                var n,
                  i = e[r]
                return (-2147483648 ^ (n = (t.E >>> 11) * i)) >
                  (-2147483648 ^ t.Bb)
                  ? ((t.E = n),
                    (e[r] = ((i + ((2048 - i) >>> 5)) << 16) >> 16),
                    -16777216 & t.E ||
                      ((t.Bb = (t.Bb << 8) | g(t.Ab)), (t.E <<= 8)),
                    0)
                  : ((t.E -= n),
                    (t.Bb -= n),
                    (e[r] = ((i - (i >>> 5)) << 16) >> 16),
                    -16777216 & t.E ||
                      ((t.Bb = (t.Bb << 8) | g(t.Ab)), (t.E <<= 8)),
                    1)
              }
              function Ut(t) {
                for (var e = t.length - 1; e >= 0; --e) t[e] = 1024
              }
              function Bt(t, e, r, n) {
                var a,
                  u = e[r]
                ;(a = (t.E >>> 11) * u),
                  n
                    ? ((t.xc = i(t.xc, o(f(a), [4294967295, 0]))),
                      (t.E -= a),
                      (e[r] = ((u - (u >>> 5)) << 16) >> 16))
                    : ((t.E = a),
                      (e[r] = ((u + ((2048 - u) >>> 5)) << 16) >> 16)),
                  -16777216 & t.E || ((t.E <<= 8), Rt(t))
              }
              function Mt(t, e, r) {
                for (var n = r - 1; n >= 0; --n)
                  (t.E >>>= 1),
                    1 == ((e >>> n) & 1) && (t.xc = i(t.xc, f(t.E))),
                    -16777216 & t.E || ((t.E <<= 8), Rt(t))
              }
              function Lt(t) {
                return i(i(f(t.Jb), t.mc), [4, 0])
              }
              function Rt(t) {
                var e,
                  r = c(
                    (function (t, e) {
                      var r
                      return (
                        (r = p(t, (e &= 63))),
                        0 > t[1] && (r = i(r, h([2, 0], 63 - e))),
                        r
                      )
                    })(t.xc, 32)
                  )
                if (0 != r || a(t.xc, [4278190080, 0]) < 0) {
                  ;(t.mc = i(t.mc, f(t.Jb))), (e = t.Oc)
                  do {
                    w(t.Ab, e + r), (e = 255)
                  } while (0 != --t.Jb)
                  t.Oc = c(t.xc) >>> 24
                }
                ++t.Jb, (t.xc = h(o(t.xc, [16777215, 0]), 8))
              }
              function It(t, e) {
                return $t[(2047 & ((t - e) ^ -e)) >>> 2]
              }
              function Pt(t) {
                for (
                  var e, r, n, i = 0, o = 0, a = t.length, u = [], s = [];
                  a > i;
                  ++i, ++o
                ) {
                  if (128 & (e = 255 & t[i]))
                    if (192 == (224 & e)) {
                      if (i + 1 >= a) return t
                      if (128 != (192 & (r = 255 & t[++i]))) return t
                      s[o] = ((31 & e) << 6) | (63 & r)
                    } else {
                      if (224 != (240 & e)) return t
                      if (i + 2 >= a) return t
                      if (128 != (192 & (r = 255 & t[++i]))) return t
                      if (128 != (192 & (n = 255 & t[++i]))) return t
                      s[o] = ((15 & e) << 12) | ((63 & r) << 6) | (63 & n)
                    }
                  else {
                    if (!e) return t
                    s[o] = e
                  }
                  16383 == o &&
                    (u.push(String.fromCharCode.apply(String, s)), (o = -1))
                }
                return (
                  o > 0 &&
                    ((s.length = o),
                    u.push(String.fromCharCode.apply(String, s))),
                  u.join('')
                )
              }
              function Ct(t) {
                var e,
                  r,
                  n,
                  i = [],
                  o = 0,
                  a = t.length
                if ('object' == typeof t) return t
                for (
                  (function (t, e, r, n, i) {
                    var o
                    for (o = e; r > o; ++o) n[i++] = t.charCodeAt(o)
                  })(t, 0, a, i, 0),
                    n = 0;
                  a > n;
                  ++n
                )
                  (e = i[n]) >= 1 && 127 >= e
                    ? ++o
                    : (o += !e || (e >= 128 && 2047 >= e) ? 2 : 3)
                for (r = [], o = 0, n = 0; a > n; ++n)
                  (e = i[n]) >= 1 && 127 >= e
                    ? (r[o++] = (e << 24) >> 24)
                    : !e || (e >= 128 && 2047 >= e)
                    ? ((r[o++] = ((192 | ((e >> 6) & 31)) << 24) >> 24),
                      (r[o++] = ((128 | (63 & e)) << 24) >> 24))
                    : ((r[o++] = ((224 | ((e >> 12) & 15)) << 24) >> 24),
                      (r[o++] = ((128 | ((e >> 6) & 63)) << 24) >> 24),
                      (r[o++] = ((128 | (63 & e)) << 24) >> 24))
                return r
              }
              function Nt(t) {
                return t[1] + t[0]
              }
              var Dt = 1,
                zt = 2,
                qt = 3,
                Ft = 'function' == typeof t ? t : setTimeout,
                Yt = 4294967296,
                Wt = [4294967295, -Yt],
                Gt = [0, -0x8000000000000000],
                Jt = [0, 0],
                Ht = [1, 0],
                Zt = (function () {
                  var t,
                    e,
                    r,
                    n = []
                  for (t = 0; 256 > t; ++t) {
                    for (r = t, e = 0; 8 > e; ++e)
                      0 != (1 & r) ? (r = (r >>> 1) ^ -306674912) : (r >>>= 1)
                    n[t] = r
                  }
                  return n
                })(),
                Vt = (function () {
                  var t,
                    e,
                    r,
                    n = 2,
                    i = [0, 1]
                  for (r = 2; 22 > r; ++r)
                    for (e = 1 << ((r >> 1) - 1), t = 0; e > t; ++t, ++n)
                      i[n] = (r << 24) >> 24
                  return i
                })(),
                $t = (function () {
                  var t,
                    e,
                    r,
                    n = []
                  for (e = 8; e >= 0; --e)
                    for (t = 1 << (9 - e), r = 1 << (9 - e - 1); t > r; ++r)
                      n[r] = (e << 6) + (((t - r) << 6) >>> (9 - e - 1))
                  return n
                })(),
                Qt = (function () {
                  var t = [
                    { s: 16, f: 64, m: 0 },
                    { s: 20, f: 64, m: 0 },
                    { s: 19, f: 64, m: 1 },
                    { s: 20, f: 64, m: 1 },
                    { s: 21, f: 128, m: 1 },
                    { s: 22, f: 128, m: 1 },
                    { s: 23, f: 128, m: 1 },
                    { s: 24, f: 255, m: 1 },
                    { s: 25, f: 255, m: 1 }
                  ]
                  return function (e) {
                    return t[e - 1] || t[6]
                  }
                })()
              return (
                'undefined' == typeof onmessage ||
                  ('undefined' != typeof window &&
                    void 0 !== window.document) ||
                  (onmessage = function (t) {
                    t &&
                      t.gc &&
                      (t.gc.action == zt
                        ? e.decompress(t.gc.gc, t.gc.cbn)
                        : t.gc.action == Dt &&
                          e.compress(t.gc.gc, t.gc.Rc, t.gc.cbn))
                  }),
                {
                  compress: function (t, e, n, i) {
                    var o,
                      a,
                      u = {},
                      s = void 0 === n && void 0 === i
                    if (
                      ('function' != typeof n && ((a = n), (n = i = 0)),
                      (i =
                        i ||
                        function (t) {
                          return void 0 !== a ? r(t, a) : void 0
                        }),
                      (n =
                        n ||
                        function (t, e) {
                          return void 0 !== a
                            ? postMessage({
                                action: Dt,
                                cbn: a,
                                result: t,
                                error: e
                              })
                            : void 0
                        }),
                      s)
                    ) {
                      for (u.c = S({}, Ct(t), Qt(e)); q(u.c.yb); );
                      return m(u.c.Nb)
                    }
                    try {
                      ;(u.c = S({}, Ct(t), Qt(e))), i(0)
                    } catch (t) {
                      return n(null, t)
                    }
                    Ft(function t() {
                      try {
                        for (var e, r = new Date().getTime(); q(u.c.yb); )
                          if (
                            ((o = Nt(u.c.yb.Pb) / Nt(u.c.Tb)),
                            new Date().getTime() - r > 200)
                          )
                            return i(o), Ft(t, 0), 0
                        i(1), (e = m(u.c.Nb)), Ft(n.bind(null, e), 0)
                      } catch (t) {
                        n(null, t)
                      }
                    }, 0)
                  },
                  decompress: function (t, e, n) {
                    var i,
                      o,
                      a,
                      u,
                      s = {},
                      f = void 0 === e && void 0 === n
                    if (
                      ('function' != typeof e && ((o = e), (e = n = 0)),
                      (n =
                        n ||
                        function (t) {
                          return void 0 !== o ? r(a ? t : -1, o) : void 0
                        }),
                      (e =
                        e ||
                        function (t, e) {
                          return void 0 !== o
                            ? postMessage({
                                action: zt,
                                cbn: o,
                                result: t,
                                error: e
                              })
                            : void 0
                        }),
                      f)
                    ) {
                      for (s.d = A({}, t); q(s.d.yb); );
                      return Pt(m(s.d.Nb))
                    }
                    try {
                      ;(s.d = A({}, t)), (u = Nt(s.d.Tb)), (a = u > -1), n(0)
                    } catch (t) {
                      return e(null, t)
                    }
                    Ft(function t() {
                      try {
                        for (
                          var r, o = 0, f = new Date().getTime();
                          q(s.d.yb);

                        )
                          if (++o % 1e3 == 0 && new Date().getTime() - f > 200)
                            return (
                              a && ((i = Nt(s.d.yb.Z.g) / u), n(i)), Ft(t, 0), 0
                            )
                        n(1), (r = Pt(m(s.d.Nb))), Ft(e.bind(null, r), 0)
                      } catch (t) {
                        e(null, t)
                      }
                    }, 0)
                  }
                }
              )
            })()
            this.LZMA = this.LZMA_WORKER = e
          }).call(this, r(20).setImmediate)
        },
        function (t, e, r) {
          var n,
            i = (function () {
              var t = String.fromCharCode,
                e =
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
                r =
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$',
                n = {}
              function i(t, e) {
                if (!n[t]) {
                  n[t] = {}
                  for (var r = 0; r < t.length; r++) n[t][t.charAt(r)] = r
                }
                return n[t][e]
              }
              var o = {
                compressToBase64: function (t) {
                  if (null == t) return ''
                  var r = o._compress(t, 6, function (t) {
                    return e.charAt(t)
                  })
                  switch (r.length % 4) {
                    default:
                    case 0:
                      return r
                    case 1:
                      return r + '==='
                    case 2:
                      return r + '=='
                    case 3:
                      return r + '='
                  }
                },
                decompressFromBase64: function (t) {
                  return null == t
                    ? ''
                    : '' == t
                    ? null
                    : o._decompress(t.length, 32, function (r) {
                        return i(e, t.charAt(r))
                      })
                },
                compressToUTF16: function (e) {
                  return null == e
                    ? ''
                    : o._compress(e, 15, function (e) {
                        return t(e + 32)
                      }) + ' '
                },
                decompressFromUTF16: function (t) {
                  return null == t
                    ? ''
                    : '' == t
                    ? null
                    : o._decompress(t.length, 16384, function (e) {
                        return t.charCodeAt(e) - 32
                      })
                },
                compressToUint8Array: function (t) {
                  for (
                    var e = o.compress(t),
                      r = new Uint8Array(2 * e.length),
                      n = 0,
                      i = e.length;
                    n < i;
                    n++
                  ) {
                    var a = e.charCodeAt(n)
                    ;(r[2 * n] = a >>> 8), (r[2 * n + 1] = a % 256)
                  }
                  return r
                },
                decompressFromUint8Array: function (e) {
                  if (null == e) return o.decompress(e)
                  for (
                    var r = new Array(e.length / 2), n = 0, i = r.length;
                    n < i;
                    n++
                  )
                    r[n] = 256 * e[2 * n] + e[2 * n + 1]
                  var a = []
                  return (
                    r.forEach(function (e) {
                      a.push(t(e))
                    }),
                    o.decompress(a.join(''))
                  )
                },
                compressToEncodedURIComponent: function (t) {
                  return null == t
                    ? ''
                    : o._compress(t, 6, function (t) {
                        return r.charAt(t)
                      })
                },
                decompressFromEncodedURIComponent: function (t) {
                  return null == t
                    ? ''
                    : '' == t
                    ? null
                    : ((t = t.replace(/ /g, '+')),
                      o._decompress(t.length, 32, function (e) {
                        return i(r, t.charAt(e))
                      }))
                },
                compress: function (e) {
                  return o._compress(e, 16, function (e) {
                    return t(e)
                  })
                },
                _compress: function (t, e, r) {
                  if (null == t) return ''
                  var n,
                    i,
                    o,
                    a = {},
                    u = {},
                    s = '',
                    f = '',
                    c = '',
                    l = 2,
                    h = 3,
                    p = 2,
                    d = [],
                    b = 0,
                    g = 0
                  for (o = 0; o < t.length; o += 1)
                    if (
                      ((s = t.charAt(o)),
                      Object.prototype.hasOwnProperty.call(a, s) ||
                        ((a[s] = h++), (u[s] = !0)),
                      (f = c + s),
                      Object.prototype.hasOwnProperty.call(a, f))
                    )
                      c = f
                    else {
                      if (Object.prototype.hasOwnProperty.call(u, c)) {
                        if (c.charCodeAt(0) < 256) {
                          for (n = 0; n < p; n++)
                            (b <<= 1),
                              g == e - 1
                                ? ((g = 0), d.push(r(b)), (b = 0))
                                : g++
                          for (i = c.charCodeAt(0), n = 0; n < 8; n++)
                            (b = (b << 1) | (1 & i)),
                              g == e - 1
                                ? ((g = 0), d.push(r(b)), (b = 0))
                                : g++,
                              (i >>= 1)
                        } else {
                          for (i = 1, n = 0; n < p; n++)
                            (b = (b << 1) | i),
                              g == e - 1
                                ? ((g = 0), d.push(r(b)), (b = 0))
                                : g++,
                              (i = 0)
                          for (i = c.charCodeAt(0), n = 0; n < 16; n++)
                            (b = (b << 1) | (1 & i)),
                              g == e - 1
                                ? ((g = 0), d.push(r(b)), (b = 0))
                                : g++,
                              (i >>= 1)
                        }
                        0 == --l && ((l = Math.pow(2, p)), p++), delete u[c]
                      } else
                        for (i = a[c], n = 0; n < p; n++)
                          (b = (b << 1) | (1 & i)),
                            g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                            (i >>= 1)
                      0 == --l && ((l = Math.pow(2, p)), p++),
                        (a[f] = h++),
                        (c = String(s))
                    }
                  if ('' !== c) {
                    if (Object.prototype.hasOwnProperty.call(u, c)) {
                      if (c.charCodeAt(0) < 256) {
                        for (n = 0; n < p; n++)
                          (b <<= 1),
                            g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++
                        for (i = c.charCodeAt(0), n = 0; n < 8; n++)
                          (b = (b << 1) | (1 & i)),
                            g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                            (i >>= 1)
                      } else {
                        for (i = 1, n = 0; n < p; n++)
                          (b = (b << 1) | i),
                            g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                            (i = 0)
                        for (i = c.charCodeAt(0), n = 0; n < 16; n++)
                          (b = (b << 1) | (1 & i)),
                            g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                            (i >>= 1)
                      }
                      0 == --l && ((l = Math.pow(2, p)), p++), delete u[c]
                    } else
                      for (i = a[c], n = 0; n < p; n++)
                        (b = (b << 1) | (1 & i)),
                          g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                          (i >>= 1)
                    0 == --l && ((l = Math.pow(2, p)), p++)
                  }
                  for (i = 2, n = 0; n < p; n++)
                    (b = (b << 1) | (1 & i)),
                      g == e - 1 ? ((g = 0), d.push(r(b)), (b = 0)) : g++,
                      (i >>= 1)
                  for (;;) {
                    if (((b <<= 1), g == e - 1)) {
                      d.push(r(b))
                      break
                    }
                    g++
                  }
                  return d.join('')
                },
                decompress: function (t) {
                  return null == t
                    ? ''
                    : '' == t
                    ? null
                    : o._decompress(t.length, 32768, function (e) {
                        return t.charCodeAt(e)
                      })
                },
                _decompress: function (e, r, n) {
                  var i,
                    o,
                    a,
                    u,
                    s,
                    f,
                    c,
                    l = [],
                    h = 4,
                    p = 4,
                    d = 3,
                    b = '',
                    g = [],
                    y = { val: n(0), position: r, index: 1 }
                  for (i = 0; i < 3; i += 1) l[i] = i
                  for (a = 0, s = Math.pow(2, 2), f = 1; f != s; )
                    (u = y.val & y.position),
                      (y.position >>= 1),
                      0 == y.position &&
                        ((y.position = r), (y.val = n(y.index++))),
                      (a |= (u > 0 ? 1 : 0) * f),
                      (f <<= 1)
                  switch (a) {
                    case 0:
                      for (a = 0, s = Math.pow(2, 8), f = 1; f != s; )
                        (u = y.val & y.position),
                          (y.position >>= 1),
                          0 == y.position &&
                            ((y.position = r), (y.val = n(y.index++))),
                          (a |= (u > 0 ? 1 : 0) * f),
                          (f <<= 1)
                      c = t(a)
                      break
                    case 1:
                      for (a = 0, s = Math.pow(2, 16), f = 1; f != s; )
                        (u = y.val & y.position),
                          (y.position >>= 1),
                          0 == y.position &&
                            ((y.position = r), (y.val = n(y.index++))),
                          (a |= (u > 0 ? 1 : 0) * f),
                          (f <<= 1)
                      c = t(a)
                      break
                    case 2:
                      return ''
                  }
                  for (l[3] = c, o = c, g.push(c); ; ) {
                    if (y.index > e) return ''
                    for (a = 0, s = Math.pow(2, d), f = 1; f != s; )
                      (u = y.val & y.position),
                        (y.position >>= 1),
                        0 == y.position &&
                          ((y.position = r), (y.val = n(y.index++))),
                        (a |= (u > 0 ? 1 : 0) * f),
                        (f <<= 1)
                    switch ((c = a)) {
                      case 0:
                        for (a = 0, s = Math.pow(2, 8), f = 1; f != s; )
                          (u = y.val & y.position),
                            (y.position >>= 1),
                            0 == y.position &&
                              ((y.position = r), (y.val = n(y.index++))),
                            (a |= (u > 0 ? 1 : 0) * f),
                            (f <<= 1)
                        ;(l[p++] = t(a)), (c = p - 1), h--
                        break
                      case 1:
                        for (a = 0, s = Math.pow(2, 16), f = 1; f != s; )
                          (u = y.val & y.position),
                            (y.position >>= 1),
                            0 == y.position &&
                              ((y.position = r), (y.val = n(y.index++))),
                            (a |= (u > 0 ? 1 : 0) * f),
                            (f <<= 1)
                        ;(l[p++] = t(a)), (c = p - 1), h--
                        break
                      case 2:
                        return g.join('')
                    }
                    if ((0 == h && ((h = Math.pow(2, d)), d++), l[c])) b = l[c]
                    else {
                      if (c !== p) return null
                      b = o + o.charAt(0)
                    }
                    g.push(b),
                      (l[p++] = o + b.charAt(0)),
                      (o = b),
                      0 == --h && ((h = Math.pow(2, d)), d++)
                  }
                }
              }
              return o
            })()
          void 0 ===
            (n = function () {
              return i
            }.call(e, r, e, t)) || (t.exports = n)
        },
        function (t, e, r) {
          var n = function () {}
          ;(n.prototype.encode = function (t) {
            for (
              var e,
                r = {},
                n = (t + '').split(''),
                i = [],
                o = n[0],
                a = 256,
                u = 1;
              u < n.length;
              u++
            )
              null != r[o + (e = n[u])]
                ? (o += e)
                : (i.push(o.length > 1 ? r[o] : o.charCodeAt(0)),
                  (r[o + e] = a),
                  a++,
                  (o = e))
            i.push(o.length > 1 ? r[o] : o.charCodeAt(0))
            for (u = 0; u < i.length; u++) i[u] = String.fromCharCode(i[u])
            return i.join('')
          }),
            (n.prototype.decode = function (t) {
              for (
                var e,
                  r = {},
                  n = (t + '').split(''),
                  i = n[0],
                  o = i,
                  a = [i],
                  u = 256,
                  s = 1;
                s < n.length;
                s++
              ) {
                var f = n[s].charCodeAt(0)
                ;(e = f < 256 ? n[s] : r[f] ? r[f] : o + i),
                  a.push(e),
                  (i = e.charAt(0)),
                  (r[u] = o + i),
                  u++,
                  (o = e)
              }
              return a.join('')
            }),
            (t.exports = new n())
        },
        function (t, e, r) {
          r.r(e)
          var n,
            i,
            o,
            a = r(1),
            u = r.n(a),
            s = r(0),
            f = r.n(s),
            c = r(23),
            l = r(24),
            h = r(25),
            p = {
              pack: !0,
              encode: !0,
              compress:
                ((i = u()(
                  f.a.mark(function t(e) {
                    return f.a.wrap(function (t) {
                      for (;;)
                        switch ((t.prev = t.next)) {
                          case 0:
                            return t.abrupt('return', e)
                          case 1:
                          case 'end':
                            return t.stop()
                        }
                    }, t)
                  })
                )),
                function (t) {
                  return i.apply(this, arguments)
                }),
              decompress:
                ((n = u()(
                  f.a.mark(function t(e) {
                    return f.a.wrap(function (t) {
                      for (;;)
                        switch ((t.prev = t.next)) {
                          case 0:
                            return t.abrupt('return', e)
                          case 1:
                          case 'end':
                            return t.stop()
                        }
                    }, t)
                  })
                )),
                function (t) {
                  return n.apply(this, arguments)
                })
            },
            d = { lzma: c.a, lzstring: l.a, lzw: h.a, pack: p },
            b = r(2)
          r.p =
            (o = (function () {
              if (document.currentScript) return document.currentScript.src
              var t = document.getElementsByTagName('script')
              return t[t.length - 1].src
            })()).substring(0, o.lastIndexOf('/')) + '/'
          e.default = function (t) {
            if (!Object.prototype.hasOwnProperty.call(d, t))
              throw new Error('No such algorithm '.concat(t))
            var e = d[t],
              r = e.pack,
              n = e.encode
            function i(t) {
              return o.apply(this, arguments)
            }
            function o() {
              return (o = u()(
                f.a.mark(function e(i) {
                  var o, a, u
                  return f.a.wrap(function (e) {
                    for (;;)
                      switch ((e.prev = e.next)) {
                        case 0:
                          if (!r) {
                            e.next = 6
                            break
                          }
                          return (e.next = 3), b.a.msgpack()
                        case 3:
                          ;(e.t0 = e.sent.encode(i)), (e.next = 7)
                          break
                        case 6:
                          e.t0 = JSON.stringify(i)
                        case 7:
                          return (o = e.t0), (e.next = 10), d[t].compress(o)
                        case 10:
                          if (((a = e.sent), !n)) {
                            e.next = 17
                            break
                          }
                          return (e.next = 14), b.a.safe64()
                        case 14:
                          ;(e.t1 = e.sent.encode(a)), (e.next = 18)
                          break
                        case 17:
                          e.t1 = a
                        case 18:
                          return (u = e.t1), e.abrupt('return', u)
                        case 20:
                        case 'end':
                          return e.stop()
                      }
                  }, e)
                })
              )).apply(this, arguments)
            }
            function a() {
              return (a = u()(
                f.a.mark(function e(i) {
                  var o, a, u
                  return f.a.wrap(function (e) {
                    for (;;)
                      switch ((e.prev = e.next)) {
                        case 0:
                          if (!n) {
                            e.next = 6
                            break
                          }
                          return (e.next = 3), b.a.safe64()
                        case 3:
                          ;(e.t0 = e.sent.decode(i)), (e.next = 7)
                          break
                        case 6:
                          e.t0 = i
                        case 7:
                          return (o = e.t0), (e.next = 10), d[t].decompress(o)
                        case 10:
                          if (((a = e.sent), !r)) {
                            e.next = 17
                            break
                          }
                          return (e.next = 14), b.a.msgpack()
                        case 14:
                          ;(e.t1 = e.sent.decode(a)), (e.next = 18)
                          break
                        case 17:
                          e.t1 = JSON.parse(a)
                        case 18:
                          return (u = e.t1), e.abrupt('return', u)
                        case 20:
                        case 'end':
                          return e.stop()
                      }
                  }, e)
                })
              )).apply(this, arguments)
            }
            function s() {
              return (s = u()(
                f.a.mark(function t(e) {
                  var r, n, o
                  return f.a.wrap(function (t) {
                    for (;;)
                      switch ((t.prev = t.next)) {
                        case 0:
                          return (
                            (r = JSON.stringify(e)),
                            (n = encodeURIComponent(r)),
                            (t.next = 4),
                            i(e)
                          )
                        case 4:
                          return (
                            (o = t.sent),
                            t.abrupt('return', {
                              raw: r.length,
                              rawencoded: n.length,
                              compressedencoded: o.length,
                              compression:
                                ((a = n.length / o.length),
                                Math.floor(1e4 * a) / 1e4)
                            })
                          )
                        case 6:
                        case 'end':
                          return t.stop()
                      }
                    var a
                  }, t)
                })
              )).apply(this, arguments)
            }
            return {
              compress: i,
              decompress: function (t) {
                return a.apply(this, arguments)
              },
              stats: function (t) {
                return s.apply(this, arguments)
              }
            }
          }
        }
      ]).default
    })
  })(jsonUrlSingle$2)
  return jsonUrlSingle$2.exports
}

var jsonUrlSingleExports = requireJsonUrlSingle()
var jsonUrlSingle = /*@__PURE__*/ getDefaultExportFromCjs(jsonUrlSingleExports)

var jsonUrlSingle$1 = /*#__PURE__*/ _mergeNamespaces(
  {
    __proto__: null,
    default: jsonUrlSingle
  },
  [jsonUrlSingleExports]
)

export { _testDeps, config, _handlers as default, encodings, gc }
