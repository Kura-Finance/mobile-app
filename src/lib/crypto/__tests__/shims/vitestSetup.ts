/**
 * Vitest setup — runs before every test file.
 *
 * Installs RN-specific globals so that production modules (Logger / baseUrl)
 * can import cleanly in a Node environment without needing to be modified.
 */

declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}

if (typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'undefined') {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
}

export {};
