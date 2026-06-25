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
 * The SCA address is deterministic (EOA + Safe version + EntryPoint), so
 * even if all caches are lost, we can always re-derive it from the Privy EOA.
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
  USDC_BASE,
  WETH_BASE,
  WALLET_ADDRESS_STORE_KEY,
  WALLET_IMPORTED_KEY,
  PAY_GAS_IN_USDC,
  GAS_TOKEN,
  GAS_RESERVE_BUFFER,
  GAS_RESERVE_FALLBACK_USDC,
} from '../config/cardWalletConfig';
import { fetchWalletRecord, saveScaAddress, saveEoaAddress } from '../../../lib/api/wallet/client';
import Logger from '../../../shared/utils/Logger';
import { selectCanonicalEmbeddedWallet } from '../../../shared/utils/embeddedWallet';
import i18n from '../../../shared/locales/i18n';
import type { LiFiBridgeQuote } from '../../../lib/api/bridge/lifiClient';
import type { SwapQuote } from '../../../lib/api/bridge/lifiSwapClient';
import type { MorphoVaultAssetRef } from '../../../lib/wallet/morphoVault';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildSmartAccountClientFromPrivKey as buildSmartAccountClient,
  buildAllowanceAndTxCalls,
  estimateErc20GasUsdc,
  fetchWalletBalances,
  privateKeyFromMnemonic,
  resolveKuraSmartAccountClient,
  truncateAddress,
  withGasApprovalCalls,
  type ImportMnemonicType,
  type SmartAccountCall as Call,
  type TypedDataInput,
} from '../../../lib/wallet/smartAccountClient';

export type { ImportMnemonicType, TypedDataInput };

export interface MorphoEarnVaultParams {
  innerVaultAddress: `0x${string}`;
  depositVaultAddress: `0x${string}`;
  usesFeeWrapper: boolean;
  asset: MorphoVaultAssetRef;
}

export interface MorphoEarnWithdrawParams extends MorphoEarnVaultParams {
  withdrawAll: boolean;
  amountAssets?: number;
}
export { buildSmartAccountClient, privateKeyFromMnemonic };

export type WalletStatus = 'loading' | 'provisioning' | 'ready' | 'error';

