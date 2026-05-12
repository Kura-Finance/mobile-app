/**
 * CSPRNG wrapper backed by `react-native-get-random-values`, which polyfills
 * `crypto.getRandomValues` on RN. Already pulled in by
 * `@walletconnect/react-native-compat` at app bootstrap, but we re-import here
 * defensively so this module can be used without depending on import order.
 */

import 'react-native-get-random-values';

export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('randomBytes: length must be a positive integer');
  }
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}
