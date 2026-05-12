// Must be first — patches Object.defineProperty so getter-only `default` exports
// don't throw "Cannot assign to property 'default' which has only a getter" in Hermes.
import './src/shims/defaultWritable';

import 'react-native-gesture-handler';
import '@walletconnect/react-native-compat';
import './src/lib/walletconnect/walletConnectBootstrap';
import { warmWalletConnectWalletMode } from './src/lib/walletconnect/walletConnectBootstrap';
import { installWalletConnectDeepLinkListener } from './src/lib/walletconnect/wcInboundPairing';

void warmWalletConnectWalletMode();
installWalletConnectDeepLinkListener();

// Polyfill global.crypto.subtle BEFORE any module that uses tssrp6a (SRP-6a)
// or other WebCrypto-dependent libraries.
// react-native-get-random-values only provides getRandomValues, not subtle.
import './src/shims/cryptoSubtle';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
