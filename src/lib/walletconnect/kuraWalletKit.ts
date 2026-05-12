import '@walletconnect/react-native-compat';
import { WalletKit } from '@reown/walletkit';
import Logger from '../../shared/utils/Logger';
import { KURA_WALLET_METADATA_ICONS } from './kuraWalletListing';
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
        name: 'Kura Wallet',
        description: 'Kura Safe Smart Account on Base',
        url: 'https://kura-finance.com',
        icons: [...KURA_WALLET_METADATA_ICONS],
        redirect: {
          native: 'kura://',
          universal: 'https://kura-finance.com/dashboard',
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
