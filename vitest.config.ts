import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['./src/lib/crypto/__tests__/shims/vitestSetup.ts'],
    server: {
      deps: {
        inline: ['@noble/ciphers', '@noble/curves', '@noble/hashes'],
      },
    },
    alias: {
      'react-native-get-random-values': new URL(
        './src/lib/crypto/__tests__/shims/getRandomValues.ts',
        import.meta.url,
      ).pathname,
      'react-native-argon2': new URL(
        './src/lib/crypto/__tests__/shims/argon2.ts',
        import.meta.url,
      ).pathname,
      // libsodium API surface is identical between native (`react-native-libsodium`)
      // and the WASM-backed `libsodium-wrappers`; alias for vitest so the same
      // application code runs in Node.
      'react-native-libsodium': 'libsodium-wrappers',
    },
  },
});
