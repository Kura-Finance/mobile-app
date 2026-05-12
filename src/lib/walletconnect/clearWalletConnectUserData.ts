import { getSdkError } from '@walletconnect/utils';
import { clearDappSessionHistory } from '../../features/walletconnect/lib/dappSessionHistory';
import { getKuraWalletKit } from './kuraWalletKit';
import Logger from '../../shared/utils/Logger';

const TAG = 'WalletConnectLogout';

/**
 * Disconnect all WalletConnect sessions and wipe persisted dApp history
 * for the signing-out user.
 */
export async function clearWalletConnectUserData(userId?: string): Promise<void> {
  await clearDappSessionHistory(userId);

  try {
    const kit = await getKuraWalletKit();
    const sessions = Object.values(kit.getActiveSessions());
    await Promise.all(
      sessions.map((session) =>
        kit.disconnectSession({
          topic: session.topic,
          reason: getSdkError('USER_DISCONNECTED'),
        }).catch(() => undefined),
      ),
    );
    Logger.info(TAG, 'Disconnected WalletConnect sessions on logout', {
      count: sessions.length,
    });
  } catch (err) {
    Logger.warn(TAG, 'Failed to disconnect WalletConnect sessions on logout', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
