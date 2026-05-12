import { useEffect, useRef } from 'react';
import { WcController } from '@reown/appkit-core-react-native';
import { KURA_WALLET_ID } from '../../../lib/walletconnect/kuraWalletListing';
import { pairWalletConnectUri } from '../../../lib/walletconnect/wcInboundPairing';
import Logger from '../../../shared/utils/Logger';

const TAG = 'WcAppKitBridge';

/**
 * When TrackFi DeFi opens AppKit and the user picks Kura in the same app,
 * AppKit normally round-trips through `kura://` via Linking.openURL — which
 * does not reliably fire on the foreground app. Pair directly instead.
 */
export default function AppKitKuraWalletBridge() {
  const pairingRef = useRef(false);

  useEffect(() => {
    const unsub = WcController.subscribeKey('pressedWallet', (wallet) => {
      if (wallet?.id !== KURA_WALLET_ID) return;

      const wcUri = WcController.state.wcUri;
      if (!wcUri || pairingRef.current) return;

      pairingRef.current = true;
      Logger.info(TAG, 'In-app Kura wallet selected — pairing directly');
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
