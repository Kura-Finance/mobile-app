import { useEffect, useRef } from 'react';
import { WcController } from '@reown/appkit-core-react-native';
import { WALLET_ID } from '../../../lib/walletconnect/walletListing';
import { pairWalletConnectUri } from '../../../lib/walletconnect/wcInboundPairing';
import Logger from '../../../shared/utils/Logger';

const TAG = 'WcAppKitBridge';

/**
 * When TrackFi DeFi opens AppKit and the user picks this app's wallet in-process,
 * AppKit normally round-trips through the native scheme via Linking.openURL — which
 * does not reliably fire on the foreground app. Pair directly instead.
 */
export default function AppKitKuraWalletBridge() {
  const pairingRef = useRef(false);

  useEffect(() => {
    const unsub = WcController.subscribeKey('pressedWallet', (wallet) => {
      if (wallet?.id !== WALLET_ID) return;

      const wcUri = WcController.state.wcUri;
      if (!wcUri || pairingRef.current) return;

      pairingRef.current = true;
      Logger.info(TAG, 'In-app wallet selected — pairing directly');
      void pairWalletConnectUri(wcUri)
        .catch((err) => {
          Logger.error(TAG, 'In-app pairing failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(() => {
          pairingRef.current = false;
        });
    });

    return unsub;
  }, []);

  return null;
}
