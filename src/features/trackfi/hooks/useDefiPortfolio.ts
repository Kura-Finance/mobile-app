/**
 * useDefiPortfolio
 *
 * Manages a list of watched wallet addresses and fetches their on-chain token
 * balances + DeFi protocol positions via the Kura backend DeBank proxy.
 *
 * Addresses are persisted in AsyncStorage so they survive app restarts.
 *
 * DeBank data is loaded from the backend cache when the screen opens.
 * Pull-to-refresh triggers a backend DeBank sync (refresh=true).
 *
 * Backend endpoints:
 *   GET /api/debank/tokens?address=0x...&refresh=true|false
 *   GET /api/debank/protocols?address=0x...&refresh=true|false
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { filterSpotTokensForDisplay } from '../../../lib/api/debank/displayTokens';
import { computeWalletPortfolioTotals, effectiveProtocolDisplayUsd } from '../../../lib/api/debank/portfolioTotals';
import {
  fetchDeBankProtocols,
  fetchDeBankTokens,
} from '../../../lib/api/debank/client';
import type {
  DeBankProtocol,
  DeBankToken,
  RateLimitInfo,
} from '../../../lib/api/debank/types';
import Logger from '../../../shared/utils/Logger';
import { hasKuraBackend } from '../../../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchedWallet {
  address: string;
  /** Optional human-readable label */
  label?: string;
  addedAt: number;
}

export interface DefiToken {
  id: string;
  chain: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  price: number;
  amount: number;
  usdValue: number;
  isVerified: boolean;
}

export interface ProtocolPortfolioItem {
  /** e.g. "supplied", "borrowed", "staked", "reward", "liquidity" */
  type: string;
  tokens: {
    symbol: string;
    amount: number;
    usdValue: number;
    logoUrl: string | null;
  }[];
  usdValue: number;
}

export interface DefiProtocol {
  id: string;
  name: string;
  chain: string;
  logoUrl: string | null;
  siteUrl: string | null;
  netUsdValue: number;
  assetUsdValue: number;
  debtUsdValue: number;
  portfolioItems: ProtocolPortfolioItem[];
}

