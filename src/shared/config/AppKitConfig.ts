// src/AppKitConfig.ts - AppKit initialization with WalletConnect support
import '@walletconnect/react-native-compat'
import '../../lib/walletconnect/walletConnectBootstrap';
import { warmWalletConnectWalletMode } from '../../lib/walletconnect/walletConnectBootstrap';

import { createAppKit } from '@reown/appkit-react-native'
import { EthersAdapter } from '@reown/appkit-ethers-react-native'
import { mainnet, polygon, arbitrum, avalanche, bsc, fantom } from 'viem/chains'
import { storageAdapter } from './StorageAdapter'
import Logger from '../utils/Logger'
import { KURA_CUSTOM_WALLET, KURA_WALLET_ID, KURA_WALLET_ICON } from '../../lib/walletconnect/kuraWalletListing'
import { brand } from '../../config/branding'
import { env } from '../../config/env'

const projectId = env.walletConnectProjectId

if (!projectId) {
  throw new Error(
    'WALLETCONNECT_PROJECT_ID environment variable is not defined. ' +
    'Please obtain it from https://dashboard.reown.com/ and set it in your environment variables.'
  )
}

const ethersAdapter = new EthersAdapter()

/**
 * AppKit Configuration
 * Supports multiple EVM chains for wallet connection
 * Enables wallet detection and QR code connection via WalletConnect
 *
 * NOTE: createAppKit() runs at module-import time (when App.tsx is loaded), i.e.
 * before React mounts. If it throws/hangs in a release build the app gets stuck
 * on the white native splash. The breadcrumbs below let the device log pinpoint
 * whether this step is the culprit.
 */
Logger.info('Boot', 'AppKitConfig: creating AppKit instance…')

let appKitInstance: ReturnType<typeof createAppKit> | null = null;
let appKitInitPromise: Promise<ReturnType<typeof createAppKit>> | null = null;

export async function initAppKit(): Promise<ReturnType<typeof createAppKit>> {
  if (appKitInstance) return appKitInstance;
  if (!appKitInitPromise) {
    appKitInitPromise = (async () => {
      // WalletKit must own the shared SignClient before AppKit (dApp mode) inits.
      await warmWalletConnectWalletMode();
      appKitInstance = createAppKit({
        projectId,
        networks: [mainnet, polygon, arbitrum, avalanche, bsc, fantom],
        defaultNetwork: mainnet,
        adapters: [ethersAdapter],
        storage: storageAdapter,

        metadata: {
          name: brand.walletName,
          description: brand.appDescription,
          url: brand.homepage,
          icons: [KURA_WALLET_ICON],
          redirect: {
            native: `${brand.scheme}://`,
            universal: brand.universalLinkDashboard,
          },
        },

        customWallets: [KURA_CUSTOM_WALLET],
        featuredWalletIds: [KURA_WALLET_ID],
      });
      Logger.info('Boot', 'AppKitConfig: AppKit instance created ✓');
      return appKitInstance;
    })().catch((err) => {
      appKitInitPromise = null;
      throw err;
    });
  }
  return appKitInitPromise;
}

/** Lazy AppKit singleton — call initAppKit() before use. */
export async function getAppKit(): Promise<ReturnType<typeof createAppKit>> {
  return initAppKit();
}
