import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppKit } from '@reown/appkit-react-native';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';
import { useFinanceStore } from '../store/finance';
import Logger from '../utils/Logger';
import { isPlaidOAuthInProgress } from '../utils/plaidOAuthState';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  56: 'Binance Smart Chain',
  250: 'Fantom',
};

const CHAIN_NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH',
  137: 'MATIC',
  42161: 'ETH',
  43114: 'AVAX',
  56: 'BNB',
  250: 'FTM',
};

const RPC_URLS: Record<number, string> = {
  1: 'https://eth-mainnet.public.blastapi.io',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
  56: 'https://bsc-dataseed1.binance.org:443',
  250: 'https://rpc.ftm.tools',
};

// Provider 缓存 - 避免重复创建 RPC 连接
const providerCache: Record<number, ethers.JsonRpcProvider> = {};

function getProvider(chainId: number): ethers.JsonRpcProvider {
  if (!providerCache[chainId]) {
    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chainId ${chainId}`);
    }
    providerCache[chainId] = new ethers.JsonRpcProvider(rpcUrl);
  }
  return providerCache[chainId];
}

/**
 * Fetch native token balance for a wallet address on a specific chain
 * Uses AbortController to prevent duplicate concurrent requests
 */
async function fetchNativeBalance(
  address: string, 
  chainId: number,
  signal?: AbortSignal
): Promise<number> {
  try {
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    const provider = getProvider(chainId);
    const balanceWei = await provider.getBalance(address);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));
    
    return balanceEth;
  } catch (err) {
    if (err instanceof Error && err.message === 'Request aborted') {
      Logger.debug('useWalletSync', 'Balance fetch cancelled');
      return 0;
    }
    Logger.error('useWalletSync', 'Balance fetch failed', {
      error: err instanceof Error ? err.message : String(err),
      chainId,
      address: address.substring(0, 6) + '...',
    });
    return 0;
  }
}

/**
 * Unified hook for wallet connection management and sync
 * Uses AppKit's native connection events and efficient AsyncStorage checks
 */
export function useWalletSync() {
  const { open: openAppKit } = useAppKit();
  const syncConnectedWalletPosition = useFinanceStore((state) => state.syncConnectedWalletPosition);
  const removeConnectedWalletPosition = useFinanceStore((state) => state.removeConnectedWalletPosition);
  
  // Store stable references to prevent dependency issues
  const syncFunctionRef = useRef(syncConnectedWalletPosition);
  const removeFunctionRef = useRef(removeConnectedWalletPosition);
  
  // Update refs when functions change (but don't trigger re-renders)
  useEffect(() => {
    syncFunctionRef.current = syncConnectedWalletPosition;
    removeFunctionRef.current = removeConnectedWalletPosition;
  }, [syncConnectedWalletPosition, removeConnectedWalletPosition]);
  
  // 管理连接状态
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  
  const prevStateRef = useRef<{ address?: string; chainId?: number }>({});
  const balanceFetchRef = useRef<AbortController | null>(null);
  const syncInProgressRef = useRef(false);
  const initializedRef = useRef(false);

  // 将同步逻辑提取为 useCallback，这样可以在任何地方调用
  const performSync = useCallback(async () => {
    // 防止同时进行多个同步操作
    if (syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;

    try {
      // 取消之前的请求
      if (balanceFetchRef.current) {
        balanceFetchRef.current.abort();
      }

      const namespaceKeys = await AsyncStorage.getAllKeys();
      const namespacesKey = namespaceKeys.find(key => 
        key.includes('universal_provider') && key.includes('/namespaces')
      );

      let address: string | undefined;
      let chainId: number | undefined;

      if (namespacesKey) {
        const namespacesData = await AsyncStorage.getItem(namespacesKey);
        
        if (namespacesData) {
          const namespaces = JSON.parse(namespacesData);
          const eip155 = namespaces.eip155;
          
          if (eip155?.accounts && eip155.accounts.length > 0) {
            const accountString = eip155.accounts[0];
            const [, chainIdStr, parsedAddress] = accountString.split(':');
            address = parsedAddress;
            chainId = parseInt(chainIdStr, 10);
          }
        }
      }

      // 监听断开连接
      if (prevStateRef.current.address && !address) {
        const prevAddress = prevStateRef.current.address;
        const prevChainId = prevStateRef.current.chainId || 1;
        
        removeFunctionRef.current(prevAddress, prevChainId);
        
        // 更新状态
        setIsConnected(false);
        setAddress(undefined);
        setChainId(undefined);
        
        Logger.warn('useWalletSync', '🔌 Wallet disconnected');
        
        prevStateRef.current = {};
        return;
      }

      // 如果未连接或信息不完整
      if (!address || !chainId) {
        return;
      }

      // 检查是否是新连接
      const isNewConnection = 
        !prevStateRef.current.address || 
        address !== prevStateRef.current.address || 
        chainId !== prevStateRef.current.chainId;

      if (!isNewConnection) {
        return;
      }

      prevStateRef.current = { address, chainId };

      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      const nativeSymbol = CHAIN_NATIVE_SYMBOLS[chainId] || 'TOKEN';

      Logger.info('useWalletSync', '🔗 Wallet connected: ' + chainName, {
        address: address.substring(0, 6) + '...',
        chainId,
      });

      // 更新连接状态
      setIsConnected(true);
      setAddress(address);
      setChainId(chainId);

      try {
        // 创建 AbortController 用于取消请求
        balanceFetchRef.current = new AbortController();
        
        // 获取原生代币余额
        const nativeBalance = await fetchNativeBalance(
          address, 
          chainId,
          balanceFetchRef.current.signal
        );

        // 同步到 Finance Store
        await syncFunctionRef.current({
          address,
          chainId,
          chainName,
          nativeSymbol,
          nativeBalance,
        });

        Logger.info('useWalletSync', '✅ Wallet synced: ' + nativeSymbol, {
          balance: nativeBalance,
          address: address.substring(0, 6) + '...',
        });
      } catch (err) {
        Logger.error('useWalletSync', '❌ Wallet sync failed', {
          error: err instanceof Error ? err.message : String(err),
          chainId,
        });
      }
    } catch (err) {
      Logger.error('useWalletSync', 'Failed to check wallet state', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      syncInProgressRef.current = false;
    }
  }, []);

  // 初始化时检查一次连接状态（仅一次）
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    performSync();
  }, []); // 空依赖数组 - 仅运行一次

  // 定期检查（30分钟）以防止长时间未同步
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSync();
    }, 30 * 60 * 1000); // 增加到 30 分钟

    return () => clearTimeout(timeoutId);
  }, [performSync]);

  // 监听 App 生命周期 - 进入前台时检查钱包状态
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // Skip the on-foreground sync while a Plaid OAuth handoff is in flight.
        // The bank auth backgrounds/foregrounds the app repeatedly; re-rendering
        // the wallet/dashboard mid-handoff can tear down the Plaid modal's host
        // and abort OAuth before onSuccess fires.
        if (isPlaidOAuthInProgress()) {
          Logger.debug('useWalletSync', 'Skipping foreground sync — Plaid OAuth in progress');
          return;
        }
        performSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [performSync]);

  return {
    isConnected,
    address,
    chainId,
    openWallet: useCallback(async () => {
      try {
        if (openAppKit) {
          Logger.info('useWalletSync', '🔓 Opening AppKit modal');
          const result = await openAppKit();
          // 打开后等待更长时间，让 AppKit 有時間更新狀態并保存到 AsyncStorage
          setTimeout(() => {
            performSync();
          }, 2000); // 增加到 2 秒
          return result;
        }
        throw new Error('AppKit not initialized');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        Logger.error('useWalletSync', '❌ Failed to open AppKit', { error: errorMsg });
        throw err;
      }
    }, [openAppKit, performSync]),
    
    // 手动刷新钱包数据（用于下拉刷新或按钮点击）
    refreshBalance: useCallback(async () => {
      // 立即触发一次检查
      await (async () => {
        try {
          const namespaceKeys = await AsyncStorage.getAllKeys();
          const namespacesKey = namespaceKeys.find(key => 
            key.includes('universal_provider') && key.includes('/namespaces')
          );

          if (!namespacesKey) {
            return;
          }

          const namespacesData = await AsyncStorage.getItem(namespacesKey);
          if (!namespacesData) {
            return;
          }

          const namespaces = JSON.parse(namespacesData);
          const eip155 = namespaces.eip155;
          
          if (!(eip155?.accounts && eip155.accounts.length > 0)) {
            return;
          }

          const accountString = eip155.accounts[0];
          const [, chainIdStr, address] = accountString.split(':');
          const chainId = parseInt(chainIdStr, 10);

          const nativeBalance = await fetchNativeBalance(address, chainId);
          const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
          const nativeSymbol = CHAIN_NATIVE_SYMBOLS[chainId] || 'TOKEN';
          
          await syncConnectedWalletPosition({
            address,
            chainId,
            chainName,
            nativeSymbol,
            nativeBalance,
          });
          
          Logger.info('useWalletSync', '✅ Manual refresh complete');
        } catch (err) {
          Logger.error('useWalletSync', 'Manual refresh failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }, [syncConnectedWalletPosition]),
    
    // 获取当前连接状态
    getConnectionStatus: useCallback(async () => {
      try {
        const namespaceKeys = await AsyncStorage.getAllKeys();
        const namespacesKey = namespaceKeys.find(key => 
          key.includes('universal_provider') && key.includes('/namespaces')
        );

        if (!namespacesKey) {
          return { isConnected: false, address: undefined, chainId: undefined };
        }

        const namespacesData = await AsyncStorage.getItem(namespacesKey);
        if (!namespacesData) {
          return { isConnected: false, address: undefined, chainId: undefined };
        }

        const namespaces = JSON.parse(namespacesData);
        const eip155 = namespaces.eip155;
        
        if (!(eip155?.accounts && eip155.accounts.length > 0)) {
          return { isConnected: false, address: undefined, chainId: undefined };
        }

        const accountString = eip155.accounts[0];
        const [, chainIdStr, address] = accountString.split(':');
        const chainId = parseInt(chainIdStr, 10);

        return { isConnected: true, address, chainId };
      } catch (err) {
        Logger.error('useWalletSync', 'Failed to get connection status', {
          error: err instanceof Error ? err.message : String(err),
        });
        return { isConnected: false, address: undefined, chainId: undefined };
      }
    }, []),
  };
}