export interface WalletData {
  address: string;
  label?: string;
  /** Spot token total (deduped against protocol nets). */
  tokenTotalUsdValue: number;
  /** DeFi protocol net total. */
  protocolTotalUsdValue: number;
  tokens: DefiToken[];
  protocols: DefiProtocol[];
  /** null = not yet loaded, true = loading, false = idle */
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TAG = 'DefiPortfolio';
const STORAGE_KEY = 'trackfi_watched_wallets_v1';

function walletKey(address: string): string {
  return address.trim().toLowerCase();
}

export function walletDataKey(address: string): string {
  return walletKey(address);
}

/** Spot token total + protocol net total. */
export function walletPortfolioTotal(data: WalletData): number {
  return (data.tokenTotalUsdValue ?? 0) + (data.protocolTotalUsdValue ?? 0);
}

// Survives DefiPortfolioScreen remounts (e.g. hub ↔ sub-screen navigation).
let sessionWatched: WatchedWallet[] = [];
let sessionWalletData: Record<string, WalletData> = {};
let sessionRateLimitInfo: Record<string, RateLimitInfo | null> = {};
let sessionHydratedFromStorage = false;

/** Clear in-memory DeBank portfolio cache on logout. */
export function resetDefiPortfolioSession(): void {
  sessionWatched = [];
  sessionWalletData = {};
  sessionRateLimitInfo = {};
  sessionHydratedFromStorage = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend DeBank helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapBackendToken(t: DeBankToken): DefiToken {
  const usdValue = t.amount * t.price;
  return {
    id: t.id,
    chain: t.chain,
    symbol: t.symbol,
    name: t.name,
    logoUrl: t.logo || null,
    price: t.price,
    amount: t.amount,
    usdValue,
    isVerified: true,
  };
}

function dedupeWalletTokens(tokens: DefiToken[]): DefiToken[] {
  const seen = new Map<string, DefiToken>();
  for (const token of tokens) {
    const key = `${token.chain}:${token.id}`;
    if (!seen.has(key)) {
      seen.set(key, token);
    }
  }
  return Array.from(seen.values());
}

function mapBackendProtocol(p: DeBankProtocol): DefiProtocol {
  return {
    id: p.id,
    name: p.name,
    chain: p.chain,
    logoUrl: p.logo || null,
    siteUrl: p.siteUrl || null,
    netUsdValue: p.netUsdValue,
    assetUsdValue: p.assetUsdValue,
    debtUsdValue: p.debtUsdValue,
    portfolioItems: p.portfolioItems.map((item) => ({
      type: item.type,
      tokens: item.tokens.map((t) => ({
        symbol: t.symbol,
        amount: t.amount,
        usdValue: t.usdValue,
        logoUrl: t.logo || null,
      })),
      usdValue: item.usdValue,
    })),
  };
}

async function fetchWalletData(
  address: string,
  label?: string,
  refresh = false,
): Promise<{ wallet: WalletData; rateLimitInfo: RateLimitInfo | null }> {
  const [tokensResult, protocolsResult] = await Promise.all([
    fetchDeBankTokens(address, refresh),
    fetchDeBankProtocols(address, refresh),
  ]);

  const rateLimitInfo =
    [tokensResult.rateLimitInfo, protocolsResult.rateLimitInfo].find(
      (info) => info?.limitReached,
    ) ??
    tokensResult.rateLimitInfo ??
    protocolsResult.rateLimitInfo ??
    null;

  const tokens = dedupeWalletTokens(
    filterSpotTokensForDisplay(tokensResult.tokens.map(mapBackendToken)),
  ).sort((a, b) => b.usdValue - a.usdValue);

  const protocols = protocolsResult.protocols
    .map(mapBackendProtocol)
    .sort((a, b) => effectiveProtocolDisplayUsd(b) - effectiveProtocolDisplayUsd(a));

  const totals = computeWalletPortfolioTotals(
    tokensResult.tokens,
    protocolsResult.protocols,
  );

  return {
    wallet: {
      address,
      label,
      tokenTotalUsdValue: totals.tokenTotalUsd,
      protocolTotalUsdValue: totals.protocolTotalUsd,
      tokens,
      protocols,
      isLoading: false,
      error: null,
    },
    rateLimitInfo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useDefiPortfolio() {
  const [watched, setWatched] = useState<WatchedWallet[]>(sessionWatched);
  const [walletData, setWalletData] = useState<Record<string, WalletData>>(sessionWalletData);
  const [rateLimitInfo, setRateLimitInfo] = useState<Record<string, RateLimitInfo | null>>(
    sessionRateLimitInfo,
  );
  const [isInitialising, setIsInitialising] = useState(!sessionHydratedFromStorage);

  // ── Persist helpers ──────────────────────────────────────────────────────

  const saveWatched = useCallback(async (list: WatchedWallet[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  // ── Load persisted addresses on mount ───────────────────────────────────

  useEffect(() => {
    if (sessionHydratedFromStorage) return;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const list: WatchedWallet[] = JSON.parse(raw);
          sessionWatched = list;
          setWatched(list);
        }
      })
      .catch((e) => Logger.warn(TAG, 'Failed to load watched wallets', { e }))
      .finally(() => {
        sessionHydratedFromStorage = true;
        setIsInitialising(false);
      });
  }, []);

  useEffect(() => {
    sessionWatched = watched;
    sessionWalletData = walletData;
    sessionRateLimitInfo = rateLimitInfo;
  }, [watched, walletData, rateLimitInfo]);

  // ── Fetch data for all watched addresses ────────────────────────────────

  const fetchAll = useCallback(
    async (list: WatchedWallet[], forceRefresh = false) => {
      if (!hasKuraBackend() || list.length === 0) return;

      // Mark loading — keep prior balances so the UI does not flash to $0.
      setWalletData((prev) => {
        const next = { ...prev };
        for (const w of list) {
          const key = walletKey(w.address);
          const existing = next[key];
          next[key] = {
            address: w.address,
            label: w.label ?? existing?.label,
            tokenTotalUsdValue: existing?.tokenTotalUsdValue ?? 0,
            protocolTotalUsdValue: existing?.protocolTotalUsdValue ?? 0,
            tokens: existing?.tokens ?? [],
            protocols: existing?.protocols ?? [],
            isLoading: true,
            error: null,
          };
        }
        return next;
      });

      for (const wallet of list) {
        const key = walletKey(wallet.address);
        try {
          Logger.debug(TAG, 'Fetching wallet data', {
            address: wallet.address,
            refresh: forceRefresh,
          });
          const { wallet: data, rateLimitInfo: limitInfo } = await fetchWalletData(
            wallet.address,
            wallet.label,
            forceRefresh,
          );
          setWalletData((prev) => ({ ...prev, [key]: { ...data, address: wallet.address } }));
          setRateLimitInfo((prev) => ({ ...prev, [key]: limitInfo }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to load';
          Logger.warn(TAG, 'Wallet fetch failed', { address: wallet.address, err: msg });
          setWalletData((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? {
                address: wallet.address,
                label: wallet.label,
                tokenTotalUsdValue: 0,
                protocolTotalUsdValue: 0,
                tokens: [],
                protocols: [],
              }),
              isLoading: false,
              error: msg,
            },
          }));
        }
      }
    },
    [],
  );

  // ── Public actions ───────────────────────────────────────────────────────

  const addWallet = useCallback(
    async (address: string, label?: string) => {
      const normalised = address.trim().toLowerCase();
      if (watched.some((w) => w.address.toLowerCase() === normalised)) return;
      const entry: WatchedWallet = {
        address: address.trim(),
        label,
        addedAt: Date.now(),
      };
      const next = [...watched, entry];
      setWatched(next);
      await saveWatched(next);
      await fetchAll(next, false);
    },
    [watched, saveWatched, fetchAll],
  );

  const removeWallet = useCallback(
    async (address: string) => {
      const next = watched.filter(
        (w) => w.address.toLowerCase() !== address.toLowerCase(),
      );
      setWatched(next);
      setWalletData((prev) => {
        const next2 = { ...prev };
        delete next2[walletKey(address)];
        return next2;
      });
      setRateLimitInfo((prev) => {
        const next2 = { ...prev };
        delete next2[walletKey(address)];
        return next2;
      });
      await saveWatched(next);
    },
    [watched, saveWatched],
  );

  const loadCached = useCallback(() => fetchAll(watched, false), [fetchAll, watched]);
  const refresh = useCallback(() => fetchAll(watched, true), [fetchAll, watched]);

  const totalUsdValue = Object.values(walletData).reduce(
    (sum, d) => sum + walletPortfolioTotal(d),
    0,
  );

  const anyRateLimited = Object.values(rateLimitInfo).some(
    (info) => info?.limitReached,
  );

  return {
    watched,
    walletData,
    rateLimitInfo,
    anyRateLimited,
    isInitialising,
    totalUsdValue,
    addWallet,
    removeWallet,
    loadCached,
    refresh,
  };
}
