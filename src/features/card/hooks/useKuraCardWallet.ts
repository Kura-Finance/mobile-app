/**
 * useKuraCardWallet
 *
 * Manages the ERC-4337 Smart Contract Wallet that backs the Kura Card.
 *
 * Key stack:
 *   Privy Embedded Wallet (EOA, MPC-backed)
 *     → toSafeSmartAccount  (Safe 1.4.1, EntryPoint 0.7)
 *     → SmartAccountClient  (Pimlico bundler + Verifying Paymaster on Base)
 *
 * Provisioning flow (fully automatic — no manual user step required):
 *   1. Ensure Privy embedded EOA exists (call `create()` if not present).
 *   2. Look up the Safe SCA address:
 *        a. SecureStore cache (fastest, no network)
 *        b. Kura backend  (cross-device, survives device wipe)
 *        c. Compute + register (first time on any device)
 *   3. Fetch USDC / WETH balances.
 *   4. status → 'ready'
 *
 * Transaction helpers live in `./kuraCardWallet/*` — this hook wires provisioning,
 * balance state, and loading flags.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import {
  getGlobalProvisionedSca,
  getGlobalProvisionPromise,
  setGlobalProvisionedSca,
  setGlobalProvisionPromise,
} from '../kuraCardWalletSession';
import { useAppStore } from '../../../shared/store/useAppStore';
import {
  WALLET_ADDRESS_STORE_KEY,
  WALLET_IMPORTED_KEY,
} from '../config/cardWalletConfig';
import { fetchWalletRecord, saveScaAddress, saveEoaAddress } from '../../../lib/api/wallet/client';
import Logger from '../../../shared/utils/Logger';
import { selectCanonicalEmbeddedWallet } from '../../../shared/utils/embeddedWallet';
import i18n from '../../../shared/locales/i18n';
import {
  fetchBaseBalances,
  usdcBalanceFrom,
  useBaseBalances,
} from '../../crypto/hooks/useBaseBalances';
import {
  buildSmartAccountClientFromPrivKey,
  privateKeyFromMnemonic,
  resolveKuraSmartAccountClient,
  truncateAddress,
  type ImportMnemonicType,
} from '../../../lib/wallet/smartAccountClient';
import { estimateUsdcGasReserve as estimateUsdcGasReserveTx } from './kuraCardWallet/gasReserve';
import {
  executeMorphoBorrowTx,
  executeMorphoDepositTx,
  executeMorphoRepayTx,
  executeMorphoWithdrawCollateralTx,
  executeMorphoWithdrawTx,
  estimateMorphoBorrowGasUsdc as estimateMorphoBorrowGasUsdcTx,
  estimateMorphoDepositGasUsdc as estimateMorphoDepositGasUsdcTx,
  estimateMorphoRepayGasUsdc as estimateMorphoRepayGasUsdcTx,
  estimateMorphoWithdrawCollateralGasUsdc as estimateMorphoWithdrawCollateralGasUsdcTx,
  estimateMorphoWithdrawGasUsdc as estimateMorphoWithdrawGasUsdcTx,
} from './kuraCardWallet/morphoTx';
import {
  sendNativeEthTx,
  sendTokenTx,
  sendUsdcTx,
  wrapEthToWethTx,
} from './kuraCardWallet/sendTx';
import { signMessageTx, signTypedDataTx } from './kuraCardWallet/signTx';
import {
  estimateBridgeGasUsdc as estimateBridgeGasUsdcTx,
  estimateSwapGasUsdc as estimateSwapGasUsdcTx,
  executeBridgeTx,
  executeSwapTx,
} from './kuraCardWallet/swapBridgeTx';
import type {
  MorphoBorrowTxParams,
  MorphoEarnVaultParams,
  MorphoEarnWithdrawParams,
  MorphoRepayTxParams,
  MorphoWithdrawCollateralTxParams,
  ResolveSmartAccountClient,
  TypedDataInput,
  UseKuraCardWalletReturn,
  WalletStatus,
} from './kuraCardWallet/types';

export type {
  ImportMnemonicType,
  MorphoBorrowTxParams,
  MorphoEarnVaultParams,
  MorphoEarnWithdrawParams,
  MorphoRepayTxParams,
  MorphoWithdrawCollateralTxParams,
  TypedDataInput,
  UseKuraCardWalletReturn,
  WalletStatus,
};

export { buildSmartAccountClientFromPrivKey, privateKeyFromMnemonic };

export function useKuraCardWalletState(): UseKuraCardWalletReturn {
  const authToken = useAppStore((s) => s.authToken);
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [smartAddress, setSmartAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [isExecutingEarn, setIsExecutingEarn] = useState(false);
  const [isExecutingBorrow, setIsExecutingBorrow] = useState(false);

  const cancelRef = useRef(false);
  const provisioningRef = useRef(false);
  const provisionedScaRef = useRef<string | null>(null);

  const { wallets: embeddedWallets, create: createEmbeddedWallet } = useEmbeddedEthereumWallet();
  const { user } = usePrivy();
  const embeddedWallet = selectCanonicalEmbeddedWallet(embeddedWallets);
  const embeddedWalletRef = useRef(embeddedWallet);
  embeddedWalletRef.current = embeddedWallet;
  const embeddedWalletKey = embeddedWallet
    ? `${embeddedWallet.walletIndex}:${embeddedWallet.address.toLowerCase()}`
    : null;

  const {
    balances,
    loading: balancesLoading,
    hasLoaded: balancesHasLoaded,
    refresh: refreshBalances,
    refreshAfterTx: scheduleBalanceRefresh,
  } = useBaseBalances(smartAddress || null);

  const refreshBalancesRef = useRef(refreshBalances);
  refreshBalancesRef.current = refreshBalances;

  const usdcBalance = usdcBalanceFrom(balances);
  const refreshBalance = refreshBalances;

  const resolveSmartAccountClient = useCallback<ResolveSmartAccountClient>(async () => {
    const wallet = embeddedWalletRef.current;
    if (!wallet) {
      throw new Error('Embedded wallet not available.');
    }
    return resolveKuraSmartAccountClient(() => wallet.getProvider());
  }, [embeddedWalletKey]);

  useEffect(() => {
    const token = useAppStore.getState().authToken;
    if (!token || !user) return;
    if (provisioningRef.current) return;

    cancelRef.current = false;
    provisioningRef.current = true;

    async function applyReady(scaAddress: string, logReady = false) {
      if (cancelRef.current) return;
      setSmartAddress(scaAddress);
      setStatus('ready');
      provisionedScaRef.current = scaAddress;
      setGlobalProvisionedSca(scaAddress);
      await refreshBalancesRef.current({ address: scaAddress });
      if (logReady) {
        try {
          const fetched = await fetchBaseBalances(scaAddress as `0x${string}`);
          Logger.info('KuraCardWallet', 'Wallet ready', {
            scaAddress,
            usdc: usdcBalanceFrom(fetched),
          });
        } catch {
          Logger.info('KuraCardWallet', 'Wallet ready', { scaAddress });
        }
      }
    }

    async function resolveScaAddress(wallet: NonNullable<typeof embeddedWalletRef.current>) {
      if (getGlobalProvisionedSca()) {
        return getGlobalProvisionedSca();
      }

      const existingPromise = getGlobalProvisionPromise();
      if (existingPromise) {
        return await existingPromise;
      }

      const provisionPromise = (async () => {
        let scaAddress = await SecureStore.getItemAsync(WALLET_ADDRESS_STORE_KEY);

        if (!scaAddress) {
          Logger.debug('KuraCardWallet', 'Cache miss — checking backend...');
          const record = await fetchWalletRecord();
          if (record.scaAddress) {
            Logger.info('KuraCardWallet', 'Restored SCA from backend', { addr: record.scaAddress });
            scaAddress = record.scaAddress;
            await SecureStore.setItemAsync(WALLET_ADDRESS_STORE_KEY, scaAddress);
          }
        }

        if (!scaAddress) {
          Logger.info('KuraCardWallet', 'First time — computing Safe SCA...');
          setStatus('provisioning');

          const provider = await wallet.getProvider();
          const accounts: string[] = await (provider as { request: (args: { method: string }) => Promise<string[]> }).request({ method: 'eth_accounts' });
          const eoaAddress = accounts[0] as string;

          const { smartAddress: addr } = await resolveKuraSmartAccountClient(() => wallet.getProvider());

          await Promise.all([
            saveScaAddress(addr).catch((err) =>
              Logger.warn('KuraCardWallet', 'Failed to save SCA to backend', { err }),
            ),
            saveEoaAddress(eoaAddress).catch((err) =>
              Logger.warn('KuraCardWallet', 'Failed to save EOA to backend', { err }),
            ),
            SecureStore.setItemAsync(WALLET_ADDRESS_STORE_KEY, addr),
          ]);

          scaAddress = addr;
          Logger.info('KuraCardWallet', 'Safe SCA registered', { eoaAddress, scaAddress: addr });
        }

        setGlobalProvisionedSca(scaAddress);
        return scaAddress;
      })().finally(() => {
        setGlobalProvisionPromise(null);
      });

      setGlobalProvisionPromise(provisionPromise);
      return await provisionPromise;
    }

    async function provision() {
      try {
        const wallet = embeddedWalletRef.current;

        if (!wallet) {
          Logger.info('KuraCardWallet', 'No embedded wallet — creating Privy EOA...');
          setStatus('provisioning');
          try {
            await createEmbeddedWallet();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.toLowerCase().includes('already')) throw err;
            Logger.info('KuraCardWallet', 'Embedded wallet already exists (idempotent)');
          }
          return;
        }

        const cachedSca =
          getGlobalProvisionedSca() ?? (await SecureStore.getItemAsync(WALLET_ADDRESS_STORE_KEY));

        if (cachedSca) {
          await applyReady(cachedSca, provisionedScaRef.current !== cachedSca);
          return;
        }

        Logger.info('KuraCardWallet', 'Resolving Smart Account address...');
        setStatus('loading');

        const scaAddress = await resolveScaAddress(wallet);
        if (!scaAddress || cancelRef.current) return;

        await applyReady(scaAddress, true);
      } catch (err) {
        if (cancelRef.current) return;
        const msg = err instanceof Error ? err.message : i18n.t('card.walletSetupFailed');
        Logger.error('KuraCardWallet', 'Provision failed', { err: msg });
        setErrorMessage(msg);
        setStatus('error');
      } finally {
        provisioningRef.current = false;
      }
    }

    provision();
    return () => {
      cancelRef.current = true;
      provisioningRef.current = false;
    };
  }, [authToken, user?.id, embeddedWalletKey, createEmbeddedWallet]);

  const requireReady = useCallback(() => {
    if (!smartAddress) throw new Error('Wallet not ready.');
  }, [smartAddress]);

  const estimateUsdcGasReserve = useCallback(async () => {
    requireReady();
    return estimateUsdcGasReserveTx(resolveSmartAccountClient, smartAddress);
  }, [requireReady, resolveSmartAccountClient, smartAddress]);

  const sendUsdc = useCallback(async (toAddress: string, amountUsdc: number) => {
    requireReady();
    setIsSending(true);
    try {
      const hash = await sendUsdcTx(resolveSmartAccountClient, toAddress, amountUsdc, usdcBalance);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsSending(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh, usdcBalance]);

  const sendToken = useCallback(async (
    tokenAddress: `0x${string}`,
    decimals: number,
    toAddress: string,
    amount: number,
  ) => {
    requireReady();
    setIsSending(true);
    try {
      const hash = await sendTokenTx(resolveSmartAccountClient, tokenAddress, decimals, toAddress, amount);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsSending(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh]);

  const sendNativeEth = useCallback(async (toAddress: string, amountEth: number) => {
    requireReady();
    setIsSending(true);
    try {
      const hash = await sendNativeEthTx(resolveSmartAccountClient, toAddress, amountEth);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsSending(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh]);

  const wrapEthToWeth = useCallback(async (amountEth: number) => {
    requireReady();
    setIsSending(true);
    try {
      const hash = await wrapEthToWethTx(resolveSmartAccountClient, amountEth);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsSending(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh]);

  const executeBridge = useCallback(async (quote: Parameters<typeof executeBridgeTx>[1]) => {
    requireReady();
    setIsBridging(true);
    try {
      const hash = await executeBridgeTx(resolveSmartAccountClient, quote);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsBridging(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh]);

  const estimateBridgeGasUsdc = useCallback(async (quote: Parameters<typeof estimateBridgeGasUsdcTx>[2]) => {
    requireReady();
    return estimateBridgeGasUsdcTx(resolveSmartAccountClient, smartAddress, quote);
  }, [requireReady, resolveSmartAccountClient, smartAddress]);

  const executeSwap = useCallback(async (quote: Parameters<typeof executeSwapTx>[1]) => {
    requireReady();
    setIsExecutingSwap(true);
    try {
      const hash = await executeSwapTx(resolveSmartAccountClient, quote);
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsExecutingSwap(false);
    }
  }, [requireReady, resolveSmartAccountClient, scheduleBalanceRefresh]);

  const estimateSwapGasUsdc = useCallback(async (quote: Parameters<typeof estimateSwapGasUsdcTx>[2]) => {
    requireReady();
    return estimateSwapGasUsdcTx(resolveSmartAccountClient, smartAddress, quote);
  }, [requireReady, resolveSmartAccountClient, smartAddress]);

  const runEarnTx = useCallback(async (fn: () => Promise<string>) => {
    requireReady();
    setIsExecutingEarn(true);
    try {
      const hash = await fn();
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsExecutingEarn(false);
    }
  }, [requireReady, scheduleBalanceRefresh]);

  const executeMorphoDeposit = useCallback(
    (params: MorphoEarnVaultParams & { amount: number }) =>
      runEarnTx(() => executeMorphoDepositTx(resolveSmartAccountClient, params)),
    [runEarnTx, resolveSmartAccountClient],
  );

  const executeMorphoWithdraw = useCallback(
    (params: MorphoEarnWithdrawParams) =>
      runEarnTx(() => executeMorphoWithdrawTx(resolveSmartAccountClient, params)),
    [runEarnTx, resolveSmartAccountClient],
  );

  const estimateMorphoDepositGasUsdc = useCallback(
    (params: MorphoEarnVaultParams & { amount: number }) => {
      requireReady();
      return estimateMorphoDepositGasUsdcTx(resolveSmartAccountClient, smartAddress, params);
    },
    [requireReady, resolveSmartAccountClient, smartAddress],
  );

  const estimateMorphoWithdrawGasUsdc = useCallback(
    (params: MorphoEarnWithdrawParams) => {
      requireReady();
      return estimateMorphoWithdrawGasUsdcTx(resolveSmartAccountClient, smartAddress, params);
    },
    [requireReady, resolveSmartAccountClient, smartAddress],
  );

  const runBorrowTx = useCallback(async (fn: () => Promise<string>) => {
    requireReady();
    setIsExecutingBorrow(true);
    try {
      const hash = await fn();
      scheduleBalanceRefresh();
      return hash;
    } finally {
      setIsExecutingBorrow(false);
    }
  }, [requireReady, scheduleBalanceRefresh]);

  const executeMorphoBorrow = useCallback(
    (params: MorphoBorrowTxParams) =>
      runBorrowTx(() => executeMorphoBorrowTx(resolveSmartAccountClient, params)),
    [runBorrowTx, resolveSmartAccountClient],
  );

  const executeMorphoRepay = useCallback(
    (params: MorphoRepayTxParams) =>
      runBorrowTx(() => executeMorphoRepayTx(resolveSmartAccountClient, params)),
    [runBorrowTx, resolveSmartAccountClient],
  );

  const executeMorphoWithdrawCollateral = useCallback(
    (params: MorphoWithdrawCollateralTxParams) =>
      runBorrowTx(() => executeMorphoWithdrawCollateralTx(resolveSmartAccountClient, params)),
    [runBorrowTx, resolveSmartAccountClient],
  );

  const estimateMorphoBorrowGasUsdc = useCallback(
    (params: MorphoBorrowTxParams) => {
      requireReady();
      return estimateMorphoBorrowGasUsdcTx(resolveSmartAccountClient, smartAddress, params);
    },
    [requireReady, resolveSmartAccountClient, smartAddress],
  );

  const estimateMorphoRepayGasUsdc = useCallback(
    (params: MorphoRepayTxParams) => {
      requireReady();
      return estimateMorphoRepayGasUsdcTx(resolveSmartAccountClient, smartAddress, params);
    },
    [requireReady, resolveSmartAccountClient, smartAddress],
  );

  const estimateMorphoWithdrawCollateralGasUsdc = useCallback(
    (params: MorphoWithdrawCollateralTxParams) => {
      requireReady();
      return estimateMorphoWithdrawCollateralGasUsdcTx(resolveSmartAccountClient, smartAddress, params);
    },
    [requireReady, resolveSmartAccountClient, smartAddress],
  );

  const signMessage = useCallback(async (message: string) => {
    requireReady();
    return signMessageTx(resolveSmartAccountClient, message);
  }, [requireReady, resolveSmartAccountClient]);

  const signTypedData = useCallback(async (typedData: TypedDataInput) => {
    requireReady();
    return signTypedDataTx(resolveSmartAccountClient, typedData);
  }, [requireReady, resolveSmartAccountClient]);

  const importWallet = useCallback(async (phrase: string, type: ImportMnemonicType) => {
    setStatus('provisioning');
    setErrorMessage('');
    try {
      const privKey = privateKeyFromMnemonic(phrase, type);
      const { smartAddress: addr } = await buildSmartAccountClientFromPrivKey(privKey);
      await SecureStore.setItemAsync(WALLET_IMPORTED_KEY, privKey);
      await SecureStore.setItemAsync(WALLET_ADDRESS_STORE_KEY, addr);
      await saveScaAddress(addr).catch(() => undefined);
      setSmartAddress(addr);
      setStatus('ready');
      provisionedScaRef.current = addr;
      setGlobalProvisionedSca(addr);
      await refreshBalances({ address: addr });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : i18n.t('card.importFailedShort'));
      setStatus('error');
      throw err;
    }
  }, [refreshBalances]);

  return {
    status,
    smartAddress,
    truncatedAddress: smartAddress ? truncateAddress(smartAddress) : '',
    balances,
    balancesLoading,
    balancesHasLoaded,
    usdcBalance,
    errorMessage,
    isSending,
    isBridging,
    isExecutingSwap,
    isExecutingEarn,
    isExecutingBorrow,
    importWallet,
    refreshBalance,
    sendUsdc,
    sendToken,
    sendNativeEth,
    wrapEthToWeth,
    estimateUsdcGasReserve,
    executeBridge,
    estimateBridgeGasUsdc,
    executeSwap,
    estimateSwapGasUsdc,
    executeMorphoDeposit,
    executeMorphoWithdraw,
    estimateMorphoDepositGasUsdc,
    estimateMorphoWithdrawGasUsdc,
    executeMorphoBorrow,
    executeMorphoRepay,
    estimateMorphoBorrowGasUsdc,
    estimateMorphoRepayGasUsdc,
    executeMorphoWithdrawCollateral,
    estimateMorphoWithdrawCollateralGasUsdc,
    signMessage,
    signTypedData,
  };
}
