/**
 * Drop-in replacement for `tssrp6a/dist/crossEnvCrypto.js`.
 *
 * The upstream module tries to use `window.crypto.subtle` (or Node's
 * `require("crypto").webcrypto`) and refuses to load if neither is present.
 * In React Native (Hermes) `crypto.subtle` does not exist, so the upstream
 * file throws "Crypto.Subtle is undefined" at module-init time.
 *
 * Metro aliases this file in place of the upstream one (see metro.config.js).
 *
 * Contract (from tssrp6a/src/crossEnvCrypto.ts):
 *
 *   exports.crossEnvCrypto = {
 *     randomBytes: (arr: Uint8Array) => Uint8Array,
 *     hashFunctions: {
 *       SHA1:   (data: Uint8Array) => Promise<ArrayBuffer>,
 *       SHA256: (data: Uint8Array) => Promise<ArrayBuffer>,
 *       SHA384: (data: Uint8Array) => Promise<ArrayBuffer>,
 *       SHA512: (data: Uint8Array) => Promise<ArrayBuffer>,
 *     },
 *   }
 *
 * Hashes are backed by @noble/hashes (pure JS, Hermes-safe).
 * randomBytes uses the global crypto polyfill from
 * `react-native-get-random-values`.
 */

'use strict';

var _sha2   = require('@noble/hashes/sha2.js');
var _legacy = require('@noble/hashes/legacy.js');

function digest(hashFn) {
  return function (data) {
    var bytes = data instanceof Uint8Array
      ? data
      : (data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return Promise.resolve(hashFn(bytes).buffer);
  };
}

function randomBytes(arr) {
  if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
    return global.crypto.getRandomValues(arr);
  }
  throw new Error(
    'tssrp6aCrypto: global.crypto.getRandomValues is unavailable. ' +
    'Ensure react-native-get-random-values is imported before any tssrp6a usage.',
  );
}

exports.crossEnvCrypto = {
  randomBytes: randomBytes,
  hashFunctions: {
    SHA1:   digest(_legacy.sha1),
    SHA256: digest(_sha2.sha256),
    SHA384: digest(_sha2.sha384),
    SHA512: digest(_sha2.sha512),
  },
};
