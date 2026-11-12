/**
 * Who is signed in, independent of where the session comes from.
 *
 *   - With an app backend: Privy (email / Google / Apple) + its embedded EOA.
 *   - Without one: the wallet whose key lives on this device. No Privy at all.
 *
 * The mode is fixed at build time (EXPO_PUBLIC_API_BASE_URL), so each exported
 * hook is bound to one implementation for the lifetime of the app. Feature
 * code must use these hooks instead of importing `@privy-io/expo` directly:
 * Privy hooks throw when no <PrivyProvider> is mounted.
 */

import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useEmbeddedEthereumWallet,
  usePrivy,
  type ConnectedEthereumWallet,
} from '@privy-io/expo';
import i18n from '../../shared/locales/i18n';
import Logger from '../../shared/utils/Logger';
import { removeLocalWallet, useLocalWalletStore } from '../wallet/localWallet';
import { isLocalSessionMode, localUserId } from './localSession';

export interface AuthSession {
  /** False until the session source has finished initialising. */
  isReady: boolean;
  user: { id: string } | null;
  /**
   * End the session; resolves true once signed out. Without a backend this
   * removes the wallet key from the device, so it asks for confirmation first
   * and resolves false when the user backs out.
   */
  logout: () => Promise<boolean>;
}

function usePrivyAuthSession(): AuthSession {
  const { isReady, user, logout } = usePrivy();
  const signOut = useCallback(async () => {
    await logout();
    return true;
  }, [logout]);
  return { isReady, user: user ?? null, logout: signOut };
}

/** Ask before deleting the only copy of the key this device holds. */
export function confirmRemoveLocalWallet(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('localWallet.removeTitle'),
      i18n.t('localWallet.removeMessage'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: i18n.t('localWallet.removeConfirm'),
          style: 'destructive',
          onPress: () => {
            removeLocalWallet()
              .then(() => resolve(true))
              .catch((err) => {
                Logger.error('AuthSession', 'Failed to remove local wallet', {
                  error: err instanceof Error ? err.message : String(err),
                });
                resolve(false);
              });
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function useLocalAuthSession(): AuthSession {
  const status = useLocalWalletStore((s) => s.status);
  const eoaAddress = useLocalWalletStore((s) => s.eoaAddress);
  const user = useMemo(
    () => (status === 'present' && eoaAddress ? { id: localUserId(eoaAddress) } : null),
    [status, eoaAddress],
  );
  return {
    isReady: status === 'present' || status === 'absent',
    user,
    logout: confirmRemoveLocalWallet,
  };
}

export const useAuthSession: () => AuthSession = isLocalSessionMode()
  ? useLocalAuthSession
  : usePrivyAuthSession;

export interface SignerWallets {
  /** Privy embedded EOAs. Always empty without a backend — the key is on the device. */
  wallets: readonly ConnectedEthereumWallet[];
  create: () => Promise<unknown>;
}

function usePrivySignerWallets(): SignerWallets {
  const { wallets, create } = useEmbeddedEthereumWallet();
  return { wallets, create };
}

const LOCAL_SIGNER_WALLETS: SignerWallets = {
  wallets: [],
  create: async () => undefined,
};

function useLocalSignerWallets(): SignerWallets {
  return LOCAL_SIGNER_WALLETS;
}

export const useSignerWallets: () => SignerWallets = isLocalSessionMode()
  ? useLocalSignerWallets
  : usePrivySignerWallets;