export interface UseKuraCardWalletReturn {
  status: WalletStatus;
  smartAddress: string;
  truncatedAddress: string;
  usdcBalance: number;
  wethBalance: number;
  errorMessage: string;
  isSending: boolean;
  isBridging: boolean;
  isExecutingSwap: boolean;
  isExecutingEarn: boolean;
  /** Power-user: replace the Privy EOA signer with a BIP-39 imported key */
  importWallet: (phrase: string, type: ImportMnemonicType) => Promise<void>;
  refreshBalance: () => Promise<void>;
  sendUsdc: (toAddress: string, amountUsdc: number) => Promise<string>;
  /** Transfer an ERC-20 token from the SCA on Base. */
  sendToken: (
    tokenAddress: `0x${string}`,
    decimals: number,
    toAddress: string,
    amount: number,
  ) => Promise<string>;
  /** Send native ETH from the SCA on Base. */
  sendNativeEth: (toAddress: string, amountEth: number) => Promise<string>;
  /** Wrap native ETH into WETH on Base (required before swapping mistaken ETH deposits). */
  wrapEthToWeth: (amountEth: number) => Promise<string>;
  /**
   * Estimate the USDC that must be left in the SCA to cover network fees for a
   * single UserOp. Returns 0 when gas is sponsored. Used to reserve gas so a
   * "max send" doesn't leave the account unable to pay the ERC-20 paymaster.
   */
  estimateUsdcGasReserve: () => Promise<number>;
  executeBridge: (quote: LiFiBridgeQuote) => Promise<string>;
  /** Estimate the actual USDC gas cost for a bridge route (0 when sponsored). */
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
  /** Same-chain token swap on Base via Li.Fi */
  executeSwap: (quote: SwapQuote) => Promise<string>;
  /** Estimate the actual USDC gas cost for a same-chain swap (0 when sponsored). */
  estimateSwapGasUsdc: (quote: SwapQuote) => Promise<number>;
  /** Deposit into a Morpho ERC-4626 vault (fee wrapper when configured). */
  executeMorphoDeposit: (params: MorphoEarnVaultParams & { amount: number }) => Promise<string>;
  /** Withdraw / redeem from a Morpho vault. */
  executeMorphoWithdraw: (params: MorphoEarnWithdrawParams) => Promise<string>;
  /** Estimate USDC gas for a Morpho earn deposit. */
  estimateMorphoDepositGasUsdc: (params: MorphoEarnVaultParams & { amount: number }) => Promise<number>;
  /** Estimate USDC gas for a Morpho earn withdraw. */
  estimateMorphoWithdrawGasUsdc: (params: MorphoEarnWithdrawParams) => Promise<number>;
  /** Sign a plain message with the Safe SCA (ERC-1271). */
  signMessage: (message: string) => Promise<string>;
  /** Sign EIP-712 typed data with the Safe SCA (ERC-1271). */
  signTypedData: (typedData: TypedDataInput) => Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ─────────────────────────────────────────────────────────────────────────────
// Hook (single instance — mount via KuraWalletConnectShell + context)
// ─────────────────────────────────────────────────────────────────────────────

export function useKuraCardWalletState(): UseKuraCardWalletReturn {
  const authToken = useAppStore((s) => s.authToken);
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [smartAddress, setSmartAddress] = useState('');
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [wethBalance, setWethBalance] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [isExecutingEarn, setIsExecutingEarn] = useState(false);

  const cancelRef = useRef(false);
  const provisioningRef = useRef(false); // guard against concurrent runs
  const provisionedScaRef = useRef<string | null>(null);

  const { wallets: embeddedWallets, create: createEmbeddedWallet } = useEmbeddedEthereumWallet();
  const { user } = usePrivy();
  // Lock onto a single, deterministic EOA. Privy keeps every embedded wallet it
  // has ever created for a user, and the array order is not stable — indexing
  // [0] could resolve to a different EOA (and thus a different Safe SCA) between
  // sessions. selectCanonicalEmbeddedWallet always returns the lowest-index one.
  const embeddedWallet = selectCanonicalEmbeddedWallet(embeddedWallets);
  const embeddedWalletRef = useRef(embeddedWallet);
  embeddedWalletRef.current = embeddedWallet;
  /** Stable identity — Privy may replace wallet object refs without changing the EOA. */
  const embeddedWalletKey = embeddedWallet
    ? `${embeddedWallet.walletIndex}:${embeddedWallet.address.toLowerCase()}`
    : null;

  // ── Resolve key source ────────────────────────────────────────────────────

  async function resolveSmartAccountClient(): Promise<{
    smartAccountClient: AnyClient;
    smartAddress: `0x${string}`;
    pimlicoClient: AnyClient;
  }> {
    const wallet = embeddedWalletRef.current;
    if (!wallet) {
      throw new Error('Embedded wallet not available.');
    }
    return resolveKuraSmartAccountClient(() => wallet.getProvider());
  }

  // ── Auto-provision ────────────────────────────────────────────────────────
  // Runs whenever authToken or embeddedWallet changes.
  // Strategy:
  //   1. Ensure Privy EOA exists — call create() if not.
  //   2. Resolve SCA address: SecureStore → backend → compute+register.
  //   3. Fetch balances → ready.

  useEffect(() => {
    const token = useAppStore.getState().authToken;
    if (!token || !user) return;
    if (provisioningRef.current) return;

    cancelRef.current = false;
    provisioningRef.current = true;

    async function applyReady(scaAddress: string, usdc: number, weth: number, logReady = false) {
      if (cancelRef.current) return;
      setSmartAddress(scaAddress);
      setUsdcBalance(usdc);
      setWethBalance(weth);
      setStatus('ready');
      provisionedScaRef.current = scaAddress;
      setGlobalProvisionedSca(scaAddress);
      if (logReady) {
        Logger.info('KuraCardWallet', 'Wallet ready', { scaAddress, usdc, weth });
      }
    }

    async function resolveScaAddress(wallet: NonNullable<typeof embeddedWalletRef.current>) {
      // Global fast path — already provisioned this session (survives remounts).
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
          const accounts: string[] = await (provider as any).request({ method: 'eth_accounts' });
          const eoaAddress = accounts[0] as string;

          const { smartAddress: addr } = await resolveSmartAccountClient();

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

        // ── Step 1: Ensure Privy embedded EOA ─────────────────────────────
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

        // ── Step 2: Resolve SCA (session + hook fast paths) ───────────────
        const cachedSca =
          getGlobalProvisionedSca() ?? (await SecureStore.getItemAsync(WALLET_ADDRESS_STORE_KEY));

        if (cachedSca) {
          const { usdc, weth } = await fetchWalletBalances(cachedSca as `0x${string}`);
          await applyReady(cachedSca, usdc, weth, provisionedScaRef.current !== cachedSca);
          return;
        }

        Logger.info('KuraCardWallet', 'Resolving Smart Account address...');
        setStatus('loading');

        const scaAddress = await resolveScaAddress(wallet);
        if (!scaAddress || cancelRef.current) return;

        const { usdc, weth } = await fetchWalletBalances(scaAddress as `0x${string}`);
        await applyReady(scaAddress, usdc, weth, true);
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
  }, [authToken, user?.id, embeddedWalletKey]);

  // ── refreshBalance ────────────────────────────────────────────────────────

  const refreshBalance = useCallback(async () => {
    if (!smartAddress) return;
    try {
      const { usdc, weth } = await fetchWalletBalances(smartAddress as `0x${string}`);
      setUsdcBalance(usdc);
      setWethBalance(weth);
    } catch {
      // Silently fail — stale balance beats an error screen
    }
  }, [smartAddress]);

  // ── estimateUsdcGasReserve ─────────────────────────────────────────────────

  const estimateUsdcGasReserve = useCallback(async (): Promise<number> => {
    if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const { encodeFunctionData, erc20Abi } = require('viem') as typeof import('viem');
      const { base } = require('viem/chains') as typeof import('viem/chains');

      // Gas is independent of the transferred amount, so a 0-value self-transfer
      // is a faithful proxy for the real send's UserOp cost.
      const calls = await withGasApprovalCalls(pimlicoClient, sca, [
        {
          to: USDC_BASE as `0x${string}`,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [sca, 0n] }),
        },
      ]);
      const userOperation = await client.prepareUserOperation({ calls });
      const { costInToken } = await pimlicoClient.estimateErc20PaymasterCost({
        userOperation,
        token: GAS_TOKEN as `0x${string}`,
        chain: base,
      });
      // costInToken is in USDC base units (6 decimals); apply the safety buffer.
      const reserve = (Number(costInToken) / 1_000_000) * GAS_RESERVE_BUFFER;
      return Math.max(reserve, 0.01);
    } catch (err) {
      Logger.warn('KuraCardWallet', 'Gas reserve estimate failed; using fallback', {
        err: err instanceof Error ? err.message : String(err),
      });
      return GAS_RESERVE_FALLBACK_USDC;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── sendUsdc ──────────────────────────────────────────────────────────────

  const sendUsdc = useCallback(async (toAddress: string, amountUsdc: number): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    const { encodeFunctionData, erc20Abi, isAddress } = require('viem') as typeof import('viem');
    if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
    if (amountUsdc <= 0) throw new Error('Amount must be greater than 0.');
    if (amountUsdc > usdcBalance) throw new Error('Insufficient USDC balance.');
    setIsSending(true);
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const calls = await withGasApprovalCalls(pimlicoClient, sca, [
        {
          to: USDC_BASE as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [toAddress as `0x${string}`, BigInt(Math.round(amountUsdc * 1_000_000))],
          }),
        },
      ]);
      const hash = await client.sendTransaction({ calls });
      fetchWalletBalances(smartAddress as `0x${string}`)
        .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
        .catch(() => undefined);
      return hash as string;
    } finally {
      setIsSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, usdcBalance, embeddedWallet]);

  // ── sendToken ─────────────────────────────────────────────────────────────

  const sendToken = useCallback(
    async (
      tokenAddress: `0x${string}`,
      decimals: number,
      toAddress: string,
      amount: number,
    ): Promise<string> => {
      if (!smartAddress) throw new Error('Wallet not ready.');
      const { encodeFunctionData, erc20Abi, isAddress, parseUnits } =
        require('viem') as typeof import('viem');
      if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
      if (amount <= 0) throw new Error('Amount must be greater than 0.');

      setIsSending(true);
      try {
        const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
          await resolveSmartAccountClient();
        const amountWei = (() => {
          const raw = amount.toString();
          const [whole, frac = ''] = raw.split('.');
          const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
          return parseUnits(safe as `${number}`, decimals);
        })();
        const calls = await withGasApprovalCalls(pimlicoClient, sca, [
          {
            to: tokenAddress,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [toAddress as `0x${string}`, amountWei],
            }),
          },
        ]);
        const hash = await client.sendTransaction({ calls });
        fetchWalletBalances(smartAddress as `0x${string}`)
          .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
          .catch(() => undefined);
        return hash as string;
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [smartAddress, embeddedWallet],
  );

  // ── sendNativeEth ─────────────────────────────────────────────────────────

  const sendNativeEth = useCallback(async (toAddress: string, amountEth: number): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    const { isAddress, parseUnits } = require('viem') as typeof import('viem');
    if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
    if (amountEth <= 0) throw new Error('Amount must be greater than 0.');

    setIsSending(true);
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const raw = amountEth.toString();
      const [whole, frac = ''] = raw.split('.');
      const safe = frac ? `${whole}.${frac.slice(0, 18)}` : whole;
      const amountWei = parseUnits(safe as `${number}`, 18);
      const calls = await withGasApprovalCalls(pimlicoClient, sca, [
        { to: toAddress as `0x${string}`, value: amountWei, data: '0x' },
      ]);
      const hash = await client.sendTransaction({ calls });
      fetchWalletBalances(smartAddress as `0x${string}`)
        .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
        .catch(() => undefined);
      return hash as string;
    } finally {
      setIsSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── wrapEthToWeth ─────────────────────────────────────────────────────────

  const wrapEthToWeth = useCallback(async (amountEth: number): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    if (amountEth <= 0) throw new Error('Amount must be greater than 0.');

    setIsSending(true);
    try {
      const { encodeFunctionData, parseUnits } = require('viem') as typeof import('viem');
      const wethAbi = [
        {
          type: 'function',
          name: 'deposit',
          inputs: [],
          outputs: [],
          stateMutability: 'payable',
        },
      ] as const;
      const raw = amountEth.toString();
      const [whole, frac = ''] = raw.split('.');
      const safe = frac ? `${whole}.${frac.slice(0, 18)}` : whole;
      const amountWei = parseUnits(safe as `${number}`, 18);
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const calls = await withGasApprovalCalls(pimlicoClient, sca, [
        {
          to: WETH_BASE as `0x${string}`,
          value: amountWei,
          data: encodeFunctionData({ abi: wethAbi, functionName: 'deposit' }),
        },
      ]);
      const hash = await client.sendTransaction({ calls });
      fetchWalletBalances(smartAddress as `0x${string}`)
        .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
        .catch(() => undefined);
      return hash as string;
    } finally {
      setIsSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── executeBridge ─────────────────────────────────────────────────────────

  const executeBridge = useCallback(async (quote: LiFiBridgeQuote): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    const spender = quote.approvalAddress as `0x${string}`;
    const fromToken = quote.fromToken.address as `0x${string}`;
    const fromAmount = BigInt(quote.fromAmount);

    setIsBridging(true);
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const callsRaw = await buildAllowanceAndTxCalls({
        spender,
        fromToken,
        fromAmount,
        scaAddress: sca,
        tx: {
          to: quote.transactionRequest.to as `0x${string}`,
          data: quote.transactionRequest.data as `0x${string}`,
          value: BigInt(quote.transactionRequest.value ?? '0'),
        },
      });
      const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
      const txHash = await client.sendTransaction({ calls });
      fetchWalletBalances(smartAddress as `0x${string}`)
        .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
        .catch(() => undefined);
      return txHash as string;
    } finally {
      setIsBridging(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── estimateBridgeGasUsdc ──────────────────────────────────────────────────

  const estimateBridgeGasUsdc = useCallback(async (quote: LiFiBridgeQuote): Promise<number> => {
    if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const callsRaw = await buildAllowanceAndTxCalls({
        spender: quote.approvalAddress as `0x${string}`,
        fromToken: quote.fromToken.address as `0x${string}`,
        fromAmount: BigInt(quote.fromAmount),
        scaAddress: sca,
        tx: {
          to: quote.transactionRequest.to as `0x${string}`,
          data: quote.transactionRequest.data as `0x${string}`,
          value: BigInt(quote.transactionRequest.value ?? '0'),
        },
      });
      const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
      return await estimateErc20GasUsdc(client, pimlicoClient, calls);
    } catch (err) {
      Logger.warn('KuraCardWallet', 'Bridge gas estimate failed; using fallback', {
        err: err instanceof Error ? err.message : String(err),
      });
      return GAS_RESERVE_FALLBACK_USDC;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── executeSwap (same-chain Base swap via Li.Fi) ───────────────────────────

  const executeSwap = useCallback(async (quote: SwapQuote): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');

    setIsExecutingSwap(true);
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const callsRaw = await buildAllowanceAndTxCalls({
        spender: quote.approvalAddress as `0x${string}`,
        fromToken: quote.fromToken.address as `0x${string}`,
        fromAmount: BigInt(quote.fromAmount),
        scaAddress: sca,
        tx: {
          to: quote.transactionRequest.to as `0x${string}`,
          data: quote.transactionRequest.data as `0x${string}`,
          value: BigInt(quote.transactionRequest.value ?? '0'),
        },
      });
      const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
      const txHash = await client.sendTransaction({ calls });
      fetchWalletBalances(smartAddress as `0x${string}`)
        .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
        .catch(() => undefined);
      return txHash as string;
    } finally {
      setIsExecutingSwap(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── estimateSwapGasUsdc ────────────────────────────────────────────────────

  const estimateSwapGasUsdc = useCallback(async (quote: SwapQuote): Promise<number> => {
    if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
    try {
      const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
        await resolveSmartAccountClient();
      const callsRaw = await buildAllowanceAndTxCalls({
        spender: quote.approvalAddress as `0x${string}`,
        fromToken: quote.fromToken.address as `0x${string}`,
        fromAmount: BigInt(quote.fromAmount),
        scaAddress: sca,
        tx: {
          to: quote.transactionRequest.to as `0x${string}`,
          data: quote.transactionRequest.data as `0x${string}`,
          value: BigInt(quote.transactionRequest.value ?? '0'),
        },
      });
      const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
      return await estimateErc20GasUsdc(client, pimlicoClient, calls);
    } catch (err) {
      Logger.warn('KuraCardWallet', 'Swap gas estimate failed; using fallback', {
        err: err instanceof Error ? err.message : String(err),
      });
      return GAS_RESERVE_FALLBACK_USDC;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── Morpho Earn (ERC-4626 deposit / withdraw) ─────────────────────────────

  const executeMorphoDeposit = useCallback(
    async (params: MorphoEarnVaultParams & { amount: number }): Promise<string> => {
      if (!smartAddress) throw new Error('Wallet not ready.');
      const {
        buildMorphoDepositTx,
      } = require('../../../lib/wallet/morphoVault') as typeof import('../../../lib/wallet/morphoVault');

      setIsExecutingEarn(true);
      try {
        const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
          await resolveSmartAccountClient();
        const { assetsRaw, tx } = buildMorphoDepositTx({
          vaultAddress: params.depositVaultAddress,
          asset: params.asset,
          amount: params.amount,
          receiver: sca,
        });
        const callsRaw = await buildAllowanceAndTxCalls({
          spender: params.depositVaultAddress,
          fromToken: params.asset.address,
          fromAmount: assetsRaw,
          scaAddress: sca,
          tx,
        });
        const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
        const txHash = await client.sendTransaction({ calls });

        fetchWalletBalances(smartAddress as `0x${string}`)
          .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
          .catch(() => undefined);
        return txHash as string;
      } finally {
        setIsExecutingEarn(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [smartAddress, embeddedWallet],
  );

  const executeMorphoWithdraw = useCallback(
    async (params: MorphoEarnWithdrawParams): Promise<string> => {
      if (!smartAddress) throw new Error('Wallet not ready.');
      const {
        planMorphoWithdraw,
        buildMorphoWithdrawCalls,
      } = require('../../../lib/wallet/morphoVault') as typeof import('../../../lib/wallet/morphoVault');

      setIsExecutingEarn(true);
      try {
        const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
          await resolveSmartAccountClient();
        const plan = await planMorphoWithdraw({
          vaultAddress: params.depositVaultAddress,
          assetDecimals: params.asset.decimals,
          owner: sca,
          withdrawAll: params.withdrawAll,
          amountAssets: params.amountAssets,
        });
        const callsRaw = buildMorphoWithdrawCalls({
          vaultAddress: params.depositVaultAddress,
          owner: sca,
          plan,
        });
        const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
        const txHash = await client.sendTransaction({ calls });

        fetchWalletBalances(smartAddress as `0x${string}`)
          .then(({ usdc, weth }) => { setUsdcBalance(usdc); setWethBalance(weth); })
          .catch(() => undefined);
        return txHash as string;
      } finally {
        setIsExecutingEarn(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [smartAddress, embeddedWallet],
  );

  const estimateMorphoDepositGasUsdc = useCallback(
    async (params: MorphoEarnVaultParams & { amount: number }): Promise<number> => {
      if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
      try {
        const { buildMorphoDepositTx } =
          require('../../../lib/wallet/morphoVault') as typeof import('../../../lib/wallet/morphoVault');
        const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
          await resolveSmartAccountClient();
        const { assetsRaw, tx } = buildMorphoDepositTx({
          vaultAddress: params.depositVaultAddress,
          asset: params.asset,
          amount: params.amount,
          receiver: sca,
        });
        const callsRaw = await buildAllowanceAndTxCalls({
          spender: params.depositVaultAddress,
          fromToken: params.asset.address,
          fromAmount: assetsRaw,
          scaAddress: sca,
          tx,
        });
        const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
        return await estimateErc20GasUsdc(client, pimlicoClient, calls);
      } catch (err) {
        Logger.warn('KuraCardWallet', 'Morpho deposit gas estimate failed; using fallback', {
          err: err instanceof Error ? err.message : String(err),
        });
        return GAS_RESERVE_FALLBACK_USDC;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [smartAddress, embeddedWallet],
  );

  const estimateMorphoWithdrawGasUsdc = useCallback(
    async (params: MorphoEarnWithdrawParams): Promise<number> => {
      if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
      try {
        const {
          planMorphoWithdraw,
          buildMorphoWithdrawCalls,
        } = require('../../../lib/wallet/morphoVault') as typeof import('../../../lib/wallet/morphoVault');
        const { smartAccountClient: client, smartAddress: sca, pimlicoClient } =
          await resolveSmartAccountClient();
        const plan = await planMorphoWithdraw({
          vaultAddress: params.depositVaultAddress,
          assetDecimals: params.asset.decimals,
          owner: sca,
          withdrawAll: params.withdrawAll,
          amountAssets: params.amountAssets,
        });
        const callsRaw = buildMorphoWithdrawCalls({
          vaultAddress: params.depositVaultAddress,
          owner: sca,
          plan,
        });
        const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
        return await estimateErc20GasUsdc(client, pimlicoClient, calls);
      } catch (err) {
        Logger.warn('KuraCardWallet', 'Morpho withdraw gas estimate failed; using fallback', {
          err: err instanceof Error ? err.message : String(err),
        });
        return GAS_RESERVE_FALLBACK_USDC;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [smartAddress, embeddedWallet],
  );

  // ── Signing (Dinari order permits, wallet-connect nonce, etc.) ─────────────

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    const { smartAccountClient: client } = await resolveSmartAccountClient();
    const sig = await client.signMessage({ message });
    return sig as string;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  const signTypedData = useCallback(async (typedData: TypedDataInput): Promise<string> => {
    if (!smartAddress) throw new Error('Wallet not ready.');
    const { smartAccountClient: client } = await resolveSmartAccountClient();
    const sig = await client.signTypedData({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    });
    return sig as string;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress, embeddedWallet]);

  // ── importWallet (power user) ─────────────────────────────────────────────

  const importWallet = useCallback(async (phrase: string, type: ImportMnemonicType) => {
    setStatus('provisioning');
    setErrorMessage('');
    try {
      const privKey = privateKeyFromMnemonic(phrase, type);
      const { smartAddress: addr } = await buildSmartAccountClient(privKey);
      await SecureStore.setItemAsync(WALLET_IMPORTED_KEY, privKey);
      await SecureStore.setItemAsync(WALLET_ADDRESS_STORE_KEY, addr);
      await saveScaAddress(addr).catch(() => undefined);
      const { usdc, weth } = await fetchWalletBalances(addr);
      setSmartAddress(addr);
      setUsdcBalance(usdc);
      setWethBalance(weth);
      setStatus('ready');
      provisionedScaRef.current = addr;
      setGlobalProvisionedSca(addr);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : i18n.t('card.importFailedShort'));
      setStatus('error');
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    smartAddress,
    truncatedAddress: smartAddress ? truncateAddress(smartAddress) : '',
    usdcBalance,
    wethBalance,
    errorMessage,
    isSending,
    isBridging,
    isExecutingSwap,
    isExecutingEarn,
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
    signMessage,
    signTypedData,
  };
}
