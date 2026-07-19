import { StateCreator } from 'zustand';
import { Web3State, SyncWalletPayload, Investment, InvestmentAccount, ChainMarketMeta, FinanceState } from './types';
import Logger from '../../utils/Logger';
import { coingeckoFetch } from '../../../lib/api/coingecko/client';

// ============================================================================
// Constants
// ============================================================================

const CHAIN_MARKET_META: Record<number, ChainMarketMeta> = {
  1: {
    coingeckoId: 'ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    fallbackName: 'Ethereum',
  },
  137: {
    coingeckoId: 'matic-network',
    logo: 'https://assets.coingecko.com/coins/images/4713/large/polygon.png',
    fallbackName: 'Polygon',
  },
  42161: {
    coingeckoId: 'ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    fallbackName: 'Arbitrum ETH',
  },
  43114: {
    coingeckoId: 'avalanche-2',
    logo: 'https://assets.coingecko.com/coins/images/12559/large/avalanche-horizontal-red.png',
    fallbackName: 'Avalanche',
  },
  56: {
    coingeckoId: 'binancecoin',
    logo: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png',
    fallbackName: 'Binance Smart Chain',
  },
  250: {
    coingeckoId: 'fantom',
    logo: 'https://assets.coingecko.com/coins/images/4001/large/Fantom.png',
    fallbackName: 'Fantom',
  },
};

// 價格快取 - 減少 API 請求
const PRICE_CACHE: Record<
  string,
  { prices: Record<string, number>; changes: Record<string, number>; timestamp: number }
> = {};
const CACHE_DURATION = 300000; // 5 分鐘

