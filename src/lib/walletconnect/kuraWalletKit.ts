import '@walletconnect/react-native-compat';
import { WalletKit } from '@reown/walletkit';
import Logger from '../../shared/utils/Logger';
import { brand } from '../../config/branding';
import {
  KURA_WALLET_METADATA_ICONS,
  KURA_WALLET_NATIVE_LINK,
  KURA_WALLET_UNIVERSAL_LINK,
} from './kuraWalletListing';
import { getSharedWalletConnectCore } from './walletConnectBootstrap';

const TAG = 'KuraWalletKit';

type KuraWalletKitInstance = Awaited<ReturnType<typeof WalletKit.init>>;

let walletKitInstance: KuraWalletKitInstance | null = null;
let initPromise: Promise<KuraWalletKitInstance> | null = null;

export async function getKuraWalletKit(): Promise<KuraWalletKitInstance> {
  if (walletKitInstance) return walletKitInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    Logger.info(TAG, 'Initializing WalletKit…');
    const core = getSharedWalletConnectCore();
    walletKitInstance = await WalletKit.init({
      core,
      metadata: {
        name: `${brand.walletName} Wallet`,
        description: brand.walletKitDescription,
        url: brand.homepage,
        icons: [...KURA_WALLET_METADATA_ICONS],
        redirect: {
          native: KURA_WALLET_NATIVE_LINK,
          universal: KURA_WALLET_UNIVERSAL_LINK,
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
