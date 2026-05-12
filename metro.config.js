const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const tssrp6aCryptoShim = path.resolve(__dirname, 'src/shims/tssrp6aCrypto.js');
const cryptoShim = path.resolve(__dirname, 'src/shims/crypto.js');

// react-native-libsodium's "react-native" field points to src/index.ts (TypeScript
// source). Metro transforms it with the Hermes Babel preset which converts
// `export default namespace` to an Object.defineProperty getter — making the
// resulting exports.default non-writable. This causes:
//   TypeError: Cannot assign to property 'default' which has only a getter
// Fix: redirect to the pre-compiled CommonJS build which uses plain
// writable exports.default assignment and doesn't trigger this issue.
const libsodiumCjsIndex = path.resolve(
  __dirname,
  'node_modules/react-native-libsodium/lib/commonjs/index',
);

// Custom resolveRequest: replace problematic module imports BEFORE Metro
// tries to apply package "exports" / built-in resolution. Used because
// `extraNodeModules` only intercepts top-level bare specifiers, not the
// internal relative imports inside `tssrp6a/dist/...`.
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  // Disable strict enforcement of package.json "exports" field.
  // Several nested packages (ethers/viem/@scure/@reown's copies of @noble/hashes,
  // multiformats) import internal subpaths not listed in their "exports", which
  // Metro 0.81+ warns about. Setting this to false tells Metro to fall back to
  // file-based resolution silently (the same resolution that already works).
  unstable_enablePackageExports: false,
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    crypto: cryptoShim,
    '@walletconnect/core': path.resolve(__dirname, 'node_modules/@walletconnect/core'),
    '@walletconnect/sign-client': path.resolve(__dirname, 'node_modules/@walletconnect/sign-client'),
    '@walletconnect/types': path.resolve(__dirname, 'node_modules/@walletconnect/types'),
    '@walletconnect/utils': path.resolve(__dirname, 'node_modules/@walletconnect/utils'),
    '@walletconnect/universal-provider': path.resolve(
      __dirname,
      'node_modules/@walletconnect/universal-provider',
    ),
  },
  resolveRequest: (context, moduleName, platform) => {
    // Force react-native-libsodium to its pre-compiled CJS build so Metro
    // doesn't process the TypeScript source with a transform that makes
    // `exports.default` non-writable (getter-only).
    if (moduleName === 'react-native-libsodium') {
      return { type: 'sourceFile', filePath: libsodiumCjsIndex + '.js' };
    }

    // Redirect tssrp6a's WebCrypto-dependent module to our pure-JS replacement.
    // tssrp6a/src/parameters.ts does `import "./crossEnvCrypto"`, which Metro
    // resolves to either the cjs or esm copy depending on package.json fields.
    if (
      moduleName === './crossEnvCrypto' ||
      moduleName === './crossEnvCrypto.js' ||
      moduleName === '../crossEnvCrypto' ||
      moduleName === '../crossEnvCrypto.js'
    ) {
      // Only redirect when the request originates from inside tssrp6a.
      if (context.originModulePath && context.originModulePath.includes('/tssrp6a/')) {
        return {
          type: 'sourceFile',
          filePath: tssrp6aCryptoShim,
        };
      }
    }

    // permissionless and viem ship TypeScript source with ESM-style ".js"
    // extension imports (e.g. "./simple/toSimpleSmartAccount.js"). With
    // unstable_enablePackageExports: false Metro resolves to the TS source
    // and then can't find the ".js" sibling. Fix: strip ".js" so Metro falls
    // back to file-based resolution and finds the .ts source.
    //
    // IMPORTANT: pass `context` directly — spreading loses Metro's internal
    // prototype methods and can cause "Got unexpected undefined" in nullthrows.
    if (
      moduleName.endsWith('.js') &&
      context.originModulePath &&
      (context.originModulePath.includes('/permissionless/') ||
        context.originModulePath.includes('/viem/'))
    ) {
      const withoutExt = moduleName.slice(0, -3);
      try {
        const resolved = defaultResolveRequest
          ? defaultResolveRequest(context, withoutExt, platform)
          : context.resolveRequest(context, withoutExt, platform);
        if (resolved) return resolved;
      } catch {
        // fall through to default resolution with original module name
      }
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
