import '@walletconnect/react-native-compat';
import { WalletKit } from '@reown/walletkit';
import Logger from '../../shared/utils/Logger';
import { brand } from '../../config/branding';
import {
  WALLET_METADATA_ICONS,
  WALLET_NATIVE_LINK,
  WALLET_UNIVERSAL_LINK,
} from './walletListing';
import { getSharedWalletConnectCore } from './walletConnectBootstrap';

const TAG = 'WalletKit';

type WalletKitInstance = Awaited<ReturnType<typeof WalletKit.init>>;

let walletKitInstance: WalletKitInstance | null = null;
let initPromise: Promise<WalletKitInstance> | null = null;

export async function getWalletKit(): Promise<WalletKitInstance> {
  if (walletKitInstance) return walletKitInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    Logger.info(TAG, 'Initializing WalletKit…');
    const core = getSharedWalletConnectCore();
    walletKitInstance = await WalletKit.init({
      core,
      metadata: {
        name: brand.walletName,
        description: brand.walletKitDescription,
        url: brand.homepage,
        icons: [...WALLET_METADATA_ICONS],
        redirect: {
          native: WALLET_NATIVE_LINK,
          universal: WALLET_UNIVERSAL_LINK,
        },
      },
    });
    Logger.info(TAG, 'WalletKit ready');
    return walletKitInstance;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/** @deprecated Prefer {@link getWalletKit}. */
export const getKuraWalletKit = getWalletKit;
