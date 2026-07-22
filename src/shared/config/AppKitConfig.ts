// src/AppKitConfig.ts - AppKit initialization with WalletConnect support
import '@walletconnect/react-native-compat'
import { warmWalletConnectWalletMode } from '../../lib/walletconnect/walletConnectBootstrap';

import { createAppKit } from '@reown/appkit-react-native'
import { EthersAdapter } from '@reown/appkit-ethers-react-native'
import { mainnet, polygon, arbitrum, avalanche, bsc, fantom } from 'viem/chains'
import { storageAdapter } from './StorageAdapter'
import Logger from '../utils/Logger'
import { CUSTOM_WALLET, WALLET_ID, WALLET_ICON } from '../../lib/walletconnect/walletListing'
import { brand } from '../../config/branding'
import { assertValidWalletConnectProjectId } from '../../config/env'

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
      const projectId = assertValidWalletConnectProjectId();
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
          icons: [WALLET_ICON],
          redirect: {
            native: `${brand.scheme}://`,
            universal: brand.universalLinkDashboard,
          },
        },

        customWallets: [CUSTOM_WALLET],
        featuredWalletIds: [WALLET_ID],
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
