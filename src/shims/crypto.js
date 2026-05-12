/**
 * Metro shim for Node's built-in `crypto` module.
 *
 * tssrp6a's crossEnvCrypto.js (module-level code) does:
 *
 *   const webcrypto = (typeof window !== "undefined" && window.crypto)
 *                  || require("crypto").webcrypto;   ← our shim is resolved here
 *   if (!webcrypto.subtle) throw ...
 *   webcrypto.getRandomValues.bind(webcrypto)
 *   webcrypto.subtle.digest("SHA-1"|"SHA-256"|"SHA-384"|"SHA-512", data)
 *
 * All four algorithms are needed because tssrp6a registers all hash functions
 * at module init time.
 */

'use strict';

var _sha2   = require('@noble/hashes/sha2.js');
var _legacy = require('@noble/hashes/legacy.js');

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

var subtle = {
  digest: function(algorithm, data) {
    var alg = typeof algorithm === 'string' ? algorithm : algorithm.name;
    var b   = toBytes(data);
    if (alg === 'SHA-256') return Promise.resolve(_sha2.sha256(b).buffer);
    if (alg === 'SHA-512') return Promise.resolve(_sha2.sha512(b).buffer);
    if (alg === 'SHA-384') return Promise.resolve(_sha2.sha384(b).buffer);
    if (alg === 'SHA-1')   return Promise.resolve(_legacy.sha1(b).buffer);
    return Promise.reject(new Error('crypto shim: unsupported "' + alg + '"'));
  }
};

function getRandomValues(arr) {
  if (global.crypto && global.crypto.getRandomValues) {
    return global.crypto.getRandomValues(arr);
  }
  throw new Error('getRandomValues: polyfill not yet ready');
}

var webcrypto = { subtle: subtle, getRandomValues: getRandomValues };

module.exports = {
  webcrypto: webcrypto,
  subtle: subtle,
  getRandomValues: getRandomValues,
};
