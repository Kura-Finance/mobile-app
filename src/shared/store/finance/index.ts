import { create } from 'zustand';
import { FinanceState } from './types';
import { createUISlice } from './uiSlice';
import { createAccountSlice } from './accountSlice';
import { createPlaidSlice } from './plaidSlice';
import { createWeb3Slice } from './web3Slice';
import { createHistorySlice } from './historySlice';

/**
 * Main Finance Store - 組合所有 Slice 的主入口
 *
 * 使用 Zustand 的組合模式，將多個 slice 結合成一個統一的 store
 */
export const useFinanceStore = create<FinanceState>((set, get, api) => ({
  // Combine all slices
  ...createUISlice(set, get, api),
  ...createAccountSlice(set, get, api),
  ...createPlaidSlice(set, get, api),
  ...createWeb3Slice(set, get, api),
  ...createHistorySlice(set, get, api),
}));

// Export all types
export * from './types';