// 支援的貨幣
const SUPPORTED_CURRENCIES = ['usd', 'eur', 'twd', 'cny', 'jpy', 'ngn'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 從快取或 CoinGecko 獲取多種貨幣的價格
 */
async function getCoinPrice(
  coingeckoId: string,
  currency: string = 'usd'
): Promise<{ price: number; change24h: number }> {
  const now = Date.now();
  const cacheKey = coingeckoId;

  // 檢查快取
  const cached = PRICE_CACHE[cacheKey];
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    if (cached.prices[currency]) {
      Logger.info(
        'Web3Slice',
        `💰 Price from cache: ${cached.prices[currency].toFixed(2)} ${currency.toUpperCase()}`,
        {
          coingeckoId,
          currency,
          age: `${((now - cached.timestamp) / 1000).toFixed(0)}s`,
        }
      );
      return {
        price: cached.prices[currency],
        change24h: cached.changes[currency] ?? 0,
      };
    }
  }

  // 從 CoinGecko 獲取價格（shared client handles 429 retry + in-flight dedup）
  try {
    const currencyList = SUPPORTED_CURRENCIES.join(',');
    const url =
      `/simple/price?ids=${coingeckoId}&vs_currencies=${currencyList}&include_24hr_change=true`;
    const response = await coingeckoFetch(url);

    if (response.ok) {
      const data = await response.json();

      if (data[coingeckoId]) {
        const prices: Record<string, number> = {};
        const changes: Record<string, number> = {};

        SUPPORTED_CURRENCIES.forEach((curr) => {
          prices[curr] = data[coingeckoId][curr] ?? 0;
          changes[curr] = data[coingeckoId][`${curr}_24h_change`] ?? 0;
        });

        PRICE_CACHE[cacheKey] = { prices, changes, timestamp: now };

        Logger.info('Web3Slice', `💰 Price from CoinGecko: ${prices[currency].toFixed(2)} ${currency.toUpperCase()}`, {
          coingeckoId,
          currency,
        });

        return {
          price: prices[currency],
          change24h: changes[currency],
        };
      }
    }

    Logger.warn('Web3Slice', `⚠️ CoinGecko HTTP ${response.status}`);
  } catch (err) {
    Logger.error('Web3Slice', '❌ Price fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (cached) {
    return {
      price: cached.prices[currency] ?? 0,
      change24h: cached.changes[currency] ?? 0,
    };
  }

  return { price: 0, change24h: 0 };
}

// ============================================================================
// Web3 Slice
// ============================================================================

/**
 * Web3 Slice - 處理 Web3 錢包同步
 * 包括：同步錢包位置、移除錢包位置
 */
export const createWeb3Slice: StateCreator<FinanceState, [], [], Web3State> = (set, get, _api) => ({
  // ========================================================================
  // Web3 Wallet Operations
  // ========================================================================

  syncConnectedWalletPosition: async ({
    address,
    chainId,
    chainName,
    nativeSymbol,
    nativeBalance,
  }: SyncWalletPayload) => {
    const normalizedAddress = address.toLowerCase();
    const accountId = `wallet-${chainId}-${normalizedAddress}`;
    const assetId = `wallet-native-${chainId}-${normalizedAddress}`;
    const chainMeta = CHAIN_MARKET_META[chainId];

    Logger.info('Web3Slice', '📥 syncConnectedWalletPosition called with:', {
      address: normalizedAddress.substring(0, 6) + '...',
      chainId,
      chainName,
      nativeSymbol,
      nativeBalance,
      accountId,
      assetId,
      chainMetaExists: !!chainMeta,
    });

    let currentPrice = 0;
    let change24h = 0;

    if (chainMeta) {
      const preferredCurrency = get().currency;
      const priceData = await getCoinPrice(chainMeta.coingeckoId, preferredCurrency);
      currentPrice = priceData.price;
      change24h = priceData.change24h;
    } else {
      Logger.warn('Web3Slice', `⚠️ No chainMeta for chainId ${chainId}`);
    }

    const walletAccount: InvestmentAccount = {
      id: accountId,
      name: `${chainName} Wallet`,
      type: 'Web3 Wallet',
      logo: 'https://www.google.com/s2/favicons?domain=walletconnect.com&sz=128',
    };

    const walletAsset: Investment = {
      id: assetId,
      accountId,
      symbol: nativeSymbol,
      name: chainMeta?.fallbackName ?? nativeSymbol,
      holdings: nativeBalance,
      currentPrice,
      change24h,
      usdValue: nativeBalance * currentPrice,
      type: 'crypto',
      logo:
        chainMeta?.logo ?? 'https://www.google.com/s2/favicons?domain=ethereum.org&sz=128',
    };

    Logger.info('Web3Slice', '✅ Created wallet objects:', {
      walletAccount: JSON.stringify(walletAccount),
      walletAsset: JSON.stringify(walletAsset),
    });

    set((state) => {
      const updatedAccounts = [
        ...state.investmentAccounts.filter((account) => account.id !== accountId),
        walletAccount,
      ];
      const updatedInvestments = [
        ...state.investments.filter((investment) => investment.id !== assetId),
        walletAsset,
      ];

      Logger.info('Web3Slice', '✅ Updating store state with wallet data:', {
        accountsCount: updatedAccounts.length,
        investmentsCount: updatedInvestments.length,
        accountIds: updatedAccounts.map((a) => a.id),
        investmentIds: updatedInvestments.map((i) => i.id),
      });

      return {
        investmentAccounts: updatedAccounts,
        investments: updatedInvestments,
      };
    });

    Logger.info('Web3Slice', '✅ Wallet position synced to store', {
      address: normalizedAddress.substring(0, 6) + '...',
      balance: nativeBalance,
      accountId,
    });
  },

  removeConnectedWalletPosition: (address: string, chainId: number) => {
    const normalizedAddress = address.toLowerCase();
    const accountId = `wallet-${chainId}-${normalizedAddress}`;
    const assetId = `wallet-native-${chainId}-${normalizedAddress}`;

    Logger.debug('Web3Slice', 'Removing wallet position', {
      address: normalizedAddress,
      chainId,
    });

    set((state) => ({
      investmentAccounts: state.investmentAccounts.filter(
        (account) => account.id !== accountId
      ),
      investments: state.investments.filter((investment) => investment.id !== assetId),
    }));

    Logger.info('Web3Slice', 'Wallet position removed');
  },
});
