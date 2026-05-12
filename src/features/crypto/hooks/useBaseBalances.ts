/**
 * Reads ERC-20 balances for all blue-chip tokens from a given SCA address on Base.
 * Uses viem multicall for a single RPC round-trip.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPublicClient, erc20Abi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import i18n from '../../../shared/locales/i18n';

import { createBaseTransport } from '../../card/config/cardWalletConfig';
import { BLUE_CHIPS, BluechipToken } from '../config/blueChips';

export type TokenBalances = Record<string, number>; // symbol → human-readable amount

const REFRESH_INTERVAL_MS = 30_000;

const publicClient = createPublicClient({
  chain: base,
  transport: createBaseTransport(),
});

async function fetchBalances(address: `0x${string}`): Promise<TokenBalances> {
  const erc20Tokens = BLUE_CHIPS.filter((t) => t.baseAddress !== null);
  const nativeTokens = BLUE_CHIPS.filter((t) => t.baseAddress === null);

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

  return balances;
}

export function useBaseBalances(scaAddress: string | null) {
  const [balances, setBalances] = useState<TokenBalances>({});
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!scaAddress) {
      setBalances({});
      setHasLoaded(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBalances(scaAddress as `0x${string}`);
      setBalances(result);
      setHasLoaded(true);
    } catch (e: any) {
      setError(e?.message ?? i18n.t('crypto.balanceFetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [scaAddress]);

  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  return { balances, loading, hasLoaded, refresh, error };
}

export type { BluechipToken };
