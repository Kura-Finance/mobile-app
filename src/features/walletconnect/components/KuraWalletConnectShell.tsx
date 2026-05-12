import React from 'react';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useKuraCardWalletState } from '../../card/hooks/useKuraCardWallet';
import { KuraCardWalletProvider } from '../../card/context/KuraCardWalletContext';
import { KuraWalletConnectProvider } from '../context/KuraWalletConnectContext';
import AppKitKuraWalletBridge from './AppKitKuraWalletBridge';

interface Props {
  children: React.ReactNode;
}

/**
 * App-level WalletConnect wallet shell: initializes WalletKit, handles inbound
 * deep links, and renders session approval modals globally.
 */
export default function KuraWalletConnectShell({ children }: Props) {
  const userId = useAppStore((s) => s.userProfile.id);
  const wallet = useKuraCardWalletState();
  const { smartAddress, status: walletStatus } = wallet;
  const walletReady = walletStatus === 'ready' && !!smartAddress;

  return (
    <KuraCardWalletProvider value={wallet}>
      <KuraWalletConnectProvider
        smartAddress={smartAddress}
        walletReady={walletReady}
        userId={userId}
      >
        <AppKitKuraWalletBridge />
        {children}
      </KuraWalletConnectProvider>
    </KuraCardWalletProvider>
  );
}
