/**
 * Reads ERC-20 balances for all blue-chip tokens from a given SCA address on Base.
 * Uses viem multicall for a single RPC round-trip.
 *
 * Polls every {@link REFRESH_INTERVAL_MS} while the app is foregrounded; pauses in
 * background and refreshes once when returning to active.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { createPublicClient, erc20Abi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import i18n from '../../../shared/locales/i18n';

import { createBaseTransport } from '../../card/config/cardWalletConfig';
import { BLUE_CHIPS, BluechipToken } from '../config/blueChips';

export type TokenBalances = Record<string, number>; // symbol → human-readable amount

const REFRESH_INTERVAL_MS = 30_000;
const TX_REFRESH_DELAYS_MS = [0, 1200, 3000, 6000];

const publicClient = createPublicClient({
  chain: base,
  transport: createBaseTransport(),
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchBaseBalances(address: `0x${string}`): Promise<TokenBalances> {
  const erc20Tokens = BLUE_CHIPS.filter((t) => t.baseAddress !== null && t.trackBalance !== false);
  const nativeTokens = BLUE_CHIPS.filter((t) => t.baseAddress === null && t.trackBalance !== false);

  const calls = erc20Tokens.map((t) => ({
    address: t.baseAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [address] as [`0x${string}`],
  }));

  const [results, nativeBalance] = await Promise.all([
    erc20Tokens.length > 0
      ? publicClient.multicall({ contracts: calls, allowFailure: true })
      : Promise.resolve([]),
    nativeTokens.length > 0
      ? publicClient.getBalance({ address })
      : Promise.resolve(0n),
  ]);

  const balances: TokenBalances = {};

  results.forEach((result, i) => {
    const token = erc20Tokens[i]!;
    if (result.status === 'success') {
      const raw = result.result as bigint;
      balances[token.symbol] = parseFloat(formatUnits(raw, token.decimals));
    } else {
      balances[token.symbol] = 0;
    }
  });

  if (nativeTokens.length > 0) {
    const nativeAmount = parseFloat(formatUnits(nativeBalance, nativeTokens[0]!.decimals));
    for (const token of nativeTokens) {
      balances[token.symbol] = nativeAmount;
    }
  }

  for (const token of BLUE_CHIPS.filter((t) => t.trackBalance === false)) {
    balances[token.symbol] = 0;
  }

  return balances;
}

/** Poll all token balances after a UserOp — RPC state can lag behind the bundler receipt. */
export async function refreshBaseBalancesAfterTx(
  address: `0x${string}`,
  onUpdate?: (balances: TokenBalances) => void,
): Promise<TokenBalances> {
  let balances: TokenBalances = {};

  for (let i = 0; i < TX_REFRESH_DELAYS_MS.length; i++) {
    if (i > 0) await sleep(TX_REFRESH_DELAYS_MS[i] - TX_REFRESH_DELAYS_MS[i - 1]);
    try {
      balances = await fetchBaseBalances(address);
      onUpdate?.(balances);
    } catch {
      // Best-effort — keep polling.
    }
  }

  return balances;
}

export function usdcBalanceFrom(balances: TokenBalances): number {
  return balances.USDC ?? 0;
}

export function useBaseBalances(scaAddress: string | null) {
  const [balances, setBalances] = useState<TokenBalances>({});
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async (options?: { silent?: boolean; address?: string | null }) => {
    const target = options?.address ?? scaAddress;
    if (!target) {
      setBalances({});
      setHasLoaded(false);
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }
    if (!options?.silent && !hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchBaseBalances(target as `0x${string}`);
      setBalances(result);
      setHasLoaded(true);
      hasLoadedRef.current = true;
    } catch (e: any) {
      setError(e?.message ?? i18n.t('crypto.balanceFetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [scaAddress]);

  const refreshAfterTx = useCallback(async (address?: string | null) => {
    const target = address ?? scaAddress;
    if (!target) return;
    await refreshBaseBalancesAfterTx(target as `0x${string}`, setBalances);
  }, [scaAddress]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        void refresh({ silent: true });
      }, REFRESH_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    void refresh();

    if (AppState.currentState === 'active') {
      startPolling();
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void refresh({ silent: true });
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [refresh]);

  return { balances, loading, hasLoaded, refresh, refreshAfterTx, error };
}

export type { BluechipToken };
