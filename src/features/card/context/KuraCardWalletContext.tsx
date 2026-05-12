import React, { createContext, useContext } from 'react';
import type { UseKuraCardWalletReturn } from '../hooks/useKuraCardWallet';

const KuraCardWalletContext = createContext<UseKuraCardWalletReturn | null>(null);

export function KuraCardWalletProvider({
  value,
  children,
}: {
  value: UseKuraCardWalletReturn;
  children: React.ReactNode;
}) {
  return <KuraCardWalletContext.Provider value={value}>{children}</KuraCardWalletContext.Provider>;
}

/** Read the app-wide Kura Card wallet (provisioned once in KuraWalletConnectShell). */
export function useKuraCardWallet(): UseKuraCardWalletReturn {
  const ctx = useContext(KuraCardWalletContext);
  if (!ctx) {
    throw new Error('useKuraCardWallet must be used within KuraWalletConnectShell');
  }
  return ctx;
}
