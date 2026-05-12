/**
 * Node test shim for `react-native-get-random-values`.
 *
 * The real module polyfills `crypto.getRandomValues` on RN; in Node we can
 * piggyback on the global webcrypto already exposed since Node 20.
 */

if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('node:crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    writable: false,
    configurable: false,
  });
}

export {};
